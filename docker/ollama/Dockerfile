# Ollama with preloaded models for fast startup
FROM ollama/ollama:latest

# Install required tools
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables for optimal performance
ENV OLLAMA_HOST=0.0.0.0
ENV OLLAMA_ORIGINS=*
ENV OLLAMA_KEEP_ALIVE=24h
ENV OLLAMA_MAX_LOADED_MODELS=3
ENV OLLAMA_NUM_PARALLEL=2
ENV OLLAMA_LOAD_TIMEOUT=10m

# Create model directory
RUN mkdir -p /root/.ollama/models

# Copy model download script
COPY download-models.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/download-models.sh

# Copy startup script
COPY startup.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/startup.sh

# Note: Model preloading removed from build time to prevent hang
# Models will be downloaded on first startup by startup.sh
# This ensures build completes successfully and models are pulled at runtime

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:11434/api/version || exit 1

# Use custom startup script
ENTRYPOINT ["/usr/local/bin/startup.sh"]