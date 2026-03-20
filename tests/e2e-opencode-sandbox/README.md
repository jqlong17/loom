# E2E：OpenCode（源码）+ Loom MCP 沙箱

在**独立临时沙箱目录**中通过 OpenCode 的 `run` 子命令发起真实模型请求，并断言 stdout/stderr 中出现对应 **MCP 工具行**（形如 `loom_loom_index`）。

## 前置条件

| 项 | 说明 |
|----|------|
| **Bun** | 已安装且在 `PATH` 中（用于跑 OpenCode `packages/opencode` 的 `src/index.ts`）。 |
| **OpenCode 源码路径** | 环境变量 `OPENCODE_PACKAGE_DIR` 指向 OpenCode 仓库内的 **`packages/opencode`** 目录（含 `src/index.ts`）。 |
| **模型与 Key** | 与全局 OpenCode CLI 相同，默认读取 `~/.config/opencode` 与 `~/.local/share/opencode/auth.json`。需能访问所配置的 Provider。 |
| **Loom 已构建** | 仓库根存在 `dist/index.js`；若缺失，runner 会自动执行 `npm run build`。 |

## 用例定义

- 用例列表：`cases.json`（`id`、`prompt`、`expectStdoutContains`）。
- 新增用例：编辑 `cases.json`，**prompt** 用自然语言明确要求调用某个 `loom_*` 工具；**expectStdoutContains** 至少包含 OpenCode 打印的工具名前缀（一般为 `loom_<mcp名>_<工具名>`，默认 MCP 名为 `loom` 时为 `loom_loom_index` 等）。

## 运行

在 **Loom 仓库根**：

```bash
export OPENCODE_PACKAGE_DIR="/你的路径/opencode/packages/opencode"
npm run test:e2e-opencode
```

或：

```bash
export OPENCODE_PACKAGE_DIR="/你的路径/opencode/packages/opencode"
bash tests/e2e-opencode-sandbox/run-e2e.sh
```

只跑一条用例：

```bash
node tests/e2e-opencode-sandbox/runner.mjs --only=index-mandatory-read
```

CI / 无 API Key 时跳过：

```bash
E2E_SKIP_OPENCODE=1 npm run test:e2e-opencode
```

## 行为说明

- 每次完整运行会在 `.sandbox-output/e2e-opencode-*` 下新建沙箱（目录已被仓库 `.gitignore` 忽略）。
- Runner 将 `OPENCODE_CONTEXT_LOG_DIR` 指向沙箱内的 `context-request-log/`；若你使用的 OpenCode 已合并「上下文请求日志」能力，结束后终端会列出 `requests.jsonl` 路径与行数。
- 子进程对 **stdin 使用 ignore**，避免 `opencode run` 在非 TTY 下阻塞（与文档 §4.1 一致）。

## 运行结果落盘

每次执行会在 **`results/run-YYYYMMDD-HHmmss-<6位hex>/`** 下写入（命名与树状结构见 [`results/README.md`](./results/README.md)）：

- `manifest.json` / `SUMMARY.md`：总览与通过情况  
- `cases/<用例 id>/`：`stdout.txt`、`stderr.txt`、`case.json`  
- `context-request-log/`：`requests.jsonl` 副本（若 OpenCode 支持上下文日志）  
- `results/_latest.txt`：最近一次运行的目录名（本地指针，默认不提交）

## 与 `vitest` 的关系

本目录**不**接入 `npm test`：E2E 依赖本机 OpenCode 路径、网络与 Key，默认仅在显式执行 `test:e2e-opencode` 时运行。

## 跨项目复用

通用模式（实施清单、易踩坑、本仓库对照路径表）见 [`docs/跨项目可复用经验/模式-宿主CLI与MCP隔离沙箱-E2E.md`](../../docs/跨项目可复用经验/模式-宿主CLI与MCP隔离沙箱-E2E.md)。
