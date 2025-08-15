import { BaseAgent, AgentConfig, Task, AgentMessage } from './core/BaseAgent';
import { MemoryService } from '../memory/MemoryService';
import { PromptCard, CreatePromptCardRequest } from '../types/promptCard';
import { OptimizationEngine } from '../services/optimization/OptimizationEngine';
import { PromptAnalyzer } from '../services/optimization/PromptAnalyzer';
import { SecurityAnalyzer } from '../services/optimization/SecurityAnalyzer';

export class PromptCardAgent extends BaseAgent {
  private optimizationEngine?: OptimizationEngine;
  private promptAnalyzer?: PromptAnalyzer;
  private securityAnalyzer?: SecurityAnalyzer;

  constructor(memoryService?: MemoryService) {
    const config: AgentConfig = {
      id: 'prompt-card-agent',
      name: 'Prompt Card Agent',
      description: 'Specialized agent for prompt card management, optimization, and analysis',
      capabilities: [
        {
          name: 'create_prompt_card',
          description: 'Create new prompt cards with validation and optimization',
          inputSchema: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              prompt_template: { type: 'string' },
              variables: { type: 'array', items: { type: 'string' } }
            },
            required: ['title', 'prompt_template']
          }
        },
        {
          name: 'optimize_prompt',
          description: 'Analyze and optimize prompt templates for better performance',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: { type: 'string' },
              context: { type: 'object' },
              optimization_type: { 
                type: 'string', 
                enum: ['clarity', 'performance', 'safety', 'cost'] 
              }
            },
            required: ['prompt']
          }
        },
        {
          name: 'analyze_prompt_security',
          description: 'Perform security analysis on prompt templates',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: { type: 'string' },
              check_injection: { type: 'boolean' },
              check_toxicity: { type: 'boolean' }
            },
            required: ['prompt']
          }
        },
        {
          name: 'validate_prompt_variables',
          description: 'Validate prompt template variables and suggest improvements',
          inputSchema: {
            type: 'object',
            properties: {
              template: { type: 'string' },
              variables: { type: 'array', items: { type: 'string' } }
            },
            required: ['template', 'variables']
          }
        }
      ],
      maxConcurrentTasks: 5,
      priority: 'high',
      specialization: ['prompt_creation', 'prompt_optimization', 'template_analysis'],
      memoryEnabled: true
    };

    super(config, memoryService);
  }

  protected async initialize(): Promise<void> {
    this.logger.info('Initializing Prompt Card Agent');
    
    try {
      // Initialize optimization services
      this.optimizationEngine = new OptimizationEngine();
      this.promptAnalyzer = new PromptAnalyzer();
      this.securityAnalyzer = new SecurityAnalyzer();
      
      this.logger.info('Prompt Card Agent initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Prompt Card Agent:', error);
      throw error;
    }
  }

  protected async executeTask(task: Task): Promise<any> {
    this.logger.info(`Executing task: ${task.type}`);

    switch (task.type) {
      case 'create_prompt_card':
        return await this.createPromptCard(task.input);
      
      case 'optimize_prompt':
        return await this.optimizePrompt(task.input);
      
      case 'analyze_prompt_security':
        return await this.analyzePromptSecurity(task.input);
      
      case 'validate_prompt_variables':
        return await this.validatePromptVariables(task.input);
      
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  protected async handleMessage(message: AgentMessage): Promise<void> {
    this.logger.info(`Handling message from ${message.from}: ${message.type}`);

    switch (message.type) {
      case 'task_request':
        await this.handleTaskRequest(message);
        break;
      
      case 'coordination':
        await this.handleCoordinationMessage(message);
        break;
      
      default:
        this.logger.warn(`Unhandled message type: ${message.type}`);
    }
  }

  protected async cleanup(): Promise<void> {
    this.logger.info('Cleaning up Prompt Card Agent');
    // Cleanup resources if needed
  }

  /**
   * Create a new prompt card with validation and optimization
   */
  private async createPromptCard(input: CreatePromptCardRequest): Promise<PromptCard> {
    this.logger.info('Creating new prompt card');

    // Validate input
    if (!input.title || !input.prompt_template) {
      throw new Error('Title and prompt template are required');
    }

    // Extract variables from template
    const extractedVariables = this.extractVariablesFromTemplate(input.prompt_template);
    const providedVariables = input.variables || [];

    // Validate variables consistency
    const missingVariables = extractedVariables.filter(v => !providedVariables.includes(v));
    const extraVariables = providedVariables.filter(v => !extractedVariables.includes(v));

    if (missingVariables.length > 0) {
      this.logger.warn(`Missing variables detected: ${missingVariables.join(', ')}`);
    }

    if (extraVariables.length > 0) {
      this.logger.warn(`Extra variables detected: ${extraVariables.join(', ')}`);
    }

    // Perform security analysis
    const securityResult = await this.analyzePromptSecurity({
      prompt: input.prompt_template,
      check_injection: true,
      check_toxicity: true
    });

    if (securityResult.risks && securityResult.risks.length > 0) {
      this.logger.warn('Security risks detected:', securityResult.risks);
    }

    // Create the prompt card (this would interact with database in real implementation)
    const promptCard: PromptCard = {
      id: Date.now(), // Temporary ID generation
      title: input.title,
      description: input.description,
      prompt_template: input.prompt_template,
      variables: JSON.stringify(extractedVariables),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.logger.info(`Prompt card created successfully: ${promptCard.id}`);
    return promptCard;
  }

  /**
   * Optimize a prompt template
   */
  private async optimizePrompt(input: any): Promise<any> {
    this.logger.info('Optimizing prompt template');

    if (!this.optimizationEngine || !this.promptAnalyzer) {
      throw new Error('Optimization services not initialized');
    }

    const { prompt, context, optimization_type = 'clarity' } = input;

    try {
      // Analyze current prompt
      const analysis = await this.promptAnalyzer.analyzePrompt(prompt, context);
      
      // Generate optimizations based on type
      let optimizations;
      switch (optimization_type) {
        case 'clarity':
          optimizations = await this.optimizationEngine.optimizeForClarity(prompt, analysis);
          break;
        case 'performance':
          optimizations = await this.optimizationEngine.optimizeForPerformance(prompt, analysis);
          break;
        case 'safety':
          optimizations = await this.optimizationEngine.optimizeForSafety(prompt, analysis);
          break;
        case 'cost':
          optimizations = await this.optimizationEngine.optimizeForCost(prompt, analysis);
          break;
        default:
          optimizations = await this.optimizationEngine.optimizeGeneral(prompt, analysis);
      }

      return {
        original_prompt: prompt,
        analysis,
        optimizations,
        optimization_type,
        improvements: optimizations.suggestions || [],
        estimated_improvement: optimizations.score || 0
      };

    } catch (error) {
      this.logger.error('Optimization failed:', error);
      throw new Error(`Optimization failed: ${error.message}`);
    }
  }

  /**
   * Analyze prompt for security vulnerabilities
   */
  private async analyzePromptSecurity(input: any): Promise<any> {
    this.logger.info('Analyzing prompt security');

    if (!this.securityAnalyzer) {
      throw new Error('Security analyzer not initialized');
    }

    const { prompt, check_injection = true, check_toxicity = true } = input;

    try {
      const securityResult = await this.securityAnalyzer.analyzePrompt(prompt, {
        checkInjection: check_injection,
        checkToxicity: check_toxicity,
        checkBias: true,
        checkPrivacy: true
      });

      return {
        prompt,
        security_score: securityResult.score,
        risks: securityResult.risks,
        recommendations: securityResult.recommendations,
        safe_to_use: securityResult.score > 0.7,
        analysis_timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Security analysis failed:', error);
      throw new Error(`Security analysis failed: ${error.message}`);
    }
  }

  /**
   * Validate prompt template variables
   */
  private async validatePromptVariables(input: any): Promise<any> {
    const { template, variables } = input;

    this.logger.info('Validating prompt variables');

    // Extract variables from template
    const extractedVariables = this.extractVariablesFromTemplate(template);
    
    // Check for consistency
    const missingVariables = extractedVariables.filter(v => !variables.includes(v));
    const extraVariables = variables.filter(v => !extractedVariables.includes(v));
    const unusedVariables = variables.filter(v => !template.includes(`{{${v}}}`));

    // Analyze variable usage patterns
    const variableAnalysis = extractedVariables.map(variable => {
      const occurrences = (template.match(new RegExp(`{{${variable}}}`, 'g')) || []).length;
      const position = template.indexOf(`{{${variable}}}`);
      
      return {
        name: variable,
        occurrences,
        position,
        is_required: occurrences > 0,
        usage_pattern: this.analyzeVariableUsage(template, variable)
      };
    });

    return {
      template,
      provided_variables: variables,
      extracted_variables: extractedVariables,
      validation: {
        is_valid: missingVariables.length === 0 && extraVariables.length === 0,
        missing_variables: missingVariables,
        extra_variables: extraVariables,
        unused_variables: unusedVariables
      },
      variable_analysis: variableAnalysis,
      recommendations: this.generateVariableRecommendations(template, variables, extractedVariables)
    };
  }

  /**
   * Extract variables from template using {{variable}} syntax
   */
  private extractVariablesFromTemplate(template: string): string[] {
    const variableRegex = /\{\{(\w+)\}\}/g;
    const variables = new Set<string>();
    let match;

    while ((match = variableRegex.exec(template)) !== null) {
      variables.add(match[1]);
    }

    return Array.from(variables);
  }

  /**
   * Analyze how a variable is used in the template
   */
  private analyzeVariableUsage(template: string, variable: string): string {
    const variablePattern = new RegExp(`{{${variable}}}`, 'g');
    const matches = template.match(variablePattern);
    
    if (!matches) return 'unused';
    if (matches.length === 1) return 'single_use';
    if (matches.length > 1) return 'multiple_use';
    
    return 'unknown';
  }

  /**
   * Generate recommendations for variable usage
   */
  private generateVariableRecommendations(
    template: string, 
    provided: string[], 
    extracted: string[]
  ): string[] {
    const recommendations: string[] = [];

    const missing = extracted.filter(v => !provided.includes(v));
    const extra = provided.filter(v => !extracted.includes(v));

    if (missing.length > 0) {
      recommendations.push(`Add missing variables to your variable list: ${missing.join(', ')}`);
    }

    if (extra.length > 0) {
      recommendations.push(`Remove unused variables from your list: ${extra.join(', ')}`);
    }

    // Check for potential naming improvements
    const shortVariables = extracted.filter(v => v.length < 3);
    if (shortVariables.length > 0) {
      recommendations.push(`Consider using more descriptive names for: ${shortVariables.join(', ')}`);
    }

    // Check for consistent naming conventions
    const hasCamelCase = extracted.some(v => /[a-z][A-Z]/.test(v));
    const hasUnderscores = extracted.some(v => v.includes('_'));
    
    if (hasCamelCase && hasUnderscores) {
      recommendations.push('Consider using consistent naming convention (either camelCase or snake_case)');
    }

    return recommendations;
  }

  /**
   * Handle task requests from other agents
   */
  private async handleTaskRequest(message: AgentMessage): Promise<void> {
    try {
      const taskId = await this.submitTask({
        type: message.payload.type,
        description: message.payload.description,
        input: message.payload.input,
        context: message.payload.context,
        priority: message.payload.priority || 'medium',
        correlationId: message.correlationId,
        requesterAgent: message.from
      });

      // Send confirmation back
      this.sendMessage({
        to: message.from,
        type: 'task_response',
        payload: {
          status: 'accepted',
          taskId,
          estimated_completion: new Date(Date.now() + 30000).toISOString() // 30 seconds estimate
        },
        correlationId: message.correlationId,
        priority: message.priority
      });

    } catch (error) {
      // Send error response
      this.sendMessage({
        to: message.from,
        type: 'error',
        payload: {
          error: error.message,
          original_request: message.payload
        },
        correlationId: message.correlationId,
        priority: message.priority
      });
    }
  }

  /**
   * Handle coordination messages from orchestrator
   */
  private async handleCoordinationMessage(message: AgentMessage): Promise<void> {
    this.logger.info('Handling coordination message:', message.payload);

    switch (message.payload.action) {
      case 'status_request':
        this.sendMessage({
          to: message.from,
          type: 'status',
          payload: this.getStats(),
          correlationId: message.correlationId,
          priority: message.priority
        });
        break;

      case 'capability_query':
        this.sendMessage({
          to: message.from,
          type: 'coordination',
          payload: {
            action: 'capability_response',
            capabilities: this.config.capabilities,
            specialization: this.config.specialization,
            current_load: this.getStats().currentLoad
          },
          correlationId: message.correlationId,
          priority: message.priority
        });
        break;

      default:
        this.logger.warn('Unknown coordination action:', message.payload.action);
    }
  }
}