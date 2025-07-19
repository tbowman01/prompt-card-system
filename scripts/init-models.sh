#!/bin/bash

# Model Initialization Script for Development

set -e

echo "🔄 Initializing Ollama models for development..."

# Wait for Ollama to be ready
echo "⏳ Waiting for Ollama service to start..."
until curl -s http://ollama:11434/api/version > /dev/null 2>&1; do
  echo "   Waiting for Ollama..."
  sleep 5
done

echo "✅ Ollama is ready!"

# Function to pull model with retry
pull_model() {
  local model=$1
  local max_retries=3
  local retry=0

  while [ $retry -lt $max_retries ]; do
    echo "📥 Pulling model: $model (attempt $((retry + 1))/$max_retries)"
    
    if ollama pull "$model"; then
      echo "✅ Successfully pulled: $model"
      return 0
    else
      echo "❌ Failed to pull: $model"
      retry=$((retry + 1))
      if [ $retry -lt $max_retries ]; then
        echo "🔄 Retrying in 10 seconds..."
        sleep 10
      fi
    fi
  done
  
  echo "❌ Failed to pull $model after $max_retries attempts"
  return 1
}

# Pull essential models for development
MODELS=(
  "llama2:7b-chat"
  "phi3:mini"
  "codellama:7b"
)

echo "📥 Pulling ${#MODELS[@]} models..."

for model in "${MODELS[@]}"; do
  pull_model "$model"
done

echo "🎉 Model initialization complete!"
echo "📋 Available models:"
ollama list

# Test model functionality
echo "🧪 Testing model functionality..."
echo "Testing llama2:7b-chat..."
response=$(ollama run llama2:7b-chat "Hello, respond with just 'OK' if you're working" 2>/dev/null || echo "FAILED")
if [[ "$response" == *"OK"* ]]; then
  echo "✅ llama2:7b-chat is working"
else
  echo "⚠️  llama2:7b-chat test failed"
fi

echo "🏁 Model initialization script completed!"