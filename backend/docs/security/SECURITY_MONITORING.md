# Security Monitoring System

The Prompt Card System includes a comprehensive security monitoring and vulnerability scanning system that provides real-time threat detection, automated compliance checking, and centralized security event management.

## Features

### 🔍 Vulnerability Scanning
- **Dependency Scanning**: Automated detection of known vulnerabilities in npm packages
- **Code Analysis**: Static code analysis for security patterns and potential vulnerabilities
- **Infrastructure Scanning**: Docker and configuration security assessment
- **Comprehensive Scanning**: Combined vulnerability assessment across all layers

### 📊 Security Event Monitoring
- **Real-time Event Logging**: Capture and categorize security events
- **Threat Level Assessment**: Automatic severity classification
- **Pattern Detection**: Identify security patterns and anomalies
- **Event Correlation**: Link related security events for investigation

### 🚨 Alerting System
- **Multi-channel Notifications**: Email, Slack, webhook, and SMS alerts
- **Configurable Rules**: Custom alerting rules with conditions and thresholds
- **Alert Management**: Acknowledge and resolve alerts with tracking
- **Auto-remediation**: Automated response to specific security events

### 📋 Compliance Checking
- **Multiple Frameworks**: SOC2, GDPR, OWASP, NIST, ISO27001 compliance
- **Automated Checks**: Continuous compliance monitoring
- **Compliance Scoring**: Quantitative compliance assessment
- **Remediation Guidance**: Actionable recommendations for compliance issues

### 📈 Log Aggregation & Analysis
- **Centralized Logging**: Collect logs from all system components
- **Real-time Analysis**: Immediate pattern detection and alerting
- **Log Retention**: Configurable log retention policies
- **Search & Filter**: Advanced log search and filtering capabilities

## Architecture

### Core Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ SecurityMonitor │    │  LogAggregator  │    │ AlertingSystem  │
│                 │    │                 │    │                 │
│ • Vuln Scanning │◄──►│ • Log Collection│◄──►│ • Alert Rules   │
│ • Event Logging │    │ • Pattern Detect│    │ • Notifications │
│ • Metrics       │    │ • Analysis      │    │ • Management    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
           │                       │                       │
           └───────────────────────┼───────────────────────┘
                                   │
                   ┌─────────────────┐
                   │ComplianceChecker│
                   │                 │
                   │ • Framework     │
                   │   Support       │
                   │ • Automated     │
                   │   Checks        │
                   │ • Reporting     │
                   └─────────────────┘
```

### Integration Points

- **Express Middleware**: Request/response logging and monitoring
- **Health Checks**: Security status integration with health endpoints
- **WebSocket Events**: Real-time security event streaming
- **Database Integration**: Persistent storage for events and reports

## API Endpoints

### Security Status
```http
GET /api/security/status
```
Returns comprehensive security status including metrics, alerts, and compliance.

### Vulnerability Scanning
```http
POST /api/security/scan/dependencies
POST /api/security/scan/code
POST /api/security/scan/infrastructure
POST /api/security/scan/comprehensive
```

### Security Events
```http
GET /api/security/events?severity=critical&limit=100
POST /api/security/events
```

### Log Management
```http
GET /api/security/logs?level=error&since=2024-01-01
GET /api/security/logs/analysis
GET /api/security/logs/statistics
```

### Alert Management
```http
GET /api/security/alerts?resolved=false
PATCH /api/security/alerts/{id}/acknowledge
PATCH /api/security/alerts/{id}/resolve
```

### Compliance
```http
GET /api/security/compliance/status
POST /api/security/compliance/scan
GET /api/security/compliance/reports
```

## Configuration

### Environment Variables

```bash
# Security Monitoring
ENABLE_SECURITY_MONITORING=true
SECURITY_SCAN_INTERVAL=3600000  # 1 hour in ms
SECURITY_EVENT_RETENTION_DAYS=30

# Compliance
COMPLIANCE_FRAMEWORKS=SOC2,OWASP,GDPR
COMPLIANCE_CHECK_INTERVAL=86400000  # 24 hours in ms

# Alerting
ALERT_RETENTION_DAYS=90
ENABLE_AUTO_REMEDIATION=false

# Logging
LOG_LEVEL=info
LOG_RETENTION_DAYS=30
MAX_LOG_SIZE=50000
```

### Alert Rules Configuration

```typescript
// Example alert rule
const criticalSecurityRule = {
  name: 'Critical Security Events',
  description: 'Alert on critical security events',
  enabled: true,
  conditions: {
    eventType: ['security'],
    severity: ['critical']
  },
  actions: [
    { type: 'email', target: 'security-team@company.com' },
    { type: 'slack', target: 'security-channel' }
  ],
  cooldown: 5 // minutes
};
```

### Notification Channels

```typescript
// Email channel
const emailChannel = {
  type: 'email',
  name: 'Security Team Email',
  config: {
    email: {
      to: ['security@company.com'],
      from: 'alerts@company.com'
    }
  },
  enabled: true
};

// Slack channel
const slackChannel = {
  type: 'slack',
  name: 'Security Slack Channel',
  config: {
    slack: {
      webhook: 'https://hooks.slack.com/services/...',
      channel: '#security-alerts'
    }
  },
  enabled: true
};
```

## Security Scanning

### Dependency Scanning

The system uses `npm audit` to scan for known vulnerabilities in dependencies:

```javascript
// Automatic dependency scanning
const report = await securityMonitor.scanDependencies();
console.log(`Found ${report.vulnerabilities.total} vulnerabilities`);
```

### Code Scanning

Static code analysis looks for common security patterns:

- Use of `eval()` functions
- Hardcoded secrets and passwords
- SQL injection patterns
- XSS vulnerabilities
- Command injection risks

### Infrastructure Scanning

Docker and configuration security checks:

- Privileged container usage
- Root user execution
- Insecure file permissions
- Environment variable security

## Compliance Frameworks

### Supported Frameworks

- **SOC2**: Security controls and operational procedures
- **GDPR**: Data protection and privacy requirements
- **OWASP**: Web application security standards
- **NIST**: Cybersecurity framework guidelines
- **ISO27001**: Information security management

### Compliance Checks

```typescript
// Example compliance check
const passwordPolicyCheck = {
  name: 'Password Policy Enforcement',
  framework: 'OWASP',
  severity: 'high',
  automated: true,
  checkFunction: async () => {
    // Validate password policy configuration
    const minLength = process.env.MIN_PASSWORD_LENGTH;
    return {
      passed: minLength >= 8,
      score: minLength >= 8 ? 100 : 0,
      findings: minLength >= 8 ? [] : ['Minimum password length too short']
    };
  }
};
```

## Security Events

### Event Types

- **Vulnerability**: Security vulnerabilities discovered
- **Intrusion**: Unauthorized access attempts
- **Authentication**: Login and authentication events
- **Access**: Resource access events
- **Malware**: Malware detection events

### Event Severity

- **Critical**: Immediate attention required
- **High**: Urgent response needed
- **Medium**: Important but not urgent
- **Low**: Informational

### Event Processing

```typescript
// Log a security event
securityMonitor.logSecurityEvent({
  severity: 'high',
  type: 'intrusion',
  source: 'auth-system',
  message: 'Multiple failed login attempts detected',
  details: {
    userId: 'user123',
    ipAddress: '192.168.1.100',
    attempts: 5
  },
  resolved: false
});
```

## Monitoring Dashboard

Access the security dashboard at:
```
GET /api/security/dashboard
```

The dashboard provides:
- Security metrics overview
- Recent alerts and events
- Compliance status
- Log analysis summary
- Trend analysis

## Integration with Health Checks

Security monitoring is integrated with the enhanced health check system:

```http
GET /api/health/v2/security
```

Returns:
```json
{
  "status": "healthy",
  "details": {
    "securityScore": 85,
    "threatLevel": "low",
    "criticalVulnerabilities": 0,
    "eventsLast24h": 15,
    "complianceScore": 92
  }
}
```

## Testing

Use the comprehensive security testing script:

```bash
./scripts/security-test.sh
```

This script performs:
- Vulnerability scans
- API security tests
- Common vulnerability tests
- Security header checks
- Compliance verification

## Best Practices

### 1. Regular Scanning
- Schedule daily vulnerability scans
- Run compliance checks weekly
- Monitor security events continuously

### 2. Alert Configuration
- Set up alerts for critical events
- Configure multiple notification channels
- Test alert delivery regularly

### 3. Response Procedures
- Document incident response procedures
- Assign security team responsibilities
- Practice incident response scenarios

### 4. Compliance Management
- Regular compliance assessments
- Address compliance gaps promptly
- Maintain compliance documentation

### 5. Log Management
- Centralize all security logs
- Regular log analysis
- Secure log storage and retention

## Troubleshooting

### Common Issues

**1. Scan Failures**
```bash
# Check if npm audit is working
npm audit --json

# Verify file permissions
ls -la src/
```

**2. Alert Delivery Issues**
- Verify notification channel configuration
- Check network connectivity
- Review alert rule conditions

**3. High Resource Usage**
- Reduce scan frequency
- Limit log retention
- Optimize pattern detection

### Debug Mode

Enable debug logging:
```bash
DEBUG=security:* npm start
```

## Performance Considerations

- **Scanning Impact**: Scans run asynchronously to avoid blocking operations
- **Memory Usage**: Configurable limits for events and logs
- **Storage**: Automatic cleanup of old data
- **Network**: Rate limiting for external vulnerability databases

## Security of the Security System

- **Access Control**: API endpoints require authentication
- **Data Protection**: Sensitive data is encrypted
- **Audit Trail**: All security system actions are logged
- **Secure Storage**: Security data stored securely

## Future Enhancements

- Machine learning for anomaly detection
- Integration with external security tools
- Advanced threat intelligence feeds
- Automated penetration testing
- Zero-trust architecture support

## Support

For security-related issues:
1. Check the security dashboard
2. Review security logs
3. Run the security test script
4. Contact the security team

---

*This documentation covers the comprehensive security monitoring system implemented for the Prompt Card System. Regular updates ensure the system stays current with evolving security threats and compliance requirements.*