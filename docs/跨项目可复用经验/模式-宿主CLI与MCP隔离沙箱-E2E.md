# 模式：宿主 CLI + MCP 的隔离沙箱 E2E

本文沉淀一种 **跨业务项目可复用** 的端到端测试思路：**在隔离目录中模拟「真实用户只说一句」**，驱动 **真实宿主进程** 连接 **真实 stdio MCP 子进程**，对 **真实模型 API**（若需要）走完整链路，并把 **可审计产物** 落盘。该模式的价值不限于「记忆库 / Loom」本身，任何「编辑器或 CLI 宿主 + MCP 工具」组合都可按同一骨架迁移。

---

## 1. 模式定义（What）

| 要素 | 含义 |
| --- | --- |
| **隔离沙箱** | 每次或每轮测试使用 **独立目录** 作为「项目根」，其中的 MCP 配置、工作区数据（如 `.loom`、`node` 写盘路径）与开发者日常仓库 **完全隔离**。 |
| **真实 MCP** | 子进程执行 **与生产一致** 的入口（如 `node dist/index.js`），通过 `environment` 将工作目录指向沙箱，避免污染用户主项目。 |
| **真实宿主** | 使用目标产品的 **官方或源码 CLI** 发起 **非交互** 单轮（或多轮脚本循环）对话，而不是在测试里 mock `tools/call`。 |
| **可断言层** | 在 **不解析私有二进制协议** 的前提下，断言 **宿主 stdout/stderr** 中出现的 **工具调用痕迹**（如 `loom_loom_index`），并可选断言 **宿主侧日志文件**（如上下文请求 JSONL）。 |
| **结果归档** | 每次运行生成 **带时间戳与随机后缀** 的结果目录，保存每用例输出、清单与日志副本，便于 diff 与事后审计。 |

**与单元测试的分工**：单元测试保 **MCP 协议与业务逻辑**；本模式保 **「宿主 + 模型 + MCP + 文件系统」** 的集成行为。

---

## 2. 为什么值得单独沉淀（Why）

1. **复现成本高**：集成问题往往只在「真宿主 + 真 Key + 真子进程」下出现，纯 mock 测不到。  
2. **环境差异大**：非 TTY、错误 CLI 参数、全局配置路径，会导致「本地能跑、CI 或脚本挂死」的假阴性。  
3. **可迁移**：沙箱生成、用例清单、runner、结果目录结构 **与业务领域无关**；换掉宿主命令与 MCP 启动方式即可套到别的项目。

---

## 3. 实施清单（How：给另一项目的执行顺序）

按顺序完成下列步骤，即可在 **任意仓库** 落地同类 E2E。

### 3.1 约定环境变量

| 变量 | 用途 |
| --- | --- |
| 宿主源码根或包路径 | 例如 OpenCode 的 `packages/opencode`，供 runner 调用 `bun …/src/index.ts run`。 |
| 沙箱父目录 | 如仓库内 `.sandbox-output/`，已加入 `.gitignore`。 |
| 可选：日志目录 | 宿主若支持「请求上下文落盘」，设独立变量指向沙箱内子目录，便于与结果打包。 |

### 3.2 一键生成沙箱目录

脚本应完成：

1. 创建空目录作为 **项目根**。  
2. 写入宿主识别的项目级配置（如 `opencode.json`），其中 **仅声明 MCP**：`command` + `environment` 把 MCP 工作目录钉死在沙箱。  
3. 调用 **业务侧初始化命令**（如 `loom-cli init`），在沙箱内生成数据骨架。  

**原则**：脚本内 **不要** 依赖用户 `cd` 到沙箱后再手抄配置，避免漂移。

### 3.3 用例与断言策略

1. 用 **JSON 或 NDJSON** 维护用例：`id`、自然语言 `prompt`、**期望在合并输出中出现的子串**（如工具行前缀）。  
2. **不要** 在 E2E 中断言模型遣词造句，只断言 **工具曾被调度**（stdout 里宿主打印的工具名）或 **落盘文件存在**。  
3. 多轮依赖顺序的用例（先写后查）放在 **同一沙箱、同一 runner 进程内** 顺序执行，避免每用例新建沙箱导致状态不连续（按产品需求二选一：每套件一新沙箱 vs 每用例一新沙箱）。

### 3.4 非交互运行宿主（关键）

1. **消息用位置参数传递**，勿与宿主 CLI 中 **`-m` = model** 等缩写冲突。  
2. **stdin**：若宿主实现为「非 TTY 时读取 stdin 直到 EOF」，在脚本中必须 **`stdin: ignore` 或 `< /dev/null`**，否则子进程会 **无限阻塞**，表现为超时或 Aborted。  
3. **模型与 Key**：优先依赖宿主 **全局用户配置目录**（与安装方式无关）；文档中写明 **XDG/平台路径** 与 **项目配置覆盖顺序**，避免「源码版读不到 Key」的误判。

### 3.5 结果目录规范

建议每次运行创建：

```text
<results-root>/run-YYYYMMDD-HHmmss-<6位hex>/
  manifest.json          # 机器可读总览
  SUMMARY.md             # 人类可读摘要
  cases/<id>/stdout.txt
  cases/<id>/stderr.txt
  cases/<id>/case.json   # prompt、期望、exit、耗时等
  context-request-log/   # 若有：从沙箱复制的 JSONL
```

另写 `_latest.txt` 记录最近一次 `run-*` 目录名，便于自动化取用。

### 3.6 CI 与跳过开关

提供 **`E2E_SKIP_*=1`** 时 **0 退出码直接跳过**，避免无 Key 的流水线失败；默认 **不** 把此类 E2E 绑进常规单元测试命令。

---

## 4. 易踩坑速查

| 现象 | 常见原因 | 对策 |
| --- | --- | --- |
| 子进程永远无输出 | 非 TTY + `read stdin` 阻塞 | `stdin ignore` 或 `< /dev/null` |
| 模型未调用、乱报错 | 把用户话传成了 `--model` | 查宿主 `run --help`，消息用位置参数 |
| MCP 从未连接 | 宿主未在 **沙箱根** 加载项目配置 | `run --dir <sandbox>` 或等价 |
| 断言找不到工具名 | MCP 在宿主侧工具名带 **服务器名前缀** | 用实际 stdout 中的前缀（如 `loom_loom_index`） |
| 沙箱 Git 初始化失败 | 沙箱在 **被 ignore 的目录** 里，`git add` 报错 | 与产品无关时可忽略；要绿可改为沙箱内 `git init` 不 add 忽略路径，或改 `LOOM_WORK_DIR` 到非 ignore 路径（按项目策略） |

---

## 5. Loom 仓库中的对照实现（复制清单）

以下路径均以 **Loom 仓库根** 为相对路径，便于另一项目的 AI 或开发者 **逐文件对照**。

| 角色 | 路径 | 说明 |
| --- | --- | --- |
| 沙箱生成 | `scripts/opencode-loom-sandbox/setup.sh` | 写 `opencode.json`、`.loomrc.json`，`LOOM_WORK_DIR` 指向沙箱并 `loom-cli init` |
| 用例定义 | `tests/e2e-opencode-sandbox/cases.json` | `id` / `prompt` / `expectStdoutContains` |
| Runner | `tests/e2e-opencode-sandbox/runner.mjs` | 建沙箱、调 setup、循环 `bun` + `run`、`stdio` stdin ignore、写 `results/run-*`、复制 `context-request-log` |
| 结果约定 | `tests/e2e-opencode-sandbox/results/README.md` | 命名规范与目录树说明 |
| 入口说明 | `tests/e2e-opencode-sandbox/README.md` | 环境变量、`npm run test:e2e-opencode`、`--only=` |
| 产品侧演练文档 | `docs/技术文档/OpenCode-Loom-MCP-演练沙箱.md` | 序列图、全局配置与源码版共用路径、**§4.1** 非交互坑、`OPENCODE_CONTEXT_LOG_DIR` |
| 上下文日志设计 | `docs/执行计划/03-opencode-context-request-logging.md` | 与 OpenCode 源码侧 `requests.jsonl` 格式对齐（宿主需自行合并） |
| 离线样例（无模型） | `scripts/reproduce-opencode-context-log-sample.sh`、`npm run demo:opencode-context-log` | 仅验证日志管线，不启动 MCP 对话 |

**npm 脚本**：`package.json` 中 `test:e2e-opencode`、`sandbox:opencode`。

---

## 6. 迁移到其他宿主时的替换点

| 保持不变 | 按宿主替换 |
| --- | --- |
| 沙箱目录生成、MCP `command` + `env`、用例 JSON、结果目录结构、stdin 处理思路 | 可执行文件与参数（如 `cursor`、`claude`、其他 `agent run`）、项目级配置文件名、日志环境变量名 |

迁移时建议 **先** 用手动一条命令在沙箱根跑通，再把该命令 **原样封进 runner**，最后再加用例与归档。

---

## 7. 小结

该模式的核心不是「Loom」，而是：**隔离数据 + 真实子进程 MCP + 真实宿主非交互一轮 + 可重复的结果目录**。把本文 **§3 清单** 与 **§5 路径** 交给其他项目的 AI 或同事，即可在较低沟通成本下复现同类 E2E。
