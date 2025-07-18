# Running Tests

Learn how to execute tests effectively and interpret results in the Prompt Card System.

## 🚀 Test Execution Overview

The Prompt Card System offers multiple ways to run tests:
- **Single Test Execution**: Run one test at a time
- **Batch Execution**: Run multiple tests sequentially
- **Parallel Execution**: Run tests simultaneously for speed
- **Scheduled Testing**: Automated recurring test runs

## 🎯 Single Test Execution

### Running a Single Test
1. Navigate to your prompt card
2. Find the test case you want to run
3. Click the **"Run Test"** button
4. Watch the real-time progress indicator
5. Review the detailed results

### When to Use Single Tests
- **Debugging**: When a test is failing
- **Development**: While creating new test cases
- **Validation**: Confirming fixes work correctly
- **Interactive Testing**: When you need immediate feedback

## 📊 Batch Test Execution

### Running Multiple Tests
1. Select your prompt card
2. Choose **"Run All Tests"** or select specific tests
3. Monitor the progress dashboard
4. Review the comprehensive results report

### Batch Execution Benefits
- **Comprehensive Validation**: Test all scenarios at once
- **Efficiency**: Better resource utilization
- **Reporting**: Unified results view
- **Regression Testing**: Ensure nothing breaks

## ⚡ Parallel Test Execution

### High-Performance Testing
The system automatically optimizes test execution:
- **Smart Concurrency**: Adjusts based on system resources
- **Resource Management**: Prevents system overload
- **Queue Management**: Handles test prioritization
- **Real-time Monitoring**: Live progress tracking

### Configuration Options
```json
{
  "parallel": {
    "enabled": true,
    "maxConcurrency": 10,
    "resourceThreshold": 0.8,
    "priorityQueues": ["high", "medium", "low"]
  }
}
```

### Performance Benefits
- **Speed**: Up to 10x faster execution
- **Efficiency**: Better resource utilization
- **Scalability**: Handles large test suites
- **Throughput**: Process more tests in less time

## 📈 Real-time Monitoring

### Progress Tracking
During test execution, monitor:
- **Overall Progress**: Percentage complete
- **Active Tests**: Currently running tests
- **Queue Status**: Pending tests in queue
- **Resource Usage**: CPU and memory utilization
- **Error Rate**: Failed tests percentage

### Live Updates
The system provides real-time updates via WebSocket:
- **Test Start**: When each test begins
- **Progress Updates**: Execution milestones
- **Completion**: When tests finish
- **Results**: Pass/fail status immediately

## 🔧 Test Configuration

### Execution Settings
Configure how tests run:
```json
{
  "execution": {
    "timeout": 30000,
    "retries": 3,
    "retryDelay": 1000,
    "failFast": false,
    "captureOutput": true
  }
}
```

### Model Selection
Choose which LLM to use:
- **Default Model**: System-configured model
- **Specific Model**: Choose for this test run
- **Multi-Model**: Test across multiple models
- **A/B Testing**: Compare model performance

### Resource Management
Control resource usage:
- **CPU Limit**: Maximum CPU usage
- **Memory Limit**: Maximum memory usage
- **Concurrency**: Number of simultaneous tests
- **Rate Limiting**: Requests per second

## 📊 Understanding Results

### Test Status Types
- ✅ **PASSED**: All assertions succeeded
- ❌ **FAILED**: One or more assertions failed
- ⚠️ **PARTIAL**: Some assertions passed, others failed
- ⏸️ **SKIPPED**: Test was not executed
- 🔄 **RUNNING**: Test in progress
- ⏱️ **TIMEOUT**: Test exceeded time limit
- 🚫 **ERROR**: System or execution error

### Result Details
Each test result includes:
- **Execution Time**: How long the test took
- **Token Usage**: Input/output tokens consumed
- **Cost**: Calculated cost for the test
- **LLM Response**: Raw output from the model
- **Assertion Results**: Individual assertion outcomes
- **Metadata**: Additional execution information

### Performance Metrics
- **Response Time**: Average LLM response time
- **Success Rate**: Percentage of tests passing
- **Token Efficiency**: Tokens per successful test
- **Cost Efficiency**: Cost per successful test
- **Throughput**: Tests completed per minute

## 🔍 Debugging Failed Tests

### Analyzing Failures
When tests fail, investigate:
1. **Review Raw Output**: Check actual LLM response
2. **Examine Assertions**: Identify which assertions failed
3. **Check Input Data**: Verify test case parameters
4. **Compare Expected vs Actual**: Understand differences
5. **Review Context**: Consider prompt card changes

### Common Failure Patterns
- **Assertion Mismatch**: Output doesn't match expected
- **Format Issues**: Response format not as expected
- **Timeout Problems**: Test takes too long
- **API Errors**: LLM service issues
- **Resource Constraints**: System overload

### Debugging Tools
- **Debug Mode**: Capture detailed execution logs
- **Response Inspector**: View raw LLM responses
- **Assertion Debugger**: Step through assertion logic
- **Performance Profiler**: Identify bottlenecks

## 📋 Test Reports

### Execution Summary
After test runs, get comprehensive reports:
- **Overall Statistics**: Total tests, pass/fail rates
- **Performance Metrics**: Response times, costs
- **Trend Analysis**: Performance over time
- **Model Comparison**: Different model performance

### Export Options
- **PDF Reports**: Professional formatted reports
- **Excel Spreadsheets**: Detailed data analysis
- **CSV Files**: Raw data for further analysis
- **JSON Data**: Machine-readable results

### Automated Reporting
- **Daily Reports**: Automated daily summaries
- **Weekly Trends**: Performance trend analysis
- **Monthly Reviews**: Comprehensive monthly reports
- **Custom Schedules**: Configure your own reporting

## 🔄 Continuous Testing

### Scheduled Execution
Set up automated test runs:
- **Hourly**: For critical prompt cards
- **Daily**: For comprehensive validation
- **Weekly**: For full regression testing
- **Custom**: Based on your needs

### Trigger Conditions
Automatically run tests when:
- **Prompt Changes**: When prompt cards are modified
- **New Test Cases**: When tests are added
- **Performance Drops**: When metrics decline
- **API Changes**: When LLM providers update

### Integration Options
- **CI/CD Pipelines**: Integrate with development workflows
- **Monitoring Systems**: Connect to alerting systems
- **API Automation**: Trigger via REST API
- **Webhook Support**: Respond to external events

## 🎯 Best Practices

### Test Execution Strategy
1. **Start Small**: Begin with single tests
2. **Scale Gradually**: Move to batch execution
3. **Optimize Performance**: Use parallel execution
4. **Monitor Continuously**: Set up automated testing

### Resource Management
- **Monitor Usage**: Keep track of resource consumption
- **Set Limits**: Prevent system overload
- **Optimize Timing**: Run heavy tests during off-peak hours
- **Balance Load**: Distribute tests across time

### Quality Assurance
- **Regular Validation**: Run tests frequently
- **Comprehensive Coverage**: Test all scenarios
- **Performance Monitoring**: Track metrics over time
- **Failure Analysis**: Investigate and fix issues

## 📊 Advanced Features

### A/B Testing
Compare different prompts or models:
```json
{
  "abTest": {
    "variant1": "prompt-card-v1",
    "variant2": "prompt-card-v2",
    "trafficSplit": 0.5,
    "successMetric": "assertion_pass_rate"
  }
}
```

### Load Testing
Test system performance under stress:
```json
{
  "loadTest": {
    "concurrentUsers": 100,
    "duration": "10m",
    "rampUpTime": "2m",
    "testCases": ["high-priority-tests"]
  }
}
```

### Regression Testing
Ensure changes don't break existing functionality:
```json
{
  "regression": {
    "baseline": "v1.0.0",
    "current": "v1.1.0",
    "threshold": 0.95,
    "criticalTests": ["core-functionality"]
  }
}
```

## 🔧 Troubleshooting

### Common Issues
- **Slow Performance**: Check parallel execution settings
- **High Costs**: Monitor token usage and optimize prompts
- **Inconsistent Results**: Review model temperature settings
- **Memory Issues**: Reduce concurrent test count

### Performance Optimization
- **Parallel Execution**: Enable for faster testing
- **Resource Monitoring**: Track system usage
- **Caching**: Use result caching for repeated tests
- **Batch Processing**: Group similar tests together

### Error Recovery
- **Retry Logic**: Automatically retry failed tests
- **Graceful Degradation**: Continue testing despite errors
- **Error Reporting**: Detailed error information
- **Recovery Strategies**: Automatic system recovery

---

**Next Steps**: Learn about the [Analytics Dashboard](./analytics.md) to monitor and analyze your test results.