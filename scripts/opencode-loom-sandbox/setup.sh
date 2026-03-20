#!/usr/bin/env bash
# 生成「OpenCode + Loom MCP」演练目录：独立项目根 + opencode.json + 初始化 .loom
# 用法：在 Loom 仓库根执行：bash scripts/opencode-loom-sandbox/setup.sh [沙箱目录]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOOM_REPO="$(cd "$SCRIPT_DIR/../.." && pwd)"
SANDBOX="${1:-${LOOM_SANDBOX_DIR:-$HOME/loom-opencode-lab}}"
LOOM_ENTRY="$LOOM_REPO/dist/index.js"

if [[ ! -f "$LOOM_ENTRY" ]]; then
  echo "未找到 $LOOM_ENTRY ，请先在 Loom 仓库执行: npm run build" >&2
  exit 1
fi

mkdir -p "$SANDBOX"

SANDBOX="$SANDBOX" LOOM_ENTRY="$LOOM_ENTRY" node <<'NODE'
const fs = require("fs");
const path = require("path");
const sandbox = process.env.SANDBOX;
const entry = process.env.LOOM_ENTRY;
const opencode = {
  mcp: {
    loom: {
      type: "local",
      command: ["node", path.normalize(entry)],
      environment: {
        LOOM_WORK_DIR: path.normalize(sandbox),
      },
    },
  },
};
const out = path.join(sandbox, "opencode.json");
fs.writeFileSync(out, JSON.stringify(opencode, null, 2), "utf8");
console.log("Wrote", out);
NODE

LOOMRC="$SANDBOX/.loomrc.json"
if [[ ! -f "$LOOMRC" ]]; then
  cat >"$LOOMRC" <<'JSON'
{
  "fullConversationLogging": {
    "enabled": true,
    "storageDir": "raw_conversations",
    "redact": true,
    "maxPayloadChars": 50000
  }
}
JSON
  echo "Wrote $LOOMRC (fullConversationLogging on)"
fi

export LOOM_WORK_DIR="$SANDBOX"
node "$LOOM_REPO/dist/cli.js" init --json

echo ""
echo "=== 沙箱就绪 ==="
echo "目录: $SANDBOX"
echo "Loom MCP 入口: $LOOM_ENTRY"
echo "LOOM_WORK_DIR: $SANDBOX"
echo ""
echo "下一步："
echo "  1) 在本机安装/编译好 OpenCode CLI（PATH 可执行 opencode）。"
echo "  2) cd \"$SANDBOX\""
echo "  3) 启动 OpenCode，确保加载当前目录下的 opencode.json。"
echo "  4) 演练台词见 docs/技术文档/OpenCode-Loom-MCP-演练沙箱.md"
echo ""
