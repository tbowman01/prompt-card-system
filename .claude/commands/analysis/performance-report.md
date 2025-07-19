# performance-report

Generate comprehensive performance reports for swarm operations with detailed analytics, trend analysis, and optimization recommendations.

## Usage
```bash
npx claude-flow analysis performance-report [options]
```

## MCP Command
```javascript
mcp__claude-flow__performance_report({
  "format": "string",
  "timeframe": "string", 
  "include_recommendations": "boolean",
  "baseline_comparison": "string",
  "export_path": "string"
})
```

## Options

### Report Formats
- `--format <type>` - Output format: `json`, `html`, `markdown`, `pdf`, `csv`, `summary`
- `--template <name>` - Use predefined template: `executive`, `technical`, `developer`, `ops`
- `--interactive` - Generate interactive HTML dashboard

### Time & Scope
- `--timeframe <period>` - Analysis period: `1h`, `6h`, `24h`, `7d`, `30d`, `all` (default: 24h)
- `--baseline <file>` - Compare against baseline performance data
- `--compare <id>` - Compare with specific swarm/session ID
- `--include-historical` - Include long-term trend analysis

### Content Options
- `--include-metrics` - Include detailed performance metrics
- `--include-recommendations` - Add optimization recommendations
- `--include-predictions` - Add performance forecasting
- `--include-costs` - Include cost analysis and projections
- `--minimal` - Generate condensed summary report

### Export & Sharing
- `--export <path>` - Export report to specified path
- `--auto-email` - Email report to configured recipients
- `--archive` - Save to performance report archive
- `--dashboard-update` - Update real-time dashboard

## Detailed Examples

### Quick Performance Overview
```bash
# Basic performance summary
npx claude-flow analysis performance-report --format summary

# Last 6 hours with recommendations
npx claude-flow analysis performance-report --timeframe 6h --include-recommendations
```

### Comprehensive Analysis
```bash
# Full technical report
npx claude-flow analysis performance-report \
  --format html \
  --template technical \
  --timeframe 7d \
  --include-metrics \
  --include-recommendations \
  --include-predictions \
  --export performance-analysis.html

# Executive dashboard
npx claude-flow analysis performance-report \
  --format pdf \
  --template executive \
  --timeframe 30d \
  --include-costs \
  --baseline performance-baseline.json \
  --export executive-report.pdf
```

### Comparative Analysis
```bash
# Compare current vs previous week
npx claude-flow analysis performance-report \
  --timeframe 7d \
  --compare $(date -d '1 week ago' +%Y%m%d) \
  --format markdown \
  --export weekly-comparison.md

# A/B test comparison
npx claude-flow analysis performance-report \
  --compare swarm-experiment-a \
  --baseline swarm-control \
  --format json \
  --export ab-test-results.json
```

### Continuous Monitoring
```bash
# Daily automated report
npx claude-flow analysis performance-report \
  --timeframe 24h \
  --template ops \
  --format html \
  --archive \
  --auto-email \
  --dashboard-update

# Real-time dashboard update
npx claude-flow analysis performance-report \
  --timeframe 1h \
  --format json \
  --minimal \
  --dashboard-update
```

## Report Components

### Executive Summary
- **System Health Score** - Overall performance rating (0-100)
- **Key Performance Indicators** - Critical metrics summary
- **Resource Utilization** - High-level resource usage overview
- **Cost Analysis** - Budget impact and efficiency metrics
- **Strategic Recommendations** - High-level improvement suggestions

### Technical Metrics

#### Swarm Performance
```
📊 Swarm Performance Metrics
├── Throughput: 42.3 tasks/hour (+15% vs baseline)
├── Average Latency: 1.2s (-8% vs baseline)
├── Success Rate: 98.7% (+0.3% vs baseline)
├── Concurrency Efficiency: 87% (+12% vs baseline)
└── Agent Utilization: 84% (+5% vs baseline)
```

#### Agent Performance
```
🤖 Agent Performance Breakdown
├── coordinator-001: 95% efficiency, 1.1s avg response
├── coder-001: 89% efficiency, 2.3s avg response
├── coder-002: 92% efficiency, 1.8s avg response
├── analyst-001: 87% efficiency, 3.1s avg response
└── tester-001: 94% efficiency, 1.4s avg response
```

#### Task Analysis
```
📋 Task Performance Analysis
├── Completed: 847 tasks (98.7% success rate)
├── Average Duration: 4.2 minutes (-12% vs baseline)
├── Queue Time: 0.8s average (+0.2s vs baseline)
├── Complex Tasks: 156 (18.4% of total)
└── Failed Tasks: 11 (1.3% failure rate)
```

#### Resource Utilization
```
💾 Resource Utilization
├── Memory Usage: 67% average (85% peak)
├── Token Consumption: 1.2M tokens (15% under budget)
├── API Calls: 3,847 calls (92% success rate)
├── Storage I/O: 245MB transferred
└── Network Latency: 45ms average
```

### Performance Trends

#### Hourly Performance Pattern
```
📈 24-Hour Performance Trend
 Hour  | Tasks | Latency | Success | Efficiency
-------|-------|---------|---------|----------
 00-01 |   18  |  1.1s   |  100%   |   89%
 01-02 |   12  |  0.9s   |  100%   |   92%
 02-03 |    8  |  0.8s   |  100%   |   95%
 ...
 09-10 |   65  |  1.4s   |   98%   |   84%
 10-11 |   73  |  1.6s   |   97%   |   82%
 ...
```

#### Weekly Trend Analysis
```
📅 7-Day Performance Trend
 Day       | Avg Tasks/Hour | Efficiency | Issues
----------|----------------|------------|--------
 Monday    |      42.3      |    87%     |   2
 Tuesday   |      48.1      |    89%     |   1
 Wednesday |      39.7      |    85%     |   3
 Thursday  |      44.2      |    88%     |   1
 Friday    |      41.8      |    86%     |   2
 Saturday  |      28.5      |    91%     |   0
 Sunday    |      23.1      |    94%     |   0
```

### Cost Analysis

#### Token Economics
```
💰 Token Usage & Costs
├── Total Tokens: 1,247,893 (15% under monthly budget)
├── Cost per Task: $0.023 average (-8% vs target)
├── Most Expensive: Complex analysis tasks ($0.087/task)
├── Most Efficient: Simple code reviews ($0.008/task)
└── Projected Monthly Cost: $1,847 (vs $2,000 budget)
```

#### Cost Optimization Opportunities
```
🎯 Cost Optimization Recommendations
1. Template Optimization: -12% token usage (Est. saving: $240/month)
2. Caching Strategy: -8% API calls (Est. saving: $160/month)
3. Agent Specialization: -15% task duration (Est. saving: $300/month)
4. Batch Processing: -20% setup overhead (Est. saving: $200/month)
```

### Quality Metrics

#### Output Quality Assessment
```
🎯 Quality Metrics
├── Code Quality Score: 8.7/10 (+0.3 vs baseline)
├── Test Coverage: 94% (+2% vs baseline)
├── Documentation Score: 8.2/10 (-0.1 vs baseline)
├── Security Compliance: 97% (+1% vs baseline)
└── Performance Standards: 89% met (8.9/10 average)
```

#### Error Analysis
```
⚠️ Error Pattern Analysis
├── Total Errors: 23 (2.1% of operations)
├── Network Errors: 12 (52% of errors)
├── Timeout Errors: 7 (30% of errors)
├── Validation Errors: 3 (13% of errors)
└── System Errors: 1 (4% of errors)
```

## Advanced Analytics

### Predictive Analysis
```
🔮 Performance Predictions (Next 7 Days)
├── Expected Throughput: 45-52 tasks/hour
├── Predicted Bottlenecks: API rate limits (Day 3-4)
├── Resource Requirements: +15% memory, +8% tokens
├── Optimal Agent Count: 6-7 agents
└── Recommended Maintenance: Day 5 (low activity period)
```

### Anomaly Detection
```
🚨 Performance Anomalies Detected
1. Tuesday 14:30-15:15: 40% latency spike (API timeout storm)
2. Wednesday 09:45: Memory usage peak (large file processing)
3. Thursday 11:20: Success rate drop to 94% (validation issue)
```

### Correlation Analysis
```
🔗 Performance Correlations
├── Task Complexity ↔ Agent Efficiency: -0.73 (strong negative)
├── Time of Day ↔ Response Time: +0.45 (moderate positive)
├── Agent Load ↔ Error Rate: +0.62 (strong positive)
└── Queue Depth ↔ User Satisfaction: -0.58 (strong negative)
```

## Optimization Recommendations

### High Impact Optimizations
```
🚀 Priority Optimization Recommendations

1. Implement Smart Caching (Impact: High, Effort: Medium)
   - Reduce token usage by 25%
   - Improve response time by 40%
   - Implementation time: 2-3 days

2. Optimize Agent Allocation (Impact: High, Effort: Low)
   - Increase throughput by 30%
   - Reduce queue time by 50%
   - Implementation time: 1 day

3. Enhanced Error Handling (Impact: Medium, Effort: Low)
   - Improve success rate to 99.5%
   - Reduce user frustration
   - Implementation time: 1 day
```

### Performance Targets
```
📈 Recommended Performance Targets
├── Throughput: 60+ tasks/hour (vs current 42.3)
├── Average Latency: <1.0s (vs current 1.2s)
├── Success Rate: >99% (vs current 98.7%)
├── Agent Efficiency: >90% (vs current 87%)
└── Cost per Task: <$0.020 (vs current $0.023)
```

## Report Templates

### Executive Template
- High-level KPIs and business impact
- Cost analysis and ROI metrics
- Strategic recommendations
- Risk assessment and mitigation

### Technical Template
- Detailed performance metrics
- System architecture analysis
- Bottleneck identification
- Implementation recommendations

### Developer Template
- Code quality metrics
- Agent performance breakdown
- Debugging information
- Development workflow optimization

### Operations Template
- System health monitoring
- Resource utilization tracking
- Incident analysis
- Capacity planning

## Integration Examples

### Claude Code Integration
```javascript
// Generate comprehensive performance report
mcp__claude-flow__performance_report({
  format: "html",
  timeframe: "24h",
  include_recommendations: true,
  include_predictions: true,
  export_path: "reports/performance-" + new Date().toISOString().split('T')[0] + ".html"
})

// Quick performance check
mcp__claude-flow__performance_report({
  format: "summary",
  timeframe: "1h"
})

// Baseline comparison
mcp__claude-flow__performance_report({
  format: "json",
  timeframe: "7d",
  baseline_comparison: "performance-baseline.json",
  export_path: "comparison-report.json"
})
```

### Automated Reporting
```bash
# Daily automated reports
crontab -e
# Add: 0 9 * * * npx claude-flow analysis performance-report --template ops --auto-email

# Weekly executive summary
# Add: 0 9 * * 1 npx claude-flow analysis performance-report --template executive --timeframe 7d --export weekly-summary.pdf
```

### CI/CD Integration
```yaml
# GitHub Actions workflow
name: Performance Analysis
on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Generate Performance Report
        run: |
          npx claude-flow analysis performance-report \
            --format json \
            --timeframe 6h \
            --export performance-report.json
      - name: Upload Report
        uses: actions/upload-artifact@v2
        with:
          name: performance-report
          path: performance-report.json
```

## Best Practices

### Regular Reporting Schedule
1. **Hourly**: Quick health checks during active development
2. **Daily**: Comprehensive analysis for ongoing optimization
3. **Weekly**: Trend analysis and strategic planning
4. **Monthly**: Executive summaries and budget reviews

### Report Customization
- Tailor reports to audience (executive vs technical)
- Focus on actionable insights over raw data
- Include comparative analysis for context
- Provide clear optimization roadmaps

### Performance Monitoring
- Set up automated alerting for performance degradation
- Track key metrics against established baselines
- Monitor trends to predict future issues
- Regular optimization implementation and validation

## Troubleshooting

### Common Issues
- **Large Report Generation**: Use `--minimal` flag for quick summaries
- **Export Failures**: Check file permissions and available disk space
- **Missing Data**: Ensure sufficient operation history exists
- **Format Errors**: Verify template compatibility with output format

### Performance Tips
- Use appropriate timeframes for analysis scope
- Export large reports to files rather than console
- Schedule intensive reporting during low-activity periods
- Cache baseline data for faster comparative analysis

## See Also

- **[bottleneck-detect](./bottleneck-detect.md)** - Identify specific performance constraints
- **[token-usage](./token-usage.md)** - Detailed token consumption analysis
- **[cost-analysis](./cost-analysis.md)** - Financial impact and optimization
- **[trend-analysis](./trend-analysis.md)** - Long-term performance trends
- **[Monitoring Commands](../monitoring/README.md)** - Real-time performance monitoring
