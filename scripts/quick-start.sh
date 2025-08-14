#!/bin/bash

# Quick start script for fast application startup
# Ensures the app is usable within 5 minutes with model downloading in background

set -e

YELLOW='\033[0;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Prompt Card System - Quick Start${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Stop any existing containers
echo -e "${YELLOW}🧹 Cleaning up existing containers...${NC}"
docker-compose -f docker-compose.dev.yml down 2>/dev/null || true

# Check for GPU support
if command -v nvidia-smi > /dev/null 2>&1; then
    echo -e "${GREEN}✅ GPU detected - using GPU profile${NC}"
    PROFILE="gpu"
else
    echo -e "${YELLOW}⚠️  No GPU detected - using CPU profile${NC}"
    PROFILE="cpu"
fi

# Start core services first (without Ollama)
echo -e "${BLUE}1️⃣  Starting core services...${NC}"
docker-compose --profile $PROFILE -f docker-compose.dev.yml up -d frontend redis

# Wait for core services
echo -e "${YELLOW}⏳ Waiting for core services to be ready...${NC}"
sleep 5

# Start backend with simple server for immediate availability
echo -e "${BLUE}2️⃣  Starting backend service...${NC}"
docker-compose --profile $PROFILE -f docker-compose.dev.yml up -d backend 2>/dev/null || \
docker-compose --profile $PROFILE -f docker-compose.dev.yml up -d backend-cpu

# Start Ollama in the background
echo -e "${BLUE}3️⃣  Starting Ollama service (background)...${NC}"
if [ "$PROFILE" = "gpu" ]; then
    docker-compose --profile gpu -f docker-compose.dev.yml up -d ollama &
else
    docker-compose --profile cpu -f docker-compose.dev.yml up -d ollama-cpu &
fi

# Check service status
echo -e "${YELLOW}⏳ Checking service status...${NC}"
sleep 10

# Verify frontend is accessible
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200\|304"; then
    echo -e "${GREEN}✅ Frontend is ready!${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend is still starting...${NC}"
fi

# Verify backend is accessible
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health | grep -q "200"; then
    echo -e "${GREEN}✅ Backend is ready!${NC}"
else
    echo -e "${YELLOW}⚠️  Backend is still starting...${NC}"
fi

# Load demo data if requested
if [ "$1" = "--demo" ]; then
    echo -e "${BLUE}4️⃣  Loading demo data...${NC}"
    sleep 5
    curl -X POST http://localhost:3001/api/demo/load -H "Content-Type: application/json" 2>/dev/null || \
    echo -e "${YELLOW}⚠️  Demo data will be available once backend is fully ready${NC}"
fi

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 Application is starting!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📱 Access the application:${NC}"
echo -e "   Frontend: ${GREEN}http://localhost:3000${NC}"
echo -e "   Backend API: ${GREEN}http://localhost:3001${NC}"
echo -e "   Ollama API: ${GREEN}http://localhost:11434${NC} (may take a few minutes)"
echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo -e "   • The application is usable immediately"
echo -e "   • Ollama models are downloading in the background"
echo -e "   • Check status: ${BLUE}docker-compose -f docker-compose.dev.yml ps${NC}"
echo -e "   • View logs: ${BLUE}docker-compose -f docker-compose.dev.yml logs -f${NC}"
echo ""

# Optional: Monitor Ollama status in background
if [ "$2" = "--monitor" ]; then
    echo -e "${BLUE}📊 Monitoring Ollama status (press Ctrl+C to stop)...${NC}"
    while true; do
        if curl -s http://localhost:11434/api/version > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Ollama is ready!${NC}"
            # List available models
            docker exec $(docker-compose -f docker-compose.dev.yml ps -q ollama 2>/dev/null || docker-compose -f docker-compose.dev.yml ps -q ollama-cpu) ollama list 2>/dev/null || true
            break
        else
            echo -ne "${YELLOW}⏳ Waiting for Ollama...${NC}\r"
        fi
        sleep 5
    done
fi