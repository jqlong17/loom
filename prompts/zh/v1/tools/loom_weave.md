# 工具说明

将一条知识写入 Loom。当对话中出现架构、业务逻辑、技术决策或讨论纪要等有价值信息时使用。

在 Cursor 等环境里若同时存在「写文件」类能力与 Loom MCP：**向 `.loom/concepts`、`decisions`、`threads` 落盘时请优先调用本工具**，而不是用 Write/Apply Patch 直接改 `.loom` 下的 md，否则不会经过校验、索引重建与 Git 提交流程。`title` 会生成正文中的 `#` 一级标题；`content` 建议从 `##` 小节开始写。

## 参数：category

知识分类：`concepts` 表示架构/模块/业务逻辑/术语；`decisions` 表示 ADR 式「为何选某方案」；`threads` 表示对话摘要与讨论笔记。

## 参数：title

清晰、可检索的标题（例如「支付流程」「为何选用 PostgreSQL」）。

## 参数：content

Markdown 正文，建议结构化、写清背景与结论。

## 参数：tags

可选标签列表，用于分类与检索（如 backend、database、auth）。

## 参数：links

可选关联条目路径（如 `concepts/user-auth`、`decisions/why-mcp-over-vs-code-plugin`）。

## 参数：domain

可选宏观领域，用于图谱骨架（如 architecture、product、operations）。

## 参数：is_core

若为 `true`，强制为条目增加 `core` 标签，作为必读基础概念。

## 参数：mode

写入模式：`replace` 整篇覆盖（默认）；`append` 在文末追加并带日期分隔；`section` 按 `##` 标题替换或新增小节。
