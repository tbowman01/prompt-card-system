# ADR-002: Database Technology Choice - PostgreSQL

## Status
Accepted

## Context
We needed to select a primary database technology for the Prompt Card System. The system requires:

- **ACID compliance** for test execution consistency
- **JSON support** for flexible prompt templates and test configurations
- **Full-text search** for prompt discovery and analytics
- **Time-series data** for performance metrics and analytics
- **Multi-tenant isolation** with row-level security
- **Horizontal scalability** for future growth

## Decision
We chose **PostgreSQL 16** as our primary database with **Redis** for caching and session management.

## Alternatives Considered

### 1. MongoDB (Document Database)
**Pros:**
- Native JSON document storage
- Flexible schema evolution
- Built-in sharding for horizontal scaling
- Strong aggregation pipeline for analytics

**Cons:**
- No ACID transactions across collections (until 4.0+)
- Eventual consistency challenges for critical test data
- Less mature tooling for observability and backup
- Higher memory usage for large datasets

### 2. MySQL (Relational Database)
**Pros:**
- Mature ecosystem and tooling
- Good performance for read-heavy workloads
- Strong community support
- Cost-effective cloud hosting options

**Cons:**
- Limited JSON support compared to PostgreSQL
- Weaker full-text search capabilities
- Less advanced features for analytics queries
- No native support for advanced data types

### 3. SQLite (Embedded Database)
**Pros:**
- Zero configuration and maintenance
- Perfect for development and testing
- ACID compliance with WAL mode
- Extremely lightweight

**Cons:**
- Limited concurrent write capability
- No network access or multi-user support
- Not suitable for production multi-tenant architecture
- Limited analytical query performance

## Rationale for PostgreSQL

### Technical Advantages

```sql
-- Advanced JSON support with indexing
CREATE TABLE prompt_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    title VARCHAR(500) NOT NULL,
    variables JSONB NOT NULL DEFAULT '[]',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- GIN index for JSON queries
CREATE INDEX idx_prompt_variables ON prompt_cards USING GIN (variables);
CREATE INDEX idx_prompt_metadata ON prompt_cards USING GIN (metadata);

-- Complex JSON queries
SELECT id, title, variables->>'name' as variable_name
FROM prompt_cards 
WHERE workspace_id = $1 
  AND variables @> '[{"type": "string"}]'
  AND metadata->>'category' = 'enterprise';
```

### Multi-tenant Security

```sql
-- Row Level Security (RLS)
ALTER TABLE prompt_cards ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy
CREATE POLICY tenant_isolation ON prompt_cards
    FOR ALL TO application_user
    USING (workspace_id = current_setting('app.current_workspace_id')::UUID);

-- Performance with tenant-aware indexes
CREATE INDEX idx_prompt_cards_tenant ON prompt_cards(workspace_id, created_at DESC);
```

### Analytics and Time-Series Support

```sql
-- Window functions for analytics
SELECT 
    workspace_id,
    DATE_TRUNC('day', created_at) as day,
    COUNT(*) as daily_executions,
    AVG(execution_time_ms) as avg_execution_time,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms) as p95_execution_time,
    LAG(COUNT(*), 1) OVER (PARTITION BY workspace_id ORDER BY DATE_TRUNC('day', created_at)) as prev_day_count
FROM test_executions
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY workspace_id, DATE_TRUNC('day', created_at)
ORDER BY workspace_id, day;

-- Advanced aggregations for ML features
SELECT 
    prompt_card_id,
    ARRAY_AGG(execution_time_ms ORDER BY created_at DESC LIMIT 100) as recent_execution_times,
    ARRAY_AGG(DISTINCT llm_provider) as used_providers,
    JSON_AGG(
        JSON_BUILD_OBJECT(
            'timestamp', created_at,
            'success_rate', (passed::int),
            'cost', cost_usd
        ) ORDER BY created_at DESC LIMIT 50
    ) as execution_history
FROM test_executions
GROUP BY prompt_card_id;
```

### Full-Text Search Integration

```sql
-- Full-text search setup
ALTER TABLE prompt_cards ADD COLUMN search_vector tsvector;

-- Search index
CREATE INDEX idx_prompt_cards_search ON prompt_cards USING GIN(search_vector);

-- Update search vector
UPDATE prompt_cards SET search_vector = 
    to_tsvector('english', 
        COALESCE(title, '') || ' ' || 
        COALESCE(description, '') || ' ' ||
        COALESCE(array_to_string(ARRAY(SELECT jsonb_array_elements_text(tags)), ' '), '')
    );

-- Search queries with ranking
SELECT 
    id, 
    title,
    ts_rank(search_vector, plainto_tsquery('english', $1)) as rank
FROM prompt_cards
WHERE workspace_id = $2
  AND search_vector @@ plainto_tsquery('english', $1)
ORDER BY rank DESC, created_at DESC
LIMIT 20;
```

## Database Architecture

### Primary Database Configuration

```yaml
# docker-compose production configuration
postgres:
  image: postgres:16-alpine
  environment:
    - POSTGRES_DB=prompt_card_system
    - POSTGRES_USER=app_user
    - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
  command: >
    postgres
    -c max_connections=200
    -c shared_buffers=256MB
    -c effective_cache_size=1GB
    -c maintenance_work_mem=64MB
    -c checkpoint_completion_target=0.9
    -c wal_buffers=16MB
    -c default_statistics_target=100
    -c random_page_cost=1.1
    -c effective_io_concurrency=200
  volumes:
    - postgres_data:/var/lib/postgresql/data
    - ./database/init:/docker-entrypoint-initdb.d:ro
```

### Redis Caching Strategy

```typescript
// Cache layer configuration
interface CacheConfig {
  // Session management
  sessions: {
    ttl: 24 * 60 * 60; // 24 hours
    keyPattern: 'session:{userId}:{sessionId}';
  };
  
  // Query result caching
  queries: {
    ttl: 5 * 60; // 5 minutes
    keyPattern: 'query:{hash}';
  };
  
  // Real-time metrics
  metrics: {
    ttl: 60; // 1 minute
    keyPattern: 'metrics:{workspaceId}:{metric}';
  };
}

class DatabaseService {
  constructor(
    private pg: Pool,
    private redis: Redis
  ) {}

  async findPromptCards(workspaceId: string): Promise<PromptCard[]> {
    const cacheKey = `query:prompt_cards:${workspaceId}`;
    
    // Try cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Query database
    const result = await this.pg.query(`
      SELECT id, title, description, variables, created_at
      FROM prompt_cards
      WHERE workspace_id = $1
      ORDER BY created_at DESC
    `, [workspaceId]);

    // Cache result
    await this.redis.setex(cacheKey, 300, JSON.stringify(result.rows));
    
    return result.rows;
  }
}
```

## Performance Considerations

### Connection Pooling

```typescript
// PostgreSQL connection pool configuration
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  
  // Pool configuration
  min: 10,                    // Minimum connections
  max: 30,                    // Maximum connections
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 2000, // Timeout connection attempts after 2s
  
  // SSL configuration for production
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});
```

### Query Optimization

```sql
-- Performance monitoring views
CREATE VIEW slow_queries AS
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    stddev_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements
ORDER BY total_time DESC;

-- Index usage monitoring
CREATE VIEW index_usage AS
SELECT
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation,
    most_common_vals
FROM pg_stats
WHERE schemaname = 'public'
ORDER BY tablename, attname;
```

## Backup and Recovery Strategy

```bash
#!/bin/bash
# Automated backup script
BACKUP_DIR="/backups/postgresql"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="prompt_card_system_backup_${TIMESTAMP}.sql"

# Create backup
pg_dump \
  --host="${POSTGRES_HOST}" \
  --port="${POSTGRES_PORT}" \
  --username="${POSTGRES_USER}" \
  --dbname="${POSTGRES_DB}" \
  --verbose \
  --clean \
  --no-owner \
  --no-privileges \
  --compress=9 \
  --file="${BACKUP_DIR}/${BACKUP_FILE}"

# Upload to S3 (if configured)
if [ -n "$AWS_S3_BUCKET" ]; then
    aws s3 cp "${BACKUP_DIR}/${BACKUP_FILE}" "s3://${AWS_S3_BUCKET}/database-backups/"
fi

# Cleanup old backups (keep last 7 days)
find "${BACKUP_DIR}" -name "*.sql" -mtime +7 -delete
```

## Migration Strategy

### Schema Versioning

```typescript
// Database migration system
interface Migration {
  version: string;
  description: string;
  up: string;
  down: string;
}

const migrations: Migration[] = [
  {
    version: '001',
    description: 'Initial schema',
    up: `
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE TABLE workspaces (...);
      CREATE TABLE users (...);
    `,
    down: `
      DROP TABLE users;
      DROP TABLE workspaces;
    `
  }
];
```

## Consequences

### Positive
- **ACID compliance** ensures data consistency for critical operations
- **Rich JSON support** provides flexibility for evolving data structures
- **Excellent analytical capabilities** with window functions and CTEs
- **Strong ecosystem** with mature tooling and extensions
- **Multi-tenant security** with row-level security built-in
- **Performance optimization** through sophisticated query planner

### Negative
- **Higher operational complexity** compared to managed NoSQL solutions
- **Vertical scaling limitations** require eventual sharding strategy
- **Memory requirements** can be high for large analytical workloads
- **JSON query syntax** has learning curve compared to native document databases

### Mitigation Strategies
- **Read replicas** for analytical workloads and reporting
- **Connection pooling** (PgBouncer) for high-concurrency scenarios
- **Partitioning** for large time-series tables
- **Monitoring** with pg_stat_statements and custom metrics

## Related Decisions
- [ADR-003: Caching Strategy - Redis Implementation](./003-caching-strategy.md)
- [ADR-005: Multi-tenant Data Isolation Strategy](./005-multi-tenant-isolation.md)