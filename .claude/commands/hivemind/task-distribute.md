# task-distribute

Efficiently distribute work across available agents using intelligent allocation strategies.

## Usage
```bash
npx claude-flow task distribute [options]
```

## MCP Command
```javascript
mcp__claude-flow__task_distribute({
  "tasks": "array",
  "distribution_strategy": "string",
  "constraints": "object",
  "optimization_goal": "string"
})
```

## Parameters
- `tasks` - Array of tasks to distribute
- `distribution_strategy` - Algorithm for task allocation
- `constraints` - Limitations and requirements for distribution
- `optimization_goal` - Primary objective for optimization

## Distribution Strategies

### load_balance
Distribute tasks evenly across agents based on current workload
- **Best for**: Many similar tasks, balanced team utilization
- **Algorithm**: Round-robin with workload consideration
- **Considers**: Current task count, estimated completion times

### expertise
Match tasks to agents with relevant skills and experience
- **Best for**: Specialized tasks requiring specific knowledge
- **Algorithm**: Skill matching with competency scoring
- **Considers**: Agent capabilities, past performance, domain expertise

### deadline
Prioritize urgent tasks and allocate to fastest available agents
- **Best for**: Time-critical projects with varying priorities
- **Algorithm**: Earliest deadline first with agent speed ranking
- **Considers**: Task deadlines, agent throughput, availability

### random
Random distribution for experimental or low-priority tasks
- **Best for**: Learning scenarios, skill diversification
- **Algorithm**: Weighted random selection
- **Considers**: Basic availability constraints only

### hybrid
Combine multiple strategies based on task characteristics
- **Best for**: Complex projects with diverse task types
- **Algorithm**: Multi-factor optimization
- **Considers**: Skills, workload, deadlines, dependencies

## Examples

### Microservices Development Project
```javascript
mcp__claude-flow__task_distribute({
  "tasks": [
    {
      "id": "auth_service",
      "type": "backend_development",
      "complexity": "high",
      "skills_required": ["node.js", "jwt", "security"],
      "estimated_hours": 32,
      "deadline": "2024-02-15T17:00:00Z",
      "priority": "critical"
    },
    {
      "id": "user_interface",
      "type": "frontend_development", 
      "complexity": "medium",
      "skills_required": ["react", "typescript", "responsive_design"],
      "estimated_hours": 24,
      "deadline": "2024-02-20T17:00:00Z",
      "priority": "high"
    },
    {
      "id": "database_schema",
      "type": "database_design",
      "complexity": "medium",
      "skills_required": ["postgresql", "schema_design", "migrations"],
      "estimated_hours": 16,
      "deadline": "2024-02-10T17:00:00Z", 
      "priority": "high"
    },
    {
      "id": "api_documentation",
      "type": "documentation",
      "complexity": "low",
      "skills_required": ["technical_writing", "openapi"],
      "estimated_hours": 8,
      "deadline": "2024-02-25T17:00:00Z",
      "priority": "medium"
    }
  ],
  "distribution_strategy": "expertise",
  "constraints": {
    "max_tasks_per_agent": 2,
    "required_skills_match": true,
    "workload_balance_threshold": 0.8,
    "exclude_agents": ["agent_on_leave"]
  },
  "optimization_goal": "quality"
})
```

### Bug Fix Sprint Distribution
```javascript
mcp__claude-flow__task_distribute({
  "tasks": [
    {
      "id": "critical_login_bug",
      "severity": "critical",
      "estimated_hours": 4,
      "skills_required": ["debugging", "authentication"],
      "deadline": "2024-01-16T12:00:00Z"
    },
    {
      "id": "ui_rendering_issue", 
      "severity": "high",
      "estimated_hours": 6,
      "skills_required": ["css", "browser_compatibility"],
      "deadline": "2024-01-17T17:00:00Z"
    },
    {
      "id": "performance_optimization",
      "severity": "medium",
      "estimated_hours": 12,
      "skills_required": ["performance_tuning", "profiling"],
      "deadline": "2024-01-20T17:00:00Z"
    }
  ],
  "distribution_strategy": "deadline", 
  "constraints": {
    "immediate_start_required": true,
    "allow_task_switching": false
  },
  "optimization_goal": "speed"
})
```

### Research and Analysis Project
```javascript
mcp__claude-flow__task_distribute({
  "tasks": [
    {
      "id": "market_research",
      "type": "research",
      "estimated_hours": 20,
      "skills_required": ["market_analysis", "data_collection"]
    },
    {
      "id": "competitive_analysis",
      "type": "analysis", 
      "estimated_hours": 16,
      "skills_required": ["competitive_intelligence", "feature_comparison"]
    },
    {
      "id": "technology_evaluation",
      "type": "technical_research",
      "estimated_hours": 24,
      "skills_required": ["technology_assessment", "architecture_evaluation"]
    },
    {
      "id": "user_interview_analysis",
      "type": "user_research",
      "estimated_hours": 12,
      "skills_required": ["user_research", "qualitative_analysis"]
    }
  ],
  "distribution_strategy": "load_balance",
  "constraints": {
    "collaboration_encouraged": true,
    "knowledge_sharing_required": true
  },
  "optimization_goal": "learning"
})
```

## Constraints Configuration

### Workload Constraints
```javascript
"constraints": {
  "max_tasks_per_agent": 3,
  "max_hours_per_agent": 40,
  "workload_balance_threshold": 0.75,
  "consider_existing_workload": true
}
```

### Skill Constraints
```javascript
"constraints": {
  "required_skills_match": true,
  "minimum_skill_level": "intermediate",
  "allow_skill_development": false,
  "prefer_diverse_experience": true
}
```

### Timeline Constraints
```javascript
"constraints": {
  "respect_agent_availability": true,
  "buffer_time_percentage": 20,
  "allow_overtime": false,
  "consider_dependencies": true
}
```

### Collaboration Constraints
```javascript
"constraints": {
  "team_size_limits": {"min": 1, "max": 4},
  "collaboration_encouraged": true,
  "avoid_agent_conflicts": true,
  "maintain_team_cohesion": true
}
```

## Optimization Goals

### speed
Minimize total completion time
- Prioritize fastest agents for critical path tasks
- Allow parallel execution where possible
- Consider agent availability and throughput

### quality
Maximize output quality and accuracy
- Match expertise to task requirements
- Allow sufficient time for thorough work
- Consider past quality metrics

### efficiency
Optimize resource utilization
- Balance workloads evenly
- Minimize context switching
- Maximize parallel work opportunities

### learning
Develop agent capabilities
- Assign stretch tasks for skill development
- Encourage knowledge transfer
- Balance learning with delivery needs

### innovation
Encourage creative solutions
- Assign diverse perspectives to complex problems
- Allow experimentation and exploration
- Support cross-functional collaboration

## Output Format

```json
{
  "distribution_id": "dist_2024_001_microservices",
  "strategy_used": "expertise",
  "optimization_goal": "quality",
  "total_tasks": 4,
  "agents_involved": 3,
  "distribution_results": [
    {
      "task_id": "auth_service",
      "assigned_to": "backend_specialist_001",
      "assignment_score": 0.95,
      "rationale": "Perfect skill match, available capacity, strong security background"
    },
    {
      "task_id": "user_interface",
      "assigned_to": "frontend_lead_002", 
      "assignment_score": 0.89,
      "rationale": "React expertise, TypeScript experience, responsive design skills"
    },
    {
      "task_id": "database_schema",
      "assigned_to": "database_architect_003",
      "assignment_score": 0.92,
      "rationale": "PostgreSQL specialist, schema design experience"
    },
    {
      "task_id": "api_documentation",
      "assigned_to": "backend_specialist_001",
      "assignment_score": 0.78,
      "rationale": "Technical writing skills, API knowledge, available capacity"
    }
  ],
  "workload_distribution": {
    "backend_specialist_001": {"tasks": 2, "hours": 40, "utilization": 0.85},
    "frontend_lead_002": {"tasks": 1, "hours": 24, "utilization": 0.65},
    "database_architect_003": {"tasks": 1, "hours": 16, "utilization": 0.45}
  },
  "timeline_analysis": {
    "earliest_completion": "2024-02-25T17:00:00Z",
    "critical_path": ["database_schema", "auth_service", "user_interface"],
    "parallel_opportunities": 2
  },
  "recommendations": [
    "Consider load balancing by redistributing documentation task",
    "Monitor backend_specialist_001 for potential overutilization"
  ]
}
```

## Best Practices
- Consider both current and future workloads when distributing
- Match task complexity to agent experience levels appropriately
- Allow for skill development while maintaining delivery quality
- Monitor distribution effectiveness and adjust strategies
- Provide clear task specifications to enable accurate distribution
- Consider team dynamics and collaboration opportunities
- Plan for contingencies and agent availability changes

## See Also
- `task-create` - Create tasks ready for distribution
- `agent-metrics` - Use performance data for distribution decisions
- `task-monitor` - Track distributed task progress
- `queen-delegate` - Alternative high-level task delegation