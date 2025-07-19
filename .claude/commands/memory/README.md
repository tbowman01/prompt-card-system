# Memory Commands

Persistent storage and knowledge management capabilities for Claude Flow. These commands provide advanced memory systems for cross-session context preservation, intelligent knowledge storage, and distributed memory coordination across agent networks.

## 🎯 Overview

The memory suite provides:
- **Persistent Context Management** - Maintain context and knowledge across sessions and restarts
- **Intelligent Knowledge Storage** - Smart storage and retrieval of information and patterns
- **Cross-Session Continuity** - Seamless continuation of work across different sessions
- **Distributed Memory Systems** - Shared memory pools accessible across agent networks
- **Pattern-Based Retrieval** - Intelligent search and retrieval based on patterns and context

## 💾 Core Memory Commands

### Primary Memory Operations
- **[memory-usage](./memory-usage.md)** - Store, retrieve, and manage persistent data with TTL and namespacing
- **[memory-persist](./memory-persist.md)** - Cross-session persistence and context management
- **[memory-search](./memory-search.md)** - Intelligent pattern-based search through stored knowledge

## 🚀 Quick Start Examples

### Basic Memory Operations
```bash
# Store important context and knowledge
npx claude-flow memory memory-usage --action store --key "project/context" --value "..." --namespace "current-session"

# Retrieve stored knowledge
npx claude-flow memory memory-usage --action retrieve --key "project/context" --namespace "current-session"

# Search for patterns in stored knowledge
npx claude-flow memory memory-search --pattern "successful-patterns" --limit 10 --namespace "learning"
```

### Advanced Memory Management
```bash
# Cross-session persistence
npx claude-flow memory memory-persist --session-id "project-alpha" --persist-context --load-patterns

# Intelligent knowledge search
npx claude-flow memory memory-search --pattern "api-design-patterns" --semantic-search --context-aware

# Distributed memory coordination
npx claude-flow memory memory-usage --action store --collective-access --distributed-sync --key "shared/knowledge"
```

## 🧠 Memory Architecture

### 1. Hierarchical Namespacing
```bash
# Organized knowledge storage
npx claude-flow memory memory-usage --action store --namespace "projects/api-dev/patterns" --key "auth-flow"
npx claude-flow memory memory-usage --action store --namespace "projects/api-dev/decisions" --key "architecture-choice"
npx claude-flow memory memory-usage --action store --namespace "learning/successful-approaches" --key "testing-strategy"
```
- **Project Namespaces** - Organize knowledge by project or domain
- **Temporal Namespaces** - Organize by time periods or sessions
- **Knowledge Type Namespaces** - Organize by type of knowledge (patterns, decisions, learnings)
- **Agent Namespaces** - Agent-specific knowledge and context

### 2. Intelligent Retrieval Systems
```bash
# Context-aware retrieval
npx claude-flow memory memory-search --pattern "authentication" --context-match --related-concepts
```
- **Semantic Search** - Search based on meaning and context, not just keywords
- **Pattern Matching** - Find similar patterns and approaches
- **Context Awareness** - Retrieve knowledge relevant to current context
- **Relationship Mapping** - Find related and connected knowledge

### 3. Cross-Session Continuity
```bash
# Session management and continuity
npx claude-flow memory memory-persist --session-restore --context-continuity --knowledge-bridge
```
- **Session Snapshots** - Save complete session state for restoration
- **Context Bridging** - Connect knowledge across different sessions
- **Work Continuity** - Seamlessly continue work from previous sessions
- **Knowledge Evolution** - Track how knowledge evolves over time

## 💡 Advanced Memory Features

### Time-To-Live (TTL) Management
```bash
# TTL-based memory management
npx claude-flow memory memory-usage --action store --key "temp/analysis" --ttl 3600 --auto-cleanup
npx claude-flow memory memory-usage --action store --key "permanent/patterns" --ttl-never --long-term
```
- **Automatic Cleanup** - Remove outdated information automatically
- **Temporal Relevance** - Keep information relevant to timeframes
- **Resource Management** - Manage memory usage efficiently
- **Long-term Storage** - Preserve important knowledge permanently

### Distributed Memory Coordination
```bash
# Shared memory across agents
npx claude-flow memory memory-usage --action store --shared-access --agent-coordination --key "collective/insights"
```
- **Shared Knowledge Pools** - Knowledge accessible to all agents
- **Coordination Synchronization** - Keep agents synchronized through shared memory
- **Collective Learning** - Build collective knowledge across agent network
- **Distributed Decision Making** - Share decision-making information

### Intelligent Compression and Optimization
```bash
# Memory optimization
npx claude-flow memory memory-usage --action optimize --compress-patterns --deduplicate --efficiency-mode
```
- **Pattern Compression** - Compress repetitive patterns efficiently
- **Deduplication** - Remove duplicate information and consolidate
- **Semantic Compression** - Compress while preserving meaning
- **Access Optimization** - Optimize for fast retrieval and access

## 🔧 MCP Integration

### Claude Code Memory Integration
```javascript
// Store persistent context
mcp__claude-flow__memory_usage({
  action: "store",
  key: "project/current-state",
  value: {
    progress: "api-development",
    decisions: ["microservices", "postgres"],
    patterns: ["repository-pattern", "event-sourcing"]
  },
  namespace: "development",
  ttl: 86400
})

// Intelligent knowledge search
mcp__claude-flow__memory_search({
  pattern: "successful-api-patterns",
  limit: 5,
  namespace: "learning",
  semantic_search: true
})

// Cross-session persistence
mcp__claude-flow__memory_persist({
  session_id: "api-project-2024",
  load_context: true,
  preserve_patterns: true
})
```

### Hooks Integration
```bash
# Memory integration with hooks
npx claude-flow hooks pre-task --memory-load --context-restore --pattern-preparation
npx claude-flow hooks post-task --memory-store --pattern-save --knowledge-update
npx claude-flow hooks session-end --memory-persist --knowledge-consolidate --pattern-archive
```

## 📊 Memory Categories

### Context Management
- **Session Context** - Maintain context within and across sessions
- **Project Context** - Project-specific knowledge and state
- **User Context** - User preferences and patterns
- **Environmental Context** - System and environmental state

### Knowledge Storage
- **Pattern Libraries** - Successful patterns and approaches
- **Decision Records** - Important decisions and rationale
- **Learning Insights** - Insights and lessons learned
- **Best Practices** - Proven approaches and methodologies

### Collaborative Memory
- **Shared Knowledge** - Knowledge accessible to all agents
- **Collective Insights** - Insights from collective intelligence
- **Team Memory** - Team-specific knowledge and context
- **Organizational Memory** - Organization-wide knowledge

### Performance Memory
- **Optimization Patterns** - Performance optimization strategies
- **Benchmark Results** - Performance measurements and results
- **Resource Usage Patterns** - Resource utilization patterns
- **Efficiency Metrics** - Efficiency measurements and trends

## 📈 Memory Performance Metrics

### Storage Efficiency
- **Compression Ratio** - Efficiency of knowledge compression
- **Access Speed** - Speed of knowledge retrieval
- **Storage Utilization** - Efficiency of storage usage
- **Deduplication Effectiveness** - Success of duplicate removal

### Knowledge Quality
- **Relevance Score** - Relevance of retrieved knowledge
- **Knowledge Freshness** - How up-to-date stored knowledge is
- **Pattern Accuracy** - Accuracy of stored patterns
- **Context Preservation** - How well context is maintained

### Collaboration Effectiveness
- **Knowledge Sharing Rate** - How effectively knowledge is shared
- **Cross-Session Continuity** - Quality of session transitions
- **Agent Synchronization** - How well agents stay synchronized
- **Collective Learning Rate** - Speed of collective knowledge growth

## 🎯 Best Practices

### Memory Design
1. **Namespace Organization** - Use clear and consistent namespace hierarchies
2. **TTL Strategy** - Implement appropriate TTL policies for different knowledge types
3. **Access Patterns** - Design for common access patterns and usage
4. **Redundancy Planning** - Plan for backup and redundancy of critical knowledge

### Knowledge Management
1. **Quality Control** - Implement quality controls for stored knowledge
2. **Version Management** - Track and manage knowledge evolution
3. **Relevance Maintenance** - Keep knowledge relevant and up-to-date
4. **Privacy Considerations** - Implement appropriate privacy and security measures

### Performance Optimization
1. **Efficient Storage** - Use efficient storage and compression strategies
2. **Caching Strategy** - Implement intelligent caching for frequently accessed knowledge
3. **Access Optimization** - Optimize for fast and efficient knowledge access
4. **Resource Management** - Manage memory resources effectively

## 🔄 Memory Workflow Examples

### 1. Project Development Memory
```bash
# Initialize project memory
npx claude-flow memory memory-usage --action store --namespace "project/setup" --key "initial-requirements"

# Store development decisions
npx claude-flow memory memory-usage --action store --namespace "project/decisions" --key "architecture" --value "microservices"

# Search for relevant patterns
npx claude-flow memory memory-search --pattern "microservices-patterns" --namespace "learning"
```

### 2. Learning and Improvement Memory
```bash
# Store successful patterns
npx claude-flow memory memory-usage --action store --namespace "learning/patterns" --key "successful-auth-flow"

# Search for similar solutions
npx claude-flow memory memory-search --pattern "authentication" --context-aware --semantic-search

# Cross-reference with previous learnings
npx claude-flow memory memory-search --pattern "security-patterns" --related-concepts
```

### 3. Cross-Session Continuity
```bash
# Save session state
npx claude-flow memory memory-persist --session-save --context-complete --pattern-archive

# Restore previous session
npx claude-flow memory memory-persist --session-restore --context-load --pattern-reactivate

# Bridge knowledge across sessions
npx claude-flow memory memory-search --pattern "previous-session-insights" --continuity-mode
```

## 🔗 Related Documentation

- **[HiveMind Commands](../hivemind/README.md)** - Collective memory and intelligence
- **[Hooks Commands](../hooks/README.md)** - Memory integration with lifecycle hooks
- **[Analysis Commands](../analysis/README.md)** - Memory-based analysis and insights
- **[Training Commands](../training/README.md)** - Memory for training and learning

## 🆘 Troubleshooting

### Common Memory Issues
- **Memory Fragmentation** - Memory becoming fragmented and inefficient
- **Access Performance** - Slow memory access and retrieval
- **Storage Overflow** - Running out of memory storage space
- **Context Loss** - Loss of important context and knowledge

### Performance Tips
- Use appropriate TTL settings to manage memory usage
- Implement regular cleanup and optimization routines
- Use namespacing to organize and optimize access patterns
- Monitor memory usage and performance regularly
- Implement efficient compression and deduplication strategies

---

*For detailed command usage, see individual command documentation files.*