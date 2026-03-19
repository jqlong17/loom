export type ProbeSessionStatus = "open" | "committed";

export interface ProbeSessionState {
  status: ProbeSessionStatus;
  updatedAt: string;
  committedAt?: string;
}

export function commitSessionState(base: ProbeSessionState, atIso: string): ProbeSessionState {
  if (base.status !== "open") {
    throw new Error("Probe session transition invalid: only open session can be committed.");
  }
  return {
    status: "committed",
    updatedAt: atIso,
    committedAt: atIso,
  };
}
