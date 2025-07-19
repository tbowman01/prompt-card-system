# Hooks Commands

Event-driven automation and integration points for Claude Flow. These commands provide powerful automation capabilities through lifecycle hooks, enabling automatic optimization, coordination, and intelligent workflow management.

## 🎯 Overview

The hooks suite provides:
- **Lifecycle Automation** - Automatic execution at key workflow points
- **Event-Driven Integration** - Respond to system events with intelligent actions
- **Workflow Optimization** - Automatic performance tuning and resource optimization
- **Intelligent Coordination** - Automated agent coordination and task management
- **Session Management** - Comprehensive session tracking and optimization

## 🔗 Core Hook Commands

### Task Lifecycle Hooks
- **[pre-task](./pre-task.md)** - Pre-execution setup, validation, and intelligent preparation
- **[post-task](./post-task.md)** - Post-execution analysis, cleanup, and learning integration

### Edit Lifecycle Hooks
- **[pre-edit](./pre-edit.md)** - Pre-edit validation, context loading, and optimization
- **[post-edit](./post-edit.md)** - Post-edit analysis, coordination sync, and progress tracking

### Session Management
- **[session-end](./session-end.md)** - Session summary, optimization analysis, and knowledge consolidation

## 🚀 Quick Start Examples

### Basic Hook Setup
```bash
# Pre-task intelligent preparation
npx claude-flow hooks pre-task --auto-spawn --optimize-topology --load-context

# Post-task analysis and learning
npx claude-flow hooks post-task --analyze-performance --update-models --save-patterns

# Session-end comprehensive analysis
npx claude-flow hooks session-end --generate-summary --export-metrics --optimize-future
```

### Advanced Hook Automation
```bash
# Intelligent pre-edit preparation
npx claude-flow hooks pre-edit --context-analysis --capability-match --resource-optimize

# Comprehensive post-edit processing
npx claude-flow hooks post-edit --coordination-sync --pattern-update --quality-assess

# Advanced session management
npx claude-flow hooks session-end --full-analysis --knowledge-consolidation --strategic-planning
```

## 🔄 Hook Lifecycle Integration

### 1. Pre-Task Automation
```bash
# Comprehensive pre-task setup
npx claude-flow hooks pre-task --intelligent-preparation --context-analysis --resource-planning
```
- **Context Loading** - Load relevant context and historical data
- **Resource Planning** - Optimize resource allocation for upcoming tasks
- **Agent Preparation** - Prepare and configure agents for optimal performance
- **Topology Optimization** - Adjust swarm topology based on task requirements

### 2. Post-Task Processing
```bash
# Comprehensive post-task analysis
npx claude-flow hooks post-task --performance-analysis --learning-integration --optimization-updates
```
- **Performance Analysis** - Analyze task completion efficiency and quality
- **Learning Integration** - Update models and patterns based on outcomes
- **Result Validation** - Validate task results and identify improvements
- **Knowledge Storage** - Store learnings and patterns for future use

### 3. Edit Lifecycle Management
```bash
# Pre-edit intelligent preparation
npx claude-flow hooks pre-edit --context-preparation --validation-setup --optimization-ready

# Post-edit comprehensive processing
npx claude-flow hooks post-edit --coordination-update --pattern-analysis --quality-validation
```
- **Context Preparation** - Load relevant context for edit operations
- **Validation Setup** - Prepare validation and quality checks
- **Coordination Updates** - Sync changes across agent network
- **Pattern Analysis** - Analyze edit patterns for optimization

### 4. Session Management
```bash
# Comprehensive session-end processing
npx claude-flow hooks session-end --full-analysis --knowledge-consolidation --future-optimization
```
- **Session Analysis** - Comprehensive analysis of session performance
- **Knowledge Consolidation** - Consolidate learnings and insights
- **Future Optimization** - Plan optimizations for future sessions
- **Export and Reporting** - Generate reports and export session data

## 🧠 Intelligent Hook Features

### Automatic GitHub Issue Creation (NEW!)
```bash
# Automatically creates GitHub issues when using the Task tool
# This hook is now configured in .claude/settings.json
```
- **Smart Task Detection** - Automatically detects substantial tasks (Agent, Research, Implement, Analyze, Create, Build, Design, Develop)
- **GitHub Integration** - Creates issues with proper labels and assignment
- **Rich Context** - Includes task description, session ID, and timestamp in issue body
- **Non-Blocking** - Failures won't interrupt your workflow (errors are handled gracefully)

**How to Enable:**
Add this to your `.claude/settings.json` under the `hooks` section:
```json
{
  "matcher": "Task",
  "hooks": [{
    "type": "command",
    "command": "cat | jq -r 'if (.tool_input.description | test(\"^(Agent|Research|Implement|Analyze|Create|Build|Design|Develop)\")) then .tool_input.description else empty end' | xargs -I {} bash -c 'gh issue create --title \"Task: {}\" --body \"Automated task tracking\\n\\nTask: {}\\nSession: claude-flow-$(date +%s)\\nTimestamp: $(date)\\nAutomation: Claude Flow\" --label claude-flow,automated --assignee @me 2>/dev/null || true'"
  }]
}
```

**Benefits:**
- Automatic task tracking in GitHub
- No manual issue creation needed
- Maintains project history
- Easy to filter with labels
- Self-assigns for accountability

### Automatic Optimization
```bash
# Self-optimizing hooks
npx claude-flow hooks pre-task --auto-optimize --learn-patterns --adapt-behavior
```
- **Performance Tuning** - Automatic performance optimization based on historical data
- **Pattern Learning** - Learn from successful patterns and apply them automatically
- **Adaptive Behavior** - Adapt hook behavior based on context and outcomes
- **Resource Optimization** - Automatically optimize resource usage and allocation

### Context Intelligence
```bash
# Context-aware hook execution
npx claude-flow hooks pre-edit --context-intelligence --smart-preparation --predictive-loading
```
- **Context Analysis** - Intelligent analysis of current context and requirements
- **Smart Preparation** - Prepare resources and agents based on context analysis
- **Predictive Loading** - Preload likely needed resources and context
- **Adaptive Configuration** - Configure systems based on predicted needs

### Learning Integration
```bash
# Learning-enabled hooks
npx claude-flow hooks post-task --learning-integration --pattern-update --model-improvement
```
- **Continuous Learning** - Continuous improvement through experience
- **Pattern Updates** - Update and refine patterns based on outcomes
- **Model Improvement** - Improve models based on task results
- **Knowledge Sharing** - Share learnings across agent network

## 🔧 MCP Integration

### Claude Code Hook Integration
```javascript
// Pre-task hook with MCP
mcp__claude-flow__hooks_pre_task({
  auto_spawn: true,
  optimize_topology: true,
  load_context: true,
  intelligent_preparation: true
})

// Post-task hook with analysis
mcp__claude-flow__hooks_post_task({
  analyze_performance: true,
  update_models: true,
  save_patterns: true,
  coordination_sync: true
})

// Session-end comprehensive processing
mcp__claude-flow__hooks_session_end({
  generate_summary: true,
  export_metrics: true,
  knowledge_consolidation: true,
  future_optimization: true
})
```

### Automated Hook Chains
```bash
# Chained hook execution
npx claude-flow hooks pre-task --chain-to-post --full-lifecycle --intelligent-handoff
npx claude-flow hooks post-edit --chain-to-task --coordination-bridge --seamless-transition
```

## 📊 Hook Categories

### Automation Hooks
- **Intelligent Spawning** - Automatic agent creation based on task analysis
- **Resource Optimization** - Automatic resource allocation and tuning
- **Workflow Adaptation** - Dynamic workflow adjustment based on context
- **Quality Assurance** - Automatic quality checks and validation

### Coordination Hooks
- **Agent Synchronization** - Keep agents coordinated and synchronized
- **Task Distribution** - Intelligent task routing and distribution
- **Progress Tracking** - Monitor and track progress across agent network
- **Conflict Resolution** - Automatic resolution of conflicts and issues

### Learning Hooks
- **Pattern Recognition** - Identify and learn from patterns in execution
- **Model Updates** - Update and improve models based on outcomes
- **Knowledge Storage** - Store and organize learnings for future use
- **Continuous Improvement** - Enable continuous system improvement

### Integration Hooks
- **External System Integration** - Connect with external tools and systems
- **Data Synchronization** - Sync data across different components
- **Event Propagation** - Propagate events across system components
- **Workflow Triggers** - Trigger workflows based on events and conditions

## 📈 Hook Performance Metrics

### Automation Effectiveness
- **Hook Execution Speed** - Time taken for hook processing
- **Automation Success Rate** - Percentage of successful automated actions
- **Resource Optimization Impact** - Improvement in resource utilization
- **Quality Improvement** - Enhancement in output quality through hooks

### Learning Progress
- **Pattern Recognition Accuracy** - Accuracy of learned patterns
- **Model Improvement Rate** - Rate of model performance improvement
- **Knowledge Accumulation** - Growth in stored knowledge and patterns
- **Adaptation Speed** - Speed of adaptation to new contexts

### Integration Quality
- **Coordination Effectiveness** - Quality of coordination through hooks
- **Synchronization Accuracy** - Accuracy of synchronization operations
- **Event Handling Reliability** - Reliability of event processing
- **Workflow Continuity** - Smoothness of workflow transitions

## 🎯 Best Practices

### Hook Design
1. **Lightweight Processing** - Keep hook processing fast and efficient
2. **Error Handling** - Implement robust error handling and recovery
3. **Idempotent Operations** - Ensure hooks can be safely re-executed
4. **Context Preservation** - Maintain context across hook executions

### Automation Strategy
1. **Gradual Automation** - Start with basic automation and gradually increase complexity
2. **Monitoring and Validation** - Monitor hook performance and validate automation results
3. **Fallback Mechanisms** - Implement fallback mechanisms for automation failures
4. **Regular Review** - Regularly review and update automation strategies

### Performance Optimization
1. **Efficient Processing** - Optimize hook processing for speed and efficiency
2. **Resource Management** - Manage resources effectively during hook execution
3. **Caching Strategies** - Use caching to improve hook performance
4. **Parallel Processing** - Use parallel processing where appropriate

## 🔄 Hook Workflow Examples

### 1. Automatic GitHub Issue Creation Workflow
```bash
# When you use the Task tool in Claude Code:
# Task("Research and implement authentication system")
# 
# The hook automatically:
# 1. Detects this is a substantial task (starts with "Research")
# 2. Creates a GitHub issue with title: "Task: Research and implement authentication system"
# 3. Adds labels: claude-flow, automated
# 4. Assigns to you (@me)
# 5. Includes rich context in the issue body

# Example issue created:
# Title: Task: Research and implement authentication system
# Body: Automated task tracking
#       
#       Task: Research and implement authentication system
#       Session: claude-flow-1704123456
#       Timestamp: Mon Jan 1 12:34:56 PST 2024
#       Automation: Claude Flow
# Labels: claude-flow, automated
# Assignee: @me
```

### 2. Development Workflow Integration
```bash
# Pre-development setup
npx claude-flow hooks pre-task --development-setup --environment-prepare --agent-configure

# Post-development analysis
npx claude-flow hooks post-task --code-analysis --quality-assess --documentation-update
```

### 3. Testing Workflow Integration
```bash
# Pre-testing preparation
npx claude-flow hooks pre-task --testing-setup --environment-validate --test-data-prepare

# Post-testing analysis
npx claude-flow hooks post-task --test-analysis --coverage-report --quality-metrics
```

### 4. Deployment Workflow Integration
```bash
# Pre-deployment checks
npx claude-flow hooks pre-task --deployment-validate --security-check --performance-verify

# Post-deployment monitoring
npx claude-flow hooks post-task --deployment-monitor --health-check --performance-track
```

## 🔗 Related Documentation

- **[Automation Commands](../automation/README.md)** - Automation capabilities enhanced by hooks
- **[Coordination Commands](../coordination/README.md)** - Coordination improved through hook integration
- **[Monitoring Commands](../monitoring/README.md)** - Monitoring data collected through hooks
- **[Analysis Commands](../analysis/README.md)** - Analysis enhanced by hook-collected data

## 🆘 Troubleshooting

### Common Hook Issues
- **Hook Execution Failures** - Hooks failing to execute properly
- **Performance Overhead** - Hooks adding significant performance overhead
- **Context Loss** - Loss of context between hook executions
- **Integration Conflicts** - Conflicts with existing workflows and tools

### Performance Tips
- Keep hook processing lightweight and efficient
- Use asynchronous processing where appropriate
- Implement proper error handling and recovery mechanisms
- Monitor hook performance and optimize regularly
- Use caching and optimization strategies to improve performance

---

*For detailed command usage, see individual command documentation files.*