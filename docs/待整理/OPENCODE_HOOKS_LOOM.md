# 用 OpenCode 插件在会话结束时自动写入 Loom

本文基于 OpenCode 源码（`packages/opencode`、`packages/plugin`、`packages/sdk`）说明如何通过 **插件 + session.idle 钩子** 在会话结束时把本场对话写入 Loom，无需依赖 AI 在对话里调用 MCP。

---

## 1. OpenCode 插件机制（源码要点）

### 1.1 加载方式

- **项目级**：`.opencode/plugins/` 下的 JS/TS 文件在启动时自动加载。
- **全局**：`~/.config/opencode/plugins/`。
- **npm**：在 `opencode.json` 的 `plugin` 数组里写包名，例如 `["opencode-wakatime"]`。

加载顺序：全局配置 → 项目配置 → 全局插件目录 → 项目插件目录（见 `packages/opencode/src/plugin/index.ts`）。

### 1.2 插件结构

插件导出一个**异步函数**，接收一个上下文对象，返回一个**钩子对象**：

```ts
// .opencode/plugins/my-plugin.ts
import type { Plugin } from "@opencode-ai/plugin"

export const MyPlugin: Plugin = async (ctx) => {
  return {
    event: async ({ event }) => {
      if (event.type === "session.idle") {
        const sessionID = event.properties.sessionID
        // ...
      }
    },
  }
}
```

上下文 `ctx` 包含（见 `packages/plugin/src/index.ts`）：

| 字段 | 说明 |
|------|------|
| `client` | OpenCode SDK 客户端，可调 `client.session.messages()`、`client.session.summarize()` 等 |
| `project` | 当前项目信息 |
| `directory` | 当前工作目录 |
| `worktree` | git worktree 路径 |
| `serverUrl` | 本地 OpenCode 服务 URL |
| `$` | Bun Shell API，可执行命令（如 `$ \`loom ingest-from-file ...\``） |

### 1.3 事件钩子

在返回对象里写 `event: async ({ event }) => { ... }` 即可订阅**所有**总线上发出的事件。事件格式为：

```ts
event = {
  type: string,      // 如 "session.idle", "message.updated"
  properties: object // 随 type 不同而不同
}
```

`session.idle` 在会话变为 idle 时发出（agent 结束回复），定义在 `packages/opencode/src/session/status.ts`：

```ts
Bus.publish(Event.Idle, { sessionID })
```

因此 `event.type === "session.idle"` 时，`event.properties.sessionID` 即为当前会话 ID。

### 1.4 用 client 取会话内容

SDK 客户端（`ctx.client`）有 `session` 子对象（见 `packages/sdk/js/src/v2/gen/sdk.gen.ts`）：

- **`client.session.messages({ sessionID })`**  
  返回该会话的消息列表：`Array<{ info: Message, parts: Part[] }>`，可自行拼成 Markdown。
- **`client.session.summarize({ sessionID })`**  
  调用服务端「会话总结」接口，适合直接当摘要写入 Loom（具体返回格式见服务端实现）。

插件与 OpenCode 主进程同进程，`client` 请求的是本地 `http://localhost:4096`，因此可直接用上述 API。

---

## 2. 在 session.idle 时写入 Loom 的思路

1. 在 `event` 钩子里判断 `event.type === "session.idle"`。
2. 用 `event.properties.sessionID` 调 `ctx.client.session.messages({ sessionID })`（或 `summarize`）拿到内容。
3. 将内容写成临时 Markdown 文件（例如 `directory` 下的 `.opencode/loom-session-{sessionID}.md` 或系统 temp 目录）。
4. 用 `ctx.$` 执行 `loom ingest-from-file --file <path> --category threads --title "Session <date>"`（需本机已装 `loom` 或 `npx loom-memory`）。
5. 可选：删除临时文件；若 Loom 根目录与当前项目一致，可传 `directory` 所在项目根（Loom 会从当前工作目录找 `.loom`，一般 `directory` 即项目根）。

注意：若 Loom 的 `.loom` 不在 `directory` 下，需在调用前 `cd` 到正确项目根，或在 Loom 支持时传入 `--loom` 等参数。

---

## 3. 示例插件（最小可用）

下面这段可保存为 **`.opencode/plugins/loom-session-idle.ts`**（在**使用 OpenCode 的项目**里，而不是 Loom 仓库里）。需在项目根或全局安装 `loom-memory`，并确保 `loom` 或 `npx loom-memory` 可用。

```ts
import type { Plugin } from "@opencode-ai/plugin"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"

export const LoomSessionIdlePlugin: Plugin = async (ctx) => {
  return {
    event: async ({ event }) => {
      if (event.type !== "session.idle") return
      const sessionID = (event as { properties?: { sessionID?: string } }).properties?.sessionID
      if (!sessionID) return

      try {
        const res = await ctx.client.session.messages({ sessionID })
        const data = res as { 200?: Array<{ info: { role?: string }; parts: Array<{ type?: string; text?: string }> }> }
        const messages = data?.200 ?? []
        const lines: string[] = ["# Session\n", `sessionID: ${sessionID}\n`]
        for (const m of messages) {
          const role = m.info?.role ?? "unknown"
          for (const part of m.parts ?? []) {
            if (part.type === "text" && part.text) {
              lines.push(`## ${role}\n\n${part.text}\n`)
            }
          }
        }
        const body = lines.join("\n")
        const dir = join(tmpdir(), "opencode-loom")
        await mkdir(dir, { recursive: true })
        const filePath = join(dir, `session-${sessionID.slice(0, 8)}.md`)
        await writeFile(filePath, body, "utf-8")

        const title = `Session ${new Date().toISOString().slice(0, 10)} ${sessionID.slice(0, 8)}`
        await ctx.$`cd ${ctx.directory} && (loom ingest-from-file --file ${filePath} --category threads --title ${title} || npx loom-memory ingest-from-file --file ${filePath} --category threads --title ${title})`
      } catch (e) {
        console.error("[loom-session-idle]", e)
      }
    },
  }
}
```

说明：

- 仅做示例：未处理 `client.session.messages` 的实际响应类型（可能带 `directory` 等），实际使用时建议补全类型或做安全解析。
- 写入的是「原始消息拼接」的 Markdown；若希望只写摘要，可改为调 `ctx.client.session.summarize({ sessionID })` 并用返回内容写文件再 ingest。
- `ctx.directory` 即当前 OpenCode 项目目录，一般也是 Loom 的工程根；若你的 Loom 根不在 `ctx.directory`，需在 `$` 里先 `cd` 到正确路径。

---

## 4. 使用步骤小结

1. 在**使用 OpenCode 的项目**中创建 `.opencode/plugins/`，放入上述插件（或从 Loom 仓库复制）。
2. 若插件用 TS，确保该目录或全局 OpenCode 能解析 TypeScript（OpenCode 默认用 Bun 加载插件）。
3. 在本机安装 Loom CLI：`npm i -g loom-memory` 或在项目中 `npx loom-memory`。
4. 在该项目中初始化 Loom（若尚未）：`loom init`，保证有 `.loom`。
5. 启动 OpenCode，正常对话；会话结束（session.idle）时插件会自动拉取消息并执行 `loom ingest-from-file`。

这样即可在不依赖 MCP、不依赖 AI 主动调工具的前提下，用 OpenCode 的 **hooks（session.idle）+ 插件 + Loom CLI** 实现「会话结束自动写入 .loom」。
