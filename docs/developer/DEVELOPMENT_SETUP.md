# Development Environment Setup Guide

This guide will help you set up a complete development environment for the Prompt Card System. We provide multiple setup options to accommodate different development preferences and system configurations.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [Docker Development Setup (Recommended)](#docker-development-setup-recommended)
4. [Local Development Setup](#local-development-setup)
5. [IDE Configuration](#ide-configuration)
6. [Environment Variables](#environment-variables)
7. [Database Setup](#database-setup)
8. [Testing Environment](#testing-environment)
9. [Troubleshooting](#troubleshooting)
10. [Development Workflow](#development-workflow)

## Quick Start

For the fastest setup, use our Docker development environment:

```bash
# Clone the repository
git clone https://github.com/tbowman01/prompt-card-system.git
cd prompt-card-system

# Start development environment
docker-compose -f docker-compose.dev.yml up

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:3001
# Ollama API: http://localhost:11434
```

## Prerequisites

### Required Software

| Software | Version | Purpose | Installation |
|----------|---------|---------|-------------|
| **Node.js** | 20.0+ | Runtime environment | [Download](https://nodejs.org/) |
| **npm** | 9.0+ | Package manager | Comes with Node.js |
| **Git** | 2.30+ | Version control | [Download](https://git-scm.com/) |
| **Docker** | 24.0+ | Containerization | [Download](https://docker.com/) |
| **Docker Compose** | 2.20+ | Multi-container orchestration | Comes with Docker Desktop |

### Optional but Recommended

| Software | Purpose | Installation |
|----------|---------|-------------|
| **VS Code** | Code editor with excellent TypeScript support | [Download](https://code.visualstudio.com/) |
| **Ollama** | Local LLM runtime (for non-Docker setup) | [Download](https://ollama.ai/) |

### System Requirements

- **Memory**: 8GB RAM minimum (16GB recommended for AI features)
- **Storage**: 10GB free space (more needed for LLM models)
- **CPU**: Multi-core processor (for parallel test execution)
- **OS**: Windows 10+, macOS 11+, or Linux

## Docker Development Setup (Recommended)

Docker provides the most consistent development environment across all platforms.

### Benefits of Docker Development

- ✅ **Consistent Environment**: Same environment across all developer machines
- ✅ **Easy Setup**: One command to start everything
- ✅ **Isolated Dependencies**: No conflicts with other projects
- ✅ **Production Parity**: Development environment matches production
- ✅ **Automatic LLM Setup**: Ollama and models are configured automatically
- ✅ **Hot Reload**: Code changes are reflected immediately

### Docker Setup Steps

1. **Clone and Navigate**
   ```bash
   git clone https://github.com/tbowman01/prompt-card-system.git
   cd prompt-card-system
   ```

2. **Environment Configuration**
   ```bash
   # Backend environment
   cp backend/.env.example backend/.env
   
   # Frontend environment (optional)
   cp frontend/.env.example frontend/.env
   ```

3. **Start Development Environment**
   ```bash
   # Start all services with hot reload
   docker-compose -f docker-compose.dev.yml up
   
   # Or run in background
   docker-compose -f docker-compose.dev.yml up -d
   ```

4. **Verify Installation**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001/health
   - Ollama API: http://localhost:11434/api/version

### Docker Development Commands

```bash
# Start services
docker-compose -f docker-compose.dev.yml up

# Stop services
docker-compose -f docker-compose.dev.yml down

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# View specific service logs
docker-compose -f docker-compose.dev.yml logs -f backend

# Rebuild services (after dependency changes)
docker-compose -f docker-compose.dev.yml up --build

# Access service shell
docker exec -it prompt-card-backend sh
docker exec -it prompt-card-frontend sh

# Clean up (removes containers and volumes)
docker-compose -f docker-compose.dev.yml down -v --remove-orphans
```

### Docker Development Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Development Environment                  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Frontend  │  │   Backend   │  │   Ollama    │         │
│  │   Next.js   │  │  Node.js    │  │    LLM      │         │
│  │   Port 3000 │  │  Port 3001  │  │  Port 11434 │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         │                │                │                │
│         └────────────────┼────────────────┘                │
│                          │                                 │
│  ┌─────────────┐        │        ┌─────────────┐           │
│  │   SQLite    │        │        │   Redis     │           │
│  │  Database   │────────┼────────│   Cache     │           │
│  │   Volume    │        │        │  (Optional) │           │
│  └─────────────┘        │        └─────────────┘           │
└──────────────────────────┼─────────────────────────────────┘
                           │
                    ┌─────────────┐
                    │ Host System │
                    │   VS Code   │
                    └─────────────┘
```

## Local Development Setup

For developers who prefer running services locally without Docker.

### Prerequisites for Local Setup

1. **Node.js and npm**
   ```bash
   # Verify installation
   node --version  # Should be 20.0+
   npm --version   # Should be 9.0+
   ```

2. **Ollama (for AI features)**
   ```bash
   # Install Ollama
   curl -fsSL https://ollama.ai/install.sh | sh
   
   # Start Ollama service
   ollama serve
   
   # Download required models (in another terminal)
   ollama pull llama2:7b
   ollama pull llama2:13b
   ```

### Local Setup Steps

1. **Clone and Install Dependencies**
   ```bash
   git clone https://github.com/tbowman01/prompt-card-system.git
   cd prompt-card-system
   
   # Install all dependencies (root, backend, frontend)
   npm run install:all
   ```

2. **Environment Configuration**
   
   Backend (`.env`):
   ```bash
   NODE_ENV=development
   PORT=3001
   DATABASE_PATH=./data/database.sqlite
   OLLAMA_BASE_URL=http://localhost:11434
   CORS_ORIGIN=http://localhost:3000
   ```
   
   Frontend (`.env.local`):
   ```bash
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```

3. **Database Initialization**
   ```bash
   # Create database directory
   mkdir -p backend/data
   
   # Run database migrations
   cd backend
   npm run migrate
   ```

4. **Start Development Servers**
   
   **Option 1: Use root scripts (recommended)**
   ```bash
   # From root directory - starts both frontend and backend
   npm run dev
   ```
   
   **Option 2: Start services separately**
   ```bash
   # Terminal 1: Backend
   cd backend
   npm run dev
   
   # Terminal 2: Frontend
   cd frontend
   npm run dev
   
   # Terminal 3: Ollama (if not running as service)
   ollama serve
   ```

5. **Verify Installation**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001/health
   - Ollama API: http://localhost:11434/api/version

### Local Development Commands

```bash
# Install dependencies
npm run install:all

# Start all services
npm run dev

# Start services separately
npm run dev:backend
npm run dev:frontend

# Build all services
npm run build

# Run tests
npm test

# Run linting
npm run lint

# Clean installation
npm run clean
```

## IDE Configuration

### VS Code Setup (Recommended)

1. **Install Recommended Extensions**
   ```json
   {
     "recommendations": [
       "ms-vscode.vscode-typescript-next",
       "dbaeumer.vscode-eslint",
       "esbenp.prettier-vscode",
       "ms-vscode.vscode-jest",
       "eamodio.gitlens",
       "ms-azuretools.vscode-docker",
       "bradlc.vscode-tailwindcss",
       "gruntfuggly.todo-tree"
     ]
   }
   ```

2. **Workspace Settings** (`.vscode/settings.json`)
   ```json
   {
     "typescript.preferences.importModuleSpecifier": "relative",
     "editor.formatOnSave": true,
     "editor.defaultFormatter": "esbenp.prettier-vscode",
     "editor.codeActionsOnSave": {
       "source.fixAll.eslint": true
     },
     "eslint.workingDirectories": ["backend", "frontend"],
     "typescript.preferences.includePackageJsonAutoImports": "auto",
     "files.exclude": {
       "**/node_modules": true,
       "**/dist": true,
       "**/.next": true
     }
   }
   ```

3. **Launch Configuration** (`.vscode/launch.json`)
   ```json
   {
     "version": "0.2.0",
     "configurations": [
       {
         "name": "Debug Backend",
         "type": "node",
         "request": "launch",
         "program": "${workspaceFolder}/backend/src/server.ts",
         "outFiles": ["${workspaceFolder}/backend/dist/**/*.js"],
         "runtimeArgs": ["-r", "ts-node/register"],
         "env": {
           "NODE_ENV": "development"
         },
         "console": "integratedTerminal",
         "internalConsoleOptions": "neverOpen"
       },
       {
         "name": "Debug Frontend",
         "type": "node",
         "request": "launch",
         "cwd": "${workspaceFolder}/frontend",
         "runtimeExecutable": "npm",
         "runtimeArgs": ["run", "dev"]
       }
     ]
   }
   ```

### Other IDE Support

**WebStorm:**
- Import the project as a Node.js project
- Configure ESLint and Prettier
- Set up run configurations for npm scripts

**Vim/Neovim:**
- Use CoC or native LSP for TypeScript support
- Configure ESLint and Prettier plugins

## Environment Variables

### Backend Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment mode | `development` | Yes |
| `PORT` | Backend server port | `3001` | Yes |
| `DATABASE_PATH` | SQLite database file path | `./data/database.sqlite` | Yes |
| `OLLAMA_BASE_URL` | Ollama API URL | `http://localhost:11434` | Yes |
| `CORS_ORIGIN` | Allowed CORS origins | `http://localhost:3000` | Yes |
| `JWT_SECRET` | JWT signing secret | Generated | No |
| `LOG_LEVEL` | Logging level | `info` | No |
| `REDIS_URL` | Redis connection URL | None | No |

### Frontend Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:3001` | Yes |
| `NEXTAUTH_SECRET` | NextAuth secret | Generated | No |
| `NEXTAUTH_URL` | NextAuth URL | `http://localhost:3000` | No |

### Security Note

- Never commit actual secrets to version control
- Use different secrets for development and production
- Rotate secrets regularly
- Use strong, randomly generated secrets

## Database Setup

### SQLite Development Database

The development environment uses SQLite for simplicity:

```bash
# Database location
backend/data/database.sqlite

# Create database directory
mkdir -p backend/data

# Run migrations
cd backend && npm run migrate
```

### Database Migrations

```bash
# Run migrations
npm run migrate

# Create new migration
# Add SQL file to backend/src/database/migrations/

# Migration naming convention
# 001_initial_schema.sql
# 002_add_user_table.sql
# 003_add_indexes.sql
```

### Database Schema

The system includes these main tables:

- **prompt_cards** - Prompt card definitions
- **test_cases** - Test case configurations
- **test_results** - Test execution results
- **users** - User accounts
- **workspaces** - Multi-tenant workspaces
- **analytics_events** - Event tracking for analytics

### Development Data

```bash
# Reset database (development only)
rm backend/data/database.sqlite
npm run migrate

# Seed development data
npm run seed
```

## Testing Environment

### Test Configuration

The project includes comprehensive testing setup:

```bash
# Run all tests
npm test

# Run backend tests only
cd backend && npm test

# Run frontend tests only
cd frontend && npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run integration tests
npm run test:integration

# Run E2E tests
cd frontend && npm run test:e2e
```

### Test Types

1. **Unit Tests**
   - Fast, isolated component testing
   - Located in `__tests__` directories or `.test.ts` files
   - Use Jest with TypeScript support

2. **Integration Tests**
   - API endpoint testing
   - Database integration testing
   - Service interaction testing

3. **E2E Tests**
   - Full user workflow testing
   - Browser-based testing with Playwright
   - Critical path validation

### Test Environment Variables

```bash
# Backend test environment
NODE_ENV=test
DATABASE_PATH=:memory:
OLLAMA_BASE_URL=http://localhost:11434

# Frontend test environment
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Check what's using the port
   lsof -i :3000
   lsof -i :3001
   
   # Kill process using port
   kill -9 $(lsof -t -i:3000)
   ```

2. **Node Module Issues**
   ```bash
   # Clean node modules and reinstall
   npm run clean
   npm run install:all
   ```

3. **Database Issues**
   ```bash
   # Reset development database
   rm backend/data/database.sqlite
   cd backend && npm run migrate
   ```

4. **Docker Issues**
   ```bash
   # Rebuild containers
   docker-compose -f docker-compose.dev.yml up --build
   
   # Clean Docker system
   docker system prune -a
   ```

5. **Ollama Issues**
   ```bash
   # Check Ollama status
   ollama list
   
   # Pull required models
   ollama pull llama2:7b
   
   # Restart Ollama
   pkill ollama
   ollama serve
   ```

### Performance Issues

1. **Slow TypeScript Compilation**
   ```bash
   # Use project references
   npx tsc --build --watch
   
   # Clear TypeScript cache
   rm -rf backend/.tsbuildinfo frontend/.tsbuildinfo
   ```

2. **High Memory Usage**
   - Reduce Jest workers: `jest --maxWorkers=2`
   - Use Docker resource limits
   - Close unused browser tabs

3. **Slow Docker Builds**
   ```bash
   # Use BuildKit
   DOCKER_BUILDKIT=1 docker-compose build
   
   # Use multi-stage builds with caching
   docker-compose -f docker-compose.dev.yml up --build
   ```

### Debugging Tips

1. **Backend Debugging**
   ```bash
   # Enable debug mode
   DEBUG=* npm run dev
   
   # Use Node.js inspector
   node --inspect src/server.ts
   ```

2. **Frontend Debugging**
   - Use React Developer Tools
   - Check Network tab for API issues
   - Use VS Code debugger configuration

3. **Database Debugging**
   ```bash
   # Access SQLite database
   sqlite3 backend/data/database.sqlite
   
   # View tables
   .tables
   
   # View schema
   .schema prompt_cards
   ```

## Development Workflow

### Daily Development Workflow

1. **Start Development Environment**
   ```bash
   # Docker (recommended)
   docker-compose -f docker-compose.dev.yml up
   
   # Or local
   npm run dev
   ```

2. **Make Changes**
   - Edit code in your IDE
   - Changes are reflected immediately (hot reload)
   - Tests run automatically in watch mode

3. **Test Changes**
   ```bash
   # Run relevant tests
   npm test
   
   # Check code quality
   npm run lint
   npm run type-check
   ```

4. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

### Code Quality Workflow

```bash
# Before committing
npm run lint          # Check linting rules
npm run lint:fix      # Fix auto-fixable issues
npm run type-check    # Check TypeScript types
npm test              # Run tests
npm run build         # Ensure build works
```

### Integration Workflow

```bash
# Update from main branch
git checkout main
git pull origin main

# Merge into feature branch
git checkout feature/my-feature
git merge main

# Run integration tests
npm run test:integration
```

This development setup guide provides everything you need to start contributing to the Prompt Card System. Choose the setup method that best fits your development style and system configuration.

For additional help, see the [Troubleshooting Guide](../troubleshooting/common-issues.md) or join our [Discord community](https://discord.gg/prompt-card-system).