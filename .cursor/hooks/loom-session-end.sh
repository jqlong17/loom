#!/usr/bin/env bash
# When Cursor conversation ends and transcript is enabled, append this session to .loom as a thread.
# Requires: Cursor transcripts enabled; loom or npx loom-memory on PATH.
set -e
if [[ -n "$CURSOR_TRANSCRIPT_PATH" && -f "$CURSOR_TRANSCRIPT_PATH" ]]; then
  cd "${CURSOR_PROJECT_DIR:-.}"
  title="Session $(date '+%Y-%m-%d %H:%M')"
  if command -v loom >/dev/null 2>&1; then
    loom ingest-from-file --file "$CURSOR_TRANSCRIPT_PATH" --category threads --title "$title" 2>/dev/null || true
  elif command -v npx >/dev/null 2>&1; then
    npx loom-memory ingest-from-file --file "$CURSOR_TRANSCRIPT_PATH" --category threads --title "$title" 2>/dev/null || true
  fi
fi
exit 0
