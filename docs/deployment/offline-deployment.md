# Offline Deployment Guide

## Overview

This guide covers deploying the Prompt Card System in air-gapped or offline environments where internet access is restricted or unavailable.

## Pre-Deployment Preparation

### 1. Export Container Images

#### Create Image Export Script
```bash
#!/bin/bash
# scripts/export-images.sh

set -e

IMAGES=(
    "ghcr.io/tbowman01/prompt-card-system/frontend:latest"
    "ghcr.io/tbowman01/prompt-card-system/backend:latest"
    "ghcr.io/tbowman01/prompt-card-system/auth:latest"
    "node:20-alpine"
    "nginx:alpine"
    "postgres:15-alpine"
    "redis:7-alpine"
)

OUTPUT_DIR="./offline-images"
mkdir -p $OUTPUT_DIR

echo "📦 Exporting Docker images for offline deployment..."

for image in "${IMAGES[@]}"; do
    echo "Exporting $image..."
    image_file=$(echo $image | tr '/' '_' | tr ':' '_').tar
    docker pull $image
    docker save $image > "$OUTPUT_DIR/$image_file"
done

# Create image list
cat > "$OUTPUT_DIR/image-list.txt" << EOF
# Image list for offline deployment
# Format: image_file:image_name
$(for image in "${IMAGES[@]}"; do
    image_file=$(echo $image | tr '/' '_' | tr ':' '_').tar
    echo "$image_file:$image"
done)
EOF

# Create import script
cat > "$OUTPUT_DIR/import-images.sh" << 'EOF'
#!/bin/bash
set -e

echo "📥 Importing Docker images..."

while IFS=':' read -r file image_name; do
    if [ ! -z "$file" ] && [ "${file:0:1}" != "#" ]; then
        echo "Importing $image_name from $file..."
        docker load < "$file"
    fi
done < image-list.txt

echo "✅ All images imported successfully!"
EOF

chmod +x "$OUTPUT_DIR/import-images.sh"

# Create compressed archive
tar -czf offline-deployment-images.tar.gz $OUTPUT_DIR

echo "✅ Image export complete!"
echo "📁 Archive created: offline-deployment-images.tar.gz"
echo "📊 Archive size: $(du -h offline-deployment-images.tar.gz | cut -f1)"
```

#### Export Application Code
```bash
#!/bin/bash
# scripts/export-application.sh

set -e

echo "📦 Exporting application for offline deployment..."

# Create deployment package
PACKAGE_DIR="offline-deployment"
mkdir -p $PACKAGE_DIR

# Copy application files
cp -r frontend backend auth nginx monitoring $PACKAGE_DIR/
cp docker-compose.prod.yml docker-compose.offline.yml $PACKAGE_DIR/
cp -r scripts database $PACKAGE_DIR/

# Remove unnecessary files
find $PACKAGE_DIR -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true
find $PACKAGE_DIR -name ".git" -type d -exec rm -rf {} + 2>/dev/null || true
find $PACKAGE_DIR -name "*.log" -type f -delete 2>/dev/null || true

# Create environment template
cat > "$PACKAGE_DIR/.env.template" << 'EOF'
# Offline Deployment Environment Variables
NODE_ENV=production
DATABASE_URL=postgresql://username:password@database:5432/promptcards
JWT_SECRET=your-super-secure-jwt-secret-change-this
DB_NAME=promptcards
DB_USER=promptuser
DB_PASSWORD=change-this-password
REDIS_URL=redis://redis:6379
API_URL=https://your-domain.com
NGINX_SSL_CERT_PATH=/etc/nginx/certs/cert.pem
NGINX_SSL_KEY_PATH=/etc/nginx/certs/key.pem
EOF

# Create deployment documentation
cat > "$PACKAGE_DIR/DEPLOYMENT_README.md" << 'EOF'
# Offline Deployment Instructions

## Prerequisites
- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 4GB RAM
- 20GB disk space

## Quick Start
1. Extract deployment package
2. Import Docker images: `./import-images.sh`
3. Copy `.env.template` to `.env` and configure
4. Run: `docker-compose -f docker-compose.offline.yml up -d`

## Configuration
Edit `.env` file with your specific settings before deployment.

## Health Check
curl http://localhost/health
EOF

# Create compressed package
tar -czf offline-deployment.tar.gz $PACKAGE_DIR

echo "✅ Application export complete!"
echo "📁 Package created: offline-deployment.tar.gz"
echo "📊 Package size: $(du -h offline-deployment.tar.gz | cut -f1)"
```

### 2. Offline Docker Compose Configuration

#### Create Offline Compose File
```yaml
# docker-compose.offline.yml
version: '3.8'

services:
  frontend:
    image: ghcr.io/tbowman01/prompt-card-system/frontend:latest
    container_name: prompt-frontend
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=${API_URL:-http://localhost:3001}
      - NEXT_TELEMETRY_DISABLED=1
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - app-network
    depends_on:
      backend:
        condition: service_healthy

  backend:
    image: ghcr.io/tbowman01/prompt-card-system/backend:latest
    container_name: prompt-backend
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
      - REDIS_URL=${REDIS_URL:-redis://redis:6379}
    volumes:
      - app-data:/app/data
      - app-logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    networks:
      - app-network
    depends_on:
      database:
        condition: service_healthy
      redis:
        condition: service_healthy

  auth:
    image: ghcr.io/tbowman01/prompt-card-system/auth:latest
    container_name: prompt-auth
    ports:
      - "3002:3002"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3002/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - app-network
    depends_on:
      database:
        condition: service_healthy

  database:
    image: postgres:15-alpine
    container_name: prompt-database
    environment:
      - POSTGRES_DB=${DB_NAME:-promptcards}
      - POSTGRES_USER=${DB_USER:-promptuser}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_INITDB_ARGS=--encoding=UTF-8 --lc-collate=C --lc-ctype=C
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./database/init:/docker-entrypoint-initdb.d:ro
    ports:
      - "5432:5432"
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-promptuser} -d ${DB_NAME:-promptcards}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    container_name: prompt-redis
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD:-}
    volumes:
      - redis-data:/data
    ports:
      - "6379:6379"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 20s
    networks:
      - app-network

  nginx:
    image: nginx:alpine
    container_name: prompt-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.offline.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/certs:/etc/nginx/certs:ro
      - nginx-cache:/var/cache/nginx
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - app-network
    depends_on:
      - frontend
      - backend
      - auth

networks:
  app-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16

volumes:
  app-data:
    driver: local
  app-logs:
    driver: local
  postgres-data:
    driver: local
  redis-data:
    driver: local
  nginx-cache:
    driver: local
```

### 3. Offline Nginx Configuration
```nginx
# nginx/nginx.offline.conf
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;

    # Basic settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Rate limiting for offline environment
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=general:10m rate=5r/s;

    upstream frontend {
        server frontend:3000 max_fails=3 fail_timeout=30s;
    }

    upstream backend {
        server backend:3001 max_fails=3 fail_timeout=30s;
    }

    upstream auth {
        server auth:3002 max_fails=3 fail_timeout=30s;
    }

    # Health check endpoint
    server {
        listen 80;
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }

    # Main server block
    server {
        listen 80 default_server;
        listen [::]:80 default_server;
        server_name _;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Referrer-Policy "strict-origin-when-cross-origin";

        # Frontend
        location / {
            limit_req zone=general burst=20 nodelay;
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_connect_timeout 30s;
            proxy_send_timeout 30s;
            proxy_read_timeout 30s;
        }

        # Backend API
        location /api/ {
            limit_req zone=api burst=50 nodelay;
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # Auth API
        location /auth/ {
            limit_req zone=api burst=30 nodelay;
            proxy_pass http://auth;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_connect_timeout 30s;
            proxy_send_timeout 30s;
            proxy_read_timeout 30s;
        }

        # WebSocket support for real-time features
        location /ws/ {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_connect_timeout 7d;
            proxy_send_timeout 7d;
            proxy_read_timeout 7d;
        }

        # Static assets caching
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            add_header X-Cache-Status "HIT";
        }
    }

    # HTTPS server (if SSL certificates are available)
    server {
        listen 443 ssl http2;
        listen [::]:443 ssl http2;
        server_name _;

        # SSL configuration
        ssl_certificate ${NGINX_SSL_CERT_PATH};
        ssl_certificate_key ${NGINX_SSL_KEY_PATH};
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        # Include same location blocks as HTTP server
        include /etc/nginx/conf.d/locations.conf;
    }
}
```

## Deployment Process

### 1. Pre-Deployment Server Setup
```bash
#!/bin/bash
# scripts/offline-server-setup.sh

set -e

echo "🚀 Setting up offline server environment..."

# Check prerequisites
command -v docker >/dev/null 2>&1 || {
    echo "❌ Docker is required but not installed."
    echo "Please install Docker manually and try again."
    exit 1
}

command -v docker-compose >/dev/null 2>&1 || {
    echo "❌ Docker Compose is required but not installed."
    echo "Please install Docker Compose manually and try again."
    exit 1
}

# Create application directory
DEPLOY_DIR="/opt/prompt-card-system"
sudo mkdir -p $DEPLOY_DIR
sudo chown $USER:$USER $DEPLOY_DIR

# Create required directories
mkdir -p $DEPLOY_DIR/{data,logs,backups,nginx/certs}

# Set proper permissions
chmod 755 $DEPLOY_DIR
chmod 750 $DEPLOY_DIR/data
chmod 750 $DEPLOY_DIR/logs
chmod 700 $DEPLOY_DIR/nginx/certs

# Create systemd service for auto-start
sudo tee /etc/systemd/system/prompt-card-system.service > /dev/null << EOF
[Unit]
Description=Prompt Card System
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$DEPLOY_DIR
ExecStart=/usr/local/bin/docker-compose -f docker-compose.offline.yml up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.offline.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable prompt-card-system

echo "✅ Offline server setup complete!"
```

### 2. Deployment Script
```bash
#!/bin/bash
# scripts/offline-deploy.sh

set -e

DEPLOY_DIR="/opt/prompt-card-system"
BACKUP_DIR="$DEPLOY_DIR/backups"

echo "🚀 Starting offline deployment..."

# Validate environment
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Please copy .env.template to .env and configure."
    exit 1
fi

# Source environment variables
set -a
source .env
set +a

# Validate required variables
required_vars=("JWT_SECRET" "DB_PASSWORD" "DATABASE_URL")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Required environment variable $var is not set."
        exit 1
    fi
done

# Create backup if existing deployment
if [ -f "$DEPLOY_DIR/docker-compose.offline.yml" ]; then
    echo "📦 Creating backup..."
    timestamp=$(date +%Y%m%d-%H%M%S)
    backup_file="$BACKUP_DIR/backup-$timestamp.tar.gz"
    
    mkdir -p $BACKUP_DIR
    docker-compose -f docker-compose.offline.yml logs > "$BACKUP_DIR/logs-$timestamp.txt" 2>/dev/null || true
    
    if [ -d "$DEPLOY_DIR/data" ]; then
        tar -czf "$backup_file" -C "$DEPLOY_DIR" data
        echo "✅ Backup created: $backup_file"
    fi
fi

# Copy deployment files
echo "📁 Copying deployment files..."
cp docker-compose.offline.yml nginx/nginx.offline.conf database/ $DEPLOY_DIR/ 2>/dev/null || true

# Load environment
cd $DEPLOY_DIR

# Stop existing services
echo "🛑 Stopping existing services..."
docker-compose -f docker-compose.offline.yml down --timeout 30 || true

# Start services
echo "▶️ Starting services..."
docker-compose -f docker-compose.offline.yml up -d

# Wait for services to be healthy
echo "🏥 Waiting for services to be healthy..."
timeout 300 bash -c 'until docker-compose -f docker-compose.offline.yml ps | grep -q "healthy"; do echo "Waiting for services..."; sleep 10; done'

# Run health checks
echo "🔍 Running health checks..."
sleep 30

health_check() {
    local url=$1
    local service=$2
    
    if curl -f -m 10 "$url" >/dev/null 2>&1; then
        echo "✅ $service is healthy"
        return 0
    else
        echo "❌ $service health check failed"
        return 1
    fi
}

# Check all services
health_check "http://localhost/health" "Nginx"
health_check "http://localhost:3000/health" "Frontend" 
health_check "http://localhost:3001/health" "Backend"
health_check "http://localhost:3002/health" "Auth"

# Show deployment status
echo "📊 Deployment status:"
docker-compose -f docker-compose.offline.yml ps

# Show resource usage
echo "💾 Resource usage:"
docker stats --no-stream

echo "✅ Offline deployment complete!"
echo "🌐 Access the application at: http://localhost"
```

### 3. Database Initialization
```sql
-- database/init/001_offline_init.sql
-- Initialize database for offline deployment

-- Create database if not exists
SELECT 'CREATE DATABASE promptcards'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'promptcards');

-- Connect to the database
\c promptcards;

-- Create user if not exists
DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'promptuser') THEN
      CREATE USER promptuser WITH PASSWORD 'change-this-password';
   END IF;
END
$$;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE promptcards TO promptuser;
GRANT ALL ON SCHEMA public TO promptuser;

-- Create basic tables
CREATE TABLE IF NOT EXISTS prompt_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    prompt TEXT NOT NULL,
    category VARCHAR(100),
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS test_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_card_id UUID REFERENCES prompt_cards(id) ON DELETE CASCADE,
    input JSONB,
    expected_output TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_prompt_cards_category ON prompt_cards(category);
CREATE INDEX IF NOT EXISTS idx_prompt_cards_created_at ON prompt_cards(created_at);
CREATE INDEX IF NOT EXISTS idx_test_cases_prompt_card_id ON test_cases(prompt_card_id);

-- Insert sample data for offline demo
INSERT INTO prompt_cards (title, description, prompt, category, tags) VALUES
('Code Review Prompt', 'Generate code review comments', 'Review this {{language}} code and provide feedback: {{code}}', 'development', ARRAY['code-review', 'development']),
('Documentation Generator', 'Generate documentation for functions', 'Generate documentation for this {{language}} function: {{function}}', 'documentation', ARRAY['docs', 'api']),
('Test Case Generator', 'Generate test cases for functions', 'Generate comprehensive test cases for: {{function_description}}', 'testing', ARRAY['testing', 'quality-assurance'])
ON CONFLICT (id) DO NOTHING;
```

## Monitoring and Maintenance

### 1. Health Monitoring Script
```bash
#!/bin/bash
# scripts/health-monitor.sh

set -e

DEPLOY_DIR="/opt/prompt-card-system"
LOG_FILE="$DEPLOY_DIR/logs/health-monitor.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

check_service() {
    local service=$1
    local url=$2
    
    if curl -f -m 10 "$url" >/dev/null 2>&1; then
        log "✅ $service is healthy"
        return 0
    else
        log "❌ $service is unhealthy"
        return 1
    fi
}

check_docker_service() {
    local service=$1
    
    if docker-compose -f "$DEPLOY_DIR/docker-compose.offline.yml" ps "$service" | grep -q "Up"; then
        log "✅ Docker service $service is running"
        return 0
    else
        log "❌ Docker service $service is not running"
        return 1
    fi
}

cd $DEPLOY_DIR

log "🔍 Starting health check..."

# Check Docker services
services=("frontend" "backend" "auth" "database" "redis" "nginx")
for service in "${services[@]}"; do
    check_docker_service "$service"
done

# Check HTTP endpoints
check_service "Nginx" "http://localhost/health"
check_service "Frontend" "http://localhost:3000/health"
check_service "Backend" "http://localhost:3001/health"
check_service "Auth" "http://localhost:3002/health"

# Check resource usage
log "💾 Resource usage:"
docker stats --no-stream >> "$LOG_FILE"

# Check disk space
disk_usage=$(df -h /opt | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$disk_usage" -gt 80 ]; then
    log "⚠️ High disk usage: ${disk_usage}%"
else
    log "✅ Disk usage: ${disk_usage}%"
fi

log "✅ Health check complete"
```

### 2. Backup Script
```bash
#!/bin/bash
# scripts/backup.sh

set -e

DEPLOY_DIR="/opt/prompt-card-system"
BACKUP_DIR="$DEPLOY_DIR/backups"
RETENTION_DAYS=7

timestamp=$(date +%Y%m%d-%H%M%S)
backup_name="backup-$timestamp"

echo "📦 Creating backup: $backup_name"

cd $DEPLOY_DIR
mkdir -p $BACKUP_DIR

# Backup database
echo "💾 Backing up database..."
docker-compose -f docker-compose.offline.yml exec -T database pg_dump -U promptuser promptcards > "$BACKUP_DIR/$backup_name-database.sql"

# Backup application data
echo "📁 Backing up application data..."
tar -czf "$BACKUP_DIR/$backup_name-data.tar.gz" data/

# Backup configuration
echo "⚙️ Backing up configuration..."
tar -czf "$BACKUP_DIR/$backup_name-config.tar.gz" .env nginx/ docker-compose.offline.yml

# Create restore script
cat > "$BACKUP_DIR/$backup_name-restore.sh" << EOF
#!/bin/bash
set -e

echo "🔄 Restoring backup: $backup_name"

# Stop services
docker-compose -f docker-compose.offline.yml down

# Restore database
docker-compose -f docker-compose.offline.yml up -d database
sleep 30
docker-compose -f docker-compose.offline.yml exec -T database psql -U promptuser -d promptcards < $backup_name-database.sql

# Restore data
tar -xzf $backup_name-data.tar.gz

# Start services
docker-compose -f docker-compose.offline.yml up -d

echo "✅ Restore complete"
EOF

chmod +x "$BACKUP_DIR/$backup_name-restore.sh"

# Cleanup old backups
find $BACKUP_DIR -name "backup-*" -mtime +$RETENTION_DAYS -delete

echo "✅ Backup complete: $backup_name"
echo "📊 Backup size:"
ls -lh "$BACKUP_DIR/$backup_name"*
```

## Troubleshooting

### 1. Common Issues

#### Container Startup Failures
```bash
# Check container logs
docker-compose -f docker-compose.offline.yml logs service-name

# Check container status
docker-compose -f docker-compose.offline.yml ps

# Restart specific service
docker-compose -f docker-compose.offline.yml restart service-name
```

#### Network Connectivity Issues
```bash
# Test internal connectivity
docker-compose -f docker-compose.offline.yml exec frontend curl backend:3001/health

# Check network configuration
docker network ls
docker network inspect prompt-card-system_app-network
```

#### Database Connection Problems
```bash
# Test database connection
docker-compose -f docker-compose.offline.yml exec database psql -U promptuser -d promptcards -c "SELECT version();"

# Check database logs
docker-compose -f docker-compose.offline.yml logs database
```

### 2. Performance Optimization

#### Resource Monitoring
```bash
# Monitor resource usage
docker stats

# Check system resources
free -h
df -h
```

#### Log Management
```bash
# Configure log rotation
sudo tee /etc/logrotate.d/prompt-card-system > /dev/null << EOF
/opt/prompt-card-system/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 root root
}
EOF
```

## Security Considerations

### 1. Network Security
- Use internal Docker networks
- Disable unnecessary ports
- Implement firewall rules

### 2. Data Security
- Encrypt sensitive data at rest
- Use strong passwords
- Regular security updates

### 3. Access Control
- Limit SSH access
- Use key-based authentication
- Implement audit logging

## Maintenance Procedures

### 1. Regular Maintenance
```bash
# Weekly maintenance script
#!/bin/bash
# scripts/weekly-maintenance.sh

echo "🧹 Running weekly maintenance..."

# Cleanup old logs
find /opt/prompt-card-system/logs -name "*.log" -mtime +7 -delete

# Cleanup old Docker images
docker image prune -f

# Update time synchronization
sudo ntpdate -s time.nist.gov || true

# Run health check
./health-monitor.sh

# Create backup
./backup.sh

echo "✅ Weekly maintenance complete"
```

### 2. Updates and Patches
```bash
# Update procedure
#!/bin/bash
# scripts/update.sh

echo "🔄 Updating Prompt Card System..."

# Create backup before update
./backup.sh

# Pull new images (if available locally)
docker-compose -f docker-compose.offline.yml pull

# Restart services
docker-compose -f docker-compose.offline.yml down
docker-compose -f docker-compose.offline.yml up -d

# Verify update
sleep 60
./health-monitor.sh

echo "✅ Update complete"
```

## Next Steps

1. Review [production setup guide](./production-setup.md) for advanced configurations
2. Check [GHCR deployment guide](./ghcr-deployment.md) for online deployment
3. See [architecture documentation](../architecture/swarm-coordination.md) for system design details