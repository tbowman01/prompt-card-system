#!/bin/bash

# 🐳 Docker Deployment Readiness Check
# Validates Docker deployment configuration and requirements

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REQUIRED_DOCKER_VERSION="20.0.0"
REQUIRED_COMPOSE_VERSION="2.0.0"
COMPOSE_FILE="docker-compose.ghcr.yml"

echo -e "${BLUE}🐳 Docker Deployment Readiness Check${NC}"
echo "=================================================="

# Function to print status
print_status() {
    local status=$1
    local message=$2
    if [ "$status" = "OK" ]; then
        echo -e "${GREEN}✅ $message${NC}"
    elif [ "$status" = "WARN" ]; then
        echo -e "${YELLOW}⚠️  $message${NC}"
    else
        echo -e "${RED}❌ $message${NC}"
    fi
}

# Function to check version
version_ge() {
    local version1=$1
    local version2=$2
    [ "$(printf '%s\n' "$version2" "$version1" | sort -V | head -n1)" = "$version2" ]
}

# Check Docker installation
check_docker() {
    echo -e "\n${BLUE}🔍 Checking Docker Installation...${NC}"
    
    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
        if version_ge "$DOCKER_VERSION" "$REQUIRED_DOCKER_VERSION"; then
            print_status "OK" "Docker $DOCKER_VERSION installed (required: $REQUIRED_DOCKER_VERSION+)"
        else
            print_status "FAIL" "Docker $DOCKER_VERSION is too old (required: $REQUIRED_DOCKER_VERSION+)"
            return 1
        fi
        
        # Check Docker daemon
        if docker info &> /dev/null; then
            print_status "OK" "Docker daemon is running"
        else
            print_status "FAIL" "Docker daemon is not running"
            return 1
        fi
    else
        print_status "FAIL" "Docker is not installed"
        return 1
    fi
}

# Check Docker Compose
check_docker_compose() {
    echo -e "\n${BLUE}🔍 Checking Docker Compose...${NC}"
    
    if command -v docker-compose &> /dev/null; then
        COMPOSE_VERSION=$(docker-compose --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
        if version_ge "$COMPOSE_VERSION" "$REQUIRED_COMPOSE_VERSION"; then
            print_status "OK" "Docker Compose $COMPOSE_VERSION installed (required: $REQUIRED_COMPOSE_VERSION+)"
        else
            print_status "WARN" "Docker Compose $COMPOSE_VERSION may be too old (recommended: $REQUIRED_COMPOSE_VERSION+)"
        fi
    elif docker compose version &> /dev/null; then
        COMPOSE_VERSION=$(docker compose version --short)
        print_status "OK" "Docker Compose Plugin $COMPOSE_VERSION installed"
    else
        print_status "FAIL" "Docker Compose is not installed"
        return 1
    fi
}

# Check system resources
check_resources() {
    echo -e "\n${BLUE}🔍 Checking System Resources...${NC}"
    
    # Check available memory
    if command -v free &> /dev/null; then
        TOTAL_MEM=$(free -m | awk 'NR==2{printf "%.0f", $2}')
        if [ "$TOTAL_MEM" -ge 4096 ]; then
            print_status "OK" "Available memory: ${TOTAL_MEM}MB (recommended: 4GB+)"
        elif [ "$TOTAL_MEM" -ge 2048 ]; then
            print_status "WARN" "Available memory: ${TOTAL_MEM}MB (recommended: 4GB+)"
        else
            print_status "FAIL" "Available memory: ${TOTAL_MEM}MB (minimum: 2GB)"
        fi
    else
        print_status "WARN" "Cannot check memory (free command not available)"
    fi
    
    # Check available disk space
    DISK_USAGE=$(df -BG . | awk 'NR==2 {print $4}' | sed 's/G//')
    if [ "$DISK_USAGE" -ge 10 ]; then
        print_status "OK" "Available disk space: ${DISK_USAGE}GB (recommended: 10GB+)"
    elif [ "$DISK_USAGE" -ge 5 ]; then
        print_status "WARN" "Available disk space: ${DISK_USAGE}GB (recommended: 10GB+)"
    else
        print_status "FAIL" "Available disk space: ${DISK_USAGE}GB (minimum: 5GB)"
    fi
}

# Check configuration files
check_config_files() {
    echo -e "\n${BLUE}🔍 Checking Configuration Files...${NC}"
    
    # Check docker-compose file
    if [ -f "$COMPOSE_FILE" ]; then
        print_status "OK" "Docker Compose file found: $COMPOSE_FILE"
        
        # Validate compose file
        if docker-compose -f "$COMPOSE_FILE" config > /dev/null 2>&1; then
            print_status "OK" "Docker Compose configuration is valid"
        else
            print_status "FAIL" "Docker Compose configuration is invalid"
            return 1
        fi
    else
        print_status "FAIL" "Docker Compose file not found: $COMPOSE_FILE"
        return 1
    fi
    
    # Check environment file
    if [ -f ".env" ]; then
        print_status "OK" "Environment file found: .env"
        
        # Check required environment variables
        REQUIRED_VARS=("JWT_SECRET" "ENCRYPTION_KEY" "REDIS_PASSWORD")
        for var in "${REQUIRED_VARS[@]}"; do
            if grep -q "^$var=" .env && ! grep -q "^$var=$" .env && ! grep -q "^$var=your-" .env; then
                print_status "OK" "$var is configured"
            else
                print_status "WARN" "$var is not configured (using default/placeholder)"
            fi
        done
    else
        if [ -f ".env.example" ]; then
            print_status "WARN" "Environment file not found, but .env.example exists"
            echo "         Run: cp .env.example .env && nano .env"
        else
            print_status "FAIL" "Environment file not found: .env"
        fi
    fi
}

# Check network connectivity
check_network() {
    echo -e "\n${BLUE}🔍 Checking Network Connectivity...${NC}"
    
    # Check GitHub Container Registry access
    if curl -s --head https://ghcr.io > /dev/null; then
        print_status "OK" "GitHub Container Registry is accessible"
    else
        print_status "FAIL" "Cannot access GitHub Container Registry"
        return 1
    fi
    
    # Check if ports are available
    PORTS=(3000 3001 8005 11434)
    for port in "${PORTS[@]}"; do
        if ! netstat -tuln 2>/dev/null | grep -q ":$port "; then
            print_status "OK" "Port $port is available"
        else
            print_status "WARN" "Port $port is already in use"
        fi
    done
}

# Check Docker image availability
check_images() {
    echo -e "\n${BLUE}🔍 Checking Docker Images...${NC}"
    
    IMAGES=(
        "ghcr.io/tbowman01/prompt-card-system-backend:latest"
        "ghcr.io/tbowman01/prompt-card-system-frontend:latest"
        "ghcr.io/tbowman01/prompt-card-system-auth:latest"
        "ghcr.io/tbowman01/prompt-card-system-ollama:latest"
    )
    
    for image in "${IMAGES[@]}"; do
        if docker manifest inspect "$image" > /dev/null 2>&1; then
            print_status "OK" "Image available: $image"
        else
            print_status "FAIL" "Image not found: $image"
        fi
    done
}

# Check GPU support (optional)
check_gpu() {
    echo -e "\n${BLUE}🔍 Checking GPU Support (Optional)...${NC}"
    
    if command -v nvidia-smi &> /dev/null; then
        if nvidia-smi > /dev/null 2>&1; then
            GPU_COUNT=$(nvidia-smi -L | wc -l)
            print_status "OK" "NVIDIA GPU detected ($GPU_COUNT GPU(s))"
        else
            print_status "WARN" "NVIDIA drivers installed but GPU not accessible"
        fi
    elif lspci | grep -i nvidia > /dev/null; then
        print_status "WARN" "NVIDIA GPU detected but drivers not installed"
    else
        print_status "OK" "No GPU detected (CPU-only deployment)"
    fi
    
    # Check Docker GPU support
    if docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi > /dev/null 2>&1; then
        print_status "OK" "Docker GPU support is working"
    else
        print_status "WARN" "Docker GPU support not available (CPU-only mode)"
    fi
}

# Generate deployment commands
generate_commands() {
    echo -e "\n${BLUE}🚀 Deployment Commands${NC}"
    echo "=================================================="
    
    echo -e "${GREEN}# Quick Start Commands:${NC}"
    echo "cp .env.example .env"
    echo "nano .env  # Configure your environment"
    echo "docker-compose -f $COMPOSE_FILE up -d"
    echo ""
    
    echo -e "${GREEN}# Health Check:${NC}"
    echo "curl http://localhost:3000"
    echo "curl http://localhost:3001/health"
    echo "curl http://localhost:8005/auth/health"
    echo "curl http://localhost:11434/api/version"
    echo ""
    
    echo -e "${GREEN}# Monitor Deployment:${NC}"
    echo "docker-compose -f $COMPOSE_FILE ps"
    echo "docker-compose -f $COMPOSE_FILE logs -f"
    echo ""
    
    echo -e "${GREEN}# Stop Services:${NC}"
    echo "docker-compose -f $COMPOSE_FILE down"
}

# Main execution
main() {
    local exit_code=0
    
    # Run all checks
    check_docker || exit_code=1
    check_docker_compose || exit_code=1
    check_resources
    check_config_files || exit_code=1
    check_network || exit_code=1
    check_images
    check_gpu
    
    # Summary
    echo -e "\n${BLUE}📊 Summary${NC}"
    echo "=================================================="
    
    if [ $exit_code -eq 0 ]; then
        print_status "OK" "All critical checks passed"
        echo -e "\n${GREEN}🎉 System is ready for Docker deployment!${NC}"
        generate_commands
    else
        print_status "FAIL" "Some critical checks failed"
        echo -e "\n${RED}🚨 Please fix the issues above before deploying${NC}"
        
        echo -e "\n${YELLOW}💡 Common Solutions:${NC}"
        echo "• Install Docker: https://docs.docker.com/get-docker/"
        echo "• Start Docker daemon: sudo systemctl start docker"
        echo "• Copy environment file: cp .env.example .env"
        echo "• Configure secrets in .env file"
        echo "• Free up disk space if needed"
        echo "• Check firewall settings for ports"
    fi
    
    exit $exit_code
}

# Run the main function
main "$@"