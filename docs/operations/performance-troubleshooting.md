# Performance Troubleshooting Guide

## ⚡ Overview

This document provides systematic procedures for diagnosing and resolving performance issues in the Prompt Card System, including identification of bottlenecks, root cause analysis, and remediation strategies.

## 🎯 Performance Metrics Overview

### Key Performance Indicators (KPIs)
- **Response Time**: < 2 seconds (95th percentile)
- **Throughput**: > 1000 requests/minute
- **Error Rate**: < 1%
- **Availability**: 99.9%
- **CPU Usage**: < 80%
- **Memory Usage**: < 90%
- **Database Response**: < 100ms (average)

### Performance Monitoring Stack
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Application   │ ──→│   Prometheus    │ ──→│     Grafana     │
│    Metrics      │    │   (Collection)  │    │ (Visualization) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   OpenTelemetry │    │   Jaeger        │    │   Custom        │
│   (Tracing)     │    │   (Distributed  │    │   Dashboards    │
└─────────────────┘    │   Tracing)      │    └─────────────────┘
                       └─────────────────┘
```

## 🚀 Quick Performance Assessment

### Immediate Health Check
```bash
# Overall system health
curl -s http://localhost:3001/api/health | jq '.'

# Response time test
time curl -s http://localhost:3001/api/prompt-cards > /dev/null

# Load test (simple)
for i in {1..100}; do 
  curl -s http://localhost:3001/api/health > /dev/null & 
done
wait
```

### Key Metrics Dashboard
```bash
# CPU usage
docker stats --no-stream | awk 'NR>1 {print $1, $3}'

# Memory usage
docker stats --no-stream | awk 'NR>1 {print $1, $4}'

# Database connections
docker exec prompt-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT count(*) as active_connections FROM pg_stat_activity WHERE state = 'active';"

# Redis performance
docker exec prompt-redis redis-cli info stats | grep keyspace
```

## 🔍 Systematic Performance Diagnosis

### Step 1: Identify the Problem

#### Performance Symptoms Checklist
- [ ] Slow page load times
- [ ] High server response times
- [ ] Database query timeouts
- [ ] Memory exhaustion
- [ ] High CPU utilization
- [ ] Disk I/O bottlenecks
- [ ] Network connectivity issues

#### Initial Investigation
```bash
# Check application logs for performance warnings
docker logs prompt-backend --since 1h | grep -E "(slow|timeout|error)" | tail -20

# Monitor real-time metrics
docker stats prompt-backend prompt-frontend prompt-postgres prompt-redis

# Check system load
docker exec prompt-backend uptime
docker exec prompt-backend free -h
docker exec prompt-backend df -h
```

### Step 2: Application Performance Analysis

#### Frontend Performance
```bash
# Check Next.js build performance
docker exec prompt-frontend npm run analyze

# Lighthouse audit (if accessible)
npx lighthouse http://localhost:3000 --output=html --output-path=./lighthouse-report.html

# Bundle analysis
docker exec prompt-frontend npm run build -- --analyze
```

#### Backend Performance Profiling
```bash
# Enable Node.js profiling
docker exec prompt-backend node --prof src/server.js &
PROF_PID=$!
sleep 60
kill $PROF_PID

# Generate profile report
docker exec prompt-backend node --prof-process isolate-*.log > profile-report.txt

# Check for memory leaks
docker exec prompt-backend node --inspect=0.0.0.0:9229 src/server.js &

# Monitor heap usage
docker exec prompt-backend node -e "console.log(process.memoryUsage())"
```

### Step 3: Database Performance Analysis

#### PostgreSQL Performance
```sql
-- Connect to database
docker exec -it prompt-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB

-- Check slow queries
SELECT query, calls, total_time, mean_time, rows
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Check database connections
SELECT datname, numbackends, xact_commit, xact_rollback, 
       blks_read, blks_hit, temp_files, temp_bytes
FROM pg_stat_database 
WHERE datname = 'prompt_card_db';

-- Check table statistics
SELECT schemaname, tablename, seq_scan, seq_tup_read, 
       idx_scan, idx_tup_fetch, n_tup_ins, n_tup_upd, n_tup_del
FROM pg_stat_user_tables
ORDER BY seq_scan DESC;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

#### Database Optimization Commands
```bash
# Check for missing indexes
docker exec prompt-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public'
AND n_distinct > 100
ORDER BY n_distinct DESC;"

# Analyze table statistics
docker exec prompt-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "ANALYZE;"

# Check table sizes
docker exec prompt-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
```

### Step 4: Cache Performance Analysis

#### Redis Performance Check
```bash
# Redis info
docker exec prompt-redis redis-cli info all

# Cache hit ratio
docker exec prompt-redis redis-cli info stats | grep keyspace_

# Memory usage analysis
docker exec prompt-redis redis-cli info memory | grep used_memory

# Slow log analysis
docker exec prompt-redis redis-cli slowlog get 10

# Monitor Redis operations
docker exec prompt-redis redis-cli monitor | head -100
```

#### Cache Optimization
```bash
# Check cache keys
docker exec prompt-redis redis-cli keys "*" | head -20

# Analyze memory usage by key type
docker exec prompt-redis redis-cli --bigkeys

# Test cache performance
docker exec prompt-redis redis-cli --latency-history -i 1
```

## 🛠️ Performance Optimization Strategies

### Application-Level Optimizations

#### Backend Optimizations
```javascript
// Enable clustering for Node.js (add to server.js)
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
} else {
  // Start your app
  require('./app');
}
```

```bash
# Implement compression middleware
docker exec prompt-backend npm install compression
# Add to Express app: app.use(compression())

# Enable HTTP/2 if using HTTPS
# Update nginx configuration for HTTP/2 support
```

#### Database Query Optimization
```sql
-- Create performance-critical indexes
CREATE INDEX CONCURRENTLY idx_prompt_cards_created_at ON prompt_cards(created_at);
CREATE INDEX CONCURRENTLY idx_test_executions_status ON test_executions(status);
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);

-- Optimize frequently used queries
CREATE INDEX CONCURRENTLY idx_prompt_cards_user_category 
ON prompt_cards(user_id, category) WHERE deleted_at IS NULL;
```

#### Caching Strategy Implementation
```bash
# Implement Redis caching for expensive queries
cat > backend/src/middleware/cache.js << 'EOF'
const redis = require('ioredis');
const client = new redis(process.env.REDIS_URL);

const cacheMiddleware = (ttl = 300) => {
  return async (req, res, next) => {
    const key = `cache:${req.originalUrl}`;
    
    try {
      const cached = await client.get(key);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
      
      // Store original json method
      const originalJson = res.json;
      res.json = function(data) {
        // Cache the response
        client.setex(key, ttl, JSON.stringify(data));
        return originalJson.call(this, data);
      };
      
      next();
    } catch (error) {
      next();
    }
  };
};

module.exports = cacheMiddleware;
EOF
```

### Infrastructure-Level Optimizations

#### Container Resource Optimization
```yaml
# docker-compose.prod.yml optimizations
version: '3.8'
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
    environment:
      - NODE_ENV=production
      - NODE_OPTIONS=--max-old-space-size=3072
      - UV_THREADPOOL_SIZE=20
```

#### Load Balancing Configuration
```bash
# Update nginx for better load balancing
cat > nginx/nginx.conf << 'EOF'
upstream backend {
    least_conn;
    server prompt-backend_1:3001 max_fails=3 fail_timeout=30s;
    server prompt-backend_2:3001 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

server {
    listen 80;
    
    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
    
    location /static {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF
```

## 📊 Load Testing and Benchmarking

### Setup Load Testing

#### Artillery Load Testing
```bash
# Install Artillery
npm install -g artillery

# Create load test configuration
cat > loadtest/api-test.yml << 'EOF'
config:
  target: 'http://localhost:3001'
  phases:
    - duration: 60
      arrivalRate: 10
    - duration: 120
      arrivalRate: 20
    - duration: 60
      arrivalRate: 5

scenarios:
  - name: "API Health Check"
    requests:
      - get:
          url: "/api/health"
      
  - name: "Get Prompt Cards"
    requests:
      - get:
          url: "/api/prompt-cards"
          
  - name: "Create Prompt Card"
    requests:
      - post:
          url: "/api/prompt-cards"
          json:
            title: "Test Card"
            description: "Load test card"
            category: "test"
EOF

# Run load test
artillery run loadtest/api-test.yml --output loadtest-results.json

# Generate report
artillery report loadtest-results.json
```

#### Apache Bench Testing
```bash
# Simple load test
ab -n 1000 -c 50 http://localhost:3001/api/health

# POST request test with data
ab -n 500 -c 25 -p postdata.json -T application/json http://localhost:3001/api/prompt-cards

# Long-running test
ab -t 300 -c 50 http://localhost:3001/api/prompt-cards
```

### Database Load Testing
```bash
# PostgreSQL connection stress test
cat > scripts/db-stress-test.sh << 'EOF'
#!/bin/bash
for i in {1..100}; do
  docker exec prompt-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT COUNT(*) FROM prompt_cards;" &
done
wait
echo "Database stress test completed"
EOF

chmod +x scripts/db-stress-test.sh
./scripts/db-stress-test.sh
```

## 🔧 Performance Tuning Procedures

### Memory Optimization

#### Node.js Memory Tuning
```bash
# Increase Node.js heap size
docker-compose -f docker-compose.prod.yml exec backend node --max-old-space-size=4096 src/server.js

# Enable garbage collection logging
NODE_OPTIONS="--max-old-space-size=4096 --trace-gc" docker-compose -f docker-compose.prod.yml up backend

# Analyze memory usage patterns
docker exec prompt-backend node --inspect=0.0.0.0:9229 src/server.js
```

#### Database Memory Tuning
```bash
# Update PostgreSQL memory settings
cat > postgresql-tuning.sql << 'EOF'
-- Memory settings (adjust based on available RAM)
ALTER SYSTEM SET shared_buffers = '1GB';
ALTER SYSTEM SET effective_cache_size = '3GB';
ALTER SYSTEM SET work_mem = '256MB';
ALTER SYSTEM SET maintenance_work_mem = '512MB';

-- Connection settings
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET max_prepared_transactions = 100;

SELECT pg_reload_conf();
EOF

docker exec prompt-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -f postgresql-tuning.sql
```

### CPU Optimization

#### Process Optimization
```bash
# Check CPU-intensive processes
docker exec prompt-backend top -b -n1 | head -20

# Optimize Node.js clustering
cat > backend/cluster.js << 'EOF'
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);
  
  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork();
  });
} else {
  require('./src/server.js');
  console.log(`Worker ${process.pid} started`);
}
EOF
```

### I/O Optimization

#### Disk I/O Tuning
```bash
# Check disk I/O
docker exec prompt-backend iostat -x 1 5

# Optimize Docker volumes for performance
docker volume create --driver local \
  --opt type=tmpfs \
  --opt device=tmpfs \
  --opt o=size=1g \
  prompt-temp-cache

# Use SSD-optimized mount options
mount -o noatime,nodiratime /dev/sdb1 /var/lib/docker
```

## 📈 Performance Monitoring Automation

### Custom Performance Metrics
```bash
# Create performance monitoring script
cat > scripts/perf-monitor.sh << 'EOF'
#!/bin/bash

LOGFILE="/var/log/performance-monitor.log"
THRESHOLD_CPU=80
THRESHOLD_MEM=90
THRESHOLD_RESPONSE=2000

while true; do
    TIMESTAMP=$(date)
    
    # Check CPU usage
    CPU_USAGE=$(docker stats --no-stream prompt-backend | awk 'NR==2 {print $3}' | sed 's/%//')
    
    # Check memory usage
    MEM_USAGE=$(docker stats --no-stream prompt-backend | awk 'NR==2 {print $7}' | sed 's/%//')
    
    # Check response time
    RESPONSE_TIME=$(curl -o /dev/null -s -w "%{time_total}" http://localhost:3001/api/health | cut -d. -f1)
    
    echo "$TIMESTAMP - CPU: ${CPU_USAGE}% MEM: ${MEM_USAGE}% Response: ${RESPONSE_TIME}ms" >> $LOGFILE
    
    # Alert on thresholds
    if (( $(echo "$CPU_USAGE > $THRESHOLD_CPU" | bc -l) )); then
        echo "🚨 High CPU usage: ${CPU_USAGE}%" | logger -t perf-monitor
    fi
    
    if (( $(echo "$MEM_USAGE > $THRESHOLD_MEM" | bc -l) )); then
        echo "🚨 High memory usage: ${MEM_USAGE}%" | logger -t perf-monitor
    fi
    
    sleep 30
done
EOF

chmod +x scripts/perf-monitor.sh
nohup scripts/perf-monitor.sh &
```

### Performance Alert Rules
```yaml
# Add to prometheus alert rules
groups:
  - name: performance_alerts
    rules:
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"
          description: "95th percentile response time is {{ $value }}s"
          
      - alert: LowThroughput
        expr: rate(http_requests_total[5m]) < 10
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Low request throughput"
          description: "Request rate is {{ $value }} requests/second"
```

## 📋 Performance Maintenance Checklist

### Daily Performance Tasks
- [ ] Review performance dashboards
- [ ] Check response time metrics
- [ ] Monitor resource utilization
- [ ] Verify cache hit rates
- [ ] Check for slow queries

### Weekly Performance Tasks
- [ ] Run performance load tests
- [ ] Analyze performance trends
- [ ] Review and optimize slow queries
- [ ] Clean up database statistics
- [ ] Update performance baselines

### Monthly Performance Tasks
- [ ] Conduct comprehensive performance audit
- [ ] Review and update performance thresholds
- [ ] Optimize database indexes
- [ ] Plan capacity upgrades
- [ ] Update performance documentation

### Performance Troubleshooting Playbook

#### Issue: High Response Time
1. **Check application logs** for errors
2. **Monitor database queries** for slow operations
3. **Verify cache performance** and hit rates
4. **Check system resources** (CPU, memory, disk)
5. **Scale horizontally** if needed

#### Issue: High CPU Usage
1. **Identify CPU-intensive processes**
2. **Check for infinite loops** or runaway processes
3. **Optimize application code** for CPU efficiency
4. **Scale vertically** or add more instances
5. **Review and optimize algorithms**

#### Issue: Memory Issues
1. **Check for memory leaks** in application
2. **Monitor garbage collection** patterns
3. **Optimize memory-intensive operations**
4. **Increase container memory limits**
5. **Implement memory caching strategies**

---

**Last Updated**: $(date +%Y-%m-%d)  
**Review Schedule**: Monthly  
**Contact**: Performance Team (performance@company.com)