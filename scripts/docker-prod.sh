#!/bin/bash

# Docker Production Helper Script
# Usage: ./scripts/docker-prod.sh [command] [options]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.prod.yml"
PROJECT_NAME="prompt-card-system-prod"
ENV_FILE=".env.prod"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check prerequisites
check_prerequisites() {
    # Check Docker
    if ! docker info &>/dev/null; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    
    # Check environment file
    if [ ! -f "$ENV_FILE" ]; then
        print_error "Environment file $ENV_FILE not found. Please create it first."
        print_status "Use: $0 init-env"
        exit 1
    fi
}

# Function to display help
show_help() {
    cat << EOF
Docker Production Helper Script

Usage: $0 [COMMAND] [OPTIONS]

Commands:
  deploy             Deploy production environment
  stop               Stop production environment
  restart            Restart production environment
  logs [service]     Show logs for service(s)
  build              Build production images
  scale <service> <replicas>  Scale service
  rollback           Rollback to previous version
  health             Check health of all services
  backup             Backup production data
  restore <backup>   Restore from backup
  init-env           Initialize production environment file
  update             Update production deployment
  ssl-setup          Setup SSL certificates
  monitor            Show real-time monitoring

Security Commands:
  security-scan      Scan images for vulnerabilities
  rotate-secrets     Rotate production secrets
  audit              Audit production setup

Examples:
  $0 deploy                      # Deploy production
  $0 scale backend 3             # Scale backend to 3 replicas
  $0 logs backend               # Show backend logs
  $0 backup                     # Backup production data

EOF
}

# Function to initialize environment file
init_env_file() {
    if [ -f "$ENV_FILE" ]; then
        print_warning "Environment file $ENV_FILE already exists."
        read -p "Overwrite? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Environment file initialization cancelled."
            return
        fi
    fi
    
    print_status "Creating production environment file..."
    
    cat > "$ENV_FILE" << EOF
# Production Environment Variables
NODE_ENV=production

# Database
POSTGRES_PASSWORD=$(openssl rand -base64 32)
DATABASE_URL=postgresql://promptcard:\${POSTGRES_PASSWORD}@postgres:5432/promptcard_prod

# Redis
REDIS_PASSWORD=$(openssl rand -base64 32)

# Security
JWT_SECRET=$(openssl rand -base64 64)

# Monitoring
GRAFANA_PASSWORD=$(openssl rand -base64 16)

# API Configuration
CORS_ORIGIN=https://yourdomain.com
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com

# SSL/TLS
SSL_CERT_PATH=/etc/nginx/ssl/cert.pem
SSL_KEY_PATH=/etc/nginx/ssl/private.key

# Backup
BACKUP_ENCRYPTION_KEY=$(openssl rand -base64 32)
BACKUP_SCHEDULE="0 2 * * *"

# Resource Limits
POSTGRES_MAX_CONNECTIONS=100
REDIS_MAX_MEMORY=512mb
OLLAMA_MAX_MEMORY=4g
EOF
    
    # Create secrets directory
    mkdir -p secrets
    
    # Extract passwords to secret files
    grep "PASSWORD=" "$ENV_FILE" | while IFS='=' read -r key value; do
        echo "$value" > "secrets/${key,,}.txt"
    done
    
    print_success "Environment file created: $ENV_FILE"
    print_warning "Please review and update the configuration before deploying!"
    print_warning "Update domain names and SSL certificate paths!"
}

# Function to deploy production
deploy_production() {
    print_status "Deploying production environment..."
    
    # Check if this is an update
    if docker compose -f $COMPOSE_FILE -p $PROJECT_NAME ps &>/dev/null; then
        print_status "Existing deployment detected. Performing rolling update..."
        docker compose -f $COMPOSE_FILE -p $PROJECT_NAME --env-file $ENV_FILE up -d --force-recreate --remove-orphans
    else
        print_status "New deployment. Starting all services..."
        docker compose -f $COMPOSE_FILE -p $PROJECT_NAME --env-file $ENV_FILE up -d
    fi
    
    # Wait for services to be healthy
    print_status "Waiting for services to be healthy..."
    sleep 30
    
    # Check health
    check_health
    
    print_success "Production deployment completed!"
    show_access_info
}

# Function to stop production
stop_production() {
    print_warning "This will stop the production environment."
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Stopping production environment..."
        docker compose -f $COMPOSE_FILE -p $PROJECT_NAME down
        print_success "Production environment stopped!"
    else
        print_status "Stop cancelled."
    fi
}

# Function to show logs
show_logs() {
    local service="$1"
    
    if [ -z "$service" ]; then
        print_status "Showing logs for all services..."
        docker compose -f $COMPOSE_FILE -p $PROJECT_NAME logs -f --tail=100
    else
        print_status "Showing logs for service: $service"
        docker compose -f $COMPOSE_FILE -p $PROJECT_NAME logs -f --tail=100 "$service"
    fi
}

# Function to build production images
build_production() {
    print_status "Building production images..."
    docker compose -f $COMPOSE_FILE -p $PROJECT_NAME build --no-cache
    print_success "Production images built!"
}

# Function to scale services
scale_service() {
    local service="$1"
    local replicas="$2"
    
    if [ -z "$service" ] || [ -z "$replicas" ]; then
        print_error "Usage: $0 scale <service> <replicas>"
        exit 1
    fi
    
    print_status "Scaling $service to $replicas replicas..."
    docker compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d --scale "$service=$replicas"
    print_success "Service $service scaled to $replicas replicas!"
}

# Function to check health
check_health() {
    print_status "Checking service health..."
    
    local all_healthy=true
    
    # Check each service health
    for service in frontend backend postgres redis ollama; do
        local status=$(docker compose -f $COMPOSE_FILE -p $PROJECT_NAME ps "$service" --format json 2>/dev/null | jq -r '.Health // "unknown"')
        
        case "$status" in
            "healthy")
                echo -e "  ${GREEN}✓${NC} $service: healthy"
                ;;
            "unhealthy")
                echo -e "  ${RED}✗${NC} $service: unhealthy"
                all_healthy=false
                ;;
            "starting")
                echo -e "  ${YELLOW}⟳${NC} $service: starting"
                ;;
            *)
                echo -e "  ${YELLOW}?${NC} $service: $status"
                ;;
        esac
    done
    
    if [ "$all_healthy" = true ]; then
        print_success "All services are healthy!"
    else
        print_warning "Some services are not healthy. Check logs for details."
    fi
}

# Function to backup production data
backup_production() {
    local backup_dir="./backups/production/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    print_status "Creating production backup..."
    
    # Backup PostgreSQL
    print_status "Backing up PostgreSQL database..."
    docker compose -f $COMPOSE_FILE -p $PROJECT_NAME exec -T postgres pg_dump -U promptcard promptcard_prod | gzip > "$backup_dir/postgres.sql.gz"
    
    # Backup Redis
    print_status "Backing up Redis data..."
    docker compose -f $COMPOSE_FILE -p $PROJECT_NAME exec -T redis redis-cli BGSAVE
    docker cp "$(docker compose -f $COMPOSE_FILE -p $PROJECT_NAME ps -q redis):/data/dump.rdb" "$backup_dir/redis.rdb"
    
    # Backup Ollama models
    print_status "Backing up Ollama models..."
    docker run --rm -v "${PROJECT_NAME}_ollama_models:/data" -v "$(pwd)/$backup_dir:/backup" alpine tar czf "/backup/ollama_models.tar.gz" -C /data .
    
    # Create backup manifest
    cat > "$backup_dir/manifest.json" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "version": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "services": {
    "postgres": "postgres.sql.gz",
    "redis": "redis.rdb",
    "ollama": "ollama_models.tar.gz"
  }
}
EOF
    
    print_success "Backup completed: $backup_dir"
}

# Function to setup SSL
setup_ssl() {
    print_status "Setting up SSL certificates..."
    
    mkdir -p ssl
    
    # Generate self-signed certificates for development/testing
    if [ ! -f ssl/cert.pem ] || [ ! -f ssl/private.key ]; then
        print_status "Generating self-signed SSL certificates..."
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout ssl/private.key \
            -out ssl/cert.pem \
            -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
        
        print_success "Self-signed certificates generated!"
        print_warning "For production, replace with proper SSL certificates!"
    else
        print_status "SSL certificates already exist."
    fi
}

# Function to security scan
security_scan() {
    print_status "Running security scan on Docker images..."
    
    # Check if trivy is available
    if ! command -v trivy &> /dev/null; then
        print_warning "Trivy not found. Installing..."
        # Install trivy
        curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin
    fi
    
    # Scan each image
    for image in frontend backend; do
        print_status "Scanning $image image..."
        trivy image "${PROJECT_NAME}-${image}:latest" --severity HIGH,CRITICAL
    done
    
    print_success "Security scan completed!"
}

# Function to show access information
show_access_info() {
    echo ""
    echo "🌐 Production Access URLs:"
    echo "   Frontend:          https://yourdomain.com"
    echo "   Backend API:       https://api.yourdomain.com"
    echo "   Grafana:           https://monitoring.yourdomain.com"
    echo ""
    echo "📊 Monitoring Commands:"
    echo "   Health Check:      $0 health"
    echo "   View Logs:         $0 logs [service]"
    echo "   Real-time Monitor: $0 monitor"
    echo ""
    echo "🔧 Management Commands:"
    echo "   Scale Services:    $0 scale <service> <replicas>"
    echo "   Backup Data:       $0 backup"
    echo "   Security Scan:     $0 security-scan"
}

# Function to monitor in real-time
monitor_realtime() {
    print_status "Starting real-time monitoring (Ctrl+C to exit)..."
    
    while true; do
        clear
        echo "=== Production Environment Status ==="
        echo "Timestamp: $(date)"
        echo ""
        
        # Service status
        check_health
        echo ""
        
        # Resource usage
        echo "=== Resource Usage ==="
        docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" | head -10
        echo ""
        
        # Recent logs
        echo "=== Recent Errors ==="
        docker compose -f $COMPOSE_FILE -p $PROJECT_NAME logs --tail=5 2>&1 | grep -i error || echo "No recent errors"
        
        sleep 10
    done
}

# Main script logic
case "${1:-help}" in
    deploy)
        check_prerequisites
        deploy_production
        ;;
    stop)
        check_prerequisites
        stop_production
        ;;
    restart)
        check_prerequisites
        stop_production
        deploy_production
        ;;
    logs)
        check_prerequisites
        show_logs "$2"
        ;;
    build)
        build_production
        ;;
    scale)
        check_prerequisites
        scale_service "$2" "$3"
        ;;
    health)
        check_prerequisites
        check_health
        ;;
    backup)
        check_prerequisites
        backup_production
        ;;
    init-env)
        init_env_file
        ;;
    ssl-setup)
        setup_ssl
        ;;
    security-scan)
        security_scan
        ;;
    monitor)
        check_prerequisites
        monitor_realtime
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac