#!/usr/bin/env bash
# 生成与「真实 LLM.stream 前 fireContextRequestLog」同格式的 requests.jsonl（测试台词见脚本内 user 消息）。
# 不启动 OpenCode UI、不调模型；便于验收与文档归档。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="${OPENCODE_CONTEXT_LOG_SAMPLE_OUT:-$ROOT/.sandbox-output/opencode-context-log-sample}"
OPENCODE_ROOT="${OPENCODE_ROOT:-$HOME/开源项目/opencode}"

PKG="$OPENCODE_ROOT/packages/opencode"
SCRIPT="$PKG/script/demo-context-request-log-sample.ts"

if [[ ! -f "$SCRIPT" ]]; then
  echo "未找到: $SCRIPT" >&2
  echo "请设置 OPENCODE_ROOT 为你的 opencode 克隆根目录。" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
export OPENCODE_CONTEXT_LOG_DIR="$OUT_DIR"

echo "写入目录: $OUT_DIR"
(cd "$PKG" && bun run "$SCRIPT") | tail -n +1

echo ""
echo "结果文件（可复制路径）:"
find "$OUT_DIR" -name requests.jsonl -print
