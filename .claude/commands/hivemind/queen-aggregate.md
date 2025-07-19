# queen-aggregate

Combine and synthesize results from multiple workers into cohesive deliverables.

## Usage
```bash
npx claude-flow queen aggregate [options]
```

## MCP Command
```javascript
mcp__claude-flow__queen_aggregate({
  "task_id": "string",
  "worker_results": "array",
  "aggregation_method": "string"
})
```

## Parameters
- `task_id` - Original task identifier to aggregate
- `worker_results` - Array of results from different workers
- `aggregation_method` - How to combine results: "consensus", "merge", "prioritize", "synthesis"

## Aggregation Methods

### Consensus
Combine results where workers agree, flag conflicts for resolution
- **Use when**: Multiple workers tackled the same problem
- **Output**: Unified solution with consensus confidence scores

### Merge  
Combine complementary results into comprehensive solution
- **Use when**: Workers handled different aspects of the same task
- **Output**: Integrated solution combining all worker contributions

### Prioritize
Rank and select best results based on quality metrics
- **Use when**: Multiple alternative solutions were generated
- **Output**: Top-ranked solution with rationale for selection

### Synthesis
Create new solution by combining insights from all workers
- **Use when**: Need innovative solution beyond individual contributions
- **Output**: Novel approach synthesized from worker insights

## Examples

### API Design Consensus
```javascript
mcp__claude-flow__queen_aggregate({
  "task_id": "api_design_task_001",
  "worker_results": [
    {
      "agent": "architect",
      "recommendation": "REST API with OpenAPI 3.0 specification",
      "confidence": 0.9,
      "rationale": "Industry standard, excellent tooling support"
    },
    {
      "agent": "security_expert", 
      "recommendation": "Add OAuth2 + JWT with rate limiting",
      "confidence": 0.95,
      "rationale": "Essential for production security"
    },
    {
      "agent": "performance_analyst",
      "recommendation": "Implement GraphQL for flexible queries + caching layer",
      "confidence": 0.8,
      "rationale": "Reduces over-fetching, improves mobile performance"
    }
  ],
  "aggregation_method": "merge"
})
```

### Database Architecture Selection
```javascript
mcp__claude-flow__queen_aggregate({
  "task_id": "database_architecture_decision",
  "worker_results": [
    {
      "agent": "database_specialist",
      "recommendation": "PostgreSQL with read replicas",
      "quality_score": 95,
      "pros": ["ACID compliance", "mature ecosystem", "JSON support"],
      "cons": ["Complex scaling", "higher operational overhead"]
    },
    {
      "agent": "scalability_expert",
      "recommendation": "MongoDB with sharding",
      "quality_score": 85,
      "pros": ["horizontal scaling", "flexible schema"],
      "cons": ["eventual consistency", "complex transactions"]
    },
    {
      "agent": "performance_analyst",
      "recommendation": "Hybrid: PostgreSQL + Redis",
      "quality_score": 92,
      "pros": ["best of both worlds", "proven pattern"],
      "cons": ["increased complexity", "multiple systems to manage"]
    }
  ],
  "aggregation_method": "prioritize"
})
```

### Security Implementation Synthesis
```javascript
mcp__claude-flow__queen_aggregate({
  "task_id": "comprehensive_security_implementation",
  "worker_results": [
    {
      "agent": "auth_specialist",
      "deliverable": "Multi-factor authentication system",
      "implementation": "TOTP + WebAuthn + SMS backup",
      "coverage": ["user_authentication", "session_management"]
    },
    {
      "agent": "data_protection_expert",
      "deliverable": "Data encryption and privacy controls",
      "implementation": "AES-256 + field-level encryption + GDPR compliance",
      "coverage": ["data_at_rest", "data_in_transit", "user_privacy"]
    },
    {
      "agent": "infrastructure_security",
      "deliverable": "Network and infrastructure hardening",
      "implementation": "WAF + DDoS protection + security monitoring",
      "coverage": ["network_security", "infrastructure_protection"]
    },
    {
      "agent": "code_security_reviewer",
      "deliverable": "Secure coding practices and static analysis",
      "implementation": "SonarQube + Snyk + security linting rules",
      "coverage": ["code_security", "dependency_scanning"]
    }
  ],
  "aggregation_method": "synthesis"
})
```

## Output Format

### Consensus Result
```json
{
  "aggregated_solution": {
    "primary_recommendation": "REST API with OAuth2 and caching",
    "consensus_level": 0.87,
    "contributing_agents": ["architect", "security_expert", "performance_analyst"],
    "implementation_details": {...},
    "conflict_resolutions": [...]
  }
}
```

### Merge Result  
```json
{
  "integrated_solution": {
    "components": [
      {"from": "architect", "component": "API design"},
      {"from": "security_expert", "component": "authentication"},
      {"from": "performance_analyst", "component": "caching strategy"}
    ],
    "integration_plan": {...},
    "dependencies": [...],
    "implementation_sequence": [...]
  }
}
```

### Prioritize Result
```json
{
  "selected_solution": {
    "winner": "Hybrid: PostgreSQL + Redis",
    "selection_rationale": "Best balance of consistency and performance",
    "quality_score": 92,
    "alternatives": [...],
    "implementation_roadmap": {...}
  }
}
```

### Synthesis Result
```json
{
  "synthesized_solution": {
    "innovative_approach": "Layered security with zero-trust architecture",
    "combined_insights": [...],
    "novel_components": [...],
    "implementation_strategy": {...},
    "risk_mitigation": [...]
  }
}
```

## Quality Validation

Before aggregation, validate worker results:
- **Completeness**: All required deliverables present
- **Quality**: Results meet defined quality standards  
- **Consistency**: No fundamental conflicts between results
- **Traceability**: Clear connection to original requirements

## Conflict Resolution

When worker results conflict:
1. **Identify Conflicts**: Technical, philosophical, or priority conflicts
2. **Analyze Impact**: Assess consequences of each approach
3. **Seek Additional Input**: Consult domain experts if needed
4. **Make Reasoned Decision**: Document rationale for resolution
5. **Update Requirements**: Clarify requirements to prevent future conflicts

## Best Practices
- Choose aggregation method based on task type and worker coordination
- Document decision rationale for future reference
- Validate integrated solutions meet original success criteria
- Preserve individual worker insights even when not selected
- Plan for implementation coordination across worker domains
- Create feedback loops to improve future task delegation

## See Also
- `queen-delegate` - Delegate tasks that require aggregation
- `consensus-vote` - Alternative democratic decision making
- `task-aggregate` - Worker-level result combination