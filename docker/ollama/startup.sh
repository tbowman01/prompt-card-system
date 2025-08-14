#!/bin/bash

# Startup script for Ollama with background model downloading
set -e

echo "🚀 Starting Ollama server..."

# Start Ollama in the background
/bin/ollama serve &
OLLAMA_PID=$!

# Wait for Ollama to be ready
echo "⏳ Waiting for Ollama to be ready..."
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:11434/api/version > /dev/null 2>&1; then
        echo "✅ Ollama is ready!"
        break
    fi
    sleep 2
    attempt=$((attempt + 1))
done

if [ $attempt -eq $max_attempts ]; then
    echo "❌ Ollama failed to start within 60 seconds"
    exit 1
fi

# Start background model download if enabled
if [ "${DOWNLOAD_MODELS}" = "true" ]; then
    echo "📥 Starting background model downloads..."
    /usr/local/bin/download-models.sh &
fi

# Keep the container running
echo "🎯 Ollama server is running on port 11434"
wait $OLLAMA_PID