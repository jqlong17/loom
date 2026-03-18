---
created: 2026-03-18T14:53:43.808Z
updated: 2026-03-18T14:53:43.808Z
tags: collaboration, git, sync, team
category: concepts
status: active
---

# Team Collaboration via Git

## 概述

通过 Git 远程仓库机制，不同开发者可以实时同步同一套 Markdown 知识库。

## 同步流程

1. **Pull**：开发者打开编辑器时，Loom 可 `loom_sync` 拉取最新 `.loom/` 内容
2. **Weave**：对话中 AI 调用 loom_weave 更新文档
3. **Commit & Push**：Loom 自动提交并推送到 GitHub 远程仓库
4. **Broadcast**：其他开发者的 Loom 同步获取更新

## 两种协作模式

### 模式 A：与源码同仓

`.loom/` 文件夹放在项目源码仓库根目录下，文档与代码同步版本化。

- 优点：代码改了，文档也跟着改
- 权限：复用现有 Git 权限

### 模式 B：独立知识库（Wiki 模式）

创建专门的 GitHub Repo 存放文档，Loom 独立挂载。

- 优点：跨项目共享（如公司通用规范）

## 冲突处理

- 鼓励原子化文件（一个主题一个 MD），降低碰撞概率
- Git 冲突时可借助 AI 做语义合并
- 可选 PR 审阅模式：Loom 在独立分支工作，通过 PR 合入主分支
