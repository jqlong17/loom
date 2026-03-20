# Loom

[中文](./README.md) | [English](./README.en.md)

**将转瞬即逝的 AI 对话，编织成可持续演进的系统记忆。**

Loom 是一个 **CLI-first** 的长期记忆系统，并兼容 MCP（Model Context Protocol）安装方式。它用来把你和 AI 的对话沉淀为结构化、可版本管理的 Markdown 知识库；本地运行、复用编辑器自带 AI（不需要额外 API Key），并可通过 Git 实现团队协作。

**如何选择安装方式：**

- **希望系统自动记录、更新记忆**（对话中由 AI 主动写入）：建议按 **MCP 方式**安装并配置到 Cursor / OpenCode / Claude Code 等，让 AI 在对话里调用 `loom_weave` / `loom_ingest`；也可配合 [Cursor sessionEnd hook](docs/CONVERSATION_TO_LOOM.md#cursor-示例sessionend-自动写入转录) 或 [OpenCode session.idle 插件](docs/OPENCODE_HOOKS_LOOM.md) 在会话结束时自动写入转录。
- **希望更多自主控制**（自己或脚本决定何时写入）：建议按 **CLI 方式**安装（`npm i -g loom-memory`），通过 `loom ingest`、`loom ingest-from-file`、`loom weave` 等命令在需要时执行；不依赖 MCP，也不依赖 AI 是否在对话中调工具。

> npm 包名：`loom-memory`（产品名仍为 Loom）。

## 为什么是 Loom？

你每次与 AI 讨论架构、排查问题、拆解需求，都会产生高价值知识，但这些内容常常随着聊天窗口关闭而丢失。

Loom 会把这些知识自动留下来：

- **对话即文档**：AI 调用 `loom_weave` 将结论写入 Markdown
- **零额外模型成本**：直接使用 Cursor / VS Code Copilot / Claude Code / OpenCode / Codex 等宿主 AI 能力
- **Git 原生**：每次知识更新都可追踪，支持多人协作维护
- **人类可读可改**：纯 Markdown 文件，和代码一样可审查、可编辑

### 记忆什么时候会被保存？

你可以把 Loom 理解成“关键节点记忆系统”，不是把所有聊天原样录音，而是在有价值的时刻进行沉淀。

- **接 MCP 时**：当 AI 在对话中调用 `loom_weave` / `loom_ingest` 时写入（例如形成结论、你说「记一下」、或按项目规则在收口时主动调用）；也可通过 Cursor/OpenCode 的会话结束 hook 自动写入本场转录。
- **仅用 CLI 时**：当你或脚本执行 `ingest` / `ingest-from-file` / `weave` / `closeout` 时写入；AI 不会自动写，需你决定时机。
- 当你做澄清问答（`probe`）并提交答案时，会把“问题-答案-依据”一起沉淀（MCP 或 CLI 均可触发）。

### 这个记忆系统有什么特点？

对非技术同学：

- **该记的时候才记**：减少噪音，保留真正有用的信息。
- **看得懂、改得了**：记忆就是 Markdown 文档，不是黑盒数据库。
- **能回看来龙去脉**：每次更新都有记录，后续追溯更容易。

对技术同学：

- **MCP 用于自动记录、CLI 用于自主控制**：接 MCP 时 AI 可在对话中自动写；仅用 CLI 时由你或脚本在需要时执行命令。
- **Git 原生可审计**：记忆变更可 diff、可 review、可回滚。
- **有治理和指标闭环**：支持 doctor、events、metrics snapshot/report，能把“记忆质量”变成可观测与可改进的工程信号。

## 快速开始

### 1. 安装（推荐 npm）

```bash
# 全局安装（推荐，便于 OpenCode / 终端直接调用）
npm install -g loom-memory

# 验证
loom-cli help
```

### 1.1 从源码构建（开发者）

```bash
git clone https://github.com/jqlong17/loom
cd loom
npm install
npm run build
```

### 2. 配置 AI 工具（MCP：推荐用于「自动记录」）

若希望 **AI 在对话中自动记录与更新记忆**，请按下方方式将 Loom 配置为 MCP 服务；配置后 AI 可在对话里直接调用 `loom_weave`、`loom_trace` 等工具。若仅需 **自主控制写入时机**（用 CLI 或脚本），可跳过本节，只安装 CLI（见上方「如何选择安装方式」）。

以下配置中的路径请替换为你的实际路径。

<details>
<summary><b>Cursor</b></summary>

在项目根目录 `.cursor/mcp.json` 中添加（若已全局安装可直接用 `loom` 命令）：

```json
{
  "mcpServers": {
    "loom": {
      "command": "loom",
      "args": [],
      "env": {
        "LOOM_WORK_DIR": "/your/project/root"
      }
    }
  }
}
```

可选：若希望 Cursor 内 AI 更主动调用 Loom，可自行将 `docs/CURSOR_HINTS.md` 粘贴到编辑器规则（仓库不再内置 `.cursorrules`）。

</details>

<details>
<summary><b>VS Code（Copilot）</b></summary>

在 `settings.json` 中添加（若未全局安装，可改回 `node + dist/index.js` 方式）：

```json
{
  "github.copilot.chat.mcp.servers": {
    "loom": {
      "command": "loom",
      "args": [],
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
      "command": ["loom"],
      "enabled": true,
      "environment": {
        "LOOM_WORK_DIR": "/your/project/root"
      }
    }
  }
}
```

也可以放到全局配置 `~/.config/opencode/opencode.json` 中，对所有项目生效。

**演练与自动化（开发者 / 进阶）**

- 隔离沙箱 + 文档：`docs/技术文档/OpenCode-Loom-MCP-演练沙箱.md`；一键生成目录：`npm run sandbox:opencode`。
- **源码版 OpenCode** 下 MCP 链路 E2E（需本机 Bun、模型配置与 `OPENCODE_PACKAGE_DIR`）：`npm run test:e2e-opencode`，说明见 `tests/e2e-opencode-sandbox/README.md`；每次运行结果归档在 `tests/e2e-opencode-sandbox/results/run-*`。
- 将同类能力迁移到其他宿主时的**模式说明**（清单、坑位、本仓库对照路径）：`docs/跨项目可复用经验/`。

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
# 全局安装后可直接调用
loom-cli trace --query "auth architecture" --json
```

推荐让 OpenClaw 调用以下命令模式：

- 写入知识：`loom-cli weave --category concepts --title "..." --content "..." --tags a,b --mode append --json`
- 检索知识：`loom-cli trace --query "..." --category concepts --limit 5 --json`
- 体检知识：`loom-cli reflect --maxFindings 20 --json`

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
- 若用户希望「自动记录 / 对话中由 AI 写入」且客户端支持 MCP：走 MCP 安装
- 若用户希望「自主控制 / 脚本化」或客户端不支持 MCP（如 OpenClaw）：使用 CLI Wrapper

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

**MCP 已配置时**：在 AI 聊天里可直接说“记一下”“把我们刚才讨论的记进 Loom”等，AI 会调用 Loom 工具写入。**仅用 CLI 时**：在终端执行 `loom ingest` / `loom ingest-from-file` 等，或在脚本中调用。

示例（MCP 场景）：

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
- `loom_weave` 支持图谱骨架字段：
  - `domain`：宏观归属域（如 `architecture` / `product` / `operations`）
  - `links`：关联条目路径（如 `concepts/three-layer-architecture`）
- `loom_trace` 支持 `category`、`tags`、`limit` 参数，便于精准检索
- `loom_deprecate` 可将旧条目标记为废弃，并可选指向 `superseded_by`
- `loom_probe` 支持主动提问状态机（当前 MCP 入口）：
  - 第一步：`record=false`，传入 `context` 生成问题与 `session_id`
  - 第二步：`record=true`，传入 `session_id + answers` 回写到 `threads`
  - 若未提供 `session_id` 但给了 `context`，会自动创建会话并提交回答
  - 写入前会执行 Memory Lint；若出现 ERROR 级问题会拒绝写入，并返回修复建议
- `loom_changelog` 可按日期维护公开 `CHANGELOG.md`：
  - `mode=auto`：自动从当天 git 提交提炼核心变化
  - `mode=manual`：手动传入要公开的核心变化点
- `loom_upgrade` 可在安装目录执行 Git 升级（`git pull`）：
  - `dryRun=true`：只检查是否可升级
  - 默认：执行实际升级
- `loom-cli closeout` 可一键执行“功能收口”：
  - 写入一条 `loom_weave` 总结
  - 自动更新 `CHANGELOG.md`（按当天聚合）

### 4.1 分层渐进披露（推荐读取策略）

建议所有 AI 在回答前按以下顺序读取 Loom 记忆：

1. 先调用 `loom_index`（读取全局知识地图 + 必读集合）
2. 必读集合默认包含：
   - 最近 5 条记忆（不排除 threads）
   - 所有 `core` 标签的 concepts
3. 再调用 `loom_trace`（基于问题检索候选条目）
4. 仅在必要时调用 `loom_read`（读取少量高相关条目的全文）

说明：
- `loom_index` 输出的是“截断摘要”（短期记忆有效 + 控制上下文长度）
- 当摘要不足以支撑回答时，再按需扩读全文
- `loom_weave` 支持 `is_core=true`，可强制给基础概念加 `core` 标签

### 4.2 宏观图谱骨架（技术 + 业务）

Loom 初始化后会自动创建：

- `.loom/schema/technical.md`：技术图谱骨架（模块、服务、依赖、影响关系）
- `.loom/schema/business.md`：业务图谱骨架（目标、约束、能力、结果关系）

建议在写入 `concepts` / `decisions` 时补充 `domain` 与 `links`，以形成稳定知识图谱。

`loom_reflect` 现在会额外检测：

- `dangling_link`：链接目标不存在
- `isolated_node`：没有任何入边/出边的孤立条目（`core` 条目除外）

### 4.3 CLI 与自主控制（推荐脚本化 / CI 路径）

如果你希望“由自己或脚本决定何时写入、稳定触发、可接入 CI”，建议使用 CLI（无需 MCP）：

- `ingest`：一条命令完成 lint + weave + index（可选 changelog/commit）
- `doctor`：统一健康检查输出，可通过 `--failOn` 做门禁

示例：

```bash
# 一键收口（不提交，先看结果）
node dist/cli.js ingest \
  --category concepts \
  --title "支付链路边界" \
  --content "## 背景\n...\n\n## 结论\n..." \
  --tags architecture,payment \
  --domain architecture \
  --links concepts/three-layer-architecture,decisions/why-mcp-over-vs-code-plugin \
  --commit false \
  --json

# 记忆体检门禁（发现 error 即退出码 2）
node dist/cli.js doctor --failOn error --json
```

### 4.4 CLI-first + MCP-adapter 架构

当前代码结构采用“能力下沉、入口适配”：

- `src/core/`：共享核心流程（如 ingest / doctor）
- `src/app/usecases/`：用例层，统一业务返回结构
- `src/cli.ts`：主入口（稳定自动化与脚本化）
- `src/index.ts`：MCP 适配层（对话工具映射到同一用例）

这样可避免 CLI 与 MCP 双入口逻辑分叉，提升回归一致性与长期可维护性。

## MCP 工具列表

| Tool | 说明 |
|------|------|
| `loom_init` | 初始化项目中的 `.loom/` 目录结构 |
| `loom_weave` | 写入知识条目（概念 / 决策 / 线程） |
| `loom_ingest` | 一键收口（lint + weave + index，可选 changelog/commit） |
| `loom_doctor` | 运行记忆健康门禁并返回结构化严重级别 |
| `loom_trace` | 按关键词检索知识库 |
| `loom_read` | 读取指定条目的完整内容 |
| `loom_index` | 读取全局索引（分层披露第一步） |
| `loom_list` | 列出知识库中的所有条目 |
| `loom_sync` | 与远程 Git 仓库执行 pull + push 同步 |
| `loom_log` | 查看知识变更的 Git 历史 |
| `loom_deprecate` | 将旧条目标记为 deprecated，并记录废弃原因和替代项 |
| `loom_reflect` | 执行知识库自检，输出冲突、过期、缺少标签、可合并项 |
| `loom_probe_start` | 启动主动提问会话，生成问题并保存 session |
| `loom_probe_commit` | 提交回答并写回 threads（两阶段显式流程） |
| `loom_probe` | 主动提问与回写记忆（同一工具支持 start/commit 两阶段） |
| `loom_changelog` | 维护公开 CHANGELOG（按日期聚合核心变更） |
| `loom_metrics_snapshot` | 生成指标快照 JSON（治理通过率与辅助指标） |
| `loom_metrics_report` | 生成指标周报草稿（用于复盘与决策） |
| `loom_events` | 查询事件流（支持 type/since/limit/order） |
| `loom_upgrade` | 升级 Loom MCP 安装本体（从 GitHub 拉取最新） |

## CLI 命令列表（`node dist/cli.js <command>`）

`init`、`weave`、`ingest`、`probe-start`、`probe-commit`、`metrics-snapshot`、`metrics-report`、`events`、`closeout`、`trace`、`read`、`list`、`deprecate`、`reflect`、`doctor`、`sync`、`log`、`changelog`、`upgrade`

## 知识分类

- **concepts/**：系统架构、业务规则、术语、模块说明
- **decisions/**：架构决策记录（ADR），重点记录“为什么”
- **threads/**：对话摘要、讨论纪要、会议记录

## 目录结构

```
.loom/
├── index.md          # 自动生成的知识索引
├── schema/           # 宏观图谱骨架
│   ├── technical.md
│   └── business.md
├── concepts/         # 系统概念与定义
│   ├── payment-flow.md
│   └── user-auth.md
├── decisions/        # 架构决策记录
│   └── why-postgresql.md
├── threads/          # 对话/讨论沉淀
│   └── 2026-03-18-api-design.md
├── probes/           # 主动提问会话状态（probe sessions）
│   └── probe-xxxxx.json
├── events.jsonl      # 事件流（append-only）
├── raw_conversations/ # 可配置的全量原始对话日志（jsonl）
│   └── events-YYYY-MM-DD.jsonl
└── metrics/          # 指标快照输出
    └── snapshot-YYYY-MM-DD.json
```

## 配置说明

你可以在项目根目录创建 `.loomrc.json` 来自定义行为：

```json
{
  "loomDir": ".loom",
  "promptVersion": "v1",
  "promptLocale": "zh",
  "autoCommit": true,
  "autoPush": false,
  "branch": "main",
  "commitPrefix": "loom",
  "fullConversationLogging": {
    "enabled": false,
    "storageDir": "raw_conversations",
    "redact": true,
    "maxPayloadChars": 12000
  }
}
```

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `promptVersion` | `v1` | MCP 工具说明与 `loom-instructions` 使用的提示词版本目录（`prompts/<locale>/<version>/`）；可被环境变量 `LOOM_PROMPT_VERSION` 覆盖 |
| `promptLocale` | `zh` | 提示词语言目录；可被 `LOOM_PROMPT_LOCALE` 覆盖（当前以 `zh` 为主，预留 `en`） |
| `loomDir` | `.loom` | 知识库目录 |
| `autoCommit` | `true` | 每次 weave 后自动提交 |
| `autoPush` | `false` | 每次提交后自动推送远程 |
| `branch` | `main` | 同步使用的分支 |
| `commitPrefix` | `loom` | 提交信息前缀 |
| `fullConversationLogging.enabled` | `false` | 开启后记录 MCP/CLI 原始输入输出到 `.loom/raw_conversations/*.jsonl` |
| `fullConversationLogging.storageDir` | `raw_conversations` | 原始对话日志目录（位于 `.loom/` 下） |
| `fullConversationLogging.redact` | `true` | 对常见敏感字段（token/secret/password 等）进行脱敏 |
| `fullConversationLogging.maxPayloadChars` | `12000` | 单字段最大保留字符数，超出会截断 |

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

## 路线图与规划协作

为了让社区一起规划 Loom 的长期方向并持续动态演进，项目新增公开规划文档：

- `docs/ROADMAP.md`：产品与架构长期方向（动态演进）
- `docs/IMPLEMENTATION_PLAN.md`：可执行任务清单（逐项打勾）
- `docs/BRAINSTORM.md`：脑爆创意池（想法先沉淀再转 roadmap）
- `docs/METRICS.md`：北极星指标与周度追踪模板（判断方向是否有效）
- `docs/ARCHITECTURE.md`：全局技术架构图（非技术/技术双层 + Tool 能力映射）

建议协作方式：

1. 先在 `docs/BRAINSTORM.md` 记录想法
2. 通过 PR 将成熟想法升级到 `docs/ROADMAP.md`
3. 拆解为 `docs/IMPLEMENTATION_PLAN.md` 可执行任务
4. 实现后在 PR 中同步更新勾选状态、验证结果与指标影响（参考 `docs/METRICS.md`）

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
npm test         # 运行单元/集成测试
npm run test:coverage   # 运行覆盖率测试（含阈值）
npm run test:regression # 生成可复现测试日志：.test-logs/latest.log
npm run sandbox:opencode   # 生成 OpenCode + Loom MCP 隔离演练沙箱目录
npm run test:e2e-opencode  # 源码 OpenCode + Loom MCP E2E（需 OPENCODE_PACKAGE_DIR，见 tests/e2e-opencode-sandbox/README.md）
npm run demo:opencode-context-log  # 离线生成与 OpenCode 同形的上下文请求日志 JSONL 样例
npm run changelog:auto  # 自动更新当天 CHANGELOG 核心变更
npm run cli -- help  # 查看 CLI Wrapper 命令
npm run hooks:install  # 安装 post-commit 自动更新 hook
npm run release:patch # patch 发版（创建 tag 并 push，触发自动发布）
npm run release:minor # minor 发版
npm run release:major # major 发版
```

## npm 自动发布（Trusted Publishing）

- 工作流：`.github/workflows/release-npm.yml`
- 触发：push `v*` tag（例如 `v0.1.1`）
- 发布方式：GitHub OIDC Trusted Publishing（无需仓库保存 `NPM_TOKEN`、无需每次 OTP）

一次性配置与细节见：`docs/RELEASE_AUTOMATION.md`

## 贡献 PR 建议流程

如果你希望贡献 PR，建议按以下步骤：

1. 新建分支并实现功能（优先走 CLI-first 路径）
2. 本地执行：
   - `npm run build`
   - `npm run lint`
   - `npm run test:coverage`
3. 如需复现测试过程，附上 `.test-logs/latest.log` 关键片段
4. 更新 README / CHANGELOG 中与功能对应的说明
5. 发起 PR 并说明验证命令与结果

说明：
- 测试用例会纳入仓库（不忽略），便于贡献者在提交前跑同样的回归测试
- 仅忽略测试产物（如 `coverage/`、`.test-logs/`）

## 许可证

MIT
