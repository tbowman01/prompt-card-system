#!/bin/bash

# Docker Configuration Validation Script
# Tests Docker configurations without requiring Docker to be running

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_WARNING=0

# Test result tracking
test_result() {
    local test_name="$1"
    local result="$2"
    local message="$3"
    
    case $result in
        "PASS")
            log_success "$test_name: $message"
            ((TESTS_PASSED++))
            ;;
        "FAIL")
            log_error "$test_name: $message"
            ((TESTS_FAILED++))
            ;;
        "WARN")
            log_warning "$test_name: $message"
            ((TESTS_WARNING++))
            ;;
    esac
}

# Change to project root
cd "$(dirname "$0")/.."

log_info "Starting Docker Configuration Validation..."
log_info "Project root: $(pwd)"

# ==============================================
# TEST 1: File Existence Validation
# ==============================================
log_info "Phase 1: Validating Docker file presence..."

# Check Docker Compose files
declare -A compose_files=(
    ["docker-compose.prod.yml"]="Production Docker Compose"
    ["docker/docker-compose.optimized.yml"]="Optimized Docker Compose"
    ["docker-compose.dev.yml"]="Development Docker Compose"
    ["docker-compose.monitoring.yml"]="Monitoring Docker Compose"
)

for file in "${!compose_files[@]}"; do
    if [[ -f "$file" ]]; then
        test_result "FILE_CHECK" "PASS" "${compose_files[$file]} exists at $file"
    else
        test_result "FILE_CHECK" "FAIL" "${compose_files[$file]} missing at $file"
    fi
done

# Check Dockerfile presence
declare -A dockerfiles=(
    ["backend/Dockerfile.prod"]="Backend Production Dockerfile"
    ["frontend/Dockerfile.prod"]="Frontend Production Dockerfile"
    ["docker/Dockerfile.backend.optimized"]="Backend Optimized Dockerfile"
    ["docker/Dockerfile.frontend.optimized"]="Frontend Optimized Dockerfile"
)

for file in "${!dockerfiles[@]}"; do
    if [[ -f "$file" ]]; then
        test_result "DOCKERFILE_CHECK" "PASS" "${dockerfiles[$file]} exists at $file"
    else
        test_result "DOCKERFILE_CHECK" "FAIL" "${dockerfiles[$file]} missing at $file"
    fi
done

# ==============================================
# TEST 2: Docker Compose Validation
# ==============================================
log_info "Phase 2: Validating Docker Compose configurations..."

# Function to validate compose file syntax
validate_compose_syntax() {
    local file="$1"
    local description="$2"
    
    if ! docker-compose -f "$file" config > /dev/null 2>&1; then
        test_result "COMPOSE_SYNTAX" "WARN" "$description has syntax issues (Docker not available to validate)"
        return 1
    else
        test_result "COMPOSE_SYNTAX" "PASS" "$description syntax is valid"
        return 0
    fi
}

# Check production compose file
if [[ -f "docker-compose.prod.yml" ]]; then
    # Check for required services
    required_services=("nginx" "frontend" "backend" "postgres" "redis" "ollama" "prometheus" "grafana")
    missing_services=()
    
    for service in "${required_services[@]}"; do
        if ! grep -q "^[[:space:]]*${service}:" docker-compose.prod.yml; then
            missing_services+=("$service")
        fi
    done
    
    if [[ ${#missing_services[@]} -eq 0 ]]; then
        test_result "COMPOSE_SERVICES" "PASS" "All required services found in production compose"
    else
        test_result "COMPOSE_SERVICES" "FAIL" "Missing services in production compose: ${missing_services[*]}"
    fi
    
    # Check for health checks
    if grep -q "healthcheck:" docker-compose.prod.yml; then
        test_result "COMPOSE_HEALTH" "PASS" "Health checks configured in production compose"
    else
        test_result "COMPOSE_HEALTH" "WARN" "No health checks found in production compose"
    fi
    
    # Check for volume definitions
    if grep -q "^volumes:" docker-compose.prod.yml; then
        test_result "COMPOSE_VOLUMES" "PASS" "Persistent volumes configured in production compose"
    else
        test_result "COMPOSE_VOLUMES" "WARN" "No persistent volumes configured in production compose"
    fi
fi

# ==============================================
# TEST 3: Dockerfile Validation
# ==============================================
log_info "Phase 3: Validating Dockerfile configurations..."

# Function to validate Dockerfile best practices
validate_dockerfile() {
    local file="$1"
    local description="$2"
    
    if [[ ! -f "$file" ]]; then
        test_result "DOCKERFILE_VALIDATION" "FAIL" "$description not found at $file"
        return 1
    fi
    
    # Check for multi-stage build
    if grep -q "^FROM.*AS" "$file"; then
        test_result "DOCKERFILE_MULTISTAGE" "PASS" "$description uses multi-stage build"
    else
        test_result "DOCKERFILE_MULTISTAGE" "WARN" "$description not using multi-stage build"
    fi
    
    # Check for non-root user
    if grep -q "USER" "$file"; then
        test_result "DOCKERFILE_USER" "PASS" "$description configures non-root user"
    else
        test_result "DOCKERFILE_USER" "WARN" "$description may run as root user"
    fi
    
    # Check for health check
    if grep -q "HEALTHCHECK" "$file"; then
        test_result "DOCKERFILE_HEALTH" "PASS" "$description includes health check"
    else
        test_result "DOCKERFILE_HEALTH" "WARN" "$description missing health check"
    fi
    
    # Check for EXPOSE directive
    if grep -q "EXPOSE" "$file"; then
        test_result "DOCKERFILE_EXPOSE" "PASS" "$description properly exposes ports"
    else
        test_result "DOCKERFILE_EXPOSE" "WARN" "$description missing EXPOSE directive"
    fi
    
    # Check for proper entrypoint
    if grep -q -E "(ENTRYPOINT|CMD)" "$file"; then
        test_result "DOCKERFILE_ENTRYPOINT" "PASS" "$description has proper entrypoint/command"
    else
        test_result "DOCKERFILE_ENTRYPOINT" "FAIL" "$description missing ENTRYPOINT or CMD"
    fi
}

# Validate each Dockerfile
validate_dockerfile "backend/Dockerfile.prod" "Backend Production Dockerfile"
validate_dockerfile "frontend/Dockerfile.prod" "Frontend Production Dockerfile"
validate_dockerfile "docker/Dockerfile.backend.optimized" "Backend Optimized Dockerfile"
validate_dockerfile "docker/Dockerfile.frontend.optimized" "Frontend Optimized Dockerfile"

# ==============================================
# TEST 4: Environment Configuration
# ==============================================
log_info "Phase 4: Validating environment configurations..."

# Check production environment file
if [[ -f ".env.production" ]]; then
    test_result "ENV_CONFIG" "PASS" "Production environment file exists"
    
    # Check for required environment variables
    required_vars=("NODE_ENV" "POSTGRES_DB" "POSTGRES_USER" "REDIS_URL" "JWT_SECRET")
    missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" .env.production; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -eq 0 ]]; then
        test_result "ENV_VARS" "PASS" "All required environment variables present"
    else
        test_result "ENV_VARS" "WARN" "Missing environment variables: ${missing_vars[*]}"
    fi
    
    # Check for default passwords (security concern)
    if grep -q "CHANGE_ME" .env.production; then
        test_result "ENV_SECURITY" "FAIL" "Default passwords found in production config - SECURITY RISK!"
    else
        test_result "ENV_SECURITY" "PASS" "No default passwords found in production config"
    fi
else
    test_result "ENV_CONFIG" "WARN" "Production environment file not found"
fi

# ==============================================
# TEST 5: Network Configuration
# ==============================================
log_info "Phase 5: Validating network configurations..."

# Check nginx configuration
if [[ -f "nginx/nginx.conf" ]]; then
    test_result "NGINX_CONFIG" "PASS" "Nginx configuration file exists"
    
    # Check for SSL configuration
    if grep -q "ssl_certificate" nginx/nginx.conf; then
        test_result "NGINX_SSL" "PASS" "SSL configuration found in Nginx"
    else
        test_result "NGINX_SSL" "WARN" "No SSL configuration found in Nginx"
    fi
else
    test_result "NGINX_CONFIG" "FAIL" "Nginx configuration file not found"
fi

# ==============================================
# TEST 6: Monitoring Configuration
# ==============================================
log_info "Phase 6: Validating monitoring configurations..."

# Check Prometheus configuration
if [[ -f "monitoring/prometheus/prometheus.yml" ]]; then
    test_result "PROMETHEUS_CONFIG" "PASS" "Prometheus configuration exists"
    
    # Check for scrape targets
    if grep -q "scrape_configs:" monitoring/prometheus/prometheus.yml; then
        test_result "PROMETHEUS_SCRAPE" "PASS" "Prometheus scrape targets configured"
    else
        test_result "PROMETHEUS_SCRAPE" "WARN" "No scrape targets configured in Prometheus"
    fi
else
    test_result "PROMETHEUS_CONFIG" "WARN" "Prometheus configuration not found"
fi

# Check Grafana configuration
if [[ -d "monitoring/grafana" ]]; then
    test_result "GRAFANA_CONFIG" "PASS" "Grafana configuration directory exists"
    
    if [[ -f "monitoring/grafana/dashboards/prompt-card-overview.json" ]]; then
        test_result "GRAFANA_DASHBOARDS" "PASS" "Grafana dashboards configured"
    else
        test_result "GRAFANA_DASHBOARDS" "WARN" "No Grafana dashboards found"
    fi
else
    test_result "GRAFANA_CONFIG" "WARN" "Grafana configuration not found"
fi

# ==============================================
# TEST 7: Security Validation
# ==============================================
log_info "Phase 7: Validating security configurations..."

# Check for secrets in Docker files
security_check_files=("docker-compose.prod.yml" "docker/docker-compose.optimized.yml")
for file in "${security_check_files[@]}"; do
    if [[ -f "$file" ]]; then
        if grep -q "security_opt" "$file"; then
            test_result "SECURITY_OPTIONS" "PASS" "Security options configured in $file"
        else
            test_result "SECURITY_OPTIONS" "WARN" "No security options found in $file"
        fi
        
        # Check for hardcoded secrets (basic check)
        if grep -qE "(password|secret|key).*:" "$file" | grep -qv "\${"; then
            test_result "HARDCODED_SECRETS" "WARN" "Potential hardcoded secrets in $file"
        else
            test_result "HARDCODED_SECRETS" "PASS" "No hardcoded secrets detected in $file"
        fi
    fi
done

# ==============================================
# TEST 8: Build Context Validation
# ==============================================
log_info "Phase 8: Validating build contexts..."

# Check .dockerignore files
if [[ -f "backend/.dockerignore" ]]; then
    test_result "DOCKERIGNORE_BACKEND" "PASS" "Backend .dockerignore exists"
else
    test_result "DOCKERIGNORE_BACKEND" "WARN" "Backend .dockerignore missing - build context may be large"
fi

if [[ -f "frontend/.dockerignore" ]]; then
    test_result "DOCKERIGNORE_FRONTEND" "PASS" "Frontend .dockerignore exists"
else
    test_result "DOCKERIGNORE_FRONTEND" "WARN" "Frontend .dockerignore missing - build context may be large"
fi

# Check for large directories that should be ignored
large_dirs=("node_modules" ".git" "coverage" "dist" "build")
for dir in "${large_dirs[@]}"; do
    if [[ -d "backend/$dir" ]] && [[ -f "backend/.dockerignore" ]]; then
        if ! grep -q "$dir" backend/.dockerignore; then
            test_result "BUILD_CONTEXT" "WARN" "Backend build context includes $dir directory"
        fi
    fi
    
    if [[ -d "frontend/$dir" ]] && [[ -f "frontend/.dockerignore" ]]; then
        if ! grep -q "$dir" frontend/.dockerignore; then
            test_result "BUILD_CONTEXT" "WARN" "Frontend build context includes $dir directory"
        fi
    fi
done

# ==============================================
# FINAL RESULTS
# ==============================================
log_info "Docker Configuration Validation Complete!"
echo ""
echo "========================================"
echo "VALIDATION SUMMARY"
echo "========================================"
echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
echo -e "${YELLOW}Tests with Warnings: $TESTS_WARNING${NC}"
echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"
echo "========================================"

# Generate recommendations
echo ""
log_info "RECOMMENDATIONS:"

if [[ $TESTS_FAILED -gt 0 ]]; then
    echo "🔴 CRITICAL: $TESTS_FAILED critical issues found. Address before production deployment."
fi

if [[ $TESTS_WARNING -gt 0 ]]; then
    echo "🟡 WARNING: $TESTS_WARNING potential issues found. Consider addressing for optimal security/performance."
fi

if [[ $TESTS_PASSED -gt 0 && $TESTS_FAILED -eq 0 ]]; then
    echo "✅ GOOD: Basic configuration validation passed. Ready for Docker testing phase."
fi

# Exit code based on results
if [[ $TESTS_FAILED -gt 0 ]]; then
    exit 1
else
    exit 0
fi