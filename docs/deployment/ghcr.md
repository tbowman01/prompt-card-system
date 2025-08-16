# GitHub Container Registry (GHCR) Integration

This guide covers publishing and deploying Docker containers using GitHub Container Registry (GHCR) for the Prompt Card System.

## 🎯 Overview

GitHub Container Registry provides:
- **Free hosting** for public repositories
- **Tight GitHub integration** with Actions
- **Multi-platform support** (amd64, arm64)
- **Automated publishing** via CI/CD
- **Package security** with vulnerability scanning

## 🔧 Setup & Configuration

### 1. Enable GHCR for Repository
```bash
# Repository Settings > Actions > General
# Enable "Read and write permissions" for GITHUB_TOKEN
```

### 2. Create Personal Access Token (PAT)
```bash
# GitHub Settings > Developer settings > Personal access tokens
# Create token with scopes:
# - read:packages
# - write:packages
# - delete:packages (optional)
```

### 3. Configure Repository Secrets
```bash
# Repository Settings > Secrets and variables > Actions
# Add secrets:
GHCR_TOKEN=your_personal_access_token
GHCR_USERNAME=your_github_username
```

## 🏗️ Automated Publishing Workflow

### GitHub Actions Workflow
Create `.github/workflows/ghcr-publish.yml`:

```yaml
name: 🚀 Build & Publish to GHCR

on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:
    branches: [main]
  workflow_dispatch:

env:
  REGISTRY: ghcr.io
  IMAGE_NAME_FRONTEND: ${{ github.repository }}/frontend
  IMAGE_NAME_BACKEND: ${{ github.repository }}/backend

jobs:
  build-and-publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    
    strategy:
      matrix:
        service: [frontend, backend]
        platform: [linux/amd64, linux/arm64]

    steps:
      - name: 🔍 Checkout repository
        uses: actions/checkout@v4

      - name: 🔐 Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: 🏗️ Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
        with:
          platforms: linux/amd64,linux/arm64

      - name: 🏷️ Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ matrix.service == 'frontend' && env.IMAGE_NAME_FRONTEND || env.IMAGE_NAME_BACKEND }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=semver,pattern={{major}}
            type=sha,prefix={{branch}}-
            type=raw,value=latest,enable={{is_default_branch}}

      - name: 🏗️ Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: ./${{ matrix.service }}
          file: ./${{ matrix.service }}/Dockerfile.prod
          platforms: ${{ matrix.platform }}
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            VERSION=${{ steps.meta.outputs.version }}
            BUILD_DATE=${{ fromJSON(steps.meta.outputs.json).labels['org.opencontainers.image.created'] }}
            GIT_SHA=${{ github.sha }}

      - name: 📊 Generate build summary
        run: |
          echo "## 🚀 Container Published Successfully!" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "### 📦 Package Details" >> $GITHUB_STEP_SUMMARY
          echo "- **Service**: ${{ matrix.service }}" >> $GITHUB_STEP_SUMMARY
          echo "- **Platform**: ${{ matrix.platform }}" >> $GITHUB_STEP_SUMMARY
          echo "- **Registry**: ${{ env.REGISTRY }}" >> $GITHUB_STEP_SUMMARY
          echo "- **Tags**: ${{ steps.meta.outputs.tags }}" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "### 🔗 Pull Commands" >> $GITHUB_STEP_SUMMARY
          echo "\`\`\`bash" >> $GITHUB_STEP_SUMMARY
          echo "docker pull ${{ env.REGISTRY }}/${{ matrix.service == 'frontend' && env.IMAGE_NAME_FRONTEND || env.IMAGE_NAME_BACKEND }}:latest" >> $GITHUB_STEP_SUMMARY
          echo "\`\`\`" >> $GITHUB_STEP_SUMMARY

  security-scan:
    needs: build-and-publish
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: read
      security-events: write

    strategy:
      matrix:
        service: [frontend, backend]

    steps:
      - name: 🔍 Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: '${{ env.REGISTRY }}/${{ matrix.service == 'frontend' && env.IMAGE_NAME_FRONTEND || env.IMAGE_NAME_BACKEND }}:latest'
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: 📤 Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: 'trivy-results.sarif'

  deploy-staging:
    if: github.ref == 'refs/heads/main'
    needs: [build-and-publish, security-scan]
    runs-on: ubuntu-latest
    environment: staging
    
    steps:
      - name: 🚀 Deploy to staging
        run: |
          echo "Deploying to staging environment..."
          # Add your deployment logic here
          
      - name: 🧪 Run integration tests
        run: |
          echo "Running integration tests against staging..."
          # Add your test commands here

  deploy-production:
    if: startsWith(github.ref, 'refs/tags/v')
    needs: [build-and-publish, security-scan]
    runs-on: ubuntu-latest
    environment: production
    
    steps:
      - name: 🚀 Deploy to production
        run: |
          echo "Deploying to production environment..."
          # Add your production deployment logic here
```

## 📦 Container Configuration

### Optimized Production Dockerfile

#### Frontend Dockerfile.prod
```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Add metadata labels
LABEL org.opencontainers.image.title="Prompt Card System Frontend"
LABEL org.opencontainers.image.description="Enterprise AI Testing Platform - Frontend"
LABEL org.opencontainers.image.url="https://github.com/tbowman01/prompt-card-system"
LABEL org.opencontainers.image.source="https://github.com/tbowman01/prompt-card-system"
LABEL org.opencontainers.image.vendor="Prompt Card System"
LABEL org.opencontainers.image.licenses="MIT"

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

WORKDIR /app

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Switch to non-root user
USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

EXPOSE 3000

CMD ["node", "server.js"]
```

#### Backend Dockerfile.prod
```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy source and build
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Add metadata labels
LABEL org.opencontainers.image.title="Prompt Card System Backend"
LABEL org.opencontainers.image.description="Enterprise AI Testing Platform - Backend API"
LABEL org.opencontainers.image.url="https://github.com/tbowman01/prompt-card-system"
LABEL org.opencontainers.image.source="https://github.com/tbowman01/prompt-card-system"
LABEL org.opencontainers.image.vendor="Prompt Card System"
LABEL org.opencontainers.image.licenses="MIT"

# Security: Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodeapp -u 1001

# Install production dependencies only
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=builder --chown=nodeapp:nodejs /app/dist ./dist
COPY --from=builder --chown=nodeapp:nodejs /app/package.json ./

# Security configurations
RUN chmod -R 755 /app
USER nodeapp

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

EXPOSE 3001

CMD ["node", "dist/server.js"]
```

## 🚢 GHCR Docker Compose

### docker-compose.ghcr.yml
```yaml
version: '3.8'

services:
  frontend:
    image: ghcr.io/tbowman01/prompt-card-system/frontend:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=http://backend:3001
    depends_on:
      - backend
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  backend:
    image: ghcr.io/tbowman01/prompt-card-system/backend:latest
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - JWT_SECRET=${JWT_SECRET}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3001/api/health"]
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
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:

networks:
  default:
    name: prompt-card-system
```

## 🔧 Manual GHCR Operations

### Build and Push Manually
```bash
# Login to GHCR
echo $GHCR_TOKEN | docker login ghcr.io -u $GHCR_USERNAME --password-stdin

# Build multi-platform images
docker buildx create --use --name multiarch

# Build and push frontend
docker buildx build --platform linux/amd64,linux/arm64 \
  -t ghcr.io/tbowman01/prompt-card-system/frontend:latest \
  -t ghcr.io/tbowman01/prompt-card-system/frontend:v1.0.1 \
  --push ./frontend

# Build and push backend
docker buildx build --platform linux/amd64,linux/arm64 \
  -t ghcr.io/tbowman01/prompt-card-system/backend:latest \
  -t ghcr.io/tbowman01/prompt-card-system/backend:v1.0.1 \
  --push ./backend
```

### Pull and Run from GHCR
```bash
# Pull latest images
docker pull ghcr.io/tbowman01/prompt-card-system/frontend:latest
docker pull ghcr.io/tbowman01/prompt-card-system/backend:latest

# Run with GHCR images
docker compose -f docker-compose.ghcr.yml up -d

# Check running containers
docker compose -f docker-compose.ghcr.yml ps
```

## 📊 Package Management

### List Published Packages
```bash
# Using GitHub CLI
gh api /user/packages?package_type=container

# Using curl
curl -H "Authorization: token $GHCR_TOKEN" \
  https://api.github.com/user/packages?package_type=container
```

### Package Cleanup Script
```bash
#!/bin/bash
# cleanup-old-packages.sh

REPO="tbowman01/prompt-card-system"
PACKAGE_NAME="frontend"  # or "backend"
KEEP_VERSIONS=10

# Get package versions
VERSIONS=$(gh api "/repos/$REPO/packages/container/$PACKAGE_NAME/versions" --jq '.[].id' | tail -n +$((KEEP_VERSIONS + 1)))

# Delete old versions
for VERSION_ID in $VERSIONS; do
  echo "Deleting version $VERSION_ID"
  gh api -X DELETE "/repos/$REPO/packages/container/$PACKAGE_NAME/versions/$VERSION_ID"
done
```

## 🔐 Security Best Practices

### Container Security Scanning
```yaml
# Add to workflow for security scanning
- name: 🔍 Run container security scan
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'ghcr.io/tbowman01/prompt-card-system/backend:latest'
    format: 'table'
    exit-code: '1'
    ignore-unfixed: true
    vuln-type: 'os,library'
    severity: 'CRITICAL,HIGH'
```

### GHCR Token Security
```bash
# Use GitHub App tokens for better security
# Instead of PAT, create a GitHub App with packages:write permission

# Rotate tokens regularly
# Set token expiration to 90 days maximum

# Use repository secrets, not organization secrets
# Limit scope to specific repositories
```

## 🚀 Deployment Strategies

### Blue-Green Deployment
```yaml
# blue-green-deploy.yml
name: 🔵🟢 Blue-Green Deployment

on:
  push:
    tags: ['v*']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: 🚀 Deploy to Green environment
        run: |
          # Pull new images
          docker compose -f docker-compose.ghcr.yml pull
          
          # Start green environment
          docker compose -f docker-compose.ghcr.yml up -d
          
          # Health check
          sleep 30
          curl -f http://localhost:3001/api/health
          
          # Switch traffic (update load balancer)
          # Terminate blue environment
```

### Rolling Update
```bash
#!/bin/bash
# rolling-update.sh

SERVICES=("frontend" "backend")

for SERVICE in "${SERVICES[@]}"; do
  echo "Updating $SERVICE..."
  
  # Pull new image
  docker compose pull $SERVICE
  
  # Rolling update with health check
  docker compose up -d --no-deps $SERVICE
  
  # Wait for health check
  sleep 30
  
  # Verify service is healthy
  if ! curl -f http://localhost:3001/api/health; then
    echo "Health check failed for $SERVICE"
    exit 1
  fi
  
  echo "$SERVICE updated successfully"
done
```

## 📈 Monitoring & Observability

### GHCR Metrics
```bash
# Package download statistics
gh api "/repos/tbowman01/prompt-card-system/packages/container/frontend/versions" \
  --jq '.[] | {name: .name, downloads: .metadata.container.tags[0].download_count}'

# Storage usage
gh api "/user/packages?package_type=container" \
  --jq '.[] | {name: .name, size: .metadata.container.total_size_bytes}'
```

### Container Resource Monitoring
```yaml
# Add to docker-compose.yml for monitoring
services:
  backend:
    image: ghcr.io/tbowman01/prompt-card-system/backend:latest
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
```

## 🔧 Troubleshooting

### Common GHCR Issues

#### Authentication Failed
```bash
# Check token permissions
gh auth status

# Re-login with correct scopes
gh auth login --scopes read:packages,write:packages

# Verify registry login
docker login ghcr.io -u $GITHUB_USERNAME
```

#### Image Pull Failures
```bash
# Check image exists
docker manifest inspect ghcr.io/tbowman01/prompt-card-system/backend:latest

# Pull with verbose output
docker pull --verbose ghcr.io/tbowman01/prompt-card-system/backend:latest

# Check for platform issues
docker pull --platform linux/amd64 ghcr.io/tbowman01/prompt-card-system/backend:latest
```

#### Build Cache Issues
```bash
# Clear buildx cache
docker buildx prune -f

# Build without cache
docker buildx build --no-cache --platform linux/amd64,linux/arm64 \
  -t ghcr.io/tbowman01/prompt-card-system/backend:latest \
  --push ./backend
```

## 📚 Best Practices

### Image Tagging Strategy
```bash
# Semantic versioning
ghcr.io/tbowman01/prompt-card-system/backend:v1.2.3
ghcr.io/tbowman01/prompt-card-system/backend:v1.2
ghcr.io/tbowman01/prompt-card-system/backend:v1

# Environment tags
ghcr.io/tbowman01/prompt-card-system/backend:staging
ghcr.io/tbowman01/prompt-card-system/backend:production

# Git-based tags
ghcr.io/tbowman01/prompt-card-system/backend:main-abc1234
ghcr.io/tbowman01/prompt-card-system/backend:pr-123
```

### Package Maintenance
```bash
# Regular cleanup of old versions
# Keep only last 10 versions per package

# Use multi-stage builds to reduce image size
# Scan for vulnerabilities before deployment

# Use specific tags in production, not 'latest'
# Document breaking changes in release notes
```

---

## 🆘 Support

- **📖 GHCR Documentation**: [GitHub Container Registry Docs](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- **🐛 Report Issues**: [GitHub Issues](https://github.com/tbowman01/prompt-card-system/issues)
- **💬 Community**: [GitHub Discussions](https://github.com/tbowman01/prompt-card-system/discussions)
- **📧 Email**: ghcr-support@prompt-card-system.com

## 📚 Additional Resources

- [GitHub Packages Documentation](https://docs.github.com/en/packages)
- [Docker Multi-platform Builds](https://docs.docker.com/buildx/working-with-buildx/)
- [Container Security Best Practices](https://snyk.io/blog/10-docker-image-security-best-practices/)