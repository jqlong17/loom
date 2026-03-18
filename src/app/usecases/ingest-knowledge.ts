import type { LoomConfig } from "../../config.js";
import type { GitManager } from "../../git-manager.js";
import { ingestKnowledge } from "../../core/loom-core.js";
import {
  failResult,
  successResult,
  type ApplicationResult,
} from "../../contracts/application-result.js";
import type {
  IngestCommand,
  IngestOutcome,
} from "../../contracts/knowledge.js";

export async function executeIngestKnowledge(params: {
  workDir: string;
  loomRoot: string;
  config: LoomConfig;
  git: GitManager;
  command: IngestCommand;
}): Promise<ApplicationResult<IngestOutcome>> {
  const output = await ingestKnowledge({
    workDir: params.workDir,
    loomRoot: params.loomRoot,
    config: params.config,
    git: params.git,
    input: params.command,
  });

  if (!output.ok || !output.ingest) {
    return failResult([
      {
        level: "error",
        code: "INGEST_LINT_BLOCKED",
        message: "Ingest blocked by memory lint errors.",
        suggestion: output.lintReport,
      },
    ]);
  }

  return successResult({
    ingest: output.ingest,
    lintReport: output.lintReport,
    lintIssues: output.lintIssues,
    changelog: output.changelog,
    git: output.git,
  });
}
