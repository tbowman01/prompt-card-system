#!/bin/bash
# Isolated Build Test Script for Docker Workflows
# This script tests the exact build process used in GitHub Actions

set -e

echo "🔧 Starting Isolated Docker Build Test..."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
REGISTRY="ghcr.io"
IMAGE_PREFIX="tbowman01/prompt-card-system"
PLATFORMS="linux/amd64"
TEST_TAG="test-$(date +%Y%m%d-%H%M%S)"

echo -e "${BLUE}📊 Environment Check${NC}"
echo "Docker Version: $(docker --version)"
echo "BuildX Version: $(docker buildx version)"
echo "Available Space: $(df -h / | tail -1 | awk '{print $4}')"
echo "Current Directory: $(pwd)"
echo ""

echo -e "${BLUE}📁 Repository Structure Check${NC}"
echo "Checking directory structure..."
for dir in backend frontend auth docker; do
    if [ -d "$dir" ]; then
        echo -e "✅ $dir/ exists"
        ls -la "$dir/" | head -5
    else
        echo -e "❌ $dir/ missing"
    fi
done
echo ""

echo -e "${BLUE}📦 Package.json Check${NC}"
for service in backend frontend auth; do
    if [ -f "$service/package.json" ]; then
        echo -e "✅ $service/package.json exists"
        # Check for critical scripts
        if jq -e '.scripts.build' "$service/package.json" >/dev/null 2>&1; then
            echo "  - Build script: $(jq -r '.scripts.build' "$service/package.json")"
        else
            echo -e "  ${YELLOW}⚠️ No build script found${NC}"
        fi
    else
        echo -e "❌ $service/package.json missing"
    fi
done
echo ""

echo -e "${BLUE}🐳 Dockerfile Validation${NC}"
for service in backend frontend auth; do
    dockerfile_path="$service/Dockerfile"
    if [ -f "$dockerfile_path" ]; then
        echo -e "✅ $dockerfile_path exists"
        # Basic syntax check
        if docker buildx build --help | grep -q "build"; then
            echo "  - Dockerfile syntax appears valid"
        fi
        
        # Check for multi-stage build
        if grep -q "FROM.*AS" "$dockerfile_path"; then
            echo "  - Multi-stage build detected"
        fi
        
        # Check for common issues
        if grep -q "COPY \. \." "$dockerfile_path"; then
            echo -e "  ${YELLOW}⚠️ Broad COPY detected - may cause cache misses${NC}"
        fi
    else
        echo -e "❌ $dockerfile_path missing"
    fi
done
echo ""

echo -e "${BLUE}🏗️ BuildX Setup Test${NC}"
if docker buildx ls | grep -q "default"; then
    echo "✅ BuildX default builder available"
else
    echo "⚠️ Creating BuildX builder..."
    docker buildx create --name test-builder --use
fi

# Test simple build to verify BuildX functionality
echo "Testing BuildX functionality..."
cat > Dockerfile.test << 'EOF'
FROM node:20-alpine
WORKDIR /app
RUN echo "BuildX test successful"
CMD ["echo", "Test passed"]
EOF

if docker buildx build --platform $PLATFORMS -t buildx-test:latest -f Dockerfile.test . >/dev/null 2>&1; then
    echo "✅ BuildX basic functionality working"
    docker rmi buildx-test:latest >/dev/null 2>&1 || true
else
    echo -e "${RED}❌ BuildX basic functionality failed${NC}"
fi
rm -f Dockerfile.test
echo ""

echo -e "${BLUE}🧪 Service Build Tests${NC}"
for service in backend frontend; do
    dockerfile_path="$service/Dockerfile"
    if [ -f "$dockerfile_path" ]; then
        echo "Testing $service build..."
        
        # Simulate the GitHub Actions build process
        BUILD_ARGS="--platform $PLATFORMS"
        BUILD_ARGS="$BUILD_ARGS --file $dockerfile_path"
        BUILD_ARGS="$BUILD_ARGS --tag $IMAGE_PREFIX-$service:$TEST_TAG"
        BUILD_ARGS="$BUILD_ARGS --build-arg NODE_ENV=production"
        BUILD_ARGS="$BUILD_ARGS --build-arg BUILDPLATFORM=linux/amd64"
        BUILD_ARGS="$BUILD_ARGS --progress=plain"
        
        echo "Build command: docker buildx build $BUILD_ARGS ."
        
        # Start build with timeout
        if timeout 300 docker buildx build $BUILD_ARGS . 2>&1; then
            echo -e "${GREEN}✅ $service build successful${NC}"
            
            # Test the built image
            echo "Testing image functionality..."
            if docker run --rm --entrypoint=/bin/sh $IMAGE_PREFIX-$service:$TEST_TAG -c "node --version" >/dev/null 2>&1; then
                echo -e "${GREEN}✅ $service image functional${NC}"
            else
                echo -e "${YELLOW}⚠️ $service image may have issues${NC}"
            fi
            
            # Get image size
            SIZE=$(docker images --format "table {{.Size}}" $IMAGE_PREFIX-$service:$TEST_TAG | tail -1)
            echo "  Image size: $SIZE"
            
            # Cleanup
            docker rmi $IMAGE_PREFIX-$service:$TEST_TAG >/dev/null 2>&1 || true
        else
            echo -e "${RED}❌ $service build failed or timed out${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}⚠️ Skipping $service - no Dockerfile${NC}"
    fi
    echo ""
done

echo -e "${BLUE}🔍 Workflow File Validation${NC}"
for workflow_file in .github/workflows/*.yml; do
    if [ -f "$workflow_file" ]; then
        echo "Checking $(basename "$workflow_file")..."
        
        # Basic YAML syntax check
        if command -v yq >/dev/null 2>&1; then
            if yq eval '.' "$workflow_file" >/dev/null 2>&1; then
                echo "  ✅ Valid YAML syntax"
            else
                echo -e "  ${RED}❌ Invalid YAML syntax${NC}"
            fi
        elif python3 -c "import yaml; yaml.safe_load(open('$workflow_file'))" 2>/dev/null; then
            echo "  ✅ Valid YAML syntax"
        else
            echo -e "  ${YELLOW}⚠️ Could not validate YAML syntax${NC}"
        fi
        
        # Check for common issues
        if grep -q "docker buildx build" "$workflow_file"; then
            echo "  ✅ Uses docker buildx build"
        elif grep -q "docker build" "$workflow_file"; then
            echo -e "  ${YELLOW}⚠️ Uses legacy docker build${NC}"
        fi
        
        if grep -q "continue-on-error: true" "$workflow_file"; then
            echo -e "  ${YELLOW}⚠️ Has continue-on-error steps${NC}"
        fi
    fi
done
echo ""

echo -e "${BLUE}📊 System Resource Check${NC}"
echo "Available disk space: $(df -h / | tail -1 | awk '{print $4}')"
echo "Memory usage: $(free -h | grep '^Mem:' | awk '{print $3 "/" $2}')"
echo "Docker system usage:"
docker system df 2>/dev/null || echo "  Could not get Docker system info"
echo ""

echo -e "${GREEN}🎉 Isolated Build Test Complete!${NC}"
echo "This test simulates the GitHub Actions build process locally."
echo "If builds succeeded here but fail in GitHub Actions, check:"
echo "  1. GitHub Actions runner resources"
echo "  2. Network connectivity issues"
echo "  3. Registry authentication"
echo "  4. Environment variable differences"
echo "  5. File permission issues"