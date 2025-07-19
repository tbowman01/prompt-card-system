import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';

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
  iat?: number;
  exp?: number;
}

// JWT Secret keys
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '15m';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

// In-memory blacklist for revoked tokens (use Redis in production)
const blacklistedTokens = new Set<string>();

// Token generation utilities
export const generateTokens = (payload: Omit<JWTPayload, 'iat' | 'exp'>) => {
  const accessToken = jwt.sign(payload as object, JWT_SECRET as string, { expiresIn: JWT_EXPIRY });
  const refreshToken = jwt.sign(payload as object, JWT_REFRESH_SECRET as string, { expiresIn: JWT_REFRESH_EXPIRY });
  
  return { accessToken, refreshToken };
};

// Password hashing utilities
export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
};

export const verifyPassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

// JWT verification middleware
export const verifyToken = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
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
      res.status(401).json({
        success: false,
        error: 'Token has been revoked.',
        code: 'TOKEN_REVOKED'
      });
      return;
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: 'Token has expired.',
        code: 'TOKEN_EXPIRED'
      });
    } else if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: 'Invalid token.',
        code: 'INVALID_TOKEN'
      });
    } else {
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

// Clean up expired tokens from blacklist (should be run periodically)
export const cleanupBlacklist = (): void => {
  // In a real implementation, you would check token expiration times
  // and remove expired tokens from the blacklist
  // This is a simplified version
  console.log('Cleaning up token blacklist...');
};