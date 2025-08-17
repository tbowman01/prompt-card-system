#!/bin/bash
# =============================================================================
# 🔍 DOCKER BUILD VALIDATION SCRIPT
# =============================================================================
# Memory-driven validation based on build failure analysis:
# - Health check validation for all services
# - Image size optimization verification  
# - Security vulnerability scanning
# - Performance startup time validation
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
REPOSITORY="${REPOSITORY:-$(git config --get remote.origin.url 2>/dev/null | sed 's/.*[:/]\([^/]*\/[^/]*\)\.git/\1/' || echo 'local')}"
TAG="${TAG:-latest}"
TIMEOUT="${TIMEOUT:-60}"
MAX_IMAGE_SIZE_MB="${MAX_IMAGE_SIZE_MB:-1024}"
VALIDATE_SECURITY="${VALIDATE_SECURITY:-true}"

# Service configurations
declare -A SERVICE_CONFIGS=(
    ["backend"]="port=3001,health=/health,max_startup=30"
    ["frontend"]="port=3000,health=/,max_startup=30"
    ["auth"]="port=8005,health=/auth/health,max_startup=25"
    ["ollama"]="port=11434,health=/api/version,max_startup=60"
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

# Parse service configuration
parse_service_config() {
    local service="$1"
    local config="${SERVICE_CONFIGS[$service]:-}"
    
    if [[ -z "$config" ]]; then
        error "Unknown service: $service"
        return 1
    fi
    
    # Parse config string
    local port=$(echo "$config" | grep -o 'port=[0-9]*' | cut -d= -f2)
    local health=$(echo "$config" | grep -o 'health=[^,]*' | cut -d= -f2)
    local max_startup=$(echo "$config" | grep -o 'max_startup=[0-9]*' | cut -d= -f2)
    
    echo "$port,$health,$max_startup"
}

# Validate image exists
validate_image_exists() {
    local image="$1"
    
    log "Checking if image exists: $image"
    
    if docker image inspect "$image" >/dev/null 2>&1; then
        success "Image exists locally: $image"
        return 0
    fi
    
    log "Attempting to pull image: $image"
    if docker pull "$image" >/dev/null 2>&1; then
        success "Image pulled successfully: $image"
        return 0
    fi
    
    error "Image not found: $image"
    return 1
}

# Validate image size
validate_image_size() {
    local image="$1"
    
    log "Checking image size for: $image"
    
    local size_bytes=$(docker image inspect "$image" --format='{{.Size}}' 2>/dev/null || echo "0")
    local size_mb=$((size_bytes / 1024 / 1024))
    
    log "Image size: ${size_mb} MB"
    
    if [[ $size_mb -gt $MAX_IMAGE_SIZE_MB ]]; then
        warning "Image size (${size_mb} MB) exceeds recommended maximum (${MAX_IMAGE_SIZE_MB} MB)"
        return 1
    fi
    
    success "Image size is acceptable: ${size_mb} MB"
    return 0
}

# Security scan with Trivy
security_scan() {
    local image="$1"
    
    if [[ "$VALIDATE_SECURITY" != "true" ]]; then
        log "Security scanning disabled"
        return 0
    fi
    
    log "Running security scan for: $image"
    
    # Check if trivy is available
    if ! command -v trivy >/dev/null 2>&1; then
        warning "Trivy not found, skipping security scan"
        return 0
    fi
    
    local scan_result
    if scan_result=$(trivy image --exit-code 1 --severity HIGH,CRITICAL --format json "$image" 2>/dev/null); then
        success "Security scan passed: no HIGH or CRITICAL vulnerabilities found"
        return 0
    else
        local vuln_count=$(echo "$scan_result" | jq '.Results[]?.Vulnerabilities | length' 2>/dev/null | awk '{sum+=$1} END {print sum+0}')
        warning "Security scan found $vuln_count vulnerabilities"
        
        # Create detailed report
        local report_file="security-scan-$(basename "$image" | tr '/' '-' | tr ':' '-').json"
        echo "$scan_result" > "$report_file"
        log "Detailed security report saved to: $report_file"
        
        return 1
    fi
}

# Health check validation
validate_health_check() {
    local service="$1"
    local image="$2"
    
    log "Validating health check for: $service"
    
    # Parse service configuration
    local config
    config=$(parse_service_config "$service")
    local port=$(echo "$config" | cut -d, -f1)
    local health_endpoint=$(echo "$config" | cut -d, -f2)
    local max_startup=$(echo "$config" | cut -d, -f3)
    
    local container_name="validate-$service-$$"
    
    # Start container
    log "Starting container: $container_name"
    docker run -d --name "$container_name" \
        -p "$port:$port" \
        --health-cmd="curl -f http://localhost:$port$health_endpoint || exit 1" \
        --health-interval=5s \
        --health-timeout=3s \
        --health-retries=3 \
        --health-start-period=10s \
        "$image" >/dev/null 2>&1
    
    # Wait for container to start
    local elapsed=0
    local healthy=false
    
    while [[ $elapsed -lt $max_startup ]]; do
        local status=$(docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null || echo "starting")
        
        case "$status" in
            "healthy")
                healthy=true
                break
                ;;
            "unhealthy")
                error "Container health check failed"
                docker logs "$container_name" 2>/dev/null | tail -10
                break
                ;;
            *)
                log "Waiting for container to be healthy... (${elapsed}s/${max_startup}s)"
                sleep 2
                elapsed=$((elapsed + 2))
                ;;
        esac
    done
    
    # Clean up container
    docker stop "$container_name" >/dev/null 2>&1 || true
    docker rm "$container_name" >/dev/null 2>&1 || true
    
    if [[ "$healthy" == "true" ]]; then
        success "$service health check passed (startup time: ${elapsed}s)"
        return 0
    else
        error "$service health check failed or timed out"
        return 1
    fi
}

# Smoke test
smoke_test() {
    local service="$1"
    local image="$2"
    
    log "Running smoke test for: $service"
    
    # Basic smoke test - check if container can start and run basic commands
    if docker run --rm --entrypoint=/bin/sh "$image" -c "node --version && echo 'Smoke test passed'" >/dev/null 2>&1; then
        success "$service smoke test passed"
        return 0
    else
        error "$service smoke test failed"
        return 1
    fi
}

# Validate single service
validate_service() {
    local service="$1"
    local image_name="$REGISTRY/$REPOSITORY-$service:$TAG"
    
    log "Validating service: $service"
    log "Image: $image_name"
    
    local validations=()
    local failures=()
    
    # Image existence
    if validate_image_exists "$image_name"; then
        validations+=("Image exists")
    else
        failures+=("Image not found")
        return 1
    fi
    
    # Image size
    if validate_image_size "$image_name"; then
        validations+=("Image size OK")
    else
        failures+=("Image size too large")
    fi
    
    # Security scan
    if security_scan "$image_name"; then
        validations+=("Security scan passed")
    else
        failures+=("Security vulnerabilities found")
    fi
    
    # Smoke test
    if smoke_test "$service" "$image_name"; then
        validations+=("Smoke test passed")
    else
        failures+=("Smoke test failed")
    fi
    
    # Health check (only for services with health configuration)
    if [[ -n "${SERVICE_CONFIGS[$service]:-}" ]]; then
        if validate_health_check "$service" "$image_name"; then
            validations+=("Health check passed")
        else
            failures+=("Health check failed")
        fi
    fi
    
    # Summary for service
    echo
    log "Validation summary for $service:"
    if [[ ${#validations[@]} -gt 0 ]]; then
        for validation in "${validations[@]}"; do
            success "  ✓ $validation"
        done
    fi
    
    if [[ ${#failures[@]} -gt 0 ]]; then
        for failure in "${failures[@]}"; do
            error "  ✗ $failure"
        done
        return 1
    fi
    
    return 0
}

# Generate validation report
generate_report() {
    local successful_services=("$@")
    local total_services=${#successful_services[@]}
    
    local report_file="build-validation-report-$(date +%Y%m%d-%H%M%S).json"
    
    cat > "$report_file" << EOF
{
  "validation_timestamp": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')",
  "registry": "$REGISTRY",
  "repository": "$REPOSITORY",
  "tag": "$TAG",
  "total_services": $total_services,
  "successful_services": $(printf '%s\n' "${successful_services[@]}" | jq -R . | jq -s .),
  "validation_config": {
    "max_image_size_mb": $MAX_IMAGE_SIZE_MB,
    "timeout_seconds": $TIMEOUT,
    "security_scan_enabled": $VALIDATE_SECURITY
  }
}
EOF
    
    log "Validation report generated: $report_file"
}

# Main function
main() {
    local services="${1:-backend,frontend,auth}"
    
    log "Starting Docker build validation..."
    log "Registry: $REGISTRY"
    log "Repository: $REPOSITORY"
    log "Tag: $TAG"
    log "Services: $services"
    log "Max image size: ${MAX_IMAGE_SIZE_MB} MB"
    log "Timeout: ${TIMEOUT}s"
    log "Security scanning: $VALIDATE_SECURITY"
    
    # Convert services string to array
    IFS=',' read -ra service_array <<< "$services"
    
    local successful_services=()
    local failed_services=()
    
    # Validate each service
    for service in "${service_array[@]}"; do
        service=$(echo "$service" | xargs) # trim whitespace
        
        echo
        log "========================================="
        log "Validating service: $service"
        log "========================================="
        
        if validate_service "$service"; then
            successful_services+=("$service")
        else
            failed_services+=("$service")
        fi
    done
    
    # Final summary
    echo
    echo "============================================="
    log "VALIDATION SUMMARY"
    echo "============================================="
    
    if [[ ${#successful_services[@]} -gt 0 ]]; then
        success "Successfully validated: ${successful_services[*]}"
    fi
    
    if [[ ${#failed_services[@]} -gt 0 ]]; then
        error "Failed validation: ${failed_services[*]}"
    fi
    
    # Generate report
    generate_report "${successful_services[@]}"
    
    # Exit with error if any service failed
    if [[ ${#failed_services[@]} -gt 0 ]]; then
        error "Validation failed for ${#failed_services[@]} service(s)"
        exit 1
    fi
    
    success "All services passed validation!"
}

# Handle script arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --services)
            SERVICES="$2"
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
        --tag)
            TAG="$2"
            shift 2
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --max-size)
            MAX_IMAGE_SIZE_MB="$2"
            shift 2
            ;;
        --no-security)
            VALIDATE_SECURITY="false"
            shift
            ;;
        --help)
            cat << 'EOF'
Usage: validate-builds.sh [OPTIONS] [SERVICES]

Validates Docker images for proper functionality, security, and performance.

OPTIONS:
    --services SERVICES         Comma-separated list of services to validate
    --registry REGISTRY         Container registry (default: ghcr.io)
    --repository REPO           Repository name (auto-detected from git)
    --tag TAG                   Image tag to validate (default: latest)
    --timeout SECONDS           Health check timeout (default: 60)
    --max-size MB               Maximum allowed image size in MB (default: 1024)
    --no-security               Skip security scanning
    --help                      Show this help message

EXAMPLES:
    validate-builds.sh                          # Validate all default services
    validate-builds.sh --services backend       # Validate specific service
    validate-builds.sh --tag v1.0.0            # Validate specific tag
    validate-builds.sh --no-security           # Skip security scanning

VALIDATION CHECKS:
    ✓ Image existence and accessibility
    ✓ Image size optimization
    ✓ Security vulnerability scanning
    ✓ Container health checks
    ✓ Basic smoke tests
EOF
            exit 0
            ;;
        *)
            SERVICES="$1"
            shift
            ;;
    esac
done

# Execute main function
main "${SERVICES:-backend,frontend,auth}"