import * as path from "path";
import { describe, expect, it } from "vitest";
import { ensureLoomStructure, type LoomConfig } from "../src/config.js";
import { GitManager } from "../src/git-manager.js";
import { ingestKnowledge, runDoctor } from "../src/core/loom-core.js";
import { makeTempDir, pathExists } from "./test-utils.js";

const TEST_CONFIG: LoomConfig = {
  loomDir: ".loom",
  autoCommit: false,
  autoPush: false,
  branch: "main",
  commitPrefix: "loom",
};

describe("core loom service", () => {
  it("ingests a concept without git commit", async () => {
    const workDir = await makeTempDir("loom-core-");
    const loomRoot = path.join(workDir, ".loom");
    await ensureLoomStructure(loomRoot);
    const git = new GitManager(workDir, TEST_CONFIG);

    const result = await ingestKnowledge({
      workDir,
      loomRoot,
      config: TEST_CONFIG,
      git,
      input: {
        category: "concepts",
        title: "Core ingest test entry",
        content: "## 背景\n用于测试 ingest。\n\n## 结论\n可完成写入。",
        tags: ["architecture"],
        links: ["concepts/non-existing-link"],
        domain: "architecture",
        commit: false,
        changelog: false,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.ingest?.filePath.endsWith(".md")).toBe(true);
    expect(
      await pathExists(path.join(loomRoot, "concepts", "core-ingest-test-entry.md")),
    ).toBe(true);
  });

  it("doctor fails on dangling links when failOn=error", async () => {
    const workDir = await makeTempDir("loom-core-");
    const loomRoot = path.join(workDir, ".loom");
    await ensureLoomStructure(loomRoot);
    const git = new GitManager(workDir, TEST_CONFIG);

    await ingestKnowledge({
      workDir,
      loomRoot,
      config: TEST_CONFIG,
      git,
      input: {
        category: "concepts",
        title: "Doctor dangling link sample",
        content: "## 背景\n用于制造 dangling link。\n\n## 结论\n检查 error 门禁。",
        tags: ["architecture"],
        domain: "architecture",
        links: ["concepts/does-not-exist"],
        commit: false,
      },
    });

    const report = await runDoctor({
      loomRoot,
      staleDays: 30,
      includeThreads: true,
      maxFindings: 20,
      failOn: "error",
    });

    expect(report.shouldFail).toBe(true);
    expect(report.summary.errorCount).toBeGreaterThan(0);
    expect(report.issues.some((i) => i.type === "dangling_link")).toBe(true);
  });

  it("doctor can pass when failOn=none", async () => {
    const workDir = await makeTempDir("loom-core-");
    const loomRoot = path.join(workDir, ".loom");
    await ensureLoomStructure(loomRoot);

    const report = await runDoctor({
      loomRoot,
      staleDays: 30,
      includeThreads: true,
      maxFindings: 20,
      failOn: "none",
    });

    expect(report.ok).toBe(true);
    expect(report.failOn).toBe("none");
  });
});
