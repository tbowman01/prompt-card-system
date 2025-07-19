# Frontend Testing Guide

## Overview

This document describes the comprehensive testing strategy implemented for the prompt card system frontend. The test suite covers unit tests, integration tests, end-to-end tests, and performance/accessibility testing.

## Test Structure

```
src/
├── __tests__/
│   ├── components/
│   │   ├── ui/                    # UI component tests
│   │   ├── Analytics/             # Analytics component tests
│   │   ├── PromptCard/            # PromptCard component tests
│   │   └── TestExecution/         # Test execution component tests
│   ├── hooks/                     # Custom hooks tests
│   ├── lib/                       # Utility/API tests
│   ├── integration/               # API integration tests
│   ├── mocks/                     # MSW mock handlers
│   └── setup/                     # Test configuration
e2e/                               # Playwright E2E tests
```

## Testing Technologies

### Unit & Integration Testing
- **Jest**: Test runner and assertion library
- **React Testing Library**: Component testing utilities
- **JSdom**: DOM environment for tests
- **MSW (Mock Service Worker)**: API mocking for integration tests

### End-to-End Testing
- **Playwright**: Cross-browser E2E testing
- **Multiple browsers**: Chrome, Firefox, Safari, Mobile
- **Visual testing**: Screenshots and videos on failure

## Test Categories

### 1. UI Component Tests

**Location**: `src/__tests__/components/ui/`

Tests for core UI components with comprehensive coverage:

#### LoadingSpinner Tests
- Renders with different sizes (sm, md, lg)
- Applies custom styling
- Maintains accessibility with screen reader text
- Proper CSS class application

#### Button Tests
- Different variants (primary, secondary, outline, danger)
- Different sizes (sm, md, lg)
- Loading and disabled states
- Event handling and accessibility
- Custom props and HTML attributes

#### Modal Tests
- Open/close state management
- Backdrop and close button interactions
- Keyboard navigation (Escape key)
- Different sizes and responsive behavior
- Body scroll management and cleanup
- Portal rendering

**Run UI Tests:**
```bash
npm run test -- --testPathPattern="ui"
```

### 2. Component Integration Tests

**Location**: `src/__tests__/components/`

Tests for complex business components:

#### PromptCardForm Tests
- Form validation and submission
- Variable extraction from templates
- Create vs Edit mode behavior
- Error handling and loading states
- Router navigation integration

#### MetricsOverview Tests
- API data fetching and display
- Real-time metrics updates
- Error state handling
- Data formatting and visualization
- Auto-refresh functionality

#### TestResults Tests
- Test result rendering and status display
- Assertion result visualization
- Performance metrics display
- Error message handling
- Accessibility features

**Run Component Tests:**
```bash
npm run test -- --testPathPattern="components"
```

### 3. API Integration Tests

**Location**: `src/__tests__/integration/`

Comprehensive API testing with MSW mocking:

#### Prompt Cards API
- CRUD operations (Create, Read, Update, Delete)
- Pagination and search functionality
- Error handling (404, 500, network errors)

#### Test Execution API
- Test running and status tracking
- Result retrieval and formatting
- Single test vs batch execution

#### Analytics API
- Dashboard metrics retrieval
- Real-time data updates
- Historical data analysis

**Run Integration Tests:**
```bash
npm run test -- --testPathPattern="integration"
```

### 4. Custom Hooks Tests

**Location**: `src/__tests__/hooks/`

#### useWebSocket Tests
- Connection management
- Message handling and state updates
- Event listener cleanup
- Error handling and reconnection
- Custom options support

**Run Hook Tests:**
```bash
npm run test -- --testPathPattern="hooks"
```

### 5. End-to-End Tests

**Location**: `e2e/`

#### Complete User Workflows
- Prompt card creation and editing
- Test case management
- Test execution and result viewing
- Analytics dashboard interaction

#### Responsive Design Tests
- Mobile and tablet viewports
- Navigation and layout adaptation
- Touch interaction support

#### Accessibility Tests
- Keyboard navigation
- Screen reader compatibility
- ARIA labels and roles
- Color contrast and focus management

**Run E2E Tests:**
```bash
npm run test:e2e
npm run test:e2e:ui      # With UI
npm run test:e2e:headed  # With browser window
```

## Test Configuration

### Jest Configuration

**File**: `jest.config.js`

Key features:
- Module path mapping for clean imports
- Coverage collection and thresholds (70% minimum)
- JSdom test environment
- MSW integration support
- Next.js integration

### Coverage Requirements

```javascript
coverageThreshold: {
  global: {
    branches: 70,
    functions: 70,
    lines: 70,
    statements: 70,
  },
}
```

### Playwright Configuration

**File**: `playwright.config.ts`

Features:
- Multi-browser testing (Chrome, Firefox, Safari)
- Mobile device emulation
- Screenshot and video capture on failure
- Automatic retry on CI
- Lighthouse integration for performance

## Running Tests

### Development Commands

```bash
# Run all unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run CI tests (no watch, with timeout)
npm run test:ci

# Run E2E tests
npm run test:e2e

# Run all tests (unit + E2E)
npm run test:all
```

### CI/CD Integration

**File**: `.github/workflows/test.yml`

The CI pipeline includes:
1. **Unit Tests**: Run on Node.js 18.x and 20.x
2. **E2E Tests**: Full browser testing with Playwright
3. **Lighthouse**: Performance and accessibility auditing
4. **Coverage**: Code coverage reporting with CodeCov

## Mock Service Worker (MSW)

### API Mocking Strategy

**Files**: 
- `src/__tests__/mocks/handlers.ts`
- `src/__tests__/mocks/server.ts`

MSW provides realistic API mocking for:
- Prompt card management
- Test case operations  
- Test execution workflows
- Analytics data
- Error simulation and edge cases

### Mock Data

The mock handlers include:
- Sample prompt cards with variables
- Test cases with assertions
- Dashboard metrics and analytics
- Realistic response times and data

## Best Practices

### Test Organization
1. **Group related tests** using `describe` blocks
2. **Use descriptive test names** that explain the expected behavior
3. **Follow AAA pattern**: Arrange, Act, Assert
4. **Clean up** after each test with proper mocking resets

### Component Testing
1. **Test user interactions**, not implementation details
2. **Use semantic queries** (byRole, byLabelText) over test IDs
3. **Test accessibility** features and keyboard navigation
4. **Mock external dependencies** (APIs, timers, etc.)

### Integration Testing
1. **Test complete user workflows** end-to-end
2. **Use realistic data** that matches production scenarios
3. **Test error states** and edge cases thoroughly
4. **Verify API contracts** and response handling

## Debugging Tests

### Common Issues

1. **Timer-related tests**: Use `jest.useFakeTimers()` for consistency
2. **Async operations**: Always use `waitFor` for async assertions
3. **DOM cleanup**: Tests failing due to previous test side effects
4. **Mock persistence**: MSW handlers persisting between tests

### Debugging Commands

```bash
# Debug specific test file
npm run test -- --testPathPattern="Button" --verbose

# Debug with console output
npm run test -- --verbose --no-silent

# Debug E2E tests with browser
npm run test:e2e:headed
```

## Performance Considerations

### Test Performance
- **Parallel execution** for independent tests
- **Smart test selection** based on changed files
- **Efficient mocking** to avoid real API calls
- **Resource cleanup** to prevent memory leaks

### CI Optimization
- **Test splitting** across multiple workers
- **Caching** for node_modules and build artifacts
- **Conditional runs** based on file changes
- **Artifact retention** for debugging failed tests

## Future Enhancements

### Planned Improvements
1. **Visual regression testing** with Percy or similar
2. **Performance testing** with WebPageTest integration
3. **Component testing** with Storybook
4. **Advanced accessibility testing** with axe-core
5. **Cross-device testing** with BrowserStack

### Test Coverage Goals
- Increase coverage to 85%+ for critical paths
- Add performance benchmarking tests
- Implement automated accessibility auditing
- Add international localization testing

## Conclusion

This comprehensive test suite ensures the frontend application is:
- **Reliable**: Catches regressions and bugs early
- **Maintainable**: Tests serve as living documentation
- **Accessible**: Ensures inclusive user experience
- **Performant**: Validates performance requirements
- **Cross-platform**: Works across devices and browsers

The testing strategy evolves with the application, providing confidence in deployments and enabling rapid feature development.