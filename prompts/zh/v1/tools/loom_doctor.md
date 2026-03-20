# 工具说明

运行记忆库质量门禁：陈旧、孤立节点、悬空链接等，返回结构化严重级别与是否应拦截。

## 参数：staleDays

超过多少天未更新视为陈旧（可选）。

## 参数：includeThreads

是否扫描 `threads` 分类（可选）。

## 参数：maxFindings

最多返回多少条发现（可选）。

## 参数：failOn

门禁级别：`none` | `error` | `warn`（可选）。
