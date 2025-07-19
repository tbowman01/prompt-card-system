# Hive Mind Commands

Commands for hive mind collective intelligence operations in Claude Flow.

## Available Commands

### Collective Intelligence
- [consensus-vote](./consensus-vote.md) - Democratic decision making across the hive
- [memory-share](./memory-share.md) - Share knowledge and discoveries across all hive members  
- [neural-sync](./neural-sync.md) - Synchronize learning patterns across the collective
- [swarm-think](./swarm-think.md) - Engage collective problem-solving intelligence

### Queen Coordination
- [queen-command](./queen-command.md) - Issue strategic directives from Queen to workers
- [queen-monitor](./queen-monitor.md) - Monitor overall swarm health and performance
- [queen-delegate](./queen-delegate.md) - Delegate complex tasks to appropriate worker teams
- [queen-aggregate](./queen-aggregate.md) - Combine and synthesize results from multiple workers

### Worker Management  
- [agent-spawn](./agent-spawn.md) - Create specialized worker agents with specific capabilities
- [agent-assign](./agent-assign.md) - Assign specific tasks to individual or groups of agents
- [agent-communicate](./agent-communicate.md) - Enable direct peer-to-peer communication between agents
- [agent-metrics](./agent-metrics.md) - Track individual and collective agent performance

### Task Orchestration
- [task-create](./task-create.md) - Create hierarchical, complex task structures
- [task-distribute](./task-distribute.md) - Efficiently distribute work across available agents
- [task-monitor](./task-monitor.md) - Track progress of distributed tasks in real-time
- [task-aggregate](./task-aggregate.md) - Combine results from distributed task execution

### Memory & Learning
- [memory-store](./memory-store.md) - Store knowledge in the collective memory system
- [memory-retrieve](./memory-retrieve.md) - Access stored knowledge from collective memory
- [neural-train](./neural-train.md) - Train the collective intelligence from experiences
- [pattern-recognize](./pattern-recognize.md) - Identify patterns in data and behaviors

## Quick Reference

See [available-commands.md](./available-commands.md) for a complete command reference table.

## Core Concepts

### Collective Intelligence
The Hive Mind system transforms individual AI agents into a coordinated swarm capable of:
- **Democratic Decision Making**: Consensus-based voting on complex decisions
- **Shared Knowledge**: Real-time memory synchronization across all agents
- **Distributed Problem Solving**: Collective intelligence that exceeds individual capabilities
- **Adaptive Learning**: Continuous improvement through shared experiences

### Queen Coordination
Strategic oversight and high-level coordination:
- **Strategic Directives**: Issue commands and set priorities across the swarm
- **Performance Monitoring**: Track swarm health and individual agent metrics
- **Task Delegation**: Assign complex projects to appropriate specialist teams
- **Result Synthesis**: Combine outputs from multiple agents into cohesive deliverables

### Worker Specialization
Specialized agents with distinct capabilities:
- **Agent Types**: researcher, coder, architect, tester, analyst, coordinator, specialist
- **Skill Matching**: Intelligent assignment based on capabilities and experience
- **Performance Tracking**: Individual and collective performance analytics
- **Peer Communication**: Direct agent-to-agent coordination and knowledge sharing

## Usage Patterns

### Project Development Workflow
1. **Initialize Swarm**: Create hierarchical swarm with appropriate agent types
2. **Delegate Project**: Queen delegates complex project to specialist team
3. **Distribute Tasks**: Break down project into specific task assignments
4. **Monitor Progress**: Real-time tracking with alerts and performance metrics
5. **Aggregate Results**: Combine individual outputs into integrated deliverable

### Research and Analysis
1. **Spawn Research Team**: Create researchers, analysts, and domain specialists
2. **Collective Thinking**: Use swarm intelligence for problem exploration
3. **Knowledge Sharing**: Distribute findings across the collective memory
4. **Pattern Recognition**: Identify insights and trends in collected data
5. **Consensus Formation**: Democratic validation of findings and recommendations

### Quality Assurance and Optimization
1. **Performance Analysis**: Identify bottlenecks and optimization opportunities
2. **Code Quality Assessment**: Automated and peer review processes
3. **Neural Training**: Learn from successful patterns and outcomes
4. **Continuous Improvement**: Adaptive optimization based on feedback loops

## Integration with Claude Code

Use MCP tools in Claude Code for hive mind operations:

```javascript
// Initialize swarm
mcp__claude-flow__swarm_init({ 
  topology: "hierarchical", 
  maxAgents: 8,
  strategy: "specialized" 
})

// Spawn specialized agents
mcp__claude-flow__agent_spawn({ 
  type: "researcher", 
  name: "Knowledge_Specialist" 
})

// Collective decision making
mcp__claude-flow__consensus_vote({
  proposal: "Architecture selection for new service",
  options: ["microservices", "serverless", "monolith"],
  voters: ["architect", "developer", "ops_specialist"],
  threshold: 0.67
})

// Store collective knowledge
mcp__claude-flow__memory_store({
  key: "best_practices/api_design",
  value: { patterns: [...], security: [...] },
  namespace: "hive/"
})
```

## Advanced Features

### Neural Learning
- **Pattern Recognition**: Identify successful strategies and anti-patterns
- **Adaptive Behavior**: Agents improve decision-making based on experience
- **Cross-Domain Transfer**: Apply learnings from one domain to another
- **Predictive Analytics**: Anticipate outcomes and optimize strategies

### Memory Management
- **Collective Memory**: Shared knowledge base accessible to all agents
- **Intelligent Retrieval**: Semantic search and pattern-based discovery
- **Knowledge Validation**: Peer review and quality scoring of stored information
- **Memory Evolution**: Continuous refinement and updating of knowledge base

### Performance Optimization
- **Load Balancing**: Intelligent task distribution based on agent capabilities
- **Resource Optimization**: Efficient utilization of computational resources
- **Bottleneck Detection**: Identify and resolve performance constraints
- **Scalability**: Dynamic scaling based on workload requirements

## Best Practices

### Swarm Design
- Choose topology based on project complexity and team size
- Balance agent specialization with cross-functional capabilities
- Plan for knowledge transfer and documentation from the start
- Monitor swarm health and adjust composition as needed

### Decision Making
- Use consensus voting for critical architectural and strategic decisions
- Combine collective intelligence with individual expertise
- Document decision rationale in collective memory
- Learn from both successful and failed decisions

### Knowledge Management
- Store all important discoveries and insights in collective memory
- Use structured data formats for consistent knowledge representation
- Implement quality controls and validation processes
- Enable easy discovery and retrieval of relevant information

### Performance Monitoring
- Track both individual agent and collective swarm performance
- Use metrics to guide task assignment and resource allocation
- Identify patterns in successful collaborations and replicate them
- Continuously optimize based on performance data and feedback

## See Also

- **Coordination Commands**: Basic swarm setup and task orchestration
- **Memory Commands**: Advanced memory management and persistence
- **Monitoring Commands**: Performance tracking and health monitoring
- **GitHub Commands**: Repository management and code collaboration
- **Analysis Commands**: Performance analysis and optimization