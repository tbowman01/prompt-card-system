/**
 * Comprehensive Test Runner
 * @description Main test runner for executing all test suites
 */

import { execSync, spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';

interface TestSuite {
  name: string;
  path: string;
  timeout: number;
  parallel: boolean;
  dependencies?: string[];
}

interface TestResults {
  suite: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  coverage?: number;
  errors: string[];
}

const TEST_SUITES: TestSuite[] = [
  {
    name: 'Unit Tests - Backend',
    path: 'tests/unit/backend',
    timeout: 60000,
    parallel: true,
  },
  {
    name: 'Unit Tests - Frontend',
    path: 'tests/unit/frontend',
    timeout: 60000,
    parallel: true,
  },
  {
    name: 'Unit Tests - Auth',
    path: 'tests/unit/auth',
    timeout: 30000,
    parallel: true,
  },
  {
    name: 'Integration Tests - API',
    path: 'tests/integration/api',
    timeout: 120000,
    parallel: false,
    dependencies: ['Unit Tests - Backend'],
  },
  {
    name: 'Integration Tests - Database',
    path: 'tests/integration/database',
    timeout: 90000,
    parallel: false,
    dependencies: ['Unit Tests - Backend'],
  },
  {
    name: 'Integration Tests - Services',
    path: 'tests/integration/services',
    timeout: 120000,
    parallel: false,
    dependencies: ['Unit Tests - Backend', 'Unit Tests - Auth'],
  },
  {
    name: 'Performance Tests',
    path: 'tests/performance',
    timeout: 300000,
    parallel: false,
    dependencies: ['Integration Tests - API'],
  },
  {
    name: 'Docker Tests',
    path: 'tests/docker',
    timeout: 600000,
    parallel: false,
    dependencies: ['Integration Tests - Services'],
  },
  {
    name: 'E2E Tests',
    path: 'tests/e2e',
    timeout: 900000,
    parallel: false,
    dependencies: ['Docker Tests'],
  },
];

class TestRunner {
  private results: TestResults[] = [];
  private startTime: number = 0;
  private totalTime: number = 0;

  constructor() {
    this.startTime = Date.now();
  }

  async runAllTests(options: {
    parallel?: boolean;
    coverage?: boolean;
    suites?: string[];
    verbose?: boolean;
  } = {}): Promise<void> {
    console.log('🚀 Starting Comprehensive Test Suite');
    console.log('=====================================');

    const suitesToRun = this.filterSuites(options.suites);
    
    if (options.parallel && this.canRunInParallel(suitesToRun)) {
      await this.runTestsInParallel(suitesToRun, options);
    } else {
      await this.runTestsSequentially(suitesToRun, options);
    }

    this.totalTime = Date.now() - this.startTime;
    await this.generateReport(options);
  }

  private filterSuites(suiteNames?: string[]): TestSuite[] {
    if (!suiteNames || suiteNames.length === 0) {
      return TEST_SUITES;
    }

    return TEST_SUITES.filter(suite => 
      suiteNames.some(name => suite.name.toLowerCase().includes(name.toLowerCase()))
    );
  }

  private canRunInParallel(suites: TestSuite[]): boolean {
    return suites.every(suite => suite.parallel && !suite.dependencies);
  }

  private async runTestsInParallel(suites: TestSuite[], options: any): Promise<void> {
    console.log('🔄 Running tests in parallel...');

    const promises = suites.map(suite => this.runTestSuite(suite, options));
    const results = await Promise.allSettled(promises);

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`❌ Test suite ${suites[index].name} failed:`, result.reason);
      }
    });
  }

  private async runTestsSequentially(suites: TestSuite[], options: any): Promise<void> {
    console.log('📋 Running tests sequentially...');

    const sortedSuites = this.topologicalSort(suites);

    for (const suite of sortedSuites) {
      try {
        await this.runTestSuite(suite, options);
      } catch (error) {
        console.error(`❌ Test suite ${suite.name} failed:`, error);
        
        // Check if we should continue or stop
        if (this.shouldStopOnFailure(suite)) {
          console.log('🛑 Stopping test execution due to critical failure');
          break;
        }
      }
    }
  }

  private topologicalSort(suites: TestSuite[]): TestSuite[] {
    const sorted: TestSuite[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (suite: TestSuite) => {
      if (visiting.has(suite.name)) {
        throw new Error(`Circular dependency detected: ${suite.name}`);
      }
      if (visited.has(suite.name)) {
        return;
      }

      visiting.add(suite.name);

      if (suite.dependencies) {
        for (const depName of suite.dependencies) {
          const depSuite = suites.find(s => s.name === depName);
          if (depSuite) {
            visit(depSuite);
          }
        }
      }

      visiting.delete(suite.name);
      visited.add(suite.name);
      sorted.push(suite);
    };

    for (const suite of suites) {
      visit(suite);
    }

    return sorted;
  }

  private async runTestSuite(suite: TestSuite, options: any): Promise<TestResults> {
    console.log(`\n🧪 Running ${suite.name}...`);
    const startTime = Date.now();

    try {
      // Pre-test setup
      await this.setupTestSuite(suite);

      // Run tests
      const result = await this.executeTests(suite, options);
      
      // Post-test cleanup
      await this.cleanupTestSuite(suite);

      const duration = Date.now() - startTime;
      const testResult: TestResults = {
        suite: suite.name,
        passed: result.passed,
        failed: result.failed,
        skipped: result.skipped,
        duration,
        coverage: result.coverage,
        errors: result.errors,
      };

      this.results.push(testResult);
      this.logTestResult(testResult);

      return testResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      const testResult: TestResults = {
        suite: suite.name,
        passed: 0,
        failed: 1,
        skipped: 0,
        duration,
        errors: [error instanceof Error ? error.message : String(error)],
      };

      this.results.push(testResult);
      this.logTestResult(testResult);

      throw error;
    }
  }

  private async setupTestSuite(suite: TestSuite): Promise<void> {
    // Suite-specific setup
    switch (suite.name) {
      case 'Docker Tests':
        console.log('🐳 Setting up Docker environment...');
        try {
          execSync('docker --version', { stdio: 'pipe' });
        } catch (error) {
          throw new Error('Docker is not available');
        }
        break;

      case 'E2E Tests':
        console.log('🎭 Setting up E2E environment...');
        // Check if services are running
        await this.waitForServices();
        break;

      case 'Performance Tests':
        console.log('⚡ Setting up performance test environment...');
        // Ensure clean state for performance testing
        break;
    }
  }

  private async cleanupTestSuite(suite: TestSuite): Promise<void> {
    // Suite-specific cleanup
    switch (suite.name) {
      case 'Docker Tests':
        console.log('🐳 Cleaning up Docker containers...');
        try {
          execSync('docker-compose -f docker/docker-compose.yml down -v', { stdio: 'pipe' });
        } catch (error) {
          // Ignore cleanup errors
        }
        break;

      case 'E2E Tests':
        console.log('🎭 Cleaning up E2E environment...');
        break;
    }
  }

  private async executeTests(suite: TestSuite, options: any): Promise<any> {
    const jestConfig = this.getJestConfig(suite, options);
    const command = `npx jest ${jestConfig}`;

    return new Promise((resolve, reject) => {
      const process = spawn('npx', ['jest', ...jestConfig.split(' ')], {
        stdio: 'pipe',
        timeout: suite.timeout,
      });

      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
        if (options.verbose) {
          console.log(data.toString());
        }
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
        if (options.verbose) {
          console.error(data.toString());
        }
      });

      process.on('close', (code) => {
        const result = this.parseJestOutput(stdout, stderr);
        
        if (code === 0) {
          resolve(result);
        } else {
          result.errors.push(`Process exited with code ${code}`);
          resolve(result); // Don't reject, let caller handle failures
        }
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  private getJestConfig(suite: TestSuite, options: any): string {
    const configs = [];

    configs.push(`--testPathPattern="${suite.path}"`);
    configs.push(`--testTimeout=${suite.timeout}`);
    
    if (options.coverage) {
      configs.push('--coverage');
      configs.push(`--coverageDirectory=coverage/${suite.name.toLowerCase().replace(/\s+/g, '-')}`);
    }

    if (options.verbose) {
      configs.push('--verbose');
    }

    if (suite.parallel) {
      configs.push('--maxWorkers=50%');
    } else {
      configs.push('--runInBand');
    }

    // Environment-specific configs
    if (suite.path.includes('frontend')) {
      configs.push('--testEnvironment=jsdom');
    } else {
      configs.push('--testEnvironment=node');
    }

    return configs.join(' ');
  }

  private parseJestOutput(stdout: string, stderr: string): any {
    const result = {
      passed: 0,
      failed: 0,
      skipped: 0,
      coverage: 0,
      errors: [] as string[],
    };

    // Parse test results from Jest output
    const testSummaryRegex = /Tests:\s+(\d+)\s+failed,\s+(\d+)\s+passed,\s+(\d+)\s+total/;
    const match = stdout.match(testSummaryRegex);

    if (match) {
      result.failed = parseInt(match[1], 10);
      result.passed = parseInt(match[2], 10);
    }

    // Parse coverage
    const coverageRegex = /All files\s+\|\s+([\d.]+)/;
    const coverageMatch = stdout.match(coverageRegex);
    if (coverageMatch) {
      result.coverage = parseFloat(coverageMatch[1]);
    }

    // Extract errors
    if (stderr) {
      result.errors.push(stderr);
    }

    return result;
  }

  private async waitForServices(): Promise<void> {
    const services = [
      { name: 'Backend', url: 'http://localhost:8000/api/health' },
      { name: 'Frontend', url: 'http://localhost:3000' },
      { name: 'Auth', url: 'http://localhost:8005/health' },
    ];

    for (const service of services) {
      console.log(`⏳ Waiting for ${service.name}...`);
      
      let retries = 30;
      while (retries > 0) {
        try {
          const response = await fetch(service.url);
          if (response.ok) {
            console.log(`✅ ${service.name} is ready`);
            break;
          }
        } catch (error) {
          // Service not ready yet
        }

        retries--;
        if (retries === 0) {
          throw new Error(`${service.name} did not become ready in time`);
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  private shouldStopOnFailure(suite: TestSuite): boolean {
    // Stop on critical infrastructure failures
    return suite.name.includes('Docker') || suite.name.includes('Database');
  }

  private logTestResult(result: TestResults): void {
    const status = result.failed > 0 ? '❌' : '✅';
    const coverage = result.coverage ? `(${result.coverage.toFixed(1)}% coverage)` : '';
    
    console.log(
      `${status} ${result.suite}: ${result.passed} passed, ${result.failed} failed, ` +
      `${result.skipped} skipped in ${(result.duration / 1000).toFixed(2)}s ${coverage}`
    );

    if (result.errors.length > 0) {
      console.error('   Errors:', result.errors.join(', '));
    }
  }

  private async generateReport(options: any): Promise<void> {
    console.log('\n📊 Test Summary Report');
    console.log('======================');

    const totalPassed = this.results.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = this.results.reduce((sum, r) => sum + r.failed, 0);
    const totalSkipped = this.results.reduce((sum, r) => sum + r.skipped, 0);
    const totalTests = totalPassed + totalFailed + totalSkipped;
    const averageCoverage = this.results
      .filter(r => r.coverage !== undefined)
      .reduce((sum, r) => sum + (r.coverage || 0), 0) / this.results.length;

    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${totalPassed} (${((totalPassed / totalTests) * 100).toFixed(1)}%)`);
    console.log(`Failed: ${totalFailed} (${((totalFailed / totalTests) * 100).toFixed(1)}%)`);
    console.log(`Skipped: ${totalSkipped} (${((totalSkipped / totalTests) * 100).toFixed(1)}%)`);
    console.log(`Average Coverage: ${averageCoverage.toFixed(1)}%`);
    console.log(`Total Duration: ${(this.totalTime / 1000).toFixed(2)}s`);

    // Generate detailed report file
    const reportPath = path.join(process.cwd(), 'test-report.json');
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests,
        passed: totalPassed,
        failed: totalFailed,
        skipped: totalSkipped,
        averageCoverage,
        totalDuration: this.totalTime,
      },
      suites: this.results,
    };

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);

    // Exit with appropriate code
    if (totalFailed > 0) {
      console.log('\n❌ Some tests failed!');
      process.exit(1);
    } else {
      console.log('\n✅ All tests passed!');
      process.exit(0);
    }
  }
}

// CLI interface
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = {
    parallel: args.includes('--parallel'),
    coverage: args.includes('--coverage'),
    verbose: args.includes('--verbose'),
    suites: args.filter(arg => !arg.startsWith('--')),
  };

  const runner = new TestRunner();
  await runner.runAllTests(options);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

export { TestRunner, TEST_SUITES };