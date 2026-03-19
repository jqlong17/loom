import * as fs from "fs/promises";
import * as path from "path";

export type LoomEventType =
  | "knowledge.ingested"
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
