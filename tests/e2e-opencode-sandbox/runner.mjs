#!/usr/bin/env node
/**
 * OpenCode（源码 bun 入口）+ Loom MCP 沙箱 E2E。
 *
 * 前置：本机已配置 OpenCode 全局模型/API（与 CLI 共用 ~/.config/opencode）。
 *
 * 用法（在 Loom 仓库根）：
 *   export OPENCODE_PACKAGE_DIR="/path/to/opencode/packages/opencode"
 *   npm run test:e2e-opencode
 *
 * 仅跑一条用例：
 *   node tests/e2e-opencode-sandbox/runner.mjs --only=index-mandatory-read
 *
 * 跳过（CI 无 Key 时）：
 *   E2E_SKIP_OPENCODE=1 npm run test:e2e-opencode
 *
 * 结果目录：tests/e2e-opencode-sandbox/results/run-YYYYMMDD-HHmmss-<6hex>/
 */

import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const CASES_FILE = path.join(__dirname, "cases.json");
const RESULTS_DIR = path.join(__dirname, "results");
const LATEST_FILE = path.join(RESULTS_DIR, "_latest.txt");

function die(msg, code = 1) {
  console.error(`[e2e-opencode] ${msg}`);
  process.exit(code);
}

function parseOnlyArg() {
  const a = process.argv.find((x) => x.startsWith("--only="));
  return a ? a.slice("--only=".length) : null;
}

function ensureBuild() {
  const entry = path.join(REPO_ROOT, "dist", "index.js");
  if (fs.existsSync(entry)) return;
  console.log("[e2e-opencode] dist/ missing, running npm run build …");
  const r = spawnSync("npm", ["run", "build"], {
    cwd: REPO_ROOT,
    stdio: "inherit",
    env: process.env,
  });
  if (r.status !== 0) die("npm run build failed", r.status ?? 1);
}

function mkSandbox() {
  const base = path.join(REPO_ROOT, ".sandbox-output");
  fs.mkdirSync(base, { recursive: true });
  return fs.mkdtempSync(path.join(base, "e2e-opencode-"));
}

function runSetup(sandboxDir) {
  const setup = path.join(REPO_ROOT, "scripts", "opencode-loom-sandbox", "setup.sh");
  const r = spawnSync("bash", [setup, sandboxDir], {
    cwd: REPO_ROOT,
    stdio: "inherit",
    env: { ...process.env },
  });
  if (r.status !== 0) die(`setup.sh failed for ${sandboxDir}`, r.status ?? 1);
}

function runOpencodeCase({ opencodePkg, sandboxDir, contextLogDir, prompt }) {
  const r = spawnSync(
    "bun",
    [
      "run",
      "--conditions=browser",
      "./src/index.ts",
      "run",
      "--dir",
      sandboxDir,
      prompt,
    ],
    {
      cwd: opencodePkg,
      encoding: "utf8",
      env: {
        ...process.env,
        OPENCODE_CONTEXT_LOG_DIR: contextLogDir,
      },
      // 等价于 CLI 非交互下的 `< /dev/null`，避免 run 里 await Bun.stdin.text() 永久阻塞
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 20 * 1024 * 1024,
    },
  );
  const stdout = r.stdout ?? "";
  const stderr = r.stderr ?? "";
  return { status: r.status, stdout, stderr };
}

/** run-YYYYMMDD-HHmmss-abcdef */
function makeRunDirName() {
  const now = new Date();
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  const suffix = crypto.randomBytes(3).toString("hex");
  return `run-${y}${mo}${d}-${h}${mi}${s}-${suffix}`;
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, ent.name);
    const to = path.join(dest, ent.name);
    if (ent.isDirectory()) copyDirRecursive(from, to);
    else fs.copyFileSync(from, to);
  }
}

function readLoomVersion() {
  try {
    const p = path.join(REPO_ROOT, "package.json");
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    return j.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

function readGitShort() {
  const r = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  if (r.status !== 0) return null;
  return (r.stdout || "").trim() || null;
}

function saveCaseArtifacts(runDir, id, { prompt, expectStdoutContains }, outcome) {
  const dir = path.join(runDir, "cases", id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "stdout.txt"), outcome.stdout, "utf8");
  fs.writeFileSync(path.join(dir, "stderr.txt"), outcome.stderr, "utf8");
  const meta = {
    id,
    prompt,
    expectStdoutContains,
    exitCode: outcome.status,
    durationMs: outcome.durationMs,
    ok: outcome.ok,
    missingSubstrings: outcome.missingSubstrings ?? [],
  };
  fs.writeFileSync(path.join(dir, "case.json"), `${JSON.stringify(meta, null, 2)}\n`, "utf8");
}

function copyContextLogs(runDir, contextLogDir) {
  const dest = path.join(runDir, "context-request-log");
  if (!fs.existsSync(contextLogDir)) return [];
  copyDirRecursive(contextLogDir, dest);
  const copied = [];
  if (fs.existsSync(dest)) {
    for (const ent of fs.readdirSync(dest, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      const p = path.join(dest, ent.name, "requests.jsonl");
      if (fs.existsSync(p)) copied.push(p);
    }
  }
  return copied;
}

function writeSummaryMd(runDir, manifest) {
  const lines = [
    `# E2E OpenCode + Loom 运行摘要`,
    ``,
    `- **runId**: \`${manifest.runId}\``,
    `- **开始**: ${manifest.startedAt}`,
    `- **结束**: ${manifest.finishedAt}`,
    `- **结果**: ${manifest.overallOk ? "全部通过" : "存在失败"}`,
    `- **沙箱**: \`${manifest.sandboxDir}\``,
    `- **Loom 版本**: ${manifest.loomVersion}`,
    manifest.gitShort ? `- **Git**: \`${manifest.gitShort}\`` : null,
    ``,
    `## 用例`,
    ``,
    ...manifest.cases.map((c) => {
      const mark = c.ok ? "✓" : "✖";
      return `- ${mark} **${c.id}** (${c.durationMs}ms, exit=${c.exitCode})${c.missingSubstrings?.length ? ` — 缺子串: \`${c.missingSubstrings.join("`, `")}\`` : ""}`;
    }),
    ``,
    `详情见 \`manifest.json\` 与 \`cases/\` 下各目录。`,
    ``,
  ].filter(Boolean);
  fs.writeFileSync(path.join(runDir, "SUMMARY.md"), lines.join("\n"), "utf8");
}

function persistRunResults({ runDir, manifest, contextLogDir }) {
  fs.mkdirSync(runDir, { recursive: true });
  const copiedAbs = copyContextLogs(runDir, contextLogDir);
  manifest.contextRequestLogFiles = copiedAbs.map((p) => path.relative(runDir, p));
  fs.writeFileSync(path.join(runDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  writeSummaryMd(runDir, manifest);
  fs.writeFileSync(LATEST_FILE, `${path.basename(runDir)}\n`, "utf8");
}

function main() {
  if (process.env.E2E_SKIP_OPENCODE === "1") {
    console.log("[e2e-opencode] E2E_SKIP_OPENCODE=1 — skipping.");
    process.exit(0);
  }

  const opencodePkg = process.env.OPENCODE_PACKAGE_DIR?.trim();
  if (!opencodePkg) {
    die(
      "请设置环境变量 OPENCODE_PACKAGE_DIR 为 OpenCode 仓库下的 packages/opencode 绝对路径（源码 bun 入口所在目录）。",
    );
  }
  const indexTs = path.join(opencodePkg, "src", "index.ts");
  if (!fs.existsSync(indexTs)) {
    die(`未找到 ${indexTs}，请检查 OPENCODE_PACKAGE_DIR。`);
  }

  const bunCheck = spawnSync("bun", ["--version"], { encoding: "utf8" });
  if (bunCheck.status !== 0) {
    die("未检测到 bun，请先安装 Bun 并确保在 PATH 中。");
  }

  ensureBuild();

  const raw = fs.readFileSync(CASES_FILE, "utf8");
  const { cases } = JSON.parse(raw);
  if (!Array.isArray(cases) || cases.length === 0) {
    die("cases.json 无效或为空。");
  }

  const only = parseOnlyArg();
  const selected = only ? cases.filter((c) => c.id === only) : cases;
  if (only && selected.length === 0) {
    die(`未找到用例 id: ${only}`);
  }

  const runId = makeRunDirName();
  const runDir = path.join(RESULTS_DIR, runId);
  const startedAt = new Date().toISOString();
  const loomVersion = readLoomVersion();
  const gitShort = readGitShort();

  const sandboxDir = mkSandbox();
  const contextLogDir = path.join(sandboxDir, "context-request-log");
  fs.mkdirSync(contextLogDir, { recursive: true });

  console.log(`[e2e-opencode] sandbox: ${sandboxDir}`);
  console.log(`[e2e-opencode] OPENCODE_PACKAGE_DIR: ${opencodePkg}`);
  console.log(`[e2e-opencode] 结果目录: ${runDir}`);
  runSetup(sandboxDir);

  const caseRows = [];
  let failed = 0;

  for (const c of selected) {
    const { id, prompt, expectStdoutContains } = c;
    if (!id || !prompt || !Array.isArray(expectStdoutContains)) {
      die(`用例格式错误: ${JSON.stringify(c)}`);
    }
    console.log(`\n[e2e-opencode] ▶ ${id}`);
    const t0 = Date.now();
    const { status, stdout, stderr } = runOpencodeCase({
      opencodePkg,
      sandboxDir,
      contextLogDir,
      prompt,
    });
    const durationMs = Date.now() - t0;
    const combined = `${stdout}\n${stderr}`;
    const missing = expectStdoutContains.filter((sub) => !combined.includes(sub));
    const ok = status === 0 && missing.length === 0;

    saveCaseArtifacts(runDir, id, c, {
      status,
      stdout,
      stderr,
      durationMs,
      ok,
      missingSubstrings: missing.length ? missing : undefined,
    });

    caseRows.push({
      id,
      exitCode: status,
      durationMs,
      ok,
      missingSubstrings: missing.length ? missing : [],
    });

    if (!ok) {
      failed++;
      if (status !== 0) {
        console.error(`[e2e-opencode] ✖ ${id} exit=${status}`);
        if (stderr.trim()) console.error(stderr.slice(-4000));
        if (stdout.trim()) console.error(stdout.slice(-4000));
      } else {
        console.error(`[e2e-opencode] ✖ ${id} 输出中缺少子串: ${missing.join(", ")}`);
        console.error("--- stdout/stderr 尾部 ---\n" + combined.slice(-6000));
      }
    } else {
      console.log(`[e2e-opencode] ✓ ${id}`);
    }
  }

  const finishedAt = new Date().toISOString();
  const overallOk = failed === 0;

  const manifest = {
    schema: "loom-e2e-opencode-run/v1",
    runId,
    startedAt,
    finishedAt,
    overallOk,
    loomVersion,
    gitShort,
    opencodePackageDir: opencodePkg,
    onlyCase: only,
    sandboxDir,
    contextLogDir,
    cases: caseRows,
    contextRequestLogFiles: [],
  };

  persistRunResults({ runDir, manifest, contextLogDir });

  const jsonlRel = manifest.contextRequestLogFiles;
  if (jsonlRel.length) {
    console.log(`\n[e2e-opencode] 上下文请求日志已复制到结果目录:`);
    for (const rel of jsonlRel) {
      const full = path.join(runDir, rel);
      const n = fs.readFileSync(full, "utf8").trim().split("\n").filter(Boolean).length;
      console.log(`  ${rel} (${n} lines)`);
    }
  } else {
    console.log(
      "\n[e2e-opencode] 提示: 未复制到 requests.jsonl（若 OpenCode 未合并 context 日志改动则属正常）。",
    );
  }

  console.log(`\n[e2e-opencode] 完整结果: ${runDir}`);
  console.log(`[e2e-opencode] 最近运行指针: ${LATEST_FILE}`);

  if (failed > 0) {
    console.error(`\n[e2e-opencode] 失败 ${failed} / ${selected.length}`);
    process.exit(1);
  }
  console.log(`\n[e2e-opencode] 全部通过 (${selected.length})。`);
}

main();
