/**
 * 运行指标测试集：对 test-set.json 中每条 case 执行 trace，统计命中率与 Token ROI。
 * 用法: npx tsx scripts/run-eval.ts [--set path/to/test-set.json] [--loom .loom]
 *
 * 若 --seed 则先在 loom 下写入默认种子数据（weave + rebuildIndex），再跑 cases。
 */

import * as fs from "fs/promises";
import * as path from "path";
import { ensureLoomStructure } from "../src/config.js";
import { readEvents } from "../src/events.js";
import { rebuildIndex, trace, weave } from "../src/weaver.js";

const DEFAULT_SET = ".loom/eval/test-set.json";

interface EvalCase {
  id: string;
  query: string;
  expectedTitles: string[];
  category?: string;
  tags?: string[];
  minResults?: number;
}

interface TestSet {
  name: string;
  description?: string;
  seed?: string;
  cases: EvalCase[];
}

function parseArgs(): { setPath: string; loomRoot: string; seed: boolean } {
  const args = process.argv.slice(2);
  let setPath = path.resolve(process.cwd(), DEFAULT_SET);
  let loomRoot = path.resolve(process.cwd(), ".loom");
  let seed = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--set" && args[i + 1]) {
      setPath = path.resolve(process.cwd(), args[++i]);
    } else if (args[i] === "--loom" && args[i + 1]) {
      loomRoot = path.resolve(process.cwd(), args[++i]);
    } else if (args[i] === "--seed") {
      seed = true;
    }
  }
  return { setPath, loomRoot, seed };
}

async function seedDefault(loomRoot: string): Promise<void> {
  await ensureLoomStructure(loomRoot);
  await weave(loomRoot, {
    category: "concepts",
    title: "支付网关架构",
    content:
      "## 背景\n统一支付入口。\n\n## 结论\n通过 gateway 解耦渠道。",
    tags: ["payments", "core"],
    links: ["decisions/payment-provider-choice"],
    domain: "payments",
  });
  await weave(loomRoot, {
    category: "decisions",
    title: "payment provider choice",
    content: "## Decision\nchoose provider A.",
    tags: ["payments"],
    domain: "payments",
  });
  await weave(loomRoot, {
    category: "concepts",
    title: "订单领域模型",
    content:
      "## 背景\n订单状态流转。\n\n## 结论\n采用状态机管理订单生命周期。",
    tags: ["orders", "domain"],
    domain: "commerce",
  });
  await weave(loomRoot, {
    category: "threads",
    title: "order incident review",
    content: "定位订单重复创建问题并给出修复策略。",
    tags: ["orders", "incident"],
    domain: "commerce",
  });
  await rebuildIndex(loomRoot);
}

async function main(): Promise<void> {
  const { setPath, loomRoot, seed: doSeed } = parseArgs();

  const raw = await fs.readFile(setPath, "utf-8").catch((e) => {
    console.error("Failed to read test set:", setPath, e.message);
    process.exit(1);
  });
  const testSet: TestSet = JSON.parse(raw);

  await ensureLoomStructure(loomRoot);
  if (doSeed && testSet.seed) {
    console.log("Seeding default data...");
    await seedDefault(loomRoot);
  }

  const eventsBefore = await readEvents(loomRoot);
  const initialQueryCount = eventsBefore.filter(
    (e) => e.type === "index.query.executed",
  ).length;

  const results: { id: string; query: string; passed: boolean; note?: string }[] = [];

  for (const c of testSet.cases) {
    const options: { limit?: number; category?: string; tags?: string[] } = {
      limit: 5,
    };
    if (c.category) options.category = c.category as "concepts" | "decisions" | "threads";
    if (c.tags?.length) options.tags = c.tags;

    const list = await trace(loomRoot, c.query, options);
    const titles = new Set(list.map((r) => r.title));
    const hit = c.expectedTitles.some((t) => titles.has(t));
    const minOk = c.minResults == null || list.length >= c.minResults;
    const passed = hit && minOk;
    results.push({
      id: c.id,
      query: c.query,
      passed,
      note: hit ? undefined : `expected one of [${c.expectedTitles.join(", ")}]`,
    });
  }

  const eventsAfter = await readEvents(loomRoot);
  const queryEvents = eventsAfter.filter((e) => e.type === "index.query.executed");
  const newQueryEvents = queryEvents.slice(initialQueryCount);
  let totalContextChars = 0;
  let totalRetrievedChars = 0;
  for (const e of newQueryEvents) {
    const p = e.payload as { contextChars?: number; retrievedChars?: number };
    totalContextChars += p.contextChars ?? 0;
    totalRetrievedChars += p.retrievedChars ?? 0;
  }

  const passedCount = results.filter((r) => r.passed).length;
  const hitRate = testSet.cases.length > 0 ? passedCount / testSet.cases.length : 0;
  const tokenROI =
    totalContextChars > 0 ? totalRetrievedChars / totalContextChars : 0;

  console.log("\n--- Eval Report ---");
  console.log("Set:", testSet.name);
  console.log("Cases:", testSet.cases.length, "| Passed:", passedCount);
  console.log("Hit rate (M2 proxy):", (hitRate * 100).toFixed(2) + "%");
  console.log(
    "Token ROI (M4):",
    tokenROI.toFixed(4),
    `(retrievedChars=${totalRetrievedChars}, contextChars=${totalContextChars})`,
  );
  const failed = results.filter((r) => !r.passed);
  if (failed.length > 0) {
    console.log("Failed cases:", failed.map((r) => r.id + ": " + r.note).join("; "));
  }
  console.log("------------------\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
