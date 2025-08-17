# Comprehensive Test Suite

This directory contains a complete testing framework for the Prompt Card System, implementing industry best practices for test-driven development and quality assurance.

## 📁 Test Structure

```
tests/
├── unit/                    # Unit tests (isolated component testing)
│   ├── backend/            # Backend service unit tests
│   ├── frontend/           # React component unit tests
│   └── auth/               # Authentication service unit tests
├── integration/            # Integration tests (service interaction)
│   ├── api/               # API endpoint testing
│   ├── database/          # Database operation testing
│   └── services/          # Service integration testing
├── performance/           # Performance and load testing
├── e2e/                  # End-to-end workflow testing
├── docker/               # Container functionality testing
├── setup/                # Test configuration and setup
├── utils/                # Test utilities and helpers
├── scripts/              # Test automation scripts
└── ci/                   # CI/CD pipeline configuration
```

## 🧪 Test Types

### Unit Tests
- **Coverage Target**: >80% code coverage
- **Focus**: Individual functions, components, and modules
- **Speed**: Fast execution (<15s per suite)
- **Isolation**: Mocked dependencies

### Integration Tests
- **Coverage Target**: >70% integration paths
- **Focus**: Service interactions and API endpoints
- **Environment**: Test database and services
- **Duration**: Medium execution (<2 minutes per suite)

### Performance Tests
- **Focus**: Load testing, stress testing, memory usage
- **Metrics**: Response times, throughput, resource usage
- **Thresholds**: <1s average response, <512MB memory
- **Duration**: Long execution (5-10 minutes)

### E2E Tests
- **Focus**: Complete user workflows
- **Environment**: Full application stack
- **Browser**: Playwright with Chromium
- **Coverage**: Critical user journeys

### Docker Tests
- **Focus**: Container health, networking, persistence
- **Environment**: Docker Compose stack
- **Validation**: Service communication, resource limits

## 🚀 Running Tests

### Quick Commands

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:performance
npm run test:e2e
npm run test:docker

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### Advanced Test Runner

```bash
# Use the comprehensive test runner
npx ts-node tests/test-runner.ts

# Run specific suites
npx ts-node tests/test-runner.ts --suites="unit,integration"

# Run with coverage and verbose output
npx ts-node tests/test-runner.ts --coverage --verbose

# Run in parallel (where supported)
npx ts-node tests/test-runner.ts --parallel
```

### Individual Test Configuration

Each service has its own Jest configuration:

```bash
# Backend tests
cd backend && npm run test:coverage

# Frontend tests
cd frontend && npm run test:coverage

# Auth service tests
cd auth && npm run test:coverage
```

## 📊 Test Coverage

### Coverage Requirements

| Component | Statements | Branches | Functions | Lines |
|-----------|------------|----------|-----------|-------|
| Backend Services | 100% | 100% | 100% | 100% |
| Frontend Components | 100% | 100% | 100% | 100% |
| Auth Service | 100% | 100% | 100% | 100% |
| Integration | 80% | 75% | 80% | 80% |

### Coverage Reports

Coverage reports are generated in multiple formats:
- **HTML**: Interactive browsable reports
- **LCOV**: For CI/CD integration
- **JSON**: For programmatic analysis
- **Text**: For console output

## 🏗️ Test Setup and Configuration

### Environment Variables

```bash
# Test environment
NODE_ENV=test

# Database
DATABASE_PATH=:memory:
DATABASE_URL=postgres://test:test@localhost:5432/test_db

# Redis
REDIS_URL=redis://localhost:6379/15

# Services
API_PORT=0  # Random port for testing
AUTH_PORT=0
FRONTEND_PORT=0

# Security
JWT_SECRET=test-secret-key
LOG_LEVEL=error
```

### Test Database Setup

The test suite automatically manages test databases:

```typescript
// Automatic setup for each test
beforeEach(async () => {
  await setupTestDatabase();
  await createTestData();
});

// Automatic cleanup
afterEach(async () => {
  await cleanupTestDatabase();
});
```

### Mock Configuration

External dependencies are mocked for unit tests:

```typescript
// LLM Service Mock
jest.mock('axios', () => ({
  post: jest.fn(),
  get: jest.fn(),
}));

// Database Mock
jest.mock('better-sqlite3', () => jest.fn(() => ({
  prepare: jest.fn(),
  close: jest.fn(),
})));
```

## 🔄 CI/CD Integration

### GitHub Actions Pipeline

The test suite integrates with GitHub Actions for continuous testing:

1. **Code Quality**: Linting, type checking, security audit
2. **Unit Tests**: Parallel execution across services
3. **Integration Tests**: Database and API testing
4. **Performance Tests**: Load and stress testing
5. **Docker Tests**: Container functionality
6. **E2E Tests**: Full workflow validation
7. **Security Tests**: Vulnerability scanning
8. **Quality Gate**: Coverage and success rate validation

### Quality Gates

Tests must pass these quality gates:

- **Unit Test Coverage**: ≥80%
- **Integration Coverage**: ≥70%
- **Overall Success Rate**: ≥95%
- **Performance Thresholds**: Met
- **Security Scans**: No high-severity issues

## 🛠️ Test Utilities

### Database Utilities

```typescript
// Create test data
const testCards = await createTestPromptCards(10);
const testUsers = await createTestUsers(3);

// Execute queries
const results = executeTestQuery('SELECT * FROM prompt_cards');

// Performance testing
const stats = await measureDatabasePerformance(
  () => db.prepare('SELECT * FROM prompt_cards').all(),
  100 // iterations
);
```

### Authentication Utilities

```typescript
// Create test users
const user = await createTestUser({
  email: 'test@example.com',
  role: 'admin'
});

// Generate tokens
const token = generateAuthToken(user);
const expiredToken = generateExpiredToken(user);

// Mock authentication
const authHeader = createAuthHeader(token);
```

### Performance Monitoring

```typescript
// Monitor performance during tests
global.performanceMonitor.start();
// ... test operations ...
global.performanceMonitor.end();

const stats = global.performanceMonitor.getStats();
console.log('Performance:', stats);
```

## 📈 Test Metrics and Reporting

### Automated Reports

The test suite generates comprehensive reports:

- **HTML Reports**: Visual test results and coverage
- **JSON Reports**: Machine-readable metrics
- **CI Reports**: GitHub Actions integration
- **Performance Reports**: Benchmarking results

### Key Metrics Tracked

- **Test Execution Time**: Per suite and overall
- **Code Coverage**: Statements, branches, functions, lines
- **Performance Metrics**: Response times, memory usage
- **Failure Analysis**: Error patterns and trends
- **Regression Detection**: Performance degradation

## 🔧 Development Workflow

### Writing New Tests

1. **Identify Test Type**: Unit, integration, E2E
2. **Create Test File**: Follow naming conventions
3. **Write Test Cases**: Follow AAA pattern (Arrange, Act, Assert)
4. **Add Mocks**: Mock external dependencies
5. **Verify Coverage**: Ensure adequate coverage
6. **Run Tests**: Validate locally before commit

### Test-Driven Development (TDD)

```typescript
// 1. Write failing test
describe('PromptCardService', () => {
  it('should create prompt card with valid data', async () => {
    const service = new PromptCardService();
    const result = await service.create(validData);
    expect(result).toHaveProperty('id');
  });
});

// 2. Write minimal implementation
class PromptCardService {
  async create(data) {
    return { id: 'test-id' };
  }
}

// 3. Refactor and improve
class PromptCardService {
  async create(data) {
    this.validate(data);
    return this.database.insert(data);
  }
}
```

### Debugging Tests

```bash
# Run tests with debugging
npx jest --runInBand --verbose --no-cache

# Debug specific test
npx jest --testNamePattern="should create prompt card"

# Debug with Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand

# View detailed coverage
npx jest --coverage --coverageReporters=text-lcov
```

## 🚨 Troubleshooting

### Common Issues

1. **Test Timeouts**: Increase timeout for slow operations
2. **Port Conflicts**: Use random ports (PORT=0)
3. **Database Locks**: Ensure proper cleanup
4. **Memory Leaks**: Check for unclosed connections
5. **Flaky Tests**: Add proper waits and retries

### Performance Issues

```typescript
// Optimize slow tests
jest.setTimeout(30000); // Increase timeout
jest.retryTimes(3);     // Add retries

// Use test.concurrent for parallel execution
test.concurrent('parallel test 1', async () => {
  // test implementation
});
```

### Docker Issues

```bash
# Check Docker availability
docker --version

# Clean up containers
docker system prune -f

# View container logs
docker-compose logs backend

# Check container health
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

## 📚 Best Practices

### Test Organization

- **Group Related Tests**: Use describe blocks
- **Clear Test Names**: Describe what and why
- **Single Responsibility**: One assertion per test
- **Test Data Builders**: Use factories for test data
- **Cleanup**: Always clean up after tests

### Performance

- **Mock External Calls**: Keep tests fast
- **Use Test Doubles**: Avoid real network calls
- **Parallel Execution**: Run independent tests concurrently
- **Resource Management**: Properly close connections
- **Caching**: Reuse expensive setup operations

### Maintainability

- **Page Object Model**: For E2E tests
- **Test Utilities**: Reusable helper functions
- **Configuration**: Environment-specific settings
- **Documentation**: Keep tests self-documenting
- **Version Control**: Track test changes with code

## 🔗 Related Documentation

- [API Documentation](../docs/API.md)
- [Development Guide](../docs/developer/DEVELOPMENT_SETUP.md)
- [Deployment Guide](../docs/DEPLOYMENT.md)
- [Security Guide](../docs/SECURITY.md)
- [Performance Guide](../docs/operations/performance-troubleshooting.md)

---

**Note**: This test suite follows industry best practices and provides comprehensive coverage for the Prompt Card System. Regular updates and maintenance ensure continued effectiveness as the system evolves.