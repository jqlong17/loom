/**
 * Shared helpers for MCP read-path bounding (list cap, index body truncation).
 * Keeps CLI and MCP handlers aligned on ordering and truncation semantics.
 */

export interface ListCapItem {
  updated: string;
}

export function applyListEntryCap<T extends ListCapItem>(
  items: T[],
  maxEntries: number,
): { shown: T[]; total: number; truncated: boolean } {
  const total = items.length;
  const cap = Math.max(1, Math.floor(maxEntries));
  if (total <= cap) {
    return { shown: items, total, truncated: false };
  }
  const sorted = [...items].sort(
    (a, b) => entryTime(b.updated) - entryTime(a.updated),
  );
  return { shown: sorted.slice(0, cap), total, truncated: true };
}

function entryTime(updated: string): number {
  const ts = Date.parse(updated);
  return Number.isNaN(ts) ? 0 : ts;
}

export function truncateMarkdownForContext(
  markdown: string,
  maxChars: number,
): { text: string; truncated: boolean; originalChars: number } {
  const originalChars = markdown.length;
  const cap = Math.max(1, Math.floor(maxChars));
  if (originalChars <= cap) {
    return { text: markdown, truncated: false, originalChars };
  }
  const head = markdown.slice(0, cap).trimEnd();
  const notice =
    `\n\n> …（已截断）原文约 ${originalChars} 字符，此处最多展示 ${cap} 字符。请用 \`loom_read\` 读取单篇，或先用 \`loom_trace\` 缩小范围。`;
  return { text: `${head}${notice}`, truncated: true, originalChars };
}
