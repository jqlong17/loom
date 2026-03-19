import { listCoreConcepts, listRecentEntries, trace } from "../weaver.js";
import { createProbeSession, type ProbeQuestion } from "../probe.js";

function deriveContextTerms(input: string, maxTerms = 5): string[] {
  const lowered = input.toLowerCase();
  const asciiTerms = lowered.match(/[a-z][a-z0-9_-]{2,}/g) ?? [];
  const cjkTerms = input.match(/[\u4e00-\u9fff]{2,}/g) ?? [];
  const stop = new Set([
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from",
    "into",
    "about",
    "have",
    "will",
    "should",
    "can",
    "could",
    "我们",
    "需要",
    "一个",
    "可以",
    "进行",
    "这个",
    "怎么",
    "什么",
  ]);
  const all = [...asciiTerms, ...cjkTerms].filter((t) => !stop.has(t));
  const score = new Map<string, number>();
  for (const term of all) {
    score.set(term, (score.get(term) ?? 0) + 1);
  }
  return Array.from(score.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([term]) => term)
    .slice(0, maxTerms);
}

function buildProbeQuestions(
  context: string,
  goal: string | undefined,
  hasEvidence: boolean,
): Array<{ question: string; reason: string }> {
  const questions: Array<{ question: string; reason: string }> = [];
  if (!goal || goal.trim().length < 6) {
    questions.push({
      question: "这轮对话的最终目标是什么？希望产出的结果形式是文档、代码还是决策结论？",
      reason: "目标未充分显式化，后续记忆沉淀容易偏离重点。",
    });
  }
  questions.push({
    question: "本次范围的边界是什么？哪些内容明确不做，以避免扩散？",
    reason: "范围边界决定后续知识分类与行动优先级。",
  });
  questions.push({
    question: "成功验收标准是什么？请给出 2-3 条可验证条件。",
    reason: "缺少验收标准会导致记忆记录无法支持后续复盘。",
  });
  if (hasEvidence) {
    questions.push({
      question: "与现有记忆相比，这次需求的增量变化是什么？请明确“沿用”与“变更”的部分。",
      reason: "已有相关历史，需避免与既有概念/决策冲突。",
    });
  } else {
    questions.push({
      question: "当前需求涉及哪些核心模块或关键词？请给 3-5 个检索词。",
      reason: "尚未检索到高相关记忆，先补检索锚点可提升沉淀质量。",
    });
  }
  const hasRiskHint = /风险|risk|限制|constraint|兼容|兼容性|迁移|migration/i.test(
    `${context} ${goal ?? ""}`,
  );
  if (!hasRiskHint) {
    questions.push({
      question: "这次方案有哪些风险、约束或兼容性要求需要提前记录？",
      reason: "风险与约束缺失会影响后续决策质量。",
    });
  }
  return questions;
}

export interface ProbeStartCoreResult {
  sessionId: string;
  questions: ProbeQuestion[];
  evidence: {
    coreConceptCount: number;
    recentCount: number;
    entries: Array<{ filePath: string; summary: string }>;
  };
}

export async function startProbeSessionCore(params: {
  loomRoot: string;
  context: string;
  goal?: string;
  maxQuestions: number;
}): Promise<ProbeStartCoreResult> {
  const terms = deriveContextTerms(`${params.goal ?? ""} ${params.context}`);
  const coreConcepts = await listCoreConcepts(params.loomRoot);
  const recent = await listRecentEntries(params.loomRoot, 5);
  const evidenceMap = new Map<string, string>();

  for (const term of terms.slice(0, 4)) {
    const hits = await trace(params.loomRoot, term, { limit: 2 });
    for (const hit of hits) {
      if (!evidenceMap.has(hit.filePath)) {
        evidenceMap.set(
          hit.filePath,
          `${hit.title} [${hit.category}] — ${hit.snippet.slice(0, 120).replace(/\s+/g, " ").trim()}`,
        );
      }
    }
  }

  const candidates = buildProbeQuestions(
    params.context,
    params.goal,
    evidenceMap.size > 0,
  ).slice(0, Math.max(1, Math.min(5, params.maxQuestions)));

  const questions: ProbeQuestion[] = candidates.map((item, idx) => ({
    id: `q${idx + 1}`,
    question: item.question,
    reason: item.reason,
  }));

  const session = await createProbeSession(params.loomRoot, {
    context: params.context,
    goal: params.goal,
    questions,
    evidencePaths: Array.from(evidenceMap.keys()),
  });

  return {
    sessionId: session.id,
    questions,
    evidence: {
      coreConceptCount: coreConcepts.length,
      recentCount: recent.length,
      entries: Array.from(evidenceMap.entries()).map(([filePath, summary]) => ({
        filePath,
        summary,
      })),
    },
  };
}
