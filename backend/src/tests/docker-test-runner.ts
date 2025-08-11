#!/usr/bin/env node

import { spawn } from 'child_process';
import chalk from 'chalk';
import path from 'path';

interface DockerTestSuite {
  name: string;
  description: string;
  file: string;
  timeout: number;
  priority: 'high' | 'medium' | 'low';
}

class DockerTestRunner {
  private testSuites: DockerTestSuite[] = [
    {
      name: 'Docker Integration Tests',
      description: 'Complete system verification with all services',
      file: 'integration/docker-integration.test.ts',
      timeout: 600000, // 10 minutes
      priority: 'high'
    },
    {
      name: 'Performance Baseline Tests',
      description: 'Establish performance baselines for Docker deployment',
      file: 'integration/docker-performance-baseline.test.ts',
      timeout: 900000, // 15 minutes
      priority: 'medium'
    },
    {
      name: 'Existing Integration Tests',
      description: 'Run existing integration test suite',
      file: 'integration/integration-test-runner.ts',
      timeout: 300000, // 5 minutes
      priority: 'high'
    }
  ];

  private results: Array<{
    suite: string;
    passed: boolean;
    duration: number;
    error?: string;
  }> = [];

  constructor(private verbose: boolean = false) {}

  async runAllTests(): Promise<boolean> {
    console.log(chalk.blue.bold('🐳 Docker Integration Test Runner'));
    console.log(chalk.gray('Testing complete Docker deployment...\n'));

    // Check Docker environment
    const dockerReady = await this.checkDockerEnvironment();
    if (!dockerReady) {
      console.error(chalk.red('❌ Docker environment not ready'));
      return false;
    }

    // Run test suites in order of priority
    const sortedSuites = this.testSuites.sort((a, b) => {
      const priorities = { high: 3, medium: 2, low: 1 };
      return priorities[b.priority] - priorities[a.priority];
    });

    for (const suite of sortedSuites) {
      await this.runTestSuite(suite);
    }

    // Generate report
    return this.generateReport();
  }

  private async checkDockerEnvironment(): Promise<boolean> {
    console.log(chalk.yellow('🔍 Checking Docker environment...'));

    try {
      // Check if Docker is running
      const dockerCheck = await this.executeCommand('docker', ['info'], 10000);
      if (!dockerCheck.success) {
        console.error(chalk.red('❌ Docker is not running'));
        return false;
      }

      // Check if required containers are running
      const requiredContainers = [
        'prompt-frontend',
        'prompt-backend',
        'prompt-postgres',
        'prompt-redis',
        'prompt-ollama'
      ];

      for (const container of requiredContainers) {
        const containerCheck = await this.executeCommand('docker', [
          'inspect',
          '--format={{.State.Running}}',
          container
        ], 5000);

        if (!containerCheck.success || containerCheck.output.trim() !== 'true') {
          console.warn(chalk.yellow(`⚠️  Container ${container} is not running`));
          
          // Try to start the container
          console.log(chalk.blue(`🔄 Attempting to start ${container}...`));
          const startResult = await this.executeCommand('docker', ['start', container], 30000);
          
          if (!startResult.success) {
            console.error(chalk.red(`❌ Failed to start ${container}`));
            return false;
          }
          
          // Wait for container to be ready
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }

      console.log(chalk.green('✅ Docker environment ready'));
      return true;
    } catch (error) {
      console.error(chalk.red('❌ Docker environment check failed:'), error.message);
      return false;
    }
  }

  private async runTestSuite(suite: DockerTestSuite): Promise<void> {
    console.log(chalk.blue.bold(`\n🧪 ${suite.name}`));
    console.log(chalk.gray(`   ${suite.description}`));
    console.log(chalk.gray(`   Timeout: ${suite.timeout / 1000}s`));

    const startTime = Date.now();
    const testPath = path.join(__dirname, suite.file);

    try {
      const result = await this.executeCommand('npx', [
        'mocha',
        testPath,
        '--require',
        'ts-node/register',
        '--timeout',
        suite.timeout.toString(),
        '--bail'
      ], suite.timeout + 10000);

      const duration = Date.now() - startTime;

      if (result.success) {
        console.log(chalk.green(`   ✅ Passed (${duration}ms)`));
        this.results.push({
          suite: suite.name,
          passed: true,
          duration
        });
      } else {
        console.log(chalk.red(`   ❌ Failed (${duration}ms)`));
        if (this.verbose && result.error) {
          console.log(chalk.red(`   Error: ${result.error}`));
        }
        this.results.push({
          suite: suite.name,
          passed: false,
          duration,
          error: result.error
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(chalk.red(`   ❌ Error (${duration}ms)`));
      console.log(chalk.red(`   ${error.message}`));
      
      this.results.push({
        suite: suite.name,
        passed: false,
        duration,
        error: error.message
      });
    }
  }

  private async executeCommand(
    command: string,
    args: string[],
    timeout: number
  ): Promise<{ success: boolean; output: string; error: string }> {
    return new Promise((resolve) => {
      const child = spawn(command, args, {
        stdio: 'pipe',
        cwd: path.join(__dirname, '../../..')
      });

      let output = '';
      let error = '';

      child.stdout?.on('data', (data) => {
        output += data.toString();
        if (this.verbose) {
          process.stdout.write(data);
        }
      });

      child.stderr?.on('data', (data) => {
        error += data.toString();
        if (this.verbose) {
          process.stderr.write(data);
        }
      });

      child.on('close', (code) => {
        resolve({
          success: code === 0,
          output,
          error
        });
      });

      // Timeout handling
      const timer = setTimeout(() => {
        child.kill();
        resolve({
          success: false,
          output,
          error: `Command timed out after ${timeout}ms`
        });
      }, timeout);

      child.on('close', () => {
        clearTimeout(timer);
      });
    });
  }

  private generateReport(): boolean {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;
    const successRate = (passed / total) * 100;

    console.log(chalk.blue.bold('\n📊 Docker Test Results Summary'));
    console.log(chalk.blue('='.repeat(50)));
    console.log(chalk.white(`Total Test Suites: ${total}`));
    console.log(chalk.green(`Passed: ${passed}`));
    console.log(chalk.red(`Failed: ${failed}`));
    console.log(chalk.yellow(`Success Rate: ${successRate.toFixed(1)}%`));

    // Individual results
    console.log(chalk.blue.bold('\n📋 Test Suite Results'));
    this.results.forEach((result, index) => {
      const status = result.passed ? chalk.green('✅ PASSED') : chalk.red('❌ FAILED');
      console.log(`${index + 1}. ${result.suite}: ${status} (${result.duration}ms)`);
      
      if (!result.passed && result.error && this.verbose) {
        console.log(chalk.gray(`   Error: ${result.error.substring(0, 100)}...`));
      }
    });

    // Recommendations
    console.log(chalk.blue.bold('\n💡 Recommendations'));
    if (failed === 0) {
      console.log(chalk.green('🎉 All Docker integration tests passed!'));
      console.log(chalk.green('🚀 System is ready for production deployment'));
    } else {
      console.log(chalk.yellow(`⚠️  ${failed} test suite(s) failed`));
      console.log(chalk.yellow('🔧 Review failed tests and fix issues before deployment'));
      
      if (successRate < 70) {
        console.log(chalk.red('🚨 Success rate below 70% - investigate system stability'));
      }
    }

    // Save detailed report
    this.saveDetailedReport();

    return failed === 0;
  }

  private saveDetailedReport(): void {
    const report = {
      timestamp: new Date().toISOString(),
      environment: 'docker',
      summary: {
        total: this.results.length,
        passed: this.results.filter(r => r.passed).length,
        failed: this.results.filter(r => !r.passed).length,
        successRate: (this.results.filter(r => r.passed).length / this.results.length) * 100
      },
      results: this.results,
      recommendations: this.generateRecommendations()
    };

    const reportPath = path.join(__dirname, '../../docker-integration-report.json');
    require('fs').writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(chalk.gray(`\n📄 Detailed report saved to: ${reportPath}`));
  }

  private generateRecommendations(): string[] {
    const recommendations = [];
    
    const failedSuites = this.results.filter(r => !r.passed);
    if (failedSuites.length > 0) {
      recommendations.push(`Fix ${failedSuites.length} failed test suite(s)`);
    }

    const slowSuites = this.results.filter(r => r.duration > 300000); // > 5 minutes
    if (slowSuites.length > 0) {
      recommendations.push(`Optimize ${slowSuites.length} slow test suite(s)`);
    }

    const successRate = (this.results.filter(r => r.passed).length / this.results.length) * 100;
    if (successRate < 80) {
      recommendations.push('Success rate below 80% - investigate system stability');
    }

    if (recommendations.length === 0) {
      recommendations.push('All Docker integration tests passed - system ready for deployment');
    }

    return recommendations;
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v');
  
  const runner = new DockerTestRunner(verbose);
  
  runner.runAllTests().then((success) => {
    const exitCode = success ? 0 : 1;
    console.log(chalk.gray(`\n🏁 Docker integration testing completed with exit code ${exitCode}`));
    process.exit(exitCode);
  }).catch((error) => {
    console.error(chalk.red.bold('❌ Docker integration testing failed:'), error);
    process.exit(1);
  });
}

export { DockerTestRunner };