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
  weave --category <concepts|decisions|threads> --title <t> --content <text> [--tags a,b] [--mode replace|append|section]
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

      const result = await weave(loomRoot, {
        category: category as "concepts" | "decisions" | "threads",
        title,
        content,
        tags: asList(args, "tags"),
        mode: asString(args, "mode") as "replace" | "append" | "section" | undefined,
      });
      await rebuildIndex(loomRoot);
      const commitResult = await git.commitChanges(
        [result.filePath, path.join(loomRoot, "index.md")],
        `${result.isUpdate ? "update" : "add"} ${category}/${title}`,
      );
      print(
        {
          ok: true,
          ...result,
          git: commitResult.message,
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

