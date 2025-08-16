#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { createWriteStream } from 'fs';
import { TestReport } from './run-optimization-tests';

interface ReportGenerator {
  generateHTML(report: TestReport): Promise<string>;
  generateMarkdown(report: TestReport): Promise<string>;
  generateJSON(report: TestReport): Promise<string>;
  generateCSV(report: TestReport): Promise<string>;
}

interface TrendAnalysis {
  testSuccessRate: number[];
  performanceMetrics: {
    memoryUsage: number[];
    executionTime: number[];
    cacheEfficiency: number[];
  };
  coverageMetrics: {
    lines: number[];
    functions: number[];
    branches: number[];
  };
  regressionTrends: {
    newFailures: number[];
    performanceRegressions: number[];
  };
}

class OptimizationTestReportGenerator implements ReportGenerator {
  private projectRoot: string;
  private templateDir: string;

  constructor() {
    this.projectRoot = process.cwd();
    this.templateDir = path.join(__dirname, '..', 'templates');
  }

  async generateComprehensiveReport(
    report: TestReport,
    format: 'html' | 'markdown' | 'json' | 'csv' | 'all' = 'all'
  ): Promise<{ [key: string]: string }> {
    const results: { [key: string]: string } = {};

    if (format === 'all' || format === 'html') {
      results.html = await this.generateHTML(report);
    }
    if (format === 'all' || format === 'markdown') {
      results.markdown = await this.generateMarkdown(report);
    }
    if (format === 'all' || format === 'json') {
      results.json = await this.generateJSON(report);
    }
    if (format === 'all' || format === 'csv') {
      results.csv = await this.generateCSV(report);
    }

    return results;
  }

  async generateHTML(report: TestReport): Promise<string> {
    const trendAnalysis = await this.analyzeTrends();
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Optimization Test Report - ${report.timestamp.toISOString()}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f8f9fa;
            color: #333;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e9ecef;
        }
        .header h1 {
            color: #2c3e50;
            margin-bottom: 10px;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        .summary-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #007bff;
            text-align: center;
        }
        .summary-card.success {
            border-left-color: #28a745;
        }
        .summary-card.warning {
            border-left-color: #ffc107;
        }
        .summary-card.danger {
            border-left-color: #dc3545;
        }
        .summary-card h3 {
            margin: 0 0 10px 0;
            color: #495057;
        }
        .summary-card .value {
            font-size: 2em;
            font-weight: bold;
            color: #2c3e50;
        }
        .chart-container {
            margin: 30px 0;
            height: 400px;
        }
        .test-suites {
            margin-top: 40px;
        }
        .test-suite {
            margin-bottom: 20px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
            border-left: 4px solid #6c757d;
        }
        .test-suite.passed {
            border-left-color: #28a745;
        }
        .test-suite.failed {
            border-left-color: #dc3545;
        }
        .performance-section {
            margin-top: 40px;
            padding: 20px;
            background: #e3f2fd;
            border-radius: 8px;
        }
        .regression-section {
            margin-top: 40px;
            padding: 20px;
            background: #fff3e0;
            border-radius: 8px;
        }
        .badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.875em;
            font-weight: 500;
        }
        .badge.success {
            background-color: #d4edda;
            color: #155724;
        }
        .badge.danger {
            background-color: #f8d7da;
            color: #721c24;
        }
        .badge.warning {
            background-color: #fff3cd;
            color: #856404;
        }
        .trend-charts {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 30px;
            margin-top: 30px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #dee2e6;
        }
        th {
            background-color: #f8f9fa;
            font-weight: 600;
        }
        .error-details {
            background: #f8d7da;
            padding: 10px;
            border-radius: 4px;
            margin-top: 10px;
            font-family: monospace;
            font-size: 0.875em;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Optimization Test Report</h1>
            <p>Generated on ${report.timestamp.toLocaleString()}</p>
            <p>Total Duration: ${(report.totalDuration / 1000).toFixed(2)} seconds</p>
        </div>

        <div class="summary-grid">
            <div class="summary-card ${report.summary.failedSuites === 0 ? 'success' : 'danger'}">
                <h3>Test Suites</h3>
                <div class="value">${report.summary.passedSuites}/${report.summary.totalSuites}</div>
                <p>Passed</p>
            </div>
            <div class="summary-card ${report.summary.failedTests === 0 ? 'success' : 'danger'}">
                <h3>Individual Tests</h3>
                <div class="value">${report.summary.passedTests}/${report.summary.totalTests}</div>
                <p>Passed</p>
            </div>
            ${report.summary.overallCoverage ? `
            <div class="summary-card ${report.summary.overallCoverage.lines > 80 ? 'success' : 'warning'}">
                <h3>Code Coverage</h3>
                <div class="value">${report.summary.overallCoverage.lines.toFixed(1)}%</div>
                <p>Lines Covered</p>
            </div>
            ` : ''}
            <div class="summary-card ${this.getPerformanceStatus(report.performanceMetrics)}">
                <h3>Performance Targets</h3>
                <div class="value">${this.countMetTargets(report.performanceMetrics)}/4</div>
                <p>Targets Met</p>
            </div>
        </div>

        <div class="performance-section">
            <h2>🎯 Performance Validation Results</h2>
            <div class="summary-grid">
                <div class="badge ${report.performanceMetrics.memoryReductionAchieved ? 'success' : 'danger'}">
                    Memory Reduction (50% target): ${report.performanceMetrics.memoryReductionAchieved ? '✅ Met' : '❌ Not Met'}
                </div>
                <div class="badge ${report.performanceMetrics.latencyTargetsMet ? 'success' : 'danger'}">
                    Latency Reduction (90% target): ${report.performanceMetrics.latencyTargetsMet ? '✅ Met' : '❌ Not Met'}
                </div>
                <div class="badge ${report.performanceMetrics.throughputTargetsMet ? 'success' : 'danger'}">
                    Throughput Targets: ${report.performanceMetrics.throughputTargetsMet ? '✅ Met' : '❌ Not Met'}
                </div>
                <div class="badge ${report.performanceMetrics.reliabilityTargetsMet ? 'success' : 'danger'}">
                    Reliability Targets: ${report.performanceMetrics.reliabilityTargetsMet ? '✅ Met' : '❌ Not Met'}
                </div>
            </div>
        </div>

        ${this.generateRegressionSection(report.regressionResults)}

        <div class="trend-charts">
            <div class="chart-container">
                <h3>Test Success Rate Trend</h3>
                <canvas id="successRateChart"></canvas>
            </div>
            <div class="chart-container">
                <h3>Performance Trends</h3>
                <canvas id="performanceChart"></canvas>
            </div>
            <div class="chart-container">
                <h3>Coverage Trends</h3>
                <canvas id="coverageChart"></canvas>
            </div>
        </div>

        <div class="test-suites">
            <h2>📋 Test Suite Details</h2>
            ${report.suites.map(suite => this.generateSuiteHTML(suite)).join('')}
        </div>

        ${this.generateDetailedMetricsTable(report)}
    </div>

    <script>
        ${this.generateChartScripts(trendAnalysis)}
    </script>
</body>
</html>
    `.trim();
  }

  async generateMarkdown(report: TestReport): Promise<string> {
    const successRate = (report.summary.passedTests / report.summary.totalTests * 100).toFixed(1);
    const suiteSuccessRate = (report.summary.passedSuites / report.summary.totalSuites * 100).toFixed(1);
    
    return `
# 🚀 Optimization Test Report

**Generated:** ${report.timestamp.toISOString()}  
**Duration:** ${(report.totalDuration / 1000).toFixed(2)} seconds

## 📈 Summary

| Metric | Value | Status |
|--------|-------|--------|
| Test Suites | ${report.summary.passedSuites}/${report.summary.totalSuites} (${suiteSuccessRate}%) | ${report.summary.failedSuites === 0 ? '✅' : '❌'} |
| Individual Tests | ${report.summary.passedTests}/${report.summary.totalTests} (${successRate}%) | ${report.summary.failedTests === 0 ? '✅' : '❌'} |
${report.summary.overallCoverage ? `| Code Coverage | ${report.summary.overallCoverage.lines.toFixed(1)}% | ${report.summary.overallCoverage.lines > 80 ? '✅' : '⚠️'} |` : ''}

## 🎯 Performance Validation

| Target | Status | Achievement |
|--------|--------|-------------|
| Memory Reduction (50%) | ${report.performanceMetrics.memoryReductionAchieved ? '✅ Met' : '❌ Not Met'} | ${report.performanceMetrics.memoryReductionAchieved ? 'Target achieved' : 'Needs improvement'} |
| Latency Reduction (90%) | ${report.performanceMetrics.latencyTargetsMet ? '✅ Met' : '❌ Not Met'} | ${report.performanceMetrics.latencyTargetsMet ? 'Target achieved' : 'Needs improvement'} |
| Throughput Targets | ${report.performanceMetrics.throughputTargetsMet ? '✅ Met' : '❌ Not Met'} | ${report.performanceMetrics.throughputTargetsMet ? 'Target achieved' : 'Needs improvement'} |
| Reliability Targets | ${report.performanceMetrics.reliabilityTargetsMet ? '✅ Met' : '❌ Not Met'} | ${report.performanceMetrics.reliabilityTargetsMet ? 'Target achieved' : 'Needs improvement'} |

## 🔍 Regression Analysis

${this.generateRegressionMarkdown(report.regressionResults)}

## 📋 Test Suite Results

${report.suites.map(suite => this.generateSuiteMarkdown(suite)).join('\n\n')}

${report.summary.overallCoverage ? `
## 📈 Code Coverage Details

| Type | Coverage |
|------|----------|
| Lines | ${report.summary.overallCoverage.lines.toFixed(1)}% |
| Functions | ${report.summary.overallCoverage.functions.toFixed(1)}% |
| Branches | ${report.summary.overallCoverage.branches.toFixed(1)}% |
| Statements | ${report.summary.overallCoverage.statements.toFixed(1)}% |
` : ''}

## ⚙️ Detailed Metrics

${this.generateDetailedMarkdownMetrics(report)}

---

**Report generated by Optimization Test Suite v1.0.0**
    `.trim();
  }

  async generateJSON(report: TestReport): Promise<string> {
    const trendAnalysis = await this.analyzeTrends();
    
    const enhancedReport = {
      ...report,
      metadata: {
        version: '1.0.0',
        generator: 'OptimizationTestReportGenerator',
        reportTypes: ['summary', 'performance', 'regression', 'trends'],
        validationCriteria: {
          memoryReductionTarget: 50,
          latencyReductionTarget: 90,
          minimumCoverage: 80,
          reliabilityTarget: 99.5
        }
      },
      trendAnalysis,
      recommendations: this.generateRecommendations(report)
    };
    
    return JSON.stringify(enhancedReport, null, 2);
  }

  async generateCSV(report: TestReport): Promise<string> {
    const rows = [
      ['Suite Name', 'Status', 'Duration (ms)', 'Tests Total', 'Tests Passed', 'Tests Failed', 'Coverage Lines', 'Coverage Functions', 'Memory Usage (bytes)', 'Errors']
    ];
    
    for (const suite of report.suites) {
      rows.push([
        suite.suite,
        suite.passed ? 'PASSED' : 'FAILED',
        suite.duration.toFixed(0),
        suite.tests.total.toString(),
        suite.tests.passed.toString(),
        suite.tests.failed.toString(),
        suite.coverage?.lines?.toFixed(1) || 'N/A',
        suite.coverage?.functions?.toFixed(1) || 'N/A',
        suite.performance?.memoryUsage?.toString() || 'N/A',
        suite.errors?.join('; ') || 'None'
      ]);
    }
    
    return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  }

  private async analyzeTrends(): Promise<TrendAnalysis> {
    try {
      const resultsDir = path.join(this.projectRoot, 'test-results');
      const files = await fs.readdir(resultsDir);
      const reportFiles = files.filter(f => f.startsWith('results-') && f.endsWith('.json'));
      
      const historicalReports: TestReport[] = [];
      
      for (const file of reportFiles.slice(-10)) { // Last 10 reports
        try {
          const content = await fs.readFile(path.join(resultsDir, file), 'utf-8');
          const report = JSON.parse(content);
          historicalReports.push(report);
        } catch (error) {
          // Skip invalid files
        }
      }
      
      return {
        testSuccessRate: historicalReports.map(r => r.summary.passedTests / r.summary.totalTests * 100),
        performanceMetrics: {
          memoryUsage: historicalReports.map(r => 
            r.suites.reduce((sum, s) => sum + (s.performance?.memoryUsage || 0), 0) / r.suites.length
          ),
          executionTime: historicalReports.map(r => r.totalDuration),
          cacheEfficiency: historicalReports.map(r => 
            r.suites.filter(s => s.suite.includes('Cache')).length > 0 ? 85 : 0 // Simplified
          )
        },
        coverageMetrics: {
          lines: historicalReports.map(r => r.summary.overallCoverage?.lines || 0),
          functions: historicalReports.map(r => r.summary.overallCoverage?.functions || 0),
          branches: historicalReports.map(r => r.summary.overallCoverage?.branches || 0)
        },
        regressionTrends: {
          newFailures: historicalReports.map(r => r.regressionResults.newFailures.length),
          performanceRegressions: historicalReports.map(r => r.regressionResults.performanceRegressions.length)
        }
      };
    } catch (error) {
      // Return empty trends if no historical data
      return {
        testSuccessRate: [],
        performanceMetrics: {
          memoryUsage: [],
          executionTime: [],
          cacheEfficiency: []
        },
        coverageMetrics: {
          lines: [],
          functions: [],
          branches: []
        },
        regressionTrends: {
          newFailures: [],
          performanceRegressions: []
        }
      };
    }
  }

  private generateRecommendations(report: TestReport): string[] {
    const recommendations: string[] = [];
    
    if (report.summary.failedSuites > 0) {
      recommendations.push('Address failing test suites before deploying optimization improvements');
    }
    
    if (report.summary.overallCoverage && report.summary.overallCoverage.lines < 80) {
      recommendations.push('Increase test coverage to meet 80% minimum threshold');
    }
    
    if (!report.performanceMetrics.memoryReductionAchieved) {
      recommendations.push('Optimize memory usage algorithms to achieve 50% reduction target');
    }
    
    if (!report.performanceMetrics.latencyTargetsMet) {
      recommendations.push('Improve caching strategies and edge optimization to meet 90% latency reduction');
    }
    
    if (report.regressionResults.newFailures.length > 0) {
      recommendations.push('Investigate and fix regression failures: ' + report.regressionResults.newFailures.join(', '));
    }
    
    if (report.regressionResults.performanceRegressions.length > 0) {
      recommendations.push('Address performance regressions to maintain optimization targets');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('All optimization targets met! Consider raising performance benchmarks.');
    }
    
    return recommendations;
  }

  private getPerformanceStatus(metrics: TestReport['performanceMetrics']): string {
    const metCount = this.countMetTargets(metrics);
    if (metCount === 4) return 'success';
    if (metCount >= 2) return 'warning';
    return 'danger';
  }

  private countMetTargets(metrics: TestReport['performanceMetrics']): number {
    return Object.values(metrics).filter(Boolean).length;
  }

  private generateRegressionSection(regressionResults: TestReport['regressionResults']): string {
    if (regressionResults.newFailures.length === 0 && 
        regressionResults.performanceRegressions.length === 0 &&
        regressionResults.fixedTests.length === 0 &&
        regressionResults.performanceImprovements.length === 0) {
      return '<div class="regression-section"><h2>🔍 Regression Analysis</h2><p>No regressions or improvements detected.</p></div>';
    }
    
    return `
        <div class="regression-section">
            <h2>🔍 Regression Analysis</h2>
            ${regressionResults.newFailures.length > 0 ? `
                <h3>❌ New Failures</h3>
                <ul>
                    ${regressionResults.newFailures.map(f => `<li>${f}</li>`).join('')}
                </ul>
            ` : ''}
            ${regressionResults.performanceRegressions.length > 0 ? `
                <h3>🐌 Performance Regressions</h3>
                <ul>
                    ${regressionResults.performanceRegressions.map(r => `<li>${r}</li>`).join('')}
                </ul>
            ` : ''}
            ${regressionResults.fixedTests.length > 0 ? `
                <h3>✅ Fixed Tests</h3>
                <ul>
                    ${regressionResults.fixedTests.map(f => `<li>${f}</li>`).join('')}
                </ul>
            ` : ''}
            ${regressionResults.performanceImprovements.length > 0 ? `
                <h3>🚀 Performance Improvements</h3>
                <ul>
                    ${regressionResults.performanceImprovements.map(i => `<li>${i}</li>`).join('')}
                </ul>
            ` : ''}
        </div>
    `;
  }

  private generateSuiteHTML(suite: any): string {
    return `
        <div class="test-suite ${suite.passed ? 'passed' : 'failed'}">
            <h3>${suite.suite} ${suite.passed ? '✅' : '❌'}</h3>
            <p><strong>Duration:</strong> ${suite.duration.toFixed(0)}ms</p>
            <p><strong>Tests:</strong> ${suite.tests.passed}/${suite.tests.total} passed</p>
            ${suite.coverage ? `
                <p><strong>Coverage:</strong> Lines ${suite.coverage.lines.toFixed(1)}%, Functions ${suite.coverage.functions.toFixed(1)}%</p>
            ` : ''}
            ${suite.performance ? `
                <p><strong>Memory Usage:</strong> ${(suite.performance.memoryUsage / 1024 / 1024).toFixed(2)}MB</p>
            ` : ''}
            ${suite.errors ? `
                <div class="error-details">
                    <strong>Errors:</strong><br>
                    ${suite.errors.map((e: string) => `<div>${e}</div>`).join('')}
                </div>
            ` : ''}
        </div>
    `;
  }

  private generateRegressionMarkdown(regressionResults: TestReport['regressionResults']): string {
    const sections = [];
    
    if (regressionResults.newFailures.length > 0) {
      sections.push(`### ❌ New Failures\n\n${regressionResults.newFailures.map(f => `- ${f}`).join('\n')}`);
    }
    
    if (regressionResults.performanceRegressions.length > 0) {
      sections.push(`### 🐌 Performance Regressions\n\n${regressionResults.performanceRegressions.map(r => `- ${r}`).join('\n')}`);
    }
    
    if (regressionResults.fixedTests.length > 0) {
      sections.push(`### ✅ Fixed Tests\n\n${regressionResults.fixedTests.map(f => `- ${f}`).join('\n')}`);
    }
    
    if (regressionResults.performanceImprovements.length > 0) {
      sections.push(`### 🚀 Performance Improvements\n\n${regressionResults.performanceImprovements.map(i => `- ${i}`).join('\n')}`);
    }
    
    return sections.length > 0 ? sections.join('\n\n') : 'No regressions or improvements detected.';
  }

  private generateSuiteMarkdown(suite: any): string {
    return `
### ${suite.suite} ${suite.passed ? '✅' : '❌'}

- **Duration:** ${suite.duration.toFixed(0)}ms
- **Tests:** ${suite.tests.passed}/${suite.tests.total} passed
${suite.coverage ? `- **Coverage:** Lines ${suite.coverage.lines.toFixed(1)}%, Functions ${suite.coverage.functions.toFixed(1)}%` : ''}
${suite.performance ? `- **Memory Usage:** ${(suite.performance.memoryUsage / 1024 / 1024).toFixed(2)}MB` : ''}
${suite.errors ? `\n**Errors:**\n\`\`\`\n${suite.errors.join('\n')}\n\`\`\`` : ''}
    `.trim();
  }

  private generateDetailedMetricsTable(report: TestReport): string {
    return `
        <table>
            <thead>
                <tr>
                    <th>Suite</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>Tests</th>
                    <th>Coverage</th>
                    <th>Memory</th>
                </tr>
            </thead>
            <tbody>
                ${report.suites.map(suite => `
                    <tr>
                        <td>${suite.suite}</td>
                        <td><span class="badge ${suite.passed ? 'success' : 'danger'}">${suite.passed ? 'PASSED' : 'FAILED'}</span></td>
                        <td>${suite.duration.toFixed(0)}ms</td>
                        <td>${suite.tests.passed}/${suite.tests.total}</td>
                        <td>${suite.coverage ? `${suite.coverage.lines.toFixed(1)}%` : 'N/A'}</td>
                        <td>${suite.performance ? `${(suite.performance.memoryUsage / 1024 / 1024).toFixed(2)}MB` : 'N/A'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
  }

  private generateDetailedMarkdownMetrics(report: TestReport): string {
    return `
| Suite | Status | Duration | Tests | Coverage | Memory |
|-------|--------|----------|-------|----------|--------|
${report.suites.map(suite => 
  `| ${suite.suite} | ${suite.passed ? '✅' : '❌'} | ${suite.duration.toFixed(0)}ms | ${suite.tests.passed}/${suite.tests.total} | ${suite.coverage ? `${suite.coverage.lines.toFixed(1)}%` : 'N/A'} | ${suite.performance ? `${(suite.performance.memoryUsage / 1024 / 1024).toFixed(2)}MB` : 'N/A'} |`
).join('\n')}
    `;
  }

  private generateChartScripts(trendAnalysis: TrendAnalysis): string {
    return `
        // Success Rate Trend Chart
        const successRateCtx = document.getElementById('successRateChart').getContext('2d');
        new Chart(successRateCtx, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(Array.from({length: trendAnalysis.testSuccessRate.length}, (_, i) => `Run ${i + 1}`))},
                datasets: [{
                    label: 'Success Rate (%)',
                    data: ${JSON.stringify(trendAnalysis.testSuccessRate)},
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });

        // Performance Trends Chart
        const performanceCtx = document.getElementById('performanceChart').getContext('2d');
        new Chart(performanceCtx, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(Array.from({length: trendAnalysis.performanceMetrics.executionTime.length}, (_, i) => `Run ${i + 1}`))},
                datasets: [{
                    label: 'Execution Time (ms)',
                    data: ${JSON.stringify(trendAnalysis.performanceMetrics.executionTime)},
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    yAxisID: 'y'
                }, {
                    label: 'Memory Usage (MB)',
                    data: ${JSON.stringify(trendAnalysis.performanceMetrics.memoryUsage.map(m => m / 1024 / 1024))},
                    borderColor: 'rgb(54, 162, 235)',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    yAxisID: 'y1'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: {
                            drawOnChartArea: false,
                        },
                    }
                }
            }
        });

        // Coverage Trends Chart
        const coverageCtx = document.getElementById('coverageChart').getContext('2d');
        new Chart(coverageCtx, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(Array.from({length: trendAnalysis.coverageMetrics.lines.length}, (_, i) => `Run ${i + 1}`))},
                datasets: [{
                    label: 'Lines',
                    data: ${JSON.stringify(trendAnalysis.coverageMetrics.lines)},
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)'
                }, {
                    label: 'Functions',
                    data: ${JSON.stringify(trendAnalysis.coverageMetrics.functions)},
                    borderColor: 'rgb(255, 206, 86)',
                    backgroundColor: 'rgba(255, 206, 86, 0.2)'
                }, {
                    label: 'Branches',
                    data: ${JSON.stringify(trendAnalysis.coverageMetrics.branches)},
                    borderColor: 'rgb(153, 102, 255)',
                    backgroundColor: 'rgba(153, 102, 255, 0.2)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    `;
  }

  async saveReports(
    reports: { [key: string]: string },
    outputDir: string = path.join(this.projectRoot, 'test-reports')
  ): Promise<void> {
    await fs.mkdir(outputDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    for (const [format, content] of Object.entries(reports)) {
      const filename = `optimization-test-report-${timestamp}.${format}`;
      const filepath = path.join(outputDir, filename);
      await fs.writeFile(filepath, content);
      console.log(`📄 ${format.toUpperCase()} report saved: ${filepath}`);
    }
    
    // Also save latest versions
    for (const [format, content] of Object.entries(reports)) {
      const filename = `latest-report.${format}`;
      const filepath = path.join(outputDir, filename);
      await fs.writeFile(filepath, content);
    }
  }
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: npm run generate-report <test-results.json> [format]');
    console.error('Formats: html, markdown, json, csv, all (default)');
    process.exit(1);
  }
  
  const reportPath = args[0];
  const format = (args[1] || 'all') as 'html' | 'markdown' | 'json' | 'csv' | 'all';
  
  (async () => {
    try {
      const reportData = JSON.parse(await fs.readFile(reportPath, 'utf-8'));
      const generator = new OptimizationTestReportGenerator();
      
      console.log('📄 Generating test reports...');
      const reports = await generator.generateComprehensiveReport(reportData, format);
      
      await generator.saveReports(reports);
      
      console.log('✅ Reports generated successfully!');
    } catch (error) {
      console.error('❌ Failed to generate reports:', error);
      process.exit(1);
    }
  })();
}

export { OptimizationTestReportGenerator, ReportGenerator, TrendAnalysis };
