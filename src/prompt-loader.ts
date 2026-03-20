import * as fs from "fs/promises";
import * as path from "path";
import type { LoomConfig } from "./config.js";

export interface PromptManifest {
  defaultVersion: string;
  versions: string[];
  locales: string[];
}

export interface ToolPromptFile {
  description: string;
  params: Record<string, string>;
}

export interface LoadedPrompts {
  version: string;
  locale: string;
  loomInstructions: string;
  describeTool(name: string, fallback: string): string;
  describeParam(tool: string, param: string, fallback: string): string;
}

const TOOL_NAMES = [
  "loom_init",
  "loom_weave",
  "loom_ingest",
  "loom_doctor",
  "loom_trace",
  "loom_index",
  "loom_probe_start",
  "loom_probe_commit",
  "loom_probe",
  "loom_read",
  "loom_list",
  "loom_sync",
  "loom_log",
  "loom_changelog",
  "loom_metrics_snapshot",
  "loom_metrics_report",
  "loom_events",
  "loom_upgrade",
  "loom_deprecate",
  "loom_reflect",
] as const;

/** Strip optional YAML frontmatter */
export function stripFrontmatter(md: string): string {
  const t = md.replace(/^\uFEFF/, "").trimStart();
  if (!t.startsWith("---")) return md;
  const end = t.indexOf("\n---", 3);
  if (end === -1) return md;
  return t.slice(end + 4).trimStart();
}

/**
 * Parse tool MD: # 工具说明 ... then ## 参数：key blocks
 */
export function parseToolMarkdown(markdown: string): ToolPromptFile {
  const md = stripFrontmatter(markdown);
  const lines = md.split(/\r?\n/);
  const params: Record<string, string> = {};
  let i = 0;
  let description = "";

  const isToolHeading = (line: string) =>
    /^#\s+工具说明\s*$/.test(line) || /^##\s+工具说明\s*$/.test(line);
  const paramMatch = (line: string) => line.match(/^##\s*参数[：:]\s*([a-zA-Z0-9_]+)\s*$/);

  if (i < lines.length && isToolHeading(lines[i]!)) {
    i++;
    const buf: string[] = [];
    while (i < lines.length) {
      const m = paramMatch(lines[i]!);
      if (m) break;
      buf.push(lines[i]!);
      i++;
    }
    description = buf.join("\n").trim();
  } else {
    const buf: string[] = [];
    while (i < lines.length) {
      const m = paramMatch(lines[i]!);
      if (m) break;
      buf.push(lines[i]!);
      i++;
    }
    description = buf.join("\n").trim();
  }

  while (i < lines.length) {
    const m = paramMatch(lines[i]!);
    if (!m) {
      i++;
      continue;
    }
    const key = m[1]!;
    i++;
    const buf: string[] = [];
    while (i < lines.length) {
      const m2 = paramMatch(lines[i]!);
      if (m2) break;
      buf.push(lines[i]!);
      i++;
    }
    const text = buf.join("\n").trim();
    if (text) params[key] = text;
  }

  return { description, params };
}

async function readTextIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

export async function loadPromptBundle(
  serverRoot: string,
  workDir: string,
  config: LoomConfig,
): Promise<LoadedPrompts> {
  const manifestPath = path.join(serverRoot, "prompts", "manifest.json");
  let manifest: PromptManifest = {
    defaultVersion: "v1",
    versions: ["v1"],
    locales: ["zh"],
  };
  const manifestRaw = await readTextIfExists(manifestPath);
  if (manifestRaw) {
    try {
      manifest = { ...manifest, ...JSON.parse(manifestRaw) };
    } catch {
      // keep defaults
    }
  }

  const envVersion = process.env.LOOM_PROMPT_VERSION?.trim();
  const envLocale = process.env.LOOM_PROMPT_LOCALE?.trim();
  const version =
    envVersion ||
    config.promptVersion ||
    manifest.defaultVersion ||
    "v1";
  const locale =
    envLocale ||
    config.promptLocale ||
    manifest.locales[0] ||
    "zh";

  const baseDir = path.join(serverRoot, "prompts", locale, version);
  const tools: Record<string, ToolPromptFile> = {};

  for (const name of TOOL_NAMES) {
    const fp = path.join(baseDir, "tools", `${name}.md`);
    const raw = await readTextIfExists(fp);
    if (raw) {
      tools[name] = parseToolMarkdown(raw);
    }
  }

  const instrPath = path.join(baseDir, "loom-instructions.md");
  const instrRaw = await readTextIfExists(instrPath);
  const loomInstructions = instrRaw
    ? stripFrontmatter(instrRaw).trim()
    : "";

  function describeTool(name: string, fallback: string): string {
    const t = tools[name];
    if (t?.description?.trim()) return t.description.trim();
    return fallback;
  }

  function describeParam(tool: string, param: string, fallback: string): string {
    const p = tools[tool]?.params[param];
    if (p?.trim()) return p.trim();
    return fallback;
  }

  return {
    version,
    locale,
    loomInstructions,
    describeTool,
    describeParam,
  };
}
