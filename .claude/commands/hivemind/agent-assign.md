# agent-assign

Assign specific tasks to individual agents or groups of agents with detailed specifications.

## Usage
```bash
npx claude-flow agent assign [options]
```

## MCP Command
```javascript
mcp__claude-flow__agent_assign({
  "task_id": "string",
  "assigned_agents": "array",
  "task_details": "object",
  "dependencies": "array"
})
```

## Parameters
- `task_id` - Unique identifier for the assignment
- `assigned_agents` - Array of agent IDs or types
- `task_details` - Comprehensive task specification
- `dependencies` - Array of prerequisite tasks or resources

## Task Detail Structure
```javascript
{
  "objective": "Clear, measurable task objective",
  "scope": ["specific", "areas", "to", "cover"],
  "deliverables": ["expected", "outputs"],
  "constraints": ["limitations", "requirements"],
  "resources": ["available", "tools", "data"],
  "timeline": {
    "start_date": "ISO timestamp",
    "deadline": "ISO timestamp", 
    "milestones": [...]
  },
  "success_criteria": "How to measure completion",
  "priority": "high|medium|low|critical"
}
```

## Examples

### Database Optimization Assignment
```javascript
mcp__claude-flow__agent_assign({
  "task_id": "database_optimization_001",
  "assigned_agents": ["db_specialist", "performance_analyst"],
  "task_details": {
    "objective": "Optimize database queries to reduce response time by 50%",
    "scope": [
      "user_authentication_queries",
      "product_search_operations", 
      "order_processing_workflows",
      "reporting_dashboard_queries"
    ],
    "deliverables": [
      "query_optimization_report",
      "index_strategy_document",
      "performance_benchmark_results",
      "optimized_query_implementations"
    ],
    "constraints": [
      "no_downtime_during_implementation",
      "maintain_backward_compatibility",
      "budget_limit_5k_monthly_infra_cost"
    ],
    "resources": [
      "production_database_read_replica",
      "query_performance_monitoring_tools",
      "database_migration_scripts_repository"
    ],
    "timeline": {
      "start_date": "2024-01-15T09:00:00Z",
      "deadline": "2024-02-15T17:00:00Z",
      "milestones": [
        {"date": "2024-01-22", "deliverable": "performance_analysis_complete"},
        {"date": "2024-01-29", "deliverable": "optimization_strategy_approved"},
        {"date": "2024-02-08", "deliverable": "implementation_in_staging"},
        {"date": "2024-02-15", "deliverable": "production_deployment_complete"}
      ]
    },
    "success_criteria": "Average query response time < 200ms for 95th percentile",
    "priority": "high"
  },
  "dependencies": ["schema_analysis_complete", "monitoring_dashboard_setup"]
})
```

### Security Code Review Assignment
```javascript
mcp__claude-flow__agent_assign({
  "task_id": "security_code_review_api_v2",
  "assigned_agents": ["security_specialist", "code_reviewer"],
  "task_details": {
    "objective": "Comprehensive security review of API v2.0 implementation",
    "scope": [
      "authentication_endpoints",
      "authorization_middleware", 
      "data_validation_layers",
      "session_management",
      "error_handling_security"
    ],
    "deliverables": [
      "security_vulnerability_report",
      "code_security_recommendations",
      "threat_model_analysis",
      "secure_coding_guidelines_update"
    ],
    "constraints": [
      "review_must_complete_before_prod_deployment",
      "follow_owasp_top_10_guidelines",
      "maintain_existing_api_compatibility"
    ],
    "resources": [
      "static_analysis_tools_sonarqube",
      "security_testing_framework_owasp_zap",
      "code_repository_access",
      "security_standards_documentation"
    ],
    "timeline": {
      "start_date": "2024-01-20T10:00:00Z", 
      "deadline": "2024-02-05T18:00:00Z",
      "milestones": [
        {"date": "2024-01-24", "deliverable": "automated_scan_complete"},
        {"date": "2024-01-29", "deliverable": "manual_review_complete"},
        {"date": "2024-02-02", "deliverable": "threat_model_finalized"},
        {"date": "2024-02-05", "deliverable": "final_report_delivered"}
      ]
    },
    "success_criteria": "Zero critical vulnerabilities, < 3 high severity issues",
    "priority": "critical"
  },
  "dependencies": ["api_v2_implementation_complete", "test_environment_ready"]
})
```

### Frontend Component Development
```javascript
mcp__claude-flow__agent_assign({
  "task_id": "user_dashboard_components_v3",
  "assigned_agents": ["frontend_developer", "ux_designer", "accessibility_specialist"],
  "task_details": {
    "objective": "Develop responsive user dashboard components with accessibility compliance",
    "scope": [
      "user_profile_widget",
      "activity_timeline_component",
      "settings_panel_interface",
      "notification_center_ui"
    ],
    "deliverables": [
      "react_component_library",
      "storybook_documentation",
      "accessibility_test_suite",
      "responsive_design_specifications"
    ],
    "constraints": [
      "wcag_2.1_aa_compliance_required",
      "support_mobile_tablet_desktop",
      "compatible_with_existing_design_system",
      "bundle_size_increase_less_than_50kb"
    ],
    "resources": [
      "figma_design_mockups",
      "existing_component_library",
      "accessibility_testing_tools",
      "user_research_insights"
    ],
    "timeline": {
      "start_date": "2024-01-25T09:00:00Z",
      "deadline": "2024-03-15T17:00:00Z", 
      "milestones": [
        {"date": "2024-02-05", "deliverable": "component_architecture_approved"},
        {"date": "2024-02-20", "deliverable": "core_components_implemented"},
        {"date": "2024-03-01", "deliverable": "accessibility_testing_complete"},
        {"date": "2024-03-10", "deliverable": "cross_browser_testing_complete"},
        {"date": "2024-03-15", "deliverable": "production_ready_components"}
      ]
    },
    "success_criteria": "100% accessibility compliance, 98% cross-browser compatibility",
    "priority": "medium"
  },
  "dependencies": ["design_system_v2_finalized", "user_research_complete"]
})
```

## Agent Selection Strategies

### Skill-Based Assignment
Match agents with required technical skills:
```javascript
"assigned_agents": [
  {"agent_id": "python_expert", "skills": ["python", "django", "postgresql"]},
  {"agent_id": "security_specialist", "skills": ["owasp", "penetration_testing"]}
]
```

### Workload-Based Assignment
Distribute tasks based on current agent capacity:
```javascript
"assignment_strategy": "load_balanced",
"agent_pool": ["developer_1", "developer_2", "developer_3"],
"max_concurrent_tasks": 2
```

### Collaborative Assignment
Assign complementary agents for complex tasks:
```javascript
"collaboration_model": "pair_programming",
"primary_agent": "senior_developer",
"secondary_agent": "junior_developer",
"knowledge_transfer": true
```

## Dependency Management

### Task Dependencies
```javascript
"dependencies": [
  {"task_id": "api_design_complete", "type": "prerequisite"},
  {"task_id": "database_schema_ready", "type": "prerequisite"},
  {"resource": "staging_environment", "type": "resource_dependency"}
]
```

### Resource Dependencies
```javascript
"resource_requirements": [
  {"type": "compute", "specification": "8_core_16gb_ram"},
  {"type": "access", "specification": "production_database_read_only"},
  {"type": "tool", "specification": "profiling_tools_license"}
]
```

## Monitoring and Updates

### Progress Tracking
- Automatic milestone check-ins
- Deliverable quality validation
- Timeline adherence monitoring
- Resource utilization tracking

### Assignment Modifications
```javascript
// Update assignment with new requirements
mcp__claude-flow__agent_assign({
  "task_id": "existing_task_id",
  "modification_type": "scope_expansion",
  "updated_details": {...},
  "impact_assessment": "timeline_extended_1_week"
})
```

## Best Practices
- Provide clear, specific objectives and success criteria
- Include realistic timelines with buffer for complexity
- Specify all constraints and limitations upfront
- Ensure agents have necessary skills and resources
- Define dependencies clearly to prevent blocking
- Plan for regular progress check-ins and updates
- Document lessons learned for future assignments

## See Also
- `agent-spawn` - Create agents for assignment
- `agent-metrics` - Monitor assigned agent performance
- `task-monitor` - Track assignment progress
- `agent-communicate` - Enable coordination between assigned agents