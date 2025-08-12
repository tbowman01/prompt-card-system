# Configuration Guide

Customize the Prompt Card System to meet your organization's specific needs with comprehensive configuration options.

## ⚙️ Configuration Overview

The system offers extensive configuration options for:
- **System Settings**: Core platform behavior and features
- **User Preferences**: Individual user customization
- **Team Settings**: Workspace and collaboration configuration
- **Security Settings**: Access control and security policies
- **Integration Settings**: External tool and API connections

## 🚀 Getting Started with Configuration

### Accessing Settings
1. **Personal Settings**: Click your profile icon → "Settings"
2. **Team Settings**: In workspace, click "Settings" → "Team Configuration"
3. **System Settings**: Admin access via "System" → "Configuration"
4. **API Configuration**: In "Settings" → "Integrations" → "API Settings"

### Configuration Hierarchy
Settings are applied in order of precedence:
1. **System Defaults**: Built-in default values
2. **Organization Policies**: Company-wide settings
3. **Team Settings**: Workspace-specific configuration
4. **User Preferences**: Individual user customization

## 👤 User Preferences

### Interface Settings
Customize your personal experience:

```json
{
  "interface": {
    "theme": "light",
    "compactMode": false,
    "sidebarCollapsed": false,
    "defaultPageSize": 25,
    "showTutorialTips": true
  }
}
```

**Available Options:**
- **Theme**: `light`, `dark`, `auto` (follows system)
- **Compact Mode**: Reduces spacing and UI elements
- **Sidebar**: Auto-collapse left navigation
- **Page Size**: Number of items per page (10, 25, 50, 100)
- **Tutorial Tips**: Show helpful tooltips and guides

### Editor Preferences
Customize the prompt editing experience:

```json
{
  "editor": {
    "fontSize": 14,
    "lineHeight": 1.5,
    "wordWrap": true,
    "showLineNumbers": true,
    "autoSave": true,
    "autoSaveInterval": 30000,
    "syntaxHighlighting": true,
    "autoComplete": true
  }
}
```

### Notification Settings
Control what notifications you receive:

```json
{
  "notifications": {
    "email": {
      "enabled": true,
      "frequency": "immediate",
      "digest": "daily",
      "types": ["mentions", "reviews", "system"]
    },
    "browser": {
      "enabled": true,
      "sound": false,
      "desktop": true
    },
    "mobile": {
      "enabled": true,
      "quietHours": {
        "start": "22:00",
        "end": "07:00",
        "timezone": "UTC"
      }
    }
  }
}
```

## 🏢 Team Configuration

### Workspace Settings
Configure team workspace behavior:

```json
{
  "workspace": {
    "name": "Marketing Team",
    "description": "Collaborative prompt development for marketing",
    "visibility": "private",
    "defaultRole": "contributor",
    "features": {
      "realTimeCollaboration": true,
      "versionControl": true,
      "approvalWorkflows": true,
      "guestAccess": false
    },
    "retention": {
      "versions": 50,
      "deletedItems": "30d",
      "auditLogs": "1y"
    }
  }
}
```

### Team Roles and Permissions
Define custom roles beyond the default set:

```json
{
  "customRoles": [
    {
      "name": "prompt-reviewer",
      "displayName": "Prompt Reviewer",
      "permissions": [
        "read:all",
        "comment:all",
        "approve:prompts",
        "edit:own"
      ],
      "restrictions": [
        "delete:none",
        "admin:none"
      ]
    }
  ]
}
```

### Collaboration Rules
Set team collaboration guidelines:

```json
{
  "collaboration": {
    "editing": {
      "lockTimeout": "30min",
      "maxSimultaneousEditors": 5,
      "autoSave": true,
      "conflictResolution": "operational-transform"
    },
    "reviews": {
      "required": true,
      "selfReview": false,
      "minimumReviewers": 2,
      "approvalThreshold": 0.8
    },
    "versioning": {
      "autoVersion": true,
      "versionOnApproval": true,
      "majorVersionThreshold": 0.3
    }
  }
}
```

## 🔒 Security Configuration

### Authentication Settings
Configure user authentication:

```json
{
  "authentication": {
    "methods": ["password", "oauth", "saml"],
    "passwordPolicy": {
      "minLength": 8,
      "requireUppercase": true,
      "requireLowercase": true,
      "requireNumbers": true,
      "requireSymbols": true,
      "maxAge": "90d"
    },
    "twoFactor": {
      "required": true,
      "methods": ["totp", "sms", "email"],
      "backupCodes": true
    },
    "sessions": {
      "timeout": "8h",
      "extendOnActivity": true,
      "maxConcurrent": 3
    }
  }
}
```

### Access Control
Define access control policies:

```json
{
  "accessControl": {
    "ipRestrictions": {
      "enabled": true,
      "whitelist": [
        "192.168.1.0/24",
        "10.0.0.0/8"
      ]
    },
    "deviceTrust": {
      "enabled": true,
      "requireRegistration": true,
      "trustedDeviceTimeout": "30d"
    },
    "dataLoss": {
      "preventCopyPaste": false,
      "preventDownload": false,
      "preventScreenshot": false,
      "watermarks": true
    }
  }
}
```

### Audit and Compliance
Configure audit logging and compliance:

```json
{
  "audit": {
    "logging": {
      "enabled": true,
      "level": "detailed",
      "retention": "7y",
      "encryption": true
    },
    "events": [
      "user.login",
      "user.logout",
      "content.create",
      "content.edit",
      "content.delete",
      "permission.change",
      "export.data"
    ],
    "compliance": {
      "gdpr": true,
      "soc2": true,
      "hipaa": false
    }
  }
}
```

## 🤖 LLM Provider Configuration

### Provider Settings
Configure multiple LLM providers:

```json
{
  "llmProviders": [
    {
      "name": "openai",
      "enabled": true,
      "apiKey": "${OPENAI_API_KEY}",
      "models": ["gpt-4", "gpt-3.5-turbo"],
      "defaultModel": "gpt-3.5-turbo",
      "rateLimits": {
        "requestsPerMinute": 50,
        "tokensPerMinute": 40000
      },
      "timeout": 30000,
      "retries": 3
    },
    {
      "name": "anthropic",
      "enabled": true,
      "apiKey": "${ANTHROPIC_API_KEY}",
      "models": ["claude-3-opus", "claude-3-sonnet"],
      "defaultModel": "claude-3-sonnet",
      "rateLimits": {
        "requestsPerMinute": 30,
        "tokensPerMinute": 30000
      }
    },
    {
      "name": "ollama",
      "enabled": true,
      "baseUrl": "http://localhost:11434",
      "models": ["llama2", "codellama"],
      "defaultModel": "llama2",
      "local": true
    }
  ]
}
```

### Model Selection Strategy
Configure automatic model selection:

```json
{
  "modelSelection": {
    "strategy": "cost-optimized",
    "fallbacks": {
      "enabled": true,
      "order": ["gpt-3.5-turbo", "claude-3-sonnet", "llama2"]
    },
    "routing": {
      "simple": "gpt-3.5-turbo",
      "complex": "gpt-4",
      "code": "codellama",
      "creative": "claude-3-opus"
    },
    "costLimits": {
      "perRequest": 0.10,
      "perUser": 50.00,
      "perWorkspace": 500.00
    }
  }
}
```

## 📊 Performance Configuration

### System Performance
Configure system performance settings:

```json
{
  "performance": {
    "caching": {
      "enabled": true,
      "ttl": "1h",
      "maxSize": "500MB",
      "compression": true
    },
    "parallelExecution": {
      "enabled": true,
      "maxConcurrency": 10,
      "queueSize": 100,
      "timeout": "5m"
    },
    "database": {
      "connectionPool": 20,
      "queryTimeout": "30s",
      "slowQueryThreshold": "1s"
    },
    "monitoring": {
      "metrics": true,
      "tracing": true,
      "alerting": true
    }
  }
}
```

### Resource Limits
Set resource consumption limits:

```json
{
  "limits": {
    "users": {
      "maxPromptsPerUser": 1000,
      "maxTestsPerDay": 10000,
      "maxStoragePerUser": "1GB"
    },
    "workspace": {
      "maxUsers": 100,
      "maxPrompts": 10000,
      "maxStorage": "10GB"
    },
    "system": {
      "maxConcurrentTests": 50,
      "maxRequestRate": "1000/min",
      "maxFileSize": "10MB"
    }
  }
}
```

## 🔗 Integration Configuration

### API Settings
Configure API access and security:

```json
{
  "api": {
    "enabled": true,
    "version": "v1",
    "rateLimit": {
      "requests": "1000/hour",
      "burst": 50
    },
    "authentication": {
      "methods": ["apikey", "oauth", "jwt"],
      "keyRotation": "90d"
    },
    "cors": {
      "enabled": true,
      "origins": ["https://your-app.com"],
      "credentials": true
    },
    "documentation": {
      "swagger": true,
      "examples": true,
      "testing": true
    }
  }
}
```

### Webhook Configuration
Set up webhook integrations:

```json
{
  "webhooks": [
    {
      "name": "slack-notifications",
      "url": "https://hooks.slack.com/services/...",
      "events": [
        "test.completed",
        "prompt.approved",
        "error.occurred"
      ],
      "authentication": {
        "type": "bearer",
        "token": "${SLACK_WEBHOOK_TOKEN}"
      },
      "retries": 3,
      "timeout": "10s"
    }
  ]
}
```

### Third-party Integrations
Configure external service connections:

```json
{
  "integrations": {
    "github": {
      "enabled": true,
      "token": "${GITHUB_TOKEN}",
      "organization": "your-org",
      "features": ["issues", "webhooks", "actions"]
    },
    "jira": {
      "enabled": true,
      "baseUrl": "https://your-org.atlassian.net",
      "credentials": {
        "email": "admin@your-org.com",
        "token": "${JIRA_API_TOKEN}"
      }
    },
    "monitoring": {
      "prometheus": {
        "enabled": true,
        "endpoint": "/metrics",
        "scrapeInterval": "30s"
      },
      "grafana": {
        "enabled": true,
        "dashboards": true,
        "alerts": true
      }
    }
  }
}
```

## 📧 Email Configuration

### SMTP Settings
Configure email delivery:

```json
{
  "email": {
    "smtp": {
      "host": "smtp.gmail.com",
      "port": 587,
      "secure": false,
      "auth": {
        "user": "notifications@your-company.com",
        "password": "${SMTP_PASSWORD}"
      }
    },
    "from": {
      "name": "Prompt Card System",
      "email": "notifications@your-company.com"
    },
    "templates": {
      "path": "./email-templates",
      "engine": "handlebars"
    }
  }
}
```

### Email Templates
Customize email notifications:

```json
{
  "emailTemplates": {
    "welcome": {
      "subject": "Welcome to {{workspaceName}}",
      "template": "welcome.hbs"
    },
    "testResults": {
      "subject": "Test Results: {{promptName}}",
      "template": "test-results.hbs"
    },
    "reviewRequest": {
      "subject": "Review Request: {{promptName}}",
      "template": "review-request.hbs"
    }
  }
}
```

## 📱 Mobile Configuration

### Mobile App Settings
Configure mobile application behavior:

```json
{
  "mobile": {
    "features": {
      "offlineMode": true,
      "pushNotifications": true,
      "biometricAuth": true,
      "cameraAccess": true
    },
    "sync": {
      "interval": "5min",
      "onlyOnWifi": false,
      "backgroundSync": true
    },
    "security": {
      "pinRequired": false,
      "sessionTimeout": "1h",
      "remoteLock": true
    }
  }
}
```

## 🔧 Advanced Configuration

### Environment Variables
Key environment variables for configuration:

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost/promptcards
DATABASE_POOL_SIZE=20

# Redis Cache
REDIS_URL=redis://localhost:6379
REDIS_TTL=3600

# LLM Providers
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
OLLAMA_BASE_URL=http://localhost:11434

# Security
JWT_SECRET=your-jwt-secret
SESSION_SECRET=your-session-secret
ENCRYPTION_KEY=your-encryption-key

# Features
ENABLE_COLLABORATION=true
ENABLE_ANALYTICS=true
ENABLE_WEBHOOKS=true

# Monitoring
PROMETHEUS_ENABLED=true
GRAFANA_ENABLED=true
LOG_LEVEL=info
```

### Configuration Files
Organize configuration using multiple files:

```yaml
# config/default.yaml
server:
  port: 3000
  host: "0.0.0.0"

database:
  type: postgresql
  pool: 20
  timeout: 30s

# config/production.yaml
logging:
  level: warn
  format: json

security:
  tls:
    enabled: true
    cert: /etc/ssl/cert.pem
    key: /etc/ssl/key.pem
```

## 🎯 Configuration Best Practices

### Security
1. **Environment Variables**: Store secrets in environment variables
2. **Least Privilege**: Grant minimum necessary permissions
3. **Regular Rotation**: Rotate API keys and secrets regularly
4. **Audit Trail**: Log all configuration changes

### Performance
1. **Resource Monitoring**: Monitor resource usage patterns
2. **Scaling Strategy**: Plan for growth and usage spikes
3. **Caching**: Use caching effectively for better performance
4. **Database Optimization**: Tune database settings for workload

### Management
1. **Version Control**: Store configuration in version control
2. **Documentation**: Document all custom settings
3. **Testing**: Test configuration changes in staging first
4. **Rollback Plan**: Have a plan to revert configuration changes

## 🔄 Configuration Management

### Infrastructure as Code
Manage configuration with code:

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    image: prompt-cards:latest
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    configs:
      - source: app-config
        target: /app/config/production.yaml

configs:
  app-config:
    file: ./config/production.yaml
```

### Configuration Validation
Validate configuration before deployment:

```javascript
const configSchema = {
  type: 'object',
  required: ['database', 'llmProviders'],
  properties: {
    database: {
      type: 'object',
      required: ['url'],
      properties: {
        url: { type: 'string', format: 'uri' }
      }
    }
  }
};

function validateConfig(config) {
  const valid = ajv.validate(configSchema, config);
  if (!valid) {
    throw new Error(`Invalid configuration: ${ajv.errorsText()}`);
  }
}
```

---

**Next Steps**: Learn about common [Workflows and Use Cases](./workflows.md) to apply these configuration options effectively.