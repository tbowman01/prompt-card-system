# Deployment Guide

Complete guide for deploying the Prompt Card System to production environments.

## 🎯 Deployment Options

### 1. Docker Compose (Recommended)
Simple deployment with all services:
- **Pros**: Easy setup, all services included
- **Cons**: Single server, limited scalability
- **Best for**: Small to medium deployments

### 2. Kubernetes
Container orchestration for scalability:
- **Pros**: Highly scalable, fault-tolerant
- **Cons**: Complex setup, requires K8s knowledge
- **Best for**: Large scale, enterprise deployments

### 3. Cloud Platforms
Managed services deployment:
- **Pros**: Minimal management, auto-scaling
- **Cons**: Platform lock-in, potentially higher costs
- **Best for**: Teams preferring managed services

## 🚀 Production Deployment

### Prerequisites
- **Server**: 4+ CPU cores, 8GB+ RAM, 50GB+ storage
- **Node.js**: Version 20+ (required for compatibility)
- **Domain**: Configured domain name with SSL certificate
- **Database**: PostgreSQL for production workloads
- **Load Balancer**: For high availability (optional)

### Step 1: Server Preparation
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker and Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker $USER

# Install additional tools
sudo apt install -y nginx certbot python3-certbot-nginx
```

### Step 2: Application Setup
```bash
# Clone repository
git clone https://github.com/your-org/prompt-card-system.git
cd prompt-card-system

# Create production environment
cp .env.example .env.production
cp backend/.env.example backend/.env.production
cp frontend/.env.example frontend/.env.production

# Configure environment variables
nano .env.production
```

### Step 3: SSL Certificate
```bash
# Install SSL certificate
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

### Step 4: Database Setup
```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql
CREATE DATABASE promptcard;
CREATE USER promptcard WITH ENCRYPTED PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE promptcard TO promptcard;
\q

# Configure database connection
echo "DATABASE_URL=postgresql://promptcard:secure_password@localhost:5432/promptcard" >> backend/.env.production
```

### Step 5: Deploy Application
```bash
# Build and start services
docker-compose -f docker-compose.prod.yml up -d

# Run database migrations
docker-compose -f docker-compose.prod.yml exec backend npm run migrate

# Check service health
docker-compose -f docker-compose.prod.yml ps
```

## 🔧 Production Configuration

### Environment Variables

**Backend Production** (`backend/.env.production`):
```env
# Environment
NODE_ENV=production
PORT=3001

# Database
DATABASE_URL=postgresql://promptcard:secure_password@localhost:5432/promptcard

# Security
JWT_SECRET=your_super_secure_jwt_secret_minimum_32_characters
API_KEY_SECRET=your_api_key_secret_minimum_32_characters
BCRYPT_ROUNDS=12

# CORS
CORS_ORIGIN=https://yourdomain.com

# LLM Configuration
OLLAMA_BASE_URL=http://ollama:11434
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# Redis (for caching and queues)
REDIS_URL=redis://redis:6379

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

**Frontend Production** (`frontend/.env.production`):
```env
# API Configuration
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com

# Features
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_REPORTS=true
NEXT_PUBLIC_ENABLE_AI_OPTIMIZATION=true
NEXT_PUBLIC_ENABLE_WEBSOCKET=true

# Analytics
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
NEXT_PUBLIC_ENABLE_TELEMETRY=true
```

### Docker Compose Production

**Production Configuration** (`docker-compose.prod.yml`):
```yaml
version: '3.8'

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=https://api.yourdomain.com
      - NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com
    depends_on:
      - backend
    networks:
      - app-network

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DATABASE_URL=postgresql://promptcard:secure_password@postgres:5432/promptcard
      - REDIS_URL=redis://redis:6379
    volumes:
      - ./backend/data:/app/data
      - ./backend/logs:/app/logs
    depends_on:
      - postgres
      - redis
    networks:
      - app-network

  postgres:
    image: postgres:15
    restart: unless-stopped
    environment:
      - POSTGRES_DB=promptcard
      - POSTGRES_USER=promptcard
      - POSTGRES_PASSWORD=secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    networks:
      - app-network

  ollama:
    image: ollama/ollama:latest
    restart: unless-stopped
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    networks:
      - app-network

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - /etc/letsencrypt:/etc/letsencrypt
    depends_on:
      - frontend
      - backend
    networks:
      - app-network

volumes:
  postgres_data:
  redis_data:
  ollama_data:

networks:
  app-network:
    driver: bridge
```

### Nginx Configuration

**Nginx Config** (`nginx.conf`):
```nginx
events {
    worker_connections 1024;
}

http {
    upstream frontend {
        server frontend:3000;
    }

    upstream backend {
        server backend:3001;
    }

    # Frontend (Main Domain)
    server {
        listen 80;
        server_name yourdomain.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl;
        server_name yourdomain.com;

        ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # WebSocket support
        location /socket.io/ {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }

    # Backend API (Subdomain)
    server {
        listen 80;
        server_name api.yourdomain.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl;
        server_name api.yourdomain.com;

        ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

        location / {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # WebSocket support
        location /socket.io/ {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

## ☁️ Cloud Deployment

### AWS Deployment

**ECS with Fargate**:
```json
{
  "family": "prompt-card-system",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "your-registry/prompt-card-backend:latest",
      "portMappings": [
        {
          "containerPort": 3001,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "DATABASE_URL",
          "value": "postgresql://user:pass@rds-endpoint:5432/promptcard"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/prompt-card-system",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

### Google Cloud Platform

**Cloud Run Deployment**:
```yaml
# cloud-run.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: prompt-card-system
  annotations:
    run.googleapis.com/ingress: all
spec:
  template:
    metadata:
      annotations:
        run.googleapis.com/cpu-throttling: "false"
        run.googleapis.com/memory: "2Gi"
        run.googleapis.com/cpu: "1000m"
    spec:
      containers:
      - image: gcr.io/your-project/prompt-card-system:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: production
        - name: DATABASE_URL
          value: postgresql://user:pass@/promptcard?host=/cloudsql/project:region:instance
        resources:
          limits:
            memory: "2Gi"
            cpu: "1000m"
```

### Azure Deployment

**Container Instances**:
```yaml
# azure-container-instance.yaml
apiVersion: '2021-03-01'
location: eastus
name: prompt-card-system
properties:
  containers:
  - name: backend
    properties:
      image: your-registry.azurecr.io/prompt-card-backend:latest
      ports:
      - port: 3001
        protocol: TCP
      resources:
        requests:
          cpu: 1.0
          memoryInGB: 2.0
      environmentVariables:
      - name: NODE_ENV
        value: production
      - name: DATABASE_URL
        secureValue: postgresql://user:pass@server:5432/promptcard
  osType: Linux
  restartPolicy: Always
  ipAddress:
    type: Public
    ports:
    - port: 3001
      protocol: TCP
```

## 🔍 Monitoring and Observability

### Health Checks
```bash
# Configure health check endpoints
echo "HEALTH_CHECK_ENDPOINT=/health" >> backend/.env.production
echo "HEALTH_CHECK_INTERVAL=30" >> backend/.env.production
```

### Logging
```bash
# Configure structured logging
echo "LOG_LEVEL=info" >> backend/.env.production
echo "LOG_FORMAT=json" >> backend/.env.production
echo "LOG_FILE=/app/logs/app.log" >> backend/.env.production
```

### Metrics
```bash
# Enable Prometheus metrics
echo "ENABLE_METRICS=true" >> backend/.env.production
echo "METRICS_PORT=9090" >> backend/.env.production
```

### Alerting
```bash
# Configure alerting
echo "ALERT_WEBHOOK_URL=https://your-slack-webhook" >> backend/.env.production
echo "ALERT_EMAIL=admin@yourdomain.com" >> backend/.env.production
```

## 🔒 Security Hardening

### SSL/TLS Configuration
```nginx
# Enhanced SSL configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_dhparam /etc/ssl/certs/dhparam.pem;

# Security headers
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options DENY always;
add_header X-Content-Type-Options nosniff always;
add_header X-XSS-Protection "1; mode=block" always;
```

### Environment Security
```bash
# Secure environment variables
chmod 600 .env.production
chmod 600 backend/.env.production
chmod 600 frontend/.env.production

# Use secrets management
docker secret create jwt_secret jwt_secret.txt
docker secret create db_password db_password.txt
```

### Network Security
```bash
# Configure firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Restrict database access
sudo ufw deny from any to any port 5432
sudo ufw allow from 172.18.0.0/16 to any port 5432
```

## 🔄 Backup and Recovery

### Automated Backups
```bash
#!/bin/bash
# backup-prod.sh

BACKUP_DIR="/backups/$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

# Database backup
docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U promptcard promptcard > $BACKUP_DIR/database.sql

# Application data backup
docker-compose -f docker-compose.prod.yml exec -T backend tar -czf - /app/data > $BACKUP_DIR/app-data.tar.gz

# Upload to cloud storage
aws s3 cp $BACKUP_DIR/ s3://your-backup-bucket/$(date +%Y%m%d)/ --recursive

# Clean old backups
find /backups -type d -mtime +30 -exec rm -rf {} \;
```

### Recovery Procedures
```bash
# Database recovery
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U promptcard promptcard < backup/database.sql

# Application data recovery
docker-compose -f docker-compose.prod.yml exec -T backend tar -xzf - -C / < backup/app-data.tar.gz

# Restart services
docker-compose -f docker-compose.prod.yml restart
```

## 📊 Performance Optimization

### Database Tuning
```sql
-- PostgreSQL performance tuning
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
SELECT pg_reload_conf();
```

### Application Optimization
```bash
# Node.js optimization
echo "NODE_OPTIONS=--max-old-space-size=2048" >> backend/.env.production

# Redis optimization
echo "REDIS_MAXMEMORY=512mb" >> backend/.env.production
echo "REDIS_MAXMEMORY_POLICY=allkeys-lru" >> backend/.env.production
```

### CDN Configuration
```nginx
# Static asset caching
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# API response caching
location /api/ {
    proxy_cache api_cache;
    proxy_cache_valid 200 5m;
    proxy_cache_key $request_uri;
}
```

## 🚨 Troubleshooting

### Common Issues

**Service startup failures**:
```bash
# Check service logs
docker-compose -f docker-compose.prod.yml logs backend

# Check resource usage
docker stats

# Verify environment variables
docker-compose -f docker-compose.prod.yml exec backend printenv
```

**Database connection issues**:
```bash
# Test database connectivity
docker-compose -f docker-compose.prod.yml exec backend npx knex migrate:status

# Check database logs
docker-compose -f docker-compose.prod.yml logs postgres
```

**Performance problems**:
```bash
# Monitor resource usage
htop
iotop

# Check database performance
docker-compose -f docker-compose.prod.yml exec postgres psql -U promptcard -c "SELECT * FROM pg_stat_activity;"
```

---

**Next Steps**: Set up [monitoring and alerting](./monitoring.md) for your production deployment.