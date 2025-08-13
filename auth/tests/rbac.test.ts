import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';

describe('RBAC Permission System Tests', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let userToken: string;
  let mlEngineerToken: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    // Create test users with different roles
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        username: 'admin',
        email: 'admin@example.com',
        password: 'AdminPass123!',
        role: 'admin'
      }
    });

    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        username: 'regularuser',
        email: 'user@example.com',
        password: 'UserPass123!',
        role: 'user'
      }
    });

    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        username: 'mlengineer',
        email: 'ml@example.com',
        password: 'MLPass123!',
        role: 'ml-engineer'
      }
    });

    // Get tokens
    const adminLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'admin', password: 'AdminPass123!' }
    });
    adminToken = JSON.parse(adminLogin.body).accessToken;

    const userLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'regularuser', password: 'UserPass123!' }
    });
    userToken = JSON.parse(userLogin.body).accessToken;

    const mlLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'mlengineer', password: 'MLPass123!' }
    });
    mlEngineerToken = JSON.parse(mlLogin.body).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Admin Role Permissions', () => {
    test('admin should have access to all endpoints (*)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/users',
        headers: { authorization: `Bearer ${adminToken}` }
      });

      expect(response.statusCode).toBe(200);
    });

    test('admin should be able to manage user roles', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/auth/users/regularuser/role',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { role: 'developer' }
      });

      expect(response.statusCode).toBe(200);
    });

    test('admin should be able to revoke any user API keys', async () => {
      // First create an API key as regular user
      const keyResponse = await app.inject({
        method: 'POST',
        url: '/auth/api-keys',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'User Test Key', permissions: ['user.read'] }
      });

      const { keyId } = JSON.parse(keyResponse.body);

      // Admin should be able to revoke it
      const revokeResponse = await app.inject({
        method: 'DELETE',
        url: `/auth/api-keys/${keyId}`,
        headers: { authorization: `Bearer ${adminToken}` }
      });

      expect(revokeResponse.statusCode).toBe(200);
    });
  });

  describe('ML Engineer Role Permissions', () => {
    test('ml-engineer should access model endpoints', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/permissions/check',
        headers: { authorization: `Bearer ${mlEngineerToken}` },
        payload: { permission: 'models.read' }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.hasPermission).toBe(true);
    });

    test('ml-engineer should access inference endpoints', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/permissions/check',
        headers: { authorization: `Bearer ${mlEngineerToken}` },
        payload: { permission: 'inference.create' }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.hasPermission).toBe(true);
    });

    test('ml-engineer should NOT access admin endpoints', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/users',
        headers: { authorization: `Bearer ${mlEngineerToken}` }
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Insufficient permissions');
    });

    test('ml-engineer should NOT manage user roles', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/auth/users/regularuser/role',
        headers: { authorization: `Bearer ${mlEngineerToken}` },
        payload: { role: 'admin' }
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('User Role Permissions', () => {
    test('user should access own tasks', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/permissions/check',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { permission: 'tasks.read' }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.hasPermission).toBe(true);
    });

    test('user should create tasks', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/permissions/check',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { permission: 'tasks.create' }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.hasPermission).toBe(true);
    });

    test('user should NOT access model management', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/permissions/check',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { permission: 'models.write' }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.hasPermission).toBe(false);
    });

    test('user should NOT access other users data', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/users',
        headers: { authorization: `Bearer ${userToken}` }
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Permission Hierarchy', () => {
    test('should validate permission patterns with wildcards', async () => {
      // Admin has "*" permission - should match anything
      const response = await app.inject({
        method: 'GET',
        url: '/auth/permissions/check',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { permission: 'any.random.permission' }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.hasPermission).toBe(true);
    });

    test('should validate permission patterns with partial wildcards', async () => {
      // ML engineer has "models.*" - should match all model permissions
      const response = await app.inject({
        method: 'GET',
        url: '/auth/permissions/check',
        headers: { authorization: `Bearer ${mlEngineerToken}` },
        payload: { permission: 'models.create' }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.hasPermission).toBe(true);
    });

    test('should reject permissions outside scope', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/permissions/check',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { permission: 'admin.users.delete' }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.hasPermission).toBe(false);
    });
  });

  describe('Resource-Based Permissions', () => {
    test('user should only access own memory resources', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/permissions/check',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { 
          permission: 'memory.read:own',
          resource: { userId: 'regularuser' }
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.hasPermission).toBe(true);
    });

    test('user should NOT access other users memory', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/permissions/check',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { 
          permission: 'memory.read:own',
          resource: { userId: 'admin' }
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.hasPermission).toBe(false);
    });
  });
});