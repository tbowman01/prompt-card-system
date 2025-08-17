# Unit Testing Guide

## Overview

This guide covers the comprehensive unit testing strategy for the Prompt Card System, including Jest configuration, test patterns, and best practices.

## Testing Framework

The system uses **Jest** as the primary testing framework with the following extensions:
- **TypeScript Support**: ts-jest for TypeScript compilation
- **Coverage Reporting**: Built-in Istanbul coverage
- **HTML Reporting**: jest-html-reporters for visual coverage reports
- **JUnit Integration**: jest-junit for CI/CD integration

## Test Structure

### Directory Organization
```
├── backend/
│   ├── src/
│   │   └── __tests__/           # Unit tests co-located with source
│   └── tests/
│       ├── unit/                # Isolated unit tests
│       ├── integration/         # Integration tests
│       └── mocks/               # Mock implementations
├── frontend/
│   ├── src/
│   │   └── __tests__/           # Component tests
│   └── e2e/                     # End-to-end tests
└── auth/
    └── tests/                   # Authentication service tests
```

### Naming Conventions
- Unit tests: `*.test.ts` or `*.test.tsx`
- Integration tests: `*.integration.test.ts`
- End-to-end tests: `*.e2e.test.ts`
- Mock files: `*.mock.ts`

## Jest Configuration

### Backend Configuration (jest.config.js)
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/__tests__/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'clover'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,
  maxWorkers: 4,
};
```

### Frontend Configuration (jest.config.js)
```javascript
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapping: {
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    '^@/pages/(.*)$': '<rootDir>/src/pages/$1',
    '^@/lib/(.*)$': '<rootDir>/src/lib/$1',
  },
  testEnvironment: 'jest-environment-jsdom',
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75
    }
  },
};

module.exports = createJestConfig(customJestConfig);
```

## Test Patterns and Examples

### 1. Service Layer Testing

#### Example: Prompt Card Service
```typescript
// src/services/__tests__/PromptCardService.test.ts
import { PromptCardService } from '../PromptCardService';
import { MockDatabase } from '../../__mocks__/database';

describe('PromptCardService', () => {
  let service: PromptCardService;
  let mockDb: MockDatabase;

  beforeEach(() => {
    mockDb = new MockDatabase();
    service = new PromptCardService(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPromptCard', () => {
    it('should create a prompt card successfully', async () => {
      // Arrange
      const cardData = {
        title: 'Test Card',
        description: 'Test Description',
        prompt: 'Test prompt content',
        category: 'testing'
      };

      const expectedCard = {
        id: '123',
        ...cardData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockDb.promptCards.create.mockResolvedValue(expectedCard);

      // Act
      const result = await service.createPromptCard(cardData);

      // Assert
      expect(result).toEqual(expectedCard);
      expect(mockDb.promptCards.create).toHaveBeenCalledWith(cardData);
      expect(mockDb.promptCards.create).toHaveBeenCalledTimes(1);
    });

    it('should throw error for invalid input', async () => {
      // Arrange
      const invalidData = {
        title: '', // Invalid: empty title
        description: 'Test Description',
        prompt: 'Test prompt content',
        category: 'testing'
      };

      // Act & Assert
      await expect(service.createPromptCard(invalidData))
        .rejects
        .toThrow('Title is required');
    });
  });

  describe('getPromptCards', () => {
    it('should return paginated results', async () => {
      // Arrange
      const mockCards = [
        { id: '1', title: 'Card 1' },
        { id: '2', title: 'Card 2' }
      ];
      
      mockDb.promptCards.findMany.mockResolvedValue(mockCards);

      const pagination = { page: 1, limit: 10 };

      // Act
      const result = await service.getPromptCards(pagination);

      // Assert
      expect(result.data).toEqual(mockCards);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
    });

    it('should handle empty results', async () => {
      // Arrange
      mockDb.promptCards.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getPromptCards({ page: 1, limit: 10 });

      // Assert
      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });
  });
});
```

### 2. API Route Testing

#### Example: Express Route Testing
```typescript
// src/routes/__tests__/promptCards.test.ts
import request from 'supertest';
import { app } from '../../app';
import { PromptCardService } from '../../services/PromptCardService';

jest.mock('../../services/PromptCardService');

describe('Prompt Cards API', () => {
  let mockService: jest.Mocked<PromptCardService>;

  beforeEach(() => {
    mockService = PromptCardService as jest.Mocked<typeof PromptCardService>;
    mockService.prototype.getPromptCards = jest.fn();
    mockService.prototype.createPromptCard = jest.fn();
  });

  describe('GET /api/prompt-cards', () => {
    it('should return prompt cards with 200 status', async () => {
      // Arrange
      const mockCards = {
        data: [
          { id: '1', title: 'Test Card 1' },
          { id: '2', title: 'Test Card 2' }
        ],
        pagination: { page: 1, limit: 10, total: 2 }
      };

      mockService.prototype.getPromptCards.mockResolvedValue(mockCards);

      // Act
      const response = await request(app)
        .get('/api/prompt-cards')
        .expect(200);

      // Assert
      expect(response.body).toEqual(mockCards);
      expect(mockService.prototype.getPromptCards).toHaveBeenCalledWith({
        page: 1,
        limit: 10
      });
    });

    it('should handle query parameters', async () => {
      // Arrange
      const mockCards = { data: [], pagination: { page: 2, limit: 5, total: 0 } };
      mockService.prototype.getPromptCards.mockResolvedValue(mockCards);

      // Act
      await request(app)
        .get('/api/prompt-cards?page=2&limit=5&category=testing')
        .expect(200);

      // Assert
      expect(mockService.prototype.getPromptCards).toHaveBeenCalledWith({
        page: 2,
        limit: 5,
        category: 'testing'
      });
    });
  });

  describe('POST /api/prompt-cards', () => {
    it('should create prompt card with valid data', async () => {
      // Arrange
      const cardData = {
        title: 'New Card',
        description: 'New Description',
        prompt: 'New prompt content',
        category: 'testing'
      };

      const createdCard = { id: '123', ...cardData };
      mockService.prototype.createPromptCard.mockResolvedValue(createdCard);

      // Act
      const response = await request(app)
        .post('/api/prompt-cards')
        .send(cardData)
        .expect(201);

      // Assert
      expect(response.body).toEqual(createdCard);
      expect(mockService.prototype.createPromptCard).toHaveBeenCalledWith(cardData);
    });

    it('should return 400 for invalid data', async () => {
      // Arrange
      const invalidData = { title: '' }; // Missing required fields

      // Act
      const response = await request(app)
        .post('/api/prompt-cards')
        .send(invalidData)
        .expect(400);

      // Assert
      expect(response.body.error).toBe('Validation failed');
    });
  });
});
```

### 3. Component Testing (React)

#### Example: React Component Testing
```typescript
// src/components/__tests__/PromptCardForm.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PromptCardForm } from '../PromptCardForm';

describe('PromptCardForm', () => {
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  it('should render all form fields', () => {
    // Act
    render(<PromptCardForm onSubmit={mockOnSubmit} />);

    // Assert
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/prompt/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('should submit form with valid data', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<PromptCardForm onSubmit={mockOnSubmit} />);

    const formData = {
      title: 'Test Title',
      description: 'Test Description',
      prompt: 'Test prompt content',
      category: 'testing'
    };

    // Act
    await user.type(screen.getByLabelText(/title/i), formData.title);
    await user.type(screen.getByLabelText(/description/i), formData.description);
    await user.type(screen.getByLabelText(/prompt/i), formData.prompt);
    await user.selectOptions(screen.getByLabelText(/category/i), formData.category);
    await user.click(screen.getByRole('button', { name: /submit/i }));

    // Assert
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(formData);
    });
  });

  it('should display validation errors', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<PromptCardForm onSubmit={mockOnSubmit} />);

    // Act - Submit without filling required fields
    await user.click(screen.getByRole('button', { name: /submit/i }));

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/title is required/i)).toBeInTheDocument();
      expect(screen.getByText(/prompt is required/i)).toBeInTheDocument();
    });
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });
});
```

### 4. Mock Implementations

#### Database Mock
```typescript
// src/__mocks__/database.ts
export class MockDatabase {
  promptCards = {
    create: jest.fn(),
    findMany: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  testCases = {
    create: jest.fn(),
    findMany: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  reset() {
    Object.values(this.promptCards).forEach(mock => mock.mockReset());
    Object.values(this.testCases).forEach(mock => mock.mockReset());
  }
}
```

#### External Service Mock
```typescript
// src/__mocks__/llmService.ts
export const mockLLMService = {
  generateCompletion: jest.fn(),
  validatePrompt: jest.fn(),
  analyzeSentiment: jest.fn(),
};

export class LLMService {
  static getInstance() {
    return mockLLMService;
  }
}
```

## Test Utilities

### Setup and Teardown
```typescript
// tests/setup.ts
import { MockDatabase } from '../src/__mocks__/database';

// Global test setup
beforeAll(async () => {
  // Setup test database
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = ':memory:';
});

afterAll(async () => {
  // Cleanup
  await MockDatabase.prototype.reset();
});

// Mock external dependencies
jest.mock('../src/services/llmService');
jest.mock('../src/telemetry/tracer');
```

### Test Data Factories
```typescript
// tests/factories/promptCard.factory.ts
import { faker } from '@faker-js/faker';

export const createPromptCard = (overrides = {}) => ({
  id: faker.string.uuid(),
  title: faker.lorem.sentence(),
  description: faker.lorem.paragraph(),
  prompt: faker.lorem.paragraphs(3),
  category: faker.helpers.arrayElement(['development', 'testing', 'analysis']),
  createdAt: faker.date.past(),
  updatedAt: faker.date.recent(),
  ...overrides,
});

export const createPromptCards = (count: number, overrides = {}) =>
  Array.from({ length: count }, () => createPromptCard(overrides));
```

## Running Tests

### Basic Commands
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- promptCards.test.ts

# Run tests in watch mode
npm test -- --watch

# Run tests with verbose output
npm test -- --verbose
```

### Coverage Commands
```bash
# Backend coverage
cd backend && npm run test:coverage

# Frontend coverage
cd frontend && npm run test:coverage

# Combined coverage report
npm run test:coverage
```

### CI/CD Commands
```bash
# Run tests with JUnit output
npm test -- --reporters=default --reporters=jest-junit

# Run tests with CI optimizations
npm test -- --ci --coverage --watchAll=false
```

## Coverage Reports

### Coverage Thresholds
- **Statements**: 80%
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%

### HTML Coverage Reports
Generated in `coverage/lcov-report/index.html`:
- Line-by-line coverage visualization
- Branch coverage analysis
- Function coverage details
- Uncovered code highlighting

### Coverage Analysis
```bash
# View coverage summary
npm run test:coverage | grep -A 10 "Coverage summary"

# Check coverage thresholds
npm run test:coverage -- --coverageThreshold
```

## Best Practices

### 1. Test Structure
- **Arrange-Act-Assert**: Use clear test structure
- **Descriptive Names**: Test names should describe the scenario
- **Single Responsibility**: One assertion per test when possible

### 2. Mocking Strategy
- **Mock External Dependencies**: Database, APIs, file system
- **Keep Mocks Simple**: Don't over-complicate mock implementations
- **Reset Mocks**: Clear mock state between tests

### 3. Test Data
- **Use Factories**: Create test data with factories
- **Avoid Hardcoded Values**: Use dynamic test data
- **Clean State**: Ensure tests don't depend on each other

### 4. Performance
- **Parallel Execution**: Use Jest's parallel test runner
- **Memory Management**: Clear resources in teardown
- **Test Timeouts**: Set appropriate timeouts for async tests

## Debugging Tests

### Debug Configuration
```json
// .vscode/launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Jest Tests",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Debug Commands
```bash
# Debug specific test
node --inspect-brk node_modules/.bin/jest --runInBand --no-cache promptCards.test.ts

# Debug with VS Code
npm test -- --runInBand --no-cache
```

## Continuous Integration

### GitHub Actions Integration
```yaml
# .github/workflows/test.yml
- name: Run Unit Tests
  run: |
    npm run test:coverage
    npm run test:coverage:frontend
    npm run test:coverage:auth

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
```

## Next Steps

1. Review [integration testing guide](./integration-testing.md) for full system tests
2. Check [performance testing guide](./performance-testing.md) for load testing
3. See [deployment guide](../deployment/ghcr-deployment.md) for production testing