# Advanced Load Testing and Performance Monitoring System

This comprehensive performance monitoring system provides automated load testing, performance regression detection, and advanced benchmarking capabilities for the Prompt Card System.

## 🚀 Features

### Load Testing Framework
- **Configurable Test Scenarios**: Create custom load test scenarios with multiple endpoints, user patterns, and thresholds
- **Advanced User Simulation**: Support for different ramp-up/ramp-down strategies and think-time distributions
- **Real-time Monitoring**: Live timeline tracking with WebSocket updates
- **Comprehensive Validation**: Response validation including status codes, response times, and content checks
- **Worker Thread Support**: Parallel execution for high-concurrency testing

### Performance Regression Detection
- **Statistical Analysis**: T-tests, Mann-Kendall trend analysis, and change point detection
- **Neural Network Anomaly Detection**: TensorFlow.js-based autoencoder for pattern recognition
- **Baseline Management**: Automatic baseline creation and comparison
- **Automated Alerting**: Configurable thresholds with severity-based notifications
- **Trend Analysis**: Long-term performance trend identification with forecasting

### Performance Benchmarking
- **Comprehensive Benchmark Suite**: Tests for analytics, reports, optimization, database, cache, memory, and concurrency
- **Resource Monitoring**: CPU, memory, and I/O usage tracking
- **Performance Profiling**: Detailed metrics collection and analysis
- **Recommendation Engine**: Automated performance improvement suggestions

### Automated Scheduling
- **Cron-based Scheduling**: Flexible test scheduling with cron expressions
- **Failure Handling**: Automatic retry logic and failure notifications
- **Execution History**: Complete audit trail of all test executions
- **Batch Operations**: Support for regression testing across multiple scenarios

## 📋 API Endpoints

### Load Testing
- `GET /api/load-testing/scenarios` - List all test scenarios
- `POST /api/load-testing/scenarios` - Create new test scenario
- `POST /api/load-testing/run` - Execute load test
- `GET /api/load-testing/status` - Get current test status
- `POST /api/load-testing/stop` - Stop running test
- `GET /api/load-testing/results/:scenarioId?` - Get test results

### Regression Detection
- `POST /api/load-testing/baselines` - Set performance baseline
- `GET /api/load-testing/baselines` - List all baselines
- `GET /api/load-testing/regression-alerts` - Get regression alerts
- `POST /api/load-testing/regression-thresholds` - Configure thresholds
- `GET /api/load-testing/regression-report/:scenarioId` - Generate regression report
- `POST /api/load-testing/regression-monitoring/start` - Start automated monitoring
- `POST /api/load-testing/regression-monitoring/stop` - Stop automated monitoring

### Benchmarking
- `GET /api/load-testing/benchmarks` - List available benchmarks
- `POST /api/load-testing/benchmarks/run` - Execute benchmark suite
- `GET /api/load-testing/benchmarks/status` - Get benchmark status

### Neural Network
- `POST /api/load-testing/neural-training` - Train anomaly detection model

### Health Check
- `GET /api/load-testing/health` - System health status

## 🏗️ Architecture

### Core Components

#### LoadTestingFramework
- Manages test scenarios and execution
- Handles user simulation and request generation
- Provides real-time metrics and timeline data
- Supports various load patterns and validation rules

#### PerformanceRegressionDetector
- Monitors for performance degradation
- Uses statistical methods and machine learning
- Provides automated alerting and trend analysis
- Manages baseline comparisons

#### LoadTestScheduler
- Handles automated test scheduling
- Manages cron jobs and execution history
- Provides failure handling and notifications
- Supports batch operations

#### PerformanceBenchmark
- Runs comprehensive performance benchmarks
- Tests individual system components
- Provides detailed performance analysis
- Generates optimization recommendations

### Database Schema

The system uses SQLite with the following key tables:
- `load_test_results` - Test execution results
- `load_test_scenarios` - Scenario configurations
- `regression_baselines` - Performance baselines
- `regression_alerts` - Regression detection alerts
- `performance_metrics_history` - Historical metrics
- `benchmark_results` - Benchmark execution results
- `scheduled_tests` - Automated test schedules
- `test_executions` - Execution audit trail

## 🚀 Quick Start

### 1. Basic Load Test

```javascript
// Create a simple load test scenario
const scenario = {
  id: 'api-health-check',
  name: 'API Health Check',
  description: 'Basic health endpoint testing',
  config: {
    baseUrl: 'http://localhost:3001',
    endpoints: [
      {
        path: '/api/health',
        method: 'GET',
        weight: 100,
        validation: { statusCode: [200] }
      }
    ],
    users: {
      concurrent: 10,
      rampUp: { duration: 30, strategy: 'linear' },
      rampDown: { duration: 10, strategy: 'linear' },
      thinkTime: { min: 1000, max: 3000, distribution: 'uniform' }
    },
    duration: { total: 120, warmup: 30, cooldown: 30 },
    thresholds: {
      responseTime: { p95: 500, p99: 1000, max: 2000 },
      errorRate: { max: 1 },
      throughput: { min: 5 }
    }
  }
};

// Register and run the scenario
const response = await fetch('/api/load-testing/scenarios', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(scenario)
});

const runResponse = await fetch('/api/load-testing/run', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    scenarioId: 'api-health-check',
    options: { saveBaseline: true }
  })
});
```

### 2. Set Performance Baseline

```javascript
// Set baseline after successful test
const baselineResponse = await fetch('/api/load-testing/baselines', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    scenarioId: 'api-health-check',
    version: '1.0.0',
    environment: 'staging'
  })
});
```

### 3. Run Regression Test

```javascript
// Run regression test with baseline comparison
const regressionResponse = await fetch('/api/load-testing/run', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    scenarioId: 'api-health-check',
    options: { compareBaseline: true }
  })
});
```

### 4. Schedule Automated Tests

```javascript
// Create scheduled test (runs daily at 2 AM)
const scheduledTest = {
  name: 'Daily Performance Check',
  scenarioId: 'api-health-check',
  schedule: '0 2 * * *',
  enabled: true,
  options: {
    compareBaseline: true,
    notifyOnRegression: true
  }
};

// Note: Scheduling functionality would be implemented via admin interface
```

## 📊 Performance Metrics

### Core Metrics
- **Response Time**: min, max, avg, p50, p95, p99
- **Throughput**: requests per second, peak throughput
- **Error Rate**: percentage of failed requests
- **Concurrency**: active users, peak concurrency
- **Resource Usage**: CPU, memory, disk, network

### Advanced Analytics
- **Trend Analysis**: Long-term performance trends
- **Seasonality Detection**: Recurring performance patterns
- **Change Point Detection**: Sudden performance changes
- **Anomaly Detection**: ML-based anomaly identification
- **Correlation Analysis**: Metric interdependencies

## 🔧 Configuration

### Regression Thresholds

```javascript
const thresholds = {
  'responseTime.p95': {
    warning: 20,    // 20% increase
    critical: 50,   // 50% increase
    method: 'statistical',
    confidence: 0.95
  },
  'throughput.avg': {
    warning: 15,    // 15% decrease
    critical: 30,   // 30% decrease
    method: 'statistical',
    confidence: 0.95
  },
  'errorRate': {
    warning: 100,   // 100% increase (double)
    critical: 300,  // 300% increase (4x)
    method: 'absolute',
    confidence: 0.95
  }
};
```

### Load Test Configuration

```javascript
const config = {
  users: {
    concurrent: 50,                    // Maximum concurrent users
    rampUp: {
      duration: 120,                   // Ramp-up time in seconds
      strategy: 'linear'               // 'linear', 'exponential', 'step'
    },
    rampDown: {
      duration: 60,                    // Ramp-down time in seconds
      strategy: 'linear'
    },
    thinkTime: {
      min: 1000,                       // Minimum think time (ms)
      max: 5000,                       // Maximum think time (ms)
      distribution: 'normal'           // 'uniform', 'normal', 'exponential'
    }
  },
  duration: {
    total: 600,                        // Total test duration (seconds)
    warmup: 60,                        // Warmup period (seconds)
    cooldown: 60                       // Cooldown period (seconds)
  },
  thresholds: {
    responseTime: {
      p95: 1000,                       // 95th percentile threshold (ms)
      p99: 2000,                       // 99th percentile threshold (ms)
      max: 5000                        // Maximum response time (ms)
    },
    errorRate: {
      max: 5                           // Maximum error rate (%)
    },
    throughput: {
      min: 10                          // Minimum throughput (req/s)
    }
  }
};
```

## 🧪 Testing

### Demo Script
Run the comprehensive demo script to see all features:

```bash
cd backend
node scripts/demo-load-testing.js
```

The demo will:
1. Check system health
2. List available scenarios
3. Create a custom test scenario
4. Run smoke and performance tests
5. Set performance baselines
6. Run regression analysis
7. Execute benchmark suite
8. Show scheduled test configuration
9. Display results and generate reports

### Manual Testing

```bash
# Start the backend server
npm run dev

# In another terminal, test the API
curl -X GET http://localhost:3001/api/load-testing/health
curl -X GET http://localhost:3001/api/load-testing/scenarios

# Run a quick smoke test
curl -X POST http://localhost:3001/api/load-testing/run \
  -H "Content-Type: application/json" \
  -d '{"scenarioId": "api-smoke-test", "options": {"dryRun": true}}'
```

## 📈 Monitoring and Alerts

### Real-time Monitoring
- Live performance dashboards
- WebSocket-based real-time updates
- Timeline visualization
- Resource usage tracking

### Automated Alerting
- Configurable alert thresholds
- Multiple severity levels
- Notification channels (console, email, Slack)
- Alert acknowledgment and tracking

### Regression Detection
- Continuous baseline comparison
- Statistical significance testing
- ML-based anomaly detection
- Automated trend analysis

## 🔍 Troubleshooting

### Common Issues

1. **Test Timeouts**
   - Increase endpoint timeouts
   - Reduce concurrent users
   - Check system resources

2. **High Error Rates**
   - Verify endpoint URLs
   - Check server capacity
   - Review validation rules

3. **Memory Issues**
   - Reduce test duration
   - Lower concurrent users
   - Monitor system resources

4. **Database Locks**
   - Reduce database-intensive tests
   - Implement connection pooling
   - Check SQLite configuration

### Debug Mode
Enable detailed logging:

```bash
DEBUG=load-testing:* npm run dev
```

### Performance Tuning
- Use worker threads for high concurrency
- Enable keep-alive connections
- Implement request caching
- Optimize database queries

## 🚀 Future Enhancements

### Planned Features
- **Multi-region Testing**: Distributed load testing across regions
- **Cloud Integration**: AWS, GCP, Azure load testing services
- **Custom Metrics**: User-defined performance metrics
- **Load Balancer Testing**: Multi-server load distribution testing
- **API Rate Limiting**: Built-in rate limiting simulation
- **Custom Reporting**: Advanced report templates and exports
- **Real-time Collaboration**: Team-based test management
- **CI/CD Integration**: GitHub Actions, Jenkins integration

### Scalability Improvements
- **Kubernetes Support**: Container orchestration for large-scale testing
- **Microservices Testing**: Service mesh performance testing
- **Event-driven Architecture**: Async message queue testing
- **Database Scaling**: Multi-database performance testing

## 📚 References

- [Load Testing Best Practices](https://loadimpact.com/load-testing-best-practices/)
- [Performance Testing Guidelines](https://docs.microsoft.com/en-us/azure/architecture/best-practices/performance-testing)
- [Statistical Analysis for Performance](https://en.wikipedia.org/wiki/Mann%E2%80%93Kendall_test)
- [TensorFlow.js Documentation](https://www.tensorflow.org/js)
- [SQLite Performance Tips](https://www.sqlite.org/performance.html)

---

## 🤝 Contributing

When contributing to the load testing system:

1. **Add Tests**: Include unit tests for new features
2. **Update Documentation**: Keep README.md current
3. **Performance Considerations**: Ensure new features don't impact performance
4. **Database Migrations**: Include migration scripts for schema changes
5. **Error Handling**: Implement comprehensive error handling
6. **Logging**: Add appropriate logging for debugging

## 📄 License

This load testing system is part of the Prompt Card System and follows the same licensing terms.