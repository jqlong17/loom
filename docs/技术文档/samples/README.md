# 样例文件说明

## `context-request-one-turn.sample.json`

与 OpenCode **执行计划 03** 中 `fireContextRequestLog` 写入 **`requests.jsonl`** 的 **单行 JSON** 结构一致（已格式化便于阅读）。

- **测试用户句**（`messages` 里 `role: user`）：  
  `请调用 loom_index，把返回里「必读集合」用三句话中文概括。`
- **生成方式**：在 Loom 仓库执行 `npm run demo:opencode-context-log`（需本机存在 OpenCode 克隆，默认 `$HOME/开源项目/opencode`，可用 `OPENCODE_ROOT` 覆盖）。脚本会写入 **`.sandbox-output/opencode-context-log-sample/…/requests.jsonl`**（该目录已 `.gitignore`）。
- **与真实 OpenCode 对话的差异**：本样例为 **离线演示**（不调模型、不启 UI）；真实对话时同一格式会追加在 `$OPENCODE_CONTEXT_LOG_DIR/<会话>/requests.jsonl`，且 `messages` / `tools` 会更长。

详见：[OpenCode-Loom-MCP-演练沙箱.md](../OpenCode-Loom-MCP-演练沙箱.md) §5。
