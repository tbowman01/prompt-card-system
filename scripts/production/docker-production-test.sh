#!/bin/bash

# Docker Production Deployment Test Script
# ========================================
# This script tests Docker production deployment when Docker is available

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🐳 Docker Production Deployment Test${NC}"
echo "===================================="

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not available. Please install Docker and try again.${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose not available. Please install Docker Compose and try again.${NC}"
    exit 1
fi

# Test Docker builds
test_docker_builds() {
    echo -e "${BLUE}🏗️ Testing Docker builds...${NC}"
    
    # Test backend production build
    echo -e "${BLUE}Building backend...${NC}"
    if DOCKER_BUILDKIT=1 docker build -f backend/Dockerfile.prod --target production -t prompt-backend:test ./backend; then
        echo -e "${GREEN}✅ Backend build successful${NC}"
    else
        echo -e "${RED}❌ Backend build failed${NC}"
        return 1
    fi
    
    # Test frontend production build
    echo -e "${BLUE}Building frontend...${NC}"
    if DOCKER_BUILDKIT=1 docker build -f frontend/Dockerfile.prod --target production -t prompt-frontend:test ./frontend; then
        echo -e "${GREEN}✅ Frontend build successful${NC}"
    else
        echo -e "${RED}❌ Frontend build failed${NC}"
        return 1
    fi
    
    # Test image sizes
    backend_size=$(docker images prompt-backend:test --format "{{.Size}}")
    frontend_size=$(docker images prompt-frontend:test --format "{{.Size}}")
    
    echo -e "${BLUE}📊 Image sizes:${NC}"
    echo -e "   Backend: $backend_size"
    echo -e "   Frontend: $frontend_size"
}

# Test Docker Compose configuration
test_compose_config() {
    echo -e "${BLUE}🔧 Testing Docker Compose configuration...${NC}"
    
    # Validate compose file
    if docker-compose -f docker-compose.prod.yml config &> /dev/null; then
        echo -e "${GREEN}✅ Docker Compose configuration valid${NC}"
    else
        echo -e "${RED}❌ Docker Compose configuration invalid${NC}"
        docker-compose -f docker-compose.prod.yml config
        return 1
    fi
}

# Test service startup (dry run)
test_service_startup() {
    echo -e "${BLUE}🚀 Testing service startup (dry run)...${NC}"
    
    # Pull required images
    echo -e "${BLUE}Pulling base images...${NC}"
    docker pull postgres:16-alpine
    docker pull redis:7.2-alpine
    docker pull nginx:1.25-alpine
    docker pull prom/prometheus:v2.45.0
    docker pull grafana/grafana:10.0.0
    
    echo -e "${GREEN}✅ Base images pulled successfully${NC}"
}

# Main test execution
main() {
    echo -e "${BLUE}Starting Docker production deployment tests...${NC}"
    
    test_docker_builds
    test_compose_config
    test_service_startup
    
    echo -e "${GREEN}🎉 All Docker production tests completed successfully!${NC}"
}

# Run tests
main
