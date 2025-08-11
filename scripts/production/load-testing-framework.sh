#!/bin/bash

# Load Testing Framework for Prompt Card System
# =============================================
# P2 Enhancement: Comprehensive load testing and performance benchmarking
# This script provides automated load testing with various scenarios and comprehensive reporting

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo -e "${PURPLE}⚡ Load Testing Framework - Prompt Card System${NC}"
echo "=============================================="

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RESULTS_DIR="${PROJECT_ROOT}/load-test-results"
BASE_URL="${BASE_URL:-http://localhost:3001}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
DURATION="${DURATION:-60}"
USERS="${USERS:-10}"
RAMP_UP="${RAMP_UP:-30}"
TEST_DATA_DIR="${PROJECT_ROOT}/load-test-data"
REPORT_FORMAT="${REPORT_FORMAT:-html,json,csv}"

# Test scenarios configuration
SCENARIOS="${SCENARIOS:-api,frontend,database,mixed}"
API_ENDPOINTS_FILE="${TEST_DATA_DIR}/api-endpoints.json"
USER_SCENARIOS_FILE="${TEST_DATA_DIR}/user-scenarios.json"

# Performance thresholds
MAX_RESPONSE_TIME="${MAX_RESPONSE_TIME:-500}"  # ms
MAX_ERROR_RATE="${MAX_ERROR_RATE:-1}"          # %
MIN_THROUGHPUT="${MIN_THROUGHPUT:-10}"         # requests/second

# Function to log messages
log_message() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "INFO")
            echo -e "${GREEN}[INFO] ${timestamp}: $message${NC}"
            ;;
        "WARN")
            echo -e "${YELLOW}[WARN] ${timestamp}: $message${NC}"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR] ${timestamp}: $message${NC}"
            ;;
        "DEBUG")
            echo -e "${CYAN}[DEBUG] ${timestamp}: $message${NC}"
            ;;
    esac
}

# Function to check prerequisites
check_prerequisites() {
    log_message "INFO" "Checking load testing prerequisites..."
    
    local missing_tools=()
    
    # Check for required tools
    if ! command -v curl &> /dev/null; then
        missing_tools+=("curl")
    fi
    
    if ! command -v jq &> /dev/null; then
        missing_tools+=("jq")
    fi
    
    # Check for load testing tools (in order of preference)
    if command -v k6 &> /dev/null; then
        LOAD_TOOL="k6"
        log_message "INFO" "Using K6 for load testing"
    elif command -v artillery &> /dev/null; then
        LOAD_TOOL="artillery"
        log_message "INFO" "Using Artillery for load testing"
    elif command -v ab &> /dev/null; then
        LOAD_TOOL="ab"
        log_message "INFO" "Using Apache Bench for load testing"
    elif command -v hey &> /dev/null; then
        LOAD_TOOL="hey"
        log_message "INFO" "Using Hey for load testing"
    elif command -v wrk &> /dev/null; then
        LOAD_TOOL="wrk"
        log_message "INFO" "Using wrk for load testing"
    else
        missing_tools+=("k6 or artillery or ab or hey or wrk")
    fi
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_message "ERROR" "Missing required tools: ${missing_tools[*]}"
        log_message "INFO" "Install missing tools:"
        for tool in "${missing_tools[@]}"; do
            case $tool in
                "curl")
                    echo "  - Ubuntu/Debian: sudo apt-get install curl"
                    echo "  - macOS: brew install curl"
                    ;;
                "jq")
                    echo "  - Ubuntu/Debian: sudo apt-get install jq"
                    echo "  - macOS: brew install jq"
                    ;;
                "k6 or artillery or ab or hey or wrk")
                    echo "  - K6: curl https://github.com/grafana/k6/releases/download/v0.45.0/k6-v0.45.0-linux-amd64.tar.gz | tar -xzv --strip-components 1"
                    echo "  - Artillery: npm install -g artillery"
                    echo "  - Apache Bench: sudo apt-get install apache2-utils"
                    echo "  - Hey: go install github.com/rakyll/hey@latest"
                    echo "  - wrk: sudo apt-get install wrk"
                    ;;
            esac
        done
        exit 1
    fi
    
    log_message "INFO" "All prerequisites satisfied"
}

# Function to create test data and scenarios
create_test_data() {
    log_message "INFO" "Creating test data and scenarios..."
    
    mkdir -p "$TEST_DATA_DIR"
    
    # Create API endpoints configuration
    cat > "$API_ENDPOINTS_FILE" << 'EOF'
{
  "endpoints": [
    {
      "name": "Health Check",
      "method": "GET",
      "path": "/api/health",
      "weight": 20,
      "expected_status": 200
    },
    {
      "name": "Auth Login",
      "method": "POST",
      "path": "/api/auth/login",
      "weight": 5,
      "body": {
        "email": "test@example.com",
        "password": "password123"
      },
      "expected_status": 200
    },
    {
      "name": "Get Prompt Cards",
      "method": "GET",
      "path": "/api/prompt-cards",
      "weight": 30,
      "headers": {
        "Authorization": "Bearer ${auth_token}"
      },
      "expected_status": 200
    },
    {
      "name": "Create Prompt Card",
      "method": "POST",
      "path": "/api/prompt-cards",
      "weight": 10,
      "body": {
        "title": "Load Test Card ${random_id}",
        "content": "This is a load test prompt card",
        "category": "testing"
      },
      "headers": {
        "Authorization": "Bearer ${auth_token}"
      },
      "expected_status": 201
    },
    {
      "name": "Get Sample Prompts",
      "method": "GET",
      "path": "/api/sample-prompts",
      "weight": 25,
      "expected_status": 200
    },
    {
      "name": "Run Test Case",
      "method": "POST",
      "path": "/api/test-cases/run",
      "weight": 10,
      "body": {
        "prompt": "Test prompt for load testing",
        "expected_output": "Expected result"
      },
      "expected_status": 200
    }
  ]
}
EOF

    # Create user scenarios
    cat > "$USER_SCENARIOS_FILE" << 'EOF'
{
  "scenarios": [
    {
      "name": "Casual Browser",
      "weight": 40,
      "actions": [
        {"endpoint": "Health Check", "think_time": 2},
        {"endpoint": "Get Sample Prompts", "think_time": 5},
        {"endpoint": "Get Prompt Cards", "think_time": 8}
      ]
    },
    {
      "name": "Active User",
      "weight": 30,
      "actions": [
        {"endpoint": "Auth Login", "think_time": 1},
        {"endpoint": "Get Prompt Cards", "think_time": 3},
        {"endpoint": "Create Prompt Card", "think_time": 10},
        {"endpoint": "Get Prompt Cards", "think_time": 2},
        {"endpoint": "Run Test Case", "think_time": 5}
      ]
    },
    {
      "name": "Power User",
      "weight": 20,
      "actions": [
        {"endpoint": "Auth Login", "think_time": 1},
        {"endpoint": "Get Prompt Cards", "think_time": 2},
        {"endpoint": "Create Prompt Card", "think_time": 5},
        {"endpoint": "Create Prompt Card", "think_time": 8},
        {"endpoint": "Run Test Case", "think_time": 3},
        {"endpoint": "Run Test Case", "think_time": 4},
        {"endpoint": "Get Sample Prompts", "think_time": 2}
      ]
    },
    {
      "name": "API Consumer",
      "weight": 10,
      "actions": [
        {"endpoint": "Health Check", "think_time": 0.5},
        {"endpoint": "Get Sample Prompts", "think_time": 1},
        {"endpoint": "Get Sample Prompts", "think_time": 1},
        {"endpoint": "Get Sample Prompts", "think_time": 1}
      ]
    }
  ]
}
EOF

    log_message "INFO" "Test data and scenarios created"
}

# Function to check system health before testing
check_system_health() {
    log_message "INFO" "Checking system health before load testing..."
    
    # Check if services are responding
    local services_ok=true
    
    # Check backend API
    if ! curl -sf "$BASE_URL/api/health" > /dev/null 2>&1; then
        log_message "ERROR" "Backend API not responding at $BASE_URL"
        services_ok=false
    else
        log_message "INFO" "Backend API is healthy"
    fi
    
    # Check frontend (if different from backend)
    if [ "$FRONTEND_URL" != "$BASE_URL" ]; then
        if ! curl -sf "$FRONTEND_URL" > /dev/null 2>&1; then
            log_message "WARN" "Frontend not responding at $FRONTEND_URL"
        else
            log_message "INFO" "Frontend is healthy"
        fi
    fi
    
    # Check system resources
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}' || echo "0")
    local mem_usage=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}' || echo "0")
    local disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//' || echo "0")
    
    log_message "INFO" "System status - CPU: ${cpu_usage}%, Memory: ${mem_usage}%, Disk: ${disk_usage}%"
    
    # Warn if system resources are high
    if (( $(echo "$cpu_usage > 80" | bc -l 2>/dev/null || echo 0) )); then
        log_message "WARN" "High CPU usage detected before testing"
    fi
    
    if (( $(echo "$mem_usage > 80" | bc -l 2>/dev/null || echo 0) )); then
        log_message "WARN" "High memory usage detected before testing"
    fi
    
    if [ "$disk_usage" -gt 90 ]; then
        log_message "WARN" "High disk usage detected"
    fi
    
    if [ "$services_ok" != true ]; then
        log_message "ERROR" "System health check failed"
        return 1
    fi
    
    return 0
}

# Function to run K6 load test
run_k6_test() {
    local scenario=$1
    local output_dir="$RESULTS_DIR/k6-$scenario-$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$output_dir"
    
    log_message "INFO" "Running K6 load test for scenario: $scenario"
    
    # Generate K6 script based on scenario
    local k6_script="$output_dir/test-script.js"
    
    cat > "$k6_script" << EOF
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '${RAMP_UP}s', target: ${USERS} },
    { duration: '${DURATION}s', target: ${USERS} },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<${MAX_RESPONSE_TIME}'],
    errors: ['rate<${MAX_ERROR_RATE}'],
  },
};

export default function () {
  const baseUrl = '${BASE_URL}';
  
  // Health check
  let response = http.get(\`\${baseUrl}/api/health\`);
  check(response, {
    'health check status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);
  
  sleep(1);
  
  // Get sample prompts
  response = http.get(\`\${baseUrl}/api/sample-prompts\`);
  check(response, {
    'sample prompts status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);
  
  sleep(Math.random() * 3 + 1);
  
  // Get prompt cards
  response = http.get(\`\${baseUrl}/api/prompt-cards\`);
  check(response, {
    'prompt cards status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);
  
  sleep(Math.random() * 2 + 1);
}
EOF
    
    # Run K6 test
    k6 run \
        --out json="$output_dir/results.json" \
        --summary-export="$output_dir/summary.json" \
        "$k6_script" > "$output_dir/output.log" 2>&1
    
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        log_message "INFO" "K6 test completed successfully"
    else
        log_message "ERROR" "K6 test failed with exit code $exit_code"
    fi
    
    return $exit_code
}

# Function to run Artillery test
run_artillery_test() {
    local scenario=$1
    local output_dir="$RESULTS_DIR/artillery-$scenario-$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$output_dir"
    
    log_message "INFO" "Running Artillery load test for scenario: $scenario"
    
    # Generate Artillery configuration
    local artillery_config="$output_dir/artillery-config.yml"
    
    cat > "$artillery_config" << EOF
config:
  target: '${BASE_URL}'
  phases:
    - duration: ${RAMP_UP}
      arrivalRate: 1
      rampTo: $((USERS / 10))
    - duration: ${DURATION}
      arrivalRate: $((USERS / 10))
  processor: './processor.js'
scenarios:
  - name: 'API Load Test'
    weight: 70
    flow:
      - get:
          url: '/api/health'
          capture:
            - json: '\$.status'
              as: 'health_status'
      - think: 1
      - get:
          url: '/api/sample-prompts'
      - think: 2
      - get:
          url: '/api/prompt-cards'
      - think: 3
  - name: 'Frontend Load Test'
    weight: 30
    flow:
      - get:
          url: '/'
      - think: 5
      - get:
          url: '/sample-prompts'
      - think: 3
EOF
    
    # Create processor file
    cat > "$output_dir/processor.js" << 'EOF'
module.exports = {
  setRandomId: function(requestParams, context, ee, next) {
    context.vars.randomId = Math.floor(Math.random() * 10000);
    return next();
  }
};
EOF
    
    # Run Artillery test
    artillery run \
        --output "$output_dir/results.json" \
        "$artillery_config" > "$output_dir/output.log" 2>&1
    
    local exit_code=$?
    
    # Generate HTML report
    if [ -f "$output_dir/results.json" ]; then
        artillery report "$output_dir/results.json" --output "$output_dir/report.html"
    fi
    
    if [ $exit_code -eq 0 ]; then
        log_message "INFO" "Artillery test completed successfully"
    else
        log_message "ERROR" "Artillery test failed with exit code $exit_code"
    fi
    
    return $exit_code
}

# Function to run Apache Bench test
run_ab_test() {
    local scenario=$1
    local output_dir="$RESULTS_DIR/ab-$scenario-$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$output_dir"
    
    log_message "INFO" "Running Apache Bench test for scenario: $scenario"
    
    local total_requests=$((USERS * DURATION))
    
    # Test different endpoints
    local endpoints=(
        "/api/health"
        "/api/sample-prompts"
        "/api/prompt-cards"
    )
    
    for endpoint in "${endpoints[@]}"; do
        local endpoint_name=$(echo "$endpoint" | sed 's|/||g' | sed 's|/|-|g')
        local output_file="$output_dir/ab-${endpoint_name}.txt"
        
        log_message "INFO" "Testing endpoint: $endpoint"
        
        ab -n "$total_requests" \
           -c "$USERS" \
           -g "$output_dir/ab-${endpoint_name}.tsv" \
           -e "$output_dir/ab-${endpoint_name}.csv" \
           "${BASE_URL}${endpoint}" > "$output_file" 2>&1
        
        if [ $? -ne 0 ]; then
            log_message "ERROR" "Apache Bench test failed for $endpoint"
        fi
    done
    
    log_message "INFO" "Apache Bench tests completed"
}

# Function to analyze test results
analyze_results() {
    local results_dir=$1
    
    log_message "INFO" "Analyzing test results in: $results_dir"
    
    local analysis_file="$results_dir/analysis.json"
    local report_file="$results_dir/performance-report.html"
    
    # Initialize analysis results
    cat > "$analysis_file" << 'EOF'
{
  "test_metadata": {
    "timestamp": "",
    "duration": 0,
    "users": 0,
    "tool": ""
  },
  "performance_metrics": {
    "total_requests": 0,
    "requests_per_second": 0,
    "avg_response_time": 0,
    "p95_response_time": 0,
    "p99_response_time": 0,
    "error_rate": 0,
    "throughput_mbps": 0
  },
  "thresholds": {
    "response_time_passed": false,
    "error_rate_passed": false,
    "throughput_passed": false
  },
  "recommendations": []
}
EOF
    
    # Analyze based on tool used
    if [ -f "$results_dir/results.json" ] && command -v jq &> /dev/null; then
        # K6 or Artillery results
        if grep -q "k6" "$results_dir"/*.log 2>/dev/null; then
            analyze_k6_results "$results_dir" "$analysis_file"
        elif grep -q "artillery" "$results_dir"/*.log 2>/dev/null; then
            analyze_artillery_results "$results_dir" "$analysis_file"
        fi
    elif ls "$results_dir"/ab-*.txt &> /dev/null; then
        analyze_ab_results "$results_dir" "$analysis_file"
    fi
    
    # Generate performance report
    generate_performance_report "$results_dir" "$analysis_file" "$report_file"
    
    log_message "INFO" "Analysis completed: $analysis_file"
    log_message "INFO" "Report generated: $report_file"
}

# Function to analyze K6 results
analyze_k6_results() {
    local results_dir=$1
    local analysis_file=$2
    
    if [ ! -f "$results_dir/summary.json" ]; then
        return
    fi
    
    # Extract metrics from K6 summary
    local rps=$(jq -r '.metrics.http_reqs.rate' "$results_dir/summary.json" 2>/dev/null || echo "0")
    local avg_duration=$(jq -r '.metrics.http_req_duration.avg' "$results_dir/summary.json" 2>/dev/null || echo "0")
    local p95_duration=$(jq -r '.metrics.http_req_duration["p(95)"]' "$results_dir/summary.json" 2>/dev/null || echo "0")
    local error_rate=$(jq -r '.metrics.errors.rate' "$results_dir/summary.json" 2>/dev/null || echo "0")
    
    # Update analysis file
    jq --argjson rps "$rps" \
       --argjson avg_duration "$avg_duration" \
       --argjson p95_duration "$p95_duration" \
       --argjson error_rate "$error_rate" \
       '.performance_metrics.requests_per_second = $rps |
        .performance_metrics.avg_response_time = $avg_duration |
        .performance_metrics.p95_response_time = $p95_duration |
        .performance_metrics.error_rate = ($error_rate * 100) |
        .test_metadata.tool = "k6"' \
       "$analysis_file" > "$analysis_file.tmp" && mv "$analysis_file.tmp" "$analysis_file"
}

# Function to analyze Artillery results
analyze_artillery_results() {
    local results_dir=$1
    local analysis_file=$2
    
    if [ ! -f "$results_dir/results.json" ]; then
        return
    fi
    
    # Extract metrics from Artillery results (simplified)
    # Artillery results are more complex and would need more sophisticated parsing
    jq '.test_metadata.tool = "artillery"' "$analysis_file" > "$analysis_file.tmp" && mv "$analysis_file.tmp" "$analysis_file"
}

# Function to analyze Apache Bench results
analyze_ab_results() {
    local results_dir=$1
    local analysis_file=$2
    
    local ab_files=("$results_dir"/ab-*.txt)
    if [ ! -f "${ab_files[0]}" ]; then
        return
    fi
    
    # Parse AB results (take first file as representative)
    local ab_file="${ab_files[0]}"
    local rps=$(grep "Requests per second:" "$ab_file" | awk '{print $4}' || echo "0")
    local avg_time=$(grep "Time per request:" "$ab_file" | head -1 | awk '{print $4}' || echo "0")
    local failed_requests=$(grep "Failed requests:" "$ab_file" | awk '{print $3}' || echo "0")
    local total_requests=$(grep "Complete requests:" "$ab_file" | awk '{print $3}' || echo "1")
    
    local error_rate=$(echo "scale=2; $failed_requests * 100 / $total_requests" | bc -l 2>/dev/null || echo "0")
    
    # Update analysis file
    jq --argjson rps "$rps" \
       --argjson avg_time "$avg_time" \
       --argjson error_rate "$error_rate" \
       '.performance_metrics.requests_per_second = $rps |
        .performance_metrics.avg_response_time = $avg_time |
        .performance_metrics.error_rate = $error_rate |
        .test_metadata.tool = "apache-bench"' \
       "$analysis_file" > "$analysis_file.tmp" && mv "$analysis_file.tmp" "$analysis_file"
}

# Function to generate performance report
generate_performance_report() {
    local results_dir=$1
    local analysis_file=$2
    local report_file=$3
    
    # Read metrics from analysis file
    local rps=$(jq -r '.performance_metrics.requests_per_second' "$analysis_file" 2>/dev/null || echo "0")
    local avg_time=$(jq -r '.performance_metrics.avg_response_time' "$analysis_file" 2>/dev/null || echo "0")
    local error_rate=$(jq -r '.performance_metrics.error_rate' "$analysis_file" 2>/dev/null || echo "0")
    local tool=$(jq -r '.test_metadata.tool' "$analysis_file" 2>/dev/null || echo "unknown")
    
    # Determine pass/fail status
    local response_time_status="❌"
    local error_rate_status="❌"
    local throughput_status="❌"
    
    if (( $(echo "$avg_time <= $MAX_RESPONSE_TIME" | bc -l 2>/dev/null || echo 0) )); then
        response_time_status="✅"
    fi
    
    if (( $(echo "$error_rate <= $MAX_ERROR_RATE" | bc -l 2>/dev/null || echo 0) )); then
        error_rate_status="✅"
    fi
    
    if (( $(echo "$rps >= $MIN_THROUGHPUT" | bc -l 2>/dev/null || echo 0) )); then
        throughput_status="✅"
    fi
    
    # Generate HTML report
    cat > "$report_file" << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Load Test Performance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; color: #333; border-bottom: 2px solid #007acc; padding-bottom: 10px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric-card { background: #f8f9fa; padding: 15px; border-radius: 5px; border-left: 4px solid #007acc; }
        .metric-value { font-size: 2em; font-weight: bold; color: #007acc; }
        .metric-label { color: #666; text-transform: uppercase; font-size: 0.8em; }
        .status-good { color: #28a745; }
        .status-bad { color: #dc3545; }
        .status-warning { color: #ffc107; }
        .thresholds { background: #e9ecef; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .threshold-item { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; }
        .recommendations { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .test-details { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Load Test Performance Report</h1>
            <p>Generated on $(date)</p>
        </div>
        
        <div class="test-details">
            <h2>Test Configuration</h2>
            <table>
                <tr><td><strong>Tool:</strong></td><td>$tool</td></tr>
                <tr><td><strong>Target URL:</strong></td><td>$BASE_URL</td></tr>
                <tr><td><strong>Duration:</strong></td><td>${DURATION}s</td></tr>
                <tr><td><strong>Concurrent Users:</strong></td><td>$USERS</td></tr>
                <tr><td><strong>Ramp-up Time:</strong></td><td>${RAMP_UP}s</td></tr>
            </table>
        </div>
        
        <div class="metrics">
            <div class="metric-card">
                <div class="metric-label">Requests per Second</div>
                <div class="metric-value">$(printf "%.2f" $rps)</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Average Response Time</div>
                <div class="metric-value">$(printf "%.2f" $avg_time)ms</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Error Rate</div>
                <div class="metric-value">$(printf "%.2f" $error_rate)%</div>
            </div>
        </div>
        
        <div class="thresholds">
            <h2>Performance Thresholds</h2>
            <div class="threshold-item">
                <span>Response Time ≤ ${MAX_RESPONSE_TIME}ms</span>
                <span class="$([ "$response_time_status" = "✅" ] && echo "status-good" || echo "status-bad")">$response_time_status</span>
            </div>
            <div class="threshold-item">
                <span>Error Rate ≤ ${MAX_ERROR_RATE}%</span>
                <span class="$([ "$error_rate_status" = "✅" ] && echo "status-good" || echo "status-bad")">$error_rate_status</span>
            </div>
            <div class="threshold-item">
                <span>Throughput ≥ ${MIN_THROUGHPUT} req/s</span>
                <span class="$([ "$throughput_status" = "✅" ] && echo "status-good" || echo "status-bad")">$throughput_status</span>
            </div>
        </div>
        
        <div class="recommendations">
            <h2>📋 Recommendations</h2>
            <ul id="recommendations-list">
EOF

    # Add recommendations based on results
    if [ "$response_time_status" = "❌" ]; then
        echo "                <li>🔴 <strong>High Response Time:</strong> Consider optimizing database queries, adding caching, or scaling horizontally.</li>" >> "$report_file"
    fi
    
    if [ "$error_rate_status" = "❌" ]; then
        echo "                <li>🔴 <strong>High Error Rate:</strong> Investigate server logs for error patterns and consider improving error handling.</li>" >> "$report_file"
    fi
    
    if [ "$throughput_status" = "❌" ]; then
        echo "                <li>🔴 <strong>Low Throughput:</strong> Consider optimizing server configuration, adding load balancing, or scaling resources.</li>" >> "$report_file"
    fi
    
    # Add general recommendations
    if [ "$response_time_status" = "✅" ] && [ "$error_rate_status" = "✅" ] && [ "$throughput_status" = "✅" ]; then
        echo "                <li>✅ <strong>Performance Goals Met:</strong> System is performing well under current load conditions.</li>" >> "$report_file"
        echo "                <li>💡 <strong>Consider:</strong> Testing with higher load to find system limits and implementing monitoring.</li>" >> "$report_file"
    fi
    
    cat >> "$report_file" << EOF
            </ul>
        </div>
        
        <div class="test-details">
            <h2>Additional Metrics</h2>
            <p><strong>Test Results Location:</strong> $results_dir</p>
            <p><strong>Raw Data Files:</strong> Check the results directory for detailed logs and metrics.</p>
        </div>
    </div>
</body>
</html>
EOF
    
    log_message "INFO" "Performance report generated: $report_file"
}

# Function to run load tests
run_load_tests() {
    log_message "INFO" "Starting load test execution..."
    
    # Create results directory
    mkdir -p "$RESULTS_DIR"
    
    local test_success=true
    local scenarios_array=(${SCENARIOS//,/ })
    
    for scenario in "${scenarios_array[@]}"; do
        log_message "INFO" "Running load test scenario: $scenario"
        
        local scenario_success=false
        
        case $LOAD_TOOL in
            "k6")
                if run_k6_test "$scenario"; then
                    scenario_success=true
                fi
                ;;
            "artillery")
                if run_artillery_test "$scenario"; then
                    scenario_success=true
                fi
                ;;
            "ab")
                if run_ab_test "$scenario"; then
                    scenario_success=true
                fi
                ;;
            *)
                log_message "ERROR" "Unknown load testing tool: $LOAD_TOOL"
                test_success=false
                continue
                ;;
        esac
        
        if [ "$scenario_success" = true ]; then
            # Find the most recent results directory for this scenario
            local latest_results=$(find "$RESULTS_DIR" -name "*$scenario*" -type d | sort | tail -1)
            if [ -n "$latest_results" ]; then
                analyze_results "$latest_results"
            fi
        else
            test_success=false
            log_message "ERROR" "Load test scenario failed: $scenario"
        fi
        
        # Wait between scenarios
        sleep 5
    done
    
    return $([ "$test_success" = true ] && echo 0 || echo 1)
}

# Function to monitor system during tests
monitor_system() {
    local monitoring_interval=5
    local monitor_file="$RESULTS_DIR/system-monitoring-$(date +%Y%m%d_%H%M%S).csv"
    
    echo "timestamp,cpu_percent,memory_percent,disk_io_read,disk_io_write,network_rx,network_tx" > "$monitor_file"
    
    while true; do
        local timestamp=$(date +%s)
        local cpu_percent=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}' || echo "0")
        local memory_percent=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}' || echo "0")
        
        echo "$timestamp,$cpu_percent,$memory_percent,0,0,0,0" >> "$monitor_file"
        sleep $monitoring_interval
    done &
    
    echo $! > "$RESULTS_DIR/monitor.pid"
    log_message "INFO" "System monitoring started (PID: $!)"
}

# Function to stop system monitoring
stop_monitoring() {
    if [ -f "$RESULTS_DIR/monitor.pid" ]; then
        local monitor_pid=$(cat "$RESULTS_DIR/monitor.pid")
        kill $monitor_pid 2>/dev/null || true
        rm -f "$RESULTS_DIR/monitor.pid"
        log_message "INFO" "System monitoring stopped"
    fi
}

# Function to generate final summary report
generate_summary_report() {
    local summary_file="$RESULTS_DIR/load-test-summary-$(date +%Y%m%d_%H%M%S).json"
    
    log_message "INFO" "Generating final summary report..."
    
    cat > "$summary_file" << EOF
{
    "test_session": {
        "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
        "tool": "$LOAD_TOOL",
        "scenarios": "$SCENARIOS",
        "configuration": {
            "base_url": "$BASE_URL",
            "duration": $DURATION,
            "users": $USERS,
            "ramp_up": $RAMP_UP
        },
        "thresholds": {
            "max_response_time": $MAX_RESPONSE_TIME,
            "max_error_rate": $MAX_ERROR_RATE,
            "min_throughput": $MIN_THROUGHPUT
        }
    },
    "results": {
        "total_scenarios": $(echo "$SCENARIOS" | tr ',' '\n' | wc -l),
        "results_directory": "$RESULTS_DIR",
        "reports_available": true
    }
}
EOF
    
    log_message "INFO" "Summary report generated: $summary_file"
}

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Load Testing Framework for Prompt Card System

OPTIONS:
    -h, --help              Show this help message
    -u, --url URL           Base URL for API testing (default: http://localhost:3001)
    -d, --duration SECONDS  Test duration in seconds (default: 60)
    -c, --users COUNT       Number of concurrent users (default: 10)
    -r, --ramp-up SECONDS   Ramp-up time in seconds (default: 30)
    -s, --scenarios LIST    Comma-separated scenario list (default: api,frontend,database,mixed)
    --max-response-time MS  Maximum acceptable response time (default: 500)
    --max-error-rate PCT    Maximum acceptable error rate (default: 1)
    --min-throughput RPS    Minimum required throughput (default: 10)
    --format FORMAT         Report format: html,json,csv (default: html,json,csv)
    --monitor              Enable system monitoring during tests
    --skip-health-check    Skip pre-test health check
    --dry-run              Show what would be tested without executing

ENVIRONMENT VARIABLES:
    BASE_URL               Base URL for API testing
    FRONTEND_URL           Frontend URL for testing
    DURATION              Test duration in seconds
    USERS                 Number of concurrent users
    SCENARIOS             Test scenarios to run
    MAX_RESPONSE_TIME     Maximum response time threshold
    MAX_ERROR_RATE        Maximum error rate threshold
    MIN_THROUGHPUT        Minimum throughput threshold

EXAMPLES:
    $0                                           # Basic load test with defaults
    $0 -u http://localhost:3001 -d 120 -c 20    # 2-minute test with 20 users
    $0 --scenarios api,frontend --monitor        # Test specific scenarios with monitoring
    $0 --max-response-time 200 --max-error-rate 0.5  # Stricter performance thresholds

SUPPORTED TOOLS:
    K6 (preferred)        # npm install -g k6 (or download binary)
    Artillery             # npm install -g artillery
    Apache Bench (ab)     # sudo apt-get install apache2-utils
    Hey                   # go install github.com/rakyll/hey@latest
    wrk                   # sudo apt-get install wrk

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        -u|--url)
            BASE_URL="$2"
            shift 2
            ;;
        -d|--duration)
            DURATION="$2"
            shift 2
            ;;
        -c|--users)
            USERS="$2"
            shift 2
            ;;
        -r|--ramp-up)
            RAMP_UP="$2"
            shift 2
            ;;
        -s|--scenarios)
            SCENARIOS="$2"
            shift 2
            ;;
        --max-response-time)
            MAX_RESPONSE_TIME="$2"
            shift 2
            ;;
        --max-error-rate)
            MAX_ERROR_RATE="$2"
            shift 2
            ;;
        --min-throughput)
            MIN_THROUGHPUT="$2"
            shift 2
            ;;
        --format)
            REPORT_FORMAT="$2"
            shift 2
            ;;
        --monitor)
            ENABLE_MONITORING=true
            shift
            ;;
        --skip-health-check)
            SKIP_HEALTH_CHECK=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Main execution function
main() {
    log_message "INFO" "Starting Load Testing Framework"
    log_message "INFO" "Target: $BASE_URL"
    log_message "INFO" "Configuration: ${USERS} users, ${DURATION}s duration, ${RAMP_UP}s ramp-up"
    
    # Handle dry run
    if [ "$DRY_RUN" = true ]; then
        log_message "INFO" "DRY RUN MODE - No actual tests will be executed"
        echo "Configuration:"
        echo "  Base URL: $BASE_URL"
        echo "  Duration: ${DURATION}s"
        echo "  Users: $USERS"
        echo "  Ramp-up: ${RAMP_UP}s"
        echo "  Scenarios: $SCENARIOS"
        echo "  Tool: $LOAD_TOOL"
        echo "  Results Directory: $RESULTS_DIR"
        exit 0
    fi
    
    # Check prerequisites
    check_prerequisites
    
    # Create test data
    create_test_data
    
    # Check system health
    if [ "$SKIP_HEALTH_CHECK" != true ]; then
        if ! check_system_health; then
            log_message "ERROR" "System health check failed. Use --skip-health-check to bypass."
            exit 1
        fi
    fi
    
    # Start system monitoring if requested
    if [ "$ENABLE_MONITORING" = true ]; then
        monitor_system
    fi
    
    # Run load tests
    local test_start_time=$(date +%s)
    if run_load_tests; then
        local test_end_time=$(date +%s)
        local test_duration=$((test_end_time - test_start_time))
        
        log_message "INFO" "Load testing completed successfully in ${test_duration}s"
        
        # Generate summary report
        generate_summary_report
        
        log_message "INFO" "Results available in: $RESULTS_DIR"
        
        # Show quick summary of latest results
        local latest_report=$(find "$RESULTS_DIR" -name "performance-report.html" | sort | tail -1)
        if [ -n "$latest_report" ]; then
            log_message "INFO" "Latest performance report: $latest_report"
        fi
        
    else
        log_message "ERROR" "Load testing failed"
        exit 1
    fi
    
    # Stop monitoring
    if [ "$ENABLE_MONITORING" = true ]; then
        stop_monitoring
    fi
    
    log_message "INFO" "Load Testing Framework completed"
}

# Cleanup on exit
cleanup() {
    stop_monitoring
}
trap cleanup EXIT

# Execute main function
main "$@"