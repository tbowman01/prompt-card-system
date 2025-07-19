#!/bin/bash

# Prometheus Fix and Setup Script
# ===============================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Prometheus Fix and Setup Script${NC}"
echo "=================================="

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1
    
    echo -e "${YELLOW}⏳ Waiting for $service_name to be ready...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ $service_name is ready!${NC}"
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}❌ $service_name failed to start within $((max_attempts * 2)) seconds${NC}"
    return 1
}

# Check prerequisites
echo -e "${BLUE}🔍 Checking prerequisites...${NC}"

if ! command_exists docker; then
    echo -e "${RED}❌ Docker not found. Please install Docker first.${NC}"
    exit 1
fi

if ! command_exists docker-compose; then
    echo -e "${RED}❌ Docker Compose not found. Please install Docker Compose first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Create monitoring directory structure
echo -e "${BLUE}📁 Creating monitoring directory structure...${NC}"

mkdir -p monitoring/{prometheus,grafana/{dashboards,datasources},alertmanager}
mkdir -p monitoring/grafana/dashboards/provisioning
mkdir -p monitoring/grafana/datasources/provisioning

echo -e "${GREEN}✅ Directory structure created${NC}"

# Create Prometheus configuration
echo -e "${BLUE}⚙️  Creating Prometheus configuration...${NC}"

cat > monitoring/prometheus/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'prompt-card-system'
    environment: 'development'

rule_files:
  - "alert_rules.yml"

scrape_configs:
  # Prometheus itself
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  # Prompt Card Backend
  - job_name: 'prompt-card-backend'
    static_configs:
      - targets: ['host.docker.internal:3001']
    metrics_path: '/api/metrics'
    scrape_interval: 10s
    scrape_timeout: 5s

  # Prompt Card Frontend
  - job_name: 'prompt-card-frontend'
    static_configs:
      - targets: ['host.docker.internal:3000']
    metrics_path: '/api/metrics'
    scrape_interval: 15s

  # Node Exporter (if available)
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
    scrape_interval: 15s

  # Redis
  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']
    scrape_interval: 15s

  # Docker daemon metrics (if available)
  - job_name: 'docker'
    static_configs:
      - targets: ['host.docker.internal:9323']
    scrape_interval: 30s

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
EOF

# Create alert rules
cat > monitoring/prometheus/alert_rules.yml << 'EOF'
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
          description: "Error rate is {{ $value }} requests per second"

      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 10m
        labels:
          severity: critical
        annotations:
          summary: "High response time"
          description: "95th percentile response time is {{ $value }}s"

      - alert: ServiceDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service {{ $labels.job }} is down"
          description: "Service {{ $labels.job }} has been down for more than 1 minute"

      - alert: LowSuccessRate
        expr: rate(test_executions_total{status="success"}[10m]) / rate(test_executions_total[10m]) < 0.8
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "Low test success rate"
          description: "Test success rate is {{ $value | humanizePercentage }}"

      - alert: HighMemoryUsage
        expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is above 90% for more than 5 minutes"

      - alert: HighCPUUsage
        expr: 100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage"
          description: "CPU usage is above 80% for more than 10 minutes"
EOF

# Create Grafana datasource configuration
cat > monitoring/grafana/datasources/prometheus.yml << 'EOF'
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
EOF

# Create basic Grafana dashboard
cat > monitoring/grafana/dashboards/prompt-card-overview.json << 'EOF'
{
  "annotations": {
    "list": []
  },
  "editable": true,
  "fiscalYearStartMonth": 0,
  "graphTooltip": 0,
  "id": null,
  "links": [],
  "liveNow": false,
  "panels": [
    {
      "datasource": {
        "type": "prometheus",
        "uid": "prometheus"
      },
      "fieldConfig": {
        "defaults": {
          "color": {
            "mode": "palette-classic"
          },
          "custom": {
            "axisLabel": "",
            "axisPlacement": "auto",
            "barAlignment": 0,
            "drawStyle": "line",
            "fillOpacity": 10,
            "gradientMode": "none",
            "hideFrom": {
              "legend": false,
              "tooltip": false,
              "vis": false
            },
            "lineInterpolation": "linear",
            "lineWidth": 1,
            "pointSize": 5,
            "scaleDistribution": {
              "type": "linear"
            },
            "showPoints": "never",
            "spanNulls": false,
            "stacking": {
              "group": "A",
              "mode": "none"
            },
            "thresholdsStyle": {
              "mode": "off"
            }
          },
          "mappings": [],
          "thresholds": {
            "mode": "absolute",
            "steps": [
              {
                "color": "green",
                "value": null
              },
              {
                "color": "red",
                "value": 80
              }
            ]
          },
          "unit": "reqps"
        },
        "overrides": []
      },
      "gridPos": {
        "h": 8,
        "w": 12,
        "x": 0,
        "y": 0
      },
      "id": 1,
      "options": {
        "legend": {
          "calcs": [],
          "displayMode": "list",
          "placement": "bottom"
        },
        "tooltip": {
          "mode": "single",
          "sort": "none"
        }
      },
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "prometheus"
          },
          "expr": "rate(http_requests_total[5m])",
          "interval": "",
          "legendFormat": "{{ method }} {{ status }}",
          "refId": "A"
        }
      ],
      "title": "Request Rate",
      "type": "timeseries"
    },
    {
      "datasource": {
        "type": "prometheus",
        "uid": "prometheus"
      },
      "fieldConfig": {
        "defaults": {
          "color": {
            "mode": "thresholds"
          },
          "mappings": [],
          "thresholds": {
            "mode": "absolute",
            "steps": [
              {
                "color": "green",
                "value": null
              },
              {
                "color": "red",
                "value": 80
              }
            ]
          },
          "unit": "percent"
        },
        "overrides": []
      },
      "gridPos": {
        "h": 8,
        "w": 12,
        "x": 12,
        "y": 0
      },
      "id": 2,
      "options": {
        "orientation": "auto",
        "reduceOptions": {
          "calcs": [
            "lastNotNull"
          ],
          "fields": "",
          "values": false
        },
        "showThresholdLabels": false,
        "showThresholdMarkers": true,
        "text": {}
      },
      "pluginVersion": "8.0.0",
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "prometheus"
          },
          "expr": "rate(test_executions_total{status=\"success\"}[10m]) / rate(test_executions_total[10m]) * 100",
          "interval": "",
          "legendFormat": "Success Rate",
          "refId": "A"
        }
      ],
      "title": "Test Success Rate",
      "type": "gauge"
    }
  ],
  "refresh": "5s",
  "schemaVersion": 30,
  "style": "dark",
  "tags": ["prompt-card-system"],
  "templating": {
    "list": []
  },
  "time": {
    "from": "now-1h",
    "to": "now"
  },
  "timepicker": {},
  "timezone": "",
  "title": "Prompt Card System Overview",
  "uid": "prompt-card-overview",
  "version": 1
}
EOF

# Create dashboard provisioning config
cat > monitoring/grafana/dashboards/dashboards.yml << 'EOF'
apiVersion: 1

providers:
  - name: 'default'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /etc/grafana/provisioning/dashboards
EOF

echo -e "${GREEN}✅ Configuration files created${NC}"

# Create Docker Compose override for monitoring
echo -e "${BLUE}🐳 Creating Docker Compose monitoring configuration...${NC}"

cat > docker-compose.monitoring.yml << 'EOF'
version: '3.8'

services:
  # Prometheus
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
      - '--web.enable-admin-api'
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus:/etc/prometheus
      - prometheus_data:/prometheus
    networks:
      - monitoring-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:9090/-/healthy"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Grafana
  grafana:
    image: grafana/grafana:10.0.0
    container_name: prompt-grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
      - GF_INSTALL_PLUGINS=redis-datasource
      - GF_RENDERING_SERVER_URL=http://renderer:8081/render
      - GF_RENDERING_CALLBACK_URL=http://grafana:3000/
    ports:
      - "3002:3000"
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./monitoring/grafana/datasources:/etc/grafana/provisioning/datasources
    networks:
      - monitoring-network
    restart: unless-stopped
    depends_on:
      - prometheus
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Node Exporter for system metrics
  node-exporter:
    image: prom/node-exporter:v1.6.0
    container_name: prompt-node-exporter
    command:
      - '--path.rootfs=/host'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    ports:
      - "9100:9100"
    volumes:
      - /:/host:ro,rslave
    networks:
      - monitoring-network
    restart: unless-stopped

  # cAdvisor for container metrics
  cadvisor:
    image: gcr.io/cadvisor/cadvisor:v0.47.0
    container_name: prompt-cadvisor
    ports:
      - "8080:8080"
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
      - /dev/disk/:/dev/disk:ro
    networks:
      - monitoring-network
    restart: unless-stopped
    privileged: true
    devices:
      - /dev/kmsg

  # Redis Exporter
  redis-exporter:
    image: oliver006/redis_exporter:v1.52.0
    container_name: prompt-redis-exporter
    environment:
      - REDIS_ADDR=redis://redis:6379
    ports:
      - "9121:9121"
    networks:
      - monitoring-network
    restart: unless-stopped

  # Alertmanager
  alertmanager:
    image: prom/alertmanager:v0.25.0
    container_name: prompt-alertmanager
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'
      - '--storage.path=/alertmanager'
      - '--web.external-url=http://localhost:9093'
    ports:
      - "9093:9093"
    volumes:
      - ./monitoring/alertmanager:/etc/alertmanager
      - alertmanager_data:/alertmanager
    networks:
      - monitoring-network
    restart: unless-stopped

volumes:
  prometheus_data:
  grafana_data:
  alertmanager_data:

networks:
  monitoring-network:
    driver: bridge
EOF

echo -e "${GREEN}✅ Docker Compose monitoring configuration created${NC}"

# Function to fix common Prometheus issues
fix_prometheus_issues() {
    echo -e "${BLUE}🔧 Fixing common Prometheus issues...${NC}"
    
    # Fix permissions
    echo -e "${YELLOW}📁 Fixing permissions...${NC}"
    sudo chown -R 472:472 monitoring/grafana/ 2>/dev/null || {
        echo -e "${YELLOW}⚠️  Could not change Grafana permissions (this is normal on some systems)${NC}"
    }
    
    # Create Alertmanager config if it doesn't exist
    if [ ! -f monitoring/alertmanager/alertmanager.yml ]; then
        echo -e "${YELLOW}📧 Creating Alertmanager configuration...${NC}"
        cat > monitoring/alertmanager/alertmanager.yml << 'EOF'
global:
  smtp_smarthost: 'localhost:587'
  smtp_from: 'alertmanager@prompt-card-system.local'

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'

receivers:
  - name: 'web.hook'
    webhook_configs:
    - url: 'http://localhost:5001/'
EOF
    fi
    
    # Check if ports are available
    echo -e "${YELLOW}🔍 Checking port availability...${NC}"
    
    ports=(9090 3002 9100 8080 9121 9093)
    for port in "${ports[@]}"; do
        if check_port $port; then
            echo -e "${YELLOW}⚠️  Port $port is in use. You may need to stop the service using it.${NC}"
        else
            echo -e "${GREEN}✅ Port $port is available${NC}"
        fi
    done
}

# Function to start monitoring services
start_monitoring() {
    echo -e "${BLUE}🚀 Starting monitoring services...${NC}"
    
    # Start monitoring stack
    docker-compose -f docker-compose.monitoring.yml up -d
    
    # Wait for services to be ready
    wait_for_service "http://localhost:9090/-/healthy" "Prometheus"
    wait_for_service "http://localhost:3002/api/health" "Grafana"
    
    echo -e "${GREEN}🎉 Monitoring stack started successfully!${NC}"
    echo
    echo -e "${CYAN}📊 Available Services:${NC}"
    echo -e "   • Prometheus: ${BLUE}http://localhost:9090${NC}"
    echo -e "   • Grafana: ${BLUE}http://localhost:3002${NC} (admin/admin)"
    echo -e "   • Node Exporter: ${BLUE}http://localhost:9100${NC}"
    echo -e "   • cAdvisor: ${BLUE}http://localhost:8080${NC}"
    echo -e "   • Alertmanager: ${BLUE}http://localhost:9093${NC}"
}

# Function to validate monitoring setup
validate_monitoring() {
    echo -e "${BLUE}✅ Validating monitoring setup...${NC}"
    
    # Check Prometheus targets
    echo -e "${YELLOW}🎯 Checking Prometheus targets...${NC}"
    
    if curl -s "http://localhost:9090/api/v1/targets" | grep -q '"health":"up"'; then
        echo -e "${GREEN}✅ Prometheus targets are healthy${NC}"
    else
        echo -e "${YELLOW}⚠️  Some Prometheus targets may be down${NC}"
    fi
    
    # Check Grafana datasources
    echo -e "${YELLOW}📊 Checking Grafana datasources...${NC}"
    
    if curl -s -u admin:admin "http://localhost:3002/api/datasources" | grep -q "prometheus"; then
        echo -e "${GREEN}✅ Grafana datasources configured${NC}"
    else
        echo -e "${YELLOW}⚠️  Grafana datasources may need configuration${NC}"
    fi
}

# Main execution
case "${1:-setup}" in
    "setup")
        fix_prometheus_issues
        start_monitoring
        validate_monitoring
        ;;
    "start")
        start_monitoring
        ;;
    "stop")
        echo -e "${YELLOW}🛑 Stopping monitoring services...${NC}"
        docker-compose -f docker-compose.monitoring.yml down
        ;;
    "restart")
        echo -e "${BLUE}🔄 Restarting monitoring services...${NC}"
        docker-compose -f docker-compose.monitoring.yml down
        sleep 2
        start_monitoring
        ;;
    "status")
        echo -e "${BLUE}📊 Monitoring services status:${NC}"
        docker-compose -f docker-compose.monitoring.yml ps
        ;;
    "logs")
        echo -e "${BLUE}📝 Monitoring services logs:${NC}"
        docker-compose -f docker-compose.monitoring.yml logs -f "${2:-}"
        ;;
    "validate")
        validate_monitoring
        ;;
    "clean")
        echo -e "${RED}🧹 Cleaning monitoring setup...${NC}"
        docker-compose -f docker-compose.monitoring.yml down -v
        docker system prune -f
        ;;
    "help")
        echo -e "${BLUE}Prometheus Fix Script Usage:${NC}"
        echo
        echo -e "${CYAN}Commands:${NC}"
        echo -e "  setup     - Full setup and start (default)"
        echo -e "  start     - Start monitoring services"
        echo -e "  stop      - Stop monitoring services"
        echo -e "  restart   - Restart monitoring services"
        echo -e "  status    - Show services status"
        echo -e "  logs      - Show logs (optionally specify service)"
        echo -e "  validate  - Validate monitoring setup"
        echo -e "  clean     - Clean up monitoring setup"
        echo -e "  help      - Show this help"
        echo
        echo -e "${CYAN}Examples:${NC}"
        echo -e "  ./scripts/fix-prometheus.sh setup"
        echo -e "  ./scripts/fix-prometheus.sh logs prometheus"
        echo -e "  ./scripts/fix-prometheus.sh validate"
        ;;
    *)
        echo -e "${RED}❌ Unknown command: $1${NC}"
        echo -e "Use './scripts/fix-prometheus.sh help' for usage information"
        exit 1
        ;;
esac

echo -e "${GREEN}✅ Prometheus fix script completed!${NC}"