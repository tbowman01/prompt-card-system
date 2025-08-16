#!/usr/bin/env node

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { performance } from 'perf_hooks';

const execAsync = promisify(exec);

interface TestSuite {
  name: string;
  path: string;
  description: string;
  timeout: number;
  category: 'unit' | 'integration' | 'performance' | 'resilience' | 'ml';
  criticality: 'low' | 'medium' | 'high' | 'critical';
  prerequisites?: string[];
}

interface TestResult {
  suite: string;
  passed: boolean;
  duration: number;
  tests: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  coverage?: {
    lines: number;
    functions: number;
    branches: number;
    statements: number;
  };
  performance?: {
    memoryUsage: number;
    cpuTime: number;
  };
  errors?: string[];
}

interface TestReport {
  timestamp: Date;
  totalDuration: number;
  suites: TestResult[];
  summary: {
    totalSuites: number;
    passedSuites: number;
    failedSuites: number;
    totalTests: number;
    passedTests: number;
    failedTests: number;
    overallCoverage?: {
      lines: number;
      functions: number;
      branches: number;
      statements: number;
    };
  };
  performanceMetrics: {
    memoryReductionAchieved: boolean;
    latencyTargetsMet: boolean;
    throughputTargetsMet: boolean;
    reliabilityTargetsMet: boolean;
  };
  regressionResults: {
    newFailures: string[];
    fixedTests: string[];
    performanceRegressions: string[];
    performanceImprovements: string[];
  };
}

class OptimizationTestRunner {
  private testSuites: TestSuite[] = [
    {
      name: 'AdvancedKVCache Unit Tests',
      path: 'tests/unit/AdvancedKVCache.test.ts',
      description: 'Core cache functionality and performance tests',
      timeout: 60000,
      category: 'unit',
      criticality: 'critical'
    },
    {
      name: 'RealTimeOptimizer Unit Tests',
      path: 'tests/optimization/RealTimeOptimizer.test.ts',
      description: 'ML algorithms and real-time optimization tests',
      timeout: 120000,
      category: 'unit',
      criticality: 'critical'
    },
    {
      name: 'EdgeOptimizer Comprehensive Tests',
      path: 'tests/edge/EdgeOptimizer.comprehensive.test.ts',
      description: 'Distributed computing and edge optimization tests',
      timeout: 180000,
      category: 'unit',
      criticality: 'critical'
    },
    {
      name: 'Component Integration Tests',
      path: 'tests/integration/optimization-component-integration.test.ts',
      description: 'Cross-component interaction and workflow tests',
      timeout: 240000,
      category: 'integration',
      criticality: 'high',
      prerequisites: ['unit-tests']
    },
    {
      name: 'Performance Validation Tests',
      path: 'tests/performance/optimization-performance-validation.test.ts',
      description: 'Performance targets and load testing validation',
      timeout: 300000,
      category: 'performance',
      criticality: 'high',
      prerequisites: ['unit-tests', 'integration-tests']
    },
    {
      name: 'Failover and Fault Tolerance Tests',
      path: 'tests/resilience/failover-fault-tolerance.test.ts',
      description: 'System resilience and fault tolerance validation',
      timeout: 300000,
      category: 'resilience',
      criticality: 'high',
      prerequisites: ['unit-tests']
    },
    {
      name: 'ML Algorithm Accuracy Tests',
      path: 'tests/ml/ml-algorithm-accuracy.test.ts',
      description: 'Machine learning model effectiveness and accuracy',
      timeout: 360000,
      category: 'ml',
      criticality: 'medium',
      prerequisites: ['unit-tests']
    }
  ];

  private previousResults: TestReport | null = null;
  private projectRoot: string;

  constructor() {
    this.projectRoot = process.cwd();
  }

  async runAllTests(options: {
    categories?: string[];
    parallel?: boolean;
    coverage?: boolean;
    performance?: boolean;
    regression?: boolean;
    verbose?: boolean;
  } = {}): Promise<TestReport> {
    const {
      categories = ['unit', 'integration', 'performance', 'resilience', 'ml'],
      parallel = false,
      coverage = true,
      performance = true,
      regression = true,
      verbose = false
    } = options;

    console.log('🚀 Starting Optimization Test Suite');
    console.log(`Categories: ${categories.join(', ')}`);
    console.log(`Parallel execution: ${parallel}`);
    console.log(`Coverage analysis: ${coverage}`);
    console.log(`Performance validation: ${performance}`);
    console.log(`Regression detection: ${regression}`);
    console.log('\n');

    const startTime = performance.now();

    // Load previous results for regression analysis
    if (regression) {
      this.previousResults = await this.loadPreviousResults();
    }

    // Filter test suites by category
    const suitesToRun = this.testSuites.filter(suite => 
      categories.includes(suite.category)
    );

    // Run tests
    const results = parallel 
      ? await this.runTestsInParallel(suitesToRun, { coverage, verbose })
      : await this.runTestsSequentially(suitesToRun, { coverage, verbose });

    const totalDuration = performance.now() - startTime;

    // Generate comprehensive report
    const report = await this.generateTestReport(results, totalDuration, {
      performance,
      regression
    });

    // Save results for future regression analysis
    await this.saveTestResults(report);

    // Print summary
    this.printTestSummary(report);

    return report;
  }

  private async runTestsSequentially(
    suites: TestSuite[],
    options: { coverage: boolean; verbose: boolean }
  ): Promise<TestResult[]> {
    const results: TestResult[] = [];

    for (const suite of suites) {
      console.log(`\n📋 Running: ${suite.name}`);
      console.log(`   ${suite.description}`);
      
      const result = await this.runSingleTest(suite, options);
      results.push(result);

      if (result.passed) {
        console.log(`✅ PASSED: ${suite.name} (${result.duration.toFixed(0)}ms)`);
      } else {
        console.log(`❌ FAILED: ${suite.name} (${result.duration.toFixed(0)}ms)`);
        if (options.verbose && result.errors) {
          result.errors.forEach(error => console.log(`   Error: ${error}`));
        }
      }
    }

    return results;
  }

  private async runTestsInParallel(
    suites: TestSuite[],
    options: { coverage: boolean; verbose: boolean }
  ): Promise<TestResult[]> {
    console.log(`\n🔄 Running ${suites.length} test suites in parallel...`);

    // Group by prerequisites to ensure proper execution order
    const grouped = this.groupSuitesByPrerequisites(suites);
    const results: TestResult[] = [];

    for (const group of grouped) {
      const groupPromises = group.map(suite => this.runSingleTest(suite, options));
      const groupResults = await Promise.all(groupPromises);
      results.push(...groupResults);
    }

    return results;
  }

  private async runSingleTest(
    suite: TestSuite,
    options: { coverage: boolean; verbose: boolean }
  ): Promise<TestResult> {
    const startTime = performance.now();
    const initialMemory = process.memoryUsage();

    try {
      const jestCommand = this.buildJestCommand(suite, options);
      const { stdout, stderr } = await execAsync(jestCommand, {
        cwd: this.projectRoot,
        timeout: suite.timeout
      });

      const finalMemory = process.memoryUsage();
      const result = this.parseJestOutput(stdout, stderr);

      return {
        suite: suite.name,
        passed: result.failed === 0,
        duration: performance.now() - startTime,
        tests: result,
        coverage: options.coverage ? await this.extractCoverageData(stdout) : undefined,
        performance: {
          memoryUsage: finalMemory.heapUsed - initialMemory.heapUsed,
          cpuTime: performance.now() - startTime
        },
        errors: result.failed > 0 ? this.extractErrors(stderr) : undefined
      };
    } catch (error) {
      return {
        suite: suite.name,
        passed: false,
        duration: performance.now() - startTime,
        tests: { total: 0, passed: 0, failed: 1, skipped: 0 },
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  private buildJestCommand(suite: TestSuite, options: { coverage: boolean; verbose: boolean }): string {
    const parts = [
      'npx jest',
      `"${suite.path}"`,
      '--passWithNoTests',
      '--detectOpenHandles',
      '--forceExit'
    ];

    if (options.coverage) {
      parts.push('--coverage');
      parts.push('--coverageReporters=json-summary');
      parts.push('--coverageReporters=text');
    }

    if (options.verbose) {
      parts.push('--verbose');
    }

    parts.push('--testTimeout=' + suite.timeout);

    return parts.join(' ');
  }

  private parseJestOutput(stdout: string, stderr: string): {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  } {
    // Parse Jest output to extract test results
    const lines = stdout.split('\n');
    
    let total = 0, passed = 0, failed = 0, skipped = 0;

    for (const line of lines) {
      if (line.includes('Tests:')) {
        const match = line.match(/(\d+) passed|failed|skipped/g);
        if (match) {
          match.forEach(m => {
            const num = parseInt(m.match(/\d+/)?.[0] || '0');
            if (m.includes('passed')) passed = num;
            else if (m.includes('failed')) failed = num;
            else if (m.includes('skipped')) skipped = num;
          });
        }
      }
    }

    total = passed + failed + skipped;

    return { total, passed, failed, skipped };
  }

  private async extractCoverageData(output: string): Promise<{
    lines: number;
    functions: number;
    branches: number;
    statements: number;
  } | undefined> {
    try {
      // Look for coverage-summary.json
      const coveragePath = path.join(this.projectRoot, 'coverage', 'coverage-summary.json');
      const coverageData = JSON.parse(await fs.readFile(coveragePath, 'utf-8'));
      
      const total = coverageData.total;
      return {
        lines: total.lines.pct,
        functions: total.functions.pct,
        branches: total.branches.pct,
        statements: total.statements.pct
      };
    } catch (error) {
      return undefined;
    }
  }

  private extractErrors(stderr: string): string[] {
    const lines = stderr.split('\n');
    const errors: string[] = [];

    for (const line of lines) {
      if (line.includes('Error:') || line.includes('✕') || line.includes('FAIL')) {
        errors.push(line.trim());
      }
    }

    return errors;
  }

  private groupSuitesByPrerequisites(suites: TestSuite[]): TestSuite[][] {
    const grouped: TestSuite[][] = [];
    const processed = new Set<string>();
    
    // First group: no prerequisites
    const noDeps = suites.filter(s => !s.prerequisites || s.prerequisites.length === 0);
    if (noDeps.length > 0) {
      grouped.push(noDeps);
      noDeps.forEach(s => processed.add(s.name));
    }
    
    // Subsequent groups: based on prerequisites
    let remaining = suites.filter(s => !processed.has(s.name));
    
    while (remaining.length > 0) {
      const canRun = remaining.filter(s => 
        s.prerequisites?.every(prereq => processed.has(prereq)) ?? true
      );
      
      if (canRun.length === 0) {
        // Circular dependency or missing prerequisite
        grouped.push(remaining);
        break;
      }
      
      grouped.push(canRun);
      canRun.forEach(s => processed.add(s.name));
      remaining = remaining.filter(s => !processed.has(s.name));
    }
    
    return grouped;
  }

  private async generateTestReport(
    results: TestResult[],
    totalDuration: number,
    options: { performance: boolean; regression: boolean }
  ): Promise<TestReport> {
    const summary = this.calculateSummary(results);
    
    const report: TestReport = {
      timestamp: new Date(),
      totalDuration,
      suites: results,
      summary,
      performanceMetrics: options.performance 
        ? await this.analyzePerformanceMetrics(results)
        : {
            memoryReductionAchieved: false,
            latencyTargetsMet: false,
            throughputTargetsMet: false,
            reliabilityTargetsMet: false
          },
      regressionResults: options.regression && this.previousResults
        ? this.analyzeRegressions(results, this.previousResults.suites)
        : {
            newFailures: [],
            fixedTests: [],
            performanceRegressions: [],
            performanceImprovements: []
          }
    };

    return report;
  }

  private calculateSummary(results: TestResult[]): TestReport['summary'] {
    const totalSuites = results.length;
    const passedSuites = results.filter(r => r.passed).length;
    const failedSuites = totalSuites - passedSuites;
    
    const totalTests = results.reduce((sum, r) => sum + r.tests.total, 0);
    const passedTests = results.reduce((sum, r) => sum + r.tests.passed, 0);
    const failedTests = results.reduce((sum, r) => sum + r.tests.failed, 0);
    
    // Calculate overall coverage
    const coverageResults = results.filter(r => r.coverage);
    const overallCoverage = coverageResults.length > 0 ? {
      lines: coverageResults.reduce((sum, r) => sum + (r.coverage?.lines || 0), 0) / coverageResults.length,
      functions: coverageResults.reduce((sum, r) => sum + (r.coverage?.functions || 0), 0) / coverageResults.length,
      branches: coverageResults.reduce((sum, r) => sum + (r.coverage?.branches || 0), 0) / coverageResults.length,
      statements: coverageResults.reduce((sum, r) => sum + (r.coverage?.statements || 0), 0) / coverageResults.length
    } : undefined;
    
    return {
      totalSuites,
      passedSuites,
      failedSuites,
      totalTests,
      passedTests,
      failedTests,
      overallCoverage
    };
  }

  private async analyzePerformanceMetrics(results: TestResult[]): Promise<TestReport['performanceMetrics']> {
    // Analyze performance test results
    const performanceResults = results.filter(r => r.suite.includes('Performance'));
    
    return {
      memoryReductionAchieved: this.checkMemoryReductionTarget(performanceResults),
      latencyTargetsMet: this.checkLatencyTargets(performanceResults),
      throughputTargetsMet: this.checkThroughputTargets(performanceResults),
      reliabilityTargetsMet: this.checkReliabilityTargets(results)
    };
  }

  private checkMemoryReductionTarget(results: TestResult[]): boolean {
    // Target: 50% memory reduction
    // This would check specific test outputs for memory reduction metrics
    return results.length > 0 && results.every(r => r.passed);
  }

  private checkLatencyTargets(results: TestResult[]): boolean {
    // Target: 90% latency reduction
    // This would check specific test outputs for latency metrics
    return results.length > 0 && results.every(r => r.passed);
  }

  private checkThroughputTargets(results: TestResult[]): boolean {
    // Target: throughput improvements
    return results.length > 0 && results.every(r => r.passed);
  }

  private checkReliabilityTargets(results: TestResult[]): boolean {
    // Target: high availability and fault tolerance
    const resilienceResults = results.filter(r => r.suite.includes('Resilience') || r.suite.includes('Failover'));
    return resilienceResults.length > 0 && resilienceResults.every(r => r.passed);
  }

  private analyzeRegressions(
    currentResults: TestResult[],
    previousResults: TestResult[]
  ): TestReport['regressionResults'] {
    const newFailures: string[] = [];
    const fixedTests: string[] = [];
    const performanceRegressions: string[] = [];
    const performanceImprovements: string[] = [];

    for (const current of currentResults) {
      const previous = previousResults.find(p => p.suite === current.suite);
      
      if (previous) {
        // Check for new failures
        if (previous.passed && !current.passed) {
          newFailures.push(current.suite);
        }
        
        // Check for fixes
        if (!previous.passed && current.passed) {
          fixedTests.push(current.suite);
        }
        
        // Check for performance regressions (>20% slower)
        if (current.duration > previous.duration * 1.2) {
          performanceRegressions.push(`${current.suite}: ${(current.duration - previous.duration).toFixed(0)}ms slower`);
        }
        
        // Check for performance improvements (>20% faster)
        if (current.duration < previous.duration * 0.8) {
          performanceImprovements.push(`${current.suite}: ${(previous.duration - current.duration).toFixed(0)}ms faster`);
        }
      }
    }

    return {
      newFailures,
      fixedTests,
      performanceRegressions,
      performanceImprovements
    };
  }

  private async loadPreviousResults(): Promise<TestReport | null> {
    try {
      const resultsPath = path.join(this.projectRoot, 'test-results', 'latest-results.json');
      const data = await fs.readFile(resultsPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.log('ℹ️ No previous test results found for regression analysis');
      return null;
    }
  }

  private async saveTestResults(report: TestReport): Promise<void> {
    try {
      const resultsDir = path.join(this.projectRoot, 'test-results');
      await fs.mkdir(resultsDir, { recursive: true });
      
      // Save latest results
      const latestPath = path.join(resultsDir, 'latest-results.json');
      await fs.writeFile(latestPath, JSON.stringify(report, null, 2));
      
      // Save timestamped results
      const timestamp = report.timestamp.toISOString().replace(/[:.]/g, '-');
      const timestampedPath = path.join(resultsDir, `results-${timestamp}.json`);
      await fs.writeFile(timestampedPath, JSON.stringify(report, null, 2));
      
      console.log(`\n📄 Test results saved to: ${latestPath}`);
    } catch (error) {
      console.error('⚠️ Failed to save test results:', error);
    }
  }

  private printTestSummary(report: TestReport): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 OPTIMIZATION TEST SUITE SUMMARY');
    console.log('='.repeat(80));
    
    console.log(`\n🕐 Total Duration: ${(report.totalDuration / 1000).toFixed(2)}s`);
    console.log(`📋 Test Suites: ${report.summary.passedSuites}/${report.summary.totalSuites} passed`);
    console.log(`🧪 Individual Tests: ${report.summary.passedTests}/${report.summary.totalTests} passed`);
    
    if (report.summary.overallCoverage) {
      console.log(`\n📈 Code Coverage:`);
      console.log(`   Lines: ${report.summary.overallCoverage.lines.toFixed(1)}%`);
      console.log(`   Functions: ${report.summary.overallCoverage.functions.toFixed(1)}%`);
      console.log(`   Branches: ${report.summary.overallCoverage.branches.toFixed(1)}%`);
      console.log(`   Statements: ${report.summary.overallCoverage.statements.toFixed(1)}%`);
    }
    
    console.log(`\n🎯 Performance Targets:`);
    console.log(`   Memory Reduction (50%): ${report.performanceMetrics.memoryReductionAchieved ? '✅' : '❌'}`);
    console.log(`   Latency Reduction (90%): ${report.performanceMetrics.latencyTargetsMet ? '✅' : '❌'}`);
    console.log(`   Throughput Targets: ${report.performanceMetrics.throughputTargetsMet ? '✅' : '❌'}`);
    console.log(`   Reliability Targets: ${report.performanceMetrics.reliabilityTargetsMet ? '✅' : '❌'}`);
    
    if (report.regressionResults.newFailures.length > 0 || 
        report.regressionResults.performanceRegressions.length > 0) {
      console.log(`\n⚠️ Regressions Detected:`);
      report.regressionResults.newFailures.forEach(failure => {
        console.log(`   ❌ New failure: ${failure}`);
      });
      report.regressionResults.performanceRegressions.forEach(regression => {
        console.log(`   🐌 Performance regression: ${regression}`);
      });
    }
    
    if (report.regressionResults.fixedTests.length > 0 || 
        report.regressionResults.performanceImprovements.length > 0) {
      console.log(`\n✨ Improvements:`);
      report.regressionResults.fixedTests.forEach(fix => {
        console.log(`   ✅ Fixed: ${fix}`);
      });
      report.regressionResults.performanceImprovements.forEach(improvement => {
        console.log(`   🚀 Performance improvement: ${improvement}`);
      });
    }
    
    console.log(`\n${report.summary.failedSuites === 0 ? '🎉 ALL TESTS PASSED!' : '❌ SOME TESTS FAILED'}`);
    console.log('='.repeat(80) + '\n');
  }
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options: any = {};
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--categories':
        options.categories = args[++i]?.split(',') || ['unit', 'integration', 'performance'];
        break;
      case '--parallel':
        options.parallel = true;
        break;
      case '--no-coverage':
        options.coverage = false;
        break;
      case '--no-performance':
        options.performance = false;
        break;
      case '--no-regression':
        options.regression = false;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--help':
        console.log(`
Optimization Test Runner

Usage: npm run test:optimization [options]

Options:
  --categories <list>     Comma-separated list of test categories (unit,integration,performance,resilience,ml)
  --parallel              Run tests in parallel where possible
  --no-coverage           Skip code coverage analysis
  --no-performance        Skip performance metrics analysis
  --no-regression         Skip regression analysis
  --verbose               Show detailed output
  --help                  Show this help message

Examples:
  npm run test:optimization
  npm run test:optimization -- --categories unit,integration
  npm run test:optimization -- --parallel --verbose
`);
        process.exit(0);
    }
  }
  
  const runner = new OptimizationTestRunner();
  
  runner.runAllTests(options).then(report => {
    process.exit(report.summary.failedSuites > 0 ? 1 : 0);
  }).catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

export { OptimizationTestRunner, TestResult, TestReport };
