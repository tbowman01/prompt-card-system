import { AssertionType } from '../../types/testCase';
import { AssertionResult } from '../../types/testExecution';
import { SemanticSimilarityValidator } from './SemanticSimilarityValidator';
import { CustomAssertionValidator } from './CustomAssertionValidator';
import { AssertionTypeRegistry } from './AssertionTypeRegistry';

export interface EnhancedAssertionType extends AssertionType {
  type: 'contains' | 'not-contains' | 'equals' | 'not-equals' | 'regex' | 'length' | 
        'semantic-similarity' | 'custom' | 'json-schema' | 'sentiment' | 'language' | 'toxicity';
  value: string | number | object;
  description?: string;
  threshold?: number; // For semantic similarity, sentiment, etc.
  config?: Record<string, any>; // Additional configuration
}

export interface AssertionContext {
  prompt: string;
  variables: Record<string, any>;
  model: string;
  executionTime: number;
  metadata?: Record<string, any>;
}

export interface EnhancedAssertionResult {
  assertion: EnhancedAssertionType;
  passed: boolean;
  error?: string;
  score?: number; // For scoring-based assertions
  metadata?: Record<string, any>;
  executionTime?: number;
}

export class AssertionEngine {
  private semanticValidator: SemanticSimilarityValidator;
  private customValidator: CustomAssertionValidator;
  private typeRegistry: AssertionTypeRegistry;

  constructor() {
    this.semanticValidator = new SemanticSimilarityValidator();
    this.customValidator = new CustomAssertionValidator();
    this.typeRegistry = new AssertionTypeRegistry();
  }

  /**
   * Initialize the assertion engine with ML models
   */
  async initialize(): Promise<void> {
    console.log('Initializing Enhanced Assertion Engine...');
    
    try {
      await this.semanticValidator.initialize();
      await this.customValidator.initialize();
      await this.typeRegistry.initialize();
      
      console.log('✅ Enhanced Assertion Engine initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Enhanced Assertion Engine:', error);
      throw error;
    }
  }

  /**
   * Validate all assertions against LLM output with enhanced context
   */
  async validateAssertions(
    output: string,
    assertions: EnhancedAssertionType[],
    context?: AssertionContext
  ): Promise<EnhancedAssertionResult[]> {
    const results: EnhancedAssertionResult[] = [];
    
    for (const assertion of assertions) {
      const startTime = Date.now();
      
      try {
        const result = await this.validateSingleAssertion(output, assertion, context);
        result.executionTime = Date.now() - startTime;
        results.push(result);
      } catch (error) {
        results.push({
          assertion,
          passed: false,
          error: error instanceof Error ? error.message : 'Unknown assertion error',
          executionTime: Date.now() - startTime
        });
      }
    }
    
    return results;
  }

  /**
   * Validate a single assertion with enhanced capabilities
   */
  private async validateSingleAssertion(
    output: string,
    assertion: EnhancedAssertionType,
    context?: AssertionContext
  ): Promise<EnhancedAssertionResult> {
    switch (assertion.type) {
      case 'contains':
        return this.validateContains(output, assertion);
      
      case 'not-contains':
        return this.validateNotContains(output, assertion);
      
      case 'equals':
        return this.validateEquals(output, assertion);
      
      case 'not-equals':
        return this.validateNotEquals(output, assertion);
      
      case 'regex':
        return this.validateRegex(output, assertion);
      
      case 'length':
        return this.validateLength(output, assertion);
      
      case 'semantic-similarity':
        return await this.validateSemanticSimilarity(output, assertion, context);
      
      case 'custom':
        return await this.validateCustom(output, assertion, context);
      
      case 'json-schema':
        return this.validateJsonSchema(output, assertion);
      
      case 'sentiment':
        return await this.validateSentiment(output, assertion);
      
      case 'language':
        return await this.validateLanguage(output, assertion);
      
      case 'toxicity':
        return await this.validateToxicity(output, assertion);
      
      default:
        throw new Error(`Unknown assertion type: ${assertion.type}`);
    }
  }

  /**
   * Basic string contains validation
   */
  private validateContains(output: string, assertion: EnhancedAssertionType): EnhancedAssertionResult {
    const searchValue = String(assertion.value);
    const passed = output.toLowerCase().includes(searchValue.toLowerCase());
    
    return {
      assertion,
      passed,
      metadata: {
        searchValue,
        outputLength: output.length,
        caseSensitive: false
      }
    };
  }

  /**
   * Basic string not-contains validation
   */
  private validateNotContains(output: string, assertion: EnhancedAssertionType): EnhancedAssertionResult {
    const searchValue = String(assertion.value);
    const passed = !output.toLowerCase().includes(searchValue.toLowerCase());
    
    return {
      assertion,
      passed,
      metadata: {
        searchValue,
        outputLength: output.length,
        caseSensitive: false
      }
    };
  }

  /**
   * Exact string equality validation
   */
  private validateEquals(output: string, assertion: EnhancedAssertionType): EnhancedAssertionResult {
    const expectedValue = String(assertion.value);
    const passed = output.trim() === expectedValue.trim();
    
    return {
      assertion,
      passed,
      metadata: {
        expectedValue,
        actualValue: output.trim(),
        exactMatch: passed
      }
    };
  }

  /**
   * String inequality validation
   */
  private validateNotEquals(output: string, assertion: EnhancedAssertionType): EnhancedAssertionResult {
    const expectedValue = String(assertion.value);
    const passed = output.trim() !== expectedValue.trim();
    
    return {
      assertion,
      passed,
      metadata: {
        expectedValue,
        actualValue: output.trim(),
        exactMatch: !passed
      }
    };
  }

  /**
   * Regular expression validation
   */
  private validateRegex(output: string, assertion: EnhancedAssertionType): EnhancedAssertionResult {
    try {
      const regex = new RegExp(String(assertion.value), assertion.config?.flags || '');
      const matches = output.match(regex);
      const passed = matches !== null;
      
      return {
        assertion,
        passed,
        metadata: {
          pattern: String(assertion.value),
          flags: assertion.config?.flags || '',
          matches: matches || [],
          matchCount: matches?.length || 0
        }
      };
    } catch (error) {
      return {
        assertion,
        passed: false,
        error: `Invalid regex pattern: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {
          pattern: String(assertion.value)
        }
      };
    }
  }

  /**
   * String length validation with range support
   */
  private validateLength(output: string, assertion: EnhancedAssertionType): EnhancedAssertionResult {
    const actualLength = output.length;
    let passed = false;
    const metadata: Record<string, any> = {
      actualLength,
      constraint: assertion.value
    };

    if (typeof assertion.value === 'number') {
      passed = actualLength === assertion.value;
    } else {
      const valueStr = String(assertion.value);
      if (valueStr.includes('-')) {
        const [minStr, maxStr] = valueStr.split('-');
        const min = parseInt(minStr.trim());
        const max = parseInt(maxStr.trim());
        passed = actualLength >= min && actualLength <= max;
        metadata.min = min;
        metadata.max = max;
        metadata.inRange = passed;
      } else if (valueStr.startsWith('>')) {
        const min = parseInt(valueStr.substring(1));
        passed = actualLength > min;
        metadata.min = min;
        metadata.operator = '>';
      } else if (valueStr.startsWith('<')) {
        const max = parseInt(valueStr.substring(1));
        passed = actualLength < max;
        metadata.max = max;
        metadata.operator = '<';
      } else if (valueStr.startsWith('>=')) {
        const min = parseInt(valueStr.substring(2));
        passed = actualLength >= min;
        metadata.min = min;
        metadata.operator = '>=';
      } else if (valueStr.startsWith('<=')) {
        const max = parseInt(valueStr.substring(2));
        passed = actualLength <= max;
        metadata.max = max;
        metadata.operator = '<=';
      } else {
        const expected = parseInt(valueStr);
        passed = actualLength === expected;
        metadata.expected = expected;
      }
    }

    return {
      assertion,
      passed,
      metadata
    };
  }

  /**
   * Semantic similarity validation using transformer models
   */
  private async validateSemanticSimilarity(
    output: string,
    assertion: EnhancedAssertionType,
    context?: AssertionContext
  ): Promise<EnhancedAssertionResult> {
    try {
      const expectedText = String(assertion.value);
      const threshold = assertion.threshold || 0.8;
      
      const similarity = await this.semanticValidator.computeSimilarity(output, expectedText);
      const passed = similarity >= threshold;
      
      return {
        assertion,
        passed,
        score: similarity,
        metadata: {
          expectedText,
          threshold,
          similarity,
          model: this.semanticValidator.getModelName(),
          algorithmUsed: 'sentence-transformers'
        }
      };
    } catch (error) {
      return {
        assertion,
        passed: false,
        error: `Semantic similarity validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {
          expectedText: String(assertion.value),
          threshold: assertion.threshold || 0.8
        }
      };
    }
  }

  /**
   * Custom JavaScript assertion validation
   */
  private async validateCustom(
    output: string,
    assertion: EnhancedAssertionType,
    context?: AssertionContext
  ): Promise<EnhancedAssertionResult> {
    try {
      const customCode = String(assertion.value);
      const result = await this.customValidator.execute(customCode, output, context);
      
      return {
        assertion,
        passed: result.passed,
        score: result.score,
        metadata: {
          customCode,
          executionTime: result.executionTime,
          variables: result.variables,
          logs: result.logs
        }
      };
    } catch (error) {
      return {
        assertion,
        passed: false,
        error: `Custom assertion validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {
          customCode: String(assertion.value)
        }
      };
    }
  }

  /**
   * JSON schema validation
   */
  private validateJsonSchema(output: string, assertion: EnhancedAssertionType): EnhancedAssertionResult {
    try {
      const parsedOutput = JSON.parse(output);
      const schema = assertion.value as object;
      
      // Simple schema validation - in a real implementation, use a proper JSON schema validator
      const passed = this.validateObjectAgainstSchema(parsedOutput, schema);
      
      return {
        assertion,
        passed,
        metadata: {
          schema,
          parsedOutput,
          isValidJson: true
        }
      };
    } catch (error) {
      return {
        assertion,
        passed: false,
        error: `JSON schema validation failed: ${error instanceof Error ? error.message : 'Invalid JSON'}`,
        metadata: {
          schema: assertion.value,
          isValidJson: false
        }
      };
    }
  }

  /**
   * Sentiment analysis validation
   */
  private async validateSentiment(
    output: string,
    assertion: EnhancedAssertionType
  ): Promise<EnhancedAssertionResult> {
    try {
      const expectedSentiment = String(assertion.value); // 'positive', 'negative', 'neutral'
      const threshold = assertion.threshold || 0.6;
      
      const sentiment = await this.semanticValidator.analyzeSentiment(output);
      const passed = sentiment.label === expectedSentiment && sentiment.score >= threshold;
      
      return {
        assertion,
        passed,
        score: sentiment.score,
        metadata: {
          expectedSentiment,
          actualSentiment: sentiment.label,
          confidence: sentiment.score,
          threshold
        }
      };
    } catch (error) {
      return {
        assertion,
        passed: false,
        error: `Sentiment validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Language detection validation
   */
  private async validateLanguage(
    output: string,
    assertion: EnhancedAssertionType
  ): Promise<EnhancedAssertionResult> {
    try {
      const expectedLanguage = String(assertion.value); // 'en', 'es', 'fr', etc.
      
      const language = await this.semanticValidator.detectLanguage(output);
      const passed = language.language === expectedLanguage;
      
      return {
        assertion,
        passed,
        score: language.confidence,
        metadata: {
          expectedLanguage,
          detectedLanguage: language.language,
          confidence: language.confidence
        }
      };
    } catch (error) {
      return {
        assertion,
        passed: false,
        error: `Language validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Toxicity detection validation
   */
  private async validateToxicity(
    output: string,
    assertion: EnhancedAssertionType
  ): Promise<EnhancedAssertionResult> {
    try {
      const maxToxicity = Number(assertion.value); // 0.0 to 1.0
      
      const toxicity = await this.semanticValidator.detectToxicity(output);
      const passed = toxicity.score <= maxToxicity;
      
      return {
        assertion,
        passed,
        score: toxicity.score,
        metadata: {
          maxToxicity,
          toxicityScore: toxicity.score,
          categories: toxicity.categories,
          isToxic: toxicity.score > 0.7
        }
      };
    } catch (error) {
      return {
        assertion,
        passed: false,
        error: `Toxicity validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Simple object schema validation helper
   */
  private validateObjectAgainstSchema(obj: any, schema: any): boolean {
    if (typeof schema !== 'object' || schema === null) {
      return obj === schema;
    }

    for (const key in schema) {
      if (!(key in obj)) {
        return false;
      }
      
      if (typeof schema[key] === 'object' && schema[key] !== null) {
        if (!this.validateObjectAgainstSchema(obj[key], schema[key])) {
          return false;
        }
      } else if (typeof obj[key] !== typeof schema[key]) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Register a custom assertion type
   */
  async registerAssertionType(
    name: string,
    validator: (output: string, assertion: EnhancedAssertionType, context?: AssertionContext) => Promise<EnhancedAssertionResult>
  ): Promise<void> {
    await this.typeRegistry.register(name, validator);
  }

  /**
   * Get all registered assertion types
   */
  getRegisteredTypes(): string[] {
    return this.typeRegistry.getRegisteredTypes();
  }

  /**
   * Get assertion statistics
   */
  getStatistics(): {
    totalAssertions: number;
    successfulAssertions: number;
    failedAssertions: number;
    averageExecutionTime: number;
  } {
    return this.typeRegistry.getStatistics();
  }

  /**
   * Export assertion types to JSON
   */
  exportTypes(): string {
    return this.typeRegistry.exportTypes();
  }

  /**
   * Import assertion types from JSON
   */
  async importTypes(jsonData: string): Promise<void> {
    await this.typeRegistry.importTypes(jsonData);
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    await this.semanticValidator.cleanup();
    await this.customValidator.cleanup();
    await this.typeRegistry.cleanup();
  }
}

// The AssertionEngine class is exported for instantiation in index.ts