import * as path from "path";
import * as fs from "fs/promises";
import { describe, expect, it } from "vitest";
import {
  ensureLoomStructure,
  MCP_READ_LIMITS_DEFAULTS,
  type LoomConfig,
} from "../src/config.js";
import { GitManager } from "../src/git-manager.js";
import { executeIngestKnowledge } from "../src/app/usecases/ingest-knowledge.js";
import { executeRunDoctor } from "../src/app/usecases/run-doctor.js";
import { executeStartProbeSession } from "../src/app/usecases/start-probe-session.js";
import { executeCommitProbeSession } from "../src/app/usecases/commit-probe-session.js";
import { executeUpdateChangelog } from "../src/app/usecases/update-changelog.js";
import { executeMetricsSnapshot } from "../src/app/usecases/metrics-snapshot.js";
import { appendEvent } from "../src/events.js";
import { makeTempDir } from "./test-utils.js";

const TEST_CONFIG: LoomConfig = {
  loomDir: ".loom",
  autoCommit: false,
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

describe("application usecases", () => {
  it("executeIngestKnowledge returns structured failure on lint errors", async () => {
    const workDir = await makeTempDir("loom-usecase-");
    const loomRoot = path.join(workDir, ".loom");
    await ensureLoomStructure(loomRoot);
    const git = new GitManager(workDir, TEST_CONFIG);

    const result = await executeIngestKnowledge({
      workDir,
      loomRoot,
      config: TEST_CONFIG,
      git,
      command: {
        category: "concepts",
        title: "a",
        content: "short",
      },
    });

    expect(result.ok).toBe(false);
    expect(result.issues[0].code).toBe("INGEST_LINT_BLOCKED");
  });

  it("executeRunDoctor returns normalized data envelope", async () => {
    const workDir = await makeTempDir("loom-usecase-");
    const loomRoot = path.join(workDir, ".loom");
    await ensureLoomStructure(loomRoot);

    const result = await executeRunDoctor({
      loomRoot,
      command: {
        staleDays: 30,
        includeThreads: true,
        maxFindings: 10,
        failOn: "none",
      },
    });

    expect(result.ok).toBe(true);
    expect(result.data?.failOn).toBe("none");
    expect(result.data?.summary.total).toBeGreaterThanOrEqual(0);
    expect(result.gate?.shouldFail).toBe(false);
  });

  it("probe start + commit are available through usecases", async () => {
    const workDir = await makeTempDir("loom-usecase-");
    const loomRoot = path.join(workDir, ".loom");
    await ensureLoomStructure(loomRoot);
    const git = new GitManager(workDir, TEST_CONFIG);

    const started = await executeStartProbeSession({
      loomRoot,
      command: {
        context: "实现 metrics snapshot 与事件流",
        goal: "形成可回归的指标数据文件",
        maxQuestions: 3,
      },
    });
    expect(started.ok).toBe(true);
    expect(started.data?.questions.length).toBeGreaterThan(0);

    const first = started.data?.questions[0];
    const committed = await executeCommitProbeSession({
      loomRoot,
      git,
      command: {
        sessionId: started.data?.sessionId,
        answers: [
          {
            question_id: first?.id,
            answer: "先覆盖 M3 与辅助指标，后续再补 M1/M2。",
          },
        ],
        commit: false,
      },
    });
    expect(committed.ok).toBe(true);
    expect(committed.data?.matchedAnswers).toBe(1);
    expect(committed.artifacts?.some((p) => p.endsWith(".md"))).toBe(true);
  });

  it("update changelog usecase returns structured output", async () => {
    const workDir = await makeTempDir("loom-usecase-");
    const loomRoot = path.join(workDir, ".loom");
    await ensureLoomStructure(loomRoot);
    const git = new GitManager(workDir, TEST_CONFIG);

    const output = await executeUpdateChangelog({
      workDir,
      loomRoot,
      git,
      command: {
        mode: "manual",
        highlights: ["新增 metrics snapshot 命令，目的是形成量化反馈闭环。"],
        date: "2026-03-18",
        commit: false,
      },
    });
    expect(output.ok).toBe(true);
    expect(output.data?.added).toBeGreaterThan(0);
  });

  it("metrics snapshot usecase writes snapshot json", async () => {
    const workDir = await makeTempDir("loom-usecase-");
    const loomRoot = path.join(workDir, ".loom");
    await ensureLoomStructure(loomRoot);

    const snapshot = await executeMetricsSnapshot({
      loomRoot,
      command: {
        failOn: "none",
        staleDays: 30,
        includeThreads: true,
        maxFindings: 50,
        snapshotDate: "2026-03-18",
      },
    });
    expect(snapshot.ok).toBe(true);
    expect(snapshot.data?.snapshot.schema).toBe("metrics.snapshot.v1");
    expect(snapshot.data?.filePath.endsWith(".json")).toBe(true);
    expect(snapshot.data?.snapshot.metrics.captureRate).toBeGreaterThanOrEqual(0);
    expect(snapshot.data?.snapshot.metrics.retrievalHitRate).toBeGreaterThanOrEqual(0);
  });

  it("metrics snapshot aggregates doctor and probe data branches", async () => {
    const workDir = await makeTempDir("loom-usecase-");
    const loomRoot = path.join(workDir, ".loom");
    await ensureLoomStructure(loomRoot);

    await fs.mkdir(path.join(loomRoot, "probes"), { recursive: true });
    await fs.writeFile(
      path.join(loomRoot, "probes", "probe-test.json"),
      JSON.stringify({ status: "committed" }),
      "utf-8",
    );
    await appendEvent(loomRoot, {
      type: "doctor.executed",
      ts: "2026-03-19T00:00:00.000Z",
      payload: { shouldFail: false },
    });

    const snapshot = await executeMetricsSnapshot({
      loomRoot,
      command: {
        failOn: "none",
        staleDays: 30,
        includeThreads: true,
        maxFindings: 50,
      },
    });
    expect(snapshot.ok).toBe(true);
    expect(snapshot.data?.snapshot.metrics.governancePassRate).toBeGreaterThan(0);
    expect(snapshot.data?.snapshot.metrics.probeCompletionRate).toBe(1);
    expect(snapshot.data?.snapshot.metrics.captureRate).toBe(0);
    expect(Number.isFinite(snapshot.data?.snapshot.metrics.tokenROI)).toBe(true);
  });
});
