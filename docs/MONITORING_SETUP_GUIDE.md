# Advanced Monitoring Setup Guide

## 📊 Overview

This guide provides complete setup instructions for the advanced monitoring infrastructure, including Prometheus metrics, Grafana dashboards, distributed tracing, and predictive analytics.

## 🚀 Quick Start

### Prerequisites
```bash
# System requirements
- Node.js 20+
- Docker & Docker Compose
- PostgreSQL or SQLite
- Redis
- 8GB+ RAM recommended
```

### Environment Configuration
```bash
# Add to .env file
ENABLE_MONITORING=true
ENABLE_ADVANCED_ANALYTICS=true
PROMETHEUS_PORT=9090
GRAFANA_PORT=3000
JAEGER_PORT=16686
INFLUXDB_PORT=8086

# Monitoring secrets
METRICS_ENCRYPTION_KEY=your_secure_32_char_key_here
AUDIT_SECRET=your_blockchain_audit_secret
GRAFANA_ADMIN_PASSWORD=your_secure_password
```

## 🐳 Docker Setup

### Complete Monitoring Stack
```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  # Time Series Database
  influxdb:
    image: influxdb:2.7
    container_name: prompt-influxdb
    environment:
      - INFLUXDB_DB=monitoring
      - INFLUXDB_ADMIN_USER=admin
      - INFLUXDB_ADMIN_PASSWORD=admin123
      - INFLUXDB_HTTP_AUTH_ENABLED=true
    volumes:
      - influxdb_data:/var/lib/influxdb2
      - ./monitoring/influxdb.conf:/etc/influxdb2/influxdb.conf
    ports:
      - "8086:8086"
    networks:
      - monitoring

  # Metrics Collection
  prometheus:
    image: prom/prometheus:v2.45.0
    container_name: prompt-prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=90d'
      - '--web.enable-lifecycle'
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    networks:
      - monitoring

  # Visualization & Dashboards
  grafana:
    image: grafana/grafana:10.0.0
    container_name: prompt-grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}
      - GF_USERS_ALLOW_SIGN_UP=false
      - GF_INSTALL_PLUGINS=redis-datasource,influxdb-datasource
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./monitoring/grafana/datasources:/etc/grafana/provisioning/datasources
    ports:
      - "3000:3000"
    networks:
      - monitoring
    depends_on:
      - prometheus
      - influxdb

  # Distributed Tracing
  jaeger:
    image: jaegertracing/all-in-one:1.47
    container_name: prompt-jaeger
    environment:
      - COLLECTOR_OTLP_ENABLED=true
      - SPAN_STORAGE_TYPE=elasticsearch
    ports:
      - "16686:16686"  # UI
      - "14268:14268"  # HTTP spans
      - "14250:14250"  # gRPC spans
    networks:
      - monitoring

  # Log Aggregation
  elasticsearch:
    image: elasticsearch:8.11.0
    container_name: prompt-elasticsearch
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    ports:
      - "9200:9200"
    networks:
      - monitoring

  # Log Shipping
  filebeat:
    image: elastic/filebeat:8.11.0
    container_name: prompt-filebeat
    user: root
    volumes:
      - ./monitoring/filebeat.yml:/usr/share/filebeat/filebeat.yml:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - monitoring
    depends_on:
      - elasticsearch

  # Stream Processing
  kafka:
    image: confluentinc/cp-kafka:7.4.0
    container_name: prompt-kafka
    environment:
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
    ports:
      - "9092:9092"
    networks:
      - monitoring
    depends_on:
      - zookeeper

  zookeeper:
    image: confluentinc/cp-zookeeper:7.4.0
    container_name: prompt-zookeeper
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    networks:
      - monitoring

  # ML Pipeline
  mlflow:
    image: python:3.9
    container_name: prompt-mlflow
    command: >
      bash -c "pip install mlflow boto3 && 
               mlflow server --host 0.0.0.0 --port 5000 --default-artifact-root ./artifacts"
    ports:
      - "5000:5000"
    volumes:
      - mlflow_data:/app/artifacts
    networks:
      - monitoring

  # Redis for caching
  redis:
    image: redis:7-alpine
    container_name: prompt-redis
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    networks:
      - monitoring

volumes:
  influxdb_data:
  prometheus_data:
  grafana_data:
  elasticsearch_data:
  mlflow_data:
  redis_data:

networks:
  monitoring:
    driver: bridge
```

### Start Monitoring Stack
```bash
# Start all monitoring services
docker-compose -f docker-compose.monitoring.yml up -d

# Verify services are running
docker-compose -f docker-compose.monitoring.yml ps

# View logs
docker-compose -f docker-compose.monitoring.yml logs -f grafana
```

## ⚙️ Configuration Files

### Prometheus Configuration
```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

scrape_configs:
  - job_name: 'prompt-card-backend'
    static_configs:
      - targets: ['host.docker.internal:3001']
    metrics_path: '/api/metrics'
    scrape_interval: 10s

  - job_name: 'prompt-card-frontend'
    static_configs:
      - targets: ['host.docker.internal:3000']
    metrics_path: '/api/metrics'

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['host.docker.internal:9100']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

### Grafana Datasources
```yaml
# monitoring/grafana/datasources/datasources.yml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true

  - name: InfluxDB
    type: influxdb
    access: proxy
    url: http://influxdb:8086
    database: monitoring
    user: admin
    password: admin123

  - name: Elasticsearch
    type: elasticsearch
    access: proxy
    url: http://elasticsearch:9200
    index: logs-*
    timeField: "@timestamp"
```

### Alert Rules
```yaml
# monitoring/alert_rules.yml
groups:
  - name: prompt_card_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors per second"

      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 10m
        labels:
          severity: critical
        annotations:
          summary: "High response time"
          description: "95th percentile response time is {{ $value }}s"

      - alert: LowSuccessRate
        expr: rate(test_executions_total{status="success"}[10m]) / rate(test_executions_total[10m]) < 0.8
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "Low test success rate"
          description: "Test success rate is {{ $value | humanizePercentage }}"
```

## 📊 Grafana Dashboards

### Main Application Dashboard
```json
{
  "dashboard": {
    "title": "Prompt Card System - Overview",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{ method }} {{ route }}"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          },
          {
            "expr": "histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "50th percentile"
          }
        ]
      },
      {
        "title": "Test Execution Success Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(test_executions_total{status=\"success\"}[10m]) / rate(test_executions_total[10m])",
            "legendFormat": "Success Rate"
          }
        ]
      },
      {
        "title": "Active Users",
        "type": "stat",
        "targets": [
          {
            "expr": "active_websocket_connections",
            "legendFormat": "Connected Users"
          }
        ]
      }
    ]
  }
}
```

### Business Metrics Dashboard
```json
{
  "dashboard": {
    "title": "Business KPIs",
    "panels": [
      {
        "title": "Prompt Effectiveness Score",
        "type": "graph",
        "targets": [
          {
            "expr": "avg(prompt_effectiveness_score)",
            "legendFormat": "Average Effectiveness"
          }
        ]
      },
      {
        "title": "Model Performance Comparison",
        "type": "bargauge",
        "targets": [
          {
            "expr": "avg by (model) (model_performance_comparison)",
            "legendFormat": "{{ model }}"
          }
        ]
      },
      {
        "title": "Resource Efficiency",
        "type": "graph",
        "targets": [
          {
            "expr": "resource_efficiency_ratio",
            "legendFormat": "{{ resource_type }}"
          }
        ]
      }
    ]
  }
}
```

## 🔧 Application Integration

### Express.js Metrics Setup
```typescript
// backend/src/middleware/metrics.ts
import prometheus from 'prom-client';
import { Request, Response, NextFunction } from 'express';

// Create metrics registry
const register = new prometheus.Registry();

// Default metrics (CPU, memory, etc.)
prometheus.collectDefaultMetrics({ register });

// Custom business metrics
const promptEffectiveness = new prometheus.Histogram({
  name: 'prompt_effectiveness_score',
  help: 'Effectiveness score of prompt executions',
  labelNames: ['model', 'prompt_type', 'user_category'],
  buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
  registers: [register]
});

const modelPerformance = new prometheus.Gauge({
  name: 'model_performance_comparison',
  help: 'Comparative performance metrics across models',
  labelNames: ['model', 'metric_type', 'benchmark'],
  registers: [register]
});

const resourceEfficiency = new prometheus.Gauge({
  name: 'resource_efficiency_ratio',
  help: 'Resource efficiency ratio for cost optimization',
  labelNames: ['resource_type', 'service', 'optimization_target'],
  registers: [register]
});

// HTTP request metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register]
});

const httpRequestsTotal = new prometheus.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

// Middleware to collect HTTP metrics
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    
    httpRequestDuration
      .labels(req.method, route, res.statusCode.toString())
      .observe(duration);
      
    httpRequestsTotal
      .labels(req.method, route, res.statusCode.toString())
      .inc();
  });
  
  next();
};

// Metrics endpoint
export const metricsHandler = async (req: Request, res: Response) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
};

// Export metrics for use in other modules
export {
  register,
  promptEffectiveness,
  modelPerformance,
  resourceEfficiency,
  httpRequestDuration,
  httpRequestsTotal
};
```

### Business Metrics Recording
```typescript
// backend/src/services/MetricsCollector.ts
import { promptEffectiveness, modelPerformance, resourceEfficiency } from '../middleware/metrics';

export class MetricsCollector {
  static recordPromptEffectiveness(
    score: number,
    model: string,
    promptType: string,
    userCategory: string
  ) {
    promptEffectiveness
      .labels(model, promptType, userCategory)
      .observe(score);
  }

  static recordModelPerformance(
    performanceScore: number,
    model: string,
    metricType: string,
    benchmark: string
  ) {
    modelPerformance
      .labels(model, metricType, benchmark)
      .set(performanceScore);
  }

  static recordResourceEfficiency(
    efficiencyRatio: number,
    resourceType: string,
    service: string,
    optimizationTarget: string
  ) {
    resourceEfficiency
      .labels(resourceType, service, optimizationTarget)
      .set(efficiencyRatio);
  }
}
```

## 🎯 Distributed Tracing

### OpenTelemetry Setup
```typescript
// backend/src/tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';

const jaegerExporter = new JaegerExporter({
  endpoint: 'http://localhost:14268/api/traces',
});

const sdk = new NodeSDK({
  traceExporter: jaegerExporter,
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
```

### Custom Tracing
```typescript
// backend/src/services/tracing/TracingService.ts
import { trace, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('prompt-card-system');

export class TracingService {
  static async traceFunction<T>(
    spanName: string,
    fn: () => Promise<T>,
    attributes?: Record<string, string>
  ): Promise<T> {
    const span = tracer.startSpan(spanName, { attributes });
    
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message
      });
      throw error;
    } finally {
      span.end();
    }
  }

  static createChildSpan(
    parentSpan: any,
    spanName: string,
    attributes?: Record<string, string>
  ) {
    return tracer.startSpan(spanName, { parent: parentSpan, attributes });
  }
}
```

## 📈 Alerting Setup

### Alertmanager Configuration
```yaml
# monitoring/alertmanager.yml
global:
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@yourcompany.com'

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'

receivers:
  - name: 'web.hook'
    email_configs:
      - to: 'admin@yourcompany.com'
        subject: 'Prompt Card System Alert'
        body: |
          {{ range .Alerts }}
          Alert: {{ .Annotations.summary }}
          Description: {{ .Annotations.description }}
          {{ end }}
    
    slack_configs:
      - api_url: 'YOUR_SLACK_WEBHOOK_URL'
        channel: '#alerts'
        title: 'Prompt Card System Alert'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'dev', 'instance']
```

### Slack Integration
```typescript
// backend/src/services/alerting/SlackNotifier.ts
import axios from 'axios';

export class SlackNotifier {
  private webhookUrl: string;

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
  }

  async sendAlert(alert: {
    title: string;
    message: string;
    severity: 'info' | 'warning' | 'critical';
    metadata?: Record<string, any>;
  }) {
    const color = {
      info: 'good',
      warning: 'warning',
      critical: 'danger'
    }[alert.severity];

    await axios.post(this.webhookUrl, {
      attachments: [{
        color,
        title: alert.title,
        text: alert.message,
        fields: Object.entries(alert.metadata || {}).map(([key, value]) => ({
          title: key,
          value: String(value),
          short: true
        })),
        timestamp: Math.floor(Date.now() / 1000)
      }]
    });
  }
}
```

## 🧪 Health Checks

### Advanced Health Monitoring
```typescript
// backend/src/routes/health-monitoring.ts
import { Router } from 'express';
import { HealthOrchestrator } from '../services/health/HealthOrchestrator';

const router = Router();
const healthOrchestrator = new HealthOrchestrator();

// Comprehensive health check
router.get('/health/comprehensive', async (req, res) => {
  const health = await healthOrchestrator.getComprehensiveHealth();
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Individual service health
router.get('/health/:service', async (req, res) => {
  const { service } = req.params;
  const health = await healthOrchestrator.getServiceHealth(service);
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Kubernetes readiness probe
router.get('/ready', async (req, res) => {
  const isReady = await healthOrchestrator.isReady();
  res.status(isReady ? 200 : 503).json({ ready: isReady });
});

// Kubernetes liveness probe
router.get('/live', async (req, res) => {
  const isLive = await healthOrchestrator.isLive();
  res.status(isLive ? 200 : 503).json({ live: isLive });
});

export default router;
```

## 🔍 Troubleshooting

### Common Issues

#### Metrics Not Appearing
```bash
# Check if metrics endpoint is accessible
curl http://localhost:3001/api/metrics

# Verify Prometheus can scrape metrics
docker exec prompt-prometheus curl -s http://host.docker.internal:3001/api/metrics

# Check Prometheus targets
open http://localhost:9090/targets
```

#### Grafana Connection Issues
```bash
# Check Grafana logs
docker logs prompt-grafana

# Verify datasource connectivity
curl -u admin:password http://localhost:3000/api/datasources/proxy/1/api/v1/label/__name__/values
```

#### Jaeger Traces Not Showing
```bash
# Check Jaeger collector
curl http://localhost:14268/api/traces

# Verify OpenTelemetry instrumentation
export OTEL_LOG_LEVEL=debug
npm start
```

### Performance Optimization
```typescript
// Optimize metrics collection
const metricsConfig = {
  // Reduce metric cardinality
  maxLabels: 10,
  
  // Sample high-frequency metrics
  sampleRate: 0.1,
  
  // Use approximate histograms for better performance
  useApproximateHistograms: true,
  
  // Batch metric updates
  batchSize: 100,
  flushInterval: 5000
};
```

## 📚 Best Practices

### Metric Naming
- Use snake_case for metric names
- Include units in metric names (e.g., `_seconds`, `_bytes`)
- Keep label cardinality low
- Use descriptive help text

### Dashboard Design
- Group related metrics together
- Use consistent time ranges
- Add appropriate thresholds and targets
- Include documentation panels

### Alerting Guidelines
- Define clear SLIs and SLOs
- Avoid alert fatigue with proper thresholds
- Include runbook links in alert descriptions
- Test alert routing regularly

---

**The Advanced Monitoring Setup provides complete observability into your prompt card system, enabling proactive performance management and rapid issue resolution.**