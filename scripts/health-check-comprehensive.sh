#!/bin/bash

# Comprehensive Health Check Script for All Services
# This script provides detailed health monitoring for the entire prompt card system

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Service URLs and configuration
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"
OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"
REDIS_URL="${REDIS_URL:-localhost:6379}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3002}"

# Counters for summary
TOTAL_SERVICES=0
HEALTHY_SERVICES=0
DEGRADED_SERVICES=0
UNHEALTHY_SERVICES=0

# Configuration
TIMEOUT=10
DETAILED=${1:-false}
OUTPUT_FORMAT=${2:-"console"} # console, json, or summary

echo -e "${CYAN}🏥 Comprehensive Prompt Card System Health Check${NC}"
echo -e "${CYAN}=================================================${NC}"
echo ""
echo -e "${BLUE}📊 Configuration:${NC}"
echo -e "  • Timeout: ${TIMEOUT}s"
echo -e "  • Detailed: ${DETAILED}"
echo -e "  • Output Format: ${OUTPUT_FORMAT}"
echo ""

# Function to log results
log_result() {
    local service=$1
    local status=$2
    local message=$3
    local details=${4:-""}
    
    TOTAL_SERVICES=$((TOTAL_SERVICES + 1))
    
    case $status in
        "healthy")
            HEALTHY_SERVICES=$((HEALTHY_SERVICES + 1))
            echo -e "  ${GREEN}✓ ${service}${NC}: ${message}"
            ;;
        "degraded")
            DEGRADED_SERVICES=$((DEGRADED_SERVICES + 1))
            echo -e "  ${YELLOW}⚠ ${service}${NC}: ${message}"
            ;;
        "unhealthy")
            UNHEALTHY_SERVICES=$((UNHEALTHY_SERVICES + 1))
            echo -e "  ${RED}✗ ${service}${NC}: ${message}"
            ;;
    esac
    
    if [ "$DETAILED" = "true" ] && [ -n "$details" ]; then
        echo -e "    ${details}"
    fi
}

# Function to check HTTP endpoint with enhanced validation
check_http_endpoint() {
    local name=$1
    local url=$2
    local expected_status=${3:-200}
    local validation_path=${4:-""}
    
    local start_time=$(date +%s%3N)
    
    if response=$(curl -s -o /tmp/health_response -w "%{http_code}" --connect-timeout $TIMEOUT --max-time $TIMEOUT "$url" 2>/dev/null); then
        local end_time=$(date +%s%3N)
        local response_time=$((end_time - start_time))
        
        if [ "$response" = "$expected_status" ]; then
            local details=""
            if [ -n "$validation_path" ] && [ -f /tmp/health_response ]; then
                if command -v jq &> /dev/null; then
                    local json_status=$(jq -r "$validation_path" /tmp/health_response 2>/dev/null || echo "unknown")
                    details="Response time: ${response_time}ms, Status: ${json_status}"
                else
                    details="Response time: ${response_time}ms"
                fi
            else
                details="Response time: ${response_time}ms"
            fi
            
            if [ $response_time -gt 5000 ]; then
                log_result "$name" "degraded" "Slow response (HTTP $response)" "$details"
            else
                log_result "$name" "healthy" "HTTP $response" "$details"
            fi
        else
            log_result "$name" "degraded" "HTTP $response (expected $expected_status)"
        fi
    else
        log_result "$name" "unhealthy" "Connection failed"
    fi
    
    # Clean up temp file
    rm -f /tmp/health_response
}

# Function to check Redis with enhanced validation
check_redis() {
    echo -e "${BLUE}🔍 Checking Redis...${NC}"
    
    if command -v redis-cli &> /dev/null; then
        local start_time=$(date +%s%3N)
        if ping_result=$(redis-cli -h "${REDIS_URL%:*}" -p "${REDIS_URL#*:}" ping 2>/dev/null); then
            local end_time=$(date +%s%3N)
            local response_time=$((end_time - start_time))
            
            if [ "$ping_result" = "PONG" ]; then
                # Get additional Redis info
                local info=""
                if [ "$DETAILED" = "true" ]; then
                    local redis_info=$(redis-cli -h "${REDIS_URL%:*}" -p "${REDIS_URL#*:}" info server 2>/dev/null | grep redis_version | cut -d: -f2 | tr -d '\r')
                    local connected_clients=$(redis-cli -h "${REDIS_URL%:*}" -p "${REDIS_URL#*:}" info clients 2>/dev/null | grep connected_clients | cut -d: -f2 | tr -d '\r')
                    info="Version: ${redis_info}, Clients: ${connected_clients}, Response time: ${response_time}ms"
                else
                    info="Response time: ${response_time}ms"
                fi
                log_result "Redis" "healthy" "PONG received" "$info"
            else
                log_result "Redis" "degraded" "Unexpected response: $ping_result"
            fi
        else
            log_result "Redis" "unhealthy" "Connection failed"
        fi
    else
        log_result "Redis" "degraded" "redis-cli not available for testing"
    fi
}

# Function to check Docker containers
check_docker_containers() {
    if command -v docker &> /dev/null; then
        echo -e "${BLUE}🐳 Checking Docker Containers...${NC}"
        
        # Get container status
        local containers=$(docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" --filter "name=prompt-card" 2>/dev/null || echo "")
        
        if [ -n "$containers" ]; then
            echo -e "  ${CYAN}Docker Container Status:${NC}"
            echo "$containers" | while IFS=$'\t' read -r name status ports; do
                if [ "$name" != "NAMES" ]; then
                    if [[ $status == *"healthy"* ]] || [[ $status == *"Up"* ]]; then
                        log_result "Container: $name" "healthy" "$status"
                    else
                        log_result "Container: $name" "unhealthy" "$status"
                    fi
                fi
            done
        else
            log_result "Docker Containers" "degraded" "No containers found or Docker not accessible"
        fi
    else
        log_result "Docker" "degraded" "Docker not available"
    fi
}

# Function to check system resources
check_system_resources() {
    echo -e "${BLUE}💻 Checking System Resources...${NC}"
    
    # Memory check
    if command -v free &> /dev/null; then
        local mem_info=$(free -m | awk 'NR==2{printf "%.1f%%", $3*100/$2}')
        local mem_percent=$(echo $mem_info | cut -d'%' -f1)
        
        if (( $(echo "$mem_percent > 90" | bc -l) )); then
            log_result "Memory Usage" "unhealthy" "${mem_info} used"
        elif (( $(echo "$mem_percent > 75" | bc -l) )); then
            log_result "Memory Usage" "degraded" "${mem_info} used"
        else
            log_result "Memory Usage" "healthy" "${mem_info} used"
        fi
    fi
    
    # Disk check
    if command -v df &> /dev/null; then
        local disk_usage=$(df / | awk 'NR==2{print $5}' | cut -d'%' -f1)
        
        if [ $disk_usage -gt 90 ]; then
            log_result "Disk Usage" "unhealthy" "${disk_usage}% used"
        elif [ $disk_usage -gt 80 ]; then
            log_result "Disk Usage" "degraded" "${disk_usage}% used"
        else
            log_result "Disk Usage" "healthy" "${disk_usage}% used"
        fi
    fi
    
    # Load average check
    if command -v uptime &> /dev/null; then
        local load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | cut -d',' -f1)
        local cpu_cores=$(nproc 2>/dev/null || echo "1")
        
        if (( $(echo "$load_avg > $cpu_cores * 2" | bc -l) )); then
            log_result "Load Average" "unhealthy" "${load_avg} (${cpu_cores} cores)"
        elif (( $(echo "$load_avg > $cpu_cores" | bc -l) )); then
            log_result "Load Average" "degraded" "${load_avg} (${cpu_cores} cores)"
        else
            log_result "Load Average" "healthy" "${load_avg} (${cpu_cores} cores)"
        fi
    fi
}

# Function to check AI models
check_ai_models() {
    echo -e "${BLUE}🤖 Checking AI Models...${NC}"
    
    if curl -s --connect-timeout $TIMEOUT "$OLLAMA_URL/api/tags" > /tmp/models_response 2>/dev/null; then
        if command -v jq &> /dev/null; then
            local model_count=$(jq '.models | length' /tmp/models_response 2>/dev/null || echo "0")
            local models=$(jq -r '.models[].name' /tmp/models_response 2>/dev/null | head -5 | tr '\n' ', ' | sed 's/,$//')
            
            if [ "$model_count" -gt 0 ]; then
                log_result "AI Models" "healthy" "$model_count models available" "Models: $models"
            else
                log_result "AI Models" "degraded" "No models found"
            fi
        else
            log_result "AI Models" "degraded" "Models endpoint accessible (jq not available for parsing)"
        fi
    else
        log_result "AI Models" "unhealthy" "Cannot access models endpoint"
    fi
    
    rm -f /tmp/models_response
}

# Main health checks
echo -e "${BLUE}🔍 Core Services Health Check${NC}"
echo ""

# Frontend
check_http_endpoint "Frontend" "$FRONTEND_URL/api/health" 200 ".status"

# Backend
check_http_endpoint "Backend (Basic)" "$BACKEND_URL/api/health" 200 ".status"
check_http_endpoint "Backend (Enhanced)" "$BACKEND_URL/api/health/v2" 200 ".status"
check_http_endpoint "Backend (Orchestrator)" "$BACKEND_URL/api/health/orchestrator/summary" 200 ".overallStatus"

# Ollama
check_http_endpoint "Ollama API" "$OLLAMA_URL/api/version" 200

# Redis
check_redis

echo ""

# AI Models
check_ai_models

echo ""

# Optional monitoring services
echo -e "${BLUE}📊 Monitoring Services (Optional)${NC}"
echo ""

check_http_endpoint "Prometheus" "$PROMETHEUS_URL/-/healthy" 200
check_http_endpoint "Grafana" "$GRAFANA_URL/api/health" 200

echo ""

# System resources
check_system_resources

echo ""

# Docker containers (if available)
if [ "$DETAILED" = "true" ]; then
    check_docker_containers
    echo ""
fi

# Enhanced backend health details
if [ "$DETAILED" = "true" ]; then
    echo -e "${BLUE}📋 Detailed Backend Health Report${NC}"
    echo ""
    if curl -s "$BACKEND_URL/api/health/v2?detailed=true" > /tmp/detailed_health 2>/dev/null; then
        if command -v jq &> /dev/null; then
            echo -e "${CYAN}Detailed Service Status:${NC}"
            jq '.' /tmp/detailed_health 2>/dev/null || cat /tmp/detailed_health
        else
            cat /tmp/detailed_health
        fi
    else
        echo "  Could not retrieve detailed health report"
    fi
    rm -f /tmp/detailed_health
    echo ""
fi

# Summary
echo -e "${CYAN}=================================${NC}"
echo -e "${BLUE}📊 Health Check Summary${NC}"
echo ""
echo -e "  Total Services Checked: ${TOTAL_SERVICES}"
echo -e "  ${GREEN}✓ Healthy: ${HEALTHY_SERVICES}${NC}"
echo -e "  ${YELLOW}⚠ Degraded: ${DEGRADED_SERVICES}${NC}"
echo -e "  ${RED}✗ Unhealthy: ${UNHEALTHY_SERVICES}${NC}"
echo ""

# Calculate health percentage
HEALTH_PERCENTAGE=$(( (HEALTHY_SERVICES * 100) / TOTAL_SERVICES ))

echo -e "Overall System Health: ${HEALTH_PERCENTAGE}%"

# Determine exit code and overall status
if [ $UNHEALTHY_SERVICES -gt 0 ]; then
    echo -e "Overall Status: ${RED}UNHEALTHY${NC}"
    exit 2
elif [ $DEGRADED_SERVICES -gt 0 ]; then
    echo -e "Overall Status: ${YELLOW}DEGRADED${NC}"
    exit 1
else
    echo -e "Overall Status: ${GREEN}HEALTHY${NC}"
    exit 0
fi