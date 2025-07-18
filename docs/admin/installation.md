# Installation Guide

Complete installation guide for the Prompt Card System.

## 🎯 Installation Options

### 1. Docker Compose (Recommended)
The fastest way to get started with all services:

```bash
# Clone the repository
git clone https://github.com/your-org/prompt-card-system.git
cd prompt-card-system

# Start all services
docker-compose up -d

# Check status
docker-compose ps
```

### 2. Local Development Setup
For development and customization:

```bash
# Install dependencies
npm install

# Backend setup
cd backend
npm install
npm run build

# Frontend setup
cd ../frontend
npm install
npm run build

# Start services
npm run dev
```

### 3. Production Deployment
For production environments:

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy to production
docker-compose -f docker-compose.prod.yml up -d
```

## 📋 Prerequisites

### System Requirements
- **CPU**: 2+ cores (4+ recommended)
- **Memory**: 4GB RAM minimum (8GB+ recommended)
- **Storage**: 20GB+ available space
- **Network**: Stable internet connection

### Software Dependencies
- **Docker**: Version 20.0+ and Docker Compose
- **Node.js**: Version 16+ (for local development)
- **npm**: Version 8+ (for local development)

### Optional Dependencies
- **Redis**: For advanced caching and queue management
- **PostgreSQL**: For production database (alternative to SQLite)
- **Nginx**: For reverse proxy and SSL termination

## 🚀 Quick Start Installation

### Step 1: Clone Repository
```bash
git clone https://github.com/your-org/prompt-card-system.git
cd prompt-card-system
```

### Step 2: Configure Environment
```bash
# Copy environment templates
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# Edit configuration files
nano .env
```

### Step 3: Start Services
```bash
# Start all services
docker-compose up -d

# Wait for services to initialize
docker-compose logs -f
```

### Step 4: Verify Installation
```bash
# Check service health
curl http://localhost:3001/api/health

# Open web interface
open http://localhost:3000
```

## 🔧 Configuration

### Environment Variables

**Backend Configuration** (`.env`):
```env
# Server Configuration
NODE_ENV=production
PORT=3001

# Database Configuration
DATABASE_PATH=./data/database.sqlite
DATABASE_URL=sqlite:./data/database.sqlite

# LLM Configuration
OLLAMA_BASE_URL=http://localhost:11434
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key

# Security
JWT_SECRET=your_jwt_secret_key
API_KEY_SECRET=your_api_key_secret

# CORS
CORS_ORIGIN=http://localhost:3000
```

**Frontend Configuration** (`.env.local`):
```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001

# Features
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_REPORTS=true
NEXT_PUBLIC_ENABLE_AI_OPTIMIZATION=true
```

### Docker Compose Configuration

**Development** (`docker-compose.yml`):
```yaml
version: '3.8'

services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:3001
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
      - PORT=3001
      - DATABASE_PATH=/app/data/database.sqlite
    volumes:
      - ./backend/data:/app/data
      - ./backend/src:/app/src
    depends_on:
      - ollama

  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ./models:/root/.ollama
```

**Production** (`docker-compose.prod.yml`):
```yaml
version: '3.8'

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=https://api.yourdomain.com
    depends_on:
      - backend

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DATABASE_URL=postgresql://user:password@postgres:5432/promptcard
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=promptcard
      - POSTGRES_USER=promptcard
      - POSTGRES_PASSWORD=secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

## 🗄️ Database Setup

### SQLite (Default)
SQLite is pre-configured and requires no setup:
```bash
# Database file is created automatically
# Location: ./backend/data/database.sqlite
```

### PostgreSQL (Production)
For production deployments:

```bash
# Install PostgreSQL
sudo apt-get install postgresql postgresql-contrib

# Create database
sudo -u postgres createdb promptcard

# Create user
sudo -u postgres createuser --interactive promptcard

# Update environment variables
DATABASE_URL=postgresql://promptcard:password@localhost:5432/promptcard
```

### Migration
Run database migrations:
```bash
# Development
npm run migrate

# Production
docker-compose exec backend npm run migrate
```

## 🔐 Security Configuration

### SSL/TLS Setup
For production deployments:

```nginx
# Nginx configuration
server {
    listen 443 ssl;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Authentication Setup
Configure authentication providers:

```env
# JWT Configuration
JWT_SECRET=your_256_bit_secret_key
JWT_EXPIRES_IN=7d

# OAuth Configuration (optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# SAML Configuration (optional)
SAML_ENTRY_POINT=https://your-idp.com/saml/sso
SAML_ISSUER=prompt-card-system
```

## 📊 Performance Optimization

### Resource Configuration
Optimize for your environment:

```yaml
# Docker resource limits
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
        reservations:
          memory: 1G
          cpus: '0.5'
```

### Database Optimization
SQLite configuration:
```env
# SQLite optimizations
DATABASE_PRAGMA_JOURNAL_MODE=WAL
DATABASE_PRAGMA_SYNCHRONOUS=NORMAL
DATABASE_PRAGMA_CACHE_SIZE=10000
```

PostgreSQL configuration:
```env
# PostgreSQL optimizations
POSTGRES_SHARED_BUFFERS=256MB
POSTGRES_EFFECTIVE_CACHE_SIZE=1GB
POSTGRES_WORK_MEM=4MB
```

## 🔍 Health Checks

### Service Health Monitoring
```bash
# Check all services
docker-compose ps

# Check specific service logs
docker-compose logs backend

# Health check endpoints
curl http://localhost:3001/api/health
curl http://localhost:3001/api/health/db
```

### Automated Health Checks
Configure automated monitoring:
```yaml
# Docker health checks
services:
  backend:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## 🔄 Backup and Recovery

### Database Backup
```bash
# SQLite backup
cp ./backend/data/database.sqlite ./backups/database-$(date +%Y%m%d).sqlite

# PostgreSQL backup
pg_dump -h localhost -U promptcard promptcard > backup.sql
```

### Automated Backup Script
```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d-%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
docker-compose exec -T postgres pg_dump -U promptcard promptcard > $BACKUP_DIR/db-$DATE.sql

# Backup uploaded files
tar -czf $BACKUP_DIR/files-$DATE.tar.gz ./data/uploads/

# Clean old backups (keep last 30 days)
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
```

## 🚨 Troubleshooting

### Common Issues

**Services won't start**:
```bash
# Check port conflicts
netstat -tulpn | grep :3000
netstat -tulpn | grep :3001

# Check disk space
df -h

# Check Docker resources
docker system df
```

**Database connection issues**:
```bash
# Check database file permissions
ls -la ./backend/data/

# Test database connection
docker-compose exec backend npm run db:test
```

**Frontend can't connect to backend**:
```bash
# Check CORS configuration
curl -I http://localhost:3001/api/health

# Verify environment variables
docker-compose exec frontend printenv | grep NEXT_PUBLIC
```

### Performance Issues
```bash
# Check resource usage
docker stats

# Monitor database performance
docker-compose exec backend npm run db:analyze

# Check log files
docker-compose logs --tail=100 backend
```

## 🔄 Updates and Maintenance

### Updating the System
```bash
# Pull latest changes
git pull origin main

# Rebuild containers
docker-compose build

# Restart services
docker-compose up -d

# Run migrations
docker-compose exec backend npm run migrate
```

### Maintenance Tasks
```bash
# Clean up old data
docker-compose exec backend npm run cleanup

# Optimize database
docker-compose exec backend npm run db:optimize

# Update dependencies
docker-compose exec backend npm update
```

## 📚 Next Steps

After installation:
1. **Configure LLM providers** - Set up Ollama or cloud providers
2. **Create first prompt card** - Test the system
3. **Set up monitoring** - Configure alerts and monitoring
4. **Configure backups** - Set up automated backups
5. **Review security** - Implement security best practices

---

**Need Help?** Check the [troubleshooting guide](../troubleshooting/common-issues.md) or contact support.