# Loom 使用说明（系统级）

你正在使用名为 **Loom** 的知识管理系统。请遵循以下准则。

## 何时写入（loom_weave）

在对话中出现以下情况时，应主动调用 `loom_weave`：

- 系统架构或模块边界被定义或澄清
- 做出技术决策（并记录原因）
- 业务逻辑或领域规则被说明
- 识别出非显而易见的约束或权衡
- 定位到 Bug 根因并确定修复思路
- 功能设计在多轮讨论后定稿

分类：

- `concepts`：架构、模块、业务逻辑、术语
- `decisions`：ADR 风格，记录「为何选 X 而非 Y」
- `threads`：对话摘要、会议纪要、讨论纪要

写入模式 `mode`：

- `replace`：新建或整篇重写（默认）
- `append`：在既有条目下追加，不丢失历史
- `section`：更新或新增指定的 `##` 小节

### 写入渠道（MCP 可用时，重要）

在**已连接 Loom MCP** 的会话里，要把结论写进项目知识库（`.loom/` 下的 concepts / decisions / threads）时：

- **应使用 `loom_weave`**（或场景匹配的 `loom_ingest`、`loom_probe_commit` 等），这样会走内容校验、重建 `index.md`、按配置 Git 提交、并写入事件流，与「人工维护出高质量 md」目标一致。
- **不要**主要依赖宿主里的「写文件 / Apply Patch / 直接编辑」去改 `.loom/**/*.md`：表面结果相似，但容易**绕过**索引与提交与观测，和通过 MCP 写入不等价。
- **例外**：用户明确要求直接改某个文件、当前会话**未连接** Loom MCP、或人类自己在编辑器里手改。

`loom_weave` 的 `title` 会生成文件内一级标题；`content` 用 `##` 起头即可（勿在 `content` 里再写与 `title` 重复的一级标题）。

## 何时读取（loom_trace / loom_read）

- 先调用 `loom_index` 获取全局地图与必读集合
- 必读集合视为强相关上下文：
  - 最近记忆：最新 5 条（勿跳过 threads）
  - 核心概念：带 `core` 标签的 concepts
- 必读摘要有意截断；仅在必要时用 `loom_read` 展开全文
- 回答与系统相关的问题前，先检查 Loom 是否已有知识
- 提出架构建议前，先检索既有决策，避免矛盾
- 用户问「关于 X 我们知道什么」时，优先查 Loom
- 渐进披露顺序：
  1. `loom_index`：全局地图 + 必读集合
  2. `loom_trace`：候选条目
  3. `loom_read`：仅读高相关条目的全文
  4. 摘要不足时再读完整文件

## 何时提问（loom_probe）

- 需求模糊或范围不清
- 缺少验收标准
- 当前请求可能与既有 concepts/decisions 冲突
- 推荐状态机：
  1. `loom_probe_start` 创建会话并生成问题
  2. 在聊天中询问用户
  3. `loom_probe_commit` 带上 `session_id` 与 `answers` 持久化问答
- `loom_probe` 仍可作为兼容封装使用

## 何时反思（loom_reflect）

- 用户要求做知识库健康检查
- 多次 `weave` 之后，可定期检查冲突与陈旧内容

## 何时废弃（loom_deprecate）

- 新知识明确替代旧条目
- 先前决策被推翻

## 通用规则

- 始终使用有意义的 `tags` 以便检索
- 基础概念请加 `core` 标签（或设 `is_core=true`）
- 写入 `concepts` / `decisions` 时尽量补充 `domain` 与 `links`，利于图谱
- 每条目聚焦单一主题
- 优先使用带 `##` 的结构化 Markdown
- `threads`：写要点摘要，勿堆砌原始对话全文
