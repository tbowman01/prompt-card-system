#!/bin/bash

# Publish containers to GitHub Container Registry (ghcr.io)
# This script builds and publishes all service containers

set -euo pipefail

# Configuration
REGISTRY="ghcr.io"
OWNER="tbowman01"
REPO="prompt-card-system"
TAG="${1:-latest}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${2:-$NC}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    log "ERROR: $1" "$RED"
    exit 1
}

info() {
    log "INFO: $1" "$BLUE"
}

success() {
    log "SUCCESS: $1" "$GREEN"
}

# Check prerequisites
check_prerequisites() {
    info "Checking prerequisites..."
    
    command -v docker >/dev/null 2>&1 || error "Docker is required but not installed"
    command -v gh >/dev/null 2>&1 || error "GitHub CLI is required but not installed"
    
    # Check if logged in to GitHub
    gh auth status >/dev/null 2>&1 || error "Not authenticated with GitHub. Run: gh auth login"
    
    success "Prerequisites check passed"
}

# Login to GitHub Container Registry
login_to_ghcr() {
    info "Logging in to GitHub Container Registry..."
    
    # Get GitHub token
    GITHUB_TOKEN=$(gh auth token)
    
    # Login to ghcr.io
    echo "$GITHUB_TOKEN" | docker login "$REGISTRY" -u "$OWNER" --password-stdin
    
    success "Logged in to $REGISTRY"
}

# Build and push container
build_and_push() {
    local service=$1
    local context=$2
    local dockerfile=$3
    local image="$REGISTRY/$OWNER/$REPO-$service"
    
    info "Building $service container..."
    
    # Build for multiple platforms
    docker buildx create --use --name multiarch-builder 2>/dev/null || true
    
    docker buildx build \
        --platform linux/amd64,linux/arm64 \
        --tag "$image:$TAG" \
        --tag "$image:latest" \
        --tag "$image:$(git rev-parse --short HEAD)" \
        --build-arg VERSION="$(git rev-parse HEAD)" \
        --build-arg BUILD_DATE="$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
        --file "$dockerfile" \
        --push \
        "$context"
    
    success "Published $image:$TAG"
}

# Main execution
main() {
    info "Starting container publishing to GitHub Container Registry"
    
    check_prerequisites
    login_to_ghcr
    
    # Build and push backend
    info "Publishing backend container..."
    build_and_push "backend" "./backend" "./backend/Dockerfile"
    
    # Build and push frontend
    info "Publishing frontend container..."
    build_and_push "frontend" "./frontend" "./frontend/Dockerfile"
    
    # Build and push auth service
    info "Publishing auth container..."
    build_and_push "auth" "./auth" "./auth/Dockerfile"
    
    success "All containers published successfully!"
    
    info "Container URLs:"
    echo "  - $REGISTRY/$OWNER/$REPO-backend:$TAG"
    echo "  - $REGISTRY/$OWNER/$REPO-frontend:$TAG"
    echo "  - $REGISTRY/$OWNER/$REPO-auth:$TAG"
    
    info "To pull the containers:"
    echo "  docker pull $REGISTRY/$OWNER/$REPO-backend:$TAG"
    echo "  docker pull $REGISTRY/$OWNER/$REPO-frontend:$TAG"
    echo "  docker pull $REGISTRY/$OWNER/$REPO-auth:$TAG"
}

# Run main function
main "$@"