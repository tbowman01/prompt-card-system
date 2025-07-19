# Prompt Card System - Development Makefile

.PHONY: help dev dev-gpu dev-cpu build test clean logs restart

# Default target
help: ## Show this help message
	@echo "Prompt Card System - Development Commands"
	@echo "========================================"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# Development Commands
dev: ## Start full development environment (auto-detects GPU)
	@echo "🚀 Starting development environment..."
	@if command -v nvidia-smi >/dev/null 2>&1; then \
		echo "🎮 GPU detected, starting with GPU support..."; \
		$(MAKE) dev-gpu; \
	else \
		echo "💻 No GPU detected, starting CPU-only..."; \
		$(MAKE) dev-cpu; \
	fi

dev-gpu: ## Start development with GPU support
	@echo "🎮 Starting development environment with GPU support..."
	docker-compose --profile gpu -f docker-compose.dev.yml up -d
	@echo "⏳ Waiting for services to start..."
	@sleep 10
	@$(MAKE) init-models
	@$(MAKE) show-status

dev-cpu: ## Start development environment (CPU only)
	@echo "💻 Starting development environment (CPU only)..."
	docker-compose --profile cpu -f docker-compose.dev.yml up -d
	@echo "⏳ Waiting for services to start..."
	@sleep 10
	@$(MAKE) init-models
	@$(MAKE) show-status

dev-minimal: ## Start minimal development (frontend + backend only)
	@echo "⚡ Starting minimal development environment..."
	@if command -v nvidia-smi >/dev/null 2>&1; then \
		docker-compose -f docker-compose.dev.yml up -d frontend backend redis; \
	else \
		docker-compose -f docker-compose.dev.yml up -d frontend backend-cpu redis; \
	fi
	@$(MAKE) show-status

# Model Management
init-models: ## Initialize LLM models
	@echo "📥 Initializing models..."
	docker-compose --profile init -f docker-compose.dev.yml run --rm model-init

models-list: ## List available models
	@echo "📋 Available models:"
	@docker-compose -f docker-compose.dev.yml exec ollama ollama list || \
	docker-compose -f docker-compose.dev.yml exec ollama-cpu ollama list

# Development Tools
tools: ## Start development tools (Adminer, Redis Commander)
	@echo "🔧 Starting development tools..."
	docker-compose --profile tools -f docker-compose.dev.yml up -d
	@echo "🌐 Tools available at:"
	@echo "   - Adminer (SQLite): http://localhost:8080"
	@echo "   - Redis Commander: http://localhost:8081"

monitoring: ## Start monitoring stack (Prometheus + Grafana)
	@echo "📊 Starting monitoring stack..."
	docker-compose --profile monitoring -f docker-compose.dev.yml up -d
	@echo "📈 Monitoring available at:"
	@echo "   - Prometheus: http://localhost:9090"
	@echo "   - Grafana: http://localhost:3002 (admin/admin)"

# Status and Logs
status: ## Show service status
	@$(MAKE) show-status

show-status:
	@echo ""
	@echo "🔍 Service Status:"
	@echo "=================="
	@docker-compose -f docker-compose.dev.yml ps
	@echo ""
	@echo "🌐 Available Services:"
	@echo "   - Frontend: http://localhost:3000"
	@echo "   - Backend API: http://localhost:3001"
	@echo "   - Backend Health: http://localhost:3001/api/health"
	@echo "   - Backend Health v2: http://localhost:3001/api/health/v2"
	@echo "   - Frontend Health: http://localhost:3000/api/health"
	@echo "   - Ollama API: http://localhost:11434"
	@echo "   - Redis: localhost:6379"

# Health Checks
health: ## Run health checks for all services
	@echo "🏥 Running health checks..."
	@./scripts/health-check.sh

health-detailed: ## Run detailed health checks
	@echo "🏥 Running detailed health checks..."
	@./scripts/health-check.sh --detailed

health-watch: ## Watch health status (updates every 5 seconds)
	@echo "👀 Watching health status (Ctrl+C to stop)..."
	@watch -n 5 ./scripts/health-check.sh

logs: ## Show logs for all services
	docker-compose -f docker-compose.dev.yml logs -f

logs-frontend: ## Show frontend logs
	docker-compose -f docker-compose.dev.yml logs -f frontend

logs-backend: ## Show backend logs
	docker-compose -f docker-compose.dev.yml logs -f backend

logs-ollama: ## Show Ollama logs
	docker-compose -f docker-compose.dev.yml logs -f ollama ollama-cpu

# Testing
test: ## Run tests in containers
	@echo "🧪 Running tests..."
	docker-compose -f docker-compose.dev.yml exec backend npm test
	docker-compose -f docker-compose.dev.yml exec frontend npm test

test-backend: ## Run backend tests only
	@if docker-compose -f docker-compose.dev.yml ps | grep -q "backend "; then \
		docker-compose -f docker-compose.dev.yml exec backend npm test; \
	else \
		docker-compose -f docker-compose.dev.yml exec backend-cpu npm test; \
	fi

test-frontend: ## Run frontend tests only
	docker-compose -f docker-compose.dev.yml exec frontend npm test

# Database
db-reset: ## Reset development database
	@echo "🗄️ Resetting database..."
	@docker-compose -f docker-compose.dev.yml exec backend rm -f /app/data/database.sqlite
	@docker-compose -f docker-compose.dev.yml restart backend
	@echo "✅ Database reset complete"

db-backup: ## Backup development database
	@echo "💾 Backing up database..."
	@docker cp $$(docker-compose -f docker-compose.dev.yml ps -q backend):/app/data/database.sqlite ./backup-$$(date +%Y%m%d-%H%M%S).sqlite
	@echo "✅ Database backed up"

# Cleanup
stop: ## Stop all services
	@echo "🛑 Stopping development environment..."
	docker-compose -f docker-compose.dev.yml down

clean: ## Stop and remove all containers, networks, and volumes
	@echo "🧹 Cleaning up development environment..."
	docker-compose -f docker-compose.dev.yml down -v --remove-orphans
	docker system prune -f

restart: ## Restart all services
	@echo "🔄 Restarting development environment..."
	@$(MAKE) stop
	@$(MAKE) dev

restart-backend: ## Restart backend service only
	@if docker-compose -f docker-compose.dev.yml ps | grep -q "backend "; then \
		docker-compose -f docker-compose.dev.yml restart backend; \
	else \
		docker-compose -f docker-compose.dev.yml restart backend-cpu; \
	fi

restart-frontend: ## Restart frontend service only
	docker-compose -f docker-compose.dev.yml restart frontend

# Build
build: ## Build all development images
	@echo "🏗️ Building development images..."
	docker-compose -f docker-compose.dev.yml build

build-backend: ## Build backend image only
	docker-compose -f docker-compose.dev.yml build backend

build-frontend: ## Build frontend image only
	docker-compose -f docker-compose.dev.yml build frontend

# Utility
shell-backend: ## Open shell in backend container
	@if docker-compose -f docker-compose.dev.yml ps | grep -q "backend "; then \
		docker-compose -f docker-compose.dev.yml exec backend sh; \
	else \
		docker-compose -f docker-compose.dev.yml exec backend-cpu sh; \
	fi

shell-frontend: ## Open shell in frontend container
	docker-compose -f docker-compose.dev.yml exec frontend sh

shell-ollama: ## Open shell in Ollama container
	@docker-compose -f docker-compose.dev.yml exec ollama sh || \
	docker-compose -f docker-compose.dev.yml exec ollama-cpu sh

# Quick Start
quick-start: ## Quick start for new developers
	@echo "🚀 Quick Start for Prompt Card System Development"
	@echo "================================================="
	@echo "1. Copying environment file..."
	@cp .env.dev.example .env.dev
	@echo "2. Starting development environment..."
	@$(MAKE) dev
	@echo ""
	@echo "🎉 Quick start complete!"
	@echo "📖 Next steps:"
	@echo "   - Visit http://localhost:3000 to see the frontend"
	@echo "   - Check http://localhost:3001/api/health for backend status"
	@echo "   - Run 'make logs' to see service logs"
	@echo "   - Run 'make help' to see all available commands"