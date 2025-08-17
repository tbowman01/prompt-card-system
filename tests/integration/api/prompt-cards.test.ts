/**
 * Prompt Cards API Integration Tests
 * @description Full-stack tests for prompt card API endpoints
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { Express } from 'express';

// Import app and test utilities
import { createApp } from '../../../backend/src/app';
import { setupTestDatabase, cleanupTestDatabase } from '../../utils/database';
import { createTestUser, generateAuthToken } from '../../utils/auth';

describe('Prompt Cards API Integration', () => {
  let app: Express;
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    // Setup test database and app
    await setupTestDatabase();
    app = createApp();
    
    // Create test user and get auth token
    const testUser = await createTestUser({
      email: 'test@example.com',
      password: 'TestPass123!',
      firstName: 'Test',
      lastName: 'User',
    });
    
    testUserId = testUser.id;
    authToken = generateAuthToken(testUser);
  }, global.INTEGRATION_TEST_CONFIG.DB_TIMEOUT);

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    // Clean up prompt cards before each test
    await request(app)
      .delete('/api/test/prompt-cards')
      .set('Authorization', `Bearer ${authToken}`);
  });

  describe('POST /api/prompt-cards', () => {
    it('should create a new prompt card', async () => {
      // Arrange
      const newCard = {
        title: 'Test Prompt Card',
        description: 'A test prompt card for integration testing',
        prompt: 'Generate a summary for: {{input}}',
        category: 'General',
        tags: ['test', 'integration'],
        variables: [
          {
            name: 'input',
            type: 'string',
            required: true,
            description: 'The text to summarize',
          },
        ],
        expectedOutput: 'A concise summary of the input text',
      };

      // Act
      const response = await request(app)
        .post('/api/prompt-cards')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newCard)
        .expect(201);

      // Assert
      expect(response.body).toMatchObject({
        id: expect.any(String),
        title: 'Test Prompt Card',
        description: 'A test prompt card for integration testing',
        prompt: 'Generate a summary for: {{input}}',
        category: 'General',
        tags: ['test', 'integration'],
        status: 'draft',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });

      expect(response.body.variables).toHaveLength(1);
      expect(response.body.variables[0]).toMatchObject({
        name: 'input',
        type: 'string',
        required: true,
      });
    });

    it('should validate required fields', async () => {
      // Arrange
      const incompleteCard = {
        description: 'Missing title and prompt',
      };

      // Act
      const response = await request(app)
        .post('/api/prompt-cards')
        .set('Authorization', `Bearer ${authToken}`)
        .send(incompleteCard)
        .expect(400);

      // Assert
      expect(response.body.errors).toContain('Title is required');
      expect(response.body.errors).toContain('Prompt is required');
    });

    it('should sanitize input data', async () => {
      // Arrange
      const cardWithXSS = {
        title: '<script>alert("xss")</script>Test Card',
        prompt: 'Clean prompt',
        category: 'General',
      };

      // Act
      const response = await request(app)
        .post('/api/prompt-cards')
        .set('Authorization', `Bearer ${authToken}`)
        .send(cardWithXSS)
        .expect(201);

      // Assert
      expect(response.body.title).not.toContain('<script>');
      expect(response.body.title).toBe('Test Card');
    });

    it('should require authentication', async () => {
      // Arrange
      const newCard = {
        title: 'Test Card',
        prompt: 'Test prompt',
      };

      // Act & Assert
      await request(app)
        .post('/api/prompt-cards')
        .send(newCard)
        .expect(401);
    });
  });

  describe('GET /api/prompt-cards', () => {
    beforeEach(async () => {
      // Create test cards
      const testCards = [
        {
          title: 'Card 1',
          prompt: 'Test prompt 1',
          category: 'General',
          tags: ['test'],
        },
        {
          title: 'Card 2',
          prompt: 'Test prompt 2',
          category: 'Specific',
          tags: ['test', 'specific'],
        },
        {
          title: 'Card 3',
          prompt: 'Test prompt 3',
          category: 'General',
          tags: ['another'],
        },
      ];

      for (const card of testCards) {
        await request(app)
          .post('/api/prompt-cards')
          .set('Authorization', `Bearer ${authToken}`)
          .send(card);
      }
    });

    it('should retrieve all prompt cards', async () => {
      // Act
      const response = await request(app)
        .get('/api/prompt-cards')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      expect(response.body.data).toHaveLength(3);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: 3,
        totalPages: 1,
      });
    });

    it('should support pagination', async () => {
      // Act
      const response = await request(app)
        .get('/api/prompt-cards?page=1&limit=2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 2,
        total: 3,
        totalPages: 2,
      });
    });

    it('should filter by category', async () => {
      // Act
      const response = await request(app)
        .get('/api/prompt-cards?category=General')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      expect(response.body.data).toHaveLength(2);
      response.body.data.forEach((card: any) => {
        expect(card.category).toBe('General');
      });
    });

    it('should filter by tags', async () => {
      // Act
      const response = await request(app)
        .get('/api/prompt-cards?tags=specific')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toBe('Card 2');
    });

    it('should search by title and description', async () => {
      // Act
      const response = await request(app)
        .get('/api/prompt-cards?search=Card 1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toBe('Card 1');
    });

    it('should sort results', async () => {
      // Act
      const response = await request(app)
        .get('/api/prompt-cards?sort=title&order=desc')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      const titles = response.body.data.map((card: any) => card.title);
      expect(titles).toEqual(['Card 3', 'Card 2', 'Card 1']);
    });
  });

  describe('GET /api/prompt-cards/:id', () => {
    let testCardId: string;

    beforeEach(async () => {
      // Create a test card
      const response = await request(app)
        .post('/api/prompt-cards')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Card',
          prompt: 'Test prompt with {{variable}}',
          category: 'General',
          variables: [{ name: 'variable', type: 'string', required: true }],
        });
      
      testCardId = response.body.id;
    });

    it('should retrieve a specific prompt card', async () => {
      // Act
      const response = await request(app)
        .get(`/api/prompt-cards/${testCardId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      expect(response.body).toMatchObject({
        id: testCardId,
        title: 'Test Card',
        prompt: 'Test prompt with {{variable}}',
        category: 'General',
      });
    });

    it('should return 404 for non-existent card', async () => {
      // Act & Assert
      await request(app)
        .get('/api/prompt-cards/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PUT /api/prompt-cards/:id', () => {
    let testCardId: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/prompt-cards')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Original Title',
          prompt: 'Original prompt',
          category: 'General',
        });
      
      testCardId = response.body.id;
    });

    it('should update an existing prompt card', async () => {
      // Arrange
      const updates = {
        title: 'Updated Title',
        description: 'Updated description',
        category: 'Specific',
        tags: ['updated'],
      };

      // Act
      const response = await request(app)
        .put(`/api/prompt-cards/${testCardId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);

      // Assert
      expect(response.body).toMatchObject({
        id: testCardId,
        title: 'Updated Title',
        description: 'Updated description',
        category: 'Specific',
        tags: ['updated'],
        prompt: 'Original prompt', // Should preserve original
      });
    });

    it('should validate updates', async () => {
      // Arrange
      const invalidUpdates = {
        title: '', // Empty title
      };

      // Act & Assert
      await request(app)
        .put(`/api/prompt-cards/${testCardId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidUpdates)
        .expect(400);
    });

    it('should return 404 for non-existent card', async () => {
      // Act & Assert
      await request(app)
        .put('/api/prompt-cards/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'New Title' })
        .expect(404);
    });
  });

  describe('DELETE /api/prompt-cards/:id', () => {
    let testCardId: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/prompt-cards')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Card to Delete',
          prompt: 'Test prompt',
          category: 'General',
        });
      
      testCardId = response.body.id;
    });

    it('should delete an existing prompt card', async () => {
      // Act
      await request(app)
        .delete(`/api/prompt-cards/${testCardId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify deletion
      await request(app)
        .get(`/api/prompt-cards/${testCardId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 404 for non-existent card', async () => {
      // Act & Assert
      await request(app)
        .delete('/api/prompt-cards/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('POST /api/prompt-cards/:id/test', () => {
    let testCardId: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/prompt-cards')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Card',
          prompt: 'Summarize: {{input}}',
          category: 'General',
          variables: [{ name: 'input', type: 'string', required: true }],
        });
      
      testCardId = response.body.id;
    });

    it('should test prompt card execution', async () => {
      // Arrange
      const testData = {
        variables: {
          input: 'This is a long text that needs to be summarized for testing purposes.',
        },
        model: 'llama2',
      };

      // Act
      const response = await request(app)
        .post(`/api/prompt-cards/${testCardId}/test`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(testData)
        .expect(200);

      // Assert
      expect(response.body).toMatchObject({
        success: true,
        result: expect.any(String),
        metadata: expect.objectContaining({
          model: 'llama2',
          responseTime: expect.any(Number),
        }),
      });
    });

    it('should validate required variables', async () => {
      // Arrange
      const testData = {
        variables: {}, // Missing required 'input' variable
        model: 'llama2',
      };

      // Act & Assert
      await request(app)
        .post(`/api/prompt-cards/${testCardId}/test`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(testData)
        .expect(400);
    });
  });

  describe('POST /api/prompt-cards/batch', () => {
    it('should create multiple prompt cards', async () => {
      // Arrange
      const batchCards = [
        {
          title: 'Batch Card 1',
          prompt: 'Test prompt 1',
          category: 'General',
        },
        {
          title: 'Batch Card 2',
          prompt: 'Test prompt 2',
          category: 'Specific',
        },
      ];

      // Act
      const response = await request(app)
        .post('/api/prompt-cards/batch')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ cards: batchCards })
        .expect(201);

      // Assert
      expect(response.body.created).toBe(2);
      expect(response.body.cards).toHaveLength(2);
      expect(response.body.cards[0]).toMatchObject({
        title: 'Batch Card 1',
        category: 'General',
      });
    });

    it('should handle partial failures in batch creation', async () => {
      // Arrange
      const batchCards = [
        {
          title: 'Valid Card',
          prompt: 'Valid prompt',
          category: 'General',
        },
        {
          // Missing required fields
          description: 'Invalid card',
        },
      ];

      // Act
      const response = await request(app)
        .post('/api/prompt-cards/batch')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ cards: batchCards })
        .expect(207); // Multi-status

      // Assert
      expect(response.body.created).toBe(1);
      expect(response.body.failed).toBe(1);
      expect(response.body.errors).toHaveLength(1);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      // Act - Make rapid requests
      const promises = Array(20).fill(null).map(() =>
        request(app)
          .get('/api/prompt-cards')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(promises);

      // Assert
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      // This test would require mocking database failures
      // Implementation depends on specific database mocking strategy
    });

    it('should handle malformed JSON requests', async () => {
      // Act & Assert
      await request(app)
        .post('/api/prompt-cards')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);
    });

    it('should handle large payload requests', async () => {
      // Arrange
      const largeCard = {
        title: 'A'.repeat(10000), // Very long title
        prompt: 'Test prompt',
      };

      // Act & Assert
      await request(app)
        .post('/api/prompt-cards')
        .set('Authorization', `Bearer ${authToken}`)
        .send(largeCard)
        .expect(413); // Payload too large
    });
  });
});