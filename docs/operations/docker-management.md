# Docker Container Management

## 🐳 Overview

This document provides comprehensive procedures for managing Docker containers in the Prompt Card System, including lifecycle management, troubleshooting, scaling, and maintenance operations.

## 🏗️ Container Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Frontend    │    │     Backend     │    │   PostgreSQL    │
│   (Next.js)     │ ──→│   (Node.js)     │ ──→│   (Database)    │
│   Port: 3000    │    │   Port: 3001    │    │   Port: 5432    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│      Redis      │    │   Prometheus    │    │     Grafana     │
│   (Cache)       │    │  (Monitoring)   │    │ (Visualization) │
│   Port: 6379    │    │   Port: 9090    │    │   Port: 3002    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Container Status Check
```bash
# Check all containers
docker ps -a

# Check specific service status
docker-compose -f docker-compose.prod.yml ps

# Health check for all services
docker-compose -f docker-compose.prod.yml exec backend curl -f http://localhost:3001/api/health
```

### Service Management
```bash
# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Stop all services
docker-compose -f docker-compose.prod.yml down

# Restart specific service
docker-compose -f docker-compose.prod.yml restart backend
```

## 📊 Container Operations

### Individual Container Management

#### Frontend Container (Next.js)
```bash
# Check frontend container
docker inspect prompt-frontend

# View frontend logs
docker logs prompt-frontend --tail=100 -f

# Execute commands in frontend container
docker exec -it prompt-frontend bash

# Restart frontend with new environment
docker-compose -f docker-compose.prod.yml stop frontend
docker-compose -f docker-compose.prod.yml up -d frontend
```

#### Backend Container (Node.js)
```bash
# Check backend health
docker exec prompt-backend curl -f http://localhost:3001/api/health

# Monitor backend logs
docker logs prompt-backend --tail=200 -f

# Check backend process
docker exec prompt-backend ps aux

# Debug backend container
docker exec -it prompt-backend node --version
docker exec -it prompt-backend npm list
```

#### Database Container (PostgreSQL)
```bash
# Connect to database
docker exec -it prompt-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB

# Check database status
docker exec prompt-postgres pg_isready -U $POSTGRES_USER

# View database logs
docker logs prompt-postgres --tail=100

# Database backup within container
docker exec prompt-postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB > /backups/db_backup.sql
```

#### Cache Container (Redis)
```bash
# Connect to Redis
docker exec -it prompt-redis redis-cli

# Check Redis status
docker exec prompt-redis redis-cli ping

# Monitor Redis commands
docker exec prompt-redis redis-cli monitor

# Check Redis memory usage
docker exec prompt-redis redis-cli info memory
```

### Container Resource Monitoring

#### Resource Usage Check
```bash
# Overall container stats
docker stats

# Specific container stats
docker stats prompt-backend prompt-frontend

# Memory usage by container
docker exec prompt-backend free -h

# CPU usage within container
docker exec prompt-backend top -n1 | head -5
```

#### Disk Usage Management
```bash
# Check container disk usage
docker system df

# Check specific container size
docker exec prompt-backend du -sh /app

# Clean up unused images
docker image prune -f

# Clean up unused volumes
docker volume prune -f
```

## 🔧 Troubleshooting Guide

### Container Won't Start

#### Step 1: Check Container Status
```bash
# List all containers including stopped ones
docker ps -a

# Inspect container configuration
docker inspect prompt-backend

# Check container exit code
docker inspect prompt-backend --format='{{.State.ExitCode}}'
```

#### Step 2: Examine Logs
```bash
# View container logs
docker logs prompt-backend --timestamps

# Follow logs in real-time
docker logs prompt-backend -f --since 10m

# Check system journal for Docker daemon
journalctl -u docker --since "1 hour ago"
```

#### Step 3: Debug Container Issues
```bash
# Try starting container interactively
docker run -it --rm prompt-backend:latest bash

# Check Dockerfile and build process
docker build --no-cache -t prompt-backend:debug .

# Test container networking
docker exec prompt-backend ping google.com
docker exec prompt-backend nslookup postgres
```

### Performance Issues

#### High Memory Usage
```bash
# Check memory usage
docker stats --no-stream prompt-backend

# Identify memory-intensive processes
docker exec prompt-backend ps aux --sort=-%mem | head -10

# Check for memory leaks
docker exec prompt-backend node --inspect=0.0.0.0:9229 src/server.js

# Restart container if memory leak detected
docker restart prompt-backend
```

#### High CPU Usage
```bash
# Monitor CPU usage
docker stats --no-stream prompt-backend

# Check CPU-intensive processes
docker exec prompt-backend top -n1

# Profile Node.js application
docker exec prompt-backend node --prof src/server.js
```

#### Network Issues
```bash
# Check container network
docker network ls
docker network inspect prompt-card-system_default

# Test connectivity between containers
docker exec prompt-backend ping prompt-postgres
docker exec prompt-backend telnet prompt-redis 6379

# Check port mappings
docker port prompt-backend
```

### Storage Issues

#### Volume Problems
```bash
# List all volumes
docker volume ls

# Inspect volume details
docker volume inspect prompt-card-system_postgres_data

# Check volume usage
docker run --rm -v prompt-card-system_postgres_data:/data alpine du -sh /data

# Backup volume before cleanup
docker run --rm -v prompt-card-system_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/volume_backup.tar.gz /data
```

#### Container File System Issues
```bash
# Check container file system usage
docker exec prompt-backend df -h

# Find large files
docker exec prompt-backend find /app -size +100M -type f

# Clean up logs within container
docker exec prompt-backend sh -c 'echo > /app/logs/application.log'
```

## ⚡ Scaling Operations

### Horizontal Scaling

#### Scale Backend Services
```bash
# Scale backend to 3 replicas
docker-compose -f docker-compose.prod.yml up -d --scale backend=3

# Verify scaled services
docker-compose -f docker-compose.prod.yml ps

# Check load distribution
for i in {1..10}; do curl -s http://localhost:3001/api/health | jq .hostname; done
```

#### Load Balancer Configuration
```bash
# Update nginx configuration for load balancing
cat > nginx/nginx.conf << 'EOF'
upstream backend {
    least_conn;
    server prompt-backend_1:3001;
    server prompt-backend_2:3001;
    server prompt-backend_3:3001;
}

server {
    listen 80;
    location /api {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

# Reload nginx configuration
docker exec prompt-nginx nginx -s reload
```

### Vertical Scaling

#### Increase Container Resources
```yaml
# docker-compose.prod.yml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
```

#### Apply Resource Changes
```bash
# Stop and recreate with new limits
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d

# Verify resource allocation
docker inspect prompt-backend | jq '.[].HostConfig.Memory'
```

## 🔄 Container Lifecycle Management

### Rolling Updates

#### Zero-Downtime Deployment
```bash
# Build new image
docker build -t prompt-backend:v2.0 .

# Tag for deployment
docker tag prompt-backend:v2.0 prompt-backend:latest

# Rolling update strategy
docker-compose -f docker-compose.prod.yml up -d --no-deps --build backend

# Verify deployment
docker-compose -f docker-compose.prod.yml ps
curl -f http://localhost:3001/api/health
```

#### Blue-Green Deployment
```bash
# Start green environment
docker-compose -f docker-compose.green.yml up -d

# Verify green environment
curl -f http://localhost:3001/api/health

# Switch traffic (update load balancer)
# Stop blue environment after verification
docker-compose -f docker-compose.prod.yml down
```

### Rollback Procedures

#### Quick Rollback
```bash
# Tag previous version
docker tag prompt-backend:v1.9 prompt-backend:latest

# Restart with previous version
docker-compose -f docker-compose.prod.yml up -d --no-deps backend

# Verify rollback
curl -f http://localhost:3001/api/health
```

#### Database Migration Rollback
```bash
# Connect to database
docker exec -it prompt-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB

# Check migration status
SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 5;

# Rollback migration (if supported)
docker exec prompt-backend npm run migrate:rollback
```

## 📊 Container Health Monitoring

### Health Check Implementation

#### Custom Health Checks
```yaml
# docker-compose.yml
services:
  backend:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

#### Advanced Health Monitoring
```bash
# Create health check script
cat > scripts/health-check.sh << 'EOF'
#!/bin/bash
set -e

# Check all services
services=("backend" "frontend" "postgres" "redis" "prometheus" "grafana")

for service in "${services[@]}"; do
    if docker-compose -f docker-compose.prod.yml ps $service | grep -q "Up"; then
        echo "✅ $service: Running"
    else
        echo "❌ $service: Down"
        exit 1
    fi
done

# Check application endpoints
if curl -f -s http://localhost:3001/api/health > /dev/null; then
    echo "✅ Backend API: Healthy"
else
    echo "❌ Backend API: Unhealthy"
    exit 1
fi

echo "🎉 All services healthy"
EOF

chmod +x scripts/health-check.sh
```

### Automated Monitoring

#### Container Restart Policy
```yaml
# docker-compose.yml
services:
  backend:
    restart: unless-stopped
    deploy:
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
        window: 120s
```

#### Monitoring Script
```bash
# Create monitoring daemon
cat > scripts/container-monitor.sh << 'EOF'
#!/bin/bash

while true; do
    # Check container health
    unhealthy=$(docker ps --filter "health=unhealthy" --format "table {{.Names}}")
    
    if [ -n "$unhealthy" ]; then
        echo "🚨 Unhealthy containers detected: $unhealthy"
        
        # Attempt restart
        for container in $unhealthy; do
            echo "🔄 Restarting $container"
            docker restart $container
        done
        
        # Send alert
        if [ -n "$SLACK_WEBHOOK_URL" ]; then
            curl -X POST -H 'Content-type: application/json' \
                --data "{\"text\":\"🚨 Container health issues detected and restart attempted: $unhealthy\"}" \
                "$SLACK_WEBHOOK_URL"
        fi
    fi
    
    sleep 60
done
EOF

# Start monitoring daemon
nohup bash scripts/container-monitor.sh > /var/log/container-monitor.log 2>&1 &
```

## 🔒 Security Operations

### Container Security

#### Security Scanning
```bash
# Scan container images for vulnerabilities
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image prompt-backend:latest

# Check for known vulnerabilities
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  clair/clair:latest
```

#### Security Hardening
```bash
# Run containers as non-root user
docker exec prompt-backend id

# Check container capabilities
docker inspect prompt-backend | jq '.[].HostConfig.CapAdd'
docker inspect prompt-backend | jq '.[].HostConfig.CapDrop'

# Verify read-only file systems where applicable
docker inspect prompt-backend | jq '.[].HostConfig.ReadonlyRootfs'
```

### Access Control

#### Container Access Audit
```bash
# List users with Docker access
grep docker /etc/group

# Check container process ownership
docker exec prompt-backend ps aux | grep -v grep

# Audit container network access
docker exec prompt-backend netstat -tuln
```

## 📋 Maintenance Procedures

### Daily Tasks
- [ ] Check container health status
- [ ] Review container logs for errors
- [ ] Monitor resource usage
- [ ] Verify service endpoints

### Weekly Tasks
- [ ] Clean up unused images and volumes
- [ ] Review container security scans
- [ ] Test backup and restore procedures
- [ ] Update container resource allocations if needed

### Monthly Tasks
- [ ] Update base images to latest security patches
- [ ] Review and optimize Dockerfile configurations
- [ ] Conduct disaster recovery testing
- [ ] Audit container access and permissions

### Container Cleanup

#### Regular Cleanup Script
```bash
# Create cleanup script
cat > scripts/docker-cleanup.sh << 'EOF'
#!/bin/bash

echo "🧹 Starting Docker cleanup..."

# Remove stopped containers
echo "🗑️ Removing stopped containers..."
docker container prune -f

# Remove unused images
echo "🗑️ Removing unused images..."
docker image prune -f

# Remove unused volumes
echo "🗑️ Removing unused volumes..."
docker volume prune -f

# Remove unused networks
echo "🗑️ Removing unused networks..."
docker network prune -f

# Clean up build cache
echo "🗑️ Cleaning build cache..."
docker builder prune -f

echo "✅ Docker cleanup completed"
docker system df
EOF

chmod +x scripts/docker-cleanup.sh

# Schedule cleanup
echo "0 2 * * 0 /path/to/scripts/docker-cleanup.sh >> /var/log/docker-cleanup.log 2>&1" | crontab -
```

---

**Last Updated**: $(date +%Y-%m-%d)  
**Review Schedule**: Monthly  
**Contact**: DevOps Team (devops@company.com)