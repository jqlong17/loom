import * as fs from "fs/promises";
import * as path from "path";
import { runDoctor } from "../../core/loom-core.js";
import { listAll } from "../../weaver.js";
import { appendEvent, readEvents } from "../../events.js";
import { successResult, type ApplicationResult } from "../../contracts/application-result.js";
import type {
  MetricsSnapshotCommand,
  MetricsSnapshotOutcome,
} from "../../contracts/knowledge.js";

function toDateOnly(input?: string): string {
  if (input && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return input;
  }
  return new Date().toISOString().slice(0, 10);
}

async function countProbeSessions(loomRoot: string): Promise<{
  total: number;
  committed: number;
}> {
  const dir = path.join(loomRoot, "probes");
  try {
    const names = await fs.readdir(dir);
    const files = names.filter((x) => x.endsWith(".json"));
    let committed = 0;
    for (const file of files) {
      try {
        const raw = await fs.readFile(path.join(dir, file), "utf-8");
        const parsed = JSON.parse(raw) as { status?: string };
        if (parsed.status === "committed") committed++;
      } catch {
        // ignore malformed files
      }
    }
    return { total: files.length, committed };
  } catch {
    return { total: 0, committed: 0 };
  }
}

export async function executeMetricsSnapshot(params: {
  loomRoot: string;
  command: MetricsSnapshotCommand;
}): Promise<ApplicationResult<MetricsSnapshotOutcome>> {
  const date = toDateOnly(params.command.snapshotDate);
  const doctor = await runDoctor({
    loomRoot: params.loomRoot,
    staleDays: params.command.staleDays,
    includeThreads: params.command.includeThreads,
    maxFindings: params.command.maxFindings,
    failOn: params.command.failOn,
  });
  const entries = await listAll(params.loomRoot);
  const probes = await countProbeSessions(params.loomRoot);
  const events = await readEvents(params.loomRoot);
  const ingestedEvents = events.filter((e) => e.type === "knowledge.ingested");
  const tracedEvents = events.filter((e) => e.type === "knowledge.traced");
  const tracedHits = tracedEvents.filter(
    (e) => ((e.payload as { count?: number }).count ?? 0) > 0,
  );
  const probeStartedEvents = events.filter((e) => e.type === "probe.started");

  const doctorEvents = events.filter((e) => e.type === "doctor.executed");
  const doctorPassed = doctorEvents.filter((e) => {
    const payload = e.payload as { shouldFail?: boolean };
    return payload.shouldFail === false;
  }).length;
  const governancePassRate =
    doctorEvents.length > 0
      ? Number((doctorPassed / doctorEvents.length).toFixed(4))
      : doctor.shouldFail
        ? 0
        : 1;
  const captureRate = Number(
    (
      ingestedEvents.length /
      Math.max(ingestedEvents.length + probeStartedEvents.length, 1)
    ).toFixed(4),
  );
  const retrievalHitRate = Number(
    (tracedHits.length / Math.max(tracedEvents.length, 1)).toFixed(4),
  );

  const byCategory = entries.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + 1;
    return acc;
  }, {});
  const eventCounts = events.reduce<Record<string, number>>((acc, event) => {
    acc[event.type] = (acc[event.type] ?? 0) + 1;
    return acc;
  }, {});
  const danglingLinkCount = doctor.issues.filter(
    (i) => i.type === "dangling_link",
  ).length;
  const isolatedNodeCount = doctor.issues.filter(
    (i) => i.type === "isolated_node",
  ).length;
  const probeCompletionRate =
    probes.total === 0
      ? 1
      : Number((probes.committed / probes.total).toFixed(4));

  const snapshot = {
    schema: "metrics.snapshot.v1" as const,
    generatedAt: new Date().toISOString(),
    metrics: {
      captureRate,
      retrievalHitRate,
      governancePassRate,
      danglingLinkCount,
      isolatedNodeCount,
      probeCompletionRate,
    },
    counts: {
      totalEntries: entries.length,
      byCategory,
      probeSessions: probes,
      events: eventCounts,
    },
  };

  const metricsDir = path.join(params.loomRoot, "metrics");
  await fs.mkdir(metricsDir, { recursive: true });
  const filePath = path.join(metricsDir, `snapshot-${date}.json`);
  await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2), "utf-8");
  const eventFile = await appendEvent(params.loomRoot, {
    type: "metrics.snapshot.generated",
    ts: new Date().toISOString(),
    payload: {
      filePath,
      date,
      governancePassRate,
    },
  });

  return successResult(
    {
      filePath,
      snapshot,
    },
    [],
    [filePath, eventFile],
    { shouldFail: false },
  );
}
