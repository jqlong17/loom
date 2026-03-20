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
- 新增 `loom_changelog` 与 `CHANGELOG.md` 自动更新流程，目的是对外持续公开每日核心能力变化并降低维护成本。
- 新增 `loom-cli` 命令行适配层，目的是让不支持 MCP 的客户端（如 OpenClaw）也能调用 Loom 核心能力。
- 在 README 增加 AI-First 自动安装协议，目的是让不同 AI 在拿到仓库链接后遵循一致的“先说明、先授权、再安装”流程。
- 新增 Project-First 安装作用域策略与 `INSTALL_POLICY.json`，目的是让 AI 在“全局或项目安装”上按统一规则决策并减少反复确认。
- 新增 `loom_index` 必读记忆策略（固定最近 5 条 + `core` 概念 + 截断摘要），目的是在控制上下文长度的前提下提升短期记忆稳定性与回答一致性。
- 新增 `loom_weave` 的 `is_core` 参数与自动 `core` 识别，并同步更新中英文 README 与规则文档，目的是降低基础概念标注成本并确保多客户端读取行为一致。

## 2026-03-19

- 新增 `loom_probe_start` / `loom_probe_commit` 状态机与 `probe_session` 持久化，并保留 `loom_probe` 兼容入口，目的是让“主动提问 -> 用户回答 -> 记忆沉淀”成为可追踪、可恢复的稳定流程。
- 新增 Memory Lint（写入前校验与统一错误提示格式）并接入 `loom_weave` 与 probe 回写链路，目的是在低成本下提升记忆内容质量与后续检索可用性。
- 新增 `.loom/schema/technical.md` 与 `.loom/schema/business.md` 初始化骨架，并在 `loom_weave` 支持 `domain/links` 字段，目的是为技术与业务记忆建立统一的宏观图谱主干。
- 增强 `loom_reflect` 图谱体检（`dangling_link` / `isolated_node`）并在 lint 中提示缺失 `domain/links`，目的是提前发现知识断链与孤岛，降低记忆系统语义漂移风险。
- 新增 `loom-cli ingest` 与 `loom-cli doctor`（CLI-first 自动化路径），目的是将“是否主动调用”从模型行为问题转化为可脚本、可门禁、可集成 CI 的工程流程。
- 重构为 `CLI-first + MCP-adapter` 架构（新增 core 服务层并让 CLI/MCP 共用同一流程），目的是降低双入口逻辑分叉带来的维护成本并提升回归一致性。
- 引入 Vitest 回归测试（含覆盖率阈值与 `.test-logs/latest.log` 复现日志），目的是在功能迭代时提供可验证、可复现的质量基线。
- 新增 `contracts + usecases` 抽象层并将 CLI/MCP 接入统一用例返回协议，目的是让系统能力与入口解耦，便于后续扩展 HTTP/Daemon 等新适配层。
- 新增 `docs/METRICS.md` 并将指标体系接入 roadmap/plan/readme，目的是让下一步架构演进具备统一的北极星衡量标准与周度复盘机制。
- 在 roadmap 与 implementation plan 中新增“数据反馈闭环”执行主线（snapshot/report/event-mapping/PR 指标影响），目的是将量化指标从“观测”升级为“驱动决策”的工程机制。
- 完成 `loom-memory@0.1.0` npm 首发并验证全局/本地安装路径，同时在 README 增加 npm 最短安装说明，目的是让 OpenCode 等用户可以一键安装并快速接入 Loom。
- 新增 `loom_events` / `loom_metrics_report` 与事件回放测试，并补齐 `metrics.snapshot.v1` 的 M1/M2/M3 映射，目的是把“事件采集”升级为“可复盘、可决策”的数据闭环。
- 新增 GitHub Actions `release-npm.yml` 与 Trusted Publishing 发布流程（tag 触发），目的是让 npm 发布摆脱手工 OTP 流程并实现稳定自动化发版。

## 2026-03-22

- 新增 **MCP 读路径有界化**：`.loomrc.json` 中 `mcpReadLimits`（`listMaxEntries` / `traceDefaultLimit` / `indexFullMaxChars`）及环境变量 `LOOM_MCP_*` 覆盖，目的是在默认参数下控制单次 tool 返回体积并降低上下文污染与 Token 成本。
- **`loom_list`**：按 `updated` 新近优先展示，默认条数上限（截断时提示总数与本次条数），目的是大盘知识库下仍能安全做条目概览。
- **`loom_trace`**：`layered` 与 **legacy** 在未传 `limit` 时共用配置化默认上界；**`loom-cli trace`** 与 MCP 共用同一解析逻辑，目的是避免 legacy 全量命中与双入口行为分叉。
- **`loom_index`**：对「### Full Index」正文按字符上限截断并附下一步指引（`loom_read` / `loom_trace`），目的是在渐进披露策略下压缩索引大块返回。
- 补充执行计划与提示词文档（`docs/执行计划/02-mcp-context-footprint-and-bounded-reads.md`、`PROMPTS.md` 中宿主 vs Loom 责任划界）及 `prompts/zh/v1/tools` 说明，目的是让默认上界可被查阅、可被运营侧理解。
- 新增 `tests/mcp-bounded-reads.test.ts` 覆盖列表截断、legacy 默认 cap、配置 env 等，目的是让有界策略具备可回归基线。
