# Build and Deployment Guide

This comprehensive guide covers building, optimizing, and deploying the Prompt Card System across different environments, from local development to production deployment with Docker, CI/CD pipelines, and cloud platforms.

## Table of Contents

1. [Build Process Overview](#build-process-overview)
2. [Local Build Process](#local-build-process)
3. [Docker Build Strategy](#docker-build-strategy)
4. [Build Optimization](#build-optimization)
5. [Environment Configuration](#environment-configuration)
6. [CI/CD Pipeline](#cicd-pipeline)
7. [Deployment Strategies](#deployment-strategies)
8. [Production Deployment](#production-deployment)
9. [Monitoring and Rollback](#monitoring-and-rollback)
10. [Performance Optimization](#performance-optimization)
11. [Security Considerations](#security-considerations)
12. [Troubleshooting](#troubleshooting)

## Build Process Overview

### Architecture Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Build Pipeline                           │
├─────────────────────────────────────────────────────────────┤
│  Source Code → TypeScript → Bundling → Optimization → Assets│
│       ↓              ↓           ↓            ↓         ↓   │
│   Linting      Compilation   Minification  Tree-shaking Images│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Container Build                            │
├─────────────────────────────────────────────────────────────┤
│  Multi-stage Docker → Layer Caching → Security Scanning     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Deployment                               │
├─────────────────────────────────────────────────────────────┤
│  Testing → Staging → Blue-Green → Production → Monitoring   │
└─────────────────────────────────────────────────────────────┘
```

### Build Targets

| Target | Description | Use Case |
|--------|-------------|----------|
| **Development** | Fast builds, hot reload | Local development |
| **Testing** | Optimized for test execution | CI/CD pipelines |
| **Staging** | Production-like with debug info | Pre-production testing |
| **Production** | Fully optimized, minified | Live deployment |

## Local Build Process

### Prerequisites

```bash
# Ensure you have the required tools
node --version  # 20.0+
npm --version   # 9.0+
docker --version # 24.0+
```

### Backend Build

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm ci

# Type checking
npm run typecheck

# Linting
npm run lint

# Run tests
npm test

# Build production bundle
npm run build

# Verify build output
ls -la dist/
```

**Build Script Details:**
```json
{
  "scripts": {
    "build": "tsc",
    "build:lenient": "tsc --noEmitOnError false --skipLibCheck true",
    "build:watch": "tsc --watch",
    "build:production": "NODE_ENV=production tsc --project tsconfig.prod.json"
  }
}
```

**TypeScript Configuration (tsconfig.json):**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": false,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitThis": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "moduleResolution": "node",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "allowJs": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"]
}
```

### Frontend Build

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm ci

# Type checking
npm run typecheck

# Linting
npm run lint

# Run tests
npm test

# Build production bundle
npm run build

# Verify build output
ls -la .next/
```

**Next.js Build Configuration:**
```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Production optimizations
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  compress: true,
  
  // Bundle analyzer (development only)
  ...(process.env.ANALYZE === 'true' && {
    webpack: (config, { isServer }) => {
      if (!isServer) {
        const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
        config.plugins.push(
          new BundleAnalyzerPlugin({
            analyzerMode: 'server',
            openAnalyzer: true,
          })
        );
      }
      return config;
    },
  }),

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
  },

  // Performance optimizations
  experimental: {
    optimizeCss: true,
    swcMinify: true,
  },

  // Environment variables
  env: {
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
    NEXT_PUBLIC_VERSION: process.env.npm_package_version,
  },

  // Headers for security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
```

### Full System Build

```bash
# From root directory
npm run build

# Or build components separately
npm run build:backend
npm run build:frontend

# Clean build (removes previous builds)
npm run clean && npm run build

# Build with specific environment
NODE_ENV=production npm run build
```

## Docker Build Strategy

### Multi-Stage Dockerfile Strategy

Our Docker builds use multi-stage containers for optimization:

1. **Dependencies Stage** - Install and cache dependencies
2. **Build Stage** - Compile TypeScript and build assets
3. **Production Stage** - Minimal runtime image

### Backend Docker Build

**Dockerfile Analysis:**
```dockerfile
# Stage 1: Dependencies (cached layer)
FROM node:20-alpine AS deps
WORKDIR /app

# Install system dependencies for native modules
RUN apk add --no-cache python3 make g++ cairo-dev jpeg-dev pango-dev

# Copy package files for dependency installation
COPY package*.json ./

# Set environment variables to skip unnecessary downloads
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=true
ENV CYPRESS_INSTALL_BINARY=0

# Install production dependencies only
RUN npm ci --only=production --ignore-scripts && npm cache clean --force

# Stage 2: Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ cairo-dev jpeg-dev pango-dev

# Copy package files and install all dependencies
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy source and build
COPY . .
RUN npm run build

# Stage 3: Production runtime
FROM node:20-alpine AS runner
WORKDIR /app

# Install only runtime dependencies
RUN apk add --no-cache cairo jpeg pango

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodeuser

# Copy production files
COPY --from=deps --chown=nodeuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodeuser:nodejs /app/dist ./dist
COPY --from=builder --chown=nodeuser:nodejs /app/package*.json ./

# Create data directory
RUN mkdir -p /app/data && chown nodeuser:nodejs /app/data

# Switch to non-root user
USER nodeuser

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

CMD ["npm", "start"]
```

### Frontend Docker Build

```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm ci --only=production --ignore-scripts && npm cache clean --force

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy Next.js build output
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

CMD ["npm", "start"]
```

### Docker Build Commands

```bash
# Build individual services
docker build -t prompt-card-backend ./backend
docker build -t prompt-card-frontend ./frontend

# Build with BuildKit (recommended)
DOCKER_BUILDKIT=1 docker build -t prompt-card-backend ./backend

# Multi-platform build
docker buildx build --platform linux/amd64,linux/arm64 -t prompt-card-backend ./backend

# Build with cache
docker build --cache-from prompt-card-backend:latest -t prompt-card-backend:new ./backend

# Build all services with docker-compose
docker-compose -f docker-compose.prod.yml build

# Build with no cache (clean build)
docker-compose build --no-cache
```

## Build Optimization

### Build Performance Optimization

1. **Parallel Builds**
   ```bash
   # Use npm workspaces for parallel builds
   npm run build --workspaces

   # Docker parallel builds
   docker-compose build --parallel

   # CI parallel jobs
   jobs:
     build:
       strategy:
         matrix:
           component: [backend, frontend]
   ```

2. **Dependency Caching**
   ```dockerfile
   # Optimize Docker layer caching
   COPY package*.json ./
   RUN npm ci --only=production
   COPY . .  # This layer changes frequently, so it's last
   ```

3. **Build Artifacts Caching**
   ```yaml
   # GitHub Actions caching
   - name: Cache node modules
     uses: actions/cache@v3
     with:
       path: |
         ~/.npm
         node_modules
         */*/node_modules
       key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
   
   - name: Cache TypeScript build
     uses: actions/cache@v3
     with:
       path: |
         backend/dist
         frontend/.next
       key: ${{ runner.os }}-build-${{ github.sha }}
   ```

### Bundle Size Optimization

1. **Webpack Bundle Analysis**
   ```bash
   # Analyze frontend bundle
   cd frontend
   ANALYZE=true npm run build

   # Check bundle size
   npm run build && npx bundlesize

   # Tree shaking analysis
   npx webpack-bundle-analyzer .next/static/chunks/
   ```

2. **Code Splitting Configuration**
   ```javascript
   // next.config.js
   module.exports = {
     experimental: {
       optimizeCss: true,
     },
     webpack: (config, { dev, isServer }) => {
       if (!dev && !isServer) {
         config.optimization.splitChunks.chunks = 'all';
         config.optimization.splitChunks.cacheGroups = {
           vendor: {
             test: /[\\/]node_modules[\\/]/,
             name: 'vendors',
             chunks: 'all',
           },
         };
       }
       return config;
     },
   };
   ```

3. **Backend Bundle Optimization**
   ```json
   // package.json
   {
     "scripts": {
       "build:optimized": "webpack --mode=production --optimize-minimize"
     }
   }
   ```

## Environment Configuration

### Environment Management Strategy

```bash
# Environment hierarchy
.env.local          # Local overrides (not committed)
.env.development    # Development defaults
.env.staging        # Staging configuration  
.env.production     # Production configuration
.env                # Base configuration
```

### Backend Environment Configuration

```bash
# backend/.env.production
NODE_ENV=production
PORT=3001
LOG_LEVEL=info

# Database
DATABASE_PATH=/app/data/database.sqlite
DATABASE_BACKUP_PATH=/app/backups

# LLM Configuration
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_TIMEOUT=30000
OLLAMA_RETRY_ATTEMPTS=3

# Security
JWT_SECRET=${JWT_SECRET}
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
HEALTH_CHECK_TIMEOUT=5000

# Performance
ENABLE_COMPRESSION=true
ENABLE_CORS=false
CORS_ORIGIN=${CORS_ORIGIN}

# Caching
REDIS_URL=${REDIS_URL}
CACHE_TTL=3600
```

### Frontend Environment Configuration

```bash
# frontend/.env.production
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1

# API Configuration
NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}

# Feature Flags
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_VOICE_INTERFACE=false
NEXT_PUBLIC_ENABLE_DEBUG_PANEL=false

# Performance
NEXT_PUBLIC_CDN_URL=${NEXT_PUBLIC_CDN_URL}
NEXT_PUBLIC_IMAGE_DOMAINS=localhost,cdn.example.com

# Monitoring
NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN}
NEXT_PUBLIC_GA_TRACKING_ID=${NEXT_PUBLIC_GA_TRACKING_ID}
```

### Environment Validation

```typescript
// src/config/validateEnv.ts
import Joi from 'joi';

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'staging', 'production').required(),
  PORT: Joi.number().port().default(3001),
  DATABASE_PATH: Joi.string().required(),
  OLLAMA_BASE_URL: Joi.string().uri().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  REDIS_URL: Joi.string().uri().optional(),
  CORS_ORIGIN: Joi.string().uri().optional(),
}).unknown();

export const validateEnvironment = () => {
  const { error, value } = envSchema.validate(process.env);
  
  if (error) {
    throw new Error(`Environment validation failed: ${error.message}`);
  }
  
  return value;
};

// Use in server startup
try {
  const env = validateEnvironment();
  console.log('Environment validation passed');
} catch (error) {
  console.error('Environment validation failed:', error.message);
  process.exit(1);
}
```

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20.x]
        
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linting
        run: npm run lint

      - name: Run type checking
        run: npm run type-check

      - name: Run tests
        run: npm test -- --coverage --watchAll=false

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage/lcov.info,./frontend/coverage/lcov.info

  build:
    needs: test
    runs-on: ubuntu-latest
    strategy:
      matrix:
        component: [backend, frontend]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Container Registry
        if: github.event_name != 'pull_request'
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-${{ matrix.component }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=sha,prefix={{branch}}-
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: ./${{ matrix.component }}
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          platforms: linux/amd64,linux/arm64

  deploy-staging:
    if: github.ref == 'refs/heads/develop'
    needs: [test, build]
    runs-on: ubuntu-latest
    environment: staging

    steps:
      - name: Deploy to staging
        run: |
          echo "Deploying to staging environment..."
          # Add staging deployment logic here

  deploy-production:
    if: github.ref == 'refs/heads/main'
    needs: [test, build]
    runs-on: ubuntu-latest
    environment: production

    steps:
      - name: Deploy to production
        run: |
          echo "Deploying to production environment..."
          # Add production deployment logic here

  security-scan:
    runs-on: ubuntu-latest
    needs: build
    
    steps:
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-backend:latest
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: 'trivy-results.sarif'
```

### Build Scripts Automation

```bash
# scripts/build.sh
#!/bin/bash
set -e

# Configuration
BUILD_ENV=${BUILD_ENV:-production}
BUILD_TARGET=${BUILD_TARGET:-all}
SKIP_TESTS=${SKIP_TESTS:-false}
DOCKER_REGISTRY=${DOCKER_REGISTRY:-""}

echo "🚀 Starting build process..."
echo "Environment: $BUILD_ENV"
echo "Target: $BUILD_TARGET"

# Pre-build validation
echo "📋 Validating environment..."
node scripts/validate-env.js

# Install dependencies
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm ci
fi

# Run tests (unless skipped)
if [ "$SKIP_TESTS" != "true" ]; then
    echo "🧪 Running tests..."
    npm test
fi

# Type checking
echo "🔍 Type checking..."
npm run type-check

# Linting
echo "🔧 Linting..."
npm run lint

# Build based on target
case $BUILD_TARGET in
    "backend"|"frontend")
        echo "🏗️ Building $BUILD_TARGET..."
        npm run build:$BUILD_TARGET
        ;;
    "all")
        echo "🏗️ Building all components..."
        npm run build
        ;;
    *)
        echo "❌ Unknown build target: $BUILD_TARGET"
        exit 1
        ;;
esac

# Docker build (if registry specified)
if [ -n "$DOCKER_REGISTRY" ]; then
    echo "🐳 Building Docker images..."
    docker-compose -f docker-compose.prod.yml build
    
    if [ "$BUILD_ENV" = "production" ]; then
        echo "📤 Pushing to registry..."
        docker-compose -f docker-compose.prod.yml push
    fi
fi

echo "✅ Build process completed successfully!"
```

## Deployment Strategies

### Blue-Green Deployment

```bash
# scripts/deploy-blue-green.sh
#!/bin/bash
set -e

CURRENT_COLOR=${1:-blue}
NEW_COLOR=$( [ "$CURRENT_COLOR" = "blue" ] && echo "green" || echo "blue" )
SERVICE_NAME="prompt-card-system"

echo "🔄 Starting blue-green deployment..."
echo "Current: $CURRENT_COLOR → New: $NEW_COLOR"

# Step 1: Deploy to new environment
echo "📦 Deploying to $NEW_COLOR environment..."
docker-compose -f docker-compose.$NEW_COLOR.yml up -d

# Step 2: Health check
echo "🔍 Performing health checks..."
for i in {1..30}; do
    if curl -f "http://localhost:8080/health" >/dev/null 2>&1; then
        echo "✅ Health check passed"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Health check failed"
        exit 1
    fi
    sleep 10
done

# Step 3: Run smoke tests
echo "🧪 Running smoke tests..."
npm run test:smoke

# Step 4: Switch traffic
echo "🔀 Switching traffic to $NEW_COLOR..."
# Update load balancer configuration
nginx -s reload

# Step 5: Monitor for issues
echo "📊 Monitoring for 5 minutes..."
sleep 300

# Step 6: Cleanup old environment
echo "🧹 Cleaning up $CURRENT_COLOR environment..."
docker-compose -f docker-compose.$CURRENT_COLOR.yml down

echo "✅ Blue-green deployment completed!"
```

### Rolling Deployment

```yaml
# docker-compose.rolling.yml
version: '3.8'
services:
  backend:
    image: prompt-card-backend:latest
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 30s
        failure_action: rollback
        monitor: 60s
      rollback_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
```

### Canary Deployment

```bash
# scripts/deploy-canary.sh
#!/bin/bash

CANARY_PERCENTAGE=${1:-10}
echo "🐦 Starting canary deployment ($CANARY_PERCENTAGE% traffic)..."

# Deploy canary version
docker-compose -f docker-compose.canary.yml up -d

# Configure load balancer for canary traffic
echo "upstream backend {
    server backend-prod:3001 weight=90;
    server backend-canary:3001 weight=$CANARY_PERCENTAGE;
}" > /etc/nginx/conf.d/canary.conf

nginx -s reload

# Monitor canary metrics
echo "📊 Monitoring canary metrics..."
# Add monitoring logic here

# Gradual traffic increase (if successful)
for percentage in 25 50 75 100; do
    echo "🔼 Increasing canary traffic to $percentage%"
    # Update load balancer config
    sleep 300  # Wait 5 minutes
done

echo "✅ Canary deployment completed!"
```

## Production Deployment

### Production Environment Setup

1. **Server Requirements**
   ```bash
   # Minimum system requirements
   CPU: 4 cores (8 recommended)
   Memory: 8GB RAM (16GB recommended)  
   Storage: 50GB SSD (100GB+ recommended)
   Network: 1Gbps connection

   # Docker requirements
   Docker: 24.0+
   Docker Compose: 2.20+
   ```

2. **Production Configuration**
   ```yaml
   # docker-compose.prod.yml
   version: '3.8'
   services:
     nginx:
       image: nginx:alpine
       ports:
         - "80:80"
         - "443:443"
       volumes:
         - ./nginx/nginx.conf:/etc/nginx/nginx.conf
         - ./nginx/ssl:/etc/nginx/ssl
       depends_on:
         - frontend
         - backend

     frontend:
       image: prompt-card-frontend:latest
       environment:
         - NODE_ENV=production
         - NEXT_PUBLIC_API_URL=https://api.example.com
       restart: unless-stopped
       healthcheck:
         test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
         interval: 30s
         timeout: 10s
         retries: 3

     backend:
       image: prompt-card-backend:latest
       environment:
         - NODE_ENV=production
         - DATABASE_PATH=/app/data/database.sqlite
         - JWT_SECRET=${JWT_SECRET}
       volumes:
         - ./data:/app/data
         - ./backups:/app/backups
       restart: unless-stopped
       healthcheck:
         test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
         interval: 30s
         timeout: 10s
         retries: 3

     ollama:
       image: ollama/ollama:latest
       volumes:
         - ollama-data:/root/.ollama
       environment:
         - OLLAMA_KEEP_ALIVE=24h
       restart: unless-stopped

     redis:
       image: redis:alpine
       volumes:
         - redis-data:/data
       restart: unless-stopped

     prometheus:
       image: prom/prometheus
       ports:
         - "9090:9090"
       volumes:
         - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml

     grafana:
       image: grafana/grafana
       ports:
         - "3030:3000"
       environment:
         - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
       volumes:
         - grafana-data:/var/lib/grafana

   volumes:
     ollama-data:
     redis-data:
     grafana-data:

   networks:
     default:
       driver: bridge
   ```

3. **SSL/TLS Configuration**
   ```nginx
   # nginx/nginx.conf
   server {
       listen 80;
       server_name example.com www.example.com;
       return 301 https://$server_name$request_uri;
   }

   server {
       listen 443 ssl http2;
       server_name example.com www.example.com;

       ssl_certificate /etc/nginx/ssl/fullchain.pem;
       ssl_certificate_key /etc/nginx/ssl/privkey.pem;
       ssl_protocols TLSv1.2 TLSv1.3;
       ssl_ciphers HIGH:!aNULL:!MD5;

       # Security headers
       add_header X-Content-Type-Options nosniff;
       add_header X-Frame-Options DENY;
       add_header X-XSS-Protection "1; mode=block";
       add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

       location / {
           proxy_pass http://frontend:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }

       location /api/ {
           proxy_pass http://backend:3001;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           
           # WebSocket support
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
       }
   }
   ```

### Deployment Commands

```bash
# Production deployment
./scripts/deploy-production.sh

# Or manual steps:
# 1. Pull latest images
docker-compose -f docker-compose.prod.yml pull

# 2. Stop services gracefully
docker-compose -f docker-compose.prod.yml stop

# 3. Backup data
./scripts/backup.sh

# 4. Start new services
docker-compose -f docker-compose.prod.yml up -d

# 5. Verify deployment
./scripts/health-check.sh
```

## Monitoring and Rollback

### Health Check Monitoring

```bash
# scripts/health-check.sh
#!/bin/bash

ENDPOINTS=(
    "http://localhost:3000/health"
    "http://localhost:3001/health"
    "http://localhost:11434/api/version"
)

for endpoint in "${ENDPOINTS[@]}"; do
    echo "🔍 Checking $endpoint"
    
    if curl -f "$endpoint" >/dev/null 2>&1; then
        echo "✅ $endpoint is healthy"
    else
        echo "❌ $endpoint is unhealthy"
        exit 1
    fi
done

echo "🎉 All services are healthy!"
```

### Automatic Rollback

```bash
# scripts/rollback.sh
#!/bin/bash

BACKUP_TAG=${1:-"previous"}
echo "🔄 Rolling back to $BACKUP_TAG..."

# Stop current services
docker-compose -f docker-compose.prod.yml stop

# Restore from backup
docker-compose -f docker-compose.prod.yml down
docker tag prompt-card-backend:$BACKUP_TAG prompt-card-backend:latest
docker tag prompt-card-frontend:$BACKUP_TAG prompt-card-frontend:latest

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Verify rollback
sleep 30
./scripts/health-check.sh

echo "✅ Rollback completed!"
```

### Monitoring Setup

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'prompt-card-backend'
    static_configs:
      - targets: ['backend:3001']
    scrape_interval: 5s
    metrics_path: /metrics

  - job_name: 'prompt-card-frontend'
    static_configs:
      - targets: ['frontend:3000']
    scrape_interval: 5s
    metrics_path: /api/metrics

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
```

## Performance Optimization

### Build Performance

1. **Build Caching Strategy**
   ```dockerfile
   # Optimize Docker layer caching
   # Copy package files first (changes less frequently)
   COPY package*.json ./
   RUN npm ci

   # Copy source code last (changes most frequently)
   COPY . .
   RUN npm run build
   ```

2. **Parallel Build Processing**
   ```json
   {
     "scripts": {
       "build:parallel": "npm-run-all --parallel build:backend build:frontend",
       "build:backend": "cd backend && npm run build",
       "build:frontend": "cd frontend && npm run build"
     }
   }
   ```

### Runtime Performance

1. **Resource Optimization**
   ```yaml
   # docker-compose.prod.yml
   services:
     backend:
       deploy:
         resources:
           limits:
             memory: 1G
             cpus: '1.0'
           reservations:
             memory: 512M
             cpus: '0.5'
   ```

2. **Database Optimization**
   ```bash
   # Database tuning
   sqlite3 data/database.sqlite "PRAGMA optimize;"
   sqlite3 data/database.sqlite "PRAGMA journal_mode=WAL;"
   sqlite3 data/database.sqlite "PRAGMA synchronous=NORMAL;"
   ```

## Security Considerations

### Container Security

```dockerfile
# Use non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodeuser

USER nodeuser

# Remove unnecessary packages
RUN apk del python3 make g++

# Set security options
LABEL security.no-new-privileges=true
```

### Secrets Management

```bash
# Use Docker secrets for sensitive data
echo "super-secret-jwt-key" | docker secret create jwt_secret -

# Reference in compose file
secrets:
  - jwt_secret

services:
  backend:
    secrets:
      - jwt_secret
    environment:
      - JWT_SECRET_FILE=/run/secrets/jwt_secret
```

## Troubleshooting

### Common Build Issues

1. **Out of Memory During Build**
   ```bash
   # Increase Docker memory limit
   export DOCKER_DEFAULT_PLATFORM=linux/amd64
   docker build --memory=4g ./backend
   
   # Use multi-stage builds to reduce memory usage
   # Optimize node_modules installation
   RUN npm ci --only=production --no-audit --no-fund
   ```

2. **Build Failures in CI**
   ```yaml
   # Increase timeout for build steps
   - name: Build application
     run: npm run build
     timeout-minutes: 20
   
   # Add retry logic
   - uses: nick-invision/retry@v2
     with:
       timeout_minutes: 10
       max_attempts: 3
       command: npm run build
   ```

3. **Docker Layer Caching Issues**
   ```bash
   # Clear Docker build cache
   docker builder prune
   
   # Force rebuild without cache
   docker build --no-cache -t app .
   
   # Check layer sizes
   docker history prompt-card-backend:latest
   ```

### Deployment Troubleshooting

1. **Service Won't Start**
   ```bash
   # Check logs
   docker-compose logs backend
   
   # Check resource usage
   docker stats
   
   # Inspect container
   docker exec -it backend sh
   ```

2. **Database Connection Issues**
   ```bash
   # Check file permissions
   ls -la backend/data/
   
   # Check SQLite database
   sqlite3 backend/data/database.sqlite ".schema"
   
   # Test connection
   docker exec backend node -e "require('./dist/database/connection').testConnection()"
   ```

This comprehensive build and deployment guide provides the foundation for reliable, scalable deployments of the Prompt Card System across all environments.