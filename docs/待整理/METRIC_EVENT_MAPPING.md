# METRIC_EVENT_MAPPING

本文件定义 `events.jsonl` 事件到指标的最小映射规则，用于 `metrics snapshot` 计算与后续扩展。

## 事件流文件

- 路径：`.loom/events.jsonl`
- 格式：JSON Lines（每行一个事件）
- 基本字段：
  - `type`: 事件类型
  - `ts`: ISO 时间戳
  - `payload`: 事件载荷

## 事件类型与指标映射

| 事件 type | 触发点 | 主要字段 | 指标用途 |
| --- | --- | --- | --- |
| `knowledge.ingested` | `ingest/weave` 成功后 | `category`, `filePath`, `isUpdate` | 统计沉淀速度、类别分布 |
| `knowledge.traced` | 执行 `trace` 检索后 | `query`, `count`, `category`, `tags` | 计算检索命中代理指标（M2） |
| `index.rebuilt` | 执行 `rebuildIndex` 后 | `totalEntries`, `categories`, `indexPath` | 统计索引更新频率、观测索引新鲜度 |
| `index.query.executed` | 执行分层/回退检索后 | `query`, `mode`, `count`, `category`, `tags`, `contextChars`, `retrievedChars`, `contextTokens`, `tokenROI` | 统计索引查询样本量与模式分布；**M4 Token ROI** 聚合用 `sum(retrievedChars)/sum(contextChars)` |
| `probe.started` | 创建主动提问 session | `sessionId`, `questionCount` | 统计主动澄清触发率 |
| `probe.committed` | 回答提交并写入记忆后 | `sessionId`, `matched`, `unmatched` | 计算提问闭环率、回答匹配质量 |
| `doctor.executed` | 运行治理检查后 | `shouldFail`, `summary` | 计算治理通过率（M3） |
| `changelog.updated` | 更新公开变更日志后 | `date`, `added`, `totalForDate` | 统计对外可见变更输出频率 |
| `metrics.snapshot.generated` | 生成快照后 | `filePath`, `governancePassRate` | 指标快照审计与追踪 |

## 当前快照规则（MVP）

- `captureRate`（M1）：
  - 基于事件流近似计算：`knowledge.ingested / (knowledge.ingested + probe.started)`。
  - 说明：作为“对话到沉淀”代理值，后续可替换为更精确口径。
- `retrievalHitRate`（M2）：
  - 基于事件流近似计算：`knowledge.traced(count>0) / knowledge.traced(total)`。
  - 说明：以 trace 命中作为“检索命中且被引用”的早期代理值。
- `tokenROI`（M4）：
  - 基于 `index.query.executed` 事件：对窗口内事件求 `sum(retrievedChars) / max(1, sum(contextChars))`。
  - 单次事件 payload 含 `contextChars`（本次检索消耗的上下文字符数）、`retrievedChars`（返回 snippet 总长）、`contextTokens`（字符估 token）、`tokenROI`（单次比值）。
- 索引闭环辅助观测：
  - 通过 `index.rebuilt` 观测索引更新频率，避免“内容更新但索引陈旧”。
  - 通过 `index.query.executed` 观测检索样本量与 `mode`（`layered/legacy`）分布。
- `governancePassRate`：
  - 优先使用历史 `doctor.executed` 事件中 `shouldFail=false` 的比例。
  - 若历史为空，则回退到本次 doctor 结果（通过=1，失败=0）。
- `probeCompletionRate`：
  - 以 `.loom/probes/*.json` 中 `status=committed` / `total` 计算。
- `danglingLinkCount` 与 `isolatedNodeCount`：
  - 来自本次 doctor 结果中的对应 issue 类型计数。

## 兼容性与演进

- 允许新增事件类型；新增时应补充到本文件。
- 已有事件字段仅追加不删除，避免破坏旧快照解析。
- 当指标定义变更时，需同步更新：
  - `docs/METRICS.md`
  - `docs/IMPLEMENTATION_PLAN.md`
  - 本映射文档
