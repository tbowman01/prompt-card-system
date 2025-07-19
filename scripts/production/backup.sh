#!/bin/bash

# Production Backup Script for Prompt Card System
# ===============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}💾 Prompt Card System - Production Backup${NC}"
echo "=========================================="

# Configuration
BACKUP_TYPE=${1:-full}
BACKUP_DIR="/backups"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Function to compress and encrypt backup
compress_and_encrypt() {
    local source_file=$1
    local target_file=$2
    
    echo -e "${YELLOW}🗜️ Compressing and encrypting backup...${NC}"
    
    if [ -n "$BACKUP_ENCRYPTION_KEY" ]; then
        gzip "$source_file" && \
        openssl enc -aes-256-cbc -salt -in "${source_file}.gz" -out "$target_file" -k "$BACKUP_ENCRYPTION_KEY" && \
        rm "${source_file}.gz"
    else
        gzip "$source_file" && \
        mv "${source_file}.gz" "$target_file"
    fi
}

# Database backup
backup_database() {
    echo -e "${BLUE}🗄️ Backing up PostgreSQL database...${NC}"
    
    local backup_file="$BACKUP_DIR/database_${TIMESTAMP}.sql"
    
    pg_dump -h postgres -U "$POSTGRES_USER" -d "$POSTGRES_DB" > "$backup_file"
    
    if [ $? -eq 0 ]; then
        compress_and_encrypt "$backup_file" "$BACKUP_DIR/database_${TIMESTAMP}.sql.gz"
        echo -e "${GREEN}✅ Database backup completed${NC}"
    else
        echo -e "${RED}❌ Database backup failed${NC}"
        exit 1
    fi
}

# Redis backup
backup_redis() {
    echo -e "${BLUE}📊 Backing up Redis data...${NC}"
    
    local backup_file="$BACKUP_DIR/redis_${TIMESTAMP}.rdb"
    
    # Get Redis RDB file
    docker cp prompt-redis:/data/dump.rdb "$backup_file"
    
    if [ $? -eq 0 ]; then
        compress_and_encrypt "$backup_file" "$BACKUP_DIR/redis_${TIMESTAMP}.rdb.gz"
        echo -e "${GREEN}✅ Redis backup completed${NC}"
    else
        echo -e "${RED}❌ Redis backup failed${NC}"
    fi
}

# Application data backup
backup_application_data() {
    echo -e "${BLUE}📁 Backing up application data...${NC}"
    
    local backup_file="$BACKUP_DIR/app_data_${TIMESTAMP}.tar"
    
    # Backup uploaded files, logs, and configurations
    tar -cf "$backup_file" \
        -C /app uploads/ logs/ \
        -C /etc/nginx nginx.conf \
        -C /etc/grafana provisioning/
    
    if [ $? -eq 0 ]; then
        compress_and_encrypt "$backup_file" "$BACKUP_DIR/app_data_${TIMESTAMP}.tar.gz"
        echo -e "${GREEN}✅ Application data backup completed${NC}"
    else
        echo -e "${RED}❌ Application data backup failed${NC}"
    fi
}

# Monitoring data backup
backup_monitoring() {
    echo -e "${BLUE}📈 Backing up monitoring data...${NC}"
    
    local backup_file="$BACKUP_DIR/monitoring_${TIMESTAMP}.tar"
    
    # Backup Prometheus and Grafana data
    tar -cf "$backup_file" \
        -C /prometheus . \
        -C /var/lib/grafana .
    
    if [ $? -eq 0 ]; then
        compress_and_encrypt "$backup_file" "$BACKUP_DIR/monitoring_${TIMESTAMP}.tar.gz"
        echo -e "${GREEN}✅ Monitoring data backup completed${NC}"
    else
        echo -e "${RED}❌ Monitoring data backup failed${NC}"
    fi
}

# Cleanup old backups
cleanup_old_backups() {
    echo -e "${BLUE}🧹 Cleaning up old backups...${NC}"
    
    find "$BACKUP_DIR" -name "*.gz" -type f -mtime +$RETENTION_DAYS -delete
    
    echo -e "${GREEN}✅ Old backups cleaned up (older than $RETENTION_DAYS days)${NC}"
}

# Upload to cloud storage (if configured)
upload_to_cloud() {
    if [ -n "$AWS_S3_BUCKET" ]; then
        echo -e "${BLUE}☁️ Uploading backups to AWS S3...${NC}"
        
        aws s3 sync "$BACKUP_DIR" "s3://$AWS_S3_BUCKET/backups/$(date +%Y/%m/%d)/" \
            --exclude "*" --include "*_${TIMESTAMP}.*.gz"
        
        echo -e "${GREEN}✅ Backups uploaded to S3${NC}"
    fi
    
    if [ -n "$GOOGLE_CLOUD_BUCKET" ]; then
        echo -e "${BLUE}☁️ Uploading backups to Google Cloud Storage...${NC}"
        
        gsutil -m cp "$BACKUP_DIR"/*_${TIMESTAMP}.*.gz \
            "gs://$GOOGLE_CLOUD_BUCKET/backups/$(date +%Y/%m/%d)/"
        
        echo -e "${GREEN}✅ Backups uploaded to Google Cloud Storage${NC}"
    fi
}

# Send notification
send_notification() {
    local status=$1
    local message=$2
    
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🛡️ Backup $status: $message\"}" \
            "$SLACK_WEBHOOK_URL"
    fi
    
    if [ -n "$SMTP_HOST" ]; then
        echo "$message" | mail -s "Backup $status - Prompt Card System" "$BACKUP_NOTIFICATION_EMAIL"
    fi
}

# Main backup execution
main() {
    echo -e "${CYAN}📋 Backup Configuration:${NC}"
    echo "   • Type: $BACKUP_TYPE"
    echo "   • Timestamp: $TIMESTAMP"
    echo "   • Retention: $RETENTION_DAYS days"
    echo "   • Directory: $BACKUP_DIR"
    echo
    
    case $BACKUP_TYPE in
        "full")
            backup_database
            backup_redis
            backup_application_data
            backup_monitoring
            ;;
        "database")
            backup_database
            ;;
        "redis")
            backup_redis
            ;;
        "app")
            backup_application_data
            ;;
        "monitoring")
            backup_monitoring
            ;;
        *)
            echo -e "${RED}❌ Invalid backup type: $BACKUP_TYPE${NC}"
            echo "Valid types: full, database, redis, app, monitoring"
            exit 1
            ;;
    esac
    
    cleanup_old_backups
    upload_to_cloud
    
    echo -e "${GREEN}🎉 Backup completed successfully!${NC}"
    send_notification "Success" "Backup completed successfully at $TIMESTAMP"
}

# Error handling
trap 'send_notification "Failed" "Backup failed at $TIMESTAMP"; exit 1' ERR

# Run main function
main