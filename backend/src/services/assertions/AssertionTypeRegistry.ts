import { db } from '../../database/connection';
import { AssertionContext, EnhancedAssertionType, EnhancedAssertionResult } from './AssertionEngine';

export type AssertionValidator = (
  output: string,
  assertion: EnhancedAssertionType,
  context?: AssertionContext
) => Promise<EnhancedAssertionResult>;

export interface AssertionTypeDefinition {
  name: string;
  description: string;
  parameters: {
    [key: string]: {
      type: 'string' | 'number' | 'boolean' | 'object' | 'array';
      required: boolean;
      description: string;
      default?: any;
    };
  };
  examples: Array<{
    assertion: EnhancedAssertionType;
    description: string;
    expectedResult: boolean;
  }>;
  validator: AssertionValidator;
  created_at: string;
  updated_at: string;
}

export interface AssertionExecutionStats {
  assertionType: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  lastExecuted: string;
}

export class AssertionTypeRegistry {
  private customValidators: Map<string, AssertionValidator> = new Map();
  private typeDefinitions: Map<string, AssertionTypeDefinition> = new Map();
  private executionStats: Map<string, AssertionExecutionStats> = new Map();
  private initialized: boolean = false;

  /**
   * Initialize the assertion type registry
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing AssertionTypeRegistry...');
      
      // Create custom assertion types table
      await this.createAssertionTypesTable();
      
      // Load built-in assertion types
      await this.loadBuiltInTypes();
      
      // Load custom assertion types from database
      await this.loadCustomTypes();
      
      this.initialized = true;
      
      console.log('✅ AssertionTypeRegistry initialized');
    } catch (error) {
      console.error('❌ Failed to initialize AssertionTypeRegistry:', error);
      throw error;
    }
  }

  /**
   * Create the assertion types table in database
   */
  private async createAssertionTypesTable(): Promise<void> {
    db.exec(`
      CREATE TABLE IF NOT EXISTS assertion_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT NOT NULL,
        parameters TEXT NOT NULL, -- JSON
        examples TEXT NOT NULL, -- JSON
        validator_code TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS assertion_execution_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assertion_type TEXT NOT NULL,
        total_executions INTEGER DEFAULT 0,
        successful_executions INTEGER DEFAULT 0,
        failed_executions INTEGER DEFAULT 0,
        total_execution_time INTEGER DEFAULT 0,
        last_executed DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(assertion_type)
      )
    `);

    // Create indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_assertion_types_name ON assertion_types(name);
      CREATE INDEX IF NOT EXISTS idx_assertion_stats_type ON assertion_execution_stats(assertion_type);
    `);
  }

  /**
   * Load built-in assertion types
   */
  private async loadBuiltInTypes(): Promise<void> {
    const builtInTypes: Partial<AssertionTypeDefinition>[] = [
      {
        name: 'contains',
        description: 'Check if output contains a specific string',
        parameters: {
          value: {
            type: 'string',
            required: true,
            description: 'The string to search for'
          }
        },
        examples: [
          {
            assertion: { type: 'contains', value: 'hello' },
            description: 'Check if output contains "hello"',
            expectedResult: true
          }
        ]
      },
      {
        name: 'semantic-similarity',
        description: 'Check semantic similarity between output and expected text',
        parameters: {
          value: {
            type: 'string',
            required: true,
            description: 'The expected text to compare against'
          },
          threshold: {
            type: 'number',
            required: false,
            description: 'Similarity threshold (0-1)',
            default: 0.8
          }
        },
        examples: [
          {
            assertion: { type: 'semantic-similarity', value: 'The weather is nice', threshold: 0.8 },
            description: 'Check if output has similar meaning to "The weather is nice"',
            expectedResult: true
          }
        ]
      },
      {
        name: 'custom',
        description: 'Execute custom JavaScript code for assertion',
        parameters: {
          value: {
            type: 'string',
            required: true,
            description: 'JavaScript code to execute'
          }
        },
        examples: [
          {
            assertion: { type: 'custom', value: 'return output.length > 10' },
            description: 'Check if output has more than 10 characters',
            expectedResult: true
          }
        ]
      },
      {
        name: 'json-schema',
        description: 'Validate output against JSON schema',
        parameters: {
          value: {
            type: 'object',
            required: true,
            description: 'JSON schema to validate against'
          }
        },
        examples: [
          {
            assertion: { type: 'json-schema', value: { type: 'object', properties: { name: { type: 'string' } } } },
            description: 'Validate JSON output has required structure',
            expectedResult: true
          }
        ]
      },
      {
        name: 'sentiment',
        description: 'Check sentiment of the output',
        parameters: {
          value: {
            type: 'string',
            required: true,
            description: 'Expected sentiment: positive, negative, or neutral'
          },
          threshold: {
            type: 'number',
            required: false,
            description: 'Confidence threshold (0-1)',
            default: 0.6
          }
        },
        examples: [
          {
            assertion: { type: 'sentiment', value: 'positive', threshold: 0.7 },
            description: 'Check if output has positive sentiment',
            expectedResult: true
          }
        ]
      },
      {
        name: 'language',
        description: 'Detect language of the output',
        parameters: {
          value: {
            type: 'string',
            required: true,
            description: 'Expected language code (e.g., "en", "es", "fr")'
          }
        },
        examples: [
          {
            assertion: { type: 'language', value: 'en' },
            description: 'Check if output is in English',
            expectedResult: true
          }
        ]
      },
      {
        name: 'toxicity',
        description: 'Check toxicity level of the output',
        parameters: {
          value: {
            type: 'number',
            required: true,
            description: 'Maximum allowed toxicity score (0-1)'
          }
        },
        examples: [
          {
            assertion: { type: 'toxicity', value: 0.3 },
            description: 'Check if output toxicity is below 0.3',
            expectedResult: true
          }
        ]
      }
    ];

    // Register built-in types
    builtInTypes.forEach(type => {
      if (type.name) {
        this.typeDefinitions.set(type.name, {
          ...type,
          validator: this.createDummyValidator(type.name),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        } as AssertionTypeDefinition);
      }
    });
  }

  /**
   * Load custom assertion types from database
   */
  private async loadCustomTypes(): Promise<void> {
    const stmt = db.prepare('SELECT * FROM assertion_types');
    const customTypes = stmt.all();

    for (const type of customTypes) {
      try {
        const definition: AssertionTypeDefinition = {
          name: type.name,
          description: type.description,
          parameters: JSON.parse(type.parameters),
          examples: JSON.parse(type.examples),
          validator: this.createValidatorFromCode(type.validator_code),
          created_at: type.created_at,
          updated_at: type.updated_at
        };

        this.typeDefinitions.set(type.name, definition);
      } catch (error) {
        console.error(`Failed to load custom assertion type ${type.name}:`, error);
      }
    }
  }

  /**
   * Register a new custom assertion type
   */
  async register(name: string, validator: AssertionValidator): Promise<void> {
    if (!this.initialized) {
      throw new Error('AssertionTypeRegistry not initialized');
    }

    // Store in memory
    this.customValidators.set(name, validator);

    // Store in database
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO assertion_types (name, description, parameters, examples, validator_code, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const definition: Partial<AssertionTypeDefinition> = {
      name,
      description: `Custom assertion type: ${name}`,
      parameters: {},
      examples: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    stmt.run(
      name,
      definition.description,
      JSON.stringify(definition.parameters),
      JSON.stringify(definition.examples),
      validator.toString(),
      new Date().toISOString()
    );

    console.log(`✅ Registered custom assertion type: ${name}`);
  }

  /**
   * Get all registered assertion types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.typeDefinitions.keys());
  }

  /**
   * Get assertion type definition
   */
  getTypeDefinition(name: string): AssertionTypeDefinition | undefined {
    return this.typeDefinitions.get(name);
  }

  /**
   * Get all type definitions
   */
  getAllTypeDefinitions(): AssertionTypeDefinition[] {
    return Array.from(this.typeDefinitions.values());
  }

  /**
   * Update execution statistics
   */
  updateExecutionStats(
    assertionType: string,
    success: boolean,
    executionTime: number
  ): void {
    const stats = this.executionStats.get(assertionType) || {
      assertionType,
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      lastExecuted: new Date().toISOString()
    };

    stats.totalExecutions++;
    if (success) {
      stats.successfulExecutions++;
    } else {
      stats.failedExecutions++;
    }

    // Update average execution time
    stats.averageExecutionTime = (stats.averageExecutionTime * (stats.totalExecutions - 1) + executionTime) / stats.totalExecutions;
    stats.lastExecuted = new Date().toISOString();

    this.executionStats.set(assertionType, stats);

    // Update database
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO assertion_execution_stats 
      (assertion_type, total_executions, successful_executions, failed_executions, total_execution_time, last_executed)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      assertionType,
      stats.totalExecutions,
      stats.successfulExecutions,
      stats.failedExecutions,
      Math.round(stats.averageExecutionTime * stats.totalExecutions),
      stats.lastExecuted
    );
  }

  /**
   * Get execution statistics
   */
  getStatistics(): {
    totalAssertions: number;
    successfulAssertions: number;
    failedAssertions: number;
    averageExecutionTime: number;
  } {
    const stats = Array.from(this.executionStats.values());
    
    const totalAssertions = stats.reduce((sum, stat) => sum + stat.totalExecutions, 0);
    const successfulAssertions = stats.reduce((sum, stat) => sum + stat.successfulExecutions, 0);
    const failedAssertions = stats.reduce((sum, stat) => sum + stat.failedExecutions, 0);
    const averageExecutionTime = stats.reduce((sum, stat) => sum + stat.averageExecutionTime, 0) / Math.max(1, stats.length);

    return {
      totalAssertions,
      successfulAssertions,
      failedAssertions,
      averageExecutionTime
    };
  }

  /**
   * Get statistics for a specific assertion type
   */
  getTypeStatistics(assertionType: string): AssertionExecutionStats | undefined {
    return this.executionStats.get(assertionType);
  }

  /**
   * Create a dummy validator for built-in types
   */
  private createDummyValidator(typeName: string): AssertionValidator {
    return async (output: string, assertion: EnhancedAssertionType, context?: AssertionContext): Promise<EnhancedAssertionResult> => {
      // This would be replaced by the actual assertion engine validation
      return {
        assertion,
        passed: false,
        error: `Validator for ${typeName} should be handled by AssertionEngine`
      };
    };
  }

  /**
   * Create a validator from stored code
   */
  private createValidatorFromCode(code: string): AssertionValidator {
    return async (output: string, assertion: EnhancedAssertionType, context?: AssertionContext): Promise<EnhancedAssertionResult> => {
      try {
        // In a real implementation, this would safely execute the stored code
        const func = new Function('output', 'assertion', 'context', code);
        const result = func(output, assertion, context);
        
        return {
          assertion,
          passed: Boolean(result),
          score: typeof result === 'number' ? result : (result ? 1 : 0)
        };
      } catch (error) {
        return {
          assertion,
          passed: false,
          error: error instanceof Error ? error.message : 'Custom validator execution failed'
        };
      }
    };
  }

  /**
   * Export assertion types to JSON
   */
  exportTypes(): string {
    const types = Array.from(this.typeDefinitions.values()).map(type => ({
      ...type,
      validator: undefined // Don't export the validator function
    }));

    return JSON.stringify(types, null, 2);
  }

  /**
   * Import assertion types from JSON
   */
  async importTypes(jsonData: string): Promise<void> {
    try {
      const types = JSON.parse(jsonData);
      
      for (const type of types) {
        if ((type as any).name && (type as any).description && (type as any).parameters) {
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO assertion_types (name, description, parameters, examples, validator_code, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `);

          stmt.run(
            (type as any).name,
            (type as any).description,
            JSON.stringify((type as any).parameters),
            JSON.stringify((type as any).examples || []),
            (type as any).validator_code || '',
            new Date().toISOString()
          );
        }
      }

      // Reload types
      await this.loadCustomTypes();
      
      console.log(`✅ Imported ${types.length} assertion types`);
    } catch (error) {
      throw new Error(`Failed to import assertion types: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a custom assertion type
   */
  async deleteType(name: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('AssertionTypeRegistry not initialized');
    }

    // Remove from memory
    this.customValidators.delete(name);
    this.typeDefinitions.delete(name);
    this.executionStats.delete(name);

    // Remove from database
    const stmt = db.prepare('DELETE FROM assertion_types WHERE name = ?');
    stmt.run(name);

    const statsStmt = db.prepare('DELETE FROM assertion_execution_stats WHERE assertion_type = ?');
    statsStmt.run(name);

    console.log(`✅ Deleted assertion type: ${name}`);
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.customValidators.clear();
    this.typeDefinitions.clear();
    this.executionStats.clear();
    this.initialized = false;
  }
}