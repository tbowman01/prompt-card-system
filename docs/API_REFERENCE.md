# API Reference - Complete Documentation

## 🚀 Overview

This comprehensive API reference covers all endpoints in the Prompt Card System, including the new advanced features: Voice Interface, Blockchain Audit, Real-time Collaboration, Multi-tenant Architecture, and Advanced Monitoring.

## 🔗 Base URLs

```
Production:  https://api.promptcard.ai
Staging:     https://staging-api.promptcard.ai  
Development: http://localhost:3001
```

## 🔐 Authentication

### JWT Authentication
```http
Authorization: Bearer <jwt_token>
```

### API Key Authentication
```http
X-API-Key: <api_key>
X-Workspace-ID: <workspace_id>
```

### Multi-Tenant Context
```http
X-Workspace-Slug: <workspace_slug>
X-Workspace-ID: <workspace_id>
```

## 📋 Core API Endpoints

### Prompt Cards

#### List Prompt Cards
```http
GET /api/prompt-cards
```

**Query Parameters:**
- `workspace_id` (string): Filter by workspace
- `limit` (number): Maximum results (default: 20)
- `offset` (number): Pagination offset
- `search` (string): Search term
- `category` (string): Filter by category
- `tags` (array): Filter by tags

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "prompt_123",
      "title": "Customer Service Response",
      "description": "Generate professional customer service responses",
      "prompt_template": "You are a helpful customer service...",
      "variables": ["customer_name", "issue_type"],
      "category": "customer_service",
      "tags": ["support", "automated"],
      "workspace_id": "ws_456",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

#### Create Prompt Card
```http
POST /api/prompt-cards
```

**Request Body:**
```json
{
  "title": "New Prompt Card",
  "description": "Description of the prompt",
  "prompt_template": "Template with {{variables}}",
  "variables": ["variable1", "variable2"],
  "category": "general",
  "tags": ["tag1", "tag2"]
}
```

#### Get Prompt Card
```http
GET /api/prompt-cards/{id}
```

#### Update Prompt Card
```http
PUT /api/prompt-cards/{id}
```

#### Delete Prompt Card
```http
DELETE /api/prompt-cards/{id}
```

### Test Cases

#### List Test Cases
```http
GET /api/test-cases
```

#### Create Test Case
```http
POST /api/test-cases
```

**Request Body:**
```json
{
  "prompt_card_id": "prompt_123",
  "name": "Test Customer Inquiry",
  "input_variables": {
    "customer_name": "John Doe",
    "issue_type": "billing"
  },
  "expected_output": "Expected response text",
  "assertions": [
    {
      "type": "contains",
      "value": "billing"
    },
    {
      "type": "tone",
      "value": "professional"
    }
  ]
}
```

#### Execute Test Case
```http
POST /api/test-cases/{id}/execute
```

**Request Body:**
```json
{
  "model": "gpt-4",
  "temperature": 0.7,
  "max_tokens": 500
}
```

### Parallel Test Execution

#### Batch Execute Tests
```http
POST /api/parallel-test-execution/batch
```

**Request Body:**
```json
{
  "test_case_ids": ["test_1", "test_2", "test_3"],
  "models": ["gpt-4", "claude-3"],
  "parallel_limit": 5,
  "notification_webhook": "https://yourapp.com/webhook"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "batch_id": "batch_789",
    "status": "queued",
    "total_tests": 6,
    "estimated_completion": "2024-01-15T10:35:00Z"
  }
}
```

#### Get Batch Status
```http
GET /api/parallel-test-execution/batch/{batch_id}/status
```

## 📊 Analytics & Monitoring API

### Dashboard Metrics
```http
GET /api/analytics/dashboard
```

**Query Parameters:**
- `timeframe` (string): "24h", "7d", "30d", "90d"
- `workspace_id` (string): Filter by workspace

**Response:**
```json
{
  "success": true,
  "data": {
    "realtime": {
      "activeTests": 5,
      "successRate": 0.87,
      "averageResponseTime": 1250,
      "tokensUsedToday": 45000
    },
    "historical": {
      "totalTests": 2450,
      "overallSuccessRate": 0.92,
      "totalCost": 127.50,
      "topModels": ["gpt-4", "claude-3"]
    }
  }
}
```

### Performance Metrics
```http
GET /api/analytics/performance
```

### Cost Analytics
```http
GET /api/analytics/costs
```

**Response:**
```json
{
  "success": true,
  "data": {
    "currentPeriod": {
      "totalCost": 127.50,
      "tokenCost": 98.30,
      "apiCalls": 1247,
      "averageCostPerTest": 0.052
    },
    "breakdown": {
      "gpt-4": 89.20,
      "claude-3": 38.30
    },
    "trends": [
      {
        "date": "2024-01-14",
        "cost": 15.30,
        "tokens": 12500
      }
    ]
  }
}
```

### Model Health Monitoring
```http
GET /api/analytics/models/health
```

### Advanced Analytics Events
```http
POST /api/analytics/events
```

**Request Body:**
```json
{
  "event_type": "prompt_optimization",
  "entity_type": "prompt_card",
  "entity_id": "prompt_123",
  "data": {
    "optimization_score": 0.85,
    "suggestions": ["Reduce token count", "Improve clarity"]
  }
}
```

## 🎤 Voice Interface API

### Process Voice Command
```http
POST /api/voice/process
```

**Request Body (multipart/form-data):**
```
audio: <audio_file>
user_id: user_123
language: en-US
```

**Response:**
```json
{
  "success": true,
  "data": {
    "text": "I'll help you create a new prompt card called 'Marketing Copy'.",
    "intent": "create_prompt",
    "entities": {
      "name": "Marketing Copy",
      "type": "marketing"
    },
    "confidence": 0.95,
    "actions": ["open_prompt_editor"],
    "suggestions": [
      "Add test cases",
      "Set model parameters"
    ]
  }
}
```

### Text to Speech
```http
POST /api/voice/speak
```

**Request Body:**
```json
{
  "text": "Your test completed successfully with 95% accuracy.",
  "language": "en-US",
  "voice_settings": {
    "speed": 1.0,
    "pitch": 1.0
  }
}
```

### Voice Session Management
```http
POST /api/voice/session/start
POST /api/voice/session/end
GET /api/voice/session/status
```

### Supported Languages
```http
GET /api/voice/languages
```

## 🔗 Blockchain Audit API

### Record Audit Event
```http
POST /api/blockchain/audit/record
```

**Request Body:**
```json
{
  "event_type": "prompt_created",
  "user_id": "user_123",
  "data": {
    "prompt_id": "prompt_456",
    "title": "New Prompt",
    "changes": ["created"]
  },
  "metadata": {
    "ip_address": "192.168.1.100",
    "user_agent": "Mozilla/5.0..."
  }
}
```

### Get Audit Trail
```http
GET /api/blockchain/audit/trail/{entity_id}
```

### Mine Block
```http
POST /api/blockchain/mine
```

### Blockchain Statistics
```http
GET /api/blockchain/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalBlocks": 150,
    "totalEvents": 4500,
    "totalContracts": 12,
    "totalProposals": 8,
    "averageBlockTime": 45000,
    "chainIntegrity": true
  }
}
```

### Smart Contracts
```http
POST /api/blockchain/contracts
GET /api/blockchain/contracts
GET /api/blockchain/contracts/{id}
```

### Governance Proposals
```http
POST /api/blockchain/governance/proposals
GET /api/blockchain/governance/proposals
POST /api/blockchain/governance/proposals/{id}/vote
```

### Quality Tokens
```http
GET /api/blockchain/tokens/balance/{user_id}
POST /api/blockchain/tokens/mint
GET /api/blockchain/tokens/history/{user_id}
```

## 🤝 Collaboration API

### Document Management
```http
GET /api/collaboration/documents
POST /api/collaboration/documents
GET /api/collaboration/documents/{id}
PUT /api/collaboration/documents/{id}
DELETE /api/collaboration/documents/{id}
```

### Document Permissions
```http
GET /api/collaboration/documents/{id}/permissions
PUT /api/collaboration/documents/{id}/permissions
```

**Request Body:**
```json
{
  "owner": "user_123",
  "editors": ["user_456", "user_789"],
  "viewers": ["user_101"],
  "public": false
}
```

### Document Participants
```http
GET /api/collaboration/documents/{id}/participants
```

### Collaboration Metrics
```http
GET /api/collaboration/metrics
```

**Response:**
```json
{
  "success": true,
  "data": {
    "activeDocuments": 25,
    "activeSessions": 8,
    "totalOperations": 1250,
    "averageParticipantsPerDocument": 2.3
  }
}
```

## 🏢 Multi-Tenant API

### Workspace Management

#### List Workspaces
```http
GET /api/workspaces
```

#### Create Workspace
```http
POST /api/workspaces
```

**Request Body:**
```json
{
  "name": "Acme Corporation",
  "slug": "acme-corp",
  "description": "AI testing workspace for Acme",
  "plan_type": "pro"
}
```

#### Get Workspace
```http
GET /api/workspaces/{id}
```

#### Update Workspace Settings
```http
PUT /api/workspaces/{id}/settings
```

**Request Body:**
```json
{
  "enableVoiceInterface": true,
  "enableBlockchainAudit": true,
  "defaultTestTimeout": 30000,
  "customBranding": {
    "logo_url": "https://example.com/logo.png",
    "primary_color": "#1f2937"
  }
}
```

### User Management

#### List Workspace Members
```http
GET /api/workspaces/{id}/members
```

#### Add Workspace Member
```http
POST /api/workspaces/{id}/members
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "role": "member",
  "permissions": {
    "canCreatePrompts": true,
    "canRunTests": true,
    "canViewAnalytics": false
  }
}
```

#### Update Member Role
```http
PUT /api/workspaces/{id}/members/{user_id}
```

#### Remove Member
```http
DELETE /api/workspaces/{id}/members/{user_id}
```

### Invitation Management

#### Send Invitation
```http
POST /api/workspaces/{id}/invitations
```

#### List Pending Invitations
```http
GET /api/workspaces/{id}/invitations
```

#### Accept Invitation
```http
POST /api/invitations/{token}/accept
```

#### Revoke Invitation
```http
DELETE /api/invitations/{id}
```

### Usage & Billing

#### Get Workspace Usage
```http
GET /api/workspaces/{id}/usage
```

**Response:**
```json
{
  "success": true,
  "data": {
    "current_period": {
      "users": 15,
      "prompt_cards": 87,
      "test_executions": 2340,
      "storage_mb": 1250
    },
    "limits": {
      "users": 25,
      "prompt_cards": 500,
      "test_executions": 10000,
      "storage_mb": 5120
    },
    "usage_percentage": {
      "users": 60,
      "prompt_cards": 17.4,
      "test_executions": 23.4,
      "storage": 24.4
    }
  }
}
```

#### Get Billing Events
```http
GET /api/workspaces/{id}/billing/events
```

#### Update Subscription
```http
PUT /api/workspaces/{id}/subscription
```

### API Key Management

#### List API Keys
```http
GET /api/workspaces/{id}/api-keys
```

#### Create API Key
```http
POST /api/workspaces/{id}/api-keys
```

**Request Body:**
```json
{
  "name": "Production API Key",
  "permissions": {
    "prompts:read": true,
    "prompts:write": true,
    "tests:execute": true,
    "analytics:read": false
  },
  "expires_at": "2024-12-31T23:59:59Z"
}
```

#### Revoke API Key
```http
DELETE /api/workspaces/{id}/api-keys/{key_id}
```

## 📊 Advanced Monitoring API

### Health Checks

#### Comprehensive Health
```http
GET /api/health/comprehensive
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "services": {
    "database": {
      "status": "healthy",
      "response_time": 5,
      "details": {
        "connection_pool": "optimal",
        "query_performance": "normal"
      }
    },
    "redis": {
      "status": "healthy",
      "response_time": 2
    },
    "ollama": {
      "status": "healthy",
      "response_time": 150,
      "details": {
        "available_models": ["llama2", "codellama"]
      }
    },
    "websocket": {
      "status": "healthy",
      "active_connections": 25
    }
  },
  "metrics": {
    "uptime": 86400,
    "memory_usage": 0.75,
    "cpu_usage": 0.23
  }
}
```

#### Service-Specific Health
```http
GET /api/health/{service}
```

#### Kubernetes Probes
```http
GET /api/ready
GET /api/live
```

### Metrics Export

#### Prometheus Metrics
```http
GET /api/metrics
```

#### Custom Business Metrics
```http
GET /api/metrics/business
```

### Performance Monitoring

#### Real-time Performance
```http
GET /api/monitoring/performance/realtime
```

#### Performance History
```http
GET /api/monitoring/performance/history
```

**Query Parameters:**
- `timeframe` (string): "1h", "24h", "7d", "30d"
- `metric` (string): "response_time", "throughput", "error_rate"
- `granularity` (string): "1m", "5m", "1h", "1d"

### Alerting

#### Get Active Alerts
```http
GET /api/monitoring/alerts
```

#### Create Alert Rule
```http
POST /api/monitoring/alerts/rules
```

**Request Body:**
```json
{
  "name": "High Error Rate",
  "condition": {
    "metric": "error_rate",
    "operator": ">",
    "threshold": 0.05,
    "duration": "5m"
  },
  "actions": [
    {
      "type": "email",
      "recipients": ["admin@example.com"]
    },
    {
      "type": "slack",
      "webhook": "https://hooks.slack.com/..."
    }
  ]
}
```

#### Update Alert Rule
```http
PUT /api/monitoring/alerts/rules/{id}
```

#### Delete Alert Rule
```http
DELETE /api/monitoring/alerts/rules/{id}
```

## 📄 Report Generation API

### Generate Report
```http
POST /api/reports/generate
```

**Request Body:**
```json
{
  "type": "performance_summary",
  "format": "pdf",
  "timeframe": "last_30_days",
  "filters": {
    "workspace_id": "ws_123",
    "models": ["gpt-4", "claude-3"]
  },
  "options": {
    "include_charts": true,
    "include_raw_data": false,
    "template": "executive_summary"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "report_id": "report_456",
    "status": "generating",
    "estimated_completion": "2024-01-15T10:35:00Z",
    "download_url": null
  }
}
```

### Get Report Status
```http
GET /api/reports/{id}/status
```

### Download Report
```http
GET /api/reports/{id}/download
```

### List Reports
```http
GET /api/reports
```

### Schedule Report
```http
POST /api/reports/schedule
```

**Request Body:**
```json
{
  "name": "Weekly Performance Report",
  "template": "performance_summary",
  "schedule": "0 9 * * 1",
  "recipients": ["manager@example.com"],
  "format": "pdf"
}
```

## 🔧 Configuration API

### Get System Configuration
```http
GET /api/config
```

### Update Configuration
```http
PUT /api/config
```

### Feature Flags
```http
GET /api/config/features
PUT /api/config/features
```

**Request Body:**
```json
{
  "voice_interface": true,
  "blockchain_audit": true,
  "collaboration": true,
  "advanced_analytics": true,
  "multi_tenant": true
}
```

## 🔒 Security API

### Security Scan
```http
POST /api/security/scan
```

**Request Body:**
```json
{
  "target": "prompt_card",
  "target_id": "prompt_123",
  "scan_types": ["toxicity", "bias", "privacy", "injection"]
}
```

### Audit Logs
```http
GET /api/security/audit-logs
```

**Query Parameters:**
- `workspace_id` (string): Filter by workspace
- `user_id` (string): Filter by user
- `action` (string): Filter by action type
- `resource_type` (string): Filter by resource type
- `start_date` (string): ISO date string
- `end_date` (string): ISO date string

## 📡 WebSocket Events

### Connection
```javascript
const socket = io('ws://localhost:3001', {
  auth: {
    token: 'jwt_token',
    workspace_id: 'ws_123'
  }
});
```

### Real-time Events

#### Test Execution Progress
```javascript
socket.on('test_progress', (data) => {
  console.log('Test progress:', data);
  // { test_id, progress_percentage, stage, eta }
});
```

#### Analytics Updates
```javascript
socket.on('analytics_update', (data) => {
  console.log('Analytics update:', data);
  // { metric_type, current_value, change_percentage }
});
```

#### Collaboration Events
```javascript
// Document operations
socket.on('operation', (operation) => {
  // Apply operational transform
});

// User presence
socket.on('user_joined', (user) => {
  // Update participant list
});

// Cursor updates
socket.on('cursor_update', (cursor) => {
  // Update cursor positions
});
```

#### Voice Commands
```javascript
socket.on('voice_command_processed', (result) => {
  console.log('Voice command result:', result);
  // { intent, entities, actions, response_text }
});
```

#### Blockchain Events
```javascript
socket.on('block_mined', (block) => {
  console.log('New block mined:', block);
  // { index, hash, events_count, timestamp }
});

socket.on('quality_tokens_minted', (event) => {
  console.log('Tokens minted:', event);
  // { user_id, amount, reason }
});
```

## 📊 Error Handling

### Standard Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input parameters",
    "details": {
      "field": "email",
      "reason": "Invalid email format"
    },
    "request_id": "req_abc123"
  }
}
```

### Common Error Codes
- `AUTHENTICATION_REQUIRED` (401)
- `INSUFFICIENT_PERMISSIONS` (403)
- `RESOURCE_NOT_FOUND` (404)
- `VALIDATION_ERROR` (400)
- `RATE_LIMIT_EXCEEDED` (429)
- `INTERNAL_SERVER_ERROR` (500)
- `SERVICE_UNAVAILABLE` (503)
- `WORKSPACE_LIMIT_EXCEEDED` (402)
- `FEATURE_NOT_ENABLED` (422)

## 📈 Rate Limiting

### Rate Limit Headers
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642678800
X-RateLimit-Window: 3600
```

### Limits by Plan
- **Free**: 100 requests/hour
- **Pro**: 1000 requests/hour  
- **Enterprise**: 10000 requests/hour
- **API Keys**: Custom limits per key

## 📚 SDKs & Libraries

### JavaScript/TypeScript
```bash
npm install @promptcard/sdk
```

```javascript
import { PromptCardSDK } from '@promptcard/sdk';

const sdk = new PromptCardSDK({
  apiKey: 'your_api_key',
  workspaceId: 'ws_123',
  baseUrl: 'https://api.promptcard.ai'
});

// Use the SDK
const prompts = await sdk.prompts.list();
const result = await sdk.tests.execute('test_123');
```

### Python
```bash
pip install promptcard-sdk
```

```python
from promptcard import PromptCardClient

client = PromptCardClient(
    api_key='your_api_key',
    workspace_id='ws_123'
)

prompts = client.prompts.list()
result = client.tests.execute('test_123')
```

---

**This API reference provides complete documentation for all system capabilities. For more detailed examples and use cases, see the individual feature guides.**