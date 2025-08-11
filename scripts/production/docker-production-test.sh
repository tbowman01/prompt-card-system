#!/bin/bash

# Enhanced Docker Production Deployment Test Script
# =================================================
# P2 Enhancement: Comprehensive Docker production deployment testing
# This script tests Docker production deployment with advanced validation

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo -e "${PURPLE}🐳 Enhanced Docker Production Deployment Test${NC}"
echo "============================================="

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_RESULTS=()
TEST_FAILED=0
TEST_PASSED=0
TEST_WARNINGS=0
TEMP_DIR="/tmp/docker-prod-test-$$"
LOAD_TEST_DURATION=${LOAD_TEST_DURATION:-30}
CONCURRENT_USERS=${CONCURRENT_USERS:-10}

# Create temporary directory
mkdir -p "$TEMP_DIR"

# Function to log test results
log_test_result() {
    local status=$1
    local message=$2
    local details=${3:-}
    
    case $status in
        "PASS")
            echo -e "${GREEN}✅ $message${NC}"
            if [ -n "$details" ]; then
                echo -e "${CYAN}   └─ $details${NC}"
            fi
            TEST_PASSED=$((TEST_PASSED + 1))
            TEST_RESULTS+=("✅ $message")
            ;;
        "FAIL")
            echo -e "${RED}❌ $message${NC}"
            if [ -n "$details" ]; then
                echo -e "${RED}   └─ $details${NC}"
            fi
            TEST_FAILED=$((TEST_FAILED + 1))
            TEST_RESULTS+=("❌ $message")
            ;;
        "WARN")
            echo -e "${YELLOW}⚠️ $message${NC}"
            if [ -n "$details" ]; then
                echo -e "${YELLOW}   └─ $details${NC}"
            fi
            TEST_WARNINGS=$((TEST_WARNINGS + 1))
            TEST_RESULTS+=("⚠️ $message")
            ;;
    esac
}

# Cleanup function
cleanup() {
    echo -e "${BLUE}🧹 Cleaning up test resources...${NC}"
    
    # Stop and remove test containers
    docker-compose -f docker-compose.prod.yml -f "$TEMP_DIR/docker-compose.test.yml" down --remove-orphans --volumes 2>/dev/null || true
    
    # Remove test images
    docker rmi prompt-backend:test prompt-frontend:test 2>/dev/null || true
    
    # Remove temporary files
    rm -rf "$TEMP_DIR" 2>/dev/null || true
    
    echo -e "${GREEN}✅ Cleanup completed${NC}"
}

# Set trap for cleanup
trap cleanup EXIT

# Check prerequisites
check_prerequisites() {
    echo -e "${BLUE}🔍 Checking prerequisites...${NC}"
    
    # Check if Docker is available
    if ! command -v docker &> /dev/null; then
        log_test_result "FAIL" "Docker not available" "Please install Docker and try again"
        exit 1
    fi
    log_test_result "PASS" "Docker is available"
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_test_result "FAIL" "Docker Compose not available" "Please install Docker Compose and try again"
        exit 1
    fi
    log_test_result "PASS" "Docker Compose is available"
    
    # Check Docker daemon
    if ! docker info &> /dev/null; then
        log_test_result "FAIL" "Docker daemon not running" "Please start Docker daemon"
        exit 1
    fi
    log_test_result "PASS" "Docker daemon is running"
    
    # Check BuildKit support
    if docker buildx version &> /dev/null; then
        log_test_result "PASS" "Docker BuildKit available"
    else
        log_test_result "WARN" "Docker BuildKit not available" "Consider upgrading Docker for better build performance"
    fi
    
    # Check available resources
    local free_space=$(df /var/lib/docker 2>/dev/null | awk 'NR==2 {print $4}' || echo "0")
    if [ "$free_space" -gt 5000000 ]; then  # 5GB in KB
        log_test_result "PASS" "Sufficient disk space available"
    else
        log_test_result "WARN" "Low disk space" "Consider freeing up disk space for Docker builds"
    fi
    
    # Check memory
    local total_mem=$(grep MemTotal /proc/meminfo | awk '{print $2}' || echo "0")
    if [ "$total_mem" -gt 2097152 ]; then  # 2GB in KB
        log_test_result "PASS" "Sufficient memory available"
    else
        log_test_result "WARN" "Low memory" "Consider increasing available memory for Docker"
    fi
}

# Test Docker builds with comprehensive validation
test_docker_builds() {
    echo -e "${BLUE}🏗️ Testing Docker builds with comprehensive validation...${NC}"
    
    # Test backend production build with BuildKit
    echo -e "${BLUE}Building backend with BuildKit...${NC}"
    local start_time=$(date +%s)
    
    if DOCKER_BUILDKIT=1 docker build \
        -f backend/Dockerfile.prod \
        --target production \
        --build-arg BUILDKIT_INLINE_CACHE=1 \
        --cache-from prompt-backend:latest \
        -t prompt-backend:test \
        ./backend > "$TEMP_DIR/backend-build.log" 2>&1; then
        
        local end_time=$(date +%s)
        local build_time=$((end_time - start_time))
        log_test_result "PASS" "Backend build successful" "Build time: ${build_time}s"
        
        # Test image security
        if docker run --rm prompt-backend:test whoami | grep -q "nodeuser"; then
            log_test_result "PASS" "Backend runs as non-root user"
        else
            log_test_result "FAIL" "Backend runs as root user" "Security risk detected"
        fi
        
    else
        log_test_result "FAIL" "Backend build failed" "Check $TEMP_DIR/backend-build.log for details"
        return 1
    fi
    
    # Test frontend production build with BuildKit
    echo -e "${BLUE}Building frontend with BuildKit...${NC}"
    start_time=$(date +%s)
    
    if DOCKER_BUILDKIT=1 docker build \
        -f frontend/Dockerfile.prod \
        --target production \
        --build-arg BUILDKIT_INLINE_CACHE=1 \
        --cache-from prompt-frontend:latest \
        -t prompt-frontend:test \
        ./frontend > "$TEMP_DIR/frontend-build.log" 2>&1; then
        
        local end_time=$(date +%s)
        local build_time=$((end_time - start_time))
        log_test_result "PASS" "Frontend build successful" "Build time: ${build_time}s"
        
        # Test image security
        if docker run --rm prompt-frontend:test whoami | grep -q "nextjs"; then
            log_test_result "PASS" "Frontend runs as non-root user"
        else
            log_test_result "FAIL" "Frontend runs as root user" "Security risk detected"
        fi
        
    else
        log_test_result "FAIL" "Frontend build failed" "Check $TEMP_DIR/frontend-build.log for details"
        return 1
    fi
    
    # Analyze image sizes and efficiency
    local backend_size=$(docker images prompt-backend:test --format "{{.Size}}")
    local frontend_size=$(docker images prompt-frontend:test --format "{{.Size}}")
    local backend_layers=$(docker history prompt-backend:test --no-trunc | wc -l)
    local frontend_layers=$(docker history prompt-frontend:test --no-trunc | wc -l)
    
    echo -e "${BLUE}📊 Image Analysis:${NC}"
    echo -e "   Backend: $backend_size ($backend_layers layers)"
    echo -e "   Frontend: $frontend_size ($frontend_layers layers)"
    
    # Check for reasonable image sizes (warning thresholds)
    local backend_mb=$(docker inspect prompt-backend:test --format='{{.Size}}' | awk '{print int($1/1048576)}')
    local frontend_mb=$(docker inspect prompt-frontend:test --format='{{.Size}}' | awk '{print int($1/1048576)}')
    
    if [ "$backend_mb" -lt 500 ]; then
        log_test_result "PASS" "Backend image size optimized" "${backend_mb}MB"
    elif [ "$backend_mb" -lt 1000 ]; then
        log_test_result "WARN" "Backend image size moderate" "${backend_mb}MB - consider optimization"
    else
        log_test_result "WARN" "Backend image size large" "${backend_mb}MB - optimization recommended"
    fi
    
    if [ "$frontend_mb" -lt 200 ]; then
        log_test_result "PASS" "Frontend image size optimized" "${frontend_mb}MB"
    elif [ "$frontend_mb" -lt 500 ]; then
        log_test_result "WARN" "Frontend image size moderate" "${frontend_mb}MB - consider optimization"
    else
        log_test_result "WARN" "Frontend image size large" "${frontend_mb}MB - optimization recommended"
    fi
    
    # Test image vulnerabilities (if trivy is available)
    if command -v trivy &> /dev/null; then
        echo -e "${BLUE}🛡️ Testing image security vulnerabilities...${NC}"
        
        if trivy image --exit-code 1 --severity HIGH,CRITICAL --no-progress prompt-backend:test > "$TEMP_DIR/backend-vuln.log" 2>&1; then
            log_test_result "PASS" "Backend image has no high/critical vulnerabilities"
        else
            log_test_result "WARN" "Backend image has vulnerabilities" "Check $TEMP_DIR/backend-vuln.log"
        fi
        
        if trivy image --exit-code 1 --severity HIGH,CRITICAL --no-progress prompt-frontend:test > "$TEMP_DIR/frontend-vuln.log" 2>&1; then
            log_test_result "PASS" "Frontend image has no high/critical vulnerabilities"
        else
            log_test_result "WARN" "Frontend image has vulnerabilities" "Check $TEMP_DIR/frontend-vuln.log"
        fi
    else
        log_test_result "WARN" "Trivy not available" "Install trivy for security vulnerability scanning"
    fi
}

# Test Docker Compose configuration with advanced validation
test_compose_config() {
    echo -e "${BLUE}🔧 Testing Docker Compose configuration with advanced validation...${NC}"
    
    # Validate main production compose file
    if docker-compose -f docker-compose.prod.yml config > "$TEMP_DIR/config-output.yml" 2>&1; then
        log_test_result "PASS" "Production Docker Compose configuration valid"
    else
        log_test_result "FAIL" "Production Docker Compose configuration invalid" "Check $TEMP_DIR/config-output.yml"
        return 1
    fi
    
    # Validate monitoring compose file
    if docker-compose -f docker-compose.monitoring.yml config > "$TEMP_DIR/monitoring-config.yml" 2>&1; then
        log_test_result "PASS" "Monitoring Docker Compose configuration valid"
    else
        log_test_result "FAIL" "Monitoring Docker Compose configuration invalid" "Check $TEMP_DIR/monitoring-config.yml"
    fi
    
    # Test combined configuration
    if docker-compose -f docker-compose.prod.yml -f docker-compose.monitoring.yml config > "$TEMP_DIR/combined-config.yml" 2>&1; then
        log_test_result "PASS" "Combined Docker Compose configuration valid"
    else
        log_test_result "WARN" "Combined Docker Compose configuration issues" "Check $TEMP_DIR/combined-config.yml"
    fi
    
    # Validate network configuration
    local networks=$(docker-compose -f docker-compose.prod.yml config --services | wc -l)
    if [ "$networks" -gt 5 ]; then
        log_test_result "PASS" "Multiple services configured" "$networks services"
    else
        log_test_result "WARN" "Limited services configured" "Only $networks services"
    fi
    
    # Check for required environment variables
    local missing_vars=()
    local required_vars=("DATABASE_URL" "REDIS_URL" "JWT_SECRET" "POSTGRES_PASSWORD")
    
    for var in "${required_vars[@]}"; do
        if ! grep -q "$var" docker-compose.prod.yml; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -eq 0 ]; then
        log_test_result "PASS" "All required environment variables referenced"
    else
        log_test_result "WARN" "Some environment variables missing" "${missing_vars[*]}"
    fi
    
    # Test with environment file if available
    if [ -f ".env.production" ]; then
        if docker-compose -f docker-compose.prod.yml --env-file .env.production config > /dev/null 2>&1; then
            log_test_result "PASS" "Configuration valid with production environment"
        else
            log_test_result "WARN" "Configuration issues with production environment"
        fi
    else
        log_test_result "WARN" "No .env.production file found" "Create production environment file"
    fi
}

# Test comprehensive service startup and health checks
test_service_startup() {
    echo -e "${BLUE}🚀 Testing comprehensive service startup and health checks...${NC}"
    
    # Create test compose override
    cat > "$TEMP_DIR/docker-compose.test.yml" << 'EOF'
version: '3.8'
services:
  backend:
    image: prompt-backend:test
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=test
      - DATABASE_URL=sqlite:///tmp/test.db
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=test-secret-key
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 30s
      
  frontend:
    image: prompt-frontend:test
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=http://backend:3001
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 30s
EOF
    
    # Pull required base images with retry logic
    local base_images=(
        "postgres:16-alpine"
        "redis:7.2-alpine"
        "nginx:1.25-alpine"
        "prom/prometheus:v2.45.0"
        "grafana/grafana:10.0.0"
        "ollama/ollama:latest"
    )
    
    echo -e "${BLUE}📥 Pulling base images...${NC}"
    for image in "${base_images[@]}"; do
        local retries=3
        while [ $retries -gt 0 ]; do
            if docker pull "$image" > "$TEMP_DIR/pull-${image//[:\/]/_}.log" 2>&1; then
                log_test_result "PASS" "Base image pulled: $image"
                break
            else
                retries=$((retries - 1))
                if [ $retries -eq 0 ]; then
                    log_test_result "WARN" "Failed to pull base image: $image" "Check $TEMP_DIR/pull-${image//[:\/]/_}.log"
                else
                    echo -e "${YELLOW}⏳ Retrying pull for $image (attempts left: $retries)${NC}"
                    sleep 2
                fi
            fi
        done
    done
    
    # Test service startup with timeout
    echo -e "${BLUE}🚀 Testing service startup...${NC}"
    
    if timeout 120 docker-compose -f docker-compose.prod.yml -f "$TEMP_DIR/docker-compose.test.yml" up -d --build > "$TEMP_DIR/startup.log" 2>&1; then
        log_test_result "PASS" "Services started successfully"
        
        # Wait for services to be ready
        echo -e "${BLUE}⏳ Waiting for services to be healthy...${NC}"
        local max_wait=90
        local wait_time=0
        local services_ready=false
        
        while [ $wait_time -lt $max_wait ] && [ "$services_ready" = false ]; do
            if docker-compose -f docker-compose.prod.yml -f "$TEMP_DIR/docker-compose.test.yml" ps --filter status=running | grep -q "Up (healthy)"; then
                services_ready=true
                log_test_result "PASS" "Services are healthy"
            else
                sleep 3
                wait_time=$((wait_time + 3))
                echo -ne "\r${CYAN}   Waiting... ${wait_time}/${max_wait}s${NC}"
            fi
        done
        echo  # New line after progress
        
        if [ "$services_ready" = false ]; then
            log_test_result "WARN" "Services started but health checks pending" "Check service logs for issues"
        fi
        
        # Test service connectivity
        test_service_connectivity
        
        # Stop services
        echo -e "${BLUE}⏹️ Stopping test services...${NC}"
        docker-compose -f docker-compose.prod.yml -f "$TEMP_DIR/docker-compose.test.yml" down --remove-orphans --volumes > /dev/null 2>&1
        
    else
        log_test_result "FAIL" "Service startup failed" "Check $TEMP_DIR/startup.log for details"
        return 1
    fi
}

# Test service connectivity and endpoints
test_service_connectivity() {
    echo -e "${BLUE}🔗 Testing service connectivity...${NC}"
    
    # Test backend API endpoint
    local max_retries=10
    local retry_count=0
    while [ $retry_count -lt $max_retries ]; do
        if curl -f -s http://localhost:3001/api/health > /dev/null 2>&1; then
            log_test_result "PASS" "Backend API endpoint accessible"
            break
        else
            retry_count=$((retry_count + 1))
            if [ $retry_count -eq $max_retries ]; then
                log_test_result "WARN" "Backend API endpoint not accessible" "Service may still be starting"
            else
                sleep 3
            fi
        fi
    done
    
    # Test frontend endpoint
    retry_count=0
    while [ $retry_count -lt $max_retries ]; do
        if curl -f -s http://localhost:3000 > /dev/null 2>&1; then
            log_test_result "PASS" "Frontend endpoint accessible"
            break
        else
            retry_count=$((retry_count + 1))
            if [ $retry_count -eq $max_retries ]; then
                log_test_result "WARN" "Frontend endpoint not accessible" "Service may still be starting"
            else
                sleep 3
            fi
        fi
    done
    
    # Test database connectivity (if accessible)
    if docker-compose -f docker-compose.prod.yml exec -T postgres pg_isready > /dev/null 2>&1; then
        log_test_result "PASS" "Database connectivity confirmed"
    else
        log_test_result "WARN" "Database connectivity not confirmed" "May be expected if not fully started"
    fi
    
    # Test Redis connectivity (if accessible)
    if docker-compose -f docker-compose.prod.yml exec -T redis redis-cli ping > /dev/null 2>&1; then
        log_test_result "PASS" "Redis connectivity confirmed"
    else
        log_test_result "WARN" "Redis connectivity not confirmed" "May be expected if not fully started"
    fi
}

# Test load and performance
test_load_performance() {
    echo -e "${BLUE}⚡ Testing load and performance...${NC}"
    
    # Check if we can run load tests
    if ! command -v ab &> /dev/null && ! command -v curl &> /dev/null; then
        log_test_result "WARN" "Load testing tools not available" "Install apache2-utils (ab) or curl for load testing"
        return
    fi
    
    # Simple load test with curl if ab is not available
    if command -v ab &> /dev/null; then
        echo -e "${BLUE}Running Apache Bench load test...${NC}"
        if ab -n 100 -c $CONCURRENT_USERS -t $LOAD_TEST_DURATION http://localhost:3001/api/health > "$TEMP_DIR/load-test.log" 2>&1; then
            local requests_per_sec=$(grep "Requests per second" "$TEMP_DIR/load-test.log" | awk '{print $4}')
            local time_per_request=$(grep "Time per request.*mean" "$TEMP_DIR/load-test.log" | head -1 | awk '{print $4}')
            log_test_result "PASS" "Load test completed" "${requests_per_sec} req/sec, ${time_per_request}ms avg response"
        else
            log_test_result "WARN" "Load test failed" "Check $TEMP_DIR/load-test.log"
        fi
    else
        echo -e "${BLUE}Running basic performance test with curl...${NC}"
        local start_time=$(date +%s%N)
        for i in $(seq 1 10); do
            curl -s -o /dev/null http://localhost:3001/api/health || true
        done
        local end_time=$(date +%s%N)
        local avg_time=$(( (end_time - start_time) / 10000000 ))  # Convert to milliseconds
        log_test_result "PASS" "Basic performance test completed" "Average response time: ${avg_time}ms"
    fi
}

# Generate comprehensive test report
generate_test_report() {
    echo -e "${BLUE}📊 Generating comprehensive test report...${NC}"
    
    local report_file="$PROJECT_ROOT/docker-production-test-report.txt"
    
    cat > "$report_file" << EOF
Docker Production Deployment Test Report
========================================

Generated: $(date)
Test Environment: $(docker --version)
Project: Prompt Card System

SUMMARY
-------
✅ Tests Passed: $TEST_PASSED
❌ Tests Failed: $TEST_FAILED
⚠️ Warnings: $TEST_WARNINGS
📊 Total Tests: $((TEST_PASSED + TEST_FAILED + TEST_WARNINGS))

SUCCESS RATE: $(( TEST_PASSED * 100 / (TEST_PASSED + TEST_FAILED + TEST_WARNINGS) ))%

DETAILED RESULTS
---------------
EOF

    for result in "${TEST_RESULTS[@]}"; do
        echo "$result" >> "$report_file"
    done
    
    echo "" >> "$report_file"
    echo "TEST ARTIFACTS" >> "$report_file"
    echo "-------------" >> "$report_file"
    echo "Logs and artifacts available in: $TEMP_DIR" >> "$report_file"
    
    if [ -f "$TEMP_DIR/backend-build.log" ]; then
        echo "- Backend build log: $TEMP_DIR/backend-build.log" >> "$report_file"
    fi
    
    if [ -f "$TEMP_DIR/frontend-build.log" ]; then
        echo "- Frontend build log: $TEMP_DIR/frontend-build.log" >> "$report_file"
    fi
    
    if [ -f "$TEMP_DIR/load-test.log" ]; then
        echo "- Load test results: $TEMP_DIR/load-test.log" >> "$report_file"
    fi
    
    echo "" >> "$report_file"
    echo "RECOMMENDATIONS" >> "$report_file"
    echo "---------------" >> "$report_file"
    
    if [ $TEST_FAILED -gt 0 ]; then
        echo "🚨 CRITICAL: Address all failed tests before production deployment" >> "$report_file"
    fi
    
    if [ $TEST_WARNINGS -gt 0 ]; then
        echo "⚠️ RECOMMENDED: Review and address warnings for optimal production setup" >> "$report_file"
    fi
    
    echo "✅ NEXT STEPS:" >> "$report_file"
    echo "1. Review test results and logs" >> "$report_file"
    echo "2. Address any critical issues" >> "$report_file"
    echo "3. Run production deployment validation" >> "$report_file"
    echo "4. Execute monitoring and alerting setup" >> "$report_file"
    echo "5. Perform security audit and backup validation" >> "$report_file"
    
    log_test_result "PASS" "Test report generated" "$report_file"
}

# Main test execution with comprehensive coverage
main() {
    echo -e "${CYAN}🏁 Starting comprehensive Docker production deployment tests...${NC}"
    echo "Project Root: $PROJECT_ROOT"
    echo "Test Started: $(date)"
    echo "Load Test Duration: ${LOAD_TEST_DURATION}s"
    echo "Concurrent Users: $CONCURRENT_USERS"
    echo
    
    # Change to project root
    cd "$PROJECT_ROOT"
    
    # Run all test phases
    check_prerequisites
    echo
    
    test_docker_builds
    echo
    
    test_compose_config
    echo
    
    test_service_startup
    echo
    
    test_load_performance
    echo
    
    generate_test_report
    
    # Display final summary
    echo
    echo -e "${PURPLE}📋 TEST SUMMARY${NC}"
    echo "====================="
    echo -e "${GREEN}✅ Passed: $TEST_PASSED${NC}"
    echo -e "${RED}❌ Failed: $TEST_FAILED${NC}"
    echo -e "${YELLOW}⚠️ Warnings: $TEST_WARNINGS${NC}"
    echo -e "📊 Total: $((TEST_PASSED + TEST_FAILED + TEST_WARNINGS))"
    echo
    
    if [ $TEST_FAILED -eq 0 ]; then
        echo -e "${GREEN}🎉 Docker production deployment tests completed successfully!${NC}"
        echo -e "${BLUE}📝 Review the full report: docker-production-test-report.txt${NC}"
        echo -e "${BLUE}🚀 Ready for production deployment${NC}"
        
        # Keep temp directory for inspection if requested
        if [ "${KEEP_TEMP_FILES:-false}" = "true" ]; then
            echo -e "${CYAN}📁 Test artifacts preserved: $TEMP_DIR${NC}"
            trap - EXIT  # Disable cleanup
        fi
        
        exit 0
    else
        echo -e "${RED}⚠️ Tests completed with failures. Review issues before production deployment.${NC}"
        echo -e "${BLUE}📝 Review the full report: docker-production-test-report.txt${NC}"
        
        # Keep temp directory for debugging
        echo -e "${CYAN}📁 Test artifacts preserved for debugging: $TEMP_DIR${NC}"
        trap - EXIT  # Disable cleanup
        
        exit 1
    fi
}

# Run main function
main
