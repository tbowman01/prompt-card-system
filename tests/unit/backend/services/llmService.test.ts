/**
 * LLM Service Unit Tests
 * @description Comprehensive tests for LLM service functionality
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock axios before importing the service
jest.mock('axios');
const mockAxios = jest.mocked(require('axios'));

import { LLMService } from '../../../../backend/src/services/llmService';

describe('LLMService', () => {
  let llmService: LLMService;
  
  beforeEach(() => {
    llmService = new LLMService();
    mockAxios.post.mockClear();
    mockAxios.get.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateResponse', () => {
    it('should generate response successfully', async () => {
      // Arrange
      const mockResponse = {
        data: {
          response: 'Generated response',
          model: 'llama2',
          created_at: new Date().toISOString(),
          done: true,
        },
      };
      mockAxios.post.mockResolvedValueOnce(mockResponse);

      const prompt = 'Test prompt';
      const model = 'llama2';

      // Act
      const result = await llmService.generateResponse(prompt, model);

      // Assert
      expect(result).toEqual({
        response: 'Generated response',
        model: 'llama2',
        metadata: {
          created_at: mockResponse.data.created_at,
          done: true,
        },
      });
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/generate'),
        expect.objectContaining({
          model,
          prompt,
          stream: false,
        })
      );
    });

    it('should handle API errors gracefully', async () => {
      // Arrange
      mockAxios.post.mockRejectedValueOnce(new Error('API Error'));
      const prompt = 'Test prompt';
      const model = 'llama2';

      // Act & Assert
      await expect(llmService.generateResponse(prompt, model)).rejects.toThrow(
        'Failed to generate response'
      );
    });

    it('should validate required parameters', async () => {
      // Act & Assert
      await expect(llmService.generateResponse('', 'llama2')).rejects.toThrow(
        'Prompt cannot be empty'
      );
      await expect(llmService.generateResponse('test', '')).rejects.toThrow(
        'Model cannot be empty'
      );
    });

    it('should handle timeout scenarios', async () => {
      // Arrange
      const timeoutError = new Error('timeout of 30000ms exceeded');
      mockAxios.post.mockRejectedValueOnce(timeoutError);

      // Act & Assert
      await expect(llmService.generateResponse('test', 'llama2')).rejects.toThrow(
        'Request timeout'
      );
    });
  });

  describe('streamResponse', () => {
    it('should stream response successfully', async () => {
      // Arrange
      const mockStream = {
        data: {
          response: 'Partial response',
          done: false,
        },
      };
      mockAxios.post.mockResolvedValueOnce({ data: mockStream });

      const prompt = 'Test prompt';
      const model = 'llama2';
      const onChunk = jest.fn();

      // Act
      await llmService.streamResponse(prompt, model, onChunk);

      // Assert
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/generate'),
        expect.objectContaining({
          model,
          prompt,
          stream: true,
        })
      );
    });

    it('should handle streaming errors', async () => {
      // Arrange
      mockAxios.post.mockRejectedValueOnce(new Error('Stream error'));

      // Act & Assert
      await expect(
        llmService.streamResponse('test', 'llama2', jest.fn())
      ).rejects.toThrow('Failed to stream response');
    });
  });

  describe('getAvailableModels', () => {
    it('should fetch available models', async () => {
      // Arrange
      const mockModels = {
        data: {
          models: [
            { name: 'llama2', size: '7B' },
            { name: 'codellama', size: '13B' },
          ],
        },
      };
      mockAxios.get.mockResolvedValueOnce(mockModels);

      // Act
      const result = await llmService.getAvailableModels();

      // Assert
      expect(result).toEqual([
        { name: 'llama2', size: '7B' },
        { name: 'codellama', size: '13B' },
      ]);
      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/tags')
      );
    });

    it('should handle model fetch errors', async () => {
      // Arrange
      mockAxios.get.mockRejectedValueOnce(new Error('Model fetch error'));

      // Act & Assert
      await expect(llmService.getAvailableModels()).rejects.toThrow(
        'Failed to fetch models'
      );
    });
  });

  describe('validateModel', () => {
    it('should validate existing model', async () => {
      // Arrange
      const mockResponse = { data: { name: 'llama2' } };
      mockAxios.get.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await llmService.validateModel('llama2');

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for non-existing model', async () => {
      // Arrange
      mockAxios.get.mockRejectedValueOnce(new Error('Model not found'));

      // Act
      const result = await llmService.validateModel('invalid-model');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('performance metrics', () => {
    it('should track response times', async () => {
      // Arrange
      const mockResponse = {
        data: {
          response: 'Test response',
          model: 'llama2',
          eval_duration: 1500000000, // 1.5 seconds in nanoseconds
        },
      };
      mockAxios.post.mockResolvedValueOnce(mockResponse);

      const startTime = Date.now();

      // Act
      const result = await llmService.generateResponse('test', 'llama2');

      // Assert
      expect(result.metadata).toHaveProperty('responseTime');
      expect(result.metadata.responseTime).toBeGreaterThan(0);
    });

    it('should calculate tokens per second', async () => {
      // Arrange
      const mockResponse = {
        data: {
          response: 'Test response with multiple tokens',
          model: 'llama2',
          eval_count: 100,
          eval_duration: 2000000000, // 2 seconds in nanoseconds
        },
      };
      mockAxios.post.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await llmService.generateResponse('test', 'llama2');

      // Assert
      expect(result.metadata).toHaveProperty('tokensPerSecond');
      expect(result.metadata.tokensPerSecond).toBe(50); // 100 tokens / 2 seconds
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      // Arrange
      const networkError = new Error('Network Error');
      networkError.code = 'ECONNREFUSED';
      mockAxios.post.mockRejectedValueOnce(networkError);

      // Act & Assert
      await expect(llmService.generateResponse('test', 'llama2')).rejects.toThrow(
        'Unable to connect to LLM service'
      );
    });

    it('should handle rate limiting', async () => {
      // Arrange
      const rateLimitError = {
        response: {
          status: 429,
          data: { error: 'Rate limit exceeded' },
        },
      };
      mockAxios.post.mockRejectedValueOnce(rateLimitError);

      // Act & Assert
      await expect(llmService.generateResponse('test', 'llama2')).rejects.toThrow(
        'Rate limit exceeded'
      );
    });

    it('should handle malformed responses', async () => {
      // Arrange
      const malformedResponse = { data: null };
      mockAxios.post.mockResolvedValueOnce(malformedResponse);

      // Act & Assert
      await expect(llmService.generateResponse('test', 'llama2')).rejects.toThrow(
        'Invalid response format'
      );
    });
  });

  describe('configuration', () => {
    it('should use custom API endpoint', () => {
      // Arrange
      const customEndpoint = 'http://custom-ollama:11434';
      const customService = new LLMService(customEndpoint);

      // Act & Assert
      expect(customService.getBaseUrl()).toBe(customEndpoint);
    });

    it('should use default timeout', () => {
      // Act & Assert
      expect(llmService.getTimeout()).toBe(30000);
    });

    it('should allow custom timeout', () => {
      // Arrange
      const customTimeout = 60000;
      llmService.setTimeout(customTimeout);

      // Act & Assert
      expect(llmService.getTimeout()).toBe(customTimeout);
    });
  });
});