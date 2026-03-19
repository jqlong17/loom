# Loom 技术架构图（全局总览）

本文给两层视图：

- 第一层：给非技术同学的“业务总览图”（先看整体怎么运转）
- 第二层：给技术同学的“工程细化图”（再看模块边界和数据流）

---

## 01. 业务总览图（非技术优先）

```mermaid
flowchart LR
  U[用户] --> AI[AI 助手]
  AI --> T{触发类型}

  T -->|L1 正文写入触发| P{选择入口}
  T -->|L2 流程触发| FLOW[closeout/hook/脚本]
  T -->|L3 观测触发| OBS[trace/doctor/metrics]

  P -->|对话工具| MCP[Loom MCP 工具]
  P -->|脚本/命令| CLI[Loom CLI]

  MCP --> CORE[统一能力内核]
  CLI --> CORE
  FLOW --> CORE
  OBS --> CORE

  CORE --> SAVE[记忆保存]
  CORE --> READ[记忆检索]
  CORE --> QA[质量治理]
  CORE --> METRIC[指标反馈]

  SAVE --> FS[.loom Markdown 知识库]
  READ --> FS
  QA --> FS
  METRIC --> EVENT[events.jsonl]
  METRIC --> SNAP[metrics snapshot/report]

  FS --> GIT[Git 协作与审计]
```

### 这张图怎么理解

- Loom 不依赖单一入口：聊天里可用 MCP，自动化里可用 CLI。
- 触发分三层：L1（正文写入）、L2（流程收口）、L3（观测记录）。
- 不管从哪里进，都会走同一个能力内核，保证行为一致。
- 记忆落在本地 Markdown（`.loom`），不是黑盒数据库。
- Git 提供版本历史与团队协作；事件与指标提供可量化反馈。

---

## 02. 工程细化图（技术实现）

```mermaid
flowchart TB
  subgraph Entry[入口层]
    CLI2[src/cli.ts]
    MCP2[src/index.ts]
  end

  subgraph Adapter[适配层]
    ADP1[adapters/*]
  end

  subgraph Usecase[应用用例层]
    UC1[ingest-knowledge]
    UC2[run-doctor]
    UC3[start-probe-session]
    UC4[commit-probe-session]
    UC5[update-changelog]
    UC6[metrics-snapshot]
    UC7[query-events]
    UC8[metrics-report]
  end

  subgraph Core[核心能力层]
    C1[core/loom-core]
    C2[core/probe-core]
  end

  subgraph Domain[领域层]
    D1[domain/probe-session]
    D2[domain/quality-issue]
    CT1[contracts/application-result]
    CT2[contracts/knowledge]
  end

  subgraph Infra[基础设施层]
    W[weaver.ts]
    PBE[probe.ts]
    EVT[events.ts]
    GL[git-manager.ts]
    CH[changelog.ts]
    CFG[config.ts]
  end

  subgraph Data[数据层]
    L1[.loom/*.md]
    L2[.loom/events.jsonl]
    L3[.loom/metrics/*.json]
    L4[CHANGELOG.md]
  end

  CLI2 --> ADP1
  MCP2 --> ADP1
  ADP1 --> UC1
  ADP1 --> UC2
  ADP1 --> UC3
  ADP1 --> UC4
  ADP1 --> UC5
  ADP1 --> UC6
  ADP1 --> UC7
  ADP1 --> UC8

  UC1 --> C1
  UC2 --> C1
  UC3 --> C2
  UC4 --> C2
  UC5 --> CH
  UC6 --> C1
  UC7 --> EVT
  UC8 --> EVT

  C1 --> D1
  C1 --> D2
  C1 --> CT1
  C2 --> D1
  UC1 --> CT2
  UC2 --> CT2

  C1 --> W
  C1 --> GL
  C2 --> PBE
  UC6 --> EVT
  UC5 --> GL
  UC5 --> CH
  UC1 --> EVT
  UC2 --> EVT
  UC3 --> EVT
  UC4 --> EVT

  W --> L1
  PBE --> L1
  EVT --> L2
  UC6 --> L3
  CH --> L4
```

---

## 03. 记忆触发时序（关键路径）

```mermaid
sequenceDiagram
  participant User as 用户/AI
  participant Entry as CLI or MCP
  participant Usecase as UseCase
  participant Core as Core
  participant Store as .loom Markdown
  participant Event as events.jsonl
  participant Git as Git

  alt L1 正文写入触发（weave/ingest/probe-commit）
    User->>Entry: 发起正文写入命令
    Entry->>Usecase: 参数映射与校验
    Usecase->>Core: 执行业务规则
    Core->>Store: 写入 .loom/*.md
    Core->>Event: 追加事件
    opt 开启 commit
      Core->>Git: 提交变更
    end
  else L2 流程触发（closeout/hook/脚本）
    User->>Entry: 触发收口流程
    Entry->>Usecase: 组装多步动作
    Usecase->>Core: 执行 weave/changelog/doctor
    Core->>Store: 更新正文与索引
    Core->>Event: 追加流程事件
  else L3 观测触发（trace/doctor/metrics）
    User->>Entry: 发起检索/体检/指标命令
    Entry->>Usecase: 参数映射与校验
    Usecase->>Core: 执行查询或治理
    Core->>Event: 写入观测事件
    opt 生成快照
      Core->>Store: 写入 .loom/metrics/*.json
    end
  end
  Core-->>Usecase: 返回 ok/data/issues/artifacts/gate
  Usecase-->>Entry: 统一结构化输出
```

### 触发层定义（补充说明）

- **L1 正文写入触发**：把知识正文落到 `.loom/*.md`（核心记忆）。
- **L2 流程触发**：把“人记得做”变成“流程保证做”（closeout、hook、CI 脚本）。
- **L3 观测触发**：不一定写正文，但会记录事件/快照用于治理与复盘。

---

## 04. 架构硬核点（简版）

- **双入口同核**：CLI 与 MCP 共享同一用例/核心能力，避免逻辑分叉。
- **可审计记忆**：Markdown + Git，天然支持 review、diff、回滚。
- **可治理闭环**：doctor + events + metrics snapshot/report，支持持续优化。
- **可扩展演进**：当前已具备 domain/usecase/contracts 分层，可平滑扩到 HTTP/Daemon。

---

## 05. Tool 能力映射图（从工具看架构）

```mermaid
flowchart LR
  subgraph L1[L1 正文写入触发]
    T1[loom_weave<br/>写入知识条目]
    T2[loom_ingest<br/>一键收口写入]
    T3[loom_probe_commit<br/>提交问答并沉淀]
  end

  subgraph L2[L2 流程触发]
    T4[loom-cli closeout<br/>功能收口流程]
    T5[loom_changelog<br/>更新公开变更]
    T6[post-commit hook<br/>提交后自动触发]
  end

  subgraph L3[L3 观测与治理触发]
    T7[loom_trace<br/>检索记忆并记事件]
    T8[loom_doctor<br/>质量体检门禁]
    T9[loom_events<br/>查询事件流]
    T10[loom_metrics_snapshot<br/>生成指标快照]
    T11[loom_metrics_report<br/>生成周报草稿]
  end

  subgraph AUX[辅助工具]
    A1[loom_index<br/>索引与必读集合]
    A2[loom_read<br/>读取全文]
    A3[loom_list<br/>列出条目]
    A4[loom_log<br/>查看知识历史]
    A5[loom_sync<br/>同步远程仓库]
    A6[loom_upgrade<br/>升级 Loom 本体]
    A7[loom_deprecate<br/>标记废弃条目]
    A8[loom_probe_start<br/>启动澄清会话]
  end

  subgraph Usecase[UseCase 层]
    U1[executeIngestKnowledge<br/>统一写入用例]
    U2[executeCommitProbeSession<br/>问答提交用例]
    U3[executeUpdateChangelog<br/>变更日志用例]
    U4[executeRunDoctor<br/>治理门禁用例]
    U5[executeQueryEvents<br/>事件查询用例]
    U6[executeMetricsSnapshot<br/>快照聚合用例]
    U7[executeMetricsReport<br/>报告生成用例]
    U8[executeStartProbeSession<br/>澄清启动用例]
  end

  subgraph Data[数据产物]
    D1[.loom/*.md<br/>知识正文]
    D2[events.jsonl<br/>事件事实源]
    D3[metrics snapshot/report<br/>指标快照与报告]
    D4[CHANGELOG.md<br/>公开变更记录]
    D5[Git commits<br/>可审计历史]
  end

  T1 --> U1
  T2 --> U1
  T3 --> U2
  T4 --> U1
  T4 --> U3
  T5 --> U3
  T6 --> U3
  T7 --> U5
  T8 --> U4
  T9 --> U5
  T10 --> U6
  T11 --> U7
  A8 --> U8

  U1 --> D1
  U1 --> D2
  U2 --> D1
  U2 --> D2
  U3 --> D4
  U3 --> D2
  U4 --> D2
  U5 --> D2
  U6 --> D3
  U6 --> D2
  U7 --> D3

  D1 --> D5
  D4 --> D5
```

### 一句话看懂这张图

- 工具不是孤立能力：每个 tool 都映射到统一 usecase，再统一沉淀到 Markdown/事件/指标/Git 产物。
