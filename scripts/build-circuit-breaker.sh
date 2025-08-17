#!/bin/bash
# Advanced Circuit Breaker Pattern for Docker Builds
# Implements intelligent retry logic with exponential backoff and failure analysis

set -euo pipefail

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly MAX_RETRIES=${MAX_RETRIES:-3}
readonly BASE_DELAY=${BASE_DELAY:-30}
readonly MAX_DELAY=${MAX_DELAY:-300}
readonly TIMEOUT=${TIMEOUT:-1800}  # 30 minutes
readonly LOG_FILE="/tmp/build-circuit-breaker-$(date +%Y%m%d-%H%M%S).log"

# Circuit breaker states
readonly STATE_CLOSED="CLOSED"
readonly STATE_OPEN="OPEN"
readonly STATE_HALF_OPEN="HALF_OPEN"

# Failure tracking
declare -A failure_counts
declare -A last_failure_time
declare -A circuit_state
declare -A success_counts

# Logging functions
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" | tee -a "$LOG_FILE" >&2
}

log_success() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] SUCCESS: $*" | tee -a "$LOG_FILE"
}

# Circuit breaker functions
init_circuit() {
    local service="$1"
    failure_counts["$service"]=0
    last_failure_time["$service"]=0
    circuit_state["$service"]="$STATE_CLOSED"
    success_counts["$service"]=0
}

get_circuit_state() {
    local service="$1"
    local current_time=$(date +%s)
    local last_failure=${last_failure_time["$service"]:-0}
    local failures=${failure_counts["$service"]:-0}
    
    # Check if circuit should move from OPEN to HALF_OPEN
    if [[ "${circuit_state["$service"]}" == "$STATE_OPEN" ]]; then
        local time_since_failure=$((current_time - last_failure))
        if [[ $time_since_failure -gt 300 ]]; then  # 5 minutes cooldown
            circuit_state["$service"]="$STATE_HALF_OPEN"
            log "Circuit for $service moved to HALF_OPEN state"
        fi
    fi
    
    echo "${circuit_state["$service"]}"
}

record_failure() {
    local service="$1"
    local current_time=$(date +%s)
    
    failure_counts["$service"]=$((${failure_counts["$service"]:-0} + 1))
    last_failure_time["$service"]=$current_time
    success_counts["$service"]=0
    
    # Open circuit if too many failures
    if [[ ${failure_counts["$service"]} -ge 3 ]]; then
        circuit_state["$service"]="$STATE_OPEN"
        log_error "Circuit for $service opened due to repeated failures"
    fi
}

record_success() {
    local service="$1"
    
    success_counts["$service"]=$((${success_counts["$service"]:-0} + 1))
    
    # Close circuit if in HALF_OPEN state and success
    if [[ "${circuit_state["$service"]}" == "$STATE_HALF_OPEN" ]]; then
        circuit_state["$service"]="$STATE_CLOSED"
        failure_counts["$service"]=0
        log_success "Circuit for $service closed after successful recovery"
    fi
}

# Build analysis functions
analyze_build_failure() {
    local service="$1"
    local exit_code="$2"
    local log_output="$3"
    
    log "Analyzing build failure for $service (exit code: $exit_code)"
    
    # Common failure patterns
    if echo "$log_output" | grep -q "ENOSPC\|No space left on device"; then
        echo "DISK_SPACE"
    elif echo "$log_output" | grep -q "network\|timeout\|connection"; then
        echo "NETWORK"
    elif echo "$log_output" | grep -q "memory\|OOM\|out of memory"; then
        echo "MEMORY"
    elif echo "$log_output" | grep -q "permission denied\|unauthorized"; then
        echo "PERMISSIONS"
    elif echo "$log_output" | grep -q "package not found\|404"; then
        echo "DEPENDENCIES"
    elif echo "$log_output" | grep -q "typescript\|compilation"; then
        echo "COMPILATION"
    else
        echo "UNKNOWN"
    fi
}

# Recovery strategies
apply_recovery_strategy() {
    local service="$1"
    local failure_type="$2"
    local attempt="$3"
    
    log "Applying recovery strategy for $service: $failure_type (attempt $attempt)"
    
    case "$failure_type" in
        "DISK_SPACE")
            log "Cleaning up disk space..."
            docker system prune -f
            docker builder prune -f
            ;;
        "NETWORK")
            log "Implementing network retry with backoff..."
            sleep $((attempt * 15))
            ;;
        "MEMORY")
            log "Reducing build parallelism..."
            export DOCKER_BUILDKIT_BUILD_ARG_MAX_PARALLELISM=2
            ;;
        "DEPENDENCIES")
            log "Clearing npm cache..."
            docker run --rm -v /tmp/.npm-cache:/tmp/.npm-cache alpine:latest rm -rf /tmp/.npm-cache/*
            ;;
        "COMPILATION")
            log "Using fallback build configuration..."
            export USE_FALLBACK_CONFIG=true
            ;;
        *)
            log "Applying general recovery strategy..."
            sleep $((attempt * BASE_DELAY))
            ;;
    esac
}

# Enhanced build function with circuit breaker
build_with_circuit_breaker() {
    local service="$1"
    local dockerfile="$2"
    local context="$3"
    local push_flag="$4"
    
    init_circuit "$service"
    
    local build_start=$(date +%s)
    local attempt=1
    local delay=$BASE_DELAY
    
    while [[ $attempt -le $MAX_RETRIES ]]; do
        local state=$(get_circuit_state "$service")
        
        if [[ "$state" == "$STATE_OPEN" ]]; then
            log_error "Circuit is OPEN for $service. Skipping build attempt."
            return 1
        fi
        
        log "🔄 Build attempt $attempt/$MAX_RETRIES for $service (circuit: $state)"
        
        local build_log="/tmp/build-${service}-${attempt}.log"
        local build_cmd="docker buildx build"
        
        # Build command construction
        build_cmd+=" --platform linux/amd64,linux/arm64"
        build_cmd+=" --file $dockerfile"
        build_cmd+=" --tag ghcr.io/\${GITHUB_REPOSITORY}-${service}:optimized"
        
        # Advanced caching strategy
        build_cmd+=" --cache-from type=gha,scope=${service}-amd64"
        build_cmd+=" --cache-from type=gha,scope=${service}-arm64"
        build_cmd+=" --cache-from type=registry,ref=ghcr.io/\${GITHUB_REPOSITORY}/cache:${service}"
        build_cmd+=" --cache-to type=gha,mode=max,scope=${service}-amd64"
        build_cmd+=" --cache-to type=registry,ref=ghcr.io/\${GITHUB_REPOSITORY}/cache:${service},mode=max"
        
        # Build arguments
        build_cmd+=" --build-arg BUILDPLATFORM=linux/amd64"
        build_cmd+=" --build-arg SERVICE_NAME=${service}"
        build_cmd+=" --build-arg BUILD_ATTEMPT=${attempt}"
        
        if [[ "$push_flag" == "true" ]]; then
            build_cmd+=" --push"
        else
            build_cmd+=" --load"
        fi
        
        build_cmd+=" $context"
        
        # Execute build with timeout
        log "Executing: $build_cmd"
        if timeout "$TIMEOUT" bash -c "$build_cmd 2>&1 | tee $build_log"; then
            local build_end=$(date +%s)
            local build_duration=$((build_end - build_start))
            
            record_success "$service"
            log_success "Build completed for $service in ${build_duration}s (attempt $attempt)"
            
            # Performance analysis
            analyze_build_performance "$service" "$build_duration" "$build_log"
            
            return 0
        else
            local exit_code=$?
            local log_output=$(cat "$build_log" 2>/dev/null || echo "No log available")
            local failure_type=$(analyze_build_failure "$service" "$exit_code" "$log_output")
            
            record_failure "$service"
            log_error "Build failed for $service: $failure_type (exit code: $exit_code)"
            
            if [[ $attempt -eq $MAX_RETRIES ]]; then
                log_error "All retry attempts exhausted for $service"
                return 1
            fi
            
            # Apply recovery strategy
            apply_recovery_strategy "$service" "$failure_type" "$attempt"
            
            # Exponential backoff with jitter
            local jitter=$((RANDOM % 10))
            local total_delay=$((delay + jitter))
            if [[ $total_delay -gt $MAX_DELAY ]]; then
                total_delay=$MAX_DELAY
            fi
            
            log "Waiting ${total_delay}s before retry..."
            sleep "$total_delay"
            
            delay=$((delay * 2))
            attempt=$((attempt + 1))
        fi
    done
    
    return 1
}

# Performance analysis
analyze_build_performance() {
    local service="$1"
    local duration="$2"
    local log_file="$3"
    
    log "📊 Performance analysis for $service:"
    log "   Duration: ${duration}s"
    
    # Extract cache hit information
    if grep -q "CACHED" "$log_file"; then
        local cache_hits=$(grep -c "CACHED" "$log_file" || echo "0")
        log "   Cache hits: $cache_hits"
    fi
    
    # Performance rating
    if [[ $duration -lt 120 ]]; then
        log "   Rating: 🚀 Excellent (<2min)"
    elif [[ $duration -lt 300 ]]; then
        log "   Rating: ✅ Good (<5min)"
    elif [[ $duration -lt 600 ]]; then
        log "   Rating: ⚠️ Fair (<10min)"
    else
        log "   Rating: ❌ Needs optimization (>10min)"
    fi
}

# Report generation
generate_build_report() {
    local services=("$@")
    local report_file="/tmp/build-report-$(date +%Y%m%d-%H%M%S).json"
    
    log "📋 Generating build report..."
    
    cat > "$report_file" <<EOF
{
  "build_report": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "services": [
EOF
    
    local first=true
    for service in "${services[@]}"; do
        if [[ "$first" == "true" ]]; then
            first=false
        else
            echo "," >> "$report_file"
        fi
        
        cat >> "$report_file" <<EOF
      {
        "name": "$service",
        "circuit_state": "${circuit_state["$service"]:-"UNKNOWN"}",
        "failure_count": ${failure_counts["$service"]:-0},
        "success_count": ${success_counts["$service"]:-0}
      }
EOF
    done
    
    cat >> "$report_file" <<EOF
    ],
    "log_file": "$LOG_FILE"
  }
}
EOF
    
    log "Report generated: $report_file"
    echo "$report_file"
}

# Main execution
main() {
    local service="${1:-}"
    local dockerfile="${2:-}"
    local context="${3:-.}"
    local push_flag="${4:-false}"
    
    if [[ -z "$service" || -z "$dockerfile" ]]; then
        log_error "Usage: $0 <service> <dockerfile> [context] [push_flag]"
        exit 1
    fi
    
    log "🚀 Starting circuit breaker build for $service"
    log "   Dockerfile: $dockerfile"
    log "   Context: $context"
    log "   Push: $push_flag"
    
    if build_with_circuit_breaker "$service" "$dockerfile" "$context" "$push_flag"; then
        log_success "Circuit breaker build completed successfully for $service"
        exit 0
    else
        log_error "Circuit breaker build failed for $service"
        exit 1
    fi
}

# Execute if called directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi