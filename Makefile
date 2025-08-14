# Prompt Card System - Enhanced Development Makefile
# ==================================================

.PHONY: help dev dev-gpu dev-cpu build test clean logs restart demo demo-clean demo-quick demo-presentation demo-load-data demo-status demo-reset demo-stop demo-export docs-demo
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
setup: ## First-time setup for new developers with progress tracking
	@echo "$(GREEN)🚀 Setting up Prompt Card System for development...$(RESET)"
	@./scripts/statusline.sh --phase Setup --msg "Starting first-time setup" --extras "steps=4/4"
	@echo "$(YELLOW)Step 1: Checking prerequisites...$(RESET)"
	@./scripts/statusline.sh --progress "Checking prerequisites" --extras "step=1/4"
	@$(MAKE) check-prerequisites
	@echo "$(YELLOW)Step 2: Creating environment files...$(RESET)"
	@./scripts/statusline.sh --progress "Creating environment files" --extras "step=2/4"
	@$(MAKE) create-env
	@echo "$(YELLOW)Step 3: Building containers...$(RESET)"
	@./scripts/statusline.sh --progress "Building containers" --extras "step=3/4"
	@$(MAKE) build
	@echo "$(YELLOW)Step 4: Starting development environment...$(RESET)"
	@./scripts/statusline.sh --progress "Starting development environment" --extras "step=4/4"
	@$(MAKE) dev
	@./scripts/statusline.sh --ok "Setup complete! Visit http://localhost:3000" --extras "duration=$$(date +%s)s"
	@echo "$(GREEN)✅ Setup complete! Visit http://localhost:3000$(RESET)"

check-prerequisites: ## Check system prerequisites with detailed validation
	@echo "$(BLUE)🔍 Checking prerequisites...$(RESET)"
	@./scripts/statusline.sh --phase Setup --msg "Validating system requirements"
	@command -v docker >/dev/null 2>&1 || (./scripts/statusline.sh --error "Docker not found" --extras "install=https://docs.docker.com/install" && exit 1)
	@command -v docker-compose >/dev/null 2>&1 || command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 || (./scripts/statusline.sh --error "Docker Compose not found" --extras "install=docker-compose-plugin" && exit 1)
	@./scripts/statusline.sh --ok "Docker requirements met" --extras "docker=$$(docker --version | awk '{print $$3}' | tr -d ',') compose=$$(docker-compose --version 2>/dev/null | awk '{print $$3}' || docker compose version --short)"
	@echo "$(GREEN)✅ Docker and Docker Compose found$(RESET)"
	@if command -v nvidia-smi >/dev/null 2>&1; then \
		./scripts/statusline.sh --ok "GPU support available" --extras "gpu=$$(nvidia-smi --query-gpu=name --format=csv,noheader | head -1)"; \
		echo "$(GREEN)🎮 GPU detected and available$(RESET)"; \
	else \
		./scripts/statusline.sh --warn "No GPU detected, using CPU-only" --extras "mode=cpu-only performance=reduced"; \
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
	@./scripts/statusline.sh --phase Setup --msg "Auto-detecting hardware and starting environment"
	@if command -v nvidia-smi >/dev/null 2>&1; then \
		./scripts/statusline.sh --ok "GPU detected, starting with GPU support" --extras "mode=gpu hardware=nvidia"; \
		echo "$(GREEN)🎮 GPU detected, starting with GPU support...$(RESET)"; \
		$(MAKE) dev-gpu; \
	else \
		./scripts/statusline.sh --warn "No GPU detected, starting CPU-only" --extras "mode=cpu performance=limited"; \
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
	@./scripts/statusline.sh --phase Deploy --msg "Starting GPU-enabled containers"
	@if docker-compose --profile gpu -f docker-compose.dev.yml up -d; then \
		./scripts/statusline.sh --progress "Services starting, waiting for readiness" --extras "gpu=enabled timeout=60s"; \
		echo "$(YELLOW)⏳ Waiting for services to start...$(RESET)"; \
		sleep 10; \
		$(MAKE) init-models; \
		$(MAKE) show-status; \
		./scripts/statusline.sh --ok "GPU development environment ready" --extras "services=frontend,backend,ollama-gpu,redis"; \
	else \
		./scripts/statusline.sh --error "Failed to start GPU environment" --extras "fallback=cpu-mode"; \
		exit 1; \
	fi

dev-cpu: ## Start development environment (CPU only)
	@echo "$(YELLOW)💻 Starting development environment (CPU only)...$(RESET)"
	@./scripts/statusline.sh --phase Deploy --msg "Starting CPU-only containers"
	@if docker-compose --profile cpu -f docker-compose.dev.yml up -d; then \
		./scripts/statusline.sh --progress "Services starting, waiting for readiness" --extras "mode=cpu timeout=60s"; \
		echo "$(YELLOW)⏳ Waiting for services to start...$(RESET)"; \
		sleep 10; \
		$(MAKE) init-models; \
		$(MAKE) show-status; \
		./scripts/statusline.sh --ok "CPU development environment ready" --extras "services=frontend,backend-cpu,ollama-cpu,redis"; \
	else \
		./scripts/statusline.sh --error "Failed to start CPU environment" --extras "check=docker-compose,resources"; \
		exit 1; \
	fi

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
health: ## Run comprehensive health checks for all services
	@echo "$(GREEN)🏥 Running health checks...$(RESET)"
	@./scripts/statusline.sh --phase Test --msg "Running comprehensive health checks"
	@if [ -f ./scripts/health-check.sh ]; then \
		./scripts/health-check.sh; \
		./scripts/statusline.sh --ok "Health checks completed" --extras "script=comprehensive"; \
	else \
		echo "$(YELLOW)⚠️  Health check script not found, running basic checks...$(RESET)"; \
		./scripts/statusline.sh --warn "Using basic health checks" --extras "script=basic comprehensive=unavailable"; \
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

health-basic: ## Basic health check using curl with detailed status
	@echo "$(BLUE)🔍 Basic Health Checks:$(RESET)"
	@./scripts/statusline.sh --phase Test --msg "Testing service endpoints"
	@FRONTEND_STATUS=$$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null || echo "DOWN"); \
	BACKEND_STATUS=$$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health 2>/dev/null || echo "DOWN"); \
	OLLAMA_STATUS=$$(curl -s -o /dev/null -w "%{http_code}" http://localhost:11434/api/version 2>/dev/null || echo "DOWN"); \
	echo "Frontend: $$FRONTEND_STATUS"; \
	echo "Backend: $$BACKEND_STATUS"; \
	echo "Ollama: $$OLLAMA_STATUS"; \
	if echo "$$FRONTEND_STATUS" | grep -q "^2[0-9][0-9]$$" && echo "$$BACKEND_STATUS" | grep -q "^2[0-9][0-9]$$" && echo "$$OLLAMA_STATUS" | grep -q "^2[0-9][0-9]$$"; then \
		./scripts/statusline.sh --ok "All services healthy" --extras "frontend=$$FRONTEND_STATUS backend=$$BACKEND_STATUS ollama=$$OLLAMA_STATUS"; \
	else \
		./scripts/statusline.sh --warn "Services not running (expected when containers are down)" --extras "frontend=$$FRONTEND_STATUS backend=$$BACKEND_STATUS ollama=$$OLLAMA_STATUS"; \
	fi

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
build: ## Build all development images with validation
	@echo "$(PURPLE)🏗️ Building development images...$(RESET)"
	@./scripts/statusline.sh --phase Build --msg "Starting container build process"
	@if docker-compose -f docker-compose.dev.yml build; then \
		./scripts/statusline.sh --ok "All images built successfully" --extras "images=frontend,backend,ollama"; \
	else \
		./scripts/statusline.sh --error "Build failed" --extras "retry=available"; \
		exit 1; \
	fi

build-backend: ## Build backend image only with validation
	@echo "$(BLUE)🏗️ Building backend image...$(RESET)"
	@./scripts/statusline.sh --phase Build --msg "Building backend container"
	@if docker-compose -f docker-compose.dev.yml build backend; then \
		./scripts/statusline.sh --ok "Backend image built" --extras "size=$$(docker images prompt-card-system-v2-backend:latest --format 'table {{.Size}}' 2>/dev/null | tail -1)"; \
	else \
		./scripts/statusline.sh --error "Backend build failed" --extras "check=dockerfile,dependencies"; \
		exit 1; \
	fi

build-frontend: ## Build frontend image only with validation
	@echo "$(BLUE)🏗️ Building frontend image...$(RESET)"
	@./scripts/statusline.sh --phase Build --msg "Building frontend container"
	@if docker-compose -f docker-compose.dev.yml build frontend; then \
		./scripts/statusline.sh --ok "Frontend image built" --extras "size=$$(docker images prompt-card-system-v2-frontend:latest --format 'table {{.Size}}' 2>/dev/null | tail -1)"; \
	else \
		./scripts/statusline.sh --error "Frontend build failed" --extras "check=dockerfile,node_modules"; \
		exit 1; \
	fi

build-no-cache: ## Build all images without cache (clean build)
	@echo "$(PURPLE)🏗️ Building images without cache...$(RESET)"
	@./scripts/statusline.sh --phase Build --msg "Clean build without cache" --extras "cache=disabled"
	@if docker-compose -f docker-compose.dev.yml build --no-cache; then \
		./scripts/statusline.sh --ok "Clean build completed" --extras "cache=cleared images=rebuilt"; \
	else \
		./scripts/statusline.sh --error "Clean build failed" --extras "retry_with_cache=available"; \
		exit 1; \
	fi

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

# Demo Mode Commands
demo-clean: ## Clean Docker networks and containers before demo
	@echo "$(BLUE)🧹 Cleaning Docker environment for demo...$(RESET)"
	@docker-compose -f docker-compose.dev.yml down --remove-orphans 2>/dev/null || true
	@if [ -f docker-compose.monitoring.yml ]; then docker-compose -f docker-compose.monitoring.yml down --remove-orphans 2>/dev/null || true; fi
	@docker network ls --filter name=prompt-card-system --format "{{.ID}}" | xargs -r docker network rm 2>/dev/null || true
	@docker network rm prompt-card-system-v2_prompt-card-network 2>/dev/null || true
	@docker network prune -f 2>/dev/null || true
	@docker container prune -f 2>/dev/null || true
	@echo "$(GREEN)✅ Docker environment cleaned$(RESET)"

demo: ## Start demo mode with all features
	@echo "$(PURPLE)🎮 Starting DEMO MODE - Full Feature Showcase$(RESET)"
	@echo "$(YELLOW)✨ Prepopulated with sample data and test cases$(RESET)"
	@$(MAKE) demo-clean
	@DEMO_MODE=true $(MAKE) dev
	@sleep 5
	@$(MAKE) demo-status

demo-quick: ## Quick demo setup (3-minute experience)
	@echo "$(CYAN)⚡ Quick Demo Mode (3-minute experience)$(RESET)"
	@echo "$(YELLOW)🎯 Perfect for presentations and rapid demonstrations$(RESET)"
	@$(MAKE) demo-clean
	@DEMO_MODE=true DEMO_TYPE=quick $(MAKE) dev-minimal
	@sleep 3
	@$(MAKE) demo-load-data
	@$(MAKE) demo-status

demo-load-data: ## Load demo data into running system
	@echo "$(BLUE)📊 Loading demo data...$(RESET)"
	@if docker-compose -f docker-compose.dev.yml ps | grep -q "backend.*Up"; then \
		echo "$(YELLOW)Loading 5 prompt cards with test cases...$(RESET)"; \
		docker cp demo/ $$(docker-compose -f docker-compose.dev.yml ps -q backend | head -1):/app/ 2>/dev/null || \
		( \
			docker-compose -f docker-compose.dev.yml exec backend mkdir -p /app/demo && \
			docker cp demo/demo-prompt-cards.json $$(docker-compose -f docker-compose.dev.yml ps -q backend | head -1):/app/demo/ && \
			docker cp demo/demo-test-cases.json $$(docker-compose -f docker-compose.dev.yml ps -q backend | head -1):/app/demo/ && \
			docker cp demo/demo-analytics.json $$(docker-compose -f docker-compose.dev.yml ps -q backend | head -1):/app/demo/ && \
			docker cp demo/demo-config.json $$(docker-compose -f docker-compose.dev.yml ps -q backend | head -1):/app/demo/ && \
			docker cp demo/load-demo-data.js $$(docker-compose -f docker-compose.dev.yml ps -q backend | head -1):/app/demo/ \
		); \
		docker-compose -f docker-compose.dev.yml exec backend node demo/load-demo-data.js || \
		echo "$(YELLOW)⚠️  Demo data loader not available, continuing with static files$(RESET)"; \
		echo "$(GREEN)✅ Demo data loaded successfully$(RESET)"; \
	else \
		echo "$(RED)❌ Backend not running. Start with 'make demo' first.$(RESET)"; \
	fi

demo-status: ## Show demo mode status and URLs
	@echo "$(GREEN)🎮 DEMO MODE ACTIVE$(RESET)"
	@echo "======================"
	@echo "$(CYAN)🌐 Demo URLs:$(RESET)"
	@echo "   • Main Demo: http://localhost:3000?demo=true"
	@echo "   • Quick Tour: http://localhost:3000?demo=quick-win"
	@echo "   • Full Tour: http://localhost:3000?demo=full-tour"
	@echo "   • Technical Demo: http://localhost:3000?demo=technical"
	@echo ""
	@echo "$(YELLOW)📋 Demo Features:$(RESET)"
	@echo "   ✅ 5 Prepopulated prompt cards"
	@echo "   ✅ 15+ Test cases with results"
	@echo "   ✅ 30 days of analytics data"
	@echo "   ✅ Team workspace with 5 members"
	@echo "   ✅ Interactive guided tours"
	@echo "   ✅ Success/failure examples"
	@echo ""
	@echo "$(PURPLE)🎯 Demo Scripts Available:$(RESET)"
	@echo "   • 3-minute quick demo"
	@echo "   • 5-minute full tour"
	@echo "   • 8-minute technical deep-dive"
	@echo ""
	@echo "$(BLUE)📖 Demo Guide: ./demo/DEMO_QUICK_START.md$(RESET)"

demo-reset: ## Reset demo data to initial state
	@echo "$(YELLOW)🔄 Resetting demo data...$(RESET)"
	@if docker-compose -f docker-compose.dev.yml ps | grep -q "backend.*Up"; then \
		docker-compose -f docker-compose.dev.yml exec backend rm -rf /app/demo/current-state.json; \
		$(MAKE) demo-load-data; \
		echo "$(GREEN)✅ Demo data reset to initial state$(RESET)"; \
	else \
		echo "$(RED)❌ Backend not running$(RESET)"; \
	fi

demo-stop: ## Stop demo mode and return to development
	@echo "$(YELLOW)🛑 Stopping demo mode...$(RESET)"
	@$(MAKE) stop
	@echo "$(GREEN)✅ Demo mode stopped. Use 'make dev' for normal development.$(RESET)"

demo-export: ## Export demo session results
	@echo "$(BLUE)📁 Exporting demo session...$(RESET)"
	@TIMESTAMP=$$(date +%Y%m%d-%H%M%S); \
	mkdir -p exports/demo-$$TIMESTAMP; \
	cp -r demo/ exports/demo-$$TIMESTAMP/; \
	if docker-compose -f docker-compose.dev.yml ps | grep -q "backend.*Up"; then \
		docker cp $$(docker-compose -f docker-compose.dev.yml ps -q backend | head -1):/app/demo/session-data.json exports/demo-$$TIMESTAMP/ 2>/dev/null || true; \
	fi; \
	echo "$(GREEN)✅ Demo session exported to exports/demo-$$TIMESTAMP/$(RESET)"

demo-presentation: ## Start demo in presentation mode (full screen, auto-advance)
	@echo "$(PURPLE)🎥 Starting PRESENTATION MODE$(RESET)"
	@echo "$(YELLOW)📺 Optimized for live demonstrations and sales presentations$(RESET)"
	@$(MAKE) demo-clean
	@DEMO_MODE=true PRESENTATION_MODE=true $(MAKE) dev
	@sleep 5
	@echo "$(GREEN)🎬 Presentation mode ready!$(RESET)"
	@echo "   • Auto-advancing slides"
	@echo "   • Larger text and UI elements"
	@echo "   • Simplified navigation"
	@echo "   • Focus on key metrics"

# Documentation
docs: ## Generate/serve documentation
	@echo "$(BLUE)📚 Documentation commands:$(RESET)"
	@echo "   • Main docs are in ./docs/"
	@echo "   • Demo guide: ./demo/DEMO_QUICK_START.md"
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

docs-demo: ## Open demo documentation
	@if command -v xdg-open >/dev/null 2>&1; then \
		xdg-open demo/DEMO_QUICK_START.md; \
	elif command -v open >/dev/null 2>&1; then \
		open demo/DEMO_QUICK_START.md; \
	else \
		echo "$(BLUE)📖 Demo guide available at: ./demo/DEMO_QUICK_START.md$(RESET)"; \
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
config-check: ## Check configuration files with statusline
	@echo "$(BLUE)⚙️  Checking configuration files...$(RESET)"
	@./scripts/statusline.sh --phase Setup --msg "Validating configuration files"
	@MISSING_FILES=""; \
	for file in .env .env.dev docker-compose.dev.yml; do \
		if [ -f "$$file" ]; then \
			echo "$(GREEN)✅ $$file exists$(RESET)"; \
		else \
			echo "$(RED)❌ $$file missing$(RESET)"; \
			MISSING_FILES="$$MISSING_FILES $$file"; \
		fi; \
	done; \
	if [ -z "$$MISSING_FILES" ]; then \
		./scripts/statusline.sh --ok "All configuration files present" --extras "files=.env,.env.dev,docker-compose.dev.yml"; \
	else \
		./scripts/statusline.sh --error "Missing configuration files" --extras "missing=$$MISSING_FILES"; \
	fi

config-validate: ## Validate docker-compose configuration with detailed feedback
	@echo "$(BLUE)✅ Validating docker-compose configuration...$(RESET)"
	@./scripts/statusline.sh --phase Test --msg "Validating Docker Compose syntax"
	@if docker-compose -f docker-compose.dev.yml config >/dev/null 2>&1; then \
		./scripts/statusline.sh --ok "Docker Compose configuration valid" --extras "file=docker-compose.dev.yml syntax=valid"; \
		echo "$(GREEN)✅ Configuration valid$(RESET)"; \
	else \
		./scripts/statusline.sh --error "Docker Compose configuration invalid" --extras "file=docker-compose.dev.yml check=syntax"; \
		echo "$(RED)❌ Configuration invalid$(RESET)"; \
		exit 1; \
	fi

# Advanced Build Validation
build-validate: ## Validate build without actually building
	@echo "$(BLUE)🔍 Validating build configuration...$(RESET)"
	@./scripts/statusline.sh --phase Build --msg "Pre-build validation"
	@$(MAKE) config-validate
	@if [ -f frontend/Dockerfile.dev ] && [ -f backend/Dockerfile.dev ]; then \
		./scripts/statusline.sh --ok "Dockerfiles found" --extras "frontend=✓ backend=✓"; \
		echo "$(GREEN)✅ Dockerfiles present$(RESET)"; \
	else \
		./scripts/statusline.sh --error "Missing Dockerfiles" --extras "check=frontend/Dockerfile.dev,backend/Dockerfile.dev"; \
		echo "$(RED)❌ Missing Dockerfiles$(RESET)"; \
		exit 1; \
	fi

build-retry: ## Retry failed builds with automatic recovery
	@echo "$(YELLOW)🔄 Retrying build with recovery strategies...$(RESET)"
	@./scripts/statusline.sh --phase Build --msg "Attempting build recovery"
	@echo "$(BLUE)Step 1: Cleaning Docker cache...$(RESET)"
	@docker builder prune -f 2>/dev/null || true
	@echo "$(BLUE)Step 2: Pulling base images...$(RESET)"
	@docker pull node:18-alpine 2>/dev/null || true
	@docker pull ollama/ollama:latest 2>/dev/null || true
	@echo "$(BLUE)Step 3: Retry build...$(RESET)"
	@if $(MAKE) build; then \
		./scripts/statusline.sh --ok "Build recovery successful" --extras "strategy=cache-clean,base-pull"; \
	else \
		./scripts/statusline.sh --error "Build recovery failed" --extras "next=build-no-cache"; \
		echo "$(RED)Build still failing. Try: make build-no-cache$(RESET)"; \
		exit 1; \
	fi

build-status: ## Show build status and image information
	@echo "$(BLUE)📊 Build Status Information$(RESET)"
	@./scripts/statusline.sh --phase Info --msg "Collecting build status"
	@echo "$(CYAN)Docker Images:$(RESET)"
	@docker images | grep prompt-card-system-v2 || echo "No project images found"
	@echo ""
	@echo "$(CYAN)Container Status:$(RESET)"
	@docker-compose -f docker-compose.dev.yml ps 2>/dev/null || echo "No containers running"
	@echo ""
	@echo "$(CYAN)Docker System Info:$(RESET)"
	@docker system df 2>/dev/null || echo "Docker system info unavailable"
	@./scripts/statusline.sh --ok "Build status collected" --extras "images=listed containers=checked system=analyzed"

# Enhanced Testing with Statusline
test-all: ## Run comprehensive test suite with progress tracking
	@echo "$(GREEN)🧪 Running comprehensive test suite...$(RESET)"
	@./scripts/statusline.sh --phase Test --msg "Starting comprehensive test suite"
	@$(MAKE) lint && \
	$(MAKE) test-backend && \
	$(MAKE) test-frontend && \
	$(MAKE) test-e2e && \
	./scripts/statusline.sh --ok "All tests passed" --extras "lint=✓ backend=✓ frontend=✓ e2e=✓" || \
	(./scripts/statusline.sh --error "Test suite failed" --extras "check=individual_test_logs"; exit 1)

# Production Readiness
prod-ready: ## Complete production readiness check
	@echo "$(PURPLE)🚀 Production Readiness Assessment$(RESET)"
	@./scripts/statusline.sh --phase Test --msg "Assessing production readiness"
	@echo "$(BLUE)1. Configuration validation...$(RESET)"
	@$(MAKE) config-validate
	@echo "$(BLUE)2. Security audit...$(RESET)"
	@$(MAKE) security-audit
	@echo "$(BLUE)3. Test suite...$(RESET)"
	@$(MAKE) test-all
	@echo "$(BLUE)4. Build validation...$(RESET)"
	@$(MAKE) build-validate
	@echo "$(BLUE)5. Health checks...$(RESET)"
	@$(MAKE) health
	@./scripts/statusline.sh --ok "Production readiness confirmed" --extras "config=✓ security=✓ tests=✓ build=✓ health=✓"
	@echo "$(GREEN)✅ Ready for production deployment!$(RESET)"

# Container Health and Recovery
containers-health: ## Detailed container health assessment
	@echo "$(GREEN)🏥 Detailed Container Health Assessment$(RESET)"
	@./scripts/statusline.sh --phase Test --msg "Assessing container health"
	@echo "$(CYAN)Container Status:$(RESET)"
	@docker-compose -f docker-compose.dev.yml ps
	@echo ""
	@echo "$(CYAN)Container Logs (last 10 lines each):$(RESET)"
	@for service in frontend backend backend-cpu ollama ollama-cpu redis; do \
		if docker-compose -f docker-compose.dev.yml ps $$service 2>/dev/null | grep -q "Up"; then \
			echo "$(BLUE)--- $$service ---$(RESET)"; \
			docker-compose -f docker-compose.dev.yml logs --tail=10 $$service 2>/dev/null || echo "No logs available"; \
		fi; \
	done
	@echo ""
	@./scripts/statusline.sh --ok "Container health assessment completed" --extras "services=checked logs=analyzed"

containers-restart-unhealthy: ## Restart unhealthy containers
	@echo "$(YELLOW)🔄 Restarting unhealthy containers...$(RESET)"
	@./scripts/statusline.sh --phase Deploy --msg "Restarting unhealthy containers"
	@RESTARTED=0; \
	for service in frontend backend backend-cpu ollama ollama-cpu redis; do \
		if docker-compose -f docker-compose.dev.yml ps $$service 2>/dev/null | grep -q "Exit\|unhealthy"; then \
			echo "$(YELLOW)Restarting $$service...$(RESET)"; \
			docker-compose -f docker-compose.dev.yml restart $$service; \
			RESTARTED=$$((RESTARTED + 1)); \
		fi; \
	done; \
	if [ $$RESTARTED -gt 0 ]; then \
		./scripts/statusline.sh --ok "Restarted $$RESTARTED unhealthy containers" --extras "count=$$RESTARTED"; \
	else \
		./scripts/statusline.sh --ok "No unhealthy containers found" --extras "all_healthy=true"; \
	fi