# 工具说明

列出知识库条目概览。默认按 **更新时间** 从新到旧排序，且 **最多返回 `listMaxEntries` 条**（默认 100，可由项目 `.loomrc.json` 的 `mcpReadLimits.listMaxEntries` 或环境变量 `LOOM_MCP_LIST_MAX_ENTRIES` 调整）。若被截断，返回中会提示总数与本次列出条数；未列出的条目请用 `loom_trace` 或 `loom_read` 定位。
