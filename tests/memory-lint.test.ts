import { describe, expect, it } from "vitest";
import { lintMemoryEntry } from "../src/memory-lint.js";

describe("memory lint", () => {
  it("blocks short title/content", () => {
    const result = lintMemoryEntry({
      title: "ab",
      category: "concepts",
      content: "too short",
      tags: [],
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "TITLE_TOO_SHORT")).toBe(true);
    expect(result.issues.some((i) => i.code === "CONTENT_TOO_SHORT")).toBe(true);
  });

  it("warns missing domain and links for concept", () => {
    const result = lintMemoryEntry({
      title: "Payment architecture context",
      category: "concepts",
      content: "## 背景\n这是一个足够长的内容用于通过硬性校验。\n\n## 结论\n继续推进。",
      tags: ["architecture"],
    });
    expect(result.ok).toBe(true);
    expect(result.issues.some((i) => i.code === "MISSING_DOMAIN")).toBe(true);
    expect(result.issues.some((i) => i.code === "MISSING_LINKS")).toBe(true);
  });

  it("passes cleanly when required fields are present", () => {
    const result = lintMemoryEntry({
      title: "Payment boundary decision",
      category: "decisions",
      content:
        "## 背景\n这是足够长的决策内容。\n\n## 为什么\n为了降低系统复杂度与后续维护成本。\n\n## 结论\n采用当前方案。",
      tags: ["architecture", "decision"],
      domain: "architecture",
      links: ["concepts/three-layer-architecture"],
    });
    expect(result.ok).toBe(true);
    expect(result.issues.length).toBe(0);
  });
});
