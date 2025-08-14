/**
 * Global Jest Setup - Enterprise Test Configuration
 * Initializes test environment for all services
 */

module.exports = async () => {
  console.log('🧪 Setting up enterprise test environment...');
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // Reduce noise during tests
  process.env.DISABLE_TELEMETRY = 'true'; // Disable telemetry in tests
  
  // Database setup for tests
  process.env.DATABASE_URL = ':memory:'; // Use in-memory SQLite for tests
  
  // Security settings for tests
  process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
  process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-long';
  
  // LLM service test configuration
  process.env.OLLAMA_HOST = 'http://localhost:11434';
  process.env.LLM_TIMEOUT = '5000'; // Shorter timeout for tests
  
  // Coverage tracking
  process.env.FORCE_COVERAGE = 'true';
  process.env.COVERAGE_THRESHOLD = '100';
  
  console.log('✅ Global test setup complete');
};