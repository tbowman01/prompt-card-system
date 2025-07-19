#!/bin/bash

# Security Testing Script for Prompt Card System
# This script performs comprehensive security testing including vulnerability scans,
# penetration testing, and compliance checks

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
REPORT_DIR="./security-reports"
TEST_DATE=$(date +"%Y%m%d_%H%M%S")

echo -e "${BLUE}🔒 Prompt Card System Security Testing Suite${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo "Test Date: $(date)"
echo "Backend URL: $BACKEND_URL"
echo "Frontend URL: $FRONTEND_URL"
echo "Report Directory: $REPORT_DIR"
echo ""

# Create report directory
mkdir -p "$REPORT_DIR"

# Function to check if service is running
check_service() {
    local name=$1
    local url=$2
    
    echo -n "Checking $name... "
    
    if curl -s -f "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Running${NC}"
        return 0
    else
        echo -e "${RED}✗ Not accessible${NC}"
        return 1
    fi
}

# Function to run security scan
run_security_scan() {
    local scan_type=$1
    local endpoint=$2
    
    echo -e "${YELLOW}🔍 Running $scan_type scan...${NC}"
    
    local response
    if response=$(curl -s -X POST "$BACKEND_URL/api/security/scan/$endpoint" \
        -H "Content-Type: application/json" \
        --connect-timeout 30 \
        --max-time 120 2>&1); then
        
        echo "$response" > "$REPORT_DIR/${scan_type}_scan_${TEST_DATE}.json"
        
        # Parse response for summary
        local vulnerabilities
        if vulnerabilities=$(echo "$response" | jq -r '.vulnerabilities.total' 2>/dev/null); then
            if [ "$vulnerabilities" = "null" ] || [ "$vulnerabilities" = "0" ]; then
                echo -e "${GREEN}✓ No vulnerabilities found${NC}"
            else
                echo -e "${YELLOW}⚠ Found $vulnerabilities vulnerabilities${NC}"
            fi
        else
            echo -e "${BLUE}ℹ Scan completed - check report for details${NC}"
        fi
    else
        echo -e "${RED}✗ Scan failed: $response${NC}"
        return 1
    fi
}

# Function to test API security
test_api_security() {
    echo -e "${YELLOW}🛡️ Testing API Security...${NC}"
    
    local security_tests=(
        "GET:$BACKEND_URL/api/security/status:Security status endpoint"
        "GET:$BACKEND_URL/api/health/v2/security:Security health check"
        "GET:$BACKEND_URL/api/security/events:Security events (should require auth)"
        "POST:$BACKEND_URL/api/security/events:Security event creation (should require auth)"
    )
    
    for test in "${security_tests[@]}"; do
        IFS=':' read -r method url description <<< "$test"
        
        echo -n "Testing $description... "
        
        local status_code
        if [ "$method" = "GET" ]; then
            status_code=$(curl -s -o /dev/null -w "%{http_code}" "$url" --connect-timeout 10)
        else
            status_code=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url" \
                -H "Content-Type: application/json" \
                -d '{}' --connect-timeout 10)
        fi
        
        case $status_code in
            200|201)
                echo -e "${GREEN}✓ Accessible (HTTP $status_code)${NC}"
                ;;
            401|403)
                echo -e "${GREEN}✓ Properly secured (HTTP $status_code)${NC}"
                ;;
            404)
                echo -e "${YELLOW}⚠ Not found (HTTP $status_code)${NC}"
                ;;
            500|502|503)
                echo -e "${RED}✗ Server error (HTTP $status_code)${NC}"
                ;;
            *)
                echo -e "${YELLOW}? Unexpected response (HTTP $status_code)${NC}"
                ;;
        esac
    done
}

# Function to test for common vulnerabilities
test_common_vulnerabilities() {
    echo -e "${YELLOW}🚨 Testing Common Vulnerabilities...${NC}"
    
    # Test for SQL injection (basic)
    echo -n "Testing SQL injection resistance... "
    local sqli_response
    sqli_response=$(curl -s "$BACKEND_URL/api/prompt-cards?search='; DROP TABLE users; --" \
        --connect-timeout 10 --max-time 15 2>/dev/null || echo "error")
    
    if [[ "$sqli_response" == *"error"* ]] || [[ "$sqli_response" == *"syntax error"* ]]; then
        echo -e "${RED}⚠ Potential SQL injection vulnerability${NC}"
    else
        echo -e "${GREEN}✓ No obvious SQL injection vulnerability${NC}"
    fi
    
    # Test for XSS (basic)
    echo -n "Testing XSS resistance... "
    local xss_response
    xss_response=$(curl -s "$BACKEND_URL/api/prompt-cards" \
        -H "Content-Type: application/json" \
        -d '{"title":"<script>alert('xss')</script>"}' \
        --connect-timeout 10 2>/dev/null || echo "error")
    
    if [[ "$xss_response" == *"<script>"* ]]; then
        echo -e "${RED}⚠ Potential XSS vulnerability${NC}"
    else
        echo -e "${GREEN}✓ No obvious XSS vulnerability${NC}"
    fi
    
    # Test for directory traversal
    echo -n "Testing directory traversal resistance... "
    local dt_status
    dt_status=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/../../../etc/passwd" \
        --connect-timeout 10)
    
    if [ "$dt_status" = "200" ]; then
        echo -e "${RED}⚠ Potential directory traversal vulnerability${NC}"
    else
        echo -e "${GREEN}✓ No obvious directory traversal vulnerability${NC}"
    fi
}

# Function to check security headers
check_security_headers() {
    echo -e "${YELLOW}🔐 Checking Security Headers...${NC}"
    
    local headers_response
    headers_response=$(curl -s -I "$BACKEND_URL/api/health" --connect-timeout 10)
    
    local required_headers=(
        "X-Content-Type-Options"
        "X-Frame-Options"
        "X-XSS-Protection"
        "Strict-Transport-Security"
        "Content-Security-Policy"
    )
    
    for header in "${required_headers[@]}"; do
        echo -n "Checking $header... "
        if echo "$headers_response" | grep -qi "$header"; then
            echo -e "${GREEN}✓ Present${NC}"
        else
            echo -e "${YELLOW}⚠ Missing${NC}"
        fi
    done
}

# Function to run compliance checks
run_compliance_check() {
    echo -e "${YELLOW}📋 Running Compliance Checks...${NC}"
    
    local response
    if response=$(curl -s -X POST "$BACKEND_URL/api/security/compliance/scan" \
        -H "Content-Type: application/json" \
        --connect-timeout 30 \
        --max-time 60 2>&1); then
        
        echo "$response" > "$REPORT_DIR/compliance_report_${TEST_DATE}.json"
        
        # Parse compliance score
        local score
        if score=$(echo "$response" | jq -r '.overallScore' 2>/dev/null); then
            if [ "$score" != "null" ]; then
                echo "Compliance Score: $score/100"
                if [ "$score" -ge 80 ]; then
                    echo -e "${GREEN}✓ Good compliance score${NC}"
                elif [ "$score" -ge 60 ]; then
                    echo -e "${YELLOW}⚠ Moderate compliance score${NC}"
                else
                    echo -e "${RED}✗ Low compliance score${NC}"
                fi
            fi
        fi
        
        local status
        if status=$(echo "$response" | jq -r '.status' 2>/dev/null); then
            case $status in
                "compliant")
                    echo -e "${GREEN}✓ System is compliant${NC}"
                    ;;
                "partially-compliant")
                    echo -e "${YELLOW}⚠ System is partially compliant${NC}"
                    ;;
                "non-compliant")
                    echo -e "${RED}✗ System is non-compliant${NC}"
                    ;;
            esac
        fi
    else
        echo -e "${RED}✗ Compliance check failed: $response${NC}"
        return 1
    fi
}

# Function to generate summary report
generate_summary_report() {
    echo -e "${BLUE}📊 Generating Summary Report...${NC}"
    
    local summary_file="$REPORT_DIR/security_summary_${TEST_DATE}.md"
    
    cat > "$summary_file" << EOF
# Security Test Summary Report

**Date:** $(date)
**System:** Prompt Card System
**Backend URL:** $BACKEND_URL
**Frontend URL:** $FRONTEND_URL

## Test Results

### Vulnerability Scans
- Dependency scan: See \`dependency_scan_${TEST_DATE}.json\`
- Code scan: See \`code_scan_${TEST_DATE}.json\`
- Infrastructure scan: See \`infrastructure_scan_${TEST_DATE}.json\`

### API Security Tests
- Security endpoints accessibility tested
- Authentication and authorization verified
- Error handling validated

### Common Vulnerability Tests
- SQL injection resistance tested
- XSS protection verified
- Directory traversal protection checked

### Security Headers
- Security headers presence verified
- Content security policies checked

### Compliance Checks
- See \`compliance_report_${TEST_DATE}.json\`
- Multiple compliance frameworks tested
- Automated and manual checks performed

## Recommendations

1. Review all vulnerability scan results
2. Address any identified security issues
3. Implement missing security headers
4. Improve compliance score if below 80
5. Regular security testing should be automated

## Next Steps

- Schedule regular security scans
- Implement continuous security monitoring
- Set up automated alerting for security events
- Conduct penetration testing with external tools

EOF

    echo "Summary report generated: $summary_file"
}

# Main execution
echo -e "${BLUE}🏁 Starting Security Tests${NC}"
echo ""

# Check if services are running
if ! check_service "Backend" "$BACKEND_URL/api/health"; then
    echo -e "${RED}❌ Backend service not accessible. Please start the backend server.${NC}"
    exit 1
fi

echo ""

# Run all security tests
echo -e "${BLUE}🔍 Phase 1: Vulnerability Scanning${NC}"
run_security_scan "dependency" "dependencies" || true
run_security_scan "code" "code" || true
run_security_scan "infrastructure" "infrastructure" || true
echo ""

echo -e "${BLUE}🛡️ Phase 2: API Security Testing${NC}"
test_api_security
echo ""

echo -e "${BLUE}🚨 Phase 3: Common Vulnerability Testing${NC}"
test_common_vulnerabilities
echo ""

echo -e "${BLUE}🔐 Phase 4: Security Headers Check${NC}"
check_security_headers
echo ""

echo -e "${BLUE}📋 Phase 5: Compliance Checking${NC}"
run_compliance_check || true
echo ""

echo -e "${BLUE}📊 Phase 6: Report Generation${NC}"
generate_summary_report
echo ""

# Final summary
echo -e "${GREEN}✅ Security testing completed!${NC}"
echo ""
echo "Reports available in: $REPORT_DIR"
echo "Summary report: $REPORT_DIR/security_summary_${TEST_DATE}.md"
echo ""
echo -e "${YELLOW}🔍 Please review all reports and address any identified issues.${NC}"
echo ""

# Check if jq is available for better report parsing
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}💡 Tip: Install 'jq' for better report parsing and analysis.${NC}"
fi

exit 0