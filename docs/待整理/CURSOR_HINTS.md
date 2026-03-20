# Cursor 用户可选说明（非产品内置）

Loom 仓库不再包含 `.cursorrules`。若你在 Cursor 中希望 AI 更主动地调用 Loom MCP，可将下列要点**自行**粘贴到 Cursor 的用户规则 / 项目规则中（与产品行为无关，仅为编辑器侧习惯）。

- 用户说「记一下」「写进 loom」「更新记忆」时，调用 `loom_weave` 写入摘要或结论。
- **写入 `.loom/` 时优先走 MCP**：需要新增或更新 `concepts` / `decisions` / `threads` 时，用 `loom_weave`（或 `loom_ingest` / `loom_probe_commit` 等合适工具），避免用 Agent 自带的 Write/Apply Patch 直接改 `.loom/**/*.md`，否则会绕过索引重建、Git 提交与事件记录。
- 回答与项目相关的问题前，可先 `loom_trace` / `loom_index` 检索既有记忆。
- 具体工具列表与参数以 MCP 暴露为准。

产品侧统一提示词管理见：`docs/PROMPTS.md`。
