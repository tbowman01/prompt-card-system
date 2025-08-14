#!/bin/bash

# Background model download script
# Downloads additional models after the service is running

echo "🔄 Background model downloader started"

# Wait a bit to ensure main service is stable
sleep 30

# List of models to download in the background
# Ordered by priority/usefulness as specified by user
MODELS=(
    "phi4-mini-reasoning:3.8b"  # Small reasoning model for quick responses
    "phi4:latest"                # Latest Phi-4 model
    "llama3.2-vision:latest"     # Vision-capable model
    "granite3.3:latest"          # IBM's Granite model
)

# Function to download a model
download_model() {
    local model=$1
    echo "📥 Downloading model: $model"
    
    if ollama list | grep -q "$model"; then
        echo "✅ Model $model already exists, skipping..."
        return 0
    fi
    
    if ollama pull "$model"; then
        echo "✅ Successfully downloaded: $model"
        
        # Optional: Send notification that model is ready
        if [ -n "$WEBHOOK_URL" ]; then
            curl -X POST "$WEBHOOK_URL" \
                -H "Content-Type: application/json" \
                -d "{\"model\": \"$model\", \"status\": \"ready\"}" \
                2>/dev/null || true
        fi
    else
        echo "⚠️ Failed to download: $model"
    fi
}

# Download models one by one in the background
for model in "${MODELS[@]}"; do
    # Check if we should continue downloading
    if [ -f "/tmp/stop_downloads" ]; then
        echo "🛑 Download stop signal received"
        break
    fi
    
    # Check available disk space (require at least 10GB free)
    available_space=$(df /root/.ollama | awk 'NR==2 {print $4}')
    if [ "$available_space" -lt 10485760 ]; then
        echo "⚠️ Low disk space, stopping downloads"
        break
    fi
    
    download_model "$model"
    
    # Small delay between downloads to avoid overloading
    sleep 5
done

echo "✅ Background model download completed"