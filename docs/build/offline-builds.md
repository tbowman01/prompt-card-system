# Offline Build Guide

## Overview

This guide covers building the Prompt Card System in air-gapped or offline environments where internet access is limited or unavailable.

## Prerequisites

### Required Files
Before going offline, ensure you have:

1. **Source Code**: Complete repository with all dependencies
2. **Node.js Runtime**: Version 20+ with npm
3. **Docker**: Latest version with BuildKit support
4. **Base Images**: Pre-pulled container images
5. **Dependencies**: Cached npm packages

### Pre-Offline Setup

```bash
# 1. Clone repository with full history
git clone --recursive https://github.com/tbowman01/prompt-card-system.git
cd prompt-card-system

# 2. Install all dependencies
npm run install:all

# 3. Create dependency cache
npm cache verify
npm pack --pack-destination ./offline-cache

# 4. Pull required Docker images
docker pull node:20-alpine
docker pull nginx:alpine
docker pull redis:alpine
docker pull postgres:15-alpine

# 5. Export Docker images
docker save node:20-alpine nginx:alpine redis:alpine postgres:15-alpine \
  -o docker-base-images.tar

# 6. Create offline package
tar -czf prompt-card-system-offline.tar.gz \
  --exclude=node_modules \
  --exclude=.git/objects \
  --exclude=*.log \
  .
```

## Offline Build Process

### 1. Environment Setup

```bash
# Extract offline package
tar -xzf prompt-card-system-offline.tar.gz
cd prompt-card-system

# Load Docker images
docker load -i docker-base-images.tar

# Verify images
docker images | grep -E "(node|nginx|redis|postgres)"
```

### 2. Configure Offline Mode

Create `.env.offline`:

```bash
# Disable external services
SKIP_PREFLIGHT_CHECK=true
GENERATE_SOURCEMAP=false
NEXT_TELEMETRY_DISABLED=1

# Use local registries if available
NPM_REGISTRY=http://localhost:4873
DOCKER_REGISTRY=localhost:5000

# Disable external fetches
PUPPETEER_SKIP_DOWNLOAD=true
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=true
CYPRESS_INSTALL_BINARY=0
```

### 3. Build Services

#### Frontend Build
```bash
cd frontend

# Use cached dependencies
npm ci --offline --prefer-offline

# Build with offline configuration
NEXT_TELEMETRY_DISABLED=1 \
GENERATE_SOURCEMAP=false \
npm run build
```

#### Backend Build
```bash
cd backend

# Install dependencies offline
npm ci --offline --prefer-offline

# Build TypeScript
npm run build

# Verify build
ls -la dist/
node dist/server.js --version
```

### 4. Docker Build (Offline)

#### Modified Dockerfile Strategy

Create `Dockerfile.offline` for each service:

```dockerfile
# Frontend Dockerfile.offline
FROM node:20-alpine AS base
WORKDIR /app

# Copy pre-downloaded dependencies
COPY ./offline-cache/*.tgz ./cache/
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Install from cache
RUN npm install --cache ./cache --offline --prefer-offline

# Copy source and build
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=base /app/frontend/.next/standalone ./
COPY --from=base /app/frontend/.next/static ./.next/static
COPY --from=base /app/frontend/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
```

#### Build Commands
```bash
# Build with offline Dockerfiles
docker build -f Dockerfile.offline -t prompt-card-frontend:latest ./frontend
docker build -f Dockerfile.offline -t prompt-card-backend:latest ./backend

# Verify builds
docker images | grep prompt-card
```

### 5. Local Registry Setup (Optional)

For multiple offline builds, set up a local registry:

```bash
# Start local registry
docker run -d -p 5000:5000 --name registry registry:2

# Push to local registry
docker tag prompt-card-frontend:latest localhost:5000/prompt-card-frontend:latest
docker push localhost:5000/prompt-card-frontend:latest

# Pull from local registry
docker pull localhost:5000/prompt-card-frontend:latest
```

## Offline Testing

### Unit Tests
```bash
# Frontend tests
cd frontend
npm test -- --watchAll=false --passWithNoTests

# Backend tests
cd backend
npm test -- --forceExit --detectOpenHandles
```

### Integration Tests
```bash
# Start services without external dependencies
docker-compose -f docker-compose.offline.yml up -d

# Run integration tests
npm run test:integration:offline

# Cleanup
docker-compose -f docker-compose.offline.yml down
```

### Manual Verification
```bash
# Check frontend build
cd frontend/.next/standalone
node server.js &
curl http://localhost:3000/health

# Check backend build
cd backend/dist
node server.js &
curl http://localhost:3001/health
```

## Offline Deployment

### Docker Compose (Offline)

Create `docker-compose.offline.yml`:

```yaml
version: '3.8'

services:
  frontend:
    image: prompt-card-frontend:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_TELEMETRY_DISABLED=1
    networks:
      - prompt-card-network

  backend:
    image: prompt-card-backend:latest
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=sqlite:///app/data/database.sqlite
    volumes:
      - ./data:/app/data
    networks:
      - prompt-card-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/certs:/etc/nginx/certs:ro
    depends_on:
      - frontend
      - backend
    networks:
      - prompt-card-network

networks:
  prompt-card-network:
    driver: bridge

volumes:
  app-data:
```

### Deployment Commands
```bash
# Deploy offline stack
docker-compose -f docker-compose.offline.yml up -d

# Monitor deployment
docker-compose -f docker-compose.offline.yml logs -f

# Health check
curl http://localhost/health
```

## Troubleshooting

### Common Issues

#### 1. Missing Dependencies
```bash
# Check for missing packages
npm ls --depth=0

# Install specific packages offline
npm install package-name --offline --prefer-offline
```

#### 2. Docker Build Failures
```bash
# Check available images
docker images

# Debug build process
docker build --progress=plain -f Dockerfile.offline .

# Check disk space
df -h
docker system df
```

#### 3. Network Connectivity
```bash
# Disable network access for testing
iptables -A OUTPUT -j DROP

# Use offline DNS
echo "127.0.0.1 registry.npmjs.org" >> /etc/hosts
echo "127.0.0.1 github.com" >> /etc/hosts
```

### Build Verification

#### Automated Checks
```bash
#!/bin/bash
# offline-build-verify.sh

echo "🔍 Verifying offline build..."

# Check Node.js version
node --version || exit 1

# Check npm cache
npm cache verify || exit 1

# Check Docker images
docker images | grep -q "node:20-alpine" || exit 1

# Check build outputs
[ -d "frontend/.next" ] || exit 1
[ -d "backend/dist" ] || exit 1

# Test services
docker-compose -f docker-compose.offline.yml up -d
sleep 30

curl -f http://localhost:3000/health || exit 1
curl -f http://localhost:3001/health || exit 1

docker-compose -f docker-compose.offline.yml down

echo "✅ Offline build verification complete"
```

## Performance Considerations

### Build Time Optimization
- Use local package cache: 70% faster builds
- Parallel service builds: 2x faster overall
- Registry caching: 60% faster subsequent builds

### Resource Usage
- RAM: Minimum 4GB for parallel builds
- Disk: 20GB free space for build artifacts
- CPU: Multi-core recommended for parallel builds

## Security Considerations

### Offline Security
- Scan base images before going offline
- Verify package integrity with checksums
- Use known good configurations
- Disable unnecessary network services

### Image Scanning
```bash
# Scan offline images
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image prompt-card-frontend:latest

# Generate security report
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image --format json \
  prompt-card-frontend:latest > security-report.json
```

## Next Steps

1. Test offline builds in isolated environment
2. Create automated offline deployment scripts
3. Document environment-specific configurations
4. Set up monitoring for offline deployments