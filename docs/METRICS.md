# Metrics

用于定义 Loom 的北极星指标与周度追踪规则，避免“功能增加但价值不明”。

## 01. 北极星指标

## M1 沉淀率（Capture Rate）

- 定义：有价值对话中，被沉淀为 Loom 记忆条目的比例。
- 公式：`沉淀率 = 被写入记忆的有效对话数 / 有价值对话总数`
- 目标（阶段性）：
  - Phase A：>= 40%
  - Phase B：>= 60%
  - Phase C：>= 75%

### M2 命中率（Retrieval Hit Rate）

- 定义：回答前通过 Loom 检索到正确历史上下文的比例。
- 公式：`命中率 = 检索命中且被实际引用的回答数 / 需要历史上下文的回答数`
- 目标（阶段性）：
  - Phase A：>= 50%
  - Phase B：>= 70%
  - Phase C：>= 85%

### M3 治理通过率（Governance Pass Rate）

- 定义：在 `doctor` 门禁下通过质量检查的比例。
- 公式：`治理通过率 = doctor 通过次数 / doctor 总执行次数`
- 目标（阶段性）：
  - Phase A：>= 70%
  - Phase B：>= 85%
  - Phase C：>= 95%

## 02. 辅助指标

- Dangling Link 数（越低越好）
- Isolated Node 数（越低越好）
- 每周新增核心概念（core-tagged concepts）
- 每周 `probe` 会话数与完成率

## 03. 数据采集建议

短期先采用轻量方式（无需额外服务）：

1. `npm run test:regression` 日志（`.test-logs/latest.log`）
2. `node dist/cli.js doctor --json` 的结构化输出
3. `CHANGELOG.md` 每日核心变化
4. 后续事件流（`events.jsonl`）上线后统一汇总

## 04. 周报模板（建议）

每周固定写入（可放在 PR 描述或 docs）：

```text
Week: 2026-Wxx

M1 Capture Rate:
- value: xx%
- change vs last week: +x%
- note:

M2 Retrieval Hit Rate:
- value: xx%
- change vs last week: +x%
- note:

M3 Governance Pass Rate:
- value: xx%
- change vs last week: +x%
- note:

Top Risks:
1) ...
2) ...

Next Week Focus:
1) ...
2) ...
```

## 05. 指标解释原则

- 指标是“方向盘”，不是“考核 KPI”。
- 优先看趋势，不只看单点绝对值。
- 当指标冲突时，优先级建议：治理通过率 > 命中率 > 沉淀率。
