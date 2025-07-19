# Docker Troubleshooting Guide

## Quick Diagnostics

### Health Check Commands
```bash
# Check overall system status
./scripts/docker-dev.sh status

# Check production health
./scripts/docker-prod.sh health

# View service logs
./scripts/docker-dev.sh logs [service]

# Monitor real-time
./scripts/docker-prod.sh monitor
```

## Common Issues and Solutions

### 1. Services Won't Start

#### Symptoms
- Containers exit immediately
- Health checks failing
- Connection refused errors

#### Diagnostics
```bash
# Check service status
docker compose -f docker-compose.dev.yml ps

# View detailed logs
./scripts/docker-dev.sh logs backend
./scripts/docker-dev.sh logs frontend

# Check container health
docker inspect <container_name> | grep Health -A 10
```

#### Solutions

**Port Conflicts**
```bash
# Find processes using ports
sudo lsof -i :3000
sudo lsof -i :3001
sudo lsof -i :11434

# Kill conflicting processes
sudo kill -9 <PID>

# Or change ports in docker-compose.yml
```

**Memory Issues**
```bash
# Check Docker memory allocation
docker system df
docker stats

# Increase Docker memory limit (Docker Desktop)
# Settings > Resources > Memory > Increase to 8GB+

# Clean up unused resources
docker system prune -f
./scripts/docker-dev.sh clean
```

**Permission Issues**
```bash
# Fix volume permissions
sudo chown -R $USER:$USER ./data
sudo chown -R $USER:$USER ./frontend
sudo chown -R $USER:$USER ./backend

# Set proper permissions
chmod -R 755 ./data
```

### 2. Ollama GPU Issues

#### Symptoms
- Ollama fails to start with GPU profile
- CUDA errors in logs
- Models not loading

#### Diagnostics
```bash
# Check GPU availability
nvidia-smi
docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi

# Check Docker GPU support
docker info | grep nvidia
```

#### Solutions

**GPU Drivers Not Installed**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nvidia-driver-470

# Restart system after installation
```

**NVIDIA Container Toolkit Missing**
```bash
# Install NVIDIA Container Toolkit
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list

sudo apt-get update && sudo apt-get install -y nvidia-docker2
sudo systemctl restart docker
```

**Fallback to CPU**
```bash
# Use CPU profile instead
./scripts/docker-dev.sh stop
./scripts/docker-dev.sh start cpu
```

### 3. Database Connection Issues

#### Symptoms
- Backend can't connect to database
- SQL errors in logs
- Data not persisting

#### Diagnostics
```bash
# Check database service status
docker compose -f docker-compose.dev.yml ps postgres
docker compose -f docker-compose.dev.yml ps redis

# Test database connectivity
docker compose -f docker-compose.dev.yml exec postgres psql -U promptcard -d promptcard_dev -c "SELECT 1;"
```

#### Solutions

**PostgreSQL Not Starting**
```bash
# Check PostgreSQL logs
./scripts/docker-dev.sh logs postgres

# Reset PostgreSQL data
docker volume rm prompt-card-system_postgres_dev_data
./scripts/docker-dev.sh start postgres
```

**SQLite Permission Issues**
```bash
# Fix SQLite file permissions
sudo chown -R $USER:$USER ./data
chmod 644 ./data/database.sqlite
```

**Redis Connection Issues**
```bash
# Check Redis status
./scripts/docker-dev.sh logs redis

# Test Redis connectivity
docker compose -f docker-compose.dev.yml exec redis redis-cli ping
```

### 4. Frontend Issues

#### Symptoms
- Frontend not accessible
- Hot reload not working
- Build failures

#### Diagnostics
```bash
# Check frontend logs
./scripts/docker-dev.sh logs frontend

# Check if port is accessible
curl http://localhost:3000

# Verify file mounting
docker compose -f docker-compose.dev.yml exec frontend ls -la /app
```

#### Solutions

**Hot Reload Not Working**
```bash
# Enable polling for file changes
# Add to docker-compose.dev.yml:
environment:
  - CHOKIDAR_USEPOLLING=true
  - WATCHPACK_POLLING=true
```

**Node Modules Issues**
```bash
# Clear node_modules and reinstall
./scripts/docker-dev.sh shell frontend
rm -rf node_modules package-lock.json
npm install

# Or rebuild container
./scripts/docker-dev.sh build frontend
```

**Next.js Build Issues**
```bash
# Clear Next.js cache
./scripts/docker-dev.sh shell frontend
rm -rf .next
npm run build
```

### 5. Backend Issues

#### Symptoms
- API endpoints not responding
- TypeScript compilation errors
- WebSocket connections failing

#### Diagnostics
```bash
# Check backend logs
./scripts/docker-dev.sh logs backend

# Test API endpoints
curl http://localhost:3001/api/health

# Check TypeScript compilation
./scripts/docker-dev.sh shell backend
npm run type-check
```

#### Solutions

**TypeScript Compilation Errors**
```bash
# Run type checking
./scripts/docker-dev.sh shell backend
npm run type-check

# Clear TypeScript cache
rm -rf dist
npm run build
```

**API Not Responding**
```bash
# Check if backend is running
./scripts/docker-dev.sh shell backend
ps aux | grep node

# Restart backend service
docker compose -f docker-compose.dev.yml restart backend
```

**WebSocket Issues**
```bash
# Check WebSocket endpoint
wscat -c ws://localhost:3001/socket.io/?EIO=4&transport=websocket

# Verify CORS settings
# Check environment variables in docker-compose.yml
```

### 6. Model Loading Issues

#### Symptoms
- Models not downloading
- Ollama service healthy but no models
- Model initialization timeouts

#### Diagnostics
```bash
# Check model initialization logs
./scripts/docker-dev.sh logs model-init

# List available models
docker compose -f docker-compose.dev.yml exec ollama ollama list

# Check Ollama service
curl http://localhost:11434/api/version
```

#### Solutions

**Models Not Downloading**
```bash
# Manually initialize models
docker compose -f docker-compose.dev.yml --profile init up model-init

# Check network connectivity
docker compose -f docker-compose.dev.yml exec ollama ping -c 3 google.com

# Pull models manually
docker compose -f docker-compose.dev.yml exec ollama ollama pull llama2:7b-chat
```

**Disk Space Issues**
```bash
# Check available space
df -h
docker system df

# Clean up unused images
docker image prune -f
docker volume prune -f
```

### 7. Production Deployment Issues

#### Symptoms
- Production deployment fails
- SSL certificate issues
- Performance problems

#### Diagnostics
```bash
# Check production health
./scripts/docker-prod.sh health

# Monitor production logs
./scripts/docker-prod.sh logs

# Check SSL certificates
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com
```

#### Solutions

**SSL Certificate Issues**
```bash
# Generate new self-signed certificates
./scripts/docker-prod.sh ssl-setup

# Or use Let's Encrypt
certbot certonly --standalone -d yourdomain.com
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ssl/cert.pem
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ssl/private.key
```

**Environment Configuration**
```bash
# Reinitialize production environment
./scripts/docker-prod.sh init-env

# Verify environment file
cat .env.prod
```

**Performance Issues**
```bash
# Monitor resource usage
./scripts/docker-prod.sh monitor

# Scale services
./scripts/docker-prod.sh scale backend 3
./scripts/docker-prod.sh scale frontend 2
```

### 8. Network Issues

#### Symptoms
- Services can't communicate
- External network access blocked
- DNS resolution failures

#### Diagnostics
```bash
# Check Docker networks
docker network ls
docker network inspect prompt-card-system_prompt-card-network

# Test service connectivity
docker compose -f docker-compose.dev.yml exec backend ping postgres
docker compose -f docker-compose.dev.yml exec backend ping redis
```

#### Solutions

**Service Discovery Issues**
```bash
# Restart Docker daemon
sudo systemctl restart docker

# Recreate networks
docker compose -f docker-compose.dev.yml down
docker network prune -f
./scripts/docker-dev.sh start
```

**DNS Resolution**
```bash
# Check DNS configuration
docker compose -f docker-compose.dev.yml exec backend nslookup postgres
docker compose -f docker-compose.dev.yml exec backend cat /etc/resolv.conf

# Use explicit IPs if needed
# Find container IP:
docker inspect <container_name> | grep IPAddress
```

### 9. Performance Issues

#### Symptoms
- Slow response times
- High CPU/memory usage
- Timeouts and errors

#### Diagnostics
```bash
# Monitor resource usage
docker stats

# Check system resources
top
free -h
df -h

# Monitor application performance
./scripts/docker-prod.sh monitor
```

#### Solutions

**Resource Limits**
```bash
# Increase Docker resources (Docker Desktop)
# Settings > Resources > Increase CPU/Memory

# Add resource limits to docker-compose.yml
deploy:
  resources:
    limits:
      memory: 2G
      cpus: '1.0'
```

**Database Performance**
```bash
# Check PostgreSQL performance
./scripts/docker-dev.sh shell postgres
psql -U promptcard -d promptcard_dev -c "SELECT * FROM pg_stat_activity;"

# Optimize queries and add indexes
# Check database configuration
```

**Ollama Performance**
```bash
# Monitor Ollama resource usage
curl http://localhost:11434/api/ps

# Adjust model concurrency
# Set OLLAMA_NUM_PARALLEL environment variable
```

## System Diagnostics

### Complete Health Check Script

```bash
#!/bin/bash
# Save as health-check.sh

echo "=== Docker System Health Check ==="

# Check Docker daemon
if ! docker info &>/dev/null; then
    echo "❌ Docker daemon not running"
    exit 1
fi
echo "✅ Docker daemon running"

# Check Docker Compose
if ! docker-compose --version &>/dev/null; then
    echo "❌ Docker Compose not available"
    exit 1
fi
echo "✅ Docker Compose available"

# Check available space
space=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $space -gt 85 ]; then
    echo "⚠️  Disk space low: ${space}%"
else
    echo "✅ Disk space OK: ${space}%"
fi

# Check memory
mem=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
if [ $mem -gt 85 ]; then
    echo "⚠️  Memory usage high: ${mem}%"
else
    echo "✅ Memory usage OK: ${mem}%"
fi

# Check services
echo ""
echo "=== Service Status ==="
docker compose -f docker-compose.dev.yml ps

echo ""
echo "=== Recent Errors ==="
docker compose -f docker-compose.dev.yml logs --tail=10 2>&1 | grep -i error || echo "No recent errors"
```

### Environment Validation Script

```bash
#!/bin/bash
# Save as validate-env.sh

echo "=== Environment Validation ==="

# Check required files
files=("docker-compose.dev.yml" "backend/Dockerfile" "frontend/Dockerfile")
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file exists"
    else
        echo "❌ $file missing"
    fi
done

# Check required directories
dirs=("data" "scripts" "backend/src" "frontend/src")
for dir in "${dirs[@]}"; do
    if [ -d "$dir" ]; then
        echo "✅ $dir exists"
    else
        echo "❌ $dir missing"
    fi
done

# Check environment variables
echo ""
echo "=== Environment Variables ==="
if [ -f ".env.dev" ]; then
    echo "✅ .env.dev exists"
    # Validate required variables
    required_vars=("NODE_ENV" "POSTGRES_PASSWORD" "JWT_SECRET")
    for var in "${required_vars[@]}"; do
        if grep -q "$var=" .env.dev; then
            echo "✅ $var configured"
        else
            echo "❌ $var missing"
        fi
    done
else
    echo "❌ .env.dev missing"
fi

# Check Docker network
echo ""
echo "=== Docker Network ==="
if docker network ls | grep -q prompt-card-network; then
    echo "✅ Docker network exists"
else
    echo "⚠️  Docker network will be created"
fi

# Check volumes
echo ""
echo "=== Docker Volumes ==="
volumes=("ollama_models" "redis_data" "postgres_dev_data")
for volume in "${volumes[@]}"; do
    if docker volume ls | grep -q "prompt-card-system_$volume"; then
        echo "✅ Volume $volume exists"
    else
        echo "⚠️  Volume $volume will be created"
    fi
done
```

## Recovery Procedures

### Complete Environment Reset

```bash
#!/bin/bash
# Nuclear option - complete reset

echo "⚠️  This will completely reset the Docker environment"
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Reset cancelled"
    exit 0
fi

echo "Stopping all services..."
./scripts/docker-dev.sh stop

echo "Removing containers and volumes..."
docker compose -f docker-compose.dev.yml down -v --remove-orphans

echo "Cleaning up Docker system..."
docker system prune -af
docker volume prune -f

echo "Rebuilding environment..."
./scripts/docker-dev.sh init
./scripts/docker-dev.sh start gpu postgres tools

echo "Environment reset complete!"
```

### Selective Service Recovery

```bash
# Reset just the database
docker compose -f docker-compose.dev.yml stop postgres
docker volume rm prompt-card-system_postgres_dev_data
docker compose -f docker-compose.dev.yml up -d postgres

# Reset just Ollama models
docker compose -f docker-compose.dev.yml stop ollama
docker volume rm prompt-card-system_ollama_models
docker compose -f docker-compose.dev.yml --profile init up model-init
docker compose -f docker-compose.dev.yml up -d ollama

# Reset just Redis
docker compose -f docker-compose.dev.yml stop redis
docker volume rm prompt-card-system_redis_data
docker compose -f docker-compose.dev.yml up -d redis
```

## Getting Help

### Information Gathering

Before seeking help, gather this information:

```bash
# System information
uname -a
docker --version
docker-compose --version

# Service logs
./scripts/docker-dev.sh logs > logs.txt

# Service status
./scripts/docker-dev.sh status > status.txt

# Resource usage
docker stats --no-stream > resources.txt

# Environment configuration
cat docker-compose.dev.yml > config.txt
cat .env.dev > env.txt  # Remove sensitive data first
```

### Support Channels

1. **Documentation**: Check the main Docker guide
2. **Logs**: Enable debug logging for detailed output
3. **Community**: GitHub issues with system information
4. **Self-Help**: Use the diagnostic scripts provided

Remember to remove sensitive information (passwords, secrets) from any shared configuration files.