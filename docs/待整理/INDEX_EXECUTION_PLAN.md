# Loom 索引架构执行计划（Tree 主骨架 + Graph 辅助）

本文给出可直接落地的索引优化方案，目标是在保持 Markdown 可读可管的前提下，显著降低检索 token 成本，并提升命中质量与可解释性。

## 1. 目标与边界

### 1.1 目标

- 以 Markdown 文件系统作为事实源（Source of Truth），不引入黑盒数据库。
- 构建三级树状索引（L0/L1/L2），实现按需加载，避免全量读全文。
- 融入图关系（links/tags/domain）作为辅助重排与治理信号。
- 保持 CLI 与 MCP 输出一致，兼容现有 usecase 与事件体系。

### 1.2 非目标

- 不在本阶段引入向量数据库或外部检索服务。
- 不改变知识写入格式（仍为 `.loom/**/*.md` + frontmatter）。
- 不在本阶段做跨仓库联邦检索。

## 2. 目标架构

## 2.1 Tree：三级索引（主骨架）

- **L0（Catalog）**：全局目录级索引，存放最小可判定信息。
  - 字段：`id/slug`、`title`、`category`、`tags`、`domain`、`updated`、`status`
  - 用途：快速候选召回，控制首轮 token。
- **L1（Digest）**：条目摘要级索引，存放可解释语义摘要与局部结构。
  - 字段：`summary`、`key_points[]`、`related_links[]`、`quality_flags[]`
  - 用途：候选重排与命中确认。
- **L2（Source）**：Markdown 原文与章节信息。
  - 字段：`file_path`、`sections[]`、`content`
  - 用途：最终答案生成时按需加载。

建议加载顺序：`L0 -> L1(topK) -> L2(topN)`，默认 `K=20`、`N=3`。

## 2.2 Graph：关系索引（辅助层）

关系来源：

- frontmatter `links`
- `tags` 共现
- `domain` 共域
- 时间邻近（`updated` 窗口）

关系作用：

- 在 L0 召回后进行候选扩展（1-hop 邻居）
- 作为重排特征（中心性、入度、是否孤立）
- 作为治理信号（dangling link、isolated node、过密簇）

## 3. 数据产物与文件布局

建议在 `.loom/index/` 生成只读索引产物（可重建）：

- `.loom/index/catalog.v1.json`（L0）
- `.loom/index/digest.v1.json`（L1）
- `.loom/index/graph.v1.json`（Graph）
- `.loom/index/build-meta.v1.json`（构建时间、版本、统计）

说明：索引文件是缓存层，真实数据仍来自 `.loom/**/*.md`。

## 4. 查询流程（执行时序）

1. Query 解析（关键词、category、tags、时间范围）
2. L0 召回（title/tags/category/domain/updated）
3. Graph 扩展（可选，最多 1-hop）
4. L1 重排（summary/key_points + 关系特征）
5. L2 按需读取 topN 原文片段
6. 返回结果并记录事件（可观测）

## 5. 分阶段执行计划（可直接排期）

## Phase A：索引骨架（1 周）

- [ ] 定义索引契约：`CatalogItem`、`DigestItem`、`GraphSnapshot`
- [ ] 新增索引构建器：从 Markdown 生成 `.loom/index/*.json`
- [ ] `loom index rebuild` 改为产出 L0/L1/Graph 三类文件
- [ ] 增量构建策略：单文件变更时局部更新（可先全量后增量）
- [ ] 回归测试：索引重建幂等性（同输入同输出）

验收标准：

- 重建后索引完整率 100%
- 索引文件可在不读全文情况下完成候选召回

## Phase B：查询改造（1 周）

- [ ] `trace` 改为 `L0 -> L1 -> L2` 分层读取
- [ ] 引入 graph 辅助重排（入度、连通性、domain proximity）
- [ ] 输出解释字段：`why_matched`（命中依据）
- [ ] CLI/MCP 同构测试扩展到 trace 结果一致性

验收标准：

- 同等数据集下，平均读取全文文件数下降 >= 60%
- Top3 命中率不低于现状

## Phase C：治理与观测（1 周）

- [ ] doctor 接入图结构体检（孤立、悬空、弱连接）
- [ ] events 增补索引事件：`index.rebuilt`、`index.query.executed`
- [ ] metrics snapshot 增补索引指标（见第 6 节）
- [ ] 出具周报模板，支持“索引质量趋势”

验收标准：

- 指标可追踪一周趋势
- 异常可定位到具体文件/关系

## 6. 指标设计（新增）

- `indexRecallAt20`：L0+Graph 召回覆盖率
- `indexPrecisionAt3`：L1 重排后 top3 精度
- `avgL2ReadsPerQuery`：每次查询平均读取全文数量
- `graphConnectivity`：活跃节点连通率
- `danglingLinkRate`：悬空链接占比

## 7. 风险与回滚

主要风险：

- 摘要质量不稳定导致 L1 重排偏差
- 图扩展过度导致噪声上升
- 增量构建复杂度提升

回滚策略：

- 保留旧 trace 路径开关：`--traceMode legacy|layered`
- 索引异常时自动降级到 legacy（全量扫描）
- 索引文件损坏可直接重建，不影响 Markdown 原始数据

## 8. 与现有架构的映射

- UseCase：新增/扩展 `Index` 相关 usecase，不改变 `Ingest/Doctor/Probe` 契约。
- Domain：为 `KnowledgeGraph` 建立明确模型，作为 `reflect/doctor` 的统一输入。
- Ports & Drivers：补齐 `IndexRepository`，索引构建与读取走同一端口。
- Data Product：索引产物进入 `.loom/index/`，与 `events/snapshot` 形成闭环。

## 9. 立即可执行的第一步（本周）

- [ ] 先落地 L0 `catalog.v1.json` + 查询改造（仅 title/tags/category 召回）
- [ ] 再补 L1 `digest.v1.json`（summary/key_points）
- [ ] 最后接入 Graph 辅助重排（先 links，再 tag/domain）

按此顺序推进，能在不大改现有接口的前提下，快速把“全量扫文件”升级为“分层按需读取”。
