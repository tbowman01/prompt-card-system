# Contributing to Prompt Card System

Welcome to the Prompt Card System project! We're excited to have you contribute. This guide will help you get started with contributing to our comprehensive prompt testing and evaluation platform.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Setup](#development-setup)
3. [Project Structure](#project-structure)
4. [Coding Standards](#coding-standards)
5. [Git Workflow](#git-workflow)
6. [Testing Guidelines](#testing-guidelines)
7. [Pull Request Process](#pull-request-process)
8. [Security Guidelines](#security-guidelines)
9. [Performance Guidelines](#performance-guidelines)
10. [Documentation Standards](#documentation-standards)
11. [Community Guidelines](#community-guidelines)

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 20+** - Required for both frontend and backend
- **npm 9.0+** - Package manager
- **Docker & Docker Compose** - For containerized development
- **Git** - Version control
- **VS Code** (recommended) - With TypeScript and ESLint extensions

### Quick Setup

1. **Fork the repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/prompt-card-system.git
   cd prompt-card-system
   ```

2. **Install dependencies**
   ```bash
   npm run install:all
   ```

3. **Set up environment**
   ```bash
   # Backend environment
   cp backend/.env.example backend/.env
   
   # Frontend environment (if needed)
   cp frontend/.env.example frontend/.env
   ```

4. **Start development environment**
   ```bash
   # Option 1: Docker Compose (Recommended)
   docker-compose -f docker-compose.dev.yml up

   # Option 2: Local development
   npm run dev
   ```

## Development Setup

### Docker Development (Recommended)

The project includes optimized Docker configurations for development:

```bash
# Start development environment with hot reload
docker-compose -f docker-compose.dev.yml up

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop environment
docker-compose -f docker-compose.dev.yml down
```

**Benefits of Docker development:**
- Consistent environment across all developers
- No need to install Ollama or other dependencies locally
- Automatic model loading and configuration
- Production-like environment testing

### Local Development

If you prefer local development:

```bash
# Install dependencies
npm run install:all

# Start backend (Terminal 1)
cd backend && npm run dev

# Start frontend (Terminal 2) 
cd frontend && npm run dev

# Optional: Start Ollama locally (Terminal 3)
ollama serve
ollama pull llama2:7b
```

**Environment Configuration:**

Backend (`.env`):
```bash
NODE_ENV=development
PORT=3001
DATABASE_PATH=./data/database.sqlite
OLLAMA_BASE_URL=http://localhost:11434
CORS_ORIGIN=http://localhost:3000
```

## Project Structure

```
prompt-card-system/
├── backend/                 # Node.js/Express backend
│   ├── src/
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Express middleware
│   │   ├── database/       # Database models and migrations
│   │   ├── types/          # TypeScript type definitions
│   │   └── tests/          # Test files
│   ├── Dockerfile          # Production Docker image
│   ├── Dockerfile.dev      # Development Docker image
│   └── package.json
├── frontend/               # Next.js frontend
│   ├── src/
│   │   ├── app/           # Next.js App Router pages
│   │   ├── components/    # React components
│   │   ├── lib/           # Utility functions
│   │   ├── hooks/         # Custom React hooks
│   │   └── types/         # TypeScript type definitions
│   ├── Dockerfile         # Production Docker image
│   ├── Dockerfile.dev     # Development Docker image
│   └── package.json
├── docs/                  # Documentation
├── monitoring/            # Grafana/Prometheus configs
├── scripts/              # Build and deployment scripts
├── docker-compose.yml    # Production Docker Compose
├── docker-compose.dev.yml # Development Docker Compose
└── package.json          # Root package.json
```

## Coding Standards

### TypeScript Guidelines

We use strict TypeScript configuration with the following principles:

1. **Type Safety First**
   ```typescript
   // ✅ Good - Explicit types
   interface PromptCard {
     id: string;
     title: string;
     description?: string;
     variables: Record<string, unknown>;
   }

   // ❌ Avoid - Any types
   const data: any = response.data;
   ```

2. **Proper Error Handling**
   ```typescript
   // ✅ Good - Proper error types
   type ApiResponse<T> = {
     success: true;
     data: T;
   } | {
     success: false;
     error: string;
   };

   // ✅ Good - Error boundaries
   try {
     const result = await processPrompt(prompt);
     return { success: true, data: result };
   } catch (error) {
     logger.error('Prompt processing failed', { error, prompt });
     return { success: false, error: error.message };
   }
   ```

3. **Consistent Naming**
   - **Files**: `kebab-case` for files (`prompt-card.service.ts`)
   - **Functions/Variables**: `camelCase` (`createPromptCard`)
   - **Classes/Interfaces**: `PascalCase` (`PromptCard`)
   - **Constants**: `UPPER_SNAKE_CASE` (`MAX_PROMPT_LENGTH`)

### Code Formatting

We use ESLint and Prettier with the following configuration:

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code (runs automatically on commit)
npx prettier --write .
```

**Key formatting rules:**
- 2 spaces for indentation
- Single quotes for strings
- Trailing commas in objects/arrays
- Semi-colons required
- 80-character line limit

### React/Next.js Guidelines

1. **Functional Components with TypeScript**
   ```typescript
   interface Props {
     title: string;
     onSubmit: (data: FormData) => void;
   }

   const PromptCardForm: React.FC<Props> = ({ title, onSubmit }) => {
     // Component logic
   };
   ```

2. **Custom Hooks for Logic Reuse**
   ```typescript
   const usePromptCard = (id: string) => {
     const { data, error, mutate } = useSWR(`/api/prompt-cards/${id}`, fetcher);
     
     const updatePromptCard = useCallback(async (updates: Partial<PromptCard>) => {
       // Update logic
     }, [id]);

     return { promptCard: data, error, updatePromptCard };
   };
   ```

3. **Proper State Management**
   ```typescript
   // Use SWR for server state
   const { data, error, mutate } = useSWR('/api/prompt-cards', fetcher);

   // Use useState for local UI state
   const [isEditing, setIsEditing] = useState(false);
   ```

## Git Workflow

### Branching Strategy

We use a Git Flow inspired workflow:

- **main** - Production-ready code
- **develop** - Development branch for integration
- **feature/** - Feature development branches
- **bugfix/** - Bug fix branches
- **hotfix/** - Critical production fixes

### Branch Naming Convention

```bash
# Features
feature/add-voice-interface
feature/improve-analytics-dashboard

# Bug fixes
bugfix/fix-prompt-validation
bugfix/resolve-memory-leak

# Hot fixes
hotfix/security-vulnerability-patch

# Chores
chore/update-dependencies
chore/improve-documentation
```

### Commit Message Standards

We use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
type(scope): subject

body (optional)

footer (optional)
```

**Types:**
- `feat` - New features
- `fix` - Bug fixes
- `docs` - Documentation changes
- `style` - Code style changes (no logic changes)
- `refactor` - Code refactoring
- `test` - Test additions or modifications
- `chore` - Maintenance tasks

**Examples:**
```bash
feat(analytics): add real-time performance monitoring

fix(auth): resolve JWT token validation issue

docs(api): update endpoint documentation

test(integration): add test cases for prompt optimization
```

### Creating a Feature Branch

```bash
# Create and switch to feature branch
git checkout -b feature/your-feature-name

# Make your changes, then commit
git add .
git commit -m "feat(scope): add new feature"

# Push branch to your fork
git push origin feature/your-feature-name
```

## Testing Guidelines

### Testing Strategy

Our testing follows the test pyramid approach:

1. **Unit Tests (70%)**
   - Fast, isolated component testing
   - Located alongside source files or in `__tests__` directories
   - Use Jest with TypeScript support

2. **Integration Tests (20%)**
   - API endpoint testing
   - Database integration testing
   - Service interaction testing

3. **End-to-End Tests (10%)**
   - Full workflow testing
   - User interface testing with Playwright
   - Critical path testing

### Writing Tests

**Backend Unit Tests:**
```typescript
describe('PromptCardService', () => {
  let service: PromptCardService;
  let mockDb: jest.Mocked<Database>;

  beforeEach(() => {
    mockDb = createMockDatabase();
    service = new PromptCardService(mockDb);
  });

  it('should create a new prompt card', async () => {
    // Arrange
    const promptCard = { title: 'Test', prompt: 'Hello {{name}}' };
    
    // Act
    const result = await service.create(promptCard);
    
    // Assert
    expect(result.success).toBe(true);
    expect(mockDb.promptCards.create).toHaveBeenCalledWith(promptCard);
  });
});
```

**Frontend Component Tests:**
```typescript
describe('PromptCardForm', () => {
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  it('should submit form with correct data', async () => {
    render(<PromptCardForm onSubmit={mockOnSubmit} />);
    
    await userEvent.type(screen.getByLabelText(/title/i), 'Test Card');
    await userEvent.click(screen.getByRole('button', { name: /submit/i }));
    
    expect(mockOnSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Test Card' })
    );
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run backend tests only
cd backend && npm test

# Run frontend tests only
cd frontend && npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run E2E tests
cd frontend && npm run test:e2e
```

### Test Coverage Requirements

- **Minimum coverage**: 85% lines, 80% branches, 80% functions
- **Critical services**: 90% coverage required
- **New features**: Must include comprehensive tests
- **Bug fixes**: Must include regression tests

## Pull Request Process

### Before Creating a Pull Request

1. **Ensure your code follows our standards**
   ```bash
   npm run lint
   npm run type-check
   npm test
   ```

2. **Update documentation if needed**
   - Update API documentation for new endpoints
   - Update user guides for new features
   - Update this contributing guide for process changes

3. **Test your changes thoroughly**
   - Run full test suite
   - Test in Docker environment
   - Test edge cases and error scenarios

### Pull Request Template

When creating a PR, use this template:

```markdown
## Description
Brief description of changes made.

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass (if applicable)
- [ ] Manual testing completed

## Documentation
- [ ] Code is self-documenting
- [ ] API documentation updated
- [ ] User documentation updated (if applicable)

## Screenshots (if applicable)
Add screenshots of UI changes.

## Additional Notes
Any additional information about the PR.
```

### Code Review Process

1. **Automated Checks**
   - All CI/CD pipelines must pass
   - Code coverage must meet requirements
   - Security scans must pass
   - Performance benchmarks must be met

2. **Peer Review**
   - At least one reviewer required
   - Two reviewers for breaking changes
   - Architecture review for major changes

3. **Review Checklist**
   - [ ] Code follows project standards
   - [ ] Tests are comprehensive and pass
   - [ ] Documentation is updated
   - [ ] Performance impact is acceptable
   - [ ] Security implications are considered
   - [ ] Breaking changes are documented

## Security Guidelines

### Security Best Practices

1. **Input Validation**
   ```typescript
   // Always validate and sanitize inputs
   const validatePrompt = (prompt: string): boolean => {
     if (!prompt || prompt.length > MAX_PROMPT_LENGTH) {
       return false;
     }
     return !containsMaliciousPatterns(prompt);
   };
   ```

2. **Authentication & Authorization**
   - Use JWT tokens with appropriate expiration
   - Implement role-based access control
   - Validate permissions on every request

3. **Sensitive Data Handling**
   - Never log sensitive information
   - Encrypt sensitive data at rest
   - Use environment variables for secrets

4. **LLM Security**
   - Implement prompt injection detection
   - Validate LLM outputs before displaying
   - Rate limit LLM requests

### Reporting Security Issues

Please report security vulnerabilities privately to [security@example.com]. Do not create public GitHub issues for security problems.

## Performance Guidelines

### Performance Best Practices

1. **Database Optimization**
   - Use appropriate indexes
   - Avoid N+1 queries
   - Implement proper pagination

2. **API Performance**
   - Implement caching where appropriate
   - Use compression for large responses
   - Optimize database queries

3. **Frontend Performance**
   - Implement code splitting
   - Use React.memo for expensive components
   - Optimize bundle size

4. **LLM Integration**
   - Implement request batching
   - Use caching for repeated prompts
   - Implement timeout handling

### Performance Testing

```bash
# Backend performance tests
cd backend && npm run test:performance

# Frontend performance tests
cd frontend && npm run test:performance

# Load testing
./scripts/load-test.sh
```

## Documentation Standards

### Code Documentation

1. **TSDoc Comments**
   ```typescript
   /**
    * Creates a new prompt card with the provided data
    * @param promptCard - The prompt card data to create
    * @returns Promise resolving to the created prompt card
    * @throws {ValidationError} When prompt card data is invalid
    */
   async createPromptCard(promptCard: CreatePromptCardData): Promise<PromptCard> {
     // Implementation
   }
   ```

2. **README Files**
   - Each major directory should have a README
   - Explain purpose and usage
   - Include examples where helpful

3. **API Documentation**
   - Document all endpoints
   - Include request/response examples
   - Document error responses

### Documentation Updates

- Update documentation with code changes
- Keep examples up to date
- Review documentation in PRs

## Community Guidelines

### Code of Conduct

We are committed to providing a friendly, safe, and welcoming environment for all contributors. Please read our [Code of Conduct](CODE_OF_CONDUCT.md).

### Getting Help

- **GitHub Discussions** - For questions and community discussion
- **GitHub Issues** - For bug reports and feature requests
- **Discord** - Real-time community chat (link in README)

### Recognition

We appreciate all contributions! Contributors are recognized in:
- Release notes for significant contributions
- GitHub contributors page
- Hall of fame in documentation

## Development Tips

### IDE Setup (VS Code)

Recommended extensions:
- TypeScript
- ESLint
- Prettier
- Jest
- GitLens
- Docker

### Debugging

1. **Backend Debugging**
   ```bash
   # Debug mode with inspector
   cd backend && npm run dev:debug
   ```

2. **Frontend Debugging**
   - Use React Developer Tools
   - Use browser debugger with source maps
   - Check Network tab for API issues

3. **Docker Debugging**
   ```bash
   # Access container shell
   docker exec -it prompt-card-backend sh

   # View container logs
   docker logs prompt-card-backend -f
   ```

### Common Issues

1. **Port Conflicts**
   ```bash
   # Check for port usage
   lsof -i :3000
   lsof -i :3001

   # Kill processes using ports
   kill -9 $(lsof -t -i:3000)
   ```

2. **Database Issues**
   ```bash
   # Reset database in development
   rm backend/data/database.sqlite
   npm run migrate
   ```

3. **Node Modules Issues**
   ```bash
   # Clean install
   npm run clean
   npm run install:all
   ```

## Questions?

If you have questions about contributing, please:

1. Check existing documentation
2. Search GitHub issues and discussions
3. Join our Discord community
4. Create a new GitHub discussion

Thank you for contributing to the Prompt Card System! Your contributions help make AI prompt testing more accessible and reliable for everyone.