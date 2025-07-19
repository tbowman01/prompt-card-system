#!/bin/sh

# Production entrypoint script for backend service
# Handles initialization, health checks, and graceful shutdown

set -e

echo "Starting Prompt Card Backend Service..."

# Environment validation
if [ -z "$NODE_ENV" ]; then
    echo "ERROR: NODE_ENV is not set"
    exit 1
fi

if [ "$NODE_ENV" != "production" ]; then
    echo "WARNING: NODE_ENV is not set to production (current: $NODE_ENV)"
fi

# Create required directories
mkdir -p /app/data /app/logs

# Initialize database if needed
echo "Checking database initialization..."
if [ ! -f "/app/data/database.db" ]; then
    echo "Initializing database..."
    node dist/scripts/init-db.js
else
    echo "Database already exists, checking for migrations..."
    node dist/scripts/migrate-db.js
fi

# Wait for dependencies
echo "Waiting for Redis..."
while ! nc -z ${REDIS_HOST:-redis} ${REDIS_PORT:-6379}; do
    sleep 1
done
echo "Redis is ready"

echo "Waiting for Ollama..."
while ! curl -f http://${OLLAMA_BASE_URL:-ollama:11434}/api/tags > /dev/null 2>&1; do
    sleep 5
done
echo "Ollama is ready"

# Pre-pull required models
echo "Ensuring required models are available..."
curl -X POST http://${OLLAMA_BASE_URL:-ollama:11434}/api/pull \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"${OLLAMA_DEFAULT_MODEL:-llama3}\"}" || true

# Start the application with proper signal handling
echo "Starting backend service..."
exec node dist/server.js