# Claude Code Statusline Helper - Complete Guide

The Claude Code `/statusline` helper provides consistent, context-aware progress updates across local development, Claude Code terminals, and CI/CD pipelines.

## 🚀 Quick Start

### Installation
The statusline helper is ready to use immediately:

```bash
# Make executable (if needed)
chmod +x scripts/statusline.sh

# Test it works
./scripts/statusline.sh --ok "System ready" --extras "version=1.0"
```

### Basic Usage

```bash
# Simple status update
./scripts/statusline.sh --phase Setup --msg "Initializing application"

# Success notification
./scripts/statusline.sh --ok "Deployment complete"

# Warning with context
./scripts/statusline.sh --warn "High latency detected" --extras "p95=800ms"

# Error with details
./scripts/statusline.sh --error "Database connection failed" --extras "retry=1/3"

# Progress tracking
./scripts/statusline.sh --progress "Building containers" --extras "step=3/5"
```

## 📊 Output Format

The statusline helper generates consistent output:

```
/statusline [PHASE] MESSAGE | Env: ENV | Branch: BRANCH | Model: PROVIDER/MODEL | EXTRAS
```

**Example outputs:**
```
/statusline [Setup] Validating configuration | Env: dev | Branch: develop | Model: openai/gpt-4.1
/statusline [Build] Docker image created | Env: prod | Branch: main | Model: anthropic/claude-3.7 | cache=hit size=234MB
/statusline [OK] Deployment successful | Env: staging | Branch: release/v1.2 | uptime=99.9% errors=0
/statusline [Warn] Resource usage high | Env: prod | Branch: main | cpu=85% memory=78%
/statusline [Error] Service unavailable | Env: prod | Branch: hotfix/db-fix | retry=2/3 timeout=30s
```

## 🔧 Command Line Interface

### Flags and Options

| Flag | Description | Example |
|------|-------------|---------|
| `--phase`, `-p` | Phase label | `--phase Build` |
| `--msg`, `-m` | Message text | `--msg "Compiling sources"` |
| `--extras`, `-x` | Additional context | `--extras "cache=hit target=linux"` |
| `--ok` | Success shortcut | `--ok "Done"` |
| `--warn` | Warning shortcut | `--warn "Issue detected"` |
| `--error`, `--err` | Error shortcut | `--error "Failed"` |
| `--progress` | Progress shortcut | `--progress "Installing..."` |
| `--help`, `-h` | Show help | `--help` |

### Phase Labels

Standard phase labels for consistency:

- **Setup** - Initial configuration and preparation
- **Build** - Compilation, packaging, container building
- **Test** - Running tests, validation, quality checks
- **Deploy** - Deployment, provisioning, rollout
- **Post-Deploy** - Health checks, verification, monitoring
- **Alert** - Alerts, notifications, escalations
- **Info** - General information
- **OK** - Success states
- **Warn** - Warnings, non-critical issues
- **Error** - Errors, failures, critical issues
- **Progress** - Work in progress, status updates

### Extras Format

Use key=value pairs for structured context:

```bash
# Single value
--extras "version=1.4.2"

# Multiple values (space-separated)
--extras "cache=hit target=linux size=234MB"

# Complex values (quote if needed)
--extras "message='Operation completed successfully' duration=45s"
```

## 🎯 Auto-Detection Features

The statusline helper automatically detects:

### Environment Detection
- `DEPLOY_ENV` → Production environment
- `ENVIRONMENT` → General environment
- `NODE_ENV` → Node.js environment
- `RUNTIME_ENV` → Runtime environment
- Default: `dev`

### Branch Detection
- `GITHUB_REF_NAME` → GitHub Actions
- `CI_COMMIT_REF_NAME` → GitLab CI
- `BRANCH_NAME` → Jenkins/General
- Git command fallback: `git rev-parse --abbrev-ref HEAD`
- Default: `unknown`

### CI System Detection
- GitHub Actions (`GITHUB_ACTIONS`)
- GitLab CI (`GITLAB_CI`)
- Jenkins (`JENKINS_HOME`)
- Generic CI (`CI`)
- Default: `local`

### LLM Provider/Model Detection

**Provider Detection:**
- `LLM_PROVIDER`, `PROVIDER`, `AI_PROVIDER`
- Auto-detect from API keys:
  - `OPENAI_API_KEY` → `openai`
  - `ANTHROPIC_API_KEY` → `anthropic`
  - `GEMINI_API_KEY`, `GOOGLE_API_KEY` → `google`
  - `OLLAMA_HOST` → `ollama`

**Model Detection:**
- `MODEL_NAME` (primary)
- `OPENAI_MODEL`, `ANTHROPIC_MODEL`, `OLLAMA_MODEL`, `VERTEX_MODEL`
- Defaults:
  - `ollama` → `llama3:8b`
  - `anthropic` → `claude-3.7`
  - `openai` → `gpt-4.1`

## 🏗️ GitHub Actions Integration

### Using the Composite Action

```yaml
- name: Status Update
  uses: ./.github/actions/statusline
  with:
    phase: Build
    msg: "Building Docker image"
    extras: "target=production cache=enabled"
```

### Direct Script Usage

```yaml
- name: Setup Status
  run: |
    chmod +x scripts/statusline.sh
    ./scripts/statusline.sh --phase Setup --msg "Preparing build environment"

- name: Build Status
  run: ./scripts/statusline.sh --progress "Compiling sources" --extras "step=2/5"

- name: Success Status
  run: ./scripts/statusline.sh --ok "Build completed" --extras "size=234MB duration=45s"
```

### Environment Variables for CI

```yaml
env:
  DEPLOY_ENV: production
  LLM_PROVIDER: anthropic
  ANTHROPIC_MODEL: claude-3.7
```

### GitHub Step Summary Integration

When running in GitHub Actions, the statusline automatically appends to `$GITHUB_STEP_SUMMARY` for job summaries:

```yaml
- name: Deployment Summary
  run: |
    ./scripts/statusline.sh --ok "Deployment successful" --extras "version=1.4.2 uptime=100%"
    # This appears both in logs AND in the job summary
```

## 🛠️ Integration Patterns

### Local Development

```bash
# Development workflow
./scripts/statusline.sh --phase Setup --msg "Starting development server"
npm run dev &
./scripts/statusline.sh --progress "Server starting..." --extras "port=3000"
./scripts/statusline.sh --ok "Development server ready" --extras "url=http://localhost:3000"
```

### Docker Builds

```bash
# Docker workflow
./scripts/statusline.sh --phase Build --msg "Building Docker image"
docker build -t myapp:latest .
./scripts/statusline.sh --ok "Docker image built" --extras "size=$(docker images myapp:latest --format 'table {{.Size}}')"
```

### Test Automation

```bash
# Testing workflow
./scripts/statusline.sh --phase Test --msg "Running test suite"
npm test
if [ $? -eq 0 ]; then
  ./scripts/statusline.sh --ok "All tests passed" --extras "coverage=94%"
else
  ./scripts/statusline.sh --error "Tests failed" --extras "failures=3"
fi
```

### Deployment Pipeline

```bash
# Deployment workflow
./scripts/statusline.sh --phase Deploy --msg "Deploying to production"
kubectl apply -f k8s/
./scripts/statusline.sh --phase Post-Deploy --msg "Waiting for rollout"
kubectl rollout status deployment/myapp
./scripts/statusline.sh --ok "Deployment complete" --extras "replicas=3 health=100%"
```

## 🔍 Advanced Usage

### Error Handling

```bash
# Function with error handling
deploy_service() {
  ./scripts/statusline.sh --phase Deploy --msg "Deploying $1"
  
  if ! kubectl apply -f "$1.yaml"; then
    ./scripts/statusline.sh --error "Deployment failed" --extras "service=$1 reason=kubectl_error"
    return 1
  fi
  
  ./scripts/statusline.sh --ok "Service deployed" --extras "service=$1"
}
```

### Progress Tracking

```bash
# Multi-step process
STEPS=("Setup" "Build" "Test" "Deploy")
TOTAL=${#STEPS[@]}

for i in "${!STEPS[@]}"; do
  STEP=${STEPS[$i]}
  PROGRESS=$(((i + 1) * 100 / TOTAL))
  ./scripts/statusline.sh --progress "$STEP in progress" --extras "step=$((i+1))/$TOTAL progress=${PROGRESS}%"
  
  # Do work here
  sleep 2
  
  ./scripts/statusline.sh --ok "$STEP completed" --extras "step=$((i+1))/$TOTAL"
done
```

### Conditional Status

```bash
# Environment-specific messaging
if [[ "$DEPLOY_ENV" == "production" ]]; then
  ./scripts/statusline.sh --warn "Production deployment starting" --extras "env=prod maintenance_window=true"
else
  ./scripts/statusline.sh --phase Deploy --msg "Deploying to staging" --extras "env=staging"
fi
```

## 🚨 Troubleshooting

### Common Issues

**Script not executable:**
```bash
chmod +x scripts/statusline.sh
git update-index --chmod=+x scripts/statusline.sh
```

**Auto-detection not working:**
```bash
# Check environment variables
echo "DEPLOY_ENV: $DEPLOY_ENV"
echo "LLM_PROVIDER: $LLM_PROVIDER"
echo "MODEL_NAME: $MODEL_NAME"

# Manual override
DEPLOY_ENV=production LLM_PROVIDER=openai MODEL_NAME=gpt-4 ./scripts/statusline.sh --ok "Test"
```

**GitHub Actions not showing in summary:**
```bash
# Verify GITHUB_STEP_SUMMARY exists
echo "Step summary: $GITHUB_STEP_SUMMARY"

# Check permissions
ls -la "$GITHUB_STEP_SUMMARY"
```

### Debug Mode

```bash
# Add debug information
set -x
./scripts/statusline.sh --phase Debug --msg "Testing auto-detection"
set +x
```

### Validation Script

```bash
#!/bin/bash
# validate-statusline.sh

echo "🧪 Testing statusline functionality..."

./scripts/statusline.sh --phase Test --msg "Basic functionality test"
./scripts/statusline.sh --ok "Success test"
./scripts/statusline.sh --warn "Warning test" --extras "level=minor"
./scripts/statusline.sh --error "Error test" --extras "code=500"
./scripts/statusline.sh --progress "Progress test" --extras "step=1/1"

echo "✅ All tests completed"
```

## 📋 Best Practices

### 1. Consistent Phase Labels
Use standard phase labels across your team and projects.

### 2. Meaningful Messages
Write clear, actionable messages:
```bash
# Good
./scripts/statusline.sh --phase Build --msg "Compiling TypeScript sources"

# Better
./scripts/statusline.sh --phase Build --msg "Compiling TypeScript sources" --extras "files=42 duration=8s"
```

### 3. Structured Extras
Use consistent key=value format:
```bash
# Good structure
--extras "version=1.4.2 env=prod replicas=3 health=100%"

# Avoid unstructured text
--extras "Version 1.4.2 deployed to production with 3 replicas"
```

### 4. Error Context
Always provide context for errors:
```bash
./scripts/statusline.sh --error "Database connection failed" --extras "host=db.example.com port=5432 timeout=30s retry=2/3"
```

### 5. Success Metrics
Include relevant metrics in success messages:
```bash
./scripts/statusline.sh --ok "Deployment successful" --extras "duration=45s size=234MB uptime=99.9%"
```

### 6. Environment Awareness
Adjust messaging based on environment:
```bash
if [[ "$DEPLOY_ENV" == "production" ]]; then
  ./scripts/statusline.sh --warn "Production deployment" --extras "maintenance=scheduled downtime=0s"
else
  ./scripts/statusline.sh --phase Deploy --msg "Staging deployment"
fi
```

## 📈 Examples by Use Case

### Development Setup
```bash
./scripts/statusline.sh --phase Setup --msg "Installing dependencies"
npm install
./scripts/statusline.sh --phase Setup --msg "Setting up database"
npm run db:setup
./scripts/statusline.sh --ok "Development environment ready" --extras "port=3000 db=ready"
```

### CI/CD Pipeline
```bash
./scripts/statusline.sh --phase Build --msg "Building application"
npm run build
./scripts/statusline.sh --phase Test --msg "Running test suite"
npm test
./scripts/statusline.sh --phase Deploy --msg "Deploying to staging"
npm run deploy:staging
./scripts/statusline.sh --ok "Pipeline completed" --extras "version=$(git rev-parse --short HEAD)"
```

### Monitoring Integration
```bash
# Health check
if curl -f http://localhost:3000/health; then
  ./scripts/statusline.sh --ok "Service healthy" --extras "response_time=23ms"
else
  ./scripts/statusline.sh --error "Service unhealthy" --extras "status=503 last_seen=5m"
fi
```

### Release Process
```bash
./scripts/statusline.sh --phase Deploy --msg "Starting release v1.4.2"
./scripts/statusline.sh --progress "Creating release branch" --extras "version=1.4.2"
git checkout -b release/v1.4.2
./scripts/statusline.sh --progress "Building release artifacts"
npm run build:production
./scripts/statusline.sh --progress "Running release tests"
npm run test:e2e
./scripts/statusline.sh --ok "Release v1.4.2 ready" --extras "artifacts=3 tests=247"
```

## 🎯 Integration with Other Tools

### Make Integration
```makefile
# Makefile
.PHONY: deploy
deploy:
	@./scripts/statusline.sh --phase Deploy --msg "Starting deployment"
	@kubectl apply -f k8s/
	@./scripts/statusline.sh --ok "Deployment complete"
```

### Docker Compose Integration
```yaml
# docker-compose.yml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    command: |
      sh -c "
        ./scripts/statusline.sh --phase Setup --msg 'Starting application container'
        npm start
      "
```

### Pre-commit Hooks Integration
```bash
#!/bin/bash
# .git/hooks/pre-commit
./scripts/statusline.sh --phase Test --msg "Running pre-commit checks"
npm run lint && npm test
if [ $? -eq 0 ]; then
  ./scripts/statusline.sh --ok "Pre-commit checks passed"
else
  ./scripts/statusline.sh --error "Pre-commit checks failed"
  exit 1
fi
```

---

## 📚 Related Documentation

- [GitHub Actions Integration](https://docs.github.com/en/actions)
- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)
- [Project README](../README.md)
- [Contributing Guidelines](../CONTRIBUTING.md)

---

*Generated with Claude Code - Last updated: 2025-08-13*