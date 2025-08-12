# Production Deployment Guide

## 🚀 Overview

This document provides comprehensive procedures for deploying the Prompt Card System to production, including deployment strategies, rollback procedures, and post-deployment verification.

## 🏗️ Deployment Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Git Repository│ ──→│   CI/CD Pipeline│ ──→│   Production    │
│   (GitHub)      │    │   (GitHub       │    │   Environment   │
│                 │    │    Actions)     │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Development   │    │   Staging       │    │   Load Balancer │
│   Environment   │    │   Environment   │    │   + Monitoring  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🎯 Deployment Strategies

### 1. Blue-Green Deployment (Recommended)

#### Overview
Blue-green deployment maintains two identical production environments, allowing for zero-downtime deployments with instant rollback capability.

#### Implementation
```bash
# Blue-Green Deployment Script
cat > scripts/production/blue-green-deploy.sh << 'EOF'
#!/bin/bash

set -e

# Configuration
CURRENT_ENV=${1:-blue}
NEW_ENV=${2:-green}
IMAGE_TAG=${3:-latest}

echo "🚀 Starting Blue-Green Deployment"
echo "   Current: $CURRENT_ENV"
echo "   New: $NEW_ENV" 
echo "   Image: $IMAGE_TAG"

# Step 1: Deploy to inactive environment
echo "📦 Deploying to $NEW_ENV environment..."
docker-compose -f docker-compose.$NEW_ENV.yml down
docker-compose -f docker-compose.$NEW_ENV.yml pull
docker-compose -f docker-compose.$NEW_ENV.yml up -d

# Step 2: Health check on new environment
echo "🔍 Performing health checks..."
sleep 30

for i in {1..30}; do
    if curl -f -s "http://localhost:$(get_port $NEW_ENV)/api/health" > /dev/null; then
        echo "✅ Health check passed"
        break
    else
        echo "⏳ Waiting for health check... ($i/30)"
        sleep 10
    fi
    
    if [ $i -eq 30 ]; then
        echo "❌ Health check failed, aborting deployment"
        exit 1
    fi
done

# Step 3: Switch load balancer
echo "🔄 Switching traffic to $NEW_ENV environment..."
update_load_balancer $NEW_ENV

# Step 4: Verify traffic switch
sleep 10
if verify_traffic $NEW_ENV; then
    echo "✅ Traffic successfully switched to $NEW_ENV"
else
    echo "❌ Traffic switch failed, rolling back..."
    update_load_balancer $CURRENT_ENV
    exit 1
fi

# Step 5: Shutdown old environment (after verification period)
echo "⏱️  Waiting 5 minutes before shutting down $CURRENT_ENV..."
sleep 300

echo "🛑 Shutting down $CURRENT_ENV environment..."
docker-compose -f docker-compose.$CURRENT_ENV.yml down

echo "🎉 Blue-Green deployment completed successfully!"

function get_port() {
    case $1 in
        blue) echo "3000" ;;
        green) echo "3001" ;;
    esac
}

function update_load_balancer() {
    local env=$1
    local port=$(get_port $env)
    
    # Update nginx configuration
    sed -i "s/upstream backend {/upstream backend {\n    server localhost:$port;/" /etc/nginx/nginx.conf
    nginx -s reload
}

function verify_traffic() {
    local env=$1
    local expected_port=$(get_port $env)
    
    # Verify a few requests hit the new environment
    for i in {1..5}; do
        response=$(curl -s "http://localhost/api/health" | jq -r '.environment')
        if [ "$response" != "$env" ]; then
            return 1
        fi
    done
    return 0
}
EOF

chmod +x scripts/production/blue-green-deploy.sh
```

### 2. Rolling Deployment

#### Implementation
```bash
# Rolling Deployment Script
cat > scripts/production/rolling-deploy.sh << 'EOF'
#!/bin/bash

set -e

IMAGE_TAG=${1:-latest}
SERVICE_NAME=${2:-backend}
INSTANCES=${3:-3}

echo "🔄 Starting Rolling Deployment"
echo "   Service: $SERVICE_NAME"
echo "   Image: $IMAGE_TAG"
echo "   Instances: $INSTANCES"

# Pull new image
docker pull prompt-$SERVICE_NAME:$IMAGE_TAG

# Rolling update one instance at a time
for i in $(seq 1 $INSTANCES); do
    INSTANCE_NAME="prompt-${SERVICE_NAME}_${i}"
    
    echo "🔄 Updating instance $i/$INSTANCES: $INSTANCE_NAME"
    
    # Remove instance from load balancer
    remove_from_lb $INSTANCE_NAME
    
    # Stop and update instance
    docker stop $INSTANCE_NAME
    docker rm $INSTANCE_NAME
    
    # Start new instance
    docker run -d --name $INSTANCE_NAME \
        --network prompt-card-system_default \
        -e NODE_ENV=production \
        prompt-$SERVICE_NAME:$IMAGE_TAG
    
    # Health check
    echo "🔍 Health checking $INSTANCE_NAME..."
    for j in {1..30}; do
        if docker exec $INSTANCE_NAME curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
            echo "✅ Instance $INSTANCE_NAME healthy"
            break
        else
            sleep 5
        fi
        
        if [ $j -eq 30 ]; then
            echo "❌ Instance $INSTANCE_NAME failed health check"
            exit 1
        fi
    done
    
    # Add back to load balancer
    add_to_lb $INSTANCE_NAME
    
    echo "✅ Instance $i/$INSTANCES updated successfully"
    sleep 10
done

echo "🎉 Rolling deployment completed successfully!"

function remove_from_lb() {
    local instance=$1
    # Implementation depends on your load balancer
    echo "Removing $instance from load balancer"
}

function add_to_lb() {
    local instance=$1
    # Implementation depends on your load balancer  
    echo "Adding $instance to load balancer"
}
EOF

chmod +x scripts/production/rolling-deploy.sh
```

### 3. Canary Deployment

#### Implementation
```bash
# Canary Deployment Script
cat > scripts/production/canary-deploy.sh << 'EOF'
#!/bin/bash

set -e

IMAGE_TAG=${1:-latest}
CANARY_PERCENTAGE=${2:-10}

echo "🐦 Starting Canary Deployment"
echo "   Image: $IMAGE_TAG"
echo "   Canary Traffic: $CANARY_PERCENTAGE%"

# Deploy canary instance
echo "📦 Deploying canary instance..."
docker run -d --name prompt-backend-canary \
    --network prompt-card-system_default \
    -e NODE_ENV=production \
    -e CANARY=true \
    prompt-backend:$IMAGE_TAG

# Health check canary
echo "🔍 Health checking canary..."
for i in {1..30}; do
    if docker exec prompt-backend-canary curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
        echo "✅ Canary instance healthy"
        break
    else
        sleep 5
    fi
    
    if [ $i -eq 30 ]; then
        echo "❌ Canary health check failed"
        docker stop prompt-backend-canary
        docker rm prompt-backend-canary
        exit 1
    fi
done

# Configure traffic split
echo "🔄 Configuring traffic split ($CANARY_PERCENTAGE% to canary)..."
configure_canary_traffic $CANARY_PERCENTAGE

# Monitor canary for specified duration
MONITOR_DURATION=600  # 10 minutes
echo "📊 Monitoring canary for $MONITOR_DURATION seconds..."

for i in $(seq 1 $MONITOR_DURATION); do
    # Check canary health
    if ! docker exec prompt-backend-canary curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
        echo "❌ Canary health check failed during monitoring"
        rollback_canary
        exit 1
    fi
    
    # Check error rates (implement based on your monitoring)
    ERROR_RATE=$(get_canary_error_rate)
    if [ "$ERROR_RATE" -gt 5 ]; then  # More than 5% error rate
        echo "❌ High error rate detected in canary: $ERROR_RATE%"
        rollback_canary
        exit 1
    fi
    
    sleep 1
done

# Promote canary to full deployment
echo "🎉 Canary successful, promoting to full deployment..."
promote_canary

echo "✅ Canary deployment completed successfully!"

function configure_canary_traffic() {
    local percentage=$1
    # Update load balancer to send percentage of traffic to canary
    echo "Configuring $percentage% traffic to canary"
}

function rollback_canary() {
    echo "🔙 Rolling back canary deployment..."
    # Remove canary from load balancer
    configure_canary_traffic 0
    docker stop prompt-backend-canary
    docker rm prompt-backend-canary
    echo "✅ Canary rollback completed"
}

function promote_canary() {
    # Replace all instances with canary version
    echo "Promoting canary to full deployment..."
    # Implementation depends on your deployment setup
}

function get_canary_error_rate() {
    # Query monitoring system for canary error rate
    # This is a placeholder - implement based on your monitoring
    echo "0"
}
EOF

chmod +x scripts/production/canary-deploy.sh
```

## 📋 Pre-Deployment Checklist

### Infrastructure Readiness
- [ ] **Server Resources**: Verify adequate CPU, memory, and disk space
- [ ] **Network Connectivity**: Confirm all required ports are open
- [ ] **SSL Certificates**: Ensure certificates are valid and up-to-date
- [ ] **DNS Configuration**: Verify DNS records point to correct endpoints
- [ ] **Load Balancer**: Confirm load balancer configuration
- [ ] **Database**: Ensure database is ready and migrations are prepared
- [ ] **Monitoring**: Verify monitoring systems are operational

### Application Readiness
- [ ] **Code Review**: All code changes have been reviewed and approved
- [ ] **Testing**: Unit tests, integration tests, and E2E tests pass
- [ ] **Security Scan**: Security vulnerabilities have been addressed
- [ ] **Performance Testing**: Application meets performance requirements
- [ ] **Configuration**: Environment variables and secrets are configured
- [ ] **Dependencies**: All dependencies are available and compatible

### Deployment Preparation
```bash
# Pre-deployment verification script
cat > scripts/production/pre-deploy-check.sh << 'EOF'
#!/bin/bash

echo "🔍 Pre-Deployment Verification"

# Check Docker and Docker Compose
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not installed"
    exit 1
fi
echo "✅ Docker available"

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose not installed"
    exit 1
fi
echo "✅ Docker Compose available"

# Check disk space
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "❌ Disk usage too high: $DISK_USAGE%"
    exit 1
fi
echo "✅ Disk space available: $DISK_USAGE%"

# Check memory
MEMORY_USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
if [ $MEMORY_USAGE -gt 90 ]; then
    echo "❌ Memory usage too high: $MEMORY_USAGE%"
    exit 1
fi
echo "✅ Memory available: $MEMORY_USAGE%"

# Check required ports
REQUIRED_PORTS=(80 443 3000 3001 5432 6379 9090 3002)
for port in "${REQUIRED_PORTS[@]}"; do
    if netstat -tuln | grep -q ":$port "; then
        echo "✅ Port $port available"
    else
        echo "⚠️ Port $port not listening (may be expected)"
    fi
done

# Check SSL certificates
if [ -f "/etc/ssl/certs/yourdomain.com.crt" ]; then
    CERT_EXPIRY=$(openssl x509 -enddate -noout -in /etc/ssl/certs/yourdomain.com.crt | cut -d= -f2)
    EXPIRY_EPOCH=$(date -d "$CERT_EXPIRY" +%s)
    CURRENT_EPOCH=$(date +%s)
    DAYS_LEFT=$(( ($EXPIRY_EPOCH - $CURRENT_EPOCH) / 86400 ))
    
    if [ $DAYS_LEFT -lt 7 ]; then
        echo "❌ SSL certificate expires in $DAYS_LEFT days"
        exit 1
    fi
    echo "✅ SSL certificate valid for $DAYS_LEFT days"
fi

# Check environment files
if [ ! -f ".env.production" ]; then
    echo "❌ Production environment file not found"
    exit 1
fi
echo "✅ Production environment file exists"

# Verify database connection
if docker run --rm --network prompt-card-system_default postgres:13 \
    psql -h postgres -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✅ Database connection successful"
else
    echo "❌ Cannot connect to database"
    exit 1
fi

echo "🎉 Pre-deployment checks completed successfully!"
EOF

chmod +x scripts/production/pre-deploy-check.sh
```

## 🚀 Deployment Execution

### Standard Deployment Process
```bash
# Main deployment script
cat > scripts/production/deploy.sh << 'EOF'
#!/bin/bash

set -e

# Configuration
DEPLOYMENT_TYPE=${1:-rolling}
IMAGE_TAG=${2:-latest}
DRY_RUN=${3:-false}

echo "🚀 Starting Production Deployment"
echo "   Type: $DEPLOYMENT_TYPE"
echo "   Image Tag: $IMAGE_TAG"
echo "   Dry Run: $DRY_RUN"

# Pre-deployment checks
echo "🔍 Running pre-deployment checks..."
./scripts/production/pre-deploy-check.sh

if [ "$DRY_RUN" = "true" ]; then
    echo "🧪 Dry run mode - deployment simulation only"
    echo "✅ Dry run completed successfully"
    exit 0
fi

# Backup current deployment
echo "💾 Creating deployment backup..."
./scripts/production/backup.sh app

# Database migration (if needed)
if [ -f "migrations/pending.sql" ]; then
    echo "🗄️ Running database migrations..."
    docker exec prompt-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -f migrations/pending.sql
fi

# Execute deployment based on type
case $DEPLOYMENT_TYPE in
    "blue-green")
        ./scripts/production/blue-green-deploy.sh blue green $IMAGE_TAG
        ;;
    "rolling")
        ./scripts/production/rolling-deploy.sh $IMAGE_TAG backend 3
        ;;
    "canary")
        ./scripts/production/canary-deploy.sh $IMAGE_TAG 10
        ;;
    *)
        echo "❌ Unknown deployment type: $DEPLOYMENT_TYPE"
        echo "Available types: blue-green, rolling, canary"
        exit 1
        ;;
esac

# Post-deployment verification
echo "✅ Running post-deployment verification..."
./scripts/production/post-deploy-verify.sh

# Update monitoring
echo "📊 Updating monitoring configuration..."
./scripts/production/monitoring-setup.sh

echo "🎉 Deployment completed successfully!"

# Send notification
if [ -n "$SLACK_WEBHOOK_URL" ]; then
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"🚀 Production deployment completed successfully!\nType: $DEPLOYMENT_TYPE\nImage: $IMAGE_TAG\"}" \
        "$SLACK_WEBHOOK_URL"
fi
EOF

chmod +x scripts/production/deploy.sh
```

### Post-Deployment Verification
```bash
# Post-deployment verification script
cat > scripts/production/post-deploy-verify.sh << 'EOF'
#!/bin/bash

echo "✅ Post-Deployment Verification"

# Health check all services
SERVICES=("backend" "frontend" "postgres" "redis")
for service in "${SERVICES[@]}"; do
    echo "🔍 Checking $service..."
    
    case $service in
        "backend")
            if curl -f -s http://localhost:3001/api/health > /dev/null; then
                echo "✅ Backend API healthy"
            else
                echo "❌ Backend API unhealthy"
                exit 1
            fi
            ;;
        "frontend")
            if curl -f -s http://localhost:3000 > /dev/null; then
                echo "✅ Frontend healthy"
            else
                echo "❌ Frontend unhealthy"
                exit 1
            fi
            ;;
        "postgres")
            if docker exec prompt-postgres pg_isready -U $POSTGRES_USER; then
                echo "✅ PostgreSQL healthy"
            else
                echo "❌ PostgreSQL unhealthy"
                exit 1
            fi
            ;;
        "redis")
            if docker exec prompt-redis redis-cli ping | grep -q "PONG"; then
                echo "✅ Redis healthy"
            else
                echo "❌ Redis unhealthy"
                exit 1
            fi
            ;;
    esac
done

# Verify critical functionality
echo "🧪 Testing critical functionality..."

# Test user authentication
AUTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST http://localhost:3001/api/auth/test \
    -H "Content-Type: application/json" \
    -d '{"test": true}')

if [ "$AUTH_RESPONSE" = "200" ] || [ "$AUTH_RESPONSE" = "201" ]; then
    echo "✅ Authentication endpoints accessible"
else
    echo "❌ Authentication endpoints failed: $AUTH_RESPONSE"
    exit 1
fi

# Test database connectivity
DB_TEST=$(docker exec prompt-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT COUNT(*) FROM prompt_cards;" -t)
if [ -n "$DB_TEST" ]; then
    echo "✅ Database queries working (found $DB_TEST prompt cards)"
else
    echo "❌ Database queries failed"
    exit 1
fi

# Test cache
CACHE_TEST=$(docker exec prompt-redis redis-cli set test_key test_value)
if [ "$CACHE_TEST" = "OK" ]; then
    echo "✅ Cache operations working"
else
    echo "❌ Cache operations failed"
    exit 1
fi

# Load test (basic)
echo "🔄 Running basic load test..."
for i in {1..10}; do
    if ! curl -f -s http://localhost:3001/api/health > /dev/null; then
        echo "❌ Load test failed on request $i"
        exit 1
    fi
done
echo "✅ Basic load test passed"

# Check SSL certificate (if HTTPS enabled)
if curl -k -s https://localhost > /dev/null 2>&1; then
    CERT_INFO=$(openssl s_client -connect localhost:443 -servername yourdomain.com 2>/dev/null | openssl x509 -noout -subject)
    echo "✅ SSL certificate valid: $CERT_INFO"
fi

# Verify monitoring endpoints
if curl -f -s http://localhost:9090/api/v1/targets > /dev/null; then
    echo "✅ Prometheus monitoring active"
else
    echo "⚠️ Prometheus monitoring not accessible"
fi

if curl -f -s http://localhost:3002/api/health > /dev/null; then
    echo "✅ Grafana dashboard accessible"
else
    echo "⚠️ Grafana dashboard not accessible"
fi

echo "🎉 Post-deployment verification completed successfully!"

# Generate deployment report
cat > /var/log/deployment_report_$(date +%Y%m%d_%H%M%S).json << EOL
{
    "timestamp": "$(date -Iseconds)",
    "deployment_type": "$DEPLOYMENT_TYPE",
    "image_tag": "$IMAGE_TAG",
    "services_verified": ["backend", "frontend", "postgres", "redis"],
    "health_checks_passed": true,
    "load_test_passed": true,
    "monitoring_active": true,
    "deployment_status": "success"
}
EOL
EOF

chmod +x scripts/production/post-deploy-verify.sh
```

## 🔙 Rollback Procedures

### Automatic Rollback
```bash
# Rollback script
cat > scripts/production/rollback.sh << 'EOF'
#!/bin/bash

set -e

ROLLBACK_TYPE=${1:-previous}
REASON=${2:-"Manual rollback"}

echo "🔙 Starting Production Rollback"
echo "   Type: $ROLLBACK_TYPE"
echo "   Reason: $REASON"

# Get current deployment info
CURRENT_TAG=$(docker inspect prompt-backend --format='{{.Config.Image}}' | cut -d: -f2)
echo "   Current version: $CURRENT_TAG"

case $ROLLBACK_TYPE in
    "previous")
        # Rollback to previous version (stored in metadata)
        PREVIOUS_TAG=$(cat /var/log/last_deployment_tag.txt 2>/dev/null || echo "previous")
        echo "🔄 Rolling back to previous version: $PREVIOUS_TAG"
        
        # Update images
        docker tag prompt-backend:$PREVIOUS_TAG prompt-backend:latest
        docker tag prompt-frontend:$PREVIOUS_TAG prompt-frontend:latest
        
        # Restart services
        docker-compose -f docker-compose.prod.yml down
        docker-compose -f docker-compose.prod.yml up -d
        ;;
        
    "version")
        ROLLBACK_VERSION=${3:-""}
        if [ -z "$ROLLBACK_VERSION" ]; then
            echo "❌ Version not specified for version rollback"
            exit 1
        fi
        
        echo "🔄 Rolling back to specific version: $ROLLBACK_VERSION"
        
        # Pull specific version
        docker pull prompt-backend:$ROLLBACK_VERSION
        docker pull prompt-frontend:$ROLLBACK_VERSION
        
        # Update deployment
        docker-compose -f docker-compose.prod.yml down
        docker-compose -f docker-compose.prod.yml up -d
        ;;
        
    "emergency")
        echo "🚨 Emergency rollback - stopping all services"
        docker-compose -f docker-compose.prod.yml down
        
        # Start with known good configuration
        if [ -f "docker-compose.last-known-good.yml" ]; then
            docker-compose -f docker-compose.last-known-good.yml up -d
        else
            echo "❌ No known good configuration found"
            exit 1
        fi
        ;;
esac

# Database rollback (if needed)
if [ -f "migrations/rollback.sql" ]; then
    echo "🗄️ Rolling back database migrations..."
    docker exec prompt-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -f migrations/rollback.sql
fi

# Verify rollback
echo "✅ Verifying rollback..."
sleep 30

for i in {1..30}; do
    if curl -f -s http://localhost:3001/api/health > /dev/null; then
        echo "✅ Rollback successful - services healthy"
        break
    else
        echo "⏳ Waiting for services to start... ($i/30)"
        sleep 10
    fi
    
    if [ $i -eq 30 ]; then
        echo "❌ Rollback verification failed"
        exit 1
    fi
done

# Update monitoring
./scripts/production/monitoring-setup.sh

echo "🎉 Rollback completed successfully!"

# Log rollback
echo "$(date -Iseconds): Rollback completed - Type: $ROLLBACK_TYPE, Reason: $REASON" >> /var/log/deployment_history.log

# Send notification
if [ -n "$SLACK_WEBHOOK_URL" ]; then
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"🔙 Production rollback completed\nType: $ROLLBACK_TYPE\nReason: $REASON\"}" \
        "$SLACK_WEBHOOK_URL"
fi
EOF

chmod +x scripts/production/rollback.sh
```

## 📊 Deployment Monitoring

### Deployment Metrics
```bash
# Deployment metrics collection
cat > scripts/production/deployment-metrics.sh << 'EOF'
#!/bin/bash

DEPLOYMENT_START_TIME=${1:-$(date +%s)}
DEPLOYMENT_TYPE=${2:-"unknown"}

echo "📊 Collecting Deployment Metrics"

# Calculate deployment duration
DEPLOYMENT_END_TIME=$(date +%s)
DEPLOYMENT_DURATION=$((DEPLOYMENT_END_TIME - DEPLOYMENT_START_TIME))

# Collect metrics
SERVICES_COUNT=$(docker-compose -f docker-compose.prod.yml config --services | wc -l)
CONTAINERS_RUNNING=$(docker ps | grep prompt- | wc -l)
MEMORY_USAGE=$(docker stats --no-stream | awk 'NR>1 {sum+=$4} END {print sum}')
CPU_USAGE=$(docker stats --no-stream | awk 'NR>1 {sum+=$3} END {print sum}')

# Generate metrics report
cat > /var/log/deployment_metrics_$(date +%Y%m%d_%H%M%S).json << EOL
{
    "timestamp": "$(date -Iseconds)",
    "deployment_type": "$DEPLOYMENT_TYPE",
    "duration_seconds": $DEPLOYMENT_DURATION,
    "services_deployed": $SERVICES_COUNT,
    "containers_running": $CONTAINERS_RUNNING,
    "total_memory_usage": "$MEMORY_USAGE",
    "total_cpu_usage": "$CPU_USAGE",
    "deployment_status": "success"
}
EOL

echo "✅ Deployment metrics collected"
EOF

chmod +x scripts/production/deployment-metrics.sh
```

## 📋 Operational Procedures

### Daily Deployment Tasks
- [ ] Review deployment logs
- [ ] Check service health status
- [ ] Monitor resource utilization
- [ ] Verify backup completions
- [ ] Review security alerts

### Weekly Deployment Tasks
- [ ] Test rollback procedures
- [ ] Review deployment metrics
- [ ] Update deployment documentation
- [ ] Validate disaster recovery plans
- [ ] Security vulnerability assessments

### Monthly Deployment Tasks
- [ ] Comprehensive system audit
- [ ] Deployment process optimization
- [ ] Team training updates
- [ ] Infrastructure capacity planning
- [ ] Documentation review and updates

### Emergency Response Procedures

#### Service Outage
1. **Immediate Assessment**: Determine scope and impact
2. **Quick Rollback**: If deployment-related, execute rollback
3. **Communication**: Notify stakeholders and customers
4. **Investigation**: Identify root cause
5. **Resolution**: Implement permanent fix
6. **Post-Mortem**: Document lessons learned

#### Performance Degradation
1. **Monitor Metrics**: Check CPU, memory, and response times
2. **Scale Resources**: Horizontal or vertical scaling as needed
3. **Optimize Code**: Identify and fix performance bottlenecks
4. **Database Tuning**: Optimize queries and indexes
5. **Load Balancing**: Distribute traffic more effectively

---

**Last Updated**: $(date +%Y-%m-%d)  
**Review Schedule**: Quarterly  
**Contact**: DevOps Team (devops@company.com)