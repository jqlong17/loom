#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
SOURCE="$ROOT/scripts/hooks/post-commit"
TARGET="$ROOT/.git/hooks/post-commit"

if [[ ! -f "$SOURCE" ]]; then
  echo "Hook template not found: $SOURCE"
  exit 1
fi

cp "$SOURCE" "$TARGET"
chmod +x "$TARGET"

echo "Installed Git hook: $TARGET"
echo "Behavior: post-commit will auto refresh CHANGELOG.md in working tree (no auto-commit)."

