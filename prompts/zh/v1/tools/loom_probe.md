# 工具说明

主动澄清的兼容封装。推荐显式使用 `loom_probe_start` + `loom_probe_commit`。

## 参数：context

`record=false` 时必填：对话摘要或用户请求。

## 参数：goal

可选目标。

## 参数：max_questions

问题数量（默认 3，最大 5）。

## 参数：record

`false` 仅生成问题；`true` 将 `answers` 写入 Loom。

## 参数：session_id

已有会话 id（提交时使用）。

## 参数：answers

`record=true` 时必填：回答列表。

## 参数：title

可选 thread 标题。

## 参数：tags

可选标签。

## 参数：commit

是否自动提交（默认 true）。
