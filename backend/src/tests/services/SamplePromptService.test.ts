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
      
      expect(samples).toHaveLength(12);
      expect(samples[0]).toHaveProperty('title', 'Creative Story Generator');
      expect(samples[1]).toHaveProperty('title', 'Technical Documentation Assistant');
      expect(samples[2]).toHaveProperty('title', 'Data Analysis Query Builder');
      expect(samples[3]).toHaveProperty('title', 'Problem-Solving Framework');
      expect(samples[4]).toHaveProperty('title', 'Code Generation Assistant');
      expect(samples[5]).toHaveProperty('title', 'Business Strategy Consultant');
      expect(samples[6]).toHaveProperty('title', 'Educational Content Creator');
      expect(samples[7]).toHaveProperty('title', 'Social Media Content Strategist');
      expect(samples[8]).toHaveProperty('title', 'Legal Document Analyst');
      expect(samples[9]).toHaveProperty('title', 'Health & Wellness Coach');
      expect(samples[10]).toHaveProperty('title', 'Creative Project Manager');
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
      expect(categories).toContain('education');
      expect(categories).toContain('marketing');
      expect(categories).toContain('legal');
      expect(categories).toContain('health');
      expect(categories).toContain('project-management');
      
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
      
      expect(stats.totalSamples).toBe(12);
      expect(stats.categories).toBe(11);
      expect(stats.categoriesBreakdown).toHaveLength(11);
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

  describe('searchSamplePrompts', () => {
    it('should return all samples when query is empty', () => {
      const results = service.searchSamplePrompts('');
      expect(results).toHaveLength(12);
    });

    it('should search by title', () => {
      const results = service.searchSamplePrompts('Creative');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toContain('Creative');
    });

    it('should search by description', () => {
      const results = service.searchSamplePrompts('documentation');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.description.toLowerCase().includes('documentation'))).toBe(true);
    });

    it('should search by tags', () => {
      const results = service.searchSamplePrompts('storytelling');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.tags.includes('storytelling'))).toBe(true);
    });

    it('should filter by categories', () => {
      const results = service.searchSamplePrompts('', { categories: ['creative'] });
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.category === 'creative')).toBe(true);
    });

    it('should respect maxResults parameter', () => {
      const results = service.searchSamplePrompts('', { maxResults: 3 });
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('should perform fuzzy matching when enabled', () => {
      const results = service.searchSamplePrompts('cretv', { fuzzyMatch: true });
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('getSamplePromptsPaginated', () => {
    it('should return paginated results with default options', () => {
      const result = service.getSamplePromptsPaginated();
      
      expect(result.samples).toHaveLength(10); // default limit
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.total).toBe(12);
      expect(result.pagination.totalPages).toBe(2);
    });

    it('should handle custom page and limit', () => {
      const result = service.getSamplePromptsPaginated({ page: 2, limit: 5 });
      
      expect(result.samples).toHaveLength(5);
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(5);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrev).toBe(true);
    });

    it('should sort by title ascending by default', () => {
      const result = service.getSamplePromptsPaginated({ limit: 12 });
      
      for (let i = 1; i < result.samples.length; i++) {
        expect(result.samples[i-1].title.toLowerCase() <= result.samples[i].title.toLowerCase()).toBe(true);
      }
    });

    it('should sort by variables count descending', () => {
      const result = service.getSamplePromptsPaginated({ 
        sortBy: 'variables', 
        sortOrder: 'desc',
        limit: 12
      });
      
      for (let i = 1; i < result.samples.length; i++) {
        expect(result.samples[i-1].variables.length >= result.samples[i].variables.length).toBe(true);
      }
    });

    it('should filter by category', () => {
      const result = service.getSamplePromptsPaginated({ category: 'creative' });
      
      expect(result.samples.every(s => s.category === 'creative')).toBe(true);
    });
  });

  describe('exportSamplePrompts', () => {
    it('should export as JSON', () => {
      const exported = service.exportSamplePrompts('json');
      const parsed = JSON.parse(exported);
      
      expect(parsed.samples).toBeDefined();
      expect(Array.isArray(parsed.samples)).toBe(true);
      expect(parsed.samples).toHaveLength(12);
    });

    it('should export as YAML', () => {
      const exported = service.exportSamplePrompts('yaml');
      
      expect(typeof exported).toBe('string');
      expect(exported).toContain('samples:');
      expect(exported).toContain('title:');
      expect(exported).toContain('category:');
    });

    it('should export as CSV', () => {
      const exported = service.exportSamplePrompts('csv');
      const lines = exported.split('\n');
      
      expect(lines[0]).toBe('Title,Category,Description,Variables,Tags,Template Length');
      expect(lines).toHaveLength(13); // header + 12 samples
    });

    it('should include stats when requested', () => {
      const exported = service.exportSamplePrompts('json', { includeStats: true });
      const parsed = JSON.parse(exported);
      
      expect(parsed.stats).toBeDefined();
      expect(parsed.exportedAt).toBeDefined();
      expect(parsed.filter).toBeDefined();
    });

    it('should filter by category', () => {
      const exported = service.exportSamplePrompts('json', { category: 'creative' });
      const parsed = JSON.parse(exported);
      
      expect(parsed.samples.every((s: any) => s.category === 'creative')).toBe(true);
    });

    it('should throw error for unsupported format', () => {
      expect(() => service.exportSamplePrompts('xml' as any)).toThrow('Unsupported export format: xml');
    });
  });

  describe('getTemplateComplexity', () => {
    it('should analyze template complexity', () => {
      const sample = service.getSamplePrompts()[0]; // Creative Story Generator
      const complexity = service.getTemplateComplexity(sample);
      
      expect(complexity.score).toBeGreaterThan(0);
      expect(complexity.factors.variableCount).toBe(sample.variables.length);
      expect(complexity.factors.templateLength).toBe(sample.prompt_template.length);
      expect(['simple', 'moderate', 'complex', 'advanced']).toContain(complexity.level);
    });

    it('should identify structural elements', () => {
      const sample = {
        title: 'Test',
        description: 'Test',
        prompt_template: '# Header\n\n1. Item\n• Bullet\n→ Arrow\n**Bold**',
        variables: ['var1'],
        category: 'test',
        tags: []
      };
      
      const complexity = service.getTemplateComplexity(sample);
      expect(complexity.factors.structuralElements).toBeGreaterThan(0);
    });

    it('should detect conditional logic', () => {
      const sample = {
        title: 'Test',
        description: 'Test',
        prompt_template: 'If the condition is met, then should proceed. When necessary, must validate.',
        variables: [],
        category: 'test',
        tags: []
      };
      
      const complexity = service.getTemplateComplexity(sample);
      expect(complexity.factors.conditionalLogic).toBeGreaterThan(0);
    });
  });

  describe('validateAllSamplePrompts', () => {
    it('should validate all sample prompts', () => {
      const report = service.validateAllSamplePrompts();
      
      expect(report.valid).toBeGreaterThan(0);
      expect(report.valid + report.invalid).toBe(12);
      expect(Array.isArray(report.issues)).toBe(true);
    });

    it('should include complexity information in issues', () => {
      // This test would pass if there were invalid samples
      // For our current samples, they should all be valid
      const report = service.validateAllSamplePrompts();
      
      report.issues.forEach(issue => {
        expect(issue.title).toBeDefined();
        expect(Array.isArray(issue.errors)).toBe(true);
        expect(['simple', 'moderate', 'complex', 'advanced']).toContain(issue.complexity);
      });
    });
  });

  describe('fuzzyMatch', () => {
    it('should perform fuzzy matching', () => {
      // Access private method through any casting for testing
      const fuzzyMatch = (service as any).fuzzyMatch;
      
      expect(fuzzyMatch('creative', 'cretv')).toBe(true);
      expect(fuzzyMatch('documentation', 'dcmnttn')).toBe(true);
      expect(fuzzyMatch('short', 'verylongstring')).toBe(false);
    });
  });
});