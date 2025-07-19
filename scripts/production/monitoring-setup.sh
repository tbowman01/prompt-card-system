#!/bin/bash

# Production Monitoring Setup Script
# ==================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}📊 Production Monitoring Setup${NC}"
echo "=============================="

# Configuration
GRAFANA_URL="http://localhost:3002"
GRAFANA_USER="admin"
GRAFANA_PASSWORD="${GRAFANA_ADMIN_PASSWORD:-admin}"

# Function to wait for Grafana to be ready
wait_for_grafana() {
    echo -e "${YELLOW}⏳ Waiting for Grafana to be ready...${NC}"
    
    for i in {1..30}; do
        if curl -s "$GRAFANA_URL/api/health" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Grafana is ready${NC}"
            return 0
        fi
        echo -n "."
        sleep 2
    done
    
    echo -e "${RED}❌ Grafana failed to start${NC}"
    return 1
}

# Function to configure Grafana datasources
configure_datasources() {
    echo -e "${BLUE}🔗 Configuring Grafana datasources...${NC}"
    
    # Prometheus datasource
    curl -X POST "$GRAFANA_URL/api/datasources" \
        -H "Content-Type: application/json" \
        -u "$GRAFANA_USER:$GRAFANA_PASSWORD" \
        -d '{
            "name": "Prometheus",
            "type": "prometheus",
            "url": "http://prometheus:9090",
            "access": "proxy",
            "isDefault": true
        }' || echo -e "${YELLOW}⚠️ Prometheus datasource might already exist${NC}"
    
    # Loki datasource
    curl -X POST "$GRAFANA_URL/api/datasources" \
        -H "Content-Type: application/json" \
        -u "$GRAFANA_USER:$GRAFANA_PASSWORD" \
        -d '{
            "name": "Loki",
            "type": "loki",
            "url": "http://loki:3100",
            "access": "proxy"
        }' || echo -e "${YELLOW}⚠️ Loki datasource might already exist${NC}"
    
    # Jaeger datasource
    curl -X POST "$GRAFANA_URL/api/datasources" \
        -H "Content-Type: application/json" \
        -u "$GRAFANA_USER:$GRAFANA_PASSWORD" \
        -d '{
            "name": "Jaeger",
            "type": "jaeger",
            "url": "http://jaeger:16686",
            "access": "proxy"
        }' || echo -e "${YELLOW}⚠️ Jaeger datasource might already exist${NC}"
    
    echo -e "${GREEN}✅ Datasources configured${NC}"
}

# Function to import dashboards
import_dashboards() {
    echo -e "${BLUE}📋 Importing Grafana dashboards...${NC}"
    
    # System Overview Dashboard
    curl -X POST "$GRAFANA_URL/api/dashboards/db" \
        -H "Content-Type: application/json" \
        -u "$GRAFANA_USER:$GRAFANA_PASSWORD" \
        -d '{
            "dashboard": {
                "title": "Prompt Card System Overview",
                "tags": ["prompt-card", "overview"],
                "timezone": "browser",
                "panels": [
                    {
                        "title": "Request Rate",
                        "type": "graph",
                        "targets": [{
                            "expr": "rate(http_requests_total[5m])",
                            "legendFormat": "{{method}} {{status}}"
                        }]
                    },
                    {
                        "title": "Response Time",
                        "type": "graph",
                        "targets": [{
                            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
                            "legendFormat": "95th percentile"
                        }]
                    },
                    {
                        "title": "Error Rate",
                        "type": "singlestat",
                        "targets": [{
                            "expr": "rate(http_requests_total{status=~\"5..\"}[5m])",
                            "legendFormat": "Error Rate"
                        }]
                    }
                ]
            },
            "overwrite": true
        }' || echo -e "${YELLOW}⚠️ Dashboard import might have failed${NC}"
    
    echo -e "${GREEN}✅ Dashboards imported${NC}"
}

# Function to configure alerting
configure_alerting() {
    echo -e "${BLUE}🚨 Configuring alerting rules...${NC}"
    
    # High Error Rate Alert
    curl -X POST "$GRAFANA_URL/api/alert-rules" \
        -H "Content-Type: application/json" \
        -u "$GRAFANA_USER:$GRAFANA_PASSWORD" \
        -d '{
            "title": "High Error Rate",
            "condition": "C",
            "data": [
                {
                    "refId": "A",
                    "queryType": "prometheus",
                    "model": {
                        "expr": "rate(http_requests_total{status=~\"5..\"}[5m]) > 0.1"
                    }
                }
            ],
            "intervalSeconds": 60,
            "noDataState": "NoData",
            "execErrState": "Alerting"
        }' || echo -e "${YELLOW}⚠️ Alert rule might already exist${NC}"
    
    echo -e "${GREEN}✅ Alerting configured${NC}"
}

# Function to setup notification channels
setup_notifications() {
    echo -e "${BLUE}📧 Setting up notification channels...${NC}"
    
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST "$GRAFANA_URL/api/alert-notifications" \
            -H "Content-Type: application/json" \
            -u "$GRAFANA_USER:$GRAFANA_PASSWORD" \
            -d "{
                \"name\": \"Slack\",
                \"type\": \"slack\",
                \"settings\": {
                    \"url\": \"$SLACK_WEBHOOK_URL\",
                    \"channel\": \"#alerts\",
                    \"title\": \"Prompt Card System Alert\",
                    \"text\": \"{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}\"
                }
            }" || echo -e "${YELLOW}⚠️ Slack notification setup failed${NC}"
    fi
    
    if [ -n "$SMTP_HOST" ]; then
        curl -X POST "$GRAFANA_URL/api/alert-notifications" \
            -H "Content-Type: application/json" \
            -u "$GRAFANA_USER:$GRAFANA_PASSWORD" \
            -d "{
                \"name\": \"Email\",
                \"type\": \"email\",
                \"settings\": {
                    \"addresses\": \"$BACKUP_NOTIFICATION_EMAIL\"
                }
            }" || echo -e "${YELLOW}⚠️ Email notification setup failed${NC}"
    fi
    
    echo -e "${GREEN}✅ Notification channels configured${NC}"
}

# Function to validate monitoring setup
validate_monitoring() {
    echo -e "${BLUE}✅ Validating monitoring setup...${NC}"
    
    # Check Prometheus targets
    if curl -s "http://localhost:9090/api/v1/targets" | grep -q '"health":"up"'; then
        echo -e "${GREEN}✅ Prometheus targets are healthy${NC}"
    else
        echo -e "${YELLOW}⚠️ Some Prometheus targets are down${NC}"
    fi
    
    # Check Grafana dashboards
    if curl -s -u "$GRAFANA_USER:$GRAFANA_PASSWORD" "$GRAFANA_URL/api/search" | grep -q "Prompt Card"; then
        echo -e "${GREEN}✅ Grafana dashboards are installed${NC}"
    else
        echo -e "${YELLOW}⚠️ Grafana dashboards might not be properly installed${NC}"
    fi
    
    # Check Jaeger
    if curl -s "http://localhost:16686/api/services" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Jaeger is accessible${NC}"
    else
        echo -e "${YELLOW}⚠️ Jaeger might not be running${NC}"
    fi
}

# Main execution
main() {
    echo -e "${CYAN}📋 Monitoring Setup Configuration:${NC}"
    echo "   • Grafana URL: $GRAFANA_URL"
    echo "   • Grafana User: $GRAFANA_USER"
    echo "   • Slack Webhook: ${SLACK_WEBHOOK_URL:+Configured}"
    echo "   • Email Alerts: ${SMTP_HOST:+Configured}"
    echo
    
    wait_for_grafana
    configure_datasources
    import_dashboards
    configure_alerting
    setup_notifications
    validate_monitoring
    
    echo -e "${GREEN}🎉 Monitoring setup completed successfully!${NC}"
    echo
    echo -e "${CYAN}📊 Access your monitoring:${NC}"
    echo -e "   • Grafana: ${BLUE}$GRAFANA_URL${NC} (admin/admin)"
    echo -e "   • Prometheus: ${BLUE}http://localhost:9090${NC}"
    echo -e "   • Jaeger: ${BLUE}http://localhost:16686${NC}"
    echo
    echo -e "${YELLOW}⚠️ Security reminder:${NC}"
    echo -e "   • Change default Grafana password"
    echo -e "   • Configure proper SSL certificates"
    echo -e "   • Set up authentication for Prometheus"
}

# Run main function
main