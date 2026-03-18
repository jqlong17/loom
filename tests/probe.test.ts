import * as fs from "fs/promises";
import * as path from "path";
import { describe, expect, it } from "vitest";
import {
  createProbeSession,
  commitProbeSession,
  loadProbeSession,
} from "../src/probe.js";
import { makeTempDir, pathExists } from "./test-utils.js";

describe("probe sessions", () => {
  it("creates and commits a probe session", async () => {
    const root = await makeTempDir("loom-probe-");
    const session = await createProbeSession(root, {
      context: "Need clarified scope",
      goal: "reduce ambiguity",
      questions: [
        { id: "q1", question: "What is scope?", reason: "boundary" },
        { id: "q2", question: "What is done?", reason: "acceptance" },
      ],
      evidencePaths: ["concepts/a.md"],
    });

    const sessionFile = path.join(root, "probes", `${session.id}.json`);
    expect(await pathExists(sessionFile)).toBe(true);

    const committed = await commitProbeSession(root, session.id, [
      { question_id: "q1", answer: "Only CLI path now." },
      { question: "What is done?", answer: "Build and tests pass." },
      { question_id: "q404", answer: "unknown" },
    ]);
    expect(committed.matched.length).toBe(2);
    expect(committed.unmatched.length).toBe(1);

    const loaded = await loadProbeSession(root, session.id);
    expect(loaded?.status).toBe("committed");
    expect(loaded?.answers?.length).toBe(2);
  });

  it("rejects second commit on same session", async () => {
    const root = await makeTempDir("loom-probe-");
    const session = await createProbeSession(root, {
      context: "x",
      questions: [{ id: "q1", question: "A?", reason: "r" }],
      evidencePaths: [],
    });
    await commitProbeSession(root, session.id, [
      { question_id: "q1", answer: "yes" },
    ]);

    await expect(
      commitProbeSession(root, session.id, [{ question_id: "q1", answer: "again" }]),
    ).rejects.toThrow(/already committed/);
  });

  it("persists JSON with stable structure", async () => {
    const root = await makeTempDir("loom-probe-");
    const session = await createProbeSession(root, {
      context: "graph onboarding",
      questions: [{ id: "q1", question: "Need links?", reason: "graph" }],
      evidencePaths: [],
    });
    const raw = await fs.readFile(path.join(root, "probes", `${session.id}.json`), "utf-8");
    const parsed = JSON.parse(raw) as { id: string; status: string };
    expect(parsed.id).toBe(session.id);
    expect(parsed.status).toBe("open");
  });
});
