# Backup and Restore Procedures

## 💾 Overview

This document provides comprehensive procedures for backing up and restoring the Prompt Card System, including database backups, application data, configuration files, and disaster recovery protocols.

## 🏗️ Backup Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Application   │ ──→│   Local Backup  │ ──→│  Cloud Storage  │
│      Data       │    │    Directory    │    │   (S3/GCS)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │   Compression   │    │   Encryption    │
│   + Redis       │    │   + Archive     │    │   + Retention   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Automated Backup (Recommended)
```bash
# Run full system backup
./scripts/production/backup.sh full

# Check backup status
ls -la /backups/ | grep $(date +%Y%m%d)

# Verify backup integrity
./scripts/production/backup.sh verify
```

### Manual Backup
```bash
# Database only
./scripts/production/backup.sh database

# Application data only
./scripts/production/backup.sh app

# Monitoring data
./scripts/production/backup.sh monitoring
```

## 📊 Backup Components

### 1. Database Backup (PostgreSQL)

#### Full Database Backup
```bash
# Create full database backup
pg_dump -h postgres -U $POSTGRES_USER -d $POSTGRES_DB \
  --verbose --format=custom --compress=9 \
  --file="/backups/database_$(date +%Y%m%d_%H%M%S).dump"

# Verify backup
pg_restore --list /backups/database_*.dump | head -20
```

#### Schema-Only Backup
```bash
# Backup database schema only
pg_dump -h postgres -U $POSTGRES_USER -d $POSTGRES_DB \
  --schema-only --verbose \
  --file="/backups/schema_$(date +%Y%m%d_%H%M%S).sql"
```

#### Table-Specific Backup
```bash
# Backup specific tables
pg_dump -h postgres -U $POSTGRES_USER -d $POSTGRES_DB \
  --table=prompt_cards --table=users --table=test_cases \
  --file="/backups/tables_$(date +%Y%m%d_%H%M%S).sql"
```

### 2. Redis Backup

#### RDB Snapshot Backup
```bash
# Force Redis save
docker exec prompt-redis redis-cli BGSAVE

# Wait for completion
docker exec prompt-redis redis-cli LASTSAVE

# Copy RDB file
docker cp prompt-redis:/data/dump.rdb /backups/redis_$(date +%Y%m%d_%H%M%S).rdb
```

#### Redis Configuration Backup
```bash
# Backup Redis configuration
docker exec prompt-redis cat /usr/local/etc/redis/redis.conf > /backups/redis_config_$(date +%Y%m%d).conf
```

### 3. Application Data Backup

#### Uploaded Files and Logs
```bash
# Create application data archive
tar -czf /backups/app_data_$(date +%Y%m%d_%H%M%S).tar.gz \
  --exclude='node_modules' \
  --exclude='*.log' \
  /app/uploads/ \
  /app/temp/ \
  /app/config/
```

#### Configuration Files
```bash
# Backup system configurations
tar -czf /backups/config_$(date +%Y%m%d_%H%M%S).tar.gz \
  /etc/nginx/nginx.conf \
  /etc/grafana/ \
  /etc/prometheus/ \
  docker-compose*.yml \
  .env*
```

### 4. Monitoring Data Backup

#### Prometheus Data
```bash
# Stop Prometheus temporarily
docker stop prompt-prometheus

# Create Prometheus backup
tar -czf /backups/prometheus_$(date +%Y%m%d_%H%M%S).tar.gz \
  -C /var/lib/docker/volumes/prompt-card-system_prometheus_data/_data .

# Restart Prometheus
docker start prompt-prometheus
```

#### Grafana Data
```bash
# Backup Grafana data
tar -czf /backups/grafana_$(date +%Y%m%d_%H%M%S).tar.gz \
  -C /var/lib/docker/volumes/prompt-card-system_grafana_data/_data .

# Export dashboards
curl -s -u admin:$GRAFANA_PASSWORD http://localhost:3002/api/search | \
  jq -r '.[].uri' | \
  xargs -I {} curl -s -u admin:$GRAFANA_PASSWORD http://localhost:3002/api/dashboards/{} > \
  /backups/dashboards_$(date +%Y%m%d_%H%M%S).json
```

## 🔄 Automated Backup Setup

### Backup Script Configuration
```bash
# Set environment variables
export BACKUP_DIR="/backups"
export BACKUP_RETENTION_DAYS="30"
export BACKUP_ENCRYPTION_KEY="your-encryption-key"
export AWS_S3_BUCKET="your-backup-bucket"
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK"
```

### Cron Job Setup
```bash
# Edit crontab
crontab -e

# Add backup schedules
# Full backup daily at 2 AM
0 2 * * * /path/to/prompt-card-system/scripts/production/backup.sh full >> /var/log/backup.log 2>&1

# Database backup every 6 hours
0 */6 * * * /path/to/prompt-card-system/scripts/production/backup.sh database >> /var/log/backup.log 2>&1

# Weekly monitoring data backup
0 3 * * 0 /path/to/prompt-card-system/scripts/production/backup.sh monitoring >> /var/log/backup.log 2>&1
```

### Backup Automation with systemd
```bash
# Create backup service
cat > /etc/systemd/system/prompt-backup.service << EOF
[Unit]
Description=Prompt Card System Backup
After=docker.service

[Service]
Type=oneshot
User=backup
Environment=BACKUP_DIR=/backups
ExecStart=/path/to/scripts/production/backup.sh full
StandardOutput=journal
StandardError=journal
EOF

# Create timer
cat > /etc/systemd/system/prompt-backup.timer << EOF
[Unit]
Description=Run Prompt Card System Backup Daily
Requires=prompt-backup.service

[Timer]
OnCalendar=daily
Persistent=true
RandomizedDelaySec=30min

[Install]
WantedBy=timers.target
EOF

# Enable and start timer
systemctl enable prompt-backup.timer
systemctl start prompt-backup.timer
```

## 🔧 Backup Verification

### Integrity Checks
```bash
# Verify database backup
pg_restore --list /backups/database_*.dump | wc -l

# Test restore to temporary database
createdb temp_restore_test
pg_restore -d temp_restore_test /backups/database_*.dump
psql temp_restore_test -c "SELECT count(*) FROM prompt_cards;"
dropdb temp_restore_test
```

### Archive Validation
```bash
# Check archive integrity
tar -tzf /backups/app_data_*.tar.gz > /dev/null && echo "Archive OK"

# Verify compressed files
gzip -t /backups/*.gz && echo "All compressed files OK"
```

### Cloud Backup Verification
```bash
# Verify S3 uploads
aws s3 ls s3://$AWS_S3_BUCKET/backups/$(date +%Y/%m/%d)/ --human-readable

# Check file integrity in cloud
aws s3api head-object --bucket $AWS_S3_BUCKET --key backups/$(date +%Y/%m/%d)/database_*.dump
```

## 🔄 Restore Procedures

### Database Restore

#### Full Database Restore
```bash
# Stop application services
docker-compose -f docker-compose.prod.yml stop backend frontend

# Drop existing database (CAUTION!)
docker exec prompt-postgres psql -U $POSTGRES_USER -c "DROP DATABASE IF EXISTS $POSTGRES_DB;"
docker exec prompt-postgres psql -U $POSTGRES_USER -c "CREATE DATABASE $POSTGRES_DB;"

# Restore from backup
docker exec -i prompt-postgres pg_restore -U $POSTGRES_USER -d $POSTGRES_DB --verbose < /backups/database_latest.dump

# Verify restore
docker exec prompt-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT count(*) FROM prompt_cards;"

# Start services
docker-compose -f docker-compose.prod.yml start backend frontend
```

#### Point-in-Time Recovery (if WAL is enabled)
```bash
# Stop PostgreSQL
docker stop prompt-postgres

# Replace data directory with base backup
rm -rf /var/lib/docker/volumes/prompt-card-system_postgres_data/_data/*
tar -xzf /backups/postgres_base_backup.tar.gz -C /var/lib/docker/volumes/prompt-card-system_postgres_data/_data/

# Create recovery configuration
cat > /var/lib/docker/volumes/prompt-card-system_postgres_data/_data/recovery.conf << EOF
restore_command = 'cp /backups/wal/%f %p'
recovery_target_time = '2024-01-01 14:30:00'
EOF

# Start PostgreSQL for recovery
docker start prompt-postgres
```

### Redis Restore

#### RDB File Restore
```bash
# Stop Redis
docker stop prompt-redis

# Replace RDB file
docker cp /backups/redis_latest.rdb prompt-redis:/data/dump.rdb

# Set proper permissions
docker exec prompt-redis chown redis:redis /data/dump.rdb

# Start Redis
docker start prompt-redis

# Verify data
docker exec prompt-redis redis-cli dbsize
```

### Application Data Restore

#### Files and Configuration Restore
```bash
# Stop services
docker-compose -f docker-compose.prod.yml stop

# Restore application files
tar -xzf /backups/app_data_latest.tar.gz -C /

# Restore configuration files
tar -xzf /backups/config_latest.tar.gz -C /

# Set proper permissions
chown -R www-data:www-data /app/uploads/
chmod -R 755 /app/uploads/

# Start services
docker-compose -f docker-compose.prod.yml start
```

### Monitoring Data Restore

#### Prometheus Data Restore
```bash
# Stop Prometheus
docker stop prompt-prometheus

# Clear existing data
docker volume rm prompt-card-system_prometheus_data
docker volume create prompt-card-system_prometheus_data

# Restore data
tar -xzf /backups/prometheus_latest.tar.gz -C /var/lib/docker/volumes/prompt-card-system_prometheus_data/_data/

# Start Prometheus
docker start prompt-prometheus
```

## 🚨 Disaster Recovery

### Complete System Recovery

#### Step 1: Infrastructure Setup
```bash
# Install Docker and Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Download application code
git clone https://github.com/tbowman01/prompt-card-system.git
cd prompt-card-system
```

#### Step 2: Restore from Cloud Backup
```bash
# Download latest backups from S3
aws s3 sync s3://$AWS_S3_BUCKET/backups/latest/ /backups/

# Decrypt backups if encrypted
for file in /backups/*.enc; do
  openssl enc -aes-256-cbc -d -in "$file" -out "${file%.enc}" -k "$BACKUP_ENCRYPTION_KEY"
done
```

#### Step 3: System Restore
```bash
# Start infrastructure services
docker-compose -f docker-compose.prod.yml up -d postgres redis

# Wait for services to be ready
sleep 30

# Restore database
pg_restore -h localhost -U $POSTGRES_USER -d $POSTGRES_DB /backups/database_latest.dump

# Restore Redis
docker cp /backups/redis_latest.rdb prompt-redis:/data/dump.rdb
docker restart prompt-redis

# Restore application data
tar -xzf /backups/app_data_latest.tar.gz -C /

# Start all services
docker-compose -f docker-compose.prod.yml up -d
```

### Recovery Time Objectives (RTO)

| Component | RTO Target | Procedure |
|-----------|------------|-----------|
| Database | < 30 minutes | Automated restore from latest backup |
| Application | < 15 minutes | Container restart + data restore |
| Monitoring | < 10 minutes | Volume restore + service restart |
| Full System | < 1 hour | Complete disaster recovery |

### Recovery Point Objectives (RPO)

| Component | RPO Target | Backup Frequency |
|-----------|------------|------------------|
| Database | < 1 hour | Every 30 minutes |
| Application Data | < 6 hours | Every 4 hours |
| Configuration | < 24 hours | Daily |
| Monitoring | < 24 hours | Daily |

## 📊 Backup Monitoring

### Backup Health Checks
```bash
# Check backup recency
find /backups -name "database_*.dump" -mtime +1 -ls

# Monitor backup sizes
du -sh /backups/* | sort -hr | head -10

# Check backup success
tail -100 /var/log/backup.log | grep -E "(SUCCESS|FAILURE)"
```

### Backup Metrics
```bash
# Create backup metrics for Prometheus
cat > /etc/prometheus/backup_metrics.py << 'EOF'
#!/usr/bin/env python3
import os
import time
from prometheus_client import Gauge, generate_latest, CONTENT_TYPE_LATEST
from http.server import HTTPServer, BaseHTTPRequestHandler

backup_success_time = Gauge('backup_success_timestamp_seconds', 'Last successful backup timestamp', ['backup_type'])
backup_size_bytes = Gauge('backup_size_bytes', 'Size of backup file', ['backup_type'])

class MetricsHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Update metrics
        for backup_type in ['database', 'redis', 'app_data']:
            files = [f for f in os.listdir('/backups') if f.startswith(backup_type)]
            if files:
                latest_file = max(files, key=lambda x: os.path.getmtime(f'/backups/{x}'))
                backup_success_time.labels(backup_type=backup_type).set(os.path.getmtime(f'/backups/{latest_file}'))
                backup_size_bytes.labels(backup_type=backup_type).set(os.path.getsize(f'/backups/{latest_file}'))
        
        self.send_response(200)
        self.send_header('Content-Type', CONTENT_TYPE_LATEST)
        self.end_headers()
        self.wfile.write(generate_latest())

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 8000), MetricsHandler)
    server.serve_forever()
EOF

# Make executable and start
chmod +x /etc/prometheus/backup_metrics.py
nohup python3 /etc/prometheus/backup_metrics.py &
```

## 🔒 Backup Security

### Encryption
```bash
# Encrypt backup files
openssl enc -aes-256-cbc -salt -in database_backup.sql -out database_backup.sql.enc -k "$BACKUP_ENCRYPTION_KEY"

# Decrypt when needed
openssl enc -aes-256-cbc -d -in database_backup.sql.enc -out database_backup.sql -k "$BACKUP_ENCRYPTION_KEY"
```

### Access Control
```bash
# Set secure permissions
chmod 600 /backups/*
chown backup:backup /backups/*

# Create backup user
useradd -r -s /bin/false backup
usermod -G docker backup
```

### Backup Verification
```bash
# Create checksums
sha256sum /backups/*.dump > /backups/checksums.txt

# Verify integrity
sha256sum -c /backups/checksums.txt
```

## 📋 Maintenance Procedures

### Daily Tasks
- [ ] Verify backup completion
- [ ] Check backup file sizes
- [ ] Monitor available disk space
- [ ] Review backup logs for errors

### Weekly Tasks
- [ ] Test restore procedure on staging
- [ ] Clean up old backup files
- [ ] Verify cloud backup synchronization
- [ ] Update backup documentation

### Monthly Tasks
- [ ] Full disaster recovery test
- [ ] Review backup retention policies
- [ ] Audit backup access logs
- [ ] Update backup encryption keys

---

**Last Updated**: $(date +%Y-%m-%d)  
**Review Schedule**: Monthly  
**Contact**: DevOps Team (devops@company.com)