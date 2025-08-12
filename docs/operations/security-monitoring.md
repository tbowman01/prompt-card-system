# Security Monitoring and Incident Response

## 🔒 Overview

This document outlines security monitoring procedures, incident response protocols, and security event management for the Prompt Card System. It provides step-by-step guidance for detecting, analyzing, and responding to security threats.

## 🛡️ Security Monitoring Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Application   │ ──→│   Security      │ ──→│   SIEM/Log      │
│     Logs        │    │   Events        │    │   Analysis      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Access Logs   │    │   Alerting      │    │   Incident      │
│   + Audit Trail │    │   System        │    │   Response      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Security Assessment

### Immediate Security Health Check
```bash
# Check for failed login attempts
docker logs prompt-backend --since 1h | grep -i "authentication failed" | wc -l

# Check for suspicious IP addresses
docker logs prompt-backend --since 1h | grep -E "40[0-9]|50[0-9]" | awk '{print $1}' | sort | uniq -c | sort -nr | head -10

# Check SSL certificate status
openssl s_client -connect localhost:443 -servername yourdomain.com < /dev/null 2>/dev/null | openssl x509 -noout -dates

# Verify container security
docker inspect prompt-backend | jq '.[].HostConfig.Privileged'
```

### Security Metrics Dashboard
```bash
# Failed authentication attempts (last hour)
FAILED_AUTH=$(docker logs prompt-backend --since 1h | grep -c "authentication failed")
echo "Failed auth attempts: $FAILED_AUTH"

# Unusual response codes
HTTP_ERRORS=$(docker logs prompt-nginx --since 1h | grep -E " [45][0-9][0-9] " | wc -l)
echo "HTTP errors: $HTTP_ERRORS"

# Security events
SECURITY_EVENTS=$(docker logs prompt-backend --since 1h | grep -i -E "(security|breach|attack|intrusion)" | wc -l)
echo "Security events: $SECURITY_EVENTS"
```

## 🔍 Security Event Detection

### Authentication Security

#### Failed Login Monitoring
```bash
# Monitor failed authentication attempts
cat > scripts/auth-monitor.sh << 'EOF'
#!/bin/bash

THRESHOLD=10
TIMEFRAME="5m"
LOGFILE="/var/log/security-monitor.log"

while true; do
    TIMESTAMP=$(date)
    
    # Count failed auth attempts in last 5 minutes
    FAILED_COUNT=$(docker logs prompt-backend --since $TIMEFRAME | grep -c "authentication failed")
    
    if [ $FAILED_COUNT -gt $THRESHOLD ]; then
        MESSAGE="🚨 HIGH FAILED AUTH ATTEMPTS: $FAILED_COUNT in last $TIMEFRAME"
        echo "$TIMESTAMP - $MESSAGE" >> $LOGFILE
        
        # Extract attacking IPs
        docker logs prompt-backend --since $TIMEFRAME | \
            grep "authentication failed" | \
            grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | \
            sort | uniq -c | sort -nr > /tmp/attack_ips.txt
        
        # Block suspicious IPs (if firewall available)
        while read count ip; do
            if [ $count -gt 5 ]; then
                echo "$TIMESTAMP - Blocking IP $ip ($count attempts)" >> $LOGFILE
                # ufw deny from $ip (uncomment if using ufw)
            fi
        done < /tmp/attack_ips.txt
        
        # Send alert
        if [ -n "$SLACK_WEBHOOK_URL" ]; then
            curl -X POST -H 'Content-type: application/json' \
                --data "{\"text\":\"$MESSAGE\"}" \
                "$SLACK_WEBHOOK_URL"
        fi
    fi
    
    sleep 60
done
EOF

chmod +x scripts/auth-monitor.sh
nohup scripts/auth-monitor.sh &
```

#### Session Security Monitoring
```bash
# Check for session hijacking indicators
cat > scripts/session-security.sh << 'EOF'
#!/bin/bash

# Check for multiple sessions from same user with different IPs
docker exec prompt-redis redis-cli keys "session:*" | while read session; do
    SESSION_DATA=$(docker exec prompt-redis redis-cli get "$session")
    USER_ID=$(echo "$SESSION_DATA" | jq -r '.userId')
    IP=$(echo "$SESSION_DATA" | jq -r '.ipAddress')
    
    # Check if user has sessions from multiple IPs
    UNIQUE_IPS=$(docker exec prompt-redis redis-cli keys "session:*" | \
        xargs -I {} docker exec prompt-redis redis-cli get {} | \
        jq -r "select(.userId == \"$USER_ID\") | .ipAddress" | \
        sort | uniq | wc -l)
    
    if [ $UNIQUE_IPS -gt 2 ]; then
        echo "⚠️ User $USER_ID has sessions from $UNIQUE_IPS different IPs"
    fi
done
EOF
```

### Network Security Monitoring

#### Intrusion Detection
```bash
# Monitor for potential intrusion patterns
cat > scripts/intrusion-detection.sh << 'EOF'
#!/bin/bash

LOGFILE="/var/log/intrusion-detection.log"

# Monitor for SQL injection attempts
SQL_INJECTION=$(docker logs prompt-backend --since 1h | \
    grep -i -E "(union select|drop table|exec|script|alert)" | wc -l)

if [ $SQL_INJECTION -gt 0 ]; then
    echo "$(date) - SQL Injection attempts detected: $SQL_INJECTION" >> $LOGFILE
    docker logs prompt-backend --since 1h | \
        grep -i -E "(union select|drop table|exec|script|alert)" >> $LOGFILE
fi

# Monitor for XSS attempts
XSS_ATTEMPTS=$(docker logs prompt-backend --since 1h | \
    grep -i -E "(<script|javascript:|onerror=|onload=)" | wc -l)

if [ $XSS_ATTEMPTS -gt 0 ]; then
    echo "$(date) - XSS attempts detected: $XSS_ATTEMPTS" >> $LOGFILE
    docker logs prompt-backend --since 1h | \
        grep -i -E "(<script|javascript:|onerror=|onload=)" >> $LOGFILE
fi

# Monitor for directory traversal
DIR_TRAVERSAL=$(docker logs prompt-backend --since 1h | \
    grep -E "(\.\.\/|\.\.\\)" | wc -l)

if [ $DIR_TRAVERSAL -gt 0 ]; then
    echo "$(date) - Directory traversal attempts: $DIR_TRAVERSAL" >> $LOGFILE
fi
EOF

chmod +x scripts/intrusion-detection.sh

# Run every 10 minutes
echo "*/10 * * * * /path/to/scripts/intrusion-detection.sh" | crontab -
```

#### Rate Limiting Monitoring
```bash
# Monitor rate limiting effectiveness
docker logs prompt-nginx --since 1h | \
    grep "limiting requests" | \
    awk '{print $1}' | \
    sort | uniq -c | \
    sort -nr | head -10
```

### Application Security Events

#### File System Monitoring
```bash
# Monitor for unauthorized file access
cat > scripts/file-monitor.sh << 'EOF'
#!/bin/bash

# Monitor sensitive directories
inotifywait -m -r -e access,modify,create,delete \
    /app/config \
    /app/uploads \
    /etc/ssl \
    --format '%T %w %f %e' \
    --timefmt '%Y-%m-%d %H:%M:%S' >> /var/log/file-monitor.log &

# Monitor configuration file changes
find /app/config -name "*.json" -o -name "*.yml" -o -name "*.env" | \
    entr -p bash -c 'echo "$(date): Configuration file changed: $1" >> /var/log/config-changes.log'
EOF

chmod +x scripts/file-monitor.sh
```

#### Container Security Monitoring
```bash
# Check container security compliance
cat > scripts/container-security-check.sh << 'EOF'
#!/bin/bash

echo "🔍 Container Security Audit - $(date)"

# Check for privileged containers
PRIVILEGED=$(docker ps --filter "label=privileged=true" --format "table {{.Names}}")
if [ -n "$PRIVILEGED" ]; then
    echo "⚠️ Privileged containers found: $PRIVILEGED"
fi

# Check for containers running as root
docker ps --format "table {{.Names}}" | tail -n +2 | while read container; do
    ROOT_PROCESS=$(docker exec "$container" ps -o user --no-headers | head -1)
    if [ "$ROOT_PROCESS" = "root" ]; then
        echo "⚠️ Container $container running as root"
    fi
done

# Check for containers with exposed Docker socket
docker ps --format "{{.Names}}" | while read container; do
    DOCKER_SOCKET=$(docker inspect "$container" | jq -r '.[].Mounts[] | select(.Source == "/var/run/docker.sock") | .Source')
    if [ -n "$DOCKER_SOCKET" ]; then
        echo "⚠️ Container $container has Docker socket mounted"
    fi
done

# Check for images with known vulnerabilities
echo "📊 Scanning images for vulnerabilities..."
docker images --format "{{.Repository}}:{{.Tag}}" | while read image; do
    if command -v trivy &> /dev/null; then
        trivy image --severity HIGH,CRITICAL --quiet "$image" | grep -q "Total:" && \
            echo "🚨 Vulnerabilities found in $image"
    fi
done
EOF

chmod +x scripts/container-security-check.sh

# Run weekly
echo "0 2 * * 0 /path/to/scripts/container-security-check.sh >> /var/log/container-security.log 2>&1" | crontab -
```

## 🚨 Security Incident Response

### Incident Classification

#### Severity Levels
- **Critical (P1)**: Active attack, data breach, system compromise
- **High (P2)**: Suspected security incident, multiple failed authentications
- **Medium (P3)**: Security policy violation, unusual activity
- **Low (P4)**: Security warning, compliance issue

### Incident Response Procedures

#### Step 1: Immediate Response
```bash
# Security incident response script
cat > scripts/security-incident-response.sh << 'EOF'
#!/bin/bash

INCIDENT_TYPE=$1
SEVERITY=$2
AFFECTED_SYSTEM=$3

echo "🚨 Security Incident Response - $(date)"
echo "Type: $INCIDENT_TYPE"
echo "Severity: $SEVERITY"
echo "Affected: $AFFECTED_SYSTEM"

case $SEVERITY in
    "P1"|"critical")
        # Critical incident - immediate action
        echo "🚨 CRITICAL SECURITY INCIDENT"
        
        # Isolate affected system
        if [ -n "$AFFECTED_SYSTEM" ]; then
            echo "🔒 Isolating system: $AFFECTED_SYSTEM"
            docker stop "$AFFECTED_SYSTEM" || true
        fi
        
        # Preserve evidence
        EVIDENCE_DIR="/var/log/security/incidents/$(date +%Y%m%d_%H%M%S)"
        mkdir -p "$EVIDENCE_DIR"
        
        # Collect logs
        docker logs prompt-backend > "$EVIDENCE_DIR/backend.log"
        docker logs prompt-nginx > "$EVIDENCE_DIR/nginx.log"
        
        # Network snapshot
        netstat -tuln > "$EVIDENCE_DIR/network.txt"
        ps aux > "$EVIDENCE_DIR/processes.txt"
        
        # Alert team
        MESSAGE="🚨 CRITICAL SECURITY INCIDENT: $INCIDENT_TYPE affecting $AFFECTED_SYSTEM"
        if [ -n "$SLACK_WEBHOOK_URL" ]; then
            curl -X POST -H 'Content-type: application/json' \
                --data "{\"text\":\"$MESSAGE\"}" \
                "$SLACK_WEBHOOK_URL"
        fi
        ;;
        
    "P2"|"high")
        # High severity - investigate and contain
        echo "⚠️ HIGH SEVERITY SECURITY INCIDENT"
        
        # Enhanced monitoring
        docker logs prompt-backend --tail=1000 | grep -E "(error|fail|attack)" > /tmp/security_events.log
        
        # Check for ongoing attacks
        ACTIVE_ATTACKS=$(docker logs prompt-backend --since 10m | grep -c "authentication failed")
        if [ $ACTIVE_ATTACKS -gt 20 ]; then
            echo "🚨 Active brute force attack detected - $ACTIVE_ATTACKS attempts"
        fi
        ;;
esac
EOF

chmod +x scripts/security-incident-response.sh
```

#### Step 2: Investigation and Analysis
```bash
# Security investigation toolkit
cat > scripts/security-investigation.sh << 'EOF'
#!/bin/bash

INCIDENT_ID=$1
TIMEFRAME=${2:-"1h"}

echo "🔍 Security Investigation - Incident: $INCIDENT_ID"

# Create investigation directory
INVEST_DIR="/var/log/security/investigations/$INCIDENT_ID"
mkdir -p "$INVEST_DIR"

# Collect application logs
echo "📋 Collecting application logs..."
docker logs prompt-backend --since $TIMEFRAME > "$INVEST_DIR/backend_logs.txt"
docker logs prompt-frontend --since $TIMEFRAME > "$INVEST_DIR/frontend_logs.txt"
docker logs prompt-nginx --since $TIMEFRAME > "$INVEST_DIR/nginx_logs.txt"

# Extract authentication events
echo "🔐 Analyzing authentication events..."
docker logs prompt-backend --since $TIMEFRAME | \
    grep -E "(login|logout|authentication)" > "$INVEST_DIR/auth_events.txt"

# Extract IP addresses from suspicious activities
echo "🌐 Analyzing IP addresses..."
docker logs prompt-backend --since $TIMEFRAME | \
    grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | \
    sort | uniq -c | sort -nr > "$INVEST_DIR/ip_analysis.txt"

# Check database for suspicious queries
echo "🗄️ Checking database activity..."
docker exec prompt-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "
    SELECT query_start, state, query 
    FROM pg_stat_activity 
    WHERE state != 'idle' 
    ORDER BY query_start DESC;" > "$INVEST_DIR/db_activity.txt"

# Generate investigation report
cat > "$INVEST_DIR/investigation_report.md" << EOL
# Security Investigation Report - $INCIDENT_ID

**Date**: $(date)
**Timeframe**: $TIMEFRAME
**Investigator**: $(whoami)

## Summary
- Incident ID: $INCIDENT_ID
- Investigation started: $(date)
- Evidence collected in: $INVEST_DIR

## Key Findings
- Authentication events: $(wc -l < "$INVEST_DIR/auth_events.txt") events
- Unique IP addresses: $(wc -l < "$INVEST_DIR/ip_analysis.txt") IPs
- Database queries analyzed: $(wc -l < "$INVEST_DIR/db_activity.txt") queries

## Next Steps
1. Review collected evidence
2. Correlate events with external threat intelligence
3. Determine root cause
4. Implement remediation measures

EOL

echo "✅ Investigation complete. Report: $INVEST_DIR/investigation_report.md"
EOF

chmod +x scripts/security-investigation.sh
```

### Automated Threat Detection

#### Security Alert Rules
```yaml
# Add to prometheus/alert_rules_enhanced.yml
groups:
  - name: security_alerts
    rules:
      - alert: HighFailedAuthentications
        expr: increase(failed_auth_attempts_total[5m]) > 10
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "High number of failed authentication attempts"
          description: "{{ $value }} failed authentication attempts in 5 minutes"
          
      - alert: SuspiciousHTTPActivity
        expr: rate(http_requests_total{status=~"40[13]"}[5m]) > 5
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Suspicious HTTP activity detected"
          description: "High rate of 401/403 responses: {{ $value }}/sec"
          
      - alert: PotentialSQLInjection
        expr: increase(sql_injection_attempts_total[5m]) > 0
        for: 0s
        labels:
          severity: critical
        annotations:
          summary: "Potential SQL injection detected"
          description: "SQL injection attempt detected"
```

#### Threat Intelligence Integration
```bash
# Check IPs against threat intelligence
cat > scripts/threat-intel-check.sh << 'EOF'
#!/bin/bash

# Extract IPs from logs
docker logs prompt-nginx --since 1h | \
    grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | \
    sort | uniq > /tmp/recent_ips.txt

# Check against AbuseIPDB (requires API key)
if [ -n "$ABUSEIPDB_API_KEY" ]; then
    while read ip; do
        ABUSE_SCORE=$(curl -s "https://api.abuseipdb.com/api/v2/check" \
            -H "Key: $ABUSEIPDB_API_KEY" \
            -H "Accept: application/json" \
            -d "ipAddress=$ip" | jq -r '.data.abuseConfidencePercentage')
        
        if [ "$ABUSE_SCORE" -gt 50 ]; then
            echo "🚨 Malicious IP detected: $ip (Abuse Score: $ABUSE_SCORE%)"
            echo "$(date): Blocking malicious IP $ip" >> /var/log/security.log
            # Block IP (adjust for your firewall)
            # iptables -A INPUT -s $ip -j DROP
        fi
    done < /tmp/recent_ips.txt
fi
EOF

chmod +x scripts/threat-intel-check.sh
```

## 🛡️ Security Hardening Monitoring

### SSL/TLS Monitoring
```bash
# Monitor SSL certificate expiration
cat > scripts/ssl-monitor.sh << 'EOF'
#!/bin/bash

DOMAINS=("yourdomain.com" "api.yourdomain.com")

for domain in "${DOMAINS[@]}"; do
    EXPIRY=$(openssl s_client -connect $domain:443 -servername $domain 2>/dev/null | \
        openssl x509 -noout -dates | grep notAfter | cut -d= -f2)
    
    EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s)
    CURRENT_EPOCH=$(date +%s)
    DAYS_LEFT=$(( ($EXPIRY_EPOCH - $CURRENT_EPOCH) / 86400 ))
    
    if [ $DAYS_LEFT -lt 30 ]; then
        echo "⚠️ SSL certificate for $domain expires in $DAYS_LEFT days"
        
        # Send alert
        if [ -n "$SLACK_WEBHOOK_URL" ]; then
            curl -X POST -H 'Content-type: application/json' \
                --data "{\"text\":\"⚠️ SSL certificate for $domain expires in $DAYS_LEFT days\"}" \
                "$SLACK_WEBHOOK_URL"
        fi
    fi
done
EOF

chmod +x scripts/ssl-monitor.sh

# Run daily
echo "0 9 * * * /path/to/scripts/ssl-monitor.sh" | crontab -
```

### Compliance Monitoring
```bash
# Security compliance checker
cat > scripts/compliance-check.sh << 'EOF'
#!/bin/bash

echo "🔍 Security Compliance Check - $(date)"

# Check password policy compliance
echo "👤 Checking password policies..."

# Check for default passwords (customize as needed)
DEFAULT_PASSWORDS=("admin" "password" "123456" "admin123")
for password in "${DEFAULT_PASSWORDS[@]}"; do
    # This is a mock check - implement based on your auth system
    echo "Checking for default password: $password"
done

# Check encryption in transit
echo "🔒 Checking encryption in transit..."
if docker logs prompt-nginx --since 1h | grep -q "ssl_protocols"; then
    echo "✅ SSL/TLS configured"
else
    echo "⚠️ SSL/TLS configuration not found"
fi

# Check file permissions
echo "📁 Checking file permissions..."
docker exec prompt-backend find /app -type f -perm 777 2>/dev/null | \
    head -10 | while read file; do
        echo "⚠️ World-writable file: $file"
    done

# Check for exposed secrets
echo "🔑 Checking for exposed secrets..."
docker logs prompt-backend --since 1d | \
    grep -E "(password|secret|key|token)" | \
    grep -v "REDACTED" | head -5 | \
    while read line; do
        echo "⚠️ Potential secret exposure in logs"
    done
EOF

chmod +x scripts/compliance-check.sh
```

## 📊 Security Metrics and Reporting

### Security Dashboard Metrics
```bash
# Generate security metrics for Prometheus
cat > scripts/security-metrics.py << 'EOF'
#!/usr/bin/env python3
import os
import re
import time
import subprocess
from prometheus_client import Counter, Gauge, generate_latest, CONTENT_TYPE_LATEST
from http.server import HTTPServer, BaseHTTPRequestHandler

# Define metrics
failed_auth_attempts = Counter('failed_auth_attempts_total', 'Total failed authentication attempts')
security_events = Counter('security_events_total', 'Total security events', ['event_type'])
active_sessions = Gauge('active_sessions', 'Number of active user sessions')
blocked_ips = Gauge('blocked_ips_total', 'Total number of blocked IP addresses')

class SecurityMetricsHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Update metrics from logs
        try:
            # Get failed auth attempts from logs
            result = subprocess.run(['docker', 'logs', 'prompt-backend', '--since', '1h'], 
                                  capture_output=True, text=True)
            
            # Count failed authentications
            failed_auths = len(re.findall(r'authentication failed', result.stdout, re.IGNORECASE))
            failed_auth_attempts._value._value = failed_auths
            
            # Count other security events
            sql_injections = len(re.findall(r'sql injection', result.stdout, re.IGNORECASE))
            xss_attempts = len(re.findall(r'xss attempt', result.stdout, re.IGNORECASE))
            
            security_events.labels(event_type='sql_injection')._value._value = sql_injections
            security_events.labels(event_type='xss_attempt')._value._value = xss_attempts
            
        except Exception as e:
            print(f"Error updating metrics: {e}")
        
        self.send_response(200)
        self.send_header('Content-Type', CONTENT_TYPE_LATEST)
        self.end_headers()
        self.wfile.write(generate_latest().encode())

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 8001), SecurityMetricsHandler)
    server.serve_forever()
EOF

chmod +x scripts/security-metrics.py
nohup python3 scripts/security-metrics.py &
```

### Daily Security Report
```bash
# Generate daily security summary
cat > scripts/daily-security-report.sh << 'EOF'
#!/bin/bash

REPORT_DATE=$(date +%Y-%m-%d)
REPORT_FILE="/var/log/security/daily_reports/security_report_$REPORT_DATE.md"

mkdir -p "/var/log/security/daily_reports"

cat > "$REPORT_FILE" << EOL
# Daily Security Report - $REPORT_DATE

## Authentication Summary
- Failed login attempts: $(docker logs prompt-backend --since 24h | grep -c "authentication failed")
- Successful logins: $(docker logs prompt-backend --since 24h | grep -c "successful login")
- Active sessions: $(docker exec prompt-redis redis-cli keys "session:*" | wc -l)

## Network Security
- HTTP 4xx errors: $(docker logs prompt-nginx --since 24h | grep -c " 4[0-9][0-9] ")
- HTTP 5xx errors: $(docker logs prompt-nginx --since 24h | grep -c " 5[0-9][0-9] ")
- Unique IP addresses: $(docker logs prompt-nginx --since 24h | awk '{print $1}' | sort | uniq | wc -l)

## Security Events
- SQL injection attempts: $(docker logs prompt-backend --since 24h | grep -ic "sql injection")
- XSS attempts: $(docker logs prompt-backend --since 24h | grep -ic "xss")
- Directory traversal: $(docker logs prompt-backend --since 24h | grep -c "\.\./")

## System Security
- SSL certificate days remaining: $(openssl s_client -connect localhost:443 -servername yourdomain.com 2>/dev/null | openssl x509 -noout -dates | grep notAfter | cut -d= -f2 | xargs -I {} date -d "{}" +%s | awk -v current=\$(date +%s) '{print int((\$1 - current) / 86400)}')
- Container security compliance: $(docker ps --format "{{.Names}}" | wc -l) containers running

## Recommendations
$(if [ $(docker logs prompt-backend --since 24h | grep -c "authentication failed") -gt 50 ]; then echo "- Review and strengthen authentication policies"; fi)
$(if [ $(docker logs prompt-nginx --since 24h | grep -c " 4[0-9][0-9] ") -gt 1000 ]; then echo "- Investigate high number of client errors"; fi)
$(if [ $(docker logs prompt-backend --since 24h | grep -ic "sql injection") -gt 0 ]; then echo "- Immediate review of SQL injection attempts required"; fi)

---
Report generated: $(date)
EOL

echo "📊 Daily security report generated: $REPORT_FILE"

# Send report if configured
if [ -n "$SECURITY_EMAIL" ]; then
    cat "$REPORT_FILE" | mail -s "Daily Security Report - $REPORT_DATE" "$SECURITY_EMAIL"
fi
EOF

chmod +x scripts/daily-security-report.sh

# Schedule daily report
echo "0 6 * * * /path/to/scripts/daily-security-report.sh" | crontab -
```

## 📋 Security Operations Checklist

### Daily Security Tasks
- [ ] Review failed authentication attempts
- [ ] Check for suspicious IP addresses
- [ ] Monitor security event logs
- [ ] Verify SSL certificate status
- [ ] Check system access logs

### Weekly Security Tasks
- [ ] Run security compliance scan
- [ ] Review and update threat intelligence
- [ ] Analyze security metrics trends
- [ ] Test incident response procedures
- [ ] Update security documentation

### Monthly Security Tasks
- [ ] Conduct security vulnerability assessment
- [ ] Review and update security policies
- [ ] Audit user access permissions
- [ ] Test backup and recovery procedures
- [ ] Security awareness training updates

---

**Last Updated**: $(date +%Y-%m-%d)  
**Review Schedule**: Monthly  
**Contact**: Security Team (security@company.com)