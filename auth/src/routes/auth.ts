import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AuthService } from '../services/auth-service';
import { getDatabase } from '../database/connection';
import { loadConfig } from '../config/config';

// Request/Response schemas
const registerSchema = z.object({
  email: z.string().email().max(255),
  username: z.string().min(3).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(12).max(128),
  role: z.enum(['user', 'admin', 'moderator']).optional()
});

const loginSchema = z.object({
  identifier: z.string().min(1).max(255),
  password: z.string().min(1).max(128),
  mfaCode: z.string().length(6).optional()
});

const apiKeySchema = z.object({
  name: z.string().min(1).max(255),
  permissions: z.array(z.string()).optional(),
  expiresInDays: z.number().min(1).max(365).optional()
});

const authRoutes: FastifyPluginAsync = async (fastify) => {
  const config = loadConfig();
  const db = getDatabase();
  const authService = new AuthService(db, config);

  // User Registration
  fastify.post('/register', {
    schema: {
      body: registerSchema,
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                username: { type: 'string' },
                role: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const userData = registerSchema.parse(request.body);
    
    try {
      const user = await authService.createUser({
        email: userData.email,
        username: userData.username,
        password: userData.password,
        role: userData.role
      });

      // Log successful registration
      request.log.info({
        action: 'user_registered',
        userId: user.id,
        email: user.email,
        ip: request.ip
      }, 'User registered successfully');

      reply.status(201).send({
        success: true,
        message: 'User registered successfully',
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role
        }
      });
    } catch (error: any) {
      request.log.error({
        action: 'registration_failed',
        email: userData.email,
        error: error.message,
        ip: request.ip
      }, 'Registration failed');
      
      throw error;
    }
  });

  // User Login
  fastify.post('/login', {
    schema: {
      body: loginSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                username: { type: 'string' },
                role: { type: 'string' },
                permissions: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const loginData = loginSchema.parse(request.body);
    
    try {
      const authResult = await authService.authenticateUser(
        loginData,
        request.ip,
        request.headers['user-agent']
      );

      // Generate JWT tokens
      const accessToken = fastify.jwt.sign(
        {
          userId: authResult.user.id,
          email: authResult.user.email,
          role: authResult.user.role,
          permissions: authResult.user.permissions,
          sessionId: authResult.sessionId,
          jti: authResult.jti
        },
        { expiresIn: config.jwtExpiresIn }
      );

      const refreshToken = fastify.jwt.sign(
        {
          userId: authResult.user.id,
          sessionId: authResult.sessionId,
          type: 'refresh'
        },
        { expiresIn: config.jwtRefreshExpiresIn }
      );

      // Set secure HTTP-only cookies in production
      if (config.nodeEnv === 'production') {
        reply.setCookie('accessToken', accessToken, {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: 15 * 60 * 1000 // 15 minutes
        });

        reply.setCookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
      }

      // Log successful login
      request.log.info({
        action: 'user_login',
        userId: authResult.user.id,
        email: authResult.user.email,
        ip: request.ip,
        sessionId: authResult.sessionId
      }, 'User logged in successfully');

      reply.send({
        success: true,
        message: 'Login successful',
        accessToken,
        refreshToken,
        user: {
          id: authResult.user.id,
          email: authResult.user.email,
          username: authResult.user.username,
          role: authResult.user.role,
          permissions: authResult.user.permissions
        }
      });
    } catch (error: any) {
      request.log.error({
        action: 'login_failed',
        identifier: loginData.identifier,
        error: error.message,
        ip: request.ip
      }, 'Login failed');
      
      throw error;
    }
  });

  // Token Refresh
  fastify.post('/refresh', async (request, reply) => {
    try {
      const refreshToken = (request.body as any)?.refreshToken || 
                          request.cookies?.refreshToken;

      if (!refreshToken) {
        return reply.status(401).send({
          success: false,
          error: 'Refresh token required'
        });
      }

      const decoded = fastify.jwt.verify(refreshToken) as any;
      
      if (decoded.type !== 'refresh') {
        return reply.status(401).send({
          success: false,
          error: 'Invalid refresh token'
        });
      }

      // Verify session is still active
      const sessionCheck = await db.query(`
        SELECT s.id, s.user_id, u.email, u.role, u.permissions, u.account_locked
        FROM user_sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = $1 AND s.is_active = TRUE AND s.expires_at > NOW()
      `, [decoded.sessionId]);

      if (sessionCheck.rows.length === 0) {
        return reply.status(401).send({
          success: false,
          error: 'Session expired or invalid'
        });
      }

      const sessionData = sessionCheck.rows[0];
      
      if (sessionData.account_locked) {
        return reply.status(403).send({
          success: false,
          error: 'Account is locked'
        });
      }

      // Generate new access token with fresh JTI
      const newJti = require('nanoid').nanoid(32);
      const newAccessToken = fastify.jwt.sign(
        {
          userId: sessionData.user_id,
          email: sessionData.email,
          role: sessionData.role,
          permissions: JSON.parse(sessionData.permissions || '[]'),
          sessionId: decoded.sessionId,
          jti: newJti
        },
        { expiresIn: config.jwtExpiresIn }
      );

      // Update session activity
      await db.query(`
        UPDATE user_sessions 
        SET last_activity = NOW() 
        WHERE id = $1
      `, [decoded.sessionId]);

      reply.send({
        success: true,
        accessToken: newAccessToken
      });
    } catch (error: any) {
      request.log.error({
        action: 'token_refresh_failed',
        error: error.message,
        ip: request.ip
      }, 'Token refresh failed');
      
      reply.status(401).send({
        success: false,
        error: 'Invalid refresh token'
      });
    }
  });

  // Logout
  fastify.post('/logout', {
    preHandler: async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (error) {
        reply.status(401).send({ success: false, error: 'Authentication required' });
      }
    }
  }, async (request, reply) => {
    const user = request.user as any;
    
    try {
      // Deactivate session
      await db.query(`
        UPDATE user_sessions 
        SET is_active = FALSE 
        WHERE id = $1 AND user_id = $2
      `, [user.sessionId, user.userId]);

      // Clear cookies
      reply.clearCookie('accessToken');
      reply.clearCookie('refreshToken');

      // Log logout
      request.log.info({
        action: 'user_logout',
        userId: user.userId,
        sessionId: user.sessionId,
        ip: request.ip
      }, 'User logged out');

      reply.send({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error: any) {
      request.log.error({
        action: 'logout_failed',
        userId: user.userId,
        error: error.message,
        ip: request.ip
      }, 'Logout failed');
      
      throw error;
    }
  });

  // Create API Key
  fastify.post('/api-key', {
    preHandler: async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (error) {
        reply.status(401).send({ success: false, error: 'Authentication required' });
      }
    },
    schema: {
      body: apiKeySchema
    }
  }, async (request, reply) => {
    const user = request.user as any;
    const keyData = apiKeySchema.parse(request.body);
    
    try {
      const expiresAt = keyData.expiresInDays 
        ? new Date(Date.now() + keyData.expiresInDays * 24 * 60 * 60 * 1000)
        : undefined;

      const result = await authService.createApiKey(
        user.userId,
        keyData.name,
        keyData.permissions || [],
        expiresAt
      );

      // Log API key creation
      request.log.info({
        action: 'api_key_created',
        userId: user.userId,
        keyId: result.apiKey.id,
        keyName: keyData.name,
        permissions: keyData.permissions,
        ip: request.ip
      }, 'API key created');

      reply.status(201).send({
        success: true,
        message: 'API key created successfully',
        apiKey: {
          ...result.apiKey,
          key: result.key // Only returned once during creation
        }
      });
    } catch (error: any) {
      request.log.error({
        action: 'api_key_creation_failed',
        userId: user.userId,
        error: error.message,
        ip: request.ip
      }, 'API key creation failed');
      
      throw error;
    }
  });

  // Get User Profile
  fastify.get('/profile', {
    preHandler: async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (error) {
        reply.status(401).send({ success: false, error: 'Authentication required' });
      }
    }
  }, async (request, reply) => {
    const user = request.user as any;
    
    try {
      const userResult = await db.query(`
        SELECT id, email, username, role, permissions, mfa_enabled, 
               email_verified, last_login, created_at
        FROM users 
        WHERE id = $1 AND NOT account_locked
      `, [user.userId]);

      if (userResult.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'User not found'
        });
      }

      const userData = userResult.rows[0];
      
      reply.send({
        success: true,
        user: {
          id: userData.id,
          email: userData.email,
          username: userData.username,
          role: userData.role,
          permissions: JSON.parse(userData.permissions || '[]'),
          mfaEnabled: userData.mfa_enabled,
          emailVerified: userData.email_verified,
          lastLogin: userData.last_login,
          createdAt: userData.created_at
        }
      });
    } catch (error: any) {
      request.log.error({
        action: 'profile_fetch_failed',
        userId: user.userId,
        error: error.message,
        ip: request.ip
      }, 'Profile fetch failed');
      
      throw error;
    }
  });
};

export default authRoutes;