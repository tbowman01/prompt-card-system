import { Pool } from 'pg';
import { createHash } from 'crypto';
import { nanoid } from 'nanoid';

export interface AgentMemory {
  id: string;
  agentId: string;
  taskId: string;
  taskHash: string;
  taskDescription: string;
  context: any;
  result?: any;
  status: 'in_progress' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  learnedPatterns?: string[];
  performanceMetrics?: any;
}

export interface TaskContext {
  filePaths?: string[];
  serviceNames?: string[];
  operationType?: string;
  technologyStack?: string[];
  userId?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

export interface AntiCollisionResult {
  canAssign: boolean;
  suggestedAgent?: string;
  reason?: string;
  conflictingTasks?: string[];
}

export class MemoryService {
  constructor(private db: Pool) {}

  /**
   * MANDATORY: Generate consistent task hash for collision detection
   * This ensures the same logical task gets the same hash regardless of minor variations
   */
  generateTaskHash(description: string, context: TaskContext = {}): string {
    // Normalize description by removing user-specific details and timestamps
    const normalized = description
      .toLowerCase()
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g, 'DATE') // Remove dates
      .replace(/\b\d{2}:\d{2}:\d{2}\b/g, 'TIME') // Remove times  
      .replace(/\buser_\w+/g, 'USER') // Remove user IDs
      .replace(/\bid_\w+/g, 'ID') // Remove specific IDs
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    // Create consistent context fingerprint
    const contextFingerprint = JSON.stringify({
      filePaths: (context.filePaths || []).sort(),
      serviceNames: (context.serviceNames || []).sort(),  
      operationType: context.operationType || '',
      technologyStack: (context.technologyStack || []).sort(),
    }, null, 0);

    // Generate SHA-256 hash
    return createHash('sha256')
      .update(`${normalized}|${contextFingerprint}`)
      .digest('hex');
  }

  /**
   * CRITICAL: Anti-collision check - prevents same agent from handling same task
   */
  async checkTaskCollision(
    taskHash: string, 
    availableAgents: string[]
  ): Promise<AntiCollisionResult> {
    const client = await this.db.connect();
    
    try {
      // Find agents who have previously handled this exact task
      const collisionQuery = await client.query(`
        SELECT DISTINCT agent_id, status, started_at, completed_at,
               task_description, performance_metrics
        FROM agent_memories 
        WHERE task_hash = $1 AND agent_id = ANY($2)
        ORDER BY started_at DESC
      `, [taskHash, availableAgents]);

      if (collisionQuery.rows.length > 0) {
        const conflictingAgents = collisionQuery.rows.map(row => row.agent_id);
        const eligibleAgents = availableAgents.filter(
          agent => !conflictingAgents.includes(agent)
        );

        if (eligibleAgents.length === 0) {
          // Emergency fallback: Use least recently used agent
          const lruQuery = await client.query(`
            SELECT agent_id, MAX(started_at) as last_used
            FROM agent_memories 
            WHERE agent_id = ANY($1)
            GROUP BY agent_id
            ORDER BY last_used ASC
            LIMIT 1
          `, [availableAgents]);

          if (lruQuery.rows.length > 0) {
            return {
              canAssign: true,
              suggestedAgent: lruQuery.rows[0].agent_id,
              reason: 'lru_fallback',
              conflictingTasks: [taskHash]
            };
          }

          return {
            canAssign: false,
            reason: 'all_agents_have_handled_task',
            conflictingTasks: [taskHash]
          };
        }

        // Select best agent from eligible ones based on domain expertise
        const bestAgent = await this.selectOptimalAgent(eligibleAgents, taskHash);
        
        return {
          canAssign: true,
          suggestedAgent: bestAgent,
          reason: 'collision_avoided',
          conflictingTasks: [taskHash]
        };
      }

      // No collision detected, select optimal agent
      const bestAgent = await this.selectOptimalAgent(availableAgents, taskHash);
      
      return {
        canAssign: true,
        suggestedAgent: bestAgent,
        reason: 'no_collision'
      };

    } finally {
      client.release();
    }
  }

  /**
   * Select optimal agent based on domain expertise and performance history
   */
  private async selectOptimalAgent(agents: string[], taskHash: string): Promise<string> {
    // For now, use simple round-robin with performance weighting
    // In production, this would use ML-based agent selection
    
    const client = await this.db.connect();
    
    try {
      const performanceQuery = await client.query(`
        SELECT 
          agent_id,
          COUNT(*) as task_count,
          AVG(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as success_rate,
          AVG(
            EXTRACT(EPOCH FROM (completed_at - started_at))
          ) as avg_duration_seconds
        FROM agent_memories 
        WHERE agent_id = ANY($1) AND completed_at IS NOT NULL
        GROUP BY agent_id
      `, [agents]);

      if (performanceQuery.rows.length === 0) {
        // No performance data, return random agent
        return agents[Math.floor(Math.random() * agents.length)];
      }

      // Score agents based on success rate and speed
      const scoredAgents = performanceQuery.rows
        .map(row => ({
          agentId: row.agent_id,
          score: (parseFloat(row.success_rate) * 0.7) + 
                 ((1 / (parseFloat(row.avg_duration_seconds) || 60)) * 0.3)
        }))
        .sort((a, b) => b.score - a.score);

      return scoredAgents[0]?.agentId || agents[0];

    } finally {
      client.release();
    }
  }

  /**
   * MANDATORY: Record task assignment with full audit trail
   */
  async recordTaskAssignment(
    agentId: string,
    taskDescription: string, 
    context: TaskContext,
    userId?: string
  ): Promise<string> {
    const taskHash = this.generateTaskHash(taskDescription, context);
    const memoryId = nanoid();

    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Insert memory record
      await client.query(`
        INSERT INTO agent_memories (
          id, agent_id, task_id, task_hash, task_description, 
          context, status, started_at, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
      `, [
        memoryId,
        agentId, 
        taskHash, // Use hash as task ID for now
        taskHash,
        taskDescription,
        JSON.stringify(context),
        'in_progress',
        userId
      ]);

      // Log assignment in audit trail
      await client.query(`
        INSERT INTO memory_audit_logs (
          action, agent_id, task_hash, metadata, created_at
        ) VALUES ($1, $2, $3, $4, NOW())
      `, [
        'task_assigned',
        agentId,
        taskHash,
        JSON.stringify({
          memoryId,
          description: taskDescription,
          context,
          assignedBy: userId
        })
      ]);

      await client.query('COMMIT');
      return memoryId;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Record task completion with learned patterns and performance metrics
   */
  async recordTaskCompletion(
    memoryId: string,
    result: any,
    learnedPatterns: string[] = [],
    performanceMetrics: any = {}
  ): Promise<void> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Update memory record
      const updateResult = await client.query(`
        UPDATE agent_memories 
        SET 
          result = $2,
          status = $3,
          completed_at = NOW(),
          learned_patterns = $4,
          performance_metrics = $5,
          updated_at = NOW()
        WHERE id = $1
        RETURNING agent_id, task_hash, task_description
      `, [
        memoryId,
        JSON.stringify(result),
        'completed',
        JSON.stringify(learnedPatterns),
        JSON.stringify(performanceMetrics)
      ]);

      if (updateResult.rows.length === 0) {
        throw new Error(`Memory record not found: ${memoryId}`);
      }

      const memory = updateResult.rows[0];

      // Extract and store learned patterns for future reference
      if (learnedPatterns.length > 0) {
        for (const pattern of learnedPatterns) {
          await client.query(`
            INSERT INTO agent_knowledge (
              agent_id, knowledge_type, domain, content, 
              confidence, created_at
            ) VALUES ($1, $2, $3, $4, $5, NOW())
            ON CONFLICT (agent_id, knowledge_type, content) 
            DO UPDATE SET usage_count = agent_knowledge.usage_count + 1,
                         updated_at = NOW()
          `, [
            memory.agent_id,
            'pattern',
            this.extractDomainFromTask(memory.task_description),
            pattern,
            75 // Initial confidence score
          ]);
        }
      }

      // Log completion in audit trail
      await client.query(`
        INSERT INTO memory_audit_logs (
          action, agent_id, task_hash, metadata, created_at
        ) VALUES ($1, $2, $3, $4, NOW())
      `, [
        'task_completed',
        memory.agent_id,
        memory.task_hash,
        JSON.stringify({
          memoryId,
          result: typeof result === 'object' ? 'object' : result,
          learnedPatterns,
          performanceMetrics,
          duration: 'calculated_on_update'
        })
      ]);

      await client.query('COMMIT');

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get relevant context and patterns for an agent working on a similar task
   */
  async getRelevantContext(
    agentId: string, 
    taskDescription: string, 
    context: TaskContext = {}
  ): Promise<{
    previousExperiences: AgentMemory[];
    relevantPatterns: string[];
    domainKnowledge: any[];
  }> {
    const taskHash = this.generateTaskHash(taskDescription, context);
    const domain = this.extractDomainFromTask(taskDescription);

    const client = await this.db.connect();
    
    try {
      // Get previous experiences with similar tasks
      const experienceQuery = await client.query(`
        SELECT 
          id, task_id, task_description, context, result,
          learned_patterns, performance_metrics, started_at, completed_at
        FROM agent_memories
        WHERE agent_id = $1 AND status = 'completed'
          AND (
            task_hash = $2 OR  -- Exact match
            task_description ILIKE $3 OR -- Similar description
            context::text ILIKE $4 -- Similar context
          )
        ORDER BY completed_at DESC
        LIMIT 5
      `, [
        agentId,
        taskHash,
        `%${taskDescription.split(' ').slice(0, 3).join('%')}%`,
        `%${domain}%`
      ]);

      // Get agent's domain knowledge
      const knowledgeQuery = await client.query(`
        SELECT knowledge_type, domain, content, confidence, usage_count
        FROM agent_knowledge
        WHERE agent_id = $1 AND domain = $2
        ORDER BY confidence DESC, usage_count DESC
        LIMIT 10
      `, [agentId, domain]);

      // Get learned patterns from similar tasks
      const patternsQuery = await client.query(`
        SELECT DISTINCT unnest(learned_patterns::text[]) as pattern
        FROM agent_memories
        WHERE agent_id = $1 AND learned_patterns IS NOT NULL
          AND task_description ILIKE $2
        LIMIT 20
      `, [agentId, `%${domain}%`]);

      return {
        previousExperiences: experienceQuery.rows.map(this.mapMemoryFromDb),
        relevantPatterns: patternsQuery.rows.map(row => row.pattern),
        domainKnowledge: knowledgeQuery.rows
      };

    } finally {
      client.release();
    }
  }

  /**
   * Get agent performance statistics for optimization
   */
  async getAgentPerformanceStats(agentId: string): Promise<{
    totalTasks: number;
    completedTasks: number;
    successRate: number;
    averageDuration: number;
    topDomains: string[];
    recentPerformance: any[];
  }> {
    const client = await this.db.connect();
    
    try {
      const statsQuery = await client.query(`
        SELECT 
          COUNT(*) as total_tasks,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
          AVG(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as success_rate,
          AVG(
            CASE WHEN completed_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (completed_at - started_at))
            ELSE NULL END
          ) as avg_duration_seconds
        FROM agent_memories
        WHERE agent_id = $1
      `, [agentId]);

      const domainsQuery = await client.query(`
        SELECT domain, COUNT(*) as count
        FROM agent_knowledge
        WHERE agent_id = $1
        GROUP BY domain
        ORDER BY count DESC
        LIMIT 5
      `, [agentId]);

      const recentQuery = await client.query(`
        SELECT 
          DATE_TRUNC('day', started_at) as date,
          COUNT(*) as tasks,
          AVG(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as success_rate
        FROM agent_memories
        WHERE agent_id = $1 AND started_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE_TRUNC('day', started_at)
        ORDER BY date DESC
      `, [agentId]);

      const stats = statsQuery.rows[0];
      
      return {
        totalTasks: parseInt(stats.total_tasks),
        completedTasks: parseInt(stats.completed_tasks),
        successRate: parseFloat(stats.success_rate) || 0,
        averageDuration: parseFloat(stats.avg_duration_seconds) || 0,
        topDomains: domainsQuery.rows.map(row => row.domain),
        recentPerformance: recentQuery.rows
      };

    } finally {
      client.release();
    }
  }

  private extractDomainFromTask(taskDescription: string): string {
    const description = taskDescription.toLowerCase();
    
    if (description.includes('auth') || description.includes('security')) return 'security';
    if (description.includes('test') || description.includes('coverage')) return 'testing';
    if (description.includes('docker') || description.includes('container')) return 'infrastructure';
    if (description.includes('database') || description.includes('sql')) return 'database';
    if (description.includes('api') || description.includes('endpoint')) return 'api';
    if (description.includes('ui') || description.includes('frontend')) return 'frontend';
    if (description.includes('performance') || description.includes('optimize')) return 'performance';
    
    return 'general';
  }

  private mapMemoryFromDb(row: any): AgentMemory {
    return {
      id: row.id,
      agentId: row.agent_id,
      taskId: row.task_id,
      taskHash: row.task_hash,
      taskDescription: row.task_description,
      context: JSON.parse(row.context || '{}'),
      result: row.result ? JSON.parse(row.result) : undefined,
      status: row.status,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      learnedPatterns: row.learned_patterns ? JSON.parse(row.learned_patterns) : undefined,
      performanceMetrics: row.performance_metrics ? JSON.parse(row.performance_metrics) : undefined
    };
  }
}