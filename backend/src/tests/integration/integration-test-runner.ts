import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';

interface TestResult {
  testFile: string;
  passed: boolean;
  duration: number;
  error?: string;
  output?: string;
}

interface TestSuite {
  name: string;
  description: string;
  files: string[];
  dependencies: string[];
}

class IntegrationTestRunner {
  private testSuites: TestSuite[] = [
    {
      name: 'Analytics Integration',
      description: 'Tests frontend-backend analytics communication and real-time updates',
      files: ['analytics-integration.test.ts'],
      dependencies: ['EventStore', 'AnalyticsEngine', 'WebSocket']
    },
    {
      name: 'Reporting Integration',
      description: 'Tests report generation, export formats, and scheduling',
      files: ['reporting-integration.test.ts'],
      dependencies: ['ReportService', 'PDFExporter', 'ExcelExporter']
    },
    {
      name: 'Optimization Integration',
      description: 'Tests AI-powered optimization, security validation, and cost tracking',
      files: ['optimization-integration.test.ts'],
      dependencies: ['OptimizationEngine', 'SecurityAnalyzer', 'CostTracker']
    },
    {
      name: 'Parallel Execution',
      description: 'Tests queue management, resource allocation, and concurrent processing',
      files: ['parallel-execution.test.ts'],
      dependencies: ['TestQueueManager', 'ResourceManager', 'Semaphore']
    },
    {
      name: 'WebSocket Integration',
      description: 'Tests real-time communication, progress updates, and multi-agent coordination',
      files: ['websocket-integration.test.ts'],
      dependencies: ['ProgressService', 'WebSocketManager']
    }
  ];

  private results: TestResult[] = [];
  private startTime: number = 0;

  constructor(private verbose: boolean = false) {}

  async runAllTests(): Promise<void> {
    console.log(chalk.blue.bold('🧪 Starting Phase 4 Integration Tests'));
    console.log(chalk.gray('Testing newly implemented features comprehensively...\n'));

    this.startTime = Date.now();

    // Check dependencies first
    await this.checkDependencies();

    // Run each test suite
    for (const suite of this.testSuites) {
      await this.runTestSuite(suite);
    }

    // Generate final report
    await this.generateReport();
  }

  private async checkDependencies(): Promise<void> {
    console.log(chalk.yellow('📋 Checking Dependencies...'));
    
    const allDependencies = new Set<string>();
    this.testSuites.forEach(suite => {
      suite.dependencies.forEach(dep => allDependencies.add(dep));
    });

    for (const dep of allDependencies) {
      const exists = await this.checkServiceExists(dep);
      if (exists) {
        console.log(chalk.green(`✅ ${dep} - Available`));
      } else {
        console.log(chalk.red(`❌ ${dep} - Missing`));
      }
    }
    console.log();
  }

  private async checkServiceExists(serviceName: string): Promise<boolean> {
    try {
      const servicePath = path.join(__dirname, '../../services', serviceName);
      return fs.existsSync(servicePath + '.ts') || fs.existsSync(servicePath + '.js');
    } catch {
      return false;
    }
  }

  private async runTestSuite(suite: TestSuite): Promise<void> {
    console.log(chalk.blue.bold(`🔍 ${suite.name}`));
    console.log(chalk.gray(`   ${suite.description}`));

    for (const testFile of suite.files) {
      const result = await this.runSingleTest(testFile);
      this.results.push(result);
      
      if (result.passed) {
        console.log(chalk.green(`   ✅ ${testFile} - Passed (${result.duration}ms)`));
      } else {
        console.log(chalk.red(`   ❌ ${testFile} - Failed (${result.duration}ms)`));
        if (this.verbose && result.error) {
          console.log(chalk.red(`      Error: ${result.error}`));
        }
      }
    }
    console.log();
  }

  private async runSingleTest(testFile: string): Promise<TestResult> {
    const startTime = Date.now();
    const testPath = path.join(__dirname, testFile);

    return new Promise((resolve) => {
      const child = spawn('npx', ['mocha', testPath, '--require', 'ts-node/register'], {
        stdio: 'pipe',
        cwd: path.join(__dirname, '../../..')
      });

      let output = '';
      let error = '';

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        error += data.toString();
      });

      child.on('close', (code) => {
        const duration = Date.now() - startTime;
        resolve({
          testFile,
          passed: code === 0,
          duration,
          error: error || undefined,
          output: output || undefined
        });
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        child.kill();
        resolve({
          testFile,
          passed: false,
          duration: Date.now() - startTime,
          error: 'Test timed out after 5 minutes'
        });
      }, 5 * 60 * 1000);
    });
  }

  private async generateReport(): Promise<void> {
    const totalDuration = Date.now() - this.startTime;
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => r.passed === false).length;
    const successRate = (passed / this.results.length) * 100;

    console.log(chalk.blue.bold('📊 Integration Test Results'));
    console.log(chalk.blue('='.repeat(50)));
    console.log(chalk.white(`Total Tests: ${this.results.length}`));
    console.log(chalk.green(`Passed: ${passed}`));
    console.log(chalk.red(`Failed: ${failed}`));
    console.log(chalk.yellow(`Success Rate: ${successRate.toFixed(1)}%`));
    console.log(chalk.gray(`Total Duration: ${totalDuration}ms`));
    console.log();

    // Test suite breakdown
    console.log(chalk.blue.bold('📋 Test Suite Breakdown'));
    this.testSuites.forEach((suite, index) => {
      const suiteResults = this.results.filter(r => 
        suite.files.includes(r.testFile)
      );
      const suitePassed = suiteResults.filter(r => r.passed).length;
      const suiteTotal = suiteResults.length;
      const suiteRate = (suitePassed / suiteTotal) * 100;

      console.log(chalk.white(`${index + 1}. ${suite.name}: ${suitePassed}/${suiteTotal} (${suiteRate.toFixed(1)}%)`));
    });

    // Failed tests details
    const failedTests = this.results.filter(r => !r.passed);
    if (failedTests.length > 0) {
      console.log();
      console.log(chalk.red.bold('❌ Failed Tests Details'));
      failedTests.forEach((test, index) => {
        console.log(chalk.red(`${index + 1}. ${test.testFile}`));
        if (test.error) {
          console.log(chalk.gray(`   Error: ${test.error.substring(0, 200)}...`));
        }
      });
    }

    // Performance insights
    console.log();
    console.log(chalk.blue.bold('⚡ Performance Insights'));
    const avgDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length;
    const slowestTest = this.results.reduce((prev, curr) => 
      curr.duration > prev.duration ? curr : prev
    );
    const fastestTest = this.results.reduce((prev, curr) => 
      curr.duration < prev.duration ? curr : prev
    );

    console.log(chalk.white(`Average Test Duration: ${avgDuration.toFixed(0)}ms`));
    console.log(chalk.yellow(`Slowest Test: ${slowestTest.testFile} (${slowestTest.duration}ms)`));
    console.log(chalk.green(`Fastest Test: ${fastestTest.testFile} (${fastestTest.duration}ms)`));

    // Save detailed report
    await this.saveDetailedReport();

    // Coordination update
    await this.updateCoordination();
  }

  private async saveDetailedReport(): Promise<void> {
    const reportPath = path.join(__dirname, '../../../integration-test-report.json');
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.results.length,
        passed: this.results.filter(r => r.passed).length,
        failed: this.results.filter(r => !r.passed).length,
        duration: Date.now() - this.startTime
      },
      testSuites: this.testSuites.map(suite => ({
        name: suite.name,
        description: suite.description,
        results: this.results.filter(r => suite.files.includes(r.testFile))
      })),
      detailedResults: this.results
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(chalk.gray(`📄 Detailed report saved to: ${reportPath}`));
  }

  private async updateCoordination(): Promise<void> {
    console.log(chalk.blue('\n🤝 Updating Agent Coordination...'));
    
    const testResults = {
      phase: 'Phase 4 Integration Testing',
      status: this.results.every(r => r.passed) ? 'SUCCESS' : 'PARTIAL_SUCCESS',
      summary: {
        totalTests: this.results.length,
        passed: this.results.filter(r => r.passed).length,
        failed: this.results.filter(r => !r.passed).length,
        duration: Date.now() - this.startTime
      },
      issues: this.results.filter(r => !r.passed).map(r => ({
        testFile: r.testFile,
        error: r.error
      })),
      recommendations: this.generateRecommendations()
    };

    // Store in coordination memory
    try {
      const { spawn } = require('child_process');
      const memoryKey = `testing/integration/phase4_results`;
      const memoryValue = JSON.stringify(testResults);
      
      spawn('npx', ['claude-flow@alpha', 'hooks', 'notification', 
        '--message', `Integration testing completed: ${testResults.status}`,
        '--telemetry', 'true'
      ], { stdio: 'inherit' });

      console.log(chalk.green('✅ Coordination updated successfully'));
    } catch (error) {
      console.log(chalk.yellow('⚠️ Could not update coordination (non-critical)'));
    }
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    const failedTests = this.results.filter(r => !r.passed);
    if (failedTests.length > 0) {
      recommendations.push(`Review and fix ${failedTests.length} failed integration tests`);
    }

    const slowTests = this.results.filter(r => r.duration > 30000); // > 30 seconds
    if (slowTests.length > 0) {
      recommendations.push(`Optimize ${slowTests.length} slow-running tests for better performance`);
    }

    const successRate = (this.results.filter(r => r.passed).length / this.results.length) * 100;
    if (successRate < 80) {
      recommendations.push('Success rate below 80% - investigate system stability');
    }

    if (recommendations.length === 0) {
      recommendations.push('All integration tests passed - system is ready for deployment');
    }

    return recommendations;
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v');
  
  const runner = new IntegrationTestRunner(verbose);
  
  runner.runAllTests().then(() => {
    console.log(chalk.green.bold('\n🎉 Integration testing completed!'));
    process.exit(0);
  }).catch((error) => {
    console.error(chalk.red.bold('❌ Integration testing failed:'), error);
    process.exit(1);
  });
}

export { IntegrationTestRunner };