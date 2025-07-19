#!/bin/bash

# Health Check Script for Docker Compose Services
# This script checks the health of all services in the prompt card system

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Service URLs
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"
OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"
REDIS_URL="${REDIS_URL:-localhost:6379}"

echo "🏥 Prompt Card System Health Check"
echo "=================================="
echo ""

# Function to check HTTP endpoint
check_http_endpoint() {
    local name=$1
    local url=$2
    local expected_status=${3:-200}
    
    echo -n "Checking $name... "
    
    if response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$url" 2>/dev/null); then
        if [ "$response" = "$expected_status" ]; then
            echo -e "${GREEN}✓ Healthy${NC} (HTTP $response)"
            return 0
        else
            echo -e "${YELLOW}⚠ Degraded${NC} (HTTP $response)"
            return 1
        fi
    else
        echo -e "${RED}✗ Unhealthy${NC} (Connection failed)"
        return 1
    fi
}

# Function to check Redis
check_redis() {
    echo -n "Checking Redis... "
    
    if redis-cli -h "${REDIS_URL%:*}" -p "${REDIS_URL#*:}" ping 2>/dev/null | grep -q "PONG"; then
        echo -e "${GREEN}✓ Healthy${NC}"
        return 0
    else
        echo -e "${RED}✗ Unhealthy${NC}"
        return 1
    fi
}

# Check Frontend
check_http_endpoint "Frontend" "$FRONTEND_URL/api/health"

# Check Backend
check_http_endpoint "Backend" "$BACKEND_URL/api/health"

# Check Enhanced Backend Health
if [ "$1" = "--detailed" ]; then
    echo ""
    echo "📊 Detailed Health Check (Backend v2)"
    echo "-------------------------------------"
    curl -s "$BACKEND_URL/api/health/v2?detailed=true" | jq '.' 2>/dev/null || echo "Failed to get detailed health"
fi

# Check Ollama
check_http_endpoint "Ollama" "$OLLAMA_URL/api/version"

# Check Redis (if redis-cli is available)
if command -v redis-cli &> /dev/null; then
    check_redis
else
    echo "Checking Redis... ⚠ Skipped (redis-cli not found)"
fi

echo ""
echo "=================================="

# Summary
echo -n "Overall Status: "
if [ $? -eq 0 ]; then
    echo -e "${GREEN}All services healthy${NC}"
    exit 0
else
    echo -e "${YELLOW}Some services may be degraded${NC}"
    exit 1
fi