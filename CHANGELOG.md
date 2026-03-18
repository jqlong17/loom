# CHANGELOG

公开记录 Loom 项目每日粒度的核心功能变化（中文）。

- 只记录核心能力升级，不记录琐碎改动
- 同一天多次更新会合并到同一日期下

## 2026-03-18

- 完成 Loom MCP 基础能力：`loom_init` / `loom_weave` / `loom_trace` / `loom_read` / `loom_list` / `loom_sync` / `loom_log`
- 建立 `.loom` 知识库结构与自动索引（`index.md`）
- 支持 Git 自动关联：知识写入后自动提交，并可选择推送
- 新增 `loom_reflect`：知识库体检（冲突、过期、缺标签、可合并项）
- 新增 `loom_weave` 增量模式（`replace` / `append` / `section`）
- 新增 `loom_deprecate`：可将旧条目标记废弃并指向替代方案
- 新增 `loom_upgrade`：支持从 GitHub 拉取 Loom 本体更新
- 增强 `loom_trace`：支持分类/标签过滤、limit 与相关性排序
- 完善多客户端接入文档：Cursor、VS Code Copilot、Claude Code、OpenCode、Codex CLI
