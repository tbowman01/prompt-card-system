# agent-communicate

Enable direct peer-to-peer communication between agents for coordination and collaboration.

## Usage
```bash
npx claude-flow agent communicate [options]
```

## MCP Command
```javascript
mcp__claude-flow__agent_communicate({
  "sender": "string",
  "recipient": "string",
  "message_type": "string",
  "content": "object"
})
```

## Parameters
- `sender` - Sending agent identifier
- `recipient` - Receiving agent identifier or "broadcast" for all
- `message_type` - Type of communication
- `content` - Message payload with structured data

## Message Types

### info
Share information or updates
- **Use**: Status updates, discoveries, general information sharing
- **Response**: Optional acknowledgment

### request
Request assistance or information
- **Use**: Ask for help, request specific information or resources
- **Response**: Required response with requested information

### response
Reply to a previous request
- **Use**: Answer questions, provide requested information
- **Response**: Optional confirmation of receipt

### alert
Urgent notification requiring attention
- **Use**: Critical issues, blocking problems, security concerns
- **Response**: Required acknowledgment and action plan

### proposal
Suggest changes or new approaches
- **Use**: Propose solutions, suggest improvements, offer alternatives
- **Response**: Feedback, acceptance, or counter-proposal

### coordination
Coordinate work and dependencies
- **Use**: Synchronize efforts, manage dependencies, schedule work
- **Response**: Confirmation of coordination plan

## Examples

### API Endpoint Specification Request
```javascript
mcp__claude-flow__agent_communicate({
  "sender": "frontend_developer",
  "recipient": "backend_developer",
  "message_type": "request",
  "content": {
    "subject": "User authentication API endpoints specification needed",
    "details": "Implementing login flow, need endpoint details for authentication",
    "specific_requirements": [
      "login endpoint with email/password",
      "token refresh mechanism", 
      "logout endpoint",
      "password reset flow"
    ],
    "urgency": "high",
    "deadline": "2024-01-20T15:00:00Z",
    "preferred_format": "OpenAPI_3.0_specification",
    "context": "user_registration_sprint_3"
  }
})
```

### Security Vulnerability Alert
```javascript
mcp__claude-flow__agent_communicate({
  "sender": "security_specialist",
  "recipient": "broadcast",
  "message_type": "alert",
  "content": {
    "subject": "Critical SQL injection vulnerability discovered",
    "severity": "critical",
    "affected_components": [
      "user_search_endpoint",
      "product_filter_api",
      "admin_dashboard_queries"
    ],
    "vulnerability_details": {
      "type": "SQL_injection",
      "attack_vector": "unsanitized_user_input",
      "potential_impact": "full_database_access",
      "cve_reference": "pending_assignment"
    },
    "immediate_actions_required": [
      "disable_affected_endpoints",
      "implement_input_sanitization",
      "review_all_database_queries"
    ],
    "mitigation_timeline": "must_be_fixed_within_24_hours",
    "contact_for_assistance": "security_specialist"
  }
})
```

### Database Schema Coordination
```javascript
mcp__claude-flow__agent_communicate({
  "sender": "database_specialist",
  "recipient": "backend_developer",
  "message_type": "coordination",
  "content": {
    "subject": "Database migration schedule coordination",
    "migration_plan": {
      "migration_id": "user_table_restructure_v2",
      "scheduled_time": "2024-01-25T02:00:00Z",
      "estimated_duration": "45_minutes",
      "downtime_required": "15_minutes"
    },
    "coordination_requirements": [
      "application_maintenance_mode_activation",
      "cache_clearing_before_migration",
      "connection_pool_restart_after_migration"
    ],
    "rollback_plan": {
      "rollback_scripts_ready": true,
      "rollback_duration": "10_minutes",
      "data_backup_confirmed": true
    },
    "communication_channel": "slack_ops_channel",
    "confirmation_needed_by": "2024-01-24T18:00:00Z"
  }
})
```

### Performance Optimization Proposal
```javascript
mcp__claude-flow__agent_communicate({
  "sender": "performance_analyst",
  "recipient": "backend_developer",
  "message_type": "proposal",
  "content": {
    "subject": "Redis caching layer implementation proposal",
    "analysis_summary": {
      "current_performance": "average_response_time_850ms",
      "bottleneck_identified": "repeated_database_queries",
      "improvement_potential": "estimated_60_percent_reduction"
    },
    "proposed_solution": {
      "technology": "Redis_cluster",
      "implementation_approach": "write_through_cache",
      "cache_invalidation_strategy": "TTL_plus_event_based",
      "estimated_effort": "2_weeks_development"
    },
    "benefits": [
      "60% faster API response times",
      "50% reduction in database load",
      "improved user experience",
      "better system scalability"
    ],
    "risks_and_mitigation": [
      {"risk": "cache_consistency", "mitigation": "event_driven_invalidation"},
      {"risk": "increased_complexity", "mitigation": "comprehensive_testing"},
      {"risk": "redis_failure", "mitigation": "fallback_to_database"}
    ],
    "resource_requirements": "redis_cluster_3_nodes",
    "decision_needed_by": "2024-01-30T17:00:00Z"
  }
})
```

### Code Review Response
```javascript
mcp__claude-flow__agent_communicate({
  "sender": "code_reviewer",
  "recipient": "feature_developer",
  "message_type": "response",
  "content": {
    "subject": "Code review feedback for user_profile_feature",
    "review_id": "PR_2024_001_user_profile",
    "overall_assessment": "good_quality_minor_improvements_needed",
    "specific_feedback": [
      {
        "file": "src/components/UserProfile.tsx",
        "line": 45,
        "type": "suggestion",
        "comment": "Consider extracting validation logic to separate hook"
      },
      {
        "file": "src/api/userService.ts", 
        "line": 23,
        "type": "required_change",
        "comment": "Add error handling for network failures"
      },
      {
        "file": "src/tests/UserProfile.test.tsx",
        "line": 0,
        "type": "missing",
        "comment": "Add test cases for error scenarios"
      }
    ],
    "approval_status": "changes_requested",
    "estimated_fix_time": "4_hours",
    "resubmit_instructions": "Address required changes, optional suggestions welcome"
  }
})
```

## Communication Patterns

### Request-Response Pattern
```javascript
// 1. Frontend requests API spec
mcp__claude-flow__agent_communicate({
  "sender": "frontend_dev", "recipient": "backend_dev",
  "message_type": "request", "content": {...}
})

// 2. Backend responds with specification  
mcp__claude-flow__agent_communicate({
  "sender": "backend_dev", "recipient": "frontend_dev", 
  "message_type": "response", "content": {...}
})

// 3. Frontend confirms receipt
mcp__claude-flow__agent_communicate({
  "sender": "frontend_dev", "recipient": "backend_dev",
  "message_type": "info", "content": {"status": "specification_received"}
})
```

### Broadcast Alert Pattern
```javascript
// Security agent broadcasts critical alert
mcp__claude-flow__agent_communicate({
  "sender": "security_specialist", "recipient": "broadcast",
  "message_type": "alert", "content": {...}
})

// Each agent acknowledges receipt and action plan
// Multiple agents respond individually
```

### Coordination Chain Pattern
```javascript
// Database specialist coordinates with multiple dependent agents
// 1. Notify backend of migration
// 2. Notify DevOps of infrastructure needs  
// 3. Notify frontend of API changes
// 4. Coordinate timing across all agents
```

## Message Threading
Track related conversations:
```javascript
"content": {
  "thread_id": "user_auth_implementation_2024_01",
  "references": ["previous_message_id"],
  "sequence_number": 3
}
```

## Priority and Urgency
```javascript
"content": {
  "priority": "high|medium|low",
  "urgency": "immediate|same_day|normal",
  "deadline": "ISO_timestamp"
}
```

## Best Practices
- Use appropriate message types for clear communication intent
- Include sufficient context for recipients to understand and respond
- Set realistic deadlines and response expectations
- Use structured content format for complex information
- Follow up on important requests to ensure receipt
- Maintain thread continuity for ongoing conversations
- Broadcast sparingly to avoid information overload

## See Also
- `agent-assign` - Assign tasks requiring communication
- `memory-share` - Share knowledge across agents
- `consensus-vote` - Make collective decisions
- `swarm-think` - Collaborative problem solving