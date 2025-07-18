/**
 * Enhanced Assertion System
 * 
 * This module provides a comprehensive assertion system for validating LLM outputs
 * with support for semantic similarity, custom JavaScript code execution, and
 * various other advanced validation techniques.
 */

export { 
  AssertionEngine, 
  assertionEngine
} from './AssertionEngine';

export type { 
  EnhancedAssertionType,
  EnhancedAssertionResult,
  AssertionContext
} from './AssertionEngine';

export { 
  SemanticSimilarityValidator,
  type SimilarityResult,
  type SentimentResult,
  type LanguageResult,
  type ToxicityResult
} from './SemanticSimilarityValidator';

export { 
  CustomAssertionValidator,
  type CustomAssertionResult
} from './CustomAssertionValidator';

export { 
  AssertionTypeRegistry,
  type AssertionValidator,
  type AssertionTypeDefinition,
  type AssertionExecutionStats
} from './AssertionTypeRegistry';

/**
 * Enhanced Assertion System Features:
 * 
 * 1. **Basic Assertions**: contains, not-contains, equals, not-equals, regex, length
 * 2. **Semantic Similarity**: Compare text meaning using TF-IDF similarity
 * 3. **Custom Assertions**: Execute secure JavaScript code for complex validations
 * 4. **JSON Schema**: Validate JSON structure and content
 * 5. **Sentiment Analysis**: Detect positive, negative, or neutral sentiment
 * 6. **Language Detection**: Identify text language automatically
 * 7. **Toxicity Detection**: Check for inappropriate or harmful content
 * 8. **Performance Tracking**: Monitor execution time and success rates
 * 9. **Type Registry**: Manage and extend assertion types dynamically
 * 10. **Security**: Sandboxed execution environment for custom code
 * 
 * Usage Examples:
 * 
 * ```typescript
 * import { assertionEngine, EnhancedAssertionType } from './assertions';
 * 
 * // Initialize the engine
 * await assertionEngine.initialize();
 * 
 * // Basic assertion
 * const basicAssertion: EnhancedAssertionType = {
 *   type: 'contains',
 *   value: 'hello'
 * };
 * 
 * // Semantic similarity
 * const semanticAssertion: EnhancedAssertionType = {
 *   type: 'semantic-similarity',
 *   value: 'The weather is nice',
 *   threshold: 0.8
 * };
 * 
 * // Custom assertion
 * const customAssertion: EnhancedAssertionType = {
 *   type: 'custom',
 *   value: 'return output.length > 10 && wordCount > 2'
 * };
 * 
 * // Validate assertions
 * const results = await assertionEngine.validateAssertions(
 *   'Hello world!',
 *   [basicAssertion, semanticAssertion, customAssertion]
 * );
 * ```
 */

// Re-export types from testCase for convenience
export type { AssertionType } from '../../types/testCase';
export type { AssertionResult } from '../../types/testExecution';

// Utility functions for common assertion patterns
import { EnhancedAssertionType } from './AssertionEngine';

export class AssertionUtils {
  /**
   * Create a basic contains assertion
   */
  static contains(value: string, description?: string): EnhancedAssertionType {
    return {
      type: 'contains',
      value,
      description: description || `Check if output contains "${value}"`
    };
  }

  /**
   * Create a length range assertion
   */
  static lengthRange(min: number, max: number, description?: string): EnhancedAssertionType {
    return {
      type: 'length',
      value: `${min}-${max}`,
      description: description || `Check if output length is between ${min} and ${max} characters`
    };
  }

  /**
   * Create a semantic similarity assertion
   */
  static semanticSimilarity(
    expectedText: string, 
    threshold: number = 0.8, 
    description?: string
  ): EnhancedAssertionType {
    return {
      type: 'semantic-similarity',
      value: expectedText,
      threshold,
      description: description || `Check semantic similarity to "${expectedText}" (threshold: ${threshold})`
    };
  }

  /**
   * Create a sentiment assertion
   */
  static sentiment(
    expectedSentiment: 'positive' | 'negative' | 'neutral',
    threshold: number = 0.6,
    description?: string
  ): EnhancedAssertionType {
    return {
      type: 'sentiment',
      value: expectedSentiment,
      threshold,
      description: description || `Check if sentiment is ${expectedSentiment} (threshold: ${threshold})`
    };
  }

  /**
   * Create a language detection assertion
   */
  static language(expectedLanguage: string, description?: string): EnhancedAssertionType {
    return {
      type: 'language',
      value: expectedLanguage,
      description: description || `Check if language is ${expectedLanguage}`
    };
  }

  /**
   * Create a toxicity assertion
   */
  static toxicity(maxScore: number = 0.5, description?: string): EnhancedAssertionType {
    return {
      type: 'toxicity',
      value: maxScore,
      description: description || `Check if toxicity score is below ${maxScore}`
    };
  }

  /**
   * Create a custom assertion with helper functions
   */
  static custom(code: string, description?: string): EnhancedAssertionType {
    return {
      type: 'custom',
      value: code,
      description: description || 'Custom assertion validation'
    };
  }

  /**
   * Create a JSON schema assertion
   */
  static jsonSchema(schema: object, description?: string): EnhancedAssertionType {
    return {
      type: 'json-schema',
      value: schema,
      description: description || 'Validate JSON structure'
    };
  }

  /**
   * Create a regex assertion
   */
  static regex(pattern: string, flags?: string, description?: string): EnhancedAssertionType {
    return {
      type: 'regex',
      value: pattern,
      config: flags ? { flags } : undefined,
      description: description || `Check if output matches pattern: ${pattern}`
    };
  }

  /**
   * Create multiple assertions for comprehensive validation
   */
  static comprehensive(
    expectedText: string,
    options: {
      semanticThreshold?: number;
      sentimentExpected?: 'positive' | 'negative' | 'neutral';
      minLength?: number;
      maxLength?: number;
      language?: string;
      maxToxicity?: number;
      customChecks?: string[];
    } = {}
  ): EnhancedAssertionType[] {
    const assertions: EnhancedAssertionType[] = [];

    // Semantic similarity
    if (options.semanticThreshold !== undefined) {
      assertions.push(this.semanticSimilarity(expectedText, options.semanticThreshold));
    }

    // Sentiment
    if (options.sentimentExpected) {
      assertions.push(this.sentiment(options.sentimentExpected));
    }

    // Length constraints
    if (options.minLength !== undefined && options.maxLength !== undefined) {
      assertions.push(this.lengthRange(options.minLength, options.maxLength));
    }

    // Language
    if (options.language) {
      assertions.push(this.language(options.language));
    }

    // Toxicity
    if (options.maxToxicity !== undefined) {
      assertions.push(this.toxicity(options.maxToxicity));
    }

    // Custom checks
    if (options.customChecks) {
      options.customChecks.forEach(check => {
        assertions.push(this.custom(check));
      });
    }

    return assertions;
  }
}

// Export the default assertion engine instance
export default assertionEngine;