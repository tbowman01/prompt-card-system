# Prometheus & Grafana Integration

This guide covers the complete setup and configuration of Prometheus and Grafana for monitoring the Prompt Card System.

## Overview

The monitoring stack includes:
- **Prometheus**: Metrics collection and alerting
- **Grafana**: Data visualization and dashboards
- **Node Exporter**: System metrics collection
- **cAdvisor**: Container metrics collection
- **Redis Exporter**: Redis metrics collection
- **Alertmanager**: Alert routing and notification

## Architecture

```mermaid
graph TB
    subgraph "Application Services"
        BE[Backend API<br/>:3001/api/metrics]
        FE[Frontend<br/>:3000/api/metrics]
    end
    
    subgraph "System Monitoring"
        NE[Node Exporter<br/>:9100]
        CA[cAdvisor<br/>:8080]
        RE[Redis Exporter<br/>:9121]
    end
    
    subgraph "Monitoring Stack"
        PROM[Prometheus<br/>:9090]
        GRAF[Grafana<br/>:3002]
        AM[Alertmanager<br/>:9093]
    end
    
    BE --> PROM
    FE --> PROM
    NE --> PROM
    CA --> PROM
    RE --> PROM
    
    PROM --> GRAF
    PROM --> AM
    
    AM --> SLACK[Slack/Discord]
    AM --> EMAIL[Email Alerts]
```

## Quick Start

### 1. Start Monitoring Stack

```bash
# Start all monitoring services
docker-compose -f docker-compose.monitoring.yml up -d

# Check service status
docker-compose -f docker-compose.monitoring.yml ps
```

### 2. Access Dashboards

- **Grafana**: http://localhost:3002 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Alertmanager**: http://localhost:9093

## Configuration Files

### Prometheus Configuration

Location: `/monitoring/prometheus/prometheus.yml`

Key features:
- **Scrape Interval**: 15 seconds for most services
- **Retention**: 90 days of metrics data
- **Service Discovery**: Auto-discovery of services
- **Alert Rules**: Comprehensive alerting rules

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'prompt-card-system'
    environment: 'development'

scrape_configs:
  # Application Services
  - job_name: 'prompt-card-backend'
    static_configs:
      - targets: ['host.docker.internal:3001']
    metrics_path: '/api/metrics'
    scrape_interval: 10s

  - job_name: 'prompt-card-frontend'
    static_configs:
      - targets: ['host.docker.internal:3000']
    metrics_path: '/api/metrics'
    scrape_interval: 15s

  # Infrastructure Services
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']

  # CI/CD Monitoring
  - job_name: 'github-actions-metrics'
    static_configs:
      - targets: ['host.docker.internal:3001']
    metrics_path: '/api/ci-cd/metrics'
    scrape_interval: 30s
```

### Grafana Datasource Configuration

Location: `/monitoring/grafana/datasources/prometheus.yml`

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
    jsonData:
      httpMethod: POST
      manageAlerts: true
      prometheusType: Prometheus
      prometheusVersion: 2.45.0
```

## Available Metrics

### Application Metrics

#### Backend API Metrics
- `http_requests_total`: HTTP request count by method, route, status
- `http_request_duration_seconds`: Request latency histogram
- `ollama_requests_total`: LLM API request count
- `ollama_request_duration_seconds`: LLM request latency
- `database_queries_total`: Database query count
- `database_query_duration_seconds`: Database query latency
- `active_websocket_connections`: Current WebSocket connections
- `prompt_card_operations_total`: Prompt card operations count

#### System Metrics
- `node_cpu_seconds_total`: CPU usage by core
- `node_memory_MemAvailable_bytes`: Available memory
- `node_filesystem_avail_bytes`: Available disk space
- `node_load1`: System load average (1 minute)

#### Container Metrics
- `container_cpu_usage_seconds_total`: Container CPU usage
- `container_memory_working_set_bytes`: Container memory usage
- `container_network_receive_bytes_total`: Network ingress
- `container_network_transmit_bytes_total`: Network egress

#### Redis Metrics
- `redis_connected_clients`: Connected clients
- `redis_used_memory_bytes`: Memory usage
- `redis_commands_processed_total`: Commands processed
- `redis_keyspace_hits_total`: Cache hits
- `redis_keyspace_misses_total`: Cache misses

### CI/CD Metrics

#### Pipeline Metrics
- `github_workflow_runs_total`: Workflow execution count
- `github_workflow_duration_seconds`: Workflow execution time
- `github_workflow_success_rate`: Success rate percentage
- `build_duration_seconds`: Build time by stage
- `test_execution_time_seconds`: Test execution time
- `deployment_frequency`: Deployment frequency
- `lead_time_seconds`: Lead time for changes

## Dashboards

### 1. System Overview Dashboard
- System health indicators
- Resource utilization (CPU, Memory, Disk)
- Network traffic
- Container status

### 2. Application Performance Dashboard  
- API response times
- Request throughput
- Error rates
- Database performance
- Cache hit rates

### 3. CI/CD Pipeline Dashboard
- Build success rates
- Deployment frequency
- Test metrics
- Pipeline duration trends
- Failure analysis

### 4. Custom Business Metrics Dashboard
- Prompt card usage statistics
- User activity patterns
- Feature adoption rates
- Performance trends

## Alert Rules

Location: `/monitoring/prometheus/alert_rules.yml`

### Critical Alerts

```yaml
groups:
  - name: critical_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }}% for the last 5 minutes"

      - alert: DatabaseDown
        expr: up{job="database"} == 0
        for: 30s
        labels:
          severity: critical
        annotations:
          summary: "Database is down"
          description: "Database has been down for more than 30 seconds"

      - alert: HighMemoryUsage
        expr: node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes < 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is above 90%"
```

### Application-Specific Alerts

```yaml
  - name: application_alerts
    rules:
      - alert: SlowAPIResponse
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Slow API response times"
          description: "95th percentile response time is {{ $value }}s"

      - alert: LowCacheHitRate
        expr: rate(redis_keyspace_hits_total[5m]) / (rate(redis_keyspace_hits_total[5m]) + rate(redis_keyspace_misses_total[5m])) < 0.8
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Low cache hit rate"
          description: "Cache hit rate is {{ $value }}%"
```

## Alertmanager Configuration

Location: `/monitoring/alertmanager/alertmanager.yml`

```yaml
global:
  smtp_smarthost: 'localhost:587'
  smtp_from: 'alerts@promptcard.local'

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'
  routes:
    - match:
        severity: critical
      receiver: 'critical-alerts'
    - match:
        severity: warning
      receiver: 'warning-alerts'

receivers:
  - name: 'web.hook'
    webhook_configs:
      - url: 'http://127.0.0.1:5001/'

  - name: 'critical-alerts'
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#alerts-critical'
        title: 'Critical Alert: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'

  - name: 'warning-alerts'
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#alerts-warning'
        title: 'Warning Alert: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
```

## Grafana Dashboard Import

### Pre-built Dashboard IDs
- **Node Exporter Full**: 1860
- **Docker and OS Metrics**: 179
- **Redis Dashboard**: 763
- **Express.js Application**: 11159

### Custom Dashboard JSON
Available in `/monitoring/grafana/dashboards/`:
- `prompt-card-overview.json`: Main application dashboard
- `cicd-pipeline-monitoring.json`: CI/CD pipeline metrics
- `advanced-performance-dashboard.json`: Detailed performance metrics

## Environment Variables

### Required Environment Variables

```bash
# Monitoring Configuration
PROMETHEUS_RETENTION_TIME=90d
GRAFANA_ADMIN_PASSWORD=secure_password_here
ALERT_WEBHOOK_URL=https://hooks.slack.com/your/webhook/url

# Metrics Endpoints
METRICS_ENABLED=true
METRICS_PATH=/api/metrics
HEALTH_CHECK_INTERVAL=30s

# Redis Configuration for Metrics
REDIS_METRICS_ENABLED=true
REDIS_EXPORTER_ENABLED=true

# CI/CD Monitoring
GITHUB_TOKEN=your_github_token
GITHUB_WEBHOOK_SECRET=your_webhook_secret
```

### Optional Configuration

```bash
# Custom Metrics
CUSTOM_METRICS_ENABLED=true
BUSINESS_METRICS_ENABLED=true

# External Integrations
SENTRY_DSN=your_sentry_dsn
JAEGER_ENDPOINT=http://jaeger:14268/api/traces

# Performance Monitoring
PERFORMANCE_MONITORING_ENABLED=true
SLOW_QUERY_THRESHOLD=1000
```

## Deployment

### Docker Compose

```bash
# Start monitoring stack
docker-compose -f docker-compose.monitoring.yml up -d

# View logs
docker-compose -f docker-compose.monitoring.yml logs -f prometheus
docker-compose -f docker-compose.monitoring.yml logs -f grafana

# Restart specific service
docker-compose -f docker-compose.monitoring.yml restart prometheus
```

### Health Checks

```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check Grafana health
curl http://localhost:3002/api/health

# Validate Alertmanager configuration
curl http://localhost:9093/-/healthy
```

## Troubleshooting

### Common Issues

#### 1. Prometheus Can't Scrape Targets
- Check network connectivity between containers
- Verify service endpoints are accessible
- Check firewall rules and port configurations

#### 2. Grafana Dashboard Not Loading Data
- Verify Prometheus datasource configuration
- Check query syntax in dashboard panels
- Confirm metric names and labels

#### 3. Alerts Not Firing
- Validate alert rule expressions
- Check Alertmanager routing configuration
- Verify webhook URLs and credentials

#### 4. High Memory Usage
- Adjust Prometheus retention settings
- Optimize query performance
- Consider using recording rules for complex queries

### Debugging Commands

```bash
# Check Prometheus configuration
docker exec prometheus-container promtool check config /etc/prometheus/prometheus.yml

# Test alert rules
docker exec prometheus-container promtool check rules /etc/prometheus/alert_rules.yml

# Query Prometheus directly
curl 'http://localhost:9090/api/v1/query?query=up'

# Check Grafana datasource
curl -u admin:admin http://localhost:3002/api/datasources
```

### Log Locations

- **Prometheus Logs**: `docker logs prometheus-container`
- **Grafana Logs**: `docker logs grafana-container`
- **Alertmanager Logs**: `docker logs alertmanager-container`

## Performance Optimization

### Prometheus Optimization

```yaml
# prometheus.yml optimizations
global:
  scrape_interval: 15s          # Balance between accuracy and resource usage
  evaluation_interval: 15s      # How often to evaluate rules
  
# Storage optimization
--storage.tsdb.retention.time=90d    # Adjust based on storage capacity
--storage.tsdb.retention.size=100GB  # Set maximum storage size
--storage.tsdb.min-block-duration=2h # Reduce block size for better query performance
```

### Grafana Optimization

```ini
# grafana.ini optimizations
[database]
max_idle_conn = 2
max_open_conn = 0
conn_max_lifetime = 14400

[caching]
enabled = true
ttl = 300
```

## Backup and Recovery

### Prometheus Data
```bash
# Backup Prometheus data
docker run --rm -v prometheus_data:/data -v $(pwd):/backup alpine tar czf /backup/prometheus-backup.tar.gz -C /data .

# Restore Prometheus data
docker run --rm -v prometheus_data:/data -v $(pwd):/backup alpine tar xzf /backup/prometheus-backup.tar.gz -C /data
```

### Grafana Configuration
```bash
# Backup Grafana configuration
docker exec grafana-container grafana-cli admin export-dashboard > dashboards-backup.json

# Import Grafana dashboards
curl -X POST http://admin:admin@localhost:3002/api/dashboards/db -H "Content-Type: application/json" -d @dashboard.json
```

## Integration with External Services

### Slack Integration
```yaml
# Alertmanager Slack configuration
slack_configs:
  - api_url: '${SLACK_WEBHOOK_URL}'
    channel: '#monitoring'
    username: 'Prometheus'
    icon_emoji: ':warning:'
    title: 'Alert: {{ .GroupLabels.alertname }}'
    text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
```

### Email Notifications
```yaml
# Alertmanager email configuration
email_configs:
  - to: 'alerts@company.com'
    from: 'prometheus@company.com'
    smarthost: 'smtp.company.com:587'
    auth_username: 'prometheus@company.com'
    auth_password: '${EMAIL_PASSWORD}'
    subject: 'Alert: {{ .GroupLabels.alertname }}'
    body: |
      {{ range .Alerts }}
      Alert: {{ .Annotations.summary }}
      Description: {{ .Annotations.description }}
      {{ end }}
```

For more advanced configurations and custom metrics, see our [Custom Metrics Guide](./custom-metrics.md).