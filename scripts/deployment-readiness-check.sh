#!/bin/bash

# Deployment Readiness Check Script
# Validates all system components before production deployment

set -e

echo "🚀 PROMPT CARD SYSTEM - DEPLOYMENT READINESS CHECK"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

# Helper functions
pass() { echo -e "${GREEN}✅ PASS${NC}: $1"; ((PASS_COUNT++)); }
fail() { echo -e "${RED}❌ FAIL${NC}: $1"; ((FAIL_COUNT++)); }
warn() { echo -e "${YELLOW}⚠️  WARN${NC}: $1"; ((WARN_COUNT++)); }
info() { echo -e "${BLUE}ℹ️  INFO${NC}: $1"; }

# Test function wrapper
test_section() {
    echo -e "\n${BLUE}Testing: $1${NC}"
    echo "----------------------------------------"
}

# 1. Environment Check
test_section "Environment Requirements"

# Check Docker
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | cut -d',' -f1)
    pass "Docker installed (version: $DOCKER_VERSION)"
else
    fail "Docker not installed"
fi

# Check Docker Compose
if command -v docker compose &> /dev/null; then
    COMPOSE_VERSION=$(docker compose version | cut -d' ' -f4 | cut -d'v' -f2)
    pass "Docker Compose installed (version: $COMPOSE_VERSION)"
else
    fail "Docker Compose not installed"
fi

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    pass "Node.js installed (version: $NODE_VERSION)"
else
    warn "Node.js not installed locally (Docker will handle this)"
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    pass "npm installed (version: $NPM_VERSION)"
else
    warn "npm not installed locally (Docker will handle this)"
fi

# 2. File Structure Check
test_section "File Structure"

REQUIRED_FILES=(
    "package.json"
    "docker-compose.yml"
    "docker-compose.dev.yml" 
    "docker-compose.prod.yml"
    "docker-compose.monitoring.yml"
    "docker-security.yml"
    "backend/package.json"
    "backend/Dockerfile.dev"
    "backend/src/server.ts"
    "frontend/package.json"
    "frontend/Dockerfile.dev"
    ".github/workflows/test-suite.yml"
    "nginx/nginx.conf"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        pass "Required file exists: $file"
    else
        fail "Missing required file: $file"
    fi
done

# 3. Configuration Validation
test_section "Configuration Files"

# Check environment files
if [[ -f ".env.dev" ]]; then
    pass "Development environment file exists"
else
    warn "Missing .env.dev file"
fi

if [[ -f ".env.production" ]]; then
    pass "Production environment file exists"
    
    # Check for required production variables
    PROD_VARS=("NODE_ENV" "DATABASE_URL" "JWT_SECRET" "ENCRYPTION_KEY")
    for var in "${PROD_VARS[@]}"; do
        if grep -q "^$var=" .env.production; then
            pass "Production variable configured: $var"
        else
            fail "Missing production variable: $var"
        fi
    done
else
    fail "Missing .env.production file"
fi

# 4. Security Check
test_section "Security Configuration"

# Check security files
SECURITY_FILES=(
    "backend/src/middleware/security.ts"
    "backend/src/middleware/advancedSecurity.ts" 
    "backend/src/middleware/enhancedAuth.ts"
    "backend/src/services/security/SecretManager.ts"
    ".github/workflows/security.yml"
)

for file in "${SECURITY_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        pass "Security file exists: $file"
    else
        fail "Missing security file: $file"
    fi
done

# Check for security headers in nginx config
if [[ -f "nginx/nginx.conf" ]] && grep -q "add_header X-Content-Type-Options" nginx/nginx.conf; then
    pass "Security headers configured in nginx"
else
    warn "Security headers may not be configured in nginx"
fi

# 5. Database Check
test_section "Database Configuration"

if [[ -d "database" ]]; then
    pass "Database directory exists"
else
    warn "Database directory not found"
fi

# Check for database migration files
if [[ -f "backend/src/database/migrate.ts" ]] || [[ -f "backend/src/database/migrate.js" ]]; then
    pass "Database migration file exists"
else
    warn "Database migration file not found"
fi

# 6. Monitoring Check
test_section "Monitoring & Observability"

MONITORING_FILES=(
    "monitoring/prometheus/prometheus.yml"
    "monitoring/grafana/datasources/prometheus.yml"
    "monitoring/alertmanager/alertmanager.yml"
)

for file in "${MONITORING_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        pass "Monitoring file exists: $file"
    else
        warn "Missing monitoring file: $file"
    fi
done

# 7. Docker Build Test
test_section "Docker Build Validation"

info "Testing Docker image builds..."

# Test backend build
if docker compose -f docker-compose.dev.yml build backend --no-cache > /dev/null 2>&1; then
    pass "Backend Docker image builds successfully"
else
    fail "Backend Docker image build failed"
fi

# Test frontend build
if docker compose -f docker-compose.dev.yml build frontend --no-cache > /dev/null 2>&1; then
    pass "Frontend Docker image builds successfully"
else
    fail "Frontend Docker image build failed"
fi

# 8. Port Availability Check
test_section "Port Availability"

REQUIRED_PORTS=(3000 3001 5432 6379 9090 3100)

for port in "${REQUIRED_PORTS[@]}"; do
    if ss -tuln | grep -q ":$port "; then
        warn "Port $port is already in use (may conflict)"
    else
        pass "Port $port is available"
    fi
done

# 9. Network Connectivity Test
test_section "Network Configuration"

# Test if we can create Docker networks
if docker network create test-network --driver bridge > /dev/null 2>&1; then
    pass "Can create Docker networks"
    docker network rm test-network > /dev/null 2>&1
else
    fail "Cannot create Docker networks"
fi

# 10. Git Repository Status
test_section "Source Control"

if [[ -d ".git" ]]; then
    pass "Git repository initialized"
    
    # Check for uncommitted changes
    if [[ -z $(git status --porcelain) ]]; then
        pass "No uncommitted changes"
    else
        warn "Uncommitted changes detected"
        git status --short
    fi
    
    # Check current branch
    CURRENT_BRANCH=$(git branch --show-current)
    if [[ "$CURRENT_BRANCH" == "main" || "$CURRENT_BRANCH" == "master" ]]; then
        pass "On main branch ($CURRENT_BRANCH)"
    else
        warn "Not on main branch (current: $CURRENT_BRANCH)"
    fi
else
    warn "Not a Git repository"
fi

# Summary
echo -e "\n${BLUE}DEPLOYMENT READINESS SUMMARY${NC}"
echo "=============================================="
echo -e "✅ Passed: ${GREEN}$PASS_COUNT${NC}"
echo -e "❌ Failed: ${RED}$FAIL_COUNT${NC}"
echo -e "⚠️  Warnings: ${YELLOW}$WARN_COUNT${NC}"

# Deployment recommendation
echo -e "\n${BLUE}DEPLOYMENT RECOMMENDATION:${NC}"
if [[ $FAIL_COUNT -eq 0 ]]; then
    if [[ $WARN_COUNT -eq 0 ]]; then
        echo -e "${GREEN}🚀 READY FOR PRODUCTION DEPLOYMENT${NC}"
        echo "All checks passed successfully!"
    else
        echo -e "${YELLOW}⚠️  READY WITH WARNINGS${NC}"
        echo "Address warnings before production deployment for optimal security."
    fi
else
    echo -e "${RED}❌ NOT READY FOR DEPLOYMENT${NC}"
    echo "Fix all failed checks before proceeding to production."
    exit 1
fi

echo -e "\n${BLUE}NEXT STEPS:${NC}"
echo "1. Start development environment: docker compose -f docker-compose.dev.yml up -d"
echo "2. Run test suite: npm test"
echo "3. Start monitoring stack: docker compose -f docker-compose.monitoring.yml up -d"
echo "4. Run security scan: npm run security:audit"
echo "5. Deploy to staging: docker compose -f docker-compose.yml up -d"
echo "6. Deploy to production: docker compose -f docker-compose.prod.yml up -d"

exit 0