#!/bin/bash

# Docker Development Helper Script
# Usage: ./scripts/docker-dev.sh [command] [options]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
COMPOSE_FILE="docker-compose.dev.yml"
PROJECT_NAME="prompt-card-system"

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

# Function to check if Docker is running
check_docker() {
    if ! docker info &>/dev/null; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Function to display help
show_help() {
    cat << EOF
Docker Development Helper Script

Usage: $0 [COMMAND] [OPTIONS]

Commands:
  start [profile]     Start development environment
  stop               Stop all services
  restart [profile]  Restart development environment
  logs [service]     Show logs for service(s)
  build [service]    Build or rebuild service(s)
  clean              Clean up containers and volumes
  shell <service>    Open shell in running service
  test               Run test suite in containers
  init               Initialize development environment
  status             Show status of all services
  update             Update all images
  backup             Backup volumes
  restore            Restore volumes from backup

Profiles:
  default            Frontend + Redis + Tools (default)
  gpu                GPU-accelerated Ollama + Backend
  cpu                CPU-only Ollama + Backend
  postgres           Add PostgreSQL database
  monitoring         Add Prometheus + Grafana
  tools              Add Adminer + Redis Commander
  init               Model initialization

Examples:
  $0 start gpu                    # Start with GPU profile
  $0 start cpu postgres           # Start with CPU + PostgreSQL
  $0 logs backend                 # Show backend logs
  $0 shell backend               # Open shell in backend container
  $0 clean                       # Clean up everything

EOF
}

# Function to start services
start_services() {
    local profiles="${1:-default}"
    
    print_status "Starting development environment with profiles: $profiles"
    
    # Convert space-separated profiles to comma-separated
    local profile_args=""
    for profile in $profiles; do
        profile_args="$profile_args --profile $profile"
    done
    
    # Start services
    docker compose -f $COMPOSE_FILE -p $PROJECT_NAME $profile_args up -d
    
    print_success "Development environment started!"
    print_status "Services are starting up. Use '$0 logs' to monitor progress."
    print_status "Use '$0 status' to check service health."
    
    # Show useful URLs
    echo ""
    echo "🌐 Access URLs:"
    echo "   Frontend:          http://localhost:3000"
    
    if [[ "$profiles" == *"gpu"* ]] || [[ "$profiles" == *"cpu"* ]]; then
        echo "   Backend:           http://localhost:3001"
        echo "   Backend Health:    http://localhost:3001/api/health"
        echo "   Ollama:            http://localhost:11434"
    fi
    
    if [[ "$profiles" == *"tools"* ]]; then
        echo "   Adminer (SQLite):  http://localhost:8080"
        echo "   Redis Commander:   http://localhost:8081"
    fi
    
    if [[ "$profiles" == *"postgres"* ]]; then
        echo "   PgAdmin:           http://localhost:8082"
    fi
    
    if [[ "$profiles" == *"monitoring"* ]]; then
        echo "   Prometheus:        http://localhost:9090"
        echo "   Grafana:           http://localhost:3002"
    fi
}

# Function to stop services
stop_services() {
    print_status "Stopping development environment..."
    docker compose -f $COMPOSE_FILE -p $PROJECT_NAME down
    print_success "Development environment stopped!"
}

# Function to show logs
show_logs() {
    local service="$1"
    
    if [ -z "$service" ]; then
        print_status "Showing logs for all services..."
        docker compose -f $COMPOSE_FILE -p $PROJECT_NAME logs -f
    else
        print_status "Showing logs for service: $service"
        docker compose -f $COMPOSE_FILE -p $PROJECT_NAME logs -f "$service"
    fi
}

# Function to build services
build_services() {
    local service="$1"
    
    if [ -z "$service" ]; then
        print_status "Building all services..."
        docker compose -f $COMPOSE_FILE -p $PROJECT_NAME build --no-cache
    else
        print_status "Building service: $service"
        docker compose -f $COMPOSE_FILE -p $PROJECT_NAME build --no-cache "$service"
    fi
    
    print_success "Build completed!"
}

# Function to open shell
open_shell() {
    local service="$1"
    
    if [ -z "$service" ]; then
        print_error "Please specify a service name"
        exit 1
    fi
    
    print_status "Opening shell in service: $service"
    docker compose -f $COMPOSE_FILE -p $PROJECT_NAME exec "$service" /bin/sh
}

# Function to show status
show_status() {
    print_status "Development environment status:"
    docker compose -f $COMPOSE_FILE -p $PROJECT_NAME ps
    
    echo ""
    print_status "Resource usage:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
}

# Function to run tests
run_tests() {
    print_status "Running test suite..."
    
    # Backend tests
    if docker compose -f $COMPOSE_FILE -p $PROJECT_NAME ps backend | grep -q "Up"; then
        print_status "Running backend tests..."
        docker compose -f $COMPOSE_FILE -p $PROJECT_NAME exec backend npm test
    fi
    
    # Frontend tests
    if docker compose -f $COMPOSE_FILE -p $PROJECT_NAME ps frontend | grep -q "Up"; then
        print_status "Running frontend tests..."
        docker compose -f $COMPOSE_FILE -p $PROJECT_NAME exec frontend npm test
    fi
    
    print_success "Test suite completed!"
}

# Function to clean up
clean_up() {
    print_warning "This will remove all containers, networks, and volumes for this project."
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Cleaning up development environment..."
        docker compose -f $COMPOSE_FILE -p $PROJECT_NAME down -v --remove-orphans
        docker system prune -f
        print_success "Cleanup completed!"
    else
        print_status "Cleanup cancelled."
    fi
}

# Function to initialize environment
init_environment() {
    print_status "Initializing development environment..."
    
    # Create required directories
    mkdir -p data database/init monitoring secrets
    
    # Generate .env file if it doesn't exist
    if [ ! -f .env.dev ]; then
        cat > .env.dev << EOF
# Development Environment Variables
NODE_ENV=development
POSTGRES_PASSWORD=promptcard_dev_password
REDIS_PASSWORD=redis_dev_password
JWT_SECRET=your-jwt-secret-here
GRAFANA_PASSWORD=admin

# API URLs
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
EOF
        print_success "Created .env.dev file"
    fi
    
    # Initialize models
    print_status "Initializing Ollama models..."
    docker compose -f $COMPOSE_FILE -p $PROJECT_NAME --profile init up model-init
    
    print_success "Environment initialization completed!"
}

# Function to update images
update_images() {
    print_status "Updating Docker images..."
    docker compose -f $COMPOSE_FILE -p $PROJECT_NAME pull
    print_success "Images updated!"
}

# Function to backup volumes
backup_volumes() {
    local backup_dir="./backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    print_status "Backing up volumes to $backup_dir..."
    
    # Backup each volume
    for volume in ollama_models redis_data postgres_dev_data; do
        if docker volume ls | grep -q "${PROJECT_NAME}_${volume}"; then
            print_status "Backing up volume: $volume"
            docker run --rm -v "${PROJECT_NAME}_${volume}:/data" -v "$(pwd)/$backup_dir:/backup" alpine tar czf "/backup/${volume}.tar.gz" -C /data .
        fi
    done
    
    print_success "Backup completed: $backup_dir"
}

# Main script logic
check_docker

case "${1:-help}" in
    start)
        start_services "${@:2}"
        ;;
    stop)
        stop_services
        ;;
    restart)
        stop_services
        start_services "${@:2}"
        ;;
    logs)
        show_logs "$2"
        ;;
    build)
        build_services "$2"
        ;;
    shell)
        open_shell "$2"
        ;;
    status)
        show_status
        ;;
    test)
        run_tests
        ;;
    clean)
        clean_up
        ;;
    init)
        init_environment
        ;;
    update)
        update_images
        ;;
    backup)
        backup_volumes
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