---
created: 2026-03-18T14:53:24.152Z
updated: 2026-03-18T14:53:24.152Z
tags: architecture, design, modules, core
category: concepts
status: active
---

# Three-Layer Architecture

## 概述

Loom 采用三层架构设计，各层职责清晰。

## A. MCP Server 层（The Bridge）

- 实现 MCP 协议的 tools 接口
- 负责与 Cursor / VS Code 等宿主通信
- 入口文件：`src/index.ts`
- 当前工具：loom_init, loom_weave, loom_trace, loom_read, loom_list, loom_sync, loom_log, loom_reflect

## B. Loom Logic 层（The Weaver）

- **Weaver（编织者）**：处理 MD 文件的创建、增量更新和 frontmatter 解析
- **Tracer（追溯者）**：读取 MD 目录，根据关键词为 AI 提供上下文检索
- **Reflector（反思者）**：扫描知识库，检测冲突、过期、缺标签、可合并项
- 核心文件：`src/weaver.ts`

## C. Git Sync 层（The Syncer）

- 封装 simple-git，处理自动 add, commit, pull, push
- 处理基础冲突逻辑
- 核心文件：`src/git-manager.ts`

## 配置层

- `.loomrc.json` 控制行为（autoCommit, autoPush, branch 等）
- 核心文件：`src/config.ts`
