#!/bin/bash

# Docker Production Deployment Validator
# =====================================
# P2 Enhancement: Complete Docker deployment testing
# This script validates Docker configurations and prepares deployment tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo -e "${PURPLE}🐳 Docker Production Deployment Validator${NC}"
echo "=============================================="

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VALIDATION_RESULTS="$PROJECT_ROOT/docker-validation-results.txt"
TEST_RESULTS=()
WARNINGS=()
CRITICAL_ISSUES=()

# Validation counters
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNING=0

# Function to log results
log_result() {
    local status=$1
    local message=$2
    local details=${3:-}
    
    case $status in
        "PASS")
            echo -e "${GREEN}✅ $message${NC}"
            if [ -n "$details" ]; then
                echo -e "${CYAN}   └─ $details${NC}"
            fi
            CHECKS_PASSED=$((CHECKS_PASSED + 1))
            TEST_RESULTS+=("✅ $message")
            ;;
        "FAIL")
            echo -e "${RED}❌ $message${NC}"
            if [ -n "$details" ]; then
                echo -e "${RED}   └─ $details${NC}"
            fi
            CHECKS_FAILED=$((CHECKS_FAILED + 1))
            TEST_RESULTS+=("❌ $message")
            CRITICAL_ISSUES+=("$message: $details")
            ;;
        "WARN")
            echo -e "${YELLOW}⚠️ $message${NC}"
            if [ -n "$details" ]; then
                echo -e "${YELLOW}   └─ $details${NC}"
            fi
            CHECKS_WARNING=$((CHECKS_WARNING + 1))
            TEST_RESULTS+=("⚠️ $message")
            WARNINGS+=("$message: $details")
            ;;
    esac
}

# Function to validate Docker Compose files
validate_compose_files() {
    echo -e "${BLUE}🔍 Validating Docker Compose Configurations...${NC}"
    
    local compose_files=(
        "docker-compose.prod.yml"
        "docker-compose.dev.yml"
        "docker-compose.monitoring.yml"
        "docker/docker-compose.optimized.yml"
    )
    
    for file in "${compose_files[@]}"; do
        local filepath="$PROJECT_ROOT/$file"
        
        if [ -f "$filepath" ]; then
            # Check if file is valid YAML
            if python3 -c "import yaml; yaml.safe_load(open('$filepath'))" 2>/dev/null; then
                log_result "PASS" "Docker Compose file syntax: $file"
                
                # Check for required services in production file
                if [[ "$file" == "docker-compose.prod.yml" ]]; then
                    local required_services=("frontend" "backend" "postgres" "redis" "nginx" "prometheus" "grafana")
                    
                    for service in "${required_services[@]}"; do
                        if grep -q "^[[:space:]]*${service}:" "$filepath"; then
                            log_result "PASS" "Required service found: $service"
                        else
                            log_result "FAIL" "Missing required service: $service"
                        fi
                    done
                    
                    # Check for security configurations
                    if grep -q "restart: unless-stopped" "$filepath"; then
                        log_result "PASS" "Restart policy configured"
                    else
                        log_result "WARN" "No restart policy specified"
                    fi
                    
                    # Check for health checks
                    if grep -q "healthcheck:" "$filepath"; then
                        log_result "PASS" "Health checks configured"
                    else
                        log_result "WARN" "No health checks configured"
                    fi
                fi
                
            else
                log_result "FAIL" "Invalid YAML syntax: $file"
            fi
        else
            log_result "FAIL" "Docker Compose file not found: $file"
        fi
    done
}

# Function to validate Dockerfiles
validate_dockerfiles() {
    echo -e "${BLUE}🔍 Validating Dockerfile Configurations...${NC}"
    
    local dockerfiles=(
        "backend/Dockerfile.prod"
        "frontend/Dockerfile.prod"
        "docker/Dockerfile.backend.optimized"
        "docker/Dockerfile.frontend.optimized"
    )
    
    for dockerfile in "${dockerfiles[@]}"; do
        local filepath="$PROJECT_ROOT/$dockerfile"
        
        if [ -f "$filepath" ]; then
            log_result "PASS" "Dockerfile exists: $dockerfile"
            
            # Check for multi-stage build
            if grep -q "^FROM.*AS" "$filepath"; then
                log_result "PASS" "Multi-stage build detected: $dockerfile"
            else
                log_result "WARN" "Single-stage build: $dockerfile" "Consider multi-stage for optimization"
            fi
            
            # Check for non-root user
            if grep -q "USER" "$filepath"; then
                log_result "PASS" "Non-root user configured: $dockerfile"
            else
                log_result "FAIL" "Running as root user: $dockerfile" "Security risk"
            fi
            
            # Check for health checks
            if grep -q "HEALTHCHECK" "$filepath"; then
                log_result "PASS" "Health check defined: $dockerfile"
            else
                log_result "WARN" "No health check defined: $dockerfile"
            fi
            
            # Check for security updates
            if grep -q "apk update.*apk upgrade\|apt-get update.*apt-get upgrade" "$filepath"; then
                log_result "PASS" "Security updates included: $dockerfile"
            else
                log_result "WARN" "No security updates: $dockerfile"
            fi
            
        else
            log_result "FAIL" "Dockerfile not found: $dockerfile"
        fi
    done
}

# Function to validate environment files
validate_environment() {
    echo -e "${BLUE}🔍 Validating Environment Configuration...${NC}"
    
    local env_files=(
        ".env.production"
        ".env.dev"
        ".env.dev.example"
    )
    
    for env_file in "${env_files[@]}"; do
        local filepath="$PROJECT_ROOT/$env_file"
        
        if [ -f "$filepath" ]; then
            log_result "PASS" "Environment file exists: $env_file"
            
            # Check for required production variables
            if [[ "$env_file" == ".env.production" ]]; then
                local required_vars=(
                    "DATABASE_URL"
                    "REDIS_URL"
                    "JWT_SECRET"
                    "POSTGRES_PASSWORD"
                    "GRAFANA_ADMIN_PASSWORD"
                )
                
                for var in "${required_vars[@]}"; do
                    if grep -q "^${var}=" "$filepath"; then
                        log_result "PASS" "Required environment variable: $var"
                    else
                        log_result "FAIL" "Missing environment variable: $var"
                    fi
                done
                
                # Check for secure values (not default)
                if grep -q "changeme\|password123\|secret123" "$filepath"; then
                    log_result "FAIL" "Default/insecure values detected" "Please use secure passwords"
                else
                    log_result "PASS" "No default passwords detected"
                fi
            fi
        else
            if [[ "$env_file" == ".env.production" ]]; then
                log_result "FAIL" "Production environment file missing: $env_file"
            else
                log_result "WARN" "Environment file missing: $env_file"
            fi
        fi
    done
}

# Function to validate monitoring configuration
validate_monitoring() {
    echo -e "${BLUE}🔍 Validating Monitoring Configuration...${NC}"
    
    local monitoring_configs=(
        "monitoring/prometheus/prometheus.yml"
        "monitoring/grafana/dashboards/dashboards.yml"
        "monitoring/grafana/datasources/prometheus.yml"
        "monitoring/alertmanager/alertmanager.yml"
    )
    
    for config in "${monitoring_configs[@]}"; do
        local filepath="$PROJECT_ROOT/$config"
        
        if [ -f "$filepath" ]; then
            log_result "PASS" "Monitoring config exists: $config"
            
            # Validate YAML syntax
            if python3 -c "import yaml; yaml.safe_load(open('$filepath'))" 2>/dev/null; then
                log_result "PASS" "Valid YAML syntax: $config"
            else
                log_result "FAIL" "Invalid YAML syntax: $config"
            fi
        else
            log_result "WARN" "Monitoring config missing: $config"
        fi
    done
    
    # Check for Grafana dashboards
    if [ -d "$PROJECT_ROOT/monitoring/grafana/dashboards" ]; then
        local dashboard_count=$(find "$PROJECT_ROOT/monitoring/grafana/dashboards" -name "*.json" | wc -l)
        if [ "$dashboard_count" -gt 0 ]; then
            log_result "PASS" "Grafana dashboards found: $dashboard_count"
        else
            log_result "WARN" "No Grafana dashboards found"
        fi
    fi
}

# Function to validate security configuration
validate_security() {
    echo -e "${BLUE}🔍 Validating Security Configuration...${NC}"
    
    # Check for SSL/TLS configuration
    if [ -d "$PROJECT_ROOT/nginx/ssl" ] || [ -f "$PROJECT_ROOT/nginx/nginx.conf" ]; then
        if [ -f "$PROJECT_ROOT/nginx/nginx.conf" ] && grep -q "ssl_certificate" "$PROJECT_ROOT/nginx/nginx.conf"; then
            log_result "PASS" "SSL configuration found in Nginx"
        else
            log_result "WARN" "SSL configuration not found" "Consider enabling HTTPS"
        fi
    else
        log_result "WARN" "No SSL configuration directory found"
    fi
    
    # Check for backup configuration
    if [ -f "$PROJECT_ROOT/scripts/production/backup.sh" ]; then
        log_result "PASS" "Backup script exists"
        if [ -x "$PROJECT_ROOT/scripts/production/backup.sh" ]; then
            log_result "PASS" "Backup script is executable"
        else
            log_result "WARN" "Backup script not executable"
        fi
    else
        log_result "FAIL" "Backup script missing"
    fi
    
    # Check for database initialization
    if [ -d "$PROJECT_ROOT/database/init" ]; then
        log_result "PASS" "Database initialization scripts directory exists"
        local init_scripts=$(find "$PROJECT_ROOT/database/init" -name "*.sql" | wc -l)
        if [ "$init_scripts" -gt 0 ]; then
            log_result "PASS" "Database initialization scripts found: $init_scripts"
        else
            log_result "WARN" "No database initialization scripts found"
        fi
    else
        log_result "WARN" "No database initialization directory found"
    fi
}

# Function to validate network configuration
validate_network() {
    echo -e "${BLUE}🔍 Validating Network Configuration...${NC}"
    
    # Check docker-compose network configuration
    if [ -f "$PROJECT_ROOT/docker-compose.prod.yml" ]; then
        if grep -q "networks:" "$PROJECT_ROOT/docker-compose.prod.yml"; then
            log_result "PASS" "Custom networks configured"
            
            # Check for bridge network
            if grep -q "driver: bridge" "$PROJECT_ROOT/docker-compose.prod.yml"; then
                log_result "PASS" "Bridge network driver configured"
            else
                log_result "WARN" "No explicit bridge network driver"
            fi
            
            # Check for subnet configuration
            if grep -q "subnet:" "$PROJECT_ROOT/docker-compose.prod.yml"; then
                log_result "PASS" "Custom subnet configured"
            else
                log_result "WARN" "No custom subnet configured"
            fi
        else
            log_result "WARN" "No custom networks configured" "Using default bridge network"
        fi
    fi
}

# Function to create deployment test script
create_deployment_test_script() {
    echo -e "${BLUE}🛠️ Creating deployment test script...${NC}"
    
    local test_script="$PROJECT_ROOT/scripts/production/docker-production-test.sh"
    
    cat > "$test_script" << 'EOF'
#!/bin/bash

# Docker Production Deployment Test Script
# ========================================
# This script tests Docker production deployment when Docker is available

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🐳 Docker Production Deployment Test${NC}"
echo "===================================="

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not available. Please install Docker and try again.${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose not available. Please install Docker Compose and try again.${NC}"
    exit 1
fi

# Test Docker builds
test_docker_builds() {
    echo -e "${BLUE}🏗️ Testing Docker builds...${NC}"
    
    # Test backend production build
    echo -e "${BLUE}Building backend...${NC}"
    if DOCKER_BUILDKIT=1 docker build -f backend/Dockerfile.prod --target production -t prompt-backend:test ./backend; then
        echo -e "${GREEN}✅ Backend build successful${NC}"
    else
        echo -e "${RED}❌ Backend build failed${NC}"
        return 1
    fi
    
    # Test frontend production build
    echo -e "${BLUE}Building frontend...${NC}"
    if DOCKER_BUILDKIT=1 docker build -f frontend/Dockerfile.prod --target production -t prompt-frontend:test ./frontend; then
        echo -e "${GREEN}✅ Frontend build successful${NC}"
    else
        echo -e "${RED}❌ Frontend build failed${NC}"
        return 1
    fi
    
    # Test image sizes
    backend_size=$(docker images prompt-backend:test --format "{{.Size}}")
    frontend_size=$(docker images prompt-frontend:test --format "{{.Size}}")
    
    echo -e "${BLUE}📊 Image sizes:${NC}"
    echo -e "   Backend: $backend_size"
    echo -e "   Frontend: $frontend_size"
}

# Test Docker Compose configuration
test_compose_config() {
    echo -e "${BLUE}🔧 Testing Docker Compose configuration...${NC}"
    
    # Validate compose file
    if docker-compose -f docker-compose.prod.yml config &> /dev/null; then
        echo -e "${GREEN}✅ Docker Compose configuration valid${NC}"
    else
        echo -e "${RED}❌ Docker Compose configuration invalid${NC}"
        docker-compose -f docker-compose.prod.yml config
        return 1
    fi
}

# Test service startup (dry run)
test_service_startup() {
    echo -e "${BLUE}🚀 Testing service startup (dry run)...${NC}"
    
    # Pull required images
    echo -e "${BLUE}Pulling base images...${NC}"
    docker pull postgres:16-alpine
    docker pull redis:7.2-alpine
    docker pull nginx:1.25-alpine
    docker pull prom/prometheus:v2.45.0
    docker pull grafana/grafana:10.0.0
    
    echo -e "${GREEN}✅ Base images pulled successfully${NC}"
}

# Main test execution
main() {
    echo -e "${BLUE}Starting Docker production deployment tests...${NC}"
    
    test_docker_builds
    test_compose_config
    test_service_startup
    
    echo -e "${GREEN}🎉 All Docker production tests completed successfully!${NC}"
}

# Run tests
main
EOF

    chmod +x "$test_script"
    log_result "PASS" "Docker production test script created" "$test_script"
}

# Function to generate validation report
generate_report() {
    echo -e "${BLUE}📊 Generating validation report...${NC}"
    
    cat > "$VALIDATION_RESULTS" << EOF
Docker Production Deployment Validation Report
==============================================

Generated: $(date)
Project: Prompt Card System
Validator Version: 1.0.0

SUMMARY
-------
✅ Checks Passed: $CHECKS_PASSED
❌ Checks Failed: $CHECKS_FAILED
⚠️  Warnings: $CHECKS_WARNING
📊 Total Checks: $((CHECKS_PASSED + CHECKS_FAILED + CHECKS_WARNING))

SUCCESS RATE: $(( CHECKS_PASSED * 100 / (CHECKS_PASSED + CHECKS_FAILED + CHECKS_WARNING) ))%

DETAILED RESULTS
---------------
EOF

    for result in "${TEST_RESULTS[@]}"; do
        echo "$result" >> "$VALIDATION_RESULTS"
    done
    
    if [ ${#CRITICAL_ISSUES[@]} -gt 0 ]; then
        echo "" >> "$VALIDATION_RESULTS"
        echo "CRITICAL ISSUES REQUIRING ATTENTION" >> "$VALIDATION_RESULTS"
        echo "-----------------------------------" >> "$VALIDATION_RESULTS"
        for issue in "${CRITICAL_ISSUES[@]}"; do
            echo "❌ $issue" >> "$VALIDATION_RESULTS"
        done
    fi
    
    if [ ${#WARNINGS[@]} -gt 0 ]; then
        echo "" >> "$VALIDATION_RESULTS"
        echo "WARNINGS AND RECOMMENDATIONS" >> "$VALIDATION_RESULTS"
        echo "---------------------------" >> "$VALIDATION_RESULTS"
        for warning in "${WARNINGS[@]}"; do
            echo "⚠️ $warning" >> "$VALIDATION_RESULTS"
        done
    fi
    
    echo "" >> "$VALIDATION_RESULTS"
    echo "NEXT STEPS" >> "$VALIDATION_RESULTS"
    echo "----------" >> "$VALIDATION_RESULTS"
    echo "1. Address all critical issues before deployment" >> "$VALIDATION_RESULTS"
    echo "2. Review and implement warning recommendations" >> "$VALIDATION_RESULTS"
    echo "3. Run Docker production test script when Docker is available" >> "$VALIDATION_RESULTS"
    echo "4. Execute production deployment test plan" >> "$VALIDATION_RESULTS"
    echo "5. Monitor deployment health and performance" >> "$VALIDATION_RESULTS"
    
    log_result "PASS" "Validation report generated" "$VALIDATION_RESULTS"
}

# Main execution
main() {
    echo -e "${CYAN}🏁 Starting Docker production deployment validation...${NC}"
    echo "Project Root: $PROJECT_ROOT"
    echo "Validation Started: $(date)"
    echo
    
    # Change to project root
    cd "$PROJECT_ROOT"
    
    # Run all validation checks
    validate_compose_files
    echo
    validate_dockerfiles
    echo
    validate_environment
    echo
    validate_monitoring
    echo
    validate_security
    echo
    validate_network
    echo
    create_deployment_test_script
    echo
    generate_report
    
    # Display final summary
    echo
    echo -e "${PURPLE}📋 VALIDATION SUMMARY${NC}"
    echo "====================="
    echo -e "${GREEN}✅ Passed: $CHECKS_PASSED${NC}"
    echo -e "${RED}❌ Failed: $CHECKS_FAILED${NC}"
    echo -e "${YELLOW}⚠️ Warnings: $CHECKS_WARNING${NC}"
    echo -e "📊 Total: $((CHECKS_PASSED + CHECKS_FAILED + CHECKS_WARNING))"
    echo
    
    if [ $CHECKS_FAILED -eq 0 ]; then
        echo -e "${GREEN}🎉 Docker production deployment validation completed successfully!${NC}"
        echo -e "${BLUE}📝 Review the full report: $VALIDATION_RESULTS${NC}"
        echo -e "${BLUE}🚀 Next: Run docker-production-test.sh when Docker is available${NC}"
        exit 0
    else
        echo -e "${RED}⚠️ Validation completed with issues. Please address critical failures.${NC}"
        echo -e "${BLUE}📝 Review the full report: $VALIDATION_RESULTS${NC}"
        exit 1
    fi
}

# Check dependencies
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python3 is required for YAML validation. Please install python3.${NC}"
    exit 1
fi

# Run main function
main