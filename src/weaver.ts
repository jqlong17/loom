import * as fs from "fs/promises";
import * as path from "path";
import { type LoomCategory } from "./config.js";
import { slugify } from "./utils/slug.js";

export interface KnowledgeEntry {
  title: string;
  category: LoomCategory;
  content: string;
  tags?: string[];
}

interface Frontmatter {
  created?: string;
  updated: string;
  tags: string;
  category: string;
  status: "active" | "deprecated";
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

export async function weave(
  loomRoot: string,
  entry: KnowledgeEntry,
): Promise<{ filePath: string; isUpdate: boolean }> {
  const slug = slugify(entry.title);
  const dir = path.join(loomRoot, categoryToDir(entry.category));
  await fs.mkdir(dir, { recursive: true });

  const filePath = path.join(dir, `${slug}.md`);
  let existingFm: Frontmatter | undefined;
  let isUpdate = false;

  try {
    const existing = await fs.readFile(filePath, "utf-8");
    existingFm = parseFrontmatter(existing);
    isUpdate = true;
  } catch {
    // new file
  }

  const frontmatter = buildFrontmatter(entry, existingFm);
  const fileContent = `${frontmatter}\n\n# ${entry.title}\n\n${entry.content}\n`;

  await fs.writeFile(filePath, fileContent, "utf-8");
  return { filePath, isUpdate };
}

export interface TraceResult {
  title: string;
  category: LoomCategory;
  filePath: string;
  snippet: string;
  tags: string;
  updated: string;
}

export async function trace(
  loomRoot: string,
  query: string,
): Promise<TraceResult[]> {
  const results: TraceResult[] = [];
  const q = query.toLowerCase();

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

      if (!raw.toLowerCase().includes(q)) continue;

      const fm = parseFrontmatter(raw);
      const titleMatch = raw.match(/^# (.+)$/m);

      results.push({
        title: titleMatch?.[1] ?? file.replace(".md", ""),
        category: cat,
        filePath: path.relative(loomRoot, filePath),
        snippet: extractSnippet(raw, q),
        tags: fm?.tags ?? "",
        updated: fm?.updated ?? "unknown",
      });
    }
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
