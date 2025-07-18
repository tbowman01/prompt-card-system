# API Reference

Complete documentation for the Prompt Card System REST API.

## 🚀 API Overview

The Prompt Card System provides a comprehensive REST API for programmatic access to all system functionality. The API is designed to be:

- **RESTful**: Follows REST architectural principles
- **Consistent**: Uniform interface across all endpoints
- **Secure**: Authentication and authorization built-in
- **Scalable**: Designed for high-volume usage
- **Well-documented**: Comprehensive documentation with examples

## 📋 Base Information

### Base URL
```
Production: https://api.promptcard.io/v1
Development: http://localhost:3001/api
```

### API Version
Current version: `v1`

### Content Type
All requests and responses use JSON:
```
Content-Type: application/json
```

## 🔐 Authentication

### API Key Authentication
Include your API key in the Authorization header:
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.promptcard.io/v1/prompt-cards
```

### JWT Authentication
For web applications, use JWT tokens:
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://api.promptcard.io/v1/prompt-cards
```

### Getting an API Key
1. Log into your dashboard
2. Navigate to Settings → API Keys
3. Click "Generate New Key"
4. Copy and secure your API key

## 📚 API Endpoints

### Prompt Cards
- `GET /prompt-cards` - List all prompt cards
- `GET /prompt-cards/{id}` - Get specific prompt card
- `POST /prompt-cards` - Create new prompt card
- `PUT /prompt-cards/{id}` - Update prompt card
- `DELETE /prompt-cards/{id}` - Delete prompt card

### Test Cases
- `GET /test-cases` - List all test cases
- `GET /test-cases/{id}` - Get specific test case
- `POST /test-cases` - Create new test case
- `PUT /test-cases/{id}` - Update test case
- `DELETE /test-cases/{id}` - Delete test case

### Test Execution
- `POST /test-execution/single` - Execute single test
- `POST /test-execution/batch` - Execute batch tests
- `GET /test-execution/{id}` - Get execution results
- `GET /test-execution/{id}/status` - Get execution status

### Analytics
- `GET /analytics/metrics` - Get performance metrics
- `GET /analytics/costs` - Get cost analysis
- `GET /analytics/usage` - Get usage statistics
- `GET /analytics/trends` - Get trend analysis

### Reports
- `GET /reports/templates` - List report templates
- `POST /reports/generate` - Generate report
- `GET /reports/{id}` - Get report details
- `POST /reports/{id}/export` - Export report

## 🔧 Common Patterns

### Pagination
Most list endpoints support pagination:
```javascript
GET /prompt-cards?page=1&limit=20&sort=created_at&order=desc
```

### Filtering
Filter results using query parameters:
```javascript
GET /prompt-cards?status=active&created_after=2024-01-01
```

### Field Selection
Select specific fields to reduce payload size:
```javascript
GET /prompt-cards?fields=id,title,created_at
```

### Sorting
Sort results by any field:
```javascript
GET /prompt-cards?sort=title&order=asc
```

## 📊 Response Format

### Success Response
```json
{
  "success": true,
  "data": {
    "id": "prompt-123",
    "title": "Customer Service Response",
    "description": "Generates customer service responses"
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.0.0"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "title",
        "message": "Title is required"
      }
    ]
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "request_id": "req-123"
  }
}
```

### List Response
```json
{
  "success": true,
  "data": [
    {
      "id": "prompt-123",
      "title": "Customer Service Response"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "total_pages": 8
  }
}
```

## 🚨 Error Codes

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

### Application Error Codes
- `VALIDATION_ERROR` - Input validation failed
- `AUTHENTICATION_ERROR` - Authentication failed
- `AUTHORIZATION_ERROR` - Insufficient permissions
- `RESOURCE_NOT_FOUND` - Requested resource not found
- `RATE_LIMIT_EXCEEDED` - Rate limit exceeded
- `SYSTEM_ERROR` - Internal system error

## 🔄 Rate Limiting

### Rate Limits
- **Free Tier**: 100 requests/hour
- **Pro Tier**: 1,000 requests/hour
- **Enterprise**: 10,000 requests/hour

### Rate Limit Headers
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

### Handling Rate Limits
```javascript
async function apiCall() {
  try {
    const response = await fetch('/api/prompt-cards');
    return await response.json();
  } catch (error) {
    if (error.status === 429) {
      // Wait and retry
      await new Promise(resolve => setTimeout(resolve, 60000));
      return apiCall();
    }
    throw error;
  }
}
```

## 📖 Quick Start Examples

### JavaScript/Node.js
```javascript
const axios = require('axios');

const api = axios.create({
  baseURL: 'https://api.promptcard.io/v1',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
});

// Get all prompt cards
const promptCards = await api.get('/prompt-cards');

// Create a new prompt card
const newCard = await api.post('/prompt-cards', {
  title: 'My New Prompt',
  description: 'A sample prompt card',
  prompt_template: 'Hello {{name}}, how are you?'
});
```

### Python
```python
import requests

headers = {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
}

# Get all prompt cards
response = requests.get(
    'https://api.promptcard.io/v1/prompt-cards',
    headers=headers
)
prompt_cards = response.json()

# Create a new prompt card
new_card = requests.post(
    'https://api.promptcard.io/v1/prompt-cards',
    headers=headers,
    json={
        'title': 'My New Prompt',
        'description': 'A sample prompt card',
        'prompt_template': 'Hello {{name}}, how are you?'
    }
)
```

### cURL
```bash
# Get all prompt cards
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.promptcard.io/v1/prompt-cards

# Create a new prompt card
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My New Prompt",
    "description": "A sample prompt card",
    "prompt_template": "Hello {{name}}, how are you?"
  }' \
  https://api.promptcard.io/v1/prompt-cards
```

## 🔧 Advanced Features

### Webhooks
Subscribe to events:
```javascript
POST /webhooks
{
  "url": "https://your-app.com/webhook",
  "events": ["test.completed", "card.created"],
  "secret": "your-webhook-secret"
}
```

### Bulk Operations
Process multiple items:
```javascript
POST /prompt-cards/bulk
{
  "operation": "create",
  "items": [
    {
      "title": "Card 1",
      "prompt_template": "Template 1"
    },
    {
      "title": "Card 2",
      "prompt_template": "Template 2"
    }
  ]
}
```

### Async Operations
Handle long-running operations:
```javascript
POST /test-execution/batch
{
  "test_cases": ["test-1", "test-2", "test-3"],
  "async": true
}

// Returns operation ID
{
  "success": true,
  "operation_id": "op-123",
  "status": "pending"
}

// Check status
GET /operations/op-123
```

## 📚 SDK Libraries

### Official SDKs
- **JavaScript/TypeScript**: `npm install @promptcard/sdk`
- **Python**: `pip install promptcard-sdk`
- **Go**: `go get github.com/promptcard/go-sdk`

### Community SDKs
- **Ruby**: `gem install promptcard`
- **PHP**: `composer require promptcard/php-sdk`
- **Java**: Maven/Gradle available

## 🛠️ Developer Tools

### API Explorer
Interactive API documentation:
- **Live Testing**: Test endpoints directly
- **Code Generation**: Generate code samples
- **Schema Validation**: Validate requests/responses

### Postman Collection
Pre-built Postman collection:
- **All Endpoints**: Complete API coverage
- **Environment Variables**: Easy configuration
- **Example Requests**: Sample requests and responses

### OpenAPI Specification
Machine-readable API specification:
- **Swagger UI**: Interactive documentation
- **Code Generation**: Generate SDKs
- **Validation**: Request/response validation

## 🔍 Debugging

### Request Logging
Enable detailed logging:
```javascript
const api = axios.create({
  baseURL: 'https://api.promptcard.io/v1',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'X-Debug': 'true'
  }
});
```

### Error Handling
Comprehensive error handling:
```javascript
try {
  const response = await api.get('/prompt-cards');
  return response.data;
} catch (error) {
  if (error.response) {
    // Server responded with error
    console.error('API Error:', error.response.data);
  } else if (error.request) {
    // Network error
    console.error('Network Error:', error.request);
  } else {
    // Other error
    console.error('Error:', error.message);
  }
}
```

---

**Next Steps**: Explore specific endpoint documentation:
- [Prompt Cards API](./endpoints/prompt-cards.md)
- [Test Cases API](./endpoints/test-cases.md)
- [Analytics API](./endpoints/analytics.md)
- [Reports API](./endpoints/reports.md)