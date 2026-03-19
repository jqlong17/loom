# Implementation Plan

用于推进 Loom 的持续演进。本文按“当前状态 + 优先级”组织，避免任务散落。

## 0) 当前状态快照（2026-03-19）

### 已完成能力（Done）

- [x] CLI-first + MCP-adapter 双入口复用核心流程
- [x] UseCases：`IngestKnowledge`、`RunDoctor`、`StartProbeSession`、`CommitProbeSession`、`UpdateChangelog`
- [x] 统一返回协议：`ok / data / issues / artifacts / gate`
- [x] 事件流：`.loom/events.jsonl`（ingest/probe/doctor/changelog/metrics）
- [x] 指标快照：`loom metrics-snapshot` + `metrics.snapshot.v1`
- [x] 文档：`docs/METRIC_EVENT_MAPPING.md`
- [x] 测试：usecase 契约测试 + adapter 同构测试（CLI/MCP）

### 已知缺口（Open Gaps）

- [x] `loom events` 查询命令（事件可读性不足）
- [x] `loom metrics report` 周报草稿命令（决策层可读输出缺失）
- [x] 事件流回放测试（缺少时序回归保障）
- [x] PR 模板加入“指标影响 + 验证数据”字段

## 1) P0（最高优先级）：发布与分发（面向 OpenCode 用户）

目标：让用户通过 npm 一步安装并可直接配置到 OpenCode/Cursor/CLI。

- [x] npm 首发（`loom-memory@0.1.0`）
- [x] 安装路径验证（全局安装 + 本地安装）
- [x] README 增加“npm 安装与验证”最短路径
- [x] 发布后补充 CHANGELOG 当日条目（含“目的是”）

## 2) P1：数据反馈闭环补全

目标：让“有事件”变成“可读结论 + 可执行决策”。

- [x] `loom events`：支持 `--type --since --limit --json`
- [x] `loom metrics report`：按周生成文字周报草稿（引用 snapshot）
- [x] snapshot 与 `docs/METRICS.md` 的 M1/M2/M3 字段一一映射
- [x] PR 模板新增指标影响字段，并在 CI 中做最小校验（warn 即可）

## 3) P2：治理与架构抽象

目标：把规则从“代码里的 if”升级为“策略化能力”。

### 3.1 Domain Model

- [ ] `KnowledgeEntry` 领域模型（状态、链接、领域、版本）
- [ ] `KnowledgeGraph` 领域模型（nodes/edges/query）
- [ ] `ProbeSession` 状态机模型（open -> committed）
- [ ] `QualityIssue` 模型与错误码统一
- [ ] frontmatter 改为“模型 <-> 序列化”双向转换

### 3.2 Ports & Drivers

- [ ] `KnowledgeRepository` + MarkdownDriver
- [ ] `SessionRepository` + JsonDriver
- [ ] `IndexRepository` + MarkdownDriver
- [ ] `ChangelogRepository` + MarkdownDriver
- [ ] `VcsPort` + GitDriver

### 3.3 Policy Engine

- [ ] `WritePolicy`
- [ ] `GraphPolicy`
- [ ] `ReleasePolicy`
- [ ] `FailLevel`（none/error/warn）配置化
- [ ] 将策略配置接入 `.loomrc.json`

## 4) P3：多入口扩展（在核心稳定后）

目标：扩展入口但不复制业务逻辑。

- [ ] 提炼统一 `ApplicationService` 组装入口（Context + Ports）
- [ ] HTTP adapter（只做参数映射）
- [ ] Daemon adapter（文件监听 + 自动触发策略）

## 5) Definition of Done（每项任务完成前）

- [ ] `npm run build`
- [ ] `npm run lint`
- [ ] `npm run test:coverage`
- [ ] `npm run test:regression`
- [ ] 更新 `README` + `CHANGELOG` + 本计划状态
- [ ] PR 说明中标注指标影响（参考 `docs/METRICS.md`）
