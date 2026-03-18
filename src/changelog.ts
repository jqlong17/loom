import * as fs from "fs/promises";
import * as path from "path";
import { simpleGit } from "simple-git";

const CHANGELOG_FILE = "CHANGELOG.md";

export interface ChangelogResult {
  filePath: string;
  date: string;
  added: number;
  totalForDate: number;
  highlights: string[];
}

function normalizeDate(date?: string): string {
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return new Date().toISOString().slice(0, 10);
}

function buildHeader(): string {
  return [
    "# CHANGELOG",
    "",
    "公开记录 Loom 项目每日粒度的核心功能变化（中文）。",
    "",
    "- 只记录核心能力升级，不记录琐碎改动",
    "- 同一天多次更新会合并到同一日期下",
    "",
  ].join("\n");
}

function dedupe(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const key = line.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(line.trim());
  }
  return out;
}

export async function updateChangelog(
  workDir: string,
  highlights: string[],
  date?: string,
): Promise<ChangelogResult> {
  const targetDate = normalizeDate(date);
  const filePath = path.join(workDir, CHANGELOG_FILE);
  const newItems = dedupe(highlights).map((h) => `- ${h}`);

  let raw = "";
  try {
    raw = await fs.readFile(filePath, "utf-8");
  } catch {
    raw = buildHeader();
  }

  const heading = `## ${targetDate}`;
  let updated = raw;

  if (!raw.includes(heading)) {
    const section = `${heading}\n\n${newItems.join("\n")}\n\n`;
    updated = `${raw.trimEnd()}\n\n${section}`;
    await fs.writeFile(filePath, updated, "utf-8");
    return {
      filePath,
      date: targetDate,
      added: newItems.length,
      totalForDate: newItems.length,
      highlights: newItems.map((i) => i.slice(2)),
    };
  }

  const lines = raw.split("\n");
  const start = lines.findIndex((l) => l.trim() === heading);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) {
      end = i;
      break;
    }
  }

  const sectionLines = lines.slice(start + 1, end);
  const existingItems = sectionLines
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "));
  const merged = dedupe([...existingItems, ...newItems]);
  const added = merged.length - existingItems.length;

  const newSection = ["", ...merged, ""];
  const nextLines = [
    ...lines.slice(0, start + 1),
    ...newSection,
    ...lines.slice(end),
  ];

  updated = nextLines.join("\n").replace(/\n{3,}/g, "\n\n");
  await fs.writeFile(filePath, updated, "utf-8");

  return {
    filePath,
    date: targetDate,
    added,
    totalForDate: merged.length,
    highlights: merged.map((i) => i.slice(2)),
  };
}

function mapCommitToHighlight(message: string): string | null {
  const msg = message.trim();

  const skipPatterns = [
    /^loom: add (concepts|decisions|threads)\//i,
    /^loom: initialize knowledge base/i,
    /^loom: update changelog/i,
  ];
  if (skipPatterns.some((re) => re.test(msg))) return null;

  if (/incremental weave|append|section/i.test(msg)) {
    return "新增 `loom_weave` 增量模式（`replace` / `append` / `section`）";
  }
  if (/deprecate/i.test(msg)) {
    return "新增 `loom_deprecate`：可将旧条目标记废弃并指向替代方案";
  }
  if (/reflection|reflect/i.test(msg)) {
    return "新增 `loom_reflect`：知识库体检（冲突、过期、缺标签、可合并项）";
  }
  if (/cross-client|claude|opencode|codex/i.test(msg)) {
    return "完善多客户端接入文档：Cursor、VS Code Copilot、Claude Code、OpenCode、Codex CLI";
  }
  if (/upgrade/i.test(msg)) {
    return "新增 `loom_upgrade`：支持从 GitHub 拉取 Loom 本体更新";
  }
  if (/trace|retriev|search/i.test(msg)) {
    return "增强 `loom_trace`：支持分类/标签过滤、limit 与相关性排序";
  }

  return null;
}

export async function collectDailyHighlightsFromGit(
  workDir: string,
  date?: string,
): Promise<string[]> {
  const targetDate = normalizeDate(date);
  const git = simpleGit(workDir);
  const log = await git.log({ maxCount: 200 });
  const msgs = log.all
    .filter((c) => c.date.startsWith(targetDate))
    .map((c) => c.message);

  const mapped = msgs
    .map((m) => mapCommitToHighlight(m))
    .filter((x): x is string => Boolean(x));
  return dedupe(mapped);
}

