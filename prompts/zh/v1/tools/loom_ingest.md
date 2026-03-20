# 工具说明

CLI 风格的一次性写入：lint + 编织 + 索引（可选 changelog/commit）。与核心 ingest 管线一致。

## 参数：category

`concepts` | `decisions` | `threads`

## 参数：title

条目标题。

## 参数：content

Markdown 正文。

## 参数：tags

可选标签列表。

## 参数：links

可选关联路径列表。

## 参数：domain

可选领域。

## 参数：mode

`replace` | `append` | `section`

## 参数：commit

是否自动 git 提交（默认 true）。

## 参数：changelog

是否更新公开 CHANGELOG（默认 false）。

## 参数：changelogDate

变更日志聚合日期，格式 `YYYY-MM-DD`。
