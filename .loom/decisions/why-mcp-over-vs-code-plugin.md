---
created: 2026-03-18T14:52:56.309Z
updated: 2026-03-18T14:52:56.309Z
tags: decision, mcp, architecture, vs-code
category: decisions
status: active
---

# Why MCP Over VS Code Plugin

## 背景

最初考虑了两种实现路径：VS Code 原生插件 vs MCP Server。

## 决策

选择 MCP（Model Context Protocol）作为核心协议。

## 对比分析

| 维度 | VS Code 插件 | MCP Server |
|------|-------------|------------|
| 模型调用 | 需调用 vscode.lm API，受限于审核和 API 暴露程度 | 直接利用宿主能力，宿主把模型能力「借」给工具用 |
| API Key | 复杂文档分析可能需要额外 API | 完全不需要，AI 是宿主的 |
| 通用性 | 只能在 VS Code 用 | 一次编写，Cursor / Claude Desktop / VS Code 都能用 |
| 开发成本 | 较高，需处理 UI、生命周期等 | 极低，只需写几个 JSON-RPC 接口函数 |

## 结论

MCP 的「白嫖」逻辑：Loom 不负责运行模型，只负责读写 Markdown。宿主（Host）拥有 AI 大脑和 Token，Loom 作为 MCP Server 运行在本地，全程使用宿主的 AI 配额。
