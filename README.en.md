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

### 3. Use

Once configured, Loom tools are available in your AI chat:

```
"Initialize the Loom knowledge base for this project."
"Loom this — record our discussion about the payment flow."
"What does Loom know about our auth system?"
```

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
| `loom_reflect` | Run a self-audit for conflicts, stale entries, missing tags, and merge candidates |

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

## Development

```bash
npm run dev      # Run with tsx (hot reload)
npm run build    # Compile TypeScript
npm run watch    # Watch mode compilation
npm run lint     # Type check
```

## License

MIT
