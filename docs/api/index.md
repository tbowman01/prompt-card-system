# API Reference

The Prompt Card System provides a comprehensive RESTful API for all platform operations. This documentation covers all endpoints, authentication methods, and integration patterns.

## 🔑 Quick Start

```bash
# Set your API key
export API_KEY="your-api-key"

# Test the API
curl -H "X-API-Key: $API_KEY" \
  https://api.prompt-card-system.com/api/health
```

## 📋 Base Information

- **Base URL**: `https://api.prompt-card-system.com/api`
- **Version**: `v1`
- **Format**: JSON
- **Authentication**: API Key or JWT
- **Rate Limits**: 1000 requests/hour (authenticated), 100 requests/hour (anonymous)

## 🔐 Authentication

### API Key Authentication
```bash
curl -H "X-API-Key: your-api-key" \
  https://api.prompt-card-system.com/api/prompt-cards
```

### JWT Bearer Token
```bash
curl -H "Authorization: Bearer your-jwt-token" \
  https://api.prompt-card-system.com/api/prompt-cards
```

### Authentication Endpoints

#### POST `/auth/login`
Authenticate user and receive JWT token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secure-password"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "role": "user"
  },
  "expiresIn": "24h"
}
```

#### POST `/auth/api-keys`
Generate new API key.

**Request:**
```json
{
  "name": "my-integration",
  "permissions": ["read", "write"],
  "expiresIn": "90d"
}
```

**Response:**
```json
{
  "key": "pk_live_abc123...",
  "name": "my-integration",
  "permissions": ["read", "write"],
  "expiresAt": "2024-04-01T00:00:00Z"
}
```

## 🃏 Prompt Cards API

### GET `/prompt-cards`
List all prompt cards with pagination and filtering.

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20, max: 100)
- `category` (string): Filter by category
- `search` (string): Search in title and content
- `tags` (string[]): Filter by tags

**Example:**
```bash
curl "https://api.prompt-card-system.com/api/prompt-cards?category=development&limit=10"
```

**Response:**
```json
{
  "data": [
    {
      "id": "pc-123",
      "title": "Code Review Assistant",
      "prompt": "Review this code for best practices: {{code}}",
      "variables": ["code"],
      "category": "development",
      "tags": ["code-review", "quality"],
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z",
      "stats": {
        "totalRuns": 156,
        "successRate": 94.2,
        "avgResponseTime": 1.2
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "totalPages": 5
  }
}
```

### POST `/prompt-cards`
Create a new prompt card.

**Request:**
```json
{
  "title": "SQL Query Generator",
  "prompt": "Generate a SQL query for: {{description}}",
  "variables": ["description"],
  "category": "database",
  "tags": ["sql", "generation"],
  "metadata": {
    "author": "john-doe",
    "difficulty": "intermediate"
  }
}
```

**Response:**
```json
{
  "id": "pc-124",
  "title": "SQL Query Generator",
  "prompt": "Generate a SQL query for: {{description}}",
  "variables": ["description"],
  "category": "database",
  "tags": ["sql", "generation"],
  "createdAt": "2024-01-16T09:15:00Z",
  "updatedAt": "2024-01-16T09:15:00Z"
}
```

### GET `/prompt-cards/{id}`
Get a specific prompt card by ID.

**Response:**
```json
{
  "id": "pc-123",
  "title": "Code Review Assistant",
  "prompt": "Review this code for best practices: {{code}}",
  "variables": ["code"],
  "category": "development",
  "tags": ["code-review", "quality"],
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z",
  "testCases": [
    {
      "id": "tc-456",
      "name": "JavaScript Function Review",
      "variableValues": {
        "code": "function add(a, b) { return a + b; }"
      }
    }
  ],
  "analytics": {
    "totalRuns": 156,
    "successRate": 94.2,
    "avgResponseTime": 1.2,
    "costMetrics": {
      "totalTokens": 12450,
      "estimatedCost": 0.25
    }
  }
}
```

### PUT `/prompt-cards/{id}`
Update an existing prompt card.

### DELETE `/prompt-cards/{id}`
Delete a prompt card.

## 🧪 Test Cases API

### GET `/test-cases`
List test cases with filtering options.

**Query Parameters:**
- `promptCardId` (string): Filter by prompt card
- `status` (string): Filter by status (pending, running, completed, failed)
- `page`, `limit`: Pagination

### POST `/test-cases`
Create a new test case.

**Request:**
```json
{
  "name": "API Documentation Test",
  "promptCardId": "pc-123",
  "variableValues": {
    "code": "const api = express(); api.get('/health', (req, res) => res.json({status: 'ok'}));"
  },
  "expectedOutputs": [
    {
      "type": "contains",
      "value": "This code looks good"
    },
    {
      "type": "sentiment",
      "value": "positive"
    }
  ]
}
```

### POST `/test-cases/{id}/execute`
Execute a single test case.

**Response:**
```json
{
  "id": "execution-789",
  "testCaseId": "tc-456",
  "status": "running",
  "startedAt": "2024-01-16T10:00:00Z",
  "progress": {
    "currentStep": "llm-processing",
    "completedSteps": 2,
    "totalSteps": 5
  }
}
```

### POST `/test-cases/execute-batch`
Execute multiple test cases in parallel.

**Request:**
```json
{
  "testCaseIds": ["tc-456", "tc-457", "tc-458"],
  "options": {
    "maxConcurrency": 3,
    "timeoutMs": 30000,
    "retryCount": 2
  }
}
```

## 📊 Analytics API

### GET `/analytics/dashboard`
Get dashboard metrics and KPIs.

**Response:**
```json
{
  "overview": {
    "totalPromptCards": 45,
    "totalTestCases": 234,
    "totalExecutions": 1567,
    "successRate": 92.4
  },
  "performance": {
    "avgResponseTime": 1.8,
    "p95ResponseTime": 3.2,
    "throughput": 45.6
  },
  "costs": {
    "totalTokens": 145670,
    "estimatedCost": 12.45,
    "costPerExecution": 0.008
  },
  "trends": {
    "executionsToday": 89,
    "executionsYesterday": 76,
    "weeklyGrowth": 15.2
  }
}
```

### GET `/analytics/performance`
Get detailed performance metrics.

**Query Parameters:**
- `timeRange` (string): 1h, 24h, 7d, 30d
- `promptCardId` (string): Filter by prompt card
- `aggregation` (string): minute, hour, day

### GET `/analytics/costs`
Get cost analysis and token usage.

**Response:**
```json
{
  "summary": {
    "totalCost": 12.45,
    "totalTokens": 145670,
    "avgCostPerExecution": 0.008
  },
  "breakdown": {
    "byModel": {
      "gpt-4": { "cost": 8.30, "tokens": 85000 },
      "gpt-3.5-turbo": { "cost": 4.15, "tokens": 60670 }
    },
    "byPromptCard": [
      {
        "id": "pc-123",
        "title": "Code Review Assistant",
        "cost": 2.45,
        "executions": 156
      }
    ]
  },
  "projections": {
    "monthlyEstimate": 374.50,
    "dailyAverage": 12.48
  }
}
```

## 🤖 AI Optimization API

### POST `/optimization/analyze`
Analyze a prompt for optimization opportunities.

**Request:**
```json
{
  "prompt": "Write a function that does something useful",
  "context": {
    "domain": "software-development",
    "difficulty": "intermediate",
    "audience": "developers"
  }
}
```

**Response:**
```json
{
  "score": 6.5,
  "issues": [
    {
      "type": "clarity",
      "severity": "medium",
      "description": "Prompt lacks specific requirements",
      "suggestion": "Specify what the function should do and what parameters it should accept"
    },
    {
      "type": "context",
      "severity": "low",
      "description": "Missing programming language specification",
      "suggestion": "Specify the target programming language"
    }
  ],
  "suggestions": [
    {
      "type": "improved_prompt",
      "content": "Write a JavaScript function that takes two parameters (name and age) and returns a greeting message. Include parameter validation and JSDoc comments.",
      "expectedImprovement": 25
    }
  ]
}
```

### POST `/optimization/suggest`
Get AI-powered suggestions for prompt improvement.

### GET `/optimization/security-scan`
Scan prompt for security and safety issues.

## 🔄 Real-time API

### WebSocket `/ws/progress`
Real-time test execution progress updates.

**Connection:**
```javascript
const ws = new WebSocket('wss://api.prompt-card-system.com/ws/progress');

ws.on('message', (data) => {
  const update = JSON.parse(data);
  console.log('Progress update:', update);
});
```

**Message Format:**
```json
{
  "type": "execution_progress",
  "executionId": "exec-789",
  "progress": {
    "currentStep": "llm-processing",
    "completedSteps": 3,
    "totalSteps": 5,
    "percentage": 60
  },
  "timestamp": "2024-01-16T10:05:30Z"
}
```

## 📄 Reports API

### POST `/reports/generate`
Generate comprehensive reports.

**Request:**
```json
{
  "type": "performance",
  "format": "pdf",
  "timeRange": "7d",
  "filters": {
    "promptCardIds": ["pc-123", "pc-124"],
    "includeCharts": true,
    "includeRawData": false
  }
}
```

**Response:**
```json
{
  "reportId": "report-456",
  "status": "generating",
  "estimatedTime": "2 minutes",
  "downloadUrl": null
}
```

### GET `/reports/{id}`
Get report status and download link.

### GET `/reports/{id}/download`
Download generated report file.

## 🔧 System API

### GET `/health`
System health check.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-16T10:00:00Z",
  "version": "1.0.1",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "llm_providers": {
      "openai": "healthy",
      "anthropic": "healthy",
      "ollama": "degraded"
    }
  },
  "metrics": {
    "uptime": "5d 12h 30m",
    "requestCount": 45670,
    "errorRate": 0.02
  }
}
```

### GET `/metrics`
Prometheus-formatted metrics for monitoring.

### GET `/openapi.json`
OpenAPI 3.0 specification document.

## 📚 SDKs and Libraries

### JavaScript/TypeScript
```bash
npm install @prompt-card-system/sdk
```

```javascript
import { PromptCardSystem } from '@prompt-card-system/sdk';

const client = new PromptCardSystem({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.prompt-card-system.com'
});

// Create a prompt card
const promptCard = await client.promptCards.create({
  title: 'My Prompt',
  prompt: 'Generate code for: {{description}}',
  variables: ['description']
});

// Execute a test case
const execution = await client.testCases.execute('tc-123');
```

### Python
```bash
pip install prompt-card-system
```

```python
from prompt_card_system import Client

client = Client(api_key='your-api-key')

# List prompt cards
cards = client.prompt_cards.list(category='development')

# Create and execute test case
test_case = client.test_cases.create({
    'name': 'Python Test',
    'promptCardId': 'pc-123',
    'variableValues': {'code': 'print("hello")'}
})

execution = client.test_cases.execute(test_case.id)
```

## 🚨 Error Handling

All API errors follow a consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "variables",
        "message": "Required field missing"
      }
    ],
    "requestId": "req-abc123"
  }
}
```

### Common Error Codes
- `AUTHENTICATION_ERROR` (401): Invalid API key or token
- `AUTHORIZATION_ERROR` (403): Insufficient permissions
- `VALIDATION_ERROR` (400): Invalid request parameters
- `NOT_FOUND` (404): Resource not found
- `RATE_LIMITED` (429): Rate limit exceeded
- `INTERNAL_ERROR` (500): Server error

## 📈 Rate Limits

| Tier | Requests/Hour | Burst |
|------|---------------|-------|
| Free | 100 | 10 |
| Pro | 1,000 | 50 |
| Enterprise | 10,000 | 200 |

Rate limit headers:
- `X-RateLimit-Limit`: Requests per hour limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset timestamp

## 🔗 Webhooks

Configure webhooks to receive real-time notifications:

### POST `/webhooks`
Create a webhook endpoint.

**Request:**
```json
{
  "url": "https://your-app.com/webhooks/prompt-card-system",
  "events": ["test_completed", "prompt_card_created"],
  "secret": "your-webhook-secret"
}
```

### Webhook Events
- `test_completed`: Test execution finished
- `prompt_card_created`: New prompt card created
- `prompt_card_updated`: Prompt card modified
- `system_alert`: System alert triggered

**Event Payload:**
```json
{
  "event": "test_completed",
  "timestamp": "2024-01-16T10:00:00Z",
  "data": {
    "executionId": "exec-789",
    "testCaseId": "tc-456",
    "status": "completed",
    "results": { /* execution results */ }
  }
}
```

---

## 🆘 Support

- **📖 API Documentation**: You're reading it!
- **🔧 Interactive API Explorer**: [https://api.prompt-card-system.com/docs](https://api.prompt-card-system.com/docs)
- **💬 Discord Community**: [Join our Discord](https://discord.gg/prompt-card-system)
- **📧 Email Support**: api-support@prompt-card-system.com