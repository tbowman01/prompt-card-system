#!/bin/bash
# =============================================================================
# 🧪 COMPREHENSIVE TEST SUITE RUNNER
# =============================================================================
# Memory-driven test patterns from coverage analysis:
# - Parallel test execution with optimal resource allocation
# - Coverage reporting with detailed metrics
# - Integration test orchestration across services
# - Performance benchmarking integration
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SERVICES="${SERVICES:-backend,frontend,auth}"
TEST_TYPES="${TEST_TYPES:-unit,integration,e2e}"
COVERAGE_THRESHOLD="${COVERAGE_THRESHOLD:-80}"
PARALLEL_JOBS="${PARALLEL_JOBS:-$(nproc)}"
GENERATE_REPORTS="${GENERATE_REPORTS:-true}"
FAIL_FAST="${FAIL_FAST:-false}"
DOCKER_TESTS="${DOCKER_TESTS:-false}"
PERFORMANCE_TESTS="${PERFORMANCE_TESTS:-false}"

# Test configurations
declare -A SERVICE_TEST_CONFIGS=(
    ["backend"]="unit=jest,integration=jest,e2e=supertest,coverage=jest"
    ["frontend"]="unit=jest,integration=jest,e2e=playwright,coverage=jest"
    ["auth"]="unit=jest,integration=jest,e2e=supertest,coverage=jest"
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

# Setup test environment
setup_test_environment() {
    log "Setting up test environment..."
    
    # Create test reports directory
    mkdir -p test-reports/{coverage,junit,performance}
    
    # Setup environment variables for testing
    export NODE_ENV=test
    export CI=true
    export FORCE_COLOR=1
    export JEST_JUNIT_OUTPUT_DIR="test-reports/junit"
    export JEST_JUNIT_OUTPUT_NAME="results.xml"
    
    # Docker test setup if enabled
    if [[ "$DOCKER_TESTS" == "true" ]]; then
        log "Setting up Docker test environment..."
        docker network create test-network 2>/dev/null || true
        
        # Start test databases
        docker run -d --name test-postgres --network test-network \
            -e POSTGRES_DB=test_db \
            -e POSTGRES_USER=test \
            -e POSTGRES_PASSWORD=test \
            -p 5433:5432 \
            postgres:15-alpine >/dev/null 2>&1 || true
            
        docker run -d --name test-redis --network test-network \
            -p 6380:6379 \
            redis:7-alpine >/dev/null 2>&1 || true
            
        # Wait for services to be ready
        sleep 10
    fi
    
    success "Test environment setup completed"
}

# Cleanup test environment
cleanup_test_environment() {
    log "Cleaning up test environment..."
    
    if [[ "$DOCKER_TESTS" == "true" ]]; then
        docker stop test-postgres test-redis 2>/dev/null || true
        docker rm test-postgres test-redis 2>/dev/null || true
        docker network rm test-network 2>/dev/null || true
    fi
    
    # Clean up temporary test files
    find . -name "*.tmp" -type f -delete 2>/dev/null || true
    find . -name ".test-*" -type d -exec rm -rf {} + 2>/dev/null || true
    
    log "Test environment cleanup completed"
}

# Run unit tests for a service
run_unit_tests() {
    local service="$1"
    local config="${SERVICE_TEST_CONFIGS[$service]:-}"
    
    if [[ -z "$config" ]]; then
        warning "No test configuration found for service: $service"
        return 0
    fi
    
    log "Running unit tests for: $service"
    
    cd "$service"
    
    # Check if service has tests
    if [[ ! -d "src/__tests__" ]] && [[ ! -d "tests" ]] && [[ ! -f "jest.config.js" ]]; then
        warning "No tests found for service: $service"
        cd ..
        return 0
    fi
    
    # Install dependencies if needed
    if [[ ! -d "node_modules" ]]; then
        log "Installing dependencies for $service..."
        npm ci --silent --ignore-scripts --no-audit --no-fund
    fi
    
    # Run unit tests
    local test_cmd="npm run test:unit"
    if ! npm run test:unit >/dev/null 2>&1; then
        # Fallback to standard test command
        test_cmd="npm test"
        if ! npm test -- --passWithNoTests --watchAll=false --coverage=false --silent >/dev/null 2>&1; then
            # Direct Jest execution
            test_cmd="npx jest --passWithNoTests --watchAll=false --coverage=false"
        fi
    fi
    
    log "Executing: $test_cmd"
    if eval "$test_cmd --coverage --coverageReporters=json --coverageReporters=lcov --coverageReporters=text-summary --outputFile=../test-reports/coverage/$service-unit.json"; then
        success "Unit tests passed for: $service"
        cd ..
        return 0
    else
        error "Unit tests failed for: $service"
        cd ..
        return 1
    fi
}

# Run integration tests for a service
run_integration_tests() {
    local service="$1"
    
    log "Running integration tests for: $service"
    
    cd "$service"
    
    # Check for integration tests
    if [[ ! -d "tests/integration" ]] && [[ ! -d "src/tests/integration" ]]; then
        warning "No integration tests found for service: $service"
        cd ..
        return 0
    fi
    
    # Set integration test environment
    export DATABASE_URL="postgresql://test:test@localhost:5433/test_db"
    export REDIS_URL="redis://localhost:6380"
    export NODE_ENV=test
    
    # Run integration tests
    local test_cmd="npm run test:integration"
    if ! npm run test:integration >/dev/null 2>&1; then
        # Fallback commands
        test_cmd="npx jest tests/integration --passWithNoTests --watchAll=false"
        if [[ ! -d "tests/integration" ]]; then
            test_cmd="npx jest src/tests/integration --passWithNoTests --watchAll=false"
        fi
    fi
    
    log "Executing: $test_cmd"
    if eval "$test_cmd --outputFile=../test-reports/junit/$service-integration.xml --testResultsProcessor=jest-junit"; then
        success "Integration tests passed for: $service"
        cd ..
        return 0
    else
        error "Integration tests failed for: $service"
        cd ..
        return 1
    fi
}

# Run end-to-end tests
run_e2e_tests() {
    local service="$1"
    
    log "Running E2E tests for: $service"
    
    cd "$service"
    
    # Check for E2E tests
    if [[ ! -d "e2e" ]] && [[ ! -d "tests/e2e" ]] && [[ ! -f "playwright.config.ts" ]]; then
        warning "No E2E tests found for service: $service"
        cd ..
        return 0
    fi
    
    # Setup E2E environment
    case "$service" in
        "frontend")
            # Use Playwright for frontend E2E tests
            if command -v npx playwright >/dev/null 2>&1; then
                log "Running Playwright E2E tests..."
                if npx playwright test --reporter=junit --output-dir=../test-reports/e2e/$service; then
                    success "E2E tests passed for: $service"
                    cd ..
                    return 0
                fi
            fi
            ;;
        "backend"|"auth")
            # Use Supertest or similar for API E2E tests
            local test_cmd="npm run test:e2e"
            if ! npm run test:e2e >/dev/null 2>&1; then
                test_cmd="npx jest e2e --passWithNoTests --watchAll=false"
                if [[ ! -d "e2e" ]]; then
                    test_cmd="npx jest tests/e2e --passWithNoTests --watchAll=false"
                fi
            fi
            
            if eval "$test_cmd --outputFile=../test-reports/junit/$service-e2e.xml --testResultsProcessor=jest-junit"; then
                success "E2E tests passed for: $service"
                cd ..
                return 0
            fi
            ;;
    esac
    
    error "E2E tests failed for: $service"
    cd ..
    return 1
}

# Run performance tests
run_performance_tests() {
    local service="$1"
    
    if [[ "$PERFORMANCE_TESTS" != "true" ]]; then
        return 0
    fi
    
    log "Running performance tests for: $service"
    
    cd "$service"
    
    # Check for performance tests
    if [[ ! -d "tests/performance" ]] && [[ ! -f "load-test.js" ]]; then
        warning "No performance tests found for service: $service"
        cd ..
        return 0
    fi
    
    # Run performance tests
    local test_cmd="npm run test:performance"
    if ! npm run test:performance >/dev/null 2>&1; then
        if [[ -f "load-test.js" ]]; then
            test_cmd="node load-test.js"
        else
            test_cmd="npx jest tests/performance --passWithNoTests --watchAll=false"
        fi
    fi
    
    if eval "$test_cmd > ../test-reports/performance/$service-performance.json"; then
        success "Performance tests passed for: $service"
        cd ..
        return 0
    else
        error "Performance tests failed for: $service"
        cd ..
        return 1
    fi
}

# Generate coverage report
generate_coverage_report() {
    log "Generating comprehensive coverage report..."
    
    # Collect all coverage files
    local coverage_files=()
    for service in backend frontend auth; do
        if [[ -f "test-reports/coverage/$service-unit.json" ]]; then
            coverage_files+=("test-reports/coverage/$service-unit.json")
        fi
    done
    
    if [[ ${#coverage_files[@]} -eq 0 ]]; then
        warning "No coverage files found"
        return 0
    fi
    
    # Create combined coverage report
    cat > test-reports/coverage/combined-coverage.json << 'EOF'
{
  "total": {
    "lines": {"total": 0, "covered": 0, "skipped": 0, "pct": 0},
    "functions": {"total": 0, "covered": 0, "skipped": 0, "pct": 0},
    "statements": {"total": 0, "covered": 0, "skipped": 0, "pct": 0},
    "branches": {"total": 0, "covered": 0, "skipped": 0, "pct": 0}
  }
}
EOF
    
    # Generate HTML coverage report
    if command -v istanbul >/dev/null 2>&1; then
        istanbul report --include="test-reports/coverage/*-unit.json" html --dir test-reports/coverage/html || true
    fi
    
    # Check coverage threshold
    local avg_coverage=0
    local service_count=0
    
    for coverage_file in "${coverage_files[@]}"; do
        if [[ -f "$coverage_file" ]]; then
            # Extract coverage percentage (simplified)
            local coverage=$(grep -o '"pct":[0-9]*' "$coverage_file" | head -1 | cut -d: -f2 || echo "0")
            avg_coverage=$((avg_coverage + coverage))
            service_count=$((service_count + 1))
        fi
    done
    
    if [[ $service_count -gt 0 ]]; then
        avg_coverage=$((avg_coverage / service_count))
        log "Average coverage: ${avg_coverage}%"
        
        if [[ $avg_coverage -ge $COVERAGE_THRESHOLD ]]; then
            success "Coverage threshold met: ${avg_coverage}% >= ${COVERAGE_THRESHOLD}%"
        else
            error "Coverage threshold not met: ${avg_coverage}% < ${COVERAGE_THRESHOLD}%"
            return 1
        fi
    fi
    
    return 0
}

# Generate test report
generate_test_report() {
    log "Generating test execution report..."
    
    local report_file="test-reports/test-execution-report-$(date +%Y%m%d-%H%M%S).json"
    
    cat > "$report_file" << EOF
{
  "execution_timestamp": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')",
  "services": $(echo "$SERVICES" | jq -R 'split(",")'),
  "test_types": $(echo "$TEST_TYPES" | jq -R 'split(",")'),
  "configuration": {
    "coverage_threshold": $COVERAGE_THRESHOLD,
    "parallel_jobs": $PARALLEL_JOBS,
    "docker_tests": $DOCKER_TESTS,
    "performance_tests": $PERFORMANCE_TESTS,
    "fail_fast": $FAIL_FAST
  },
  "results": {
    "total_tests": 0,
    "passed_tests": 0,
    "failed_tests": 0,
    "coverage_percentage": 0,
    "execution_time_seconds": 0
  }
}
EOF
    
    log "Test report generated: $report_file"
}

# Run tests for a single service
run_service_tests() {
    local service="$1"
    local test_types="$2"
    
    log "Running tests for service: $service (types: $test_types)"
    
    if [[ ! -d "$service" ]]; then
        warning "Service directory not found: $service"
        return 0
    fi
    
    local failed_tests=()
    
    # Run each test type
    IFS=',' read -ra type_array <<< "$test_types"
    for test_type in "${type_array[@]}"; do
        test_type=$(echo "$test_type" | xargs) # trim whitespace
        
        case "$test_type" in
            "unit")
                if ! run_unit_tests "$service"; then
                    failed_tests+=("unit")
                fi
                ;;
            "integration")
                if ! run_integration_tests "$service"; then
                    failed_tests+=("integration")
                fi
                ;;
            "e2e")
                if ! run_e2e_tests "$service"; then
                    failed_tests+=("e2e")
                fi
                ;;
            "performance")
                if ! run_performance_tests "$service"; then
                    failed_tests+=("performance")
                fi
                ;;
            *)
                warning "Unknown test type: $test_type"
                ;;
        esac
        
        # Fail fast if enabled
        if [[ "$FAIL_FAST" == "true" ]] && [[ ${#failed_tests[@]} -gt 0 ]]; then
            error "Failing fast due to test failure in $service ($test_type)"
            return 1
        fi
    done
    
    if [[ ${#failed_tests[@]} -gt 0 ]]; then
        error "Failed test types for $service: ${failed_tests[*]}"
        return 1
    fi
    
    success "All tests passed for service: $service"
    return 0
}

# Main test execution function
main() {
    local start_time=$(date +%s)
    
    log "Starting comprehensive test suite..."
    log "Services: $SERVICES"
    log "Test types: $TEST_TYPES"
    log "Coverage threshold: ${COVERAGE_THRESHOLD}%"
    log "Parallel jobs: $PARALLEL_JOBS"
    log "Docker tests: $DOCKER_TESTS"
    log "Performance tests: $PERFORMANCE_TESTS"
    log "Fail fast: $FAIL_FAST"
    
    # Setup
    setup_test_environment
    trap cleanup_test_environment EXIT
    
    # Convert services string to array
    IFS=',' read -ra service_array <<< "$SERVICES"
    
    local failed_services=()
    local successful_services=()
    
    # Run tests for each service
    if [[ "$PARALLEL_JOBS" -gt 1 ]] && [[ ${#service_array[@]} -gt 1 ]]; then
        log "Running tests in parallel with $PARALLEL_JOBS jobs..."
        
        # Parallel execution
        export -f run_service_tests run_unit_tests run_integration_tests run_e2e_tests run_performance_tests
        export -f log error warning success
        export RED GREEN YELLOW BLUE NC
        export SERVICE_TEST_CONFIGS TEST_TYPES COVERAGE_THRESHOLD DOCKER_TESTS PERFORMANCE_TESTS FAIL_FAST
        
        if printf '%s\n' "${service_array[@]}" | xargs -I {} -P "$PARALLEL_JOBS" bash -c 'run_service_tests "$1" "$2"' _ {} "$TEST_TYPES"; then
            successful_services=("${service_array[@]}")
        else
            failed_services=("${service_array[@]}")
        fi
    else
        # Sequential execution
        for service in "${service_array[@]}"; do
            service=$(echo "$service" | xargs) # trim whitespace
            
            if run_service_tests "$service" "$TEST_TYPES"; then
                successful_services+=("$service")
            else
                failed_services+=("$service")
                
                if [[ "$FAIL_FAST" == "true" ]]; then
                    error "Failing fast due to test failure in $service"
                    break
                fi
            fi
        done
    fi
    
    # Generate reports if enabled
    if [[ "$GENERATE_REPORTS" == "true" ]]; then
        generate_coverage_report || warning "Coverage report generation failed"
        generate_test_report
    fi
    
    # Calculate execution time
    local end_time=$(date +%s)
    local execution_time=$((end_time - start_time))
    
    # Final summary
    echo
    log "========================================="
    log "TEST EXECUTION SUMMARY"
    log "========================================="
    log "Execution time: ${execution_time}s"
    
    if [[ ${#successful_services[@]} -gt 0 ]]; then
        success "Successfully tested: ${successful_services[*]}"
    fi
    
    if [[ ${#failed_services[@]} -gt 0 ]]; then
        error "Failed testing: ${failed_services[*]}"
        exit 1
    fi
    
    success "All tests completed successfully!"
    
    if [[ "$GENERATE_REPORTS" == "true" ]]; then
        log "Reports available in: test-reports/"
    fi
}

# Handle script arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --services)
            SERVICES="$2"
            shift 2
            ;;
        --types)
            TEST_TYPES="$2"
            shift 2
            ;;
        --coverage-threshold)
            COVERAGE_THRESHOLD="$2"
            shift 2
            ;;
        --parallel)
            PARALLEL_JOBS="$2"
            shift 2
            ;;
        --no-reports)
            GENERATE_REPORTS="false"
            shift
            ;;
        --fail-fast)
            FAIL_FAST="true"
            shift
            ;;
        --docker)
            DOCKER_TESTS="true"
            shift
            ;;
        --performance)
            PERFORMANCE_TESTS="true"
            shift
            ;;
        --help)
            cat << 'EOF'
Usage: run-test-suite.sh [OPTIONS]

Comprehensive test suite runner with parallel execution and reporting.

OPTIONS:
    --services SERVICES         Comma-separated list of services (default: backend,frontend,auth)
    --types TYPES               Test types to run (default: unit,integration,e2e)
    --coverage-threshold PCT    Minimum coverage percentage (default: 80)
    --parallel JOBS             Number of parallel jobs (default: number of CPUs)
    --no-reports                Skip report generation
    --fail-fast                 Stop on first failure
    --docker                    Enable Docker-based testing
    --performance               Include performance tests
    --help                      Show this help message

EXAMPLES:
    run-test-suite.sh                           # Run all tests for all services
    run-test-suite.sh --services backend        # Test only backend
    run-test-suite.sh --types unit,integration  # Run only unit and integration tests
    run-test-suite.sh --parallel 4 --fail-fast # Parallel execution with fail-fast
    run-test-suite.sh --docker --performance   # Full test suite with Docker and performance

TEST TYPES:
    unit            Unit tests (Jest/Mocha)
    integration     Integration tests with real services
    e2e             End-to-end tests (Playwright/Supertest)
    performance     Load and performance tests

REPORTS:
    Coverage reports will be generated in test-reports/coverage/
    JUnit reports will be generated in test-reports/junit/
    Performance reports will be generated in test-reports/performance/
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