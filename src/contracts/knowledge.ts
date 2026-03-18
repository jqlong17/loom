import type { LoomCategory } from "../config.js";
import type { ReflectIssue } from "../weaver.js";

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
