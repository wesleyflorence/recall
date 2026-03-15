#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

mkdir -p "${HOME}/Library/Logs/recall"
git pull
bun install
bun run build
launchctl unload ~/Library/LaunchAgents/com.wesleyflorence.recall.plist 2>/dev/null || true
launchctl load ~/Library/LaunchAgents/com.wesleyflorence.recall.plist
