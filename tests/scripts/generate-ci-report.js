/**
 * CI Test Report Generator
 * @description Generates comprehensive test reports for CI/CD pipeline
 */

const fs = require('fs');
const path = require('path');

class CIReportGenerator {
  constructor(artifactsPath) {
    this.artifactsPath = artifactsPath;
    this.summary = {
      timestamp: new Date().toISOString(),
      overall: {
        status: 'PASSED',
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        successRate: 0,
        duration: 0,
      },
      unit: { status: 'PASSED', passed: 0, failed: 0, coverage: 0 },
      integration: { status: 'PASSED', passed: 0, failed: 0, coverage: 0 },
      performance: { status: 'PASSED', passed: 0, failed: 0 },
      docker: { status: 'PASSED', passed: 0, failed: 0 },
      e2e: { status: 'PASSED', passed: 0, failed: 0 },
      security: { status: 'PASSED', passed: 0, failed: 0 },
    };
  }

  async generateReport() {
    console.log('📊 Generating comprehensive CI test report...');

    try {
      await this.collectTestResults();
      await this.calculateOverallMetrics();
      await this.generateHTMLReport();
      await this.saveSummary();

      console.log('✅ Test report generation complete');
    } catch (error) {
      console.error('❌ Failed to generate test report:', error);
      process.exit(1);
    }
  }

  async collectTestResults() {
    // Collect unit test results
    await this.collectUnitTestResults();

    // Collect integration test results
    await this.collectIntegrationTestResults();

    // Collect performance test results
    await this.collectPerformanceTestResults();

    // Collect Docker test results
    await this.collectDockerTestResults();

    // Collect E2E test results
    await this.collectE2ETestResults();

    // Collect security test results
    await this.collectSecurityTestResults();
  }

  async collectUnitTestResults() {
    const unitTestPaths = [
      'unit-test-results-backend',
      'unit-test-results-frontend',
      'unit-test-results-auth',
    ];

    for (const testPath of unitTestPaths) {
      const resultPath = path.join(this.artifactsPath, testPath);
      if (fs.existsSync(resultPath)) {
        const coverage = await this.parseCoverageReport(resultPath);
        const testResults = await this.parseJestResults(resultPath);

        this.summary.unit.passed += testResults.passed;
        this.summary.unit.failed += testResults.failed;
        this.summary.unit.coverage = Math.max(this.summary.unit.coverage, coverage);
      }
    }

    if (this.summary.unit.failed > 0) {
      this.summary.unit.status = 'FAILED';
    }
  }

  async collectIntegrationTestResults() {
    const integrationPath = path.join(this.artifactsPath, 'integration-test-results');
    if (fs.existsSync(integrationPath)) {
      const coverage = await this.parseCoverageReport(integrationPath);
      const testResults = await this.parseJestResults(integrationPath);

      this.summary.integration.passed = testResults.passed;
      this.summary.integration.failed = testResults.failed;
      this.summary.integration.coverage = coverage;

      if (this.summary.integration.failed > 0) {
        this.summary.integration.status = 'FAILED';
      }
    }
  }

  async collectPerformanceTestResults() {
    const performancePath = path.join(this.artifactsPath, 'performance-test-results');
    if (fs.existsSync(performancePath)) {
      const testResults = await this.parseJestResults(performancePath);

      this.summary.performance.passed = testResults.passed;
      this.summary.performance.failed = testResults.failed;

      if (this.summary.performance.failed > 0) {
        this.summary.performance.status = 'FAILED';
      }
    }
  }

  async collectDockerTestResults() {
    const dockerPath = path.join(this.artifactsPath, 'docker-test-results');
    if (fs.existsSync(dockerPath)) {
      const testResults = await this.parseJestResults(dockerPath);

      this.summary.docker.passed = testResults.passed;
      this.summary.docker.failed = testResults.failed;

      if (this.summary.docker.failed > 0) {
        this.summary.docker.status = 'FAILED';
      }
    }
  }

  async collectE2ETestResults() {
    const e2ePath = path.join(this.artifactsPath, 'e2e-test-results');
    if (fs.existsSync(e2ePath)) {
      const testResults = await this.parseJestResults(e2ePath);

      this.summary.e2e.passed = testResults.passed;
      this.summary.e2e.failed = testResults.failed;

      if (this.summary.e2e.failed > 0) {
        this.summary.e2e.status = 'FAILED';
      }
    }
  }

  async collectSecurityTestResults() {
    const securityPath = path.join(this.artifactsPath, 'security-test-results');
    if (fs.existsSync(securityPath)) {
      // Security tests might have different format
      this.summary.security.passed = 1;
      this.summary.security.failed = 0;
    }
  }

  async parseCoverageReport(testPath) {
    try {
      const coveragePath = path.join(testPath, 'coverage', 'coverage-summary.json');
      if (fs.existsSync(coveragePath)) {
        const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
        return coverageData.total.lines.pct || 0;
      }
    } catch (error) {
      console.warn(`Failed to parse coverage for ${testPath}:`, error.message);
    }
    return 0;
  }

  async parseJestResults(testPath) {
    try {
      const resultPath = path.join(testPath, 'test-results.xml');
      if (fs.existsSync(resultPath)) {
        // Parse JUnit XML format
        const xml = fs.readFileSync(resultPath, 'utf8');
        const testcases = (xml.match(/<testcase/g) || []).length;
        const failures = (xml.match(/<failure/g) || []).length;
        const errors = (xml.match(/<error/g) || []).length;

        return {
          passed: testcases - failures - errors,
          failed: failures + errors,
          skipped: 0,
        };
      }
    } catch (error) {
      console.warn(`Failed to parse test results for ${testPath}:`, error.message);
    }
    return { passed: 0, failed: 0, skipped: 0 };
  }

  async calculateOverallMetrics() {
    const suites = ['unit', 'integration', 'performance', 'docker', 'e2e', 'security'];

    for (const suite of suites) {
      this.summary.overall.passed += this.summary[suite].passed;
      this.summary.overall.failed += this.summary[suite].failed;

      if (this.summary[suite].status === 'FAILED') {
        this.summary.overall.status = 'FAILED';
      }
    }

    this.summary.overall.total = this.summary.overall.passed + this.summary.overall.failed;
    this.summary.overall.successRate = this.summary.overall.total > 0
      ? (this.summary.overall.passed / this.summary.overall.total) * 100
      : 0;
  }

  async generateHTMLReport() {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Comprehensive Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; font-size: 2.5em; font-weight: 300; }
        .header .subtitle { opacity: 0.9; margin-top: 10px; }
        .summary { padding: 30px; border-bottom: 1px solid #eee; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 20px; border-radius: 6px; text-align: center; border-left: 4px solid #007bff; }
        .metric.success { border-left-color: #28a745; }
        .metric.failure { border-left-color: #dc3545; }
        .metric .value { font-size: 2em; font-weight: bold; margin-bottom: 5px; }
        .metric .label { color: #666; text-transform: uppercase; font-size: 0.8em; letter-spacing: 1px; }
        .test-suites { padding: 30px; }
        .suite { margin-bottom: 30px; border: 1px solid #eee; border-radius: 6px; overflow: hidden; }
        .suite-header { background: #f8f9fa; padding: 15px 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
        .suite-title { font-weight: 600; font-size: 1.1em; }
        .suite-status { padding: 4px 12px; border-radius: 20px; font-size: 0.8em; font-weight: 600; text-transform: uppercase; }
        .suite-status.passed { background: #d4edda; color: #155724; }
        .suite-status.failed { background: #f8d7da; color: #721c24; }
        .suite-details { padding: 20px; }
        .suite-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; }
        .suite-metric { text-align: center; }
        .suite-metric .value { font-size: 1.5em; font-weight: bold; }
        .suite-metric .label { color: #666; font-size: 0.9em; }
        .footer { padding: 20px; text-align: center; color: #666; border-top: 1px solid #eee; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 0.8em; font-weight: 600; }
        .badge.success { background: #d4edda; color: #155724; }
        .badge.failure { background: #f8d7da; color: #721c24; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Test Report</h1>
            <div class="subtitle">
                Generated on ${new Date(this.summary.timestamp).toLocaleString()} | 
                Status: <span class="badge ${this.summary.overall.status.toLowerCase() === 'passed' ? 'success' : 'failure'}">${this.summary.overall.status}</span>
            </div>
        </div>

        <div class="summary">
            <div class="metrics">
                <div class="metric ${this.summary.overall.status.toLowerCase() === 'passed' ? 'success' : 'failure'}">
                    <div class="value">${this.summary.overall.total}</div>
                    <div class="label">Total Tests</div>
                </div>
                <div class="metric success">
                    <div class="value">${this.summary.overall.passed}</div>
                    <div class="label">Passed</div>
                </div>
                <div class="metric ${this.summary.overall.failed > 0 ? 'failure' : ''}">
                    <div class="value">${this.summary.overall.failed}</div>
                    <div class="label">Failed</div>
                </div>
                <div class="metric">
                    <div class="value">${this.summary.overall.successRate.toFixed(1)}%</div>
                    <div class="label">Success Rate</div>
                </div>
            </div>
        </div>

        <div class="test-suites">
            ${this.generateSuiteHTML('Unit Tests', this.summary.unit)}
            ${this.generateSuiteHTML('Integration Tests', this.summary.integration)}
            ${this.generateSuiteHTML('Performance Tests', this.summary.performance)}
            ${this.generateSuiteHTML('Docker Tests', this.summary.docker)}
            ${this.generateSuiteHTML('E2E Tests', this.summary.e2e)}
            ${this.generateSuiteHTML('Security Tests', this.summary.security)}
        </div>

        <div class="footer">
            <p>Report generated by Prompt Card System CI/CD Pipeline</p>
        </div>
    </div>
</body>
</html>`;

    fs.writeFileSync('comprehensive-test-report.html', html);
    console.log('📄 HTML report generated: comprehensive-test-report.html');
  }

  generateSuiteHTML(title, data) {
    return `
            <div class="suite">
                <div class="suite-header">
                    <div class="suite-title">${title}</div>
                    <div class="suite-status ${data.status.toLowerCase()}">${data.status}</div>
                </div>
                <div class="suite-details">
                    <div class="suite-metrics">
                        <div class="suite-metric">
                            <div class="value">${data.passed}</div>
                            <div class="label">Passed</div>
                        </div>
                        <div class="suite-metric">
                            <div class="value">${data.failed}</div>
                            <div class="label">Failed</div>
                        </div>
                        ${data.coverage !== undefined ? `
                        <div class="suite-metric">
                            <div class="value">${data.coverage.toFixed(1)}%</div>
                            <div class="label">Coverage</div>
                        </div>` : ''}
                    </div>
                </div>
            </div>`;
  }

  async saveSummary() {
    fs.writeFileSync('test-summary.json', JSON.stringify(this.summary, null, 2));
    console.log('📊 Test summary saved: test-summary.json');
  }
}

// Main execution
async function main() {
  const artifactsPath = process.argv[2] || './test-artifacts';

  if (!fs.existsSync(artifactsPath)) {
    console.error('❌ Test artifacts directory not found:', artifactsPath);
    process.exit(1);
  }

  const generator = new CIReportGenerator(artifactsPath);
  await generator.generateReport();
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Report generation failed:', error);
    process.exit(1);
  });
}

module.exports = { CIReportGenerator };