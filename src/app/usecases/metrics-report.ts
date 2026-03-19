import * as fs from "fs/promises";
import * as path from "path";
import { queryEvents, readEvents } from "../../events.js";
import { successResult, type ApplicationResult } from "../../contracts/application-result.js";
import type {
  MetricsReportCommand,
  MetricsReportOutcome,
} from "../../contracts/knowledge.js";

function clampRate(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, Number(n.toFixed(4))));
}

async function findLatestSnapshot(loomRoot: string): Promise<string | undefined> {
  const metricsDir = path.join(loomRoot, "metrics");
  try {
    const files = (await fs.readdir(metricsDir))
      .filter((x) => /^snapshot-\d{4}-\d{2}-\d{2}\.json$/.test(x))
      .sort();
    if (files.length === 0) return undefined;
    return path.join(metricsDir, files[files.length - 1]);
  } catch {
    return undefined;
  }
}

export async function executeMetricsReport(params: {
  loomRoot: string;
  command: MetricsReportCommand;
}): Promise<ApplicationResult<MetricsReportOutcome>> {
  const since = params.command.since;
  const limit = params.command.limit ?? 500;
  const allEvents = await readEvents(params.loomRoot);
  const events = queryEvents(allEvents, { since, limit, order: "desc" });

  const ingested = events.filter((e) => e.type === "knowledge.ingested").length;
  const traces = events.filter((e) => e.type === "knowledge.traced");
  const traceHits = traces.filter(
    (e) => ((e.payload as { count?: number }).count ?? 0) > 0,
  ).length;
  const doctor = events.filter((e) => e.type === "doctor.executed");
  const doctorPass = doctor.filter(
    (e) => (e.payload as { shouldFail?: boolean }).shouldFail === false,
  ).length;
  const probeStarted = events.filter((e) => e.type === "probe.started").length;

  const m1CaptureRate = clampRate(
    ingested / Math.max(ingested + probeStarted, 1),
  );
  const m2RetrievalHitRate = clampRate(
    traceHits / Math.max(traces.length, 1),
  );
  const m3GovernancePassRate = clampRate(
    doctorPass / Math.max(doctor.length, 1),
  );

  const latestSnapshot = await findLatestSnapshot(params.loomRoot);
  const reportDate = params.command.reportDate ?? new Date().toISOString().slice(0, 10);
  const reportMarkdown = [
    `Week: ${reportDate}`,
    "",
    "M1 Capture Rate:",
    `- value: ${(m1CaptureRate * 100).toFixed(2)}%`,
    `- evidence: knowledge.ingested=${ingested}, probe.started=${probeStarted}`,
    "",
    "M2 Retrieval Hit Rate:",
    `- value: ${(m2RetrievalHitRate * 100).toFixed(2)}%`,
    `- evidence: knowledge.traced hit=${traceHits}/${traces.length}`,
    "",
    "M3 Governance Pass Rate:",
    `- value: ${(m3GovernancePassRate * 100).toFixed(2)}%`,
    `- evidence: doctor pass=${doctorPass}/${doctor.length}`,
    "",
    "Top Risks:",
    `1) ${traces.length === 0 ? "检索事件样本不足，M2 代表性有限。" : "持续追踪低命中检索并回写核心记忆。"}`,
    `2) ${doctor.length === 0 ? "doctor 执行频率不足，M3 稳定性待观察。" : "保持 doctor 执行节奏，避免治理盲区。"}`,
    "",
    "Next Week Focus:",
    "1) 提升 retrieval 命中并完善 trace 语义标签。",
    "2) 把指标解读写入 PR，形成决策闭环。",
    "",
    `Latest Snapshot: ${latestSnapshot ?? "none"}`,
    `Events Analyzed: ${events.length}`,
  ].join("\n");

  return successResult(
    {
      reportMarkdown,
      summary: {
        m1CaptureRate,
        m2RetrievalHitRate,
        m3GovernancePassRate,
      },
      basedOn: {
        events: events.length,
        since,
        latestSnapshot,
      },
    },
    [],
    latestSnapshot ? [latestSnapshot] : [],
    { shouldFail: false },
  );
}
