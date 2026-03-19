import * as fs from "fs/promises";
import * as path from "path";

export type LoomEventType =
  | "knowledge.ingested"
  | "knowledge.traced"
  | "index.rebuilt"
  | "index.query.executed"
  | "probe.started"
  | "probe.committed"
  | "doctor.executed"
  | "changelog.updated"
  | "metrics.snapshot.generated";

export interface LoomEvent<T = Record<string, unknown>> {
  type: LoomEventType;
  ts: string;
  payload: T;
}

export async function appendEvent(
  loomRoot: string,
  event: LoomEvent,
): Promise<string> {
  const filePath = path.join(loomRoot, "events.jsonl");
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, `${JSON.stringify(event)}\n`, "utf-8");
  return filePath;
}

export async function readEvents(
  loomRoot: string,
): Promise<LoomEvent[]> {
  const filePath = path.join(loomRoot, "events.jsonl");
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as LoomEvent);
  } catch {
    return [];
  }
}

export interface QueryEventsInput {
  type?: LoomEventType;
  since?: string;
  limit?: number;
  order?: "asc" | "desc";
}

export function queryEvents(
  events: LoomEvent[],
  input: QueryEventsInput,
): LoomEvent[] {
  const sinceTs = input.since ? Date.parse(input.since) : undefined;
  let result = events.filter((event) => {
    if (input.type && event.type !== input.type) return false;
    if (sinceTs !== undefined) {
      const ts = Date.parse(event.ts);
      if (Number.isFinite(ts) && ts < sinceTs) return false;
    }
    return true;
  });
  if ((input.order ?? "desc") === "desc") {
    result = [...result].reverse();
  }
  if (input.limit && input.limit > 0) {
    result = result.slice(0, input.limit);
  }
  return result;
}

export function summarizeEventCounts(events: LoomEvent[]): Record<string, number> {
  return events.reduce<Record<string, number>>((acc, event) => {
    acc[event.type] = (acc[event.type] ?? 0) + 1;
    return acc;
  }, {});
}

export interface EventReplayState {
  ingestedCount: number;
  traceCount: number;
  traceHitCount: number;
  indexRebuiltCount: number;
  indexQueryCount: number;
  probeStartedCount: number;
  probeCommittedCount: number;
  doctorRunCount: number;
  doctorPassCount: number;
  changelogCount: number;
  snapshotCount: number;
}

export function replayEvents(events: LoomEvent[]): EventReplayState {
  const state: EventReplayState = {
    ingestedCount: 0,
    traceCount: 0,
    traceHitCount: 0,
    indexRebuiltCount: 0,
    indexQueryCount: 0,
    probeStartedCount: 0,
    probeCommittedCount: 0,
    doctorRunCount: 0,
    doctorPassCount: 0,
    changelogCount: 0,
    snapshotCount: 0,
  };
  for (const event of events) {
    switch (event.type) {
      case "knowledge.ingested":
        state.ingestedCount++;
        break;
      case "knowledge.traced":
        state.traceCount++;
        if (((event.payload as { count?: number }).count ?? 0) > 0) {
          state.traceHitCount++;
        }
        break;
      case "index.rebuilt":
        state.indexRebuiltCount++;
        break;
      case "index.query.executed":
        state.indexQueryCount++;
        break;
      case "probe.started":
        state.probeStartedCount++;
        break;
      case "probe.committed":
        state.probeCommittedCount++;
        break;
      case "doctor.executed":
        state.doctorRunCount++;
        if ((event.payload as { shouldFail?: boolean }).shouldFail === false) {
          state.doctorPassCount++;
        }
        break;
      case "changelog.updated":
        state.changelogCount++;
        break;
      case "metrics.snapshot.generated":
        state.snapshotCount++;
        break;
      default:
        break;
    }
  }
  return state;
}
