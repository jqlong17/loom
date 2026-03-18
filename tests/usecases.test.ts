import * as path from "path";
import { describe, expect, it } from "vitest";
import { ensureLoomStructure, type LoomConfig } from "../src/config.js";
import { GitManager } from "../src/git-manager.js";
import { executeIngestKnowledge } from "../src/app/usecases/ingest-knowledge.js";
import { executeRunDoctor } from "../src/app/usecases/run-doctor.js";
import { makeTempDir } from "./test-utils.js";

const TEST_CONFIG: LoomConfig = {
  loomDir: ".loom",
  autoCommit: false,
  autoPush: false,
  branch: "main",
  commitPrefix: "loom",
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
  });
});
