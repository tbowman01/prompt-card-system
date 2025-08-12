# Monitoring Setup Guide

## 📊 Overview

This guide provides step-by-step procedures for setting up, configuring, and maintaining the monitoring infrastructure for the Prompt Card System using Prometheus, Grafana, and associated tools.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Application   │ ──→│   Prometheus    │ ──→│     Grafana     │
│   Metrics       │    │   (Scraping)    │    │  (Visualization)│
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  OpenTelemetry  │    │  Alertmanager   │    │     Jaeger      │
│    (Tracing)    │    │   (Alerting)    │    │   (Tracing)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Admin access to the system
- Network connectivity to monitoring endpoints

### 1. Start Monitoring Stack
```bash
# Navigate to project root
cd /path/to/prompt-card-system

# Start monitoring services
docker-compose -f docker-compose.monitoring.yml up -d

# Verify services are running
docker-compose -f docker-compose.monitoring.yml ps
```

### 2. Run Setup Script
```bash
# Execute monitoring setup script
./scripts/production/monitoring-setup.sh

# Check setup status
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health: .health}'
```

## 📊 Component Configuration

### Prometheus Configuration

**Location**: `/monitoring/prometheus/prometheus.yml`

**Key Scrape Targets**:
- **Backend API**: `host.docker.internal:3001/api/metrics`
- **Frontend**: `host.docker.internal:3000/api/metrics`
- **Node Exporter**: `node-exporter:9100`
- **Redis**: `redis-exporter:9121`
- **cAdvisor**: `cadvisor:8080/metrics`

**Configuration Validation**:
```bash
# Validate Prometheus config
docker exec prompt-prometheus promtool check config /etc/prometheus/prometheus.yml

# Reload configuration
curl -X POST http://localhost:9090/-/reload
```

### Grafana Configuration

**Access**: http://localhost:3002 (admin/admin)

**Default Datasources**:
- **Prometheus**: http://prometheus:9090
- **Loki**: http://loki:3100 (if available)
- **Jaeger**: http://jaeger:16686

**Dashboard Import**:
```bash
# Import pre-configured dashboards
curl -X POST http://localhost:3002/api/dashboards/import \
  -H "Content-Type: application/json" \
  -u admin:admin \
  -d @monitoring/grafana/dashboards/prompt-card-overview.json
```

### Alertmanager Configuration

**Location**: `/monitoring/alertmanager/alertmanager.yml`

**Test Configuration**:
```bash
# Validate alertmanager config
docker exec prompt-alertmanager amtool config show

# Test alert routing
docker exec prompt-alertmanager amtool config routes test
```

## 🔧 Detailed Setup Procedures

### Step 1: Infrastructure Monitoring

#### Node Exporter Setup
```bash
# Verify Node Exporter is collecting system metrics
curl http://localhost:9100/metrics | grep node_cpu

# Check available metrics
curl -s http://localhost:9100/metrics | grep "^# HELP" | head -10
```

#### cAdvisor Setup
```bash
# Verify container metrics
curl http://localhost:8080/metrics | grep container_cpu

# Check container discovery
curl -s http://localhost:8080/api/v1.3/containers | jq '.[0].name'
```

### Step 2: Application Monitoring

#### Backend Metrics Setup
Ensure the following metrics are exposed by the backend:

```typescript
// Verify these metrics are available at /api/metrics
- http_requests_total
- http_request_duration_seconds
- db_connections_active
- cache_operations_total
- websocket_connections_active
```

**Health Check**:
```bash
# Test backend metrics endpoint
curl http://localhost:3001/api/metrics

# Check specific metrics
curl -s http://localhost:3001/api/metrics | grep http_requests_total
```

#### Frontend Metrics Setup
```bash
# Test frontend health
curl http://localhost:3000/api/health

# Check frontend metrics (if available)
curl http://localhost:3000/api/metrics
```

### Step 3: Custom Metrics Configuration

#### Application-Specific Metrics
```yaml
# Add to prometheus.yml
- job_name: 'prompt-cards-custom'
  static_configs:
    - targets: ['host.docker.internal:3001']
  metrics_path: '/api/custom-metrics'
  scrape_interval: 30s
  params:
    format: ['prometheus']
```

#### CI/CD Metrics
```yaml
# GitHub Actions metrics
- job_name: 'github-actions'
  static_configs:
    - targets: ['host.docker.internal:3001']
  metrics_path: '/api/ci-cd/metrics'
  scrape_interval: 60s
```

## 📈 Dashboard Configuration

### Core Dashboards

#### 1. System Overview Dashboard
**Key Panels**:
- Request rate and response times
- Error rates and status codes
- System resource utilization
- Database performance metrics

**Import Command**:
```bash
curl -X POST http://localhost:3002/api/dashboards/db \
  -H "Content-Type: application/json" \
  -u admin:admin \
  -d @monitoring/grafana/dashboards/prompt-card-overview.json
```

#### 2. Infrastructure Dashboard
**Key Panels**:
- CPU, memory, disk utilization
- Network I/O and connections
- Container resource usage
- Docker metrics

#### 3. Application Performance Dashboard
**Key Panels**:
- Application response times
- Throughput and concurrency
- Cache hit rates
- Database query performance

### Custom Dashboard Creation

#### Creating New Dashboard
1. **Access Grafana**: http://localhost:3002
2. **Login**: admin/admin (change password immediately)
3. **Create Dashboard**: + → Dashboard
4. **Add Panel**: + Add Panel
5. **Configure Query**: Select Prometheus datasource

#### Example Query Templates
```promql
# Request rate
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])

# Response time 95th percentile
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Memory usage
(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes
```

## 🚨 Alerting Configuration

### Alert Rules Setup

**Location**: `/monitoring/prometheus/alert_rules.yml`

#### Critical Alerts
```yaml
- alert: ServiceDown
  expr: up == 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Service {{ $labels.job }} is down"

- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High error rate detected"
```

#### Performance Alerts
```yaml
- alert: HighResponseTime
  expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "High response time detected"

- alert: HighMemoryUsage
  expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.9
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High memory usage"
```

### Notification Channels

#### Slack Integration
```bash
# Configure Slack webhook
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"

# Test notification
curl -X POST -H 'Content-type: application/json' \
    --data '{"text":"🚨 Test alert from Prompt Card System"}' \
    $SLACK_WEBHOOK_URL
```

#### Email Notifications
```yaml
# alertmanager.yml configuration
global:
  smtp_smarthost: 'smtp.example.com:587'
  smtp_from: 'alerts@yourcompany.com'

receivers:
- name: 'email-alerts'
  email_configs:
  - to: 'ops-team@yourcompany.com'
    subject: 'Alert: {{ .GroupLabels.alertname }}'
    body: |
      Alert Details:
      {{ range .Alerts }}
      - {{ .Annotations.summary }}
      - {{ .Annotations.description }}
      {{ end }}
```

## 🔍 Troubleshooting

### Common Issues

#### Prometheus Not Scraping Targets
```bash
# Check targets status
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.health != "up")'

# Check network connectivity
docker exec prompt-prometheus ping host.docker.internal

# Verify firewall rules
sudo ufw status
```

#### Grafana Dashboard Issues
```bash
# Check Grafana logs
docker logs prompt-grafana

# Verify datasource connectivity
curl -u admin:admin http://localhost:3002/api/datasources/proxy/1/api/v1/query?query=up

# Reset admin password
docker exec prompt-grafana grafana-cli admin reset-admin-password newpassword
```

#### Alertmanager Not Sending Alerts
```bash
# Check alert rules loading
curl http://localhost:9090/api/v1/rules

# Test alert firing
curl -X POST http://localhost:9090/api/v1/admin/tsdb/delete_series?match[]=fake_metric

# Check alertmanager logs
docker logs prompt-alertmanager
```

### Performance Optimization

#### Prometheus Storage
```bash
# Monitor Prometheus storage usage
du -sh /var/lib/docker/volumes/prompt-card-system_prometheus_data/_data

# Configure retention
# Add to prometheus.yml command:
--storage.tsdb.retention.time=90d
--storage.tsdb.retention.size=50GB
```

#### Query Performance
```promql
# Optimize queries - use recording rules for expensive queries
groups:
  - name: recording_rules
    interval: 30s
    rules:
    - record: job:http_requests:rate5m
      expr: sum(rate(http_requests_total[5m])) by (job)
```

## 📊 Monitoring Best Practices

### Metric Collection
1. **Collect only what you need** - Avoid metric explosion
2. **Use consistent naming** - Follow Prometheus naming conventions
3. **Add appropriate labels** - For aggregation and filtering
4. **Monitor the monitors** - Alert on monitoring system health

### Dashboard Design
1. **Start with USE method** - Utilization, Saturation, Errors
2. **Layer information** - Overview → Detail drill-down
3. **Use consistent time ranges** - Align panels for comparison
4. **Add context** - Annotations for deployments and incidents

### Alerting Strategy
1. **Alert on symptoms, not causes** - Focus on user impact
2. **Make alerts actionable** - Include runbook links
3. **Reduce noise** - Proper alert routing and suppression
4. **Test regularly** - Verify alert delivery and escalation

## 🔒 Security Considerations

### Access Control
```bash
# Secure Grafana admin account
curl -X PUT http://localhost:3002/api/admin/users/1/password \
  -H "Content-Type: application/json" \
  -u admin:admin \
  -d '{"password":"STRONG_PASSWORD"}'

# Enable authentication for Prometheus (if needed)
# Add to prometheus.yml:
basic_auth_users:
  prometheus: $2b$12$hNf2lSsxfm0.i4a.1kVpSOVyBCfIB51VRjgBUyv6kdnyTlgWj81Ay
```

### Network Security
```bash
# Restrict access to monitoring ports
sudo ufw deny 9090  # Prometheus
sudo ufw allow from 10.0.0.0/8 to any port 9090

# Use TLS for external access
# Configure reverse proxy with SSL termination
```

## 📋 Maintenance Procedures

### Daily Tasks
- [ ] Check system health dashboards
- [ ] Review overnight alerts
- [ ] Verify backup monitoring data
- [ ] Monitor disk space usage

### Weekly Tasks
- [ ] Review alert false positive rate
- [ ] Update dashboard configurations
- [ ] Check monitoring system performance
- [ ] Validate backup retention policies

### Monthly Tasks
- [ ] Review and update alert thresholds
- [ ] Audit monitoring access logs
- [ ] Update monitoring documentation
- [ ] Test disaster recovery procedures

---

**Last Updated**: $(date +%Y-%m-%d)  
**Review Schedule**: Monthly  
**Contact**: DevOps Team (devops@company.com)