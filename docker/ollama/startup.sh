#!/bin/bash

# Startup script for Ollama with background model downloading
set -e

echo "🚀 Starting Ollama server..."

# Start Ollama in the background
/bin/ollama serve &
OLLAMA_PID=$!

# Wait for Ollama to be ready (with shorter timeout and better feedback)
echo "⏳ Waiting for Ollama to be ready..."
max_attempts=15
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:11434/api/version > /dev/null 2>&1; then
        echo "✅ Ollama is ready!"
        break
    fi
    echo "  Attempt $((attempt + 1))/$max_attempts..."
    sleep 2
    attempt=$((attempt + 1))
done

if [ $attempt -eq $max_attempts ]; then
    echo "⚠️ Ollama took longer than expected to start"
    echo "  Continuing anyway - models will be downloaded on first use"
fi

# Download default model in background if not present
echo "🔍 Checking for default model..."
if ! ollama list 2>/dev/null | grep -q "phi"; then
    echo "📥 Downloading default model (phi4-mini-reasoning:3.8b) in background..."
    (ollama pull phi4-mini-reasoning:3.8b 2>&1 | while read line; do
        echo "  Model download: $line"
    done && echo "✅ Default model ready!") &
else
    echo "✅ Default model already available"
fi

# Start additional model downloads if enabled
if [ "${DOWNLOAD_MODELS}" = "true" ] && [ -f "/usr/local/bin/download-models.sh" ]; then
    echo "📥 Starting additional model downloads..."
    /usr/local/bin/download-models.sh &
fi

# Keep the container running
echo "🎯 Ollama server is running on port 11434"
echo "📊 API endpoint: http://localhost:11434/api"
echo "💡 Models will be downloaded on first use if not already present"
wait $OLLAMA_PID