# task-monitor

Track progress of distributed tasks in real-time with comprehensive monitoring and alerting.

## Usage
```bash
npx claude-flow task monitor [options]
```

## MCP Command
```javascript
mcp__claude-flow__task_monitor({
  "task_ids": "array",
  "monitoring_level": "string",
  "update_frequency": "number",
  "notification_triggers": "array"
})
```

## Parameters
- `task_ids` - Array of task IDs to monitor, or ["all"] for all active tasks
- `monitoring_level` - Depth of monitoring: "basic", "detailed", "comprehensive"
- `update_frequency` - Seconds between monitoring updates (minimum 10)
- `notification_triggers` - Events that trigger notifications

## Monitoring Levels

### basic
Essential progress tracking
- **Metrics**: Completion status, basic timeline adherence
- **Frequency**: Lower resource usage, suitable for many tasks
- **Alerts**: Only critical issues and completions

### detailed
Comprehensive progress analysis
- **Metrics**: Quality indicators, resource usage, milestone tracking
- **Frequency**: Balanced monitoring with actionable insights
- **Alerts**: Performance issues, deadline risks, quality concerns

### comprehensive
Full observability with predictive analytics
- **Metrics**: All available data points, trend analysis, predictive modeling
- **Frequency**: High-frequency monitoring for critical tasks
- **Alerts**: Early warning systems, optimization opportunities

## Notification Triggers

### Progress Events
- `task_started` - Task begins execution
- `milestone_reached` - Predefined milestone completed
- `task_completed` - Task finished successfully
- `task_failed` - Task failed or encountered errors

### Timeline Events
- `deadline_approaching` - Configurable time before deadline
- `timeline_deviation` - Significant deviation from planned schedule
- `critical_path_impact` - Changes affecting project critical path

### Quality Events
- `quality_threshold_breach` - Quality metrics below acceptable levels
- `peer_review_required` - Task ready for review
- `rework_needed` - Quality issues requiring corrections

### Resource Events
- `resource_constraint` - Resource limitations detected
- `agent_overutilization` - Agent workload exceeding thresholds
- `dependency_blocking` - Dependencies preventing progress

### Collaboration Events
- `collaboration_needed` - Task requires multi-agent coordination
- `knowledge_gap_detected` - Agent needs assistance or information
- `conflict_detected` - Conflicts between agents or approaches

## Examples

### Critical Production Bug Monitoring
```javascript
mcp__claude-flow__task_monitor({
  "task_ids": ["critical_login_bug", "payment_processing_issue"],
  "monitoring_level": "comprehensive",
  "update_frequency": 30,
  "notification_triggers": [
    "task_started",
    "progress_update",
    "deadline_approaching",
    "task_completed",
    "blocking_issue",
    "escalation_needed"
  ]
})
```

### Development Sprint Monitoring
```javascript
mcp__claude-flow__task_monitor({
  "task_ids": [
    "user_authentication_api",
    "dashboard_frontend",
    "database_migration",
    "integration_tests",
    "deployment_automation"
  ],
  "monitoring_level": "detailed",
  "update_frequency": 300,
  "notification_triggers": [
    "milestone_reached",
    "deadline_approaching",
    "quality_threshold_breach",
    "dependency_blocking",
    "task_completed"
  ]
})
```

### Research Project Tracking
```javascript
mcp__claude-flow__task_monitor({
  "task_ids": [
    "market_research_analysis",
    "competitor_feature_study", 
    "user_interview_synthesis",
    "technology_evaluation"
  ],
  "monitoring_level": "basic",
  "update_frequency": 1800,
  "notification_triggers": [
    "milestone_reached",
    "collaboration_needed",
    "knowledge_gap_detected",
    "task_completed"
  ]
})
```

## Monitoring Dashboard

### Real-time Status Overview
```json
{
  "monitoring_session": "session_2024_001_sprint_monitoring",
  "active_tasks": 5,
  "last_update": "2024-01-16T14:30:00Z",
  "overall_health": "good",
  "tasks_status": [
    {
      "task_id": "user_authentication_api",
      "agent": "backend_specialist_001",
      "status": "in_progress",
      "progress_percentage": 75,
      "time_elapsed": "18h 30m",
      "estimated_remaining": "6h 15m",
      "deadline": "2024-01-18T17:00:00Z",
      "health": "on_track",
      "last_activity": "15 minutes ago",
      "current_milestone": "API endpoint implementation"
    },
    {
      "task_id": "dashboard_frontend",
      "agent": "frontend_lead_002",
      "status": "blocked",
      "progress_percentage": 45,
      "time_elapsed": "12h 45m",
      "blocking_reason": "waiting_for_api_specification",
      "health": "at_risk",
      "last_activity": "2 hours ago",
      "escalation_suggested": true
    }
  ]
}
```

### Progress Trend Analysis
```json
{
  "trend_analysis": {
    "period": "last_24_hours",
    "velocity_trend": "stable",
    "quality_trend": "improving",
    "collaboration_trend": "increasing",
    "risk_indicators": [
      {
        "task": "dashboard_frontend",
        "risk": "deadline_miss_probability",
        "probability": 0.65,
        "impact": "medium",
        "mitigation": "add_additional_resources"
      }
    ]
  }
}
```

### Performance Metrics
```json
{
  "performance_summary": {
    "sprint_burndown": {
      "planned_completion": 0.70,
      "actual_completion": 0.63,
      "variance": -0.07
    },
    "quality_metrics": {
      "average_quality_score": 8.3,
      "peer_review_pass_rate": 0.89,
      "rework_percentage": 0.12
    },
    "collaboration_metrics": {
      "inter_agent_communications": 47,
      "knowledge_sharing_events": 8,
      "consensus_decisions": 3
    }
  }
}
```

## Alert Configuration

### Deadline Alerts
```javascript
"deadline_alerts": {
  "warning_threshold": "24_hours_before",
  "critical_threshold": "4_hours_before",
  "escalation_rules": {
    "missed_deadline": "immediate_notification",
    "at_risk_deadline": "hourly_updates"
  }
}
```

### Quality Alerts
```javascript
"quality_alerts": {
  "minimum_score": 7.0,
  "peer_review_required": true,
  "automated_testing_threshold": 0.85,
  "code_coverage_minimum": 0.80
}
```

### Resource Alerts
```javascript
"resource_alerts": {
  "agent_utilization_threshold": 0.90,
  "memory_usage_warning": 0.85,
  "dependency_timeout": "2_hours",
  "blocking_escalation": "4_hours"
}
```

## Predictive Analytics

### Timeline Prediction
- Machine learning models predict completion times
- Factor in agent performance history and task complexity
- Identify potential delays before they occur
- Suggest mitigation strategies

### Quality Prediction
- Analyze patterns in code quality and review feedback
- Predict likely quality issues based on task characteristics
- Recommend additional review or testing based on risk assessment

### Resource Optimization
- Predict resource needs for upcoming phases
- Identify optimal task reallocation opportunities
- Suggest load balancing to prevent bottlenecks

## Integration Features

### Communication Integration
```javascript
"integrations": {
  "slack_notifications": {
    "channel": "#development-alerts",
    "mention_agents": true,
    "escalation_channel": "#leadership"
  },
  "email_reports": {
    "daily_summary": true,
    "critical_alerts": "immediate",
    "stakeholder_updates": "weekly"
  }
}
```

### Dashboard Visualization
- Real-time progress charts and graphs
- Gantt chart visualization for timeline tracking
- Heat maps showing agent workload and availability
- Trend analysis with historical comparison

## Best Practices
- Set monitoring frequency appropriate to task criticality
- Use comprehensive monitoring sparingly to avoid overhead
- Configure notifications to be informative but not overwhelming
- Regularly review and adjust notification triggers
- Use predictive analytics to prevent issues rather than just react
- Maintain monitoring consistency across similar task types
- Archive monitoring data for future analysis and improvement

## See Also
- `task-distribute` - Monitor tasks after distribution
- `agent-metrics` - Correlate task progress with agent performance
- `queen-monitor` - High-level swarm monitoring
- `task-aggregate` - Combine monitoring data for project overview