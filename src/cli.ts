#!/usr/bin/env node

import * as path from "path";
import { fileURLToPath } from "url";
import { loadConfig, resolveLoomPath, ensureLoomStructure } from "./config.js";
import {
  weave,
  trace,
  listAll,
  readKnowledge,
  reflect,
  deprecateEntry,
  rebuildIndex,
} from "./weaver.js";
import { GitManager } from "./git-manager.js";
import { updateChangelog, collectDailyHighlightsFromGit } from "./changelog.js";
import { upgradeFromGit } from "./updater.js";
import { executeIngestKnowledge } from "./app/usecases/ingest-knowledge.js";
import { executeRunDoctor } from "./app/usecases/run-doctor.js";

type ArgMap = Record<string, string | boolean>;

interface ParsedArgs {
  command?: string;
  args: ArgMap;
}

const WORK_DIR = process.env.LOOM_WORK_DIR ?? process.cwd();
const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv: string[]): ParsedArgs {
  const [, , command, ...rest] = argv;
  const args: ArgMap = {};
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = rest[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i++;
  }
  return { command, args };
}

function asString(args: ArgMap, key: string): string | undefined {
  const v = args[key];
  return typeof v === "string" ? v : undefined;
}

function asNumber(args: ArgMap, key: string): number | undefined {
  const v = asString(args, key);
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function asBool(args: ArgMap, key: string, fallback?: boolean): boolean | undefined {
  const v = args[key];
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    if (v === "true") return true;
    if (v === "false") return false;
  }
  return fallback;
}

function asList(args: ArgMap, key: string): string[] | undefined {
  const v = asString(args, key);
  if (!v) return undefined;
  return v
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function fail(message: string): never {
  throw new Error(message);
}

function print(data: unknown, jsonMode: boolean): void {
  if (jsonMode) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  if (typeof data === "string") {
    console.log(data);
    return;
  }
  console.log(JSON.stringify(data, null, 2));
}

function helpText(): string {
  return `Loom CLI Wrapper

Usage:
  loom-cli <command> [options]

Commands:
  init
  weave --category <concepts|decisions|threads> --title <t> --content <text> [--tags a,b] [--links a,b] [--domain d] [--mode replace|append|section]
  ingest --category <concepts|decisions|threads> --title <t> --content <text> [--tags a,b] [--links a,b] [--domain d] [--mode replace|append|section] [--commit true|false] [--changelog true|false]
  doctor [--staleDays 30] [--includeThreads true|false] [--maxFindings 20] [--failOn none|error|warn]
  closeout --title <t> --content <text> [--category threads|concepts] [--tags a,b] [--mode append|replace|section]
  trace --query <text> [--category <c>] [--tags a,b] [--limit n]
  read --category <c> --slug <filename-without-md>
  list
  deprecate --category <c> --slug <s> --reason <text> [--superseded_by <path>]
  reflect [--staleDays 30] [--includeThreads true|false] [--maxFindings 20]
  sync
  log [--limit 10]
  changelog [--mode auto|manual] [--date YYYY-MM-DD] [--highlights a|b|c] [--commit true|false]
  upgrade [--dryRun true|false]

Global:
  --json    Print JSON output for agent consumption
`;
}

async function main(): Promise<void> {
  const { command, args } = parseArgs(process.argv);
  const jsonMode = asBool(args, "json", false) ?? false;

  if (!command || command === "help" || command === "--help") {
    print(helpText(), false);
    return;
  }

  const config = await loadConfig(WORK_DIR);
  const loomRoot = resolveLoomPath(WORK_DIR, config);

  if (command !== "upgrade") {
    await ensureLoomStructure(loomRoot);
  }

  const git = new GitManager(WORK_DIR, config);

  switch (command) {
    case "init": {
      await ensureLoomStructure(loomRoot);
      const commitResult = await git.commitChanges([loomRoot], "initialize knowledge base");
      print(
        {
          ok: true,
          loomRoot,
          git: commitResult.message,
        },
        jsonMode,
      );
      return;
    }

    case "weave": {
      const category = asString(args, "category");
      const title = asString(args, "title");
      const content = asString(args, "content");
      if (!category || !title || !content) {
        fail("weave requires --category --title --content");
      }
      if (!["concepts", "decisions", "threads"].includes(category)) {
        fail("invalid --category");
      }
      const output = await executeIngestKnowledge({
        workDir: WORK_DIR,
        loomRoot,
        config,
        git,
        command: {
          category: category as "concepts" | "decisions" | "threads",
          title,
          content,
          tags: asList(args, "tags"),
          links: asList(args, "links"),
          domain: asString(args, "domain"),
          mode: asString(args, "mode") as "replace" | "append" | "section" | undefined,
          commit: true,
          changelog: false,
        },
      });
      if (!output.ok || !output.data) {
        fail(output.issues.map((i) => i.suggestion ?? i.message).join("\n"));
      }

      print(
        {
          ok: true,
          ...output.data.ingest,
          lint: output.data.lintIssues,
          git: output.data.git,
        },
        jsonMode,
      );
      return;
    }

    case "ingest": {
      const category = asString(args, "category");
      const title = asString(args, "title");
      const content = asString(args, "content");
      if (!category || !title || !content) {
        fail("ingest requires --category --title --content");
      }
      if (!["concepts", "decisions", "threads"].includes(category)) {
        fail("invalid --category");
      }

      const output = await executeIngestKnowledge({
        workDir: WORK_DIR,
        loomRoot,
        config,
        git,
        command: {
        category: category as "concepts" | "decisions" | "threads",
        title,
        content,
          tags: asList(args, "tags"),
          links: asList(args, "links"),
          domain: asString(args, "domain"),
          mode: asString(args, "mode") as "replace" | "append" | "section" | undefined,
          commit: asBool(args, "commit", true) ?? true,
          changelog: asBool(args, "changelog", false) ?? false,
          changelogDate: asString(args, "date"),
        },
      });
      if (!output.ok || !output.data) {
        fail(output.issues.map((i) => i.suggestion ?? i.message).join("\n"));
      }

      print(
        {
          ok: true,
          ingest: output.data.ingest,
          lint: output.data.lintIssues,
          changelog: output.data.changelog ?? { skipped: true },
          git: output.data.git,
        },
        jsonMode,
      );
      return;
    }

    case "closeout": {
      const title = asString(args, "title");
      const content = asString(args, "content");
      if (!title || !content) {
        fail("closeout requires --title --content");
      }

      const category = (asString(args, "category") ??
        "threads") as "concepts" | "decisions" | "threads";
      const mode = (asString(args, "mode") ??
        "append") as "replace" | "append" | "section";

      const weaveResult = await weave(loomRoot, {
        category,
        title,
        content,
        tags: asList(args, "tags"),
        mode,
      });
      await rebuildIndex(loomRoot);
      const weaveCommit = await git.commitChanges(
        [weaveResult.filePath, path.join(loomRoot, "index.md")],
        `${weaveResult.isUpdate ? "update" : "add"} ${category}/${title}`,
      );

      const highlights = await collectDailyHighlightsFromGit(WORK_DIR);
      let changelogResult:
        | Awaited<ReturnType<typeof updateChangelog>>
        | undefined;
      let changelogCommitMsg: string | undefined;
      if (highlights.length > 0) {
        changelogResult = await updateChangelog(WORK_DIR, highlights);
        const cc = await git.commitChanges(
          [changelogResult.filePath],
          `update changelog ${changelogResult.date}`,
        );
        changelogCommitMsg = cc.message;
      }

      print(
        {
          ok: true,
          weave: {
            ...weaveResult,
            git: weaveCommit.message,
          },
          changelog: changelogResult
            ? {
                file: changelogResult.filePath,
                date: changelogResult.date,
                added: changelogResult.added,
                total: changelogResult.totalForDate,
                git: changelogCommitMsg,
              }
            : {
                skipped: true,
                reason: "no highlights",
              },
        },
        jsonMode,
      );
      return;
    }

    case "trace": {
      const query = asString(args, "query");
      if (!query) fail("trace requires --query");
      const results = await trace(loomRoot, query, {
        category: asString(args, "category") as
          | "concepts"
          | "decisions"
          | "threads"
          | undefined,
        tags: asList(args, "tags"),
        limit: asNumber(args, "limit"),
      });
      print({ ok: true, count: results.length, results }, jsonMode);
      return;
    }

    case "read": {
      const category = asString(args, "category");
      const slug = asString(args, "slug");
      if (!category || !slug) fail("read requires --category --slug");
      const content = await readKnowledge(
        loomRoot,
        category as "concepts" | "decisions" | "threads",
        slug,
      );
      if (!content) fail(`entry not found: ${category}/${slug}`);
      print({ ok: true, content }, jsonMode);
      return;
    }

    case "list": {
      const items = await listAll(loomRoot);
      print({ ok: true, count: items.length, items }, jsonMode);
      return;
    }

    case "deprecate": {
      const category = asString(args, "category");
      const slug = asString(args, "slug");
      const reason = asString(args, "reason");
      if (!category || !slug || !reason) {
        fail("deprecate requires --category --slug --reason");
      }
      const result = await deprecateEntry(
        loomRoot,
        category as "concepts" | "decisions" | "threads",
        slug,
        reason,
        asString(args, "superseded_by"),
      );
      await rebuildIndex(loomRoot);
      const commitResult = await git.commitChanges(
        [result.filePath, path.join(loomRoot, "index.md")],
        `deprecate ${category}/${slug}`,
      );
      print({ ok: result.success, message: result.message, git: commitResult.message }, jsonMode);
      return;
    }

    case "reflect": {
      const report = await reflect(loomRoot, {
        staleDays: asNumber(args, "staleDays") ?? 30,
        includeThreads: asBool(args, "includeThreads", true) ?? true,
        maxFindings: asNumber(args, "maxFindings") ?? 20,
      });
      print({ ok: true, ...report }, jsonMode);
      return;
    }

    case "doctor": {
      const failOn = (asString(args, "failOn") ?? "error").toLowerCase();
      if (!["none", "error", "warn"].includes(failOn)) {
        fail("doctor --failOn must be one of: none|error|warn");
      }

      const report = await executeRunDoctor({
        loomRoot,
        command: {
          staleDays: asNumber(args, "staleDays") ?? 30,
          includeThreads: asBool(args, "includeThreads", true) ?? true,
          maxFindings: asNumber(args, "maxFindings") ?? 20,
          failOn: failOn as "none" | "error" | "warn",
        },
      });
      if (!report.ok || !report.data) {
        fail("doctor execution failed");
      }

      print(
        {
          ok: !report.data.shouldFail,
          ...report.data,
        },
        jsonMode,
      );

      if (report.data.shouldFail) {
        process.exitCode = 2;
      }
      return;
    }

    case "sync": {
      const result = await git.sync();
      print({ ok: result.success, message: result.message }, jsonMode);
      return;
    }

    case "log": {
      const output = await git.log(asNumber(args, "limit") ?? 10);
      print({ ok: true, output }, jsonMode);
      return;
    }

    case "changelog": {
      const mode = (asString(args, "mode") ?? "auto") as "auto" | "manual";
      const date = asString(args, "date");
      const highlights =
        mode === "manual"
          ? (asString(args, "highlights")
              ?.split("|")
              .map((x) => x.trim())
              .filter(Boolean) ?? [])
          : await collectDailyHighlightsFromGit(WORK_DIR, date);
      if (highlights.length === 0) {
        print({ ok: true, message: "no highlights" }, jsonMode);
        return;
      }
      const result = await updateChangelog(WORK_DIR, highlights, date);
      let gitMsg: string | undefined;
      if (asBool(args, "commit", true) ?? true) {
        const commitResult = await git.commitChanges(
          [result.filePath],
          `update changelog ${result.date}`,
        );
        gitMsg = commitResult.message;
      }
      print({ ok: true, ...result, git: gitMsg }, jsonMode);
      return;
    }

    case "upgrade": {
      const dryRun = asBool(args, "dryRun", false) ?? false;
      const result = await upgradeFromGit(SERVER_ROOT, dryRun);
      print({ ok: result.success, ...result }, jsonMode);
      return;
    }

    default:
      fail(`unknown command: ${command}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

