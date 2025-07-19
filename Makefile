# Prompt Card System - Enhanced Development Makefile
# ==================================================

.PHONY: help dev dev-gpu dev-cpu build test clean logs restart
.DEFAULT_GOAL := help

# Colors for output
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[0;33m
BLUE := \033[0;34m
PURPLE := \033[0;35m
CYAN := \033[0;36m
WHITE := \033[0;37m
RESET := \033[0m

# Default target
help: ## Show this help message
	@echo "$(BLUE)Prompt Card System - Development Commands$(RESET)"
	@echo "========================================"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "$(CYAN)%-25s$(RESET) %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# Quick Commands
setup: ## First-time setup for new developers
	@echo "$(GREEN)🚀 Setting up Prompt Card System for development...$(RESET)"
	@echo "$(YELLOW)Step 1: Checking prerequisites...$(RESET)"
	@$(MAKE) check-prerequisites
	@echo "$(YELLOW)Step 2: Creating environment files...$(RESET)"
	@$(MAKE) create-env
	@echo "$(YELLOW)Step 3: Building containers...$(RESET)"
	@$(MAKE) build
	@echo "$(YELLOW)Step 4: Starting development environment...$(RESET)"
	@$(MAKE) dev
	@echo "$(GREEN)✅ Setup complete! Visit http://localhost:3000$(RESET)"

check-prerequisites: ## Check system prerequisites
	@echo "$(BLUE)🔍 Checking prerequisites...$(RESET)"
	@command -v docker >/dev/null 2>&1 || (echo "$(RED)❌ Docker not found. Please install Docker.$(RESET)" && exit 1)
	@command -v docker-compose >/dev/null 2>&1 || (echo "$(RED)❌ Docker Compose not found. Please install Docker Compose.$(RESET)" && exit 1)
	@echo "$(GREEN)✅ Docker and Docker Compose found$(RESET)"
	@if command -v nvidia-smi >/dev/null 2>&1; then \
		echo "$(GREEN)🎮 GPU detected and available$(RESET)"; \
	else \
		echo "$(YELLOW)💻 No GPU detected, will use CPU-only mode$(RESET)"; \
	fi

create-env: ## Create environment files from examples
	@echo "$(BLUE)📝 Creating environment files...$(RESET)"
	@if [ ! -f .env ]; then \
		echo "$(YELLOW)Creating .env from .env.example...$(RESET)"; \
		cp .env.example .env 2>/dev/null || echo "$(YELLOW)No .env.example found, skipping...$(RESET)"; \
	fi
	@if [ ! -f .env.dev ]; then \
		echo "$(YELLOW)Creating .env.dev from .env.dev.example...$(RESET)"; \
		cp .env.dev.example .env.dev 2>/dev/null || echo "$(YELLOW)No .env.dev.example found, skipping...$(RESET)"; \
	fi
	@echo "$(GREEN)✅ Environment files ready$(RESET)"

# Development Commands
dev: ## Start full development environment (auto-detects GPU)
	@echo "$(GREEN)🚀 Starting development environment...$(RESET)"
	@if command -v nvidia-smi >/dev/null 2>&1; then \
		echo "$(GREEN)🎮 GPU detected, starting with GPU support...$(RESET)"; \
		$(MAKE) dev-gpu; \
	else \
		echo "$(YELLOW)💻 No GPU detected, starting CPU-only...$(RESET)"; \
		$(MAKE) dev-cpu; \
	fi

dev-full: ## Start complete development stack with all features
	@echo "$(PURPLE)🌟 Starting FULL development stack with advanced features...$(RESET)"
	@echo "$(YELLOW)🎤 Voice Interface: ENABLED$(RESET)"
	@echo "$(YELLOW)🔗 Blockchain Audit: ENABLED$(RESET)"
	@echo "$(YELLOW)🤝 Collaboration: ENABLED$(RESET)"
	@echo "$(YELLOW)📊 Advanced Monitoring: ENABLED$(RESET)"
	@echo "$(YELLOW)🏢 Multi-Tenant: ENABLED$(RESET)"
	@if command -v nvidia-smi >/dev/null 2>&1; then \
		ENABLE_VOICE_INTERFACE=true ENABLE_BLOCKCHAIN_AUDIT=true ENABLE_COLLABORATION=true ENABLE_MONITORING=true MULTI_TENANT_MODE=true docker-compose --profile gpu --profile monitoring --profile tools -f docker-compose.dev.yml up -d; \
	else \
		ENABLE_VOICE_INTERFACE=true ENABLE_BLOCKCHAIN_AUDIT=true ENABLE_COLLABORATION=true ENABLE_MONITORING=true MULTI_TENANT_MODE=true docker-compose --profile cpu --profile monitoring --profile tools -f docker-compose.dev.yml up -d; \
	fi
	@echo "$(YELLOW)⏳ Waiting for services to initialize...$(RESET)"
	@sleep 15
	@$(MAKE) init-models
	@$(MAKE) show-full-status

dev-gpu: ## Start development with GPU support
	@echo "$(GREEN)🎮 Starting development environment with GPU support...$(RESET)"
	@docker-compose --profile gpu -f docker-compose.dev.yml up -d
	@echo "$(YELLOW)⏳ Waiting for services to start...$(RESET)"
	@sleep 10
	@$(MAKE) init-models
	@$(MAKE) show-status

dev-cpu: ## Start development environment (CPU only)
	@echo "$(YELLOW)💻 Starting development environment (CPU only)...$(RESET)"
	@docker-compose --profile cpu -f docker-compose.dev.yml up -d
	@echo "$(YELLOW)⏳ Waiting for services to start...$(RESET)"
	@sleep 10
	@$(MAKE) init-models
	@$(MAKE) show-status

dev-minimal: ## Start minimal development (frontend + backend only)
	@echo "$(CYAN)⚡ Starting minimal development environment...$(RESET)"
	@if command -v nvidia-smi >/dev/null 2>&1; then \
		docker-compose -f docker-compose.dev.yml up -d frontend backend redis; \
	else \
		docker-compose -f docker-compose.dev.yml up -d frontend backend-cpu redis; \
	fi
	@$(MAKE) show-status

# Feature-specific environments
dev-voice: ## Start development with Voice Interface enabled
	@echo "$(PURPLE)🎤 Starting development with Voice Interface...$(RESET)"
	@ENABLE_VOICE_INTERFACE=true $(MAKE) dev
	@echo "$(GREEN)✅ Voice Interface enabled - 6 languages supported$(RESET)"

dev-blockchain: ## Start development with Blockchain Audit enabled
	@echo "$(BLUE)🔗 Starting development with Blockchain Audit...$(RESET)"
	@ENABLE_BLOCKCHAIN_AUDIT=true $(MAKE) dev
	@echo "$(GREEN)✅ Blockchain Audit enabled - Smart contracts active$(RESET)"

dev-collaboration: ## Start development with Real-time Collaboration
	@echo "$(CYAN)🤝 Starting development with Collaboration features...$(RESET)"
	@ENABLE_COLLABORATION=true $(MAKE) dev
	@echo "$(GREEN)✅ Real-time Collaboration enabled$(RESET)"

dev-monitoring: ## Start development with Advanced Monitoring
	@echo "$(YELLOW)📊 Starting development with Advanced Monitoring...$(RESET)"
	@ENABLE_MONITORING=true docker-compose --profile monitoring -f docker-compose.dev.yml up -d
	@$(MAKE) monitoring
	@echo "$(GREEN)✅ Advanced Monitoring enabled$(RESET)"

dev-enterprise: ## Start development with Multi-Tenant features
	@echo "$(PURPLE)🏢 Starting development with Enterprise Multi-Tenant...$(RESET)"
	@MULTI_TENANT_MODE=true $(MAKE) dev
	@echo "$(GREEN)✅ Multi-Tenant mode enabled$(RESET)"

# Model Management
init-models: ## Initialize LLM models
	@echo "$(BLUE)📥 Initializing models...$(RESET)"
	@if docker-compose -f docker-compose.dev.yml ps | grep -q "ollama"; then \
		docker-compose --profile init -f docker-compose.dev.yml run --rm model-init || echo "$(YELLOW)Model initialization skipped$(RESET)"; \
	else \
		echo "$(YELLOW)⚠️  Ollama not running, skipping model initialization$(RESET)"; \
	fi

models-list: ## List available models
	@echo "$(BLUE)📋 Available models:$(RESET)"
	@docker-compose -f docker-compose.dev.yml exec ollama ollama list 2>/dev/null || \
	docker-compose -f docker-compose.dev.yml exec ollama-cpu ollama list 2>/dev/null || \
	echo "$(YELLOW)⚠️  Ollama not available$(RESET)"

models-pull: ## Pull additional models (specify MODEL=model_name)
	@if [ -z "$(MODEL)" ]; then \
		echo "$(RED)❌ Please specify MODEL name: make models-pull MODEL=llama2$(RESET)"; \
		exit 1; \
	fi
	@echo "$(BLUE)📥 Pulling model: $(MODEL)...$(RESET)"
	@docker-compose -f docker-compose.dev.yml exec ollama ollama pull $(MODEL) || \
	docker-compose -f docker-compose.dev.yml exec ollama-cpu ollama pull $(MODEL)

models-remove: ## Remove model (specify MODEL=model_name)
	@if [ -z "$(MODEL)" ]; then \
		echo "$(RED)❌ Please specify MODEL name: make models-remove MODEL=llama2$(RESET)"; \
		exit 1; \
	fi
	@echo "$(YELLOW)🗑️  Removing model: $(MODEL)...$(RESET)"
	@docker-compose -f docker-compose.dev.yml exec ollama ollama rm $(MODEL) || \
	docker-compose -f docker-compose.dev.yml exec ollama-cpu ollama rm $(MODEL)

# Development Tools
tools: ## Start development tools (Adminer, Redis Commander)
	@echo "$(CYAN)🔧 Starting development tools...$(RESET)"
	@docker-compose --profile tools -f docker-compose.dev.yml up -d
	@echo "$(GREEN)🌐 Development tools available:$(RESET)"
	@echo "   $(CYAN)• Adminer (Database):$(RESET) http://localhost:8080"
	@echo "   $(CYAN)• Redis Commander:$(RESET) http://localhost:8081"

monitoring: ## Start monitoring stack (Prometheus + Grafana)
	@echo "$(YELLOW)📊 Starting monitoring stack...$(RESET)"
	@docker-compose --profile monitoring -f docker-compose.dev.yml up -d
	@echo "$(GREEN)📈 Monitoring stack available:$(RESET)"
	@echo "   $(YELLOW)• Prometheus:$(RESET) http://localhost:9090"
	@echo "   $(YELLOW)• Grafana:$(RESET) http://localhost:3002 (admin/admin)"
	@echo "   $(YELLOW)• Jaeger Tracing:$(RESET) http://localhost:16686"
	@echo "   $(YELLOW)• InfluxDB:$(RESET) http://localhost:8086"

monitoring-full: ## Start complete monitoring infrastructure
	@echo "$(PURPLE)📊 Starting COMPLETE monitoring infrastructure...$(RESET)"
	@if [ -f ./scripts/fix-prometheus.sh ]; then \
		./scripts/fix-prometheus.sh setup; \
	elif [ -f docker-compose.monitoring.yml ]; then \
		docker-compose -f docker-compose.monitoring.yml up -d; \
		echo "$(GREEN)🚀 Full monitoring stack started:$(RESET)"; \
		echo "   $(YELLOW)• Prometheus:$(RESET) http://localhost:9090"; \
		echo "   $(YELLOW)• Grafana:$(RESET) http://localhost:3002"; \
		echo "   $(YELLOW)• Node Exporter:$(RESET) http://localhost:9100"; \
		echo "   $(YELLOW)• cAdvisor:$(RESET) http://localhost:8080"; \
		echo "   $(YELLOW)• Alertmanager:$(RESET) http://localhost:9093"; \
	else \
		echo "$(YELLOW)⚠️  monitoring files not found, using basic monitoring$(RESET)"; \
		$(MAKE) monitoring; \
	fi

fix-prometheus: ## Fix Prometheus configuration and setup
	@echo "$(BLUE)🔧 Fixing Prometheus setup...$(RESET)"
	@if [ -f ./scripts/fix-prometheus.sh ]; then \
		./scripts/fix-prometheus.sh setup; \
	else \
		echo "$(RED)❌ fix-prometheus.sh script not found$(RESET)"; \
	fi

prometheus-start: ## Start Prometheus monitoring
	@./scripts/fix-prometheus.sh start

prometheus-stop: ## Stop Prometheus monitoring
	@./scripts/fix-prometheus.sh stop

prometheus-restart: ## Restart Prometheus monitoring
	@./scripts/fix-prometheus.sh restart

prometheus-status: ## Check Prometheus status
	@./scripts/fix-prometheus.sh status

prometheus-logs: ## Show Prometheus logs
	@./scripts/fix-prometheus.sh logs

prometheus-validate: ## Validate Prometheus setup
	@./scripts/fix-prometheus.sh validate

prometheus-clean: ## Clean Prometheus setup
	@./scripts/fix-prometheus.sh clean

# Status and Logs
status: ## Show service status
	@$(MAKE) show-status

show-status:
	@echo ""
	@echo "$(BLUE)🔍 Service Status:$(RESET)"
	@echo "=================="
	@docker-compose -f docker-compose.dev.yml ps
	@echo ""
	@echo "$(GREEN)🌐 Available Services:$(RESET)"
	@echo "   $(CYAN)• Frontend:$(RESET) http://localhost:3000"
	@echo "   $(CYAN)• Backend API:$(RESET) http://localhost:3001"
	@echo "   $(CYAN)• Backend Health:$(RESET) http://localhost:3001/api/health"
	@echo "   $(CYAN)• Enhanced Health:$(RESET) http://localhost:3001/api/health/comprehensive"
	@echo "   $(CYAN)• Frontend Health:$(RESET) http://localhost:3000/api/health"
	@echo "   $(CYAN)• Ollama API:$(RESET) http://localhost:11434"
	@echo "   $(CYAN)• Redis:$(RESET) localhost:6379"

show-full-status:
	@$(MAKE) show-status
	@echo ""
	@echo "$(PURPLE)🌟 Advanced Features Status:$(RESET)"
	@echo "================================="
	@if [ "$$ENABLE_VOICE_INTERFACE" = "true" ]; then echo "   $(GREEN)✅ Voice Interface (6 languages)$(RESET)"; else echo "   $(YELLOW)⚪ Voice Interface$(RESET)"; fi
	@if [ "$$ENABLE_BLOCKCHAIN_AUDIT" = "true" ]; then echo "   $(GREEN)✅ Blockchain Audit Trail$(RESET)"; else echo "   $(YELLOW)⚪ Blockchain Audit$(RESET)"; fi
	@if [ "$$ENABLE_COLLABORATION" = "true" ]; then echo "   $(GREEN)✅ Real-time Collaboration$(RESET)"; else echo "   $(YELLOW)⚪ Collaboration$(RESET)"; fi
	@if [ "$$ENABLE_MONITORING" = "true" ]; then echo "   $(GREEN)✅ Advanced Monitoring$(RESET)"; else echo "   $(YELLOW)⚪ Advanced Monitoring$(RESET)"; fi
	@if [ "$$MULTI_TENANT_MODE" = "true" ]; then echo "   $(GREEN)✅ Multi-Tenant Architecture$(RESET)"; else echo "   $(YELLOW)⚪ Multi-Tenant$(RESET)"; fi

# Health Checks
health: ## Run health checks for all services
	@echo "$(GREEN)🏥 Running health checks...$(RESET)"
	@if [ -f ./scripts/health-check.sh ]; then \
		./scripts/health-check.sh; \
	else \
		echo "$(YELLOW)⚠️  Health check script not found, running basic checks...$(RESET)"; \
		$(MAKE) health-basic; \
	fi

health-detailed: ## Run detailed health checks
	@echo "$(GREEN)🏥 Running detailed health checks...$(RESET)"
	@if [ -f ./scripts/health-check-comprehensive.sh ]; then \
		./scripts/health-check-comprehensive.sh; \
	else \
		echo "$(YELLOW)⚠️  Comprehensive health check script not found$(RESET)"; \
		$(MAKE) health; \
	fi

health-basic: ## Basic health check using curl
	@echo "$(BLUE)🔍 Basic Health Checks:$(RESET)"
	@echo -n "Frontend: "; curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null || echo "❌ Down"
	@echo -n "Backend: "; curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health 2>/dev/null || echo "❌ Down"
	@echo -n "Ollama: "; curl -s -o /dev/null -w "%{http_code}" http://localhost:11434/api/version 2>/dev/null || echo "❌ Down"

health-watch: ## Watch health status (updates every 5 seconds)
	@echo "$(BLUE)👀 Watching health status (Ctrl+C to stop)...$(RESET)"
	@if command -v watch >/dev/null 2>&1; then \
		watch -n 5 "$(MAKE) health-basic"; \
	else \
		echo "$(YELLOW)⚠️  'watch' command not found, running health check once$(RESET)"; \
		$(MAKE) health-basic; \
	fi

# Logging
logs: ## Show logs for all services
	@docker-compose -f docker-compose.dev.yml logs -f

logs-frontend: ## Show frontend logs
	@docker-compose -f docker-compose.dev.yml logs -f frontend

logs-backend: ## Show backend logs
	@if docker-compose -f docker-compose.dev.yml ps | grep -q "backend "; then \
		docker-compose -f docker-compose.dev.yml logs -f backend; \
	else \
		docker-compose -f docker-compose.dev.yml logs -f backend-cpu; \
	fi

logs-ollama: ## Show Ollama logs
	@docker-compose -f docker-compose.dev.yml logs -f ollama ollama-cpu 2>/dev/null || \
	echo "$(YELLOW)⚠️  Ollama containers not running$(RESET)"

logs-monitoring: ## Show monitoring logs
	@docker-compose --profile monitoring -f docker-compose.dev.yml logs -f

logs-follow: ## Follow logs with service names (specify SERVICE=name)
	@if [ -z "$(SERVICE)" ]; then \
		echo "$(BLUE)Available services:$(RESET) frontend, backend, ollama, redis, monitoring"; \
		echo "Usage: make logs-follow SERVICE=backend"; \
	else \
		docker-compose -f docker-compose.dev.yml logs -f $(SERVICE); \
	fi

# Testing
test: ## Run all tests
	@echo "$(GREEN)🧪 Running all tests...$(RESET)"
	@$(MAKE) test-backend
	@$(MAKE) test-frontend

test-backend: ## Run backend tests only
	@echo "$(BLUE)🧪 Running backend tests...$(RESET)"
	@if docker-compose -f docker-compose.dev.yml ps | grep -q "backend "; then \
		docker-compose -f docker-compose.dev.yml exec backend npm test; \
	else \
		docker-compose -f docker-compose.dev.yml exec backend-cpu npm test; \
	fi

test-frontend: ## Run frontend tests only
	@echo "$(BLUE)🧪 Running frontend tests...$(RESET)"
	@docker-compose -f docker-compose.dev.yml exec frontend npm test

test-watch: ## Run tests in watch mode (specify SERVICE=backend or frontend)
	@if [ -z "$(SERVICE)" ]; then \
		echo "$(RED)❌ Please specify SERVICE: make test-watch SERVICE=backend$(RESET)"; \
		exit 1; \
	fi
	@echo "$(BLUE)🧪 Running $(SERVICE) tests in watch mode...$(RESET)"
	@docker-compose -f docker-compose.dev.yml exec $(SERVICE) npm run test:watch

test-coverage: ## Run tests with coverage
	@echo "$(GREEN)📊 Running tests with coverage...$(RESET)"
	@docker-compose -f docker-compose.dev.yml exec backend npm run test:coverage
	@docker-compose -f docker-compose.dev.yml exec frontend npm run test:coverage

test-e2e: ## Run end-to-end tests
	@echo "$(PURPLE)🎭 Running E2E tests...$(RESET)"
	@if docker-compose -f docker-compose.dev.yml ps | grep -q "frontend.*Up"; then \
		docker-compose -f docker-compose.dev.yml exec frontend npm run test:e2e; \
	else \
		echo "$(RED)❌ Frontend not running. Start with 'make dev' first.$(RESET)"; \
	fi

# Database Management
db-reset: ## Reset development database
	@echo "$(YELLOW)🗄️ Resetting database...$(RESET)"
	@if docker-compose -f docker-compose.dev.yml ps | grep -q "backend"; then \
		docker-compose -f docker-compose.dev.yml exec backend rm -f /app/data/database.sqlite; \
		docker-compose -f docker-compose.dev.yml restart backend; \
		echo "$(GREEN)✅ Database reset complete$(RESET)"; \
	else \
		echo "$(RED)❌ Backend not running$(RESET)"; \
	fi

db-backup: ## Backup development database
	@echo "$(BLUE)💾 Backing up database...$(RESET)"
	@if docker-compose -f docker-compose.dev.yml ps | grep -q "backend"; then \
		BACKUP_FILE="backup-$$(date +%Y%m%d-%H%M%S).sqlite"; \
		docker cp $$(docker-compose -f docker-compose.dev.yml ps -q backend | head -1):/app/data/database.sqlite ./$$BACKUP_FILE; \
		echo "$(GREEN)✅ Database backed up to $$BACKUP_FILE$(RESET)"; \
	else \
		echo "$(RED)❌ Backend not running$(RESET)"; \
	fi

db-migrate: ## Run database migrations
	@echo "$(BLUE)🔄 Running database migrations...$(RESET)"
	@if docker-compose -f docker-compose.dev.yml ps | grep -q "backend"; then \
		docker-compose -f docker-compose.dev.yml exec backend npm run migrate; \
		echo "$(GREEN)✅ Migrations complete$(RESET)"; \
	else \
		echo "$(RED)❌ Backend not running$(RESET)"; \
	fi

db-seed: ## Seed database with sample data
	@echo "$(BLUE)🌱 Seeding database...$(RESET)"
	@if docker-compose -f docker-compose.dev.yml ps | grep -q "backend"; then \
		docker-compose -f docker-compose.dev.yml exec backend npm run seed; \
		echo "$(GREEN)✅ Database seeded$(RESET)"; \
	else \
		echo "$(RED)❌ Backend not running$(RESET)"; \
	fi

# Security
security-scan: ## Run security scans
	@echo "$(RED)🛡️ Running security scans...$(RESET)"
	@if [ -f ./scripts/security-test.sh ]; then \
		./scripts/security-test.sh; \
	else \
		echo "$(YELLOW)⚠️  Security test script not found$(RESET)"; \
	fi

security-audit: ## Audit npm packages for vulnerabilities
	@echo "$(RED)🔍 Auditing npm packages...$(RESET)"
	@docker-compose -f docker-compose.dev.yml exec backend npm audit
	@docker-compose -f docker-compose.dev.yml exec frontend npm audit

# Performance
benchmark: ## Run performance benchmarks
	@echo "$(PURPLE)⚡ Running performance benchmarks...$(RESET)"
	@if docker-compose -f docker-compose.dev.yml ps | grep -q "backend"; then \
		docker-compose -f docker-compose.dev.yml exec backend npm run benchmark; \
	else \
		echo "$(RED)❌ Backend not running$(RESET)"; \
	fi

load-test: ## Run load tests (requires backend running)
	@echo "$(PURPLE)🔥 Running load tests...$(RESET)"
	@if command -v ab >/dev/null 2>&1; then \
		ab -n 1000 -c 10 http://localhost:3001/api/health; \
	else \
		echo "$(YELLOW)⚠️  Apache Bench (ab) not found. Install with: apt-get install apache2-utils$(RESET)"; \
	fi

# Cleanup
stop: ## Stop all services
	@echo "$(YELLOW)🛑 Stopping development environment...$(RESET)"
	@docker-compose -f docker-compose.dev.yml down
	@if [ -f docker-compose.monitoring.yml ]; then \
		docker-compose -f docker-compose.monitoring.yml down; \
	fi

clean: ## Stop and remove all containers, networks, and volumes
	@echo "$(RED)🧹 Cleaning up development environment...$(RESET)"
	@docker-compose -f docker-compose.dev.yml down -v --remove-orphans
	@if [ -f docker-compose.monitoring.yml ]; then \
		docker-compose -f docker-compose.monitoring.yml down -v --remove-orphans; \
	fi
	@docker system prune -f
	@echo "$(GREEN)✅ Cleanup complete$(RESET)"

clean-all: ## Deep clean including images and build cache
	@echo "$(RED)🔥 Deep cleaning (including images)...$(RESET)"
	@$(MAKE) clean
	@docker image prune -a -f
	@docker builder prune -f
	@echo "$(GREEN)✅ Deep clean complete$(RESET)"

# Restart Commands
restart: ## Restart all services
	@echo "$(BLUE)🔄 Restarting development environment...$(RESET)"
	@$(MAKE) stop
	@sleep 2
	@$(MAKE) dev

restart-backend: ## Restart backend service only
	@echo "$(BLUE)🔄 Restarting backend...$(RESET)"
	@if docker-compose -f docker-compose.dev.yml ps | grep -q "backend "; then \
		docker-compose -f docker-compose.dev.yml restart backend; \
	else \
		docker-compose -f docker-compose.dev.yml restart backend-cpu; \
	fi

restart-frontend: ## Restart frontend service only
	@echo "$(BLUE)🔄 Restarting frontend...$(RESET)"
	@docker-compose -f docker-compose.dev.yml restart frontend

restart-service: ## Restart specific service (specify SERVICE=name)
	@if [ -z "$(SERVICE)" ]; then \
		echo "$(RED)❌ Please specify SERVICE: make restart-service SERVICE=backend$(RESET)"; \
		exit 1; \
	fi
	@echo "$(BLUE)🔄 Restarting $(SERVICE)...$(RESET)"
	@docker-compose -f docker-compose.dev.yml restart $(SERVICE)

# Build Commands
build: ## Build all development images
	@echo "$(PURPLE)🏗️ Building development images...$(RESET)"
	@docker-compose -f docker-compose.dev.yml build

build-backend: ## Build backend image only
	@echo "$(BLUE)🏗️ Building backend image...$(RESET)"
	@docker-compose -f docker-compose.dev.yml build backend

build-frontend: ## Build frontend image only
	@echo "$(BLUE)🏗️ Building frontend image...$(RESET)"
	@docker-compose -f docker-compose.dev.yml build frontend

build-no-cache: ## Build all images without cache
	@echo "$(PURPLE)🏗️ Building images without cache...$(RESET)"
	@docker-compose -f docker-compose.dev.yml build --no-cache

# Shell Access
shell-backend: ## Open shell in backend container
	@if docker-compose -f docker-compose.dev.yml ps | grep -q "backend "; then \
		docker-compose -f docker-compose.dev.yml exec backend sh; \
	else \
		docker-compose -f docker-compose.dev.yml exec backend-cpu sh; \
	fi

shell-frontend: ## Open shell in frontend container
	@docker-compose -f docker-compose.dev.yml exec frontend sh

shell-ollama: ## Open shell in Ollama container
	@docker-compose -f docker-compose.dev.yml exec ollama sh 2>/dev/null || \
	docker-compose -f docker-compose.dev.yml exec ollama-cpu sh 2>/dev/null || \
	echo "$(RED)❌ Ollama container not running$(RESET)"

shell-redis: ## Open Redis CLI
	@docker-compose -f docker-compose.dev.yml exec redis redis-cli

# Development Utilities
npm-install: ## Install npm dependencies (specify SERVICE=backend or frontend)
	@if [ -z "$(SERVICE)" ]; then \
		echo "$(RED)❌ Please specify SERVICE: make npm-install SERVICE=backend$(RESET)"; \
		exit 1; \
	fi
	@echo "$(BLUE)📦 Installing npm dependencies for $(SERVICE)...$(RESET)"
	@docker-compose -f docker-compose.dev.yml exec $(SERVICE) npm install

npm-update: ## Update npm dependencies (specify SERVICE=backend or frontend)
	@if [ -z "$(SERVICE)" ]; then \
		echo "$(RED)❌ Please specify SERVICE: make npm-update SERVICE=backend$(RESET)"; \
		exit 1; \
	fi
	@echo "$(YELLOW)🔄 Updating npm dependencies for $(SERVICE)...$(RESET)"
	@docker-compose -f docker-compose.dev.yml exec $(SERVICE) npm update

lint: ## Run linting for all services
	@echo "$(BLUE)🔍 Running linting...$(RESET)"
	@docker-compose -f docker-compose.dev.yml exec backend npm run lint
	@docker-compose -f docker-compose.dev.yml exec frontend npm run lint

lint-fix: ## Fix linting issues
	@echo "$(YELLOW)🔧 Fixing linting issues...$(RESET)"
	@docker-compose -f docker-compose.dev.yml exec backend npm run lint:fix
	@docker-compose -f docker-compose.dev.yml exec frontend npm run lint:fix

format: ## Format code with prettier
	@echo "$(BLUE)✨ Formatting code...$(RESET)"
	@docker-compose -f docker-compose.dev.yml exec backend npm run format
	@docker-compose -f docker-compose.dev.yml exec frontend npm run format

# Documentation
docs: ## Generate/serve documentation
	@echo "$(BLUE)📚 Documentation commands:$(RESET)"
	@echo "   • Main docs are in ./docs/"
	@echo "   • API docs: http://localhost:3001/api/docs (when backend running)"
	@echo "   • README: ./README.md"

docs-api: ## Open API documentation
	@if command -v xdg-open >/dev/null 2>&1; then \
		xdg-open http://localhost:3001/api/docs; \
	elif command -v open >/dev/null 2>&1; then \
		open http://localhost:3001/api/docs; \
	else \
		echo "$(BLUE)📖 API docs available at: http://localhost:3001/api/docs$(RESET)"; \
	fi

# Production Preparation
prod-check: ## Check production readiness
	@echo "$(PURPLE)🚀 Checking production readiness...$(RESET)"
	@$(MAKE) test
	@$(MAKE) security-audit
	@$(MAKE) lint
	@echo "$(GREEN)✅ Production checks complete$(RESET)"

# Information Commands
info: ## Show system information
	@echo "$(BLUE)ℹ️  System Information:$(RESET)"
	@echo "Docker version: $$(docker --version)"
	@echo "Docker Compose version: $$(docker-compose --version)"
	@echo "Node.js (host): $$(node --version 2>/dev/null || echo 'Not installed')"
	@echo "NPM (host): $$(npm --version 2>/dev/null || echo 'Not installed')"
	@echo "GPU Support: $$(nvidia-smi --version 2>/dev/null | head -1 || echo 'Not available')"
	@echo "Available Memory: $$(free -h 2>/dev/null | grep ^Mem || echo 'Unknown')"
	@echo "Disk Space: $$(df -h . 2>/dev/null | tail -1 || echo 'Unknown')"

urls: ## Show all service URLs
	@echo "$(GREEN)🌐 Service URLs:$(RESET)"
	@echo "================================"
	@echo "$(CYAN)Development:$(RESET)"
	@echo "   • Frontend: http://localhost:3000"
	@echo "   • Backend API: http://localhost:3001"
	@echo "   • Health Check: http://localhost:3001/api/health"
	@echo ""
	@echo "$(YELLOW)Development Tools:$(RESET)"
	@echo "   • Adminer: http://localhost:8080"
	@echo "   • Redis Commander: http://localhost:8081"
	@echo ""
	@echo "$(PURPLE)Monitoring:$(RESET)"
	@echo "   • Prometheus: http://localhost:9090"
	@echo "   • Grafana: http://localhost:3002"
	@echo "   • Jaeger: http://localhost:16686"
	@echo ""
	@echo "$(BLUE)AI Services:$(RESET)"
	@echo "   • Ollama API: http://localhost:11434"

# Quick Development Workflows
quick-test: ## Quick test cycle (lint + test)
	@echo "$(GREEN)⚡ Quick test cycle...$(RESET)"
	@$(MAKE) lint
	@$(MAKE) test

quick-fix: ## Quick fix cycle (format + lint-fix + test)
	@echo "$(YELLOW)🔧 Quick fix cycle...$(RESET)"
	@$(MAKE) format
	@$(MAKE) lint-fix
	@$(MAKE) test

# Feature Demos
demo-voice: ## Demo Voice Interface features
	@echo "$(PURPLE)🎤 Voice Interface Demo:$(RESET)"
	@echo "1. Start with: make dev-voice"
	@echo "2. Visit: http://localhost:3000"
	@echo "3. Try voice commands like:"
	@echo "   • 'Create a new prompt for customer service'"
	@echo "   • 'Show me today's analytics'"
	@echo "   • 'Run the marketing test'"

demo-blockchain: ## Demo Blockchain Audit features
	@echo "$(BLUE)🔗 Blockchain Audit Demo:$(RESET)"
	@echo "1. Start with: make dev-blockchain"
	@echo "2. Check audit trail: http://localhost:3001/api/blockchain/stats"
	@echo "3. All actions are automatically recorded on blockchain"

demo-collaboration: ## Demo Real-time Collaboration
	@echo "$(CYAN)🤝 Collaboration Demo:$(RESET)"
	@echo "1. Start with: make dev-collaboration"
	@echo "2. Open multiple browser tabs"
	@echo "3. Edit prompts simultaneously and see real-time sync"

# Advanced Troubleshooting
debug: ## Start debug mode with verbose logging
	@echo "$(RED)🐛 Starting debug mode...$(RESET)"
	@DEBUG=* $(MAKE) dev

debug-backend: ## Debug backend with inspector
	@echo "$(RED)🐛 Backend debug mode (inspector on port 9229)...$(RESET)"
	@docker-compose -f docker-compose.dev.yml up -d backend
	@echo "$(YELLOW)Connect debugger to: localhost:9229$(RESET)"

debug-logs: ## Show debug logs with timestamps
	@docker-compose -f docker-compose.dev.yml logs -f --timestamps

troubleshoot: ## Run troubleshooting diagnostics
	@echo "$(YELLOW)🔧 Running troubleshooting diagnostics...$(RESET)"
	@$(MAKE) info
	@echo ""
	@$(MAKE) health-basic
	@echo ""
	@echo "$(BLUE)Container Status:$(RESET)"
	@docker-compose -f docker-compose.dev.yml ps
	@echo ""
	@echo "$(BLUE)Recent Logs (last 20 lines):$(RESET)"
	@docker-compose -f docker-compose.dev.yml logs --tail=20

# Git Helpers
git-hooks: ## Install git hooks for development
	@echo "$(BLUE)🔗 Installing git hooks...$(RESET)"
	@if [ -d .git ]; then \
		echo "#!/bin/sh\nmake lint-fix && make test" > .git/hooks/pre-commit; \
		chmod +x .git/hooks/pre-commit; \
		echo "$(GREEN)✅ Pre-commit hook installed$(RESET)"; \
	else \
		echo "$(YELLOW)⚠️  Not a git repository$(RESET)"; \
	fi

git-clean: ## Clean git ignored files (be careful!)
	@echo "$(RED)⚠️  This will remove all git-ignored files$(RESET)"
	@read -p "Are you sure? (y/N): " confirm && [ "$$confirm" = "y" ] || exit 1
	@git clean -fdx

# Configuration
config-check: ## Check configuration files
	@echo "$(BLUE)⚙️  Checking configuration files...$(RESET)"
	@for file in .env .env.dev docker-compose.dev.yml; do \
		if [ -f "$$file" ]; then \
			echo "$(GREEN)✅ $$file exists$(RESET)"; \
		else \
			echo "$(RED)❌ $$file missing$(RESET)"; \
		fi; \
	done

config-validate: ## Validate docker-compose configuration
	@echo "$(BLUE)✅ Validating docker-compose configuration...$(RESET)"
	@docker-compose -f docker-compose.dev.yml config >/dev/null && \
	echo "$(GREEN)✅ Configuration valid$(RESET)" || \
	echo "$(RED)❌ Configuration invalid$(RESET)"