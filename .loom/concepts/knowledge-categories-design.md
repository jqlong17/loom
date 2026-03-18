---
created: 2026-03-18T14:53:32.763Z
updated: 2026-03-18T14:53:32.763Z
tags: architecture, categories, knowledge-model
category: concepts
status: active
---

# Knowledge Categories Design

## 概述

Loom 将知识分为三类，存放在 `.loom/` 下对应目录中。

## concepts/（概念）

系统架构、业务规则、术语、模块说明。

适用场景：
- 记录系统模块的职责和边界
- 沉淀业务术语定义
- 描述数据流和接口契约

## decisions/（决策）

架构决策记录（ADR），重点记录「为什么」。

适用场景：
- 为什么选择某个技术栈
- 为什么采用某种设计模式
- 权衡取舍和被否决的替代方案

## threads/（线程）

对话摘要、讨论纪要、会议记录。

适用场景：
- 一次功能讨论的关键结论
- 排查问题过程的摘要
- 临时知识，后续可提炼到 concepts 或 decisions

## 知识流转原则

`threads/` 是入口（原始对话沉淀）→ 关键结论提炼到 `concepts/` 或 `decisions/` → `threads/` 中的临时内容可在体检时标记为 stale 或 deprecated。
