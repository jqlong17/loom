# E2E 运行结果目录

`runner.mjs` 每次执行（`E2E_SKIP_OPENCODE=1` 除外）会在此处新建**一层子目录**，保存当次沙箱路径、各用例的 stdout/stderr、以及 `requests.jsonl` 的副本（若存在）。

## 命名规范

子目录格式：

```text
run-{YYYYMMDD}-{HHmmss}-{suffix}
```

| 段 | 含义 |
|----|------|
| `YYYYMMDD` | **本地时区**日期 |
| `HHmmss` | **本地时区**时间（24 小时制） |
| `suffix` | 6 位小写十六进制随机数，避免同一秒内多次运行互相覆盖 |

示例：`run-20260320-213045-a1b2c3`

## 目录内文件

| 路径 | 说明 |
|------|------|
| `manifest.json` | 机器可读：时间、环境摘要、沙箱路径、各用例结果与耗时 |
| `SUMMARY.md` | 人类可读摘要 |
| `cases/<case-id>/stdout.txt` | 该用例标准输出 |
| `cases/<case-id>/stderr.txt` | 该用例标准错误 |
| `cases/<case-id>/case.json` | 该用例 prompt、期望子串、exit、缺失子串等 |
| `context-request-log/<session-id>/requests.jsonl` | 从当次沙箱复制的上下文请求日志（无则目录可能不存在或为空） |

另会写入 **`_latest.txt`**（与本目录同级逻辑在 `results/` 下）：内容为**最近一次**成功的 `run-*` 目录名，便于脚本读取。

## Git

除本 `README.md` 与 `.gitignore` 外，**默认不提交** `run-*` 产物（见 `.gitignore`）。
