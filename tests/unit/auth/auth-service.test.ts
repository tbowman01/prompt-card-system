/**
 * Auth Service Unit Tests
 * @description Comprehensive tests for authentication service
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Import mocked modules
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Import service after mocks
import { AuthService } from '../../../auth/src/services/auth-service';

const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockJwt = jwt as jest.Mocked<typeof jwt>;

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('User Registration', () => {
    it('should register new user successfully', async () => {
      // Arrange
      const userData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
      };

      mockBcrypt.hash.mockResolvedValueOnce('hashed-password' as never);

      // Act
      const result = await authService.registerUser(userData);

      // Assert
      expect(result).toMatchObject({
        id: expect.any(String),
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      });
      expect(result).not.toHaveProperty('password');
      expect(mockBcrypt.hash).toHaveBeenCalledWith('SecurePass123!', 12);
    });

    it('should validate email format', async () => {
      // Arrange
      const invalidEmailData = {
        email: 'invalid-email',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
      };

      // Act & Assert
      await expect(authService.registerUser(invalidEmailData)).rejects.toThrow(
        'Invalid email format'
      );
    });

    it('should validate password strength', async () => {
      // Arrange
      const weakPasswordData = {
        email: 'test@example.com',
        password: '123',
        firstName: 'John',
        lastName: 'Doe',
      };

      // Act & Assert
      await expect(authService.registerUser(weakPasswordData)).rejects.toThrow(
        'Password does not meet security requirements'
      );
    });

    it('should prevent duplicate email registration', async () => {
      // Arrange
      const userData = {
        email: 'existing@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
      };

      // Simulate existing user
      authService.findUserByEmail = jest.fn().mockResolvedValueOnce({
        id: 'existing-user',
        email: 'existing@example.com',
      });

      // Act & Assert
      await expect(authService.registerUser(userData)).rejects.toThrow(
        'Email already registered'
      );
    });

    it('should sanitize user input', async () => {
      // Arrange
      const userData = {
        email: '  TEST@EXAMPLE.COM  ',
        password: 'SecurePass123!',
        firstName: '<script>alert("xss")</script>John',
        lastName: 'Doe  ',
      };

      mockBcrypt.hash.mockResolvedValueOnce('hashed-password' as never);

      // Act
      const result = await authService.registerUser(userData);

      // Assert
      expect(result.email).toBe('test@example.com');
      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('Doe');
    });
  });

  describe('User Authentication', () => {
    it('should authenticate valid credentials', async () => {
      // Arrange
      const email = 'test@example.com';
      const password = 'SecurePass123!';

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password: 'hashed-password',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
      };

      authService.findUserByEmail = jest.fn().mockResolvedValueOnce(mockUser);
      mockBcrypt.compare.mockResolvedValueOnce(true as never);
      mockJwt.sign.mockReturnValueOnce('mock-jwt-token' as never);

      // Act
      const result = await authService.authenticateUser(email, password);

      // Assert
      expect(result).toMatchObject({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
        token: 'mock-jwt-token',
      });
      expect(mockBcrypt.compare).toHaveBeenCalledWith(password, 'hashed-password');
    });

    it('should reject invalid email', async () => {
      // Arrange
      authService.findUserByEmail = jest.fn().mockResolvedValueOnce(null);

      // Act & Assert
      await expect(
        authService.authenticateUser('nonexistent@example.com', 'password')
      ).rejects.toThrow('Invalid credentials');
    });

    it('should reject invalid password', async () => {
      // Arrange
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password: 'hashed-password',
        isActive: true,
      };

      authService.findUserByEmail = jest.fn().mockResolvedValueOnce(mockUser);
      mockBcrypt.compare.mockResolvedValueOnce(false as never);

      // Act & Assert
      await expect(
        authService.authenticateUser('test@example.com', 'wrongpassword')
      ).rejects.toThrow('Invalid credentials');
    });

    it('should reject inactive users', async () => {
      // Arrange
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password: 'hashed-password',
        isActive: false,
      };

      authService.findUserByEmail = jest.fn().mockResolvedValueOnce(mockUser);
      mockBcrypt.compare.mockResolvedValueOnce(true as never);

      // Act & Assert
      await expect(
        authService.authenticateUser('test@example.com', 'password')
      ).rejects.toThrow('Account is disabled');
    });

    it('should track failed login attempts', async () => {
      // Arrange
      authService.findUserByEmail = jest.fn().mockResolvedValueOnce(null);

      // Act & Assert
      await expect(
        authService.authenticateUser('test@example.com', 'wrongpassword')
      ).rejects.toThrow('Invalid credentials');

      expect(authService.getFailedAttempts('test@example.com')).toBe(1);
    });

    it('should lock account after max failed attempts', async () => {
      // Arrange
      const email = 'test@example.com';
      
      // Simulate max failed attempts
      for (let i = 0; i < 5; i++) {
        try {
          await authService.authenticateUser(email, 'wrongpassword');
        } catch (error) {
          // Expected to fail
        }
      }

      // Act & Assert
      await expect(
        authService.authenticateUser(email, 'wrongpassword')
      ).rejects.toThrow('Account temporarily locked');
    });
  });

  describe('Token Management', () => {
    it('should generate valid JWT token', () => {
      // Arrange
      const payload = { userId: 'user-123', email: 'test@example.com' };
      mockJwt.sign.mockReturnValueOnce('mock-jwt-token' as never);

      // Act
      const token = authService.generateToken(payload);

      // Assert
      expect(token).toBe('mock-jwt-token');
      expect(mockJwt.sign).toHaveBeenCalledWith(
        payload,
        expect.any(String),
        expect.objectContaining({
          expiresIn: '24h',
          issuer: 'prompt-card-system',
        })
      );
    });

    it('should verify valid token', () => {
      // Arrange
      const mockDecoded = { userId: 'user-123', email: 'test@example.com' };
      mockJwt.verify.mockReturnValueOnce(mockDecoded as never);

      // Act
      const result = authService.verifyToken('valid-token');

      // Assert
      expect(result).toEqual(mockDecoded);
      expect(mockJwt.verify).toHaveBeenCalledWith(
        'valid-token',
        expect.any(String)
      );
    });

    it('should reject invalid token', () => {
      // Arrange
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act & Assert
      expect(() => authService.verifyToken('invalid-token')).toThrow(
        'Invalid token'
      );
    });

    it('should refresh valid token', () => {
      // Arrange
      const mockDecoded = { userId: 'user-123', email: 'test@example.com' };
      mockJwt.verify.mockReturnValueOnce(mockDecoded as never);
      mockJwt.sign.mockReturnValueOnce('new-token' as never);

      // Act
      const newToken = authService.refreshToken('old-token');

      // Assert
      expect(newToken).toBe('new-token');
    });
  });

  describe('Password Management', () => {
    it('should validate password requirements', () => {
      // Arrange
      const validPasswords = [
        'SecurePass123!',
        'AnotherP@ssw0rd',
        'ComplexP@ssword2024',
      ];

      const invalidPasswords = [
        '123',                    // Too short
        'password',               // No uppercase, numbers, symbols
        'PASSWORD123',            // No lowercase, symbols
        'Password',               // No numbers, symbols
        'Password123',            // No symbols
      ];

      // Act & Assert
      validPasswords.forEach(password => {
        expect(() => authService.validatePassword(password)).not.toThrow();
      });

      invalidPasswords.forEach(password => {
        expect(() => authService.validatePassword(password)).toThrow();
      });
    });

    it('should change password successfully', async () => {
      // Arrange
      const userId = 'user-123';
      const oldPassword = 'OldPass123!';
      const newPassword = 'NewPass456!';

      const mockUser = {
        id: userId,
        password: 'hashed-old-password',
      };

      authService.findUserById = jest.fn().mockResolvedValueOnce(mockUser);
      mockBcrypt.compare.mockResolvedValueOnce(true as never);
      mockBcrypt.hash.mockResolvedValueOnce('hashed-new-password' as never);
      authService.updateUser = jest.fn().mockResolvedValueOnce(true);

      // Act
      const result = await authService.changePassword(userId, oldPassword, newPassword);

      // Assert
      expect(result).toBe(true);
      expect(mockBcrypt.compare).toHaveBeenCalledWith(oldPassword, 'hashed-old-password');
      expect(mockBcrypt.hash).toHaveBeenCalledWith(newPassword, 12);
    });

    it('should reject password change with wrong old password', async () => {
      // Arrange
      const userId = 'user-123';
      const mockUser = { id: userId, password: 'hashed-password' };

      authService.findUserById = jest.fn().mockResolvedValueOnce(mockUser);
      mockBcrypt.compare.mockResolvedValueOnce(false as never);

      // Act & Assert
      await expect(
        authService.changePassword(userId, 'wrongoldpass', 'NewPass123!')
      ).rejects.toThrow('Current password is incorrect');
    });
  });

  describe('Role-Based Access Control', () => {
    it('should assign roles to users', async () => {
      // Arrange
      const userId = 'user-123';
      const roles = ['user', 'admin'];

      authService.updateUserRoles = jest.fn().mockResolvedValueOnce(true);

      // Act
      const result = await authService.assignRoles(userId, roles);

      // Assert
      expect(result).toBe(true);
      expect(authService.updateUserRoles).toHaveBeenCalledWith(userId, roles);
    });

    it('should check user permissions', async () => {
      // Arrange
      const userId = 'user-123';
      const mockUser = {
        id: userId,
        roles: ['user', 'admin'],
      };

      authService.findUserById = jest.fn().mockResolvedValueOnce(mockUser);

      // Act
      const hasAdminAccess = await authService.hasPermission(userId, 'admin');
      const hasUserAccess = await authService.hasPermission(userId, 'user');
      const hasSuperAccess = await authService.hasPermission(userId, 'super');

      // Assert
      expect(hasAdminAccess).toBe(true);
      expect(hasUserAccess).toBe(true);
      expect(hasSuperAccess).toBe(false);
    });
  });

  describe('Session Management', () => {
    it('should create user session', async () => {
      // Arrange
      const userId = 'user-123';
      const sessionData = {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0...',
      };

      authService.createSession = jest.fn().mockResolvedValueOnce('session-123');

      // Act
      const sessionId = await authService.createSession(userId, sessionData);

      // Assert
      expect(sessionId).toBe('session-123');
    });

    it('should validate active session', async () => {
      // Arrange
      const sessionId = 'session-123';
      const mockSession = {
        id: sessionId,
        userId: 'user-123',
        isActive: true,
        expiresAt: new Date(Date.now() + 86400000), // 24 hours
      };

      authService.findSession = jest.fn().mockResolvedValueOnce(mockSession);

      // Act
      const isValid = await authService.validateSession(sessionId);

      // Assert
      expect(isValid).toBe(true);
    });

    it('should invalidate expired session', async () => {
      // Arrange
      const sessionId = 'session-123';
      const mockSession = {
        id: sessionId,
        userId: 'user-123',
        isActive: true,
        expiresAt: new Date(Date.now() - 1000), // Expired
      };

      authService.findSession = jest.fn().mockResolvedValueOnce(mockSession);

      // Act
      const isValid = await authService.validateSession(sessionId);

      // Assert
      expect(isValid).toBe(false);
    });

    it('should logout and invalidate session', async () => {
      // Arrange
      const sessionId = 'session-123';
      authService.invalidateSession = jest.fn().mockResolvedValueOnce(true);

      // Act
      const result = await authService.logout(sessionId);

      // Assert
      expect(result).toBe(true);
      expect(authService.invalidateSession).toHaveBeenCalledWith(sessionId);
    });
  });

  describe('Security Features', () => {
    it('should detect suspicious login patterns', async () => {
      // Arrange
      const email = 'test@example.com';
      const differentIPs = ['1.1.1.1', '2.2.2.2', '3.3.3.3'];

      // Simulate rapid logins from different IPs
      for (const ip of differentIPs) {
        try {
          await authService.authenticateUser(email, 'password', { ipAddress: ip });
        } catch (error) {
          // Expected to fail
        }
      }

      // Act
      const isSuspicious = authService.isSuspiciousActivity(email);

      // Assert
      expect(isSuspicious).toBe(true);
    });

    it('should enforce rate limiting', async () => {
      // Arrange
      const email = 'test@example.com';

      // Simulate rapid attempts
      for (let i = 0; i < 10; i++) {
        try {
          await authService.authenticateUser(email, 'wrongpassword');
        } catch (error) {
          // Expected to fail
        }
      }

      // Act & Assert
      await expect(
        authService.authenticateUser(email, 'wrongpassword')
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('should log security events', async () => {
      // Arrange
      const securityLogger = jest.fn();
      authService.setSecurityLogger(securityLogger);

      // Act
      try {
        await authService.authenticateUser('test@example.com', 'wrongpassword');
      } catch (error) {
        // Expected to fail
      }

      // Assert
      expect(securityLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'failed_login',
          email: 'test@example.com',
          timestamp: expect.any(Date),
        })
      );
    });
  });
});