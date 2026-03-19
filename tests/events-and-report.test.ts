import * as fs from "fs/promises";
import * as path from "path";
import { describe, expect, it } from "vitest";
import { ensureLoomStructure } from "../src/config.js";
import { appendEvent, queryEvents, readEvents, replayEvents } from "../src/events.js";
import { executeQueryEvents } from "../src/app/usecases/query-events.js";
import { executeMetricsReport } from "../src/app/usecases/metrics-report.js";
import { executeMetricsSnapshot } from "../src/app/usecases/metrics-snapshot.js";
import { makeTempDir } from "./test-utils.js";

describe("events and metrics report", () => {
  it("queries events with filters and replays state", async () => {
    const workDir = await makeTempDir("loom-events-");
    const loomRoot = path.join(workDir, ".loom");
    await ensureLoomStructure(loomRoot);

    await appendEvent(loomRoot, {
      type: "knowledge.ingested",
      ts: "2026-03-19T00:00:00.000Z",
      payload: { title: "A" },
    });
    await appendEvent(loomRoot, {
      type: "knowledge.traced",
      ts: "2026-03-19T00:00:05.000Z",
      payload: { query: "auth", count: 2 },
    });
    await appendEvent(loomRoot, {
      type: "doctor.executed",
      ts: "2026-03-19T00:00:10.000Z",
      payload: { shouldFail: false },
    });

    const all = await readEvents(loomRoot);
    const traces = queryEvents(all, { type: "knowledge.traced", order: "asc" });
    expect(traces).toHaveLength(1);
    const replay = replayEvents(all);
    expect(replay.ingestedCount).toBe(1);
    expect(replay.traceHitCount).toBe(1);
    expect(replay.doctorPassCount).toBe(1);
  });

  it("generates events usecase and metrics report usecase", async () => {
    const workDir = await makeTempDir("loom-report-");
    const loomRoot = path.join(workDir, ".loom");
    await ensureLoomStructure(loomRoot);

    await appendEvent(loomRoot, {
      type: "knowledge.ingested",
      ts: "2026-03-19T01:00:00.000Z",
      payload: {},
    });
    await appendEvent(loomRoot, {
      type: "probe.started",
      ts: "2026-03-19T01:01:00.000Z",
      payload: {},
    });
    await appendEvent(loomRoot, {
      type: "knowledge.traced",
      ts: "2026-03-19T01:02:00.000Z",
      payload: { count: 1 },
    });
    await appendEvent(loomRoot, {
      type: "doctor.executed",
      ts: "2026-03-19T01:03:00.000Z",
      payload: { shouldFail: false },
    });
    await fs.mkdir(path.join(loomRoot, "metrics"), { recursive: true });
    await fs.writeFile(
      path.join(loomRoot, "metrics", "snapshot-2026-03-19.json"),
      JSON.stringify({ schema: "metrics.snapshot.v1" }),
      "utf-8",
    );

    const queried = await executeQueryEvents({
      loomRoot,
      command: { since: "2026-03-19", limit: 10, order: "asc" },
    });
    expect(queried.ok).toBe(true);
    expect(queried.data?.total).toBe(4);
    expect(queried.data?.counts["knowledge.ingested"]).toBe(1);

    const report = await executeMetricsReport({
      loomRoot,
      command: { since: "2026-03-19", reportDate: "2026-03-19" },
    });
    expect(report.ok).toBe(true);
    expect(report.data?.summary.m1CaptureRate).toBeGreaterThanOrEqual(0);
    expect(report.data?.reportMarkdown.includes("M3 Governance Pass Rate")).toBe(true);
    expect(report.data?.basedOn.latestSnapshot?.endsWith("snapshot-2026-03-19.json")).toBe(
      true,
    );

    const snapshot = await executeMetricsSnapshot({
      loomRoot,
      command: {
        failOn: "none",
        staleDays: 30,
        includeThreads: true,
        maxFindings: 20,
      },
    });
    expect(snapshot.ok).toBe(true);
    expect(snapshot.data?.snapshot.metrics.captureRate).toBe(0.5);
    expect(snapshot.data?.snapshot.metrics.retrievalHitRate).toBe(1);
  });
});
