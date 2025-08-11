# API Documentation

## Overview

This document provides comprehensive documentation for the Prompt Card System REST API and WebSocket interfaces. The API follows RESTful principles and provides real-time communication through WebSocket connections.

**Base URL:** `http://localhost:3001/api`  
**WebSocket URL:** `ws://localhost:3001`

## Authentication

### JWT Token Authentication

The API uses JWT (JSON Web Token) based authentication for secure access.

#### Headers
```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
X-CSRF-Token: <csrf_token>
```

## Error Handling

### Standard Error Response
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### HTTP Status Codes
- `200 OK` - Request successful
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource already exists
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

## Authentication Endpoints

### POST `/auth/login`
Authenticate user and receive access tokens.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "1",
      "email": "user@example.com",
      "role": "user",
      "permissions": ["read", "write"],
      "lastLogin": "2024-01-15T10:00:00.000Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 3600
    }
  }
}
```

### POST `/auth/register`
Register new user account.

**Request:**
```json
{
  "email": "newuser@example.com",
  "password": "securePassword123!",
  "confirmPassword": "securePassword123!"
}
```

### POST `/auth/refresh`
Refresh expired access token.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### POST `/auth/logout`
Logout and invalidate tokens.

### GET `/auth/me`
Get current user information.

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "1",
      "email": "user@example.com",
      "role": "user",
      "permissions": ["read", "write"],
      "createdAt": "2024-01-01T00:00:00.000Z",
      "lastLogin": "2024-01-15T10:00:00.000Z"
    }
  }
}
```

## Prompt Card Management

### GET `/prompt-cards`
Retrieve all prompt cards with pagination and search.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `search` (optional): Search term for title/description

**Example Request:**
```bash
curl -X GET "http://localhost:3001/api/prompt-cards?page=1&limit=10&search=sentiment" \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Sentiment Analysis",
      "description": "Analyze sentiment of text",
      "prompt_template": "Analyze the sentiment of: {{text}}",
      "variables": ["text"],
      "test_case_count": 5,
      "created_at": "2024-01-15T10:00:00.000Z",
      "updated_at": "2024-01-15T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### GET `/prompt-cards/:id`
Get specific prompt card with test cases.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Sentiment Analysis",
    "description": "Analyze sentiment of text",
    "prompt_template": "Analyze the sentiment of: {{text}}",
    "variables": ["text"],
    "created_at": "2024-01-15T10:00:00.000Z",
    "updated_at": "2024-01-15T10:00:00.000Z",
    "test_cases": [
      {
        "id": 1,
        "name": "Positive sentiment",
        "input_variables": {
          "text": "I love this product!"
        },
        "expected_output": "positive",
        "assertions": [
          {
            "type": "contains",
            "value": "positive",
            "description": "Should identify positive sentiment"
          }
        ]
      }
    ]
  }
}
```

### POST `/prompt-cards`
Create new prompt card.

**Request:**
```json
{
  "title": "Translation Prompt",
  "description": "Translate text between languages",
  "prompt_template": "Translate '{{text}}' from {{source_lang}} to {{target_lang}}",
  "variables": ["text", "source_lang", "target_lang"]
}
```

### PUT `/prompt-cards/:id`
Update existing prompt card.

### DELETE `/prompt-cards/:id`
Delete prompt card and associated test cases.

## Test Case Management

### GET `/test-cases/prompt-cards/:promptCardId/test-cases`
Get all test cases for a prompt card.

### GET `/test-cases/:id`
Get specific test case.

### POST `/test-cases`
Create new test case.

**Request:**
```json
{
  "prompt_card_id": 1,
  "name": "Positive sentiment test",
  "input_variables": {
    "text": "I love this product!"
  },
  "expected_output": "positive",
  "assertions": [
    {
      "type": "contains",
      "value": "positive",
      "description": "Should contain 'positive'"
    }
  ]
}
```

### PUT `/test-cases/:id`
Update test case.

### DELETE `/test-cases/:id`
Delete test case.

## Test Execution

### POST `/test-cases/:id/execute`
Execute single test case.

**Request:**
```json
{
  "model": "llama3.1:8b"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "execution_id": "exec_123456",
    "test_case_id": 1,
    "passed": true,
    "llm_output": "The sentiment is positive.",
    "assertion_results": [
      {
        "type": "contains",
        "value": "positive",
        "passed": true,
        "message": "Found 'positive' in output"
      }
    ],
    "execution_time_ms": 2500,
    "model": "llama3.1:8b",
    "prompt_used": "Analyze the sentiment of: I love this product!"
  }
}
```

### POST `/test-cases/prompt-cards/:id/execute-all`
Execute all test cases for a prompt card.

**Request:**
```json
{
  "model": "llama3.1:8b",
  "stopOnFirstFailure": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "execution_id": "batch_123456",
    "prompt_card_id": 1,
    "total_tests": 3,
    "passed_tests": 2,
    "failed_tests": 1,
    "overall_passed": false,
    "execution_time_ms": 7500,
    "results": [
      {
        "execution_id": "exec_123456",
        "test_case_id": 1,
        "passed": true,
        "llm_output": "The sentiment is positive.",
        "assertion_results": [...],
        "execution_time_ms": 2500,
        "model": "llama3.1:8b",
        "prompt_used": "..."
      }
    ]
  }
}
```

### POST `/test-cases/execute-parallel`
Execute test cases in parallel with queue management.

**Request:**
```json
{
  "prompt_card_id": 1,
  "test_case_ids": [1, 2, 3],
  "model": "llama3.1:8b",
  "configuration": {
    "max_concurrent_tests": 3,
    "timeout_per_test": 30000,
    "retry_failed_tests": false,
    "max_retries": 1,
    "resource_limits": {
      "memory_mb": 1024,
      "cpu_percent": 50
    }
  },
  "priority": 0
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "execution_id": "parallel_123456",
    "status": "queued",
    "message": "Test execution queued successfully"
  }
}
```

### GET `/test-cases/executions/:executionId/progress`
Get execution progress for parallel tests.

**Response:**
```json
{
  "success": true,
  "data": {
    "job_id": "parallel_123456",
    "execution_id": "parallel_123456",
    "total_tests": 5,
    "completed_tests": 3,
    "failed_tests": 1,
    "current_test": {
      "test_case_id": 4,
      "model": "llama3.1:8b",
      "started_at": "2024-01-15T10:05:00.000Z",
      "estimated_completion": "2024-01-15T10:05:30.000Z"
    },
    "overall_progress_percent": 60,
    "estimated_time_remaining": 30000,
    "message": "Executing test 4 of 5",
    "status": "running",
    "updated_at": "2024-01-15T10:05:15.000Z"
  }
}
```

### POST `/test-cases/executions/:executionId/cancel`
Cancel running test execution.

**Request:**
```json
{
  "reason": "User requested cancellation"
}
```

### GET `/test-cases/queue/stats`
Get test execution queue statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "pending_jobs": 3,
    "active_jobs": 2,
    "completed_jobs": 15,
    "failed_jobs": 1,
    "total_tests_executed": 45,
    "average_execution_time": 2500,
    "queue_processing_rate": 8.5
  }
}
```

## Analytics and Metrics

### GET `/analytics/dashboard`
Get dashboard metrics overview.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalPromptCards": 25,
    "totalTestCases": 120,
    "totalExecutions": 1500,
    "successRate": 87.5,
    "averageExecutionTime": 2450,
    "popularModels": [
      {
        "model": "llama3.1:8b",
        "usage_count": 800,
        "success_rate": 89.2
      }
    ],
    "recentActivity": [...]
  }
}
```

### GET `/analytics/realtime`
Get real-time metrics.

### GET `/analytics/historical`
Get historical metrics.

### GET `/analytics/trends`
Get trend analysis.

**Query Parameters:**
- `period`: `hour`, `day`, `week`, `month` (default: `day`)
- `limit`: Number of data points (default: 30)

### GET `/analytics/insights`
Get AI-generated insights.

### POST `/analytics/events/test-execution`
Record test execution event.

**Request:**
```json
{
  "testCaseId": 1,
  "executionId": "exec_123456",
  "model": "llama3.1:8b",
  "passed": true,
  "executionTime": 2500,
  "metadata": {
    "prompt_length": 45,
    "output_length": 123
  }
}
```

## Sample Prompts

### GET `/sample-prompts`
Get all available sample prompts.

**Query Parameters:**
- `category` (optional): Filter by category

### GET `/sample-prompts/categories`
Get available categories.

### GET `/sample-prompts/stats`
Get sample prompt statistics.

### GET `/sample-prompts/:title/preview`
Preview sample prompt with validation.

### POST `/sample-prompts/:title/create`
Create prompt card from sample.

**Request:**
```json
{
  "includeTestCases": true
}
```

### POST `/sample-prompts/initialize`
Initialize all sample prompts in database.

## Performance Monitoring

### GET `/performance/overview`
Get comprehensive performance overview.

**Response:**
```json
{
  "success": true,
  "data": {
    "timestamp": "2024-01-15T10:00:00.000Z",
    "systemMetrics": {
      "cpu_usage": 45.2,
      "memory_usage": 67.8,
      "disk_usage": 34.1,
      "network_io": {
        "bytes_in": 1024000,
        "bytes_out": 512000
      }
    },
    "applicationMetrics": {
      "active_connections": 12,
      "requests_per_minute": 450,
      "average_response_time": 125,
      "cache_hit_rate": 89.5
    },
    "summary": {
      "status": "healthy",
      "performance_score": 8.7,
      "bottlenecks": []
    },
    "alerts": [],
    "uptime": 86400,
    "version": "v18.19.0",
    "platform": "linux",
    "arch": "x64"
  }
}
```

### GET `/performance/metrics/:metricName?`
Get specific performance metrics or list all available metrics.

### GET `/performance/alerts`
Get active performance alerts.

## Health Monitoring

### GET `/health`
Basic health check.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:00:00.000Z",
  "services": {
    "database": "connected",
    "ollama": {
      "url": "http://ollama:11434",
      "status": "configured"
    }
  },
  "environment": "development"
}
```

### GET `/health/db`
Database-specific health check.

### GET `/health/v2/*`
Enhanced health monitoring endpoints.

## CI/CD Monitoring

### GET `/ci-cd/pipelines`
Get current pipeline status.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "pipeline-1",
      "name": "CI Pipeline #1001",
      "status": "success",
      "branch": "main",
      "commit": "a1b2c3d",
      "commitMessage": "feat: add user authentication system",
      "author": "alice",
      "startTime": "2024-01-15T09:30:00.000Z",
      "duration": 480000,
      "endTime": "2024-01-15T09:38:00.000Z",
      "triggeredBy": "push",
      "jobs": [
        {
          "id": "job-setup-1",
          "name": "setup-dependencies",
          "status": "success",
          "startTime": "2024-01-15T09:30:00.000Z",
          "duration": 60000
        }
      ],
      "metrics": {
        "totalRuns": 75,
        "successRate": 89.3,
        "averageDuration": 480000,
        "failureRate": 10.7
      }
    }
  ]
}
```

### GET `/ci-cd/deployments`
Get deployment status.

### GET `/ci-cd/metrics`
Get CI/CD metrics summary.

### GET `/ci-cd/history`
Get build history.

**Query Parameters:**
- `range`: Time range (e.g., "30d", "7d") (default: "30d")

### POST `/ci-cd/trigger/:pipelineId`
Trigger pipeline run.

**Request:**
```json
{
  "branch": "main",
  "reason": "Manual trigger for hotfix deployment"
}
```

### POST `/ci-cd/cancel/:pipelineId`
Cancel running pipeline.

## Security

### GET `/security/csrf-token`
Get CSRF token for form submissions.

**Response:**
```json
{
  "success": true,
  "data": {
    "csrfToken": "abc123...",
    "expiresAt": "2024-01-15T11:00:00.000Z"
  }
}
```

### GET `/security/scan-results`
Get security scan results.

### GET `/security/compliance-report`
Get compliance report.

## Dependencies Management

### GET `/dependencies`
Get all project dependencies with metadata.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "root-express",
      "name": "express",
      "version": "4.18.2",
      "type": "production",
      "location": "root",
      "description": "Fast, unopinionated web framework",
      "homepage": "https://expressjs.com",
      "license": "MIT",
      "size": 102400,
      "installationDate": "2024-01-15T10:00:00.000Z",
      "lastUpdated": "2024-01-10T10:00:00.000Z",
      "latestVersion": "4.18.3",
      "maintainers": ["express-team"]
    }
  ]
}
```

### GET `/dependencies/security-audit`
Get dependency security audit.

### GET `/dependencies/outdated`
Get outdated dependencies.

## Optimization

### POST `/optimization/analyze`
Analyze prompt effectiveness.

**Request:**
```json
{
  "promptId": 1,
  "promptText": "Analyze the sentiment of: {{text}}",
  "timeRange": "7d"
}
```

### POST `/optimization/compare`
Compare two prompts performance.

**Request:**
```json
{
  "promptA": "Analyze sentiment: {{text}}",
  "promptB": "Determine the emotional tone of: {{text}}",
  "testCases": [
    {
      "input": {"text": "I love this!"},
      "expected": "positive"
    }
  ],
  "model": "llama3.1:8b"
}
```

### GET `/optimization/suggestions/:promptId`
Get AI-powered optimization suggestions.

**Query Parameters:**
- `originalPrompt`: Current prompt text
- `targetMetrics`: JSON string of target performance metrics
- `constraints`: JSON string of optimization constraints

## WebSocket API

### Connection
```javascript
const socket = io('http://localhost:3001', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

### Events

#### Client to Server Events

**subscribe-test**
Subscribe to test execution updates.
```javascript
socket.emit('subscribe-test', 'execution_id');
```

**unsubscribe-test**
Unsubscribe from test execution updates.
```javascript
socket.emit('unsubscribe-test', 'execution_id');
```

**subscribe-system-resources**
Subscribe to system resource updates.
```javascript
socket.emit('subscribe-system-resources');
```

**subscribe-queue-stats**
Subscribe to queue statistics.
```javascript
socket.emit('subscribe-queue-stats');
```

**get-progress**
Request current progress for an execution.
```javascript
socket.emit('get-progress', 'execution_id');
```

#### Server to Client Events

**progress**
Test execution progress update.
```javascript
socket.on('progress', (data) => {
  console.log('Progress:', data);
  // data format matches ExecutionProgress interface
});
```

**test-complete**
Test execution completed.
```javascript
socket.on('test-complete', (result) => {
  console.log('Test completed:', result);
  // result format matches TestExecutionResult interface
});
```

**system-resources**
System resource updates.
```javascript
socket.on('system-resources', (resources) => {
  console.log('System resources:', resources);
});
```

**queue-stats**
Queue statistics updates.
```javascript
socket.on('queue-stats', (stats) => {
  console.log('Queue stats:', stats);
});
```

**subscription-confirmed**
Confirmation of subscription/unsubscription.
```javascript
socket.on('subscription-confirmed', (confirmation) => {
  console.log('Subscription confirmed:', confirmation);
});
```

### WebSocket Connection Management

**Connection Events:**
```javascript
socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
});
```

### Real-time Usage Example

```javascript
import { io } from 'socket.io-client';

// Connect with authentication
const socket = io('http://localhost:3001', {
  auth: {
    token: localStorage.getItem('jwt_token')
  }
});

// Subscribe to test execution
const executionId = 'exec_123456';
socket.emit('subscribe-test', executionId);

// Listen for progress updates
socket.on('progress', (progress) => {
  updateProgressBar(progress.overall_progress_percent);
  displayCurrentTest(progress.current_test);
});

// Listen for completion
socket.on('test-complete', (result) => {
  displayResults(result);
  socket.emit('unsubscribe-test', executionId);
});

// Handle errors
socket.on('error', (error) => {
  console.error('WebSocket error:', error);
});
```

## Rate Limiting

The API implements several rate limiting tiers:

- **General Rate Limit:** 100 requests per 15 minutes per IP
- **API Rate Limit:** 200 requests per 15 minutes per user
- **Auth Rate Limit:** 5 login attempts per 15 minutes per IP
- **Test Execution Rate Limit:** 50 executions per hour per user
- **Heavy Operations:** 20 requests per hour per user (optimization, reports)

### Rate Limit Headers
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642291200
```

## Pagination

Endpoints that return lists support pagination:

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 100)

**Response Format:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 150,
    "totalPages": 15,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## Error Codes Reference

| Code | Description |
|------|-------------|
| `INVALID_CREDENTIALS` | Authentication failed |
| `USER_EXISTS` | User already registered |
| `USER_NOT_FOUND` | User account not found |
| `LOGIN_ERROR` | Generic login failure |
| `REGISTRATION_ERROR` | Registration failed |
| `TOKEN_EXPIRED` | JWT token expired |
| `INVALID_TOKEN` | JWT token invalid |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `VALIDATION_ERROR` | Request validation failed |
| `RESOURCE_NOT_FOUND` | Requested resource not found |
| `INSUFFICIENT_PERMISSIONS` | User lacks required permissions |
| `EXECUTION_FAILED` | Test execution failed |
| `QUEUE_FULL` | Test execution queue full |
| `SYSTEM_ERROR` | Internal system error |

## Development and Testing

### Environment Variables
```bash
# Server Configuration
PORT=3001
NODE_ENV=development
DATABASE_PATH=./data/database.sqlite

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# JWT Configuration
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret
JWT_EXPIRE=1h
JWT_REFRESH_EXPIRE=7d

# LLM Configuration
OLLAMA_BASE_URL=http://ollama:11434

# WebSocket Configuration
NEXT_PUBLIC_WEBSOCKET_URL=http://localhost:3001
```

### Testing API Endpoints

**Using curl:**
```bash
# Login and get token
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Use token for authenticated requests
curl -X GET http://localhost:3001/api/prompt-cards \
  -H "Authorization: Bearer <your-jwt-token>"

# Execute test case
curl -X POST http://localhost:3001/api/test-cases/1/execute \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3.1:8b"}'
```

**Using JavaScript/TypeScript:**
```javascript
// API client example
const API_BASE = 'http://localhost:3001/api';

class PromptCardAPI {
  constructor(token) {
    this.token = token;
  }

  async getPromptCards(page = 1, limit = 10) {
    const response = await fetch(`${API_BASE}/prompt-cards?page=${page}&limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    });
    return response.json();
  }

  async executeTest(testCaseId, model = 'llama3.1:8b') {
    const response = await fetch(`${API_BASE}/test-cases/${testCaseId}/execute`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ model })
    });
    return response.json();
  }
}
```

## Performance Considerations

1. **Caching:** API responses are cached where appropriate
2. **Compression:** Responses are compressed for efficiency
3. **Connection Pooling:** Database connections are pooled
4. **WebSocket Optimization:** Real-time updates use batching and compression
5. **Rate Limiting:** Protects against abuse and ensures fair usage

## Security Features

1. **HTTPS Required:** Production deployments require HTTPS
2. **CSRF Protection:** Cross-site request forgery protection
3. **Input Validation:** All inputs are validated and sanitized
4. **SQL Injection Prevention:** Parameterized queries used throughout
5. **JWT Security:** Secure token handling with refresh mechanism
6. **Rate Limiting:** Multiple layers of rate limiting
7. **Security Headers:** Comprehensive security headers via Helmet
8. **Audit Logging:** Security events are logged and monitored

For additional information or support, please refer to the project documentation or contact the development team.