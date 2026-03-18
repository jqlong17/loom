---
created: 2026-03-18T15:20:06.083Z
updated: 2026-03-18T15:20:06.083Z
tags: memory, behavior, operations, faq
category: threads
status: active
---

# Why Loom Memory Did Not Update Automatically

## 说明

用户观察到近期代码升级很多，但 `.loom/` 中没有新条目，属于预期行为。

## 原因

1. Loom 只有在显式调用工具（如 `loom_weave`、`loom_deprecate`）时才会写入知识库。
2. 我们之前做的很多改动是直接改源码和 README，不会自动触发知识沉淀。
3. MCP 服务重启或工具新增（如 `loom_reflect`、`loom_upgrade`）本身也不会自动写入 `.loom/`。

## 约定建议

- 每次完成一轮功能升级后，主动调用一次 `loom_weave` 记录升级摘要。
- 重大变更时，新增一条 `decisions/`（为什么这么改）。
- 版本发布前执行 `loom_reflect` 检查一致性。
