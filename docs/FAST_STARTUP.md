# Fast Startup Guide (< 5 Minutes)

## 🚀 Quick Start

The Prompt Card System is optimized for fast initial startup, allowing you to begin using the application within **5 minutes** while models download in the background.

### Prerequisites
- Docker and Docker Compose installed
- At least 8GB RAM available
- 20GB+ disk space for models (can be less initially)

### One-Command Start

```bash
# Quick start with automatic GPU/CPU detection
./scripts/quick-start.sh

# Quick start with demo data
./scripts/quick-start.sh --demo

# Quick start with monitoring
./scripts/quick-start.sh --demo --monitor
```

## 🎯 Startup Timeline

| Time | Status | What's Available |
|------|--------|------------------|
| 0-30s | Core services starting | Redis, Frontend container |
| 30s-1min | Backend online | API endpoints, health checks |
| 1-2min | Frontend ready | Full UI accessible at http://localhost:3000 |
| 2-3min | Primary model loaded | phi4-mini-reasoning:3.8b ready |
| 3-5min | Application fully operational | All features available |
| 5-30min | Background downloads | Additional models downloading |

## 📦 Preloaded Models

The custom Ollama image includes:

1. **phi4-mini-reasoning:3.8b** (Preloaded)
   - Small, fast reasoning model
   - Available immediately on startup
   - Good for testing and development

2. **Background Downloads** (Automatic):
   - `phi4:latest` - Latest Phi-4 model
   - `llama3.2-vision:latest` - Vision capabilities
   - `granite3.3:latest` - IBM's Granite model

## 🐳 Using the Optimized Image

### Pull from GitHub Container Registry

```bash
# Pull the pre-built image with models
docker pull ghcr.io/tbowman01/prompt-card-system-ollama:latest

# Use in docker-compose
export OLLAMA_IMAGE=ghcr.io/tbowman01/prompt-card-system-ollama:latest
docker-compose -f docker-compose.dev.yml up
```

### Build Locally

```bash
# Build custom Ollama image
docker build -t prompt-card-ollama ./docker/ollama

# Use local image
export OLLAMA_IMAGE=prompt-card-ollama:latest
docker-compose -f docker-compose.dev.yml up
```

## ⚙️ Configuration Options

### Environment Variables

```bash
# Skip background model downloads
export DOWNLOAD_ADDITIONAL_MODELS=false

# Use official Ollama image instead of custom
export OLLAMA_IMAGE=ollama/ollama:latest

# GPU/CPU selection
export COMPOSE_PROFILES=gpu  # or 'cpu' for CPU-only
```

### Makefile Commands

```bash
# Standard startup (may take longer)
make dev

# Quick demo mode
make demo

# Clean start
make clean && make dev
```

## 🔍 Monitoring Startup

### Check Service Status

```bash
# View all services
docker-compose -f docker-compose.dev.yml ps

# Check Ollama models
docker exec prompt-card-system-ollama-1 ollama list

# Monitor logs
docker-compose -f docker-compose.dev.yml logs -f ollama
```

### Health Endpoints

- Frontend: http://localhost:3000/api/health
- Backend: http://localhost:3001/api/health
- Ollama: http://localhost:11434/api/version

## 🎮 Demo Mode

Start with prepopulated data for immediate testing:

```bash
# Quick start with demo
./scripts/quick-start.sh --demo

# Or using make
make demo
```

This loads:
- 5 prompt card templates
- 11 test cases
- Sample analytics data

## 🚨 Troubleshooting

### Slow Startup

If startup takes longer than 5 minutes:

1. **Check Docker resources**:
   ```bash
   docker system df
   docker system prune -a  # Clean unused data
   ```

2. **Use CPU profile** (if GPU issues):
   ```bash
   COMPOSE_PROFILES=cpu docker-compose -f docker-compose.dev.yml up
   ```

3. **Skip model downloads**:
   ```bash
   export DOWNLOAD_ADDITIONAL_MODELS=false
   ```

### Model Download Issues

```bash
# Stop background downloads
docker exec prompt-card-system-ollama-1 touch /tmp/stop_downloads

# Manually pull specific model
docker exec prompt-card-system-ollama-1 ollama pull phi4:latest
```

## 📊 Performance Tips

1. **SSD Storage**: Store Docker volumes on SSD for faster model loading
2. **RAM Allocation**: Ensure Docker has at least 8GB RAM allocated
3. **Network Speed**: Initial model downloads depend on internet speed
4. **GPU Acceleration**: Use NVIDIA GPU for 10x faster inference

## 🔄 Updating Models

To update or add new models:

1. Edit `docker/ollama/download-models.sh`
2. Rebuild the image:
   ```bash
   docker build -t prompt-card-ollama ./docker/ollama
   ```
3. Restart services:
   ```bash
   docker-compose -f docker-compose.dev.yml down
   docker-compose -f docker-compose.dev.yml up
   ```

## 📝 Notes

- The application is fully functional even while models are downloading
- Background downloads automatically stop if disk space is low
- Models are cached locally and persist across restarts
- You can use the application with just the primary model if needed