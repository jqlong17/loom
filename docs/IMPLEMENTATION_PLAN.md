# Implementation Plan

用于逐项推进架构重构，建议每完成一项就在本文打勾并附 PR 链接。

## A. Adapter Layer

- [x] 引入 `core` 层并让 CLI/MCP 共享核心流程
- [ ] 提炼统一 `ApplicationService` 组装入口（Context + Ports）
- [ ] 新增 HTTP adapter（只映射参数，不落业务逻辑）
- [ ] 新增 Daemon adapter（文件监听 + 自动触发策略）

## B. Use Case Layer

- [x] IngestKnowledge
- [x] RunDoctor
- [ ] StartProbeSession
- [ ] CommitProbeSession
- [ ] UpdateChangelog
- [ ] 所有用例统一返回：`ok / data / issues / artifacts / gate`

## C. Domain Model

- [ ] 提炼 `KnowledgeEntry` 领域模型（状态、链接、领域、版本）
- [ ] 提炼 `KnowledgeGraph` 领域模型（nodes/edges/query）
- [ ] 提炼 `ProbeSession` 状态机模型（open -> committed）
- [ ] 提炼 `QualityIssue` 模型并统一错误码
- [ ] frontmatter 读写改为“模型 <-> 序列化”双向转换

## D. Ports & Drivers

- [ ] `KnowledgeRepository` 接口 + MarkdownDriver
- [ ] `SessionRepository` 接口 + JsonDriver
- [ ] `IndexRepository` 接口 + MarkdownDriver
- [ ] `ChangelogRepository` 接口 + MarkdownDriver
- [ ] `VcsPort` 接口 + GitDriver

## E. Policy Engine

- [ ] WritePolicy（写入前）
- [ ] GraphPolicy（图谱连通性）
- [ ] ReleasePolicy（发布前）
- [ ] FailLevel（none/error/warn）配置化
- [ ] 将策略配置接入 `.loomrc.json`

## F. Event Log

- [ ] 增加 `events.jsonl`（append-only）
- [ ] 定义标准事件 schema
- [ ] 在 ingest/probe/doctor/changelog 写入事件
- [ ] 提供 `loom events` 查询命令

## G. Testing & Regression

- [x] 引入 Vitest + 覆盖率阈值
- [x] 增加回归日志 `.test-logs/latest.log`
- [ ] 为新增 usecases 增加契约测试（输入/输出稳定）
- [ ] 为 adapters 增加一致性测试（CLI 与 MCP 结果同构）
- [ ] 增加事件流回放测试

## H. Metrics Feedback Loop

- [ ] 定义 `metrics.snapshot.v1` 数据结构（作为统一事实源）
- [ ] 增加 `loom metrics snapshot`（生成周度快照 JSON）
- [ ] 增加 `loom metrics report`（生成周报草稿）
- [ ] 增加 `docs/METRIC_EVENT_MAPPING.md`（事件到指标映射）
- [ ] 将 doctor/probe/changelog 输出接入 snapshot 聚合
- [ ] 在 PR 模板中新增“影响指标 + 验证数据”字段

## I. Definition of Done

每个架构项完成需满足：

- [ ] `npm run build`
- [ ] `npm run lint`
- [ ] `npm run test:coverage`
- [ ] `npm run test:regression`
- [ ] 更新 `README` + `CHANGELOG` + 本计划状态
- [ ] 在 PR 说明中标注本次变更影响的指标（参考 `docs/METRICS.md`）
