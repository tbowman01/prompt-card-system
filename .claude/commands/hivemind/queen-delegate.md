# queen-delegate

Delegate complex tasks to appropriate worker teams with strategic oversight.

## Usage
```bash
npx claude-flow queen delegate [options]
```

## MCP Command
```javascript
mcp__claude-flow__queen_delegate({
  "task": "string",
  "requirements": "object",
  "team_composition": "array",
  "success_criteria": "object"
})
```

## Parameters
- `task` - Task description to delegate
- `requirements` - Technical and business requirements
- `team_composition` - Required agent types for the task
- `success_criteria` - Measurable success metrics

## Examples

### E-commerce Platform Development
```javascript
mcp__claude-flow__queen_delegate({
  "task": "Build complete e-commerce platform with payment processing",
  "requirements": {
    "frontend": "React/TypeScript with responsive design",
    "backend": "Node.js/Express with microservices architecture",
    "database": "PostgreSQL with Redis caching",
    "payment": "Stripe integration with multi-currency support",
    "testing": "Jest/Cypress with 90%+ coverage",
    "deployment": "Docker containers on AWS"
  },
  "team_composition": [
    "architect",
    "frontend_developer", 
    "backend_developer",
    "database_specialist",
    "security_expert",
    "test_engineer",
    "devops_specialist"
  ],
  "success_criteria": {
    "performance": "< 2s page load time",
    "test_coverage": "> 90%",
    "security": "OWASP Top 10 compliant",
    "uptime": "> 99.9%",
    "code_quality": "Sonar score > 8.0",
    "timeline": "8 weeks from start"
  }
})
```

### AI Model Training Pipeline
```javascript
mcp__claude-flow__queen_delegate({
  "task": "Implement MLOps pipeline for model training and deployment",
  "requirements": {
    "ml_framework": "PyTorch/Transformers",
    "data_pipeline": "Apache Airflow",
    "model_registry": "MLflow",
    "monitoring": "Prometheus/Grafana",
    "deployment": "Kubernetes with auto-scaling",
    "experimentation": "Weights & Biases tracking"
  },
  "team_composition": [
    "ml_engineer",
    "data_engineer", 
    "devops_specialist",
    "monitoring_expert",
    "platform_architect"
  ],
  "success_criteria": {
    "automation": "Fully automated training pipeline",
    "monitoring": "Real-time model performance tracking",
    "scalability": "Handle 10x data volume increase",
    "reliability": "< 1% pipeline failure rate",
    "deployment_time": "< 30 minutes from training to production"
  }
})
```

### Security Audit and Remediation
```javascript
mcp__claude-flow__queen_delegate({
  "task": "Comprehensive security audit with immediate remediation",
  "requirements": {
    "scope": "Full application stack security review",
    "compliance": "SOC 2 Type II requirements",
    "penetration_testing": "Automated and manual testing",
    "code_review": "Static and dynamic analysis",
    "infrastructure": "Cloud security configuration review",
    "remediation": "Fix all critical and high severity issues"
  },
  "team_composition": [
    "security_architect",
    "penetration_tester",
    "code_security_specialist",
    "compliance_expert",
    "infrastructure_security"
  ],
  "success_criteria": {
    "vulnerability_count": "Zero critical, < 5 high severity",
    "compliance_score": "100% SOC 2 requirements met",
    "remediation_time": "All critical fixes < 48 hours",
    "documentation": "Complete security playbook delivered",
    "training": "Team security awareness training completed"
  }
})
```

## Team Composition Guidelines

### Development Projects
- **Core Team**: architect, frontend_dev, backend_dev
- **Quality**: test_engineer, security_specialist
- **Infrastructure**: devops_specialist, database_specialist
- **Oversight**: project_coordinator

### Research Projects  
- **Research Team**: researcher, data_analyst, domain_expert
- **Technical**: prototype_developer, ml_engineer
- **Validation**: quality_analyst, peer_reviewer

### Maintenance Projects
- **Core Team**: maintenance_specialist, bug_hunter
- **Quality**: regression_tester, performance_analyst
- **Documentation**: technical_writer, knowledge_curator

## Success Criteria Categories

### Performance Metrics
- Response times, throughput, resource utilization
- Scalability benchmarks, load handling capacity
- User experience metrics, conversion rates

### Quality Metrics
- Test coverage, code quality scores
- Bug density, defect rates
- Security vulnerability counts

### Business Metrics
- Timeline adherence, budget compliance
- Feature completeness, user satisfaction
- ROI, cost savings achieved

### Process Metrics
- Team collaboration effectiveness
- Knowledge transfer completion
- Documentation quality and completeness

## Best Practices
- Match team composition to task complexity and requirements
- Set measurable, time-bound success criteria
- Include cross-functional expertise for complex projects
- Plan for knowledge transfer and documentation
- Monitor progress and adjust team composition as needed
- Ensure clear communication channels between team members

## See Also
- `queen-monitor` - Monitor delegated task progress
- `queen-aggregate` - Combine results from delegated teams
- `task-distribute` - Alternative task distribution approach