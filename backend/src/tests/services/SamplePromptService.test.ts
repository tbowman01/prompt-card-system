import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SamplePromptService } from '../../services/SamplePromptService';
import { db } from '../../database/connection';

// Mock the database
jest.mock('../../database/connection', () => ({
  db: {
    prepare: jest.fn(),
    exec: jest.fn()
  }
}));

describe('SamplePromptService', () => {
  let service: SamplePromptService;
  let mockDb: jest.Mocked<typeof db>;

  beforeEach(() => {
    service = SamplePromptService.getInstance();
    mockDb = db as jest.Mocked<typeof db>;
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getSamplePrompts', () => {
    it('should return all sample prompts', () => {
      const samples = service.getSamplePrompts();
      
      expect(samples).toHaveLength(6);
      expect(samples[0]).toHaveProperty('title', 'Creative Story Generator');
      expect(samples[1]).toHaveProperty('title', 'Technical Documentation Assistant');
      expect(samples[2]).toHaveProperty('title', 'Data Analysis Query Builder');
      expect(samples[3]).toHaveProperty('title', 'Problem-Solving Framework');
      expect(samples[4]).toHaveProperty('title', 'Code Generation Assistant');
      expect(samples[5]).toHaveProperty('title', 'Business Strategy Consultant');
    });

    it('should return prompts with all required fields', () => {
      const samples = service.getSamplePrompts();
      
      samples.forEach(sample => {
        expect(sample).toHaveProperty('title');
        expect(sample).toHaveProperty('description');
        expect(sample).toHaveProperty('prompt_template');
        expect(sample).toHaveProperty('variables');
        expect(sample).toHaveProperty('category');
        expect(sample).toHaveProperty('tags');
        
        expect(typeof sample.title).toBe('string');
        expect(typeof sample.description).toBe('string');
        expect(typeof sample.prompt_template).toBe('string');
        expect(Array.isArray(sample.variables)).toBe(true);
        expect(typeof sample.category).toBe('string');
        expect(Array.isArray(sample.tags)).toBe(true);
      });
    });
  });

  describe('getSamplePromptsByCategory', () => {
    it('should return prompts filtered by category', () => {
      const creativePrompts = service.getSamplePromptsByCategory('creative');
      const technicalPrompts = service.getSamplePromptsByCategory('technical');
      
      expect(creativePrompts).toHaveLength(1);
      expect(creativePrompts[0].category).toBe('creative');
      
      expect(technicalPrompts).toHaveLength(1);
      expect(technicalPrompts[0].category).toBe('technical');
    });

    it('should return empty array for non-existent category', () => {
      const nonExistentPrompts = service.getSamplePromptsByCategory('non-existent');
      expect(nonExistentPrompts).toHaveLength(0);
    });
  });

  describe('getCategories', () => {
    it('should return all unique categories', () => {
      const categories = service.getCategories();
      
      expect(categories).toContain('creative');
      expect(categories).toContain('technical');
      expect(categories).toContain('analytics');
      expect(categories).toContain('problem-solving');
      expect(categories).toContain('development');
      expect(categories).toContain('business');
      
      // Should not contain duplicates
      expect(new Set(categories).size).toBe(categories.length);
    });
  });

  describe('validateSamplePrompt', () => {
    it('should validate a correct sample prompt', () => {
      const validSample = {
        title: 'Test Prompt',
        description: 'A test prompt for validation',
        prompt_template: 'This is a test prompt with {{variable1}} and {{variable2}}',
        variables: ['variable1', 'variable2'],
        category: 'test',
        tags: ['test', 'validation']
      };

      const result = service.validateSamplePrompt(validSample);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const invalidSample = {
        title: '',
        description: '',
        prompt_template: '',
        variables: [],
        category: 'test',
        tags: []
      };

      const result = service.validateSamplePrompt(invalidSample);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Title is required');
      expect(result.errors).toContain('Prompt template is required');
      expect(result.errors).toContain('Description is required');
    });

    it('should detect unused variables', () => {
      const sampleWithUnusedVars = {
        title: 'Test Prompt',
        description: 'A test prompt',
        prompt_template: 'This prompt uses {{variable1}}',
        variables: ['variable1', 'unused_variable'],
        category: 'test',
        tags: ['test']
      };

      const result = service.validateSamplePrompt(sampleWithUnusedVars);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('unused_variable'))).toBe(true);
    });

    it('should detect undeclared variables', () => {
      const sampleWithUndeclaredVars = {
        title: 'Test Prompt',
        description: 'A test prompt',
        prompt_template: 'This prompt uses {{variable1}} and {{undeclared_variable}}',
        variables: ['variable1'],
        category: 'test',
        tags: ['test']
      };

      const result = service.validateSamplePrompt(sampleWithUndeclaredVars);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('undeclared_variable'))).toBe(true);
    });
  });

  describe('getSamplePromptStats', () => {
    it('should return correct statistics', () => {
      const stats = service.getSamplePromptStats();
      
      expect(stats.totalSamples).toBe(6);
      expect(stats.categories).toBe(6);
      expect(stats.categoriesBreakdown).toHaveLength(6);
      expect(typeof stats.averageVariables).toBe('number');
      expect(typeof stats.totalVariables).toBe('number');
      
      // Check that breakdown adds up to total
      const breakdownTotal = stats.categoriesBreakdown.reduce((sum, cat) => sum + cat.count, 0);
      expect(breakdownTotal).toBe(stats.totalSamples);
    });
  });

  describe('getSamplePromptPreview', () => {
    it('should return correct sample prompt by title', () => {
      const preview = service.getSamplePromptPreview('Creative Story Generator');
      
      expect(preview).not.toBeNull();
      expect(preview?.title).toBe('Creative Story Generator');
      expect(preview?.category).toBe('creative');
    });

    it('should return null for non-existent prompt', () => {
      const preview = service.getSamplePromptPreview('Non-existent Prompt');
      expect(preview).toBeNull();
    });
  });

  describe('createPromptFromSample', () => {
    it('should throw error for non-existent sample', async () => {
      await expect(
        service.createPromptFromSample('Non-existent Sample')
      ).rejects.toThrow('Sample prompt \'Non-existent Sample\' not found');
    });

    // Note: Database integration tests would be better suited for full createPromptFromSample testing
    // as they require proper database setup and cleanup
  });
});