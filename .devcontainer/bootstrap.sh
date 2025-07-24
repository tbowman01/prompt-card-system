#!/bin/bash
set -e

npm install -g npm@11
curl -LsSf https://astral.sh/uv/install.sh | sh
uv tool install claude-monitor

echo "🧠 Installing Claude Code..."
npm install -g @anthropic-ai/claude-code

echo "⚙️ Activating Claude..."
claude --dangerously-skip-permissions

ehco "Initialize Claude Flow with enhanced MCP setup (auto-configures permissions!)"
npx claude-flow@alpha init --force

# https://github.com/ruvnet/claude-flow


echo "npx claude-flow@alpha hive-mind spawn "analyze github repo, triage issues and pull requests and prompt me for your recommendation on what to tackle next" --auto-spawn --monitor "
