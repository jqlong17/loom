import * as fs from "fs/promises";
import * as path from "path";

/** 默认 MCP 读路径上界；可被 `.loomrc.json` 的 `mcpReadLimits` 与 `LOOM_MCP_*` 环境变量覆盖。 */
export const MCP_READ_LIMITS_DEFAULTS = {
  /** loom_list / CLI list：按 `updated` 新近优先，最多返回条数 */
  listMaxEntries: 100,
  /** 未传 `limit` 时 trace 的默认条数（layered / legacy 一致） */
  traceDefaultLimit: 10,
  /** loom_index 中「Full Index」正文最大字符数 */
  indexFullMaxChars: 16000,
} as const;

export type McpReadLimits = {
  listMaxEntries: number;
  traceDefaultLimit: number;
  indexFullMaxChars: number;
};

export interface LoomConfig {
  /** Root directory for .loom knowledge base */
  loomDir: string;
  /** Whether to auto-commit changes to Git */
  autoCommit: boolean;
  /** Whether to auto-push to remote after commit */
  autoPush: boolean;
  /** Default branch name for Loom operations */
  branch: string;
  /** Git commit message prefix */
  commitPrefix: string;
  /** Full raw conversation logging for analysis */
  fullConversationLogging: {
    enabled: boolean;
    storageDir: string;
    redact: boolean;
    maxPayloadChars: number;
  };
  /** MCP 读路径条数/字符上界（list / trace 默认 limit / index 全文索引段） */
  mcpReadLimits: McpReadLimits;
  /** MCP 提示词版本目录名，如 v1、v2（见 prompts/<locale>/<version>/） */
  promptVersion: string;
  /** 预留：zh | en */
  promptLocale: string;
}

const DEFAULT_CONFIG: LoomConfig = {
  loomDir: ".loom",
  autoCommit: true,
  autoPush: false,
  branch: "main",
  commitPrefix: "loom",
  fullConversationLogging: {
    enabled: false,
    storageDir: "raw_conversations",
    redact: true,
    maxPayloadChars: 12000,
  },
  mcpReadLimits: { ...MCP_READ_LIMITS_DEFAULTS },
  promptVersion: "v1",
  promptLocale: "zh",
};

const CONFIG_FILE = ".loomrc.json";

function envPositiveInt(name: string): number | undefined {
  const v = process.env[name];
  if (v === undefined || v === "") return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.floor(n);
}

/** 解析 trace / 其他 limit：无效或缺失时用 fallback。 */
export function resolveTraceLimit(
  limit: number | undefined,
  fallback: number,
): number {
  if (limit !== undefined && Number.isFinite(limit) && limit > 0) {
    return Math.floor(limit);
  }
  return Math.max(1, Math.floor(fallback));
}

export async function loadConfig(workDir: string): Promise<LoomConfig> {
  const configPath = path.join(workDir, CONFIG_FILE);
  try {
    const raw = await fs.readFile(configPath, "utf-8");
    const userConfig = JSON.parse(raw) as Partial<LoomConfig>;
    const mcpFromFile: McpReadLimits = {
      listMaxEntries:
        userConfig.mcpReadLimits?.listMaxEntries ??
        DEFAULT_CONFIG.mcpReadLimits.listMaxEntries,
      traceDefaultLimit:
        userConfig.mcpReadLimits?.traceDefaultLimit ??
        DEFAULT_CONFIG.mcpReadLimits.traceDefaultLimit,
      indexFullMaxChars:
        userConfig.mcpReadLimits?.indexFullMaxChars ??
        DEFAULT_CONFIG.mcpReadLimits.indexFullMaxChars,
    };
    return {
      ...DEFAULT_CONFIG,
      ...userConfig,
      fullConversationLogging: {
        ...DEFAULT_CONFIG.fullConversationLogging,
        ...(userConfig.fullConversationLogging ?? {}),
      },
      mcpReadLimits: {
        listMaxEntries:
          envPositiveInt("LOOM_MCP_LIST_MAX_ENTRIES") ?? mcpFromFile.listMaxEntries,
        traceDefaultLimit:
          envPositiveInt("LOOM_MCP_TRACE_DEFAULT_LIMIT") ??
          mcpFromFile.traceDefaultLimit,
        indexFullMaxChars:
          envPositiveInt("LOOM_MCP_INDEX_FULL_MAX_CHARS") ??
          mcpFromFile.indexFullMaxChars,
      },
      promptVersion: userConfig.promptVersion ?? DEFAULT_CONFIG.promptVersion,
      promptLocale: userConfig.promptLocale ?? DEFAULT_CONFIG.promptLocale,
    };
  } catch {
    return {
      ...DEFAULT_CONFIG,
      mcpReadLimits: {
        listMaxEntries:
          envPositiveInt("LOOM_MCP_LIST_MAX_ENTRIES") ??
          DEFAULT_CONFIG.mcpReadLimits.listMaxEntries,
        traceDefaultLimit:
          envPositiveInt("LOOM_MCP_TRACE_DEFAULT_LIMIT") ??
          DEFAULT_CONFIG.mcpReadLimits.traceDefaultLimit,
        indexFullMaxChars:
          envPositiveInt("LOOM_MCP_INDEX_FULL_MAX_CHARS") ??
          DEFAULT_CONFIG.mcpReadLimits.indexFullMaxChars,
      },
    };
  }
}

export function resolveLoomPath(workDir: string, config: LoomConfig): string {
  return path.isAbsolute(config.loomDir)
    ? config.loomDir
    : path.join(workDir, config.loomDir);
}

const LOOM_SUBDIRS = ["concepts", "decisions", "threads"] as const;

export type LoomCategory = (typeof LOOM_SUBDIRS)[number];

export async function ensureLoomStructure(loomRoot: string): Promise<void> {
  await fs.mkdir(loomRoot, { recursive: true });
  for (const sub of LOOM_SUBDIRS) {
    await fs.mkdir(path.join(loomRoot, sub), { recursive: true });
  }
  await fs.mkdir(path.join(loomRoot, "schema"), { recursive: true });

  const indexPath = path.join(loomRoot, "index.md");
  try {
    await fs.access(indexPath);
  } catch {
    const now = new Date().toISOString();
    await fs.writeFile(
      indexPath,
      `---
created: ${now}
updated: ${now}
---

# Loom System Index

> Auto-generated by Loom. This file maps all knowledge woven from AI conversations.

## Concepts

_No concepts yet._

## Decisions

_No decisions yet._

## Threads

_No threads yet._
`,
    );
  }

  const technicalSchemaPath = path.join(loomRoot, "schema", "technical.md");
  try {
    await fs.access(technicalSchemaPath);
  } catch {
    await fs.writeFile(
      technicalSchemaPath,
      `# Technical Graph Skeleton

> Macro technical memory backbone. Keep it stable and update incrementally.

## Entities

- Module
- Service
- API
- DataStore
- TechDecision

## Relations

- depends_on
- implements
- owns_data
- affects
- supersedes

## Current System Map

- Loom MCP Server -> depends_on -> Weaver Logic
- Weaver Logic -> depends_on -> Git Sync
- Loom MCP Server -> exposes -> loom_weave / loom_trace / loom_index / loom_probe_start / loom_probe_commit

## Update Rule

- When adding a new core capability, append one node and at least one edge.
`,
    );
  }

  const businessSchemaPath = path.join(loomRoot, "schema", "business.md");
  try {
    await fs.access(businessSchemaPath);
  } catch {
    await fs.writeFile(
      businessSchemaPath,
      `# Business Graph Skeleton

> Macro business memory backbone for goals, domains, and constraints.

## Domains

- Product Experience
- Engineering Efficiency
- Team Collaboration

## Core Objects

- User Request
- Decision
- Capability
- Constraint
- Outcome

## Relations

- drives
- constrains
- enables
- impacts

## Current Objective Map

- User Request -> drives -> Capability: proactive inquiry memory
- Capability -> enables -> Engineering Efficiency
- Constraint: no extra model key -> constrains -> Solution Architecture

## Update Rule

- For each major feature, add "why this matters" edge in this map.
`,
    );
  }
}
