---
created: 2026-03-18T14:53:04.994Z
updated: 2026-03-18T14:53:04.994Z
tags: decision, storage, markdown, git
category: decisions
status: active
---

# Why Markdown Plus Git As Storage

## 背景

需要选择知识库的存储介质。考虑过数据库、向量库、JSON 等方案。

## 决策

使用本地 Markdown 文件 + Git 版本控制作为唯一存储层。

## 理由

1. **人类可读**：MD 文件可以直接用编辑器打开阅读和修改
2. **机器友好**：结构化的 frontmatter（YAML）便于程序解析
3. **天然适配 Git**：每次知识更新都是一个 commit，可追溯演进历史
4. **团队协作**：通过 Git push/pull 实现多人共享记忆，通过 PR 审阅知识变更
5. **零依赖**：不需要数据库服务，不需要云存储，完全本地化
6. **可移植**：换任何编辑器或 AI 工具，知识都还在

## 后果

- 全文检索目前是简单的关键词匹配，未来可升级为向量检索
- 大规模知识库（数万篇）可能需要索引优化
- 并发冲突依赖 Git merge，复杂冲突可能需要 AI 介入解决
