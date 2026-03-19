import * as path from "path";
import type { LoomConfig, LoomCategory } from "../config.js";
import { weave, rebuildIndex, reflect, type ReflectIssue } from "../weaver.js";
import { type GitManager } from "../git-manager.js";
import { lintMemoryEntry, formatLintIssues } from "../memory-lint.js";
import {
  collectDailyHighlightsFromGit,
  updateChangelog,
} from "../changelog.js";
import { mapReflectIssueToQualityIssue } from "../domain/quality-issue.js";

export interface IngestInput {
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

export interface IngestResult {
  ok: boolean;
  ingest?: {
    filePath: string;
    isUpdate: boolean;
    mode: "replace" | "append" | "section";
  };
  lintReport: string;
  lintIssues: ReturnType<typeof lintMemoryEntry>["issues"];
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

export interface DoctorResult {
  ok: boolean;
  failOn: "none" | "error" | "warn";
  shouldFail: boolean;
  scannedEntries: number;
  generatedAt: string;
  summary: {
    total: number;
    errorCount: number;
    warnCount: number;
  };
  issues: Array<ReflectIssue & { level: "error" | "warn" }>;
}

export async function ingestKnowledge(params: {
  workDir: string;
  loomRoot: string;
  config: LoomConfig;
  git: GitManager;
  input: IngestInput;
}): Promise<IngestResult> {
  const { workDir, loomRoot, git, input } = params;
  const lint = lintMemoryEntry({
    title: input.title,
    category: input.category,
    content: input.content,
    tags: input.tags,
    links: input.links,
    domain: input.domain,
  });
  const lintReport = formatLintIssues(lint);
  if (!lint.ok) {
    return {
      ok: false,
      lintReport,
      lintIssues: lint.issues,
    };
  }

  const result = await weave(loomRoot, {
    category: input.category,
    title: input.title,
    content: input.content,
    tags: input.tags,
    links: input.links,
    domain: input.domain,
    mode: input.mode,
  });
  await rebuildIndex(loomRoot);

  const fileList = [result.filePath, path.join(loomRoot, "index.md")];
  let changelog:
    | {
        file: string;
        date: string;
        added: number;
        total: number;
      }
    | { skipped: true; reason?: string }
    | undefined;

  if (input.changelog) {
    const highlights = await collectDailyHighlightsFromGit(workDir, input.changelogDate);
    if (highlights.length > 0) {
      const c = await updateChangelog(workDir, highlights, input.changelogDate);
      changelog = {
        file: c.filePath,
        date: c.date,
        added: c.added,
        total: c.totalForDate,
      };
      fileList.push(c.filePath);
    } else {
      changelog = { skipped: true, reason: "no highlights" };
    }
  }

  let gitMsg: string | undefined;
  if (input.commit ?? true) {
    const commitResult = await git.commitChanges(
      fileList,
      `${result.isUpdate ? "update" : "add"} ${input.category}/${input.title} via ingest`,
    );
    gitMsg = commitResult.message;
  }

  return {
    ok: true,
    ingest: result,
    lintReport,
    lintIssues: lint.issues,
    changelog,
    git: gitMsg,
  };
}

export async function runDoctor(params: {
  loomRoot: string;
  staleDays: number;
  includeThreads: boolean;
  maxFindings: number;
  failOn: "none" | "error" | "warn";
}): Promise<DoctorResult> {
  const report = await reflect(params.loomRoot, {
    staleDays: params.staleDays,
    includeThreads: params.includeThreads,
    maxFindings: params.maxFindings,
  });

  const issues = report.issues.map((i) => ({
    ...i,
    level: mapReflectIssueToQualityIssue(i).level,
  }));
  const errorCount = issues.filter((i) => i.level === "error").length;
  const warnCount = issues.filter((i) => i.level === "warn").length;
  const shouldFail =
    params.failOn === "warn"
      ? issues.length > 0
      : params.failOn === "error"
        ? errorCount > 0
        : false;

  return {
    ok: !shouldFail,
    failOn: params.failOn,
    shouldFail,
    scannedEntries: report.scannedEntries,
    generatedAt: report.generatedAt,
    summary: {
      total: issues.length,
      errorCount,
      warnCount,
    },
    issues,
  };
}
