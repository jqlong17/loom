import * as path from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ensureLoomStructure,
  loadConfig,
  MCP_READ_LIMITS_DEFAULTS,
  resolveTraceLimit,
} from "../src/config.js";
import {
  applyListEntryCap,
  truncateMarkdownForContext,
} from "../src/mcp-read-bounds.js";
import { listAll, trace, weave } from "../src/weaver.js";
import { makeTempDir } from "./test-utils.js";

describe("MCP bounded reads helpers", () => {
  it("applyListEntryCap sorts by updated desc and truncates", () => {
    const items = [
      { updated: "2020-01-01T00:00:00Z", id: "old" },
      { updated: "2024-06-01T00:00:00Z", id: "new" },
      { updated: "2022-01-01T00:00:00Z", id: "mid" },
    ];
    const { shown, total, truncated } = applyListEntryCap(items, 2);
    expect(total).toBe(3);
    expect(truncated).toBe(true);
    expect(shown.map((x) => x.id)).toEqual(["new", "mid"]);
  });

  it("truncateMarkdownForContext adds notice when over cap", () => {
    const body = "x".repeat(200);
    const { text, truncated, originalChars } = truncateMarkdownForContext(
      body,
      50,
    );
    expect(originalChars).toBe(200);
    expect(truncated).toBe(true);
    expect(text.length).toBeLessThan(body.length);
    expect(text).toContain("已截断");
  });

  it("resolveTraceLimit falls back to configured default", () => {
    expect(resolveTraceLimit(undefined, 7)).toBe(7);
    expect(resolveTraceLimit(0, 7)).toBe(7);
    expect(resolveTraceLimit(3, 7)).toBe(3);
  });
});

describe("trace legacy default cap", () => {
  it("limits results when limit omitted (legacy)", async () => {
    const workDir = await makeTempDir("loom-bounded-trace-");
    const loomRoot = path.join(workDir, ".loom");
    await ensureLoomStructure(loomRoot);
    const marker = "uniqmarker-bounded-trace";
    for (let i = 0; i < 15; i++) {
      await weave(loomRoot, {
        category: "concepts",
        title: `entry-${i}`,
        content: `## 背景\n${marker} ${i}\n`,
        tags: ["test"],
      });
    }
    const hits = await trace(loomRoot, marker, { traceMode: "legacy" });
    expect(hits.length).toBe(MCP_READ_LIMITS_DEFAULTS.traceDefaultLimit);
  });

  it("respects explicit limit under legacy", async () => {
    const workDir = await makeTempDir("loom-bounded-trace-2-");
    const loomRoot = path.join(workDir, ".loom");
    await ensureLoomStructure(loomRoot);
    const marker = "uniqmarker-bounded-trace-2";
    for (let i = 0; i < 8; i++) {
      await weave(loomRoot, {
        category: "concepts",
        title: `e2-${i}`,
        content: `## 背景\n${marker}\n`,
      });
    }
    const hits = await trace(loomRoot, marker, {
      traceMode: "legacy",
      limit: 3,
    });
    expect(hits.length).toBe(3);
  });
});

describe("listAll + list cap integration", () => {
  it("listAll returns more rows than default cap when many entries exist", async () => {
    const workDir = await makeTempDir("loom-bounded-list-");
    const loomRoot = path.join(workDir, ".loom");
    await ensureLoomStructure(loomRoot);
    for (let i = 0; i < 12; i++) {
      await weave(loomRoot, {
        category: "decisions",
        title: `d-${i}`,
        content: `## Decision\nx ${i}\n`,
      });
    }
    const all = await listAll(loomRoot);
    expect(all.length).toBeGreaterThanOrEqual(12);
    const { shown, total, truncated } = applyListEntryCap(all, 5);
    expect(total).toBe(all.length);
    expect(truncated).toBe(true);
    expect(shown.length).toBe(5);
  });
});

describe("loadConfig mcpReadLimits env override", () => {
  const saved = {
    list: process.env.LOOM_MCP_LIST_MAX_ENTRIES,
    trace: process.env.LOOM_MCP_TRACE_DEFAULT_LIMIT,
    index: process.env.LOOM_MCP_INDEX_FULL_MAX_CHARS,
  };

  afterEach(() => {
    if (saved.list === undefined) delete process.env.LOOM_MCP_LIST_MAX_ENTRIES;
    else process.env.LOOM_MCP_LIST_MAX_ENTRIES = saved.list;
    if (saved.trace === undefined) {
      delete process.env.LOOM_MCP_TRACE_DEFAULT_LIMIT;
    } else process.env.LOOM_MCP_TRACE_DEFAULT_LIMIT = saved.trace;
    if (saved.index === undefined) {
      delete process.env.LOOM_MCP_INDEX_FULL_MAX_CHARS;
    } else process.env.LOOM_MCP_INDEX_FULL_MAX_CHARS = saved.index;
  });

  it("reads LOOM_MCP_TRACE_DEFAULT_LIMIT", async () => {
    process.env.LOOM_MCP_TRACE_DEFAULT_LIMIT = "42";
    const workDir = await makeTempDir("loom-cfg-env-");
    const cfg = await loadConfig(workDir);
    expect(cfg.mcpReadLimits.traceDefaultLimit).toBe(42);
  });
});
