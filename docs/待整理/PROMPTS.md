# 提示词统一管理与版本对比

本文约定：**仅管理会影响产品使用效果的 MCP 侧文案**（工具说明、参数说明、`loom-instructions` 等）。README 安装说明、`.cursorrules` 等不在此列（`.cursorrules` 已从仓库移除；Cursor 用户可选用 `docs/CURSOR_HINTS.md` 自行粘贴到编辑器规则）。

**与「直接改文件」的关系**：写入 `.loom/` 知识条目的能力本身已由 **`loom_weave`**（及 ingest 等）提供；提示词中已要求：在 MCP 可用时**优先用工具写入**，而不是用编辑器内置写文件改 `.loom`，以便走 lint / `index.md` / Git / events。若 Agent 仍常绕过 MCP，属于宿主侧工具编排问题，可强化用户规则（见 `CURSOR_HINTS.md`）。

## 1. 目标

- **单一事实源**：文案集中在仓库内，便于迭代。
- **版本可切换**：同一套测试/同一操作路径，可切 `promptVersion` 做对比。
- **非技术可改**：正文以 **Markdown** 维护；代码只负责加载与占位符替换。
- **当前全中文**；结构上预留 **locale**（未来最多 `zh` / `en`）。

## 2. 目录约定（建议）

```
prompts/
  manifest.json              # 注册可用版本与默认版本
  zh/
    v1/
      meta.json              # 可选：human label、changelog 摘要
      loom-instructions.md   # 对应 MCP 资源 loom-instructions
      tools/
        loom_weave.md        # 工具级：说明 + 各参数段落
        loom_trace.md
        ...
```

`manifest.json` 示例：

```json
{
  "defaultVersion": "v1",
  "versions": ["v1", "v2"],
  "locales": ["zh"]
}
```

## 3. 配置（`.loomrc.json`）

```json
{
  "promptVersion": "v1",
  "promptLocale": "zh",
  "mcpReadLimits": {
    "listMaxEntries": 100,
    "traceDefaultLimit": 10,
    "indexFullMaxChars": 16000
  }
}
```

- **`promptVersion`**：选用哪套提示词目录（如 `v1`、`v2`）。
- **`promptLocale`**：预留；当前固定 `zh` 即可，未来加 `en` 时并列 `prompts/en/v1/`。
- **`mcpReadLimits`**（可选）：控制 MCP **读路径**默认上界，降低单次 tool 返回对模型上下文的占用。缺省见 `src/config.ts` 中 `MCP_READ_LIMITS_DEFAULTS`。可用环境变量覆盖：`LOOM_MCP_LIST_MAX_ENTRIES`、`LOOM_MCP_TRACE_DEFAULT_LIMIT`、`LOOM_MCP_INDEX_FULL_MAX_CHARS`（正整数）。

**覆盖优先级**：`LOOM_PROMPT_VERSION` / `LOOM_PROMPT_LOCALE`（环境变量）> `.loomrc.json` 的 `promptVersion` / `promptLocale` > `manifest.defaultVersion` / `manifest.locales[0]`。便于 CI / 脚本里「同一命令跑两遍、只改环境变量」做 A/B。

### 3.1 上下文与 Token：分层责任（宿主 vs Loom）

| 侧 | 主要负责什么 | 典型手段 |
|----|----------------|----------|
| **Loom** | 单次 **tool 返回体** 默认有界；工具说明/资源正文长度（`prompts/`）；错误信息不过度冗长 | `mcpReadLimits`（`loom_list` 条数上限、`loom_trace` 默认 `limit`、`loom_index` 中 Full Index 字符上限）；渐进披露（先 index / trace，再 `loom_read`） |
| **宿主（以 OpenCode 为主；亦含 Cursor 等其它 MCP 客户端）** | **连接后常驻**的工具 schema + 描述总体积；多轮对话 **历史裁剪 / compaction**；多 MCP 并存时的上下文叠加 | `opencode.json`、Agent 与权限、系统提示、插件等（因客户端而异） |

**说明**：磁盘上的 `fullConversationLogging` 等全量落盘 **不等于** 进入模型上下文；与「单次 MCP 返回」需分开理解。

## 4. Markdown 文件内结构（建议）

每个工具一个 `tools/<tool_name>.md`，用统一标题，便于解析与非技术编辑：

```markdown
# 工具说明

（给模型看的工具级 description，一段或多段）

## 参数：category

（对应 zod 字段说明）

## 参数：title

...
```

`loom-instructions.md` 即为当前 `loom-instructions` 资源的正文（全中文）。

解析策略（已实现，`src/prompt-loader.ts`）：按 `## 参数：xxx` 切分；工具说明为 `# 工具说明` 下至第一个 `## 参数` 之前。若某工具/参数段落缺失，**回退到代码里为该工具保留的英文 fallback**（保证 MCP 仍可启动）；`loom-instructions.md` 缺失时回退到 `src/index.ts` 内 `FALLBACK_LOOM_INSTRUCTIONS`。

## 5. 效果对比流程（你关心的 A/B）

**人工主观为主**时，推荐固定流程：

1. 准备两套目录：`prompts/zh/v1/`、`prompts/zh/v2/`（仅差异文案）。
2. **同一测试用例**跑两次：
   - 第一次：`LOOM_PROMPT_VERSION=v1`（或在 `.loomrc.json` 写 `v1`）启动 MCP / 跑集成测试。
   - 第二次：`LOOM_PROMPT_VERSION=v2` 同样再跑一遍。
3. 记录：同一会话或同一 `run-eval` 输出、以及你主观感受（是否更爱调用 weave、摘要质量等）。

后续接指标（B）时：同一脚本里对 `v1`/`v2` 各跑一遍，对比 `events.jsonl`、`raw_conversations`、M2/M4 等。

## 6. 与代码的关系

- `src/prompt-loader.ts`：`loadPromptBundle()` 读取 `manifest.json`、`.loomrc.json` 与环境变量，加载 `tools/*.md` 与 `loom-instructions.md`。
- `src/index.ts`：`main()` 中 `loadConfig` → `loadPromptBundle` → `registerLoomToolDefinitions(bundle)` → `registerLoomPrompt(bundle)` → `connect`；工具 `description` / 参数 `.describe` 与 `loom-instructions` 正文来自 bundle（见上节 fallback）。

## 7. 非技术人员改文案

- 只改 `prompts/zh/<version>/**/*.md`，提 PR。
- `manifest.json` 的 `versions` 中登记新版本后，复制一套目录（如 `v1` → `v2`），再在 `.loomrc.json` 将 `promptVersion` 切到新目录名即可试用。
