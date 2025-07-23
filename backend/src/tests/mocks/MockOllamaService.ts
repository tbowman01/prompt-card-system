/**
 * Mock Ollama Service for Testing
 * 
 * Provides a comprehensive mock implementation of the Ollama service
 * for testing without requiring the actual Ollama server.
 */

export interface OllamaModel {
  name: string;
  digest: string;
  size: number;
  modified_at: string;
}

export interface OllamaResponse {
  model: string;
  response: string;
  done: boolean;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
}

export interface GenerateRequest {
  model: string;
  prompt: string;
}

export interface MockServiceConfig {
  isOnline?: boolean;
  models?: string[];
  responseDelay?: number;
  failureRate?: number;
}

export class MockOllamaService {
  private config: Required<MockServiceConfig>;
  private availableModels: Map<string, OllamaModel> = new Map();

  constructor(config: MockServiceConfig = {}) {
    this.config = {
      isOnline: config.isOnline ?? true,
      models: config.models ?? ['llama3', 'codellama', 'mistral'],
      responseDelay: config.responseDelay ?? 100,
      failureRate: config.failureRate ?? 0
    };

    this.initializeModels();
  }

  private initializeModels(): void {
    this.config.models.forEach((modelName) => {
      this.availableModels.set(modelName, {
        name: modelName,
        digest: `sha256:${Math.random().toString(36).substring(2, 15)}`,
        size: Math.floor(Math.random() * 5000000000) + 1000000000, // 1-5GB
        modified_at: new Date().toISOString()
      });
    });
  }

  async listModels(): Promise<{ models: OllamaModel[] }> {
    if (!this.config.isOnline) {
      throw new Error('Ollama service is offline');
    }

    await this.simulateDelay();
    this.simulateFailure();

    return {
      models: Array.from(this.availableModels.values())
    };
  }

  async checkModelExists(modelName: string): Promise<boolean> {
    if (!this.config.isOnline) {
      throw new Error('Ollama service is offline');
    }

    return this.availableModels.has(modelName);
  }

  async getModelInfo(modelName: string): Promise<any> {
    if (!this.config.isOnline) {
      throw new Error('Ollama service is offline');
    }

    if (!this.availableModels.has(modelName)) {
      throw new Error(`Model ${modelName} not found`);
    }

    await this.simulateDelay();
    this.simulateFailure();

    return {
      license: 'Apache 2.0',
      modelfile: `FROM ${modelName}`,
      parameters: {
        num_ctx: 4096,
        temperature: 0.8,
        top_p: 0.9
      },
      details: {
        format: 'gguf',
        family: 'llama',
        families: ['llama'],
        parameter_size: '7B',
        quantization_level: 'Q4_0'
      }
    };
  }

  async pullModel(modelName: string): Promise<void> {
    if (!this.config.isOnline) {
      throw new Error('Ollama service is offline');
    }

    await this.simulateDelay(2000); // Longer delay for model pull
    this.simulateFailure();

    // Add the model to available models
    this.availableModels.set(modelName, {
      name: modelName,
      digest: `sha256:${Math.random().toString(36).substring(2, 15)}`,
      size: Math.floor(Math.random() * 5000000000) + 1000000000,
      modified_at: new Date().toISOString()
    });
  }

  async deleteModel(modelName: string): Promise<void> {
    if (!this.config.isOnline) {
      throw new Error('Ollama service is offline');
    }

    await this.simulateDelay();
    this.simulateFailure();

    this.availableModels.delete(modelName);
  }

  async generate(request: GenerateRequest): Promise<OllamaResponse> {
    if (!this.config.isOnline) {
      throw new Error('Ollama service is offline');
    }

    if (!this.availableModels.has(request.model)) {
      throw new Error(`Model ${request.model} not found`);
    }

    await this.simulateDelay();
    this.simulateFailure();

    const responseText = this.generateMockResponse(request.prompt);
    
    return {
      model: request.model,
      response: responseText,
      done: true,
      total_duration: Math.floor(Math.random() * 5000000000), // nanoseconds
      prompt_eval_count: request.prompt.split(' ').length,
      eval_count: responseText.split(' ').length
    };
  }

  async *chat(request: ChatRequest): AsyncGenerator<OllamaResponse> {
    if (!this.config.isOnline) {
      throw new Error('Ollama service is offline');
    }

    if (!this.availableModels.has(request.model)) {
      throw new Error(`Model ${request.model} not found`);
    }

    this.simulateFailure();

    const lastMessage = request.messages[request.messages.length - 1];
    const responseText = this.generateMockResponse(lastMessage.content);
    const words = responseText.split(' ');

    // Stream response word by word
    for (let i = 0; i < words.length; i++) {
      await this.simulateDelay(50); // Short delay between words
      
      yield {
        model: request.model,
        response: words.slice(0, i + 1).join(' '),
        done: false
      };
    }

    // Final response
    yield {
      model: request.model,
      response: responseText,
      done: true,
      total_duration: Math.floor(Math.random() * 5000000000),
      prompt_eval_count: lastMessage.content.split(' ').length,
      eval_count: words.length
    };
  }

  async healthCheck(): Promise<{ status: string; online: boolean; models: string[] }> {
    return {
      status: this.config.isOnline ? 'healthy' : 'offline',
      online: this.config.isOnline,
      models: this.config.models
    };
  }

  // Configuration methods
  setOnlineStatus(isOnline: boolean): void {
    this.config.isOnline = isOnline;
  }

  setResponseDelay(delay: number): void {
    this.config.responseDelay = delay;
  }

  setFailureRate(rate: number): void {
    this.config.failureRate = Math.max(0, Math.min(1, rate));
  }

  getStats(): Required<MockServiceConfig> & { online: boolean } {
    return { 
      ...this.config,
      online: this.config.isOnline
    };
  }

  // Private helper methods
  private async simulateDelay(customDelay?: number): Promise<void> {
    const delay = customDelay ?? this.config.responseDelay;
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  private simulateFailure(): void {
    if (Math.random() < this.config.failureRate) {
      throw new Error('simulated failure');
    }
  }

  private generateMockResponse(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();
    
    // Pattern-based responses
    if (lowerPrompt.includes('code') || lowerPrompt.includes('function') || lowerPrompt.includes('program')) {
      return `Here's a code example for your request:\n\n\`\`\`javascript\nfunction example() {\n  return "Mock response for code request";\n}\n\`\`\``;
    }
    
    if (lowerPrompt.includes('explain') || lowerPrompt.includes('what') || lowerPrompt.includes('how')) {
      return "This is a mock explanation response. In a real scenario, this would provide detailed information about the topic you asked about.";
    }
    
    if (lowerPrompt.includes('story') || lowerPrompt.includes('tell me')) {
      return "Once upon a time, in a mock testing environment, there was a simulated AI assistant that provided helpful responses to test scenarios. This assistant worked diligently to ensure all tests passed successfully.";
    }
    
    if (lowerPrompt.includes('hello') || lowerPrompt.includes('hi')) {
      return "Hello! I'm a mock AI assistant ready to help with your testing needs.";
    }
    
    // Default response
    return `Mock response to: "${prompt}". This is a simulated response for testing purposes.`;
  }
}

// Factory functions for common test scenarios
export function createMockOllamaService(scenario: 'healthy' | 'offline' | 'slow' | 'unreliable'): MockOllamaService {
  switch (scenario) {
    case 'healthy':
      return new MockOllamaService({
        isOnline: true,
        responseDelay: 100,
        failureRate: 0
      });
      
    case 'offline':
      return new MockOllamaService({
        isOnline: false
      });
      
    case 'slow':
      return new MockOllamaService({
        isOnline: true,
        responseDelay: 2000,
        failureRate: 0
      });
      
    case 'unreliable':
      return new MockOllamaService({
        isOnline: true,
        responseDelay: 500,
        failureRate: 0.3
      });
      
    default:
      return new MockOllamaService();
  }
}