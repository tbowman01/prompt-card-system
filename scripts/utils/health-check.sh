#!/bin/bash
# =============================================================================
# 🏥 COMPREHENSIVE HEALTH CHECK SCRIPT
# =============================================================================
# Memory-driven health patterns from monitoring analysis:
# - Multi-service health validation with dependency checking
# - Performance metrics collection during health checks
# - Automated recovery suggestions based on failure patterns
# - Integration with existing monitoring infrastructure
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SERVICES="${SERVICES:-backend,frontend,auth,redis,postgres}"
TIMEOUT="${TIMEOUT:-30}"
RETRY_COUNT="${RETRY_COUNT:-3}"
RETRY_DELAY="${RETRY_DELAY:-5}"
DETAILED_CHECK="${DETAILED_CHECK:-false}"
PERFORMANCE_CHECK="${PERFORMANCE_CHECK:-true}"
DEPENDENCY_CHECK="${DEPENDENCY_CHECK:-true}"
GENERATE_REPORT="${GENERATE_REPORT:-true}"

# Service configurations
declare -A SERVICE_CONFIGS=(
    ["backend"]="port=3001,health=/health,type=http,dependencies=postgres,redis"
    ["frontend"]="port=3000,health=/,type=http,dependencies=backend"
    ["auth"]="port=8005,health=/auth/health,type=http,dependencies=postgres,redis"
    ["redis"]="port=6379,health=ping,type=redis,dependencies="
    ["postgres"]="port=5432,health=,type=postgres,dependencies="
    ["ollama"]="port=11434,health=/api/version,type=http,dependencies="
)

# Health check results
declare -A HEALTH_RESULTS=()
declare -A PERFORMANCE_METRICS=()
declare -A DEPENDENCY_STATUS=()

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
        warning "No configuration found for service: $service"
        return 1
    fi
    
    # Parse config string
    local port=$(echo "$config" | grep -o 'port=[0-9]*' | cut -d= -f2)
    local health=$(echo "$config" | grep -o 'health=[^,]*' | cut -d= -f2)
    local type=$(echo "$config" | grep -o 'type=[^,]*' | cut -d= -f2)
    local dependencies=$(echo "$config" | grep -o 'dependencies=[^,]*' | cut -d= -f2)
    
    echo "$port,$health,$type,$dependencies"
}

# HTTP health check
check_http_health() {
    local service="$1"
    local port="$2"
    local endpoint="$3"
    local start_time=$(date +%s%3N)
    
    local url="http://localhost:$port$endpoint"
    
    log "Checking HTTP health for $service at $url"
    
    local response_code
    local response_time
    
    # Perform health check with timeout
    if response_code=$(curl -s -w "%{http_code}" -o /dev/null --connect-timeout "$TIMEOUT" --max-time "$TIMEOUT" "$url" 2>/dev/null); then
        local end_time=$(date +%s%3N)
        response_time=$((end_time - start_time))
        
        if [[ "$response_code" == "200" ]]; then
            HEALTH_RESULTS["$service"]="healthy"
            PERFORMANCE_METRICS["$service"]="response_time=${response_time}ms,status_code=$response_code"
            success "$service is healthy (${response_time}ms)"
            return 0
        else
            HEALTH_RESULTS["$service"]="unhealthy"
            PERFORMANCE_METRICS["$service"]="response_time=${response_time}ms,status_code=$response_code"
            error "$service returned status code: $response_code"
            return 1
        fi
    else
        HEALTH_RESULTS["$service"]="unreachable"
        PERFORMANCE_METRICS["$service"]="error=connection_failed"
        error "$service is unreachable"
        return 1
    fi
}

# Redis health check
check_redis_health() {
    local service="$1"
    local port="$2"
    local start_time=$(date +%s%3N)
    
    log "Checking Redis health for $service at port $port"
    
    # Check if redis-cli is available
    if ! command -v redis-cli >/dev/null 2>&1; then
        warning "redis-cli not found, using docker to check Redis"
        
        if docker exec -it redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
            local end_time=$(date +%s%3N)
            local response_time=$((end_time - start_time))
            HEALTH_RESULTS["$service"]="healthy"
            PERFORMANCE_METRICS["$service"]="response_time=${response_time}ms,method=docker"
            success "$service is healthy (${response_time}ms)"
            return 0
        fi
    else
        if redis-cli -h localhost -p "$port" ping 2>/dev/null | grep -q "PONG"; then
            local end_time=$(date +%s%3N)
            local response_time=$((end_time - start_time))
            HEALTH_RESULTS["$service"]="healthy"
            PERFORMANCE_METRICS["$service"]="response_time=${response_time}ms,method=cli"
            success "$service is healthy (${response_time}ms)"
            return 0
        fi
    fi
    
    HEALTH_RESULTS["$service"]="unhealthy"
    PERFORMANCE_METRICS["$service"]="error=ping_failed"
    error "$service Redis ping failed"
    return 1
}

# PostgreSQL health check
check_postgres_health() {
    local service="$1"
    local port="$2"
    local start_time=$(date +%s%3N)
    
    log "Checking PostgreSQL health for $service at port $port"
    
    # Check if psql is available
    if ! command -v psql >/dev/null 2>&1; then
        warning "psql not found, using docker to check PostgreSQL"
        
        if docker exec -it postgres pg_isready -U postgres 2>/dev/null | grep -q "accepting connections"; then
            local end_time=$(date +%s%3N)
            local response_time=$((end_time - start_time))
            HEALTH_RESULTS["$service"]="healthy"
            PERFORMANCE_METRICS["$service"]="response_time=${response_time}ms,method=docker"
            success "$service is healthy (${response_time}ms)"
            return 0
        fi
    else
        if PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" pg_isready -h localhost -p "$port" -U postgres 2>/dev/null; then
            local end_time=$(date +%s%3N)
            local response_time=$((end_time - start_time))
            HEALTH_RESULTS["$service"]="healthy"
            PERFORMANCE_METRICS["$service"]="response_time=${response_time}ms,method=cli"
            success "$service is healthy (${response_time}ms)"
            return 0
        fi
    fi
    
    HEALTH_RESULTS["$service"]="unhealthy"
    PERFORMANCE_METRICS["$service"]="error=connection_failed"
    error "$service PostgreSQL connection failed"
    return 1
}

# Port availability check
check_port_availability() {
    local service="$1"
    local port="$2"
    
    log "Checking port availability for $service on port $port"
    
    if nc -z localhost "$port" 2>/dev/null || timeout 5 bash -c "</dev/tcp/localhost/$port" 2>/dev/null; then
        success "Port $port is available for $service"
        return 0
    else
        error "Port $port is not available for $service"
        return 1
    fi
}

# Check service dependencies
check_dependencies() {
    local service="$1"
    local dependencies="$2"
    
    if [[ -z "$dependencies" ]]; then
        DEPENDENCY_STATUS["$service"]="no_dependencies"
        return 0
    fi
    
    log "Checking dependencies for $service: $dependencies"
    
    local failed_deps=()
    IFS=',' read -ra dep_array <<< "$dependencies"
    
    for dep in "${dep_array[@]}"; do
        dep=$(echo "$dep" | xargs) # trim whitespace
        
        if [[ "${HEALTH_RESULTS[$dep]:-}" == "healthy" ]]; then
            log "  ✓ Dependency $dep is healthy"
        else
            error "  ✗ Dependency $dep is not healthy"
            failed_deps+=("$dep")
        fi
    done
    
    if [[ ${#failed_deps[@]} -eq 0 ]]; then
        DEPENDENCY_STATUS["$service"]="all_healthy"
        success "All dependencies are healthy for $service"
        return 0
    else
        DEPENDENCY_STATUS["$service"]="failed:${failed_deps[*]}"
        error "Failed dependencies for $service: ${failed_deps[*]}"
        return 1
    fi
}

# Detailed service analysis
detailed_service_check() {
    local service="$1"
    
    if [[ "$DETAILED_CHECK" != "true" ]]; then
        return 0
    fi
    
    log "Running detailed check for $service..."
    
    # Memory usage check
    if command -v docker >/dev/null 2>&1 && docker ps --filter "name=$service" --format "table {{.Names}}" | grep -q "$service"; then
        local mem_usage=$(docker stats --no-stream --format "table {{.MemUsage}}" "$service" 2>/dev/null | tail -n +2)
        local cpu_usage=$(docker stats --no-stream --format "table {{.CPUPerc}}" "$service" 2>/dev/null | tail -n +2)
        
        log "  Memory usage: $mem_usage"
        log "  CPU usage: $cpu_usage"
        
        PERFORMANCE_METRICS["$service"]="${PERFORMANCE_METRICS[$service]},memory=$mem_usage,cpu=$cpu_usage"
    fi
    
    # Log analysis (if logs are available)
    if docker logs --tail 10 "$service" 2>/dev/null | grep -i error >/dev/null; then
        warning "  Recent errors found in $service logs"
        PERFORMANCE_METRICS["$service"]="${PERFORMANCE_METRICS[$service]},recent_errors=true"
    else
        log "  No recent errors in $service logs"
        PERFORMANCE_METRICS["$service"]="${PERFORMANCE_METRICS[$service]},recent_errors=false"
    fi
}

# Performance baseline check
performance_baseline_check() {
    local service="$1"
    
    if [[ "$PERFORMANCE_CHECK" != "true" ]]; then
        return 0
    fi
    
    log "Running performance baseline check for $service..."
    
    local config
    config=$(parse_service_config "$service")
    local port=$(echo "$config" | cut -d, -f1)
    local health_endpoint=$(echo "$config" | cut -d, -f2)
    local type=$(echo "$config" | cut -d, -f3)
    
    if [[ "$type" == "http" ]]; then
        local url="http://localhost:$port$health_endpoint"
        
        # Run multiple requests to get average response time
        local total_time=0
        local successful_requests=0
        local failed_requests=0
        
        for i in {1..5}; do
            local start_time=$(date +%s%3N)
            
            if curl -s --connect-timeout 5 --max-time 10 "$url" >/dev/null 2>&1; then
                local end_time=$(date +%s%3N)
                local response_time=$((end_time - start_time))
                total_time=$((total_time + response_time))
                successful_requests=$((successful_requests + 1))
            else
                failed_requests=$((failed_requests + 1))
            fi
        done
        
        if [[ $successful_requests -gt 0 ]]; then
            local avg_response_time=$((total_time / successful_requests))
            log "  Average response time: ${avg_response_time}ms (${successful_requests}/5 successful)"
            
            PERFORMANCE_METRICS["$service"]="${PERFORMANCE_METRICS[$service]},avg_response_time=${avg_response_time}ms,success_rate=${successful_requests}/5"
            
            # Performance thresholds
            if [[ $avg_response_time -gt 2000 ]]; then
                warning "  High response time detected for $service (${avg_response_time}ms)"
            fi
            
            if [[ $failed_requests -gt 1 ]]; then
                warning "  Multiple failed requests for $service ($failed_requests/5)"
            fi
        else
            error "  All performance test requests failed for $service"
            PERFORMANCE_METRICS["$service"]="${PERFORMANCE_METRICS[$service]},performance_test=failed"
        fi
    fi
}

# Generate recovery suggestions
generate_recovery_suggestions() {
    local service="$1"
    local health_status="${HEALTH_RESULTS[$service]:-unknown}"
    
    case "$health_status" in
        "unhealthy")
            echo "🔧 Recovery suggestions for $service:"
            echo "  1. Check service logs: docker logs $service"
            echo "  2. Restart service: docker restart $service"
            echo "  3. Check resource usage: docker stats $service"
            echo "  4. Verify configuration and environment variables"
            ;;
        "unreachable")
            echo "🔧 Recovery suggestions for $service:"
            echo "  1. Check if service is running: docker ps | grep $service"
            echo "  2. Start service if stopped: docker start $service"
            echo "  3. Check port availability: netstat -tlnp | grep $(parse_service_config "$service" | cut -d, -f1)"
            echo "  4. Verify network connectivity"
            ;;
        "dependency_failed")
            echo "🔧 Recovery suggestions for $service:"
            echo "  1. Check dependency status: ${DEPENDENCY_STATUS[$service]}"
            echo "  2. Start dependencies first before restarting $service"
            echo "  3. Verify dependency configuration"
            ;;
    esac
}

# Check single service health
check_service_health() {
    local service="$1"
    
    log "Health check for service: $service"
    
    # Parse service configuration
    local config
    if ! config=$(parse_service_config "$service"); then
        HEALTH_RESULTS["$service"]="no_config"
        return 1
    fi
    
    local port=$(echo "$config" | cut -d, -f1)
    local health_endpoint=$(echo "$config" | cut -d, -f2)
    local type=$(echo "$config" | cut -d, -f3)
    local dependencies=$(echo "$config" | cut -d, -f4)
    
    # Check port availability first
    if ! check_port_availability "$service" "$port"; then
        HEALTH_RESULTS["$service"]="port_unavailable"
        return 1
    fi
    
    # Perform type-specific health check with retries
    local attempt=1
    local health_check_passed=false
    
    while [[ $attempt -le $RETRY_COUNT ]]; do
        log "Health check attempt $attempt/$RETRY_COUNT for $service"
        
        case "$type" in
            "http")
                if check_http_health "$service" "$port" "$health_endpoint"; then
                    health_check_passed=true
                    break
                fi
                ;;
            "redis")
                if check_redis_health "$service" "$port"; then
                    health_check_passed=true
                    break
                fi
                ;;
            "postgres")
                if check_postgres_health "$service" "$port"; then
                    health_check_passed=true
                    break
                fi
                ;;
            *)
                warning "Unknown service type: $type for $service"
                HEALTH_RESULTS["$service"]="unknown_type"
                return 1
                ;;
        esac
        
        if [[ $attempt -lt $RETRY_COUNT ]]; then
            log "Waiting ${RETRY_DELAY}s before retry..."
            sleep "$RETRY_DELAY"
        fi
        
        ((attempt++))
    done
    
    if [[ "$health_check_passed" != "true" ]]; then
        log "All health check attempts failed for $service"
        return 1
    fi
    
    # Check dependencies if specified
    if [[ "$DEPENDENCY_CHECK" == "true" ]] && [[ -n "$dependencies" ]]; then
        if ! check_dependencies "$service" "$dependencies"; then
            HEALTH_RESULTS["$service"]="dependency_failed"
            return 1
        fi
    fi
    
    # Run detailed checks
    detailed_service_check "$service"
    performance_baseline_check "$service"
    
    return 0
}

# Generate health report
generate_health_report() {
    if [[ "$GENERATE_REPORT" != "true" ]]; then
        return 0
    fi
    
    log "Generating health check report..."
    
    local report_file="health-check-report-$(date +%Y%m%d-%H%M%S).json"
    
    # Convert associative arrays to JSON
    local services_json="["
    local first=true
    
    for service in "${!HEALTH_RESULTS[@]}"; do
        if [[ "$first" == "true" ]]; then
            first=false
        else
            services_json="$services_json,"
        fi
        
        services_json="$services_json{\"name\":\"$service\",\"status\":\"${HEALTH_RESULTS[$service]}\",\"metrics\":\"${PERFORMANCE_METRICS[$service]:-}\",\"dependencies\":\"${DEPENDENCY_STATUS[$service]:-}\"}"
    done
    
    services_json="$services_json]"
    
    cat > "$report_file" << EOF
{
  "timestamp": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')",
  "overall_status": "$(if [[ $(echo "${HEALTH_RESULTS[@]}" | grep -o "healthy" | wc -l) -eq ${#HEALTH_RESULTS[@]} ]]; then echo "healthy"; else echo "degraded"; fi)",
  "total_services": ${#HEALTH_RESULTS[@]},
  "healthy_services": $(echo "${HEALTH_RESULTS[@]}" | grep -o "healthy" | wc -l),
  "configuration": {
    "timeout": $TIMEOUT,
    "retry_count": $RETRY_COUNT,
    "retry_delay": $RETRY_DELAY,
    "detailed_check": $DETAILED_CHECK,
    "performance_check": $PERFORMANCE_CHECK,
    "dependency_check": $DEPENDENCY_CHECK
  },
  "services": $services_json
}
EOF
    
    success "Health report generated: $report_file"
}

# Main health check function
main() {
    log "Starting comprehensive health check..."
    log "Services: $SERVICES"
    log "Timeout: ${TIMEOUT}s"
    log "Retry count: $RETRY_COUNT"
    log "Detailed check: $DETAILED_CHECK"
    log "Performance check: $PERFORMANCE_CHECK"
    log "Dependency check: $DEPENDENCY_CHECK"
    
    # Convert services string to array
    IFS=',' read -ra service_array <<< "$SERVICES"
    
    local healthy_services=()
    local unhealthy_services=()
    
    # Check each service
    for service in "${service_array[@]}"; do
        service=$(echo "$service" | xargs) # trim whitespace
        
        echo
        log "========================================="
        log "Checking service: $service"
        log "========================================="
        
        if check_service_health "$service"; then
            healthy_services+=("$service")
        else
            unhealthy_services+=("$service")
            generate_recovery_suggestions "$service"
        fi
    done
    
    # Generate report
    generate_health_report
    
    # Final summary
    echo
    echo "============================================="
    log "HEALTH CHECK SUMMARY"
    echo "============================================="
    
    if [[ ${#healthy_services[@]} -gt 0 ]]; then
        success "Healthy services (${#healthy_services[@]}): ${healthy_services[*]}"
    fi
    
    if [[ ${#unhealthy_services[@]} -gt 0 ]]; then
        error "Unhealthy services (${#unhealthy_services[@]}): ${unhealthy_services[*]}"
        
        echo
        log "🔧 RECOVERY ACTIONS NEEDED:"
        for service in "${unhealthy_services[@]}"; do
            generate_recovery_suggestions "$service"
            echo
        done
        
        exit 1
    fi
    
    success "All services are healthy! 🎉"
}

# Handle script arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --services)
            SERVICES="$2"
            shift 2
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --retry-count)
            RETRY_COUNT="$2"
            shift 2
            ;;
        --retry-delay)
            RETRY_DELAY="$2"
            shift 2
            ;;
        --detailed)
            DETAILED_CHECK="true"
            shift
            ;;
        --no-performance)
            PERFORMANCE_CHECK="false"
            shift
            ;;
        --no-dependencies)
            DEPENDENCY_CHECK="false"
            shift
            ;;
        --no-report)
            GENERATE_REPORT="false"
            shift
            ;;
        --help)
            cat << 'EOF'
Usage: health-check.sh [OPTIONS]

Comprehensive health check for all system services with dependency validation.

OPTIONS:
    --services SERVICES         Comma-separated list of services (default: backend,frontend,auth,redis,postgres)
    --timeout SECONDS           Health check timeout (default: 30)
    --retry-count COUNT         Number of retries for failed checks (default: 3)
    --retry-delay SECONDS       Delay between retries (default: 5)
    --detailed                  Enable detailed resource analysis
    --no-performance            Skip performance baseline checks
    --no-dependencies           Skip dependency validation
    --no-report                 Skip health report generation
    --help                      Show this help message

EXAMPLES:
    health-check.sh                           # Check all default services
    health-check.sh --services backend,redis  # Check specific services
    health-check.sh --detailed --timeout 60   # Detailed check with longer timeout
    health-check.sh --no-dependencies         # Skip dependency checks

HEALTH CHECK TYPES:
    HTTP Services       curl-based health endpoint checks
    Redis              PING command validation
    PostgreSQL         pg_isready connection check
    Port Availability   Network connectivity verification

FEATURES:
    ✓ Multi-service health validation
    ✓ Dependency chain verification
    ✓ Performance baseline testing
    ✓ Automated recovery suggestions
    ✓ Detailed resource analysis
    ✓ Comprehensive reporting
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