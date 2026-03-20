# 对话自动写入 .loom

要让「和 AI 的对话」沉淀进 `.loom`，有两种方式：**MCP（AI 主动写）** 和 **CLI（人存文件后一条命令写）**。

## 为什么 .loom 不会「自己」更新？

Loom 是工具/库，没有常驻进程监听你的聊天窗口。  
内容只会在这两种情况下写入：

1. **有程序调用了 Loom**：MCP 工具（如 `loom_weave`）或 CLI（如 `loom ingest`）。
2. **你（或脚本）显式执行了写入**：例如跑 `loom ingest-from-file summary.md`。

所以：**自动更新 = 在对话里让 AI 调 MCP，或对话后你跑一条 CLI。**

---

## 方式一：MCP（推荐，AI 在对话里主动写）

- **前提**：当前环境接入了 Loom MCP（Cursor 里在 MCP 配置里启用 Loom 服务）。
- **原理**：AI 在对话中调用 `loom_weave` / `loom_ingest`，把本段结论或摘要写入 `.loom`，无需你复制粘贴或再跑命令。
- **触发方式**：
  - 你说「记一下」「写进 loom」「更新记忆」「把这段记下来」等，AI 应立刻调用 `loom_weave`。
  - 项目里的 `.cursorrules` 已约定：达成技术结论、做完 feature 等时机，AI 主动调用 `loom_weave` 或 closeout。
- **结论**：**只有用 MCP，才能实现「对话过程中 / 结束时由 AI 自动写 .loom」**；纯 CLI 做不到「AI 主动写」。

---

## 方式二：CLI（不用 MCP 时，人存文件再写）

不接 MCP 时，可以用 CLI 把「对话摘要」一次性写进 .loom：

1. 把要记的内容存成一个文件（例如 `summary.md`），可以是你自己写的摘要，或从别处复制过来的对话总结。
2. 在项目根目录执行：

```bash
# 用文件内容写一条 thread；标题用文件里第一个 # 行，没有则用文件名
loom ingest-from-file summary.md

# 指定分类和标题
loom ingest-from-file summary.md --category threads --title "2026-03-19 对话摘要"

# 带标签
loom ingest-from-file summary.md --category concepts --title "某架构结论" --tags "backend,api"
```

- **标题**：不传 `--title` 时，用文件首行 `# 标题`，否则用文件名（去掉扩展名）。
- **分类**：默认 `threads`；可传 `--category concepts|decisions|threads`。
- **其他**：`--tags`、`--links`、`--domain` 与 `ingest` 一致。

这样 **不需要 MCP**，也能在对话后通过一条命令更新 .loom，属于「半自动」：你负责存文件，CLI 负责写入。

---

## 方式三：用 Cursor / OpenCode 的 Hooks 自动写入

两边都提供「对话/会话结束」时的钩子，可以在**不依赖 AI 是否调 MCP** 的前提下，由环境在会话结束时自动跑脚本，把对话内容写进 .loom。

### Cursor Hooks（可用）

- **位置**：项目级 `.cursor/hooks.json` 或全局 `~/.cursor/hooks.json`。
- **相关事件**：`sessionEnd`（对话结束）、`stop`（单轮 agent 完成）。脚本通过 stdin 收 JSON，可通过环境变量拿信息。
- **关键**：若在 Cursor 设置里**开启对话转录（transcripts）**，钩子执行时会带上环境变量 **`CURSOR_TRANSCRIPT_PATH`**（本场对话的转录文件路径）。脚本里读这个路径，再调 `loom ingest-from-file`，即可在**对话结束时自动**把本场内容写进 .loom（例如记成一条 thread）。
- **限制**：写入的是「原始转录」，不是 AI 提炼的摘要；若希望是摘要，仍需在对话中靠 MCP 的 `loom_weave`，或事后自己整理再 ingest。

本仓库在 `.cursor/hooks/` 下提供示例配置与脚本，见下方「Cursor 示例」；按需复制到项目并开启 Cursor 的 transcript 即可用。

### OpenCode Hooks（可用，已写详细说明）

- **机制**：OpenCode 的插件系统支持多种钩子（如 `session.idle` 表示 agent 已结束回复）。插件放在 `.opencode/plugins/` 或通过 npm 配置加载，导出一个接收 `{ client, $, directory, worktree }` 的函数，返回 `{ event: async ({ event }) => { ... } }` 即可订阅事件。
- **session.idle**：事件里带 `event.properties.sessionID`。插件内可用 **`ctx.client.session.messages({ sessionID })`** 拉取本场消息列表，或 **`ctx.client.session.summarize({ sessionID })`** 拉取服务端摘要，再写临时文件并执行 **`loom ingest-from-file`**，实现会话结束自动写入 .loom。
- **详细实现**：见 [OpenCode 插件 + Loom 接入说明](OPENCODE_HOOKS_LOOM.md)（基于 OpenCode 源码梳理的插件结构、事件 payload、SDK 用法与完整示例）。

---

## Cursor 示例：sessionEnd 自动写入转录

1. 在 Cursor 设置中开启 **Conversation transcripts**（若未开启，`CURSOR_TRANSCRIPT_PATH` 不会存在）。
2. 在项目根创建 `.cursor/hooks.json`（若已有，只合并 `hooks` 段）：

```json
{
  "version": 1,
  "hooks": {
    "sessionEnd": [
      { "command": ".cursor/hooks/loom-session-end.sh" }
    ]
  }
}
```

3. 创建 `.cursor/hooks/loom-session-end.sh`（可执行 `chmod +x`）：

```bash
#!/usr/bin/env bash
# 对话结束时若存在转录文件，则写入 .loom（一条 thread）
set -e
if [[ -n "$CURSOR_TRANSCRIPT_PATH" && -f "$CURSOR_TRANSCRIPT_PATH" ]]; then
  cd "${CURSOR_PROJECT_DIR:-.}"
  title="Session $(date '+%Y-%m-%d %H:%M')"
  if command -v loom >/dev/null 2>&1; then
    loom ingest-from-file --file "$CURSOR_TRANSCRIPT_PATH" --category threads --title "$title" 2>/dev/null || true
  elif command -v npx >/dev/null 2>&1; then
    npx loom-memory ingest-from-file --file "$CURSOR_TRANSCRIPT_PATH" --category threads --title "$title" 2>/dev/null || true
  fi
fi
exit 0
```

4. `chmod +x .cursor/hooks/loom-session-end.sh`。之后每次对话结束（且存在转录文件时）会自动执行一次写入。

---

## 小结

| 方式 | 谁触发写入 | 是否需要 MCP | 典型用法 |
|------|------------|----------------|----------|
| MCP 工具调用 | AI 在对话里调 `loom_weave` | 需要 | 对话中说「记一下」或按规则在结论时自动写 |
| CLI `ingest-from-file` | 你运行命令 | 不需要 | 把摘要存成文件后执行 `loom ingest-from-file <path>` |
| **Cursor sessionEnd hook** | Cursor 在对话结束时跑脚本 | 不需要 | 开启 transcript + 配置 hook，自动把本场转录写进 .loom |
| **OpenCode 插件 hooks** | OpenCode 在 session.idle 等时机跑插件 | 看实现 | 若 API 暴露会话/转录，可在此自动调 Loom 写入 |

要「自动」由 AI 写，必须用 MCP；要「对话结束自动写」（原始转录），可用 Cursor hooks + transcript；只用 CLI 则需你执行命令（或脚本里调 CLI）。
