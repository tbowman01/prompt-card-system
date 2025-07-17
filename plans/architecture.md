# Prompt Card System - System Architecture Design

## Architecture Overview

The Prompt Card System is a self-hosted MVP for test-driven prompt development with local LLM integration. The architecture follows a microservices approach with containerized components, designed for local deployment via Docker Compose.

## System Components

### 1. Frontend Service (Next.js)
- **Technology**: Next.js 14+ with TypeScript
- **Port**: 3000
- **Responsibilities**:
  - User interface for prompt card management
  - Test case definition and execution UI
  - Results visualization and reporting
  - YAML import/export interface
  - Real-time test execution status updates

### 2. Backend API Service (Node.js/Express)
- **Technology**: Node.js 18+ with Express and TypeScript
- **Port**: 3001
- **Responsibilities**:
  - REST API for prompt card CRUD operations
  - Test case management
  - Promptfoo integration and orchestration
  - YAML parsing and generation
  - Database operations and data validation

### 3. Database Service (SQLite)
- **Technology**: SQLite with better-sqlite3 driver
- **Storage**: Volume-mounted for persistence
- **Responsibilities**:
  - Persistent storage of prompt cards and test cases
  - Test results storage (optional for MVP)
  - User session management (future)

### 4. LLM Service (Ollama)
- **Technology**: Ollama container with local model
- **Port**: 11434
- **Responsibilities**:
  - Local LLM inference
  - Model serving via REST API
  - Support for multiple model formats

### 5. Evaluation Engine (Promptfoo)
- **Technology**: Promptfoo library (integrated into backend)
- **Responsibilities**:
  - Test execution orchestration
  - Result aggregation and analysis
  - Assertion checking and validation

## Service Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Database      │
│   (Next.js)     │────│   (Express)     │────│   (SQLite)      │
│   Port: 3000    │    │   Port: 3001    │    │   File-based    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                │
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Promptfoo     │    │   Ollama LLM    │
                       │   (Library)     │────│   (Container)   │
                       │   Integrated    │    │   Port: 11434   │
                       └─────────────────┘    └─────────────────┘
```

## Database Design

### Core Tables

#### prompt_cards
```sql
CREATE TABLE prompt_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    prompt_template TEXT NOT NULL,
    variables JSON, -- Array of variable names extracted from template
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### test_cases
```sql
CREATE TABLE test_cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt_card_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    input_variables JSON NOT NULL, -- Key-value pairs for template variables
    expected_output TEXT,
    assertions JSON, -- Array of assertion objects
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (prompt_card_id) REFERENCES prompt_cards(id) ON DELETE CASCADE
);
```

#### test_results (Optional - for result persistence)
```sql
CREATE TABLE test_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_case_id INTEGER NOT NULL,
    execution_id VARCHAR(255) NOT NULL, -- Group related test runs
    llm_output TEXT NOT NULL,
    passed BOOLEAN NOT NULL,
    assertion_results JSON, -- Individual assertion pass/fail results
    execution_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (test_case_id) REFERENCES test_cases(id) ON DELETE CASCADE
);
```

### Data Model Relationships

```
prompt_cards (1) ──→ (many) test_cases
test_cases (1) ──→ (many) test_results [optional]
```

## API Design

### REST Endpoints

#### Prompt Cards Management
- `GET /api/prompt-cards` - List all prompt cards
- `GET /api/prompt-cards/:id` - Get specific prompt card with test cases
- `POST /api/prompt-cards` - Create new prompt card
- `PUT /api/prompt-cards/:id` - Update prompt card
- `DELETE /api/prompt-cards/:id` - Delete prompt card

#### Test Cases Management
- `GET /api/prompt-cards/:id/test-cases` - Get test cases for a prompt card
- `POST /api/prompt-cards/:id/test-cases` - Add test case to prompt card
- `PUT /api/test-cases/:id` - Update specific test case
- `DELETE /api/test-cases/:id` - Delete test case

#### Test Execution
- `POST /api/prompt-cards/:id/evaluate` - Execute all tests for a prompt card
- `POST /api/test-cases/:id/evaluate` - Execute single test case
- `GET /api/evaluations/:id/status` - Get execution status (for async operations)

#### YAML Operations
- `POST /api/import/yaml` - Import prompt cards from YAML
- `GET /api/export/yaml/:id` - Export prompt card to YAML format
- `GET /api/export/yaml` - Export all prompt cards to YAML

#### System Operations
- `GET /api/health` - Health check endpoint
- `GET /api/models` - List available LLM models
- `POST /api/models/:name/load` - Load specific model

### API Response Formats

#### Prompt Card Response
```json
{
  "id": 1,
  "title": "English to French Translation",
  "description": "Translate English text to French",
  "prompt_template": "Translate the following English text to French: {{input}}",
  "variables": ["input"],
  "test_cases": [
    {
      "id": 1,
      "name": "Basic greeting",
      "input_variables": {"input": "Hello world"},
      "expected_output": "Bonjour le monde",
      "assertions": [
        {"type": "contains", "value": "Bonjour"}
      ]
    }
  ],
  "created_at": "2023-01-01T00:00:00Z",
  "updated_at": "2023-01-01T00:00:00Z"
}
```

#### Test Results Response
```json
{
  "execution_id": "exec_123",
  "prompt_card_id": 1,
  "total_tests": 3,
  "passed_tests": 2,
  "failed_tests": 1,
  "execution_time_ms": 5000,
  "results": [
    {
      "test_case_id": 1,
      "test_name": "Basic greeting",
      "input_variables": {"input": "Hello world"},
      "llm_output": "Bonjour le monde",
      "passed": true,
      "assertion_results": [
        {"type": "contains", "value": "Bonjour", "passed": true}
      ]
    }
  ]
}
```

## Frontend Architecture

### Page Structure
```
/pages
├── index.tsx                 # Dashboard/Home page
├── prompt-cards/
│   ├── index.tsx            # List all prompt cards
│   ├── [id].tsx             # View/Edit specific prompt card
│   └── new.tsx              # Create new prompt card
├── test-cases/
│   ├── [id].tsx             # Edit test case
│   └── new.tsx              # Create test case
└── results/
    └── [executionId].tsx    # View test results
```

### Component Structure
```
/components
├── PromptCard/
│   ├── PromptCardList.tsx
│   ├── PromptCardForm.tsx
│   └── PromptCardDetail.tsx
├── TestCase/
│   ├── TestCaseList.tsx
│   ├── TestCaseForm.tsx
│   └── TestCaseEditor.tsx
├── TestResults/
│   ├── ResultsViewer.tsx
│   ├── ResultsTable.tsx
│   └── AssertionStatus.tsx
├── Common/
│   ├── Layout.tsx
│   ├── Navigation.tsx
│   └── LoadingSpinner.tsx
└── YAML/
    ├── YAMLImporter.tsx
    └── YAMLExporter.tsx
```

### State Management
- **Local State**: React hooks for component-level state
- **Server State**: SWR or React Query for API data fetching
- **Global State**: React Context for user preferences and app settings

## User Interaction Flows

### 1. Create Prompt Card Flow
```
User Input → Form Validation → API Call → Database Insert → UI Update
```

### 2. Test Execution Flow
```
User Clicks "Run Tests" → API Request → Promptfoo Evaluation → LLM Inference → Results Display
```

### 3. YAML Import Flow
```
User Uploads YAML → Parse & Validate → Create Prompt Cards → Database Insert → UI Refresh
```

## Docker Deployment Architecture

### Docker Compose Configuration
```yaml
version: '3.8'

services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:3001

  backend:
    build: ./backend
    ports:
      - "3001:3001"
    depends_on:
      - ollama
    environment:
      - OLLAMA_BASE_URL=http://ollama:11434
      - DATABASE_PATH=/app/data/database.sqlite
    volumes:
      - ./data:/app/data

  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ./models:/root/.ollama
    command: ["ollama", "serve"]

  # Model initialization service
  model-loader:
    image: ollama/ollama:latest
    depends_on:
      - ollama
    volumes:
      - ./models:/root/.ollama
    command: ["ollama", "pull", "llama2:7b"]
    restart: "no"

volumes:
  models:
  data:
```

### Container Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Host                               │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Frontend   │  │  Backend    │  │  Ollama     │        │
│  │  Container  │  │  Container  │  │  Container  │        │
│  │  :3000      │  │  :3001      │  │  :11434     │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │               Shared Volumes                           │ │
│  │  - Database Data (/app/data)                          │ │
│  │  - Model Cache (/root/.ollama)                        │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Integration Patterns

### 1. Promptfoo Integration
```typescript
// Backend service integration
import { evaluate } from 'promptfoo';

async function runEvaluation(promptCard: PromptCard, testCases: TestCase[]) {
  const config = {
    prompts: [promptCard.prompt_template],
    providers: ['ollama:chat:llama2:7b'],
    tests: testCases.map(tc => ({
      vars: tc.input_variables,
      assert: tc.assertions
    }))
  };
  
  return await evaluate(config);
}
```

### 2. LLM Communication Pattern
```typescript
// Ollama client wrapper
class OllamaClient {
  private baseUrl: string;
  
  constructor(baseUrl = 'http://ollama:11434') {
    this.baseUrl = baseUrl;
  }
  
  async generate(prompt: string, model = 'llama2:7b') {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt })
    });
    return response.json();
  }
}
```

### 3. YAML Processing Pattern
```typescript
// YAML import/export service
import yaml from 'js-yaml';

class YAMLService {
  exportPromptCard(promptCard: PromptCard): string {
    const config = {
      prompts: [promptCard.prompt_template],
      providers: ['ollama:chat:llama2:7b'],
      tests: promptCard.test_cases.map(tc => ({
        vars: tc.input_variables,
        assert: tc.assertions
      }))
    };
    return yaml.dump(config);
  }
  
  importYAML(yamlContent: string): PromptCard {
    const config = yaml.load(yamlContent);
    return this.transformToPromptCard(config);
  }
}
```

## Security Considerations

### Local-Only Design
- No external authentication required
- All services run on localhost
- No external API keys or secrets
- Data remains on local machine

### Input Validation
- Sanitize all user inputs
- Validate YAML structure before processing
- Prevent code injection in prompt templates
- Limit file upload sizes and types

### Container Security
- Use non-root users in containers
- Limit container resource usage
- Secure volume mounting
- Regular security updates for base images

## Performance Optimization

### Database Optimization
- Indexes on frequently queried columns
- Efficient JOIN operations
- Connection pooling for concurrent requests
- Prepared statements for repeated queries

### Frontend Performance
- Code splitting for large components
- Lazy loading for non-critical features
- Optimized bundle sizes
- Efficient state updates

### LLM Performance
- Model caching and warm-up
- Request batching for multiple tests
- Configurable timeouts
- Resource monitoring and limits

## Monitoring and Logging

### Application Metrics
- API response times
- Test execution duration
- Error rates and types
- Resource usage (CPU, memory)

### Logging Strategy
- Structured logging (JSON format)
- Different log levels (debug, info, warn, error)
- Request/response logging
- Error tracking and alerting

## Testing Strategy

### Unit Testing
- Backend API endpoints
- Frontend components
- Database operations
- YAML parsing logic

### Integration Testing
- End-to-end user flows
- API integration tests
- Docker container communication
- LLM integration tests

### Performance Testing
- Load testing for concurrent users
- Memory usage under load
- LLM inference performance
- Database query performance

## Future Extensibility

### Planned Extensions
- Multi-model support (GPT, Claude, etc.)
- Cloud deployment options
- Advanced assertion types
- Batch testing capabilities
- CI/CD integration
- Performance analytics

### Architecture Patterns for Extension
- Plugin system for new providers
- Modular assertion framework
- Event-driven architecture
- Microservices decomposition
- API versioning strategy

## Deployment Instructions

### Prerequisites
- Docker and Docker Compose installed
- 8GB+ RAM for LLM model
- 10GB+ disk space for models

### Setup Steps
1. Clone repository
2. Run `docker-compose up -d`
3. Wait for model download (first run)
4. Access frontend at http://localhost:3000
5. Verify all services are healthy

### Configuration Options
- Model selection via environment variables
- Database path configuration
- Port customization
- Resource limits adjustment

This architecture provides a solid foundation for the Prompt Card System MVP while maintaining flexibility for future enhancements and scalability.