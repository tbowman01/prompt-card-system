# System Architecture Documentation

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Component Architecture](#component-architecture)
3. [Data Architecture](#data-architecture)
4. [Security Architecture](#security-architecture)
5. [Deployment Architecture](#deployment-architecture)
6. [Monitoring & Observability](#monitoring--observability)
7. [Scalability Considerations](#scalability-considerations)
8. [Performance Optimization](#performance-optimization)

## Architecture Overview

The Prompt Card System is built as a modern, enterprise-grade microservices architecture designed for high availability, scalability, and maintainability. The system follows cloud-native principles and implements comprehensive observability, security, and performance monitoring.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                            Internet                                 │
└─────────────┬───────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Load Balancer & CDN                             │
│                     (NGINX/Cloudflare)                             │
├─────────────────────────────────────────────────────────────────────┤
│ • SSL Termination      • DDoS Protection                           │
│ • Geographic Routing   • Static Asset Caching                      │
│ • Rate Limiting        • WAF (Web Application Firewall)            │
└─────────────┬───────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Application Layer                               │
├─────────────────────────────────────────────────────────────────────┤
│  Frontend Services    │    Backend Services    │    AI Services     │
│  ┌─────────────────┐  │  ┌─────────────────┐   │  ┌──────────────┐  │
│  │ Next.js 14      │  │  │ Node.js/Express │   │  │ Ollama       │  │
│  │ React Components│  │  │ TypeScript      │   │  │ OpenAI API   │  │
│  │ Real-time UI    │  │  │ WebSocket       │   │  │ Local Models │  │
│  └─────────────────┘  │  └─────────────────┘   │  └──────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Data & Storage Layer                            │
├─────────────────────────────────────────────────────────────────────┤
│  Primary Database     │     Cache Layer       │    File Storage     │
│  ┌─────────────────┐  │  ┌─────────────────┐  │  ┌──────────────┐   │
│  │ PostgreSQL      │  │  │ Redis Cluster   │  │  │ Volume Mounts│   │
│  │ Multi-tenant    │  │  │ Session Store   │  │  │ Object Store │   │
│  │ Auto-backup     │  │  │ Job Queue       │  │  │ Log Storage  │   │
│  └─────────────────┘  │  └─────────────────┘  │  └──────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Infrastructure Layer                            │
├─────────────────────────────────────────────────────────────────────┤
│  Container Platform   │    Monitoring Stack    │    Security Layer  │
│  ┌─────────────────┐  │  ┌─────────────────┐   │  ┌──────────────┐  │
│  │ Docker/Compose  │  │  │ Prometheus      │   │  │ TLS/SSL      │  │
│  │ Multi-stage     │  │  │ Grafana         │   │  │ JWT Auth     │  │
│  │ Health Checks   │  │  │ Jaeger Tracing  │   │  │ Rate Limiting│  │
│  └─────────────────┘  │  └─────────────────┘   │  └──────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### Frontend Architecture (Next.js 14)

The frontend is built as a modern React application using Next.js 14 with the App Router pattern:

#### Core Components

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout with providers
│   ├── page.tsx            # Homepage
│   ├── prompt-cards/       # Prompt card management
│   │   ├── page.tsx        # List view
│   │   ├── new/page.tsx    # Create form
│   │   └── [id]/           # Dynamic routes
│   ├── analytics/          # Analytics dashboard
│   │   └── page.tsx        # Real-time metrics
│   ├── monitoring/         # System monitoring
│   └── health/             # Health dashboard
├── components/             # Reusable components
│   ├── ui/                 # Base UI components
│   │   ├── Button.tsx      # Styled buttons
│   │   ├── Modal.tsx       # Modal dialogs
│   │   ├── LoadingSpinner.tsx
│   │   └── charts/         # Chart components
│   ├── Analytics/          # Analytics components
│   │   ├── MetricsOverview.tsx
│   │   ├── RealTimeMonitor.tsx
│   │   └── CostTracker.tsx
│   ├── TestExecution/      # Test execution components
│   │   ├── TestRunner.tsx
│   │   ├── ProgressTracker.tsx
│   │   └── ParallelTestRunner.tsx
│   └── Monitoring/         # Monitoring components
│       ├── SystemHealthOverview.tsx
│       ├── AlertsManager.tsx
│       └── PerformanceHeatmap.tsx
├── lib/                    # Utilities
│   ├── api.ts              # API client with interceptors
│   ├── utils.ts            # Utility functions
│   └── constants.ts        # Application constants
├── hooks/                  # Custom React hooks
│   ├── useWebSocket.ts     # WebSocket connection
│   ├── useAnalytics.ts     # Analytics data
│   └── useAuth.ts          # Authentication
└── types/                  # TypeScript definitions
    ├── index.ts            # Common types
    ├── api.ts              # API response types
    └── components.ts       # Component prop types
```

#### Key Technologies

- **Next.js 14**: App Router, Server Components, Streaming
- **TypeScript**: Full type safety across the application
- **Tailwind CSS**: Utility-first CSS framework
- **SWR**: Data fetching with caching and revalidation
- **Socket.io Client**: Real-time bidirectional communication
- **Chart.js/D3**: Data visualization and analytics charts
- **React Hook Form**: Form management with validation

### Backend Architecture (Node.js + Express)

The backend is designed as a modular monolith with clear service boundaries:

#### Service Layer Architecture

```
src/
├── server.ts               # Main server entry point
├── routes/                 # API route handlers
│   ├── auth.ts             # Authentication endpoints
│   ├── promptCards.ts      # Prompt card CRUD operations
│   ├── testCases.ts        # Test case management
│   ├── testExecution.ts    # Test execution endpoints
│   ├── analytics.ts        # Analytics and metrics
│   ├── reports.ts          # Report generation
│   ├── health.ts           # Health check endpoints
│   ├── optimization.ts     # AI optimization endpoints
│   └── websocket.ts        # WebSocket event handlers
├── services/               # Business logic services
│   ├── analytics/          # Analytics engine
│   │   ├── AnalyticsEngine.ts
│   │   ├── PredictiveAnalytics.ts
│   │   ├── AnomalyDetector.ts
│   │   └── VoiceInterface.ts
│   ├── testing/            # Test execution services
│   │   ├── TestQueueManager.ts
│   │   ├── ParallelExecutor.ts
│   │   └── ResourceManager.ts
│   ├── optimization/       # AI optimization services
│   │   ├── OptimizationEngine.ts
│   │   ├── PromptAnalyzer.ts
│   │   └── SecurityAnalyzer.ts
│   ├── collaboration/      # Real-time collaboration
│   │   ├── CollaborationService.ts
│   │   ├── CRDTService.ts
│   │   └── OperationalTransform.ts
│   ├── reports/            # Report generation
│   │   ├── ReportService.ts
│   │   ├── PDFExporter.ts
│   │   └── ExcelExporter.ts
│   └── security/           # Security services
│       ├── SecurityMonitor.ts
│       ├── ComplianceChecker.ts
│       └── AlertingSystem.ts
├── middleware/             # Express middleware
│   ├── auth.ts             # JWT authentication
│   ├── validation.ts       # Request validation
│   ├── rateLimiting.ts     # Rate limiting
│   ├── security.ts         # Security headers
│   └── errorHandler.ts     # Global error handling
├── database/               # Database layer
│   ├── connection.ts       # Database connection
│   └── migrations/         # Database migrations
├── types/                  # TypeScript definitions
│   ├── api.ts              # API types
│   ├── database.ts         # Database entity types
│   └── services.ts         # Service interface types
└── utils/                  # Utility functions
    ├── logger.ts           # Structured logging
    ├── metrics.ts          # Metrics collection
    └── validation.ts       # Data validation schemas
```

#### Key Technologies

- **Node.js 20+**: Latest LTS runtime with performance optimizations
- **Express.js**: Fast, unopinionated web framework
- **TypeScript**: Type safety and enhanced developer experience
- **Socket.io**: Real-time bidirectional event-based communication
- **Bull**: Robust job and message queue for Node.js
- **OpenTelemetry**: Observability framework for tracing and metrics
- **Joi**: Schema validation for JavaScript objects
- **Winston**: Multi-transport async logging library

## Data Architecture

### Database Design

The system uses PostgreSQL as the primary database with a multi-tenant architecture:

#### Core Schema

```sql
-- Workspaces (Multi-tenant isolation)
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    plan_type VARCHAR(50) NOT NULL DEFAULT 'free',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Users with workspace association
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Prompt Cards
CREATE TABLE prompt_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    prompt_template TEXT NOT NULL,
    variables JSONB DEFAULT '[]',
    tags JSONB DEFAULT '[]',
    version INTEGER DEFAULT 1,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Test Cases
CREATE TABLE test_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    prompt_card_id UUID NOT NULL REFERENCES prompt_cards(id),
    name VARCHAR(255) NOT NULL,
    input_variables JSONB NOT NULL,
    expected_output TEXT,
    assertions JSONB NOT NULL DEFAULT '[]',
    priority VARCHAR(20) DEFAULT 'medium',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Test Executions
CREATE TABLE test_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    test_case_id UUID NOT NULL REFERENCES test_cases(id),
    execution_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    llm_provider VARCHAR(100),
    llm_model VARCHAR(100),
    llm_output TEXT,
    passed BOOLEAN,
    assertion_results JSONB DEFAULT '[]',
    execution_time_ms INTEGER,
    token_usage JSONB,
    cost_usd DECIMAL(10,4),
    error_message TEXT,
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Analytics Events
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB NOT NULL,
    user_id UUID REFERENCES users(id),
    session_id VARCHAR(255),
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Performance Metrics
CREATE TABLE performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,6) NOT NULL,
    dimensions JSONB DEFAULT '{}',
    timestamp TIMESTAMP DEFAULT NOW()
);
```

#### Indexing Strategy

```sql
-- Performance-critical indexes
CREATE INDEX idx_prompt_cards_workspace ON prompt_cards(workspace_id);
CREATE INDEX idx_test_cases_prompt_card ON test_cases(prompt_card_id);
CREATE INDEX idx_test_executions_case ON test_executions(test_case_id);
CREATE INDEX idx_test_executions_status ON test_executions(status);
CREATE INDEX idx_analytics_events_type_time ON analytics_events(event_type, timestamp DESC);
CREATE INDEX idx_performance_metrics_name_time ON performance_metrics(metric_name, timestamp DESC);

-- Composite indexes for common queries
CREATE INDEX idx_test_executions_workspace_status ON test_executions(workspace_id, status);
CREATE INDEX idx_analytics_events_workspace_time ON analytics_events(workspace_id, timestamp DESC);
```

### Caching Strategy

#### Multi-layer Caching

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Browser Cache │ -> │  CDN/Edge Cache │ -> │ Application     │
│   (Client-side) │    │  (Geographic)   │    │ Cache (Redis)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
   Static Assets         Immutable Content         Dynamic Data
   • CSS/JS files        • Images/Documents        • API Responses
   • Fonts/Icons         • Cached API responses    • Session Data
   • PWA Resources       • Static JSON data        • Query Results
```

#### Redis Configuration

```typescript
// Cache keys and TTL strategy
const CACHE_CONFIG = {
  // Short-lived caches (5 minutes)
  REAL_TIME_METRICS: { key: 'metrics:realtime', ttl: 300 },
  USER_SESSIONS: { key: 'session:', ttl: 3600 },
  
  // Medium-lived caches (1 hour)
  ANALYTICS_DATA: { key: 'analytics:', ttl: 3600 },
  PROMPT_CARDS: { key: 'cards:', ttl: 3600 },
  
  // Long-lived caches (24 hours)
  SYSTEM_CONFIG: { key: 'config:', ttl: 86400 },
  USER_PERMISSIONS: { key: 'perms:', ttl: 86400 }
};
```

## Security Architecture

### Authentication & Authorization

#### JWT-based Authentication Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client    │    │ API Gateway │    │   Backend   │
│ Application │    │  (Express)  │    │  Services   │
└─────────────┘    └─────────────┘    └─────────────┘
        │                 │                 │
        │ 1. Login        │                 │
        │ -------------->│                 │
        │                │ 2. Validate     │
        │                │ -------------->│
        │                │                 │
        │                │ 3. Generate JWT │
        │                │ <--------------│
        │ 4. JWT Token   │                 │
        │ <--------------│                 │
        │                │                 │
        │ 5. API Request │                 │
        │ + JWT Header   │                 │
        │ -------------->│                 │
        │                │ 6. Verify JWT   │
        │                │ -------------->│
        │                │                 │
        │                │ 7. Response     │
        │                │ <--------------│
        │ 8. API Response│                 │
        │ <--------------│                 │
```

#### Role-Based Access Control (RBAC)

```typescript
// Role definitions
enum UserRole {
  OWNER = 'owner',        // Full workspace control
  ADMIN = 'admin',        // User and resource management
  MEMBER = 'member',      // Standard user access
  VIEWER = 'viewer'       // Read-only access
}

// Permission matrix
const PERMISSIONS = {
  [UserRole.OWNER]: [
    'workspace:*', 'user:*', 'prompt:*', 'test:*', 
    'analytics:*', 'billing:*', 'settings:*'
  ],
  [UserRole.ADMIN]: [
    'user:read', 'user:create', 'user:update', 
    'prompt:*', 'test:*', 'analytics:read'
  ],
  [UserRole.MEMBER]: [
    'prompt:read', 'prompt:create', 'prompt:update',
    'test:read', 'test:create', 'test:execute'
  ],
  [UserRole.VIEWER]: [
    'prompt:read', 'test:read', 'analytics:read'
  ]
};
```

### Security Measures

#### Input Validation & Sanitization

```typescript
// Comprehensive input validation
import Joi from 'joi';
import DOMPurify from 'dompurify';
import { rateLimit } from 'express-rate-limit';

// Request validation schema
const createPromptCardSchema = Joi.object({
  title: Joi.string().min(1).max(500).required(),
  description: Joi.string().max(2000).optional(),
  promptTemplate: Joi.string().min(1).max(10000).required(),
  variables: Joi.array().items(
    Joi.object({
      name: Joi.string().pattern(/^[a-zA-Z][a-zA-Z0-9_]*$/).required(),
      type: Joi.string().valid('string', 'number', 'boolean').required(),
      description: Joi.string().max(500).optional()
    })
  ).max(20).optional(),
  tags: Joi.array().items(Joi.string().max(50)).max(10).optional()
});

// Rate limiting configuration
const rateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false
};
```

#### Content Security Policy

```typescript
// Helmet security configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

## Deployment Architecture

### Docker Configuration

#### Multi-stage Dockerfile Strategy

```dockerfile
# Backend Dockerfile (optimized for production)
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN npm run build && npm prune --production

FROM node:20-alpine AS runtime
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package*.json ./
USER nextjs
EXPOSE 3001
CMD ["npm", "start"]
```

### Production Docker Compose

```yaml
version: '3.8'

services:
  # NGINX Reverse Proxy
  nginx:
    image: nginx:1.25-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - frontend
      - backend
    restart: unless-stopped

  # Frontend Service
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      target: production
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=https://api.promptcard.ai
    restart: unless-stopped

  # Backend Service
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
      target: production
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  # Database
  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=${POSTGRES_DB}
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init:/docker-entrypoint-initdb.d:ro
    restart: unless-stopped

  # Cache & Queue
  redis:
    image: redis:7.2-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    restart: unless-stopped

  # AI/LLM Service
  ollama:
    image: ollama/ollama:latest
    environment:
      - OLLAMA_HOST=0.0.0.0
    volumes:
      - ollama_models:/root/.ollama
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  ollama_models:
```

## Monitoring & Observability

### Comprehensive Monitoring Stack

```yaml
# Monitoring services
prometheus:
  image: prom/prometheus:v2.45.0
  command:
    - '--config.file=/etc/prometheus/prometheus.yml'
    - '--storage.tsdb.retention.time=90d'
    - '--web.enable-lifecycle'
  volumes:
    - ./monitoring/prometheus:/etc/prometheus:ro
    - prometheus_data:/prometheus

grafana:
  image: grafana/grafana:10.0.0
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}
    - GF_USERS_ALLOW_SIGN_UP=false
  volumes:
    - grafana_data:/var/lib/grafana
    - ./monitoring/grafana:/etc/grafana/provisioning:ro

jaeger:
  image: jaegertracing/all-in-one:1.48
  environment:
    - COLLECTOR_OTLP_ENABLED=true
  volumes:
    - jaeger_data:/badger
```

### Observability Implementation

#### OpenTelemetry Integration

```typescript
// Tracing configuration
import { NodeSDK } from '@opentelemetry/sdk-node';
import { AutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';

const sdk = new NodeSDK({
  instrumentations: [new AutoInstrumentations({
    '@opentelemetry/instrumentation-fs': { enabled: false }
  })],
  traceExporter: new JaegerExporter({
    endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:16686/api/traces'
  }),
  metricExporter: new PrometheusExporter({
    port: 9090
  })
});

sdk.start();
```

#### Custom Metrics

```typescript
// Business metrics collection
import { metrics } from '@opentelemetry/api-metrics';

const meter = metrics.getMeter('prompt-card-system');

// Counters
const testExecutionsCounter = meter.createCounter('test_executions_total', {
  description: 'Total number of test executions'
});

const promptCardsCounter = meter.createCounter('prompt_cards_created_total', {
  description: 'Total number of prompt cards created'
});

// Histograms
const testExecutionDuration = meter.createHistogram('test_execution_duration_ms', {
  description: 'Test execution duration in milliseconds'
});

const apiResponseTime = meter.createHistogram('api_response_time_ms', {
  description: 'API response time in milliseconds'
});

// Usage in services
testExecutionsCounter.add(1, {
  workspace_id: workspaceId,
  llm_provider: provider,
  status: result.status
});

testExecutionDuration.record(executionTime, {
  test_type: testCase.type,
  llm_model: model
});
```

## Scalability Considerations

### Horizontal Scaling Strategy

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Load Balancer                              │
│                    (NGINX + Health Checks)                         │
└─────────────┬───────────────────────────────────────────────────────┘
              │
    ┌─────────┼─────────┐
    │         │         │
    ▼         ▼         ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│Frontend │ │Frontend │ │Frontend │
│Instance │ │Instance │ │Instance │
│   #1    │ │   #2    │ │   #3    │
└─────────┘ └─────────┘ └─────────┘
    │         │         │
    └─────────┼─────────┘
              │
    ┌─────────┼─────────┐
    │         │         │
    ▼         ▼         ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│Backend  │ │Backend  │ │Backend  │
│Instance │ │Instance │ │Instance │
│   #1    │ │   #2    │ │   #3    │
└─────────┘ └─────────┘ └─────────┘
    │         │         │
    └─────────┼─────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│          Shared Data Layer              │
├─────────────────────────────────────────┤
│ • PostgreSQL Cluster (Primary/Replica) │
│ • Redis Cluster (Sharded)              │
│ • Shared File Storage                   │
└─────────────────────────────────────────┘
```

### Performance Optimization

#### Database Optimization

```sql
-- Connection pooling configuration
max_connections = 200
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100

-- Query optimization
EXPLAIN ANALYZE SELECT 
  tc.id,
  tc.name,
  pc.title,
  COUNT(te.id) as execution_count,
  AVG(te.execution_time_ms) as avg_execution_time
FROM test_cases tc
JOIN prompt_cards pc ON tc.prompt_card_id = pc.id
LEFT JOIN test_executions te ON tc.id = te.test_case_id
WHERE tc.workspace_id = $1
GROUP BY tc.id, tc.name, pc.title
ORDER BY avg_execution_time DESC
LIMIT 20;
```

#### Application-level Caching

```typescript
// Intelligent caching strategy
class CacheManager {
  private redis: Redis;
  private lru: LRUCache<string, any>;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    this.lru = new LRUCache({ max: 1000, ttl: 60000 }); // 1-minute TTL
  }

  async get<T>(key: string): Promise<T | null> {
    // L1 Cache: In-memory LRU
    const l1Value = this.lru.get(key);
    if (l1Value) return l1Value as T;

    // L2 Cache: Redis
    const l2Value = await this.redis.get(key);
    if (l2Value) {
      const parsed = JSON.parse(l2Value) as T;
      this.lru.set(key, parsed); // Promote to L1
      return parsed;
    }

    return null;
  }

  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    // Set in both caches
    this.lru.set(key, value);
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }
}
```

This comprehensive system architecture documentation provides a detailed overview of all major components, their interactions, and the technical decisions that drive the Prompt Card System's scalability, security, and performance.