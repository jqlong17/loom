# Loom

**Weaving ephemeral AI chats into a persistent system mind.**

Loom is a **CLI-first** long-term memory system, with compatible MCP (Model Context Protocol) installation support. It turns your AI conversations into a structured, version-controlled Markdown knowledge base; runs locally, uses your editor's built-in AI (no API key needed), and syncs via Git for team collaboration.

> npm package name: `loom-memory` (product name remains Loom).

## Why Loom?

Every time you discuss architecture, debug a tricky issue, or explore a new feature with an AI assistant, valuable knowledge is created — and then lost when the chat window closes.

Loom captures that knowledge automatically:

- **Conversations become documentation** — AI calls `loom_weave` to persist insights as Markdown
- **Zero extra cost** — Loom uses your editor's AI (Cursor, VS Code Copilot, Claude Code, OpenCode, Codex), no separate API key
- **Git-native** — Every knowledge update is a commit; team members share a living knowledge base
- **Human-readable** — Plain Markdown files you can browse, edit, and review like any code

## Quick Start

### 1. Install (npm recommended)

```bash
# Global install (recommended for OpenCode / terminal usage)
npm install -g loom-memory

# Verify
loom-cli help
```

### 1.1 Build from source (for contributors)

```bash
git clone https://github.com/jqlong17/loom
cd loom
npm install
npm run build
```

### 2. Configure Your AI Tool

Replace the paths below with your actual paths.

<details>
<summary><b>Cursor</b></summary>

Add to `.cursor/mcp.json` in your project root (if globally installed, use `loom` directly):

```json
{
  "mcpServers": {
    "loom": {
      "command": "loom",
      "args": [],
      "env": {
        "LOOM_WORK_DIR": "/your/project/root"
      }
    }
  }
}
```

</details>

<details>
<summary><b>VS Code (Copilot)</b></summary>

Add to `settings.json` (if not globally installed, keep using `node + dist/index.js`):

```json
{
  "github.copilot.chat.mcp.servers": {
    "loom": {
      "command": "loom",
      "args": [],
      "env": {
        "LOOM_WORK_DIR": "/your/project/root"
      }
    }
  }
}
```

</details>

<details>
<summary><b>Claude Code</b></summary>

Register with a single command:

```bash
claude mcp add --transport stdio --scope user \
  --env LOOM_WORK_DIR=/your/project/root \
  loom -- node /absolute/path/to/loom/dist/index.js
```

Or manually edit `~/.claude.json` or `.mcp.json` at project root:

```json
{
  "mcpServers": {
    "loom": {
      "command": "node",
      "args": ["/absolute/path/to/loom/dist/index.js"],
      "env": {
        "LOOM_WORK_DIR": "/your/project/root"
      }
    }
  }
}
```

Scopes: `--scope local` (current project), `--scope project` (team-shared, commit to git), `--scope user` (all projects).

</details>

<details>
<summary><b>OpenCode</b></summary>

Add to the `mcp` field in `opencode.json` at your project root:

```json
{
  "mcp": {
    "loom": {
      "type": "local",
      "command": ["node", "/absolute/path/to/loom/dist/index.js"],
      "enabled": true,
      "environment": {
        "LOOM_WORK_DIR": "/your/project/root"
      }
    }
  }
}
```

Or add to global config at `~/.config/opencode/opencode.json` to enable for all projects.

</details>

<details>
<summary><b>Codex CLI (OpenAI)</b></summary>

Register interactively:

```bash
codex mcp add loom
```

Select `STDIO` type, enter command `node /absolute/path/to/loom/dist/index.js`, and set env `LOOM_WORK_DIR=/your/project/root`.

Or edit `~/.codex/config.toml` directly:

```toml
[mcp_servers.loom]
type = "stdio"
command = ["node", "/absolute/path/to/loom/dist/index.js"]

[mcp_servers.loom.environment]
LOOM_WORK_DIR = "/your/project/root"
```

</details>

<details>
<summary><b>OpenClaw (No MCP Support)</b></summary>

If OpenClaw does not support MCP yet, use Loom CLI Wrapper directly:

```bash
# After global install
loom-cli trace --query "auth architecture" --json
```

Recommended command patterns for OpenClaw:

- Write knowledge: `loom-cli weave --category concepts --title "..." --content "..." --tags a,b --mode append --json`
- Search knowledge: `loom-cli trace --query "..." --category concepts --limit 5 --json`
- Audit knowledge: `loom-cli reflect --maxFindings 20 --json`

> Note: CLI Wrapper is a compatibility layer and does not depend on MCP support.

</details>

### 2.5 AI-First Auto-Install Protocol (for any AI)

When a user only shares the repo link (for example `https://github.com/jqlong17/loom`), ask the AI to follow this exact protocol:

```text
[ROLE]
You are the Loom installation assistant.

[INPUT]
User provided GitHub link: https://github.com/jqlong17/loom

[STEP 1 - Intro]
Explain Loom in 2-3 sentences:
- It is an MCP + Markdown + Git long-term memory system
- It turns AI conversations into a traceable knowledge base

[STEP 2 - Consent]
You MUST ask for installation consent before running any command:
"Do you want me to install Loom now? I will detect your client capability first and choose MCP or CLI Wrapper automatically."

[STEP 3 - Install Path]
If user confirms:
- If client supports MCP: use MCP setup
- If client does not support MCP (e.g. OpenClaw): switch to CLI Wrapper

[STEP 3.5 - Scope Decision (REQUIRED)]
- Default to `project-first` scope
- Use global scope only when user explicitly asks for "global install"
- Require a second confirmation before switching from project to global

[STEP 4 - Verification Output]
After installation, output:
- Which config files were changed
- Which commands/tools are now available
- One minimal verification command

[STEP 5 - If user declines]
- Return only minimal setup instructions
- Do not write or modify files
```

Recommended verification commands:

```bash
# MCP path
Call loom_list or loom_trace in chat

# CLI Wrapper path
./dist/cli.js trace --query "loom architecture" --json
```

> Goal: enforce a consistent "intro -> consent -> install -> verify" behavior across different AI clients.

### 2.6 Install Scope Policy (Project-First)

To avoid ambiguity around "global vs project", Loom uses an explicit policy:

- Default installation scope: `project`
- Use `global` only when user explicitly requests global install
- Scope switch (project -> global) must require an extra confirmation

Machine-readable policy file: `INSTALL_POLICY.json`

### 3. Use

Once configured, Loom tools are available in your AI chat:

```
"Initialize the Loom knowledge base for this project."
"Loom this — record our discussion about the payment flow."
"Append today's findings to the existing payment-flow entry."
"Deprecate the old auth flow and link to the new one."
"What does Loom know about our auth system?"
```

### 4. Advanced Usage

- `loom_weave` supports `mode`:
  - `replace`: full overwrite (default)
  - `append`: add new content below existing knowledge
  - `section`: replace or append a matching `##` section
- `loom_weave` also supports graph backbone fields:
  - `domain`: macro area (e.g. `architecture` / `product` / `operations`)
  - `links`: related entry paths (e.g. `concepts/three-layer-architecture`)
- `loom_trace` supports `category`, `tags`, and `limit` for focused retrieval
- `loom_deprecate` marks outdated entries as deprecated and can point to `superseded_by`
- `loom_probe` provides the active questioning state machine (current MCP entry):
  - Step 1: call with `record=false` and `context` to generate questions and a `session_id`
  - Step 2: call with `record=true` and `session_id + answers` to persist Q&A into `threads`
  - If `session_id` is omitted but `context` is provided, Loom auto-creates a session before commit
  - Memory Lint runs before write; ERROR-level issues block writes with actionable suggestions
- `loom_changelog` maintains public `CHANGELOG.md` grouped by date:
  - `mode=auto`: infer daily core changes from git commits
  - `mode=manual`: provide highlight points explicitly
- `loom_upgrade` upgrades the Loom MCP installation itself from Git:
  - `dryRun=true`: check upgrade readiness only
  - default: execute real `git pull` upgrade

### 4.1 Progressive Disclosure (Recommended Read Strategy)

Ask AI to read Loom memory in this order before answering:

1. Call `loom_index` first (global map + mandatory set)
2. Mandatory set includes:
   - latest 5 memory entries (including threads)
   - all concepts tagged `core`
3. Call `loom_trace` for problem-specific candidate entries
4. Call `loom_read` only when details are required

Notes:
- `loom_index` returns truncated snippets to keep short-term context efficient
- Expand to full documents only when snippets are insufficient
- `loom_weave` supports `is_core=true` to force core-tagging foundational concepts

### 4.2 Macro Graph Backbone (Technical + Business)

Loom now auto-creates:

- `.loom/schema/technical.md`: technical graph backbone (modules, services, dependencies, impacts)
- `.loom/schema/business.md`: business graph backbone (goals, constraints, capabilities, outcomes)

For `concepts` / `decisions`, prefer adding `domain` and `links` so memory forms explicit graph edges.

`loom_reflect` now also checks:

- `dangling_link`: a link target does not exist
- `isolated_node`: entry has no incoming/outgoing links (except `core` entries)

### 4.3 CLI-First (Recommended Automation Path)

For reliable triggering, scripting, and CI integration, prefer CLI workflows:

- `ingest`: one command for lint + weave + index (optional changelog/commit)
- `doctor`: unified health check with gate control via `--failOn`

Examples:

```bash
# One-shot ingestion (no commit, inspect output first)
node dist/cli.js ingest \
  --category concepts \
  --title "Payment Flow Boundary" \
  --content "## Context\n...\n\n## Conclusion\n..." \
  --tags architecture,payment \
  --domain architecture \
  --links concepts/three-layer-architecture,decisions/why-mcp-over-vs-code-plugin \
  --commit false \
  --json

# Health gate (exit code 2 on error-level findings)
node dist/cli.js doctor --failOn error --json
```

### 4.4 CLI-first + MCP-adapter Architecture

The codebase now follows a "capability-down, adapter-up" structure:

- `src/core/`: shared core pipelines (e.g., ingest / doctor)
- `src/app/usecases/`: use-case layer with unified application results
- `src/cli.ts`: primary entrypoint for reliable automation
- `src/index.ts`: MCP adapter mapping chat tools to the same use-cases

This avoids logic drift between CLI and MCP paths and improves long-term regression consistency.

## MCP Tools

| Tool | Description |
|------|-------------|
| `loom_init` | Initialize `.loom/` directory structure in the project |
| `loom_weave` | Write a knowledge entry (concept, decision, or thread) |
| `loom_ingest` | One-shot pipeline (lint + weave + index, optional changelog/commit) |
| `loom_doctor` | Run memory health gate with structured severity output |
| `loom_trace` | Search the knowledge base by keyword |
| `loom_read` | Read the full content of a specific entry |
| `loom_index` | Read global index + mandatory-read set (first step) |
| `loom_list` | List all entries in the knowledge base |
| `loom_sync` | Pull + push with the remote Git repository |
| `loom_log` | Show Git history of knowledge changes |
| `loom_deprecate` | Mark an entry deprecated with reason and optional replacement pointer |
| `loom_reflect` | Run a self-audit for conflicts, stale entries, missing tags, and merge candidates |
| `loom_probe_start` | Start an active inquiry session and persist generated questions |
| `loom_probe_commit` | Commit answers and write Q&A back into threads (explicit 2-phase flow) |
| `loom_probe` | Active inquiry + memory persistence (same tool for start/commit) |
| `loom_changelog` | Maintain public CHANGELOG grouped by day-level core changes |
| `loom_metrics_snapshot` | Generate metrics snapshot JSON for governance and auxiliary metrics |
| `loom_metrics_report` | Generate weekly metrics report draft for review and decisions |
| `loom_events` | Query append-only event stream with filters |
| `loom_upgrade` | Upgrade Loom MCP installation itself from GitHub |

## CLI Commands (`node dist/cli.js <command>`)

`init`, `weave`, `ingest`, `probe-start`, `probe-commit`, `metrics-snapshot`, `metrics-report`, `events`, `closeout`, `trace`, `read`, `list`, `deprecate`, `reflect`, `doctor`, `sync`, `log`, `changelog`, `upgrade`

## Knowledge Categories

- **concepts/** — System architecture, business logic, terminology, modules
- **decisions/** — ADR-style records: why a technology or approach was chosen
- **threads/** — Conversation summaries, discussion notes, meeting records

## Directory Structure

```
.loom/
├── index.md          # Auto-generated index of all knowledge
├── schema/           # Macro graph skeleton
│   ├── technical.md
│   └── business.md
├── concepts/         # System concepts and definitions
│   ├── payment-flow.md
│   └── user-auth.md
├── decisions/        # Architecture Decision Records
│   └── why-postgresql.md
├── threads/          # Conversation summaries
│   └── 2026-03-18-api-design.md
├── probes/           # Probe session states
│   └── probe-xxxxx.json
├── events.jsonl      # Append-only event stream
└── metrics/          # Metrics snapshot outputs
    └── snapshot-YYYY-MM-DD.json
```

## Configuration

Create a `.loomrc.json` in your project root to customize behavior:

```json
{
  "loomDir": ".loom",
  "autoCommit": true,
  "autoPush": false,
  "branch": "main",
  "commitPrefix": "loom"
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `loomDir` | `.loom` | Knowledge base directory |
| `autoCommit` | `true` | Auto-commit after each weave |
| `autoPush` | `false` | Auto-push to remote after commit |
| `branch` | `main` | Git branch for sync operations |
| `commitPrefix` | `loom` | Prefix for commit messages |

## Team Collaboration

Loom's knowledge base is just a folder of Markdown files in your Git repo. Team collaboration works naturally:

1. **Shared repo**: `.loom/` lives alongside your source code
2. **`loom_sync`**: Pull teammates' knowledge before your session, push yours after
3. **PR review**: Knowledge updates show up in pull requests for review
4. **Conflict resolution**: Standard Git merge for Markdown files

## Public Changelog

- `CHANGELOG.md` (Chinese) is used for public daily core feature updates
- Multiple updates on the same day are merged under one date section
- Auto update options:
  - MCP tool: call `loom_changelog` with `mode=auto`
  - CLI: `npm run changelog:auto`

## Roadmap and Planning Collaboration

To keep Loom direction visible, long-term, and continuously evolvable, the repo includes:

- `docs/ROADMAP.md`: long-term product and architecture direction (continuously evolving)
- `docs/IMPLEMENTATION_PLAN.md`: executable checklist for incremental delivery
- `docs/BRAINSTORM.md`: idea backlog for early-stage proposals
- `docs/METRICS.md`: north-star metrics and weekly tracking template
- `docs/ARCHITECTURE.md`: global architecture diagrams (non-technical + technical + tool capability mapping)

Suggested collaboration flow:

1. Add ideas to `docs/BRAINSTORM.md`
2. Promote mature ideas into `docs/ROADMAP.md` via PR
3. Break down roadmap items in `docs/IMPLEMENTATION_PLAN.md`
4. Update checklist, validation notes, and metric impact in implementation PRs (see `docs/METRICS.md`)

## Development

```bash
npm run dev      # Run with tsx (hot reload)
npm run build    # Compile TypeScript
npm run watch    # Watch mode compilation
npm run lint     # Type check
npm test         # Run tests
npm run test:coverage   # Run coverage checks with thresholds
npm run test:regression # Produce reproducible logs at .test-logs/latest.log
npm run changelog:auto  # Auto-update today's core changelog section
npm run cli -- help  # Show CLI Wrapper commands
npm run release:patch # Patch release (create tag + push; triggers auto publish)
npm run release:minor # Minor release
npm run release:major # Major release
```

## npm Auto Publish (Trusted Publishing)

- Workflow: `.github/workflows/release-npm.yml`
- Trigger: push tag `v*` (for example `v0.1.1`)
- Publish mode: GitHub OIDC Trusted Publishing (no repo `NPM_TOKEN`, no per-release OTP)

One-time setup and details: `docs/RELEASE_AUTOMATION.md`

## PR Contribution Workflow

If you want to contribute via PR, use this flow:

1. Create a feature branch (prefer CLI-first path when adding capabilities)
2. Run locally:
   - `npm run build`
   - `npm run lint`
   - `npm run test:coverage`
3. For reproducibility, attach key excerpts from `.test-logs/latest.log`
4. Update README / CHANGELOG for user-visible behavior changes
5. Open PR with exact verification commands and outputs

Notes:
- Test cases are tracked in the repository (not ignored) so contributors can run the same regression suite
- Only generated test artifacts are ignored (`coverage/`, `.test-logs/`)

## License

MIT
