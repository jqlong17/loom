#!/usr/bin/env bash
# 薄封装：在仓库根执行 Node runner（便于本地 bash 习惯调用）
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
exec node tests/e2e-opencode-sandbox/runner.mjs "$@"
