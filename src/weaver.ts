import * as fs from "fs/promises";
import * as path from "path";
import { MCP_READ_LIMITS_DEFAULTS, type LoomCategory } from "./config.js";
import { slugify } from "./utils/slug.js";
import { appendEvent } from "./events.js";

export type WeaveMode = "replace" | "append" | "section";

export interface KnowledgeEntry {
  title: string;
  category: LoomCategory;
  content: string;
  tags?: string[];
  links?: string[];
  domain?: string;
  mode?: WeaveMode;
}

interface Frontmatter {
  created?: string;
  updated: string;
  tags: string;
  links?: string;
  domain?: string;
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
    links: entry.links?.join(", ") ?? existing?.links,
    domain: entry.domain ?? existing?.domain,
    category: entry.category,
    status: "active",
  };
  const lines = Object.entries(fm)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${v}`);
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
  whyMatched?: string[];
  whySummary?: string;
}

export interface TraceOptions {
  category?: LoomCategory;
  tags?: string[];
  limit?: number;
  traceMode?: "legacy" | "layered";
}

export interface CatalogItem {
  id: string;
  title: string;
  category: LoomCategory;
  filePath: string;
  tags: string[];
  domain?: string;
  updated: string;
  status: "active" | "deprecated" | "unknown";
}

export interface DigestItem {
  id: string;
  summary: string;
  keyPoints: string[];
  relatedLinks: string[];
  qualityFlags: string[];
}

export interface GraphEdge {
  from: string;
  to: string;
  type: "link" | "domain";
}

export interface GraphSnapshot {
  nodes: string[];
  edges: GraphEdge[];
}

interface IndexArtifacts {
  catalog: CatalogItem[];
  digest: DigestItem[];
  graph: GraphSnapshot;
}

function getIndexDir(loomRoot: string): string {
  return path.join(loomRoot, "index");
}

function getIndexPaths(loomRoot: string): {
  catalogPath: string;
  digestPath: string;
  graphPath: string;
  metaPath: string;
} {
  const indexDir = getIndexDir(loomRoot);
  return {
    catalogPath: path.join(indexDir, "catalog.v1.json"),
    digestPath: path.join(indexDir, "digest.v1.json"),
    graphPath: path.join(indexDir, "graph.v1.json"),
    metaPath: path.join(indexDir, "build-meta.v1.json"),
  };
}

async function writeIndexArtifacts(
  loomRoot: string,
  artifacts: IndexArtifacts,
): Promise<void> {
  const { catalogPath, digestPath, graphPath, metaPath } = getIndexPaths(loomRoot);
  await fs.mkdir(path.dirname(catalogPath), { recursive: true });
  await fs.writeFile(catalogPath, JSON.stringify(artifacts.catalog, null, 2), "utf-8");
  await fs.writeFile(digestPath, JSON.stringify(artifacts.digest, null, 2), "utf-8");
  await fs.writeFile(graphPath, JSON.stringify(artifacts.graph, null, 2), "utf-8");
  await fs.writeFile(
    metaPath,
    JSON.stringify(
      {
        schema: "loom.index.meta.v1",
        generatedAt: new Date().toISOString(),
        counts: {
          catalog: artifacts.catalog.length,
          digest: artifacts.digest.length,
          nodes: artifacts.graph.nodes.length,
          edges: artifacts.graph.edges.length,
        },
      },
      null,
      2,
    ),
    "utf-8",
  );
}

async function readIndexArtifacts(loomRoot: string): Promise<IndexArtifacts | null> {
  const { catalogPath, digestPath, graphPath } = getIndexPaths(loomRoot);
  try {
    const [catalogRaw, digestRaw, graphRaw] = await Promise.all([
      fs.readFile(catalogPath, "utf-8"),
      fs.readFile(digestPath, "utf-8"),
      fs.readFile(graphPath, "utf-8"),
    ]);
    return {
      catalog: JSON.parse(catalogRaw) as CatalogItem[],
      digest: JSON.parse(digestRaw) as DigestItem[],
      graph: JSON.parse(graphRaw) as GraphSnapshot,
    };
  } catch {
    return null;
  }
}

function extractKeyPoints(raw: string): string[] {
  const bodyStart = raw.indexOf("---", 4);
  const body = bodyStart > 0 ? raw.slice(bodyStart + 3) : raw;
  const headingPoints = body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("## "))
    .map((line) => line.slice(3).trim())
    .filter(Boolean);
  if (headingPoints.length > 0) {
    return headingPoints.slice(0, 5);
  }
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter(Boolean)
    .slice(0, 5);
}

function deriveQualityFlags(record: KnowledgeRecord): string[] {
  const flags: string[] = [];
  if (record.tags.length === 0) flags.push("missing_tags");
  if (record.status !== "active") flags.push(record.status);
  if (record.links.length === 0) flags.push("weak_connectivity");
  return flags;
}

export async function buildIndexArtifacts(loomRoot: string): Promise<IndexArtifacts> {
  const records = await loadRecords(loomRoot, true);
  const catalog: CatalogItem[] = [];
  const digest: DigestItem[] = [];
  const edges: GraphEdge[] = [];
  const byDomain = new Map<string, string[]>();

  for (const record of records) {
    const id = record.filePath;
    catalog.push({
      id,
      title: record.title,
      category: record.category,
      filePath: record.filePath,
      tags: record.tags,
      domain: record.domain,
      updated: record.updated,
      status: record.status,
    });
    const raw = await fs.readFile(path.join(loomRoot, record.filePath), "utf-8");
    digest.push({
      id,
      summary: truncateForIndex(extractSnippet(raw, ""), 260),
      keyPoints: extractKeyPoints(raw),
      relatedLinks: record.links,
      qualityFlags: deriveQualityFlags(record),
    });
    for (const target of record.links) {
      edges.push({ from: id, to: normalizeLinkPath(target), type: "link" });
    }
    if (record.domain) {
      const group = byDomain.get(record.domain) ?? [];
      group.push(id);
      byDomain.set(record.domain, group);
    }
  }

  for (const [, nodes] of byDomain) {
    if (nodes.length < 2 || nodes.length > 20) continue;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        edges.push({ from: nodes[i], to: nodes[j], type: "domain" });
      }
    }
  }

  const graph: GraphSnapshot = {
    nodes: catalog.map((c) => c.id),
    edges: dedupeGraphEdges(edges),
  };
  const artifacts = { catalog, digest, graph };
  await writeIndexArtifacts(loomRoot, artifacts);
  return artifacts;
}

function truncateForIndex(text: string, maxChars: number): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= maxChars) return compact;
  return `${compact.slice(0, maxChars)}...`;
}

function dedupeGraphEdges(edges: GraphEdge[]): GraphEdge[] {
  const seen = new Set<string>();
  const out: GraphEdge[] = [];
  for (const edge of edges) {
    const key = `${edge.type}::${edge.from}::${edge.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(edge);
  }
  return out;
}

interface KnowledgeRecord {
  title: string;
  category: LoomCategory;
  filePath: string;
  tags: string[];
  links: string[];
  domain?: string;
  status: "active" | "deprecated" | "unknown";
  updated: string;
}

/** Character-based proxy for token count (≈4 chars/token for English/Markdown). */
export function charsToTokenEstimate(chars: number): number {
  return Math.max(0, Math.ceil(chars / 4));
}

function effectiveTraceResultCap(options: TraceOptions): number {
  if (options.limit !== undefined && options.limit > 0) {
    return Math.floor(options.limit);
  }
  return MCP_READ_LIMITS_DEFAULTS.traceDefaultLimit;
}

export async function trace(
  loomRoot: string,
  query: string,
  options: TraceOptions = {},
): Promise<TraceResult[]> {
  const mode = options.traceMode ?? "layered";
  const resolvedLimit = effectiveTraceResultCap(options);
  const merged: TraceOptions = { ...options, limit: resolvedLimit };
  const { results, contextChars } =
    mode === "legacy"
      ? await traceLegacy(loomRoot, query, merged)
      : await traceLayered(loomRoot, query, merged);
  const retrievedChars = results.reduce((s, r) => s + r.snippet.length, 0);
  const contextTokens = charsToTokenEstimate(contextChars);
  const tokenROI =
    contextTokens > 0 ? retrievedChars / Math.max(1, contextChars) : 0;
  try {
    await appendEvent(loomRoot, {
      type: "index.query.executed",
      ts: new Date().toISOString(),
      payload: {
        query,
        mode,
        category: options.category,
        tags: options.tags,
        limit: resolvedLimit,
        count: results.length,
        contextChars,
        retrievedChars,
        contextTokens,
        tokenROI,
      },
    });
  } catch {
    // keep trace availability even if event append fails
  }
  return results;
}

async function traceLegacy(
  loomRoot: string,
  query: string,
  options: TraceOptions = {},
): Promise<{ results: TraceResult[]; contextChars: number }> {
  const results: TraceResult[] = [];
  let contextChars = 0;
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
      contextChars += raw.length;

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
        whyMatched: ["legacy_full_scan"],
        whySummary: "Legacy full-scan keyword matching.",
      });
    }
  }

  results.sort((a, b) => {
    const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    return Date.parse(b.updated || "") - Date.parse(a.updated || "");
  });

  const cap = effectiveTraceResultCap(options);
  const limited = results.slice(0, cap);
  return { results: limited, contextChars };
}

async function traceLayered(
  loomRoot: string,
  query: string,
  options: TraceOptions,
): Promise<{ results: TraceResult[]; contextChars: number }> {
  const limit = effectiveTraceResultCap(options);
  let contextChars = 0;
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const normalizedQuery = query.toLowerCase().trim();
  const artifacts = (await readIndexArtifacts(loomRoot)) ?? (await buildIndexArtifacts(loomRoot));
  contextChars += JSON.stringify(artifacts.catalog).length;
  const digestMap = new Map(artifacts.digest.map((item) => [item.id, item]));
  const adjacency = new Map<string, Set<string>>();

  for (const edge of artifacts.graph.edges) {
    const from = normalizeLinkPath(edge.from);
    const to = normalizeLinkPath(edge.to);
    const fromSet = adjacency.get(from) ?? new Set<string>();
    fromSet.add(to);
    adjacency.set(from, fromSet);
    const toSet = adjacency.get(to) ?? new Set<string>();
    toSet.add(from);
    adjacency.set(to, toSet);
  }

  const scored = artifacts.catalog
    .filter((item) => {
      if (options.category && item.category !== options.category) return false;
      if (options.tags && options.tags.length > 0) {
        const required = options.tags.map((t) => t.toLowerCase());
        const hasAll = required.every((need) =>
          item.tags.some((existing) => existing.toLowerCase() === need),
        );
        if (!hasAll) return false;
      }
      return item.status !== "deprecated";
    })
    .map((item) => {
      const digest = digestMap.get(item.id);
      const title = item.title.toLowerCase();
      const tagText = item.tags.join(" ").toLowerCase();
      const domain = (item.domain ?? "").toLowerCase();
      const l1Text = `${digest?.summary ?? ""} ${(digest?.keyPoints ?? []).join(" ")}`.toLowerCase();
      let score = 0;
      const whyMatched: string[] = [];
      if (normalizedQuery.length > 0 && title.includes(normalizedQuery)) {
        score += 12;
        whyMatched.push("title_exact");
      }
      if (normalizedQuery.length > 0 && tagText.includes(normalizedQuery)) {
        score += 6;
        whyMatched.push("tag_exact");
      }
      if (normalizedQuery.length > 0 && domain.includes(normalizedQuery)) {
        score += 3;
        whyMatched.push("domain_exact");
      }
      for (const term of terms) {
        if (title.includes(term)) {
          score += 4;
          whyMatched.push(`title_term:${term}`);
        }
        if (tagText.includes(term)) {
          score += 3;
          whyMatched.push(`tag_term:${term}`);
        }
        if (domain.includes(term)) {
          score += 2;
          whyMatched.push(`domain_term:${term}`);
        }
        if (l1Text.includes(term)) {
          score += 2;
          whyMatched.push(`digest_term:${term}`);
        }
      }
      const neighbors = adjacency.get(item.id)?.size ?? 0;
      if (neighbors > 0) {
        score += Math.min(2, neighbors * 0.2);
        whyMatched.push(`graph_neighbors:${neighbors}`);
      }
      return { item, digest, score, whyMatched: Array.from(new Set(whyMatched)) };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => {
      const diff = b.score - a.score;
      if (diff !== 0) return diff;
      return Date.parse(b.item.updated || "") - Date.parse(a.item.updated || "");
    });

  const pool = scored.slice(0, Math.max(limit * 2, 20));
  const expandedIds = new Set(pool.map((p) => p.item.id));
  for (const row of pool.slice(0, Math.min(pool.length, 8))) {
    const neighbors = adjacency.get(row.item.id);
    if (!neighbors) continue;
    for (const neighbor of neighbors) {
      if (expandedIds.has(neighbor)) continue;
      expandedIds.add(neighbor);
    }
  }

  const candidateRows = scored
    .filter((row) => expandedIds.has(row.item.id))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(limit, 5));

  for (const row of candidateRows) {
    const d = digestMap.get(row.item.id);
    if (d) {
      contextChars += (d.summary?.length ?? 0) + (d.keyPoints?.join(" ").length ?? 0);
    }
  }

  const results: TraceResult[] = [];
  for (const row of candidateRows) {
    const abs = path.join(loomRoot, row.item.filePath);
    const raw = await fs.readFile(abs, "utf-8");
    contextChars += raw.length;
    results.push({
      title: row.item.title,
      category: row.item.category,
      filePath: row.item.filePath,
      snippet: extractSnippet(raw, query),
      tags: row.item.tags.join(", ") || "none",
      updated: row.item.updated,
      score: row.score,
      whyMatched: row.whyMatched,
      whySummary: summarizeWhyMatched(row.whyMatched),
    });
    if (results.length >= limit) break;
  }
  return { results, contextChars };
}

function extractSnippet(content: string, query: string): string {
  const bodyStart = content.indexOf("---", 4);
  const body = bodyStart > 0 ? content.slice(bodyStart + 3) : content;
  const normalizedQuery = query.toLowerCase().trim();

  const idx = body.toLowerCase().indexOf(normalizedQuery);
  if (idx < 0) return body.slice(0, 200).trim();

  const start = Math.max(0, idx - 80);
  const end = Math.min(body.length, idx + query.length + 120);
  const snippet = body.slice(start, end).trim();
  return (start > 0 ? "..." : "") + snippet + (end < body.length ? "..." : "");
}

function summarizeWhyMatched(reasons: string[] | undefined): string | undefined {
  if (!reasons || reasons.length === 0) return undefined;
  const labels: string[] = [];
  if (reasons.includes("title_exact")) labels.push("标题精确命中");
  if (reasons.includes("tag_exact")) labels.push("标签精确命中");
  if (reasons.includes("domain_exact")) labels.push("领域精确命中");
  if (reasons.some((r) => r.startsWith("title_term:"))) labels.push("标题词项匹配");
  if (reasons.some((r) => r.startsWith("tag_term:"))) labels.push("标签词项匹配");
  if (reasons.some((r) => r.startsWith("domain_term:"))) labels.push("领域词项匹配");
  if (reasons.some((r) => r.startsWith("digest_term:"))) labels.push("摘要词项匹配");
  const graph = reasons.find((r) => r.startsWith("graph_neighbors:"));
  if (graph) {
    const neighborCount = graph.split(":")[1] ?? "0";
    labels.push(`图邻接增强(${neighborCount})`);
  }
  if (labels.length === 0 && reasons.includes("legacy_full_scan")) {
    return "Legacy 全量扫描关键词匹配";
  }
  if (labels.length === 0) return "关键词匹配";
  return labels.join(" + ");
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
        snippet: extractSnippet(raw, ""),
        tags: fm?.tags ?? "",
        updated: fm?.updated ?? "unknown",
      });
    }
  }

  return results;
}

function toTimestamp(updated: string): number {
  const ts = Date.parse(updated);
  return Number.isNaN(ts) ? 0 : ts;
}

export async function listRecentEntries(
  loomRoot: string,
  limit = 5,
): Promise<TraceResult[]> {
  const all = await listAll(loomRoot);
  all.sort((a, b) => toTimestamp(b.updated) - toTimestamp(a.updated));
  return all.slice(0, Math.max(1, limit));
}

export async function listCoreConcepts(loomRoot: string): Promise<TraceResult[]> {
  const all = await listAll(loomRoot);
  const core = all.filter(
    (item) =>
      item.category === "concepts" &&
      parseTags(item.tags).some((t) => t.toLowerCase() === "core"),
  );
  core.sort((a, b) => toTimestamp(b.updated) - toTimestamp(a.updated));
  return core;
}

function parseTags(tagsRaw: string): string[] {
  if (!tagsRaw || tagsRaw === "none") return [];
  return tagsRaw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function parseLinks(linksRaw: string): string[] {
  if (!linksRaw || linksRaw === "none") return [];
  return linksRaw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function normalizeLinkPath(link: string): string {
  let p = link.trim();
  if (p.startsWith("./")) p = p.slice(2);
  if (p.endsWith(".md")) return p;
  if (p.split("/").length === 2) return `${p}.md`;
  return p;
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
        links: parseLinks(fm?.links ?? "").map(normalizeLinkPath),
        domain: fm?.domain,
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
  type:
    | "conflict"
    | "stale"
    | "missing_tags"
    | "merge_candidate"
    | "deprecated"
    | "isolated_node"
    | "dangling_link";
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

  // 6) Graph hygiene: dangling links and isolated nodes.
  const existingPaths = new Set(records.map((r) => r.filePath));
  const incomingCount = new Map<string, number>();
  for (const r of records) {
    incomingCount.set(r.filePath, 0);
  }

  for (const r of records) {
    for (const rawLink of r.links) {
      const target = normalizeLinkPath(rawLink);
      if (!existingPaths.has(target)) {
        issues.push({
          type: "dangling_link",
          reason: `Entry has dangling link target "${target}": "${r.title}"`,
          files: [r.filePath],
        });
        continue;
      }
      incomingCount.set(target, (incomingCount.get(target) ?? 0) + 1);
    }
  }

  for (const r of records) {
    if (r.status !== "active") continue;
    const outgoing = r.links.filter((l) => existingPaths.has(normalizeLinkPath(l)));
    const incoming = incomingCount.get(r.filePath) ?? 0;
    const isCore = r.tags.some((t) => t.toLowerCase() === "core");
    if (incoming === 0 && outgoing.length === 0 && !isCore) {
      issues.push({
        type: "isolated_node",
        reason: `Entry has no graph links (incoming/outgoing): "${r.title}"`,
        files: [r.filePath],
      });
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
    links: fm?.links ?? "none",
    domain: fm?.domain ?? "none",
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
  await buildIndexArtifacts(loomRoot);
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
  await appendEvent(loomRoot, {
    type: "index.rebuilt",
    ts: new Date().toISOString(),
    payload: {
      totalEntries: all.length,
      categories: Object.fromEntries(
        Object.entries(grouped).map(([cat, items]) => [cat, items.length]),
      ),
      indexPath,
    },
  });
  return indexContent;
}
