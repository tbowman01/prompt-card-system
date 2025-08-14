/**
 * Global Jest Teardown - Enterprise Test Configuration
 * Cleans up test environment for all services
 */

module.exports = async () => {
  console.log('🧹 Cleaning up enterprise test environment...');
  
  // Clean up any global resources
  if (global.__MONGO_URI__) {
    console.log('Cleaning up MongoDB test instance...');
    delete global.__MONGO_URI__;
  }
  
  if (global.__REDIS_CLIENT__) {
    console.log('Cleaning up Redis test client...');
    await global.__REDIS_CLIENT__.quit();
    delete global.__REDIS_CLIENT__;
  }
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  
  // Report final coverage statistics
  const coveragePath = './coverage/coverage-summary.json';
  try {
    const fs = require('fs');
    if (fs.existsSync(coveragePath)) {
      const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
      const total = coverage.total;
      
      console.log('\n📊 Final Coverage Report:');
      console.log(`Lines: ${total.lines.pct}%`);
      console.log(`Functions: ${total.functions.pct}%`);
      console.log(`Branches: ${total.branches.pct}%`);
      console.log(`Statements: ${total.statements.pct}%`);
      
      // Enforce 100% coverage requirement
      if (
        total.lines.pct < 100 ||
        total.functions.pct < 100 ||
        total.branches.pct < 100 ||
        total.statements.pct < 100
      ) {
        console.error('\n❌ CRITICAL: Test coverage below 100% threshold!');
        console.error('London TDD requires 100% test coverage.');
        console.error('Please add tests to achieve full coverage.');
      } else {
        console.log('\n✅ EXCELLENT: 100% test coverage achieved!');
      }
    }
  } catch (error) {
    console.warn('⚠️  Could not read coverage summary:', error.message);
  }
  
  console.log('✅ Global test cleanup complete');
};