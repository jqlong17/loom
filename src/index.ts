#!/usr/bin/env node

import * as path from "path";
import { fileURLToPath } from "url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  loadConfig,
  resolveLoomPath,
  ensureLoomStructure,
} from "./config.js";
import {
  weave,
  trace,
  listAll,
  listRecentEntries,
  listCoreConcepts,
  readKnowledge,
  rebuildIndex,
  reflect,
  deprecateEntry,
} from "./weaver.js";
import { GitManager } from "./git-manager.js";
import { upgradeFromGit } from "./updater.js";
import {
  updateChangelog,
  collectDailyHighlightsFromGit,
} from "./changelog.js";
import {
  createProbeSession,
  commitProbeSession,
  type ProbeQuestion,
  type ProbeAnswerInput,
  type ProbeAnswerRecord,
} from "./probe.js";
import { lintMemoryEntry, formatLintIssues } from "./memory-lint.js";
import { executeIngestKnowledge } from "./app/usecases/ingest-knowledge.js";
import { executeRunDoctor } from "./app/usecases/run-doctor.js";
import { executeStartProbeSession } from "./app/usecases/start-probe-session.js";
import { executeCommitProbeSession } from "./app/usecases/commit-probe-session.js";
import { executeUpdateChangelog } from "./app/usecases/update-changelog.js";
import { executeMetricsSnapshot } from "./app/usecases/metrics-snapshot.js";
import { executeQueryEvents } from "./app/usecases/query-events.js";
import { executeMetricsReport } from "./app/usecases/metrics-report.js";
import { formatDoctorForMcp } from "./adapters/doctor-adapter.js";
import { appendEvent } from "./events.js";
import { loadPromptBundle, type LoadedPrompts } from "./prompt-loader.js";
import {
  appendRawConversationRecord,
  inferSessionIdFromUnknown,
} from "./raw-conversation.js";

const WORK_DIR = process.env.LOOM_WORK_DIR ?? process.cwd();
const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SERVER_VERSION = "0.1.0";

let cachedConfig: Awaited<ReturnType<typeof loadConfig>> | undefined;
let cachedLoomRoot: string | undefined;

async function getRuntimeContext() {
  if (!cachedConfig || !cachedLoomRoot) {
    cachedConfig = await loadConfig(WORK_DIR);
    cachedLoomRoot = resolveLoomPath(WORK_DIR, cachedConfig);
  }
  return { config: cachedConfig, loomRoot: cachedLoomRoot };
}

function truncateText(text: string, maxChars: number): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxChars) return cleaned;
  return `${cleaned.slice(0, maxChars)}...`;
}

function deriveContextTerms(input: string, maxTerms = 5): string[] {
  const lowered = input.toLowerCase();
  const asciiTerms = lowered.match(/[a-z][a-z0-9_-]{2,}/g) ?? [];
  const cjkTerms = input.match(/[\u4e00-\u9fff]{2,}/g) ?? [];
  const stop = new Set([
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from",
    "into",
    "about",
    "have",
    "will",
    "should",
    "can",
    "could",
    "我们",
    "需要",
    "一个",
    "可以",
    "进行",
    "这个",
    "怎么",
    "什么",
  ]);

  const all = [...asciiTerms, ...cjkTerms].filter((t) => !stop.has(t));
  const score = new Map<string, number>();
  for (const term of all) {
    score.set(term, (score.get(term) ?? 0) + 1);
  }
  return Array.from(score.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([term]) => term)
    .slice(0, maxTerms);
}

function buildProbeContent(params: {
  context: string;
  goal?: string;
  answers: Array<{ question: string; answer: string }>;
  evidencePaths: string[];
  suggestedQuestions: string[];
}): string {
  const qas = params.answers
    .map(
      (item, idx) =>
        `### Q${idx + 1}: ${item.question}\n\nA: ${item.answer}`,
    )
    .join("\n\n");

  const followups = params.suggestedQuestions
    .map((q) => `- ${q}`)
    .join("\n");

  const refs = params.evidencePaths.length
    ? params.evidencePaths.map((p) => `- ${p}`).join("\n")
    : "- none";

  return [
    "## 背景上下文",
    params.context,
    "",
    "## 对齐目标",
    params.goal ?? "未显式提供",
    "",
    "## 主动提问与用户回答",
    qas,
    "",
    "## 依据的既有记忆",
    refs,
    "",
    "## 下一步待确认",
    followups || "- 暂无",
  ].join("\n");
}

function buildProbeQuestions(
  context: string,
  goal: string | undefined,
  hasEvidence: boolean,
): Array<{ question: string; reason: string }> {
  const questions: Array<{ question: string; reason: string }> = [];

  if (!goal || goal.trim().length < 6) {
    questions.push({
      question: "这轮对话的最终目标是什么？希望产出的结果形式是文档、代码还是决策结论？",
      reason: "目标未充分显式化，后续记忆沉淀容易偏离重点。",
    });
  }

  questions.push({
    question: "本次范围的边界是什么？哪些内容明确不做，以避免扩散？",
    reason: "范围边界决定后续知识分类与行动优先级。",
  });

  questions.push({
    question: "成功验收标准是什么？请给出 2-3 条可验证条件。",
    reason: "缺少验收标准会导致记忆记录无法支持后续复盘。",
  });

  if (hasEvidence) {
    questions.push({
      question:
        "与现有记忆相比，这次需求的增量变化是什么？请明确“沿用”与“变更”的部分。",
      reason: "已有相关历史，需避免与既有概念/决策冲突。",
    });
  } else {
    questions.push({
      question: "当前需求涉及哪些核心模块或关键词？请给 3-5 个检索词。",
      reason: "尚未检索到高相关记忆，先补检索锚点可提升沉淀质量。",
    });
  }

  const hasRiskHint = /风险|risk|限制|constraint|兼容|兼容性|迁移|migration/i.test(
    `${context} ${goal ?? ""}`,
  );
  if (!hasRiskHint) {
    questions.push({
      question: "这次方案有哪些风险、约束或兼容性要求需要提前记录？",
      reason: "风险与约束缺失会影响后续决策质量。",
    });
  }
  return questions;
}

async function collectProbeEvidence(
  loomRoot: string,
  context: string,
  goal?: string,
): Promise<{
  evidenceMap: Map<string, string>;
  coreConceptCount: number;
  recentCount: number;
}> {
  const terms = deriveContextTerms(`${goal ?? ""} ${context}`);
  const coreConcepts = await listCoreConcepts(loomRoot);
  const recent = await listRecentEntries(loomRoot, 5);
  const evidenceMap = new Map<string, string>();

  for (const term of terms.slice(0, 4)) {
    const hits = await trace(loomRoot, term, { limit: 2 });
    for (const hit of hits) {
      if (!evidenceMap.has(hit.filePath)) {
        evidenceMap.set(
          hit.filePath,
          `${hit.title} [${hit.category}] — ${truncateText(hit.snippet, 120)}`,
        );
      }
    }
  }

  return {
    evidenceMap,
    coreConceptCount: coreConcepts.length,
    recentCount: recent.length,
  };
}

async function startProbeSession(
  loomRoot: string,
  context: string,
  goal: string | undefined,
  maxQuestions: number,
) {
  const evidence = await collectProbeEvidence(loomRoot, context, goal);
  const candidates = buildProbeQuestions(
    context,
    goal,
    evidence.evidenceMap.size > 0,
  ).slice(0, maxQuestions);

  const questions: ProbeQuestion[] = candidates.map((item, idx) => ({
    id: `q${idx + 1}`,
    question: item.question,
    reason: item.reason,
  }));

  const session = await createProbeSession(loomRoot, {
    context,
    goal,
    questions,
    evidencePaths: Array.from(evidence.evidenceMap.keys()),
  });

  return { session, evidence };
}

function makeProbeStartText(params: {
  sessionId: string;
  questions: ProbeQuestion[];
  evidenceMap: Map<string, string>;
  coreConceptCount: number;
  recentCount: number;
}): string {
  return [
    "## Proactive Questions",
    ...params.questions.map(
      (item, idx) =>
        `${idx + 1}. [${item.id}] ${item.question}\n   - Why: ${item.reason}`,
    ),
    "",
    "## Memory Evidence",
    `- Session: ${params.sessionId}`,
    `- Core concepts count: ${params.coreConceptCount}`,
    `- Recent memory count: ${params.recentCount}`,
    ...Array.from(params.evidenceMap.entries()).map(
      ([file, summary]) => `- ${file}: ${summary}`,
    ),
    "",
    "Next: call loom_probe_commit with session_id and answers=[{question_id,answer}]",
  ].join("\n");
}

function makeProbeThreadContent(
  session: {
    context: string;
    goal?: string;
    questions: ProbeQuestion[];
    evidencePaths: string[];
  },
  answers: ProbeAnswerRecord[],
): string {
  const answeredIds = new Set(answers.map((a) => a.question_id));
  const unanswered = session.questions
    .filter((q) => !answeredIds.has(q.id))
    .map((q) => q.question);

  return buildProbeContent({
    context: session.context,
    goal: session.goal,
    answers: answers.map((a) => ({ question: a.question, answer: a.answer })),
    evidencePaths: session.evidencePaths,
    suggestedQuestions: unanswered,
  });
}

const server = new McpServer({
  name: "loom",
  version: SERVER_VERSION,
});

function errorToString(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function inferTurnIdFromUnknown(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const obj = input as Record<string, unknown>;
  const candidate = obj.turnId ?? obj.turn_id ?? obj.message_id ?? obj.messageId;
  return typeof candidate === "string" ? candidate : undefined;
}

function enableMcpRawLogging(): void {
  const originalTool = server.tool.bind(server) as (
    name: string,
    description: string,
    schema: Record<string, z.ZodTypeAny>,
    handler: (args: Record<string, unknown>) => Promise<unknown>,
  ) => void;

  (server as unknown as { tool: typeof originalTool }).tool = (
    name,
    description,
    schema,
    handler,
  ) => {
    originalTool(name, description, schema, async (args) => {
      const { config, loomRoot } = await getRuntimeContext();
      try {
        const output = await handler(args);
        await appendRawConversationRecord(loomRoot, config, {
          ts: new Date().toISOString(),
          source: "mcp",
          sessionId: inferSessionIdFromUnknown(args),
          turnId: inferTurnIdFromUnknown(args),
          channel: "tool_call",
          name,
          input: args,
          output,
          ok: true,
        });
        return output;
      } catch (err) {
        await appendRawConversationRecord(loomRoot, config, {
          ts: new Date().toISOString(),
          source: "mcp",
          sessionId: inferSessionIdFromUnknown(args),
          turnId: inferTurnIdFromUnknown(args),
          channel: "tool_call",
          name,
          input: args,
          ok: false,
          error: errorToString(err),
        });
        throw err;
      }
    });
  };
}

enableMcpRawLogging();

function registerLoomToolDefinitions(bundle: LoadedPrompts): void {
// ─── Tool: loom_init ──────────────────────────────────────────
server.tool(
  "loom_init",
  bundle.describeTool(
    "loom_init",
    "Initialize Loom knowledge base in the current project. Creates .loom/ directory structure with index, concepts, decisions, and threads folders.",
  ),
  {},
  async () => {
    const { config, loomRoot } = await getRuntimeContext();
    await ensureLoomStructure(loomRoot);

    const git = new GitManager(WORK_DIR, config);
    await git.initIfNeeded();
    const commitResult = await git.commitChanges(
      [loomRoot],
      "initialize knowledge base",
    );

    return {
      content: [
        {
          type: "text",
          text: [
            `Loom initialized at: ${loomRoot}`,
            `Directories created: concepts/, decisions/, threads/`,
            `Index: index.md`,
            `Git: ${commitResult.message}`,
          ].join("\n"),
        },
      ],
    };
  },
);

// ─── Tool: loom_weave ─────────────────────────────────────────
server.tool(
  "loom_weave",
  bundle.describeTool(
    "loom_weave",
    "Weave a piece of knowledge into the Loom knowledge base. Use this whenever you learn something important about the system architecture, business logic, technical decisions, or discussion threads from conversations.",
  ),
  {
    category: z
      .enum(["concepts", "decisions", "threads"])
      .describe(
        bundle.describeParam(
          "loom_weave",
          "category",
          "Knowledge category: 'concepts' for system architecture, business logic, terminology; 'decisions' for ADR-style records of why something was chosen; 'threads' for conversation summaries and discussion notes",
        ),
      ),
    title: z
      .string()
      .describe(
        bundle.describeParam(
          "loom_weave",
          "title",
          "A clear, descriptive title for this knowledge entry (e.g. 'Payment Flow', 'Why We Chose PostgreSQL')",
        ),
      ),
    content: z
      .string()
      .describe(
        bundle.describeParam(
          "loom_weave",
          "content",
          "The knowledge content in Markdown format. Be thorough and structured.",
        ),
      ),
    tags: z
      .array(z.string())
      .optional()
      .describe(
        bundle.describeParam(
          "loom_weave",
          "tags",
          "Optional tags for categorization and retrieval (e.g. ['backend', 'database', 'auth'])",
        ),
      ),
    links: z
      .array(z.string())
      .optional()
      .describe(
        bundle.describeParam(
          "loom_weave",
          "links",
          "Optional graph links to related entries (e.g. ['concepts/user-auth', 'decisions/why-mcp-over-vs-code-plugin'])",
        ),
      ),
    domain: z
      .string()
      .optional()
      .describe(
        bundle.describeParam(
          "loom_weave",
          "domain",
          "Optional macro domain for graph skeleton (e.g. 'architecture', 'product', 'operations')",
        ),
      ),
    is_core: z
      .boolean()
      .optional()
      .describe(
        bundle.describeParam(
          "loom_weave",
          "is_core",
          "If true, force-add 'core' tag for foundational concepts that should be mandatory read.",
        ),
      ),
    mode: z
      .enum(["replace", "append", "section"])
      .optional()
      .describe(
        bundle.describeParam(
          "loom_weave",
          "mode",
          "Write mode: 'replace' overwrites the entire entry (default); 'append' adds new content below existing content with a date separator; 'section' replaces a matching ## heading or appends as a new section",
        ),
      ),
  },
  async ({ category, title, content, tags, links, domain, mode, is_core }) => {
    const { config, loomRoot } = await getRuntimeContext();
    await ensureLoomStructure(loomRoot);

    const normalizedTags = Array.from(new Set([...(tags ?? [])]));
    const shouldAutoCore =
      category === "concepts" &&
      /core|核心|foundation|vision|architecture|原则|baseline/i.test(title);
    if ((is_core || shouldAutoCore) && !normalizedTags.includes("core")) {
      normalizedTags.push("core");
    }

    const git = new GitManager(WORK_DIR, config);
    const ingestResult = await executeIngestKnowledge({
      workDir: WORK_DIR,
      loomRoot,
      config,
      git,
      command: {
        category,
        title,
        content,
        tags: normalizedTags,
        links,
        domain,
        mode,
        commit: true,
        changelog: false,
      },
    });

    if (!ingestResult.ok || !ingestResult.data) {
      return {
        content: [
          {
            type: "text",
            text:
              ingestResult.issues
                .map((i) => i.suggestion ?? i.message)
                .join("\n") + "\nWrite aborted due to lint errors.",
          },
        ],
      };
    }

    let pushMsg = "";
    if (config.autoPush) {
      const pushResult = await git.push();
      pushMsg = `\nPush: ${pushResult.message}`;
    }

    return {
      content: [
        {
          type: "text",
          text: [
            `${ingestResult.data.ingest.isUpdate ? "Updated" : "Created"}: ${category}/${title}`,
            `Mode: ${ingestResult.data.ingest.mode}`,
            `File: ${ingestResult.data.ingest.filePath}`,
            `Tags: ${normalizedTags.join(", ") || "none"}`,
            `Links: ${links?.join(", ") || "none"}`,
            `Domain: ${domain || "none"}`,
            ingestResult.data.lintIssues.length > 0 ? ingestResult.data.lintReport : "",
            `Git: ${ingestResult.data.git ?? "skipped"}${pushMsg}`,
            `Index rebuilt.`,
          ].join("\n"),
        },
      ],
    };
  },
);

// ─── Tool: loom_ingest ────────────────────────────────────────
server.tool(
  "loom_ingest",
  bundle.describeTool(
    "loom_ingest",
    "CLI-first style one-shot ingestion: lint + weave + index (+ optional changelog/commit). MCP adapter over core ingest pipeline.",
  ),
  {
    category: z
      .enum(["concepts", "decisions", "threads"])
      .describe(bundle.describeParam("loom_ingest", "category", "concepts | decisions | threads")),
    title: z.string().describe(bundle.describeParam("loom_ingest", "title", "Entry title")),
    content: z.string().describe(bundle.describeParam("loom_ingest", "content", "Markdown body")),
    tags: z
      .array(z.string())
      .optional()
      .describe(bundle.describeParam("loom_ingest", "tags", "Optional tags")),
    links: z
      .array(z.string())
      .optional()
      .describe(bundle.describeParam("loom_ingest", "links", "Optional related entry paths")),
    domain: z
      .string()
      .optional()
      .describe(bundle.describeParam("loom_ingest", "domain", "Optional domain")),
    mode: z
      .enum(["replace", "append", "section"])
      .optional()
      .describe(bundle.describeParam("loom_ingest", "mode", "replace | append | section")),
    commit: z
      .boolean()
      .optional()
      .describe(bundle.describeParam("loom_ingest", "commit", "Auto git commit (default true)")),
    changelog: z
      .boolean()
      .optional()
      .describe(bundle.describeParam("loom_ingest", "changelog", "Update public CHANGELOG (default false)")),
    changelogDate: z
      .string()
      .optional()
      .describe(
        bundle.describeParam(
          "loom_ingest",
          "changelogDate",
          "Date for changelog aggregation in YYYY-MM-DD",
        ),
      ),
  },
  async ({
    category,
    title,
    content,
    tags,
    links,
    domain,
    mode,
    commit,
    changelog,
    changelogDate,
  }) => {
    const { config, loomRoot } = await getRuntimeContext();
    await ensureLoomStructure(loomRoot);
    const normalizedTags = Array.from(new Set([...(tags ?? [])]));
    const git = new GitManager(WORK_DIR, config);
    const result = await executeIngestKnowledge({
      workDir: WORK_DIR,
      loomRoot,
      config,
      git,
      command: {
        category,
        title,
        content,
        tags: normalizedTags,
        links,
        domain,
        mode,
        commit: commit ?? true,
        changelog: changelog ?? false,
        changelogDate,
      },
    });

    if (!result.ok || !result.data) {
      return {
        content: [
          {
            type: "text",
            text:
              result.issues.map((i) => i.suggestion ?? i.message).join("\n") +
              "\nIngest aborted.",
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: [
            `Ingested: ${category}/${title}`,
            `File: ${result.data.ingest.filePath}`,
            `Mode: ${result.data.ingest.mode}`,
            `Git: ${result.data.git ?? "skipped"}`,
            result.data.changelog
              ? `Changelog: ${
                  "skipped" in result.data.changelog
                    ? `skipped (${result.data.changelog.reason ?? "no-op"})`
                    : `${result.data.changelog.date} +${result.data.changelog.added}`
                }`
              : "Changelog: skipped",
            result.data.lintIssues.length > 0
              ? result.data.lintReport
              : "Memory lint: no issues.",
          ].join("\n"),
        },
      ],
    };
  },
);

// ─── Tool: loom_doctor ────────────────────────────────────────
server.tool(
  "loom_doctor",
  bundle.describeTool(
    "loom_doctor",
    "Run health gate for memory graph quality. Returns structured severity and gate decision.",
  ),
  {
    staleDays: z
      .number()
      .optional()
      .describe(bundle.describeParam("loom_doctor", "staleDays", "Stale threshold in days")),
    includeThreads: z
      .boolean()
      .optional()
      .describe(bundle.describeParam("loom_doctor", "includeThreads", "Include threads category")),
    maxFindings: z
      .number()
      .optional()
      .describe(bundle.describeParam("loom_doctor", "maxFindings", "Max findings to return")),
    failOn: z
      .enum(["none", "error", "warn"])
      .optional()
      .describe(bundle.describeParam("loom_doctor", "failOn", "Gate level: none | error | warn")),
  },
  async ({ staleDays, includeThreads, maxFindings, failOn }) => {
    const { loomRoot } = await getRuntimeContext();
    await ensureLoomStructure(loomRoot);
    const report = await executeRunDoctor({
      loomRoot,
      command: {
        staleDays: staleDays ?? 30,
        includeThreads: includeThreads ?? true,
        maxFindings: maxFindings ?? 20,
        failOn: failOn ?? "error",
      },
    });
    if (!report.ok || !report.data) {
      return {
        content: [{ type: "text", text: "Doctor execution failed." }],
      };
    }
    return {
      content: [
        {
          type: "text",
          text: formatDoctorForMcp(report),
        },
      ],
    };
  },
);

// ─── Tool: loom_trace ─────────────────────────────────────────
server.tool(
  "loom_trace",
  bundle.describeTool(
    "loom_trace",
    "Search the Loom knowledge base by keyword. Use this to recall previously recorded knowledge about the system before making decisions or answering questions.",
  ),
  {
    query: z
      .string()
      .describe(
        bundle.describeParam(
          "loom_trace",
          "query",
          "Keyword or phrase to search across all knowledge entries",
        ),
      ),
    category: z
      .enum(["concepts", "decisions", "threads"])
      .optional()
      .describe(bundle.describeParam("loom_trace", "category", "Optional category filter")),
    tags: z
      .array(z.string())
      .optional()
      .describe(
        bundle.describeParam(
          "loom_trace",
          "tags",
          "Optional tag filter; all provided tags must be present",
        ),
      ),
    limit: z
      .number()
      .optional()
      .describe(
        bundle.describeParam(
          "loom_trace",
          "limit",
          "Maximum results to return after relevance sorting",
        ),
      ),
    trace_mode: z
      .enum(["legacy", "layered"])
      .optional()
      .describe(
        bundle.describeParam(
          "loom_trace",
          "trace_mode",
          "Trace pipeline mode: layered (default) or legacy full scan",
        ),
      ),
  },
  async ({ query, category, tags, limit, trace_mode }) => {
    const { loomRoot } = await getRuntimeContext();

    const results = await trace(loomRoot, query, {
      category,
      tags,
      limit,
      traceMode: trace_mode,
    });
    await appendEvent(loomRoot, {
      type: "knowledge.traced",
      ts: new Date().toISOString(),
      payload: {
        query,
        category,
        tags,
        count: results.length,
      },
    });

    if (results.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No knowledge found matching "${query}". Consider using loom_weave to record relevant information.`,
          },
        ],
      };
    }

    const formatted = results
      .map(
        (r) =>
          `### ${r.title} [${r.category}]\nFile: ${r.filePath}\nTags: ${r.tags} | Updated: ${r.updated} | Score: ${r.score ?? 0}\nWhy: ${r.whySummary ?? (r.whyMatched?.join(", ") ?? "n/a")}\n\n${r.snippet}`,
      )
      .join("\n\n---\n\n");

    return {
      content: [
        {
          type: "text",
          text: `Found ${results.length} result(s) for "${query}":\n\n${formatted}`,
        },
      ],
    };
  },
);

// ─── Tool: loom_index ─────────────────────────────────────────
server.tool(
  "loom_index",
  bundle.describeTool(
    "loom_index",
    "Read the Loom index and mandatory-read memory set first. Progressive disclosure order: index -> trace -> read.",
  ),
  {},
  async () => {
    const { loomRoot } = await getRuntimeContext();
    await ensureLoomStructure(loomRoot);
    const RECENT_LIMIT = 5;
    const SNIPPET_LIMIT = 220;
    const index = await rebuildIndex(loomRoot);
    const recent = await listRecentEntries(loomRoot, RECENT_LIMIT);
    const coreConcepts = await listCoreConcepts(loomRoot);

    const coreSection =
      coreConcepts.length === 0
        ? "- _No core-tagged concepts found yet._"
        : coreConcepts
            .map(
              (c) =>
                `- ${c.title} (${c.filePath})\n  摘要: ${truncateText(c.snippet, SNIPPET_LIMIT)}`,
            )
            .join("\n");
    const recentSection = recent
      .map(
        (r) =>
          `- ${r.title} [${r.category}] (${r.filePath})\n  摘要: ${truncateText(r.snippet, SNIPPET_LIMIT)}`,
      )
      .join("\n");

    const briefing = [
      "## Mandatory Read Set",
      "",
      "### Core Concepts (tag: core)",
      coreSection,
      "",
      `### Recent Memory (latest ${RECENT_LIMIT} entries)`,
      recentSection,
      "",
      "### Full Index",
      index,
    ].join("\n");

    return {
      content: [
        {
          type: "text",
          text: briefing,
        },
      ],
    };
  },
);

// ─── Tool: loom_probe_start ───────────────────────────────────
server.tool(
  "loom_probe_start",
  bundle.describeTool(
    "loom_probe_start",
    "Start a proactive inquiry session: generate clarification questions and persist a probe session state.",
  ),
  {
    context: z
      .string()
      .describe(
        bundle.describeParam(
          "loom_probe_start",
          "context",
          "Current dialog summary or latest user request",
        ),
      ),
    goal: z
      .string()
      .optional()
      .describe(
        bundle.describeParam(
          "loom_probe_start",
          "goal",
          "Optional objective for this dialogue turn",
        ),
      ),
    max_questions: z
      .number()
      .optional()
      .describe(
        bundle.describeParam(
          "loom_probe_start",
          "max_questions",
          "How many questions to generate (default: 3, max: 5)",
        ),
      ),
  },
  async ({ context, goal, max_questions }) => {
    const { loomRoot } = await getRuntimeContext();
    await ensureLoomStructure(loomRoot);
    const maxQ = Math.min(5, Math.max(1, max_questions ?? 3));
    const started = await executeStartProbeSession({
      loomRoot,
      command: { context, goal, maxQuestions: maxQ },
    });
    if (!started.ok || !started.data) {
      return {
        content: [{ type: "text", text: "Failed to start probe session." }],
      };
    }
    const evidenceMap = new Map(
      started.data.evidence.entries.map((e) => [e.filePath, e.summary]),
    );
    const text = makeProbeStartText({
      sessionId: started.data.sessionId,
      questions: started.data.questions,
      evidenceMap,
      coreConceptCount: started.data.evidence.coreConceptCount,
      recentCount: started.data.evidence.recentCount,
    });
    return { content: [{ type: "text", text }] };
  },
);

// ─── Tool: loom_probe_commit ──────────────────────────────────
server.tool(
  "loom_probe_commit",
  bundle.describeTool(
    "loom_probe_commit",
    "Commit answers for an existing probe session and persist Q&A into Loom threads.",
  ),
  {
    session_id: z
      .string()
      .describe(
        bundle.describeParam(
          "loom_probe_commit",
          "session_id",
          "Probe session id returned by loom_probe_start",
        ),
      ),
    answers: z
      .array(
        z.object({
          question_id: z.string().optional(),
          question: z.string().optional(),
          answer: z.string(),
        }),
      )
      .describe(
        bundle.describeParam(
          "loom_probe_commit",
          "answers",
          "Answers mapped by question_id (recommended) or exact question text",
        ),
      ),
    title: z
      .string()
      .optional()
      .describe(
        bundle.describeParam(
          "loom_probe_commit",
          "title",
          "Optional Loom thread title. Default is probe-session-<id>",
        ),
      ),
    tags: z
      .array(z.string())
      .optional()
      .describe(bundle.describeParam("loom_probe_commit", "tags", "Optional extra tags")),
    commit: z
      .boolean()
      .optional()
      .describe(
        bundle.describeParam(
          "loom_probe_commit",
          "commit",
          "Whether to auto-commit to git (default: true)",
        ),
      ),
  },
  async ({ session_id, answers, title, tags, commit }) => {
    const { config, loomRoot } = await getRuntimeContext();
    await ensureLoomStructure(loomRoot);
    const git = new GitManager(WORK_DIR, config);
    const committed = await executeCommitProbeSession({
      loomRoot,
      git,
      command: {
        sessionId: session_id,
        answers,
        title,
        tags,
        commit: commit ?? true,
      },
    });
    if (!committed.ok || !committed.data) {
      return {
        content: [
          {
            type: "text",
            text: committed.issues.map((i) => i.suggestion ?? i.message).join("\n"),
          },
        ],
      };
    }
    const lines = [
      `Captured Q&A to file: ${committed.data.filePath}`,
      `Session: ${committed.data.sessionId}`,
      `Matched answers: ${committed.data.matchedAnswers}`,
      `Unmatched answers: ${committed.data.unmatchedAnswers}`,
      `Git: ${committed.data.git ?? "skipped"}`,
    ];
    return { content: [{ type: "text", text: lines.join("\n") }] };
  },
);

// ─── Tool: loom_probe (compat) ────────────────────────────────
server.tool(
  "loom_probe",
  bundle.describeTool(
    "loom_probe",
    "Compatibility wrapper for proactive inquiry. Use loom_probe_start + loom_probe_commit for explicit state-machine flow.",
  ),
  {
    context: z
      .string()
      .optional()
      .describe(
        bundle.describeParam(
          "loom_probe",
          "context",
          "Current dialog summary or latest user request",
        ),
      ),
    goal: z
      .string()
      .optional()
      .describe(bundle.describeParam("loom_probe", "goal", "Optional objective")),
    max_questions: z
      .number()
      .optional()
      .describe(
        bundle.describeParam("loom_probe", "max_questions", "Question count (default: 3, max: 5)"),
      ),
    record: z
      .boolean()
      .optional()
      .describe(bundle.describeParam("loom_probe", "record", "If true, write answers to Loom")),
    session_id: z
      .string()
      .optional()
      .describe(bundle.describeParam("loom_probe", "session_id", "Existing probe session id")),
    answers: z
      .array(
        z.object({
          question_id: z.string().optional(),
          question: z.string().optional(),
          answer: z.string(),
        }),
      )
      .optional()
      .describe(bundle.describeParam("loom_probe", "answers", "Answer list for commit")),
    title: z
      .string()
      .optional()
      .describe(bundle.describeParam("loom_probe", "title", "Optional thread title for memory write")),
    tags: z
      .array(z.string())
      .optional()
      .describe(bundle.describeParam("loom_probe", "tags", "Optional tags")),
    commit: z
      .boolean()
      .optional()
      .describe(
        bundle.describeParam("loom_probe", "commit", "Whether to auto-commit (default: true)"),
      ),
  },
  async ({ context, goal, max_questions, record, session_id, answers, title, tags, commit }) => {
    const { config, loomRoot } = await getRuntimeContext();
    await ensureLoomStructure(loomRoot);
    const maxQ = Math.min(5, Math.max(1, max_questions ?? 3));

    if (!record) {
      if (!context?.trim()) {
        return {
          content: [{ type: "text", text: "loom_probe requires context when record=false." }],
        };
      }
      const started = await executeStartProbeSession({
        loomRoot,
        command: { context, goal, maxQuestions: maxQ },
      });
      if (!started.ok || !started.data) {
        return {
          content: [{ type: "text", text: "Failed to start probe session." }],
        };
      }
      const evidenceMap = new Map(
        started.data.evidence.entries.map((e) => [e.filePath, e.summary]),
      );
      return {
        content: [
          {
            type: "text",
            text: makeProbeStartText({
              sessionId: started.data.sessionId,
              questions: started.data.questions,
              evidenceMap,
              coreConceptCount: started.data.evidence.coreConceptCount,
              recentCount: started.data.evidence.recentCount,
            }),
          },
        ],
      };
    }

    const answerList = answers ?? [];
    if (answerList.length === 0) {
      return {
        content: [{ type: "text", text: "record=true requires answers." }],
      };
    }

    const git = new GitManager(WORK_DIR, config);
    const committed = await executeCommitProbeSession({
      loomRoot,
      git,
      command: {
        sessionId: session_id,
        context,
        goal,
        maxQuestions: maxQ,
        answers: answerList as ProbeAnswerInput[],
        title,
        tags,
        commit: commit ?? true,
      },
    });
    if (!committed.ok || !committed.data) {
      return {
        content: [
          {
            type: "text",
            text: committed.issues.map((i) => i.suggestion ?? i.message).join("\n"),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: [
            `Captured Q&A to file: ${committed.data.filePath}`,
            `Session: ${committed.data.sessionId}`,
            `Matched answers: ${committed.data.matchedAnswers}`,
            `Unmatched answers: ${committed.data.unmatchedAnswers}`,
            `Git: ${committed.data.git ?? "skipped"}`,
          ].join("\n"),
        },
      ],
    };
  },
);

// ─── Tool: loom_read ──────────────────────────────────────────
server.tool(
  "loom_read",
  bundle.describeTool(
    "loom_read",
    "Read the full content of a specific knowledge entry from the Loom knowledge base.",
  ),
  {
    category: z
      .enum(["concepts", "decisions", "threads"])
      .describe(bundle.describeParam("loom_read", "category", "concepts | decisions | threads")),
    slug: z
      .string()
      .describe(
        bundle.describeParam(
          "loom_read",
          "slug",
          "The slug (filename without .md extension) of the knowledge entry to read",
        ),
      ),
  },
  async ({ category, slug }) => {
    const { config, loomRoot } = await getRuntimeContext();

    const content = await readKnowledge(loomRoot, category, slug);
    if (!content) {
      return {
        content: [
          {
            type: "text",
            text: `Entry not found: ${category}/${slug}. Use loom_list to see available entries.`,
          },
        ],
      };
    }

    return { content: [{ type: "text", text: content }] };
  },
);

// ─── Tool: loom_list ──────────────────────────────────────────
server.tool(
  "loom_list",
  bundle.describeTool(
    "loom_list",
    "List all knowledge entries in the Loom knowledge base. Use this to get an overview of what the system knows.",
  ),
  {},
  async () => {
    const { config, loomRoot } = await getRuntimeContext();

    const all = await listAll(loomRoot);

    if (all.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "The Loom knowledge base is empty. Use loom_weave to start recording knowledge.",
          },
        ],
      };
    }

    const grouped: Record<string, typeof all> = {};
    for (const item of all) {
      (grouped[item.category] ??= []).push(item);
    }

    const formatted = Object.entries(grouped)
      .map(([cat, items]) => {
        const list = items
          .map((i) => `  - ${i.title} (${i.filePath}) [${i.tags}]`)
          .join("\n");
        return `### ${cat}\n${list}`;
      })
      .join("\n\n");

    return {
      content: [
        {
          type: "text",
          text: `Loom Knowledge Base (${all.length} entries):\n\n${formatted}`,
        },
      ],
    };
  },
);

// ─── Tool: loom_sync ──────────────────────────────────────────
server.tool(
  "loom_sync",
  bundle.describeTool(
    "loom_sync",
    "Synchronize the Loom knowledge base with the remote Git repository. Pulls latest changes from teammates and pushes local changes.",
  ),
  {},
  async () => {
    const { config } = await getRuntimeContext();
    const git = new GitManager(WORK_DIR, config);

    if (!(await git.isRepo())) {
      return {
        content: [
          {
            type: "text",
            text: "Not a Git repository. Run loom_init first.",
          },
        ],
      };
    }

    const result = await git.sync();
    return { content: [{ type: "text", text: `Sync: ${result.message}` }] };
  },
);

// ─── Tool: loom_log ───────────────────────────────────────────
server.tool(
  "loom_log",
  bundle.describeTool(
    "loom_log",
    "Show the Git history of Loom knowledge changes. Useful for understanding how the system's understanding has evolved over time.",
  ),
  {
    limit: z
      .number()
      .optional()
      .describe(
        bundle.describeParam(
          "loom_log",
          "limit",
          "Maximum number of log entries to show (default: 10)",
        ),
      ),
  },
  async ({ limit }) => {
    const { config } = await getRuntimeContext();
    const git = new GitManager(WORK_DIR, config);

    const log = await git.log(limit ?? 10);
    return { content: [{ type: "text", text: `Loom Git History:\n\n${log}` }] };
  },
);

// ─── Tool: loom_changelog ──────────────────────────────────────
server.tool(
  "loom_changelog",
  bundle.describeTool(
    "loom_changelog",
    "Update public CHANGELOG.md grouped by date. Supports auto mode (derive daily highlights from git commits) and manual mode (provide highlights explicitly).",
  ),
  {
    mode: z
      .enum(["auto", "manual"])
      .optional()
      .describe(
        bundle.describeParam(
          "loom_changelog",
          "mode",
          "auto: infer highlights from daily git commits; manual: use provided highlights",
        ),
      ),
    date: z
      .string()
      .optional()
      .describe(
        bundle.describeParam(
          "loom_changelog",
          "date",
          "Date in YYYY-MM-DD format. Defaults to today.",
        ),
      ),
    highlights: z
      .array(z.string())
      .optional()
      .describe(
        bundle.describeParam(
          "loom_changelog",
          "highlights",
          "Manual highlights used when mode=manual",
        ),
      ),
    commit: z
      .boolean()
      .optional()
      .describe(
        bundle.describeParam(
          "loom_changelog",
          "commit",
          "Whether to auto-commit changelog update (default: true)",
        ),
      ),
  },
  async ({ mode, date, highlights, commit }) => {
    const { config } = await getRuntimeContext();
    const { loomRoot } = await getRuntimeContext();
    const git = new GitManager(WORK_DIR, config);
    const output = await executeUpdateChangelog({
      workDir: WORK_DIR,
      loomRoot,
      git,
      command: {
        mode: mode ?? "auto",
        date,
        highlights,
        commit: commit ?? true,
      },
    });

    if (!output.ok || !output.data) {
      return {
        content: [
          {
            type: "text",
            text: output.issues.map((i) => i.message).join("\n"),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: [
            `Updated: ${output.data.filePath}`,
            `Date: ${output.data.date}`,
            `Added points: ${output.data.added}`,
            `Total points for date: ${output.data.totalForDate}`,
            `Git: ${output.data.git ?? "skipped"}`,
          ].join("\n"),
        },
      ],
    };
  },
);

// ─── Tool: loom_metrics_snapshot ───────────────────────────────
server.tool(
  "loom_metrics_snapshot",
  bundle.describeTool(
    "loom_metrics_snapshot",
    "Generate metrics snapshot JSON for governance and auxiliary indicators.",
  ),
  {
    snapshot_date: z
      .string()
      .optional()
      .describe(
        bundle.describeParam(
          "loom_metrics_snapshot",
          "snapshot_date",
          "Date in YYYY-MM-DD. Defaults to today.",
        ),
      ),
    stale_days: z
      .number()
      .optional()
      .describe(
        bundle.describeParam(
          "loom_metrics_snapshot",
          "stale_days",
          "Stale-age threshold in days for doctor (optional).",
        ),
      ),
    include_threads: z
      .boolean()
      .optional()
      .describe(
        bundle.describeParam(
          "loom_metrics_snapshot",
          "include_threads",
          "Whether doctor includes threads category (optional).",
        ),
      ),
    max_findings: z
      .number()
      .optional()
      .describe(
        bundle.describeParam(
          "loom_metrics_snapshot",
          "max_findings",
          "Maximum doctor findings to return (optional).",
        ),
      ),
    fail_on: z
      .enum(["none", "error", "warn"])
      .optional()
      .describe(
        bundle.describeParam(
          "loom_metrics_snapshot",
          "fail_on",
          "Doctor gate: none | error | warn (optional).",
        ),
      ),
  },
  async ({
    snapshot_date,
    stale_days,
    include_threads,
    max_findings,
    fail_on,
  }) => {
    const { loomRoot } = await getRuntimeContext();
    await ensureLoomStructure(loomRoot);
    const output = await executeMetricsSnapshot({
      loomRoot,
      command: {
        snapshotDate: snapshot_date,
        staleDays: stale_days ?? 30,
        includeThreads: include_threads ?? true,
        maxFindings: max_findings ?? 200,
        failOn: fail_on ?? "none",
      },
    });
    if (!output.ok || !output.data) {
      return {
        content: [{ type: "text", text: "Failed to generate metrics snapshot." }],
      };
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              ok: true,
              filePath: output.data.filePath,
              snapshot: output.data.snapshot,
              artifacts: output.artifacts,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

// ─── Tool: loom_metrics_report ─────────────────────────────────
server.tool(
  "loom_metrics_report",
  bundle.describeTool(
    "loom_metrics_report",
    "Generate a weekly-style metrics report draft from events and latest snapshots.",
  ),
  {
    since: z
      .string()
      .optional()
      .describe(
        bundle.describeParam(
          "loom_metrics_report",
          "since",
          "Only include events since YYYY-MM-DD",
        ),
      ),
    limit: z
      .number()
      .optional()
      .describe(
        bundle.describeParam(
          "loom_metrics_report",
          "limit",
          "Max number of events to analyze",
        ),
      ),
    report_date: z
      .string()
      .optional()
      .describe(
        bundle.describeParam(
          "loom_metrics_report",
          "report_date",
          "Report date label YYYY-MM-DD",
        ),
      ),
  },
  async ({ since, limit, report_date }) => {
    const { loomRoot } = await getRuntimeContext();
    await ensureLoomStructure(loomRoot);
    const output = await executeMetricsReport({
      loomRoot,
      command: {
        since,
        limit,
        reportDate: report_date,
      },
    });
    if (!output.ok || !output.data) {
      return {
        content: [{ type: "text", text: "Failed to generate metrics report." }],
      };
    }
    return {
      content: [{ type: "text", text: output.data.reportMarkdown }],
    };
  },
);

// ─── Tool: loom_events ─────────────────────────────────────────
server.tool(
  "loom_events",
  bundle.describeTool(
    "loom_events",
    "Query Loom append-only event stream with type/since/limit filters.",
  ),
  {
    type: z
      .enum([
        "knowledge.ingested",
        "knowledge.traced",
        "index.rebuilt",
        "index.query.executed",
        "probe.started",
        "probe.committed",
        "doctor.executed",
        "changelog.updated",
        "metrics.snapshot.generated",
      ])
      .optional()
      .describe(bundle.describeParam("loom_events", "type", "Event type filter (optional)")),
    since: z
      .string()
      .optional()
      .describe(
        bundle.describeParam("loom_events", "since", "Only include events since YYYY-MM-DD"),
      ),
    limit: z
      .number()
      .optional()
      .describe(
        bundle.describeParam("loom_events", "limit", "Maximum events to return"),
      ),
    order: z
      .enum(["asc", "desc"])
      .optional()
      .describe(bundle.describeParam("loom_events", "order", "asc | desc")),
  },
  async ({ type, since, limit, order }) => {
    const { loomRoot } = await getRuntimeContext();
    await ensureLoomStructure(loomRoot);
    const output = await executeQueryEvents({
      loomRoot,
      command: {
        type,
        since,
        limit: limit ?? 50,
        order: order ?? "desc",
      },
    });
    if (!output.ok || !output.data) {
      return { content: [{ type: "text", text: "Failed to query events." }] };
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              ok: true,
              total: output.data.total,
              counts: output.data.counts,
              events: output.data.events,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

// ─── Tool: loom_upgrade ────────────────────────────────────────
server.tool(
  "loom_upgrade",
  bundle.describeTool(
    "loom_upgrade",
    "Upgrade Loom MCP server to the latest version from its GitHub repository. This updates the Loom install itself, not the current project's .loom knowledge files.",
  ),
  {
    dryRun: z
      .boolean()
      .optional()
      .describe(
        bundle.describeParam(
          "loom_upgrade",
          "dryRun",
          "If true, only check upgrade readiness without pulling changes",
        ),
      ),
  },
  async ({ dryRun }) => {
    const result = await upgradeFromGit(SERVER_ROOT, dryRun ?? false);
    return {
      content: [
        {
          type: "text",
          text: [result.message, ...result.details].join("\n"),
        },
      ],
    };
  },
);

// ─── Tool: loom_deprecate ─────────────────────────────────────
server.tool(
  "loom_deprecate",
  bundle.describeTool(
    "loom_deprecate",
    "Mark a knowledge entry as deprecated. Use this when information is outdated, superseded by a newer entry, or no longer accurate. The entry is preserved but clearly marked.",
  ),
  {
    category: z
      .enum(["concepts", "decisions", "threads"])
      .describe(
        bundle.describeParam("loom_deprecate", "category", "concepts | decisions | threads"),
      ),
    slug: z
      .string()
      .describe(
        bundle.describeParam(
          "loom_deprecate",
          "slug",
          "The slug (filename without .md) of the entry to deprecate",
        ),
      ),
    reason: z
      .string()
      .describe(
        bundle.describeParam(
          "loom_deprecate",
          "reason",
          "Why this entry is being deprecated (e.g. 'Replaced by new auth flow', 'No longer relevant after migration')",
        ),
      ),
    superseded_by: z
      .string()
      .optional()
      .describe(
        bundle.describeParam(
          "loom_deprecate",
          "superseded_by",
          "Optional path to the replacement entry (e.g. 'concepts/new-auth-flow')",
        ),
      ),
  },
  async ({ category, slug, reason, superseded_by }) => {
    const { config, loomRoot } = await getRuntimeContext();

    const result = await deprecateEntry(
      loomRoot,
      category,
      slug,
      reason,
      superseded_by,
    );

    if (!result.success) {
      return {
        content: [{ type: "text", text: result.message }],
      };
    }

    await rebuildIndex(loomRoot);

    const git = new GitManager(WORK_DIR, config);
    const commitResult = await git.commitChanges(
      [result.filePath, `${loomRoot}/index.md`],
      `deprecate ${category}/${slug}`,
    );

    return {
      content: [
        {
          type: "text",
          text: [
            result.message,
            `Reason: ${reason}`,
            superseded_by ? `Superseded by: ${superseded_by}` : "",
            `Git: ${commitResult.message}`,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

// ─── Tool: loom_reflect ───────────────────────────────────────
server.tool(
  "loom_reflect",
  bundle.describeTool(
    "loom_reflect",
    "Run a self-reflection audit on Loom knowledge base to detect potential conflicts, stale entries, missing tags, and merge opportunities.",
  ),
  {
    staleDays: z
      .number()
      .optional()
      .describe(
        bundle.describeParam(
          "loom_reflect",
          "staleDays",
          "Entries not updated for this many days are considered stale (default: 30)",
        ),
      ),
    includeThreads: z
      .boolean()
      .optional()
      .describe(
        bundle.describeParam(
          "loom_reflect",
          "includeThreads",
          "Whether to include threads category in reflection scan (default: true)",
        ),
      ),
    maxFindings: z
      .number()
      .optional()
      .describe(
        bundle.describeParam(
          "loom_reflect",
          "maxFindings",
          "Maximum number of findings to return (default: 20)",
        ),
      ),
  },
  async ({ staleDays, includeThreads, maxFindings }) => {
    const { config, loomRoot } = await getRuntimeContext();
    await ensureLoomStructure(loomRoot);

    const report = await reflect(loomRoot, {
      staleDays: staleDays ?? 30,
      includeThreads: includeThreads ?? true,
      maxFindings: maxFindings ?? 20,
    });

    if (report.issues.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: [
              `Reflection completed at ${report.generatedAt}`,
              `Scanned entries: ${report.scannedEntries}`,
              "No issues detected. Knowledge base looks healthy.",
            ].join("\n"),
          },
        ],
      };
    }

    const grouped: Record<string, typeof report.issues> = {};
    for (const issue of report.issues) {
      (grouped[issue.type] ??= []).push(issue);
    }

    const sections = Object.entries(grouped)
      .map(([type, issues]) => {
        const rows = issues
          .map((issue, idx) => {
            const files = issue.files.map((f) => `    - ${f}`).join("\n");
            return `${idx + 1}. ${issue.reason}\n${files}`;
          })
          .join("\n");
        return `## ${type}\n${rows}`;
      })
      .join("\n\n");

    return {
      content: [
        {
          type: "text",
          text: [
            `Reflection completed at ${report.generatedAt}`,
            `Scanned entries: ${report.scannedEntries}`,
            `Findings: ${report.issues.length}`,
            "",
            sections,
          ].join("\n"),
        },
      ],
    };
  },
);

} // end registerLoomToolDefinitions

/** Used when `loom-instructions.md` is missing for the active locale/version. */
const FALLBACK_LOOM_INSTRUCTIONS = `You have access to a knowledge management system called Loom. Follow these guidelines:

## When to WRITE (loom_weave)

Proactively call loom_weave when any of the following happen during our conversation:
- A system architecture or module boundary is defined or clarified
- A technical decision is made (and why)
- Business logic or domain rules are explained
- A non-obvious constraint or trade-off is identified
- A bug root cause is found and the fix approach is decided
- A feature design is finalized after discussion

Use categories:
- "concepts" for architecture, modules, business logic, terminology
- "decisions" for ADR-style "why we chose X over Y" records
- "threads" for conversation summaries, meeting notes, discussion digests

Use mode:
- "replace" for new entries or full rewrites
- "append" to add new findings to an existing topic without losing previous content
- "section" to update a specific ## heading within an existing entry

When Loom MCP is connected, write knowledge under .loom/ via loom_weave (not host file-edit tools), so lint, index rebuild, git commit, and events run. Put structured body in "content" starting with ## headings; do not duplicate the top-level # title (title field supplies it).

## When to READ (loom_trace / loom_read)

- Always start with loom_index to get the high-level map first
- Treat mandatory set as required context:
  - Recent memory: latest 5 entries (do not skip categories)
  - Core concepts: concepts tagged with "core"
- Mandatory-read snippets are intentionally truncated; only expand with loom_read when needed
- Before answering questions about the system, check if Loom already has relevant knowledge
- Before making architectural suggestions, trace existing decisions to avoid contradictions
- When the user asks "what do we know about X", always check Loom first
- Use progressive disclosure:
  1) loom_index for global map + mandatory read set
  2) loom_trace for candidate entries
  3) loom_read only for top relevant entries
  4) read full files only when summary is insufficient

## When to ASK (loom_probe)

- When requirements are ambiguous or underspecified
- When scope/acceptance criteria are missing
- When current request may conflict with existing concepts/decisions
- Prefer state-machine flow:
  1) loom_probe_start to create a session and generate questions
  2) ask user in chat
  3) loom_probe_commit with session_id + answers to persist Q&A
- loom_probe remains available as a compatibility wrapper

## When to REFLECT (loom_reflect)

- When the user asks for a knowledge base health check
- Periodically after many weave operations to check for conflicts

## When to DEPRECATE (loom_deprecate)

- When new knowledge explicitly supersedes an older entry
- When a previous decision is reversed

## General Rules

- Always include meaningful tags for better retrieval
- For foundational concepts, include "core" tag (or set is_core=true)
- For concepts/decisions, include domain + links whenever possible for graph continuity
- Keep entries focused: one topic per entry
- Prefer structured Markdown with ## headings
- For threads: summarize key points, don't dump raw conversation`;

function registerLoomPrompt(bundle: LoadedPrompts): void {
  const text = bundle.loomInstructions.trim() || FALLBACK_LOOM_INSTRUCTIONS;
  server.prompt(
    "loom-instructions",
    "系统说明：在对话中如何、何时主动使用 Loom 工具。",
    async () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text,
          },
        },
      ],
    }),
  );
}

// ─── Resource: loom://index ───────────────────────────────────
server.resource("loom-index", "loom://index", async (uri) => {
  const { loomRoot } = await getRuntimeContext();

  try {
    const indexContent = await rebuildIndex(loomRoot);
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: indexContent,
        },
      ],
    };
  } catch {
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "text/plain",
          text: "Loom not initialized. Use loom_init to get started.",
        },
      ],
    };
  }
});

// ─── Boot ─────────────────────────────────────────────────────
function maybeHandleMetaArgs(): boolean {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`Loom MCP Server

Usage:
  loom                Start MCP stdio server
  loom --help         Show this help
  loom --version      Show version

Notes:
  - 'loom' is the MCP server binary and waits for stdio transport.
  - For interactive commands, use 'loom-cli help'.`);
    return true;
  }
  if (args.includes("--version") || args.includes("-v")) {
    console.log(SERVER_VERSION);
    return true;
  }
  return false;
}

async function main() {
  if (maybeHandleMetaArgs()) return;
  const config = await loadConfig(WORK_DIR);
  const bundle = await loadPromptBundle(SERVER_ROOT, WORK_DIR, config);
  registerLoomToolDefinitions(bundle);
  registerLoomPrompt(bundle);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Loom MCP server failed to start:", err);
  process.exit(1);
});
