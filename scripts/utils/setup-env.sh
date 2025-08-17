#!/bin/bash
# =============================================================================
# ⚙️ ENVIRONMENT SETUP SCRIPT
# =============================================================================
# Memory-driven environment patterns from deployment analysis:
# - Automated development environment configuration
# - Docker network and service initialization
# - Environment variable template generation
# - Dependency validation and installation
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="${ENVIRONMENT:-development}"
SKIP_DOCKER="${SKIP_DOCKER:-false}"
SKIP_DEPENDENCIES="${SKIP_DEPENDENCIES:-false}"
SKIP_ENV_FILES="${SKIP_ENV_FILES:-false}"
FORCE_REINSTALL="${FORCE_REINSTALL:-false}"
SERVICES="${SERVICES:-backend,frontend,auth}"

# Environment configurations
declare -A ENV_CONFIGS=(
    ["development"]="debug=true,hot_reload=true,watch_mode=true"
    ["production"]="debug=false,optimize=true,minify=true"
    ["test"]="test_mode=true,mock_services=true,coverage=true"
)

# Service ports
declare -A SERVICE_PORTS=(
    ["backend"]=3001
    ["frontend"]=3000
    ["auth"]=8005
    ["redis"]=6379
    ["postgres"]=5432
    ["ollama"]=11434
)

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Check system prerequisites
check_prerequisites() {
    log "Checking system prerequisites..."
    
    local missing_tools=()
    
    # Essential tools
    local required_tools=("git" "node" "npm")
    
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" >/dev/null 2>&1; then
            missing_tools+=("$tool")
        else
            local version
            case "$tool" in
                "node")
                    version=$(node --version 2>/dev/null || echo "unknown")
                    log "✓ Node.js: $version"
                    ;;
                "npm")
                    version=$(npm --version 2>/dev/null || echo "unknown")
                    log "✓ npm: $version"
                    ;;
                "git")
                    version=$(git --version 2>/dev/null || echo "unknown")
                    log "✓ Git: $version"
                    ;;
            esac
        fi
    done
    
    # Optional tools
    local optional_tools=("docker" "docker-compose" "yarn" "pnpm")
    
    for tool in "${optional_tools[@]}"; do
        if command -v "$tool" >/dev/null 2>&1; then
            local version
            case "$tool" in
                "docker")
                    version=$(docker --version 2>/dev/null || echo "unknown")
                    log "✓ Docker: $version"
                    ;;
                "docker-compose")
                    version=$(docker-compose --version 2>/dev/null || echo "unknown")
                    log "✓ Docker Compose: $version"
                    ;;
                *)
                    version=$($tool --version 2>/dev/null | head -1 || echo "unknown")
                    log "✓ $tool: $version"
                    ;;
            esac
        else
            log "○ $tool: not installed (optional)"
        fi
    done
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        error "Missing required tools: ${missing_tools[*]}"
        log "Please install the missing tools and run this script again"
        exit 1
    fi
    
    success "All prerequisites are satisfied"
}

# Setup Docker environment
setup_docker_environment() {
    if [[ "$SKIP_DOCKER" == "true" ]]; then
        return 0
    fi
    
    if ! command -v docker >/dev/null 2>&1; then
        warning "Docker not found, skipping Docker environment setup"
        return 0
    fi
    
    log "Setting up Docker environment..."
    
    # Create custom networks
    local network_name="prompt-card-network"
    
    if ! docker network ls | grep -q "$network_name"; then
        log "Creating Docker network: $network_name"
        docker network create "$network_name" \
            --driver bridge \
            --subnet=172.20.0.0/16 \
            --ip-range=172.20.240.0/20
        success "Docker network created: $network_name"
    else
        log "Docker network already exists: $network_name"
    fi
    
    # Setup data volumes
    local volumes=("postgres-data" "redis-data" "backend-data" "logs")
    
    for volume in "${volumes[@]}"; do
        if ! docker volume ls | grep -q "$volume"; then
            log "Creating Docker volume: $volume"
            docker volume create "$volume"
        else
            log "Docker volume already exists: $volume"
        fi
    done
    
    # Start supporting services if in development mode
    if [[ "$ENVIRONMENT" == "development" ]]; then
        log "Starting development support services..."
        
        # Start PostgreSQL
        if ! docker ps | grep -q "dev-postgres"; then
            log "Starting PostgreSQL container..."
            docker run -d \
                --name dev-postgres \
                --network "$network_name" \
                -p "${SERVICE_PORTS["postgres"]}:5432" \
                -e POSTGRES_DB=prompt_card_system \
                -e POSTGRES_USER=dev \
                -e POSTGRES_PASSWORD=dev \
                -v postgres-data:/var/lib/postgresql/data \
                postgres:15-alpine
            
            # Wait for PostgreSQL to be ready
            log "Waiting for PostgreSQL to be ready..."
            local timeout=30
            while [[ $timeout -gt 0 ]]; do
                if docker exec dev-postgres pg_isready -U dev >/dev/null 2>&1; then
                    success "PostgreSQL is ready"
                    break
                fi
                sleep 2
                timeout=$((timeout - 2))
            done
        else
            log "PostgreSQL container already running"
        fi
        
        # Start Redis
        if ! docker ps | grep -q "dev-redis"; then
            log "Starting Redis container..."
            docker run -d \
                --name dev-redis \
                --network "$network_name" \
                -p "${SERVICE_PORTS["redis"]}:6379" \
                -v redis-data:/data \
                redis:7-alpine \
                redis-server --appendonly yes
            
            # Wait for Redis to be ready
            log "Waiting for Redis to be ready..."
            sleep 5
            if docker exec dev-redis redis-cli ping | grep -q "PONG"; then
                success "Redis is ready"
            else
                warning "Redis may not be fully ready"
            fi
        else
            log "Redis container already running"
        fi
    fi
    
    success "Docker environment setup completed"
}

# Generate environment files
generate_env_files() {
    if [[ "$SKIP_ENV_FILES" == "true" ]]; then
        return 0
    fi
    
    log "Generating environment files..."
    
    # Parse environment configuration
    local env_config="${ENV_CONFIGS[$ENVIRONMENT]:-}"
    
    # Backend environment
    if [[ -d "backend" ]]; then
        log "Creating backend environment file..."
        
        cat > backend/.env << EOF
# Backend Environment Configuration
# Generated: $(date -u +'%Y-%m-%d %H:%M:%S UTC')
# Environment: $ENVIRONMENT

# Application
NODE_ENV=$ENVIRONMENT
PORT=${SERVICE_PORTS["backend"]}
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://dev:dev@localhost:${SERVICE_PORTS["postgres"]}/prompt_card_system

# Redis
REDIS_URL=redis://localhost:${SERVICE_PORTS["redis"]}

# Authentication
JWT_SECRET=dev-jwt-secret-change-in-production
JWT_EXPIRES_IN=24h
SESSION_SECRET=dev-session-secret-change-in-production

# Security
CORS_ORIGIN=http://localhost:${SERVICE_PORTS["frontend"]}
ENCRYPTION_KEY=dev-encryption-key-32-chars-long

# API Configuration
API_RATE_LIMIT=1000
API_TIMEOUT=30000

# Logging
LOG_LEVEL=debug
LOG_FORMAT=dev

# Feature Flags
OPTIMIZATION_ENABLED=true
CACHE_ENABLED=true
EDGE_OPTIMIZATION_ENABLED=false
ML_OPTIMIZATION_ENABLED=false

# External Services
OLLAMA_HOST=http://localhost:${SERVICE_PORTS["ollama"]}
DEFAULT_MODEL=llama2:7b
EOF
        
        success "Backend environment file created"
    fi
    
    # Frontend environment
    if [[ -d "frontend" ]]; then
        log "Creating frontend environment file..."
        
        cat > frontend/.env.local << EOF
# Frontend Environment Configuration
# Generated: $(date -u +'%Y-%m-%d %H:%M:%S UTC')
# Environment: $ENVIRONMENT

# Next.js Configuration
NODE_ENV=$ENVIRONMENT
NEXT_PUBLIC_APP_ENV=$ENVIRONMENT

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:${SERVICE_PORTS["backend"]}
NEXT_PUBLIC_AUTH_URL=http://localhost:${SERVICE_PORTS["auth"]}

# Authentication
NEXTAUTH_URL=http://localhost:${SERVICE_PORTS["frontend"]}
NEXTAUTH_SECRET=dev-nextauth-secret-change-in-production

# Features
NEXT_PUBLIC_ANALYTICS_ENABLED=false
NEXT_PUBLIC_DEBUG_MODE=true

# Performance
NEXT_TELEMETRY_DISABLED=1
EOF
        
        success "Frontend environment file created"
    fi
    
    # Auth service environment
    if [[ -d "auth" ]]; then
        log "Creating auth service environment file..."
        
        cat > auth/.env << EOF
# Auth Service Environment Configuration
# Generated: $(date -u +'%Y-%m-%d %H:%M:%S UTC')
# Environment: $ENVIRONMENT

# Application
NODE_ENV=$ENVIRONMENT
PORT=${SERVICE_PORTS["auth"]}
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://dev:dev@localhost:${SERVICE_PORTS["postgres"]}/prompt_card_system

# Redis
REDIS_URL=redis://localhost:${SERVICE_PORTS["redis"]}

# JWT Configuration
JWT_SECRET=dev-jwt-secret-change-in-production
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Security
CORS_ORIGIN=http://localhost:${SERVICE_PORTS["frontend"]},http://localhost:${SERVICE_PORTS["backend"]}
BCRYPT_ROUNDS=12

# Rate Limiting
AUTH_RATE_LIMIT=10
AUTH_RATE_WINDOW=900000

# Session Configuration
SESSION_SECRET=dev-session-secret-change-in-production
SESSION_EXPIRES=86400000

# Logging
LOG_LEVEL=debug
EOF
        
        success "Auth service environment file created"
    fi
    
    # Root environment file
    log "Creating root environment file..."
    
    cat > .env << EOF
# Root Environment Configuration
# Generated: $(date -u +'%Y-%m-%d %H:%M:%S UTC')
# Environment: $ENVIRONMENT

# Environment
NODE_ENV=$ENVIRONMENT

# Service Ports
BACKEND_PORT=${SERVICE_PORTS["backend"]}
FRONTEND_PORT=${SERVICE_PORTS["frontend"]}
AUTH_PORT=${SERVICE_PORTS["auth"]}
REDIS_PORT=${SERVICE_PORTS["redis"]}
POSTGRES_PORT=${SERVICE_PORTS["postgres"]}
OLLAMA_PORT=${SERVICE_PORTS["ollama"]}

# Database Configuration
POSTGRES_DB=prompt_card_system
POSTGRES_USER=dev
POSTGRES_PASSWORD=dev

# Docker Configuration
COMPOSE_PROJECT_NAME=prompt-card-system
DOCKER_BUILDKIT=1

# Development Configuration
WATCH_MODE=true
HOT_RELOAD=true
AUTO_RESTART=true
EOF
    
    success "Environment files generation completed"
}

# Install dependencies
install_dependencies() {
    if [[ "$SKIP_DEPENDENCIES" == "true" ]]; then
        return 0
    fi
    
    log "Installing dependencies..."
    
    # Detect package manager
    local package_manager="npm"
    
    if [[ -f "yarn.lock" ]] && command -v yarn >/dev/null 2>&1; then
        package_manager="yarn"
    elif [[ -f "pnpm-lock.yaml" ]] && command -v pnpm >/dev/null 2>&1; then
        package_manager="pnpm"
    fi
    
    log "Using package manager: $package_manager"
    
    # Install root dependencies
    if [[ -f "package.json" ]]; then
        log "Installing root dependencies..."
        
        case "$package_manager" in
            "yarn")
                if [[ "$FORCE_REINSTALL" == "true" ]]; then
                    rm -rf node_modules yarn.lock
                fi
                yarn install
                ;;
            "pnpm")
                if [[ "$FORCE_REINSTALL" == "true" ]]; then
                    rm -rf node_modules pnpm-lock.yaml
                fi
                pnpm install
                ;;
            *)
                if [[ "$FORCE_REINSTALL" == "true" ]]; then
                    rm -rf node_modules package-lock.json
                fi
                npm install
                ;;
        esac
        
        success "Root dependencies installed"
    fi
    
    # Install service dependencies
    IFS=',' read -ra service_array <<< "$SERVICES"
    
    for service in "${service_array[@]}"; do
        service=$(echo "$service" | xargs) # trim whitespace
        
        if [[ -d "$service" ]] && [[ -f "$service/package.json" ]]; then
            log "Installing dependencies for $service..."
            
            cd "$service"
            
            case "$package_manager" in
                "yarn")
                    if [[ "$FORCE_REINSTALL" == "true" ]]; then
                        rm -rf node_modules yarn.lock
                    fi
                    yarn install
                    ;;
                "pnpm")
                    if [[ "$FORCE_REINSTALL" == "true" ]]; then
                        rm -rf node_modules pnpm-lock.yaml
                    fi
                    pnpm install
                    ;;
                *)
                    if [[ "$FORCE_REINSTALL" == "true" ]]; then
                        rm -rf node_modules package-lock.json
                    fi
                    npm install
                    ;;
            esac
            
            cd ..
            success "Dependencies installed for $service"
        else
            warning "No package.json found for service: $service"
        fi
    done
    
    success "Dependencies installation completed"
}

# Setup development tools
setup_dev_tools() {
    log "Setting up development tools..."
    
    # Create useful aliases
    cat > .aliases << 'EOF'
# Development Aliases
alias dev-start="npm run dev"
alias dev-build="npm run build"
alias dev-test="npm run test"
alias dev-lint="npm run lint"
alias dev-clean="./scripts/utils/cleanup.sh"
alias dev-health="./scripts/utils/health-check.sh"
alias dev-logs="docker-compose logs -f"
alias dev-ps="docker-compose ps"
alias dev-restart="docker-compose restart"
alias dev-stop="docker-compose stop"
alias dev-down="docker-compose down"
alias dev-up="docker-compose up -d"
EOF
    
    # Create VSCode settings if VSCode is detected
    if command -v code >/dev/null 2>&1; then
        log "Setting up VSCode configuration..."
        
        mkdir -p .vscode
        
        cat > .vscode/settings.json << 'EOF'
{
  "typescript.preferences.quoteStyle": "double",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.next": true,
    "**/coverage": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.next": true,
    "**/coverage": true
  },
  "emmet.includeLanguages": {
    "typescript": "html",
    "typescriptreact": "html"
  }
}
EOF
        
        success "VSCode configuration created"
    fi
    
    # Create useful scripts
    mkdir -p scripts/dev
    
    cat > scripts/dev/start-all.sh << 'EOF'
#!/bin/bash
# Start all development services
echo "Starting all development services..."
docker-compose up -d postgres redis
sleep 5
npm run dev &
echo "All services started!"
EOF
    
    cat > scripts/dev/stop-all.sh << 'EOF'
#!/bin/bash
# Stop all development services
echo "Stopping all development services..."
pkill -f "npm run dev"
docker-compose stop
echo "All services stopped!"
EOF
    
    chmod +x scripts/dev/*.sh
    
    success "Development tools setup completed"
}

# Validate setup
validate_setup() {
    log "Validating environment setup..."
    
    local validation_errors=()
    
    # Check environment files
    local env_files=(".env")
    if [[ -d "backend" ]]; then env_files+=("backend/.env"); fi
    if [[ -d "frontend" ]]; then env_files+=("frontend/.env.local"); fi
    if [[ -d "auth" ]]; then env_files+=("auth/.env"); fi
    
    for env_file in "${env_files[@]}"; do
        if [[ -f "$env_file" ]]; then
            log "✓ Environment file exists: $env_file"
        else
            validation_errors+=("Missing environment file: $env_file")
        fi
    done
    
    # Check service dependencies
    IFS=',' read -ra service_array <<< "$SERVICES"
    
    for service in "${service_array[@]}"; do
        service=$(echo "$service" | xargs) # trim whitespace
        
        if [[ -d "$service/node_modules" ]]; then
            log "✓ Dependencies installed for $service"
        else
            validation_errors+=("Missing dependencies for service: $service")
        fi
    done
    
    # Check Docker services (if Docker is enabled)
    if [[ "$SKIP_DOCKER" != "true" ]] && command -v docker >/dev/null 2>&1; then
        if docker ps | grep -q "dev-postgres"; then
            log "✓ PostgreSQL container running"
        else
            validation_errors+=("PostgreSQL container not running")
        fi
        
        if docker ps | grep -q "dev-redis"; then
            log "✓ Redis container running"
        else
            validation_errors+=("Redis container not running")
        fi
    fi
    
    if [[ ${#validation_errors[@]} -gt 0 ]]; then
        error "Validation failed with the following errors:"
        for error_msg in "${validation_errors[@]}"; do
            error "  - $error_msg"
        done
        exit 1
    fi
    
    success "Environment setup validation passed"
}

# Generate setup report
generate_setup_report() {
    log "Generating setup report..."
    
    local report_file="setup-report-$(date +%Y%m%d-%H%M%S).json"
    
    cat > "$report_file" << EOF
{
  "timestamp": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')",
  "environment": "$ENVIRONMENT",
  "services": $(echo "$SERVICES" | jq -R 'split(",")'),
  "configuration": {
    "skip_docker": $SKIP_DOCKER,
    "skip_dependencies": $SKIP_DEPENDENCIES,
    "skip_env_files": $SKIP_ENV_FILES,
    "force_reinstall": $FORCE_REINSTALL
  },
  "service_ports": {
$(for service in "${!SERVICE_PORTS[@]}"; do
    echo "    \"$service\": ${SERVICE_PORTS[$service]},"
done | sed '$ s/,$//')
  },
  "status": "completed"
}
EOF
    
    log "Setup report generated: $report_file"
}

# Main setup function
main() {
    log "Starting environment setup for: $ENVIRONMENT"
    log "Services: $SERVICES"
    log "Skip Docker: $SKIP_DOCKER"
    log "Skip dependencies: $SKIP_DEPENDENCIES"
    log "Skip env files: $SKIP_ENV_FILES"
    log "Force reinstall: $FORCE_REINSTALL"
    
    check_prerequisites
    setup_docker_environment
    generate_env_files
    install_dependencies
    setup_dev_tools
    validate_setup
    generate_setup_report
    
    # Final instructions
    echo
    success "Environment setup completed successfully!"
    echo
    log "Next steps:"
    log "  1. Source the aliases: source .aliases"
    log "  2. Start development: npm run dev"
    log "  3. Check service health: ./scripts/utils/health-check.sh"
    
    if [[ -f ".aliases" ]]; then
        log "  4. Use dev aliases: dev-start, dev-health, dev-logs, etc."
    fi
    
    echo
    log "Service URLs:"
    if [[ -d "frontend" ]]; then
        log "  Frontend: http://localhost:${SERVICE_PORTS["frontend"]}"
    fi
    if [[ -d "backend" ]]; then
        log "  Backend: http://localhost:${SERVICE_PORTS["backend"]}"
    fi
    if [[ -d "auth" ]]; then
        log "  Auth: http://localhost:${SERVICE_PORTS["auth"]}"
    fi
    
    success "Happy coding! 🚀"
}

# Handle script arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --services)
            SERVICES="$2"
            shift 2
            ;;
        --skip-docker)
            SKIP_DOCKER="true"
            shift
            ;;
        --skip-dependencies)
            SKIP_DEPENDENCIES="true"
            shift
            ;;
        --skip-env-files)
            SKIP_ENV_FILES="true"
            shift
            ;;
        --force-reinstall)
            FORCE_REINSTALL="true"
            shift
            ;;
        --help)
            cat << 'EOF'
Usage: setup-env.sh [OPTIONS]

Automated environment setup for development, testing, and production.

OPTIONS:
    --environment ENV           Environment type: development, production, test (default: development)
    --services SERVICES         Comma-separated list of services (default: backend,frontend,auth)
    --skip-docker              Skip Docker environment setup
    --skip-dependencies        Skip dependency installation
    --skip-env-files           Skip environment file generation
    --force-reinstall          Force reinstall of all dependencies
    --help                     Show this help message

EXAMPLES:
    setup-env.sh                           # Full development setup
    setup-env.sh --environment production  # Production environment setup
    setup-env.sh --skip-docker            # Setup without Docker
    setup-env.sh --force-reinstall        # Clean reinstall of everything

ENVIRONMENTS:
    development                Development environment with hot reload
    production                 Production optimized environment
    test                       Testing environment with mocked services

FEATURES:
    ✓ Prerequisites validation
    ✓ Docker network and service setup
    ✓ Environment file generation
    ✓ Dependency installation
    ✓ Development tools configuration
    ✓ Setup validation and reporting
EOF
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Execute main function
main