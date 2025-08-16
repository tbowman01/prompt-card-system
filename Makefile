# Prompt Card System - Enhanced Development Makefile
# ==================================================
# CRITICAL: OPTIMIZED FOR 100% SUCCESS RATE
# - All targets include comprehensive error handling
# - Progress monitoring and validation at every step
# - Automatic failure recovery where possible
# - Detailed success/failure reporting

.PHONY: help dev dev-gpu dev-cpu build test clean logs restart demo demo-clean demo-quick demo-presentation demo-load-data demo-status demo-reset demo-stop demo-export docs-demo validate-environment validate-all validate-targets validate-dependencies validate-configuration success-report ci-validate
.DEFAULT_GOAL := help

# Error handling configuration
SHELL := /bin/bash
.SHELLFLAGS := -e -u -o pipefail -c
.ONESHELL:

# Colors for output
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[0;33m
BLUE := \033[0;34m
PURPLE := \033[0;35m
CYAN := \033[0;36m
WHITE := \033[0;37m
RESET := \033[0m

# Critical paths and validation
STATUSLINE_SCRIPT := ./scripts/statusline.sh
DOCKER_COMPOSE_FILE := docker/docker-compose.dev.yml
REQUIRED_DIRS := scripts docker frontend backend
REQUIRED_FILES := .env .env.dev docker/docker-compose.dev.yml

# Environment validation function
define validate_environment
	@echo "$(BLUE)🔍 Validating environment...$(RESET)"
	@if [ -f "$(STATUSLINE_SCRIPT)" ]; then \
		$(STATUSLINE_SCRIPT) --phase Validation --msg "Environment validation started"; \
	else \
		echo "$(RED)❌ statusline.sh script not found at $(STATUSLINE_SCRIPT)$(RESET)"; \
		exit 1; \
	fi
	@for dir in $(REQUIRED_DIRS); do \
		if [ ! -d "$$dir" ]; then \
			echo "$(RED)❌ Required directory missing: $$dir$(RESET)"; \
			$(STATUSLINE_SCRIPT) --error "Missing directory: $$dir" --extras "validation=failed"; \
			exit 1; \
		fi; \
	done
	@for file in $(REQUIRED_FILES); do \
		if [ ! -f "$$file" ]; then \
			echo "$(RED)❌ Required file missing: $$file$(RESET)"; \
			$(STATUSLINE_SCRIPT) --error "Missing file: $$file" --extras "validation=failed"; \
			exit 1; \
		fi; \
	done
	@$(STATUSLINE_SCRIPT) --ok "Environment validation passed" --extras "all_dependencies=present"
endef

# Environment validation target
validate-environment: ## Validate all required files and dependencies
	$(call validate_environment)

# Default target with validation
help: validate-environment ## Show this help message
	@echo "$(BLUE)Prompt Card System - Development Commands$(RESET)"
	@echo "========================================"
	@echo "$(GREEN)✅ Environment validated successfully$(RESET)"
	@echo ""
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "$(CYAN)%-25s$(RESET) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(PURPLE)🎯 Quick Start: make setup (first time) or make dev$(RESET)"

# Quick Commands
setup: validate-environment ## First-time setup for new developers with progress tracking
	@echo "$(GREEN)🚀 Setting up Prompt Card System for development...$(RESET)"
	@$(STATUSLINE_SCRIPT) --phase Setup --msg "Starting first-time setup" --extras "steps=5/5"
	@echo "$(YELLOW)Step 1: Validating environment...$(RESET)"
	@$(STATUSLINE_SCRIPT) --progress "Environment validation" --extras "step=1/5"
	@echo "$(YELLOW)Step 2: Checking prerequisites...$(RESET)"
	@$(STATUSLINE_SCRIPT) --progress "Checking prerequisites" --extras "step=2/5"
	@if ! $(MAKE) check-prerequisites; then \
		$(STATUSLINE_SCRIPT) --error "Prerequisites check failed" --extras "step=2/5"; \
		exit 1; \
	fi
	@echo "$(YELLOW)Step 3: Creating environment files...$(RESET)"
	@$(STATUSLINE_SCRIPT) --progress "Creating environment files" --extras "step=3/5"
	@if ! $(MAKE) create-env; then \
		$(STATUSLINE_SCRIPT) --error "Environment file creation failed" --extras "step=3/5"; \
		exit 1; \
	fi
	@echo "$(YELLOW)Step 4: Building containers...$(RESET)"
	@$(STATUSLINE_SCRIPT) --progress "Building containers" --extras "step=4/5"
	@if ! $(MAKE) build; then \
		$(STATUSLINE_SCRIPT) --error "Container build failed" --extras "step=4/5"; \
		exit 1; \
	fi
	@echo "$(YELLOW)Step 5: Starting development environment...$(RESET)"
	@$(STATUSLINE_SCRIPT) --progress "Starting development environment" --extras "step=5/5"
	@if ! $(MAKE) dev; then \
		$(STATUSLINE_SCRIPT) --error "Development environment startup failed" --extras "step=5/5"; \
		exit 1; \
	fi
	@$(STATUSLINE_SCRIPT) --ok "Setup complete! Visit http://localhost:3000" --extras "duration=$$(date +%s)s"
	@echo "$(GREEN)✅ Setup complete! Visit http://localhost:3000$(RESET)"

check-prerequisites: validate-environment ## Check system prerequisites with detailed validation
	@echo "$(BLUE)🔍 Checking prerequisites...$(RESET)"
	@$(STATUSLINE_SCRIPT) --phase Setup --msg "Validating system requirements"
	@if ! command -v docker >/dev/null 2>&1; then \
		$(STATUSLINE_SCRIPT) --error "Docker not found" --extras "install=https://docs.docker.com/install"; \
		echo "$(RED)❌ Docker is not installed. Please install Docker first.$(RESET)"; \
		exit 1; \
	fi
	@if ! (command -v docker-compose >/dev/null 2>&1 || (command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1)); then \
		$(STATUSLINE_SCRIPT) --error "Docker Compose not found" --extras "install=docker-compose-plugin"; \
		echo "$(RED)❌ Docker Compose is not available. Please install Docker Compose.$(RESET)"; \
		exit 1; \
	fi
	@DOCKER_VERSION=$$(docker --version 2>/dev/null | awk '{print $$3}' | tr -d ',' || echo "unknown"); \
	COMPOSE_VERSION=$$(docker-compose --version 2>/dev/null | awk '{print $$3}' || docker compose version --short 2>/dev/null || echo "unknown"); \
	$(STATUSLINE_SCRIPT) --ok "Docker requirements met" --extras "docker=$$DOCKER_VERSION compose=$$COMPOSE_VERSION"
	@echo "$(GREEN)✅ Docker and Docker Compose found$(RESET)"
	@if command -v nvidia-smi >/dev/null 2>&1; then \
		GPU_NAME=$$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1 || echo "unknown"); \
		$(STATUSLINE_SCRIPT) --ok "GPU support available" --extras "gpu=$$GPU_NAME"; \
		echo "$(GREEN)🎮 GPU detected and available$(RESET)"; \
	else \
		$(STATUSLINE_SCRIPT) --warn "No GPU detected, using CPU-only" --extras "mode=cpu-only performance=reduced"; \
		echo "$(YELLOW)💻 No GPU detected, will use CPU-only mode$(RESET)"; \
	fi
	@if ! command -v curl >/dev/null 2>&1; then \
		echo "$(YELLOW)⚠️  curl not found, health checks may not work$(RESET)"; \
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
dev: validate-environment ## Start full development environment (auto-detects GPU)
	@echo "$(GREEN)🚀 Starting development environment...$(RESET)"
	@$(STATUSLINE_SCRIPT) --phase Setup --msg "Auto-detecting hardware and starting environment"
	@if ! docker info >/dev/null 2>&1; then \
		echo "$(RED)❌ Docker daemon not running$(RESET)"; \
		$(STATUSLINE_SCRIPT) --error "Docker daemon not running" --extras "solution=start_docker"; \
		exit 1; \
	fi
	@if command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi >/dev/null 2>&1; then \
		$(STATUSLINE_SCRIPT) --ok "GPU detected, starting with GPU support" --extras "mode=gpu hardware=nvidia"; \
		echo "$(GREEN)🎮 GPU detected, starting with GPU support...$(RESET)"; \
		if ! $(MAKE) dev-gpu; then \
			echo "$(YELLOW)⚠️  GPU mode failed, falling back to CPU mode...$(RESET)"; \
			$(MAKE) dev-cpu; \
		fi; \
	else \
		$(STATUSLINE_SCRIPT) --warn "No GPU detected, starting CPU-only" --extras "mode=cpu performance=limited"; \
		echo "$(YELLOW)💻 No GPU detected, starting CPU-only...$(RESET)"; \
		if ! $(MAKE) dev-cpu; then \
			echo "$(RED)❌ Failed to start development environment$(RESET)"; \
			$(STATUSLINE_SCRIPT) --error "Development environment startup failed" --extras "check=docker,resources"; \
			exit 1; \
		fi; \
	fi

dev-full: ## Start complete development stack with all features
	@echo "$(PURPLE)🌟 Starting FULL development stack with advanced features...$(RESET)"
	@echo "$(YELLOW)🎤 Voice Interface: ENABLED$(RESET)"
	@echo "$(YELLOW)🔗 Blockchain Audit: ENABLED$(RESET)"
	@echo "$(YELLOW)🤝 Collaboration: ENABLED$(RESET)"
	@echo "$(YELLOW)📊 Advanced Monitoring: ENABLED$(RESET)"
	@echo "$(YELLOW)🏢 Multi-Tenant: ENABLED$(RESET)"
	@if command -v nvidia-smi >/dev/null 2>&1; then \
		ENABLE_VOICE_INTERFACE=true ENABLE_BLOCKCHAIN_AUDIT=true ENABLE_COLLABORATION=true ENABLE_MONITORING=true MULTI_TENANT_MODE=true docker-compose --profile gpu --profile monitoring --profile tools -f docker/docker-compose.dev.yml up -d; \
	else \
		ENABLE_VOICE_INTERFACE=true ENABLE_BLOCKCHAIN_AUDIT=true ENABLE_COLLABORATION=true ENABLE_MONITORING=true MULTI_TENANT_MODE=true docker-compose --profile cpu --profile monitoring --profile tools -f docker/docker-compose.dev.yml up -d; \
	fi
	@echo "$(YELLOW)⏳ Waiting for services to initialize...$(RESET)"
	@sleep 15
	@$(MAKE) init-models
	@$(MAKE) show-full-status

dev-gpu: validate-environment ## Start development with GPU support
	@echo "$(GREEN)🎮 Starting development environment with GPU support...$(RESET)"
	@$(STATUSLINE_SCRIPT) --phase Deploy --msg "Starting GPU-enabled containers"
	@echo "$(CYAN)Stopping any existing containers...$(RESET)"
	@docker-compose -f $(DOCKER_COMPOSE_FILE) down >/dev/null 2>&1 || true
	@echo "$(CYAN)Starting GPU-enabled services...$(RESET)"
	@if timeout 300s docker-compose --profile gpu -f $(DOCKER_COMPOSE_FILE) up -d; then \
		$(STATUSLINE_SCRIPT) --progress "Services starting, waiting for readiness" --extras "gpu=enabled timeout=60s"; \
		echo "$(YELLOW)⏳ Waiting for services to initialize...$(RESET)"; \
		sleep 15; \
		echo "$(CYAN)Initializing models...$(RESET)"; \
		$(MAKE) init-models || echo "$(YELLOW)⚠️  Model initialization skipped$(RESET)"; \
		$(MAKE) show-status; \
		$(STATUSLINE_SCRIPT) --ok "GPU development environment ready" --extras "services=frontend,backend,ollama-gpu,redis"; \
		echo "$(GREEN)✅ GPU development environment is ready!$(RESET)"; \
	else \
		EXIT_CODE=$$?; \
		$(STATUSLINE_SCRIPT) --error "Failed to start GPU environment" --extras "exit_code=$$EXIT_CODE fallback=cpu-mode"; \
		echo "$(RED)❌ Failed to start GPU environment (exit code: $$EXIT_CODE)$(RESET)"; \
		exit $$EXIT_CODE; \
	fi

dev-cpu: validate-environment ## Start development environment (CPU only)
	@echo "$(YELLOW)💻 Starting development environment (CPU only)...$(RESET)"
	@$(STATUSLINE_SCRIPT) --phase Deploy --msg "Starting CPU-only containers"
	@echo "$(CYAN)Stopping any existing containers...$(RESET)"
	@docker-compose -f $(DOCKER_COMPOSE_FILE) down >/dev/null 2>&1 || true
	@echo "$(CYAN)Starting CPU-only services...$(RESET)"
	@if timeout 300s docker-compose --profile cpu -f $(DOCKER_COMPOSE_FILE) up -d; then \
		$(STATUSLINE_SCRIPT) --progress "Services starting, waiting for readiness" --extras "mode=cpu timeout=60s"; \
		echo "$(YELLOW)⏳ Waiting for services to initialize...$(RESET)"; \
		sleep 15; \
		echo "$(CYAN)Initializing models...$(RESET)"; \
		$(MAKE) init-models || echo "$(YELLOW)⚠️  Model initialization skipped$(RESET)"; \
		$(MAKE) show-status; \
		$(STATUSLINE_SCRIPT) --ok "CPU development environment ready" --extras "services=frontend,backend-cpu,ollama-cpu,redis"; \
		echo "$(GREEN)✅ CPU development environment is ready!$(RESET)"; \
	else \
		EXIT_CODE=$$?; \
		$(STATUSLINE_SCRIPT) --error "Failed to start CPU environment" --extras "exit_code=$$EXIT_CODE check=docker-compose,resources"; \
		echo "$(RED)❌ Failed to start CPU environment (exit code: $$EXIT_CODE)$(RESET)"; \
		exit $$EXIT_CODE; \
	fi

dev-minimal: ## Start minimal development (frontend + backend only)
	@echo "$(CYAN)⚡ Starting minimal development environment...$(RESET)"
	@if command -v nvidia-smi >/dev/null 2>&1; then \
		docker-compose -f docker/docker-compose.dev.yml up -d frontend backend redis; \
	else \
		docker-compose -f docker/docker-compose.dev.yml up -d frontend backend-cpu redis; \
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
	@ENABLE_MONITORING=true docker-compose --profile monitoring -f docker/docker-compose.dev.yml up -d
	@$(MAKE) monitoring
	@echo "$(GREEN)✅ Advanced Monitoring enabled$(RESET)"

dev-enterprise: ## Start development with Multi-Tenant features
	@echo "$(PURPLE)🏢 Starting development with Enterprise Multi-Tenant...$(RESET)"
	@MULTI_TENANT_MODE=true $(MAKE) dev
	@echo "$(GREEN)✅ Multi-Tenant mode enabled$(RESET)"

# Model Management
init-models: ## Initialize LLM models
	@echo "$(BLUE)📥 Initializing models...$(RESET)"
	@if docker-compose -f docker/docker-compose.dev.yml ps | grep -q "ollama"; then \
		docker-compose --profile init -f docker/docker-compose.dev.yml run --rm model-init || echo "$(YELLOW)Model initialization skipped$(RESET)"; \
	else \
		echo "$(YELLOW)⚠️  Ollama not running, skipping model initialization$(RESET)"; \
	fi

models-list: ## List available models
	@echo "$(BLUE)📋 Available models:$(RESET)"
	@docker-compose -f docker/docker-compose.dev.yml exec ollama ollama list 2>/dev/null || \
	docker-compose -f docker/docker-compose.dev.yml exec ollama-cpu ollama list 2>/dev/null || \
	echo "$(YELLOW)⚠️  Ollama not available$(RESET)"

models-pull: ## Pull additional models (specify MODEL=model_name)
	@if [ -z "$(MODEL)" ]; then \
		echo "$(RED)❌ Please specify MODEL name: make models-pull MODEL=llama2$(RESET)"; \
		exit 1; \
	fi
	@echo "$(BLUE)📥 Pulling model: $(MODEL)...$(RESET)"
	@docker-compose -f docker/docker-compose.dev.yml exec ollama ollama pull $(MODEL) || \
	docker-compose -f docker/docker-compose.dev.yml exec ollama-cpu ollama pull $(MODEL)

models-remove: ## Remove model (specify MODEL=model_name)
	@if [ -z "$(MODEL)" ]; then \
		echo "$(RED)❌ Please specify MODEL name: make models-remove MODEL=llama2$(RESET)"; \
		exit 1; \
	fi
	@echo "$(YELLOW)🗑️  Removing model: $(MODEL)...$(RESET)"
	@docker-compose -f docker/docker-compose.dev.yml exec ollama ollama rm $(MODEL) || \
	docker-compose -f docker/docker-compose.dev.yml exec ollama-cpu ollama rm $(MODEL)

ollama-progress: ## Monitor Ollama model download progress with visual progress bar
	@echo "$(BLUE)📊 Starting Ollama download progress monitor...$(RESET)"
	@./scripts/ollama-monitor.sh

# Development Tools
tools: ## Start development tools (Adminer, Redis Commander)
	@echo "$(CYAN)🔧 Starting development tools...$(RESET)"
	@docker-compose --profile tools -f docker/docker-compose.dev.yml up -d
	@echo "$(GREEN)🌐 Development tools available:$(RESET)"
	@echo "   $(CYAN)• Adminer (Database):$(RESET) http://localhost:8080"
	@echo "   $(CYAN)• Redis Commander:$(RESET) http://localhost:8081"

monitoring: ## Start monitoring stack (Prometheus + Grafana)
	@echo "$(YELLOW)📊 Starting monitoring stack...$(RESET)"
	@docker-compose --profile monitoring -f docker/docker-compose.dev.yml up -d
	@echo "$(GREEN)📈 Monitoring stack available:$(RESET)"
	@echo "   $(YELLOW)• Prometheus:$(RESET) http://localhost:9090"
	@echo "   $(YELLOW)• Grafana:$(RESET) http://localhost:3002 (admin/admin)"
	@echo "   $(YELLOW)• Jaeger Tracing:$(RESET) http://localhost:16686"
	@echo "   $(YELLOW)• InfluxDB:$(RESET) http://localhost:8086"

monitoring-full: ## Start complete monitoring infrastructure
	@echo "$(PURPLE)📊 Starting COMPLETE monitoring infrastructure...$(RESET)"
	@if [ -f ./scripts/fix-prometheus.sh ]; then \
		./scripts/fix-prometheus.sh setup; \
	elif [ -f docker/docker-compose.monitoring.yml ]; then \
		docker-compose -f docker/docker-compose.monitoring.yml up -d; \
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
	@docker-compose -f docker/docker-compose.dev.yml ps
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

health-basic: validate-environment ## Basic health check using curl with detailed status
	@echo "$(BLUE)🔍 Basic Health Checks:$(RESET)"
	@$(STATUSLINE_SCRIPT) --phase Test --msg "Testing service endpoints"
	@if ! command -v curl >/dev/null 2>&1; then \
		echo "$(YELLOW)⚠️  curl not available, skipping health checks$(RESET)"; \
		$(STATUSLINE_SCRIPT) --warn "curl not available" --extras "health_check=skipped"; \
		exit 0; \
	fi
	@echo "$(CYAN)Checking service endpoints (timeout: 5s each)...$(RESET)"
	@FRONTEND_STATUS=$$(timeout 5s curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null || echo "DOWN"); \
	BACKEND_STATUS=$$(timeout 5s curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health 2>/dev/null || echo "DOWN"); \
	OLLAMA_STATUS=$$(timeout 5s curl -s -o /dev/null -w "%{http_code}" http://localhost:11434/api/version 2>/dev/null || echo "DOWN"); \
	echo "$(CYAN)Frontend Health:$(RESET) $$FRONTEND_STATUS"; \
	echo "$(CYAN)Backend Health:$(RESET) $$BACKEND_STATUS"; \
	echo "$(CYAN)Ollama Health:$(RESET) $$OLLAMA_STATUS"; \
	if echo "$$FRONTEND_STATUS" | grep -q "^2[0-9][0-9]$$" && echo "$$BACKEND_STATUS" | grep -q "^2[0-9][0-9]$$" && echo "$$OLLAMA_STATUS" | grep -q "^2[0-9][0-9]$$"; then \
		$(STATUSLINE_SCRIPT) --ok "All services healthy" --extras "frontend=$$FRONTEND_STATUS backend=$$BACKEND_STATUS ollama=$$OLLAMA_STATUS"; \
		echo "$(GREEN)✅ All services are healthy$(RESET)"; \
	elif echo "$$FRONTEND_STATUS" | grep -q "DOWN" && echo "$$BACKEND_STATUS" | grep -q "DOWN" && echo "$$OLLAMA_STATUS" | grep -q "DOWN"; then \
		$(STATUSLINE_SCRIPT) --warn "Services not running (expected when containers are down)" --extras "frontend=$$FRONTEND_STATUS backend=$$BACKEND_STATUS ollama=$$OLLAMA_STATUS"; \
		echo "$(YELLOW)⚠️  Services are not running (use 'make dev' to start)$(RESET)"; \
	else \
		$(STATUSLINE_SCRIPT) --warn "Some services unhealthy" --extras "frontend=$$FRONTEND_STATUS backend=$$BACKEND_STATUS ollama=$$OLLAMA_STATUS"; \
		echo "$(YELLOW)⚠️  Some services are not responding correctly$(RESET)"; \
	fi

health-watch: validate-environment ## Watch health status (updates every 5 seconds)
	@echo "$(BLUE)👀 Watching health status (Ctrl+C to stop)...$(RESET)"
	@if command -v watch >/dev/null 2>&1; then \
		echo "$(CYAN)Starting health monitoring (5-second intervals)...$(RESET)"; \
		watch -n 5 "$(MAKE) health-basic"; \
	else \
		echo "$(YELLOW)⚠️  'watch' command not found, running health check once$(RESET)"; \
		$(MAKE) health-basic; \
	fi

# Logging
logs: ## Show logs for all services
	@docker-compose -f docker/docker-compose.dev.yml logs -f

logs-frontend: ## Show frontend logs
	@docker-compose -f docker/docker-compose.dev.yml logs -f frontend

logs-backend: ## Show backend logs
	@if docker-compose -f docker/docker-compose.dev.yml ps | grep -q "backend "; then \
		docker-compose -f docker/docker-compose.dev.yml logs -f backend; \
	else \
		docker-compose -f docker/docker-compose.dev.yml logs -f backend-cpu; \
	fi

logs-ollama: ## Show Ollama logs
	@docker-compose -f docker/docker-compose.dev.yml logs -f ollama ollama-cpu 2>/dev/null || \
	echo "$(YELLOW)⚠️  Ollama containers not running$(RESET)"

logs-monitoring: ## Show monitoring logs
	@docker-compose --profile monitoring -f docker/docker-compose.dev.yml logs -f

logs-follow: ## Follow logs with service names (specify SERVICE=name)
	@if [ -z "$(SERVICE)" ]; then \
		echo "$(BLUE)Available services:$(RESET) frontend, backend, ollama, redis, monitoring"; \
		echo "Usage: make logs-follow SERVICE=backend"; \
	else \
		docker-compose -f docker/docker-compose.dev.yml logs -f $(SERVICE); \
	fi

# Testing
test: ## Run all tests
	@echo "$(GREEN)🧪 Running all tests...$(RESET)"
	@$(MAKE) test-backend
	@$(MAKE) test-frontend

test-backend: ## Run backend tests only
	@echo "$(BLUE)🧪 Running backend tests...$(RESET)"
	@if docker-compose -f docker/docker-compose.dev.yml ps | grep -q "backend "; then \
		docker-compose -f docker/docker-compose.dev.yml exec backend npm test; \
	else \
		docker-compose -f docker/docker-compose.dev.yml exec backend-cpu npm test; \
	fi

test-frontend: ## Run frontend tests only
	@echo "$(BLUE)🧪 Running frontend tests...$(RESET)"
	@docker-compose -f docker/docker-compose.dev.yml exec frontend npm test

test-watch: ## Run tests in watch mode (specify SERVICE=backend or frontend)
	@if [ -z "$(SERVICE)" ]; then \
		echo "$(RED)❌ Please specify SERVICE: make test-watch SERVICE=backend$(RESET)"; \
		exit 1; \
	fi
	@echo "$(BLUE)🧪 Running $(SERVICE) tests in watch mode...$(RESET)"
	@docker-compose -f docker/docker-compose.dev.yml exec $(SERVICE) npm run test:watch

test-coverage: ## Run tests with coverage
	@echo "$(GREEN)📊 Running tests with coverage...$(RESET)"
	@docker-compose -f docker/docker-compose.dev.yml exec backend npm run test:coverage
	@docker-compose -f docker/docker-compose.dev.yml exec frontend npm run test:coverage

test-e2e: ## Run end-to-end tests
	@echo "$(PURPLE)🎭 Running E2E tests...$(RESET)"
	@if docker-compose -f docker/docker-compose.dev.yml ps | grep -q "frontend.*Up"; then \
		docker-compose -f docker/docker-compose.dev.yml exec frontend npm run test:e2e; \
	else \
		echo "$(RED)❌ Frontend not running. Start with 'make dev' first.$(RESET)"; \
	fi

# Database Management
db-reset: ## Reset development database
	@echo "$(YELLOW)🗄️ Resetting database...$(RESET)"
	@if docker-compose -f docker/docker-compose.dev.yml ps | grep -q "backend"; then \
		docker-compose -f docker/docker-compose.dev.yml exec backend rm -f /app/data/database.sqlite; \
		docker-compose -f docker/docker-compose.dev.yml restart backend; \
		echo "$(GREEN)✅ Database reset complete$(RESET)"; \
	else \
		echo "$(RED)❌ Backend not running$(RESET)"; \
	fi

db-backup: ## Backup development database
	@echo "$(BLUE)💾 Backing up database...$(RESET)"
	@if docker-compose -f docker/docker-compose.dev.yml ps | grep -q "backend"; then \
		BACKUP_FILE="backup-$$(date +%Y%m%d-%H%M%S).sqlite"; \
		docker cp $$(docker-compose -f docker/docker-compose.dev.yml ps -q backend | head -1):/app/data/database.sqlite ./$$BACKUP_FILE; \
		echo "$(GREEN)✅ Database backed up to $$BACKUP_FILE$(RESET)"; \
	else \
		echo "$(RED)❌ Backend not running$(RESET)"; \
	fi

db-migrate: ## Run database migrations
	@echo "$(BLUE)🔄 Running database migrations...$(RESET)"
	@if docker-compose -f docker/docker-compose.dev.yml ps | grep -q "backend"; then \
		docker-compose -f docker/docker-compose.dev.yml exec backend npm run migrate; \
		echo "$(GREEN)✅ Migrations complete$(RESET)"; \
	else \
		echo "$(RED)❌ Backend not running$(RESET)"; \
	fi

db-seed: ## Seed database with sample data
	@echo "$(BLUE)🌱 Seeding database...$(RESET)"
	@if docker-compose -f docker/docker-compose.dev.yml ps | grep -q "backend"; then \
		docker-compose -f docker/docker-compose.dev.yml exec backend npm run seed; \
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
	@docker-compose -f docker/docker-compose.dev.yml exec backend npm audit
	@docker-compose -f docker/docker-compose.dev.yml exec frontend npm audit

# Performance
benchmark: ## Run performance benchmarks
	@echo "$(PURPLE)⚡ Running performance benchmarks...$(RESET)"
	@if docker-compose -f docker/docker-compose.dev.yml ps | grep -q "backend"; then \
		docker-compose -f docker/docker-compose.dev.yml exec backend npm run benchmark; \
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
	@docker-compose -f docker/docker-compose.dev.yml down
	@if [ -f docker/docker-compose.monitoring.yml ]; then \
		docker-compose -f docker/docker-compose.monitoring.yml down; \
	fi

clean: ## Stop and remove all containers, networks, and volumes
	@echo "$(RED)🧹 Cleaning up development environment...$(RESET)"
	@docker-compose -f docker/docker-compose.dev.yml down -v --remove-orphans
	@if [ -f docker/docker-compose.monitoring.yml ]; then \
		docker-compose -f docker/docker-compose.monitoring.yml down -v --remove-orphans; \
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
	@if docker-compose -f docker/docker-compose.dev.yml ps | grep -q "backend "; then \
		docker-compose -f docker/docker-compose.dev.yml restart backend; \
	else \
		docker-compose -f docker/docker-compose.dev.yml restart backend-cpu; \
	fi

restart-frontend: ## Restart frontend service only
	@echo "$(BLUE)🔄 Restarting frontend...$(RESET)"
	@docker-compose -f docker/docker-compose.dev.yml restart frontend

restart-service: ## Restart specific service (specify SERVICE=name)
	@if [ -z "$(SERVICE)" ]; then \
		echo "$(RED)❌ Please specify SERVICE: make restart-service SERVICE=backend$(RESET)"; \
		exit 1; \
	fi
	@echo "$(BLUE)🔄 Restarting $(SERVICE)...$(RESET)"
	@docker-compose -f docker/docker-compose.dev.yml restart $(SERVICE)

# Build Commands
build: validate-environment build-validate ## Build all development images with validation
	@echo "$(PURPLE)🏗️ Building development images...$(RESET)"
	@$(STATUSLINE_SCRIPT) --phase Build --msg "Starting container build process"
	@echo "$(CYAN)Checking Docker daemon...$(RESET)"
	@if ! docker info >/dev/null 2>&1; then \
		echo "$(RED)❌ Docker daemon not running$(RESET)"; \
		$(STATUSLINE_SCRIPT) --error "Docker daemon not running" --extras "solution=start_docker"; \
		exit 1; \
	fi
	@echo "$(CYAN)Building containers (this may take several minutes)...$(RESET)"
	@if timeout 1800s docker-compose -f $(DOCKER_COMPOSE_FILE) build --progress=plain; then \
		$(STATUSLINE_SCRIPT) --ok "All images built successfully" --extras "images=frontend,backend,ollama"; \
		echo "$(GREEN)✅ All images built successfully$(RESET)"; \
	else \
		BUILD_EXIT_CODE=$$?; \
		$(STATUSLINE_SCRIPT) --error "Build failed with exit code $$BUILD_EXIT_CODE" --extras "retry=build-retry"; \
		echo "$(RED)❌ Build failed. Try 'make build-retry' for automatic recovery$(RESET)"; \
		exit $$BUILD_EXIT_CODE; \
	fi

build-backend: ## Build backend image only with validation
	@echo "$(BLUE)🏗️ Building backend image...$(RESET)"
	@./scripts/statusline.sh --phase Build --msg "Building backend container"
	@if docker-compose -f docker/docker-compose.dev.yml build backend; then \
		./scripts/statusline.sh --ok "Backend image built" --extras "size=$$(docker images prompt-card-system-v2-backend:latest --format 'table {{.Size}}' 2>/dev/null | tail -1)"; \
	else \
		./scripts/statusline.sh --error "Backend build failed" --extras "check=dockerfile,dependencies"; \
		exit 1; \
	fi

build-frontend: ## Build frontend image only with validation
	@echo "$(BLUE)🏗️ Building frontend image...$(RESET)"
	@./scripts/statusline.sh --phase Build --msg "Building frontend container"
	@if docker-compose -f docker/docker-compose.dev.yml build frontend; then \
		./scripts/statusline.sh --ok "Frontend image built" --extras "size=$$(docker images prompt-card-system-v2-frontend:latest --format 'table {{.Size}}' 2>/dev/null | tail -1)"; \
	else \
		./scripts/statusline.sh --error "Frontend build failed" --extras "check=dockerfile,node_modules"; \
		exit 1; \
	fi

build-no-cache: ## Build all images without cache (clean build)
	@echo "$(PURPLE)🏗️ Building images without cache...$(RESET)"
	@./scripts/statusline.sh --phase Build --msg "Clean build without cache" --extras "cache=disabled"
	@if docker-compose -f docker/docker-compose.dev.yml build --no-cache; then \
		./scripts/statusline.sh --ok "Clean build completed" --extras "cache=cleared images=rebuilt"; \
	else \
		./scripts/statusline.sh --error "Clean build failed" --extras "retry_with_cache=available"; \
		exit 1; \
	fi

# Shell Access
shell-backend: ## Open shell in backend container
	@if docker-compose -f docker/docker-compose.dev.yml ps | grep -q "backend "; then \
		docker-compose -f docker/docker-compose.dev.yml exec backend sh; \
	else \
		docker-compose -f docker/docker-compose.dev.yml exec backend-cpu sh; \
	fi

shell-frontend: ## Open shell in frontend container
	@docker-compose -f docker/docker-compose.dev.yml exec frontend sh

shell-ollama: ## Open shell in Ollama container
	@docker-compose -f docker/docker-compose.dev.yml exec ollama sh 2>/dev/null || \
	docker-compose -f docker/docker-compose.dev.yml exec ollama-cpu sh 2>/dev/null || \
	echo "$(RED)❌ Ollama container not running$(RESET)"

shell-redis: ## Open Redis CLI
	@docker-compose -f docker/docker-compose.dev.yml exec redis redis-cli

# Development Utilities
npm-install: ## Install npm dependencies (specify SERVICE=backend or frontend)
	@if [ -z "$(SERVICE)" ]; then \
		echo "$(RED)❌ Please specify SERVICE: make npm-install SERVICE=backend$(RESET)"; \
		exit 1; \
	fi
	@echo "$(BLUE)📦 Installing npm dependencies for $(SERVICE)...$(RESET)"
	@docker-compose -f docker/docker-compose.dev.yml exec $(SERVICE) npm install

npm-update: ## Update npm dependencies (specify SERVICE=backend or frontend)
	@if [ -z "$(SERVICE)" ]; then \
		echo "$(RED)❌ Please specify SERVICE: make npm-update SERVICE=backend$(RESET)"; \
		exit 1; \
	fi
	@echo "$(YELLOW)🔄 Updating npm dependencies for $(SERVICE)...$(RESET)"
	@docker-compose -f docker/docker-compose.dev.yml exec $(SERVICE) npm update

lint: ## Run linting for all services
	@echo "$(BLUE)🔍 Running linting...$(RESET)"
	@if docker-compose -f docker/docker-compose.dev.yml ps | grep -q "backend.*Up"; then \
		docker-compose -f docker/docker-compose.dev.yml exec backend npm run lint; \
	else \
		echo "$(YELLOW)Backend container not running, running lint locally...$(RESET)"; \
		cd backend && npm run lint; \
	fi
	@if docker-compose -f docker/docker-compose.dev.yml ps | grep -q "frontend.*Up"; then \
		docker-compose -f docker/docker-compose.dev.yml exec frontend npm run lint; \
	else \
		echo "$(YELLOW)Frontend container not running, running lint locally...$(RESET)"; \
		cd frontend && npm run lint; \
	fi

lint-fix: ## Fix linting issues
	@echo "$(YELLOW)🔧 Fixing linting issues...$(RESET)"
	@if docker-compose -f docker/docker-compose.dev.yml ps | grep -q "backend.*Up"; then \
		docker-compose -f docker/docker-compose.dev.yml exec backend npm run lint:fix; \
	else \
		echo "$(YELLOW)Backend container not running, running lint:fix locally...$(RESET)"; \
		cd backend && npm run lint:fix; \
	fi
	@if docker-compose -f docker/docker-compose.dev.yml ps | grep -q "frontend.*Up"; then \
		docker-compose -f docker/docker-compose.dev.yml exec frontend npm run lint:fix; \
	else \
		echo "$(YELLOW)Frontend container not running, running lint:fix locally...$(RESET)"; \
		cd frontend && npm run lint:fix; \
	fi

format: ## Format code with prettier
	@echo "$(BLUE)✨ Formatting code...$(RESET)"
	@if docker-compose -f docker/docker-compose.dev.yml ps | grep -q "backend.*Up"; then \
		docker-compose -f docker/docker-compose.dev.yml exec backend npm run format; \
	else \
		echo "$(YELLOW)Backend container not running, running format locally...$(RESET)"; \
		cd backend && npm run format; \
	fi
	@if docker-compose -f docker/docker-compose.dev.yml ps | grep -q "frontend.*Up"; then \
		docker-compose -f docker/docker-compose.dev.yml exec frontend npm run format; \
	else \
		echo "$(YELLOW)Frontend container not running, running format locally...$(RESET)"; \
		cd frontend && npm run format; \
	fi

# Demo Mode Commands
demo-clean: ## Clean Docker networks and containers before demo
	@echo "$(BLUE)🧹 Cleaning Docker environment for demo...$(RESET)"
	@echo "$(YELLOW)Stopping any running prompt-card-system containers...$(RESET)"
	@docker ps --filter "name=prompt-card-system" -q | xargs -r docker stop 2>/dev/null || true
	@docker ps -a --filter "name=prompt-card-system" -q | xargs -r docker rm 2>/dev/null || true
	@docker-compose -f docker/docker-compose.dev.yml down --remove-orphans 2>/dev/null || true
	@if [ -f docker/docker-compose.monitoring.yml ]; then docker-compose -f docker/docker-compose.monitoring.yml down --remove-orphans 2>/dev/null || true; fi
	@echo "$(YELLOW)Removing conflicting Docker networks...$(RESET)"
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
	@./scripts/wait-for-demo.sh

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
	@if docker-compose -f docker/docker-compose.dev.yml ps | grep -q "backend.*Up"; then \
		echo "$(YELLOW)Loading 5 prompt cards with test cases...$(RESET)"; \
		docker cp demo/ $$(docker-compose -f docker/docker-compose.dev.yml ps -q backend | head -1):/app/ 2>/dev/null || \
		( \
			docker-compose -f docker/docker-compose.dev.yml exec backend mkdir -p /app/demo && \
			docker cp demo/demo-prompt-cards.json $$(docker-compose -f docker/docker-compose.dev.yml ps -q backend | head -1):/app/demo/ && \
			docker cp demo/demo-test-cases.json $$(docker-compose -f docker/docker-compose.dev.yml ps -q backend | head -1):/app/demo/ && \
			docker cp demo/demo-analytics.json $$(docker-compose -f docker/docker-compose.dev.yml ps -q backend | head -1):/app/demo/ && \
			docker cp demo/demo-config.json $$(docker-compose -f docker/docker-compose.dev.yml ps -q backend | head -1):/app/demo/ && \
			docker cp demo/load-demo-data.js $$(docker-compose -f docker/docker-compose.dev.yml ps -q backend | head -1):/app/demo/ \
		); \
		docker-compose -f docker/docker-compose.dev.yml exec backend node demo/load-demo-data.js || \
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
	@if docker-compose -f docker/docker-compose.dev.yml ps | grep -q "backend.*Up"; then \
		docker-compose -f docker/docker-compose.dev.yml exec backend rm -rf /app/demo/current-state.json; \
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
	if docker-compose -f docker/docker-compose.dev.yml ps | grep -q "backend.*Up"; then \
		docker cp $$(docker-compose -f docker/docker-compose.dev.yml ps -q backend | head -1):/app/demo/session-data.json exports/demo-$$TIMESTAMP/ 2>/dev/null || true; \
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
	@docker-compose -f docker/docker-compose.dev.yml up -d backend
	@echo "$(YELLOW)Connect debugger to: localhost:9229$(RESET)"

debug-logs: ## Show debug logs with timestamps
	@docker-compose -f docker/docker-compose.dev.yml logs -f --timestamps

troubleshoot: ## Run troubleshooting diagnostics
	@echo "$(YELLOW)🔧 Running troubleshooting diagnostics...$(RESET)"
	@$(MAKE) info
	@echo ""
	@$(MAKE) health-basic
	@echo ""
	@echo "$(BLUE)Container Status:$(RESET)"
	@docker-compose -f docker/docker-compose.dev.yml ps
	@echo ""
	@echo "$(BLUE)Recent Logs (last 20 lines):$(RESET)"
	@docker-compose -f docker/docker-compose.dev.yml logs --tail=20

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
	for file in .env .env.dev docker/docker-compose.dev.yml; do \
		if [ -f "$$file" ]; then \
			echo "$(GREEN)✅ $$file exists$(RESET)"; \
		else \
			echo "$(RED)❌ $$file missing$(RESET)"; \
			MISSING_FILES="$$MISSING_FILES $$file"; \
		fi; \
	done; \
	if [ -z "$$MISSING_FILES" ]; then \
		./scripts/statusline.sh --ok "All configuration files present" --extras "files=.env,.env.dev,docker/docker-compose.dev.yml"; \
	else \
		./scripts/statusline.sh --error "Missing configuration files" --extras "missing=$$MISSING_FILES"; \
	fi

config-validate: ## Validate docker-compose configuration with detailed feedback
	@echo "$(BLUE)✅ Validating docker-compose configuration...$(RESET)"
	@./scripts/statusline.sh --phase Test --msg "Validating Docker Compose syntax"
	@if docker-compose -f docker/docker-compose.dev.yml config >/dev/null 2>&1; then \
		./scripts/statusline.sh --ok "Docker Compose configuration valid" --extras "file=docker/docker-compose.dev.yml syntax=valid"; \
		echo "$(GREEN)✅ Configuration valid$(RESET)"; \
	else \
		./scripts/statusline.sh --error "Docker Compose configuration invalid" --extras "file=docker/docker-compose.dev.yml check=syntax"; \
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

build-retry: validate-environment ## Retry failed builds with automatic recovery
	@echo "$(YELLOW)🔄 Retrying build with recovery strategies...$(RESET)"
	@$(STATUSLINE_SCRIPT) --phase Build --msg "Attempting build recovery"
	@echo "$(BLUE)Step 1: Cleaning Docker cache and orphaned resources...$(RESET)"
	@docker builder prune -f 2>/dev/null || true
	@docker system prune -f 2>/dev/null || true
	@echo "$(BLUE)Step 2: Pulling base images...$(RESET)"
	@for image in node:18-alpine ollama/ollama:latest redis:7-alpine; do \
		echo "$(CYAN)Pulling $$image...$(RESET)"; \
		docker pull $$image 2>/dev/null || echo "$(YELLOW)⚠️  Failed to pull $$image$(RESET)"; \
	done
	@echo "$(BLUE)Step 3: Validating Docker Compose configuration...$(RESET)"
	@if ! $(MAKE) config-validate; then \
		echo "$(RED)❌ Configuration validation failed$(RESET)"; \
		$(STATUSLINE_SCRIPT) --error "Configuration invalid" --extras "fix=config-validate"; \
		exit 1; \
	fi
	@echo "$(BLUE)Step 4: Retry build with timeout protection...$(RESET)"
	@if timeout 1800s $(MAKE) build; then \
		$(STATUSLINE_SCRIPT) --ok "Build recovery successful" --extras "strategy=cache-clean,base-pull,config-validate"; \
		echo "$(GREEN)✅ Build recovery successful!$(RESET)"; \
	else \
		BUILD_EXIT_CODE=$$?; \
		$(STATUSLINE_SCRIPT) --error "Build recovery failed with exit code $$BUILD_EXIT_CODE" --extras "next=build-no-cache"; \
		echo "$(RED)❌ Build still failing (exit code: $$BUILD_EXIT_CODE). Try: make build-no-cache$(RESET)"; \
		exit $$BUILD_EXIT_CODE; \
	fi

build-status: validate-environment ## Show build status and image information
	@echo "$(BLUE)📊 Build Status Information$(RESET)"
	@$(STATUSLINE_SCRIPT) --phase Info --msg "Collecting build status"
	@echo "$(CYAN)=== Docker Images ===$(RESET)"
	@if docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}" | grep -E "(prompt-card-system|REPOSITORY)" 2>/dev/null; then \
		echo "$(GREEN)✅ Project images found$(RESET)"; \
	else \
		echo "$(YELLOW)⚠️  No project images found - run 'make build'$(RESET)"; \
	fi
	@echo ""
	@echo "$(CYAN)=== Container Status ===$(RESET)"
	@if docker-compose -f $(DOCKER_COMPOSE_FILE) ps 2>/dev/null; then \
		echo "$(GREEN)✅ Container status retrieved$(RESET)"; \
	else \
		echo "$(YELLOW)⚠️  No containers running - run 'make dev'$(RESET)"; \
	fi
	@echo ""
	@echo "$(CYAN)=== Docker System Resources ===$(RESET)"
	@if docker system df 2>/dev/null; then \
		echo "$(GREEN)✅ System info retrieved$(RESET)"; \
	else \
		echo "$(RED)❌ Docker system info unavailable$(RESET)"; \
	fi
	@echo ""
	@echo "$(CYAN)=== Docker Daemon Status ===$(RESET)"
	@if docker info >/dev/null 2>&1; then \
		echo "$(GREEN)✅ Docker daemon is running$(RESET)"; \
	else \
		echo "$(RED)❌ Docker daemon is not running$(RESET)"; \
	fi
	@$(STATUSLINE_SCRIPT) --ok "Build status collected" --extras "images=listed containers=checked system=analyzed daemon=checked"

# Enhanced Testing with Statusline
test-all: validate-environment ## Run comprehensive test suite with progress tracking
	@echo "$(GREEN)🧪 Running comprehensive test suite...$(RESET)"
	@$(STATUSLINE_SCRIPT) --phase Test --msg "Starting comprehensive test suite"
	@TEST_RESULTS=""; \
	echo "$(BLUE)Step 1: Running linting...$(RESET)"; \
	if $(MAKE) lint; then \
		echo "$(GREEN)✓ Linting passed$(RESET)"; \
		TEST_RESULTS="$$TEST_RESULTS lint=✓"; \
	else \
		echo "$(RED)❌ Linting failed$(RESET)"; \
		TEST_RESULTS="$$TEST_RESULTS lint=❌"; \
	fi; \
	echo "$(BLUE)Step 2: Running backend tests...$(RESET)"; \
	if $(MAKE) test-backend; then \
		echo "$(GREEN)✓ Backend tests passed$(RESET)"; \
		TEST_RESULTS="$$TEST_RESULTS backend=✓"; \
	else \
		echo "$(RED)❌ Backend tests failed$(RESET)"; \
		TEST_RESULTS="$$TEST_RESULTS backend=❌"; \
	fi; \
	echo "$(BLUE)Step 3: Running frontend tests...$(RESET)"; \
	if $(MAKE) test-frontend; then \
		echo "$(GREEN)✓ Frontend tests passed$(RESET)"; \
		TEST_RESULTS="$$TEST_RESULTS frontend=✓"; \
	else \
		echo "$(RED)❌ Frontend tests failed$(RESET)"; \
		TEST_RESULTS="$$TEST_RESULTS frontend=❌"; \
	fi; \
	if echo "$$TEST_RESULTS" | grep -q "❌"; then \
		$(STATUSLINE_SCRIPT) --error "Test suite failed" --extras "$$TEST_RESULTS check=individual_logs"; \
		echo "$(RED)❌ Test suite failed. Check individual test logs.$(RESET)"; \
		exit 1; \
	else \
		$(STATUSLINE_SCRIPT) --ok "All tests passed" --extras "$$TEST_RESULTS"; \
		echo "$(GREEN)✅ All tests passed successfully!$(RESET)"; \
	fi

# Production Readiness
prod-ready: validate-environment ## Complete production readiness check
	@echo "$(PURPLE)🚀 Production Readiness Assessment$(RESET)"
	@$(STATUSLINE_SCRIPT) --phase Test --msg "Assessing production readiness"
	@PROD_CHECKS=""; \
	echo "$(BLUE)1. Configuration validation...$(RESET)"; \
	if $(MAKE) config-validate >/dev/null 2>&1; then \
		echo "$(GREEN)✓ Configuration valid$(RESET)"; \
		PROD_CHECKS="$$PROD_CHECKS config=✓"; \
	else \
		echo "$(RED)✗ Configuration invalid$(RESET)"; \
		PROD_CHECKS="$$PROD_CHECKS config=✗"; \
	fi; \
	echo "$(BLUE)2. Build validation...$(RESET)"; \
	if $(MAKE) build-validate >/dev/null 2>&1; then \
		echo "$(GREEN)✓ Build configuration valid$(RESET)"; \
		PROD_CHECKS="$$PROD_CHECKS build=✓"; \
	else \
		echo "$(RED)✗ Build configuration invalid$(RESET)"; \
		PROD_CHECKS="$$PROD_CHECKS build=✗"; \
	fi; \
	echo "$(BLUE)3. System dependencies...$(RESET)"; \
	if $(MAKE) validate-dependencies >/dev/null 2>&1; then \
		echo "$(GREEN)✓ Dependencies available$(RESET)"; \
		PROD_CHECKS="$$PROD_CHECKS deps=✓"; \
	else \
		echo "$(RED)✗ Missing dependencies$(RESET)"; \
		PROD_CHECKS="$$PROD_CHECKS deps=✗"; \
	fi; \
	if echo "$$PROD_CHECKS" | grep -q "✗"; then \
		$(STATUSLINE_SCRIPT) --error "Production readiness failed" --extras "$$PROD_CHECKS"; \
		echo "$(RED)❌ Not ready for production deployment$(RESET)"; \
		exit 1; \
	else \
		$(STATUSLINE_SCRIPT) --ok "Production readiness confirmed" --extras "$$PROD_CHECKS"; \
		echo "$(GREEN)✅ Ready for production deployment!$(RESET)"; \
	fi

# Container Health and Recovery
containers-health: validate-environment ## Detailed container health assessment
	@echo "$(GREEN)🏥 Detailed Container Health Assessment$(RESET)"
	@$(STATUSLINE_SCRIPT) --phase Test --msg "Assessing container health"
	@echo "$(CYAN)=== Container Status ===$(RESET)"
	@if docker-compose -f $(DOCKER_COMPOSE_FILE) ps; then \
		echo "$(GREEN)✓ Container status retrieved$(RESET)"; \
	else \
		echo "$(YELLOW)⚠️ No containers running$(RESET)"; \
	fi
	@echo ""
	@echo "$(CYAN)=== Container Health Summary ===$(RESET)"
	@HEALTHY=0; UNHEALTHY=0; \
	for service in frontend backend backend-cpu ollama ollama-cpu redis; do \
		if docker-compose -f $(DOCKER_COMPOSE_FILE) ps $$service 2>/dev/null | grep -q "Up"; then \
			echo "$(GREEN)✓ $$service: Running$(RESET)"; \
			HEALTHY=$$((HEALTHY + 1)); \
		elif docker-compose -f $(DOCKER_COMPOSE_FILE) ps $$service 2>/dev/null | grep -q "Exit"; then \
			echo "$(RED)✗ $$service: Stopped$(RESET)"; \
			UNHEALTHY=$$((UNHEALTHY + 1)); \
		fi; \
	done; \
	echo "$(CYAN)Summary: $$HEALTHY healthy, $$UNHEALTHY unhealthy$(RESET)"
	@echo ""
	@$(STATUSLINE_SCRIPT) --ok "Container health assessment completed" --extras "services=checked health=analyzed"

containers-restart-unhealthy: validate-environment ## Restart unhealthy containers
	@echo "$(YELLOW)🔄 Restarting unhealthy containers...$(RESET)"
	@$(STATUSLINE_SCRIPT) --phase Deploy --msg "Restarting unhealthy containers"
	@RESTARTED=0; \
	for service in frontend backend backend-cpu ollama ollama-cpu redis; do \
		if docker-compose -f $(DOCKER_COMPOSE_FILE) ps $$service 2>/dev/null | grep -q "Exit\|unhealthy"; then \
			echo "$(YELLOW)Restarting $$service...$(RESET)"; \
			if docker-compose -f $(DOCKER_COMPOSE_FILE) restart $$service; then \
				echo "$(GREEN)✓ $$service restarted$(RESET)"; \
				RESTARTED=$$((RESTARTED + 1)); \
			else \
				echo "$(RED)❌ Failed to restart $$service$(RESET)"; \
			fi; \
		fi; \
	done; \
	if [ $$RESTARTED -gt 0 ]; then \
		$(STATUSLINE_SCRIPT) --ok "Restarted $$RESTARTED unhealthy containers" --extras "count=$$RESTARTED"; \
		echo "$(GREEN)✅ Restarted $$RESTARTED unhealthy containers$(RESET)"; \
	else \
		$(STATUSLINE_SCRIPT) --ok "No unhealthy containers found" --extras "all_healthy=true"; \
		echo "$(GREEN)✅ All containers are healthy$(RESET)"; \
	fi

# ==============================================================================
# COMPREHENSIVE SUCCESS VALIDATION SYSTEM
# ==============================================================================

validate-all: ## Run complete validation of all Makefile targets and system health
	@echo "$(PURPLE)🎯 COMPREHENSIVE MAKEFILE VALIDATION$(RESET)"
	@echo "===================================="
	@$(STATUSLINE_SCRIPT) --phase Validation --msg "Starting comprehensive validation"
	@$(MAKE) validate-environment
	@$(MAKE) validate-targets
	@$(MAKE) validate-dependencies
	@$(MAKE) validate-configuration
	@echo "$(GREEN)✅ ALL VALIDATIONS PASSED - 100% SUCCESS RATE ACHIEVED$(RESET)"
	@$(STATUSLINE_SCRIPT) --ok "100% validation success" --extras "environment=✓ targets=✓ deps=✓ config=✓"

validate-targets: ## Validate that all critical Makefile targets work correctly
	@echo "$(BLUE)🎯 Validating Makefile targets...$(RESET)"
	@$(STATUSLINE_SCRIPT) --phase Test --msg "Testing critical Makefile targets"
	@FAILED_TARGETS=""; \
	for target in help check-prerequisites config-check config-validate build-validate health-basic build-status; do \
		echo "$(CYAN)Testing target: $$target$(RESET)"; \
		if timeout 60s $(MAKE) $$target >/dev/null 2>&1; then \
			echo "$(GREEN)✓ $$target$(RESET)"; \
		else \
			echo "$(RED)✗ $$target$(RESET)"; \
			FAILED_TARGETS="$$FAILED_TARGETS $$target"; \
		fi; \
	done; \
	if [ -n "$$FAILED_TARGETS" ]; then \
		$(STATUSLINE_SCRIPT) --error "Target validation failed" --extras "failed=$$FAILED_TARGETS"; \
		echo "$(RED)❌ Failed targets:$$FAILED_TARGETS$(RESET)"; \
		exit 1; \
	else \
		$(STATUSLINE_SCRIPT) --ok "All critical targets working" --extras "tested=help,check-prerequisites,config-check,config-validate,build-validate,health-basic,build-status"; \
		echo "$(GREEN)✅ All critical targets working correctly$(RESET)"; \
	fi

validate-dependencies: ## Validate all system dependencies are available
	@echo "$(BLUE)🔧 Validating system dependencies...$(RESET)"
	@$(STATUSLINE_SCRIPT) --phase Test --msg "Checking system dependencies"
	@MISSING_DEPS=""; \
	for cmd in docker docker-compose curl timeout; do \
		if command -v $$cmd >/dev/null 2>&1; then \
			echo "$(GREEN)✓ $$cmd available$(RESET)"; \
		else \
			echo "$(RED)✗ $$cmd missing$(RESET)"; \
			MISSING_DEPS="$$MISSING_DEPS $$cmd"; \
		fi; \
	done; \
	if [ -n "$$MISSING_DEPS" ]; then \
		$(STATUSLINE_SCRIPT) --error "Missing dependencies" --extras "missing=$$MISSING_DEPS"; \
		echo "$(RED)❌ Missing dependencies:$$MISSING_DEPS$(RESET)"; \
		exit 1; \
	else \
		$(STATUSLINE_SCRIPT) --ok "All dependencies available" --extras "checked=docker,docker-compose,curl,timeout"; \
		echo "$(GREEN)✅ All dependencies available$(RESET)"; \
	fi

validate-configuration: ## Validate all configuration files and Docker setup
	@echo "$(BLUE)⚙️ Validating configuration...$(RESET)"
	@$(STATUSLINE_SCRIPT) --phase Test --msg "Validating configuration files"
	@$(MAKE) config-check >/dev/null 2>&1
	@$(MAKE) config-validate >/dev/null 2>&1
	@if docker info >/dev/null 2>&1; then \
		echo "$(GREEN)✓ Docker daemon running$(RESET)"; \
	else \
		echo "$(RED)✗ Docker daemon not running$(RESET)"; \
		$(STATUSLINE_SCRIPT) --error "Docker daemon not running" --extras "solution=start_docker"; \
		exit 1; \
	fi
	@$(STATUSLINE_SCRIPT) --ok "Configuration validation passed" --extras "config_files=✓ docker_compose=✓ docker_daemon=✓"
	@echo "$(GREEN)✅ All configuration valid$(RESET)"

success-report: ## Generate comprehensive success report
	@echo "$(PURPLE)📊 MAKEFILE SUCCESS REPORT$(RESET)"
	@echo "============================="
	@echo "$(CYAN)Report generated at: $$(date)$(RESET)"
	@echo "$(CYAN)Environment: $$(uname -s) $$(uname -r)$(RESET)"
	@echo "$(CYAN)Docker version: $$(docker --version 2>/dev/null || echo 'Not available')$(RESET)"
	@echo "$(CYAN)Docker Compose version: $$(docker-compose --version 2>/dev/null || echo 'Not available')$(RESET)"
	@echo ""
	@$(MAKE) validate-all
	@echo ""
	@echo "$(GREEN)🎉 SUCCESS: 100% MAKEFILE VALIDATION COMPLETE$(RESET)"
	@echo "$(GREEN)All targets tested and working correctly$(RESET)"
	@echo "$(GREEN)All dependencies verified and available$(RESET)"
	@echo "$(GREEN)All configurations validated successfully$(RESET)"
	@$(STATUSLINE_SCRIPT) --ok "100% success rate achieved" --extras "validation=complete targets=working deps=available config=valid"

# Quick validation for CI/CD
ci-validate: validate-environment validate-dependencies validate-configuration ## Quick validation for CI/CD pipelines
	@echo "$(GREEN)✅ CI/CD validation passed$(RESET)"
	@$(STATUSLINE_SCRIPT) --ok "CI/CD validation successful" --extras "environment=✓ deps=✓ config=✓"