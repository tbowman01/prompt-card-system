# Production Setup Guide

## Overview

This guide covers comprehensive production deployment of the Prompt Card System, including infrastructure setup, security hardening, monitoring, and operational procedures.

## Infrastructure Requirements

### 1. Minimum System Requirements

#### Single Server Deployment
```bash
# Minimum specifications
CPU: 4 cores (8 recommended)
RAM: 8GB (16GB recommended)
Storage: 100GB SSD (500GB recommended)
Network: 1Gbps connection
OS: Ubuntu 20.04 LTS or higher
```

#### High Availability Deployment
```bash
# Load Balancer
CPU: 2 cores
RAM: 4GB
Storage: 50GB SSD

# Application Servers (2+ instances)
CPU: 4 cores each
RAM: 8GB each
Storage: 100GB SSD each

# Database Server
CPU: 8 cores
RAM: 16GB
Storage: 1TB SSD with RAID 10

# Redis Cache
CPU: 2 cores
RAM: 8GB
Storage: 50GB SSD
```

### 2. Network Architecture

#### Security Groups / Firewall Rules
```bash
# Load Balancer
Inbound:
  - Port 80 (HTTP) from 0.0.0.0/0
  - Port 443 (HTTPS) from 0.0.0.0/0
  - Port 22 (SSH) from admin IPs only

Outbound:
  - Port 3000 to application servers
  - Port 443 for external dependencies

# Application Servers
Inbound:
  - Port 3000-3002 from load balancer only
  - Port 22 (SSH) from admin IPs only

Outbound:
  - Port 5432 to database server
  - Port 6379 to Redis server
  - Port 443 for external APIs

# Database Server
Inbound:
  - Port 5432 from application servers only
  - Port 22 (SSH) from admin IPs only

Outbound:
  - Port 443 for backups/replication
```

## Production Infrastructure Setup

### 1. Server Provisioning Script
```bash
#!/bin/bash
# scripts/provision-production.sh

set -e

ENVIRONMENT=${1:-production}
SERVER_TYPE=${2:-app} # app, db, lb, cache

echo "🚀 Provisioning $SERVER_TYPE server for $ENVIRONMENT..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y \
    curl \
    wget \
    git \
    htop \
    vim \
    ufw \
    fail2ban \
    unattended-upgrades \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release

# Configure automatic security updates
echo 'Unattended-Upgrade::Automatic-Reboot "false";' | sudo tee -a /etc/apt/apt.conf.d/50unattended-upgrades
sudo systemctl enable unattended-upgrades

# Install Docker (for app servers)
if [ "$SERVER_TYPE" = "app" ] || [ "$SERVER_TYPE" = "all" ]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt update
    sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    sudo usermod -aG docker $USER
    
    # Configure Docker daemon
    sudo tee /etc/docker/daemon.json > /dev/null << EOF
{
    "log-driver": "json-file",
    "log-opts": {
        "max-size": "10m",
        "max-file": "3"
    },
    "storage-driver": "overlay2"
}
EOF
    sudo systemctl restart docker
fi

# Install PostgreSQL (for db servers)
if [ "$SERVER_TYPE" = "db" ] || [ "$SERVER_TYPE" = "all" ]; then
    sudo apt install -y postgresql-15 postgresql-contrib-15
    sudo systemctl enable postgresql
fi

# Install Redis (for cache servers)
if [ "$SERVER_TYPE" = "cache" ] || [ "$SERVER_TYPE" = "all" ]; then
    sudo apt install -y redis-server
    sudo systemctl enable redis-server
fi

# Install Nginx (for lb servers)
if [ "$SERVER_TYPE" = "lb" ] || [ "$SERVER_TYPE" = "all" ]; then
    sudo apt install -y nginx certbot python3-certbot-nginx
    sudo systemctl enable nginx
fi

# Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh

case $SERVER_TYPE in
    "app")
        sudo ufw allow 3000:3002/tcp
        ;;
    "db")
        sudo ufw allow 5432/tcp
        ;;
    "cache")
        sudo ufw allow 6379/tcp
        ;;
    "lb")
        sudo ufw allow 80/tcp
        sudo ufw allow 443/tcp
        ;;
    "all")
        sudo ufw allow 80,443,3000:3002,5432,6379/tcp
        ;;
esac

sudo ufw --force enable

# Configure fail2ban
sudo tee /etc/fail2ban/jail.local > /dev/null << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log
maxretry = 3
EOF

sudo systemctl enable fail2ban
sudo systemctl restart fail2ban

# Create application user
sudo useradd -m -s /bin/bash promptapp
sudo usermod -aG docker promptapp 2>/dev/null || true

# Create application directories
sudo mkdir -p /opt/prompt-card-system/{data,logs,backups,ssl}
sudo chown -R promptapp:promptapp /opt/prompt-card-system
sudo chmod 755 /opt/prompt-card-system
sudo chmod 750 /opt/prompt-card-system/{data,logs,backups}
sudo chmod 700 /opt/prompt-card-system/ssl

# Configure log rotation
sudo tee /etc/logrotate.d/prompt-card-system > /dev/null << EOF
/opt/prompt-card-system/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 promptapp promptapp
    postrotate
        /usr/bin/docker-compose -f /opt/prompt-card-system/docker-compose.prod.yml kill -s USR1 nginx || true
    endscript
}
EOF

echo "✅ $SERVER_TYPE server provisioning complete!"
```

### 2. SSL/TLS Configuration
```bash
#!/bin/bash
# scripts/setup-ssl.sh

DOMAIN=${1:-localhost}
EMAIL=${2:-admin@localhost}

echo "🔒 Setting up SSL for domain: $DOMAIN"

# Install certbot if not already installed
sudo apt install -y certbot python3-certbot-nginx

# Stop nginx temporarily
sudo systemctl stop nginx

# Obtain SSL certificate
sudo certbot certonly --standalone -d $DOMAIN --email $EMAIL --agree-tos --non-interactive

# Create strong DH parameters
sudo openssl dhparam -out /etc/ssl/certs/dhparam.pem 2048

# Configure SSL in nginx
sudo tee /etc/nginx/sites-available/prompt-card-system << EOF
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_dhparam /etc/ssl/certs/dhparam.pem;

    # SSL Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    # Proxy settings
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /auth/ {
        proxy_pass http://localhost:3002;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/prompt-card-system /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl start nginx

# Setup auto-renewal
echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo crontab -

echo "✅ SSL setup complete for $DOMAIN"
```

### 3. Database Production Setup
```bash
#!/bin/bash
# scripts/setup-production-database.sh

set -e

DB_NAME=${1:-promptcards}
DB_USER=${2:-promptuser}
DB_PASSWORD=${3:-$(openssl rand -base64 32)}

echo "🗄️ Setting up production database..."

# Configure PostgreSQL
sudo -u postgres createuser --createdb $DB_USER || true
sudo -u postgres createdb $DB_NAME --owner=$DB_USER || true
sudo -u postgres psql -c "ALTER USER $DB_USER PASSWORD '$DB_PASSWORD';"

# Configure PostgreSQL for production
sudo tee -a /etc/postgresql/15/main/postgresql.conf << EOF

# Production Performance Settings
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200

# Connection Settings
max_connections = 200
superuser_reserved_connections = 3

# Logging
log_destination = 'stderr'
logging_collector = on
log_directory = '/var/log/postgresql'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_file_mode = 0600
log_rotation_age = 1d
log_rotation_size = 100MB
log_min_duration_statement = 1000
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on

# WAL Settings
wal_level = replica
archive_mode = on
archive_command = 'cp %p /var/lib/postgresql/15/archive/%f'
max_wal_size = 1GB
min_wal_size = 80MB
EOF

# Configure pg_hba.conf for security
sudo cp /etc/postgresql/15/main/pg_hba.conf /etc/postgresql/15/main/pg_hba.conf.backup
sudo tee /etc/postgresql/15/main/pg_hba.conf << EOF
# TYPE  DATABASE        USER            ADDRESS                 METHOD

# "local" is for Unix domain socket connections only
local   all             postgres                                peer
local   all             all                                     peer

# IPv4 local connections:
host    all             all             127.0.0.1/32            md5
host    $DB_NAME        $DB_USER        localhost               md5

# IPv6 local connections:
host    all             all             ::1/128                 md5

# Allow replication connections
local   replication     all                                     peer
host    replication     all             127.0.0.1/32            md5
host    replication     all             ::1/128                 md5
EOF

# Create WAL archive directory
sudo mkdir -p /var/lib/postgresql/15/archive
sudo chown postgres:postgres /var/lib/postgresql/15/archive
sudo chmod 750 /var/lib/postgresql/15/archive

# Restart PostgreSQL
sudo systemctl restart postgresql

# Create database backup script
sudo tee /opt/prompt-card-system/scripts/backup-database.sh << EOF
#!/bin/bash
set -e

BACKUP_DIR="/opt/prompt-card-system/backups"
DATE=\$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="\$BACKUP_DIR/database_backup_\$DATE.sql"

mkdir -p \$BACKUP_DIR

echo "📦 Creating database backup..."
sudo -u postgres pg_dump $DB_NAME > "\$BACKUP_FILE"
gzip "\$BACKUP_FILE"

# Keep only last 7 days of backups
find \$BACKUP_DIR -name "database_backup_*.sql.gz" -mtime +7 -delete

echo "✅ Database backup complete: \${BACKUP_FILE}.gz"
EOF

chmod +x /opt/prompt-card-system/scripts/backup-database.sh

# Setup daily backup cron
echo "0 2 * * * /opt/prompt-card-system/scripts/backup-database.sh" | sudo crontab -u promptapp -

echo "✅ Production database setup complete!"
echo "Database Name: $DB_NAME"
echo "Database User: $DB_USER"
echo "Database Password: $DB_PASSWORD"
echo "Connection String: postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME"
```

## Production Docker Compose

### 1. Production Compose Configuration
```yaml
# docker-compose.production.yml
version: '3.8'

services:
  frontend:
    image: ghcr.io/tbowman01/prompt-card-system/frontend:${TAG:-latest}
    container_name: prompt-frontend-prod
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=${API_URL}
      - NEXT_TELEMETRY_DISABLED=1
    volumes:
      - frontend-cache:/app/.next/cache
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    networks:
      - app-network
    depends_on:
      backend:
        condition: service_healthy
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  backend:
    image: ghcr.io/tbowman01/prompt-card-system/backend:${TAG:-latest}
    container_name: prompt-backend-prod
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - JWT_SECRET=${JWT_SECRET}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      - LOG_LEVEL=${LOG_LEVEL:-info}
    volumes:
      - app-data:/app/data
      - app-logs:/app/logs
      - app-uploads:/app/uploads
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 15s
      retries: 3
      start_period: 90s
    networks:
      - app-network
      - db-network
    depends_on:
      database:
        condition: service_healthy
      redis:
        condition: service_healthy
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  auth:
    image: ghcr.io/tbowman01/prompt-card-system/auth:${TAG:-latest}
    container_name: prompt-auth-prod
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      - SESSION_SECRET=${SESSION_SECRET}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3002/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    networks:
      - app-network
      - db-network
    depends_on:
      database:
        condition: service_healthy
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  database:
    image: postgres:15-alpine
    container_name: prompt-database-prod
    restart: unless-stopped
    environment:
      - POSTGRES_DB=${DB_NAME}
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_INITDB_ARGS=--encoding=UTF-8 --lc-collate=en_US.UTF-8 --lc-ctype=en_US.UTF-8
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - postgres-backups:/backups
      - ./database/init:/docker-entrypoint-initdb.d:ro
      - ./database/postgresql.conf:/etc/postgresql/postgresql.conf:ro
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    networks:
      - db-network
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  redis:
    image: redis:7-alpine
    container_name: prompt-redis-prod
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD} --maxmemory 1gb --maxmemory-policy allkeys-lru
    volumes:
      - redis-data:/data
      - ./redis/redis.conf:/etc/redis/redis.conf:ro
    healthcheck:
      test: ["CMD", "redis-cli", "--no-auth-warning", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 20s
    networks:
      - app-network
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 1G
        reservations:
          cpus: '0.25'
          memory: 512M
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  nginx:
    image: nginx:alpine
    container_name: prompt-nginx-prod
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.prod.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
      - nginx-cache:/var/cache/nginx
      - nginx-logs:/var/log/nginx
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - app-network
    depends_on:
      - frontend
      - backend
      - auth
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  monitoring:
    image: prom/prometheus:latest
    container_name: prompt-monitoring-prod
    restart: unless-stopped
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--web.enable-lifecycle'
      - '--storage.tsdb.retention.time=30d'
    volumes:
      - ./monitoring/prometheus:/etc/prometheus:ro
      - prometheus-data:/prometheus
    networks:
      - monitoring-network
      - app-network
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 1G

networks:
  app-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
  db-network:
    driver: bridge
    internal: true
  monitoring-network:
    driver: bridge

volumes:
  app-data:
    driver: local
  app-logs:
    driver: local
  app-uploads:
    driver: local
  frontend-cache:
    driver: local
  postgres-data:
    driver: local
  postgres-backups:
    driver: local
  redis-data:
    driver: local
  nginx-cache:
    driver: local
  nginx-logs:
    driver: local
  prometheus-data:
    driver: local
```

### 2. Production Environment Configuration
```bash
# .env.production
# Copy this to .env and configure for your environment

# Application Settings
NODE_ENV=production
TAG=latest
API_URL=https://api.yourdomain.com
LOG_LEVEL=info

# Database Configuration
DATABASE_URL=postgresql://promptuser:CHANGE_THIS_PASSWORD@database:5432/promptcards
DB_NAME=promptcards
DB_USER=promptuser
DB_PASSWORD=CHANGE_THIS_PASSWORD

# Redis Configuration
REDIS_URL=redis://:CHANGE_THIS_PASSWORD@redis:6379/0
REDIS_PASSWORD=CHANGE_THIS_PASSWORD

# Security
JWT_SECRET=CHANGE_THIS_TO_A_SECURE_RANDOM_STRING_AT_LEAST_32_CHARS
ENCRYPTION_KEY=CHANGE_THIS_TO_A_SECURE_32_CHARACTER_KEY
SESSION_SECRET=CHANGE_THIS_TO_A_SECURE_RANDOM_STRING

# SSL/TLS
SSL_CERT_PATH=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/yourdomain.com/privkey.pem

# Monitoring
PROMETHEUS_ENABLED=true
GRAFANA_ENABLED=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=/app/uploads

# External Services
OPENAI_API_KEY=your_openai_api_key_if_needed
OLLAMA_BASE_URL=http://ollama:11434

# Email Configuration (for notifications)
SMTP_HOST=smtp.yourdomain.com
SMTP_PORT=587
SMTP_USER=noreply@yourdomain.com
SMTP_PASSWORD=your_smtp_password
FROM_EMAIL=noreply@yourdomain.com

# Backup Configuration
BACKUP_RETENTION_DAYS=30
BACKUP_SCHEDULE="0 2 * * *"
S3_BACKUP_BUCKET=your-backup-bucket
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
```

## Production Deployment Script

### 1. Complete Production Deployment
```bash
#!/bin/bash
# scripts/deploy-production.sh

set -e

DEPLOY_ENV=${1:-production}
TAG=${2:-latest}
DOMAIN=${3:-localhost}
EMAIL=${4:-admin@localhost}

echo "🚀 Deploying Prompt Card System to $DEPLOY_ENV environment..."

# Configuration
DEPLOY_DIR="/opt/prompt-card-system"
BACKUP_DIR="$DEPLOY_DIR/backups"
LOG_FILE="$DEPLOY_DIR/logs/deployment.log"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handling
handle_error() {
    log "❌ Error occurred during deployment. Check logs for details."
    exit 1
}

trap handle_error ERR

log "🚀 Starting production deployment (env: $DEPLOY_ENV, tag: $TAG)"

# Pre-deployment checks
log "🔍 Running pre-deployment checks..."

# Check Docker
if ! command -v docker &> /dev/null; then
    log "❌ Docker is not installed"
    exit 1
fi

# Check Docker Compose
if ! docker compose version &> /dev/null; then
    log "❌ Docker Compose is not available"
    exit 1
fi

# Check environment file
if [ ! -f "$DEPLOY_DIR/.env" ]; then
    log "❌ Environment file not found at $DEPLOY_DIR/.env"
    exit 1
fi

# Check SSL certificates
if [ "$DOMAIN" != "localhost" ]; then
    if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
        log "⚠️ SSL certificate not found for $DOMAIN. Setting up..."
        ./setup-ssl.sh "$DOMAIN" "$EMAIL"
    fi
fi

# Load environment variables
cd "$DEPLOY_DIR"
set -a
source .env
set +a

# Create backup before deployment
if docker compose -f docker-compose.production.yml ps | grep -q "Up"; then
    log "📦 Creating pre-deployment backup..."
    timestamp=$(date +%Y%m%d_%H%M%S)
    backup_dir="$BACKUP_DIR/pre-deployment-$timestamp"
    mkdir -p "$backup_dir"
    
    # Backup database
    docker compose -f docker-compose.production.yml exec -T database pg_dump -U "$DB_USER" "$DB_NAME" > "$backup_dir/database.sql"
    
    # Backup volumes
    docker run --rm -v prompt-card-system_app-data:/data -v "$backup_dir":/backup alpine tar czf /backup/app-data.tar.gz -C /data .
    
    log "✅ Backup created at $backup_dir"
fi

# Pull latest images
log "⬇️ Pulling latest images..."
export TAG="$TAG"
docker compose -f docker-compose.production.yml pull

# Stop services gracefully
log "🛑 Stopping services gracefully..."
if docker compose -f docker-compose.production.yml ps | grep -q "Up"; then
    docker compose -f docker-compose.production.yml down --timeout 60
fi

# Update configuration files
log "⚙️ Updating configuration files..."

# Update nginx configuration
if [ "$DOMAIN" != "localhost" ]; then
    sed -i "s/server_name _;/server_name $DOMAIN;/g" nginx/nginx.prod.conf
fi

# Start database first
log "🗄️ Starting database..."
docker compose -f docker-compose.production.yml up -d database redis

# Wait for database to be ready
log "⏳ Waiting for database to be ready..."
timeout 120 bash -c 'until docker compose -f docker-compose.production.yml exec database pg_isready -U "$DB_USER" -d "$DB_NAME"; do sleep 5; done'

# Run database migrations if needed
log "🔄 Running database migrations..."
# Add migration command here if you have them
# docker compose -f docker-compose.production.yml exec backend npm run migrate

# Start all services
log "▶️ Starting all services..."
docker compose -f docker-compose.production.yml up -d

# Wait for services to be healthy
log "🏥 Waiting for services to be healthy..."
timeout 300 bash -c 'until [ $(docker compose -f docker-compose.production.yml ps --filter "health=healthy" | wc -l) -ge 6 ]; do echo "Waiting for services to be healthy..."; sleep 10; done'

# Run health checks
log "🔍 Running post-deployment health checks..."
sleep 30

check_service() {
    local name=$1
    local url=$2
    local max_attempts=5
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -m 10 "$url" &>/dev/null; then
            log "✅ $name is healthy"
            return 0
        fi
        log "⏳ $name health check attempt $attempt/$max_attempts failed, retrying..."
        sleep 10
        ((attempt++))
    done
    
    log "❌ $name health check failed after $max_attempts attempts"
    return 1
}

check_service "Frontend" "http://localhost/health"
check_service "Backend API" "http://localhost/api/health"
check_service "Auth Service" "http://localhost/auth/health"

# Verify external access if not localhost
if [ "$DOMAIN" != "localhost" ]; then
    check_service "External HTTPS" "https://$DOMAIN/health"
fi

# Clean up old images and containers
log "🧹 Cleaning up old resources..."
docker system prune -f
docker volume prune -f

# Setup monitoring and alerting
log "📊 Setting up monitoring..."
# Start monitoring services if configured
if [ "${PROMETHEUS_ENABLED:-false}" = "true" ]; then
    docker compose -f docker-compose.production.yml up -d monitoring
fi

# Generate deployment report
log "📋 Generating deployment report..."
cat > "$DEPLOY_DIR/deployment-report.txt" << EOF
Deployment Report
================
Date: $(date)
Environment: $DEPLOY_ENV
Tag: $TAG
Domain: $DOMAIN

Services Status:
$(docker compose -f docker-compose.production.yml ps)

Resource Usage:
$(docker stats --no-stream)

Disk Usage:
$(df -h $DEPLOY_DIR)

Health Check Results:
- Frontend: ✅ Healthy
- Backend: ✅ Healthy
- Auth: ✅ Healthy
- Database: ✅ Healthy
- Redis: ✅ Healthy
- Nginx: ✅ Healthy
EOF

# Send notification (if configured)
if [ -n "${SLACK_WEBHOOK:-}" ]; then
    curl -X POST -H 'Content-type: application/json' \
        --data '{"text":"🚀 Production deployment completed successfully for '"$DOMAIN"'"}' \
        "$SLACK_WEBHOOK"
fi

log "✅ Production deployment completed successfully!"
log "🌐 Application is available at: https://$DOMAIN"
log "📊 Monitoring dashboard: https://$DOMAIN/monitoring"
log "📋 Deployment report: $DEPLOY_DIR/deployment-report.txt"

# Display final status
echo ""
echo "🎉 Deployment Summary:"
echo "====================="
echo "Environment: $DEPLOY_ENV"
echo "Version: $TAG"
echo "Domain: $DOMAIN"
echo "Status: ✅ SUCCESSFUL"
echo "Access URL: https://$DOMAIN"
echo ""
echo "Next steps:"
echo "1. Verify application functionality"
echo "2. Run integration tests"
echo "3. Monitor system performance"
echo "4. Update DNS if needed"
```

### 2. Production Health Monitoring
```bash
#!/bin/bash
# scripts/production-health-monitor.sh

set -e

DEPLOY_DIR="/opt/prompt-card-system"
LOG_FILE="$DEPLOY_DIR/logs/health-monitor.log"
ALERT_EMAIL="admin@yourdomain.com"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Alert function
send_alert() {
    local subject="$1"
    local message="$2"
    
    # Send email alert
    echo "$message" | mail -s "$subject" "$ALERT_EMAIL" 2>/dev/null || true
    
    # Send Slack notification if webhook is configured
    if [ -n "${SLACK_WEBHOOK:-}" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data '{"text":"🚨 '"$subject"': '"$message"'"}' \
            "$SLACK_WEBHOOK" 2>/dev/null || true
    fi
    
    log "🚨 ALERT: $subject - $message"
}

cd "$DEPLOY_DIR"

log "🔍 Starting comprehensive health check..."

# Check Docker services
services=("frontend" "backend" "auth" "database" "redis" "nginx")
failed_services=()

for service in "${services[@]}"; do
    if ! docker compose -f docker-compose.production.yml ps "$service" | grep -q "Up"; then
        failed_services+=("$service")
    fi
done

if [ ${#failed_services[@]} -gt 0 ]; then
    send_alert "Service Failure" "Services down: ${failed_services[*]}"
fi

# Check HTTP endpoints
endpoints=(
    "http://localhost/health:Frontend"
    "http://localhost/api/health:Backend"
    "http://localhost/auth/health:Auth"
)

for endpoint_info in "${endpoints[@]}"; do
    IFS=':' read -r url name <<< "$endpoint_info"
    
    if ! curl -f -m 10 "$url" &>/dev/null; then
        send_alert "Endpoint Failure" "$name endpoint ($url) is not responding"
    else
        log "✅ $name endpoint is healthy"
    fi
done

# Check resource usage
cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//')
memory_usage=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
disk_usage=$(df /opt | tail -1 | awk '{print $5}' | sed 's/%//')

log "💾 Resource usage - CPU: ${cpu_usage}%, Memory: ${memory_usage}%, Disk: ${disk_usage}%"

# Alert on high resource usage
if (( $(echo "$cpu_usage > 80" | bc -l) )); then
    send_alert "High CPU Usage" "CPU usage is ${cpu_usage}%"
fi

if (( $(echo "$memory_usage > 85" | bc -l) )); then
    send_alert "High Memory Usage" "Memory usage is ${memory_usage}%"
fi

if [ "$disk_usage" -gt 90 ]; then
    send_alert "High Disk Usage" "Disk usage is ${disk_usage}%"
fi

# Check SSL certificate expiry
if [ -f "/etc/letsencrypt/live/*/fullchain.pem" ]; then
    cert_file=$(ls /etc/letsencrypt/live/*/fullchain.pem | head -1)
    expiry_date=$(openssl x509 -in "$cert_file" -noout -enddate | cut -d= -f2)
    expiry_timestamp=$(date -d "$expiry_date" +%s)
    current_timestamp=$(date +%s)
    days_until_expiry=$(( (expiry_timestamp - current_timestamp) / 86400 ))
    
    if [ "$days_until_expiry" -lt 30 ]; then
        send_alert "SSL Certificate Expiry" "SSL certificate expires in $days_until_expiry days"
    fi
    
    log "🔒 SSL certificate expires in $days_until_expiry days"
fi

# Check log file sizes
large_logs=$(find "$DEPLOY_DIR/logs" -name "*.log" -size +100M 2>/dev/null)
if [ -n "$large_logs" ]; then
    send_alert "Large Log Files" "Large log files detected: $large_logs"
fi

# Check backup recency
latest_backup=$(find "$DEPLOY_DIR/backups" -name "*.sql.gz" -mtime -2 2>/dev/null | head -1)
if [ -z "$latest_backup" ]; then
    send_alert "Backup Missing" "No recent database backup found"
fi

log "✅ Health check completed"
```

## Security Hardening

### 1. Security Configuration
```bash
#!/bin/bash
# scripts/security-hardening.sh

set -e

echo "🔒 Applying security hardening..."

# Update system
sudo apt update && sudo apt upgrade -y

# Configure SSH
sudo tee -a /etc/ssh/sshd_config << EOF

# Security hardening
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
X11Forwarding no
AllowTcpForwarding no
ClientAliveInterval 300
ClientAliveCountMax 2
MaxAuthTries 3
Protocol 2
EOF

sudo systemctl restart ssh

# Configure firewall rules
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow essential services
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw --force enable

# Configure fail2ban
sudo tee /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log
maxretry = 3

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 3

[nginx-noscript]
enabled = true
action = iptables-multiport[name=NoScript, port="http,https"]
filter = nginx-noscript
logpath = /var/log/nginx/access.log
maxretry = 6
bantime = 86400

[nginx-badbots]
enabled = true
filter = nginx-badbots
logpath = /var/log/nginx/access.log
maxretry = 2
bantime = 86400
EOF

sudo systemctl restart fail2ban

# Set up log monitoring
sudo apt install -y logwatch
echo "/usr/sbin/logwatch --output mail --mailto admin@yourdomain.com --detail high" | sudo crontab -

# Configure automatic updates
sudo apt install -y unattended-upgrades
echo 'Unattended-Upgrade::Automatic-Reboot "false";' | sudo tee -a /etc/apt/apt.conf.d/50unattended-upgrades

echo "✅ Security hardening complete"
```

### 2. Secrets Management
```bash
#!/bin/bash
# scripts/setup-secrets.sh

set -e

SECRETS_DIR="/opt/prompt-card-system/secrets"

echo "🔐 Setting up secrets management..."

# Create secrets directory
sudo mkdir -p "$SECRETS_DIR"
sudo chmod 700 "$SECRETS_DIR"
sudo chown promptapp:promptapp "$SECRETS_DIR"

# Generate secure secrets
generate_secret() {
    openssl rand -base64 32
}

# Create secrets
JWT_SECRET=$(generate_secret)
ENCRYPTION_KEY=$(generate_secret)
SESSION_SECRET=$(generate_secret)
DB_PASSWORD=$(generate_secret)
REDIS_PASSWORD=$(generate_secret)

# Store secrets securely
echo "$JWT_SECRET" | sudo tee "$SECRETS_DIR/jwt_secret" > /dev/null
echo "$ENCRYPTION_KEY" | sudo tee "$SECRETS_DIR/encryption_key" > /dev/null
echo "$SESSION_SECRET" | sudo tee "$SECRETS_DIR/session_secret" > /dev/null
echo "$DB_PASSWORD" | sudo tee "$SECRETS_DIR/db_password" > /dev/null
echo "$REDIS_PASSWORD" | sudo tee "$SECRETS_DIR/redis_password" > /dev/null

# Set permissions
sudo chmod 600 "$SECRETS_DIR"/*
sudo chown promptapp:promptapp "$SECRETS_DIR"/*

echo "✅ Secrets generated and stored securely"
echo "Update your .env file to reference these secrets"
```

## Monitoring and Alerting

### 1. Prometheus Configuration
```yaml
# monitoring/prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'docker'
    static_configs:
      - targets: ['docker-exporter:9323']

  - job_name: 'prompt-card-backend'
    static_configs:
      - targets: ['backend:3001']
    metrics_path: '/metrics'

  - job_name: 'prompt-card-auth'
    static_configs:
      - targets: ['auth:3002']
    metrics_path: '/metrics'

  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx:9113']

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
```

### 2. Alert Rules
```yaml
# monitoring/prometheus/alert_rules.yml
groups:
  - name: prompt-card-system
    rules:
      - alert: ServiceDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service {{ $labels.job }} is down"
          description: "{{ $labels.job }} has been down for more than 1 minute."

      - alert: HighCPUUsage
        expr: 100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage on {{ $labels.instance }}"
          description: "CPU usage is above 80% for more than 5 minutes."

      - alert: HighMemoryUsage
        expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes * 100 > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage on {{ $labels.instance }}"
          description: "Memory usage is above 85% for more than 5 minutes."

      - alert: DiskSpaceLow
        expr: 100 - ((node_filesystem_avail_bytes * 100) / node_filesystem_size_bytes) > 90
        for: 10m
        labels:
          severity: critical
        annotations:
          summary: "Disk space low on {{ $labels.instance }}"
          description: "Disk usage is above 90% for more than 10 minutes."

      - alert: DatabaseConnectionFailed
        expr: pg_up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database connection failed"
          description: "Cannot connect to PostgreSQL database."

      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "Error rate is above 10% for more than 5 minutes."
```

## Disaster Recovery

### 1. Backup Strategy
```bash
#!/bin/bash
# scripts/comprehensive-backup.sh

set -e

BACKUP_DIR="/opt/prompt-card-system/backups"
S3_BUCKET="your-backup-bucket"
RETENTION_DAYS=30

timestamp=$(date +%Y%m%d_%H%M%S)
backup_name="full_backup_$timestamp"

echo "📦 Creating comprehensive backup: $backup_name"

cd /opt/prompt-card-system

# Create backup directory
mkdir -p "$BACKUP_DIR/$backup_name"

# Backup database
echo "💾 Backing up database..."
docker compose -f docker-compose.production.yml exec -T database pg_dump -U promptuser promptcards > "$BACKUP_DIR/$backup_name/database.sql"

# Backup application data
echo "📁 Backing up application data..."
docker run --rm -v prompt-card-system_app-data:/data -v "$BACKUP_DIR/$backup_name":/backup alpine tar czf /backup/app-data.tar.gz -C /data .

# Backup configuration
echo "⚙️ Backing up configuration..."
tar czf "$BACKUP_DIR/$backup_name/config.tar.gz" .env nginx/ monitoring/ docker-compose.production.yml

# Backup SSL certificates
echo "🔒 Backing up SSL certificates..."
sudo tar czf "$BACKUP_DIR/$backup_name/ssl.tar.gz" -C /etc/letsencrypt .

# Create restore script
cat > "$BACKUP_DIR/$backup_name/restore.sh" << EOF
#!/bin/bash
set -e

echo "🔄 Restoring from backup: $backup_name"

# Stop services
docker compose -f docker-compose.production.yml down

# Restore database
docker compose -f docker-compose.production.yml up -d database
sleep 30
docker compose -f docker-compose.production.yml exec -T database psql -U promptuser -d promptcards < database.sql

# Restore application data
docker run --rm -v prompt-card-system_app-data:/data -v "\$(pwd)":/backup alpine tar xzf /backup/app-data.tar.gz -C /data

# Restore configuration
tar xzf config.tar.gz

# Restore SSL certificates
sudo tar xzf ssl.tar.gz -C /etc/letsencrypt

# Start services
docker compose -f docker-compose.production.yml up -d

echo "✅ Restore complete"
EOF

chmod +x "$BACKUP_DIR/$backup_name/restore.sh"

# Compress backup
tar czf "$BACKUP_DIR/$backup_name.tar.gz" -C "$BACKUP_DIR" "$backup_name"
rm -rf "$BACKUP_DIR/$backup_name"

# Upload to S3 if configured
if command -v aws &> /dev/null && [ -n "$S3_BUCKET" ]; then
    echo "☁️ Uploading to S3..."
    aws s3 cp "$BACKUP_DIR/$backup_name.tar.gz" "s3://$S3_BUCKET/backups/"
fi

# Cleanup old backups
find "$BACKUP_DIR" -name "full_backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "✅ Backup complete: $backup_name.tar.gz"
echo "📊 Backup size: $(du -h "$BACKUP_DIR/$backup_name.tar.gz" | cut -f1)"
```

### 2. Disaster Recovery Plan
```bash
#!/bin/bash
# scripts/disaster-recovery.sh

set -e

BACKUP_SOURCE=${1:-"latest"} # latest, s3, or specific backup file

echo "🚨 Starting disaster recovery process..."

# Stop all services
echo "🛑 Stopping all services..."
docker compose -f docker-compose.production.yml down --volumes

# Remove all data (destructive operation)
echo "⚠️ Removing existing data..."
docker volume rm $(docker volume ls -q | grep prompt-card-system) 2>/dev/null || true

# Restore from backup
case $BACKUP_SOURCE in
    "latest")
        echo "📥 Restoring from latest local backup..."
        latest_backup=$(ls -t /opt/prompt-card-system/backups/full_backup_*.tar.gz | head -1)
        tar xzf "$latest_backup" -C /tmp
        backup_dir=$(basename "$latest_backup" .tar.gz)
        ;;
    "s3")
        echo "☁️ Restoring from S3..."
        # Download latest from S3
        aws s3 cp s3://your-backup-bucket/backups/ /tmp/ --recursive --exclude "*" --include "full_backup_*.tar.gz"
        latest_backup=$(ls -t /tmp/full_backup_*.tar.gz | head -1)
        tar xzf "$latest_backup" -C /tmp
        backup_dir=$(basename "$latest_backup" .tar.gz)
        ;;
    *)
        echo "📁 Restoring from specific backup: $BACKUP_SOURCE"
        tar xzf "$BACKUP_SOURCE" -C /tmp
        backup_dir=$(basename "$BACKUP_SOURCE" .tar.gz)
        ;;
esac

# Execute restore script
cd "/tmp/$backup_dir"
chmod +x restore.sh
./restore.sh

# Verify recovery
echo "🔍 Verifying recovery..."
sleep 60

# Run health checks
timeout 300 bash -c 'until curl -f http://localhost/health; do sleep 10; done'

echo "✅ Disaster recovery completed successfully!"
```

## Next Steps

1. Review [GHCR deployment guide](./ghcr-deployment.md) for container registry setup
2. Check [offline deployment guide](./offline-deployment.md) for air-gapped environments
3. See [architecture documentation](../architecture/swarm-coordination.md) for system design details