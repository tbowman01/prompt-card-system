# Docker Deployment Guide

This guide covers deploying the Prompt Card System using Docker containers, including development, staging, and production configurations.

## 🚀 Quick Start

### Development Environment
```bash
# Clone the repository
git clone https://github.com/tbowman01/prompt-card-system.git
cd prompt-card-system

# Start development environment
docker compose -f docker-compose.dev.yml up -d

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:3001
# API Docs: http://localhost:3001/api/docs
```

### Production Environment
```bash
# Start production environment
docker compose -f docker-compose.prod.yml up -d

# Check health
curl http://localhost:3001/api/health
```

## 📋 Prerequisites

- **Docker**: Version 24.0+ with BuildKit support
- **Docker Compose**: Version 2.20+
- **System Requirements**:
  - 4GB+ RAM
  - 20GB+ disk space
  - Multi-core CPU recommended

### Verify Installation
```bash
# Check Docker version
docker --version
docker compose version

# Enable BuildKit (if not already enabled)
export DOCKER_BUILDKIT=1
```

## 🏗️ Container Architecture

```mermaid
graph TB
    LB[Load Balancer<br/>nginx:alpine] --> FE[Frontend<br/>Node.js 20-alpine]
    LB --> BE[Backend API<br/>Node.js 20-alpine]
    BE --> DB[(Database<br/>PostgreSQL 15)]
    BE --> REDIS[(Cache<br/>Redis 7-alpine)]
    BE --> OLLAMA[LLM Service<br/>Ollama]
    
    MON[Monitoring Stack]
    MON --> PROM[Prometheus]
    MON --> GRAF[Grafana]
    MON --> JAEGER[Jaeger]
```

### Container Specifications

| Service | Base Image | Purpose | Resources |
|---------|------------|---------|-----------|
| **Frontend** | `node:20-alpine` | Next.js application | 512MB RAM |
| **Backend** | `node:20-alpine` | Express.js API server | 1GB RAM |
| **Database** | `postgres:15-alpine` | Primary data storage | 2GB RAM |
| **Redis** | `redis:7-alpine` | Caching & sessions | 256MB RAM |
| **Nginx** | `nginx:alpine` | Load balancer & reverse proxy | 128MB RAM |
| **Ollama** | `ollama/ollama:latest` | Local LLM inference | 4GB+ RAM |

## 🔧 Configuration Files

### docker-compose.yml (Base)
```yaml
version: '3.8'

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=http://backend:3001
    depends_on:
      - backend

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/promptdb
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=promptdb
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init:/docker-entrypoint-initdb.d

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### docker-compose.dev.yml (Development)
```yaml
version: '3.8'

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
      target: development
    volumes:
      - ./frontend:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - NEXT_PUBLIC_API_URL=http://localhost:3001
    ports:
      - "3000:3000"

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
      target: development
    volumes:
      - ./backend:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/promptdb_dev
    ports:
      - "3001:3001"
      - "9229:9229"  # Debug port

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=promptdb_dev
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    ports:
      - "5432:5432"  # Expose for development

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"  # Expose for development
```

### docker-compose.prod.yml (Production)
```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - frontend
      - backend

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
      target: production
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=https://api.your-domain.com
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
      target: production
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/promptdb
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=promptdb
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/backup:/backup
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## 🔐 Environment Configuration

### .env.example
```bash
# Application
NODE_ENV=production
API_BASE_URL=https://api.your-domain.com

# Database
POSTGRES_PASSWORD=your-secure-password
DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/promptdb

# Redis
REDIS_URL=redis://redis:6379

# Security
JWT_SECRET=your-jwt-secret-key
ENCRYPTION_KEY=your-encryption-key

# AI Providers
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
OLLAMA_BASE_URL=http://ollama:11434

# Monitoring
PROMETHEUS_ENABLED=true
JAEGER_ENDPOINT=http://jaeger:14268/api/traces
SENTRY_DSN=your-sentry-dsn

# Email (optional)
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=your-email@domain.com
SMTP_PASS=your-email-password
```

### Production Environment Setup
```bash
# Copy and customize environment file
cp .env.example .env.prod

# Generate secure secrets
openssl rand -base64 32  # For JWT_SECRET
openssl rand -base64 32  # For ENCRYPTION_KEY
openssl rand -base64 16  # For POSTGRES_PASSWORD

# Edit the production environment file
nano .env.prod
```

## 🚀 Deployment Commands

### Development Deployment
```bash
# Start development environment
docker compose -f docker-compose.dev.yml up -d

# View logs
docker compose -f docker-compose.dev.yml logs -f

# Rebuild after changes
docker compose -f docker-compose.dev.yml up -d --build

# Stop development environment
docker compose -f docker-compose.dev.yml down
```

### Production Deployment
```bash
# Build and start production environment
docker compose -f docker-compose.prod.yml up -d --build

# Check service status
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f backend

# Update specific service
docker compose -f docker-compose.prod.yml up -d --build backend

# Scale services
docker compose -f docker-compose.prod.yml up -d --scale backend=3
```

### Monitoring Stack
```bash
# Start with monitoring
docker compose -f docker-compose.prod.yml -f docker-compose.monitoring.yml up -d

# Access monitoring dashboards
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3100 (admin/admin)
# Jaeger: http://localhost:16686
```

## 📊 Health Checks & Monitoring

### Health Check Endpoints
```bash
# Application health
curl http://localhost:3001/api/health

# Detailed health with dependencies
curl http://localhost:3001/api/health/detailed

# Container health status
docker compose ps
```

### Monitoring Commands
```bash
# View container resource usage
docker stats

# Check container logs
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres

# Execute commands in containers
docker compose exec backend npm run db:migrate
docker compose exec postgres psql -U postgres -d promptdb
```

## 🔧 Optimization Configurations

### Multi-stage Dockerfile (Backend)
```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM node:20-alpine AS production
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
WORKDIR /app

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs . .

# Security configurations
RUN chmod -R 755 /app
USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

EXPOSE 3001
CMD ["npm", "start"]
```

### Nginx Configuration
```nginx
upstream frontend {
    server frontend:3000;
}

upstream backend {
    server backend:3001;
}

server {
    listen 80;
    server_name your-domain.com;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    # Frontend routing
    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API routing
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support
    location /ws/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## 🛡️ Security Hardening

### Docker Security Best Practices
```yaml
# docker-compose.security.yml
version: '3.8'

services:
  backend:
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
    read_only: true
    tmpfs:
      - /tmp
    user: "1001:1001"
    
  postgres:
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    tmpfs:
      - /tmp
      - /var/run/postgresql
```

### Network Security
```yaml
networks:
  frontend_network:
    driver: bridge
    internal: false
  backend_network:
    driver: bridge
    internal: true
  database_network:
    driver: bridge
    internal: true
```

## 📦 GitHub Container Registry (GHCR) Integration

### Build and Push to GHCR
```bash
# Login to GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u $GITHUB_USERNAME --password-stdin

# Build with platform support
docker buildx build --platform linux/amd64,linux/arm64 \
  -t ghcr.io/tbowman01/prompt-card-system/backend:latest \
  -t ghcr.io/tbowman01/prompt-card-system/backend:$VERSION \
  --push ./backend

# Pull from GHCR
docker pull ghcr.io/tbowman01/prompt-card-system/backend:latest
```

### GHCR Docker Compose
```yaml
version: '3.8'

services:
  frontend:
    image: ghcr.io/tbowman01/prompt-card-system/frontend:latest
    ports:
      - "3000:3000"

  backend:
    image: ghcr.io/tbowman01/prompt-card-system/backend:latest
    ports:
      - "3001:3001"
```

## 🔄 Backup & Recovery

### Database Backup
```bash
# Create backup
docker compose exec postgres pg_dump -U postgres promptdb > backup_$(date +%Y%m%d_%H%M%S).sql

# Automated backup script
#!/bin/bash
BACKUP_DIR="/backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker compose exec postgres pg_dump -U postgres promptdb > $BACKUP_DIR/backup_$TIMESTAMP.sql
gzip $BACKUP_DIR/backup_$TIMESTAMP.sql
```

### Recovery Process
```bash
# Restore from backup
docker compose exec postgres psql -U postgres -d promptdb < backup_20240116_100000.sql

# Volume backup
docker run --rm -v prompt-card-system_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_data_backup.tar.gz -C /data .
```

## 🚨 Troubleshooting

### Common Issues

#### Port Conflicts
```bash
# Check which process is using a port
lsof -i :3000
netstat -tulpn | grep 3000

# Kill process using port
kill -9 $(lsof -t -i:3000)
```

#### Container Memory Issues
```bash
# Check container resource usage
docker stats

# Increase memory limits
# Add to docker-compose.yml:
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G
```

#### Database Connection Issues
```bash
# Test database connection
docker compose exec backend npm run db:test

# Check database logs
docker compose logs postgres

# Connect to database directly
docker compose exec postgres psql -U postgres -d promptdb
```

### Debug Commands
```bash
# Enter container shell
docker compose exec backend sh
docker compose exec frontend sh

# View container configuration
docker compose config

# Restart specific service
docker compose restart backend

# View resource usage
docker system df
docker system prune  # Clean up unused resources
```

## 📈 Performance Tuning

### Resource Optimization
```yaml
# docker-compose.optimized.yml
version: '3.8'

services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G
    environment:
      - NODE_OPTIONS=--max-old-space-size=1536
      - UV_THREADPOOL_SIZE=16

  postgres:
    command: >
      postgres
      -c max_connections=200
      -c shared_buffers=256MB
      -c effective_cache_size=1GB
      -c maintenance_work_mem=64MB
      -c checkpoint_completion_target=0.9
      -c wal_buffers=16MB
      -c default_statistics_target=100
```

### Caching Configuration
```yaml
services:
  redis:
    command: >
      redis-server
      --maxmemory 512mb
      --maxmemory-policy allkeys-lru
      --save 900 1
      --save 300 10
      --save 60 10000
```

---

## 🆘 Support

- **📖 Docker Documentation**: [Docker Official Docs](https://docs.docker.com/)
- **🐛 Report Issues**: [GitHub Issues](https://github.com/tbowman01/prompt-card-system/issues)
- **💬 Community**: [Discord Server](https://discord.gg/prompt-card-system)
- **📧 Email**: docker-support@prompt-card-system.com

## 📚 Additional Resources

- [Docker Compose File Reference](https://docs.docker.com/compose/compose-file/)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/security/)
- [GHCR Documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)