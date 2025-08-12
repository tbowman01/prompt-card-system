# Deployment Architecture Documentation

## Table of Contents

1. [Overview](#overview)
2. [Production Architecture](#production-architecture)
3. [Container Strategy](#container-strategy)
4. [Infrastructure Components](#infrastructure-components)
5. [Security Architecture](#security-architecture)
6. [Monitoring & Observability](#monitoring--observability)
7. [Scaling Strategies](#scaling-strategies)
8. [Disaster Recovery](#disaster-recovery)

## Overview

The Prompt Card System deployment architecture is designed for high availability, scalability, and security. It follows cloud-native principles with containerization, infrastructure as code, and comprehensive monitoring.

### Deployment Environments

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Environment Pipeline                         │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                ┌───────────────────┼───────────────────┐
                │                   │                   │
                ▼                   ▼                   ▼
        ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
        │   Development   │ │     Staging     │ │   Production    │
        │                 │ │                 │ │                 │
        │ • Local Docker  │ │ • AWS/GCP       │ │ • Multi-region  │
        │ • Hot reload    │ │ • Full stack    │ │ • HA setup      │
        │ • Debug mode    │ │ • Load testing  │ │ • Auto-scaling  │
        │ • Mock services │ │ • Integration   │ │ • Monitoring    │
        └─────────────────┘ └─────────────────┘ └─────────────────┘
```

## Production Architecture

### High-Level Infrastructure

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Internet                                  │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      CDN + WAF                                     │
│                   (CloudFlare/AWS)                                 │
├─────────────────────────────────────────────────────────────────────┤
│ • Global Edge Caching    • DDoS Protection                         │
│ • SSL Termination        • Rate Limiting                           │
│ • Geographic Routing     • Bot Detection                           │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   Load Balancer                                    │
│                  (NGINX/HAProxy)                                   │
├─────────────────────────────────────────────────────────────────────┤
│ • Health Checks          • SSL Passthrough                         │
│ • Session Affinity       • Request Routing                         │
│ • Circuit Breaker        • Compression                             │
└─────────────┬───────────────────┬───────────────────┬───────────────┘
              │                   │                   │
              ▼                   ▼                   ▼
    ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
    │ Frontend Cluster│  │ Backend Cluster │  │  AI/LLM Cluster │
    │                 │  │                 │  │                 │
    │ • Next.js Apps  │  │ • Node.js APIs  │  │ • Ollama        │
    │ • Static Assets │  │ • WebSocket     │  │ • GPU Workers   │
    │ • React SSR     │  │ • Queue Workers │  │ • Model Cache   │
    └─────────────────┘  └─────────────────┘  └─────────────────┘
              │                   │                   │
              └─────────────┬─────────────────┬───────┘
                          │                 │
                          ▼                 ▼
              ┌─────────────────────────────────────────┐
              │            Data Layer                   │
              ├─────────────────────────────────────────┤
              │ PostgreSQL Cluster  │  Redis Cluster    │
              │ • Primary/Replica   │  • Sentinel       │
              │ • Auto-failover     │  • Clustering     │
              │ • Backup/Restore    │  • Persistence    │
              └─────────────────────────────────────────┘
```

## Container Strategy

### Multi-stage Docker Architecture

#### Frontend Dockerfile (Next.js)

```dockerfile
# Multi-stage build for optimal image size and performance
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# Dependencies stage - cached layer
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production --ignore-scripts && npm cache clean --force

# Builder stage - compile TypeScript and build
FROM base AS builder
COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN npm run build

# Runtime stage - minimal production image
FROM node:20-alpine AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Security hardening
RUN chown -R nextjs:nodejs /app
USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "server.js"]
```

#### Backend Dockerfile (Node.js)

```dockerfile
# Multi-stage build with security hardening
FROM node:20-alpine AS base
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    freetype-dev

# Dependencies stage
FROM base AS deps
COPY package*.json ./
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=true
RUN npm ci --only=production --ignore-scripts && npm cache clean --force

# Builder stage
FROM base AS builder
COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN npm run build && npm prune --production

# Runtime stage
FROM node:20-alpine AS runner
WORKDIR /app

# Security: Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S backend -u 1001

# Install runtime dependencies only
RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    giflib \
    pixman \
    freetype

# Copy application files
COPY --from=builder --chown=backend:nodejs /app/dist ./dist
COPY --from=builder --chown=backend:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=backend:nodejs /app/package*.json ./

# Security hardening
USER backend

# Health check
HEALTHCHECK --interval=30s --timeout=15s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3001/api/health/comprehensive || exit 1

EXPOSE 3001
ENV NODE_ENV=production
CMD ["npm", "start"]
```

### Docker Compose Production Configuration

```yaml
version: '3.8'

x-common-variables: &common-variables
  NODE_ENV: production
  LOG_LEVEL: info
  MONITORING_ENABLED: "true"

x-restart-policy: &restart-policy
  restart: unless-stopped

x-health-check: &health-check
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s

services:
  # Reverse Proxy & Load Balancer
  nginx:
    image: nginx:1.25-alpine
    container_name: prompt-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./nginx/logs:/var/log/nginx
      - nginx_cache:/var/cache/nginx
    depends_on:
      frontend:
        condition: service_healthy
      backend:
        condition: service_healthy
    networks:
      - prompt-network
    <<: *restart-policy
    healthcheck:
      test: ["CMD", "nginx", "-t"]
      <<: *health-check

  # Frontend Cluster (3 instances)
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      target: runner
      args:
        - BUILDKIT_INLINE_CACHE=1
      cache_from:
        - node:20-alpine
        - type=gha
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
    environment:
      <<: *common-variables
      NEXT_PUBLIC_API_URL: https://api.promptcard.ai
      NEXT_PUBLIC_WS_URL: wss://api.promptcard.ai
    networks:
      - prompt-network
    <<: *restart-policy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      <<: *health-check

  # Backend Cluster (5 instances)
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
      target: runner
    deploy:
      replicas: 5
      resources:
        limits:
          cpus: '2.0'
          memory: 1G
        reservations:
          cpus: '1.0'
          memory: 512M
    environment:
      <<: *common-variables
      PORT: 3001
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
      JWT_SECRET: ${JWT_SECRET}
      OLLAMA_BASE_URL: http://ollama:11434
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - prompt-network
    <<: *restart-policy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health/comprehensive"]
      <<: *health-check

  # Database Cluster (Primary + Replica)
  postgres:
    image: postgres:16-alpine
    container_name: prompt-postgres-primary
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_INITDB_ARGS: "--auth-host=md5"
      POSTGRES_REPLICATION_USER: ${POSTGRES_REPLICATION_USER}
      POSTGRES_REPLICATION_PASSWORD: ${POSTGRES_REPLICATION_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init:/docker-entrypoint-initdb.d:ro
      - ./database/config/postgresql.conf:/etc/postgresql/postgresql.conf:ro
    networks:
      - prompt-network
    ports:
      - "5432:5432"
    <<: *restart-policy
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      <<: *health-check
    command: >
      postgres
      -c config_file=/etc/postgresql/postgresql.conf
      -c wal_level=replica
      -c max_wal_senders=3
      -c max_replication_slots=3

  # PostgreSQL Read Replica
  postgres-replica:
    image: postgres:16-alpine
    container_name: prompt-postgres-replica
    environment:
      PGUSER: ${POSTGRES_REPLICATION_USER}
      POSTGRES_PASSWORD: ${POSTGRES_REPLICATION_PASSWORD}
      POSTGRES_MASTER_SERVICE: postgres
    volumes:
      - postgres_replica_data:/var/lib/postgresql/data
    networks:
      - prompt-network
    depends_on:
      postgres:
        condition: service_healthy
    <<: *restart-policy

  # Redis Cluster with Sentinel
  redis-master:
    image: redis:7.2-alpine
    container_name: prompt-redis-master
    command: >
      redis-server 
      --requirepass ${REDIS_PASSWORD}
      --bind 0.0.0.0
      --port 6379
      --tcp-backlog 511
      --timeout 0
      --tcp-keepalive 300
      --maxmemory 256mb
      --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    networks:
      - prompt-network
    <<: *restart-policy
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      <<: *health-check

  # Ollama AI Service with GPU Support
  ollama:
    image: ollama/ollama:latest
    container_name: prompt-ollama
    environment:
      OLLAMA_HOST: 0.0.0.0
      OLLAMA_ORIGINS: "*"
      OLLAMA_NUM_PARALLEL: 4
      OLLAMA_MAX_LOADED_MODELS: 3
    volumes:
      - ollama_models:/root/.ollama
    networks:
      - prompt-network
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
        limits:
          memory: 8G
    <<: *restart-policy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:11434/api/version"]
      <<: *health-check

volumes:
  postgres_data:
    driver: local
  postgres_replica_data:
    driver: local
  redis_data:
    driver: local
  ollama_models:
    driver: local
  nginx_cache:
    driver: local
  prometheus_data:
    driver: local
  grafana_data:
    driver: local
  jaeger_data:
    driver: local

networks:
  prompt-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.22.0.0/16
```

## Infrastructure Components

### NGINX Configuration

```nginx
# Production NGINX configuration
events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Performance optimizations
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 50M;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        application/javascript
        application/json
        application/xml
        text/css
        text/javascript
        text/xml
        text/plain;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=2r/s;

    # Upstream servers
    upstream frontend_servers {
        least_conn;
        server frontend_1:3000 max_fails=3 fail_timeout=30s;
        server frontend_2:3000 max_fails=3 fail_timeout=30s;
        server frontend_3:3000 max_fails=3 fail_timeout=30s;
    }

    upstream backend_servers {
        least_conn;
        server backend_1:3001 max_fails=3 fail_timeout=30s;
        server backend_2:3001 max_fails=3 fail_timeout=30s;
        server backend_3:3001 max_fails=3 fail_timeout=30s;
        server backend_4:3001 max_fails=3 fail_timeout=30s;
        server backend_5:3001 max_fails=3 fail_timeout=30s;
    }

    # HTTPS redirect
    server {
        listen 80;
        server_name promptcard.ai www.promptcard.ai;
        return 301 https://$server_name$request_uri;
    }

    # Main application server
    server {
        listen 443 ssl http2;
        server_name promptcard.ai www.promptcard.ai;

        # SSL configuration
        ssl_certificate /etc/nginx/ssl/promptcard.ai.crt;
        ssl_certificate_key /etc/nginx/ssl/promptcard.ai.key;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;

        # Security headers
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Content-Type-Options nosniff;
        add_header X-Frame-Options DENY;
        add_header X-XSS-Protection "1; mode=block";

        # Frontend routing
        location / {
            proxy_pass http://frontend_servers;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # API routing with rate limiting
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://backend_servers;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # WebSocket support
        location /socket.io/ {
            proxy_pass http://backend_servers;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
        }

        # Health checks (no rate limiting)
        location ~ ^/(api/health|health) {
            proxy_pass http://backend_servers;
            access_log off;
        }
    }
}
```

### Database Configuration

```sql
-- PostgreSQL production configuration
-- postgresql.conf optimizations

# Memory settings
shared_buffers = 256MB                  # 25% of system RAM
effective_cache_size = 1GB             # 50-75% of system RAM
work_mem = 64MB                        # Per connection work memory
maintenance_work_mem = 256MB           # Maintenance operations

# Checkpoint settings
checkpoint_completion_target = 0.9      # Spread checkpoints
wal_buffers = 16MB                     # WAL buffer size
max_wal_size = 2GB                     # Maximum WAL size
min_wal_size = 1GB                     # Minimum WAL size

# Connection settings
max_connections = 200                   # Maximum concurrent connections
shared_preload_libraries = 'pg_stat_statements'

# Performance settings
random_page_cost = 1.1                 # SSD optimization
effective_io_concurrency = 200         # SSD concurrent I/O
default_statistics_target = 100        # Statistics accuracy

# Logging
log_min_duration_statement = 1000      # Log slow queries (1s+)
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on
```

## Security Architecture

### Network Security

```yaml
# Docker network configuration with security
networks:
  prompt-network:
    driver: bridge
    driver_opts:
      com.docker.network.bridge.enable_icc: "false"
    ipam:
      config:
        - subnet: 172.22.0.0/16
          ip_range: 172.22.1.0/24

  database-network:
    driver: bridge
    internal: true  # No external access
    ipam:
      config:
        - subnet: 172.23.0.0/16
```

### Container Security

```dockerfile
# Security hardening in Dockerfile
FROM node:20-alpine AS security-hardened

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache dumb-init

# Create non-root user with minimal permissions
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Set file permissions
COPY --chown=appuser:appgroup . .
RUN chmod -R 755 /app && \
    chmod -R 700 /app/secrets

# Use read-only filesystem
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
RUN chmod 555 ./dist

# Security settings
USER appuser
EXPOSE 3001

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]
```

### Secrets Management

```bash
#!/bin/bash
# Secrets management with environment variables

# Production secrets (use external secret manager)
export DATABASE_URL="postgresql://user:$(cat /run/secrets/db_password)@postgres:5432/prompt_db"
export REDIS_URL="redis://:$(cat /run/secrets/redis_password)@redis:6379/0"
export JWT_SECRET="$(cat /run/secrets/jwt_secret)"

# API keys (mounted as secrets)
export OPENAI_API_KEY="$(cat /run/secrets/openai_api_key)"
export ANTHROPIC_API_KEY="$(cat /run/secrets/anthropic_api_key)"

# SSL certificates
export SSL_CERT_PATH="/run/secrets/ssl_cert"
export SSL_KEY_PATH="/run/secrets/ssl_key"
```

## Monitoring & Observability

### Prometheus Configuration

```yaml
# Monitoring stack configuration
prometheus:
  image: prom/prometheus:v2.45.0
  container_name: prompt-prometheus
  command:
    - '--config.file=/etc/prometheus/prometheus.yml'
    - '--storage.tsdb.path=/prometheus'
    - '--web.console.libraries=/etc/prometheus/console_libraries'
    - '--web.console.templates=/etc/prometheus/consoles'
    - '--storage.tsdb.retention.time=90d'
    - '--web.enable-lifecycle'
    - '--web.enable-admin-api'
  volumes:
    - ./monitoring/prometheus:/etc/prometheus:ro
    - prometheus_data:/prometheus
  networks:
    - prompt-network
  restart: unless-stopped

grafana:
  image: grafana/grafana:10.0.0
  container_name: prompt-grafana
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}
    - GF_USERS_ALLOW_SIGN_UP=false
    - GF_INSTALL_PLUGINS=redis-datasource,prometheus
    - GF_SECURITY_SECRET_KEY=${GRAFANA_SECRET_KEY}
  volumes:
    - grafana_data:/var/lib/grafana
    - ./monitoring/grafana:/etc/grafana/provisioning:ro
  depends_on:
    - prometheus
  networks:
    - prompt-network
```

### Health Check Implementation

```typescript
// Comprehensive health check system
interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime?: number;
  details?: any;
}

class HealthCheckService {
  async performHealthChecks(): Promise<HealthCheck[]> {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkOllama(),
      this.checkExternalAPIs(),
      this.checkDiskSpace(),
      this.checkMemoryUsage()
    ]);

    return checks.map((result, index) => {
      const names = ['database', 'redis', 'ollama', 'external_apis', 'disk_space', 'memory_usage'];
      
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          name: names[index],
          status: 'unhealthy',
          details: result.reason.message
        };
      }
    });
  }

  private async checkDatabase(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      await this.db.query('SELECT 1');
      return {
        name: 'database',
        status: 'healthy',
        responseTime: Date.now() - start
      };
    } catch (error) {
      return {
        name: 'database',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        details: error.message
      };
    }
  }
}
```

## Scaling Strategies

### Horizontal Pod Autoscaling

```yaml
# Kubernetes HPA configuration (future migration)
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: prompt-backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: prompt-backend
  minReplicas: 5
  maxReplicas: 50
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: custom_metric_active_connections
      target:
        type: AverageValue
        averageValue: "100"
```

### Database Scaling

```bash
#!/bin/bash
# Database scaling script

# Read replica creation
docker run -d \
  --name prompt-postgres-replica-2 \
  --network prompt-network \
  -e PGUSER=${POSTGRES_REPLICATION_USER} \
  -e POSTGRES_PASSWORD=${POSTGRES_REPLICATION_PASSWORD} \
  -e POSTGRES_MASTER_SERVICE=postgres \
  -v postgres_replica_2_data:/var/lib/postgresql/data \
  postgres:16-alpine

# Connection pooling with PgBouncer
docker run -d \
  --name pgbouncer \
  --network prompt-network \
  -e DATABASES_HOST=postgres \
  -e DATABASES_PORT=5432 \
  -e DATABASES_USER=${POSTGRES_USER} \
  -e DATABASES_PASSWORD=${POSTGRES_PASSWORD} \
  -e POOL_MODE=transaction \
  -e MAX_CLIENT_CONN=1000 \
  -e DEFAULT_POOL_SIZE=25 \
  pgbouncer/pgbouncer:latest
```

## Disaster Recovery

### Backup Strategy

```bash
#!/bin/bash
# Comprehensive backup script

BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
S3_BUCKET="prompt-card-backups"

# Database backup
pg_dump \
  --host=postgres \
  --port=5432 \
  --username=${POSTGRES_USER} \
  --dbname=${POSTGRES_DB} \
  --format=custom \
  --compress=9 \
  --verbose \
  --file="${BACKUP_DIR}/postgres_backup_${BACKUP_DATE}.dump"

# Redis backup
redis-cli --rdb "${BACKUP_DIR}/redis_backup_${BACKUP_DATE}.rdb"

# Application files backup
tar -czf "${BACKUP_DIR}/app_backup_${BACKUP_DATE}.tar.gz" \
  /app/uploads \
  /app/logs \
  /app/config

# Upload to S3
aws s3 cp "${BACKUP_DIR}/" "s3://${S3_BUCKET}/daily/${BACKUP_DATE}/" --recursive

# Cleanup old backups (keep 30 days)
find "${BACKUP_DIR}" -name "*.dump" -mtime +30 -delete
find "${BACKUP_DIR}" -name "*.rdb" -mtime +30 -delete
find "${BACKUP_DIR}" -name "*.tar.gz" -mtime +30 -delete
```

### Failover Procedures

```bash
#!/bin/bash
# Automated failover script

promote_replica_to_primary() {
    echo "Promoting replica to primary..."
    
    # Stop replica
    docker stop prompt-postgres-replica
    
    # Promote to primary
    docker exec prompt-postgres-replica \
        su - postgres -c "pg_ctl promote -D /var/lib/postgresql/data"
    
    # Update application config
    export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres-replica:5432/${POSTGRES_DB}"
    
    # Restart backend services
    docker-compose restart backend
    
    echo "Failover completed successfully"
}

# Health check and automatic failover
check_primary_health() {
    if ! docker exec postgres pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}; then
        echo "Primary database is unhealthy, initiating failover..."
        promote_replica_to_primary
        
        # Send alert
        curl -X POST "${SLACK_WEBHOOK_URL}" \
            -H 'Content-type: application/json' \
            --data '{"text":"🚨 Database failover completed - Primary database failed, replica promoted"}'
    fi
}
```

This deployment architecture provides a robust, scalable, and secure foundation for the Prompt Card System in production environments.