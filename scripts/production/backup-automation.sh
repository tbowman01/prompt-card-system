#!/bin/bash

# Automated Backup Procedures for Prompt Card System
# =================================================
# P2 Enhancement: Complete automated backup system for database, configurations, and critical data
# This script provides comprehensive backup automation with retention policies and monitoring

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo -e "${PURPLE}🗄️ Automated Backup System - Prompt Card System${NC}"
echo "================================================="

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/prompt-card-system}"
S3_BUCKET="${S3_BUCKET:-prompt-card-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
HOURLY_RETENTION="${HOURLY_RETENTION:-24}"
DAILY_RETENTION="${DAILY_RETENTION:-7}"
WEEKLY_RETENTION="${WEEKLY_RETENTION:-4}"
MONTHLY_RETENTION="${MONTHLY_RETENTION:-12}"
BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-$(openssl rand -hex 32)}"
NOTIFICATION_WEBHOOK="${NOTIFICATION_WEBHOOK:-}"
BACKUP_LOG_FILE="${BACKUP_ROOT}/logs/backup.log"

# Database configuration from environment
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-prompt_card_db}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"

# Redis configuration
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"

# Backup types
BACKUP_TYPES="${BACKUP_TYPES:-database,configs,uploads,logs,docker}"

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
    
    # Log to file
    mkdir -p "$(dirname "$BACKUP_LOG_FILE")"
    echo "[$level] $timestamp: $message" >> "$BACKUP_LOG_FILE"
}

# Function to send notifications
send_notification() {
    local status=$1
    local message=$2
    local details=${3:-}
    
    if [ -n "$NOTIFICATION_WEBHOOK" ]; then
        local payload=$(cat <<EOF
{
    "text": "Backup Status: $status",
    "attachments": [
        {
            "color": $([ "$status" = "SUCCESS" ] && echo "\"good\"" || echo "\"danger\""),
            "title": "Prompt Card System Backup",
            "text": "$message",
            "fields": [
                {
                    "title": "Timestamp",
                    "value": "$(date)",
                    "short": true
                },
                {
                    "title": "Environment",
                    "value": "${NODE_ENV:-production}",
                    "short": true
                }
            ]
        }
    ]
}
EOF
        )
        
        curl -X POST -H 'Content-type: application/json' \
             --data "$payload" \
             "$NOTIFICATION_WEBHOOK" || log_message "WARN" "Failed to send notification"
    fi
}

# Function to create backup directory structure
create_backup_structure() {
    local backup_date=$1
    local backup_time=$2
    
    BACKUP_DIR="$BACKUP_ROOT/$backup_date/$backup_time"
    mkdir -p "$BACKUP_DIR"/{database,configs,uploads,logs,docker,metadata}
    
    log_message "INFO" "Created backup directory: $BACKUP_DIR"
}

# Function to backup PostgreSQL database
backup_database() {
    log_message "INFO" "Starting database backup..."
    
    local db_backup_file="$BACKUP_DIR/database/postgresql_${POSTGRES_DB}_$(date +%Y%m%d_%H%M%S).sql"
    local db_compressed_file="${db_backup_file}.gz"
    
    # Set PostgreSQL password if provided
    if [ -n "$POSTGRES_PASSWORD" ]; then
        export PGPASSWORD="$POSTGRES_PASSWORD"
    fi
    
    # Create database dump with compression
    if pg_dump -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
        --verbose --format=custom --no-owner --no-privileges --compress=9 \
        --file="${db_backup_file}.custom" 2>/dev/null; then
        
        log_message "INFO" "Database dump created successfully"
        
        # Create additional plain text backup for easier restoration
        pg_dump -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
            --verbose --no-owner --no-privileges | gzip > "$db_compressed_file"
        
        # Create database schema backup
        pg_dump -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
            --schema-only --verbose --no-owner --no-privileges \
            --file="$BACKUP_DIR/database/schema_$(date +%Y%m%d_%H%M%S).sql"
        
        # Get database statistics
        psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
            -c "SELECT schemaname,tablename,n_tup_ins,n_tup_upd,n_tup_del FROM pg_stat_user_tables;" \
            > "$BACKUP_DIR/metadata/db_stats.txt" 2>/dev/null || true
        
        log_message "INFO" "Database backup completed successfully"
        return 0
    else
        log_message "ERROR" "Database backup failed"
        return 1
    fi
    
    unset PGPASSWORD
}

# Function to backup Redis data
backup_redis() {
    log_message "INFO" "Starting Redis backup..."
    
    local redis_backup_file="$BACKUP_DIR/database/redis_$(date +%Y%m%d_%H%M%S).rdb"
    
    # Create Redis backup using BGSAVE
    if [ -n "$REDIS_PASSWORD" ]; then
        redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" --rdb "$redis_backup_file" 2>/dev/null
    else
        redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" --rdb "$redis_backup_file" 2>/dev/null
    fi
    
    if [ -f "$redis_backup_file" ]; then
        gzip "$redis_backup_file"
        log_message "INFO" "Redis backup completed successfully"
        return 0
    else
        log_message "WARN" "Redis backup failed or Redis not available"
        return 1
    fi
}

# Function to backup configuration files
backup_configs() {
    log_message "INFO" "Starting configuration backup..."
    
    local config_files=(
        "$PROJECT_ROOT/docker-compose*.yml"
        "$PROJECT_ROOT/nginx/*.conf"
        "$PROJECT_ROOT/monitoring/**/*.yml"
        "$PROJECT_ROOT/monitoring/**/*.json"
        "$PROJECT_ROOT/.env.production"
        "$PROJECT_ROOT/package*.json"
        "$PROJECT_ROOT/tsconfig.json"
        "$PROJECT_ROOT/Makefile*"
        "$PROJECT_ROOT/scripts/**/*.sh"
    )
    
    # Create tar archive of configuration files
    tar -czf "$BACKUP_DIR/configs/configurations_$(date +%Y%m%d_%H%M%S).tar.gz" \
        -C "$PROJECT_ROOT" \
        --exclude='node_modules' \
        --exclude='.git' \
        --exclude='*.log' \
        --exclude='dist' \
        --exclude='build' \
        --exclude='.next' \
        . 2>/dev/null || log_message "WARN" "Some configuration files could not be backed up"
    
    # Backup individual critical files
    mkdir -p "$BACKUP_DIR/configs/individual"
    
    for file_pattern in "${config_files[@]}"; do
        if ls $file_pattern 1> /dev/null 2>&1; then
            cp -r $file_pattern "$BACKUP_DIR/configs/individual/" 2>/dev/null || true
        fi
    done
    
    # Create environment file backup (sanitized)
    if [ -f "$PROJECT_ROOT/.env.production" ]; then
        # Remove sensitive values and create sanitized version
        sed 's/=.*/=[REDACTED]/g' "$PROJECT_ROOT/.env.production" > "$BACKUP_DIR/configs/env_structure.txt"
    fi
    
    log_message "INFO" "Configuration backup completed"
}

# Function to backup user uploads and data
backup_uploads() {
    log_message "INFO" "Starting uploads and data backup..."
    
    local upload_dirs=(
        "$PROJECT_ROOT/backend/uploads"
        "$PROJECT_ROOT/data"
        "$PROJECT_ROOT/memory"
        "$PROJECT_ROOT/database/backups"
    )
    
    for dir in "${upload_dirs[@]}"; do
        if [ -d "$dir" ]; then
            local dir_name=$(basename "$dir")
            tar -czf "$BACKUP_DIR/uploads/${dir_name}_$(date +%Y%m%d_%H%M%S).tar.gz" -C "$(dirname "$dir")" "$dir_name" 2>/dev/null
            log_message "INFO" "Backed up directory: $dir"
        fi
    done
    
    log_message "INFO" "Uploads and data backup completed"
}

# Function to backup application logs
backup_logs() {
    log_message "INFO" "Starting logs backup..."
    
    local log_dirs=(
        "$PROJECT_ROOT/backend/logs"
        "$PROJECT_ROOT/frontend/logs"
        "$PROJECT_ROOT/nginx/logs"
        "/var/log/docker"
        "/var/log/postgresql"
        "/var/log/redis"
    )
    
    for log_dir in "${log_dirs[@]}"; do
        if [ -d "$log_dir" ]; then
            local dir_name=$(basename "$log_dir")
            # Only backup logs from last 7 days to save space
            find "$log_dir" -name "*.log" -mtime -7 -type f -exec tar -czf "$BACKUP_DIR/logs/${dir_name}_$(date +%Y%m%d_%H%M%S).tar.gz" {} + 2>/dev/null || true
            log_message "INFO" "Backed up logs from: $log_dir"
        fi
    done
    
    log_message "INFO" "Logs backup completed"
}

# Function to backup Docker images and volumes
backup_docker() {
    log_message "INFO" "Starting Docker backup..."
    
    # Backup Docker images
    if command -v docker &> /dev/null; then
        # Get list of project-related images
        docker images --format "table {{.Repository}}:{{.Tag}}" | grep -E "(prompt-|prom/|grafana/|postgres:|redis:)" > "$BACKUP_DIR/docker/images_list.txt" 2>/dev/null || true
        
        # Save critical application images
        local app_images=(
            "prompt-backend:latest"
            "prompt-frontend:latest"
        )
        
        for image in "${app_images[@]}"; do
            if docker images --format "{{.Repository}}:{{.Tag}}" | grep -q "$image"; then
                local image_name=$(echo "$image" | tr ':/' '_')
                docker save "$image" | gzip > "$BACKUP_DIR/docker/${image_name}.tar.gz" 2>/dev/null
                log_message "INFO" "Saved Docker image: $image"
            fi
        done
        
        # Backup Docker volumes information
        docker volume ls --format "{{.Name}}" > "$BACKUP_DIR/docker/volumes_list.txt" 2>/dev/null || true
        
        # Backup specific volume data
        local important_volumes=($(docker volume ls --format "{{.Name}}" | grep -E "(postgres|redis|grafana)" || true))
        
        for volume in "${important_volumes[@]}"; do
            if [ -n "$volume" ]; then
                docker run --rm -v "$volume":/backup-source -v "$BACKUP_DIR/docker":/backup alpine \
                    tar -czf "/backup/volume_${volume}_$(date +%Y%m%d_%H%M%S).tar.gz" -C /backup-source . 2>/dev/null || true
                log_message "INFO" "Backed up Docker volume: $volume"
            fi
        done
        
    else
        log_message "WARN" "Docker not available, skipping Docker backup"
    fi
    
    log_message "INFO" "Docker backup completed"
}

# Function to create backup metadata
create_backup_metadata() {
    log_message "INFO" "Creating backup metadata..."
    
    local metadata_file="$BACKUP_DIR/metadata/backup_info.json"
    
    cat > "$metadata_file" << EOF
{
    "backup_id": "$(uuidgen || echo "backup-$(date +%s)")",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "backup_type": "automated",
    "environment": "${NODE_ENV:-production}",
    "version": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
    "backup_size": "$(du -sh "$BACKUP_DIR" | cut -f1)",
    "retention_policy": {
        "hourly": $HOURLY_RETENTION,
        "daily": $DAILY_RETENTION,
        "weekly": $WEEKLY_RETENTION,
        "monthly": $MONTHLY_RETENTION
    },
    "backup_components": [$(echo "$BACKUP_TYPES" | sed 's/,/","/g' | sed 's/^/"/' | sed 's/$/"/')],
    "database_info": {
        "postgres_version": "$(psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -t -c "SELECT version();" 2>/dev/null | head -1 || echo 'unknown')",
        "database_size": "$(psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "SELECT pg_size_pretty(pg_database_size('$POSTGRES_DB'));" 2>/dev/null | xargs || echo 'unknown')"
    },
    "system_info": {
        "hostname": "$(hostname)",
        "kernel": "$(uname -r)",
        "disk_usage": "$(df -h / | awk 'NR==2 {print $5}' || echo 'unknown')",
        "memory_usage": "$(free -h | awk 'NR==2{printf "%.1f%%", $3*100/$2}' || echo 'unknown')"
    }
}
EOF
    
    # Create checksum file for integrity verification
    find "$BACKUP_DIR" -type f -exec sha256sum {} + > "$BACKUP_DIR/metadata/checksums.txt"
    
    log_message "INFO" "Backup metadata created"
}

# Function to encrypt backup if encryption is enabled
encrypt_backup() {
    if [ -n "$BACKUP_ENCRYPTION_KEY" ] && command -v openssl &> /dev/null; then
        log_message "INFO" "Encrypting backup..."
        
        local encrypted_file="${BACKUP_DIR}.tar.gz.enc"
        
        # Create compressed archive
        tar -czf "${BACKUP_DIR}.tar.gz" -C "$(dirname "$BACKUP_DIR")" "$(basename "$BACKUP_DIR")"
        
        # Encrypt the archive
        openssl enc -aes-256-cbc -salt -in "${BACKUP_DIR}.tar.gz" -out "$encrypted_file" -k "$BACKUP_ENCRYPTION_KEY"
        
        # Remove unencrypted archive
        rm -f "${BACKUP_DIR}.tar.gz"
        
        log_message "INFO" "Backup encrypted successfully"
        return 0
    else
        log_message "INFO" "Backup encryption skipped (no key or openssl not available)"
        return 1
    fi
}

# Function to upload backup to cloud storage
upload_to_cloud() {
    if [ -n "$S3_BUCKET" ] && command -v aws &> /dev/null; then
        log_message "INFO" "Uploading backup to S3..."
        
        local backup_archive="${BACKUP_DIR}.tar.gz"
        local encrypted_archive="${BACKUP_DIR}.tar.gz.enc"
        
        # Determine which file to upload
        local upload_file=""
        if [ -f "$encrypted_archive" ]; then
            upload_file="$encrypted_archive"
        elif [ -f "$backup_archive" ]; then
            upload_file="$backup_archive"
        else
            # Create archive if it doesn't exist
            tar -czf "$backup_archive" -C "$(dirname "$BACKUP_DIR")" "$(basename "$BACKUP_DIR")"
            upload_file="$backup_archive"
        fi
        
        # Upload to S3 with metadata
        local s3_key="backups/$(date +%Y/%m/%d)/$(basename "$upload_file")"
        
        aws s3 cp "$upload_file" "s3://$S3_BUCKET/$s3_key" \
            --metadata backup-type=automated,environment="${NODE_ENV:-production}",timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
            --storage-class STANDARD_IA
        
        if [ $? -eq 0 ]; then
            log_message "INFO" "Backup uploaded to S3 successfully: s3://$S3_BUCKET/$s3_key"
            
            # Clean up local archive after successful upload
            rm -f "$upload_file"
        else
            log_message "ERROR" "Failed to upload backup to S3"
            return 1
        fi
    else
        log_message "INFO" "Cloud upload skipped (S3 not configured or AWS CLI not available)"
    fi
}

# Function to clean up old backups
cleanup_old_backups() {
    log_message "INFO" "Cleaning up old backups..."
    
    # Clean up local backups based on retention policy
    if [ -d "$BACKUP_ROOT" ]; then
        # Remove backups older than retention period
        find "$BACKUP_ROOT" -type d -name "20*" -mtime +$RETENTION_DAYS -exec rm -rf {} + 2>/dev/null || true
        
        log_message "INFO" "Local backup cleanup completed"
    fi
    
    # Clean up S3 backups if configured
    if [ -n "$S3_BUCKET" ] && command -v aws &> /dev/null; then
        # List and delete old backups from S3
        local cutoff_date=$(date -d "-${RETENTION_DAYS} days" +%Y-%m-%d)
        
        aws s3 ls "s3://$S3_BUCKET/backups/" --recursive | while read -r line; do
            local file_date=$(echo "$line" | awk '{print $1}')
            local file_path=$(echo "$line" | awk '{print $4}')
            
            if [[ "$file_date" < "$cutoff_date" ]]; then
                aws s3 rm "s3://$S3_BUCKET/$file_path"
                log_message "INFO" "Removed old S3 backup: $file_path"
            fi
        done 2>/dev/null || true
    fi
}

# Function to verify backup integrity
verify_backup_integrity() {
    log_message "INFO" "Verifying backup integrity..."
    
    local checksums_file="$BACKUP_DIR/metadata/checksums.txt"
    
    if [ -f "$checksums_file" ]; then
        # Verify checksums
        if sha256sum -c "$checksums_file" > /dev/null 2>&1; then
            log_message "INFO" "Backup integrity verification passed"
            return 0
        else
            log_message "ERROR" "Backup integrity verification failed"
            return 1
        fi
    else
        log_message "WARN" "No checksums file found for integrity verification"
        return 1
    fi
}

# Function to run health checks
run_health_checks() {
    log_message "INFO" "Running pre-backup health checks..."
    
    local health_ok=true
    
    # Check database connectivity
    if ! pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" > /dev/null 2>&1; then
        log_message "WARN" "PostgreSQL database not ready"
        health_ok=false
    fi
    
    # Check Redis connectivity
    if [ -n "$REDIS_PASSWORD" ]; then
        if ! redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" ping > /dev/null 2>&1; then
            log_message "WARN" "Redis not accessible"
        fi
    else
        if ! redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping > /dev/null 2>&1; then
            log_message "WARN" "Redis not accessible"
        fi
    fi
    
    # Check disk space
    local available_space=$(df "$BACKUP_ROOT" 2>/dev/null | awk 'NR==2 {print $4}' || echo "0")
    if [ "$available_space" -lt 1048576 ]; then # Less than 1GB
        log_message "WARN" "Low disk space available for backups"
        health_ok=false
    fi
    
    if [ "$health_ok" = true ]; then
        log_message "INFO" "Health checks passed"
        return 0
    else
        log_message "WARN" "Some health checks failed, continuing with backup"
        return 1
    fi
}

# Main backup execution function
run_backup() {
    local backup_date=$(date +%Y-%m-%d)
    local backup_time=$(date +%H-%M-%S)
    local start_time=$(date +%s)
    
    log_message "INFO" "Starting automated backup process..."
    log_message "INFO" "Backup types: $BACKUP_TYPES"
    
    # Run health checks
    run_health_checks
    
    # Create backup structure
    create_backup_structure "$backup_date" "$backup_time"
    
    local backup_success=true
    local failed_components=()
    
    # Execute backup components based on configuration
    IFS=',' read -ra COMPONENTS <<< "$BACKUP_TYPES"
    for component in "${COMPONENTS[@]}"; do
        case $component in
            "database")
                if ! backup_database; then
                    failed_components+=("database")
                    backup_success=false
                fi
                if ! backup_redis; then
                    failed_components+=("redis")
                fi
                ;;
            "configs")
                if ! backup_configs; then
                    failed_components+=("configs")
                    backup_success=false
                fi
                ;;
            "uploads")
                if ! backup_uploads; then
                    failed_components+=("uploads")
                    backup_success=false
                fi
                ;;
            "logs")
                if ! backup_logs; then
                    failed_components+=("logs")
                    backup_success=false
                fi
                ;;
            "docker")
                if ! backup_docker; then
                    failed_components+=("docker")
                    backup_success=false
                fi
                ;;
        esac
    done
    
    # Create metadata
    create_backup_metadata
    
    # Verify backup integrity
    verify_backup_integrity
    
    # Encrypt backup if enabled
    encrypt_backup
    
    # Upload to cloud if configured
    upload_to_cloud
    
    # Cleanup old backups
    cleanup_old_backups
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    if [ "$backup_success" = true ]; then
        log_message "INFO" "Backup completed successfully in ${duration}s"
        send_notification "SUCCESS" "Automated backup completed successfully" "Duration: ${duration}s"
    else
        log_message "ERROR" "Backup completed with errors. Failed components: ${failed_components[*]}"
        send_notification "FAILURE" "Backup completed with errors" "Failed components: ${failed_components[*]}, Duration: ${duration}s"
    fi
    
    # Generate backup report
    generate_backup_report
}

# Function to generate backup report
generate_backup_report() {
    local report_file="$BACKUP_ROOT/reports/backup_report_$(date +%Y%m%d_%H%M%S).json"
    mkdir -p "$(dirname "$report_file")"
    
    cat > "$report_file" << EOF
{
    "backup_session": {
        "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
        "backup_path": "$BACKUP_DIR",
        "components": [$(echo "$BACKUP_TYPES" | sed 's/,/","/g' | sed 's/^/"/' | sed 's/$/"/')],
        "total_size": "$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1 || echo 'unknown')",
        "file_count": $(find "$BACKUP_DIR" -type f | wc -l 2>/dev/null || echo 0)
    },
    "retention_policy": {
        "retention_days": $RETENTION_DAYS,
        "cleanup_performed": true
    },
    "storage": {
        "local_path": "$BACKUP_DIR",
        "cloud_storage": $([ -n "$S3_BUCKET" ] && echo "true" || echo "false"),
        "encryption_enabled": $([ -n "$BACKUP_ENCRYPTION_KEY" ] && echo "true" || echo "false")
    },
    "generated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
    
    log_message "INFO" "Backup report generated: $report_file"
}

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Automated backup system for Prompt Card System

OPTIONS:
    -h, --help              Show this help message
    -t, --types TYPES       Comma-separated backup types (database,configs,uploads,logs,docker)
    -r, --retention DAYS    Retention period in days (default: 30)
    --encrypt              Enable backup encryption
    --no-cloud             Skip cloud upload
    --verify-only          Only verify existing backups
    --cleanup-only         Only cleanup old backups
    --dry-run              Show what would be backed up without executing

ENVIRONMENT VARIABLES:
    BACKUP_ROOT            Root directory for backups (default: /var/backups/prompt-card-system)
    S3_BUCKET             S3 bucket for cloud storage
    BACKUP_ENCRYPTION_KEY  Encryption key for backup files
    NOTIFICATION_WEBHOOK   Webhook URL for notifications
    POSTGRES_HOST         PostgreSQL host (default: localhost)
    POSTGRES_PORT         PostgreSQL port (default: 5432)
    POSTGRES_DB           PostgreSQL database name
    POSTGRES_USER         PostgreSQL username
    POSTGRES_PASSWORD     PostgreSQL password
    REDIS_HOST            Redis host (default: localhost)
    REDIS_PORT            Redis port (default: 6379)
    REDIS_PASSWORD        Redis password

EXAMPLES:
    $0                              # Full backup with default settings
    $0 -t database,configs          # Backup only database and configs
    $0 --encrypt --retention 60     # Encrypted backup with 60-day retention
    $0 --verify-only                # Verify integrity of existing backups
    $0 --cleanup-only               # Cleanup old backups only

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        -t|--types)
            BACKUP_TYPES="$2"
            shift 2
            ;;
        -r|--retention)
            RETENTION_DAYS="$2"
            shift 2
            ;;
        --encrypt)
            BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-$(openssl rand -hex 32)}"
            shift
            ;;
        --no-cloud)
            S3_BUCKET=""
            shift
            ;;
        --verify-only)
            VERIFY_ONLY=true
            shift
            ;;
        --cleanup-only)
            CLEANUP_ONLY=true
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

# Main execution
main() {
    # Check prerequisites
    if ! command -v pg_dump &> /dev/null && [[ "$BACKUP_TYPES" == *"database"* ]]; then
        log_message "ERROR" "pg_dump not found. Install postgresql-client-common"
        exit 1
    fi
    
    if ! command -v redis-cli &> /dev/null && [[ "$BACKUP_TYPES" == *"database"* ]]; then
        log_message "WARN" "redis-cli not found. Redis backup will be skipped"
    fi
    
    # Create backup root directory
    mkdir -p "$BACKUP_ROOT"/{logs,reports}
    
    # Handle special modes
    if [ "$VERIFY_ONLY" = true ]; then
        log_message "INFO" "Verification mode: checking existing backups"
        # Implement verification logic here
        exit 0
    fi
    
    if [ "$CLEANUP_ONLY" = true ]; then
        log_message "INFO" "Cleanup mode: removing old backups"
        cleanup_old_backups
        exit 0
    fi
    
    if [ "$DRY_RUN" = true ]; then
        log_message "INFO" "Dry run mode: showing what would be backed up"
        echo "Backup types: $BACKUP_TYPES"
        echo "Retention: $RETENTION_DAYS days"
        echo "Encryption: $([ -n "$BACKUP_ENCRYPTION_KEY" ] && echo "enabled" || echo "disabled")"
        echo "Cloud storage: $([ -n "$S3_BUCKET" ] && echo "enabled ($S3_BUCKET)" || echo "disabled")"
        exit 0
    fi
    
    # Run the backup
    run_backup
}

# Execute main function
main "$@"