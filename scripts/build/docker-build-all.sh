#!/bin/bash
# =============================================================================
# 🚀 OPTIMIZED DOCKER BUILD SCRIPT - ALL SERVICES
# =============================================================================
# Memory-driven optimizations based on build analysis:
# - Multi-stage builds with enhanced caching
# - Fallback configuration patterns for build reliability
# - Cross-platform support with BuildKit optimization
# - Registry cache integration for faster rebuilds
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REGISTRY="${REGISTRY:-ghcr.io}"
REPOSITORY="${REPOSITORY:-$(git config --get remote.origin.url | sed 's/.*[:/]\([^/]*\/[^/]*\)\.git/\1/')}"
BUILD_PLATFORMS="${BUILD_PLATFORMS:-linux/amd64,linux/arm64}"
PUSH_IMAGES="${PUSH_IMAGES:-false}"
USE_CACHE="${USE_CACHE:-true}"
SERVICES="${SERVICES:-backend,frontend,auth}"

# Build configuration
DOCKER_BUILDKIT=1
BUILDKIT_PROGRESS=plain

# Logging function
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

# Setup BuildX if not exists
setup_buildx() {
    log "Setting up Docker BuildX with optimized configuration..."
    
    if ! docker buildx ls | grep -q "prompt-card-builder"; then
        docker buildx create \
            --name prompt-card-builder \
            --platform="$BUILD_PLATFORMS" \
            --driver docker-container \
            --driver-opt network=host \
            --driver-opt image=moby/buildkit:buildx-stable-1 \
            --config <(cat << 'EOF'
[worker.oci]
  max-parallelism = 6
  gc = true
  gckeepstorage = "10GB"
[worker.containerd]
  snapshotter = "overlayfs" 
  gc = true
  gckeepstorage = "10GB"
[registry."docker.io"]
  mirrors = ["mirror.gcr.io"]
[registry."ghcr.io"]
  http = true
  insecure = false
EOF
)
    fi
    
    docker buildx use prompt-card-builder
    docker buildx inspect --bootstrap
    success "BuildX setup completed"
}

# Build service with enhanced error handling
build_service() {
    local service="$1"
    local context="${2:-.}"
    local dockerfile="${3:-$service/Dockerfile}"
    
    log "Building $service service..."
    
    # Check if Dockerfile exists
    if [[ ! -f "$dockerfile" ]]; then
        error "Dockerfile not found: $dockerfile"
        return 1
    fi
    
    # Generate build tags
    local image_name="$REGISTRY/$REPOSITORY-$service"
    local build_tags="--tag $image_name:latest"
    
    if [[ -n "${BUILD_VERSION:-}" ]]; then
        build_tags="$build_tags --tag $image_name:$BUILD_VERSION"
    fi
    
    if [[ -n "${GITHUB_SHA:-}" ]]; then
        build_tags="$build_tags --tag $image_name:sha-${GITHUB_SHA:0:7}"
    fi
    
    # Cache configuration
    local cache_config=""
    if [[ "$USE_CACHE" == "true" ]]; then
        cache_config="--cache-from type=gha,scope=$service-build"
        cache_config="$cache_config --cache-from type=registry,ref=$image_name:buildcache"
        
        if [[ "$PUSH_IMAGES" == "true" ]]; then
            cache_config="$cache_config --cache-to type=gha,mode=max,scope=$service-build"
            cache_config="$cache_config --cache-to type=registry,ref=$image_name:buildcache,mode=max"
        fi
    fi
    
    # Build arguments
    local build_args=""
    build_args="--build-arg BUILDPLATFORM=linux/amd64"
    build_args="$build_args --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
    build_args="$build_args --build-arg BUILD_VERSION=${BUILD_VERSION:-dev}"
    build_args="$build_args --build-arg SERVICE_NAME=$service"
    build_args="$build_args --build-arg NODE_OPTIONS=--max-old-space-size=4096"
    
    # Execute build with error handling and fallbacks
    local build_cmd="docker buildx build"
    build_cmd="$build_cmd --platform $BUILD_PLATFORMS"
    build_cmd="$build_cmd --file $dockerfile"
    build_cmd="$build_cmd --context $context"
    build_cmd="$build_cmd $build_tags"
    build_cmd="$build_cmd $cache_config"
    build_cmd="$build_cmd $build_args"
    build_cmd="$build_cmd --provenance=false"
    build_cmd="$build_cmd --sbom=false"
    
    if [[ "$PUSH_IMAGES" == "true" ]]; then
        build_cmd="$build_cmd --push"
    else
        build_cmd="$build_cmd --load"
    fi
    
    # Add final context
    build_cmd="$build_cmd ."
    
    log "Executing: $build_cmd"
    
    # Execute with retry logic
    local attempt=1
    local max_attempts=3
    
    while [[ $attempt -le $max_attempts ]]; do
        if eval "$build_cmd"; then
            success "$service build completed successfully (attempt $attempt)"
            return 0
        else
            error "$service build failed (attempt $attempt/$max_attempts)"
            
            if [[ $attempt -eq $max_attempts ]]; then
                error "All build attempts failed for $service"
                return 1
            fi
            
            warning "Retrying build for $service in 10 seconds..."
            sleep 10
            ((attempt++))
        fi
    done
}

# Validate build environment
validate_environment() {
    log "Validating build environment..."
    
    # Check Docker version
    if ! docker --version >/dev/null 2>&1; then
        error "Docker is not installed or not accessible"
        exit 1
    fi
    
    # Check BuildX availability
    if ! docker buildx version >/dev/null 2>&1; then
        error "Docker BuildX is not available"
        exit 1
    fi
    
    # Check if we can access the registry if pushing
    if [[ "$PUSH_IMAGES" == "true" ]]; then
        if ! docker info | grep -q "Registry:"; then
            warning "Docker registry access may not be configured"
        fi
    fi
    
    success "Environment validation completed"
}

# Main build function
main() {
    log "Starting optimized Docker build process..."
    log "Registry: $REGISTRY"
    log "Repository: $REPOSITORY"
    log "Platforms: $BUILD_PLATFORMS"
    log "Push images: $PUSH_IMAGES"
    log "Use cache: $USE_CACHE"
    log "Services: $SERVICES"
    
    validate_environment
    setup_buildx
    
    # Convert services string to array
    IFS=',' read -ra service_array <<< "$SERVICES"
    
    local failed_services=()
    local successful_services=()
    
    # Build each service
    for service in "${service_array[@]}"; do
        service=$(echo "$service" | xargs) # trim whitespace
        
        log "Building service: $service"
        
        if build_service "$service"; then
            successful_services+=("$service")
        else
            failed_services+=("$service")
        fi
    done
    
    # Summary
    echo
    log "Build Summary:"
    
    if [[ ${#successful_services[@]} -gt 0 ]]; then
        success "Successfully built: ${successful_services[*]}"
    fi
    
    if [[ ${#failed_services[@]} -gt 0 ]]; then
        error "Failed to build: ${failed_services[*]}"
        exit 1
    fi
    
    success "All services built successfully!"
    
    # Post-build actions
    if [[ "$PUSH_IMAGES" == "true" ]]; then
        log "Images pushed to $REGISTRY"
        log "To pull images:"
        for service in "${successful_services[@]}"; do
            echo "  docker pull $REGISTRY/$REPOSITORY-$service:latest"
        done
    else
        log "Images built locally. To push later, run with PUSH_IMAGES=true"
    fi
}

# Handle script arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --services)
            SERVICES="$2"
            shift 2
            ;;
        --push)
            PUSH_IMAGES="true"
            shift
            ;;
        --no-cache)
            USE_CACHE="false"
            shift
            ;;
        --platforms)
            BUILD_PLATFORMS="$2"
            shift 2
            ;;
        --registry)
            REGISTRY="$2"
            shift 2
            ;;
        --repository)
            REPOSITORY="$2"
            shift 2
            ;;
        --help)
            cat << EOF
Usage: $0 [OPTIONS]

OPTIONS:
    --services SERVICE1,SERVICE2    Services to build (default: backend,frontend,auth)
    --push                          Push images to registry
    --no-cache                      Disable build cache
    --platforms PLATFORMS           Target platforms (default: linux/amd64,linux/arm64)
    --registry REGISTRY             Container registry (default: ghcr.io)
    --repository REPO               Repository name (auto-detected from git)
    --help                          Show this help message

EXAMPLES:
    $0                              # Build all services locally
    $0 --services backend,frontend  # Build specific services
    $0 --push                       # Build and push to registry
    $0 --no-cache --push            # Clean build and push

ENVIRONMENT VARIABLES:
    REGISTRY                        Container registry
    REPOSITORY                      Repository name
    BUILD_PLATFORMS                 Target platforms
    PUSH_IMAGES                     Push images (true/false)
    USE_CACHE                       Use build cache (true/false)
    SERVICES                        Services to build
    BUILD_VERSION                   Version tag for images
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