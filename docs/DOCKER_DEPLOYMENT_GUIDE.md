# 🐳 Docker Deployment Guide

**Version**: 2.0  
**Last Updated**: 2025-08-14  
**Status**: Production Ready

## 📋 Overview

The Prompt Card System provides enterprise-grade Docker containers published to GitHub Container Registry (GHCR), enabling easy deployment across development, staging, and production environments.

## 🏗️ Architecture

### Service Architecture:
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   NGINX     │    │  Frontend   │    │   Backend   │
│   Proxy     │───▶│   (Next.js) │───▶│  (Node.js)  │
│             │    │             │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
                                              │
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    Auth     │    │    Redis    │    │   Ollama    │
│  Service    │    │   Cache     │    │    LLM      │
│             │    │             │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
```

## 📦 Available Images

All images are published to **GitHub Container Registry** and are ready for production use:

### Core Services:
- **Frontend**: `ghcr.io/tbowman01/prompt-card-system-frontend:latest`
- **Backend**: `ghcr.io/tbowman01/prompt-card-system-backend:latest`
- **Auth Service**: `ghcr.io/tbowman01/prompt-card-system-auth:latest`
- **Ollama LLM**: `ghcr.io/tbowman01/prompt-card-system-ollama:latest`

### Image Features:
- ✅ **Multi-stage builds** for optimized size
- ✅ **Security scanning** with Trivy
- ✅ **Non-root user** execution
- ✅ **Health checks** built-in
- ✅ **Production optimized** with BuildKit
- ✅ **Provenance & SBOM** attestations

## 🚀 Quick Start

### 1. Using Pre-built Images (Recommended)

```bash
# Clone the repository for configuration files
git clone https://github.com/tbowman01/prompt-card-system.git
cd prompt-card-system

# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env

# Start with GitHub Container Registry images
docker-compose -f docker-compose.ghcr.yml up -d
```

### 2. Building Locally

```bash
# Development build
docker-compose -f docker-compose.dev.yml up -d

# Production build
docker-compose -f docker-compose.prod.yml up -d
```

## ⚙️ Configuration

### Environment Variables (.env)

```bash
# === CORE CONFIGURATION ===
NODE_ENV=production
LOG_LEVEL=info

# === SERVICE IMAGES ===
BACKEND_IMAGE=ghcr.io/tbowman01/prompt-card-system-backend:latest
FRONTEND_IMAGE=ghcr.io/tbowman01/prompt-card-system-frontend:latest  
AUTH_IMAGE=ghcr.io/tbowman01/prompt-card-system-auth:latest
OLLAMA_IMAGE=ghcr.io/tbowman01/prompt-card-system-ollama:latest

# === NETWORK CONFIGURATION ===
FRONTEND_PORT=3000
BACKEND_PORT=3001
AUTH_PORT=8005
OLLAMA_PORT=11434
NGINX_HTTP_PORT=80
NGINX_HTTPS_PORT=443

# === API URLS ===
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
NEXT_PUBLIC_AUTH_URL=http://localhost:8005

# === DATABASE ===
DATABASE_URL=sqlite:./data/database.sqlite
AUTH_DATABASE_URL=sqlite:./data/auth.sqlite

# === REDIS CACHE ===
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=your-redis-password-change-in-production

# === SECURITY ===
JWT_SECRET=your-jwt-secret-change-in-production-min-32-chars
ENCRYPTION_KEY=your-32-character-encryption-key-here
SESSION_SECRET=your-session-secret-change-in-production

# === LLM CONFIGURATION ===
OLLAMA_HOST=http://ollama:11434
OLLAMA_ORIGINS=*
OLLAMA_NUM_PARALLEL=2
OLLAMA_MEMORY_LIMIT=8G
DOWNLOAD_ADDITIONAL_MODELS=true

# === MONITORING ===
MONITORING_ENABLED=true
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=your-grafana-password
GRAFANA_SECRET_KEY=your-grafana-secret-key
GRAFANA_ROOT_URL=http://localhost:3000/grafana

# === CORS & SECURITY ===
CORS_ORIGIN=http://localhost:3000
API_RATE_LIMIT=1000
```

### Production Security Configuration

```bash
# Generate secure secrets
openssl rand -base64 32  # For JWT_SECRET
openssl rand -base64 32  # For ENCRYPTION_KEY  
openssl rand -base64 32  # For SESSION_SECRET
openssl rand -base64 32  # For GRAFANA_SECRET_KEY
```

## 📋 Docker Compose Configurations

### Development (docker-compose.dev.yml)
- **Purpose**: Local development with hot reloading
- **Features**: Volume mounts, debug ports, dev dependencies
- **Database**: SQLite with local volume
- **Monitoring**: Basic health checks

### Production (docker-compose.prod.yml)  
- **Purpose**: Full production deployment
- **Features**: PostgreSQL, Redis, NGINX, monitoring stack
- **Database**: PostgreSQL with clustering
- **Monitoring**: Prometheus, Grafana, Jaeger, Loki

### GitHub Container Registry (docker-compose.ghcr.yml)
- **Purpose**: Production with pre-built images
- **Features**: Fast deployment, no build time
- **Images**: Latest stable images from GHCR
- **Monitoring**: Prometheus & Grafana included

## 🎯 Deployment Scenarios

### 1. Local Development
```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop and cleanup
docker-compose -f docker-compose.dev.yml down -v
```

### 2. Production Deployment
```bash
# Pre-deployment checklist
./scripts/production/production-test.sh

# Deploy with monitoring
docker-compose -f docker-compose.ghcr.yml up -d

# Health check
curl http://localhost:3000
curl http://localhost:3001/health
curl http://localhost:8005/auth/health
curl http://localhost:11434/api/version

# Monitor deployment
docker-compose -f docker-compose.ghcr.yml ps
```

### 3. Staging Environment
```bash
# Use specific image tags for staging
export BACKEND_IMAGE=ghcr.io/tbowman01/prompt-card-system-backend:develop
export FRONTEND_IMAGE=ghcr.io/tbowman01/prompt-card-system-frontend:develop

docker-compose -f docker-compose.ghcr.yml up -d
```

### 4. Cloud Deployment (AWS/GCP/Azure)
```bash
# Pull images to container registry
docker pull ghcr.io/tbowman01/prompt-card-system-backend:latest
docker tag ghcr.io/tbowman01/prompt-card-system-backend:latest your-registry/backend:latest
docker push your-registry/backend:latest

# Use cloud-specific configuration
docker-compose -f docker-compose.cloud.yml up -d
```

## 🔍 Health Checks & Monitoring

### Built-in Health Endpoints:
- **Frontend**: `http://localhost:3000` (Next.js ready check)
- **Backend**: `http://localhost:3001/health` (API health + DB status)
- **Auth**: `http://localhost:8005/auth/health` (Authentication service)
- **Ollama**: `http://localhost:11434/api/version` (LLM service status)

### Monitoring Stack:
- **Prometheus**: `http://localhost:9090` (Metrics collection)
- **Grafana**: `http://localhost:3000/grafana` (Visualization)
- **Logs**: Docker logs + Loki aggregation

### Health Check Commands:
```bash
# Check all services
docker-compose -f docker-compose.ghcr.yml ps

# Service-specific health
docker exec prompt-frontend wget --no-verbose --tries=1 --spider http://localhost:3000
docker exec prompt-backend wget --no-verbose --tries=1 --spider http://localhost:3001/health
docker exec prompt-auth wget --no-verbose --tries=1 --spider http://localhost:8005/auth/health
docker exec prompt-ollama curl -f http://localhost:11434/api/version
```

## 🔒 Security Features

### Image Security:
- ✅ **Non-root execution**: All services run as unprivileged users
- ✅ **Minimal base images**: Alpine Linux for reduced attack surface
- ✅ **Security scanning**: Trivy scans during CI/CD
- ✅ **Provenance**: SBOM and build attestations
- ✅ **Multi-stage builds**: Exclude dev dependencies from runtime

### Runtime Security:
- ✅ **Network isolation**: Services communicate via private network
- ✅ **Secrets management**: Environment-based configuration
- ✅ **Rate limiting**: Built-in API rate limiting
- ✅ **CORS protection**: Configurable cross-origin policies
- ✅ **Health monitoring**: Automatic restart on failures

### Production Hardening:
```bash
# Remove npm from production containers
RUN rm -rf /usr/local/lib/node_modules/npm

# Use read-only root filesystem
docker run --read-only --tmpfs /tmp ghcr.io/tbowman01/prompt-card-system-backend:latest

# Drop capabilities
docker run --cap-drop=ALL ghcr.io/tbowman01/prompt-card-system-backend:latest
```

## ⚡ Performance Optimization

### Image Size Optimization:
- **Backend**: ~150MB (optimized Node.js Alpine)
- **Frontend**: ~120MB (Next.js standalone)
- **Auth**: ~100MB (minimal Node.js service)
- **Total**: < 500MB for all services

### Build Performance:
- **BuildKit caching**: Layer caching with GitHub Actions
- **Multi-stage builds**: Separate build and runtime stages
- **Dependency optimization**: Production-only dependencies
- **Parallel builds**: Services build concurrently

### Runtime Performance:
```bash
# Configure resource limits
docker-compose -f docker-compose.ghcr.yml up -d
# Resources configured in compose file:
# - Backend: 512MB RAM limit
# - Frontend: 256MB RAM limit  
# - Auth: 128MB RAM limit
# - Ollama: 8GB RAM limit (configurable)
```

## 🧪 Testing

### Container Testing:
```bash
# Test all services start correctly
./scripts/docker-production-test.sh

# Test health endpoints
curl -f http://localhost:3000 || exit 1
curl -f http://localhost:3001/health || exit 1
curl -f http://localhost:8005/auth/health || exit 1
curl -f http://localhost:11434/api/version || exit 1

# Test database connectivity
docker exec prompt-backend npm run db:test

# Test API endpoints
curl -X POST http://localhost:3001/api/prompt-cards \
  -H "Content-Type: application/json" \
  -d '{"title": "Test", "content": "Test prompt"}'
```

### Load Testing:
```bash
# Run load tests
docker run --rm -i grafana/k6 run --vus 10 --duration 30s - < loadtest.js

# Monitor performance
docker stats prompt-backend prompt-frontend prompt-auth
```

## 🚨 Troubleshooting

### Common Issues:

#### 1. **Service Won't Start**
```bash
# Check logs
docker-compose logs service-name

# Check health status
docker inspect --format='{{json .State.Health}}' container-name

# Restart specific service
docker-compose restart service-name
```

#### 2. **Database Connection Issues**
```bash
# Check SQLite database file
ls -la data/
# Database should exist with proper permissions

# Test database connection
docker exec prompt-backend npm run db:check
```

#### 3. **Memory Issues**
```bash
# Check memory usage
docker stats

# Adjust memory limits in docker-compose.yml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 1G  # Increase if needed
```

#### 4. **Port Conflicts**
```bash
# Check port usage
netstat -tulpn | grep :3000

# Change ports in .env file
FRONTEND_PORT=3001
BACKEND_PORT=3002
```

#### 5. **Image Pull Issues**
```bash
# Login to GitHub Container Registry
echo "$GITHUB_TOKEN" | docker login ghcr.io -u USERNAME --password-stdin

# Pull specific image
docker pull ghcr.io/tbowman01/prompt-card-system-backend:latest

# Use local build as fallback
docker-compose -f docker-compose.dev.yml up --build
```

### Debug Commands:
```bash
# Access container shell
docker exec -it prompt-backend sh
docker exec -it prompt-frontend sh

# Check environment variables
docker exec prompt-backend env

# View container logs in real-time
docker logs -f prompt-backend

# Inspect container configuration  
docker inspect prompt-backend

# Check network connectivity
docker exec prompt-backend ping redis
docker exec prompt-backend ping ollama
```

## 📊 Monitoring & Observability

### Metrics Collection:
- **Application Metrics**: Custom business metrics
- **System Metrics**: CPU, memory, disk, network
- **Container Metrics**: Docker stats and events
- **Database Metrics**: Query performance and connections

### Log Aggregation:
- **Structured Logging**: JSON format with correlation IDs
- **Centralized Collection**: Loki + Promtail
- **Log Retention**: 30 days (configurable)
- **Search & Filtering**: Grafana Explore interface

### Alerting:
```yaml
# Example Prometheus Alert Rules
groups:
- name: prompt-card-system
  rules:
  - alert: ServiceDown
    expr: up{job="prompt-card-system"} == 0
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "Service {{ $labels.instance }} is down"
```

## 🔄 Updates & Maintenance

### Image Updates:
```bash
# Pull latest images
docker-compose -f docker-compose.ghcr.yml pull

# Recreate containers with new images
docker-compose -f docker-compose.ghcr.yml up -d

# Remove old images
docker image prune -f
```

### Database Migrations:
```bash
# Run database migrations
docker exec prompt-backend npm run db:migrate

# Backup before major updates
docker exec prompt-backend npm run db:backup
```

### Health Maintenance:
```bash
# Weekly cleanup
docker system prune -f
docker volume prune -f

# Monthly image updates
docker-compose pull && docker-compose up -d
```

## 📚 Additional Resources

### Documentation:
- [Docker Compose Reference](https://docs.docker.com/compose/)
- [Next.js Docker Deployment](https://nextjs.org/docs/deployment/docker)
- [Node.js Docker Best Practices](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)

### Related Guides:
- [Production Deployment Guide](./PRODUCTION_DEPLOYMENT.md)
- [Security Best Practices](./SECURITY.md)
- [Monitoring Setup](./MONITORING_SETUP_GUIDE.md)
- [Backup & Recovery](../operations/backup-restore.md)

---

## 🎯 Quick Reference

### Essential Commands:
```bash
# Start production environment
docker-compose -f docker-compose.ghcr.yml up -d

# View service status  
docker-compose ps

# View logs
docker-compose logs -f service-name

# Stop all services
docker-compose down

# Update and restart
docker-compose pull && docker-compose up -d

# Health check
curl http://localhost:3000/health
```

### Service URLs:
- **Application**: http://localhost:3000
- **API**: http://localhost:3001  
- **Auth**: http://localhost:8005
- **LLM**: http://localhost:11434
- **Monitoring**: http://localhost:3000/grafana

For additional support, see the troubleshooting section or create an issue in the repository.