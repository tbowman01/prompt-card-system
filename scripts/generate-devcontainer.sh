#!/bin/bash

set -e

echo "🔍 Inspecting current environment..."

# Detect installed versions
NODE_VER=$(node -v 2>/dev/null || echo "not installed")
PYTHON_VER=$(python3 --version 2>/dev/null | awk '{print $2}' || echo "not installed")
GO_VER=$(go version 2>/dev/null | awk '{print $3}' || echo "not installed")
JAVA_VER=$(java -version 2>&1 | head -n 1 | sed 's/.*"\(.*\)".*/\1/' || echo "not installed")

# List VS Code extensions
EXT_LIST=$(code --list-extensions 2>/dev/null || echo "")

# Create .devcontainer folder
mkdir -p .devcontainer

# Create devcontainer.json
cat <<EOF > .devcontainer/devcontainer.json
{
  "name": "auto-generated-devcontainer",
  "image": "mcr.microsoft.com/devcontainers/base:ubuntu",
  "features": {
    $( [[ "$NODE_VER" != "not installed" ]] && echo "\"ghcr.io/devcontainers/features/node:1\": { \"version\": \"${NODE_VER#v}\" }," )
    $( [[ "$PYTHON_VER" != "not installed" ]] && echo "\"ghcr.io/devcontainers/features/python:1\": { \"version\": \"$PYTHON_VER\" }," )
    $( [[ "$GO_VER" != "not installed" ]] && echo "\"ghcr.io/devcontainers/features/go:1\": { \"version\": \"${GO_VER#go}\" }," )
    $( [[ "$JAVA_VER" != "not installed" ]] && echo "\"ghcr.io/devcontainers/features/java:1\": { \"version\": \"$JAVA_VER\" }," )
    "_comment": "Remove this trailing comma if editing manually"
  },
  "customizations": {
    "vscode": {
      "extensions": [
$(echo "$EXT_LIST" | sed 's/^/        "/;s/$/",/' )
      ]
    }
  },
  "postCreateCommand": "echo '📦 You can add setup commands here (e.g., npm install, pip install)'"
}
EOF

echo "✅ Generated .devcontainer/devcontainer.json"
cat .devcontainer/devcontainer.json
