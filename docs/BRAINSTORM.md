# Brainstorm

这里是 Loom 的创意池，欢迎任何贡献者先记录想法，再转为 Roadmap 或 Implementation Plan 任务。

## 使用方式

- 新想法请追加到“Idea Backlog”。
- 每条建议尽量包含：
  - 背景问题
  - 核心想法
  - 预期收益
  - 潜在风险
  - 建议下一步
- 若想法成熟，可发 PR 同步到：
  - `docs/ROADMAP.md`
  - `docs/IMPLEMENTATION_PLAN.md`

## Idea Backlog

### [IDEA-001] 事件流回放调试器

- 背景问题：当前问题复盘依赖零散日志，不够系统。
- 核心想法：增加 `loom replay --from <event-id>` 回放关键事件。
- 预期收益：快速定位“记忆为何漂移”。
- 潜在风险：事件 schema 兼容成本上升。
- 建议下一步：先定义最小事件 schema（ingest/probe/doctor）。

### [IDEA-002] 图谱增量索引器

- 背景问题：全量重建索引在规模上升后会变慢。
- 核心想法：基于文件变更集做增量图谱更新。
- 预期收益：更低延迟，适配 daemon 监听模式。
- 潜在风险：增量一致性错误会导致索引偏差。
- 建议下一步：先加校验模式 `--verify-full-rebuild`。

### [IDEA-003] PR 前自动质量门禁

- 背景问题：贡献者提交质量标准不一致。
- 核心想法：提供可复制的 PR Checklist + CI gate 模板。
- 预期收益：社区贡献更稳定，维护成本下降。
- 潜在风险：初期门槛提高可能影响贡献意愿。
- 建议下一步：先做 warn 模式，再逐步升级到 error 模式。
