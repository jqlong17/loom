import * as path from "path";
import { describe, expect, it } from "vitest";
import { ensureLoomStructure } from "../src/config.js";
import {
  rebuildIndex,
  trace,
  weave,
  type TraceResult,
} from "../src/weaver.js";
import { pathExists, makeTempDir } from "./test-utils.js";

describe("layered index pipeline", () => {
  it("rebuildIndex writes layered index artifacts", async () => {
    const workDir = await makeTempDir("loom-index-");
    const loomRoot = path.join(workDir, ".loom");
    await ensureLoomStructure(loomRoot);

    await weave(loomRoot, {
      category: "concepts",
      title: "支付网关架构",
      content: "## 背景\n统一支付入口。\n\n## 结论\n通过 gateway 解耦渠道。",
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

    await rebuildIndex(loomRoot);

    expect(await pathExists(path.join(loomRoot, "index", "catalog.v1.json"))).toBe(true);
    expect(await pathExists(path.join(loomRoot, "index", "digest.v1.json"))).toBe(true);
    expect(await pathExists(path.join(loomRoot, "index", "graph.v1.json"))).toBe(true);
    expect(await pathExists(path.join(loomRoot, "index", "build-meta.v1.json"))).toBe(true);
  });

  it("trace uses layered mode by default and supports legacy fallback", async () => {
    const workDir = await makeTempDir("loom-index-");
    const loomRoot = path.join(workDir, ".loom");
    await ensureLoomStructure(loomRoot);

    await weave(loomRoot, {
      category: "concepts",
      title: "订单领域模型",
      content: "## 背景\n订单状态流转。\n\n## 结论\n采用状态机管理订单生命周期。",
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

    const layered = await trace(loomRoot, "订单 状态机", { limit: 3 });
    const legacy = await trace(loomRoot, "订单 状态机", {
      limit: 3,
      traceMode: "legacy",
    });

    expect(layered.length).toBeGreaterThan(0);
    expect(legacy.length).toBeGreaterThan(0);
    const layeredTitles = new Set(layered.map((item: TraceResult) => item.title));
    expect(layeredTitles.has("订单领域模型")).toBe(true);
    expect(layered[0].whyMatched && layered[0].whyMatched.length > 0).toBe(true);
    expect(layered[0].whySummary).toBeTruthy();
  });
});
