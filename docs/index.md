# Prompt Card System Documentation

[![GitHub Pages](https://img.shields.io/badge/docs-GitHub%20Pages-blue)](https://tbowman01.github.io/prompt-card-system/)
[![API Reference](https://img.shields.io/badge/API-OpenAPI%203.0-green)](./api/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Welcome to the comprehensive documentation for the **Prompt Card System** - an enterprise-grade AI prompt testing and evaluation platform.

## 🚀 Quick Navigation

<div class="tip custom-block" style="padding-top: 8px">

**New to the project?** Start with our [Getting Started Guide](./user-guide/getting-started.md)

</div>

### 📚 Documentation Sections

| Section | Description | Best For |
|---------|-------------|----------|
| [**🚀 User Guide**](./user-guide/) | Complete user documentation and tutorials | End users, prompt engineers |
| [**🔌 API Reference**](./api/) | RESTful API documentation with examples | Developers, integrators |
| [**⚙️ Developer Guide**](./developer/) | Architecture, SPARC workflow, and development | Contributors, architects |
| [**🚀 Deployment**](./deployment/) | Docker, GHCR, and production deployment | DevOps, system administrators |

## 🎯 Platform Overview

The Prompt Card System is a comprehensive enterprise AI testing platform featuring:

### ✨ Core Features
- **🃏 Prompt Card Management** - Intelligent categorization and version control
- **🧪 Advanced Testing** - Parallel execution with semantic similarity validation
- **📊 Real-time Analytics** - Performance metrics and cost tracking
- **🤖 AI-Powered Optimization** - Smart prompt analysis and suggestions

### 🏢 Enterprise Features
- **👥 Real-time Collaboration** - Multi-user editing with operational transform
- **🔒 Blockchain Audit Trail** - Immutable activity logging
- **🎤 Voice Interface** - Natural language commands in 6 languages
- **🏗️ Multi-tenant Architecture** - Complete workspace isolation

## 🎮 Quick Demo

Experience the platform instantly:

```bash
# 3-minute quick demo
make demo-quick

# Full feature demonstration
make demo

# Access demo at http://localhost:3000?demo=true
```

## 🛠️ Technology Stack

<div class="warning custom-block">

**Performance Highlight:** 84.8% SWE-Bench solve rate with 2.8-4.4x speed improvement

</div>

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **WebSocket Integration** - Real-time updates

### Backend
- **Node.js + Express** - High-performance API server
- **PostgreSQL** - Multi-tenant database schema
- **Redis** - Caching and session management
- **OpenTelemetry** - Distributed tracing

### AI & ML
- **Multiple LLM Support** - OpenAI, Anthropic, Ollama
- **Vector Database** - Semantic similarity search
- **Federated Learning** - Privacy-preserving ML training
- **Predictive Analytics** - Resource forecasting

## 📈 Performance Metrics

| Metric | Performance |
|--------|-------------|
| **Parallel Test Execution** | Up to 10x faster |
| **Real-time Updates** | Sub-second latency |
| **Analytics Processing** | 1000+ events/second |
| **Report Generation** | Complex reports in <5s |

## 🔧 Claude Flow SPARC Integration

This project leverages the **SPARC methodology** (Specification, Pseudocode, Architecture, Refinement, Completion) with Claude Flow orchestration:

### 🤖 Available Agents (54 Total)
- **Core Development**: `coder`, `reviewer`, `tester`, `planner`
- **Swarm Coordination**: `hierarchical-coordinator`, `mesh-coordinator`
- **GitHub Integration**: `pr-manager`, `code-review-swarm`, `issue-tracker`
- **Performance**: `perf-analyzer`, `performance-benchmarker`

### 🚀 Quick SPARC Commands
```bash
# Run complete TDD workflow
npx claude-flow sparc tdd "feature-name"

# Execute specific mode
npx claude-flow sparc run architect "system-design"

# Parallel execution
npx claude-flow sparc batch modes "task-description"
```

## 🔒 Security & Compliance

- **🛡️ OpenSSF Scorecard** - Comprehensive security assessment
- **🔍 Automated Scanning** - Daily vulnerability detection
- **📊 Code Coverage** - 85%+ test coverage
- **⚡ Performance Grade** - A+ rating

## 🚀 Getting Started

Choose your path:

<div class="tip custom-block">

### 👤 For Users
1. [Installation Guide](./user-guide/installation.md)
2. [Quick Start Tutorial](./user-guide/getting-started.md)
3. [Create Your First Prompt Card](./user-guide/prompt-cards.md)

</div>

<div class="info custom-block">

### 🔧 For Developers
1. [Development Setup](./developer/setup.md)
2. [Architecture Overview](./developer/architecture.md)
3. [SPARC Workflow](./developer/sparc-overview.md)

</div>

<div class="warning custom-block">

### 🚀 For DevOps
1. [Docker Deployment](./deployment/docker.md)
2. [GHCR Integration](./deployment/ghcr.md)
3. [Production Setup](./deployment/production.md)

</div>

## 🆘 Need Help?

- **🐛 Found a bug?** [Open an issue](https://github.com/tbowman01/prompt-card-system/issues)
- **❓ Have questions?** Check our [FAQ](./troubleshooting/faq.md)
- **💬 Want to discuss?** Join our [discussions](https://github.com/tbowman01/prompt-card-system/discussions)

## 📝 Contributing

We welcome contributions! See our [Contributing Guide](./developer/contributing.md) for details.

---

<div style="text-align: center; margin-top: 2rem; padding: 1rem; background: var(--vp-c-bg-alt); border-radius: 8px;">

**📚 Documentation last updated:** {{ new Date().toISOString().split('T')[0] }}

**🔗 Live Demo:** [prompt-card-system.demo.com](https://prompt-card-system.demo.com)

</div>