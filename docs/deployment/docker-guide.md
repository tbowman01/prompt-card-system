# Docker Development Environment Guide

## Overview

The Prompt Card System provides a comprehensive Docker-based development environment with multiple profiles and configurations for different development scenarios.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Environment                       │
├─────────────────────┬─────────────────────┬─────────────────┤
│    Development      │     Production      │     Testing     │
│                     │                     │                 │
│ • Hot Reload        │ • Multi-stage       │ • Isolated      │
│ • Debug Support     │ • Security Focus    │ • Fast Setup   │
│ • GPU/CPU Profiles  │ • SSL/TLS          │ • CI/CD Ready   │
│ • Dev Tools         │ • Load Balancing    │                 │
└─────────────────────┴─────────────────────┴─────────────────┘
```

## Quick Start

### Development Environment

```bash
# Initialize environment
./scripts/docker-dev.sh init

# Start with GPU acceleration (recommended)
./scripts/docker-dev.sh start gpu

# Start with CPU-only (fallback)
./scripts/docker-dev.sh start cpu

# Start with PostgreSQL for production-like development
./scripts/docker-dev.sh start gpu postgres

# Start with all tools and monitoring
./scripts/docker-dev.sh start gpu postgres tools monitoring
```

### Production Environment

```bash
# Initialize production environment
./scripts/docker-prod.sh init-env

# Setup SSL certificates
./scripts/docker-prod.sh ssl-setup

# Deploy to production
./scripts/docker-prod.sh deploy

# Monitor production
./scripts/docker-prod.sh monitor
```

## Service Profiles

### Core Profiles

| Profile | Services | Use Case |
|---------|----------|----------|
| `default` | Frontend, Redis | Basic frontend development |
| `gpu` | + Backend, Ollama (GPU) | Full-stack with GPU acceleration |
| `cpu` | + Backend, Ollama (CPU) | Full-stack with CPU-only inference |

### Enhancement Profiles

| Profile | Services | Purpose |
|---------|----------|---------|
| `postgres` | + PostgreSQL, PgAdmin | Production-like database |
| `tools` | + Adminer, Redis Commander | Database management tools |
| `monitoring` | + Prometheus, Grafana | Performance monitoring |
| `init` | Model Loader | Initialize Ollama models |

## Services Overview

### Core Services

#### Frontend (Next.js)
- **Port**: 3000
- **Hot Reload**: ✅ Enabled
- **Build**: Multi-stage with nginx in production
- **Health Check**: Built-in endpoint

#### Backend (Node.js)
- **Port**: 3001 (+ 9229 for debugging)
- **Features**: Express API, WebSocket support, SQLite/PostgreSQL
- **Debug**: Node.js inspector enabled
- **Health Check**: Comprehensive health monitoring

#### Ollama (LLM Service)
- **Port**: 11434
- **GPU Support**: NVIDIA GPU acceleration (gpu profile)
- **Models**: Auto-initialized with essential models
- **Fallback**: CPU-only mode available

#### Redis (Caching)
- **Port**: 6379
- **Purpose**: Session storage, caching, job queues
- **Configuration**: Development vs production configs
- **Management**: Redis Commander available

### Database Services

#### PostgreSQL (Production Database)
- **Port**: 5432
- **Database**: `promptcard_dev` / `promptcard_prod`
- **Management**: PgAdmin web interface
- **Schema**: Auto-initialized with full schema

#### SQLite (Development Database)
- **File**: `./data/database.sqlite`
- **Management**: Adminer web interface
- **Backup**: Volume-mounted for persistence

### Development Tools

#### Adminer (Database Management)
- **Port**: 8080
- **Supports**: SQLite, PostgreSQL, MySQL
- **Access**: http://localhost:8080

#### Redis Commander
- **Port**: 8081
- **Purpose**: Redis key management and monitoring
- **Access**: http://localhost:8081

#### PgAdmin (PostgreSQL Management)
- **Port**: 8082
- **Features**: Full PostgreSQL administration
- **Access**: http://localhost:8082

### Monitoring Stack

#### Prometheus (Metrics Collection)
- **Port**: 9090
- **Metrics**: Application and system metrics
- **Storage**: Time-series database

#### Grafana (Visualization)
- **Port**: 3002
- **Dashboards**: Pre-configured for the application
- **Data Source**: Prometheus integration

## Configuration

### Environment Variables

#### Development (.env.dev)
```bash
NODE_ENV=development
POSTGRES_PASSWORD=promptcard_dev_password
REDIS_PASSWORD=redis_dev_password
JWT_SECRET=your-jwt-secret-here
GRAFANA_PASSWORD=admin
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

#### Production (.env.prod)
```bash
NODE_ENV=production
POSTGRES_PASSWORD=<secure-random-password>
REDIS_PASSWORD=<secure-random-password>
JWT_SECRET=<secure-random-secret>
GRAFANA_PASSWORD=<secure-random-password>
CORS_ORIGIN=https://yourdomain.com
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com
```

### Volume Mapping

#### Development Volumes
```yaml
volumes:
  - ./frontend:/app          # Hot reload
  - ./backend:/app           # Hot reload
  - ./data:/app/data         # Database persistence
  - ollama_models:/root/.ollama  # Model storage
  - redis_data:/data         # Redis persistence
```

#### Production Volumes
```yaml
volumes:
  - postgres_data:/var/lib/postgresql/data
  - redis_data:/data
  - ollama_models:/root/.ollama
  - prometheus_data:/prometheus
  - grafana_data:/var/lib/grafana
```

## Development Workflows

### Starting Development

1. **Initialize Environment**
   ```bash
   ./scripts/docker-dev.sh init
   ```

2. **Start Services**
   ```bash
   # For GPU development
   ./scripts/docker-dev.sh start gpu postgres tools
   
   # For CPU-only development
   ./scripts/docker-dev.sh start cpu postgres tools
   ```

3. **Check Status**
   ```bash
   ./scripts/docker-dev.sh status
   ```

### Development Commands

```bash
# View logs
./scripts/docker-dev.sh logs backend
./scripts/docker-dev.sh logs frontend

# Open shell in container
./scripts/docker-dev.sh shell backend
./scripts/docker-dev.sh shell frontend

# Run tests
./scripts/docker-dev.sh test

# Rebuild services
./scripts/docker-dev.sh build backend
```

### Hot Reload Configuration

Both frontend and backend support hot reload:

- **Frontend**: Next.js dev server with file watching
- **Backend**: Nodemon with TypeScript compilation
- **Models**: Ollama models persist across restarts

### Debugging

#### Backend Debugging
```bash
# Start with debug profile
./scripts/docker-dev.sh start gpu

# Connect debugger to localhost:9229
# VS Code: Use "Attach to Node" configuration
```

#### Frontend Debugging
- Browser dev tools work normally
- React dev tools extension supported
- Source maps enabled

## Production Deployment

### Prerequisites

1. **Domain Setup**
   - Configure DNS records
   - Obtain SSL certificates

2. **Environment Configuration**
   ```bash
   ./scripts/docker-prod.sh init-env
   # Edit .env.prod with your settings
   ```

3. **SSL Setup**
   ```bash
   ./scripts/docker-prod.sh ssl-setup
   ```

### Deployment Process

1. **Initial Deployment**
   ```bash
   ./scripts/docker-prod.sh deploy
   ```

2. **Health Check**
   ```bash
   ./scripts/docker-prod.sh health
   ```

3. **Monitor Deployment**
   ```bash
   ./scripts/docker-prod.sh monitor
   ```

### Production Features

#### Security
- Non-root containers
- Security headers
- Rate limiting
- HTTPS enforcement
- Secret management

#### Performance
- Multi-stage builds
- Image optimization
- Resource limits
- Load balancing
- Caching layers

#### Monitoring
- Health checks
- Metrics collection
- Log aggregation
- Alerting system

### Scaling

```bash
# Scale backend to 3 replicas
./scripts/docker-prod.sh scale backend 3

# Scale frontend to 2 replicas
./scripts/docker-prod.sh scale frontend 2
```

## Troubleshooting

### Common Issues

#### Port Conflicts
```bash
# Check port usage
sudo lsof -i :3000
sudo lsof -i :3001

# Stop conflicting services
sudo killall node
```

#### Volume Permissions
```bash
# Fix volume permissions
sudo chown -R $USER:$USER ./data
chmod -R 755 ./data
```

#### GPU Issues
```bash
# Check GPU availability
docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi

# Fallback to CPU profile
./scripts/docker-dev.sh start cpu
```

#### Memory Issues
```bash
# Check Docker memory usage
docker stats

# Clean up unused resources
./scripts/docker-dev.sh clean
```

### Service-Specific Issues

#### Ollama Not Starting
1. Check GPU drivers (for GPU profile)
2. Verify model downloads
3. Check available memory
4. Try CPU profile as fallback

#### Database Connection Issues
1. Verify service health
2. Check environment variables
3. Inspect container logs
4. Verify network connectivity

#### Redis Connection Issues
1. Check Redis service status
2. Verify password configuration
3. Check network connectivity
4. Review Redis logs

### Performance Optimization

#### Development Performance
```bash
# Use SSD for volumes
# Increase Docker memory allocation
# Use --no-cache for clean builds
./scripts/docker-dev.sh build --no-cache
```

#### Production Performance
```bash
# Monitor resource usage
./scripts/docker-prod.sh monitor

# Scale services based on load
./scripts/docker-prod.sh scale backend 3
```

## Backup and Recovery

### Development Backup
```bash
# Backup development data
./scripts/docker-dev.sh backup
```

### Production Backup
```bash
# Create production backup
./scripts/docker-prod.sh backup

# Backup includes:
# - PostgreSQL database dump
# - Redis data
# - Ollama models
# - Configuration files
```

### Recovery Process
```bash
# Restore from backup
./scripts/docker-prod.sh restore backup_20240101_120000
```

## Security Best Practices

### Development Security
- Use development-specific passwords
- Keep containers updated
- Limit exposed ports
- Regular dependency updates

### Production Security
- Strong random passwords
- SSL/TLS encryption
- Regular security updates
- Monitoring and alerting
- Secret management
- Network isolation

## Monitoring and Logging

### Log Management
```bash
# View real-time logs
./scripts/docker-dev.sh logs

# View specific service logs
./scripts/docker-dev.sh logs backend

# Production log monitoring
./scripts/docker-prod.sh logs backend
```

### Metrics Collection
- **Prometheus**: Collects application and system metrics
- **Grafana**: Visualizes metrics with dashboards
- **Health Checks**: Built-in service health monitoring

### Performance Monitoring
```bash
# Real-time monitoring
./scripts/docker-prod.sh monitor

# Resource usage
docker stats

# Service health
./scripts/docker-prod.sh health
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Docker Build and Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Images
        run: |
          docker compose -f docker-compose.prod.yml build
          
      - name: Run Tests
        run: |
          ./scripts/docker-dev.sh test
          
      - name: Deploy
        run: |
          ./scripts/docker-prod.sh deploy
```

## Advanced Configuration

### Custom Networks
```yaml
networks:
  prompt-card-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

### Resource Limits
```yaml
deploy:
  resources:
    limits:
      memory: 1G
      cpus: '0.5'
    reservations:
      memory: 512M
      cpus: '0.25'
```

### Health Checks
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 60s
```

## Support

For issues and questions:

1. **Documentation**: Check this guide and other docs
2. **Logs**: Use logging commands to diagnose issues
3. **Health Checks**: Verify service health status
4. **Community**: GitHub issues and discussions

## Changelog

### v2.0.0
- Added production Docker configuration
- Enhanced security features
- Added PostgreSQL support
- Comprehensive monitoring stack
- Helper scripts for common operations

### v1.5.0
- Added GPU/CPU profiles
- Development tool integration
- Enhanced health checks
- Volume optimization

### v1.0.0
- Initial Docker setup
- Basic development environment
- SQLite database support