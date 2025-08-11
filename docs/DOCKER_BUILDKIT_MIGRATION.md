# Docker BuildKit Migration Guide

## 🚀 Overview

This guide covers the migration from Docker's deprecated legacy builder to the modern Docker BuildKit system for the Prompt Card System project.

## ⚠️ Why Migrate?

The legacy Docker builder is deprecated and will be removed in a future release. The deprecation warning states:

```
DEPRECATED: The legacy builder is deprecated and will be removed in a future release.
Install the buildx component to build images with BuildKit:
https://docs.docker.com/go/buildx/
```

## ✅ What We've Updated

### 1. GitHub Actions CI/CD Pipeline

**File**: `.github/workflows/ci.yml`

**Changes**:
- Updated Docker Buildx setup with latest version and modern driver
- Added multi-platform support (linux/amd64, linux/arm64)
- Enhanced BuildKit flags for security and network features
- Configured advanced caching with GitHub Actions cache

```yaml
- name: Set up Docker Buildx with enhanced features (Modern BuildKit)
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
    platforms: linux/amd64,linux/arm64
    install: true
```

### 2. Docker Compose Configuration

**Files**: `docker-compose.yml`, `docker-compose.prod.yml`

**Changes**:
- Added BuildKit environment configuration
- Updated build sections with modern BuildKit features
- Implemented advanced caching strategies
- Added multi-platform build support

```yaml
# Enable BuildKit for modern Docker builds
x-buildkit-config: &buildkit-config
  DOCKER_BUILDKIT: 1
  COMPOSE_DOCKER_CLI_BUILD: 1

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      # Modern BuildKit configuration
      target: production
      args:
        - NODE_ENV=production
        - BUILDKIT_INLINE_CACHE=1
      # BuildKit cache configuration
      cache_from:
        - node:20-alpine
        - type=gha
      cache_to:
        - type=gha,mode=max
    environment:
      <<: *buildkit-config
```

### 3. Package.json Scripts

**File**: `package.json`

**New Scripts**:
```json
{
  "scripts": {
    "docker:setup-buildx": "./scripts/docker-buildx-setup.sh",
    "docker:build:modern": "DOCKER_BUILDKIT=1 docker buildx build --platform linux/amd64,linux/arm64",
    "docker:build:cache": "docker buildx build --cache-from type=gha --cache-to type=gha,mode=max",
    "docker:build:multi": "docker buildx build --platform linux/amd64,linux/arm64 --push"
  }
}
```

### 4. Setup Script

**File**: `scripts/docker-buildx-setup.sh`

A comprehensive script that:
- Installs Docker Buildx if not available
- Creates modern BuildKit builder with advanced features
- Configures environment variables
- Sets up caching strategies
- Provides testing and validation
- Creates helper files and configurations

## 🛠️ How to Use the New System

### Option 1: Automatic Setup

Run the setup script to automatically configure everything:

```bash
# Make script executable (if not already)
chmod +x scripts/docker-buildx-setup.sh

# Run setup
./scripts/docker-buildx-setup.sh
```

### Option 2: Manual Setup

1. **Install Docker Buildx** (if not available):
   ```bash
   # Linux
   mkdir -p ~/.docker/cli-plugins/
   curl -L "https://github.com/docker/buildx/releases/latest/download/buildx-v0.12.0.linux-amd64" -o ~/.docker/cli-plugins/docker-buildx
   chmod +x ~/.docker/cli-plugins/docker-buildx
   
   # macOS
   mkdir -p ~/.docker/cli-plugins/
   curl -L "https://github.com/docker/buildx/releases/latest/download/buildx-v0.12.0.darwin-amd64" -o ~/.docker/cli-plugins/docker-buildx
   chmod +x ~/.docker/cli-plugins/docker-buildx
   ```

2. **Create Builder**:
   ```bash
   docker buildx create \
     --name prompt-card-builder \
     --driver docker-container \
     --driver-opt network=host \
     --driver-opt image=moby/buildkit:latest \
     --buildkitd-flags '--allow-insecure-entitlement security.insecure --allow-insecure-entitlement network.host' \
     --platform linux/amd64,linux/arm64 \
     --bootstrap \
     --use
   ```

3. **Set Environment Variables**:
   ```bash
   export DOCKER_BUILDKIT=1
   export COMPOSE_DOCKER_CLI_BUILD=1
   export BUILDKIT_PROGRESS=plain
   export BUILDKIT_COLORS=1
   ```

## 🚀 Building Images

### Single Platform Build

```bash
# Build for current platform
docker buildx build --tag prompt-card-frontend:latest ./frontend
```

### Multi-Platform Build

```bash
# Build for multiple platforms
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag prompt-card-frontend:latest \
  --push \
  ./frontend
```

### With Advanced Caching

```bash
# Build with GitHub Actions cache
docker buildx build \
  --cache-from type=gha,scope=frontend \
  --cache-to type=gha,mode=max,scope=frontend \
  --tag prompt-card-frontend:latest \
  ./frontend
```

### Using Docker Compose

```bash
# Regular compose build (now uses BuildKit)
docker-compose build

# With BuildKit override
docker-compose -f docker-compose.yml -f docker-compose.buildkit.yml build
```

## 📊 Benefits of Migration

### 1. Performance Improvements
- **Faster Builds**: Parallel execution and improved caching
- **Efficient Layer Caching**: Better layer reuse and sharing
- **Multi-stage Optimization**: Enhanced multi-stage build performance

### 2. Advanced Features
- **Multi-platform Builds**: Native support for ARM64 and AMD64
- **Advanced Caching**: Multiple cache backends (GitHub Actions, registry, local)
- **Secrets Management**: Secure build-time secrets handling
- **Network Modes**: Advanced networking options

### 3. Future-Proofing
- **Modern Standards**: Aligned with Docker's future direction
- **OCI Compliance**: Full OCI image specification support
- **Buildx Integration**: Native integration with Docker Desktop and CLI

### 4. CI/CD Optimization
- **GitHub Actions Cache**: Integrated caching for faster CI builds
- **Multi-platform CI**: Build for multiple architectures simultaneously
- **Improved Security**: Enhanced security features and entitlements

## 🔧 Troubleshooting

### Common Issues

1. **Builder Not Found**:
   ```bash
   docker buildx ls
   docker buildx create --name mybuilder --use
   ```

2. **Platform Not Supported**:
   ```bash
   docker run --rm --privileged multiarch/qemu-user-static --reset -p yes
   ```

3. **Cache Issues**:
   ```bash
   docker buildx prune
   docker system prune -a
   ```

4. **Permission Issues**:
   ```bash
   sudo chmod +x scripts/docker-buildx-setup.sh
   ```

### Verification

1. **Check BuildKit Status**:
   ```bash
   docker buildx version
   docker buildx ls
   docker buildx inspect
   ```

2. **Test Build**:
   ```bash
   docker buildx build --platform linux/amd64 --tag test:latest ./frontend
   ```

3. **Verify Multi-platform**:
   ```bash
   docker buildx build --platform linux/amd64,linux/arm64 --tag test:latest ./frontend
   ```

## 📚 Additional Resources

- [Docker Buildx Documentation](https://docs.docker.com/buildx/)
- [BuildKit Documentation](https://docs.docker.com/build/buildkit/)
- [Multi-platform Images](https://docs.docker.com/build/building/multi-platform/)
- [GitHub Actions Cache](https://docs.docker.com/build/ci/github-actions/cache/)

## 🎯 Migration Status

✅ **Completed**:
- GitHub Actions CI/CD pipeline updated
- Docker Compose files modernized
- Package.json scripts added
- Setup script created
- Documentation completed

⚠️ **Next Steps**:
- Test multi-platform builds in CI
- Validate caching performance
- Update deployment documentation
- Train team on new workflows

---

**Note**: This migration ensures the Prompt Card System uses modern Docker BuildKit instead of the deprecated legacy builder, providing improved performance, security, and future compatibility.