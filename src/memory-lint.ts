import { type LoomCategory } from "./config.js";

export type MemoryLintLevel = "error" | "warn";

export interface MemoryLintIssue {
  level: MemoryLintLevel;
  code: string;
  message: string;
  suggestion: string;
}

export interface MemoryLintResult {
  ok: boolean;
  issues: MemoryLintIssue[];
}

export interface LintTarget {
  title: string;
  category: LoomCategory;
  content: string;
  tags?: string[];
  links?: string[];
  domain?: string;
}

export function lintMemoryEntry(target: LintTarget): MemoryLintResult {
  const issues: MemoryLintIssue[] = [];
  const title = target.title.trim();
  const content = target.content.trim();
  const tags = (target.tags ?? []).map((t) => t.trim()).filter(Boolean);
  const links = (target.links ?? []).map((l) => l.trim()).filter(Boolean);
  const domain = target.domain?.trim();

  if (title.length < 3) {
    issues.push({
      level: "error",
      code: "TITLE_TOO_SHORT",
      message: "标题至少需要 3 个字符。",
      suggestion: "请使用更具体的标题，例如“支付流程边界定义”。",
    });
  }

  if (content.length < 20) {
    issues.push({
      level: "error",
      code: "CONTENT_TOO_SHORT",
      message: "内容过短，无法形成稳定记忆。",
      suggestion: "补充背景、结论和影响范围，建议至少 2-3 句。",
    });
  }

  if (tags.length === 0) {
    issues.push({
      level: "warn",
      code: "MISSING_TAGS",
      message: "未设置标签，后续检索命中率会下降。",
      suggestion: "至少添加 1-3 个语义标签（如 architecture, auth, release）。",
    });
  }

  if (!/^##\s+/m.test(content)) {
    issues.push({
      level: "warn",
      code: "MISSING_H2",
      message: "内容缺少二级标题结构（##）。",
      suggestion: "建议拆分为“## 背景 / ## 结论 / ## 影响”等小节。",
    });
  }

  if (
    target.category === "decisions" &&
    !/(为什么|原因|权衡|trade-?off|why)/i.test(content)
  ) {
    issues.push({
      level: "warn",
      code: "DECISION_MISSING_WHY",
      message: "决策记录未明确“为什么这样选”。",
      suggestion: "补充备选方案、取舍依据与拒绝原因。",
    });
  }

  if (
    (target.category === "concepts" || target.category === "decisions") &&
    !domain
  ) {
    issues.push({
      level: "warn",
      code: "MISSING_DOMAIN",
      message: "缺少 domain 字段，宏观图谱归类会变弱。",
      suggestion: "建议补充 domain（如 architecture, product, operations）。",
    });
  }

  if (
    (target.category === "concepts" || target.category === "decisions") &&
    links.length === 0
  ) {
    issues.push({
      level: "warn",
      code: "MISSING_LINKS",
      message: "缺少 links 字段，知识图谱边关系不足。",
      suggestion: "建议至少补充 1 条 links（如 concepts/xxx 或 decisions/xxx）。",
    });
  }

  const hasError = issues.some((i) => i.level === "error");
  return { ok: !hasError, issues };
}

export function formatLintIssues(result: MemoryLintResult): string {
  if (result.issues.length === 0) {
    return "Memory lint: no issues.";
  }
  const lines = ["Memory lint report:"];
  for (const issue of result.issues) {
    lines.push(
      `- [${issue.level.toUpperCase()}][${issue.code}] ${issue.message} 建议: ${issue.suggestion}`,
    );
  }
  return lines.join("\n");
}
