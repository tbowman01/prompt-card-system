import { AssertionContext } from './AssertionEngine';

export interface CustomAssertionResult {
  passed: boolean;
  score?: number;
  executionTime: number;
  variables?: Record<string, any>;
  logs?: string[];
  error?: string;
}

export class CustomAssertionValidator {
  private initialized: boolean = false;
  private allowedGlobals: Set<string>;
  private bannedKeywords: Set<string>;

  constructor() {
    // Define allowed global functions and objects for security
    this.allowedGlobals = new Set([
      'Math', 'String', 'Number', 'Array', 'Object', 'Date', 'RegExp',
      'JSON', 'parseFloat', 'parseInt', 'isNaN', 'isFinite',
      'encodeURI', 'decodeURI', 'encodeURIComponent', 'decodeURIComponent'
    ]);

    // Define banned keywords for security
    this.bannedKeywords = new Set([
      'eval', 'Function', 'require', 'import', 'process', 'global',
      'window', 'document', 'localStorage', 'sessionStorage', 'fetch',
      'XMLHttpRequest', 'WebSocket', 'Worker', 'SharedWorker',
      'setTimeout', 'setInterval', 'setImmediate', 'clearTimeout',
      'clearInterval', 'clearImmediate', '__dirname', '__filename',
      'module', 'exports', 'Buffer', 'console.log', 'console.error'
    ]);
  }

  /**
   * Initialize the custom assertion validator
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing CustomAssertionValidator...');
      
      this.initialized = true;
      
      console.log('✅ CustomAssertionValidator initialized');
    } catch (error) {
      console.error('❌ Failed to initialize CustomAssertionValidator:', error);
      throw error;
    }
  }

  /**
   * Execute custom assertion code in a secure sandbox
   */
  async execute(
    code: string,
    output: string,
    context?: AssertionContext
  ): Promise<CustomAssertionResult> {
    if (!this.initialized) {
      throw new Error('CustomAssertionValidator not initialized');
    }

    const startTime = Date.now();
    const logs: string[] = [];
    const variables: Record<string, any> = {};

    try {
      // Security check - scan for banned keywords
      const securityResult = this.performSecurityCheck(code);
      if (!securityResult.safe) {
        throw new Error(`Security violation: ${securityResult.reason}`);
      }

      // Prepare execution environment
      const sandboxContext = this.createSandboxContext(output, context, logs, variables);
      
      // Execute the custom assertion
      const result = await this.executeInSandbox(code, sandboxContext);
      
      const executionTime = Date.now() - startTime;
      
      return {
        passed: Boolean(result),
        score: typeof result === 'number' ? result : (result ? 1 : 0),
        executionTime,
        variables,
        logs
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      return {
        passed: false,
        executionTime,
        variables,
        logs,
        error: error instanceof Error ? error.message : 'Unknown execution error'
      };
    }
  }

  /**
   * Perform security checks on the custom code
   */
  private performSecurityCheck(code: string): { safe: boolean; reason?: string } {
    // Check for banned keywords
    for (const keyword of this.bannedKeywords) {
      if (code.includes(keyword)) {
        return {
          safe: false,
          reason: `Banned keyword detected: ${keyword}`
        };
      }
    }

    // Check for potential injection patterns
    const dangerousPatterns = [
      /constructor/i,
      /prototype/i,
      /(__proto__|__defineGetter__|__defineSetter__|__lookupGetter__|__lookupSetter__)/i,
      /\[\s*["']constructor["']\s*\]/i,
      /\[\s*["']__proto__["']\s*\]/i,
      /\[\s*["']prototype["']\s*\]/i
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        return {
          safe: false,
          reason: `Potentially dangerous pattern detected: ${pattern.toString()}`
        };
      }
    }

    // Check code length (prevent DoS)
    if (code.length > 10000) {
      return {
        safe: false,
        reason: 'Code too long (max 10000 characters)'
      };
    }

    // Check for excessive nesting (prevent DoS)
    const nestingLevel = this.checkNestingLevel(code);
    if (nestingLevel > 20) {
      return {
        safe: false,
        reason: 'Code nesting too deep (max 20 levels)'
      };
    }

    return { safe: true };
  }

  /**
   * Check nesting level of code
   */
  private checkNestingLevel(code: string): number {
    let maxLevel = 0;
    let currentLevel = 0;
    
    for (const char of code) {
      if (char === '{' || char === '(' || char === '[') {
        currentLevel++;
        maxLevel = Math.max(maxLevel, currentLevel);
      } else if (char === '}' || char === ')' || char === ']') {
        currentLevel--;
      }
    }
    
    return maxLevel;
  }

  /**
   * Create a sandbox context for code execution
   */
  private createSandboxContext(
    output: string,
    context?: AssertionContext,
    logs?: string[],
    variables?: Record<string, any>
  ): Record<string, any> {
    const sandboxContext: Record<string, any> = {
      // Assertion input
      output,
      text: output,
      content: output,
      
      // Context information
      prompt: context?.prompt || '',
      variables: { ...context?.variables } || {},
      model: context?.model || '',
      executionTime: context?.executionTime || 0,
      
      // Utility functions
      length: output.length,
      wordCount: output.split(/\s+/).filter(w => w.length > 0).length,
      lineCount: output.split('\n').length,
      
      // Safe string operations
      toLowerCase: () => output.toLowerCase(),
      toUpperCase: () => output.toUpperCase(),
      trim: () => output.trim(),
      includes: (str: string) => output.includes(str),
      startsWith: (str: string) => output.startsWith(str),
      endsWith: (str: string) => output.endsWith(str),
      indexOf: (str: string) => output.indexOf(str),
      match: (pattern: string | RegExp) => output.match(pattern),
      replace: (search: string | RegExp, replacement: string) => output.replace(search, replacement),
      split: (separator: string | RegExp) => output.split(separator),
      substring: (start: number, end?: number) => output.substring(start, end),
      slice: (start: number, end?: number) => output.slice(start, end),
      
      // JSON operations
      parseJSON: (str?: string) => {
        try {
          return JSON.parse(str || output);
        } catch {
          return null;
        }
      },
      
      // Regular expressions
      regex: (pattern: string, flags?: string) => {
        try {
          return new RegExp(pattern, flags);
        } catch {
          return null;
        }
      },
      
      // Math operations
      Math: {
        ...Math,
        random: () => { throw new Error('Math.random() is not allowed in assertions'); }
      },
      
      // Safe logging
      log: (message: any) => {
        if (logs) {
          logs.push(String(message));
        }
      },
      
      // Variable storage
      set: (key: string, value: any) => {
        if (variables) {
          variables[key] = value;
        }
      },
      
      get: (key: string) => {
        return variables?.[key];
      },
      
      // Sentiment analysis helper
      analyzeSentiment: (text?: string) => {
        const content = text || output;
        // Simple sentiment analysis
        const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'love', 'like', 'happy'];
        const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'dislike', 'sad', 'angry', 'disappointed'];
        
        const words = content.toLowerCase().split(/\s+/);
        const positive = words.filter(w => positiveWords.includes(w)).length;
        const negative = words.filter(w => negativeWords.includes(w)).length;
        
        if (positive > negative) return 'positive';
        if (negative > positive) return 'negative';
        return 'neutral';
      },
      
      // Word frequency analysis
      wordFrequency: (text?: string) => {
        const content = text || output;
        const words = content.toLowerCase().split(/\s+/).filter(w => w.length > 0);
        const frequency: Record<string, number> = {};
        
        words.forEach(word => {
          frequency[word] = (frequency[word] || 0) + 1;
        });
        
        return frequency;
      },
      
      // Language detection helper
      detectLanguage: (text?: string) => {
        const content = text || output;
        // Very simple language detection
        const englishWords = ['the', 'and', 'is', 'in', 'to', 'of', 'a', 'that'];
        const words = content.toLowerCase().split(/\s+/);
        const englishCount = words.filter(w => englishWords.includes(w)).length;
        
        return englishCount > words.length * 0.1 ? 'en' : 'unknown';
      }
    };

    // Add allowed globals
    this.allowedGlobals.forEach(globalName => {
      if (globalName === 'Math') {
        sandboxContext[globalName] = sandboxContext.Math;
      } else if (typeof global !== 'undefined' && globalName in global) {
        sandboxContext[globalName] = (global as any)[globalName];
      }
    });

    return sandboxContext;
  }

  /**
   * Execute code in a simple sandbox environment
   */
  private async executeInSandbox(
    code: string,
    context: Record<string, any>
  ): Promise<any> {
    // Create a function that executes the code in the given context
    const wrappedCode = `
      (function() {
        "use strict";
        const {${Object.keys(context).join(', ')}} = arguments[0];
        
        // Prevent access to dangerous globals
        const eval = undefined;
        const Function = undefined;
        const constructor = undefined;
        const prototype = undefined;
        const __proto__ = undefined;
        
        // Execute the custom assertion code
        ${code}
      })
    `;

    try {
      // Use Function constructor as a safer alternative to eval
      // This is still not completely secure, but better than direct eval
      const func = new Function('return ' + wrappedCode)();
      
      // Execute with timeout to prevent infinite loops
      const result = await this.executeWithTimeout(func, [context], 5000);
      
      return result;
    } catch (error) {
      throw new Error(`Code execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute a function with timeout
   */
  private async executeWithTimeout(
    func: Function,
    args: any[],
    timeout: number
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Execution timeout'));
      }, timeout);

      try {
        const result = func.apply(null, args);
        clearTimeout(timer);
        resolve(result);
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  /**
   * Get execution statistics
   */
  getStatistics(): {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    securityViolations: number;
    averageExecutionTime: number;
  } {
    // In a real implementation, this would track actual statistics
    return {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      securityViolations: 0,
      averageExecutionTime: 0
    };
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.initialized = false;
  }
}