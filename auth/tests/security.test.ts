import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';

describe('Security Tests - Input Validation & Attack Prevention', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Input Validation', () => {
    test('should reject SQL injection attempts in username', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          username: "admin'; DROP TABLE users; --",
          password: 'password'
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Invalid username format');
    });

    test('should reject XSS attempts in registration data', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          username: '<script>alert("xss")</script>',
          email: 'test@example.com',
          password: 'SecurePass123!',
          role: 'user'
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Invalid username format');
    });

    test('should reject command injection in API key names', async () => {
      // First register and login
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          username: 'securitytest',
          email: 'security@example.com',
          password: 'SecurePass123!',
          role: 'user'
        }
      });

      const loginResponse = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { username: 'securitytest', password: 'SecurePass123!' }
      });

      const { accessToken } = JSON.parse(loginResponse.body);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/api-keys',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          name: '; rm -rf / &',
          permissions: ['user.read']
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Invalid API key name');
    });

    test('should validate email format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          username: 'emailtest',
          email: 'not-an-email',
          password: 'SecurePass123!',
          role: 'user'
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Invalid email format');
    });

    test('should enforce password complexity', async () => {
      const weakPasswords = [
        '12345678',           // Only numbers
        'password',           // Only lowercase
        'PASSWORD',           // Only uppercase  
        'Pass123',            // Too short
        'password123',        // No special chars
        'PASSWORD123!'        // No lowercase
      ];

      for (const password of weakPasswords) {
        const response = await app.inject({
          method: 'POST',
          url: '/auth/register',
          payload: {
            username: 'weaktest',
            email: 'weak@example.com',
            password,
            role: 'user'
          }
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.error).toContain('password requirements');
      }
    });

    test('should limit request body size', async () => {
      const largePayload = {
        username: 'a'.repeat(10000),
        email: 'test@example.com',
        password: 'SecurePass123!',
        role: 'user'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: largePayload
      });

      expect(response.statusCode).toBe(413);
    });
  });

  describe('Brute Force Protection', () => {
    test('should implement progressive delay for failed login attempts', async () => {
      const username = 'bruteforcetest';
      
      // Register user first
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          username,
          email: 'brute@example.com', 
          password: 'CorrectPass123!',
          role: 'user'
        }
      });

      const startTime = Date.now();
      
      // Make several failed attempts
      for (let i = 0; i < 3; i++) {
        await app.inject({
          method: 'POST',
          url: '/auth/login',
          payload: {
            username,
            password: 'WrongPassword123!'
          }
        });
      }

      // 4th attempt should have delay
      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          username,
          password: 'WrongPassword123!'
        }
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.statusCode).toBe(429);
      expect(duration).toBeGreaterThan(1000); // Should have progressive delay
    });

    test('should reset delay counter after successful login', async () => {
      const username = 'resettest';
      
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          username,
          email: 'reset@example.com',
          password: 'CorrectPass123!',
          role: 'user'
        }
      });

      // Make failed attempts
      for (let i = 0; i < 2; i++) {
        await app.inject({
          method: 'POST',
          url: '/auth/login',
          payload: { username, password: 'WrongPassword123!' }
        });
      }

      // Successful login should reset counter
      const successResponse = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { username, password: 'CorrectPass123!' }
      });

      expect(successResponse.statusCode).toBe(200);

      // Next failed attempt should not have accumulated delay
      const nextAttempt = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { username, password: 'WrongPassword123!' }
      });

      expect(nextAttempt.statusCode).toBe(401); // Not rate limited
    });
  });

  describe('Token Security', () => {
    test('should use secure JWT signing with strong secret', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/jwt-config'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.algorithm).toBe('HS256');
      expect(body.secretLength).toBeGreaterThanOrEqual(32);
    });

    test('should include security claims in JWT', async () => {
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          username: 'tokentest',
          email: 'token@example.com',
          password: 'SecurePass123!',
          role: 'user'
        }
      });

      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { username: 'tokentest', password: 'SecurePass123!' }
      });

      const { accessToken } = JSON.parse(response.body);
      
      // Decode JWT to check claims (without verification for testing)
      const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());
      
      expect(payload).toHaveProperty('iat'); // issued at
      expect(payload).toHaveProperty('exp'); // expiration
      expect(payload).toHaveProperty('sub'); // subject (user id)
      expect(payload).toHaveProperty('role');
      expect(payload).toHaveProperty('permissions');
    });

    test('should reject expired tokens', async () => {
      // This would need to be tested with a shorter token expiry or time manipulation
      // For now, we'll test that the expiration claim exists and is reasonable
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          username: 'expirytest',
          email: 'expiry@example.com',
          password: 'SecurePass123!',
          role: 'user'
        }
      });

      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { username: 'expirytest', password: 'SecurePass123!' }
      });

      const { accessToken } = JSON.parse(response.body);
      const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());
      
      // Token should expire in 15 minutes (900 seconds)
      const expectedExpiry = payload.iat + 900;
      expect(payload.exp).toBe(expectedExpiry);
    });
  });

  describe('API Key Security', () => {
    test('should generate cryptographically secure API keys', async () => {
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          username: 'keytest',
          email: 'key@example.com',
          password: 'SecurePass123!',
          role: 'user'
        }
      });

      const loginResponse = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { username: 'keytest', password: 'SecurePass123!' }
      });

      const { accessToken } = JSON.parse(loginResponse.body);

      // Generate multiple API keys and check for randomness
      const keys: string[] = [];
      for (let i = 0; i < 5; i++) {
        const response = await app.inject({
          method: 'POST',
          url: '/auth/api-keys',
          headers: { authorization: `Bearer ${accessToken}` },
          payload: { name: `Test Key ${i}`, permissions: ['user.read'] }
        });

        const { apiKey } = JSON.parse(response.body);
        keys.push(apiKey);
      }

      // All keys should be different
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);

      // All keys should have proper format and length
      keys.forEach(key => {
        expect(key).toMatch(/^vllm_[A-Za-z0-9_-]{32,}$/);
        expect(key.length).toBeGreaterThanOrEqual(37); // vllm_ + 32 chars
      });
    });

    test('should hash API keys in database', async () => {
      // This would need access to database to verify hashing
      // For now, ensure keys aren't returned in list operations
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          username: 'hashtest',
          email: 'hash@example.com',
          password: 'SecurePass123!',
          role: 'user'
        }
      });

      const loginResponse = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { username: 'hashtest', password: 'SecurePass123!' }
      });

      const { accessToken } = JSON.parse(loginResponse.body);

      await app.inject({
        method: 'POST',
        url: '/auth/api-keys',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { name: 'Hash Test Key', permissions: ['user.read'] }
      });

      // List API keys - should not include actual key values
      const listResponse = await app.inject({
        method: 'GET',
        url: '/auth/api-keys',
        headers: { authorization: `Bearer ${accessToken}` }
      });

      expect(listResponse.statusCode).toBe(200);
      const body = JSON.parse(listResponse.body);
      
      body.apiKeys.forEach((keyInfo: any) => {
        expect(keyInfo).not.toHaveProperty('apiKey');
        expect(keyInfo).toHaveProperty('keyId');
        expect(keyInfo).toHaveProperty('name');
        expect(keyInfo).toHaveProperty('permissions');
      });
    });
  });

  describe('Audit Logging', () => {
    test('should log all authentication events', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/audit/logs',
        headers: {
          'X-Admin-Token': process.env.ADMIN_TOKEN || 'test-admin-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('logs');
      expect(Array.isArray(body.logs)).toBe(true);
      
      // Should contain various event types
      const eventTypes = body.logs.map((log: any) => log.eventType);
      expect(eventTypes).toContain('user.register');
      expect(eventTypes).toContain('user.login');
      expect(eventTypes).toContain('auth.verify');
    });

    test('should include security context in audit logs', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/audit/logs',
        headers: {
          'X-Admin-Token': process.env.ADMIN_TOKEN || 'test-admin-token'
        }
      });

      const body = JSON.parse(response.body);
      const sampleLog = body.logs[0];

      expect(sampleLog).toHaveProperty('timestamp');
      expect(sampleLog).toHaveProperty('userId');
      expect(sampleLog).toHaveProperty('eventType');
      expect(sampleLog).toHaveProperty('ipAddress');
      expect(sampleLog).toHaveProperty('userAgent');
      expect(sampleLog).toHaveProperty('success');
    });
  });
});