# 🐳 Container Registry Guide

## GitHub Container Registry (ghcr.io)

The Prompt Card System publishes optimized container images to GitHub Container Registry for easy deployment.

## 📦 Available Images

### Production Images
- `ghcr.io/tbowman01/prompt-card-backend:latest` - Optimized backend with ML features
- `ghcr.io/tbowman01/prompt-card-frontend:latest` - Next.js frontend application
- `ghcr.io/tbowman01/prompt-card-auth:latest` - Authentication service

### Image Tags
- `latest` - Latest stable release from main branch
- `v*.*.*` - Semantic version tags (e.g., v2.0.0)
- `main-<sha>` - Commit-specific builds from main branch

## 🚀 Quick Start

### Pull Individual Images
```bash
# Pull all images
docker pull ghcr.io/tbowman01/prompt-card-backend:latest
docker pull ghcr.io/tbowman01/prompt-card-frontend:latest
docker pull ghcr.io/tbowman01/prompt-card-auth:latest
```

### Using Docker Compose
```bash
# Download the docker-compose file
wget https://raw.githubusercontent.com/tbowman01/prompt-card-system/main/docker-compose.ghcr.yml

# Start all services
docker-compose -f docker-compose.ghcr.yml up -d
```

## 🔧 Configuration

### Environment Variables
Create a `.env` file with required configuration:

```env
# Database
POSTGRES_PASSWORD=your_secure_password
DATABASE_URL=postgresql://postgres:your_secure_password@postgres:5432/prompt_card_system

# Authentication
JWT_SECRET=your_jwt_secret_key

# Redis
REDIS_URL=redis://redis:6379

# Optimization Features
OPTIMIZATION_ENABLED=true
ML_OPTIMIZATION_ENABLED=true
EDGE_OPTIMIZATION_ENABLED=true
CACHE_ENABLED=true
```

## 🏗️ Architecture

### Multi-Architecture Support
All images support both `linux/amd64` and `linux/arm64` architectures:
- Intel/AMD processors (amd64)
- Apple Silicon M1/M2 (arm64)
- AWS Graviton (arm64)

### Optimization Features
The containers include all optimization enhancements:
- **AdvancedKVCache**: 50% memory reduction
- **RealTimeOptimizer**: ML-driven optimization
- **EdgeOptimizer**: 90% latency reduction
- **Performance Monitoring**: Built-in metrics

## 🔒 Security

### Image Scanning
All images are automatically scanned for vulnerabilities using:
- Trivy security scanner
- GitHub Code scanning
- Dependency vulnerability checks

### Best Practices
- Images run as non-root user
- Minimal base images (Alpine Linux)
- No secrets embedded in images
- Regular security updates

## 📊 Resource Requirements

### Minimum Requirements
| Service | CPU | Memory | Storage |
|---------|-----|--------|---------|
| Backend | 0.5 cores | 1GB | 1GB |
| Frontend | 0.25 cores | 512MB | 500MB |
| Auth | 0.25 cores | 256MB | 100MB |
| Redis | 0.25 cores | 512MB | 1GB |
| PostgreSQL | 0.5 cores | 1GB | 5GB |

### Recommended Production
| Service | CPU | Memory | Storage |
|---------|-----|--------|---------|
| Backend | 2 cores | 4GB | 10GB |
| Frontend | 1 core | 2GB | 2GB |
| Auth | 0.5 cores | 1GB | 500MB |
| Redis | 1 core | 2GB | 10GB |
| PostgreSQL | 2 cores | 4GB | 50GB |

## 🚢 Deployment Examples

### Docker Swarm
```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.ghcr.yml prompt-card
```

### Kubernetes
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prompt-card-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: prompt-card-backend
  template:
    metadata:
      labels:
        app: prompt-card-backend
    spec:
      containers:
      - name: backend
        image: ghcr.io/tbowman01/prompt-card-backend:latest
        ports:
        - containerPort: 3001
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
```

### AWS ECS
```json
{
  "family": "prompt-card-backend",
  "taskRoleArn": "arn:aws:iam::account-id:role/ecsTaskRole",
  "executionRoleArn": "arn:aws:iam::account-id:role/ecsExecutionRole",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "ghcr.io/tbowman01/prompt-card-backend:latest",
      "memory": 2048,
      "cpu": 1024,
      "essential": true,
      "portMappings": [
        {
          "containerPort": 3001,
          "protocol": "tcp"
        }
      ]
    }
  ]
}
```

## 🔄 CI/CD Integration

### GitHub Actions
The containers are automatically built and published on:
- Push to main branch
- New version tags (v*.*.*)
- Manual workflow dispatch

### Workflow Status
[![Publish Containers](https://github.com/tbowman01/prompt-card-system/actions/workflows/publish-containers.yml/badge.svg)](https://github.com/tbowman01/prompt-card-system/actions/workflows/publish-containers.yml)

## 📝 Local Development

### Building Images Locally
```bash
# Build backend
docker build -t prompt-card-backend ./backend

# Build frontend
docker build -t prompt-card-frontend ./frontend

# Build auth
docker build -t prompt-card-auth ./auth
```

### Publishing to GHCR
```bash
# Run the publish script
./scripts/publish-containers.sh

# Or with specific tag
./scripts/publish-containers.sh v2.0.0
```

## 🆘 Troubleshooting

### Authentication Issues
```bash
# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
```

### Pull Rate Limits
GitHub Container Registry has generous rate limits:
- Authenticated: 5000 pulls per hour
- Unauthenticated: 100 pulls per hour

### Image Size Optimization
Our images are optimized for size:
- Backend: ~150MB (Alpine base)
- Frontend: ~200MB (Next.js optimized)
- Auth: ~100MB (Alpine base)

## 📚 Additional Resources

- [GitHub Container Registry Docs](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Docker Hub Mirror](https://hub.docker.com/u/promptcardsystem) (if available)
- [Deployment Guide](./DEPLOYMENT.md)
- [Security Best Practices](./SECURITY.md)

## 📄 License

The container images are distributed under the same MIT license as the source code.