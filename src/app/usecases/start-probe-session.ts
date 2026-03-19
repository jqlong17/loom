import { appendEvent } from "../../events.js";
import { successResult, type ApplicationResult } from "../../contracts/application-result.js";
import type {
  ProbeStartCommand,
  ProbeStartOutcome,
} from "../../contracts/knowledge.js";
import { startProbeSessionCore } from "../../core/probe-core.js";

export async function executeStartProbeSession(params: {
  loomRoot: string;
  command: ProbeStartCommand;
}): Promise<ApplicationResult<ProbeStartOutcome>> {
  const result = await startProbeSessionCore({
    loomRoot: params.loomRoot,
    context: params.command.context,
    goal: params.command.goal,
    maxQuestions: params.command.maxQuestions,
  });

  const eventFile = await appendEvent(params.loomRoot, {
    type: "probe.started",
    ts: new Date().toISOString(),
    payload: {
      sessionId: result.sessionId,
      questionCount: result.questions.length,
    },
  });

  return successResult(
    {
      sessionId: result.sessionId,
      questions: result.questions,
      evidence: result.evidence,
    },
    [],
    [eventFile],
    { shouldFail: false },
  );
}
