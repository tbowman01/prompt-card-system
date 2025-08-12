const fs = require('fs')
const path = require('path')

module.exports = async function globalTeardown() {
  console.log('🧹 Cleaning up test environment...')
  
  // Clean up MSW server
  if (global.__MSW_SERVER__) {
    global.__MSW_SERVER__.close()
    console.log('✅ MSW server closed')
  }
  
  // Calculate test run duration
  const testEndTime = Date.now()
  const testDuration = testEndTime - (global.testStartTime || testEndTime)
  
  // Final memory usage
  const finalMemoryUsage = process.memoryUsage()
  const memoryDelta = finalMemoryUsage.heapUsed - (global.initialMemoryUsage?.heapUsed || 0)
  
  // Create test summary
  const testSummary = {
    endTime: new Date().toISOString(),
    duration: testDuration,
    durationFormatted: `${Math.round(testDuration / 1000)}s`,
    memoryUsage: {
      initial: global.initialMemoryUsage,
      final: finalMemoryUsage,
      delta: memoryDelta,
      deltaFormatted: `${Math.round(memoryDelta / 1024 / 1024)}MB`,
    },
    performance: {
      averageTestDuration: global.averageTestDuration || 0,
      slowestTest: global.slowestTest || null,
      totalTests: global.totalTestsRun || 0,
    },
  }
  
  // Write test summary
  try {
    fs.writeFileSync(
      path.join(process.cwd(), 'test-results', 'test-summary.json'),
      JSON.stringify(testSummary, null, 2)
    )
    console.log('✅ Test summary written')
  } catch (error) {
    console.warn('⚠️ Could not write test summary:', error.message)
  }
  
  // Log performance metrics
  console.log(`📊 Test run completed in ${testSummary.durationFormatted}`)
  console.log(`📈 Memory delta: ${testSummary.memoryUsage.deltaFormatted}`)
  console.log(`🏁 Final memory usage: ${Math.round(finalMemoryUsage.heapUsed / 1024 / 1024)}MB`)
  
  // Performance warnings
  if (testDuration > 300000) { // 5 minutes
    console.warn('⚠️ Test run took longer than 5 minutes - consider optimizing')
  }
  
  if (memoryDelta > 100 * 1024 * 1024) { // 100MB
    console.warn('⚠️ High memory usage detected - possible memory leaks')
  }
  
  // Clean up performance measurements
  if (typeof performance !== 'undefined' && performance.clearMarks) {
    performance.clearMarks()
    performance.clearMeasures()
  }
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc()
    console.log('🗑️ Garbage collection completed')
  }
  
  console.log('✅ Test environment cleanup complete')
}