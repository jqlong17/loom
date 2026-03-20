# 工具说明

按关键词检索 Loom。在决策或回答问题前，用于回忆已记录的系统知识。

## 参数：query

关键词或短语，跨条目搜索。

## 参数：category

可选：仅检索 `concepts` | `decisions` | `threads` 之一。

## 参数：tags

可选：必须同时包含所列全部标签。

## 参数：limit

返回结果数量上限（相关性排序后截断）。**未传时**使用配置项 `mcpReadLimits.traceDefaultLimit`（默认 10），可用环境变量 `LOOM_MCP_TRACE_DEFAULT_LIMIT` 覆盖。`trace_mode=legacy` 与 `layered` 共用该默认上界。

## 参数：trace_mode

检索管线：`layered`（默认，分层索引）或 `legacy`（全量扫描 md）。
