# quality-assess

Comprehensive code quality assessment and validation with automated analysis, compliance checking, and improvement recommendations.

## Usage
```bash
npx claude-flow analysis quality-assess [options]
```

## MCP Command
```javascript
mcp__claude-flow__quality_assess({
  "target": "string",
  "criteria": "array",
  "compliance_standards": "array",
  "depth": "string",
  "auto_fix": "boolean"
})
```

## Assessment Types

### Code Quality Analysis
- `code-review` - Automated code review with best practices checking
- `architecture-review` - System architecture and design patterns analysis
- `security-scan` - Security vulnerability and compliance assessment
- `performance-review` - Performance optimization opportunities
- `maintainability` - Code maintainability and technical debt analysis

### Compliance Assessment
- `standards-compliance` - Industry standards compliance (ISO, NIST, etc.)
- `coding-standards` - Language-specific coding standards adherence
- `accessibility` - Web accessibility compliance (WCAG, ADA)
- `security-compliance` - Security standards compliance (OWASP, SOC2)
- `regulatory-compliance` - Regulatory requirements (GDPR, HIPAA, etc.)

## Options

### Target Selection
- `--target <scope>` - Assessment scope: `current-file`, `current-project`, `repository`, `codebase`
- `--files <pattern>` - Specific file patterns to assess
- `--exclude <pattern>` - Files/directories to exclude from assessment
- `--language <lang>` - Focus on specific programming language

### Assessment Criteria
- `--criteria <types>` - Quality criteria: `all`, `security`, `performance`, `maintainability`, `standards`
- `--standards <list>` - Compliance standards to check against
- `--severity <level>` - Minimum issue severity: `low`, `medium`, `high`, `critical`
- `--custom-rules <file>` - Custom quality rules configuration

### Analysis Depth
- `--depth <level>` - Analysis depth: `surface`, `standard`, `deep`, `comprehensive`
- `--include-dependencies` - Include external dependencies in assessment
- `--cross-file-analysis` - Analyze relationships between files
- `--architectural-analysis` - Include system architecture assessment

### Automation Options
- `--auto-fix` - Automatically fix identified issues where possible
- `--suggestions` - Generate improvement suggestions
- `--priority-ranking` - Rank issues by business impact
- `--remediation-plan` - Generate step-by-step remediation plan

### Reporting Options
- `--export <format>` - Export format: `json`, `html`, `pdf`, `csv`, `sonarqube`
- `--report-type <type>` - Report type: `summary`, `detailed`, `executive`, `technical`
- `--baseline <file>` - Compare against quality baseline
- `--trend-analysis` - Include quality trend analysis

## Detailed Examples

### Basic Quality Assessment
```bash
# Quick quality overview of current project
npx claude-flow analysis quality-assess --target current-project

# Comprehensive quality analysis
npx claude-flow analysis quality-assess \
  --target repository \
  --criteria all \
  --depth comprehensive \
  --export quality-report.html
```

### Security-Focused Assessment
```bash
# Security vulnerability scan
npx claude-flow analysis quality-assess \
  --criteria security \
  --standards owasp,nist \
  --severity medium \
  --auto-fix \
  --export security-assessment.pdf

# Compliance check for specific standards
npx claude-flow analysis quality-assess \
  --standards-compliance \
  --standards soc2,gdpr,hipaa \
  --regulatory-compliance \
  --export compliance-report.json
```

### Performance Quality Analysis
```bash
# Performance optimization assessment
npx claude-flow analysis quality-assess \
  --criteria performance \
  --depth deep \
  --include-dependencies \
  --suggestions \
  --priority-ranking

# Architecture quality review
npx claude-flow analysis quality-assess \
  --architecture-review \
  --cross-file-analysis \
  --architectural-analysis \
  --export architecture-assessment.pdf
```

### Automated Quality Management
```bash
# Auto-fix quality issues
npx claude-flow analysis quality-assess \
  --auto-fix \
  --criteria maintainability,standards \
  --severity high \
  --remediation-plan \
  --export remediation-plan.json

# Quality trend monitoring
npx claude-flow analysis quality-assess \
  --baseline quality-baseline.json \
  --trend-analysis \
  --report-type executive \
  --export monthly-quality-trends.pdf
```

## Quality Assessment Dashboard

### Code Quality Metrics
```
🎯 Code Quality Assessment Report

Overall Quality Score: 8.7/10 (+0.3 vs baseline)
├── Code Structure: 9.1/10 (Excellent)
├── Security: 8.9/10 (Very Good)
├── Performance: 8.2/10 (Good)
├── Maintainability: 8.8/10 (Very Good)
├── Documentation: 7.9/10 (Good)
└── Test Coverage: 9.4/10 (Excellent)

📊 Quality by Component
├── Backend Services: 8.9/10
│   ├── API Endpoints: 9.2/10
│   ├── Business Logic: 8.7/10
│   ├── Data Layer: 8.5/10
│   └── Security Layer: 9.4/10
│
├── Frontend Application: 8.3/10
│   ├── Component Structure: 8.8/10
│   ├── State Management: 8.1/10
│   ├── User Interface: 8.5/10
│   └── Performance: 7.8/10
│
├── Database Design: 9.0/10
│   ├── Schema Design: 9.2/10
│   ├── Query Optimization: 8.9/10
│   ├── Indexing Strategy: 8.8/10
│   └── Data Integrity: 9.1/10
│
└── Infrastructure: 8.5/10
    ├── Configuration: 8.7/10
    ├── Monitoring: 8.2/10
    ├── Security: 8.9/10
    └── Scalability: 8.3/10

🏆 Quality Achievements
├── Zero critical security vulnerabilities
├── 94% test coverage (industry leading)
├── 97% coding standards compliance
├── 89% performance optimization opportunities addressed
└── 92% documentation completeness
```

### Security Assessment Results
```
🔒 Security Quality Assessment

Security Score: 8.9/10 (Very High)
├── Vulnerability Count: 0 Critical, 2 High, 7 Medium, 12 Low
├── Security Standards Compliance: 97%
├── Encryption Implementation: 9.4/10
├── Authentication & Authorization: 9.1/10
├── Data Protection: 8.8/10
└── Network Security: 8.7/10

🛡️ Security Analysis by Category
├── Input Validation: 9.2/10
│   ├── SQL Injection Protection: ✅ Excellent
│   ├── XSS Prevention: ✅ Excellent
│   ├── CSRF Protection: ✅ Implemented
│   └── Input Sanitization: ✅ Comprehensive
│
├── Authentication Security: 9.1/10
│   ├── Password Policies: ✅ Strong
│   ├── Multi-Factor Auth: ✅ Implemented
│   ├── Session Management: ✅ Secure
│   └── Token Security: ✅ JWT Best Practices
│
├── Data Security: 8.8/10
│   ├── Encryption at Rest: ✅ AES-256
│   ├── Encryption in Transit: ✅ TLS 1.3
│   ├── Key Management: ✅ Secure Vault
│   └── Data Masking: ⚠️ Partial Implementation
│
├── Infrastructure Security: 8.7/10
│   ├── Container Security: ✅ Hardened Images
│   ├── Network Segmentation: ✅ Proper Isolation
│   ├── Access Controls: ✅ Principle of Least Privilege
│   └── Monitoring & Logging: ✅ Comprehensive
│
└── Compliance Status: 97%
    ├── OWASP Top 10: ✅ 100% Compliant
    ├── NIST Framework: ✅ 95% Compliant
    ├── SOC2 Type II: ✅ 98% Compliant
    └── GDPR Requirements: ✅ 94% Compliant

🚨 Security Issues Identified
High Priority (2 issues):
1. API Rate Limiting: Insufficient protection against brute force
2. Log Sanitization: Potential sensitive data in logs

Medium Priority (7 issues):
├── Password history enforcement needs improvement
├── Session timeout configuration could be optimized
├── Some endpoints lack request size limits
├── Certificate pinning not implemented for mobile
├── Security headers could be enhanced
├── Dependency vulnerabilities in 3 packages
└── Error messages could leak system information

Remediation Timeline: 5 days for high priority, 2 weeks for medium priority
```

### Performance Quality Analysis
```
⚡ Performance Quality Assessment

Performance Score: 8.2/10 (Good)
├── Response Time: 8.5/10 (Average: 245ms)
├── Throughput: 8.1/10 (1,247 req/sec peak)
├── Resource Utilization: 7.8/10 (68% CPU avg)
├── Scalability: 8.4/10 (Linear scaling to 10x load)
├── Database Performance: 8.7/10 (Average query: 45ms)
└── Frontend Performance: 7.6/10 (LCP: 1.8s, FID: 85ms)

🏃‍♂️ Performance by Component
├── API Response Times:
│   ├── Authentication: 123ms average (Target: <150ms) ✅
│   ├── Data Retrieval: 89ms average (Target: <100ms) ✅
│   ├── Complex Queries: 267ms average (Target: <300ms) ✅
│   └── File Operations: 445ms average (Target: <500ms) ✅
│
├── Database Performance:
│   ├── Query Optimization: 8.9/10
│   ├── Index Usage: 94% (Excellent)
│   ├── Connection Pooling: 8.7/10
│   └── Slow Queries: 3% (Target: <5%) ✅
│
├── Frontend Performance:
│   ├── First Contentful Paint: 1.2s (Target: <1.5s) ✅
│   ├── Largest Contentful Paint: 1.8s (Target: <2.5s) ✅
│   ├── Cumulative Layout Shift: 0.08 (Target: <0.1) ✅
│   └── Time to Interactive: 2.1s (Target: <3.0s) ✅
│
└── Infrastructure Performance:
    ├── CPU Utilization: 68% average (Target: <80%) ✅
    ├── Memory Usage: 72% average (Target: <85%) ✅
    ├── Network Latency: 23ms average (Target: <50ms) ✅
    └── Disk I/O: 45% utilization (Target: <70%) ✅

🎯 Performance Optimization Opportunities
High Impact Optimizations:
1. Image Optimization: -23% load time improvement
2. Database Query Caching: -34% response time improvement
3. CDN Implementation: -18% global latency reduction
4. Code Splitting: -27% initial bundle size reduction

Medium Impact Optimizations:
├── Compression optimization: -12% transfer size
├── Lazy loading implementation: -15% initial load time
├── Connection optimization: -8% connection time
└── Memory leak prevention: -5% memory usage

Performance Target Achievement:
├── Response Time Targets: 94% met
├── Throughput Targets: 89% met
├── Resource Utilization: 91% within targets
└── User Experience Metrics: 87% meet Core Web Vitals
```

## Code Quality Standards

### Coding Standards Compliance
```
📋 Coding Standards Assessment

Overall Compliance: 97% (Excellent)
├── Language-Specific Standards: 98%
├── Team Coding Guidelines: 96%
├── Industry Best Practices: 95%
├── Documentation Standards: 94%
└── Testing Standards: 99%

📊 Compliance by Language
├── TypeScript/JavaScript: 98%
│   ├── ESLint Rules: 99% compliance
│   ├── Prettier Formatting: 100% compliance
│   ├── JSDoc Documentation: 94% compliance
│   └── Testing Coverage: 94% (Target: 90%)
│
├── Python: 97%
│   ├── PEP 8 Compliance: 98%
│   ├── Type Hints: 89% coverage
│   ├── Docstring Coverage: 92%
│   └── Black Formatting: 100%
│
├── SQL: 95%
│   ├── Naming Conventions: 97%
│   ├── Query Optimization: 93%
│   ├── Schema Documentation: 91%
│   └── Security Practices: 98%
│
└── Configuration Files: 96%
    ├── YAML/JSON Formatting: 100%
    ├── Environment Variables: 94%
    ├── Docker Best Practices: 95%
    └── CI/CD Standards: 97%

⚠️ Standards Violations
High Priority (8 violations):
├── Missing error handling in 3 API endpoints
├── Inconsistent logging format in 2 modules
├── Outdated dependency versions (5 packages)
├── Missing input validation in 2 forms
├── Incomplete documentation for 4 functions
├── Test coverage below 90% in 1 module
├── Hard-coded configuration values (3 instances)
└── Missing API versioning in 2 endpoints

Medium Priority (15 violations):
├── Variable naming inconsistencies (7 instances)
├── Long function implementations (4 functions)
├── Missing type annotations (6 parameters)
├── Unused imports (8 files)
├── Comment formatting issues (12 comments)
├── Missing return type hints (5 functions)
├── Inconsistent indentation (3 files)
└── Magic number usage (9 instances)

Auto-Fixable Issues: 78% (23 out of 29 violations)
Estimated Fix Time: 2.5 hours for high priority, 4 hours total
```

### Maintainability Assessment
```
🔧 Code Maintainability Analysis

Maintainability Score: 8.8/10 (Very Good)
├── Code Complexity: 8.9/10 (Low complexity)
├── Documentation Quality: 7.9/10 (Good coverage)
├── Test Coverage: 9.4/10 (Excellent)
├── Dependency Management: 8.7/10 (Well managed)
├── Code Duplication: 9.1/10 (Minimal duplication)
└── Technical Debt: 8.5/10 (Low debt ratio)

📈 Maintainability Metrics
├── Cyclomatic Complexity:
│   ├── Average: 2.3 (Target: <5) ✅
│   ├── Maximum: 8 (Target: <10) ✅
│   ├── Functions >10: 0 (Target: 0) ✅
│   └── Classes >15: 1 (Target: 0) ⚠️
│
├── Code Duplication:
│   ├── Duplicate Lines: 2.1% (Target: <5%) ✅
│   ├── Duplicate Blocks: 1.3% (Target: <3%) ✅
│   ├── Similar Functions: 3 pairs identified
│   └── Refactoring Opportunities: 7 identified
│
├── Documentation Coverage:
│   ├── Function Documentation: 94%
│   ├── Class Documentation: 89%
│   ├── API Documentation: 96%
│   ├── README Completeness: 87%
│   └── Inline Comments: 78%
│
├── Test Coverage:
│   ├── Unit Tests: 94% coverage
│   ├── Integration Tests: 87% coverage
│   ├── End-to-End Tests: 78% coverage
│   ├── Mutation Testing: 89% score
│   └── Test Quality Score: 9.2/10
│
└── Dependency Health:
    ├── Outdated Dependencies: 5 packages
    ├── Security Vulnerabilities: 2 low severity
    ├── License Compatibility: 100% compatible
    ├── Bundle Size Impact: Optimized
    └── Update Effort: Low (2 hours estimated)

🚧 Technical Debt Analysis
Total Technical Debt: 12.5 hours (Low)
├── Code Debt: 4.2 hours
│   ├── Refactoring opportunities: 7 items
│   ├── Code smell fixes: 12 items
│   └── Architecture improvements: 3 items
│
├── Documentation Debt: 3.1 hours
│   ├── Missing documentation: 15 items
│   ├── Outdated documentation: 8 items
│   └── Example updates needed: 5 items
│
├── Test Debt: 2.8 hours
│   ├── Missing test cases: 18 items
│   ├── Flaky tests: 3 items
│   └── Test optimization: 6 items
│
└── Infrastructure Debt: 2.4 hours
    ├── Configuration updates: 4 items
    ├── Monitoring improvements: 3 items
    └── Security updates: 5 items

Debt Reduction Priority:
1. Critical path refactoring (1.5 hours)
2. Security-related updates (1.2 hours)
3. Test coverage improvements (2.1 hours)
4. Documentation updates (1.8 hours)
```

## Automated Quality Improvements

### Auto-Fix Capabilities
```
🔄 Automated Quality Fixes

Auto-Fix Success Rate: 78% (23/29 issues)
├── Code Formatting: 100% success (12/12 issues)
├── Import Organization: 100% success (8/8 issues)
├── Simple Refactoring: 85% success (11/13 issues)
├── Documentation Generation: 67% success (4/6 issues)
├── Test Generation: 45% success (9/20 opportunities)
└── Security Fixes: 90% success (9/10 issues)

✅ Successfully Auto-Fixed:
├── Code Formatting & Style (12 issues)
│   ├── Indentation standardization
│   ├── Line length optimization
│   ├── Bracket and spacing consistency
│   └── Import statement organization
│
├── Code Quality Improvements (11 issues)
│   ├── Unused variable removal
│   ├── Dead code elimination
│   ├── Simple complexity reduction
│   ├── Magic number extraction
│   └── Variable name improvements
│
├── Security Enhancements (9 issues)
│   ├── Input validation additions
│   ├── SQL injection prevention
│   ├── XSS protection implementation
│   ├── CSRF token additions
│   └── Secure header configurations
│
└── Documentation Updates (4 issues)
    ├── Missing function docstrings
    ├── Parameter documentation
    ├── Return type documentation
    └── Example code updates

🔧 Manual Fix Required (6 issues):
├── Complex architectural changes (2 issues)
├── Business logic modifications (1 issue)
├── Database schema updates (1 issue)
├── API contract changes (1 issue)
└── Performance optimizations requiring analysis (1 issue)

Post-Fix Quality Score: 9.2/10 (+0.4 improvement)
Estimated Manual Fix Time: 6.5 hours
ROI of Auto-Fixes: 340% (23 hours saved vs implementation cost)
```

### Quality Improvement Recommendations
```
💡 Quality Improvement Roadmap

Phase 1: Quick Wins (1-2 weeks)
├── Implement remaining auto-fixes (0.5 days)
├── Update outdated dependencies (1 day)
├── Add missing unit tests (2 days)
├── Improve documentation coverage (1.5 days)
├── Fix security vulnerabilities (1 day)
└── Expected Quality Gain: +0.6 points

Phase 2: Medium Impact (2-4 weeks)
├── Refactor complex functions (3 days)
├── Implement caching strategies (2 days)
├── Enhance error handling (2 days)
├── Optimize database queries (2 days)
├── Improve API response times (3 days)
└── Expected Quality Gain: +0.8 points

Phase 3: Strategic Improvements (1-2 months)
├── Architecture modernization (2 weeks)
├── Performance optimization (1 week)
├── Advanced security features (1 week)
├── Monitoring and observability (3 days)
├── Load testing and scaling (1 week)
└── Expected Quality Gain: +1.1 points

Target Quality Score: 9.7/10 (vs current 8.7/10)
Total Investment: 7 weeks effort
Expected ROI: 245% (reduced maintenance, faster development)
Risk Mitigation: Phased approach, continuous testing, rollback plans
```

## Integration Examples

### Claude Code Integration
```javascript
// Comprehensive quality assessment
mcp__claude-flow__quality_assess({
  target: "repository",
  criteria: ["security", "performance", "maintainability"],
  depth: "comprehensive",
  auto_fix: true
})

// Security-focused assessment
mcp__claude-flow__quality_assess({
  target: "current-project",
  criteria: ["security"],
  compliance_standards: ["owasp", "nist", "soc2"],
  auto_fix: false,
  severity: "medium"
})

// Performance quality check
mcp__claude-flow__quality_assess({
  target: "current-file",
  criteria: ["performance"],
  depth: "deep",
  suggestions: true
})
```

### CI/CD Integration
```yaml
# GitHub Actions Quality Gate
name: Quality Assessment
on: [push, pull_request]

jobs:
  quality-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Quality Assessment
        run: |
          npx claude-flow analysis quality-assess \
            --target repository \
            --criteria all \
            --auto-fix \
            --export quality-report.json
      - name: Quality Gate Check
        run: |
          quality_score=$(cat quality-report.json | jq '.overall_score')
          if (( $(echo "$quality_score < 8.0" | bc -l) )); then
            echo "Quality gate failed: Score $quality_score < 8.0"
            exit 1
          fi
```

### Automated Quality Monitoring
```bash
# Daily quality monitoring
npx claude-flow analysis quality-assess \
  --baseline quality-baseline.json \
  --trend-analysis \
  --auto-fix \
  --alert-degradation \
  --export daily-quality-report.json

# Weekly quality review
npx claude-flow analysis quality-assess \
  --comprehensive-review \
  --report-type executive \
  --improvement-roadmap \
  --export weekly-quality-executive.pdf
```

## Best Practices

### Quality Management Strategy
1. **Establish Quality Baselines** - Document current quality metrics
2. **Implement Continuous Assessment** - Automated quality checks in CI/CD
3. **Prioritize Security** - Regular security assessments and compliance checks
4. **Focus on Maintainability** - Reduce technical debt systematically
5. **Monitor Trends** - Track quality improvements over time

### Assessment Frequency
- **Real-time**: Critical security and performance checks
- **Daily**: Code quality and standards compliance
- **Weekly**: Comprehensive quality review and trend analysis
- **Monthly**: Strategic quality planning and roadmap updates

### Quality Gates
- Minimum quality score thresholds for deployment
- Security vulnerability limits (zero critical, limited high)
- Performance benchmarks for user-facing features
- Test coverage requirements for critical components

## Troubleshooting

### Common Quality Issues
- **Low Quality Scores**: Focus on high-impact improvements first
- **Security Violations**: Prioritize critical and high severity issues
- **Performance Problems**: Profile and optimize bottlenecks systematically
- **Compliance Failures**: Review standards requirements and implementation gaps

### Assessment Performance
- Use appropriate depth levels for assessment scope
- Exclude non-critical files from comprehensive assessments
- Cache assessment results for incremental analysis
- Parallel processing for large codebases

## See Also

- **[security-scan](../security/security-scan.md)** - Dedicated security scanning tools
- **[performance-report](./performance-report.md)** - Performance analysis and optimization
- **[error-analysis](./error-analysis.md)** - Error pattern analysis and prevention
- **[productivity-metrics](./productivity-metrics.md)** - Development productivity assessment