# 指标测试集构建指南

用于 M2（命中率）、M4（Token ROI）等指标的可重复评估：如何定义测试集、准备种子数据、运行并解读结果。

## 1. 目的

- **可重复**：同一测试集在不同版本/配置下跑，得到可比的 M2、M4。
- **体现关联性与复杂性**：多词 query、标签/领域过滤、图扩展、分层索引，避免 trivial 单关键词。
- **支撑北极星**：为「记忆系统是否好用」提供量化依据。

## 2. 测试集格式

推荐用 JSON 描述「查询 → 期望命中」：

```json
{
  "name": "loom-eval-v1",
  "seed": "default",
  "cases": [
    {
      "id": "multi-word-concept",
      "query": "订单 状态机 生命周期",
      "expectedTitles": ["订单领域模型"],
      "category": "concepts",
      "tags": ["orders", "domain"],
      "minResults": 1
    },
    {
      "id": "tag-filter",
      "query": "支付",
      "expectedTitles": ["支付网关架构", "payment provider choice"],
      "tags": ["payments"],
      "minResults": 1
    },
    {
      "id": "graph-expansion",
      "query": "gateway 渠道",
      "expectedTitles": ["支付网关架构"],
      "minResults": 1
    }
  ]
}
```

- **query**：与真实对话一致的检索词（多词、带空格）。
- **expectedTitles**：至少应命中其中一篇的 title（用于算召回/命中）。
- **category / tags**：可选，用于测「带过滤的 trace」。
- **minResults**：该 query 至少返回条数（可选，用于简单健壮性）。

## 3. 种子数据（关联性 + 复杂性）

为让 M4 Token ROI 和 M2 有意义，种子数据建议：

| 维度       | 做法 |
| ---------- | ---- |
| 关联性     | 多条记忆共享 `tags`、`domain`，或通过 `links` 成图。 |
| 多词 query | 标题/正文里包含多词组合，避免单关键词一搜就中。 |
| 复杂性     | 至少 2 个 category、有 link 的条目 ≥2、同一 domain 下多条。 |

示例种子（与 `tests/index-layered.test.ts` 对齐）：

- **concepts**：`订单领域模型`（tags: orders, domain；links 到 decisions）
- **decisions**：`payment provider choice`（tags: payments；与 concepts 同 domain 或 link）
- **threads**：`order incident review`（tags: orders, incident）

这样 query「订单 状态机」「支付 gateway」会同时用到 L1 digest、图扩展和 L2 全文，能区分 layered 与 legacy 的 contextChars/Token ROI。

## 4. 如何运行

### 方式 A：用脚本跑（推荐）

```bash
# 项目根目录执行

# 使用当前 .loom 的已有数据跑测试集（不写种子）
npx tsx scripts/run-eval.ts --set .loom/eval/test-set.json

# 在临时目录播种并跑（不污染现有 .loom）
npx tsx scripts/run-eval.ts --seed --loom /tmp/loom-eval --set .loom/eval/test-set.json
```

默认测试集：`.loom/eval/test-set.json`（见仓库内该文件及 `docs/TEST_SET.md`）。

脚本会：

1. 若传 `--seed`，在指定 loom 下写入默认种子数据（weave 4 条 + rebuildIndex）。
2. 对测试集里每条 case 执行 `trace(loomRoot, query, { category, tags, limit })`（layered 模式）。
3. 检查每条 case：返回结果中是否包含 `expectedTitles` 中至少一个。
4. 汇总：命中条数 / 总 case 数 → 作为 M2 代理；本轮产生的 `index.query.executed` 的 contextChars/retrievedChars 求和 → Token ROI（M4）。
5. 打印报告：Hit rate、Token ROI、失败 case 的 id 与 note。

### 方式 B：用 Vitest 跑

在 `tests/` 下增加用例，用 `makeTempDir` + 固定 seed（weave 若干条）+ 固定 test set JSON，对每条 query 调用 `trace`，断言 `expectedTitles` 有命中且（可选）tokenROI 高于某阈值。适合 CI 回归。

### 方式 C：用现有 .loom 手动跑

1. 保证当前 `.loom` 已有一定量记忆（或先按上面种子结构 weave）。
2. 执行若干次：`loom trace "query"`（可带 `--category`、`--tags`）。
3. 再跑 `loom metrics-snapshot` 与 `loom metrics-report`，看 M4 Token ROI、M2 的 evidence。

## 5. 结果解读

- **命中率（M2 代理）**：`passedCases / cases.length`。目标随阶段提升（见 METRICS.md）。
- **Token ROI（M4）**：同一测试集下 layered 的 `sum(retrievedChars)/sum(contextChars)` 应显著高于 legacy（更少上下文拿到同样召回）。若低于 0.15，可检查是否 query 过简单或种子数据过少。
- **失败 case**：记下 `id`、`query`、`expectedTitles`，用于补种子或调索引/打分。

## 6. 测试集存放建议

- 仓库内：`.loom/eval/test-set.json` 或 `docs/eval/test-set.json`（只放用例与 seed 描述，不放大体量正文）。
- 种子数据若与现有 `.loom` 一致，可只维护 test-set.json；若需隔离，用脚本在临时目录 weave 固定种子再跑 eval。
