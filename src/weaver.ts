import * as fs from "fs/promises";
import * as path from "path";
import { type LoomCategory } from "./config.js";
import { slugify } from "./utils/slug.js";

export type WeaveMode = "replace" | "append" | "section";

export interface KnowledgeEntry {
  title: string;
  category: LoomCategory;
  content: string;
  tags?: string[];
  mode?: WeaveMode;
}

interface Frontmatter {
  created?: string;
  updated: string;
  tags: string;
  category: string;
  status: "active" | "deprecated";
  superseded_by?: string;
}

function buildFrontmatter(
  entry: KnowledgeEntry,
  existing?: Frontmatter,
): string {
  const now = new Date().toISOString();
  const fm: Frontmatter = {
    created: existing?.created ?? now,
    updated: now,
    tags: entry.tags?.join(", ") ?? "none",
    category: entry.category,
    status: "active",
  };
  const lines = Object.entries(fm).map(([k, v]) => `${k}: ${v}`);
  return `---\n${lines.join("\n")}\n---`;
}

function parseFrontmatter(raw: string): Frontmatter | undefined {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return undefined;

  const result: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      result[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }
  return result as unknown as Frontmatter;
}

export function categoryToDir(category: LoomCategory): string {
  return category;
}

function extractBody(raw: string): string {
  const fmEnd = raw.indexOf("---", 4);
  if (fmEnd < 0) return raw;
  const afterFm = raw.slice(fmEnd + 3).trimStart();
  const titleEnd = afterFm.match(/^# .+\n+/);
  if (!titleEnd) return afterFm;
  return afterFm.slice(titleEnd[0].length);
}

export async function weave(
  loomRoot: string,
  entry: KnowledgeEntry,
): Promise<{ filePath: string; isUpdate: boolean; mode: WeaveMode }> {
  const slug = slugify(entry.title);
  const dir = path.join(loomRoot, categoryToDir(entry.category));
  await fs.mkdir(dir, { recursive: true });

  const filePath = path.join(dir, `${slug}.md`);
  let existingRaw: string | undefined;
  let existingFm: Frontmatter | undefined;
  let isUpdate = false;

  try {
    existingRaw = await fs.readFile(filePath, "utf-8");
    existingFm = parseFrontmatter(existingRaw);
    isUpdate = true;
  } catch {
    // new file
  }

  const mode = entry.mode ?? "replace";
  const frontmatter = buildFrontmatter(entry, existingFm);
  let body: string;

  if (!isUpdate || mode === "replace") {
    body = entry.content;
  } else if (mode === "append") {
    const oldBody = extractBody(existingRaw!);
    const separator = `\n\n---\n\n_Appended on ${new Date().toISOString().slice(0, 10)}:_\n\n`;
    body = oldBody.trimEnd() + separator + entry.content;
  } else {
    // "section" mode: replace a matching ## heading, or append as new section
    const oldBody = extractBody(existingRaw!);
    const sectionHeading = entry.content.match(/^## .+/m)?.[0];
    if (sectionHeading) {
      const escaped = sectionHeading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const sectionRe = new RegExp(
        `${escaped}[\\s\\S]*?(?=\\n## |$)`,
      );
      if (sectionRe.test(oldBody)) {
        body = oldBody.replace(sectionRe, entry.content.trimEnd());
      } else {
        body = oldBody.trimEnd() + "\n\n" + entry.content;
      }
    } else {
      body = oldBody.trimEnd() + "\n\n" + entry.content;
    }
  }

  const fileContent = `${frontmatter}\n\n# ${entry.title}\n\n${body}\n`;
  await fs.writeFile(filePath, fileContent, "utf-8");
  return { filePath, isUpdate, mode };
}

export interface TraceResult {
  title: string;
  category: LoomCategory;
  filePath: string;
  snippet: string;
  tags: string;
  updated: string;
  score?: number;
}

export interface TraceOptions {
  category?: LoomCategory;
  tags?: string[];
  limit?: number;
}

interface KnowledgeRecord {
  title: string;
  category: LoomCategory;
  filePath: string;
  tags: string[];
  status: "active" | "deprecated" | "unknown";
  updated: string;
}

export async function trace(
  loomRoot: string,
  query: string,
  options: TraceOptions = {},
): Promise<TraceResult[]> {
  const results: TraceResult[] = [];
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const categories: LoomCategory[] = ["concepts", "decisions", "threads"];

  for (const cat of categories) {
    if (options.category && options.category !== cat) continue;
    const dir = path.join(loomRoot, cat);
    let files: string[];
    try {
      files = await fs.readdir(dir);
    } catch {
      continue;
    }

    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      const filePath = path.join(dir, file);
      const raw = await fs.readFile(filePath, "utf-8");

      const fm = parseFrontmatter(raw);
      const titleMatch = raw.match(/^# (.+)$/m);
      const title = titleMatch?.[1] ?? file.replace(".md", "");
      const tags = parseTags(fm?.tags ?? "");

      if (options.tags && options.tags.length > 0) {
        const required = options.tags.map((t) => t.toLowerCase());
        const hasAll = required.every((need) =>
          tags.some((existing) => existing.toLowerCase() === need),
        );
        if (!hasAll) continue;
      }

      const score = computeTraceScore(raw, title, tags, query, terms);
      if (score <= 0) continue;

      results.push({
        title,
        category: cat,
        filePath: path.relative(loomRoot, filePath),
        snippet: extractSnippet(raw, query),
        tags: fm?.tags ?? "none",
        updated: fm?.updated ?? "unknown",
        score,
      });
    }
  }

  results.sort((a, b) => {
    const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    return Date.parse(b.updated || "") - Date.parse(a.updated || "");
  });

  if (options.limit && options.limit > 0) {
    return results.slice(0, options.limit);
  }

  return results;
}

function extractSnippet(content: string, query: string): string {
  const bodyStart = content.indexOf("---", 4);
  const body = bodyStart > 0 ? content.slice(bodyStart + 3) : content;

  const idx = body.toLowerCase().indexOf(query);
  if (idx < 0) return body.slice(0, 200).trim();

  const start = Math.max(0, idx - 80);
  const end = Math.min(body.length, idx + query.length + 120);
  const snippet = body.slice(start, end).trim();
  return (start > 0 ? "..." : "") + snippet + (end < body.length ? "..." : "");
}

function computeTraceScore(
  raw: string,
  title: string,
  tags: string[],
  query: string,
  terms: string[],
): number {
  const text = raw.toLowerCase();
  const normalizedTitle = title.toLowerCase();
  const normalizedTags = tags.map((t) => t.toLowerCase());
  const q = query.toLowerCase().trim();

  let score = 0;
  if (q.length > 0 && normalizedTitle.includes(q)) {
    score += 12;
  }
  if (q.length > 0 && normalizedTags.some((t) => t.includes(q))) {
    score += 6;
  }

  for (const term of terms) {
    if (normalizedTitle.includes(term)) score += 4;
    if (normalizedTags.some((t) => t.includes(term))) score += 3;
    if (text.includes(term)) score += 1;
  }

  return score;
}

export async function listAll(loomRoot: string): Promise<TraceResult[]> {
  const results: TraceResult[] = [];
  const categories: LoomCategory[] = ["concepts", "decisions", "threads"];

  for (const cat of categories) {
    const dir = path.join(loomRoot, cat);
    let files: string[];
    try {
      files = await fs.readdir(dir);
    } catch {
      continue;
    }

    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      const filePath = path.join(dir, file);
      const raw = await fs.readFile(filePath, "utf-8");
      const fm = parseFrontmatter(raw);
      const titleMatch = raw.match(/^# (.+)$/m);

      results.push({
        title: titleMatch?.[1] ?? file.replace(".md", ""),
        category: cat,
        filePath: path.relative(loomRoot, filePath),
        snippet: raw.slice(0, 200).trim(),
        tags: fm?.tags ?? "",
        updated: fm?.updated ?? "unknown",
      });
    }
  }

  return results;
}

function parseTags(tagsRaw: string): string[] {
  if (!tagsRaw || tagsRaw === "none") return [];
  return tagsRaw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, "")
    .trim();
}

function normalizeKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-");
}

async function loadRecords(
  loomRoot: string,
  includeThreads: boolean,
): Promise<KnowledgeRecord[]> {
  const categories: LoomCategory[] = includeThreads
    ? ["concepts", "decisions", "threads"]
    : ["concepts", "decisions"];

  const records: KnowledgeRecord[] = [];

  for (const cat of categories) {
    const dir = path.join(loomRoot, cat);
    let files: string[];
    try {
      files = await fs.readdir(dir);
    } catch {
      continue;
    }

    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      const absPath = path.join(dir, file);
      const raw = await fs.readFile(absPath, "utf-8");
      const fm = parseFrontmatter(raw);
      const title = raw.match(/^# (.+)$/m)?.[1] ?? file.replace(".md", "");
      records.push({
        title,
        category: cat,
        filePath: path.relative(loomRoot, absPath),
        tags: parseTags(fm?.tags ?? ""),
        status:
          fm?.status === "active" || fm?.status === "deprecated"
            ? fm.status
            : "unknown",
        updated: fm?.updated ?? "unknown",
      });
    }
  }

  return records;
}

export interface ReflectIssue {
  type: "conflict" | "stale" | "missing_tags" | "merge_candidate" | "deprecated";
  reason: string;
  files: string[];
}

export interface ReflectReport {
  scannedEntries: number;
  generatedAt: string;
  issues: ReflectIssue[];
}

export interface ReflectOptions {
  staleDays: number;
  includeThreads: boolean;
  maxFindings: number;
}

export async function reflect(
  loomRoot: string,
  options: ReflectOptions,
): Promise<ReflectReport> {
  const records = await loadRecords(loomRoot, options.includeThreads);
  const issues: ReflectIssue[] = [];
  const nowMs = Date.now();
  const staleThresholdMs = options.staleDays * 24 * 60 * 60 * 1000;

  // 1) Missing tags: weak retrievability and poor structure.
  for (const r of records) {
    if (r.tags.length === 0) {
      issues.push({
        type: "missing_tags",
        reason: `Entry has no tags: "${r.title}"`,
        files: [r.filePath],
      });
    }
  }

  // 2) Deprecated entries: surface them for cleanup decisions.
  for (const r of records) {
    if (r.status === "deprecated") {
      issues.push({
        type: "deprecated",
        reason: `Entry marked deprecated: "${r.title}"`,
        files: [r.filePath],
      });
    }
  }

  // 3) Stale entries: likely drifted from current system behavior.
  for (const r of records) {
    if (r.status !== "active") continue;
    const updatedMs = Date.parse(r.updated);
    if (Number.isNaN(updatedMs)) continue;
    if (nowMs - updatedMs > staleThresholdMs) {
      issues.push({
        type: "stale",
        reason: `Not updated for more than ${options.staleDays} days: "${r.title}"`,
        files: [r.filePath],
      });
    }
  }

  // 4) Duplicate title conflicts across entries.
  const groupsByTitle = new Map<string, KnowledgeRecord[]>();
  for (const r of records) {
    const key = normalizeTitle(r.title);
    const list = groupsByTitle.get(key) ?? [];
    list.push(r);
    groupsByTitle.set(key, list);
  }

  for (const [, group] of groupsByTitle) {
    if (group.length < 2) continue;
    const categories = [...new Set(group.map((g) => g.category))];
    const statuses = [...new Set(group.map((g) => g.status))];
    const files = group.map((g) => g.filePath);

    if (statuses.length > 1) {
      issues.push({
        type: "conflict",
        reason: `Same topic has mixed status (${statuses.join(", ")}): "${group[0].title}"`,
        files,
      });
    } else {
      issues.push({
        type: "merge_candidate",
        reason: `Repeated topic can be consolidated (${group.length} entries across ${categories.length} categories): "${group[0].title}"`,
        files,
      });
    }
  }

  // 5) Tag clusters with many files are consolidation opportunities.
  const byTag = new Map<string, KnowledgeRecord[]>();
  for (const r of records) {
    for (const tag of r.tags) {
      const key = normalizeKey(tag);
      const list = byTag.get(key) ?? [];
      list.push(r);
      byTag.set(key, list);
    }
  }
  for (const [tag, group] of byTag) {
    if (group.length < 3) continue;
    const topFiles = group.slice(0, 5).map((g) => g.filePath);
    issues.push({
      type: "merge_candidate",
      reason: `Tag cluster "${tag}" appears in ${group.length} entries; consider a summary decision/concept`,
      files: topFiles,
    });
  }

  const uniqueIssues = dedupeIssues(issues).slice(0, options.maxFindings);
  return {
    scannedEntries: records.length,
    generatedAt: new Date().toISOString(),
    issues: uniqueIssues,
  };
}

function dedupeIssues(items: ReflectIssue[]): ReflectIssue[] {
  const seen = new Set<string>();
  const out: ReflectIssue[] = [];
  for (const item of items) {
    const key = `${item.type}::${item.reason}::${item.files.slice().sort().join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export async function readKnowledge(
  loomRoot: string,
  category: LoomCategory,
  slug: string,
): Promise<string | null> {
  const filePath = path.join(loomRoot, category, `${slug}.md`);
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

export interface DeprecateResult {
  success: boolean;
  filePath: string;
  message: string;
}

export async function deprecateEntry(
  loomRoot: string,
  category: LoomCategory,
  slug: string,
  reason: string,
  supersededBy?: string,
): Promise<DeprecateResult> {
  const filePath = path.join(loomRoot, category, `${slug}.md`);
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf-8");
  } catch {
    return {
      success: false,
      filePath,
      message: `Entry not found: ${category}/${slug}`,
    };
  }

  const fm = parseFrontmatter(raw);
  if (fm?.status === "deprecated") {
    return {
      success: true,
      filePath,
      message: `Already deprecated: ${category}/${slug}`,
    };
  }

  const now = new Date().toISOString();
  const newFmFields: Record<string, string> = {
    created: fm?.created ?? now,
    updated: now,
    tags: fm?.tags ?? "none",
    category,
    status: "deprecated",
  };
  if (supersededBy) {
    newFmFields.superseded_by = supersededBy;
  }

  const fmLines = Object.entries(newFmFields).map(([k, v]) => `${k}: ${v}`);
  const newFm = `---\n${fmLines.join("\n")}\n---`;

  const fmEnd = raw.indexOf("---", 4);
  const body = fmEnd >= 0 ? raw.slice(fmEnd + 3) : raw;

  const deprecationNotice = `\n\n> **DEPRECATED** (${now.slice(0, 10)}): ${reason}${supersededBy ? ` → See: ${supersededBy}` : ""}\n`;

  const titleMatch = body.match(/^(\s*# .+\n)/m);
  let newBody: string;
  if (titleMatch && titleMatch.index !== undefined) {
    const insertPos = titleMatch.index + titleMatch[0].length;
    newBody =
      body.slice(0, insertPos) + deprecationNotice + body.slice(insertPos);
  } else {
    newBody = deprecationNotice + body;
  }

  await fs.writeFile(filePath, newFm + newBody, "utf-8");
  return {
    success: true,
    filePath,
    message: `Deprecated: ${category}/${slug}`,
  };
}

export async function rebuildIndex(loomRoot: string): Promise<string> {
  const all = await listAll(loomRoot);
  const now = new Date().toISOString();

  const grouped: Record<string, TraceResult[]> = {
    concepts: [],
    decisions: [],
    threads: [],
  };

  for (const item of all) {
    grouped[item.category]?.push(item);
  }

  const sections = Object.entries(grouped)
    .map(([cat, items]) => {
      const heading = `## ${cat.charAt(0).toUpperCase() + cat.slice(1)}`;
      if (items.length === 0) return `${heading}\n\n_No entries yet._`;
      const list = items
        .map(
          (i) =>
            `- [${i.title}](${i.filePath}) — tags: ${i.tags} — updated: ${i.updated}`,
        )
        .join("\n");
      return `${heading}\n\n${list}`;
    })
    .join("\n\n");

  const indexContent = `---
updated: ${now}
total_entries: ${all.length}
---

# Loom System Index

> Auto-generated by Loom. Do not edit manually.

${sections}
`;

  const indexPath = path.join(loomRoot, "index.md");
  await fs.writeFile(indexPath, indexContent, "utf-8");
  return indexContent;
}
