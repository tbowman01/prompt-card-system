#!/bin/bash

# Production Deployment Test Script
# =================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}🧪 Production Deployment Test Suite${NC}"
echo "==================================="

# Configuration
DOMAIN=${1:-promptcard.ai}
TIMEOUT=30

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
TEST_RESULTS=()

# Function to run test
run_test() {
    local test_name=$1
    local test_command=$2
    local expected_result=${3:-0}
    
    echo -e "${BLUE}🔍 Testing: $test_name${NC}"
    
    if eval "$test_command" >/dev/null 2>&1; then
        if [ $? -eq $expected_result ]; then
            echo -e "${GREEN}✅ PASS: $test_name${NC}"
            TESTS_PASSED=$((TESTS_PASSED + 1))
            TEST_RESULTS+=("✅ $test_name")
        else
            echo -e "${RED}❌ FAIL: $test_name${NC}"
            TESTS_FAILED=$((TESTS_FAILED + 1))
            TEST_RESULTS+=("❌ $test_name")
        fi
    else
        echo -e "${RED}❌ FAIL: $test_name${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        TEST_RESULTS+=("❌ $test_name")
    fi
}

# Function to test HTTP endpoint
test_http() {
    local url=$1
    local expected_status=${2:-200}
    local test_name=$3
    
    echo -e "${BLUE}🌐 Testing HTTP: $test_name${NC}"
    
    status_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout $TIMEOUT "$url")
    
    if [ "$status_code" -eq "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS: $test_name (HTTP $status_code)${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        TEST_RESULTS+=("✅ $test_name")
    else
        echo -e "${RED}❌ FAIL: $test_name (HTTP $status_code, expected $expected_status)${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        TEST_RESULTS+=("❌ $test_name")
    fi
}

# Function to test SSL certificate
test_ssl() {
    local domain=$1
    local test_name="SSL Certificate - $domain"
    
    echo -e "${BLUE}🔒 Testing SSL: $test_name${NC}"
    
    if echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -dates >/dev/null 2>&1; then
        # Check if certificate is valid for at least 7 days
        expiry_date=$(echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2)
        expiry_timestamp=$(date -d "$expiry_date" +%s)
        current_timestamp=$(date +%s)
        days_until_expiry=$(( (expiry_timestamp - current_timestamp) / 86400 ))
        
        if [ $days_until_expiry -gt 7 ]; then
            echo -e "${GREEN}✅ PASS: $test_name (expires in $days_until_expiry days)${NC}"
            TESTS_PASSED=$((TESTS_PASSED + 1))
            TEST_RESULTS+=("✅ $test_name")
        else
            echo -e "${YELLOW}⚠️ WARNING: $test_name (expires in $days_until_expiry days)${NC}"
            TESTS_FAILED=$((TESTS_FAILED + 1))
            TEST_RESULTS+=("⚠️ $test_name - Certificate expires soon")
        fi
    else
        echo -e "${RED}❌ FAIL: $test_name${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        TEST_RESULTS+=("❌ $test_name")
    fi
}

# Function to test database connection
test_database() {
    echo -e "${BLUE}🗄️ Testing database connection...${NC}"
    
    if docker-compose -f docker-compose.prod.yml exec -T postgres pg_isready -U promptcard_user >/dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS: Database connection${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        TEST_RESULTS+=("✅ Database connection")
    else
        echo -e "${RED}❌ FAIL: Database connection${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        TEST_RESULTS+=("❌ Database connection")
    fi
}

# Function to test Redis connection
test_redis() {
    echo -e "${BLUE}📊 Testing Redis connection...${NC}"
    
    if docker-compose -f docker-compose.prod.yml exec -T redis redis-cli ping | grep -q "PONG"; then
        echo -e "${GREEN}✅ PASS: Redis connection${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        TEST_RESULTS+=("✅ Redis connection")
    else
        echo -e "${RED}❌ FAIL: Redis connection${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        TEST_RESULTS+=("❌ Redis connection")
    fi
}

# Function to test Docker services
test_docker_services() {
    echo -e "${BLUE}🐳 Testing Docker services...${NC}"
    
    local services=("nginx" "frontend" "backend" "postgres" "redis" "prometheus" "grafana")
    
    for service in "${services[@]}"; do
        if docker-compose -f docker-compose.prod.yml ps "$service" | grep -q "Up"; then
            echo -e "${GREEN}✅ PASS: $service service${NC}"
            TESTS_PASSED=$((TESTS_PASSED + 1))
            TEST_RESULTS+=("✅ $service service")
        else
            echo -e "${RED}❌ FAIL: $service service${NC}"
            TESTS_FAILED=$((TESTS_FAILED + 1))
            TEST_RESULTS+=("❌ $service service")
        fi
    done
}

# Function to test API endpoints
test_api_endpoints() {
    echo -e "${BLUE}🔌 Testing API endpoints...${NC}"
    
    # Health endpoint
    test_http "https://api.$DOMAIN/api/health" 200 "API Health Endpoint"
    
    # Comprehensive health
    test_http "https://api.$DOMAIN/api/health/comprehensive" 200 "Comprehensive Health Endpoint"
    
    # Metrics endpoint
    test_http "https://api.$DOMAIN/api/metrics" 200 "Metrics Endpoint"
    
    # API documentation
    test_http "https://api.$DOMAIN/docs" 200 "API Documentation"
}

# Function to test monitoring endpoints
test_monitoring() {
    echo -e "${BLUE}📊 Testing monitoring services...${NC}"
    
    # Prometheus
    test_http "https://monitoring.$DOMAIN/prometheus/-/healthy" 200 "Prometheus Health"
    
    # Grafana
    test_http "https://monitoring.$DOMAIN/grafana/api/health" 200 "Grafana Health"
    
    # Jaeger
    test_http "https://monitoring.$DOMAIN/jaeger" 200 "Jaeger UI"
}

# Function to test performance
test_performance() {
    echo -e "${BLUE}⚡ Testing performance...${NC}"
    
    # Measure response time
    response_time=$(curl -o /dev/null -s -w "%{time_total}" "https://$DOMAIN")
    
    if (( $(echo "$response_time < 2.0" | bc -l) )); then
        echo -e "${GREEN}✅ PASS: Response time (${response_time}s)${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        TEST_RESULTS+=("✅ Response time")
    else
        echo -e "${YELLOW}⚠️ WARNING: Slow response time (${response_time}s)${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        TEST_RESULTS+=("⚠️ Slow response time")
    fi
}

# Function to test backup system
test_backup() {
    echo -e "${BLUE}💾 Testing backup system...${NC}"
    
    if [ -f "./scripts/production/backup.sh" ] && [ -x "./scripts/production/backup.sh" ]; then
        echo -e "${GREEN}✅ PASS: Backup script exists and is executable${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        TEST_RESULTS+=("✅ Backup script")
    else
        echo -e "${RED}❌ FAIL: Backup script missing or not executable${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        TEST_RESULTS+=("❌ Backup script")
    fi
    
    # Check backup directory
    if [ -d "./database/backups" ]; then
        echo -e "${GREEN}✅ PASS: Backup directory exists${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        TEST_RESULTS+=("✅ Backup directory")
    else
        echo -e "${RED}❌ FAIL: Backup directory missing${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        TEST_RESULTS+=("❌ Backup directory")
    fi
}

# Function to test security headers
test_security() {
    echo -e "${BLUE}🔒 Testing security headers...${NC}"
    
    # Test security headers
    headers=$(curl -s -I "https://$DOMAIN" | tr -d '\r')
    
    security_headers=("Strict-Transport-Security" "X-Content-Type-Options" "X-Frame-Options" "X-XSS-Protection")
    
    for header in "${security_headers[@]}"; do
        if echo "$headers" | grep -qi "$header"; then
            echo -e "${GREEN}✅ PASS: $header header${NC}"
            TESTS_PASSED=$((TESTS_PASSED + 1))
            TEST_RESULTS+=("✅ $header header")
        else
            echo -e "${RED}❌ FAIL: $header header missing${NC}"
            TESTS_FAILED=$((TESTS_FAILED + 1))
            TEST_RESULTS+=("❌ $header header")
        fi
    done
}

# Main test execution
main() {
    echo -e "${CYAN}📋 Test Configuration:${NC}"
    echo "   • Domain: $DOMAIN"
    echo "   • Timeout: $TIMEOUT seconds"
    echo "   • Started: $(date)"
    echo
    
    # Run all tests
    test_docker_services
    test_database
    test_redis
    test_http "https://$DOMAIN" 200 "Frontend Application"
    test_api_endpoints
    test_monitoring
    test_ssl "$DOMAIN"
    test_ssl "api.$DOMAIN"
    test_ssl "monitoring.$DOMAIN"
    test_security
    test_performance
    test_backup
    
    # Display results
    echo
    echo -e "${BLUE}📊 Test Results Summary${NC}"
    echo "======================="
    echo -e "${GREEN}✅ Tests Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}❌ Tests Failed: $TESTS_FAILED${NC}"
    echo -e "📊 Total Tests: $((TESTS_PASSED + TESTS_FAILED))"
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}🎉 All tests passed! Production deployment is healthy.${NC}"
        exit 0
    else
        echo -e "${RED}⚠️ Some tests failed. Please review the issues above.${NC}"
        echo
        echo -e "${YELLOW}Failed Tests:${NC}"
        for result in "${TEST_RESULTS[@]}"; do
            if [[ $result == ❌* ]] || [[ $result == ⚠️* ]]; then
                echo "   $result"
            fi
        done
        exit 1
    fi
}

# Check if bc is available for floating point arithmetic
if ! command -v bc &> /dev/null; then
    echo -e "${YELLOW}⚠️ Installing bc for performance tests...${NC}"
    sudo apt-get update && sudo apt-get install -y bc
fi

# Run main function
main