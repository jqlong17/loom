---
created: 2026-03-18T14:53:57.033Z
updated: 2026-03-18T14:53:57.033Z
tags: founding, history, milestone, conversation
category: threads
status: active
---

# Founding Conversation Summary

## 概述

这是 Loom 项目的创始对话，记录了从构想到命名到技术选型的完整思路链。

## 对话时间线

### 第一轮：核心构想

用户提出「伴随式理解」的概念：随着人和 AI 的交流，系统逐渐理解整个系统，使用 MD 文件记录来实现。

### 第二轮：命名

从多个候选名（Memosh, DocSynapse, Rootbase, Archon, CogniFile 等）中选定 **Loom**，取「织布机」之意。

### 第三轮：技术路线

确定使用 MCP（而非 VS Code 插件），核心理由是可以「借用」宿主 AI 能力、零 API Key 成本、跨编辑器通用。

### 第四轮：Git 集成

确认需要 Git 自动关联功能，并确定不需要云服务器——全本地化运行，Git 负责多端同步。

### 第五轮：GitHub 协作

讨论了通过 Git push/pull 实现团队共享记忆、PR 审阅知识变更、冲突解决策略。

### 第六轮：项目蓝图

整理了从愿景、使命、价值到技术架构、模块拆解、阶段目标的完整蓝图，形成 Master Prompt。

## 关键决策

1. 选择 MCP 而非 VS Code 插件
2. 使用 Markdown + Git 作为唯一存储层
3. 命名为 Loom
4. 全本地化，不依赖云服务器
5. 三类知识分类：concepts / decisions / threads

## 后续里程碑

- Phase 1 (MVP): 基本 MCP 服务 + weave/trace
- Phase 2: Git 联动 + auto-commit + sync
- Phase 3: 智能合并 + ADR 模板 + 自动索引
- Phase 4 (已实现): loom_reflect 自检能力
