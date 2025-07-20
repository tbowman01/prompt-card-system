import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { logSecurityEvent } from './structuredLogging';
import { randomBytes } from 'crypto';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        permissions: string[];
      };
    }
  }
}

export interface JWTPayload {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  sessionId?: string;
  fingerprint?: string;
  ipAddress?: string;
  iat?: number;
  exp?: number;
  jti?: string; // JWT ID for tracking
}

// JWT Secret keys
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '15m';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

// In-memory blacklist for revoked tokens (use Redis in production)
const blacklistedTokens = new Set<string>();

// Active sessions tracking for enhanced security
const activeSessions = new Map<string, {
  userId: string;
  sessionId: string;
  fingerprint: string;
  ipAddress: string;
  lastActivity: Date;
  userAgent: string;
}>();

// Token generation utilities with enhanced security
export const generateTokens = (payload: Omit<JWTPayload, 'iat' | 'exp' | 'jti'>, req?: Request) => {
  const jti = randomBytes(16).toString('hex'); // Unique token ID
  const sessionId = randomBytes(16).toString('hex');
  const fingerprint = req ? generateFingerprint(req) : '';
  const ipAddress = req?.ip || '';

  const enhancedPayload = {
    ...payload,
    sessionId,
    fingerprint,
    ipAddress,
    jti
  };

  const accessToken = jwt.sign(enhancedPayload as any, JWT_SECRET as string, { 
    expiresIn: JWT_EXPIRY as any,
    jwtid: jti
  } as any);
  
  const refreshToken = jwt.sign(enhancedPayload as any, JWT_REFRESH_SECRET as string, { 
    expiresIn: JWT_REFRESH_EXPIRY as any,
    jwtid: `${jti}_refresh`
  } as any);

  // Track active session
  if (req) {
    activeSessions.set(sessionId, {
      userId: payload.id,
      sessionId,
      fingerprint,
      ipAddress,
      lastActivity: new Date(),
      userAgent: req.headers['user-agent'] || 'unknown'
    });
  }
  
  return { accessToken, refreshToken, sessionId };
};

// Generate browser fingerprint for additional security
function generateFingerprint(req: Request): string {
  const components = [
    req.headers['user-agent'] || '',
    req.headers['accept-language'] || '',
    req.headers['accept-encoding'] || '',
    req.headers['accept'] || ''
  ];
  
  return Buffer.from(components.join('|')).toString('base64').substring(0, 16);
}

// Password hashing utilities
export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
};

export const verifyPassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

// Enhanced JWT verification middleware with security checks
export const verifyToken = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logSecurityEvent('auth_failure', req, { reason: 'No token provided' });
      res.status(401).json({
        success: false,
        error: 'Access denied. No token provided or invalid format.',
        code: 'NO_TOKEN'
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Check if token is blacklisted
    if (blacklistedTokens.has(token)) {
      logSecurityEvent('auth_failure', req, { reason: 'Token revoked' });
      res.status(401).json({
        success: false,
        error: 'Token has been revoked.',
        code: 'TOKEN_REVOKED'
      });
      return;
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    
    // Enhanced security checks
    const currentFingerprint = generateFingerprint(req);
    const currentIp = req.ip;

    // Check fingerprint consistency (if present in token)
    if (decoded.fingerprint && decoded.fingerprint !== currentFingerprint) {
      logSecurityEvent('suspicious_activity', req, { 
        reason: 'Fingerprint mismatch',
        tokenFingerprint: decoded.fingerprint,
        currentFingerprint,
        userId: decoded.id
      });
      
      // Allow but log suspicious activity
      console.warn(`Fingerprint mismatch for user ${decoded.id}: token=${decoded.fingerprint}, current=${currentFingerprint}`);
    }

    // Check IP consistency with tolerance for reasonable changes
    if (decoded.ipAddress && decoded.ipAddress !== currentIp) {
      logSecurityEvent('suspicious_activity', req, { 
        reason: 'IP address change',
        tokenIp: decoded.ipAddress,
        currentIp,
        userId: decoded.id
      });
      
      // Log but allow (users may change networks)
      console.warn(`IP change for user ${decoded.id}: token=${decoded.ipAddress}, current=${currentIp}`);
    }

    // Update session activity if session exists
    if (decoded.sessionId) {
      const session = activeSessions.get(decoded.sessionId);
      if (session) {
        session.lastActivity = new Date();
        session.ipAddress = currentIp || session.ipAddress;
      }
    }

    req.user = decoded;
    logSecurityEvent('auth_success', req, { userId: decoded.id, role: decoded.role });
    next();
  } catch (error) {
    const errorDetails = { error: error instanceof Error ? error.message : 'Unknown error' };
    
    if (error instanceof jwt.TokenExpiredError) {
      logSecurityEvent('auth_failure', req, { ...errorDetails, reason: 'Token expired' });
      res.status(401).json({
        success: false,
        error: 'Token has expired.',
        code: 'TOKEN_EXPIRED'
      });
    } else if (error instanceof jwt.JsonWebTokenError) {
      logSecurityEvent('auth_failure', req, { ...errorDetails, reason: 'Invalid token' });
      res.status(401).json({
        success: false,
        error: 'Invalid token.',
        code: 'INVALID_TOKEN'
      });
    } else {
      logSecurityEvent('auth_failure', req, { ...errorDetails, reason: 'Token verification error' });
      res.status(500).json({
        success: false,
        error: 'Token verification failed.',
        code: 'TOKEN_VERIFICATION_ERROR'
      });
    }
  }
};

// Optional authentication middleware (doesn't fail if no token)
export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.substring(7);
    
    if (!blacklistedTokens.has(token)) {
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
      req.user = decoded;
    }
    
    next();
  } catch (error) {
    // Ignore token errors in optional auth
    next();
  }
};

// Role-based access control middleware
export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required.',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
        code: 'INSUFFICIENT_ROLE'
      });
      return;
    }

    next();
  };
};

// Permission-based access control middleware
export const requirePermission = (requiredPermissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required.',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    const hasPermission = requiredPermissions.some(permission => 
      req.user!.permissions.includes(permission)
    );

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        error: `Access denied. Required permissions: ${requiredPermissions.join(', ')}`,
        code: 'INSUFFICIENT_PERMISSIONS'
      });
      return;
    }

    next();
  };
};

// Refresh token middleware
export const refreshToken = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      res.status(401).json({
        success: false,
        error: 'Refresh token required.',
        code: 'NO_REFRESH_TOKEN'
      });
      return;
    }

    // Check if refresh token is blacklisted
    if (blacklistedTokens.has(refreshToken)) {
      res.status(401).json({
        success: false,
        error: 'Refresh token has been revoked.',
        code: 'REFRESH_TOKEN_REVOKED'
      });
      return;
    }

    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as JWTPayload;
    
    // Generate new tokens
    const tokens = generateTokens({
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      permissions: decoded.permissions
    });

    // Blacklist old refresh token
    blacklistedTokens.add(refreshToken);

    res.json({
      success: true,
      data: tokens
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: 'Refresh token has expired.',
        code: 'REFRESH_TOKEN_EXPIRED'
      });
    } else if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: 'Invalid refresh token.',
        code: 'INVALID_REFRESH_TOKEN'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Token refresh failed.',
        code: 'TOKEN_REFRESH_ERROR'
      });
    }
  }
};

// Token blacklisting utilities
export const blacklistToken = (token: string): void => {
  blacklistedTokens.add(token);
};

export const logout = (req: Request, res: Response): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      blacklistToken(token);
    }

    // Also blacklist refresh token if provided
    const { refreshToken } = req.body;
    if (refreshToken) {
      blacklistToken(refreshToken);
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
};

// Session management functions
export const getActiveSessions = (userId?: string): Array<{
  sessionId: string;
  userId: string;
  fingerprint: string;
  ipAddress: string;
  lastActivity: Date;
  userAgent: string;
}> => {
  const sessions = Array.from(activeSessions.values());
  return userId ? sessions.filter(session => session.userId === userId) : sessions;
};

export const revokeSession = (sessionId: string): boolean => {
  return activeSessions.delete(sessionId);
};

export const revokeAllUserSessions = (userId: string): number => {
  let revokedCount = 0;
  for (const [sessionId, session] of activeSessions.entries()) {
    if (session.userId === userId) {
      activeSessions.delete(sessionId);
      revokedCount++;
    }
  }
  return revokedCount;
};

// Enhanced logout with session cleanup
export const enhancedLogout = (req: Request, res: Response): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      blacklistToken(token);
      
      // Also revoke the session if we can decode the token
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
        if (decoded.sessionId) {
          revokeSession(decoded.sessionId);
        }
        logSecurityEvent('auth_success', req, { 
          action: 'logout',
          userId: decoded.id,
          sessionId: decoded.sessionId
        });
      } catch (error) {
        // Token might be invalid/expired, but that's okay for logout
      }
    }

    // Also blacklist refresh token if provided
    const { refreshToken } = req.body;
    if (refreshToken) {
      blacklistToken(refreshToken);
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
};

// Clean up expired sessions and tokens
export const cleanupExpiredSessions = (): void => {
  const now = Date.now();
  const sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours
  
  for (const [sessionId, session] of activeSessions.entries()) {
    if (now - session.lastActivity.getTime() > sessionTimeout) {
      activeSessions.delete(sessionId);
    }
  }
};

// Clean up expired tokens from blacklist (should be run periodically)
export const cleanupBlacklist = (): void => {
  // In a real implementation, you would check token expiration times
  // and remove expired tokens from the blacklist
  // This is a simplified version
  console.log('Cleaning up token blacklist...');
  cleanupExpiredSessions();
};

// Security monitoring and statistics
export const getAuthStats = (): {
  activeSessions: number;
  blacklistedTokens: number;
  sessionsPerUser: Record<string, number>;
} => {
  const sessionsPerUser: Record<string, number> = {};
  
  for (const session of activeSessions.values()) {
    sessionsPerUser[session.userId] = (sessionsPerUser[session.userId] || 0) + 1;
  }

  return {
    activeSessions: activeSessions.size,
    blacklistedTokens: blacklistedTokens.size,
    sessionsPerUser
  };
};

// Periodic cleanup
setInterval(() => {
  cleanupBlacklist();
}, 60 * 60 * 1000); // Clean up every hour