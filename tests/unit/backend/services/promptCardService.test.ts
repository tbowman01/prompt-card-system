/**
 * Prompt Card Service Unit Tests
 * @description Comprehensive tests for prompt card management
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock dependencies
const mockDb = {
  prepare: jest.fn(),
  close: jest.fn(),
  exec: jest.fn(),
};

const mockPreparedStatement = {
  run: jest.fn(),
  get: jest.fn(),
  all: jest.fn(),
  bind: jest.fn(),
};

jest.mock('better-sqlite3', () => jest.fn(() => mockDb));

// Import after mocking
import { PromptCardService } from '../../../../backend/src/services/promptCardService';
import { PromptCard, PromptCardStatus } from '../../../../backend/src/types/promptCard';

describe('PromptCardService', () => {
  let promptCardService: PromptCardService;

  beforeEach(() => {
    promptCardService = new PromptCardService();
    mockDb.prepare.mockReturnValue(mockPreparedStatement);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createPromptCard', () => {
    it('should create a new prompt card successfully', async () => {
      // Arrange
      const newCard: Omit<PromptCard, 'id' | 'createdAt' | 'updatedAt'> = {
        title: 'Test Card',
        description: 'Test Description',
        prompt: 'Test prompt',
        category: 'General',
        tags: ['test', 'unit'],
        status: PromptCardStatus.DRAFT,
        variables: [{ name: 'input', type: 'string', required: true }],
        expectedOutput: 'Expected result',
        metadata: { author: 'test-user' },
      };

      const mockId = 'card-123';
      mockPreparedStatement.run.mockReturnValue({ lastInsertRowid: mockId });

      // Act
      const result = await promptCardService.createPromptCard(newCard);

      // Assert
      expect(result).toMatchObject({
        id: mockId,
        ...newCard,
      });
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO prompt_cards')
      );
    });

    it('should validate required fields', async () => {
      // Arrange
      const incompleteCard = {
        title: '',
        prompt: 'test',
      } as any;

      // Act & Assert
      await expect(promptCardService.createPromptCard(incompleteCard)).rejects.toThrow(
        'Title cannot be empty'
      );
    });

    it('should sanitize input data', async () => {
      // Arrange
      const cardWithXSS: Omit<PromptCard, 'id' | 'createdAt' | 'updatedAt'> = {
        title: '<script>alert("xss")</script>',
        description: 'Test Description',
        prompt: 'Test prompt',
        category: 'General',
        tags: [],
        status: PromptCardStatus.DRAFT,
        variables: [],
        expectedOutput: '',
        metadata: {},
      };

      mockPreparedStatement.run.mockReturnValue({ lastInsertRowid: 'card-123' });

      // Act
      const result = await promptCardService.createPromptCard(cardWithXSS);

      // Assert
      expect(result.title).not.toContain('<script>');
      expect(result.title).toContain('alert');
    });
  });

  describe('getPromptCard', () => {
    it('should retrieve a prompt card by ID', async () => {
      // Arrange
      const mockCard = {
        id: 'card-123',
        title: 'Test Card',
        prompt: 'Test prompt',
        status: PromptCardStatus.ACTIVE,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockPreparedStatement.get.mockReturnValue(mockCard);

      // Act
      const result = await promptCardService.getPromptCard('card-123');

      // Assert
      expect(result).toMatchObject({
        id: 'card-123',
        title: 'Test Card',
        prompt: 'Test prompt',
        status: PromptCardStatus.ACTIVE,
      });
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM prompt_cards WHERE id = ?')
      );
    });

    it('should return null for non-existent card', async () => {
      // Arrange
      mockPreparedStatement.get.mockReturnValue(undefined);

      // Act
      const result = await promptCardService.getPromptCard('non-existent');

      // Assert
      expect(result).toBeNull();
    });

    it('should validate ID format', async () => {
      // Act & Assert
      await expect(promptCardService.getPromptCard('')).rejects.toThrow(
        'Invalid card ID'
      );
      await expect(promptCardService.getPromptCard(null as any)).rejects.toThrow(
        'Invalid card ID'
      );
    });
  });

  describe('updatePromptCard', () => {
    it('should update an existing prompt card', async () => {
      // Arrange
      const cardId = 'card-123';
      const updates = {
        title: 'Updated Title',
        status: PromptCardStatus.ACTIVE,
      };

      const existingCard = {
        id: cardId,
        title: 'Original Title',
        prompt: 'Test prompt',
        status: PromptCardStatus.DRAFT,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockPreparedStatement.get.mockReturnValue(existingCard);
      mockPreparedStatement.run.mockReturnValue({ changes: 1 });

      // Act
      const result = await promptCardService.updatePromptCard(cardId, updates);

      // Assert
      expect(result.title).toBe('Updated Title');
      expect(result.status).toBe(PromptCardStatus.ACTIVE);
      expect(result.updatedAt).toBeInstanceOf(Date);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE prompt_cards')
      );
    });

    it('should throw error when updating non-existent card', async () => {
      // Arrange
      mockPreparedStatement.get.mockReturnValue(undefined);

      // Act & Assert
      await expect(
        promptCardService.updatePromptCard('non-existent', { title: 'New Title' })
      ).rejects.toThrow('Prompt card not found');
    });

    it('should preserve original values for non-updated fields', async () => {
      // Arrange
      const cardId = 'card-123';
      const updates = { title: 'New Title' };

      const existingCard = {
        id: cardId,
        title: 'Original Title',
        prompt: 'Original Prompt',
        category: 'Original Category',
        status: PromptCardStatus.DRAFT,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockPreparedStatement.get.mockReturnValue(existingCard);
      mockPreparedStatement.run.mockReturnValue({ changes: 1 });

      // Act
      const result = await promptCardService.updatePromptCard(cardId, updates);

      // Assert
      expect(result.title).toBe('New Title');
      expect(result.prompt).toBe('Original Prompt');
      expect(result.category).toBe('Original Category');
    });
  });

  describe('deletePromptCard', () => {
    it('should delete an existing prompt card', async () => {
      // Arrange
      const cardId = 'card-123';
      mockPreparedStatement.run.mockReturnValue({ changes: 1 });

      // Act
      const result = await promptCardService.deletePromptCard(cardId);

      // Assert
      expect(result).toBe(true);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM prompt_cards WHERE id = ?')
      );
    });

    it('should return false when deleting non-existent card', async () => {
      // Arrange
      mockPreparedStatement.run.mockReturnValue({ changes: 0 });

      // Act
      const result = await promptCardService.deletePromptCard('non-existent');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('searchPromptCards', () => {
    it('should search prompt cards by query', async () => {
      // Arrange
      const mockResults = [
        {
          id: 'card-1',
          title: 'Test Card 1',
          description: 'Contains search term',
          status: PromptCardStatus.ACTIVE,
        },
        {
          id: 'card-2',
          title: 'Another Test Card',
          description: 'Also contains search term',
          status: PromptCardStatus.ACTIVE,
        },
      ];

      mockPreparedStatement.all.mockReturnValue(mockResults);

      // Act
      const result = await promptCardService.searchPromptCards('search term');

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Test Card 1');
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('WHERE (title LIKE ? OR description LIKE ?)')
      );
    });

    it('should filter by category', async () => {
      // Arrange
      const mockResults = [
        {
          id: 'card-1',
          title: 'Test Card',
          category: 'General',
          status: PromptCardStatus.ACTIVE,
        },
      ];

      mockPreparedStatement.all.mockReturnValue(mockResults);

      // Act
      const result = await promptCardService.searchPromptCards('', {
        category: 'General',
      });

      // Assert
      expect(result).toHaveLength(1);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('WHERE category = ?')
      );
    });

    it('should filter by status', async () => {
      // Arrange
      const mockResults = [];
      mockPreparedStatement.all.mockReturnValue(mockResults);

      // Act
      const result = await promptCardService.searchPromptCards('', {
        status: PromptCardStatus.DRAFT,
      });

      // Assert
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = ?')
      );
    });

    it('should filter by tags', async () => {
      // Arrange
      const mockResults = [];
      mockPreparedStatement.all.mockReturnValue(mockResults);

      // Act
      const result = await promptCardService.searchPromptCards('', {
        tags: ['test', 'unit'],
      });

      // Assert
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('WHERE JSON_EXTRACT(tags')
      );
    });
  });

  describe('getPromptCardsByCategory', () => {
    it('should retrieve cards by category', async () => {
      // Arrange
      const mockResults = [
        { id: 'card-1', category: 'General' },
        { id: 'card-2', category: 'General' },
      ];

      mockPreparedStatement.all.mockReturnValue(mockResults);

      // Act
      const result = await promptCardService.getPromptCardsByCategory('General');

      // Assert
      expect(result).toHaveLength(2);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('WHERE category = ?')
      );
    });
  });

  describe('getPromptCardStats', () => {
    it('should return card statistics', async () => {
      // Arrange
      const mockStats = [
        { status: PromptCardStatus.ACTIVE, count: 10 },
        { status: PromptCardStatus.DRAFT, count: 5 },
        { status: PromptCardStatus.ARCHIVED, count: 2 },
      ];

      mockPreparedStatement.all.mockReturnValue(mockStats);

      // Act
      const result = await promptCardService.getPromptCardStats();

      // Assert
      expect(result).toEqual({
        total: 17,
        active: 10,
        draft: 5,
        archived: 2,
      });
    });
  });

  describe('validation', () => {
    it('should validate prompt card structure', () => {
      // Arrange
      const validCard = {
        title: 'Valid Card',
        prompt: 'Valid prompt',
        category: 'General',
        status: PromptCardStatus.DRAFT,
      };

      const invalidCard = {
        title: '',
        prompt: 'test',
      };

      // Act & Assert
      expect(() => promptCardService.validatePromptCard(validCard)).not.toThrow();
      expect(() => promptCardService.validatePromptCard(invalidCard)).toThrow();
    });

    it('should validate variable definitions', () => {
      // Arrange
      const validVariables = [
        { name: 'input', type: 'string', required: true },
        { name: 'count', type: 'number', required: false, default: 10 },
      ];

      const invalidVariables = [
        { name: '', type: 'string' }, // Empty name
        { name: 'test', type: 'invalid' }, // Invalid type
      ];

      // Act & Assert
      expect(() => promptCardService.validateVariables(validVariables)).not.toThrow();
      expect(() => promptCardService.validateVariables(invalidVariables)).toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      // Arrange
      mockDb.prepare.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      // Act & Assert
      await expect(promptCardService.getPromptCard('test')).rejects.toThrow(
        'Database operation failed'
      );
    });

    it('should handle JSON parsing errors', async () => {
      // Arrange
      const cardWithInvalidJSON = {
        id: 'card-123',
        title: 'Test',
        variables: 'invalid-json',
      };

      mockPreparedStatement.get.mockReturnValue(cardWithInvalidJSON);

      // Act & Assert
      await expect(promptCardService.getPromptCard('card-123')).rejects.toThrow(
        'Invalid data format'
      );
    });
  });
});