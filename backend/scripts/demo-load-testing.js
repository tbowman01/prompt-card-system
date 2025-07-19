#!/usr/bin/env node

/**
 * Load Testing Framework Demo Script
 * 
 * This script demonstrates the comprehensive load testing and performance 
 * regression detection capabilities of the system.
 */

const axios = require('axios');
const chalk = require('chalk');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const API_URL = `${BASE_URL}/api/load-testing`;

class LoadTestingDemo {
  constructor() {
    this.scenarios = [];
    this.testResults = [];
  }

  async run() {
    console.log(chalk.blue.bold('🚀 Load Testing Framework Demo'));
    console.log(chalk.gray('=' .repeat(50)));
    
    try {
      await this.checkHealth();
      await this.listDefaultScenarios();
      await this.createCustomScenario();
      await this.runSmokeTest();
      await this.runPerformanceTest();
      await this.setBaseline();
      await this.runRegressionTest();
      await this.runBenchmarks();
      await this.setupScheduledTest();
      await this.viewResults();
      await this.generateReport();
      
      console.log(chalk.green.bold('\n✅ Demo completed successfully!'));
      console.log(chalk.gray('Check the backend logs for detailed performance metrics.'));
      
    } catch (error) {
      console.error(chalk.red.bold('\n❌ Demo failed:'), error.message);
      if (error.response?.data) {
        console.error(chalk.red('Response data:'), JSON.stringify(error.response.data, null, 2));
      }
    }
  }

  async checkHealth() {
    console.log(chalk.cyan('\n📊 Checking load testing health...'));
    
    const response = await axios.get(`${API_URL}/health`);
    const health = response.data.data;
    
    console.log(`Load Testing: ${health.loadTesting.available ? '✅' : '❌'}`);
    console.log(`Benchmarks: ${health.benchmarks.available ? '✅' : '❌'}`);
    console.log(`Regression Detection: ${health.regressionDetection.available ? '✅' : '❌'}`);
    
    if (health.loadTesting.running) {
      console.log(chalk.yellow(`Currently running: ${health.loadTesting.currentTest.scenario}`));
    }
  }

  async listDefaultScenarios() {
    console.log(chalk.cyan('\n📋 Available load test scenarios:'));
    
    const response = await axios.get(`${API_URL}/scenarios`);
    this.scenarios = response.data.data.scenarios;
    
    this.scenarios.forEach((scenario, index) => {
      console.log(`${index + 1}. ${chalk.bold(scenario.name)} (${scenario.id})`);
      console.log(`   ${scenario.description}`);
      console.log(`   Users: ${scenario.config.users.concurrent}, Duration: ${scenario.config.duration.total}s`);
    });
  }

  async createCustomScenario() {
    console.log(chalk.cyan('\n🏗️  Creating custom demo scenario...'));
    
    const customScenario = {
      id: 'demo-api-test',
      name: 'Demo API Performance Test',
      description: 'Custom scenario for demonstration purposes',
      config: {
        baseUrl: BASE_URL,
        endpoints: [
          {
            path: '/api/health',
            method: 'GET',
            weight: 40,
            validation: { statusCode: [200] }
          },
          {
            path: '/api/performance/overview',
            method: 'GET',
            weight: 30,
            validation: { statusCode: [200] }
          },
          {
            path: '/api/analytics/metrics',
            method: 'GET',
            weight: 20,
            validation: { statusCode: [200] }
          },
          {
            path: '/api/load-testing/health',
            method: 'GET',
            weight: 10,
            validation: { statusCode: [200] }
          }
        ],
        users: {
          concurrent: 5,
          rampUp: { duration: 10, strategy: 'linear' },
          rampDown: { duration: 5, strategy: 'linear' },
          thinkTime: { min: 500, max: 1500, distribution: 'uniform' }
        },
        duration: { total: 60, warmup: 10, cooldown: 10 },
        thresholds: {
          responseTime: { p95: 800, p99: 1500, max: 3000 },
          errorRate: { max: 2 },
          throughput: { min: 3 }
        },
        environment: {
          concurrent: true,
          keepAlive: true,
          compression: true
        }
      }
    };
    
    await axios.post(`${API_URL}/scenarios`, customScenario);
    console.log(chalk.green('✅ Custom scenario created successfully'));
  }

  async runSmokeTest() {
    console.log(chalk.cyan('\n🔥 Running smoke test (dry run)...'));
    
    const testConfig = {
      scenarioId: 'demo-api-test',
      options: {
        dryRun: true
      }
    };
    
    const response = await axios.post(`${API_URL}/run`, testConfig);
    console.log(chalk.green('✅ Smoke test initiated'));
    
    await this.waitForTestCompletion('demo-api-test');
  }

  async runPerformanceTest() {
    console.log(chalk.cyan('\n⚡ Running full performance test...'));
    
    const testConfig = {
      scenarioId: 'demo-api-test',
      options: {
        saveBaseline: true
      }
    };
    
    const response = await axios.post(`${API_URL}/run`, testConfig);
    console.log(chalk.green('✅ Performance test initiated'));
    
    await this.waitForTestCompletion('demo-api-test');
    
    // Get results
    const resultsResponse = await axios.get(`${API_URL}/results/demo-api-test?limit=1&detailed=true`);
    const result = resultsResponse.data.data.results[0];
    
    if (result) {
      console.log(chalk.blue('📊 Test Results:'));
      console.log(`   Total Requests: ${result.totalRequests}`);
      console.log(`   Success Rate: ${((result.successfulRequests / result.totalRequests) * 100).toFixed(2)}%`);
      console.log(`   Avg Response Time: ${result.avgResponseTime.toFixed(0)}ms`);
      console.log(`   P95 Response Time: ${result.p95ResponseTime.toFixed(0)}ms`);
      console.log(`   Throughput: ${result.requestsPerSecond.toFixed(2)} req/s`);
      
      this.testResults.push(result);
    }
  }

  async setBaseline() {
    console.log(chalk.cyan('\n📏 Setting performance baseline...'));
    
    const baselineConfig = {
      scenarioId: 'demo-api-test',
      version: '1.0.0-demo',
      environment: 'demo',
      confidence: 0.95
    };
    
    await axios.post(`${API_URL}/baselines`, baselineConfig);
    console.log(chalk.green('✅ Baseline set successfully'));
    
    // List baselines
    const baselinesResponse = await axios.get(`${API_URL}/baselines`);
    const baselines = baselinesResponse.data.data.baselines;
    
    console.log(chalk.blue('📊 Current Baselines:'));
    baselines.forEach(baseline => {
      console.log(`   ${baseline.scenarioId} (${baseline.environment}) - ${baseline.timestamp}`);
    });
  }

  async runRegressionTest() {
    console.log(chalk.cyan('\n🔍 Running regression test...'));
    
    const regressionConfig = {
      scenarioIds: ['demo-api-test']
    };
    
    const response = await axios.post(`${API_URL}/regression-test`, regressionConfig);
    console.log(chalk.green('✅ Regression test initiated'));
    
    // Wait a bit for regression analysis
    await this.sleep(5000);
    
    // Check for regression alerts
    const alertsResponse = await axios.get(`${API_URL}/regression-alerts?scenarioId=demo-api-test`);
    const alerts = alertsResponse.data.data.alerts;
    
    if (alerts.length > 0) {
      console.log(chalk.yellow('⚠️  Regression alerts detected:'));
      alerts.forEach(alert => {
        console.log(`   ${alert.severity.toUpperCase()}: ${alert.metric} degraded by ${alert.degradation.toFixed(1)}%`);
      });
    } else {
      console.log(chalk.green('✅ No performance regressions detected'));
    }
  }

  async runBenchmarks() {
    console.log(chalk.cyan('\n🏆 Running performance benchmarks...'));
    
    const benchmarkConfig = {
      suiteName: 'Demo Benchmark Suite'
    };
    
    const response = await axios.post(`${API_URL}/benchmarks/run`, benchmarkConfig);
    console.log(chalk.green('✅ Benchmark suite initiated'));
    
    // Monitor benchmark progress
    let completed = false;
    while (!completed) {
      await this.sleep(2000);
      
      const statusResponse = await axios.get(`${API_URL}/benchmarks/status`);
      const status = statusResponse.data.data;
      
      if (status.isRunning) {
        console.log(chalk.gray(`   Progress: ${status.progress?.toFixed(1) || 0}%`));
      } else {
        completed = true;
      }
    }
    
    console.log(chalk.green('✅ Benchmarks completed'));
  }

  async setupScheduledTest() {
    console.log(chalk.cyan('\n⏰ Setting up scheduled test...'));
    
    // Note: This would use cron expressions in a real environment
    // For demo purposes, we'll just show the configuration
    const scheduledTestConfig = {
      name: 'Daily Performance Check',
      scenarioId: 'demo-api-test',
      schedule: '0 2 * * *', // Daily at 2 AM
      enabled: false, // Disabled for demo
      options: {
        compareBaseline: true,
        notifyOnRegression: true,
        runBenchmarks: false
      },
      maxConsecutiveFailures: 3
    };
    
    console.log(chalk.blue('📅 Scheduled test configuration:'));
    console.log(`   Name: ${scheduledTestConfig.name}`);
    console.log(`   Schedule: ${scheduledTestConfig.schedule} (Daily at 2 AM)`);
    console.log(`   Scenario: ${scheduledTestConfig.scenarioId}`);
    console.log(`   Enabled: ${scheduledTestConfig.enabled ? 'Yes' : 'No (demo only)'}}`);
    
    console.log(chalk.green('✅ Scheduled test configuration ready'));
  }

  async viewResults() {
    console.log(chalk.cyan('\n📈 Viewing historical results...'));
    
    const resultsResponse = await axios.get(`${API_URL}/results?limit=5`);
    const results = resultsResponse.data.data.results;
    
    console.log(chalk.blue('📊 Recent Test Results:'));
    results.forEach((result, index) => {
      const successRate = ((result.successfulRequests / result.totalRequests) * 100).toFixed(1);
      console.log(`   ${index + 1}. ${result.scenarioName} (${result.createdAt})`);
      console.log(`      Success Rate: ${successRate}%, Avg Response: ${result.avgResponseTime.toFixed(0)}ms`);
    });
  }

  async generateReport() {
    console.log(chalk.cyan('\n📋 Generating regression report...'));
    
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
    
    try {
      const reportResponse = await axios.get(
        `${API_URL}/regression-report/demo-api-test?start=${startDate.toISOString()}&end=${endDate.toISOString()}`
      );
      const report = reportResponse.data.data;
      
      console.log(chalk.blue('📊 Regression Report Summary:'));
      console.log(`   Total Alerts: ${report.summary.totalAlerts}`);
      console.log(`   Critical Alerts: ${report.summary.criticalAlerts}`);
      console.log(`   Overall Trend: ${report.summary.overallTrend}`);
      
      if (report.recommendations.length > 0) {
        console.log(chalk.yellow('💡 Recommendations:'));
        report.recommendations.forEach((rec, index) => {
          console.log(`   ${index + 1}. ${rec}`);
        });
      }
    } catch (error) {
      console.log(chalk.yellow('⚠️  No historical data available for regression report'));
    }
  }

  async waitForTestCompletion(scenarioId) {
    console.log(chalk.gray('   Waiting for test completion...'));
    
    let isRunning = true;
    while (isRunning) {
      await this.sleep(2000);
      
      const statusResponse = await axios.get(`${API_URL}/status`);
      const status = statusResponse.data.data;
      
      if (status.isRunning && status.currentTest?.scenario.includes(scenarioId)) {
        const progress = status.currentTest.progress || 0;
        const remaining = Math.round(status.currentTest.estimatedTimeRemaining / 1000) || 0;
        console.log(chalk.gray(`   Progress: ${progress.toFixed(1)}%, Est. remaining: ${remaining}s`));
      } else {
        isRunning = false;
      }
    }
    
    console.log(chalk.green('   ✅ Test completed'));
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run the demo if this script is executed directly
if (require.main === module) {
  const demo = new LoadTestingDemo();
  demo.run().catch(error => {
    console.error(chalk.red.bold('Demo failed:'), error.message);
    process.exit(1);
  });
}

module.exports = LoadTestingDemo;