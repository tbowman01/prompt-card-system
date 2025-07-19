# pattern-recognize

Identify patterns in data and behaviors to enhance collective intelligence and decision-making.

## Usage
```bash
npx claude-flow pattern recognize [options]
```

## MCP Command
```javascript
mcp__claude-flow__pattern_recognize({
  "data_source": "object",
  "pattern_types": "array",
  "confidence_threshold": "number",
  "context": "string"
})
```

## Parameters
- `data_source` - Data to analyze for patterns
- `pattern_types` - Types of patterns to look for
- `confidence_threshold` - Minimum confidence level (0.0-1.0)
- `context` - Analysis context for pattern interpretation

## Pattern Types

### code_quality_patterns
Identify patterns in code quality and development practices
- **Detects**: Common anti-patterns, best practices, quality indicators
- **Uses**: Code metrics, review feedback, bug reports
- **Outputs**: Quality improvement recommendations

### performance_patterns
Recognize performance bottlenecks and optimization opportunities
- **Detects**: Resource usage patterns, latency trends, scaling issues
- **Uses**: Performance metrics, profiling data, load testing results
- **Outputs**: Performance optimization strategies

### collaboration_patterns
Understand team dynamics and communication effectiveness
- **Detects**: Communication frequency, knowledge sharing, conflict resolution
- **Uses**: Inter-agent communications, task assignments, consensus voting
- **Outputs**: Team optimization recommendations

### decision_patterns
Analyze decision-making effectiveness and outcomes
- **Detects**: Decision quality, consensus patterns, outcome correlations
- **Uses**: Historical decisions, outcomes, stakeholder feedback
- **Outputs**: Decision process improvements

### failure_patterns
Identify common failure modes and preventive measures
- **Detects**: Error patterns, failure cascades, risk indicators
- **Uses**: Error logs, incident reports, system metrics
- **Outputs**: Risk mitigation strategies

### success_patterns
Recognize factors that contribute to successful outcomes
- **Detects**: Success indicators, optimal conditions, best practices
- **Uses**: Successful project data, positive outcomes, high-quality deliverables
- **Outputs**: Success replication strategies

## Examples

### Code Quality Analysis
```javascript
mcp__claude-flow__pattern_recognize({
  "data_source": {
    "code_reviews": [
      {
        "project": "user_authentication",
        "issues": ["long_functions", "missing_tests", "unclear_naming"],
        "reviewer": "senior_dev_001",
        "quality_score": 6.8
      },
      {
        "project": "payment_processing",
        "issues": ["security_concerns", "error_handling"],
        "reviewer": "security_specialist",
        "quality_score": 7.2
      }
    ],
    "bug_reports": [
      {
        "component": "user_auth",
        "frequency": 12,
        "severity": "medium",
        "root_cause": "input_validation"
      }
    ],
    "metrics": [
      {
        "component": "payment_api",
        "complexity": 15,
        "test_coverage": 78,
        "documentation_ratio": 0.65
      }
    ]
  },
  "pattern_types": ["code_quality_patterns"],
  "confidence_threshold": 0.75,
  "context": "microservices_development"
})
```

**Output:**
```json
{
  "analysis_id": "pattern_analysis_2024_001",
  "patterns_found": [
    {
      "pattern_type": "code_quality_anti_pattern",
      "pattern_name": "insufficient_input_validation",
      "confidence": 0.89,
      "description": "High correlation between missing input validation and security/reliability issues",
      "evidence": [
        "12 bugs in user_auth traced to input validation",
        "Security concerns in payment_processing code review",
        "Pattern observed across 67% of components"
      ],
      "impact": "high",
      "recommendation": "Implement comprehensive input validation framework"
    },
    {
      "pattern_type": "quality_indicator",
      "pattern_name": "test_coverage_quality_correlation",
      "confidence": 0.82,
      "description": "Strong positive correlation between test coverage and code quality scores",
      "evidence": [
        "Components with >85% coverage average 8.2 quality score",
        "Components with <70% coverage average 6.4 quality score"
      ],
      "impact": "medium",
      "recommendation": "Establish minimum 85% test coverage requirement"
    }
  ]
}
```

### Performance Bottleneck Analysis
```javascript
mcp__claude-flow__pattern_recognize({
  "data_source": {
    "performance_metrics": [
      {
        "endpoint": "/api/users",
        "avg_response_time": 850,
        "95th_percentile": 1200,
        "db_query_time": 680,
        "memory_usage": "high"
      },
      {
        "endpoint": "/api/products", 
        "avg_response_time": 320,
        "95th_percentile": 450,
        "cache_hit_rate": 0.89
      }
    ],
    "resource_usage": [
      {
        "component": "database",
        "cpu_usage": 85,
        "memory_usage": 92,
        "connection_pool": "saturated"
      }
    ],
    "user_complaints": [
      {"issue": "slow_search", "frequency": 23},
      {"issue": "page_timeouts", "frequency": 8}
    ]
  },
  "pattern_types": ["performance_patterns"],
  "confidence_threshold": 0.8,
  "context": "high_traffic_application"
})
```

**Output:**
```json
{
  "patterns_found": [
    {
      "pattern_type": "performance_bottleneck",
      "pattern_name": "database_query_bottleneck",
      "confidence": 0.91,
      "description": "Database queries are primary performance bottleneck",
      "evidence": [
        "Query time represents 80% of total response time",
        "Database CPU/memory usage at critical levels",
        "User complaints correlate with query-heavy endpoints"
      ],
      "affected_components": ["/api/users", "search functionality"],
      "optimization_opportunities": [
        {
          "strategy": "query_optimization",
          "expected_improvement": "60-70% response time reduction",
          "implementation_effort": "medium"
        },
        {
          "strategy": "caching_layer",
          "expected_improvement": "50-80% load reduction",
          "implementation_effort": "high"
        }
      ]
    }
  ]
}
```

### Team Collaboration Analysis
```javascript
mcp__claude-flow__pattern_recognize({
  "data_source": {
    "communications": [
      {
        "from": "frontend_dev",
        "to": "backend_dev",
        "frequency": 15,
        "type": "request",
        "response_time": "2h_avg"
      },
      {
        "from": "security_specialist",
        "to": "all",
        "frequency": 3,
        "type": "alert",
        "urgency": "high"
      }
    ],
    "consensus_voting": [
      {
        "proposal": "technology_selection",
        "participation_rate": 0.87,
        "consensus_reached": true,
        "time_to_consensus": "3h"
      }
    ],
    "task_performance": [
      {
        "agent": "backend_dev",
        "collaboration_score": 8.5,
        "knowledge_sharing": 7.8,
        "response_timeliness": 9.1
      }
    ]
  },
  "pattern_types": ["collaboration_patterns"],
  "confidence_threshold": 0.75,
  "context": "distributed_development_team"
})
```

### Decision Outcome Analysis
```javascript
mcp__claude-flow__pattern_recognize({
  "data_source": {
    "decisions": [
      {
        "decision": "microservices_architecture",
        "consensus_level": 0.89,
        "implementation_success": true,
        "outcome_satisfaction": 8.7,
        "factors": ["scalability_need", "team_size_8", "domain_complexity"]
      },
      {
        "decision": "nosql_database_selection",
        "consensus_level": 0.62,
        "implementation_success": false,
        "outcome_satisfaction": 5.2,
        "factors": ["performance_requirements", "consistency_needs"]
      }
    ],
    "success_metrics": [
      {
        "project": "ecommerce_platform",
        "architecture_decision": "microservices",
        "performance": "excellent",
        "maintainability": "high",
        "team_velocity": 8.9
      }
    ]
  },
  "pattern_types": ["decision_patterns", "success_patterns"],
  "confidence_threshold": 0.8,
  "context": "architecture_decisions"
})
```

## Advanced Pattern Recognition

### Temporal Patterns
Identify patterns that change over time
```javascript
"temporal_analysis": {
  "time_series_data": "performance_over_6_months",
  "trend_detection": true,
  "seasonal_patterns": true,
  "anomaly_detection": true
}
```

### Cross-Domain Patterns
Find patterns that span multiple domains
```javascript
"cross_domain_analysis": {
  "domains": ["development", "operations", "business"],
  "correlation_analysis": true,
  "causal_inference": true
}
```

### Predictive Patterns
Patterns that predict future outcomes
```javascript
"predictive_analysis": {
  "forecast_horizon": "30_days",
  "confidence_intervals": true,
  "scenario_modeling": true
}
```

## Pattern Validation

### Statistical Validation
- **Significance Testing**: Ensure patterns are statistically significant
- **Correlation Analysis**: Distinguish correlation from causation
- **Confidence Intervals**: Quantify uncertainty in pattern recognition

### Expert Validation
- **Domain Expert Review**: Have specialists validate discovered patterns
- **Historical Validation**: Test patterns against historical data
- **A/B Testing**: Validate pattern-based recommendations

### Cross-Validation
- **Train/Test Split**: Validate patterns on unseen data
- **Time-Based Validation**: Test patterns on future data
- **Domain Transfer**: Validate patterns across different contexts

## Integration with Learning

### Pattern-Based Training
```javascript
// Use recognized patterns as training data
mcp__claude-flow__neural_train({
  "training_data": recognized_patterns,
  "pattern_type": "architecture_optimization",
  "learning_mode": "supervised"
})
```

### Memory Storage
```javascript
// Store valuable patterns in collective memory
mcp__claude-flow__memory_store({
  "key": "patterns/performance_optimization_2024",
  "value": performance_patterns,
  "namespace": "patterns/"
})
```

### Decision Support
```javascript
// Use patterns to inform decisions
mcp__claude-flow__consensus_vote({
  "proposal": "Database technology selection",
  "pattern_guidance": database_selection_patterns
})
```

## Best Practices
- Use sufficient data for reliable pattern recognition
- Set appropriate confidence thresholds for your use case
- Validate patterns with domain experts before acting
- Consider multiple pattern types for comprehensive analysis
- Document pattern discovery process and assumptions
- Regularly update pattern recognition with new data
- Combine automated recognition with human insight
- Monitor pattern effectiveness in real-world applications

## See Also
- `neural-train` - Train models using recognized patterns
- `memory-store` - Store discovered patterns for future use
- `consensus-vote` - Use patterns to inform decision making
- `queen-delegate` - Apply patterns in task delegation strategies