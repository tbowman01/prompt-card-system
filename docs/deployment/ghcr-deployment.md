# GitHub Container Registry (GHCR) Deployment Guide

## Overview

This guide covers deploying the Prompt Card System using GitHub Container Registry (GHCR) for container storage and automated deployments with GitHub Actions.

## GitHub Container Registry Setup

### 1. Repository Configuration

#### Enable GitHub Packages
1. Navigate to your repository settings
2. Go to "Actions" → "General"
3. Ensure "Read and write permissions" are enabled for GITHUB_TOKEN
4. Enable "Allow GitHub Actions to create and approve pull requests"

#### Configure Secrets
Add the following secrets in repository settings:
```bash
# Required secrets
GHCR_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx  # Personal Access Token with packages:write
DOCKER_USERNAME=your-github-username
DOCKER_PASSWORD=your-github-token

# Optional for production deployments
PRODUCTION_SERVER=your.production.server
PRODUCTION_SSH_KEY=-----BEGIN OPENSSH PRIVATE KEY-----
```

### 2. Container Registry Authentication

#### GitHub Actions Authentication
```yaml
# .github/workflows/docker-publish.yml
name: Build and Publish Docker Images

on:
  push:
    branches: [main, develop]
    tags: ['v*.*.*']
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_BASE: ${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    strategy:
      matrix:
        service: [frontend, backend, auth]

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_BASE }}/${{ matrix.service }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=semver,pattern={{major}}
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./${{ matrix.service }}/Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          platforms: linux/amd64,linux/arm64
```

#### Local Authentication
```bash
# Login to GHCR
echo $GHCR_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Or using GitHub CLI
gh auth token | docker login ghcr.io -u USERNAME --password-stdin
```

## Container Image Management

### 1. Image Naming Convention
```bash
# Base format
ghcr.io/owner/repository/service:tag

# Examples
ghcr.io/tbowman01/prompt-card-system/frontend:latest
ghcr.io/tbowman01/prompt-card-system/backend:v1.2.3
ghcr.io/tbowman01/prompt-card-system/auth:main
```

### 2. Multi-Architecture Builds
```dockerfile
# Updated Dockerfile with multi-arch support
FROM --platform=$BUILDPLATFORM node:20-alpine AS base
WORKDIR /app

# Build stage
FROM base AS builder
# ... build steps

# Production stage
FROM node:20-alpine AS runner
# ... production setup
```

### 3. Image Optimization
```bash
# Build with optimization flags
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --cache-from type=gha \
  --cache-to type=gha,mode=max \
  --push \
  -t ghcr.io/tbowman01/prompt-card-system/frontend:latest \
  ./frontend
```

## Automated Deployment Pipeline

### 1. Complete CI/CD Workflow
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    tags: ['v*.*.*']
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deployment environment'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - production

env:
  REGISTRY: ghcr.io
  IMAGE_BASE: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm run test:ci
      
      - name: Run integration tests
        run: npm run test:integration:ci

  build:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    
    outputs:
      frontend-image: ${{ steps.frontend-meta.outputs.tags }}
      backend-image: ${{ steps.backend-meta.outputs.tags }}
      auth-image: ${{ steps.auth-meta.outputs.tags }}

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract frontend metadata
        id: frontend-meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_BASE }}/frontend
          tags: |
            type=ref,event=tag
            type=raw,value=latest

      - name: Build and push frontend
        uses: docker/build-push-action@v5
        with:
          context: ./frontend
          push: true
          tags: ${{ steps.frontend-meta.outputs.tags }}
          labels: ${{ steps.frontend-meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          platforms: linux/amd64,linux/arm64

      - name: Extract backend metadata
        id: backend-meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_BASE }}/backend

      - name: Build and push backend
        uses: docker/build-push-action@v5
        with:
          context: ./backend
          push: true
          tags: ${{ steps.backend-meta.outputs.tags }}
          labels: ${{ steps.backend-meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          platforms: linux/amd64,linux/arm64

      - name: Extract auth metadata
        id: auth-meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_BASE }}/auth

      - name: Build and push auth
        uses: docker/build-push-action@v5
        with:
          context: ./auth
          push: true
          tags: ${{ steps.auth-meta.outputs.tags }}
          labels: ${{ steps.auth-meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          platforms: linux/amd64,linux/arm64

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment || 'production' }}
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup kubectl
        uses: azure/setup-kubectl@v3
        with:
          version: 'latest'

      - name: Deploy to staging
        if: ${{ github.event.inputs.environment == 'staging' }}
        run: |
          echo "Deploying to staging environment..."
          # Add staging deployment commands

      - name: Deploy to production
        if: ${{ github.event.inputs.environment == 'production' || github.ref_type == 'tag' }}
        run: |
          echo "Deploying to production environment..."
          # Add production deployment commands

      - name: Notify deployment
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          channel: '#deployments'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### 2. Docker Compose for Production
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  frontend:
    image: ghcr.io/tbowman01/prompt-card-system/frontend:${TAG:-latest}
    ports:
      - "80:3000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=${API_URL}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - app-network

  backend:
    image: ghcr.io/tbowman01/prompt-card-system/backend:${TAG:-latest}
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
    volumes:
      - app-data:/app/data
      - app-logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - app-network
    depends_on:
      - database

  auth:
    image: ghcr.io/tbowman01/prompt-card-system/auth:${TAG:-latest}
    ports:
      - "3002:3002"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3002/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - app-network
    depends_on:
      - database

  database:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=${DB_NAME}
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./database/init:/docker-entrypoint-initdb.d
    restart: unless-stopped
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
    restart: unless-stopped
    networks:
      - app-network

  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/certs:/etc/nginx/certs:ro
    restart: unless-stopped
    networks:
      - app-network
    depends_on:
      - frontend
      - backend
      - auth

networks:
  app-network:
    driver: bridge

volumes:
  app-data:
  app-logs:
  postgres-data:
  redis-data:
```

## Production Deployment

### 1. Server Setup
```bash
#!/bin/bash
# scripts/setup-production-server.sh

set -e

echo "🚀 Setting up production server..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Create application directory
sudo mkdir -p /opt/prompt-card-system
sudo chown $USER:$USER /opt/prompt-card-system
cd /opt/prompt-card-system

# Create environment file
cat > .env << 'EOF'
# Production Environment Variables
TAG=latest
API_URL=https://api.yourdomain.com
DATABASE_URL=postgresql://username:password@database:5432/promptcards
JWT_SECRET=your-super-secure-jwt-secret
DB_NAME=promptcards
DB_USER=username
DB_PASSWORD=password
EOF

# Create data directories
mkdir -p data logs nginx/certs

# Setup SSL certificates (Let's Encrypt)
sudo apt install certbot python3-certbot-nginx -y

echo "✅ Production server setup complete"
```

### 2. SSL/TLS Configuration
```nginx
# nginx/nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream frontend {
        server frontend:3000;
    }

    upstream backend {
        server backend:3001;
    }

    upstream auth {
        server auth:3002;
    }

    # Redirect HTTP to HTTPS
    server {
        listen 80;
        server_name yourdomain.com www.yourdomain.com;
        return 301 https://$server_name$request_uri;
    }

    # Main HTTPS server
    server {
        listen 443 ssl http2;
        server_name yourdomain.com www.yourdomain.com;

        # SSL Configuration
        ssl_certificate /etc/nginx/certs/fullchain.pem;
        ssl_certificate_key /etc/nginx/certs/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

        # Frontend
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Backend API
        location /api/ {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Auth API
        location /auth/ {
            proxy_pass http://auth;
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
            proxy_set_header Host $host;
        }
    }
}
```

### 3. Deployment Script
```bash
#!/bin/bash
# scripts/deploy.sh

set -e

DEPLOY_DIR="/opt/prompt-card-system"
BACKUP_DIR="/opt/backups"
TAG=${1:-latest}

echo "🚀 Deploying Prompt Card System (tag: $TAG)..."

cd $DEPLOY_DIR

# Create backup
echo "📦 Creating backup..."
mkdir -p $BACKUP_DIR
docker-compose logs > $BACKUP_DIR/logs-$(date +%Y%m%d-%H%M%S).txt
cp -r data $BACKUP_DIR/data-backup-$(date +%Y%m%d-%H%M%S)

# Pull latest images
echo "⬇️ Pulling latest images..."
docker login ghcr.io -u $DOCKER_USERNAME -p $DOCKER_PASSWORD
docker-compose -f docker-compose.prod.yml pull

# Update environment
export TAG=$TAG

# Stop services gracefully
echo "🛑 Stopping services..."
docker-compose -f docker-compose.prod.yml down --timeout 30

# Start services
echo "▶️ Starting services..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be healthy
echo "🏥 Waiting for services to be healthy..."
timeout 300 bash -c 'until docker-compose -f docker-compose.prod.yml ps | grep -q "healthy\|Up"; do sleep 5; done'

# Run health checks
echo "🔍 Running health checks..."
sleep 30
curl -f http://localhost:80/health || exit 1
curl -f http://localhost:3001/health || exit 1
curl -f http://localhost:3002/health || exit 1

# Cleanup old images
echo "🧹 Cleaning up old images..."
docker image prune -f

echo "✅ Deployment complete!"
echo "📊 Service status:"
docker-compose -f docker-compose.prod.yml ps
```

## Monitoring and Observability

### 1. Health Checks
```yaml
# Health check endpoints in docker-compose
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### 2. Logging Configuration
```yaml
# Add to each service in docker-compose
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

### 3. Metrics Collection
```yaml
# prometheus/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'prompt-card-system'
    static_configs:
      - targets: ['backend:3001', 'auth:3002']
    metrics_path: '/metrics'
    scrape_interval: 5s
```

## Rollback Strategy

### 1. Automated Rollback
```bash
#!/bin/bash
# scripts/rollback.sh

set -e

DEPLOY_DIR="/opt/prompt-card-system"
PREVIOUS_TAG=${1:-$(git describe --tags --abbrev=0 HEAD~1)}

echo "🔄 Rolling back to tag: $PREVIOUS_TAG"

cd $DEPLOY_DIR

# Update tag
export TAG=$PREVIOUS_TAG

# Pull previous images
docker-compose -f docker-compose.prod.yml pull

# Restart services
docker-compose -f docker-compose.prod.yml down --timeout 30
docker-compose -f docker-compose.prod.yml up -d

# Verify rollback
sleep 30
curl -f http://localhost:80/health || exit 1

echo "✅ Rollback complete!"
```

### 2. Blue-Green Deployment
```bash
#!/bin/bash
# scripts/blue-green-deploy.sh

CURRENT_ENV=$(docker-compose -f docker-compose.prod.yml ps --services | head -1)
NEW_ENV="green"

if [ "$CURRENT_ENV" = "green" ]; then
    NEW_ENV="blue"
fi

echo "🔄 Deploying to $NEW_ENV environment..."

# Deploy to new environment
docker-compose -f docker-compose.$NEW_ENV.yml up -d

# Wait for health checks
sleep 60

# Switch traffic
nginx -s reload

# Stop old environment
docker-compose -f docker-compose.$CURRENT_ENV.yml down

echo "✅ Blue-green deployment complete!"
```

## Security Considerations

### 1. Image Scanning
```yaml
# Add to GitHub Actions workflow
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ steps.meta.outputs.tags }}
    format: 'sarif'
    output: 'trivy-results.sarif'

- name: Upload Trivy scan results
  uses: github/codeql-action/upload-sarif@v2
  with:
    sarif_file: 'trivy-results.sarif'
```

### 2. Secret Management
```bash
# Use Docker secrets or external secret management
docker secret create jwt_secret jwt_secret.txt
docker secret create db_password db_password.txt
```

### 3. Network Security
```yaml
# Restrict network access
networks:
  app-network:
    driver: bridge
    internal: true
  public-network:
    driver: bridge
```

## Performance Optimization

### 1. Image Optimization
- Use multi-stage builds
- Minimize layer count
- Use .dockerignore files
- Cache dependencies separately

### 2. Registry Performance
- Use image layer caching
- Implement registry mirrors
- Configure pull-through cache

### 3. Deployment Performance
- Use rolling updates
- Implement readiness probes
- Configure resource limits

## Troubleshooting

### Common Issues
1. **Image pull failures**: Check authentication and network
2. **Health check failures**: Verify service endpoints
3. **Port conflicts**: Check port availability
4. **SSL certificate errors**: Verify certificate paths

### Debug Commands
```bash
# Check container logs
docker-compose -f docker-compose.prod.yml logs -f service-name

# Check container health
docker inspect container-name | grep Health

# Test connectivity
docker-compose -f docker-compose.prod.yml exec backend curl frontend:3000/health

# Check resource usage
docker stats
```

## Next Steps

1. Review [offline deployment guide](./offline-deployment.md) for air-gapped environments
2. Check [production setup guide](./production-setup.md) for advanced configurations
3. See [architecture documentation](../architecture/swarm-coordination.md) for system design details