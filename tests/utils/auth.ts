/**
 * Auth Test Utilities
 * @description Helper functions for authentication testing
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

export interface TestUser {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
}

export interface AuthTokenPayload {
  id: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

const TEST_JWT_SECRET = 'test-secret-key-for-testing-only';
const TEST_TOKEN_EXPIRY = '24h';

/**
 * Create a test user with hashed password
 */
export async function createTestUser(userData: Partial<TestUser> = {}): Promise<TestUser> {
  const defaultUser: TestUser = {
    id: randomUUID(),
    email: 'test@example.com',
    password: 'TestPass123!',
    firstName: 'Test',
    lastName: 'User',
    role: 'user',
    isActive: true,
  };

  const user = { ...defaultUser, ...userData };

  // Hash password
  const hashedPassword = await bcrypt.hash(user.password, 12);

  return {
    ...user,
    password: hashedPassword,
  };
}

/**
 * Generate JWT token for test user
 */
export function generateAuthToken(user: Partial<TestUser>): string {
  const payload: AuthTokenPayload = {
    id: user.id || randomUUID(),
    email: user.email || 'test@example.com',
    role: user.role || 'user',
  };

  return jwt.sign(payload, TEST_JWT_SECRET, {
    expiresIn: TEST_TOKEN_EXPIRY,
    issuer: 'prompt-card-system-test',
  });
}

/**
 * Verify and decode test JWT token
 */
export function verifyAuthToken(token: string): AuthTokenPayload {
  try {
    return jwt.verify(token, TEST_JWT_SECRET) as AuthTokenPayload;
  } catch (error) {
    throw new Error('Invalid test token');
  }
}

/**
 * Generate expired token for testing
 */
export function generateExpiredToken(user: Partial<TestUser>): string {
  const payload: AuthTokenPayload = {
    id: user.id || randomUUID(),
    email: user.email || 'test@example.com',
    role: user.role || 'user',
  };

  return jwt.sign(payload, TEST_JWT_SECRET, {
    expiresIn: '-1h', // Expired 1 hour ago
    issuer: 'prompt-card-system-test',
  });
}

/**
 * Generate token with invalid signature
 */
export function generateInvalidToken(user: Partial<TestUser>): string {
  const payload: AuthTokenPayload = {
    id: user.id || randomUUID(),
    email: user.email || 'test@example.com',
    role: user.role || 'user',
  };

  return jwt.sign(payload, 'wrong-secret-key', {
    expiresIn: TEST_TOKEN_EXPIRY,
    issuer: 'prompt-card-system-test',
  });
}

/**
 * Create admin user for testing
 */
export async function createAdminUser(userData: Partial<TestUser> = {}): Promise<TestUser> {
  return createTestUser({
    role: 'admin',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    ...userData,
  });
}

/**
 * Create multiple test users with different roles
 */
export async function createTestUsers(count: number = 3): Promise<TestUser[]> {
  const users: TestUser[] = [];
  const roles = ['user', 'admin', 'moderator'];

  for (let i = 0; i < count; i++) {
    const user = await createTestUser({
      email: `testuser${i + 1}@example.com`,
      firstName: `Test${i + 1}`,
      lastName: 'User',
      role: roles[i % roles.length],
    });
    users.push(user);
  }

  return users;
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate test session data
 */
export function generateTestSession(user: TestUser): any {
  return {
    id: randomUUID(),
    userId: user.id,
    token: generateAuthToken(user),
    isActive: true,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    createdAt: new Date(),
    updatedAt: new Date(),
    ipAddress: '127.0.0.1',
    userAgent: 'Test-Agent/1.0',
  };
}

/**
 * Mock authentication middleware
 */
export function mockAuthMiddleware(user?: TestUser) {
  return (req: any, res: any, next: any) => {
    if (user) {
      req.user = user;
      req.token = generateAuthToken(user);
    }
    next();
  };
}

/**
 * Create authorization header for requests
 */
export function createAuthHeader(token?: string): { Authorization: string } {
  const authToken = token || generateAuthToken({ id: 'test-user', email: 'test@example.com' });
  return {
    Authorization: `Bearer ${authToken}`,
  };
}

/**
 * Test permission scenarios
 */
export const TEST_PERMISSION_SCENARIOS = {
  ANONYMOUS: {
    user: null,
    token: null,
    expectedStatus: 401,
  },
  USER: {
    user: { role: 'user' },
    expectedStatus: 200,
  },
  ADMIN: {
    user: { role: 'admin' },
    expectedStatus: 200,
  },
  EXPIRED_TOKEN: {
    token: 'expired',
    expectedStatus: 401,
  },
  INVALID_TOKEN: {
    token: 'invalid',
    expectedStatus: 401,
  },
};

/**
 * Test rate limiting scenarios
 */
export function simulateRateLimitScenario(requests: number = 10): Promise<Response>[] {
  const promises: Promise<Response>[] = [];

  for (let i = 0; i < requests; i++) {
    const promise = fetch('http://localhost:8000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'wrongpassword',
      }),
    });
    promises.push(promise);
  }

  return promises;
}

/**
 * Generate test CSRF token
 */
export function generateCSRFToken(): string {
  return randomUUID();
}

/**
 * Mock OAuth provider response
 */
export function mockOAuthResponse(provider: string = 'google'): any {
  return {
    id: `oauth-${randomUUID()}`,
    email: 'oauth@example.com',
    name: 'OAuth User',
    picture: 'https://example.com/avatar.jpg',
    provider,
    verified_email: true,
  };
}

/**
 * Test security headers
 */
export function validateSecurityHeaders(response: Response): boolean {
  const requiredHeaders = [
    'x-content-type-options',
    'x-frame-options',
    'x-xss-protection',
    'strict-transport-security',
  ];

  return requiredHeaders.every(header => response.headers.has(header));
}

/**
 * Generate test API key
 */
export function generateTestAPIKey(prefix: string = 'test'): string {
  const random = Buffer.from(randomUUID().replace(/-/g, ''), 'hex').toString('base64');
  return `${prefix}_${random}`;
}

/**
 * Mock password reset token
 */
export function generatePasswordResetToken(email: string): string {
  const payload = {
    email,
    purpose: 'password-reset',
    exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour
  };

  return jwt.sign(payload, TEST_JWT_SECRET);
}

/**
 * Verify password reset token
 */
export function verifyPasswordResetToken(token: string): { email: string; purpose: string } {
  try {
    const decoded = jwt.verify(token, TEST_JWT_SECRET) as any;
    if (decoded.purpose !== 'password-reset') {
      throw new Error('Invalid token purpose');
    }
    return decoded;
  } catch (error) {
    throw new Error('Invalid password reset token');
  }
}

/**
 * Test data for authentication scenarios
 */
export const AUTH_TEST_DATA = {
  VALID_CREDENTIALS: {
    email: 'test@example.com',
    password: 'TestPass123!',
  },
  INVALID_EMAIL: {
    email: 'invalid@example.com',
    password: 'TestPass123!',
  },
  INVALID_PASSWORD: {
    email: 'test@example.com',
    password: 'wrongpassword',
  },
  WEAK_PASSWORD: {
    email: 'test@example.com',
    password: '123',
  },
  MALFORMED_EMAIL: {
    email: 'not-an-email',
    password: 'TestPass123!',
  },
  SQL_INJECTION: {
    email: "test@example.com'; DROP TABLE users; --",
    password: 'TestPass123!',
  },
  XSS_PAYLOAD: {
    email: '<script>alert("xss")</script>@example.com',
    password: 'TestPass123!',
  },
};

/**
 * Performance test for auth operations
 */
export async function measureAuthPerformance(
  operation: () => Promise<any>,
  iterations: number = 100
): Promise<{
  averageTime: number;
  totalTime: number;
  successCount: number;
  errorCount: number;
}> {
  const times: number[] = [];
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < iterations; i++) {
    const startTime = Date.now();
    
    try {
      await operation();
      successCount++;
    } catch (error) {
      errorCount++;
    }
    
    const endTime = Date.now();
    times.push(endTime - startTime);
  }

  const totalTime = times.reduce((sum, time) => sum + time, 0);
  const averageTime = totalTime / iterations;

  return {
    averageTime,
    totalTime,
    successCount,
    errorCount,
  };
}