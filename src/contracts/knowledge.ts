import type { LoomCategory } from "../config.js";
import type { ReflectIssue } from "../weaver.js";
import type { ProbeAnswerInput, ProbeQuestion } from "../probe.js";
import type { LoomEvent, LoomEventType } from "../events.js";

export interface IngestCommand {
  category: LoomCategory;
  title: string;
  content: string;
  tags?: string[];
  links?: string[];
  domain?: string;
  mode?: "replace" | "append" | "section";
  commit?: boolean;
  changelog?: boolean;
  changelogDate?: string;
}

export interface IngestOutcome {
  ingest: {
    filePath: string;
    isUpdate: boolean;
    mode: "replace" | "append" | "section";
  };
  lintReport: string;
  lintIssues: Array<{
    level: "error" | "warn";
    code: string;
    message: string;
    suggestion: string;
  }>;
  changelog?:
    | {
        file: string;
        date: string;
        added: number;
        total: number;
      }
    | { skipped: true; reason?: string };
  git?: string;
}

export type DoctorFailOn = "none" | "error" | "warn";

export interface DoctorCommand {
  staleDays: number;
  includeThreads: boolean;
  maxFindings: number;
  failOn: DoctorFailOn;
}

export interface DoctorIssue extends ReflectIssue {
  level: "error" | "warn";
}

export interface DoctorOutcome {
  failOn: DoctorFailOn;
  shouldFail: boolean;
  scannedEntries: number;
  generatedAt: string;
  summary: {
    total: number;
    errorCount: number;
    warnCount: number;
  };
  issues: DoctorIssue[];
}

export interface ProbeStartCommand {
  context: string;
  goal?: string;
  maxQuestions: number;
}

export interface ProbeStartOutcome {
  sessionId: string;
  questions: ProbeQuestion[];
  evidence: {
    coreConceptCount: number;
    recentCount: number;
    entries: Array<{ filePath: string; summary: string }>;
  };
}

export interface ProbeCommitCommand {
  sessionId?: string;
  context?: string;
  goal?: string;
  maxQuestions?: number;
  answers: ProbeAnswerInput[];
  title?: string;
  tags?: string[];
  commit?: boolean;
}

export interface ProbeCommitOutcome {
  sessionId: string;
  filePath: string;
  matchedAnswers: number;
  unmatchedAnswers: number;
  git?: string;
}

export interface ChangelogCommand {
  mode: "auto" | "manual";
  date?: string;
  highlights?: string[];
  commit?: boolean;
}

export interface ChangelogOutcome {
  filePath: string;
  date: string;
  added: number;
  totalForDate: number;
  git?: string;
}

export interface MetricsSnapshotCommand {
  failOn: DoctorFailOn;
  staleDays: number;
  includeThreads: boolean;
  maxFindings: number;
  snapshotDate?: string;
}

export interface MetricsSnapshotOutcome {
  filePath: string;
  snapshot: {
    schema: "metrics.snapshot.v1";
    generatedAt: string;
    metrics: {
      captureRate: number;
      retrievalHitRate: number;
      governancePassRate: number;
      danglingLinkCount: number;
      isolatedNodeCount: number;
      probeCompletionRate: number;
    };
    counts: {
      totalEntries: number;
      byCategory: Record<string, number>;
      probeSessions: {
        total: number;
        committed: number;
      };
      events: Record<string, number>;
    };
  };
}

export interface EventsQueryCommand {
  type?: LoomEventType;
  since?: string;
  limit?: number;
  order?: "asc" | "desc";
}

export interface EventsQueryOutcome {
  total: number;
  counts: Record<string, number>;
  events: LoomEvent[];
}

export interface MetricsReportCommand {
  since?: string;
  limit?: number;
  reportDate?: string;
}

export interface MetricsReportOutcome {
  reportMarkdown: string;
  summary: {
    m1CaptureRate: number;
    m2RetrievalHitRate: number;
    m3GovernancePassRate: number;
  };
  basedOn: {
    events: number;
    since?: string;
    latestSnapshot?: string;
  };
}
