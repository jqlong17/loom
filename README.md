# Loom

[中文](./README.md) | [English](./README.en.md)

**将转瞬即逝的 AI 对话，编织成可持续演进的系统记忆。**

Loom 是一个 MCP（Model Context Protocol）服务器，用来把你和 AI 的对话沉淀为结构化、可版本管理的 Markdown 知识库。它本地运行，复用编辑器自带 AI（不需要额外 API Key），并可通过 Git 实现团队协作。

## 为什么是 Loom？

你每次与 AI 讨论架构、排查问题、拆解需求，都会产生高价值知识，但这些内容常常随着聊天窗口关闭而丢失。

Loom 会把这些知识自动留下来：

- **对话即文档**：AI 调用 `loom_weave` 将结论写入 Markdown
- **零额外模型成本**：直接使用 Cursor / VS Code Copilot 等宿主 AI 能力
- **Git 原生**：每次知识更新都可追踪，支持多人协作维护
- **人类可读可改**：纯 Markdown 文件，和代码一样可审查、可编辑

## 快速开始

### 1. 构建项目

```bash
git clone <your-repo-url>
cd loom
npm install
npm run build
```

### 2. 配置编辑器

**Cursor** — 在 `.cursor/mcp.json` 中添加：

```json
{
  "mcpServers": {
    "loom": {
      "command": "node",
      "args": ["/absolute/path/to/loom/dist/index.js"],
      "env": {
        "LOOM_WORK_DIR": "/your/project/root"
      }
    }
  }
}
```

**VS Code（Copilot）** — 在 `settings.json` 中添加：

```json
{
  "github.copilot.chat.mcp.servers": {
    "loom": {
      "command": "node",
      "args": ["/absolute/path/to/loom/dist/index.js"],
      "env": {
        "LOOM_WORK_DIR": "/your/project/root"
      }
    }
  }
}
```

### 3. 开始使用

配置完成后，你可以在 AI 聊天里直接使用 Loom：

```
"初始化当前项目的 Loom 知识库。"
"把我们刚才讨论的支付流程记录到 Loom。"
"Loom 里有哪些关于认证系统的知识？"
```

## 工具列表

| Tool | 说明 |
|------|------|
| `loom_init` | 初始化项目中的 `.loom/` 目录结构 |
| `loom_weave` | 写入知识条目（概念 / 决策 / 线程） |
| `loom_trace` | 按关键词检索知识库 |
| `loom_read` | 读取指定条目的完整内容 |
| `loom_list` | 列出知识库中的所有条目 |
| `loom_sync` | 与远程 Git 仓库执行 pull + push 同步 |
| `loom_log` | 查看知识变更的 Git 历史 |

## 知识分类

- **concepts/**：系统架构、业务规则、术语、模块说明
- **decisions/**：架构决策记录（ADR），重点记录“为什么”
- **threads/**：对话摘要、讨论纪要、会议记录

## 目录结构

```
.loom/
├── index.md          # 自动生成的知识索引
├── concepts/         # 系统概念与定义
│   ├── payment-flow.md
│   └── user-auth.md
├── decisions/        # 架构决策记录
│   └── why-postgresql.md
└── threads/          # 对话/讨论沉淀
    └── 2026-03-18-api-design.md
```

## 配置说明

你可以在项目根目录创建 `.loomrc.json` 来自定义行为：

```json
{
  "loomDir": ".loom",
  "autoCommit": true,
  "autoPush": false,
  "branch": "main",
  "commitPrefix": "loom"
}
```

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `loomDir` | `.loom` | 知识库目录 |
| `autoCommit` | `true` | 每次 weave 后自动提交 |
| `autoPush` | `false` | 每次提交后自动推送远程 |
| `branch` | `main` | 同步使用的分支 |
| `commitPrefix` | `loom` | 提交信息前缀 |

## 团队协作

Loom 的知识库本质上就是 Git 仓库里的一组 Markdown 文件，多人协作方式与代码一致：

1. `.loom/` 与代码同仓管理
2. 会话前可 `loom_sync` 拉取团队最新记忆
3. 会话后提交/推送新增知识
4. 通过 PR 审阅知识变更，确保质量和一致性

## 开发命令

```bash
npm run dev      # 使用 tsx 运行（开发模式）
npm run build    # 编译 TypeScript
npm run watch    # 监听编译
npm run lint     # 类型检查
```

## 许可证

MIT
