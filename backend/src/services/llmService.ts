import axios from 'axios';
import { assertionEngine, AssertionContext, EnhancedAssertionType, EnhancedAssertionResult } from './assertions';

export interface LLMResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface LLMRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  format?: string;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
  };
}

class LLMService {
  private baseUrl: string;
  public defaultModel: string;

  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.defaultModel = process.env.OLLAMA_DEFAULT_MODEL || 'llama3';
  }

  /**
   * Generate text using Ollama LLM
   */
  async generate(prompt: string, model?: string, options?: LLMRequest['options']): Promise<LLMResponse> {
    try {
      const request: LLMRequest = {
        model: model || this.defaultModel,
        prompt,
        stream: false,
        options: {
          temperature: 0.7,
          ...options
        }
      };

      const response = await axios.post(`${this.baseUrl}/api/generate`, request, {
        timeout: 60000, // 60 second timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return response.data as LLMResponse;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`LLM Service Error: ${error.response?.data?.error || error.message}`);
      }
      throw new Error(`LLM Service Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if Ollama service is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get available models
   */
  async getModels(): Promise<string[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 10000
      });
      return response.data.models?.map((model: any) => model.name) || [];
    } catch (error) {
      throw new Error(`Failed to fetch models: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Substitute variables in prompt template
   */
  substituteVariables(template: string, variables: Record<string, any>): string {
    let result = template;
    
    // Replace variables in format {{variable_name}}
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      result = result.replace(regex, String(value));
    });

    return result;
  }

  /**
   * Initialize the LLM service with enhanced assertion engine
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing LLM Service with Enhanced Assertion Engine...');
      await assertionEngine.initialize();
      console.log('✅ LLM Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize LLM Service:', error);
      throw error;
    }
  }

  /**
   * Validate assertions against LLM output using enhanced assertion engine
   */
  async validateAssertions(
    output: string, 
    assertions: EnhancedAssertionType[],
    context?: {
      prompt?: string;
      variables?: Record<string, any>;
      model?: string;
      executionTime?: number;
    }
  ): Promise<EnhancedAssertionResult[]> {
    try {
      const assertionContext: AssertionContext = {
        prompt: context?.prompt || '',
        variables: context?.variables || {},
        model: context?.model || this.defaultModel,
        executionTime: context?.executionTime || 0
      };

      return await assertionEngine.validateAssertions(output, assertions, assertionContext);
    } catch (error) {
      console.error('Error validating assertions:', error);
      // Fallback to basic validation for compatibility
      return this.validateAssertionsBasic(output, assertions);
    }
  }

  /**
   * Fallback basic assertion validation for compatibility
   */
  private async validateAssertionsBasic(
    output: string, 
    assertions: EnhancedAssertionType[]
  ): Promise<EnhancedAssertionResult[]> {
    return assertions.map(assertion => {
      try {
        let passed = false;

        switch (assertion.type) {
          case 'contains':
            passed = output.toLowerCase().includes(String(assertion.value).toLowerCase());
            break;
          
          case 'not-contains':
            passed = !output.toLowerCase().includes(String(assertion.value).toLowerCase());
            break;
          
          case 'equals':
            passed = output.trim() === String(assertion.value).trim();
            break;
          
          case 'not-equals':
            passed = output.trim() !== String(assertion.value).trim();
            break;
          
          case 'regex':
            const regex = new RegExp(String(assertion.value));
            passed = regex.test(output);
            break;
          
          case 'length':
            if (typeof assertion.value === 'number') {
              passed = output.length === assertion.value;
            } else {
              // Support range: "10-20" or ">10" or "<100"
              const valueStr = String(assertion.value);
              if (valueStr.includes('-')) {
                const [min, max] = valueStr.split('-').map(v => parseInt(v.trim()));
                passed = output.length >= min && output.length <= max;
              } else if (valueStr.startsWith('>')) {
                const min = parseInt(valueStr.substring(1));
                passed = output.length > min;
              } else if (valueStr.startsWith('<')) {
                const max = parseInt(valueStr.substring(1));
                passed = output.length < max;
              } else {
                passed = output.length === parseInt(valueStr);
              }
            }
            break;
          
          default:
            return {
              assertion,
              passed: false,
              error: `Unsupported assertion type in basic validation: ${assertion.type}`
            };
        }

        return {
          assertion,
          passed
        };
      } catch (error) {
        return {
          assertion,
          passed: false,
          error: error instanceof Error ? error.message : 'Basic assertion validation failed'
        };
      }
    });
  }

  /**
   * Get available assertion types from the engine
   */
  getAvailableAssertionTypes(): string[] {
    return assertionEngine.getRegisteredTypes();
  }

  /**
   * Get assertion execution statistics
   */
  getAssertionStatistics(): {
    totalAssertions: number;
    successfulAssertions: number;
    failedAssertions: number;
    averageExecutionTime: number;
  } {
    return assertionEngine.getStatistics();
  }
}

export const llmService = new LLMService();
export default llmService;