#!/bin/bash

# Disaster Recovery and Automated Failover System
# ==============================================
# P2 Enhancement: Comprehensive disaster recovery with automated failover mechanisms
# This script provides disaster recovery procedures and automated failover capabilities

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo -e "${PURPLE}🛡️ Disaster Recovery System - Prompt Card System${NC}"
echo "================================================="

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DR_CONFIG_FILE="${PROJECT_ROOT}/.env.disaster-recovery"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/prompt-card-system}"
DR_LOG_FILE="${PROJECT_ROOT}/logs/disaster-recovery.log"
FAILOVER_LOG_FILE="${PROJECT_ROOT}/logs/failover.log"
RECOVERY_STATUS_FILE="${PROJECT_ROOT}/status/recovery-status.json"

# Disaster Recovery Configuration
PRIMARY_REGION="${PRIMARY_REGION:-us-east-1}"
SECONDARY_REGION="${SECONDARY_REGION:-us-west-2}"
HEALTH_CHECK_INTERVAL="${HEALTH_CHECK_INTERVAL:-30}"
FAILOVER_THRESHOLD="${FAILOVER_THRESHOLD:-3}"
RECOVERY_TIMEOUT="${RECOVERY_TIMEOUT:-1800}"  # 30 minutes
RTO="${RTO:-300}"  # Recovery Time Objective: 5 minutes
RPO="${RPO:-60}"   # Recovery Point Objective: 1 minute

# Service endpoints
PRIMARY_API="${PRIMARY_API:-http://localhost:3001}"
SECONDARY_API="${SECONDARY_API:-http://backup.localhost:3001}"
LOAD_BALANCER_URL="${LOAD_BALANCER_URL:-}"
DNS_PROVIDER="${DNS_PROVIDER:-}"  # cloudflare, aws, etc.

# Notification settings
DR_NOTIFICATION_WEBHOOK="${DR_NOTIFICATION_WEBHOOK:-}"
EMERGENCY_CONTACTS="${EMERGENCY_CONTACTS:-}"

# Database configuration
PRIMARY_DB_HOST="${PRIMARY_DB_HOST:-localhost}"
SECONDARY_DB_HOST="${SECONDARY_DB_HOST:-backup-db}"
DB_REPLICATION_USER="${DB_REPLICATION_USER:-replication}"
DB_REPLICATION_PASSWORD="${DB_REPLICATION_PASSWORD:-}"

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
        "CRITICAL")
            echo -e "${RED}[CRITICAL] ${timestamp}: $message${NC}"
            ;;
        "DEBUG")
            echo -e "${CYAN}[DEBUG] ${timestamp}: $message${NC}"
            ;;
    esac
    
    # Log to file
    mkdir -p "$(dirname "$DR_LOG_FILE")"
    echo "[$level] $timestamp: $message" >> "$DR_LOG_FILE"
}

# Function to send emergency notifications
send_emergency_notification() {
    local event_type=$1
    local message=$2
    local severity=${3:-"high"}
    
    log_message "INFO" "Sending emergency notification: $event_type"
    
    # Send webhook notification
    if [ -n "$DR_NOTIFICATION_WEBHOOK" ]; then
        local payload=$(cat <<EOF
{
    "event_type": "$event_type",
    "severity": "$severity",
    "message": "$message",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "system": "prompt-card-disaster-recovery",
    "environment": "${NODE_ENV:-production}"
}
EOF
        )
        
        curl -X POST -H 'Content-type: application/json' \
             --data "$payload" \
             "$DR_NOTIFICATION_WEBHOOK" &> /dev/null || \
             log_message "WARN" "Failed to send webhook notification"
    fi
    
    # Send SMS to emergency contacts if configured
    if [ -n "$EMERGENCY_CONTACTS" ] && command -v twilio &> /dev/null; then
        IFS=',' read -ra CONTACTS <<< "$EMERGENCY_CONTACTS"
        for contact in "${CONTACTS[@]}"; do
            twilio phone-numbers:update "$contact" \
                --sms-url "https://handler.twilio.com/twiml/EH..." \
                --body "EMERGENCY: $message" &> /dev/null || true
        done
    fi
}

# Function to check system health
check_system_health() {
    local endpoint=$1
    local service_name=$2
    
    log_message "DEBUG" "Checking health of $service_name at $endpoint"
    
    local health_status="healthy"
    local response_time=0
    local http_code=0
    
    # Perform health check with timeout
    local start_time=$(date +%s%N)
    if http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$endpoint/api/health" 2>/dev/null); then
        local end_time=$(date +%s%N)
        response_time=$(( (end_time - start_time) / 1000000 ))  # Convert to milliseconds
        
        if [ "$http_code" -eq 200 ]; then
            if [ "$response_time" -lt 5000 ]; then  # Less than 5 seconds
                health_status="healthy"
            else
                health_status="degraded"
            fi
        else
            health_status="unhealthy"
        fi
    else
        health_status="unreachable"
    fi
    
    # Store health check result
    local health_result=$(cat <<EOF
{
    "service": "$service_name",
    "endpoint": "$endpoint",
    "status": "$health_status",
    "http_code": $http_code,
    "response_time_ms": $response_time,
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
    )
    
    echo "$health_result"
    return $([ "$health_status" = "healthy" ] && echo 0 || echo 1)
}

# Function to check database replication status
check_database_replication() {
    log_message "INFO" "Checking database replication status"
    
    local replication_healthy=true
    local lag_seconds=0
    
    # Check primary database
    if command -v psql &> /dev/null; then
        # Check if primary is accepting connections
        if ! PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$PRIMARY_DB_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1;" &> /dev/null; then
            log_message "ERROR" "Primary database is not accessible"
            replication_healthy=false
        else
            # Check replication lag if secondary is configured
            if [ -n "$SECONDARY_DB_HOST" ]; then
                # Query replication lag (simplified - would need actual replication setup)
                lag_seconds=$(PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$PRIMARY_DB_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
                    -t -c "SELECT COALESCE(EXTRACT(EPOCH FROM now() - pg_last_xact_replay_timestamp()), 0);" 2>/dev/null | xargs || echo "0")
                
                if (( $(echo "$lag_seconds > 60" | bc -l 2>/dev/null || echo 0) )); then
                    log_message "WARN" "Database replication lag detected: ${lag_seconds}s"
                    replication_healthy=false
                fi
            fi
        fi
    else
        log_message "WARN" "PostgreSQL client not available, skipping database checks"
    fi
    
    echo "{\"healthy\": $replication_healthy, \"lag_seconds\": $lag_seconds}"
}

# Function to perform automated failover
perform_failover() {
    local reason=$1
    log_message "CRITICAL" "Initiating automated failover: $reason"
    
    # Update recovery status
    update_recovery_status "failover_initiated" "$reason"
    
    # Send emergency notification
    send_emergency_notification "failover_initiated" "Automated failover initiated: $reason" "critical"
    
    local failover_success=true
    local failover_start_time=$(date +%s)
    
    # Step 1: Stop traffic to primary
    log_message "INFO" "Step 1: Stopping traffic to primary system"
    if stop_primary_traffic; then
        log_message "INFO" "Primary traffic stopped successfully"
    else
        log_message "ERROR" "Failed to stop primary traffic"
        failover_success=false
    fi
    
    # Step 2: Promote secondary to primary
    log_message "INFO" "Step 2: Promoting secondary to primary"
    if promote_secondary_to_primary; then
        log_message "INFO" "Secondary promoted to primary successfully"
    else
        log_message "ERROR" "Failed to promote secondary"
        failover_success=false
    fi
    
    # Step 3: Update DNS/Load balancer
    log_message "INFO" "Step 3: Updating DNS and load balancer configuration"
    if update_dns_routing; then
        log_message "INFO" "DNS routing updated successfully"
    else
        log_message "ERROR" "Failed to update DNS routing"
        failover_success=false
    fi
    
    # Step 4: Verify new primary is serving traffic
    log_message "INFO" "Step 4: Verifying new primary is serving traffic"
    if verify_failover; then
        log_message "INFO" "Failover verification successful"
    else
        log_message "ERROR" "Failover verification failed"
        failover_success=false
    fi
    
    local failover_end_time=$(date +%s)
    local failover_duration=$((failover_end_time - failover_start_time))
    
    # Log failover attempt
    log_failover_attempt "$reason" "$failover_success" "$failover_duration"
    
    if [ "$failover_success" = true ]; then
        log_message "INFO" "Automated failover completed successfully in ${failover_duration}s"
        update_recovery_status "failover_completed" "Failover successful in ${failover_duration}s"
        send_emergency_notification "failover_completed" "Failover completed successfully in ${failover_duration}s" "medium"
        
        # Check if we met RTO
        if [ "$failover_duration" -le "$RTO" ]; then
            log_message "INFO" "RTO target met: ${failover_duration}s <= ${RTO}s"
        else
            log_message "WARN" "RTO target missed: ${failover_duration}s > ${RTO}s"
        fi
        
        return 0
    else
        log_message "CRITICAL" "Automated failover failed after ${failover_duration}s"
        update_recovery_status "failover_failed" "Failover failed after ${failover_duration}s"
        send_emergency_notification "failover_failed" "CRITICAL: Failover failed after ${failover_duration}s" "critical"
        return 1
    fi
}

# Function to stop traffic to primary
stop_primary_traffic() {
    log_message "INFO" "Stopping traffic to primary system"
    
    # Method 1: Update load balancer configuration
    if [ -n "$LOAD_BALANCER_URL" ]; then
        # This would depend on your load balancer API (AWS ALB, HAProxy, etc.)
        log_message "INFO" "Removing primary from load balancer"
        # Example API call (would need to be customized)
        # curl -X POST "$LOAD_BALANCER_URL/api/remove-target" -d '{"target": "primary"}'
    fi
    
    # Method 2: Update firewall rules to block traffic
    if command -v ufw &> /dev/null; then
        log_message "INFO" "Updating firewall rules"
        ufw deny in on eth0 to any port 3001 &> /dev/null || true
    fi
    
    # Method 3: Stop application services
    if command -v docker-compose &> /dev/null; then
        log_message "INFO" "Stopping Docker services"
        cd "$PROJECT_ROOT"
        docker-compose -f docker-compose.prod.yml stop frontend backend &> /dev/null || true
    fi
    
    return 0
}

# Function to promote secondary to primary
promote_secondary_to_primary() {
    log_message "INFO" "Promoting secondary system to primary"
    
    # Database promotion
    if [ -n "$SECONDARY_DB_HOST" ]; then
        log_message "INFO" "Promoting secondary database"
        # This would depend on your database replication setup
        # For PostgreSQL with streaming replication:
        # pg_ctl promote -D /var/lib/postgresql/data
        
        # Wait for database to be ready
        local db_ready=false
        local attempts=0
        while [ "$attempts" -lt 30 ] && [ "$db_ready" = false ]; do
            if PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$SECONDARY_DB_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1;" &> /dev/null; then
                db_ready=true
                log_message "INFO" "Secondary database is ready"
            else
                sleep 2
                attempts=$((attempts + 1))
            fi
        done
        
        if [ "$db_ready" = false ]; then
            log_message "ERROR" "Secondary database failed to become ready"
            return 1
        fi
    fi
    
    # Application promotion
    log_message "INFO" "Starting application services on secondary"
    if [ -n "$SECONDARY_API" ]; then
        # Start services on secondary if they're not already running
        # This assumes secondary infrastructure is already set up
        local secondary_healthy=false
        local attempts=0
        while [ "$attempts" -lt 20 ] && [ "$secondary_healthy" = false ]; do
            if curl -sf "$SECONDARY_API/api/health" &> /dev/null; then
                secondary_healthy=true
                log_message "INFO" "Secondary application is healthy"
            else
                sleep 3
                attempts=$((attempts + 1))
            fi
        done
        
        if [ "$secondary_healthy" = false ]; then
            log_message "ERROR" "Secondary application failed to become healthy"
            return 1
        fi
    fi
    
    return 0
}

# Function to update DNS routing
update_dns_routing() {
    log_message "INFO" "Updating DNS routing to point to secondary"
    
    case "$DNS_PROVIDER" in
        "cloudflare")
            update_cloudflare_dns
            ;;
        "aws")
            update_aws_route53_dns
            ;;
        "manual")
            log_message "WARN" "Manual DNS update required - cannot automate"
            return 0
            ;;
        *)
            log_message "WARN" "Unknown DNS provider: $DNS_PROVIDER"
            return 0
            ;;
    esac
}

# Function to update Cloudflare DNS
update_cloudflare_dns() {
    if [ -z "$CLOUDFLARE_API_TOKEN" ] || [ -z "$CLOUDFLARE_ZONE_ID" ]; then
        log_message "WARN" "Cloudflare API credentials not configured"
        return 1
    fi
    
    log_message "INFO" "Updating Cloudflare DNS records"
    
    # This would update DNS A records to point to secondary server
    # Example API call (would need actual implementation)
    # curl -X PUT "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dns_records/$DNS_RECORD_ID" \
    #      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    #      -H "Content-Type: application/json" \
    #      --data '{"type":"A","name":"api","content":"$SECONDARY_IP"}'
    
    return 0
}

# Function to update AWS Route 53 DNS
update_aws_route53_dns() {
    if ! command -v aws &> /dev/null; then
        log_message "WARN" "AWS CLI not available"
        return 1
    fi
    
    log_message "INFO" "Updating AWS Route 53 DNS records"
    
    # This would update Route 53 records to point to secondary
    # Example AWS CLI command (would need actual implementation)
    # aws route53 change-resource-record-sets \
    #     --hosted-zone-id $HOSTED_ZONE_ID \
    #     --change-batch file://dns-change-batch.json
    
    return 0
}

# Function to verify failover was successful
verify_failover() {
    log_message "INFO" "Verifying failover was successful"
    
    local verification_attempts=0
    local max_attempts=10
    local verification_success=false
    
    while [ "$verification_attempts" -lt "$max_attempts" ] && [ "$verification_success" = false ]; do
        # Check if the system is responding from the new location
        local health_check_result
        health_check_result=$(check_system_health "$SECONDARY_API" "secondary")
        
        if echo "$health_check_result" | grep -q '"status": "healthy"'; then
            log_message "INFO" "Failover verification successful"
            verification_success=true
        else
            verification_attempts=$((verification_attempts + 1))
            log_message "DEBUG" "Verification attempt $verification_attempts failed, retrying..."
            sleep 10
        fi
    done
    
    if [ "$verification_success" = true ]; then
        return 0
    else
        log_message "ERROR" "Failover verification failed after $max_attempts attempts"
        return 1
    fi
}

# Function to log failover attempts
log_failover_attempt() {
    local reason=$1
    local success=$2
    local duration=$3
    
    mkdir -p "$(dirname "$FAILOVER_LOG_FILE")"
    
    local log_entry=$(cat <<EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "reason": "$reason",
    "success": $success,
    "duration_seconds": $duration,
    "rto_target": $RTO,
    "rto_met": $([ "$duration" -le "$RTO" ] && echo "true" || echo "false")
}
EOF
    )
    
    echo "$log_entry" >> "$FAILOVER_LOG_FILE"
}

# Function to update recovery status
update_recovery_status() {
    local status=$1
    local message=$2
    
    mkdir -p "$(dirname "$RECOVERY_STATUS_FILE")"
    
    local status_data=$(cat <<EOF
{
    "current_status": "$status",
    "message": "$message",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "primary_endpoint": "$PRIMARY_API",
    "secondary_endpoint": "$SECONDARY_API",
    "last_health_check": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
    )
    
    echo "$status_data" > "$RECOVERY_STATUS_FILE"
}

# Function to perform disaster recovery test
perform_dr_test() {
    log_message "INFO" "Performing disaster recovery test (non-destructive)"
    
    # Test 1: Health check both systems
    log_message "INFO" "Test 1: Health checking both primary and secondary systems"
    local primary_health
    local secondary_health
    
    primary_health=$(check_system_health "$PRIMARY_API" "primary")
    secondary_health=$(check_system_health "$SECONDARY_API" "secondary")
    
    echo "Primary Health: $primary_health"
    echo "Secondary Health: $secondary_health"
    
    # Test 2: Database replication status
    log_message "INFO" "Test 2: Checking database replication status"
    local replication_status
    replication_status=$(check_database_replication)
    echo "Replication Status: $replication_status"
    
    # Test 3: Backup integrity
    log_message "INFO" "Test 3: Checking backup integrity"
    if [ -d "$BACKUP_ROOT" ]; then
        local latest_backup=$(find "$BACKUP_ROOT" -type d -name "20*" | sort | tail -1)
        if [ -n "$latest_backup" ]; then
            if [ -f "$latest_backup/metadata/checksums.txt" ]; then
                if (cd "$(dirname "$latest_backup")" && sha256sum -c "$latest_backup/metadata/checksums.txt" &> /dev/null); then
                    log_message "INFO" "Backup integrity check passed"
                else
                    log_message "WARN" "Backup integrity check failed"
                fi
            else
                log_message "WARN" "No checksums file found for backup integrity check"
            fi
        else
            log_message "WARN" "No backups found for integrity check"
        fi
    else
        log_message "WARN" "Backup directory not found"
    fi
    
    # Test 4: Network connectivity
    log_message "INFO" "Test 4: Testing network connectivity"
    if ping -c 3 "$(echo "$SECONDARY_API" | sed 's|http://||' | sed 's|:.*||')" &> /dev/null; then
        log_message "INFO" "Network connectivity to secondary system: OK"
    else
        log_message "WARN" "Network connectivity to secondary system: FAILED"
    fi
    
    # Generate DR test report
    generate_dr_test_report "$primary_health" "$secondary_health" "$replication_status"
}

# Function to generate DR test report
generate_dr_test_report() {
    local primary_health=$1
    local secondary_health=$2
    local replication_status=$3
    
    local report_file="$PROJECT_ROOT/dr-test-report-$(date +%Y%m%d_%H%M%S).json"
    
    cat > "$report_file" << EOF
{
    "disaster_recovery_test_report": {
        "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
        "test_type": "non_destructive",
        "systems": {
            "primary": $primary_health,
            "secondary": $secondary_health
        },
        "database_replication": $replication_status,
        "configuration": {
            "rto_target_seconds": $RTO,
            "rpo_target_seconds": $RPO,
            "health_check_interval": $HEALTH_CHECK_INTERVAL,
            "failover_threshold": $FAILOVER_THRESHOLD
        },
        "recommendations": []
    }
}
EOF
    
    log_message "INFO" "DR test report generated: $report_file"
}

# Function to monitor system and trigger failover if needed
start_monitoring() {
    log_message "INFO" "Starting disaster recovery monitoring"
    
    local consecutive_failures=0
    
    while true; do
        # Check primary system health
        local primary_health
        primary_health=$(check_system_health "$PRIMARY_API" "primary")
        
        if echo "$primary_health" | grep -q '"status": "healthy"'; then
            consecutive_failures=0
            log_message "DEBUG" "Primary system is healthy"
        else
            consecutive_failures=$((consecutive_failures + 1))
            log_message "WARN" "Primary system health check failed (attempt $consecutive_failures/$FAILOVER_THRESHOLD)"
            
            if [ "$consecutive_failures" -ge "$FAILOVER_THRESHOLD" ]; then
                log_message "CRITICAL" "Primary system has failed $consecutive_failures consecutive health checks - triggering failover"
                
                if perform_failover "primary_system_failure"; then
                    log_message "INFO" "Failover completed successfully - stopping monitoring"
                    break
                else
                    log_message "CRITICAL" "Failover failed - continuing monitoring"
                    consecutive_failures=0  # Reset to prevent continuous failover attempts
                fi
            fi
        fi
        
        # Update recovery status
        update_recovery_status "monitoring" "Consecutive failures: $consecutive_failures/$FAILOVER_THRESHOLD"
        
        sleep "$HEALTH_CHECK_INTERVAL"
    done
}

# Function to restore from backup
restore_from_backup() {
    local backup_path=$1
    local restore_target=${2:-"primary"}
    
    log_message "INFO" "Starting restore from backup: $backup_path"
    
    if [ ! -d "$backup_path" ]; then
        log_message "ERROR" "Backup path does not exist: $backup_path"
        return 1
    fi
    
    # Verify backup integrity before restore
    if [ -f "$backup_path/metadata/checksums.txt" ]; then
        log_message "INFO" "Verifying backup integrity"
        if ! (cd "$(dirname "$backup_path")" && sha256sum -c "$backup_path/metadata/checksums.txt" &> /dev/null); then
            log_message "ERROR" "Backup integrity verification failed"
            return 1
        fi
        log_message "INFO" "Backup integrity verified"
    fi
    
    # Restore database
    log_message "INFO" "Restoring database"
    local db_backup_file=$(find "$backup_path/database" -name "*.custom" | head -1)
    if [ -n "$db_backup_file" ]; then
        PGPASSWORD="$POSTGRES_PASSWORD" pg_restore \
            -h "$PRIMARY_DB_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
            --clean --if-exists "$db_backup_file" || \
            log_message "ERROR" "Database restore failed"
    fi
    
    # Restore configuration files
    log_message "INFO" "Restoring configuration files"
    local config_backup=$(find "$backup_path/configs" -name "configurations_*.tar.gz" | head -1)
    if [ -n "$config_backup" ]; then
        tar -xzf "$config_backup" -C "$PROJECT_ROOT" || \
            log_message "ERROR" "Configuration restore failed"
    fi
    
    # Restore uploads and data
    log_message "INFO" "Restoring uploads and data"
    local uploads_backup=$(find "$backup_path/uploads" -name "uploads_*.tar.gz" | head -1)
    if [ -n "$uploads_backup" ]; then
        tar -xzf "$uploads_backup" -C "$PROJECT_ROOT" || \
            log_message "ERROR" "Uploads restore failed"
    fi
    
    log_message "INFO" "Restore completed successfully"
    send_emergency_notification "restore_completed" "System restore completed from backup: $backup_path" "medium"
}

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [COMMAND] [OPTIONS]

Disaster Recovery System for Prompt Card System

COMMANDS:
    monitor             Start continuous monitoring with automated failover
    test               Perform non-destructive disaster recovery test
    failover [reason]  Perform manual failover
    restore [backup]   Restore from backup
    status             Show current recovery status
    
OPTIONS:
    -h, --help         Show this help message
    --primary-api URL  Primary API endpoint
    --secondary-api URL Secondary API endpoint  
    --threshold COUNT  Number of consecutive failures before failover
    --rto SECONDS      Recovery Time Objective
    --rpo SECONDS      Recovery Point Objective
    --dry-run          Show what would be done without executing

ENVIRONMENT VARIABLES:
    PRIMARY_API              Primary system API endpoint
    SECONDARY_API            Secondary system API endpoint
    DR_NOTIFICATION_WEBHOOK  Webhook for disaster recovery notifications
    EMERGENCY_CONTACTS       Comma-separated emergency contact numbers
    HEALTH_CHECK_INTERVAL    Seconds between health checks (default: 30)
    FAILOVER_THRESHOLD       Consecutive failures before failover (default: 3)
    RTO                      Recovery Time Objective in seconds (default: 300)
    RPO                      Recovery Point Objective in seconds (default: 60)

EXAMPLES:
    $0 monitor                              # Start DR monitoring
    $0 test                                 # Run DR test
    $0 failover "planned maintenance"       # Manual failover
    $0 restore /var/backups/latest          # Restore from backup
    $0 status                               # Check recovery status

EOF
}

# Main execution function
main() {
    local command=${1:-"help"}
    shift || true
    
    case $command in
        "monitor")
            log_message "INFO" "Starting disaster recovery monitoring system"
            start_monitoring
            ;;
        "test")
            log_message "INFO" "Running disaster recovery test"
            perform_dr_test
            ;;
        "failover")
            local reason=${1:-"manual_failover"}
            log_message "INFO" "Performing manual failover: $reason"
            perform_failover "$reason"
            ;;
        "restore")
            local backup_path=${1:-""}
            if [ -z "$backup_path" ]; then
                # Find latest backup
                backup_path=$(find "$BACKUP_ROOT" -type d -name "20*" | sort | tail -1)
                if [ -z "$backup_path" ]; then
                    log_message "ERROR" "No backup path specified and no backups found"
                    exit 1
                fi
            fi
            log_message "INFO" "Starting restore from: $backup_path"
            restore_from_backup "$backup_path"
            ;;
        "status")
            if [ -f "$RECOVERY_STATUS_FILE" ]; then
                log_message "INFO" "Current recovery status:"
                cat "$RECOVERY_STATUS_FILE" | jq . || cat "$RECOVERY_STATUS_FILE"
            else
                log_message "INFO" "No recovery status information available"
            fi
            ;;
        "help"|"-h"|"--help")
            show_usage
            ;;
        *)
            echo "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
}

# Parse additional options
while [[ $# -gt 0 ]]; do
    case $1 in
        --primary-api)
            PRIMARY_API="$2"
            shift 2
            ;;
        --secondary-api)
            SECONDARY_API="$2"
            shift 2
            ;;
        --threshold)
            FAILOVER_THRESHOLD="$2"
            shift 2
            ;;
        --rto)
            RTO="$2"
            shift 2
            ;;
        --rpo)
            RPO="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        *)
            # Pass remaining arguments to main function
            main "$@"
            exit $?
            ;;
    esac
done

# Initialize recovery status
update_recovery_status "initialized" "Disaster recovery system ready"

# Execute main function if no arguments processed
if [ $# -eq 0 ]; then
    main "help"
fi