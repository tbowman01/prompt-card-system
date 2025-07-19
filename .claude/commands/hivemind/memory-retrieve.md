# memory-retrieve

Access stored knowledge from the collective memory system with advanced search capabilities.

## Usage
```bash
npx claude-flow memory retrieve [options]
```

## MCP Command
```javascript
mcp__claude-flow__memory_retrieve({
  "key": "string",
  "namespace": "string", 
  "include_metadata": "boolean"
})
```

## Parameters
- `key` - Memory key to retrieve (supports wildcards)
- `namespace` - Target namespace to search in
- `include_metadata` - Include storage metadata and provenance
- `search_type` - "exact", "wildcard", "semantic", "fuzzy"

## Retrieval Methods

### Exact Key Retrieval
Retrieve specific memory by exact key match
```javascript
mcp__claude-flow__memory_retrieve({
  "key": "best_practices/api_design",
  "namespace": "hive/",
  "include_metadata": true
})
```

### Wildcard Search
Use wildcards to find related memories
```javascript
mcp__claude-flow__memory_retrieve({
  "key": "security/*",
  "namespace": "workers/security_specialist/",
  "search_type": "wildcard"
})
```

### Namespace Search
Retrieve all memories from a namespace
```javascript
mcp__claude-flow__memory_retrieve({
  "key": "*",
  "namespace": "tasks/completed/",
  "include_metadata": true
})
```

## Examples

### API Design Knowledge Retrieval
```javascript
mcp__claude-flow__memory_retrieve({
  "key": "best_practices/api_design",
  "namespace": "hive/",
  "include_metadata": true
})
```

**Output:**
```json
{
  "success": true,
  "key": "best_practices/api_design",
  "namespace": "hive/",
  "data": {
    "patterns": ["RESTful design", "consistent naming", "proper status codes"],
    "security": ["authentication", "authorization", "rate limiting"], 
    "performance": ["caching", "pagination", "compression"],
    "learned_from": ["project_alpha", "project_beta"],
    "validation_score": 0.95,
    "last_updated": "2024-01-15T14:30:00Z"
  },
  "metadata": {
    "created_by": "architect_specialist",
    "created_at": "2024-01-10T09:15:00Z",
    "last_modified": "2024-01-15T14:30:00Z",
    "access_count": 23,
    "version": 3,
    "size_bytes": 1247,
    "tags": ["api", "design", "best_practices", "rest"]
  }
}
```

### Security Knowledge Search
```javascript
mcp__claude-flow__memory_retrieve({
  "key": "discoveries/security_*",
  "namespace": "workers/security_specialist/",
  "search_type": "wildcard",
  "include_metadata": true
})
```

**Output:**
```json
{
  "success": true,
  "search_pattern": "discoveries/security_*",
  "namespace": "workers/security_specialist/",
  "results": [
    {
      "key": "discoveries/security_vulnerability_20240115",
      "data": {
        "type": "SQL injection",
        "severity": "high",
        "location": "user_authentication_service",
        "solution": "Implement parameterized queries",
        "discovered_by": "security_specialist_agent",
        "validation_status": "confirmed"
      },
      "metadata": {
        "created_at": "2024-01-15T10:30:00Z",
        "urgency": "critical"
      }
    },
    {
      "key": "discoveries/security_best_practice_oauth",
      "data": {
        "practice": "OAuth 2.0 with PKCE",
        "benefits": ["improved_security", "better_user_experience"],
        "implementation_guide": "detailed_steps_for_oauth_setup",
        "compliance": ["gdpr_compatible", "soc2_compliant"]
      },
      "metadata": {
        "created_at": "2024-01-12T16:45:00Z",
        "validated_by": ["security_team", "compliance_officer"]
      }
    }
  ],
  "total_results": 2
}
```

### Task Results Analysis
```javascript
mcp__claude-flow__memory_retrieve({
  "key": "results/*",
  "namespace": "tasks/completed/",
  "search_type": "wildcard",
  "filter": {
    "quality_score": {"min": 8.5},
    "completion_date": {"after": "2024-01-01T00:00:00Z"}
  }
})
```

**Output:**
```json
{
  "success": true,
  "search_results": [
    {
      "key": "results/authentication_implementation",
      "data": {
        "task_id": "auth_system_v2",
        "completion_status": "successful",
        "quality_metrics": {
          "test_coverage": 95,
          "performance_score": 88,
          "security_rating": "A"
        },
        "lessons_learned": ["JWT rotation strategy", "rate limiting importance"],
        "completed_by": ["auth_specialist", "security_reviewer"]
      }
    },
    {
      "key": "results/database_optimization_sprint",
      "data": {
        "performance_improvement": "65% query speed increase",
        "implementation_approach": "index_optimization_and_query_rewriting",
        "metrics": {
          "before_avg_time": "850ms",
          "after_avg_time": "297ms"
        }
      }
    }
  ]
}
```

## Advanced Search Features

### Semantic Search
Find conceptually related content
```javascript
mcp__claude-flow__memory_retrieve({
  "search_type": "semantic",
  "query": "performance optimization database",
  "namespace": "hive/",
  "limit": 10
})
```

### Temporal Search
Find memories from specific time periods
```javascript
mcp__claude-flow__memory_retrieve({
  "key": "*",
  "namespace": "decisions/",
  "time_filter": {
    "from": "2024-01-01T00:00:00Z",
    "to": "2024-01-31T23:59:59Z"
  }
})
```

### Quality-Based Search
Filter by quality scores and validation
```javascript
mcp__claude-flow__memory_retrieve({
  "key": "patterns/*",
  "namespace": "hive/",
  "quality_filter": {
    "min_score": 0.8,
    "validated": true,
    "peer_reviewed": true
  }
})
```

## Memory Relationships

### Reference Tracking
Find memories that reference specific concepts
```javascript
mcp__claude-flow__memory_retrieve({
  "references": "authentication_system",
  "search_type": "references",
  "include_reverse_refs": true
})
```

### Dependency Analysis
Understand memory dependencies and relationships
```javascript
mcp__claude-flow__memory_retrieve({
  "key": "implementation/microservices_architecture",
  "include_dependencies": true,
  "dependency_depth": 2
})
```

## Access Patterns

### Bulk Retrieval
Efficiently retrieve multiple related memories
```javascript
mcp__claude-flow__memory_retrieve({
  "keys": [
    "best_practices/api_design",
    "patterns/microservices",
    "security/authentication"
  ],
  "namespace": "hive/",
  "batch_operation": true
})
```

### Streaming Retrieval
For large datasets, retrieve in chunks
```javascript
mcp__claude-flow__memory_retrieve({
  "key": "logs/*",
  "namespace": "monitoring/",
  "streaming": true,
  "chunk_size": 100
})
```

## Metadata Options

### Extended Metadata
```json
{
  "metadata": {
    "provenance": {
      "source_agent": "researcher_001",
      "validation_chain": ["peer_review", "expert_validation"],
      "confidence_score": 0.89
    },
    "usage_analytics": {
      "access_frequency": "high",
      "last_accessed": "2024-01-16T10:30:00Z",
      "accessing_agents": ["coder_001", "architect_002"]
    },
    "relationships": {
      "related_memories": ["api_security", "performance_patterns"],
      "superseded_by": null,
      "supersedes": ["old_api_guidelines_v1"]
    }
  }
}
```

## Performance Optimization

### Caching Strategy
- Frequently accessed memories cached locally
- Cache invalidation on memory updates
- Predictive caching based on access patterns

### Indexing
- Full-text search indexing for content
- Metadata indexing for fast filtering
- Semantic embeddings for conceptual search

### Query Optimization
- Query result caching
- Batch operations for multiple retrievals
- Lazy loading for large memory objects

## Error Handling

### Memory Not Found
```json
{
  "success": false,
  "error": "memory_not_found",
  "key": "nonexistent_key",
  "suggestions": [
    "best_practices/api_design_v2",
    "patterns/api_architecture"
  ]
}
```

### Access Denied
```json
{
  "success": false,
  "error": "access_denied",
  "message": "Insufficient permissions for private namespace",
  "required_permission": "team_member"
}
```

### Expired Memory
```json
{
  "success": false,
  "error": "memory_expired",
  "key": "temporary_analysis_results",
  "expired_at": "2024-01-15T12:00:00Z"
}
```

## Best Practices
- Use specific keys when possible for faster retrieval
- Include metadata for provenance and validation information
- Use wildcard searches judiciously to avoid performance impact
- Cache frequently accessed memories locally
- Validate retrieved data freshness for time-sensitive information
- Use semantic search for discovery and exploration
- Implement proper error handling for missing or expired memories

## See Also
- `memory-store` - Store knowledge in collective memory
- `memory-share` - Share retrieved knowledge with other agents
- `neural-train` - Use retrieved memories for learning
- `pattern-recognize` - Find patterns in retrieved memories