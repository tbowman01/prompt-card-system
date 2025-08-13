import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// User role and permission types
export type UserRole = 'admin' | 'moderator' | 'user' | 'readonly';
export type Permission = 'read' | 'write' | 'delete' | 'admin' | 'moderate' | 'manage_users' | 'view_analytics';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  permissions: Permission[];
  mfaEnabled: boolean;
  mfaSecret?: string;
  accountLocked: boolean;
  failedLoginAttempts: number;
  lockoutUntil?: Date;
  sessionIds: string[];
  passwordHistory?: string[];
  emailVerified: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  refreshToken: string;
  fingerprint: string;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
  expiresAt: Date;
  createdAt: Date;
  lastActivity: Date;
}

export interface AuthConfig {
  jwtSecret: string;
  refreshSecret: string;
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
  sessionTimeout: number;
  maxLoginAttempts: number;
  lockoutDuration: number;
  passwordMinLength: number;
  passwordHistoryCount: number;
  requireEmailVerification: boolean;
  enableMFA: boolean;
}

// Default configuration with environment variable support
export const defaultAuthConfig: AuthConfig = {
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  refreshSecret: process.env.REFRESH_SECRET || 'your-refresh-secret-key-change-in-production',
  accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || '15m',
  refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d',
  sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '3600000'), // 1 hour in ms
  maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5'),
  lockoutDuration: parseInt(process.env.LOCKOUT_DURATION || '900000'), // 15 minutes in ms
  passwordMinLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '12'),
  passwordHistoryCount: parseInt(process.env.PASSWORD_HISTORY_COUNT || '5'),
  requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === 'true',
  enableMFA: process.env.ENABLE_MFA === 'true'
};

// In-memory storage (replace with database in production)
const users = new Map<string, User>();
const sessions = new Map<string, Session>();
const blacklistedTokens = new Set<string>();
const emailVerificationTokens = new Map<string, { email: string; expires: Date }>();
const passwordResetTokens = new Map<string, { userId: string; expires: Date }>();

// Role-based permissions
const rolePermissions: Record<UserRole, Permission[]> = {
  admin: ['read', 'write', 'delete', 'admin', 'moderate', 'manage_users', 'view_analytics'],
  moderator: ['read', 'write', 'delete', 'moderate', 'view_analytics'],
  user: ['read', 'write'],
  readonly: ['read']
};

// Enhanced authentication middleware
export const enhancedAuth = (requiredPermissions: Permission[] = []) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: 'Access token required',
          code: 'TOKEN_REQUIRED'
        });
      }
      
      const token = authHeader.substring(7);
      
      // Check if token is blacklisted
      if (blacklistedTokens.has(token)) {
        return res.status(401).json({
          success: false,
          error: 'Token has been revoked',
          code: 'TOKEN_REVOKED'
        });
      }
      
      // Verify and decode token
      const decoded = jwt.verify(token, defaultAuthConfig.jwtSecret) as any;
      const sessionId = decoded.sessionId;
      
      // Check session validity
      const session = sessions.get(sessionId);
      if (!session || !session.isActive || session.expiresAt < new Date()) {
        return res.status(401).json({
          success: false,
          error: 'Session expired or invalid',
          code: 'SESSION_INVALID'
        });
      }
      
      // Verify user exists and is not locked
      const user = users.get(decoded.userId);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }
      
      if (user.accountLocked && user.lockoutUntil && user.lockoutUntil > new Date()) {
        return res.status(423).json({
          success: false,
          error: 'Account is temporarily locked',
          code: 'ACCOUNT_LOCKED',
          lockoutUntil: user.lockoutUntil
        });
      }
      
      // Check permissions
      if (requiredPermissions.length > 0) {
        const userPermissions = rolePermissions[user.role] || [];
        const hasPermission = requiredPermissions.some(perm => 
          userPermissions.includes(perm)
        );
        
        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            error: 'Insufficient permissions',
            code: 'INSUFFICIENT_PERMISSIONS',
            required: requiredPermissions,
            userPermissions
          });
        }
      }
      
      // Update session activity
      session.lastActivity = new Date();
      sessions.set(sessionId, session);
      
      // Add user context to request
      (req as any).user = {
        id: user.id,
        email: user.email,
        role: user.role,
        permissions: rolePermissions[user.role],
        sessionId: session.id
      };
      
      next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({
          success: false,
          error: 'Invalid token',
          code: 'TOKEN_INVALID'
        });
      }
      
      console.error('Authentication error:', error);
      return res.status(500).json({
        success: false,
        error: 'Authentication failed',
        code: 'AUTH_ERROR'
      });
    }
  };
};

// Export utility functions
export {
  users,
  sessions,
  blacklistedTokens,
  rolePermissions,
  defaultAuthConfig
};