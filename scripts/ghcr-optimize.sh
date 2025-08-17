#!/bin/bash

# GHCR Optimization Script
# Provides comprehensive GHCR management and optimization tools

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
REGISTRY="ghcr.io"
NAMESPACE="${GITHUB_REPOSITORY_OWNER:-$(git config user.name | tr ' ' '-' | tr '[:upper:]' '[:lower:]')}"
SERVICES=("backend" "frontend" "auth" "ollama")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️ [INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}✅ [SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠️ [WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}❌ [ERROR]${NC} $1"
}

# Help function
show_help() {
    cat << 'EOF'
🚀 GHCR Optimization Script

USAGE:
    ./scripts/ghcr-optimize.sh [COMMAND] [OPTIONS]

COMMANDS:
    auth                    Test GHCR authentication
    pull [service]          Pull optimized images from GHCR
    push [service]          Build and push optimized images
    clean                   Clean up old/unused images
    tags [service]          List available tags for service
    stats                   Show registry statistics
    health                  Check registry health
    cache-warm              Pre-warm build cache
    optimize-images         Optimize existing images
    setup-retention         Setup retention policies
    help                    Show this help message

OPTIONS:
    --namespace NAME        Override default namespace
    --registry URL          Override default registry
    --platforms LIST        Target platforms (default: linux/amd64,linux/arm64)
    --force                 Force operation without confirmation
    --dry-run               Show what would be done without executing
    --verbose               Enable verbose output

EXAMPLES:
    # Test authentication
    ./scripts/ghcr-optimize.sh auth

    # Pull all optimized images
    ./scripts/ghcr-optimize.sh pull

    # Build and push backend service
    ./scripts/ghcr-optimize.sh push backend

    # Clean up old images (dry run)
    ./scripts/ghcr-optimize.sh clean --dry-run

    # Show statistics
    ./scripts/ghcr-optimize.sh stats

ENVIRONMENT VARIABLES:
    GITHUB_TOKEN            GitHub token for authentication
    GHCR_NAMESPACE         Override namespace
    DOCKER_BUILDKIT        Enable BuildKit (default: 1)
    PLATFORMS              Target platforms

EOF
}

# Parse command line arguments
COMMAND="${1:-help}"
shift || true

NAMESPACE_OVERRIDE=""
REGISTRY_OVERRIDE=""
PLATFORMS="linux/amd64,linux/arm64"
FORCE=false
DRY_RUN=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --namespace)
            NAMESPACE_OVERRIDE="$2"
            shift 2
            ;;
        --registry)
            REGISTRY_OVERRIDE="$2"
            shift 2
            ;;
        --platforms)
            PLATFORMS="$2"
            shift 2
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        *)
            SERVICE_ARG="$1"
            shift
            ;;
    esac
done

# Apply overrides
if [[ -n "$NAMESPACE_OVERRIDE" ]]; then
    NAMESPACE="$NAMESPACE_OVERRIDE"
fi

if [[ -n "$REGISTRY_OVERRIDE" ]]; then
    REGISTRY="$REGISTRY_OVERRIDE"
fi

# Enable verbose output
if [[ "$VERBOSE" == "true" ]]; then
    set -x
fi

# Ensure Docker is available
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi
}

# Test GHCR authentication
test_auth() {
    log_info "Testing GHCR authentication..."
    
    if [[ -z "${GITHUB_TOKEN:-}" ]]; then
        log_error "GITHUB_TOKEN environment variable is not set"
        log_info "Please set your GitHub Personal Access Token:"
        log_info "export GITHUB_TOKEN=ghp_your_token_here"
        exit 1
    fi
    
    if echo "$GITHUB_TOKEN" | docker login "$REGISTRY" -u "$NAMESPACE" --password-stdin; then
        log_success "Authentication successful"
        
        # Test pull access
        if docker pull hello-world:latest &> /dev/null; then
            log_success "Registry pull access verified"
        else
            log_warning "Registry pull access failed"
        fi
        
        docker logout "$REGISTRY" &> /dev/null || true
    else
        log_error "Authentication failed"
        exit 1
    fi
}

# Get service image name
get_image_name() {
    local service="$1"
    echo "$REGISTRY/$NAMESPACE/prompt-card-$service"
}

# Pull optimized images
pull_images() {
    local target_service="${SERVICE_ARG:-all}"
    
    log_info "Pulling optimized images from GHCR..."
    
    if [[ "$target_service" == "all" ]]; then
        services_to_pull=("${SERVICES[@]}")
    else
        services_to_pull=("$target_service")
    fi
    
    for service in "${services_to_pull[@]}"; do
        local image_name
        image_name=$(get_image_name "$service")
        
        log_info "Pulling $service..."
        
        if [[ "$DRY_RUN" == "true" ]]; then
            log_info "Would run: docker pull $image_name:latest"
        else
            if docker pull "$image_name:latest"; then
                log_success "Successfully pulled $service"
                
                # Show image info
                local size
                size=$(docker inspect "$image_name:latest" --format='{{.Size}}' 2>/dev/null || echo "0")
                local size_mb=$((size / 1024 / 1024))
                log_info "$service image size: ${size_mb}MB"
            else
                log_error "Failed to pull $service"
            fi
        fi
    done
}

# Build and push optimized images
push_images() {
    local target_service="${SERVICE_ARG:-all}"
    
    log_info "Building and pushing optimized images..."
    
    # Ensure buildx is available
    if ! docker buildx version &> /dev/null; then
        log_error "Docker Buildx is not available"
        exit 1
    fi
    
    if [[ "$target_service" == "all" ]]; then
        services_to_push=("${SERVICES[@]}")
    else
        services_to_push=("$target_service")
    fi
    
    for service in "${services_to_push[@]}"; do
        local image_name
        image_name=$(get_image_name "$service")
        local dockerfile_path
        
        # Determine dockerfile path
        if [[ "$service" == "ollama" ]]; then
            dockerfile_path="./docker/ollama/Dockerfile"
        else
            dockerfile_path="./$service/Dockerfile"
        fi
        
        if [[ ! -f "$dockerfile_path" ]]; then
            log_warning "Dockerfile not found for $service at $dockerfile_path, skipping..."
            continue
        fi
        
        log_info "Building $service for platforms: $PLATFORMS"
        
        if [[ "$DRY_RUN" == "true" ]]; then
            log_info "Would build and push: $image_name"
        else
            # Build and push with optimizations
            docker buildx build \
                --platform "$PLATFORMS" \
                --file "$dockerfile_path" \
                --tag "$image_name:latest" \
                --tag "$image_name:$(git rev-parse --short HEAD)" \
                --cache-from "type=gha,scope=$service" \
                --cache-to "type=gha,mode=max,scope=$service" \
                --push \
                --build-arg BUILDKIT_INLINE_CACHE=1 \
                --build-arg DOCKER_BUILDKIT=1 \
                --label "org.opencontainers.image.source=https://github.com/$NAMESPACE/prompt-card-system" \
                --label "org.opencontainers.image.created=$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
                --label "org.opencontainers.image.revision=$(git rev-parse HEAD)" \
                . || log_error "Failed to build $service"
            
            if [[ $? -eq 0 ]]; then
                log_success "Successfully built and pushed $service"
            fi
        fi
    done
}

# Clean up old images
clean_images() {
    log_info "Cleaning up old/unused images..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Dry run mode - showing what would be cleaned:"
        docker images --filter "dangling=true" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
        docker system df
    else
        if [[ "$FORCE" == "true" ]] || read -p "This will remove dangling images and free up space. Continue? (y/N) " -n 1 -r; then
            echo
            
            # Remove dangling images
            log_info "Removing dangling images..."
            docker image prune -f
            
            # Clean build cache (keep recent)
            log_info "Cleaning build cache..."
            docker builder prune -f --filter until=24h
            
            # Show space freed
            log_info "Current disk usage:"
            docker system df
            
            log_success "Cleanup completed"
        else
            log_info "Cleanup cancelled"
        fi
    fi
}

# List available tags for a service
list_tags() {
    local service="${SERVICE_ARG:-backend}"
    local image_name
    image_name=$(get_image_name "$service")
    
    log_info "Listing available tags for $service..."
    
    # This requires GitHub CLI or API access
    if command -v gh &> /dev/null; then
        log_info "Using GitHub CLI to list tags..."
        gh api "orgs/$NAMESPACE/packages/container/prompt-card-$service/versions" \
            --jq '.[] | {name: .name, tags: .metadata.container.tags, updated: .updated_at}' 2>/dev/null || \
            log_warning "Could not fetch tags via GitHub CLI"
    else
        log_info "Available local tags:"
        docker images "$image_name" --format "table {{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
    fi
}

# Show registry statistics
show_stats() {
    log_info "GHCR Registry Statistics"
    echo "========================"
    echo "Registry: $REGISTRY"
    echo "Namespace: $NAMESPACE"
    echo "Services: ${SERVICES[*]}"
    echo ""
    
    # Show local image sizes
    log_info "Local image sizes:"
    for service in "${SERVICES[@]}"; do
        local image_name
        image_name=$(get_image_name "$service")
        
        if docker inspect "$image_name:latest" &> /dev/null; then
            local size
            size=$(docker inspect "$image_name:latest" --format='{{.Size}}' 2>/dev/null || echo "0")
            local size_mb=$((size / 1024 / 1024))
            local layers
            layers=$(docker inspect "$image_name:latest" --format='{{len .RootFS.Layers}}' 2>/dev/null || echo "0")
            echo "  $service: ${size_mb}MB ($layers layers)"
        else
            echo "  $service: Not available locally"
        fi
    done
    
    echo ""
    log_info "Docker system usage:"
    docker system df
}

# Check registry health
check_health() {
    log_info "Checking GHCR health..."
    
    # Test basic connectivity
    if docker pull hello-world:latest &> /dev/null; then
        log_success "Registry connectivity: OK"
    else
        log_error "Registry connectivity: FAILED"
        return 1
    fi
    
    # Test our images
    local healthy=true
    for service in "${SERVICES[@]}"; do
        local image_name
        image_name=$(get_image_name "$service")
        
        log_info "Testing $service..."
        if docker pull "$image_name:latest" &> /dev/null; then
            log_success "$service: Available"
        else
            log_warning "$service: Not available"
            healthy=false
        fi
    done
    
    if [[ "$healthy" == "true" ]]; then
        log_success "All services are healthy"
    else
        log_warning "Some services are not available"
    fi
}

# Pre-warm build cache
warm_cache() {
    log_info "Pre-warming build cache..."
    
    for service in "${SERVICES[@]}"; do
        local image_name
        image_name=$(get_image_name "$service")
        
        log_info "Warming cache for $service..."
        
        if [[ "$DRY_RUN" == "true" ]]; then
            log_info "Would warm cache for: $image_name"
        else
            # Pull cache images
            docker pull "$image_name:latest" &> /dev/null || log_warning "Could not pull latest for $service"
            docker pull "$image_name:cache" &> /dev/null || log_warning "Could not pull cache for $service"
        fi
    done
    
    log_success "Cache warming completed"
}

# Optimize existing images
optimize_images() {
    log_info "Optimizing existing images..."
    
    for service in "${SERVICES[@]}"; do
        local image_name
        image_name=$(get_image_name "$service")
        
        if docker inspect "$image_name:latest" &> /dev/null; then
            log_info "Analyzing $service..."
            
            # Get image statistics
            local size
            size=$(docker inspect "$image_name:latest" --format='{{.Size}}' 2>/dev/null || echo "0")
            local size_mb=$((size / 1024 / 1024))
            local layers
            layers=$(docker inspect "$image_name:latest" --format='{{len .RootFS.Layers}}' 2>/dev/null || echo "0")
            
            echo "  Size: ${size_mb}MB"
            echo "  Layers: $layers"
            
            # Recommendations
            if [[ $size_mb -gt 1024 ]]; then
                log_warning "Consider optimizing $service: size ${size_mb}MB > 1GB"
            fi
            
            if [[ $layers -gt 20 ]]; then
                log_warning "Consider consolidating layers for $service: $layers layers"
            fi
        else
            log_warning "$service image not found locally"
        fi
    done
}

# Setup retention policies
setup_retention() {
    log_info "Setting up GHCR retention policies..."
    
    cat << 'EOF'
GHCR Retention Policy Recommendations:

1. Tagged Releases (v*.*.*): Keep indefinitely
2. Main Branch Builds: Keep for 90 days
3. Development Builds: Keep for 30 days  
4. PR Builds: Keep for 7 days
5. Cache Images: Keep for 24 hours

To implement these policies:
1. Use the ghcr-retention-cleanup.yml workflow
2. Configure appropriate GitHub Actions schedules
3. Set up branch protection rules
4. Use semantic versioning for releases

The retention cleanup workflow runs daily and can be triggered manually.
EOF
}

# Main execution
main() {
    check_docker
    
    case "$COMMAND" in
        auth)
            test_auth
            ;;
        pull)
            test_auth
            pull_images
            ;;
        push)
            test_auth
            push_images
            ;;
        clean)
            clean_images
            ;;
        tags)
            list_tags
            ;;
        stats)
            show_stats
            ;;
        health)
            check_health
            ;;
        cache-warm)
            test_auth
            warm_cache
            ;;
        optimize-images)
            optimize_images
            ;;
        setup-retention)
            setup_retention
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "Unknown command: $COMMAND"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"