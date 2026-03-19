import type { ReflectIssue } from "../weaver.js";

export type QualityIssueLevel = "error" | "warn";

export interface QualityIssue {
  level: QualityIssueLevel;
  type: ReflectIssue["type"];
  reason: string;
  files: string[];
}

export function mapReflectIssueToQualityIssue(issue: ReflectIssue): QualityIssue {
  const level: QualityIssueLevel =
    issue.type === "conflict" || issue.type === "dangling_link" ? "error" : "warn";
  return {
    level,
    type: issue.type,
    reason: issue.reason,
    files: issue.files,
  };
}
