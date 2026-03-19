import type { ApplicationResult } from "../contracts/application-result.js";
import type { DoctorOutcome } from "../contracts/knowledge.js";

export interface DoctorAdapterPayload extends DoctorOutcome {
  ok: boolean;
  gate?: ApplicationResult<DoctorOutcome>["gate"];
}

export function formatDoctorPayload(
  report: ApplicationResult<DoctorOutcome>,
): DoctorAdapterPayload {
  if (!report.ok || !report.data) {
    throw new Error("doctor execution failed");
  }
  return {
    ok: !report.data.shouldFail,
    ...report.data,
    gate: report.gate,
  };
}

export function formatDoctorForMcp(
  report: ApplicationResult<DoctorOutcome>,
): string {
  return JSON.stringify(formatDoctorPayload(report), null, 2);
}
