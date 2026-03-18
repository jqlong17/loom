# CHANGELOG

公开记录 Loom 项目每日粒度的核心功能变化（中文）。

- 只记录核心能力升级，不记录琐碎改动
- 同一天多次更新会合并到同一日期下

## 2026-03-18

- 完成 Loom MCP 基础能力：`loom_init` / `loom_weave` / `loom_trace` / `loom_read` / `loom_list` / `loom_sync` / `loom_log`，目的是先建立可用的知识沉淀闭环。
- 建立 `.loom` 知识库结构与自动索引（`index.md`），目的是让知识文件可组织、可检索、可持续维护。
- 支持 Git 自动关联：知识写入后自动提交，并可选择推送，目的是让知识演进具备可追溯性与团队协作能力。
- 新增 `loom_reflect`：知识库体检（冲突、过期、缺标签、可合并项），目的是持续提升知识质量与一致性。
- 新增 `loom_weave` 增量模式（`replace` / `append` / `section`），目的是避免后续补充知识时覆盖历史内容。
- 新增 `loom_deprecate`：可将旧条目标记废弃并指向替代方案，目的是管理知识生命周期并减少过期信息误导。
- 新增 `loom_upgrade`：支持从 GitHub 拉取 Loom 本体更新，目的是让用户可以一句话完成版本升级。
- 增强 `loom_trace`：支持分类/标签过滤、limit 与相关性排序，目的是让知识检索结果更精准、更可用。
- 完善多客户端接入文档：Cursor、VS Code Copilot、Claude Code、OpenCode、Codex CLI，目的是降低接入门槛并扩大可用场景。
