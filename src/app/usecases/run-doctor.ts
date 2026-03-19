import { runDoctor } from "../../core/loom-core.js";
import { appendEvent } from "../../events.js";
import { successResult, type ApplicationResult } from "../../contracts/application-result.js";
import type { DoctorCommand, DoctorOutcome } from "../../contracts/knowledge.js";

export async function executeRunDoctor(params: {
  loomRoot: string;
  command: DoctorCommand;
}): Promise<ApplicationResult<DoctorOutcome>> {
  const report = await runDoctor({
    loomRoot: params.loomRoot,
    staleDays: params.command.staleDays,
    includeThreads: params.command.includeThreads,
    maxFindings: params.command.maxFindings,
    failOn: params.command.failOn,
  });

  const eventFile = await appendEvent(params.loomRoot, {
    type: "doctor.executed",
    ts: new Date().toISOString(),
    payload: {
      failOn: report.failOn,
      shouldFail: report.shouldFail,
      summary: report.summary,
    },
  });

  return successResult(
    {
      failOn: report.failOn,
      shouldFail: report.shouldFail,
      scannedEntries: report.scannedEntries,
      generatedAt: report.generatedAt,
      summary: report.summary,
      issues: report.issues,
    },
    [],
    [eventFile],
    {
      shouldFail: report.shouldFail,
      level: report.shouldFail ? "error" : "info",
      reason: report.shouldFail
        ? `doctor_fail_on_${report.failOn}`
        : "doctor_passed",
    },
  );
}
