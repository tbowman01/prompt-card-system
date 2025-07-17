# Prompt Card System MVP

A self-hosted system for test-driven prompt development with local LLM integration using Ollama.

## Features

- **Prompt Card Management**: Create, edit, and organize prompt templates with variables
- **Test Case Creation**: Define test cases with input variables and assertions
- **Local LLM Integration**: Test prompts with local Ollama models
- **YAML Import/Export**: Compatible with Promptfoo configuration format
- **Web Interface**: Clean, responsive UI for managing prompts and tests

## Architecture

- **Frontend**: Next.js 14 with TypeScript and Tailwind CSS
- **Backend**: Express.js with TypeScript and SQLite
- **Database**: SQLite with better-sqlite3
- **LLM Service**: Ollama with local model serving
- **Evaluation**: Promptfoo library integration

## Quick Start

### Prerequisites

- Docker and Docker Compose
- 8GB+ RAM (for LLM models)
- 10GB+ disk space (for models and data)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd prompt-card-system
```

2. Start all services:
```bash
docker-compose up -d
```

3. Wait for initial setup:
   - Backend API will be available at http://localhost:3001
   - Frontend will be available at http://localhost:3000
   - Ollama will download the default model (this may take several minutes)

4. Access the application at http://localhost:3000

### Development Setup

For development with hot reload:

1. Install dependencies:
```bash
# Backend
cd backend && npm install

# Frontend
cd frontend && npm install
```

2. Start development servers:
```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev

# Terminal 3: Ollama (if not using Docker)
ollama serve
```

## Usage

### Creating a Prompt Card

1. Navigate to "Prompt Cards" in the main menu
2. Click "Create New Card"
3. Enter a title and description
4. Define your prompt template with variables using `{{variable_name}}` syntax
5. Save the card

### Adding Test Cases

1. Open a prompt card
2. Click "Add Test Case"
3. Provide input values for each variable
4. Define expected output (optional)
5. Add assertions to validate the response
6. Save the test case

### Running Tests

1. Select a prompt card with test cases
2. Click "Run All Tests"
3. View results showing pass/fail status for each test
4. Review detailed output and assertion results

### YAML Import/Export

- **Import**: Upload a Promptfoo-compatible YAML file to create prompt cards
- **Export**: Download prompt cards as YAML files for use with Promptfoo

## API Endpoints

### Prompt Cards
- `GET /api/prompt-cards` - List all prompt cards
- `GET /api/prompt-cards/:id` - Get specific prompt card
- `POST /api/prompt-cards` - Create new prompt card
- `PUT /api/prompt-cards/:id` - Update prompt card
- `DELETE /api/prompt-cards/:id` - Delete prompt card

### Test Cases
- `GET /api/test-cases/prompt-card/:id` - Get test cases for prompt card
- `POST /api/test-cases` - Create new test case
- `PUT /api/test-cases/:id` - Update test case
- `DELETE /api/test-cases/:id` - Delete test case

### YAML Operations
- `POST /api/yaml/import` - Import from YAML
- `GET /api/yaml/export/:id` - Export prompt card to YAML
- `GET /api/yaml/export` - Export all cards to YAML

### System
- `GET /api/health` - Health check
- `GET /api/health/db` - Database status

## Configuration

### Environment Variables

**Backend** (`.env`):
```env
NODE_ENV=development
PORT=3001
DATABASE_PATH=./data/database.sqlite
OLLAMA_BASE_URL=http://localhost:11434
CORS_ORIGIN=http://localhost:3000
```

**Frontend** (`.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Docker Compose Configuration

The system uses Docker Compose for orchestration:
- `frontend`: Next.js application on port 3000
- `backend`: Express.js API on port 3001
- `ollama`: Ollama LLM service on port 11434
- `model-loader`: One-time model download service

## Database Schema

### prompt_cards
- `id`: Primary key
- `title`: Card title
- `description`: Optional description
- `prompt_template`: Prompt template with variables
- `variables`: JSON array of variable names
- `created_at`, `updated_at`: Timestamps

### test_cases
- `id`: Primary key
- `prompt_card_id`: Foreign key to prompt_cards
- `name`: Test case name
- `input_variables`: JSON object with variable values
- `expected_output`: Expected response (optional)
- `assertions`: JSON array of assertion objects
- `created_at`: Timestamp

### test_results (optional)
- `id`: Primary key
- `test_case_id`: Foreign key to test_cases
- `execution_id`: Groups related test runs
- `llm_output`: Actual LLM response
- `passed`: Boolean pass/fail status
- `assertion_results`: JSON array of assertion results
- `execution_time_ms`: Response time
- `created_at`: Timestamp

## Troubleshooting

### Common Issues

1. **Services won't start**: Check if ports 3000, 3001, and 11434 are available
2. **Frontend can't connect to backend**: Verify CORS settings and API URL
3. **Ollama model download fails**: Ensure sufficient disk space and internet connection
4. **Database connection errors**: Check if data directory is writable

### Health Checks

Visit http://localhost:3001/api/health to check system status:
- API server status
- Database connectivity
- Ollama service availability

### Logs

View service logs:
```bash
docker-compose logs -f [service_name]
```

## Development

### Project Structure

```
prompt-card-system/
├── frontend/           # Next.js frontend
│   ├── src/
│   │   ├── app/       # App router pages
│   │   ├── components/ # React components
│   │   ├── lib/       # Utilities and API client
│   │   ├── types/     # TypeScript types
│   │   └── hooks/     # Custom React hooks
│   └── package.json
├── backend/           # Express.js backend
│   ├── src/
│   │   ├── routes/    # API routes
│   │   ├── database/  # Database connection and schema
│   │   ├── middleware/ # Express middleware
│   │   ├── types/     # TypeScript types
│   │   └── server.ts  # Main server file
│   └── package.json
├── data/              # SQLite database storage
├── models/            # Ollama model cache
└── docker-compose.yml # Service orchestration
```

### Adding New Features

1. **Backend**: Add routes in `backend/src/routes/`
2. **Frontend**: Add pages in `frontend/src/app/` and components in `frontend/src/components/`
3. **Database**: Update schema in `backend/src/database/connection.ts`
4. **Types**: Add TypeScript definitions in respective `types/` directories

### Testing

Run tests:
```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review the logs for error messages
3. Create an issue in the project repository