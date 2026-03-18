---
created: 2026-03-18T17:23:16.479Z
updated: 2026-03-18T17:23:16.479Z
tags: openclaw, install-policy, project-first, automation, release
category: threads
status: active
---

# Install Scope Policy and OpenClaw Integration Iteration

## 本轮收口摘要

本轮围绕“把 Loom 仓库链接交给不同 AI 后如何稳定安装”展开，并完成了从策略到落地的完整闭环。

## 关键决策

1. 安装作用域采用 **Project-First** 作为默认策略。
2. 只有用户明确要求“全局安装”时，才允许切换到 global。
3. 从 project 切到 global 必须二次确认，避免 AI 擅自改全局环境。

## 已落地能力

- 新增 `INSTALL_POLICY.json` 作为机器可读安装策略。
- README 中英双语同步加入 AI-First 协议与作用域决策规则。
- 新增 `loom-cli` 适配层，支持 OpenClaw 这类暂不支持 MCP 的客户端。
- 增加 `closeout` 与 hook 自动化，推动 `loom_weave + loom_changelog` 收口执行。

## 影响

- 不同 AI 在安装 Loom 时有一致决策依据。
- “项目级还是全局级”不再靠模型猜测。
- 对外接入体验更可预测，减少重复沟通与误操作。
