import * as fs from "fs/promises";
import * as path from "path";
import { randomUUID } from "crypto";
import type { LoomConfig } from "./config.js";

export type RawConversationSource =
  | "mcp"
  | "cli"
  | "cursor_hook"
  | "opencode_plugin"
  | "unknown";

export interface RawConversationRecord {
  ts: string;
  source: RawConversationSource;
  sessionId?: string;
  turnId?: string;
  channel: "tool_call" | "command";
  name: string;
  input?: unknown;
  output?: unknown;
  ok: boolean;
  error?: string;
  meta?: Record<string, unknown>;
}

const SENSITIVE_KEY_RE = /(secret|token|apikey|api_key|password|passwd|authorization|cookie)/i;
const SENSITIVE_VALUE_RE = /(sk-[a-z0-9]{10,}|api[_-]?key|bearer\s+[a-z0-9._-]+)/i;

function sanitizeValue(
  value: unknown,
  shouldRedact: boolean,
  maxPayloadChars: number,
): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    let out = value;
    if (shouldRedact && SENSITIVE_VALUE_RE.test(out)) {
      out = "[REDACTED]";
    }
    if (out.length > maxPayloadChars) {
      return `${out.slice(0, maxPayloadChars)}...[TRUNCATED]`;
    }
    return out;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, shouldRedact, maxPayloadChars));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (shouldRedact && SENSITIVE_KEY_RE.test(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = sanitizeValue(v, shouldRedact, maxPayloadChars);
      }
    }
    return out;
  }
  return String(value);
}

export function inferSessionIdFromUnknown(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return process.env.LOOM_SESSION_ID;
  const obj = input as Record<string, unknown>;
  const candidate =
    obj.sessionId ??
    obj.session_id ??
    obj.sessionID ??
    obj.conversation_id ??
    obj.conversationId ??
    process.env.LOOM_SESSION_ID;
  return typeof candidate === "string" && candidate.trim().length > 0
    ? candidate
    : undefined;
}

export async function appendRawConversationRecord(
  loomRoot: string,
  config: LoomConfig,
  record: RawConversationRecord,
): Promise<void> {
  const feature = config.fullConversationLogging;
  if (!feature.enabled) return;

  const storageRoot = path.join(loomRoot, feature.storageDir);
  await fs.mkdir(storageRoot, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const filePath = path.join(storageRoot, `events-${date}.jsonl`);

  const normalized = {
    ...record,
    sessionId: record.sessionId ?? randomUUID(),
    turnId: record.turnId ?? randomUUID(),
    input: sanitizeValue(record.input, feature.redact, feature.maxPayloadChars),
    output: sanitizeValue(record.output, feature.redact, feature.maxPayloadChars),
  };
  await fs.appendFile(filePath, `${JSON.stringify(normalized)}\n`, "utf-8");
}
