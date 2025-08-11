# Alerting Procedures

## 🚨 Overview

This document outlines the alerting procedures for the Prompt Card System, including alert configuration, escalation processes, and response protocols for different types of incidents.

## 📊 Alert Categories

### System Health Alerts

#### Service Down Alerts
**Alert**: `ServiceDown`  
**Condition**: `up == 0`  
**Severity**: Critical  
**Response Time**: Immediate (< 5 minutes)

**Immediate Actions**:
1. Check service status: `docker ps | grep prompt-`
2. Review service logs: `docker logs <container_name>`
3. Attempt service restart: `docker restart <container_name>`
4. Escalate if restart fails within 5 minutes

**Escalation Path**:
1. **Level 1**: On-call engineer
2. **Level 2**: Senior DevOps engineer (after 15 minutes)
3. **Level 3**: Engineering manager (after 30 minutes)

#### High Error Rate
**Alert**: `HighErrorRate`  
**Condition**: `rate(http_requests_total{status=~"5.."}[5m]) > 0.1`  
**Severity**: Warning  
**Response Time**: 15 minutes

**Investigation Steps**:
```bash
# Check error rate by endpoint
curl -s http://localhost:9090/api/v1/query?query='rate(http_requests_total{status=~"5.."}[5m])' | jq

# Review application logs
docker logs prompt-backend --since 10m | grep ERROR

# Check database connectivity
docker exec prompt-backend npm run health-check
```

#### High Response Time
**Alert**: `HighResponseTime`  
**Condition**: `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2`  
**Severity**: Warning  
**Response Time**: 30 minutes

**Investigation Steps**:
1. **Check system resources**: CPU, memory, disk I/O
2. **Review slow queries**: Database query performance
3. **Check external dependencies**: Third-party service status
4. **Analyze traffic patterns**: Unusual load or traffic spikes

### Resource Alerts

#### High Memory Usage
**Alert**: `HighMemoryUsage`  
**Condition**: `(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.9`  
**Severity**: Warning  
**Response Time**: 15 minutes

**Response Procedure**:
```bash
# Check memory usage by process
docker exec prompt-backend ps aux --sort=-%mem | head -10

# Check for memory leaks
docker exec prompt-backend node --inspect=0.0.0.0:9229 src/server.js

# Consider scaling if sustained high usage
docker-compose -f docker-compose.prod.yml scale backend=2
```

#### High CPU Usage  
**Alert**: `HighCPUUsage`  
**Condition**: `100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80`  
**Severity**: Warning  
**Response Time**: 15 minutes

**Response Procedure**:
```bash
# Identify CPU-intensive processes
docker exec prompt-backend top -o %CPU

# Check for runaway processes
docker exec prompt-backend ps aux --sort=-%cpu | head -10

# Scale horizontally if needed
docker-compose -f docker-compose.prod.yml scale backend=2
```

### Application-Specific Alerts

#### Database Connection Issues
**Alert**: `DatabaseConnectionFailure`  
**Condition**: `db_connections_active / db_connections_max > 0.9`  
**Severity**: Critical  
**Response Time**: Immediate

**Response Procedure**:
```bash
# Check database status
docker exec prompt-postgres pg_isready

# Check active connections
docker exec prompt-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT count(*) FROM pg_stat_activity;"

# Kill long-running queries if necessary
docker exec prompt-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND query_start < now() - interval '10 minutes';"
```

#### Cache Performance Degradation
**Alert**: `LowCacheHitRate`  
**Condition**: `redis_cache_hit_rate < 0.8`  
**Severity**: Warning  
**Response Time**: 30 minutes

**Response Procedure**:
```bash
# Check Redis status
docker exec prompt-redis redis-cli ping

# Check memory usage
docker exec prompt-redis redis-cli info memory

# Check cache statistics
docker exec prompt-redis redis-cli info stats
```

## 🔄 CI/CD Alerting

### Pipeline Failure Alerts

#### CI Pipeline Failure
**Alert**: `CIPipelineFailure`  
**Condition**: `cicd_pipeline_status{status="failed"} > 0`  
**Severity**: Critical  
**Response Time**: Immediate

**Response Procedure**:
1. **Check GitHub Actions**: Review failed workflow details
2. **Identify failure point**: Build, test, or deployment stage
3. **Review logs**: Examine error messages and stack traces
4. **Quick fixes**: Address common issues (dependencies, environment)
5. **Escalate**: If not resolved within 30 minutes

#### Deployment Failure
**Alert**: `DeploymentFailure`  
**Condition**: `cicd_deployment_status{status="failed"} > 0`  
**Severity**: Critical  
**Response Time**: Immediate

**Response Procedure**:
```bash
# Check deployment status
kubectl get deployments -n production

# Review deployment logs
kubectl logs -n production deployment/prompt-backend --tail=100

# Rollback if necessary
kubectl rollout undo deployment/prompt-backend -n production

# Verify rollback
kubectl rollout status deployment/prompt-backend -n production
```

### Performance Alerts

#### Slow Build Performance
**Alert**: `SlowBuildPerformance`  
**Condition**: `cicd_build_duration_seconds > 1800`  
**Severity**: Warning  
**Response Time**: 1 hour

**Investigation Steps**:
1. **Check build cache**: Verify cache hit rates
2. **Review dependencies**: Look for unnecessary installations
3. **Optimize Dockerfile**: Multi-stage builds, layer optimization
4. **Consider parallel builds**: Split tests and builds

#### High Test Execution Time
**Alert**: `HighTestExecutionTime`  
**Condition**: `cicd_test_duration_seconds > 600`  
**Severity**: Warning  
**Response Time**: 1 hour

**Response Procedure**:
```bash
# Identify slow tests
npm test -- --verbose --coverage=false

# Check test parallelization
npm run test:parallel

# Review test database setup
npm run test:db:reset
```

## 📧 Notification Channels

### Slack Integration

#### Channel Configuration
- **#alerts-critical**: P1 incidents, immediate response required
- **#alerts-warning**: P2-P3 incidents, business hours response
- **#alerts-info**: P4 incidents, informational alerts

#### Message Format
```json
{
  "text": "🚨 {{ .GroupLabels.alertname }}",
  "attachments": [{
    "color": "{{ if eq .Status "firing" }}danger{{ else }}good{{ end }}",
    "title": "{{ .GroupLabels.alertname }}",
    "text": "{{ range .Alerts }}{{ .Annotations.summary }}\n{{ .Annotations.description }}{{ end }}",
    "fields": [{
      "title": "Severity",
      "value": "{{ .GroupLabels.severity }}",
      "short": true
    }, {
      "title": "Instance",
      "value": "{{ .GroupLabels.instance }}",
      "short": true
    }]
  }]
}
```

### Email Notifications

#### Distribution Lists
- **critical-alerts@company.com**: Immediate escalation (P1)
- **ops-team@company.com**: Operations team (P2-P3)
- **dev-team@company.com**: Development team notifications

#### Email Templates
```yaml
# alertmanager.yml
templates:
  - '/etc/alertmanager/templates/*.tmpl'

receivers:
- name: 'email-critical'
  email_configs:
  - to: 'critical-alerts@company.com'
    subject: '🚨 CRITICAL: {{ .GroupLabels.alertname }}'
    body: |
      CRITICAL ALERT FIRED
      
      Alert: {{ .GroupLabels.alertname }}
      Severity: {{ .GroupLabels.severity }}
      Instance: {{ .GroupLabels.instance }}
      
      Description: {{ range .Alerts }}{{ .Annotations.description }}{{ end }}
      
      Runbook: {{ range .Alerts }}{{ .Annotations.runbook_url }}{{ end }}
```

### PagerDuty Integration

#### Service Configuration
```bash
# Configure PagerDuty webhook
export PAGERDUTY_INTEGRATION_KEY="your-integration-key"

# Test integration
curl -X POST https://events.pagerduty.com/v2/enqueue \
  -H "Content-Type: application/json" \
  -d '{
    "routing_key": "'$PAGERDUTY_INTEGRATION_KEY'",
    "event_action": "trigger",
    "payload": {
      "summary": "Test alert from Prompt Card System",
      "source": "monitoring",
      "severity": "warning"
    }
  }'
```

## 🔧 Alert Management

### Silencing Alerts

#### Temporary Maintenance
```bash
# Silence alerts during maintenance window
amtool silence add alertname="ServiceDown" instance="prompt-backend:3001" \
  --duration="2h" \
  --comment="Scheduled maintenance"

# List active silences
amtool silence query

# Expire silence early
amtool silence expire <silence-id>
```

#### Bulk Silencing
```bash
# Silence all alerts for a service
amtool silence add job="prompt-backend" \
  --duration="30m" \
  --comment="Emergency maintenance"
```

### Alert Tuning

#### Threshold Adjustment
```yaml
# Example: Adjust memory alert threshold
- alert: HighMemoryUsage
  expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.85  # Reduced from 0.9
  for: 10m  # Increased from 5m
  labels:
    severity: warning
  annotations:
    summary: "High memory usage (adjusted threshold)"
```

#### False Positive Reduction
```yaml
# Add additional conditions to reduce noise
- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1 and rate(http_requests_total[5m]) > 0.5  # Must have minimum traffic
  for: 5m
  labels:
    severity: warning
```

## 📋 Response Playbooks

### Service Down Response

#### Step 1: Immediate Triage (0-5 minutes)
```bash
# Quick health check
curl -f http://localhost:3001/api/health || echo "Backend down"
curl -f http://localhost:3000 || echo "Frontend down"

# Check container status
docker ps | grep prompt-

# Check system resources
free -h && df -h
```

#### Step 2: Service Recovery (5-15 minutes)
```bash
# Restart individual service
docker restart prompt-backend

# Full stack restart if needed
docker-compose -f docker-compose.prod.yml restart

# Check service logs
docker logs prompt-backend --tail=50
```

#### Step 3: Post-Recovery (15-30 minutes)
1. Verify all services are healthy
2. Check for data consistency issues
3. Review logs for root cause
4. Update incident documentation

### Performance Degradation Response

#### Step 1: Identify Bottleneck (0-10 minutes)
```bash
# System resources
htop
iostat 1 5
iftop

# Database performance
docker exec prompt-postgres pg_stat_statements
```

#### Step 2: Quick Mitigation (10-20 minutes)
```bash
# Scale services
docker-compose -f docker-compose.prod.yml scale backend=2

# Clear cache if needed
docker exec prompt-redis redis-cli flushall

# Restart services with high memory usage
docker restart <high-memory-service>
```

## 📊 Alert Metrics and KPIs

### Response Metrics
- **Mean Time to Acknowledge (MTTA)**: Target < 5 minutes
- **Mean Time to Resolution (MTTR)**: Target < 30 minutes  
- **False Positive Rate**: Target < 10%
- **Alert Volume**: Monitor for alert fatigue

### Monthly Review
```bash
# Generate alert statistics
amtool alert query --alertmanager.url=http://localhost:9093 \
  --start="$(date -d '30 days ago' -I)" \
  --end="$(date -I)" \
  | jq -r '.[] | [.labels.alertname, .status.state] | @csv'
```

## 🔒 Security Alerts

### Security Incident Response
**Alert**: `SecurityVulnerabilityDetected`  
**Severity**: Critical  
**Response Time**: Immediate

**Response Procedure**:
1. **Isolate**: Quarantine affected systems
2. **Assess**: Determine scope and impact
3. **Contain**: Stop ongoing attack
4. **Investigate**: Collect evidence and logs
5. **Remediate**: Apply patches and fixes
6. **Monitor**: Enhanced monitoring period

### Failed Authentication Attempts
**Alert**: `HighFailedAuthAttempts`  
**Condition**: `rate(auth_failures_total[5m]) > 10`  
**Severity**: Warning  
**Response Time**: 30 minutes

**Response Procedure**:
```bash
# Check auth logs
docker logs prompt-backend | grep "authentication failed"

# Review IP patterns
docker logs prompt-backend | grep "authentication failed" | awk '{print $1}' | sort | uniq -c | sort -nr

# Block suspicious IPs if needed
sudo ufw deny from <suspicious-ip>
```

## 📞 Escalation Matrix

### Contact Information
| Level | Role | Contact | Response Time |
|-------|------|---------|---------------|
| L1 | On-Call Engineer | +1-555-0123 | 5 minutes |
| L2 | Senior DevOps | +1-555-0124 | 15 minutes |
| L3 | Engineering Manager | +1-555-0125 | 30 minutes |
| L4 | Director of Engineering | +1-555-0126 | 1 hour |

### Escalation Triggers
- **Automatic**: No response to critical alert within 15 minutes
- **Manual**: Complex issues requiring senior expertise
- **Business Impact**: Customer-facing services affected
- **Security**: Any confirmed security incident

---

**Last Updated**: $(date +%Y-%m-%d)  
**Review Schedule**: Quarterly  
**Contact**: DevOps Team (devops@company.com)