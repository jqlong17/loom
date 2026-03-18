#!/usr/bin/env node

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
  readKnowledge,
  rebuildIndex,
  reflect,
} from "./weaver.js";
import { GitManager } from "./git-manager.js";

const WORK_DIR = process.env.LOOM_WORK_DIR ?? process.cwd();

const server = new McpServer({
  name: "loom",
  version: "0.1.0",
});

// ─── Tool: loom_init ──────────────────────────────────────────
server.tool(
  "loom_init",
  "Initialize Loom knowledge base in the current project. Creates .loom/ directory structure with index, concepts, decisions, and threads folders.",
  {},
  async () => {
    const config = await loadConfig(WORK_DIR);
    const loomRoot = resolveLoomPath(WORK_DIR, config);
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
  "Weave a piece of knowledge into the Loom knowledge base. Use this whenever you learn something important about the system architecture, business logic, technical decisions, or discussion threads from conversations.",
  {
    category: z
      .enum(["concepts", "decisions", "threads"])
      .describe(
        "Knowledge category: 'concepts' for system architecture, business logic, terminology; 'decisions' for ADR-style records of why something was chosen; 'threads' for conversation summaries and discussion notes",
      ),
    title: z
      .string()
      .describe(
        "A clear, descriptive title for this knowledge entry (e.g. 'Payment Flow', 'Why We Chose PostgreSQL')",
      ),
    content: z
      .string()
      .describe(
        "The knowledge content in Markdown format. Be thorough and structured.",
      ),
    tags: z
      .array(z.string())
      .optional()
      .describe(
        "Optional tags for categorization and retrieval (e.g. ['backend', 'database', 'auth'])",
      ),
  },
  async ({ category, title, content, tags }) => {
    const config = await loadConfig(WORK_DIR);
    const loomRoot = resolveLoomPath(WORK_DIR, config);
    await ensureLoomStructure(loomRoot);

    const { filePath, isUpdate } = await weave(loomRoot, {
      title,
      category,
      content,
      tags,
    });

    await rebuildIndex(loomRoot);

    const git = new GitManager(WORK_DIR, config);
    const action = isUpdate ? "update" : "add";
    const commitResult = await git.commitChanges(
      [filePath, `${loomRoot}/index.md`],
      `${action} ${category}/${title}`,
    );

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
            `${isUpdate ? "Updated" : "Created"}: ${category}/${title}`,
            `File: ${filePath}`,
            `Tags: ${tags?.join(", ") ?? "none"}`,
            `Git: ${commitResult.message}${pushMsg}`,
            `Index rebuilt.`,
          ].join("\n"),
        },
      ],
    };
  },
);

// ─── Tool: loom_trace ─────────────────────────────────────────
server.tool(
  "loom_trace",
  "Search the Loom knowledge base by keyword. Use this to recall previously recorded knowledge about the system before making decisions or answering questions.",
  {
    query: z
      .string()
      .describe("Keyword or phrase to search across all knowledge entries"),
  },
  async ({ query }) => {
    const config = await loadConfig(WORK_DIR);
    const loomRoot = resolveLoomPath(WORK_DIR, config);

    const results = await trace(loomRoot, query);

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
          `### ${r.title} [${r.category}]\nFile: ${r.filePath}\nTags: ${r.tags} | Updated: ${r.updated}\n\n${r.snippet}`,
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

// ─── Tool: loom_read ──────────────────────────────────────────
server.tool(
  "loom_read",
  "Read the full content of a specific knowledge entry from the Loom knowledge base.",
  {
    category: z.enum(["concepts", "decisions", "threads"]),
    slug: z
      .string()
      .describe(
        "The slug (filename without .md extension) of the knowledge entry to read",
      ),
  },
  async ({ category, slug }) => {
    const config = await loadConfig(WORK_DIR);
    const loomRoot = resolveLoomPath(WORK_DIR, config);

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
  "List all knowledge entries in the Loom knowledge base. Use this to get an overview of what the system knows.",
  {},
  async () => {
    const config = await loadConfig(WORK_DIR);
    const loomRoot = resolveLoomPath(WORK_DIR, config);

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
  "Synchronize the Loom knowledge base with the remote Git repository. Pulls latest changes from teammates and pushes local changes.",
  {},
  async () => {
    const config = await loadConfig(WORK_DIR);
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
  "Show the Git history of Loom knowledge changes. Useful for understanding how the system's understanding has evolved over time.",
  {
    limit: z
      .number()
      .optional()
      .describe("Maximum number of log entries to show (default: 10)"),
  },
  async ({ limit }) => {
    const config = await loadConfig(WORK_DIR);
    const git = new GitManager(WORK_DIR, config);

    const log = await git.log(limit ?? 10);
    return { content: [{ type: "text", text: `Loom Git History:\n\n${log}` }] };
  },
);

// ─── Tool: loom_reflect ───────────────────────────────────────
server.tool(
  "loom_reflect",
  "Run a self-reflection audit on Loom knowledge base to detect potential conflicts, stale entries, missing tags, and merge opportunities.",
  {
    staleDays: z
      .number()
      .optional()
      .describe("Entries not updated for this many days are considered stale (default: 30)"),
    includeThreads: z
      .boolean()
      .optional()
      .describe("Whether to include threads category in reflection scan (default: true)"),
    maxFindings: z
      .number()
      .optional()
      .describe("Maximum number of findings to return (default: 20)"),
  },
  async ({ staleDays, includeThreads, maxFindings }) => {
    const config = await loadConfig(WORK_DIR);
    const loomRoot = resolveLoomPath(WORK_DIR, config);
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

// ─── Resource: loom://index ───────────────────────────────────
server.resource("loom-index", "loom://index", async (uri) => {
  const config = await loadConfig(WORK_DIR);
  const loomRoot = resolveLoomPath(WORK_DIR, config);

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
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Loom MCP server failed to start:", err);
  process.exit(1);
});
