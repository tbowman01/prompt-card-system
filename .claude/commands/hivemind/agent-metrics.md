# agent-metrics

Track individual and collective agent performance with detailed analytics.

## Usage
```bash
npx claude-flow agent metrics [options]
```

## MCP Command
```javascript
mcp__claude-flow__agent_metrics({
  "agent_id": "string",
  "metric_types": "array",
  "time_range": "string",
  "aggregation": "string"
})
```

## Parameters
- `agent_id` - Specific agent ID or "all" for collective metrics
- `metric_types` - Array of metrics to collect
- `time_range` - Analysis period ("1h", "24h", "7d", "30d", "all")
- `aggregation` - "individual" or "collective" or "comparative"

## Available Metrics

### Performance Metrics
- `task_completion_rate` - Percentage of tasks completed successfully
- `average_task_time` - Mean time to complete assigned tasks
- `quality_score` - Average quality rating of completed work
- `efficiency_rating` - Resource utilization effectiveness
- `throughput` - Tasks completed per time period

### Collaboration Metrics
- `collaboration_index` - How well agent works with others
- `communication_frequency` - Inter-agent communication rate
- `knowledge_sharing_score` - Contribution to collective knowledge
- `consensus_participation` - Participation in decision making
- `conflict_resolution` - Ability to resolve disagreements

### Learning Metrics
- `skill_improvement_rate` - Speed of learning new capabilities
- `pattern_recognition_accuracy` - Success in identifying patterns
- `adaptation_speed` - Time to adjust to new requirements
- `knowledge_retention` - Retention of learned information
- `cross_domain_transfer` - Application of learning across domains

### Reliability Metrics
- `uptime_percentage` - Agent availability and responsiveness
- `error_rate` - Frequency of errors or failures
- `consistency_score` - Consistency in output quality
- `deadline_adherence` - Meeting assigned deadlines
- `resource_efficiency` - Optimal use of allocated resources

## Examples

### Individual Agent Performance Review
```javascript
mcp__claude-flow__agent_metrics({
  "agent_id": "backend_specialist_001",
  "metric_types": [
    "task_completion_rate",
    "average_task_time", 
    "quality_score",
    "collaboration_index",
    "skill_improvement_rate"
  ],
  "time_range": "30d",
  "aggregation": "individual"
})
```

### Team Performance Comparison
```javascript
mcp__claude-flow__agent_metrics({
  "agent_id": "all",
  "metric_types": [
    "task_completion_rate",
    "quality_score",
    "efficiency_rating",
    "collaboration_index"
  ],
  "time_range": "7d", 
  "aggregation": "comparative"
})
```

### Collective Intelligence Assessment
```javascript
mcp__claude-flow__agent_metrics({
  "agent_id": "all",
  "metric_types": [
    "consensus_participation",
    "knowledge_sharing_score",
    "pattern_recognition_accuracy",
    "cross_domain_transfer",
    "collective_problem_solving"
  ],
  "time_range": "24h",
  "aggregation": "collective"
})
```

## Output Format

### Individual Metrics
```json
{
  "agent_id": "backend_specialist_001",
  "evaluation_period": "2024-01-01 to 2024-01-30",
  "metrics": {
    "task_completion_rate": {
      "value": 94.5,
      "trend": "improving",
      "benchmark": "above_average",
      "details": {
        "completed": 38,
        "assigned": 40,
        "average_team_rate": 87.2
      }
    },
    "quality_score": {
      "value": 8.7,
      "scale": "1-10",
      "trend": "stable",
      "breakdown": {
        "code_quality": 9.1,
        "documentation": 8.2,
        "testing": 8.9,
        "performance": 8.6
      }
    },
    "collaboration_index": {
      "value": 0.82,
      "scale": "0-1",
      "factors": {
        "communication_frequency": 0.85,
        "knowledge_sharing": 0.79,
        "conflict_resolution": 0.83,
        "mentorship": 0.81
      }
    }
  },
  "strengths": [
    "Exceptional code quality",
    "Strong problem-solving skills",
    "Excellent deadline adherence"
  ],
  "improvement_areas": [
    "Documentation completeness",
    "Knowledge sharing frequency"
  ],
  "recommendations": [
    "Increase participation in team knowledge sessions",
    "Consider mentoring junior agents"
  ]
}
```

### Collective Metrics
```json
{
  "swarm_id": "development_team_alpha",
  "evaluation_period": "2024-01-15 to 2024-01-22",
  "collective_performance": {
    "overall_efficiency": 89.3,
    "team_synergy_score": 0.87,
    "knowledge_velocity": 7.2,
    "collective_intelligence_index": 0.91
  },
  "agent_count": 8,
  "top_performers": [
    {"agent": "security_specialist", "overall_score": 9.4},
    {"agent": "database_expert", "overall_score": 9.1},
    {"agent": "frontend_lead", "overall_score": 8.9}
  ],
  "team_dynamics": {
    "collaboration_frequency": "high",
    "knowledge_distribution": "well_balanced",
    "consensus_effectiveness": 0.89,
    "conflict_resolution_time": "2.3_hours_average"
  },
  "performance_trends": {
    "productivity": "increasing_12_percent",
    "quality": "stable_high",
    "innovation": "increasing_8_percent"
  }
}
```

### Comparative Analysis
```json
{
  "comparison_type": "peer_analysis",
  "agents_compared": 6,
  "ranking": [
    {
      "rank": 1,
      "agent": "ml_specialist",
      "overall_score": 9.2,
      "standout_metrics": ["pattern_recognition", "innovation"]
    },
    {
      "rank": 2, 
      "agent": "system_architect",
      "overall_score": 9.0,
      "standout_metrics": ["design_quality", "scalability_thinking"]
    }
  ],
  "performance_distribution": {
    "excellent": 2,
    "good": 3,
    "average": 1,
    "needs_improvement": 0
  },
  "team_insights": [
    "Strong technical skills across the board",
    "Opportunity to improve cross-functional collaboration",
    "High innovation potential in ML and architecture domains"
  ]
}
```

## Metric Interpretation

### Performance Bands
- **Excellent** (9.0-10.0): Exceptional performance, potential for leadership roles
- **Good** (7.5-8.9): Strong performance, meeting expectations consistently  
- **Average** (6.0-7.4): Acceptable performance, room for improvement
- **Needs Improvement** (<6.0): Performance below expectations, requires support

### Trend Analysis
- **Improving**: Positive trajectory, good learning curve
- **Stable**: Consistent performance, reliable contributor
- **Declining**: Negative trend, may need intervention or support
- **Volatile**: Inconsistent performance, investigate causes

## Benchmarking

### Internal Benchmarks
- Compare against team averages
- Historical performance comparison
- Role-specific performance standards

### External Benchmarks
- Industry standard metrics when available
- Best practice performance levels
- Peer organization comparisons

## Performance Insights

### Strength Identification
- Top performing areas for each agent
- Unique capabilities and specializations
- Leadership and mentorship potential

### Development Areas
- Skills requiring improvement
- Learning opportunities
- Collaboration enhancement needs

### Team Optimization
- Optimal team composition recommendations
- Task assignment optimization
- Knowledge sharing improvement opportunities

## Best Practices
- Review metrics regularly but not obsessively
- Focus on trends rather than individual data points
- Use metrics to guide development, not punishment
- Combine quantitative metrics with qualitative feedback
- Consider context when interpreting performance data
- Celebrate improvements and recognize excellence

## See Also
- `agent-assign` - Optimize assignments based on metrics
- `neural-train` - Use metrics to guide learning
- `queen-monitor` - Aggregate metrics for swarm oversight
- `performance-report` - Generate comprehensive performance reports