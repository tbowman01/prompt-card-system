# CI/CD Pipeline Architecture

## Table of Contents

1. [Overview](#overview)
2. [Pipeline Architecture](#pipeline-architecture)
3. [Workflow Stages](#workflow-stages)
4. [Security Integration](#security-integration)
5. [Quality Assurance](#quality-assurance)
6. [Deployment Strategies](#deployment-strategies)
7. [Monitoring & Observability](#monitoring--observability)
8. [Performance Optimization](#performance-optimization)

## Overview

The Prompt Card System implements a comprehensive CI/CD pipeline using GitHub Actions with 18+ automated workflows designed for enterprise-grade development, security, and deployment processes.

### Pipeline Philosophy

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Continuous Integration                           │
│                         Philosophy                                  │
├─────────────────────────────────────────────────────────────────────┤
│ • Shift Left Security    • Automated Quality Gates                 │
│ • Fast Feedback Loops    • Parallel Execution                      │
│ • Zero-Downtime Deploy   • Comprehensive Testing                   │
│ • Infrastructure as Code • Monitoring Integration                  │
└─────────────────────────────────────────────────────────────────────┘
```

## Pipeline Architecture

### High-Level Workflow Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│                        GitHub Repository                           │
│                    (Source Code + IaC)                             │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    GitHub Actions Workflows                        │
├─────────────────────────────────────────────────────────────────────┤
│  Core Workflows       │    Security Workflows   │  Quality Workflows│
│  ┌─────────────────┐  │  ┌─────────────────┐    │  ┌──────────────┐ │
│  │ ci.yml          │  │  │ security-scan   │    │  │ test-suite   │ │
│  │ cd.yml          │  │  │ codeql          │    │  │ performance  │ │
│  │ pr-validation   │  │  │ dependency-scan │    │  │ docs-validation│ │
│  └─────────────────┘  │  └─────────────────┘    │  └──────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│  Maintenance Workflows│   Monitoring Workflows │  Release Workflows│
│  ┌─────────────────┐  │  ┌─────────────────┐    │  ┌──────────────┐ │
│  │ maintenance     │  │  │ issue-triage    │    │  │ release      │ │
│  │ label-sync      │  │  │ project-board   │    │  │ scorecard    │ │
│  │ smart-assignment│  │  │ progress-track  │    │  │ signed-commits│ │
│  └─────────────────┘  │  └─────────────────┘    │  └──────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Deployment Targets                              │
├─────────────────────────────────────────────────────────────────────┤
│  Development         │    Staging           │    Production        │
│  • Feature Branches  │    • Integration     │    • Blue-Green      │
│  • Hot Reload        │    • Load Testing    │    • Canary Deploy   │
│  • Mock Services     │    • E2E Testing     │    • Health Checks   │
└─────────────────────────────────────────────────────────────────────┘
```

### Workflow Matrix

| Workflow | Trigger | Purpose | Duration | Dependencies |
|----------|---------|---------|----------|--------------|
| `ci.yml` | Push, PR | Build, Test, Security | 8-12 min | None |
| `cd.yml` | Main branch, Tags | Deploy to staging/prod | 15-20 min | CI success |
| `security-scan.yml` | Daily, PR | Vulnerability scan | 5-8 min | None |
| `test-suite.yml` | PR, Schedule | Comprehensive testing | 20-30 min | None |
| `performance-monitoring.yml` | Schedule | Performance benchmarks | 10-15 min | Deployment |
| `pr-validation.yml` | PR | Code quality checks | 3-5 min | None |
| `docs-validation.yml` | Docs changes | Documentation quality | 2-3 min | None |

## Workflow Stages

### 1. Continuous Integration (ci.yml)

```yaml
name: Complete CI Pipeline (100% Optimized)

on:
  push:
    branches: [ main, develop, feature/*, hotfix/* ]
  pull_request:
    branches: [ main, develop ]
  schedule:
    - cron: '0 6 * * *' # Daily at 6 AM UTC
  workflow_dispatch:

env:
  NODE_VERSION: '20'
  CACHE_VERSION: 'v4'
  CI: true
  NODE_ENV: production

jobs:
  # ===== PHASE 1: SETUP & DEPENDENCIES (2-3 min) =====
  setup-dependencies:
    name: Setup Dependencies & System Cache
    runs-on: ubuntu-latest
    timeout-minutes: 10
    outputs:
      cache-key: ${{ steps.cache-key.outputs.key }}
      backend-cache-hit: ${{ steps.backend-cache.outputs.cache-hit }}
      frontend-cache-hit: ${{ steps.frontend-cache.outputs.cache-hit }}
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js with enhanced caching
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: |
            backend/package-lock.json
            frontend/package-lock.json

      - name: Generate advanced cache keys
        id: cache-key
        run: |
          echo "backend-key=${{ env.CACHE_VERSION }}-${{ runner.os }}-backend-${{ hashFiles('backend/package-lock.json') }}" >> $GITHUB_OUTPUT
          echo "frontend-key=${{ env.CACHE_VERSION }}-${{ runner.os }}-frontend-${{ hashFiles('frontend/package-lock.json') }}" >> $GITHUB_OUTPUT

      - name: Cache backend dependencies
        id: backend-cache
        uses: actions/cache@v4
        with:
          path: backend/node_modules
          key: ${{ steps.cache-key.outputs.backend-key }}

      - name: Cache frontend dependencies
        id: frontend-cache
        uses: actions/cache@v4
        with:
          path: frontend/node_modules
          key: ${{ steps.cache-key.outputs.frontend-key }}

      - name: Install backend dependencies (if cache miss)
        if: steps.backend-cache.outputs.cache-hit != 'true'
        run: |
          cd backend
          npm ci --only=production --ignore-scripts --no-audit --no-fund
          npm ci --ignore-scripts --no-audit --no-fund

      - name: Install frontend dependencies (if cache miss)
        if: steps.frontend-cache.outputs.cache-hit != 'true'
        run: |
          cd frontend
          npm ci --ignore-scripts --no-audit --no-fund

  # ===== PHASE 2: PARALLEL QUALITY CHECKS (3-5 min) =====
  code-quality:
    name: Code Quality & Linting
    runs-on: ubuntu-latest
    needs: setup-dependencies
    timeout-minutes: 8
    strategy:
      matrix:
        component: [backend, frontend]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: ${{ matrix.component }}/package-lock.json

      - name: Restore dependencies cache
        uses: actions/cache@v4
        with:
          path: ${{ matrix.component }}/node_modules
          key: ${{ needs.setup-dependencies.outputs.cache-key }}-${{ matrix.component }}

      - name: Run linting
        run: |
          cd ${{ matrix.component }}
          npm run lint

      - name: Run type checking
        run: |
          cd ${{ matrix.component }}
          npm run typecheck

  # ===== PHASE 3: SECURITY SCANNING (3-5 min) =====
  security-scan:
    name: Security Analysis
    runs-on: ubuntu-latest
    needs: setup-dependencies
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Run npm audit
        run: |
          cd backend && npm audit --audit-level=moderate
          cd ../frontend && npm audit --audit-level=moderate

      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        continue-on-error: true
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

      - name: Run TruffleHog secret scan
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: main
          head: HEAD

  # ===== PHASE 4: TESTING PIPELINE (5-8 min) =====
  test-backend:
    name: Backend Tests
    runs-on: ubuntu-latest
    needs: [setup-dependencies, security-scan]
    timeout-minutes: 15
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_USER: test
          POSTGRES_DB: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Restore backend cache
        uses: actions/cache@v4
        with:
          path: backend/node_modules
          key: ${{ needs.setup-dependencies.outputs.backend-cache-key }}

      - name: Run backend tests
        run: |
          cd backend
          npm run test:coverage
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test
          REDIS_URL: redis://localhost:6379
          NODE_ENV: test

      - name: Upload coverage reports
        uses: codecov/codecov-action@v4
        with:
          file: backend/coverage/lcov.info
          flags: backend
          name: backend-coverage

  test-frontend:
    name: Frontend Tests
    runs-on: ubuntu-latest
    needs: [setup-dependencies, security-scan]
    timeout-minutes: 12
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Restore frontend cache
        uses: actions/cache@v4
        with:
          path: frontend/node_modules
          key: ${{ needs.setup-dependencies.outputs.frontend-cache-key }}

      - name: Run frontend tests
        run: |
          cd frontend
          npm run test:ci

      - name: Upload frontend coverage
        uses: codecov/codecov-action@v4
        with:
          file: frontend/coverage/lcov.info
          flags: frontend
          name: frontend-coverage

  # ===== PHASE 5: BUILD & INTEGRATION (4-6 min) =====
  build:
    name: Build Applications
    runs-on: ubuntu-latest
    needs: [code-quality, test-backend, test-frontend]
    timeout-minutes: 15
    strategy:
      matrix:
        component: [backend, frontend]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Restore dependencies
        uses: actions/cache@v4
        with:
          path: ${{ matrix.component }}/node_modules
          key: ${{ needs.setup-dependencies.outputs.cache-key }}-${{ matrix.component }}

      - name: Build application
        run: |
          cd ${{ matrix.component }}
          npm run build

      - name: Archive build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.component }}-build
          path: |
            ${{ matrix.component }}/dist/
            ${{ matrix.component }}/.next/
          retention-days: 30

  # ===== PHASE 6: DOCKER & DEPLOYMENT PREP (3-4 min) =====
  docker-build:
    name: Docker Build & Security Scan
    runs-on: ubuntu-latest
    needs: [build]
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop'
    timeout-minutes: 20
    strategy:
      matrix:
        component: [backend, frontend]
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}

      - name: Download build artifacts
        uses: actions/download-artifact@v4
        with:
          name: ${{ matrix.component }}-build
          path: ${{ matrix.component }}/

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: ./${{ matrix.component }}
          file: ./${{ matrix.component }}/Dockerfile
          push: true
          tags: |
            ${{ secrets.DOCKER_USERNAME }}/prompt-${{ matrix.component }}:latest
            ${{ secrets.DOCKER_USERNAME }}/prompt-${{ matrix.component }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          platforms: linux/amd64,linux/arm64

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ secrets.DOCKER_USERNAME }}/prompt-${{ matrix.component }}:latest
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: 'trivy-results.sarif'

  # ===== PHASE 7: INTEGRATION TESTING (5-8 min) =====
  integration-tests:
    name: Integration & E2E Tests
    runs-on: ubuntu-latest
    needs: [docker-build]
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop'
    timeout-minutes: 25
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Compose
        run: |
          docker-compose -f docker-compose.test.yml up -d
          sleep 30 # Wait for services to start

      - name: Run integration tests
        run: |
          cd backend
          npm run test:integration

      - name: Run E2E tests
        run: |
          cd frontend
          npm run test:e2e

      - name: Cleanup
        if: always()
        run: docker-compose -f docker-compose.test.yml down -v

  # ===== FINAL PHASE: NOTIFICATIONS & REPORTING =====
  notify-completion:
    name: Notify Completion
    runs-on: ubuntu-latest
    needs: [integration-tests]
    if: always()
    steps:
      - name: Send Slack notification
        if: github.ref == 'refs/heads/main'
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          channel: '#ci-cd'
          text: |
            CI Pipeline completed for commit ${{ github.sha }}
            Branch: ${{ github.ref_name }}
            Author: ${{ github.actor }}
            Status: ${{ job.status }}
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

### 2. Continuous Deployment (cd.yml)

```yaml
name: Continuous Deployment

on:
  push:
    branches: [main]
    tags: ['v*']
  workflow_run:
    workflows: ["Complete CI Pipeline"]
    types: [completed]
    branches: [main]

jobs:
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event.workflow_run.conclusion == 'success'
    environment: staging
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Deploy to ECS Staging
        run: |
          aws ecs update-service \
            --cluster prompt-staging \
            --service prompt-backend \
            --force-new-deployment

      - name: Wait for deployment
        run: |
          aws ecs wait services-stable \
            --cluster prompt-staging \
            --services prompt-backend

      - name: Run smoke tests
        run: |
          curl -f https://staging-api.promptcard.ai/api/health || exit 1

  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: [deploy-staging]
    if: startsWith(github.ref, 'refs/tags/v')
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Blue-Green Deployment
        run: |
          # Deploy to green environment
          aws ecs update-service \
            --cluster prompt-production \
            --service prompt-backend-green \
            --task-definition prompt-backend:${{ github.run_number }}

          # Wait for green deployment
          aws ecs wait services-stable \
            --cluster prompt-production \
            --services prompt-backend-green

          # Health check green environment
          curl -f https://green-api.promptcard.ai/api/health

          # Switch traffic to green
          aws elbv2 modify-target-group \
            --target-group-arn ${{ secrets.TARGET_GROUP_ARN }} \
            --targets Id=green-backend

          # Monitor for 5 minutes
          sleep 300

          # If healthy, terminate blue environment
          aws ecs update-service \
            --cluster prompt-production \
            --service prompt-backend-blue \
            --desired-count 0
```

## Security Integration

### Security Scanning Pipeline

```yaml
# security-scan.yml
name: Security Scanning Pipeline

on:
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM
  push:
    branches: [main, develop]
  pull_request:
    types: [opened, synchronize]

jobs:
  dependency-scan:
    name: Dependency Vulnerability Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Snyk to check for vulnerabilities
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=critical --file=backend/package.json
          
      - name: Run npm audit
        run: |
          cd backend && npm audit --audit-level=critical
          cd ../frontend && npm audit --audit-level=critical

  secret-scan:
    name: Secret Detection
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          
      - name: TruffleHog OSS
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: main
          head: HEAD
          extra_args: --debug --only-verified

      - name: GitLeaks
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  container-scan:
    name: Container Security Scan
    runs-on: ubuntu-latest
    needs: [dependency-scan]
    steps:
      - uses: actions/checkout@v4
      
      - name: Build images for scanning
        run: |
          docker build -t prompt-backend:scan ./backend
          docker build -t prompt-frontend:scan ./frontend

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'prompt-backend:scan'
          format: 'sarif'
          output: 'trivy-backend.sarif'

      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: 'trivy-backend.sarif'

  sast-analysis:
    name: Static Application Security Testing
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: javascript, typescript
          queries: security-and-quality

      - name: Autobuild
        uses: github/codeql-action/autobuild@v3

      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v3
```

## Quality Assurance

### Comprehensive Testing Pipeline

```yaml
# test-suite.yml
name: Comprehensive Test Suite

on:
  pull_request:
    branches: [main, develop]
  schedule:
    - cron: '0 4 * * *' # Daily at 4 AM
  workflow_dispatch:

jobs:
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    strategy:
      matrix:
        component: [backend, frontend]
        node-version: [18, 20]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}

      - name: Install dependencies
        run: |
          cd ${{ matrix.component }}
          npm ci

      - name: Run unit tests
        run: |
          cd ${{ matrix.component }}
          npm run test:unit -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          file: ${{ matrix.component }}/coverage/lcov.info
          flags: ${{ matrix.component }}-unit-${{ matrix.node-version }}

  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: |
          cd backend
          npm ci

      - name: Run integration tests
        run: |
          cd backend
          npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379

  e2e-tests:
    name: End-to-End Tests
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: |
          cd frontend
          npm ci
          npx playwright install --with-deps

      - name: Start test environment
        run: |
          docker-compose -f docker-compose.test.yml up -d
          sleep 30

      - name: Run E2E tests
        run: |
          cd frontend
          npm run test:e2e

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: e2e-report
          path: frontend/test-results/
          retention-days: 30

  performance-tests:
    name: Performance Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install k6
        run: |
          sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6

      - name: Run performance tests
        run: |
          k6 run --out json=performance-results.json scripts/load-test.js

      - name: Upload performance results
        uses: actions/upload-artifact@v4
        with:
          name: performance-results
          path: performance-results.json
```

## Deployment Strategies

### Blue-Green Deployment

```bash
#!/bin/bash
# Blue-Green Deployment Script

CLUSTER_NAME="prompt-production"
SERVICE_NAME="prompt-backend"
TARGET_GROUP_ARN="${TARGET_GROUP_ARN}"

# Current color detection
CURRENT_COLOR=$(aws ecs describe-services \
  --cluster $CLUSTER_NAME \
  --services $SERVICE_NAME \
  --query 'services[0].tags[?key==`Color`].value' \
  --output text)

# Determine new color
if [ "$CURRENT_COLOR" == "blue" ]; then
  NEW_COLOR="green"
else
  NEW_COLOR="blue"
fi

echo "Deploying to $NEW_COLOR environment..."

# Update service with new task definition
aws ecs update-service \
  --cluster $CLUSTER_NAME \
  --service "${SERVICE_NAME}-${NEW_COLOR}" \
  --task-definition "${SERVICE_NAME}:${GITHUB_RUN_NUMBER}" \
  --force-new-deployment

# Wait for deployment to complete
echo "Waiting for deployment to stabilize..."
aws ecs wait services-stable \
  --cluster $CLUSTER_NAME \
  --services "${SERVICE_NAME}-${NEW_COLOR}"

# Health check new environment
echo "Performing health checks..."
HEALTH_CHECK_URL="https://${NEW_COLOR}-api.promptcard.ai/api/health/comprehensive"

for i in {1..10}; do
  if curl -f -s $HEALTH_CHECK_URL; then
    echo "Health check passed (attempt $i)"
    break
  else
    echo "Health check failed (attempt $i), retrying in 30s..."
    sleep 30
  fi
done

# Switch traffic
echo "Switching traffic to $NEW_COLOR..."
aws elbv2 modify-target-group \
  --target-group-arn $TARGET_GROUP_ARN \
  --targets "Id=${NEW_COLOR}-backend,Port=3001,Weight=100" \
           "Id=${CURRENT_COLOR}-backend,Port=3001,Weight=0"

# Monitor new environment
echo "Monitoring $NEW_COLOR environment for 5 minutes..."
sleep 300

# Final health check
if curl -f -s $HEALTH_CHECK_URL; then
  echo "Deployment successful! Scaling down $CURRENT_COLOR environment..."
  aws ecs update-service \
    --cluster $CLUSTER_NAME \
    --service "${SERVICE_NAME}-${CURRENT_COLOR}" \
    --desired-count 0
else
  echo "Deployment failed! Rolling back to $CURRENT_COLOR..."
  aws elbv2 modify-target-group \
    --target-group-arn $TARGET_GROUP_ARN \
    --targets "Id=${CURRENT_COLOR}-backend,Port=3001,Weight=100" \
             "Id=${NEW_COLOR}-backend,Port=3001,Weight=0"
  exit 1
fi
```

### Canary Deployment

```bash
#!/bin/bash
# Canary Deployment Script

deploy_canary() {
    local canary_percentage=$1
    
    echo "Deploying canary with ${canary_percentage}% traffic..."
    
    # Deploy canary version
    aws ecs update-service \
        --cluster prompt-production \
        --service prompt-backend-canary \
        --task-definition "prompt-backend:${GITHUB_RUN_NUMBER}"
    
    # Wait for canary to be stable
    aws ecs wait services-stable \
        --cluster prompt-production \
        --services prompt-backend-canary
    
    # Route traffic to canary
    aws elbv2 modify-target-group \
        --target-group-arn $TARGET_GROUP_ARN \
        --targets "Id=main-backend,Port=3001,Weight=$((100-canary_percentage))" \
                 "Id=canary-backend,Port=3001,Weight=${canary_percentage}"
}

monitor_canary() {
    local duration=$1
    
    echo "Monitoring canary for ${duration} seconds..."
    
    # Monitor error rates, response times, and business metrics
    python3 scripts/canary-monitor.py --duration $duration
    
    if [ $? -eq 0 ]; then
        echo "Canary metrics are healthy"
        return 0
    else
        echo "Canary metrics show issues, rolling back"
        return 1
    fi
}

# Progressive rollout
deploy_canary 5
if monitor_canary 300; then # 5 minutes
    deploy_canary 25
    if monitor_canary 600; then # 10 minutes
        deploy_canary 50
        if monitor_canary 900; then # 15 minutes
            # Full rollout
            deploy_canary 100
            echo "Canary deployment completed successfully"
        fi
    fi
fi
```

## Performance Optimization

### Pipeline Optimization Strategies

```yaml
# Optimized workflow with parallel execution
name: Optimized CI Pipeline

jobs:
  setup:
    name: Setup
    runs-on: ubuntu-latest
    outputs:
      cache-keys: ${{ steps.cache.outputs.keys }}
    steps:
      - uses: actions/checkout@v4
      - id: cache
        name: Generate cache keys
        run: |
          echo "backend=$(echo '${{ hashFiles('backend/package-lock.json') }}' | cut -c1-8)" >> $GITHUB_OUTPUT
          echo "frontend=$(echo '${{ hashFiles('frontend/package-lock.json') }}' | cut -c1-8)" >> $GITHUB_OUTPUT

  # Parallel execution matrix
  quality-checks:
    name: Quality Checks
    runs-on: ubuntu-latest
    needs: setup
    strategy:
      fail-fast: false
      matrix:
        check: [lint, typecheck, test, security]
        component: [backend, frontend]
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: ${{ matrix.component }}/package-lock.json

      - name: Install dependencies
        run: |
          cd ${{ matrix.component }}
          npm ci --prefer-offline --no-audit

      - name: Run ${{ matrix.check }}
        run: |
          cd ${{ matrix.component }}
          case "${{ matrix.check }}" in
            lint) npm run lint ;;
            typecheck) npm run typecheck ;;
            test) npm run test:ci ;;
            security) npm audit --audit-level moderate ;;
          esac

  # Conditional deployment
  deploy:
    name: Deploy
    needs: quality-checks
    if: github.ref == 'refs/heads/main'
    uses: ./.github/workflows/deploy.yml
    secrets: inherit
```

### Build Optimization

```dockerfile
# Optimized Dockerfile with multi-stage caching
# syntax=docker/dockerfile:1.4
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# Dependencies (cached layer)
FROM base AS deps
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production --prefer-offline

# Build (with dev dependencies)
FROM base AS builder
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline

COPY . .
RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

# Production runtime
FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy only necessary files
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

This CI/CD architecture provides a robust, scalable, and secure deployment pipeline that ensures high code quality, comprehensive security scanning, and reliable deployments with zero downtime.