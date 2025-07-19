import request from 'supertest';
import app from '../server';
import { generateTokens, hashPassword } from '../middleware/auth';
import { generateCSRFToken } from '../middleware/security';

describe('Security Features', () => {
  const testUser = {
    email: 'test@example.com',
    password: 'TestPass123!',
    role: 'user',
    permissions: ['read', 'write']
  };

  let authToken: string;
  let csrfToken: string;
  let sessionId: string;

  beforeAll(async () => {
    // Generate auth token for protected routes
    const tokens = generateTokens({
      id: '1',
      email: testUser.email,
      role: testUser.role,
      permissions: testUser.permissions
    });
    authToken = tokens.accessToken;

    // Get CSRF token
    const csrfResponse = await request(app)
      .get('/api/security/csrf-token');
    
    csrfToken = csrfResponse.body.data.csrfToken;
    sessionId = csrfResponse.body.data.sessionId;
  });

  describe('Basic Security Headers', () => {
    it('should include basic security headers', async () => {
      const response = await request(app).get('/api/health');
      
      expect(response.status).toBe(200);
      expect(response.headers).toHaveProperty('x-request-id');
    });

    it('should reject requests without valid token for protected routes', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
    });
  });

  describe('Authentication Tests', () => {
    it('should validate password strength requirements', async () => {
      const weakPasswordData = {
        email: 'newuser@example.com',
        password: '123', // Weak password
        confirmPassword: '123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(weakPasswordData);

      expect(response.status).toBe(400);
    });

    it('should hash passwords securely', async () => {
      const password = 'TestPassword123!';
      const hashedPassword = await hashPassword(password);
      
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword).toMatch(/^\$2[aby]\$\d+\$/);
    });
  });
});

describe('Security Utilities', () => {
  describe('CSRF Token Generation', () => {
    it('should generate unique tokens', () => {
      const sessionId1 = 'session1';
      const sessionId2 = 'session2';
      
      const token1 = generateCSRFToken(sessionId1);
      const token2 = generateCSRFToken(sessionId2);
      
      expect(token1).not.toBe(token2);
      expect(token1).toMatch(/^[a-f0-9]{64}$/);
      expect(token2).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});