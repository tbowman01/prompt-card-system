# task-aggregate

Combine results from distributed task execution into cohesive project deliverables.

## Usage
```bash
npx claude-flow task aggregate [options]
```

## MCP Command
```javascript
mcp__claude-flow__task_aggregate({
  "parent_task_id": "string",
  "completed_subtasks": "array",
  "aggregation_rules": "object",
  "validation_criteria": "object"
})
```

## Parameters
- `parent_task_id` - Main project or epic identifier
- `completed_subtasks` - Array of completed subtask results
- `aggregation_rules` - Rules for combining results
- `validation_criteria` - Quality checks and acceptance criteria

## Aggregation Rules

### merge_strategy
How to combine complementary deliverables
- `layered_integration` - Build layers on top of each other
- `parallel_integration` - Combine independent components
- `sequential_composition` - Chain outputs in sequence
- `feature_consolidation` - Merge related features together

### conflict_resolution
Handle conflicting approaches or results
- `consensus_vote` - Let agents vote on conflicts
- `quality_based` - Choose highest quality implementation
- `deadline_priority` - Prioritize timely completion
- `innovation_focus` - Favor most innovative approach

### quality_assurance
Ensure integrated result meets standards
- `comprehensive_testing` - Full test suite execution
- `peer_review_required` - Multi-agent code review
- `security_validation` - Security scan and audit
- `performance_benchmarking` - Performance requirement validation

## Examples

### Social Media Platform Integration
```javascript
mcp__claude-flow__task_aggregate({
  "parent_task_id": "social_media_platform_v1",
  "completed_subtasks": [
    {
      "id": "user_authentication",
      "agent": "security_specialist",
      "status": "complete",
      "quality_score": 95,
      "deliverables": {
        "auth_service": "deployed",
        "jwt_implementation": "complete",
        "oauth_integration": "tested",
        "security_audit": "passed"
      },
      "test_coverage": 97,
      "performance_metrics": {
        "login_time": "150ms",
        "token_validation": "25ms"
      }
    },
    {
      "id": "user_profile_system",
      "agent": "backend_developer",
      "status": "complete", 
      "quality_score": 88,
      "deliverables": {
        "profile_api": "deployed",
        "image_upload": "complete",
        "privacy_controls": "implemented"
      },
      "test_coverage": 91,
      "performance_metrics": {
        "profile_load": "200ms",
        "image_upload": "2.3s"
      }
    },
    {
      "id": "messaging_system",
      "agent": "realtime_specialist",
      "status": "complete",
      "quality_score": 92,
      "deliverables": {
        "websocket_server": "deployed",
        "message_persistence": "complete",
        "notification_system": "integrated"
      },
      "test_coverage": 89,
      "performance_metrics": {
        "message_delivery": "50ms",
        "concurrent_connections": "10000"
      }
    },
    {
      "id": "frontend_application",
      "agent": "frontend_lead",
      "status": "complete",
      "quality_score": 90,
      "deliverables": {
        "react_components": "complete",
        "responsive_design": "tested",
        "accessibility": "wcag_aa_compliant"
      },
      "test_coverage": 85,
      "performance_metrics": {
        "page_load": "1.2s",
        "interactive_time": "2.1s"
      }
    }
  ],
  "aggregation_rules": {
    "merge_strategy": "layered_integration",
    "conflict_resolution": "quality_based",
    "integration_order": [
      "user_authentication",
      "user_profile_system", 
      "messaging_system",
      "frontend_application"
    ],
    "dependency_validation": true
  },
  "validation_criteria": {
    "integration_tests": true,
    "performance_benchmarks": true,
    "security_audit": true,
    "user_acceptance_testing": true,
    "minimum_quality_threshold": 85,
    "test_coverage_requirement": 90
  }
})
```

### E-commerce Checkout Integration
```javascript
mcp__claude-flow__task_aggregate({
  "parent_task_id": "ecommerce_checkout_system",
  "completed_subtasks": [
    {
      "id": "payment_processing",
      "agent": "payment_specialist",
      "deliverables": {
        "stripe_integration": "complete",
        "paypal_integration": "complete",
        "fraud_detection": "implemented",
        "pci_compliance": "validated"
      },
      "quality_score": 96
    },
    {
      "id": "inventory_management",
      "agent": "inventory_specialist", 
      "deliverables": {
        "stock_tracking": "real_time",
        "reservation_system": "implemented",
        "backorder_handling": "complete"
      },
      "quality_score": 89
    },
    {
      "id": "order_fulfillment",
      "agent": "logistics_specialist",
      "deliverables": {
        "shipping_calculator": "multi_carrier",
        "tracking_integration": "complete",
        "return_process": "automated"
      },
      "quality_score": 87
    }
  ],
  "aggregation_rules": {
    "merge_strategy": "sequential_composition",
    "conflict_resolution": "consensus_vote",
    "transaction_consistency": "required",
    "rollback_capability": "full"
  },
  "validation_criteria": {
    "end_to_end_testing": true,
    "load_testing": "1000_concurrent_orders",
    "security_penetration_testing": true,
    "compliance_validation": ["pci_dss", "gdpr"]
  }
})
```

### Research Report Compilation
```javascript
mcp__claude-flow__task_aggregate({
  "parent_task_id": "market_research_comprehensive_report",
  "completed_subtasks": [
    {
      "id": "competitive_landscape_analysis",
      "agent": "market_researcher",
      "deliverables": {
        "competitor_profiles": "15_companies",
        "feature_comparison_matrix": "complete",
        "pricing_analysis": "detailed",
        "market_positioning": "analyzed"
      },
      "quality_score": 93
    },
    {
      "id": "user_behavior_study",
      "agent": "user_researcher",
      "deliverables": {
        "interview_analysis": "50_participants",
        "usage_patterns": "identified",
        "pain_points": "categorized",
        "personas": "5_detailed_profiles"
      },
      "quality_score": 91
    },
    {
      "id": "technology_trend_analysis",
      "agent": "tech_analyst",
      "deliverables": {
        "emerging_technologies": "assessed",
        "adoption_timelines": "projected",
        "impact_analysis": "quantified",
        "recommendations": "prioritized"
      },
      "quality_score": 88
    }
  ],
  "aggregation_rules": {
    "merge_strategy": "feature_consolidation",
    "narrative_coherence": "required",
    "executive_summary": "auto_generate",
    "citation_consistency": "enforce"
  },
  "validation_criteria": {
    "fact_checking": "automated_and_manual",
    "peer_review": "external_expert",
    "presentation_ready": true,
    "actionable_recommendations": "minimum_10"
  }
})
```

## Integration Process

### Phase 1: Validation
1. **Completeness Check**: Verify all required deliverables present
2. **Quality Assessment**: Validate quality scores meet thresholds
3. **Dependency Validation**: Ensure all dependencies satisfied
4. **Conflict Detection**: Identify integration conflicts

### Phase 2: Pre-Integration
1. **Compatibility Analysis**: Check component compatibility
2. **Integration Planning**: Define integration sequence
3. **Test Environment Setup**: Prepare integration testing
4. **Rollback Planning**: Prepare fallback strategies

### Phase 3: Integration Execution
1. **Component Integration**: Combine deliverables systematically
2. **Configuration Management**: Handle configuration conflicts
3. **Data Migration**: Integrate data and state
4. **Service Orchestration**: Coordinate service interactions

### Phase 4: Validation Testing
1. **Integration Testing**: Comprehensive integration test suite
2. **Performance Testing**: Validate performance requirements
3. **Security Testing**: Comprehensive security validation
4. **User Acceptance Testing**: End-to-end user scenario testing

## Output Format

```json
{
  "aggregation_id": "agg_2024_001_social_platform",
  "parent_task": "social_media_platform_v1",
  "integration_status": "successful",
  "aggregation_timestamp": "2024-01-30T15:45:00Z",
  "integrated_deliverable": {
    "name": "Social Media Platform v1.0",
    "version": "1.0.0",
    "components": [
      {"name": "Authentication Service", "version": "1.2.0", "status": "integrated"},
      {"name": "User Profile System", "version": "1.1.0", "status": "integrated"},
      {"name": "Messaging System", "version": "1.0.0", "status": "integrated"},
      {"name": "Frontend Application", "version": "1.0.0", "status": "integrated"}
    ],
    "deployment_package": "social_platform_v1.0.tar.gz",
    "documentation": "comprehensive_user_admin_developer_guides"
  },
  "quality_assessment": {
    "overall_quality_score": 91.25,
    "test_coverage": 90.5,
    "integration_test_pass_rate": 98.7,
    "performance_benchmark": "all_requirements_met",
    "security_audit": "passed_with_minor_recommendations"
  },
  "integration_challenges": [
    {
      "challenge": "websocket_cors_configuration",
      "resolution": "updated_cors_policy_cross_domain_support",
      "impact": "minimal"
    }
  ],
  "recommendations": [
    "Monitor real-time messaging performance under load",
    "Implement additional caching for profile image serving",
    "Consider adding advanced search functionality in next iteration"
  ],
  "deployment_readiness": {
    "production_ready": true,
    "deployment_checklist": "100_percent_complete",
    "monitoring_configured": true,
    "rollback_tested": true
  }
}
```

## Quality Gates

### Automated Checks
- Code quality thresholds
- Test coverage requirements
- Performance benchmarks
- Security vulnerability scans

### Manual Reviews
- Peer code review completion
- Architecture review approval
- User experience validation
- Documentation completeness

### Business Validation
- Requirement fulfillment verification
- Stakeholder acceptance
- Compliance requirement validation
- Risk assessment completion

## Best Practices
- Define clear integration criteria before task distribution
- Plan for integration conflicts and resolution strategies
- Maintain comprehensive test coverage throughout integration
- Document integration decisions and rationale
- Preserve individual component integrity during integration
- Plan rollback strategies for integration failures
- Validate integrated system meets original requirements
- Gather feedback for future aggregation improvements

## See Also
- `task-distribute` - Distribute tasks for later aggregation
- `task-monitor` - Monitor tasks before aggregation
- `queen-aggregate` - Strategic-level result aggregation
- `consensus-vote` - Resolve conflicts during aggregation