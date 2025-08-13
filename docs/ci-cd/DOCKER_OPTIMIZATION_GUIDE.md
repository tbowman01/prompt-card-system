# 🐳 Docker Optimization Guide

## Overview

This guide covers the advanced Docker optimization system implemented for multi-platform builds, security scanning, and performance optimization in the enterprise vLLM platform.

## 🏗️ Advanced BuildKit Features

### Multi-Platform Architecture

The system supports building for multiple architectures simultaneously:

```yaml
platforms: linux/amd64,linux/arm64
```

**Benefits**:
- **Apple Silicon Support**: Native ARM64 builds for M1/M2 Macs
- **Cloud Optimization**: Platform-specific optimizations
- **Edge Deployment**: Support for ARM-based edge devices
- **Future-Proofing**: Ready for emerging architectures

### BuildKit Configuration

**Enhanced BuildKit Setup**:
```yaml
- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v3
  with:
    version: latest
    driver: docker-container
    driver-opts: |
      network=host
      image=moby/buildkit:latest
    buildkitd-flags: |
      --allow-insecure-entitlement security.insecure
      --allow-insecure-entitlement network.host
      --oci-worker-gc=true
      --oci-worker-gc-keepstorage=10000mb
```

**Key Features Enabled**:
- **Cache Mounts**: Persistent dependency caching
- **Secret Mounts**: Secure credential handling
- **SSH Mounts**: Private repository access
- **Multi-Platform**: Cross-architecture builds
- **Attestations**: Security metadata generation

## 🚀 Build Optimization Strategies

### Multi-Stage Build Optimization

**Example Optimized Dockerfile**:
```dockerfile
# syntax=docker/dockerfile:1.7-labs
FROM --platform=$BUILDPLATFORM node:20-alpine AS base
WORKDIR /app
# Install dependencies that rarely change first
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production

FROM base AS build
RUN --mount=type=cache,target=/root/.npm \
    npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=base /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./
EXPOSE 3000
USER node
CMD ["node", "dist/server.js"]
```

**Optimization Techniques**:
- **Layer Ordering**: Dependencies installed before source code
- **Cache Mounts**: npm cache persistence across builds
- **Multi-Stage**: Separate build and runtime environments
- **Minimal Runtime**: Production-only dependencies
- **Security**: Non-root user execution

### Caching Strategy

**Three-Tier Caching**:
1. **Registry Cache**: Shared across all builds
2. **GitHub Actions Cache**: CI-specific optimization
3. **Local Cache**: Developer machine optimization

```yaml
cache-from: |
  type=gha,scope=backend
  type=registry,ref=registry.io/user/app:cache
cache-to: |
  type=gha,mode=max,scope=backend
  type=registry,ref=registry.io/user/app:cache,mode=max
```

### Build Arguments and Secrets

**Secure Build Arguments**:
```yaml
build-args: |
  BUILDKIT_INLINE_CACHE=1
  NODE_ENV=production
  BUILD_DATE=${{ fromJSON(steps.meta.outputs.json).labels['org.opencontainers.image.created'] }}
  VCS_REF=${{ github.sha }}
secrets: |
  npm_token=${{ secrets.NPM_TOKEN }}
```

**Secret Mounting in Dockerfile**:
```dockerfile
RUN --mount=type=secret,id=npm_token \
    npm config set //registry.npmjs.org/:_authToken=$(cat /run/secrets/npm_token) && \
    npm ci
```

## 🔒 Security Scanning Integration

### Vulnerability Scanning Tools

**Trivy Integration**:
```bash
# Container vulnerability scan
trivy image --exit-code 0 --severity HIGH,CRITICAL \
  --format table \
  --output trivy-report.txt \
  $IMAGE_ID

# Configuration scanning
trivy config --severity HIGH,CRITICAL \
  --format json \
  --output trivy-config.json \
  ./Dockerfile
```

**Hadolint Dockerfile Linting**:
```bash
# Dockerfile best practices validation
hadolint Dockerfile --format json > hadolint-report.json
```

**SBOM Generation with Syft**:
```bash
# Generate Software Bill of Materials
syft $IMAGE_ID -o json > sbom.json
syft $IMAGE_ID -o table > sbom.txt
```

### Security Best Practices

**Dockerfile Security Checklist**:
- ✅ Use specific base image tags (not `latest`)
- ✅ Run as non-root user
- ✅ Minimize attack surface (multi-stage builds)
- ✅ Use `COPY` instead of `ADD`
- ✅ Set resource limits
- ✅ Use health checks
- ✅ Scan for vulnerabilities
- ✅ Sign images with content trust

**Example Secure Dockerfile**:
```dockerfile
FROM node:20.11.0-alpine3.19 AS base
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY --chown=nextjs:nodejs . .
USER nextjs

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

EXPOSE 3000
CMD ["node", "server.js"]
```

## 📊 Performance Optimization

### Image Size Optimization

**Size Reduction Techniques**:
1. **Alpine Base Images**: Minimal Linux distribution
2. **Multi-Stage Builds**: Exclude build dependencies
3. **Layer Optimization**: Combine RUN commands
4. **File Exclusion**: Use `.dockerignore`
5. **Dependency Pruning**: Production-only packages

**Example .dockerignore**:
```
node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.nyc_output
coverage
.nyc_output
.coverage
docs
tests
*.test.js
*.spec.js
```

### Build Performance

**Parallel Build Strategy**:
```yaml
# Backend and frontend builds in parallel
- name: Build images in parallel
  run: |
    {
      docker buildx build \
        --platform ${{ matrix.platforms }} \
        --file ./backend/Dockerfile \
        --tag backend:latest \
        ./backend
    } &
    {
      docker buildx build \
        --platform ${{ matrix.platforms }} \
        --file ./frontend/Dockerfile \
        --tag frontend:latest \
        ./frontend
    } &
    wait
```

**Resource Optimization**:
- **CPU Limits**: Prevent build resource exhaustion
- **Memory Limits**: Optimize for available resources
- **Parallel Workers**: Multi-core build utilization
- **Cache Strategy**: Maximize cache hit rates

## 🎯 Registry Management

### Image Tagging Strategy

**Automated Tagging**:
```yaml
tags: |
  type=ref,event=branch
  type=ref,event=pr
  type=sha,prefix={{branch}}-
  type=raw,value=latest,enable={{is_default_branch}}
  type=raw,value=canary,enable={{is_default_branch}}
```

**Tag Examples**:
- `main` - Main branch builds
- `pr-123` - Pull request builds
- `main-abc1234` - Commit-specific builds
- `latest` - Latest stable release
- `canary` - Pre-release builds

### Registry Cleanup

**Automated Cleanup Strategy**:
```yaml
retention_policy:
  keep_last_n: 10        # Keep 10 most recent
  keep_weekly: 4         # Keep 4 weekly builds
  keep_monthly: 12       # Keep 12 monthly builds
  cleanup_untagged: true # Remove untagged images
  cleanup_interval: "24h" # Daily cleanup
```

## 🔧 BuildKit Advanced Features

### Cache Mounts

**Dependency Caching**:
```dockerfile
# npm cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# apt cache mount
RUN --mount=type=cache,target=/var/cache/apt \
    --mount=type=cache,target=/var/lib/apt \
    apt-get update && apt-get install -y git
```

### Secret Mounts

**Secure Credential Handling**:
```dockerfile
# Mount secret without storing in layer
RUN --mount=type=secret,id=github_token \
    git clone https://$(cat /run/secrets/github_token)@github.com/private/repo.git
```

### SSH Mounts

**Private Repository Access**:
```dockerfile
# Mount SSH key for private repos
RUN --mount=type=ssh \
    git clone git@github.com:private/repo.git
```

## 📈 Monitoring and Analytics

### Build Metrics

**Collected Metrics**:
- Build duration by stage
- Image sizes by layer
- Cache hit rates
- Security scan results
- Resource utilization

**Example Metrics Output**:
```json
{
  "build_metrics": {
    "total_duration": 240,
    "stage_durations": {
      "base": 45,
      "build": 120,
      "runtime": 75
    },
    "image_size": {
      "total": "185MB",
      "layers": 12,
      "largest_layer": "45MB"
    },
    "cache_efficiency": {
      "hit_rate": 85,
      "saved_time": 180
    }
  }
}
```

### Performance Tracking

**Optimization Targets**:
- **Backend Image**: < 200MB
- **Frontend Image**: < 50MB
- **Build Time**: < 5 minutes
- **Cache Hit Rate**: > 80%
- **Security Score**: > 95%

## 🚀 Development Workflow

### Local Development

**Local Multi-Platform Testing**:
```bash
# Create multi-platform builder
docker buildx create --name multiarch --driver docker-container --use

# Test multi-platform build
docker buildx build --platform linux/amd64,linux/arm64 -t test:multiarch .

# Inspect multi-platform manifest
docker buildx imagetools inspect test:multiarch
```

### CI/CD Integration

**Workflow Triggers**:
- **Push**: Automatic builds on main/develop
- **PR**: Validation builds with security scanning
- **Schedule**: Weekly security updates
- **Manual**: On-demand builds with custom parameters

**Build Matrix Example**:
```yaml
strategy:
  matrix:
    include:
      - service: backend
        dockerfile: backend/Dockerfile.prod
        context: ./backend
        platforms: linux/amd64,linux/arm64
        size_target: "< 200MB"
      - service: frontend
        dockerfile: frontend/Dockerfile.prod
        context: ./frontend
        platforms: linux/amd64,linux/arm64
        size_target: "< 50MB"
```

## 🛠️ Troubleshooting

### Common Issues

#### BuildKit Setup Issues
```bash
# Reset BuildKit
docker buildx rm multiarch
docker buildx create --name multiarch --driver docker-container --use

# Check available platforms
docker buildx inspect --bootstrap
```

#### Cache Issues
```bash
# Clear build cache
docker buildx prune -f

# Check cache usage
docker system df
```

#### Multi-Platform Issues
```bash
# Install QEMU for emulation
docker run --rm --privileged multiarch/qemu-user-static --reset -p yes

# Test platform support
docker buildx build --platform linux/arm64 -t test:arm64 .
```

### Performance Issues

#### Slow Builds
- **Check cache hit rates**: Optimize layer ordering
- **Reduce context size**: Use `.dockerignore`
- **Parallelize builds**: Use multi-stage builds
- **Optimize base images**: Use Alpine variants

#### Large Images
- **Multi-stage builds**: Separate build/runtime
- **Remove build dependencies**: Use production installs
- **Optimize layers**: Combine RUN commands
- **Use distroless**: Minimal runtime images

## 📋 Best Practices Summary

### Security
- ✅ Use official base images with specific tags
- ✅ Scan images for vulnerabilities regularly
- ✅ Run containers as non-root users
- ✅ Use multi-stage builds to reduce attack surface
- ✅ Generate and review SBOMs
- ✅ Implement image signing and verification

### Performance
- ✅ Optimize layer caching and ordering
- ✅ Use multi-platform builds for compatibility
- ✅ Implement parallel build strategies
- ✅ Monitor and optimize image sizes
- ✅ Use registry caching effectively

### Maintainability
- ✅ Follow consistent tagging strategies
- ✅ Implement automated cleanup policies
- ✅ Use clear and documented Dockerfiles
- ✅ Monitor build metrics and trends
- ✅ Maintain security compliance

This Docker optimization system provides enterprise-grade container builds with security, performance, and maintainability at scale.