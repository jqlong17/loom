# 工具说明

提交已有 probe 会话的回答，将问答写入 Loom（通常为 threads）。

## 参数：session_id

`loom_probe_start` 返回的会话 id。

## 参数：answers

回答列表；推荐用 `question_id` 映射，也可用与问题完全一致的 `question` 文本。

## 参数：title

可选：写入的 thread 标题，默认 `probe-session-<id>`。

## 参数：tags

可选额外标签。

## 参数：commit

是否自动 git 提交（默认 true）。
