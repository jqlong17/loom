import type { GitManager } from "../../git-manager.js";
import { commitProbeSession, type ProbeAnswerRecord } from "../../probe.js";
import { weave, rebuildIndex } from "../../weaver.js";
import { lintMemoryEntry, formatLintIssues } from "../../memory-lint.js";
import { appendEvent } from "../../events.js";
import { failResult, successResult, type ApplicationResult } from "../../contracts/application-result.js";
import type {
  ProbeCommitCommand,
  ProbeCommitOutcome,
} from "../../contracts/knowledge.js";
import { startProbeSessionCore } from "../../core/probe-core.js";

function buildProbeContent(params: {
  context: string;
  goal?: string;
  answers: ProbeAnswerRecord[];
  evidencePaths: string[];
  suggestedQuestions: string[];
}): string {
  const qas = params.answers
    .map((item, idx) => `### Q${idx + 1}: ${item.question}\n\nA: ${item.answer}`)
    .join("\n\n");
  const followups = params.suggestedQuestions.map((q) => `- ${q}`).join("\n");
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

export async function executeCommitProbeSession(params: {
  loomRoot: string;
  git: GitManager;
  command: ProbeCommitCommand;
}): Promise<ApplicationResult<ProbeCommitOutcome>> {
  let sessionId = params.command.sessionId;
  if (!sessionId) {
    if (!params.command.context?.trim()) {
      return failResult([
        {
          level: "error",
          code: "PROBE_SESSION_REQUIRED",
          message: "session_id is required if context is not provided.",
          suggestion: "Provide session_id or context to auto-create session.",
        },
      ]);
    }
    const started = await startProbeSessionCore({
      loomRoot: params.loomRoot,
      context: params.command.context,
      goal: params.command.goal,
      maxQuestions: params.command.maxQuestions ?? 3,
    });
    sessionId = started.sessionId;
  }

  if (!params.command.answers?.length) {
    return failResult([
      {
        level: "error",
        code: "PROBE_ANSWERS_REQUIRED",
        message: "answers are required to commit a probe session.",
      },
    ]);
  }

  let committed: Awaited<ReturnType<typeof commitProbeSession>>;
  try {
    committed = await commitProbeSession(
      params.loomRoot,
      sessionId,
      params.command.answers,
    );
  } catch (err) {
    return failResult([
      {
        level: "error",
        code: "PROBE_COMMIT_FAILED",
        message: (err as Error).message,
      },
    ]);
  }

  const entryTitle = params.command.title?.trim() || `probe-session-${sessionId}`;
  const normalizedTags = Array.from(
    new Set(["active-inquiry", "qa-capture", "memory", ...(params.command.tags ?? [])]),
  );
  const answeredIds = new Set(committed.matched.map((a) => a.question_id));
  const unanswered = committed.session.questions
    .filter((q) => !answeredIds.has(q.id))
    .map((q) => q.question);
  const contentMd = buildProbeContent({
    context: committed.session.context,
    goal: committed.session.goal,
    answers: committed.matched,
    evidencePaths: committed.session.evidencePaths,
    suggestedQuestions: unanswered,
  });

  const lint = lintMemoryEntry({
    title: entryTitle,
    category: "threads",
    content: contentMd,
    tags: normalizedTags,
  });
  if (!lint.ok) {
    return failResult(
      [
        {
          level: "error",
          code: "PROBE_LINT_BLOCKED",
          message: "Probe memory write blocked by lint rules.",
          suggestion: formatLintIssues(lint),
        },
      ],
      [`${params.loomRoot}/probes/${sessionId}.json`],
    );
  }

  const result = await weave(params.loomRoot, {
    category: "threads",
    title: entryTitle,
    content: contentMd,
    tags: normalizedTags,
    mode: "append",
  });
  await rebuildIndex(params.loomRoot);

  const artifacts = [
    result.filePath,
    `${params.loomRoot}/index.md`,
    `${params.loomRoot}/probes/${sessionId}.json`,
  ];
  let gitMsg: string | undefined;
  if (params.command.commit ?? true) {
    const commitResult = await params.git.commitChanges(
      artifacts,
      `capture inquiry ${entryTitle}`,
    );
    gitMsg = commitResult.message;
  }

  const eventFile = await appendEvent(params.loomRoot, {
    type: "probe.committed",
    ts: new Date().toISOString(),
    payload: {
      sessionId,
      matched: committed.matched.length,
      unmatched: committed.unmatched.length,
      filePath: result.filePath,
    },
  });

  return successResult(
    {
      sessionId,
      filePath: result.filePath,
      matchedAnswers: committed.matched.length,
      unmatchedAnswers: committed.unmatched.length,
      git: gitMsg,
    },
    [],
    [...artifacts, eventFile],
    { shouldFail: false },
  );
}
