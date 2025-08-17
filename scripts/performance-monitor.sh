#!/bin/bash
# Advanced Performance Monitoring for Docker Builds
# Real-time metrics collection and optimization recommendations

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly METRICS_DIR="/tmp/build-metrics-$(date +%Y%m%d-%H%M%S)"
readonly MONITOR_INTERVAL=${MONITOR_INTERVAL:-5}
readonly ALERT_THRESHOLD_CPU=${ALERT_THRESHOLD_CPU:-80}
readonly ALERT_THRESHOLD_MEMORY=${ALERT_THRESHOLD_MEMORY:-85}
readonly ALERT_THRESHOLD_DISK=${ALERT_THRESHOLD_DISK:-90}

# Initialize metrics directory
mkdir -p "$METRICS_DIR"

# Logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

log_alert() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ALERT: $*" >&2
}

log_info() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $*"
}

# System metrics collection
collect_system_metrics() {
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    
    # CPU metrics
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    local load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | tr -d ',')
    
    # Memory metrics
    local memory_info=$(free -m)
    local total_memory=$(echo "$memory_info" | awk 'NR==2{print $2}')
    local used_memory=$(echo "$memory_info" | awk 'NR==2{print $3}')
    local available_memory=$(echo "$memory_info" | awk 'NR==2{print $7}')
    local memory_usage=$(echo "scale=1; $used_memory * 100 / $total_memory" | bc)
    
    # Disk metrics
    local disk_info=$(df -h /)
    local disk_usage=$(echo "$disk_info" | awk 'NR==2{print $5}' | tr -d '%')
    local disk_available=$(echo "$disk_info" | awk 'NR==2{print $4}')
    
    # Network metrics
    local network_rx=$(cat /proc/net/dev | grep -E 'eth0|enp|wlan' | head -1 | awk '{print $2}' || echo "0")
    local network_tx=$(cat /proc/net/dev | grep -E 'eth0|enp|wlan' | head -1 | awk '{print $10}' || echo "0")
    
    # Docker metrics
    local docker_containers=$(docker ps -q | wc -l)
    local docker_images=$(docker images -q | wc -l)
    
    # Build cache metrics
    local buildkit_cache_size="0"
    if command -v docker >/dev/null 2>&1; then
        buildkit_cache_size=$(docker system df --format "table {{.Type}}\t{{.TotalCount}}\t{{.Size}}" | grep "Build Cache" | awk '{print $3}' | sed 's/[^0-9.]//g' || echo "0")
    fi
    
    cat <<EOF
{
    "timestamp": "$timestamp",
    "system": {
        "cpu": {
            "usage_percent": ${cpu_usage:-0},
            "load_average": ${load_avg:-0}
        },
        "memory": {
            "total_mb": $total_memory,
            "used_mb": $used_memory,
            "available_mb": $available_memory,
            "usage_percent": ${memory_usage:-0}
        },
        "disk": {
            "usage_percent": $disk_usage,
            "available": "$disk_available"
        },
        "network": {
            "rx_bytes": $network_rx,
            "tx_bytes": $network_tx
        }
    },
    "docker": {
        "containers_running": $docker_containers,
        "images_total": $docker_images,
        "buildkit_cache_size": "$buildkit_cache_size"
    }
}
EOF
}

# Docker build metrics
collect_docker_build_metrics() {
    local build_containers=$(docker ps --filter "label=build=true" --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" 2>/dev/null || echo "")
    local metrics="["
    local first=true
    
    if [[ -n "$build_containers" && "$build_containers" != "NAMES	STATUS	IMAGE" ]]; then
        while IFS=$'\t' read -r name status image; do
            [[ "$name" == "NAMES" ]] && continue
            
            if [[ "$first" == "true" ]]; then
                first=false
            else
                metrics+=","
            fi
            
            # Get container stats
            local stats=$(docker stats --no-stream --format "{{.CPUPerc}},{{.MemUsage}},{{.NetIO}},{{.PIDs}}" "$name" 2>/dev/null || echo "0%,0B / 0B,0B / 0B,0")
            local cpu_percent=$(echo "$stats" | cut -d',' -f1 | tr -d '%')
            local memory_usage=$(echo "$stats" | cut -d',' -f2 | cut -d'/' -f1 | tr -d ' ')
            local network_io=$(echo "$stats" | cut -d',' -f3)
            local pids=$(echo "$stats" | cut -d',' -f4)
            
            metrics+="{
                \"container_name\": \"$name\",
                \"status\": \"$status\",
                \"image\": \"$image\",
                \"cpu_percent\": \"$cpu_percent\",
                \"memory_usage\": \"$memory_usage\",
                \"network_io\": \"$network_io\",
                \"processes\": \"$pids\"
            }"
        done <<< "$build_containers"
    fi
    
    metrics+="]"
    echo "$metrics"
}

# Cache performance metrics
collect_cache_metrics() {
    local gha_cache_size="unknown"
    local registry_cache_size="unknown"
    local local_cache_size="0"
    
    # Local cache size
    if [[ -d "/tmp/.buildx-cache" ]]; then
        local_cache_size=$(du -sh /tmp/.buildx-cache 2>/dev/null | awk '{print $1}' || echo "0")
    fi
    
    # BuildKit cache info
    local buildkit_info=""
    if command -v docker >/dev/null 2>&1; then
        buildkit_info=$(docker buildx du 2>/dev/null || echo "")
    fi
    
    cat <<EOF
{
    "cache_performance": {
        "local_cache_size": "$local_cache_size",
        "buildkit_cache_info": "$buildkit_info",
        "gha_cache_size": "$gha_cache_size",
        "registry_cache_size": "$registry_cache_size"
    }
}
EOF
}

# Performance analysis and recommendations
analyze_performance() {
    local metrics_file="$1"
    local cpu_usage=$(jq -r '.system.cpu.usage_percent' "$metrics_file" 2>/dev/null || echo "0")
    local memory_usage=$(jq -r '.system.memory.usage_percent' "$metrics_file" 2>/dev/null || echo "0")
    local disk_usage=$(jq -r '.system.disk.usage_percent' "$metrics_file" 2>/dev/null || echo "0")
    
    local recommendations=()
    local alerts=()
    
    # CPU analysis
    if (( $(echo "$cpu_usage > $ALERT_THRESHOLD_CPU" | bc -l 2>/dev/null || echo "0") )); then
        alerts+=("High CPU usage: ${cpu_usage}%")
        recommendations+=("Consider reducing parallel builds or optimizing build processes")
    fi
    
    # Memory analysis
    if (( $(echo "$memory_usage > $ALERT_THRESHOLD_MEMORY" | bc -l 2>/dev/null || echo "0") )); then
        alerts+=("High memory usage: ${memory_usage}%")
        recommendations+=("Reduce memory allocation per build or increase system memory")
    fi
    
    # Disk analysis
    if (( $(echo "$disk_usage > $ALERT_THRESHOLD_DISK" | bc -l 2>/dev/null || echo "0") )); then
        alerts+=("High disk usage: ${disk_usage}%")
        recommendations+=("Clean up build cache and temporary files")
    fi
    
    # Load average analysis
    local load_avg=$(jq -r '.system.cpu.load_average' "$metrics_file" 2>/dev/null || echo "0")
    local cpu_cores=$(nproc)
    if (( $(echo "$load_avg > $cpu_cores * 1.5" | bc -l 2>/dev/null || echo "0") )); then
        alerts+=("High system load: $load_avg (cores: $cpu_cores)")
        recommendations+=("Reduce concurrent operations or optimize resource allocation")
    fi
    
    # Generate analysis report
    cat <<EOF
{
    "performance_analysis": {
        "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
        "status": "$([ ${#alerts[@]} -eq 0 ] && echo "healthy" || echo "needs_attention")",
        "alerts": [$(printf '"%s",' "${alerts[@]}" | sed 's/,$//')],
        "recommendations": [$(printf '"%s",' "${recommendations[@]}" | sed 's/,$//')],
        "metrics_summary": {
            "cpu_usage": "${cpu_usage}%",
            "memory_usage": "${memory_usage}%",
            "disk_usage": "${disk_usage}%",
            "load_average": "$load_avg"
        }
    }
}
EOF
}

# Real-time monitoring dashboard
start_monitoring() {
    local duration="${1:-300}"  # 5 minutes default
    local end_time=$(($(date +%s) + duration))
    
    log_info "🔍 Starting performance monitoring for ${duration}s..."
    
    while [[ $(date +%s) -lt $end_time ]]; do
        local current_time=$(date +%s)
        local metrics_file="$METRICS_DIR/metrics-$current_time.json"
        
        # Collect all metrics
        {
            echo "{"
            echo "\"system_metrics\": $(collect_system_metrics),"
            echo "\"docker_builds\": $(collect_docker_build_metrics),"
            echo "\"cache_metrics\": $(collect_cache_metrics)"
            echo "}"
        } > "$metrics_file"
        
        # Analyze performance
        local analysis=$(analyze_performance "$metrics_file")
        echo "$analysis" > "$METRICS_DIR/analysis-$current_time.json"
        
        # Check for alerts
        local alerts=$(echo "$analysis" | jq -r '.performance_analysis.alerts[]' 2>/dev/null || echo "")
        if [[ -n "$alerts" ]]; then
            while IFS= read -r alert; do
                [[ -n "$alert" ]] && log_alert "$alert"
            done <<< "$alerts"
        fi
        
        # Log current status
        local cpu=$(echo "$analysis" | jq -r '.performance_analysis.metrics_summary.cpu_usage' 2>/dev/null || echo "unknown")
        local memory=$(echo "$analysis" | jq -r '.performance_analysis.metrics_summary.memory_usage' 2>/dev/null || echo "unknown")
        local disk=$(echo "$analysis" | jq -r '.performance_analysis.metrics_summary.disk_usage' 2>/dev/null || echo "unknown")
        
        log_info "📊 CPU: $cpu | Memory: $memory | Disk: $disk"
        
        sleep "$MONITOR_INTERVAL"
    done
    
    log_info "✅ Monitoring completed"
    generate_final_report
}

# Generate comprehensive monitoring report
generate_final_report() {
    local report_file="$METRICS_DIR/performance-report.json"
    local summary_file="$METRICS_DIR/performance-summary.md"
    
    log_info "📊 Generating performance report..."
    
    # Aggregate metrics
    local total_metrics=$(ls "$METRICS_DIR"/metrics-*.json 2>/dev/null | wc -l)
    local total_alerts=$(ls "$METRICS_DIR"/analysis-*.json 2>/dev/null | xargs cat | jq -r '.performance_analysis.alerts[]' 2>/dev/null | wc -l)
    
    # Calculate averages
    local avg_cpu="0"
    local avg_memory="0"
    local avg_disk="0"
    
    if [[ $total_metrics -gt 0 ]] && command -v jq >/dev/null 2>&1; then
        avg_cpu=$(ls "$METRICS_DIR"/metrics-*.json | xargs cat | jq -r '.system_metrics.system.cpu.usage_percent' 2>/dev/null | awk '{sum+=$1} END {print sum/NR}' || echo "0")
        avg_memory=$(ls "$METRICS_DIR"/metrics-*.json | xargs cat | jq -r '.system_metrics.system.memory.usage_percent' 2>/dev/null | awk '{sum+=$1} END {print sum/NR}' || echo "0")
        avg_disk=$(ls "$METRICS_DIR"/metrics-*.json | xargs cat | jq -r '.system_metrics.system.disk.usage_percent' 2>/dev/null | awk '{sum+=$1} END {print sum/NR}' || echo "0")
    fi
    
    # Generate JSON report
    cat > "$report_file" <<EOF
{
    "performance_monitoring_report": {
        "generated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
        "monitoring_duration": "$(($(date +%s) - $(basename "$METRICS_DIR" | cut -d'-' -f3- | tr '-' ' ' | xargs -I {} date -d "{}" +%s 2>/dev/null || echo "0")))s",
        "metrics_directory": "$METRICS_DIR",
        "summary": {
            "total_metrics_collected": $total_metrics,
            "total_alerts_generated": $total_alerts,
            "average_cpu_usage": "${avg_cpu}%",
            "average_memory_usage": "${avg_memory}%",
            "average_disk_usage": "${avg_disk}%"
        },
        "performance_rating": "$(if (( $(echo "$avg_cpu < 70 && $avg_memory < 80 && $total_alerts < 5" | bc -l 2>/dev/null || echo "0") )); then echo "excellent"; elif (( $(echo "$avg_cpu < 85 && $avg_memory < 90 && $total_alerts < 10" | bc -l 2>/dev/null || echo "0") )); then echo "good"; else echo "needs_optimization"; fi)",
        "recommendations": [
            "Monitor cache hit ratios for build optimization",
            "Consider resource scaling during peak build times",
            "Implement build queue management for resource contention",
            "Regular cleanup of build artifacts and cache"
        ]
    }
}
EOF
    
    # Generate Markdown summary
    cat > "$summary_file" <<EOF
# 📊 Docker Build Performance Monitoring Report

**Generated:** $(date -u +%Y-%m-%dT%H:%M:%SZ)  
**Monitoring Duration:** $(($(date +%s) - $(basename "$METRICS_DIR" | cut -d'-' -f3- | tr '-' ' ' | xargs -I {} date -d "{}" +%s 2>/dev/null || echo "0")))s  
**Metrics Collected:** $total_metrics  

## 📈 Performance Summary

| Metric | Average Usage | Status |
|--------|---------------|--------|
| CPU | ${avg_cpu}% | $(if (( $(echo "$avg_cpu < 70" | bc -l 2>/dev/null || echo "0") )); then echo "✅ Optimal"; elif (( $(echo "$avg_cpu < 85" | bc -l 2>/dev/null || echo "0") )); then echo "⚠️ Moderate"; else echo "❌ High"; fi) |
| Memory | ${avg_memory}% | $(if (( $(echo "$avg_memory < 80" | bc -l 2>/dev/null || echo "0") )); then echo "✅ Optimal"; elif (( $(echo "$avg_memory < 90" | bc -l 2>/dev/null || echo "0") )); then echo "⚠️ Moderate"; else echo "❌ High"; fi) |
| Disk | ${avg_disk}% | $(if (( $(echo "$avg_disk < 80" | bc -l 2>/dev/null || echo "0") )); then echo "✅ Optimal"; elif (( $(echo "$avg_disk < 90" | bc -l 2>/dev/null || echo "0") )); then echo "⚠️ Moderate"; else echo "❌ High"; fi) |

## 🚨 Alerts Generated

**Total Alerts:** $total_alerts

$(if [[ $total_alerts -eq 0 ]]; then echo "✅ No performance alerts generated during monitoring period"; else echo "⚠️ Performance alerts were generated - review detailed logs for specifics"; fi)

## 🎯 Optimization Recommendations

1. **Cache Management**: Monitor build cache hit ratios and implement cache warming strategies
2. **Resource Scaling**: Consider dynamic resource allocation during peak build times
3. **Queue Management**: Implement intelligent build queue management for resource contention
4. **Cleanup Automation**: Regular automated cleanup of build artifacts and temporary files

## 📁 Files Generated

- **Detailed Report:** [performance-report.json](./performance-report.json)
- **Metrics Directory:** $METRICS_DIR
- **Raw Metrics:** metrics-*.json files
- **Analysis Data:** analysis-*.json files

---
*Generated by Docker Build Performance Monitor v2.0*
EOF
    
    log_info "✅ Performance report generated:"
    log_info "   📊 JSON Report: $report_file"
    log_info "   📝 Summary: $summary_file"
    log_info "   📁 Metrics Directory: $METRICS_DIR"
}

# Main execution
main() {
    local action="${1:-monitor}"
    local duration="${2:-300}"
    
    case "$action" in
        "monitor")
            start_monitoring "$duration"
            ;;
        "analyze")
            local metrics_file="${2:-}"
            if [[ -n "$metrics_file" && -f "$metrics_file" ]]; then
                analyze_performance "$metrics_file"
            else
                log_alert "Metrics file required for analysis"
                exit 1
            fi
            ;;
        "report")
            generate_final_report
            ;;
        *)
            echo "Usage: $0 {monitor|analyze|report} [duration|metrics_file]"
            echo "  monitor [duration]  - Start real-time monitoring (default: 300s)"
            echo "  analyze <file>      - Analyze specific metrics file"
            echo "  report              - Generate final report from existing data"
            exit 1
            ;;
    esac
}

# Execute if called directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi