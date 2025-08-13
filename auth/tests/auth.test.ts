import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';

describe('Authentication Service - Core JWT/API Key Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('JWT Authentication', () => {
    test('should register new user with secure password hashing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          username: 'testuser',
          email: 'test@example.com',
          password: 'SecurePass123!',
          role: 'user'
        }
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('userId');
      expect(body).toHaveProperty('message', 'User registered successfully');
      expect(body).not.toHaveProperty('password');
    });

    test('should fail registration with weak password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          username: 'weakuser',
          email: 'weak@example.com',
          password: '123',
          role: 'user'
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('password requirements');
    });

    test('should authenticate user and return JWT token', async () => {
      // First register a user
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          username: 'logintest',
          email: 'login@example.com',
          password: 'SecurePass123!',
          role: 'user'
        }
      });

      // Then login
      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          username: 'logintest',
          password: 'SecurePass123!'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('accessToken');
      expect(body).toHaveProperty('refreshToken');
      expect(body.accessToken).toMatch(/^[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+\.?[A-Za-z0-9\-_.+/=]*$/);
    });

    test('should fail authentication with wrong credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          username: 'logintest',
          password: 'WrongPassword123!'
        }
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Invalid credentials');
    });

    test('should validate JWT token and return user info', async () => {
      // Login to get token
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          username: 'logintest',
          password: 'SecurePass123!'
        }
      });

      const { accessToken } = JSON.parse(loginResponse.body);

      // Use token to access protected endpoint
      const response = await app.inject({
        method: 'GET',
        url: '/auth/verify',
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('userId');
      expect(body).toHaveProperty('username', 'logintest');
      expect(body).toHaveProperty('role', 'user');
    });

    test('should reject invalid JWT token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/verify',
        headers: {
          authorization: 'Bearer invalid.token.here'
        }
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Invalid token');
    });

    test('should refresh JWT token with valid refresh token', async () => {
      // Login to get tokens
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          username: 'logintest',
          password: 'SecurePass123!'
        }
      });

      const { refreshToken } = JSON.parse(loginResponse.body);

      // Refresh token
      const response = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refreshToken }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('accessToken');
      expect(body).toHaveProperty('refreshToken');
    });
  });

  describe('API Key Authentication', () => {
    test('should create API key for authenticated user', async () => {
      // Login to get token
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          username: 'logintest',
          password: 'SecurePass123!'
        }
      });

      const { accessToken } = JSON.parse(loginResponse.body);

      // Create API key
      const response = await app.inject({
        method: 'POST',
        url: '/auth/api-keys',
        headers: {
          authorization: `Bearer ${accessToken}`
        },
        payload: {
          name: 'Test API Key',
          permissions: ['user.read', 'user.write']
        }
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('apiKey');
      expect(body).toHaveProperty('keyId');
      expect(body.apiKey).toMatch(/^vllm_[A-Za-z0-9_-]{32,}$/);
    });

    test('should authenticate with valid API key', async () => {
      // Get API key first (from previous test setup)
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { username: 'logintest', password: 'SecurePass123!' }
      });

      const { accessToken } = JSON.parse(loginResponse.body);

      const keyResponse = await app.inject({
        method: 'POST',
        url: '/auth/api-keys',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { name: 'Auth Test Key', permissions: ['user.read'] }
      });

      const { apiKey } = JSON.parse(keyResponse.body);

      // Use API key for authentication
      const response = await app.inject({
        method: 'GET',
        url: '/auth/verify',
        headers: {
          'X-API-Key': apiKey
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('userId');
      expect(body).toHaveProperty('authMethod', 'apiKey');
    });

    test('should reject invalid API key', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/verify',
        headers: {
          'X-API-Key': 'vllm_invalid_key_12345'
        }
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Invalid API key');
    });

    test('should revoke API key', async () => {
      // Get token and create API key
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { username: 'logintest', password: 'SecurePass123!' }
      });

      const { accessToken } = JSON.parse(loginResponse.body);

      const keyResponse = await app.inject({
        method: 'POST',
        url: '/auth/api-keys',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { name: 'Revoke Test Key', permissions: ['user.read'] }
      });

      const { keyId } = JSON.parse(keyResponse.body);

      // Revoke the key
      const revokeResponse = await app.inject({
        method: 'DELETE',
        url: `/auth/api-keys/${keyId}`,
        headers: { authorization: `Bearer ${accessToken}` }
      });

      expect(revokeResponse.statusCode).toBe(200);
    });
  });

  describe('Rate Limiting', () => {
    test('should apply rate limiting to login attempts', async () => {
      const requests = [];
      
      // Make multiple rapid login attempts
      for (let i = 0; i < 6; i++) {
        requests.push(
          app.inject({
            method: 'POST',
            url: '/auth/login',
            payload: {
              username: 'rateLimitTest',
              password: 'WrongPassword123!'
            }
          })
        );
      }

      const responses = await Promise.all(requests);
      
      // First 5 should get 401 (unauthorized), 6th should get 429 (rate limited)
      const lastResponse = responses[responses.length - 1];
      expect(lastResponse.statusCode).toBe(429);
      
      const body = JSON.parse(lastResponse.body);
      expect(body.error).toContain('Rate limit exceeded');
    });
  });

  describe('Security Headers', () => {
    test('should include security headers in all responses', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/health'
      });

      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
      expect(response.headers).toHaveProperty('x-xss-protection', '1; mode=block');
    });
  });
});