# 工具说明

按日期维护对外 `CHANGELOG.md`。支持从当日 git 提交自动提炼要点，或手动传入 highlights。

## 参数：mode

`auto`：从 git 提交推断当日亮点；`manual`：使用 `highlights`。

## 参数：date

日期 `YYYY-MM-DD`，默认当天。

## 参数：highlights

`mode=manual` 时的要点列表。

## 参数：commit

是否自动提交 changelog 变更（默认 true）。
