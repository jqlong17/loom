# Loom

[中文](./README.md) | [English](./README.en.md)

**将转瞬即逝的 AI 对话，编织成可持续演进的系统记忆。**

Loom 是一个 MCP（Model Context Protocol）服务器，用来把你和 AI 的对话沉淀为结构化、可版本管理的 Markdown 知识库。它本地运行，复用编辑器自带 AI（不需要额外 API Key），并可通过 Git 实现团队协作。

## 为什么是 Loom？

你每次与 AI 讨论架构、排查问题、拆解需求，都会产生高价值知识，但这些内容常常随着聊天窗口关闭而丢失。

Loom 会把这些知识自动留下来：

- **对话即文档**：AI 调用 `loom_weave` 将结论写入 Markdown
- **零额外模型成本**：直接使用 Cursor / VS Code Copilot / Claude Code / OpenCode / Codex 等宿主 AI 能力
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

### 2. 配置 AI 工具

以下配置中的路径请替换为你的实际路径。

<details>
<summary><b>Cursor</b></summary>

在项目根目录 `.cursor/mcp.json` 中添加：

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

</details>

<details>
<summary><b>VS Code（Copilot）</b></summary>

在 `settings.json` 中添加：

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

</details>

<details>
<summary><b>Claude Code</b></summary>

使用 `claude mcp add` 命令一行注册：

```bash
claude mcp add --transport stdio --scope user \
  --env LOOM_WORK_DIR=/your/project/root \
  loom -- node /absolute/path/to/loom/dist/index.js
```

也可以手动编辑 `~/.claude.json` 或项目根目录的 `.mcp.json`：

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

scope 说明：`--scope local`（当前项目）、`--scope project`（团队共享，提交到 Git）、`--scope user`（全局所有项目）。

</details>

<details>
<summary><b>OpenCode</b></summary>

在项目根目录 `opencode.json` 的 `mcp` 字段中添加：

```json
{
  "mcp": {
    "loom": {
      "type": "local",
      "command": ["node", "/absolute/path/to/loom/dist/index.js"],
      "enabled": true,
      "environment": {
        "LOOM_WORK_DIR": "/your/project/root"
      }
    }
  }
}
```

也可以放到全局配置 `~/.config/opencode/opencode.json` 中，对所有项目生效。

</details>

<details>
<summary><b>Codex CLI（OpenAI）</b></summary>

使用 `codex mcp add` 交互式注册：

```bash
codex mcp add loom
```

按提示选择 `STDIO` 类型，输入命令 `node /absolute/path/to/loom/dist/index.js`，环境变量设置 `LOOM_WORK_DIR=/your/project/root`。

也可以直接编辑 `~/.codex/config.toml`：

```toml
[mcp_servers.loom]
type = "stdio"
command = ["node", "/absolute/path/to/loom/dist/index.js"]

[mcp_servers.loom.environment]
LOOM_WORK_DIR = "/your/project/root"
```

</details>

<details>
<summary><b>OpenClaw（无 MCP 适配）</b></summary>

如果 OpenClaw 当前不支持 MCP，可直接使用 Loom CLI Wrapper：

```bash
# 在 Loom 项目目录内
npm install
npm run build

# 让 OpenClaw 调用该命令即可
./dist/cli.js trace --query "auth architecture" --json
```

推荐让 OpenClaw 调用以下命令模式：

- 写入知识：`./dist/cli.js weave --category concepts --title "..." --content "..." --tags a,b --mode append --json`
- 检索知识：`./dist/cli.js trace --query "..." --category concepts --limit 5 --json`
- 体检知识：`./dist/cli.js reflect --maxFindings 20 --json`

> 说明：CLI Wrapper 是 MCP 的兼容适配层，不依赖宿主是否支持 MCP。

</details>

### 2.5 AI-First 自动安装协议（给任意 AI）

当用户只贴仓库链接（如 `https://github.com/jqlong17/loom`）时，建议 AI 严格按以下协议执行：

```text
[ROLE]
你是 Loom 安装助手。

[INPUT]
用户提供 GitHub 链接：https://github.com/jqlong17/loom

[STEP 1 - 简介]
先用 2-3 句话说明 Loom：
- 它是一个 MCP + Markdown + Git 的长期记忆系统
- 用于把 AI 对话沉淀为可追溯知识库

[STEP 2 - 授权确认]
必须先询问用户是否安装，不得直接执行命令：
“是否现在为你安装 Loom？我会先检测你的客户端是否支持 MCP，再自动选择 MCP 或 CLI Wrapper 方案。”

[STEP 3 - 安装决策]
如果用户确认安装：
- 若客户端支持 MCP：走 MCP 安装
- 若客户端不支持 MCP（如 OpenClaw）：自动切换 CLI Wrapper

[STEP 3.5 - 作用域决策（必须）]
- 默认 `project-first`：优先安装到项目级
- 仅当用户明确说“全局安装”时，才切换到全局级
- 若需要从项目级切到全局级，必须二次确认

[STEP 4 - 验证输出]
安装完成后必须输出：
- 具体修改了哪些配置文件
- 可用命令或可用工具名称
- 一条最小可复现验证命令

[STEP 5 - 拒绝安装]
如果用户拒绝安装：
- 仅返回最小接入说明
- 不执行任何写操作
```

推荐验证命令：

```bash
# MCP 路径
请在聊天中调用 loom_list 或 loom_trace

# CLI Wrapper 路径
./dist/cli.js trace --query "loom architecture" --json
```

> 这个协议的目的：让不同 AI 都遵循“先说明 -> 先授权 -> 再安装 -> 可验证”的统一行为，减少误操作和上下文歧义。

### 2.6 安装作用域策略（Project-First）

为避免 AI 在“全局 or 项目”之间反复猜测，Loom 采用明确策略：

- 默认安装作用域：`project`（项目级）
- 只有用户明确指令“全局安装”时才使用 `global`
- 作用域切换（project -> global）必须再次询问确认

对应机器可读策略文件：`INSTALL_POLICY.json`

### 3. 开始使用

配置完成后，你可以在 AI 聊天里直接使用 Loom：

```
"初始化当前项目的 Loom 知识库。"
"把我们刚才讨论的支付流程记录到 Loom。"
"把这个主题以 append 模式补充进已有条目。"
"把旧版登录流程标记为 deprecated，并指向新方案。"
"Loom 里有哪些关于认证系统的知识？"
```

### 4. 高级用法

- `loom_weave` 支持 `mode`：
  - `replace`：整体覆盖（默认）
  - `append`：在原内容下追加，不丢失历史
  - `section`：按 `##` 小节替换或新增
- `loom_trace` 支持 `category`、`tags`、`limit` 参数，便于精准检索
- `loom_deprecate` 可将旧条目标记为废弃，并可选指向 `superseded_by`
- `loom_changelog` 可按日期维护公开 `CHANGELOG.md`：
  - `mode=auto`：自动从当天 git 提交提炼核心变化
  - `mode=manual`：手动传入要公开的核心变化点
- `loom_upgrade` 可在安装目录执行 Git 升级（`git pull`）：
  - `dryRun=true`：只检查是否可升级
  - 默认：执行实际升级
- `loom-cli closeout` 可一键执行“功能收口”：
  - 写入一条 `loom_weave` 总结
  - 自动更新 `CHANGELOG.md`（按当天聚合）

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
| `loom_deprecate` | 将旧条目标记为 deprecated，并记录废弃原因和替代项 |
| `loom_reflect` | 执行知识库自检，输出冲突、过期、缺少标签、可合并项 |
| `loom_changelog` | 维护公开 CHANGELOG（按日期聚合核心变更） |
| `loom_upgrade` | 升级 Loom MCP 安装本体（从 GitHub 拉取最新） |
| `loom-cli` | OpenClaw/任意 Agent 可调用的命令行适配层（非 MCP） |

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

## 公开变更记录（CHANGELOG）

- 项目根目录提供 `CHANGELOG.md`（中文）用于公开每日核心功能变化
- 同一天多次新增会聚合在同一个日期下
- 可使用以下方式自动更新：
  - MCP 工具：调用 `loom_changelog`（`mode=auto`）
  - 命令行：`npm run changelog:auto`

## 强制收口（推荐）

每次完成一个功能（或每次 commit 后），建议固定执行：

1. `loom_weave`（记录 thread/concept 的功能总结）
2. `loom_changelog(mode=auto)`（更新公开变更）

可选一键方式（CLI Wrapper）：

```bash
node dist/cli.js closeout \
  --title "本次功能名称" \
  --content "本次做了什么、为什么做、边界和影响" \
  --category threads \
  --mode append \
  --tags release,feature
```

### Git Hook 自动化（post-commit）

安装 hook（一次即可）：

```bash
npm run hooks:install
```

安装后每次 commit 会自动执行：

```bash
node dist/cli.js changelog --mode auto --commit false --json
```

说明：
- 该 hook 只更新工作区中的 `CHANGELOG.md`，不会自动提交（避免递归 commit）
- 你可以在下一次提交中一起提交 changelog 变化

## 开发命令

```bash
npm run dev      # 使用 tsx 运行（开发模式）
npm run build    # 编译 TypeScript
npm run watch    # 监听编译
npm run lint     # 类型检查
npm run changelog:auto  # 自动更新当天 CHANGELOG 核心变更
npm run cli -- help  # 查看 CLI Wrapper 命令
npm run hooks:install  # 安装 post-commit 自动更新 hook
```

## 许可证

MIT
