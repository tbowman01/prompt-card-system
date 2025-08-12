const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

module.exports = async function globalSetup() {
  console.log('🚀 Setting up test environment...')
  
  // Ensure test directories exist
  const testDirs = [
    'test-results',
    'coverage',
    '.jest-cache',
  ]
  
  testDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
      console.log(`✅ Created directory: ${dir}`)
    }
  })
  
  // Set test environment variables
  process.env.NODE_ENV = 'test'
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001/api'
  process.env.CI = process.env.CI || 'false'
  
  // Initialize MSW in Node environment
  const { server } = require('../setup/msw')
  server.listen({ onUnhandledRequest: 'warn' })
  global.__MSW_SERVER__ = server
  
  console.log('✅ MSW server started')
  
  // Performance monitoring setup
  if (!global.performance) {
    const { performance } = require('perf_hooks')
    global.performance = performance
  }
  
  // Clear any existing performance measurements
  if (typeof performance.clearMarks === 'function') {
    performance.clearMarks()
    performance.clearMeasures()
  }
  
  // Create test metadata
  const testMetadata = {
    startTime: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    ci: !!process.env.CI,
    testRunId: Date.now().toString(),
  }
  
  fs.writeFileSync(
    path.join(process.cwd(), 'test-results', 'test-metadata.json'),
    JSON.stringify(testMetadata, null, 2)
  )
  
  console.log('✅ Test environment setup complete')
  
  // Start performance monitoring
  global.testStartTime = Date.now()
  
  // Memory usage baseline
  if (global.gc) {
    global.gc()
  }
  global.initialMemoryUsage = process.memoryUsage()
  
  console.log(`📊 Initial memory usage: ${Math.round(global.initialMemoryUsage.heapUsed / 1024 / 1024)}MB`)
}