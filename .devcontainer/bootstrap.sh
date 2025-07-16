#!/bin/bash
set -e

echo "🧠 Installing Claude Code..."
npm install -g @anthropic-ai/claude-code

echo "⚙️ Activating Claude..."
claude --dangerously-skip-permissions

ehco "Initialize Claude Flow with enhanced MCP setup (auto-configures permissions!)"
npx claude-flow@alpha init --force

# https://github.com/ruvnet/claude-flow