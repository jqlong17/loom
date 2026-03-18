import * as fs from "fs/promises";
import * as path from "path";

export interface ProbeQuestion {
  id: string;
  question: string;
  reason: string;
}

export interface ProbeAnswerInput {
  question_id?: string;
  question?: string;
  answer: string;
}

export interface ProbeAnswerRecord {
  question_id: string;
  question: string;
  answer: string;
}

export interface ProbeSession {
  id: string;
  status: "open" | "committed";
  context: string;
  goal?: string;
  questions: ProbeQuestion[];
  evidencePaths: string[];
  createdAt: string;
  updatedAt: string;
  committedAt?: string;
  answers?: ProbeAnswerRecord[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function newSessionId(): string {
  const left = Date.now().toString(36);
  const right = Math.random().toString(36).slice(2, 8);
  return `probe-${left}-${right}`;
}

function sessionDir(loomRoot: string): string {
  return path.join(loomRoot, "probes");
}

function sessionPath(loomRoot: string, id: string): string {
  return path.join(sessionDir(loomRoot), `${id}.json`);
}

export async function createProbeSession(
  loomRoot: string,
  payload: {
    context: string;
    goal?: string;
    questions: ProbeQuestion[];
    evidencePaths: string[];
  },
): Promise<ProbeSession> {
  await fs.mkdir(sessionDir(loomRoot), { recursive: true });
  const ts = nowIso();
  const session: ProbeSession = {
    id: newSessionId(),
    status: "open",
    context: payload.context,
    goal: payload.goal,
    questions: payload.questions,
    evidencePaths: payload.evidencePaths,
    createdAt: ts,
    updatedAt: ts,
  };
  await fs.writeFile(
    sessionPath(loomRoot, session.id),
    JSON.stringify(session, null, 2),
    "utf-8",
  );
  return session;
}

export async function loadProbeSession(
  loomRoot: string,
  sessionId: string,
): Promise<ProbeSession | null> {
  try {
    const raw = await fs.readFile(sessionPath(loomRoot, sessionId), "utf-8");
    return JSON.parse(raw) as ProbeSession;
  } catch {
    return null;
  }
}

export async function commitProbeSession(
  loomRoot: string,
  sessionId: string,
  answers: ProbeAnswerInput[],
): Promise<{
  session: ProbeSession;
  matched: ProbeAnswerRecord[];
  unmatched: ProbeAnswerInput[];
}> {
  const session = await loadProbeSession(loomRoot, sessionId);
  if (!session) {
    throw new Error(`Probe session not found: ${sessionId}`);
  }
  if (session.status !== "open") {
    throw new Error(`Probe session already committed: ${sessionId}`);
  }

  const byId = new Map(session.questions.map((q) => [q.id, q]));
  const byQuestion = new Map(
    session.questions.map((q) => [q.question.trim().toLowerCase(), q]),
  );
  const matched: ProbeAnswerRecord[] = [];
  const unmatched: ProbeAnswerInput[] = [];

  for (const item of answers) {
    const answer = item.answer?.trim();
    if (!answer) continue;

    let q = item.question_id ? byId.get(item.question_id) : undefined;
    if (!q && item.question) {
      q = byQuestion.get(item.question.trim().toLowerCase());
    }
    if (!q) {
      unmatched.push(item);
      continue;
    }
    matched.push({
      question_id: q.id,
      question: q.question,
      answer,
    });
  }

  if (matched.length === 0) {
    throw new Error(
      "No valid answers matched this probe session. Provide question_id or exact question text.",
    );
  }

  const next: ProbeSession = {
    ...session,
    status: "committed",
    committedAt: nowIso(),
    updatedAt: nowIso(),
    answers: matched,
  };

  await fs.writeFile(
    sessionPath(loomRoot, sessionId),
    JSON.stringify(next, null, 2),
    "utf-8",
  );

  return { session: next, matched, unmatched };
}
