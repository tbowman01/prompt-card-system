const fs = require('fs')
const path = require('path')

// Test results processor for enhanced CI reporting
module.exports = function(results) {
  // Extract useful metrics from test results
  const testMetrics = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: results.numTotalTests,
      passedTests: results.numPassedTests,
      failedTests: results.numFailedTests,
      pendingTests: results.numPendingTests,
      todoTests: results.numTodoTests,
      totalTestSuites: results.numTotalTestSuites,
      passedTestSuites: results.numPassedTestSuites,
      failedTestSuites: results.numFailedTestSuites,
      pendingTestSuites: results.numPendingTestSuites,
    },
    performance: {
      totalTime: results.testResults.reduce((total, suite) => total + (suite.perfStats?.end || 0) - (suite.perfStats?.start || 0), 0),
      averageTime: results.numTotalTests > 0 ? results.testResults.reduce((total, suite) => total + (suite.perfStats?.end || 0) - (suite.perfStats?.start || 0), 0) / results.numTotalTests : 0,
      slowestSuites: results.testResults
        .map(suite => ({
          name: suite.testFilePath,
          duration: (suite.perfStats?.end || 0) - (suite.perfStats?.start || 0),
        }))
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 5),
    },
    coverage: results.coverageMap ? {
      statements: results.coverageMap.getCoverageSummary().statements,
      branches: results.coverageMap.getCoverageSummary().branches,
      functions: results.coverageMap.getCoverageSummary().functions,
      lines: results.coverageMap.getCoverageSummary().lines,
    } : null,
    failures: results.testResults
      .filter(suite => suite.numFailingTests > 0)
      .map(suite => ({
        file: suite.testFilePath,
        failures: suite.assertionResults
          .filter(test => test.status === 'failed')
          .map(test => ({
            title: test.title,
            fullName: test.fullName,
            error: test.failureMessages?.[0] || 'Unknown error',
            duration: test.duration,
          })),
      })),
    warnings: [],
  }
  
  // Analyze performance issues
  if (testMetrics.performance.averageTime > 1000) {
    testMetrics.warnings.push('High average test execution time detected')
  }
  
  if (testMetrics.performance.slowestSuites.some(suite => suite.duration > 30000)) {
    testMetrics.warnings.push('Some test suites are taking longer than 30 seconds')
  }
  
  // Analyze coverage issues
  if (testMetrics.coverage) {
    ['statements', 'branches', 'functions', 'lines'].forEach(metric => {
      if (testMetrics.coverage[metric].pct < 80) {
        testMetrics.warnings.push(`${metric} coverage is below 80% (${testMetrics.coverage[metric].pct}%)`)
      }
    })
  }
  
  // Write enhanced test metrics
  const outputDir = path.join(process.cwd(), 'test-results')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  
  fs.writeFileSync(
    path.join(outputDir, 'test-metrics.json'),
    JSON.stringify(testMetrics, null, 2)
  )
  
  // Create test categories breakdown
  const testCategories = {
    unit: results.testResults.filter(suite => 
      suite.testFilePath.includes('__tests__') && 
      !suite.testFilePath.includes('integration') &&
      !suite.testFilePath.includes('e2e')
    ).length,
    integration: results.testResults.filter(suite => 
      suite.testFilePath.includes('integration')
    ).length,
    accessibility: results.testResults.filter(suite => 
      suite.testFilePath.includes('accessibility')
    ).length,
    performance: results.testResults.filter(suite => 
      suite.testFilePath.includes('performance')
    ).length,
    e2e: results.testResults.filter(suite => 
      suite.testFilePath.includes('e2e')
    ).length,
  }
  
  fs.writeFileSync(
    path.join(outputDir, 'test-categories.json'),
    JSON.stringify(testCategories, null, 2)
  )
  
  // Generate flaky test report
  const flakyTests = results.testResults
    .flatMap(suite => 
      suite.assertionResults
        .filter(test => test.status === 'failed' && test.retryReasons?.length > 0)
        .map(test => ({
          suite: suite.testFilePath,
          test: test.title,
          retries: test.retryReasons?.length || 0,
          errors: test.failureMessages,
        }))
    )
  
  if (flakyTests.length > 0) {
    fs.writeFileSync(
      path.join(outputDir, 'flaky-tests.json'),
      JSON.stringify(flakyTests, null, 2)
    )
    testMetrics.warnings.push(`${flakyTests.length} flaky tests detected`)
  }
  
  // Generate test health report
  const testHealth = {
    overall: results.success ? 'healthy' : 'failing',
    passRate: results.numTotalTests > 0 ? (results.numPassedTests / results.numTotalTests) * 100 : 0,
    coverageHealth: testMetrics.coverage ? 
      Object.values(testMetrics.coverage).reduce((sum, metric) => sum + metric.pct, 0) / 4 : 0,
    performanceHealth: testMetrics.performance.averageTime < 1000 ? 'good' : 
      testMetrics.performance.averageTime < 5000 ? 'warning' : 'poor',
    recommendations: [],
  }
  
  // Generate recommendations
  if (testHealth.passRate < 95) {
    testHealth.recommendations.push('Improve test reliability - pass rate below 95%')
  }
  
  if (testHealth.coverageHealth < 80) {
    testHealth.recommendations.push('Increase test coverage - below 80% average')
  }
  
  if (testHealth.performanceHealth === 'poor') {
    testHealth.recommendations.push('Optimize slow tests - average execution time is high')
  }
  
  if (testMetrics.summary.failedTestSuites > 0) {
    testHealth.recommendations.push('Fix failing test suites before deployment')
  }
  
  fs.writeFileSync(
    path.join(outputDir, 'test-health.json'),
    JSON.stringify(testHealth, null, 2)
  )
  
  // Log summary to console
  console.log('\n📊 Test Results Summary:')
  console.log(`✅ Passed: ${results.numPassedTests}/${results.numTotalTests} tests`)
  console.log(`❌ Failed: ${results.numFailedTests} tests`)
  console.log(`⏱️ Average test time: ${Math.round(testMetrics.performance.averageTime)}ms`)
  
  if (testMetrics.coverage) {
    console.log(`📈 Coverage: ${Math.round(testMetrics.coverage.statements.pct)}% statements, ${Math.round(testMetrics.coverage.branches.pct)}% branches`)
  }
  
  if (testMetrics.warnings.length > 0) {
    console.log('\n⚠️ Warnings:')
    testMetrics.warnings.forEach(warning => console.log(`   ${warning}`))
  }
  
  if (testHealth.recommendations.length > 0) {
    console.log('\n💡 Recommendations:')
    testHealth.recommendations.forEach(rec => console.log(`   ${rec}`))
  }
  
  console.log(`\n📁 Detailed results saved to: ${outputDir}`)
  
  // Store global metrics for teardown
  global.averageTestDuration = testMetrics.performance.averageTime
  global.slowestTest = testMetrics.performance.slowestSuites[0] || null
  global.totalTestsRun = results.numTotalTests
  
  return results
}