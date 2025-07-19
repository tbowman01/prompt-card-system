#!/bin/bash

# Production Deployment Script for Prompt Card System
# ===================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Prompt Card System - Production Deployment${NC}"
echo "==============================================="

# Configuration
DEPLOYMENT_ENV=${1:-production}
BACKUP_BEFORE_DEPLOY=${BACKUP_BEFORE_DEPLOY:-true}
SKIP_HEALTH_CHECK=${SKIP_HEALTH_CHECK:-false}

echo -e "${CYAN}📋 Deployment Configuration:${NC}"
echo "   • Environment: $DEPLOYMENT_ENV"
echo "   • Backup before deploy: $BACKUP_BEFORE_DEPLOY"
echo "   • Skip health check: $SKIP_HEALTH_CHECK"
echo

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1
    
    echo -e "${YELLOW}⏳ Waiting for $service_name to be ready...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ $service_name is ready!${NC}"
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}❌ $service_name failed to start within $((max_attempts * 2)) seconds${NC}"
    return 1
}

# Check prerequisites
echo -e "${BLUE}🔍 Checking prerequisites...${NC}"

if ! command_exists docker; then
    echo -e "${RED}❌ Docker not found. Please install Docker first.${NC}"
    exit 1
fi

if ! command_exists docker-compose; then
    echo -e "${RED}❌ Docker Compose not found. Please install Docker Compose first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Check environment file
ENV_FILE=".env.${DEPLOYMENT_ENV}"
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Environment file $ENV_FILE not found${NC}"
    echo "Please create the environment file with your production settings."
    exit 1
fi

echo -e "${GREEN}✅ Environment file found: $ENV_FILE${NC}"

# Load environment variables
set -a
source "$ENV_FILE"
set +a

# Validate required environment variables
required_vars=(
    "POSTGRES_PASSWORD"
    "REDIS_PASSWORD" 
    "JWT_SECRET"
    "GRAFANA_ADMIN_PASSWORD"
)

echo -e "${BLUE}🔐 Validating environment variables...${NC}"
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "${RED}❌ Required environment variable $var is not set${NC}"
        exit 1
    fi
done

echo -e "${GREEN}✅ All required environment variables are set${NC}"

# Create backup before deployment
if [ "$BACKUP_BEFORE_DEPLOY" = "true" ]; then
    echo -e "${BLUE}📦 Creating backup before deployment...${NC}"
    
    if docker-compose -f docker-compose.prod.yml ps postgres | grep -q "Up"; then
        backup_filename="backup_pre_deploy_$(date +%Y%m%d_%H%M%S).sql"
        docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "database/backups/$backup_filename"
        echo -e "${GREEN}✅ Backup created: database/backups/$backup_filename${NC}"
    else
        echo -e "${YELLOW}⚠️ PostgreSQL not running, skipping backup${NC}"
    fi
fi

# Pull latest images
echo -e "${BLUE}📥 Pulling latest images...${NC}"
docker-compose -f docker-compose.prod.yml pull

# Build custom images
echo -e "${BLUE}🏗️ Building application images...${NC}"
docker-compose -f docker-compose.prod.yml build --no-cache

# Stop existing services gracefully
echo -e "${BLUE}🛑 Stopping existing services...${NC}"
docker-compose -f docker-compose.prod.yml down --remove-orphans

# Start database and cache first
echo -e "${BLUE}🗄️ Starting database and cache services...${NC}"
docker-compose -f docker-compose.prod.yml up -d postgres redis

# Wait for database to be ready
wait_for_service "postgres://postgres:5432" "PostgreSQL"

# Run database migrations
echo -e "${BLUE}🔄 Running database migrations...${NC}"
docker-compose -f docker-compose.prod.yml exec -T backend npm run migrate

# Start core services
echo -e "${BLUE}🚀 Starting core application services...${NC}"
docker-compose -f docker-compose.prod.yml up -d backend ollama

# Wait for backend to be ready
wait_for_service "http://localhost:3001/api/health" "Backend API"

# Start frontend
echo -e "${BLUE}🌐 Starting frontend service...${NC}"
docker-compose -f docker-compose.prod.yml up -d frontend

# Start reverse proxy
echo -e "${BLUE}🔀 Starting reverse proxy...${NC}"
docker-compose -f docker-compose.prod.yml up -d nginx

# Start monitoring stack
echo -e "${BLUE}📊 Starting monitoring services...${NC}"
docker-compose -f docker-compose.prod.yml up -d prometheus grafana loki promtail jaeger

# Start backup service
echo -e "${BLUE}💾 Starting backup service...${NC}"
docker-compose -f docker-compose.prod.yml up -d backup

# Health check
if [ "$SKIP_HEALTH_CHECK" != "true" ]; then
    echo -e "${BLUE}🏥 Running health checks...${NC}"
    
    services=(
        "http://localhost/api/health:Frontend"
        "http://localhost:3001/api/health:Backend"
        "http://localhost:9090/-/healthy:Prometheus"
        "http://localhost:3002/api/health:Grafana"
    )
    
    for service in "${services[@]}"; do
        url="${service%:*}"
        name="${service#*:}"
        
        if wait_for_service "$url" "$name"; then
            echo -e "${GREEN}✅ $name health check passed${NC}"
        else
            echo -e "${RED}❌ $name health check failed${NC}"
        fi
    done
fi

# Display deployment summary
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo
echo -e "${CYAN}📊 Service URLs:${NC}"
echo -e "   • Main Application: ${BLUE}https://promptcard.ai${NC}"
echo -e "   • API Endpoint: ${BLUE}https://api.promptcard.ai${NC}"
echo -e "   • Monitoring Dashboard: ${BLUE}https://monitoring.promptcard.ai${NC}"
echo
echo -e "${CYAN}📈 Monitoring Services:${NC}"
echo -e "   • Prometheus: ${BLUE}https://monitoring.promptcard.ai/prometheus${NC}"
echo -e "   • Grafana: ${BLUE}https://monitoring.promptcard.ai/grafana${NC}"
echo -e "   • Jaeger: ${BLUE}https://monitoring.promptcard.ai/jaeger${NC}"
echo
echo -e "${CYAN}🔐 Security Notes:${NC}"
echo -e "   • Change default passwords in $ENV_FILE"
echo -e "   • Configure SSL certificates in nginx/ssl/"
echo -e "   • Set up external backup storage"
echo -e "   • Configure monitoring alerts"
echo
echo -e "${GREEN}✅ Production deployment ready!${NC}"

# Show running services
echo -e "${BLUE}🔍 Current service status:${NC}"
docker-compose -f docker-compose.prod.yml ps