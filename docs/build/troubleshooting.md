# Build Troubleshooting Guide

## Overview

This guide provides solutions for common build issues encountered when building the Prompt Card System.

## Common Build Issues

### 1. Node.js and npm Issues

#### Version Compatibility
**Problem**: Node.js version mismatch errors
```
error This project requires Node.js >=20.0.0
```

**Solution**:
```bash
# Check current version
node --version
npm --version

# Install correct Node.js version using nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# Verify installation
node --version  # Should show v20.x.x
```

#### Package Installation Failures
**Problem**: npm install fails with permission errors
```
EACCES: permission denied, mkdir '/usr/local/lib/node_modules'
```

**Solution**:
```bash
# Option 1: Use npm's built-in permission fix
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH

# Option 2: Use node version manager (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# Option 3: Fix npm permissions
sudo chown -R $(whoami) $(npm config get prefix)/{lib/node_modules,bin,share}
```

#### Cache Issues
**Problem**: Corrupted npm cache causing build failures
```
npm ERR! Unexpected end of JSON input while parsing near
```

**Solution**:
```bash
# Clear npm cache
npm cache clean --force

# Verify cache
npm cache verify

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### 2. TypeScript Build Issues

#### Compilation Errors
**Problem**: TypeScript compilation fails with type errors
```
error TS2307: Cannot find module 'xyz' or its type declarations
```

**Solution**:
```bash
# Install missing type definitions
npm install @types/node @types/express --save-dev

# Update TypeScript configuration
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": false,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "strict": false,
    "noEmitOnError": false
  }
}
EOF

# Force rebuild
npm run build -- --force
```

#### Memory Issues
**Problem**: TypeScript compiler runs out of memory
```
FATAL ERROR: Ineffective mark-compacts near heap limit
```

**Solution**:
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=8192"

# Or modify package.json script
"build": "NODE_OPTIONS='--max-old-space-size=8192' tsc"

# For persistent fix, add to .bashrc or .zshrc
echo 'export NODE_OPTIONS="--max-old-space-size=8192"' >> ~/.bashrc
```

### 3. Next.js Build Issues

#### Build Failures
**Problem**: Next.js build fails with webpack errors
```
Error: Failed to load config
```

**Solution**:
```bash
# Check Next.js configuration
cd frontend

# Create minimal next.config.js if missing
cat > next.config.js << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  generateEtags: false,
  compress: true,
  swcMinify: true,
  productionBrowserSourceMaps: false,
}
module.exports = nextConfig
EOF

# Clear Next.js cache
rm -rf .next
npm run build
```

#### Standalone Output Issues
**Problem**: Standalone build doesn't generate server.js
```
Error: Could not find a valid build in the '.next' directory
```

**Solution**:
```bash
# Verify Next.js configuration
cat next.config.js

# Ensure output is set to standalone
sed -i 's/output: .*/output: "standalone",/' next.config.js

# Force clean build
rm -rf .next node_modules
npm install
npm run build

# Verify standalone output
ls -la .next/standalone/
```

### 4. Docker Build Issues

#### Layer Caching Problems
**Problem**: Docker builds take too long or fail to use cache
```
Step 15/20 : RUN npm ci
 ---> Running in abc123
npm ERR! network timeout
```

**Solution**:
```bash
# Enable BuildKit
export DOCKER_BUILDKIT=1

# Use cache mounts in Dockerfile
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline

# Build with cache
docker buildx build --cache-from type=local,src=/tmp/.buildx-cache .
```

#### Multi-architecture Build Issues
**Problem**: Cross-platform builds fail
```
exec user process caused: exec format error
```

**Solution**:
```bash
# Setup buildx
docker buildx create --name mybuilder --use
docker buildx inspect --bootstrap

# Use correct platform in Dockerfile
FROM --platform=$BUILDPLATFORM node:20-alpine AS base

# Build for specific platforms
docker buildx build --platform linux/amd64,linux/arm64 .
```

#### Out of Disk Space
**Problem**: Docker build fails due to insufficient disk space
```
no space left on device
```

**Solution**:
```bash
# Clean Docker system
docker system prune -a --volumes

# Remove unused images
docker image prune -a

# Check disk usage
docker system df

# Monitor build progress
docker buildx build --progress=plain .
```

### 5. Database Connection Issues

#### SQLite Issues
**Problem**: Database file permissions or corruption
```
Error: SQLITE_CANTOPEN: unable to open database file
```

**Solution**:
```bash
# Check database directory permissions
ls -la data/
chmod 755 data/
chmod 644 data/database.sqlite

# Recreate database if corrupted
rm data/database.sqlite
npm run db:migrate

# Test database connection
sqlite3 data/database.sqlite ".tables"
```

### 6. Environment Configuration Issues

#### Missing Environment Variables
**Problem**: Build fails due to missing environment variables
```
Error: Environment variable NODE_ENV is required
```

**Solution**:
```bash
# Create .env file
cat > .env << 'EOF'
NODE_ENV=production
DATABASE_URL=sqlite:./data/database.sqlite
PORT=3001
EOF

# Load environment variables
export $(cat .env | xargs)

# Verify variables
env | grep -E "(NODE_ENV|DATABASE_URL|PORT)"
```

## Diagnostic Tools

### Build Health Check Script
```bash
#!/bin/bash
# build-health-check.sh

echo "🔍 Running build health check..."

# Check Node.js and npm
echo "Node.js: $(node --version || echo 'NOT INSTALLED')"
echo "npm: $(npm --version || echo 'NOT INSTALLED')"

# Check TypeScript
echo "TypeScript: $(npx tsc --version || echo 'NOT INSTALLED')"

# Check disk space
echo "Disk space:"
df -h .

# Check memory
echo "Available memory:"
free -h 2>/dev/null || vm_stat 2>/dev/null || echo "Memory info not available"

# Check Docker
echo "Docker: $(docker --version || echo 'NOT INSTALLED')"
echo "Docker BuildKit: $(echo $DOCKER_BUILDKIT || echo 'NOT ENABLED')"

# Check build dependencies
echo "Build dependencies:"
[ -f "package.json" ] && echo "✅ package.json found" || echo "❌ package.json missing"
[ -f "tsconfig.json" ] && echo "✅ tsconfig.json found" || echo "❌ tsconfig.json missing"
[ -d "node_modules" ] && echo "✅ node_modules found" || echo "❌ node_modules missing"

echo "✅ Health check complete"
```

### Build Verification Script
```bash
#!/bin/bash
# build-verify.sh

echo "🔍 Verifying build outputs..."

# Frontend verification
if [ -d "frontend/.next" ]; then
    echo "✅ Frontend build found"
    if [ -f "frontend/.next/standalone/server.js" ]; then
        echo "✅ Standalone output found"
    else
        echo "❌ Standalone output missing"
        exit 1
    fi
else
    echo "❌ Frontend build missing"
    exit 1
fi

# Backend verification
if [ -d "backend/dist" ]; then
    echo "✅ Backend build found"
    if [ -f "backend/dist/server.js" ]; then
        echo "✅ Backend server found"
    else
        echo "❌ Backend server missing"
        exit 1
    fi
else
    echo "❌ Backend build missing"
    exit 1
fi

echo "✅ Build verification complete"
```

## Performance Optimization

### Build Time Optimization
```bash
# Enable parallel builds
export NODE_OPTIONS="--max-old-space-size=8192"
npm run build -- --parallel

# Use npm ci instead of npm install
npm ci --prefer-offline

# Enable TypeScript incremental compilation
echo '{"extends": "./tsconfig.json", "compilerOptions": {"incremental": true}}' > tsconfig.build.json
```

### Memory Optimization
```bash
# Monitor memory usage during build
watch -n 1 'free -h'

# Increase swap space if needed
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

## Automated Troubleshooting

### Quick Fix Script
```bash
#!/bin/bash
# quick-fix.sh

echo "🔧 Running automated fixes..."

# Fix npm permissions
sudo chown -R $(whoami) $(npm config get prefix)/{lib/node_modules,bin,share} 2>/dev/null || true

# Clear caches
npm cache clean --force
rm -rf node_modules package-lock.json
rm -rf frontend/node_modules frontend/package-lock.json
rm -rf backend/node_modules backend/package-lock.json

# Reinstall dependencies
npm install
cd frontend && npm install && cd ..
cd backend && npm install && cd ..

# Clear build outputs
rm -rf frontend/.next
rm -rf backend/dist

# Rebuild
npm run build

echo "✅ Automated fixes complete"
```

## Getting Help

### Log Collection
```bash
# Collect build logs
npm run build > build.log 2>&1

# Collect system info
uname -a > system-info.txt
node --version >> system-info.txt
npm --version >> system-info.txt
docker --version >> system-info.txt

# Create support bundle
tar -czf support-bundle.tar.gz build.log system-info.txt package*.json
```

### Support Contacts
- **GitHub Issues**: https://github.com/tbowman01/prompt-card-system/issues
- **Documentation**: [Documentation Index](../DOCUMENTATION_INDEX.md)
- **Build Guide**: [Docker Builds](./docker-builds.md)

## Next Steps

1. Review [Docker builds guide](./docker-builds.md) for detailed build process
2. Check [offline builds guide](./offline-builds.md) for air-gapped environments  
3. See [deployment guide](../deployment/ghcr-deployment.md) for production deployment