import * as fs from "fs/promises";
import * as path from "path";
import { describe, expect, it } from "vitest";
import { appendRawConversationRecord } from "../src/raw-conversation.js";
import { makeTempDir } from "./test-utils.js";

describe("raw conversation logging", () => {
  it("writes jsonl when feature is enabled", async () => {
    const workDir = await makeTempDir("loom-raw-");
    const loomRoot = path.join(workDir, ".loom");
    await fs.mkdir(loomRoot, { recursive: true });

    await appendRawConversationRecord(loomRoot, {
      loomDir: ".loom",
      autoCommit: true,
      autoPush: false,
      branch: "main",
      commitPrefix: "loom",
      fullConversationLogging: {
        enabled: true,
        storageDir: "raw_conversations",
        redact: true,
        maxPayloadChars: 200,
      },
    }, {
      ts: "2026-03-19T00:00:00.000Z",
      source: "cli",
      channel: "command",
      name: "trace",
      input: { token: "abc123", query: "auth" },
      output: { result: "ok" },
      ok: true,
    });

    const date = new Date().toISOString().slice(0, 10);
    const filePath = path.join(loomRoot, "raw_conversations", `events-${date}.jsonl`);
    const raw = await fs.readFile(filePath, "utf-8");
    expect(raw.length).toBeGreaterThan(0);
    expect(raw.includes("\"token\":\"[REDACTED]\"")).toBe(true);
  });
});
