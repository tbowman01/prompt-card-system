# Analysis Commands

Comprehensive analysis and performance optimization tools for Claude Flow swarm operations. These commands provide deep insights into system performance, resource utilization, and optimization opportunities.

## 🎯 Overview

The analysis suite enables:
- **Performance Monitoring** - Real-time and historical performance analysis
- **Bottleneck Detection** - Identify and resolve system constraints
- **Resource Optimization** - Token usage, cost analysis, and efficiency improvements
- **Quality Assessment** - Code quality, output validation, and compliance checking
- **Trend Analysis** - Long-term performance patterns and predictions
- **Error Analysis** - Failure pattern detection and resolution strategies

## 📊 Core Analysis Commands

### Performance Analysis
- **[performance-report](./performance-report.md)** - Comprehensive performance analytics and reporting
- **[bottleneck-detect](./bottleneck-detect.md)** - Identify and resolve system performance bottlenecks
- **[trend-analysis](./trend-analysis.md)** - Long-term performance trends and predictions

### Resource Analysis
- **[token-usage](./token-usage.md)** - Token consumption analysis and optimization
- **[cost-analysis](./cost-analysis.md)** - Cost tracking, budgeting, and optimization

### Quality Analysis
- **[quality-assess](./quality-assess.md)** - Output quality assessment and validation
- **[error-analysis](./error-analysis.md)** - Error pattern analysis and prevention

## 🚀 Quick Start Examples

### Performance Health Check
```bash
# Quick performance overview
npx claude-flow analysis performance-report --format summary

# Detect immediate bottlenecks
npx claude-flow analysis bottleneck-detect --threshold 15 --fix

# Check token efficiency
npx claude-flow analysis token-usage --period 24h --optimize
```

### Comprehensive Analysis
```bash
# Full system analysis
npx claude-flow analysis performance-report --format html --include-all
npx claude-flow analysis bottleneck-detect --time-range 7d --export bottlenecks.json
npx claude-flow analysis cost-analysis --period 30d --budget 1000
```

### Quality & Error Analysis
```bash
# Quality assessment
npx claude-flow analysis quality-assess --criteria all --export quality-report.pdf

# Error pattern analysis
npx claude-flow analysis error-analysis --period 7d --categorize --solutions
```

## 📈 Analysis Workflow

### 1. Performance Baseline
```bash
# Establish performance baseline
npx claude-flow analysis performance-report --baseline --export baseline.json
```

### 2. Continuous Monitoring
```bash
# Set up monitoring dashboard
npx claude-flow analysis bottleneck-detect --monitor --interval 5m
npx claude-flow analysis token-usage --track --alert-threshold 80%
```

### 3. Optimization Cycle
```bash
# Identify optimizations
npx claude-flow analysis bottleneck-detect --recommendations
npx claude-flow analysis cost-analysis --optimize --target 20%

# Apply optimizations
npx claude-flow analysis bottleneck-detect --fix --auto-approve
```

### 4. Quality Validation
```bash
# Validate improvements
npx claude-flow analysis performance-report --compare baseline.json
npx claude-flow analysis quality-assess --regression-test
```

## 🔧 Integration with Claude Code

### MCP Commands
```javascript
// Performance analysis
mcp__claude-flow__performance_report({
  format: "detailed",
  timeframe: "24h",
  include_recommendations: true
})

// Bottleneck detection with auto-fix
mcp__claude-flow__bottleneck_analyze({
  component: "swarm",
  auto_fix: true,
  threshold: 20
})

// Token usage optimization
mcp__claude-flow__token_usage({
  operation: "analyze",
  timeframe: "7d",
  optimization_target: 25
})
```

### Automated Analysis Hooks
```bash
# Post-task analysis
npx claude-flow hooks post-task --analyze-performance --optimize-tokens

# Session-end comprehensive analysis
npx claude-flow hooks session-end --full-analysis --export-report
```

## 📊 Analysis Categories

### System Performance
- **Throughput Analysis** - Tasks completed per hour/minute
- **Latency Monitoring** - Response times and delays
- **Concurrency Efficiency** - Parallel execution effectiveness
- **Resource Utilization** - CPU, memory, and network usage

### Agent Performance
- **Individual Agent Metrics** - Per-agent performance tracking
- **Collaboration Efficiency** - Inter-agent communication analysis
- **Specialization Effectiveness** - Task-to-agent matching optimization
- **Learning Progress** - Agent improvement over time

### Task Analysis
- **Completion Rates** - Success/failure statistics
- **Complexity Analysis** - Task difficulty assessment
- **Queue Management** - Task distribution and waiting times
- **Dependency Tracking** - Task interdependency optimization

### Cost & Resource Management
- **Token Economics** - Cost per task, optimization opportunities
- **Time Investment** - ROI analysis for different task types
- **Resource Allocation** - Optimal resource distribution strategies
- **Budget Tracking** - Spending patterns and forecasting

## 🎯 Best Practices

### Regular Analysis Schedule
1. **Hourly**: Quick bottleneck checks during active development
2. **Daily**: Comprehensive performance and token usage review
3. **Weekly**: Trend analysis and optimization planning
4. **Monthly**: Full system analysis and strategic planning

### Performance Optimization Workflow
1. **Baseline Establishment** - Document current performance metrics
2. **Continuous Monitoring** - Set up automated analysis and alerts
3. **Bottleneck Resolution** - Address performance constraints promptly
4. **Optimization Validation** - Measure improvement effectiveness
5. **Documentation** - Record optimization strategies and results

### Cost Management
1. **Budget Setting** - Establish clear cost targets and limits
2. **Usage Tracking** - Monitor token consumption patterns
3. **Optimization Identification** - Find cost reduction opportunities
4. **ROI Analysis** - Evaluate cost vs. performance trade-offs

## 📚 Advanced Analysis Features

### Predictive Analytics
- **Performance Forecasting** - Predict future performance trends
- **Capacity Planning** - Determine optimal resource allocation
- **Cost Projection** - Forecast budget requirements
- **Bottleneck Prediction** - Anticipate performance constraints

### Machine Learning Integration
- **Pattern Recognition** - Identify recurring performance patterns
- **Anomaly Detection** - Spot unusual behavior automatically
- **Optimization Learning** - Learn from successful optimizations
- **Recommendation Engine** - AI-powered improvement suggestions

### Reporting & Visualization
- **Interactive Dashboards** - Real-time performance visualization
- **Comparative Analysis** - Side-by-side performance comparisons
- **Trend Visualization** - Long-term performance trends
- **Executive Summaries** - High-level performance reports

## 🔗 Related Documentation

- **[Monitoring Commands](../monitoring/README.md)** - Real-time monitoring tools
- **[Optimization Commands](../optimization/README.md)** - Performance optimization utilities
- **[Memory Commands](../memory/README.md)** - Memory management and analysis
- **[Coordination Commands](../coordination/README.md)** - Swarm coordination analysis

## 🆘 Troubleshooting

### Common Analysis Issues
- **Insufficient Data** - Run analysis after sufficient operation time
- **High Analysis Overhead** - Reduce analysis frequency for production systems
- **Memory Usage** - Use streaming analysis for large datasets
- **Export Failures** - Check file permissions and disk space

### Performance Tips
- Use `--summary` for quick analysis
- Export large reports to files instead of console output
- Schedule intensive analysis during low-activity periods
- Use incremental analysis for continuous monitoring

---

*For detailed command usage, see individual command documentation files.*
