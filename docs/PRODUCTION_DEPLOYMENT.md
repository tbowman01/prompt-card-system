# 🚀 Production Deployment Guide

## Overview

This guide provides complete instructions for deploying the Prompt Card System to production with enterprise-grade security, monitoring, and scalability.

## 🏗️ Architecture Overview

### Production Components
- **Frontend**: Next.js application with SSR
- **Backend**: Node.js API with TypeScript
- **Database**: PostgreSQL 16 with optimized settings
- **Cache**: Redis 7.2 with persistence
- **AI Engine**: Ollama with GPU support
- **Reverse Proxy**: NGINX with SSL termination
- **Monitoring**: Prometheus + Grafana + Jaeger + Loki
- **Backup**: Automated backup system

### Security Features
- SSL/TLS encryption (Let's Encrypt or custom certificates)
- Rate limiting and DDoS protection
- Security headers and CORS configuration
- Encrypted backups with retention policies
- Role-based access control
- API key management

## 📋 Prerequisites

### Server Requirements
- **Minimum**: 4 CPU cores, 8GB RAM, 100GB SSD
- **Recommended**: 8 CPU cores, 16GB RAM, 500GB SSD
- **GPU (Optional)**: NVIDIA GPU for AI acceleration
- **OS**: Ubuntu 20.04+ / CentOS 8+ / RHEL 8+

### Software Dependencies
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installations
docker --version
docker-compose --version
```

### Domain Setup
- Register domain (e.g., `promptcard.ai`)
- Configure DNS records:
  - `A` record: `promptcard.ai` → Server IP
  - `A` record: `www.promptcard.ai` → Server IP
  - `A` record: `api.promptcard.ai` → Server IP
  - `A` record: `monitoring.promptcard.ai` → Server IP

## 🔧 Configuration

### 1. Environment Setup

```bash
# Clone repository
git clone https://github.com/your-org/prompt-card-system.git
cd prompt-card-system

# Copy production environment template
cp .env.production .env.prod

# Edit configuration
nano .env.prod
```

### 2. Required Environment Variables

```bash
# Database
POSTGRES_PASSWORD=your_secure_password_here
DATABASE_URL=postgresql://promptcard_user:your_secure_password_here@postgres:5432/promptcard_prod

# Redis
REDIS_PASSWORD=your_redis_password_here

# Security
JWT_SECRET=your_jwt_secret_64_characters_minimum
GRAFANA_ADMIN_PASSWORD=your_grafana_password

# Domain
DOMAIN=promptcard.ai
CORS_ORIGIN=https://promptcard.ai,https://www.promptcard.ai

# External APIs
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
```

### 3. SSL Certificate Setup

#### Option A: Let's Encrypt (Recommended)
```bash
# Setup SSL certificates
sudo ./scripts/production/ssl-setup.sh promptcard.ai admin@promptcard.ai letsencrypt
```

#### Option B: Self-Signed (Development/Testing)
```bash
# Generate self-signed certificates
./scripts/production/ssl-setup.sh promptcard.ai admin@promptcard.ai self-signed
```

#### Option C: Custom Certificates
```bash
# Copy your certificates
cp your-fullchain.pem ./nginx/ssl/fullchain.pem
cp your-private-key.pem ./nginx/ssl/privkey.pem
chmod 600 ./nginx/ssl/*.pem
```

## 🚀 Deployment

### 1. Initial Deployment

```bash
# Deploy production stack
./scripts/production/deploy.sh production

# Check deployment status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 2. Verification

#### Health Checks
```bash
# Frontend
curl -f https://promptcard.ai/api/health

# Backend API
curl -f https://api.promptcard.ai/api/health

# Monitoring
curl -f https://monitoring.promptcard.ai/grafana/api/health
```

#### Service URLs
- **Main Application**: https://promptcard.ai
- **API Documentation**: https://api.promptcard.ai/docs
- **Monitoring Dashboard**: https://monitoring.promptcard.ai/grafana
- **Prometheus**: https://monitoring.promptcard.ai/prometheus
- **Jaeger Tracing**: https://monitoring.promptcard.ai/jaeger

## 📊 Monitoring Setup

### Default Dashboards
The deployment includes pre-configured monitoring:

1. **Application Metrics**
   - Request rate and response times
   - Error rates and success rates
   - Database performance
   - Cache hit rates

2. **Infrastructure Metrics**
   - CPU, memory, and disk usage
   - Network traffic
   - Container health
   - GPU utilization (if available)

3. **Business Metrics**
   - User activity
   - Test execution statistics
   - Cost tracking
   - Feature usage

### Alerting Rules
Configured alerts for:
- High error rates (>5%)
- Slow response times (>2s)
- High resource usage (>90%)
- Service downtime
- Certificate expiration

## 🔒 Security Hardening

### 1. Firewall Configuration
```bash
# Allow only necessary ports
sudo ufw enable
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP (redirects to HTTPS)
sudo ufw allow 443/tcp  # HTTPS
sudo ufw status
```

### 2. Fail2Ban Setup
```bash
# Install and configure Fail2Ban
sudo apt-get install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 3. Regular Security Updates
```bash
# Add to crontab for automated updates
echo "0 2 * * 1 apt-get update && apt-get -y upgrade" | sudo crontab -
```

## 💾 Backup Configuration

### Automated Backups
```bash
# Setup automated backups (runs daily at 2 AM)
echo "0 2 * * * /path/to/prompt-card-system/scripts/production/backup.sh full" | crontab -

# Manual backup
./scripts/production/backup.sh full

# Database only backup
./scripts/production/backup.sh database

# Application data backup
./scripts/production/backup.sh app
```

### Cloud Storage Integration
Configure in `.env.prod`:
```bash
# AWS S3
AWS_S3_BUCKET=your-backup-bucket
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Google Cloud Storage
GOOGLE_CLOUD_BUCKET=your-backup-bucket
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

## 🔄 Updates and Maintenance

### Rolling Updates
```bash
# Pull latest changes
git pull origin main

# Deploy updates (with automatic backup)
./scripts/production/deploy.sh production

# Rollback if needed
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

### Database Migrations
```bash
# Run pending migrations
docker-compose -f docker-compose.prod.yml exec backend npm run migrate

# Rollback migration (if needed)
docker-compose -f docker-compose.prod.yml exec backend npm run migrate:rollback
```

### Log Management
```bash
# View application logs
docker-compose -f docker-compose.prod.yml logs -f backend frontend

# Rotate logs (add to crontab)
echo "0 1 * * * docker system prune -f" | crontab -
```

## 📈 Scaling

### Horizontal Scaling
```bash
# Scale backend services
docker-compose -f docker-compose.prod.yml up -d --scale backend=3

# Scale frontend services
docker-compose -f docker-compose.prod.yml up -d --scale frontend=2
```

### Load Balancer Configuration
Update NGINX configuration for multiple backend instances:
```nginx
upstream backend {
    server backend:3001;
    server backend:3002;
    server backend:3003;
}
```

### Database Scaling
For high-traffic deployments:
1. Configure PostgreSQL replication
2. Implement read replicas
3. Add connection pooling (PgBouncer)

## 🚨 Troubleshooting

### Common Issues

#### Service Won't Start
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs service-name

# Check resource usage
docker stats

# Restart specific service
docker-compose -f docker-compose.prod.yml restart service-name
```

#### Database Connection Issues
```bash
# Check PostgreSQL logs
docker-compose -f docker-compose.prod.yml logs postgres

# Test database connection
docker-compose -f docker-compose.prod.yml exec postgres psql -U promptcard_user -d promptcard_prod -c "SELECT version();"
```

#### SSL Certificate Issues
```bash
# Check certificate validity
openssl x509 -in ./nginx/ssl/fullchain.pem -text -noout

# Renew Let's Encrypt certificates
sudo certbot renew

# Test nginx configuration
docker-compose -f docker-compose.prod.yml exec nginx nginx -t
```

### Performance Optimization

#### Database Tuning
```sql
-- Optimize PostgreSQL settings
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
SELECT pg_reload_conf();
```

#### Redis Optimization
```bash
# Configure Redis memory limits
echo "maxmemory 1gb" >> redis/redis.conf
echo "maxmemory-policy allkeys-lru" >> redis/redis.conf
```

## 📞 Support

### Health Check Endpoints
- **Application**: `GET /api/health/comprehensive`
- **Database**: `GET /api/health/database`
- **Cache**: `GET /api/health/redis`
- **AI Service**: `GET /api/health/ollama`

### Monitoring Alerts
Configure Slack/email notifications in `.env.prod`:
```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
SMTP_HOST=smtp.gmail.com
SMTP_USER=alerts@promptcard.ai
BACKUP_NOTIFICATION_EMAIL=admin@promptcard.ai
```

### Emergency Procedures

#### Complete System Restore
```bash
# Stop all services
docker-compose -f docker-compose.prod.yml down

# Restore from backup
./scripts/production/restore.sh backup_20240119_020000

# Start services
./scripts/production/deploy.sh production
```

#### Disaster Recovery
1. Provision new server
2. Install Docker and dependencies
3. Clone repository and restore configurations
4. Restore from latest backup
5. Update DNS records
6. Verify all services

---

## 🎯 Quick Start Checklist

- [ ] Server provisioned with minimum requirements
- [ ] Domain configured with DNS records
- [ ] SSL certificates generated and installed
- [ ] Environment variables configured
- [ ] Production deployment completed
- [ ] Health checks passing
- [ ] Monitoring dashboards accessible
- [ ] Backup system configured
- [ ] Security hardening applied
- [ ] Team access configured

**🎉 Your Prompt Card System is now ready for production!**