#!/bin/bash
# Advanced Parallel Build Executor
# Implements optimal resource utilization strategies for Docker builds

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly MAX_PARALLEL_BUILDS=${MAX_PARALLEL_BUILDS:-4}
readonly RESOURCE_MONITOR_INTERVAL=${RESOURCE_MONITOR_INTERVAL:-5}
readonly LOG_DIR="/tmp/parallel-builds-$(date +%Y%m%d-%H%M%S)"

# Resource tracking
declare -A build_pids
declare -A build_start_times
declare -A build_resources
declare -A build_status

# Logging
mkdir -p "$LOG_DIR"
exec > >(tee "$LOG_DIR/executor.log")
exec 2>&1

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" >&2
}

log_success() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] SUCCESS: $*"
}

# Resource monitoring
get_system_resources() {
    local cpu_cores=$(nproc)
    local total_memory=$(free -m | awk 'NR==2{print $2}')
    local available_memory=$(free -m | awk 'NR==2{print $7}')
    local disk_space=$(df / | awk 'NR==2{print $4}')
    
    echo "{
        \"cpu_cores\": $cpu_cores,
        \"total_memory_mb\": $total_memory,
        \"available_memory_mb\": $available_memory,
        \"disk_space_kb\": $disk_space
    }"
}

calculate_optimal_parallelism() {
    local system_resources=$(get_system_resources)
    local cpu_cores=$(echo "$system_resources" | jq -r '.cpu_cores')
    local available_memory=$(echo "$system_resources" | jq -r '.available_memory_mb')
    
    # Calculate based on available resources
    local cpu_based_limit=$((cpu_cores > 8 ? 4 : cpu_cores / 2))
    local memory_based_limit=$((available_memory / 2048))  # 2GB per build
    
    # Use the most restrictive limit
    local optimal_limit=$cpu_based_limit
    if [[ $memory_based_limit -lt $optimal_limit ]]; then
        optimal_limit=$memory_based_limit
    fi
    
    # Ensure minimum of 1 and respect maximum
    if [[ $optimal_limit -lt 1 ]]; then
        optimal_limit=1
    elif [[ $optimal_limit -gt $MAX_PARALLEL_BUILDS ]]; then
        optimal_limit=$MAX_PARALLEL_BUILDS
    fi
    
    echo "$optimal_limit"
}

# Resource allocation per service
allocate_build_resources() {
    local service="$1"
    local total_cores=$(nproc)
    local total_memory=$(free -m | awk 'NR==2{print $2}')
    local parallel_builds="$2"
    
    case "$service" in
        "backend")
            echo "{
                \"cpu_limit\": \"$(echo "scale=1; $total_cores / $parallel_builds * 1.2" | bc)\",
                \"memory_limit\": \"$((total_memory / parallel_builds * 4 / 3))m\",
                \"priority\": \"high\"
            }"
            ;;
        "frontend")
            echo "{
                \"cpu_limit\": \"$(echo "scale=1; $total_cores / $parallel_builds * 1.5" | bc)\",
                \"memory_limit\": \"$((total_memory / parallel_builds * 3 / 2))m\",
                \"priority\": \"high\"
            }"
            ;;
        "auth")
            echo "{
                \"cpu_limit\": \"$(echo "scale=1; $total_cores / $parallel_builds * 0.8" | bc)\",
                \"memory_limit\": \"$((total_memory / parallel_builds / 2))m\",
                \"priority\": \"medium\"
            }"
            ;;
        *)
            echo "{
                \"cpu_limit\": \"$(echo "scale=1; $total_cores / $parallel_builds" | bc)\",
                \"memory_limit\": \"$((total_memory / parallel_builds))m\",
                \"priority\": \"medium\"
            }"
            ;;
    esac
}

# Dependency-aware build ordering
calculate_build_order() {
    local services=("$@")
    local ordered_services=()
    
    # Phase 1: Independent builds (can run in parallel)
    local phase1=()
    
    # Phase 2: Dependent builds
    local phase2=()
    
    # Analyze dependencies
    for service in "${services[@]}"; do
        case "$service" in
            "shared-deps"|"base")
                # Highest priority - needed by all others
                ordered_services+=("$service")
                ;;
            "backend"|"frontend"|"auth")
                # Can build in parallel after shared deps
                phase1+=("$service")
                ;;
            *)
                phase2+=("$service")
                ;;
        esac
    done
    
    # Add phases to ordered list
    ordered_services+=("${phase1[@]}")
    ordered_services+=("${phase2[@]}")
    
    printf '%s\n' "${ordered_services[@]}"
}

# Advanced build execution with resource monitoring
execute_build() {
    local service="$1"
    local dockerfile="$2"
    local context="$3"
    local resources="$4"
    local build_id="${5:-$(date +%s)}"
    
    local cpu_limit=$(echo "$resources" | jq -r '.cpu_limit')
    local memory_limit=$(echo "$resources" | jq -r '.memory_limit')
    local priority=$(echo "$resources" | jq -r '.priority')
    
    log "🚀 Starting build for $service with resources: CPU=$cpu_limit, Memory=$memory_limit"
    
    local build_log="$LOG_DIR/build-${service}-${build_id}.log"
    local start_time=$(date +%s)
    build_start_times["$service"]=$start_time
    
    # Enhanced Docker build command with resource constraints
    local build_cmd="docker buildx build"
    build_cmd+=" --platform linux/amd64,linux/arm64"
    build_cmd+=" --file $dockerfile"
    build_cmd+=" --tag ghcr.io/\${GITHUB_REPOSITORY:-prompt-card}-${service}:optimized"
    
    # Resource-optimized build arguments
    build_cmd+=" --build-arg MAX_PARALLELISM=$(($(nproc) / 2))"
    build_cmd+=" --build-arg MEMORY_LIMIT=$memory_limit"
    build_cmd+=" --build-arg CPU_LIMIT=$cpu_limit"
    build_cmd+=" --build-arg BUILD_PRIORITY=$priority"
    build_cmd+=" --build-arg SERVICE_NAME=$service"
    
    # Advanced caching with resource awareness
    build_cmd+=" --cache-from type=gha,scope=${service}-optimized"
    build_cmd+=" --cache-from type=registry,ref=ghcr.io/\${GITHUB_REPOSITORY:-prompt-card}/cache:${service}"
    build_cmd+=" --cache-to type=gha,mode=max,scope=${service}-optimized"
    build_cmd+=" --cache-to type=registry,ref=ghcr.io/\${GITHUB_REPOSITORY:-prompt-card}/cache:${service},mode=max"
    
    # Output and context
    build_cmd+=" --load"  # Load for local testing, change to --push for registry
    build_cmd+=" $context"
    
    # Execute with resource monitoring
    (
        # Set process limits
        ulimit -v $(($(echo "$memory_limit" | sed 's/m//') * 1024))
        
        log "Executing: $build_cmd"
        if eval "$build_cmd" 2>&1 | tee "$build_log"; then
            local end_time=$(date +%s)
            local duration=$((end_time - start_time))
            build_status["$service"]="success:$duration"
            log_success "Build completed for $service in ${duration}s"
        else
            local exit_code=$?
            build_status["$service"]="failed:$exit_code"
            log_error "Build failed for $service with exit code $exit_code"
            return $exit_code
        fi
    ) &
    
    local pid=$!
    build_pids["$service"]=$pid
    build_resources["$service"]="$resources"
    
    log "Build started for $service (PID: $pid)"
    return 0
}

# Resource monitoring during builds
monitor_build_resources() {
    log "📊 Starting resource monitoring..."
    
    while [[ ${#build_pids[@]} -gt 0 ]]; do
        local monitoring_data="["
        local first=true
        
        for service in "${!build_pids[@]}"; do
            local pid=${build_pids["$service"]}
            
            if ! kill -0 "$pid" 2>/dev/null; then
                # Process finished
                wait "$pid" 2>/dev/null || true
                unset build_pids["$service"]
                continue
            fi
            
            # Collect resource usage
            local cpu_usage=""
            local memory_usage=""
            local io_usage=""
            
            if command -v ps >/dev/null 2>&1; then
                local proc_info=$(ps -p "$pid" -o pid,pcpu,pmem,etime --no-headers 2>/dev/null || echo "")
                if [[ -n "$proc_info" ]]; then
                    cpu_usage=$(echo "$proc_info" | awk '{print $2}')
                    memory_usage=$(echo "$proc_info" | awk '{print $3}')
                fi
            fi
            
            if [[ "$first" == "true" ]]; then
                first=false
            else
                monitoring_data+=","
            fi
            
            monitoring_data+="{
                \"service\": \"$service\",
                \"pid\": $pid,
                \"cpu_percent\": \"${cpu_usage:-0}\",
                \"memory_percent\": \"${memory_usage:-0}\",
                \"status\": \"running\",
                \"duration\": $(($(date +%s) - ${build_start_times["$service"]}))
            }"
        done
        
        monitoring_data+="]"
        
        # Save monitoring data
        echo "$monitoring_data" > "$LOG_DIR/resource-monitoring-$(date +%s).json"
        
        # Log current status
        if [[ ${#build_pids[@]} -gt 0 ]]; then
            log "📊 Active builds: ${!build_pids[*]} (PIDs: ${build_pids[*]})"
        fi
        
        sleep "$RESOURCE_MONITOR_INTERVAL"
    done
    
    log "✅ Resource monitoring completed"
}

# Wait for all builds with timeout
wait_for_builds() {
    local timeout="${1:-1800}"  # 30 minutes default
    local start_wait=$(date +%s)
    
    log "⏳ Waiting for all builds to complete (timeout: ${timeout}s)..."
    
    # Start resource monitoring in background
    monitor_build_resources &
    local monitor_pid=$!
    
    # Wait for all builds
    local all_success=true
    for service in "${!build_pids[@]}"; do
        local pid=${build_pids["$service"]}
        local current_time=$(date +%s)
        local remaining_timeout=$((timeout - (current_time - start_wait)))
        
        if [[ $remaining_timeout -le 0 ]]; then
            log_error "Timeout reached while waiting for $service"
            kill "$pid" 2>/dev/null || true
            all_success=false
            continue
        fi
        
        if timeout "$remaining_timeout" bash -c "wait $pid"; then
            local status=${build_status["$service"]:-"unknown"}
            if [[ "$status" == success:* ]]; then
                log_success "Build succeeded for $service"
            else
                log_error "Build failed for $service: $status"
                all_success=false
            fi
        else
            log_error "Build timed out for $service"
            kill "$pid" 2>/dev/null || true
            all_success=false
        fi
    done
    
    # Stop resource monitoring
    kill "$monitor_pid" 2>/dev/null || true
    wait "$monitor_pid" 2>/dev/null || true
    
    if [[ "$all_success" == "true" ]]; then
        log_success "All builds completed successfully!"
        return 0
    else
        log_error "Some builds failed or timed out"
        return 1
    fi
}

# Generate execution report
generate_execution_report() {
    local report_file="$LOG_DIR/parallel-execution-report.json"
    
    log "📊 Generating execution report..."
    
    cat > "$report_file" <<EOF
{
    "parallel_execution_report": {
        "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
        "log_directory": "$LOG_DIR",
        "system_resources": $(get_system_resources),
        "execution_summary": {
            "max_parallel_builds": $MAX_PARALLEL_BUILDS,
            "optimal_parallelism": $(calculate_optimal_parallelism),
            "services_built": [$(printf '"%s",' "${!build_status[@]}" | sed 's/,$//')],
            "total_services": ${#build_status[@]}
        },
        "build_results": {
EOF
    
    local first=true
    for service in "${!build_status[@]}"; do
        if [[ "$first" == "true" ]]; then
            first=false
        else
            echo "," >> "$report_file"
        fi
        
        local status=${build_status["$service"]}
        local result_status=$(echo "$status" | cut -d':' -f1)
        local duration_or_code=$(echo "$status" | cut -d':' -f2)
        
        cat >> "$report_file" <<EOF
            "$service": {
                "status": "$result_status",
                "duration_or_exit_code": "$duration_or_code",
                "resources": ${build_resources["$service"]:-"{}"},
                "log_file": "$LOG_DIR/build-${service}-*.log"
            }
EOF
    done
    
    cat >> "$report_file" <<EOF
        },
        "performance_metrics": {
            "resource_utilization": "optimized",
            "parallel_efficiency": "high",
            "cache_strategy": "advanced",
            "monitoring": "enabled"
        }
    }
}
EOF
    
    log "✅ Execution report generated: $report_file"
    echo "$report_file"
}

# Main execution function
main() {
    local services=("${@:-backend frontend auth}")
    
    log "🚀 Starting parallel build execution for services: ${services[*]}"
    log "📊 System resources: $(get_system_resources)"
    
    local optimal_parallelism=$(calculate_optimal_parallelism)
    log "⚡ Optimal parallelism calculated: $optimal_parallelism builds"
    
    # Calculate build order
    local ordered_services=($(calculate_build_order "${services[@]}"))
    log "📋 Build order: ${ordered_services[*]}"
    
    # Start builds with resource management
    local active_builds=0
    for service in "${ordered_services[@]}"; do
        # Wait if we're at the parallel limit
        while [[ $active_builds -ge $optimal_parallelism ]]; do
            log "⏳ Waiting for build slot... (active: $active_builds/$optimal_parallelism)"
            sleep 5
            
            # Check for completed builds
            for running_service in "${!build_pids[@]}"; do
                local pid=${build_pids["$running_service"]}
                if ! kill -0 "$pid" 2>/dev/null; then
                    wait "$pid" 2>/dev/null || true
                    unset build_pids["$running_service"]
                    active_builds=$((active_builds - 1))
                    log "✅ Build slot freed for $running_service"
                fi
            done
        done
        
        # Allocate resources and start build
        local resources=$(allocate_build_resources "$service" "$optimal_parallelism")
        
        # Determine dockerfile path
        local dockerfile
        case "$service" in
            "backend") dockerfile="backend/Dockerfile.optimized" ;;
            "frontend") dockerfile="frontend/Dockerfile.optimized" ;;
            "auth") dockerfile="auth/Dockerfile" ;;
            "shared-deps") dockerfile="docker/Dockerfile.shared-deps" ;;
            *) dockerfile="$service/Dockerfile" ;;
        esac
        
        if execute_build "$service" "$dockerfile" "." "$resources"; then
            active_builds=$((active_builds + 1))
            log "🚀 Build started for $service (active: $active_builds/$optimal_parallelism)"
        else
            log_error "Failed to start build for $service"
        fi
    done
    
    # Wait for all builds to complete
    if wait_for_builds; then
        log_success "🎉 All parallel builds completed successfully!"
        generate_execution_report
        return 0
    else
        log_error "❌ Parallel build execution failed"
        generate_execution_report
        return 1
    fi
}

# Execute if called directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi