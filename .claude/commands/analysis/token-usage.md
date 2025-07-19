# token-usage

Comprehensive token usage analysis and optimization tool for efficient resource management and cost control.

## Usage
```bash
npx claude-flow analysis token-usage [options]
```

## MCP Command
```javascript
mcp__claude-flow__token_usage({
  "operation": "string",
  "timeframe": "string",
  "optimization_target": "number",
  "breakdown_type": "string"
})
```

## Operations

### Analysis Operations
- `analyze` - Comprehensive token usage analysis
- `optimize` - Identify and suggest optimizations
- `track` - Continuous token consumption monitoring
- `forecast` - Predict future token requirements
- `compare` - Compare token usage across periods/swarms

### Optimization Operations
- `compress` - Apply token compression techniques
- `cache` - Implement intelligent caching strategies
- `template` - Optimize prompt templates
- `batch` - Implement batch processing optimizations

## Options

### Time & Scope
- `--period <time>` - Analysis period: `1h`, `6h`, `24h`, `7d`, `30d`, `all` (default: 24h)
- `--real-time` - Enable real-time token tracking
- `--historical` - Include historical trend analysis
- `--baseline <file>` - Compare against baseline consumption

### Breakdown Analysis
- `--by-agent` - Break down consumption by individual agents
- `--by-operation` - Analyze by operation type (read, write, analysis, etc.)
- `--by-task-type` - Group by task complexity/category
- `--by-time` - Hourly/daily consumption patterns
- `--by-cost` - Cost-focused analysis and optimization

### Optimization Options
- `--optimize` - Apply automatic optimizations
- `--target <percent>` - Set optimization target (e.g., 20% reduction)
- `--threshold <number>` - Alert threshold for high usage
- `--budget <amount>` - Set token budget and track against it
- `--suggestions` - Generate optimization recommendations

### Export & Reporting
- `--export <format>` - Export format: `csv`, `json`, `xlsx`, `pdf`
- `--report <type>` - Report type: `summary`, `detailed`, `executive`
- `--dashboard` - Update real-time dashboard
- `--alert` - Send alerts for threshold breaches

## Detailed Examples

### Basic Token Analysis
```bash
# Quick token usage overview
npx claude-flow analysis token-usage --period 24h

# Comprehensive analysis with breakdown
npx claude-flow analysis token-usage \
  --period 7d \
  --by-agent \
  --by-operation \
  --export detailed-usage.xlsx
```

### Optimization Focus
```bash
# Identify optimization opportunities
npx claude-flow analysis token-usage \
  --optimize \
  --target 25 \
  --suggestions \
  --export optimization-plan.json

# Apply automatic optimizations
npx claude-flow analysis token-usage \
  --optimize \
  --target 20 \
  --auto-apply \
  --track-results
```

### Budget Management
```bash
# Set up budget tracking
npx claude-flow analysis token-usage \
  --budget 1000000 \
  --period 30d \
  --threshold 80 \
  --alert \
  --dashboard

# Monitor budget in real-time
npx claude-flow analysis token-usage \
  --real-time \
  --budget 1000000 \
  --alert-email admin@company.com
```

### Comparative Analysis
```bash
# Compare current vs previous month
npx claude-flow analysis token-usage \
  --period 30d \
  --compare previous-month \
  --by-cost \
  --export monthly-comparison.pdf

# A/B test token efficiency
npx claude-flow analysis token-usage \
  --compare swarm-a:swarm-b \
  --by-operation \
  --optimization-analysis
```

### Advanced Analytics
```bash
# Predictive analysis
npx claude-flow analysis token-usage \
  --forecast 30d \
  --include-trends \
  --capacity-planning \
  --export forecast-report.json

# Pattern recognition
npx claude-flow analysis token-usage \
  --period 7d \
  --pattern-analysis \
  --anomaly-detection \
  --by-time
```

## Analysis Breakdown

### Agent-Level Analysis
```
🤖 Token Usage by Agent (Last 24h)
├── coordinator-001: 125,847 tokens (23.4% of total)
│   ├── Task orchestration: 89,234 tokens (71%)
│   ├── Communication: 28,567 tokens (23%)
│   └── Status updates: 8,046 tokens (6%)
│
├── coder-001: 158,392 tokens (29.5% of total)
│   ├── Code generation: 112,674 tokens (71%)
│   ├── Code review: 31,289 tokens (20%)
│   └── Documentation: 14,429 tokens (9%)
│
├── analyst-001: 97,234 tokens (18.1% of total)
│   ├── Data analysis: 68,064 tokens (70%)
│   ├── Report generation: 21,456 tokens (22%)
│   └── Visualization: 7,714 tokens (8%)
│
└── tester-001: 87,156 tokens (16.2% of total)
    ├── Test creation: 52,293 tokens (60%)
    ├── Test execution: 26,147 tokens (30%)
    └── Result analysis: 8,716 tokens (10%)

Total: 468,629 tokens
Average per agent: 117,157 tokens
Efficiency score: 87% (vs 85% baseline)
```

### Operation-Level Analysis
```
📊 Token Usage by Operation Type
├── Code Generation: 186,459 tokens (39.8%)
│   ├── Average per task: 1,247 tokens
│   ├── Most expensive: Complex algorithms (3,456 tokens)
│   └── Most efficient: Simple functions (342 tokens)
│
├── Analysis & Research: 134,567 tokens (28.7%)
│   ├── Data analysis: 89,234 tokens (66%)
│   ├── Literature review: 31,289 tokens (23%)
│   └── Competitive analysis: 14,044 tokens (10%)
│
├── Testing & QA: 78,123 tokens (16.7%)
│   ├── Test case generation: 52,293 tokens (67%)
│   ├── Bug analysis: 17,614 tokens (23%)
│   └── Performance testing: 8,216 tokens (11%)
│
├── Communication: 45,234 tokens (9.7%)
│   ├── Agent coordination: 28,567 tokens (63%)
│   ├── Status updates: 12,345 tokens (27%)
│   └── Error reporting: 4,322 tokens (10%)
│
└── Documentation: 24,246 tokens (5.2%)
    ├── API documentation: 14,429 tokens (59%)
    ├── User guides: 7,234 tokens (30%)
    └── Technical specs: 2,583 tokens (11%)
```

### Cost Analysis
```
💰 Token Cost Analysis (Last 30 Days)
├── Total Cost: $1,847.23 (15% under budget)
├── Average Cost/Token: $0.000123
├── Cost/Task: $2.34 average
├── Most Expensive Agent: coder-001 ($687.45)
├── Most Efficient Agent: coordinator-001 ($0.89/task)
└── Projected Monthly: $2,156 (vs $2,500 budget)

🎯 Cost by Task Type
├── Complex Development: $8.45/task (18.2% of total cost)
├── Code Review: $1.23/task (31.7% of total cost)
├── Documentation: $0.87/task (12.4% of total cost)
├── Testing: $1.56/task (23.1% of total cost)
└── Analysis: $2.34/task (14.6% of total cost)
```

### Time-Based Patterns
```
🕰️ Token Usage Patterns (24-Hour)
 Hour  | Tokens  | % of Total | Avg/Task | Peak Operations
-------|---------|------------|----------|----------------
 00-01 |  8,234  |    1.8%    |  1,029   | Batch processing
 01-02 |  5,678  |    1.2%    |   943    | Background tasks
 02-03 |  3,456  |    0.7%    |   865    | Maintenance
 ...
 09-10 | 32,567  |    6.9%    |  1,347   | Daily standup analysis
 10-11 | 45,789  |    9.8%    |  1,523   | Active development
 11-12 | 52,134  |   11.1%    |  1,678   | Peak productivity
 ...
 14-15 | 48,923  |   10.4%    |  1,456   | Post-lunch coding
 15-16 | 41,678  |    8.9%    |  1,389   | Code reviews
 ...
 22-23 | 12,345  |    2.6%    |  1,123   | Documentation
 23-00 |  6,789  |    1.4%    |   978    | Cleanup tasks

Peak Hours: 11-12 (52,134 tokens)
Low Hours: 02-03 (3,456 tokens)
Efficiency Pattern: Higher token efficiency during focused work hours
```

## Optimization Strategies

### Template Optimization
```
🚀 Prompt Template Optimization

Current Templates Analysis:
├── Code Generation Template: 1,247 avg tokens
│   ├── Optimization potential: 23% reduction
│   ├── Redundant instructions: 287 tokens
│   └── Verbose examples: 156 tokens
│
├── Analysis Template: 892 avg tokens
│   ├── Optimization potential: 15% reduction
│   ├── Repetitive context: 134 tokens
│   └── Unnecessary formatting: 89 tokens
│
└── Review Template: 567 avg tokens
    ├── Optimization potential: 8% reduction
    └── Already well-optimized

Recommended Actions:
1. Compress code generation templates (-287 tokens/use)
2. Streamline analysis context (-134 tokens/use)
3. Remove redundant examples (-156 tokens/use)

Estimated Savings: 577 tokens/task average (23% reduction)
Monthly Impact: $1,734 savings
```

### Caching Strategy
```
📦 Intelligent Caching Opportunities

├── Repeated Queries: 34% of all operations
│   ├── Identical prompts: 18% (immediate cache hits)
│   ├── Similar prompts: 16% (semantic caching)
│   └── Potential savings: 156,234 tokens/day
│
├── Common Patterns: 28% cache potential
│   ├── Code review patterns: 89,234 tokens/week
│   ├── Documentation templates: 45,678 tokens/week
│   └── Standard analyses: 67,890 tokens/week
│
└── Pre-computation Opportunities: 12% savings
    ├── Common calculations: 23,456 tokens/week
    ├── Standard reports: 34,567 tokens/week
    └── Template generations: 12,345 tokens/week

Implementation Priority:
1. Immediate caching (18% savings) - 1 day implementation
2. Semantic caching (16% savings) - 3 days implementation
3. Pre-computation (12% savings) - 5 days implementation

Total Potential Savings: 46% reduction in token usage
```

### Batch Processing Optimization
```
📦 Batch Processing Opportunities

├── Single-Item Processing: 67% of operations
│   ├── Setup overhead: 234 tokens per operation
│   ├── Context repetition: 156 tokens per operation
│   └── Batch potential: 78% of single operations
│
├── Batchable Operations:
│   ├── Code reviews: 45 operations/day (batch size: 5-8)
│   ├── Documentation: 23 operations/day (batch size: 3-5)
│   ├── Testing: 67 operations/day (batch size: 8-12)
│   └── Analysis: 34 operations/day (batch size: 4-6)
│
└── Estimated Savings:
    ├── Setup overhead reduction: 89,234 tokens/week
    ├── Context sharing: 45,678 tokens/week
    └── Total batch savings: 31% reduction

Optimal Batch Sizes:
- Code Reviews: 6 items (optimal efficiency)
- Documentation: 4 items (quality vs speed balance)
- Testing: 10 items (maximum throughput)
- Analysis: 5 items (context coherence)
```

## Performance Metrics

### Efficiency Indicators
```
📈 Token Efficiency Metrics
├── Tokens per Task: 1,247 average (vs 1,456 baseline)
├── Efficiency Score: 87% (target: 90%)
├── Waste Ratio: 13% (tokens for failed/retried operations)
├── Cache Hit Rate: 34% (target: 50%)
└── Optimization Rate: 67% of recommendations applied

🎯 Quality vs Efficiency Balance
├── Output Quality: 8.7/10 (maintained during optimization)
├── Task Success Rate: 98.7% (no degradation)
├── Agent Satisfaction: 9.1/10 (improved with optimization)
└── User Experience: 8.9/10 (faster responses, same quality)
```

### Trend Analysis
```
📅 30-Day Token Usage Trends

 Week 1: 1,234,567 tokens (baseline)
 Week 2: 1,189,234 tokens (-3.7% optimization applied)
 Week 3: 1,123,456 tokens (-9.0% caching implemented)
 Week 4: 1,067,890 tokens (-13.5% batch processing added)

Trend: -13.5% reduction over 30 days
Projected Next Month: -18% total reduction
ROI: $2,340 savings vs $890 optimization investment
```

## Budget Management

### Budget Tracking
```
💰 Token Budget Status
├── Monthly Budget: 10,000,000 tokens
├── Used (Day 15): 4,234,567 tokens (42.3%)
├── Projected Usage: 8,469,134 tokens (84.7%)
├── Remaining Budget: 5,765,433 tokens (57.7%)
└── Budget Health: Good (15.3% under budget)

⚠️ Budget Alerts:
- No critical alerts
- Warning: Peak usage detected on Day 12 (450k tokens)
- Recommendation: Monitor usage during high-activity periods

🔮 Budget Forecast:
- Days to budget limit: 35 days (vs 30-day target)
- Recommended adjustments: Increase batch processing by 20%
- Buffer recommendation: Maintain current optimization strategies
```

### Cost Optimization Roadmap
```
🗺️ Cost Optimization Roadmap

Phase 1 (Week 1): Quick Wins
├── Template compression: -15% tokens
├── Immediate caching: -18% tokens
└── Expected savings: $1,200/month

Phase 2 (Week 2-3): Advanced Optimization
├── Semantic caching: -16% additional
├── Batch processing: -20% additional
└── Expected savings: $2,100/month

Phase 3 (Week 4): AI-Driven Optimization
├── Predictive pre-computation: -12% additional
├── Dynamic template selection: -8% additional
└── Expected savings: $980/month

Total Projected Savings: $4,280/month (42% cost reduction)
Implementation Cost: $2,500 (one-time)
ROI Timeline: 2.3 months
```

## Alert Configuration

### Usage Thresholds
```bash
# Set up token usage alerts
npx claude-flow analysis token-usage \
  --alert-config \
  --daily-threshold 350000 \
  --weekly-threshold 2000000 \
  --monthly-threshold 8000000 \
  --cost-threshold-percent 85

# Configure notification channels
npx claude-flow analysis token-usage \
  --alert-email admin@company.com \
  --alert-slack #operations \
  --alert-webhook https://alerts.company.com/tokens
```

### Automated Responses
```bash
# Auto-optimization triggers
npx claude-flow analysis token-usage \
  --auto-optimize-threshold 90 \
  --emergency-cache-enable 95 \
  --performance-mode-threshold 98
```

## Integration Examples

### Claude Code Integration
```javascript
// Comprehensive token analysis
mcp__claude-flow__token_usage({
  operation: "analyze",
  timeframe: "7d",
  breakdown_type: "agent,operation,cost",
  include_optimization: true
})

// Real-time optimization
mcp__claude-flow__token_usage({
  operation: "optimize",
  optimization_target: 25,
  auto_apply: true,
  track_results: true
})

// Budget monitoring
mcp__claude-flow__token_usage({
  operation: "track",
  budget: 1000000,
  alert_threshold: 80,
  real_time: true
})
```

### Automated Monitoring
```bash
# Daily token analysis cron job
0 9 * * * npx claude-flow analysis token-usage --period 24h --optimize --auto-apply

# Weekly comprehensive report
0 9 * * 1 npx claude-flow analysis token-usage --period 7d --report executive --export weekly-tokens.pdf

# Real-time monitoring
* * * * * npx claude-flow analysis token-usage --real-time --threshold 95 --alert
```

## Best Practices

### Optimization Strategy
1. **Start with Analysis** - Understand current usage patterns
2. **Implement Quick Wins** - Template optimization and basic caching
3. **Advanced Techniques** - Semantic caching and batch processing
4. **Continuous Monitoring** - Real-time tracking and automated optimization

### Budget Management
- Set realistic budgets based on historical data
- Monitor usage patterns and adjust forecasts
- Implement graduated alerts (warning → critical → emergency)
- Regular optimization review and strategy updates

### Quality Maintenance
- Monitor output quality during optimization
- A/B test optimization strategies
- Maintain baseline performance metrics
- User feedback integration

## Troubleshooting

### Common Issues
- **High Token Usage**: Check for inefficient templates, failed retries
- **Budget Overruns**: Implement emergency optimization, review usage patterns
- **Cache Misses**: Tune semantic similarity thresholds, update cache strategies
- **Quality Degradation**: Reduce optimization aggressiveness, A/B test changes

### Performance Tips
- Use streaming analysis for real-time monitoring
- Implement graduated optimization (start conservative)
- Cache optimization calculations
- Batch optimization operations

## See Also

- **[cost-analysis](./cost-analysis.md)** - Financial impact and ROI analysis
- **[performance-report](./performance-report.md)** - Overall system performance
- **[bottleneck-detect](./bottleneck-detect.md)** - Identify usage bottlenecks
- **[Memory Commands](../memory/README.md)** - Memory optimization strategies
