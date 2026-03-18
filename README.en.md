# Loom

**Weaving ephemeral AI chats into a persistent system mind.**

Loom is an MCP (Model Context Protocol) server that turns your AI conversations into a structured, version-controlled Markdown knowledge base. It runs locally, uses your editor's built-in AI (no API key needed), and syncs via Git for team collaboration.

## Why Loom?

Every time you discuss architecture, debug a tricky issue, or explore a new feature with an AI assistant, valuable knowledge is created — and then lost when the chat window closes.

Loom captures that knowledge automatically:

- **Conversations become documentation** — AI calls `loom_weave` to persist insights as Markdown
- **Zero extra cost** — Loom uses your editor's AI (Cursor, VS Code Copilot, Claude Code, OpenCode, Codex), no separate API key
- **Git-native** — Every knowledge update is a commit; team members share a living knowledge base
- **Human-readable** — Plain Markdown files you can browse, edit, and review like any code

## Quick Start

### 1. Build

```bash
git clone <your-repo-url>
cd loom
npm install
npm run build
```

### 2. Configure Your AI Tool

Replace the paths below with your actual paths.

<details>
<summary><b>Cursor</b></summary>

Add to `.cursor/mcp.json` in your project root:

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

</details>

<details>
<summary><b>VS Code (Copilot)</b></summary>

Add to `settings.json`:

```json
{
  "github.copilot.chat.mcp.servers": {
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
# In Loom project directory
npm install
npm run build

# OpenClaw can call this command
./dist/cli.js trace --query "auth architecture" --json
```

Recommended command patterns for OpenClaw:

- Write knowledge: `./dist/cli.js weave --category concepts --title "..." --content "..." --tags a,b --mode append --json`
- Search knowledge: `./dist/cli.js trace --query "..." --category concepts --limit 5 --json`
- Audit knowledge: `./dist/cli.js reflect --maxFindings 20 --json`

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
- `loom_trace` supports `category`, `tags`, and `limit` for focused retrieval
- `loom_deprecate` marks outdated entries as deprecated and can point to `superseded_by`
- `loom_changelog` maintains public `CHANGELOG.md` grouped by date:
  - `mode=auto`: infer daily core changes from git commits
  - `mode=manual`: provide highlight points explicitly
- `loom_upgrade` upgrades the Loom MCP installation itself from Git:
  - `dryRun=true`: check upgrade readiness only
  - default: execute real `git pull` upgrade

## Tools

| Tool | Description |
|------|-------------|
| `loom_init` | Initialize `.loom/` directory structure in the project |
| `loom_weave` | Write a knowledge entry (concept, decision, or thread) |
| `loom_trace` | Search the knowledge base by keyword |
| `loom_read` | Read the full content of a specific entry |
| `loom_list` | List all entries in the knowledge base |
| `loom_sync` | Pull + push with the remote Git repository |
| `loom_log` | Show Git history of knowledge changes |
| `loom_deprecate` | Mark an entry deprecated with reason and optional replacement pointer |
| `loom_reflect` | Run a self-audit for conflicts, stale entries, missing tags, and merge candidates |
| `loom_changelog` | Maintain public CHANGELOG grouped by day-level core changes |
| `loom_upgrade` | Upgrade Loom MCP installation itself from GitHub |
| `loom-cli` | Command-line compatibility layer for OpenClaw/any non-MCP agent |

## Knowledge Categories

- **concepts/** — System architecture, business logic, terminology, modules
- **decisions/** — ADR-style records: why a technology or approach was chosen
- **threads/** — Conversation summaries, discussion notes, meeting records

## Directory Structure

```
.loom/
├── index.md          # Auto-generated index of all knowledge
├── concepts/         # System concepts and definitions
│   ├── payment-flow.md
│   └── user-auth.md
├── decisions/        # Architecture Decision Records
│   └── why-postgresql.md
└── threads/          # Conversation summaries
    └── 2026-03-18-api-design.md
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

## Development

```bash
npm run dev      # Run with tsx (hot reload)
npm run build    # Compile TypeScript
npm run watch    # Watch mode compilation
npm run lint     # Type check
npm run changelog:auto  # Auto-update today's core changelog section
npm run cli -- help  # Show CLI Wrapper commands
```

## License

MIT
