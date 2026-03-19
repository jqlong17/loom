import { collectDailyHighlightsFromGit, updateChangelog } from "../../changelog.js";
import type { GitManager } from "../../git-manager.js";
import { appendEvent } from "../../events.js";
import {
  failResult,
  successResult,
  type ApplicationResult,
} from "../../contracts/application-result.js";
import type {
  ChangelogCommand,
  ChangelogOutcome,
} from "../../contracts/knowledge.js";

export async function executeUpdateChangelog(params: {
  workDir: string;
  loomRoot: string;
  git: GitManager;
  command: ChangelogCommand;
}): Promise<ApplicationResult<ChangelogOutcome>> {
  const mode = params.command.mode ?? "auto";
  const highlights =
    mode === "manual"
      ? (params.command.highlights ?? [])
      : await collectDailyHighlightsFromGit(params.workDir, params.command.date);

  if (highlights.length === 0) {
    return failResult(
      [
        {
          level: "warn",
          code: "CHANGELOG_NO_HIGHLIGHTS",
          message:
            mode === "manual"
              ? "No highlights provided."
              : "No highlights inferred from git commits.",
        },
      ],
      [],
      {
        shouldFail: false,
        level: "warn",
        reason: "no_highlights",
      },
    );
  }

  const updated = await updateChangelog(params.workDir, highlights, params.command.date);
  let gitMsg: string | undefined;
  if (params.command.commit ?? true) {
    const commitResult = await params.git.commitChanges(
      [updated.filePath],
      `update changelog ${updated.date}`,
    );
    gitMsg = commitResult.message;
  }

  const eventFile = await appendEvent(params.loomRoot, {
    type: "changelog.updated",
    ts: new Date().toISOString(),
    payload: {
      date: updated.date,
      added: updated.added,
      totalForDate: updated.totalForDate,
    },
  });

  return successResult(
    {
      filePath: updated.filePath,
      date: updated.date,
      added: updated.added,
      totalForDate: updated.totalForDate,
      git: gitMsg,
    },
    [],
    [updated.filePath, eventFile],
    { shouldFail: false },
  );
}
