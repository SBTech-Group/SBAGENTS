#!/usr/bin/env bash
# Copia os agentes do SBAGENTS para ~/.claude/agents (macOS/Linux/WSL).
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
dest="$HOME/.claude/agents"
mkdir -p "$dest"
for dir in "$root"/agents/*/; do
  name="$(basename "$dir")"
  if [ -f "$dir/prompt.md" ]; then
    cp "$dir/prompt.md" "$dest/$name.md"
    echo "instalado: $name -> $dest/$name.md"
  fi
done
echo "Pronto. Abra o Claude Code e confira com /agents."
