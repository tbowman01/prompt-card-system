import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { createHash } from 'crypto';
import { AppConfig } from '../config/config';
import { SecurityError } from '../middleware/error-handler';

export interface User {
  id: string;
  email: string;
  username: string;
  role: string;
  permissions: string[];
  accountLocked: boolean;
  mfaEnabled: boolean;
  emailVerified: boolean;
  createdAt: Date;
  lastLogin?: Date;
}

export interface CreateUserRequest {
  email: string;
  username: string;
  password: string;
  role?: string;
  permissions?: string[];
}

export interface LoginRequest {
  identifier: string; // email or username
  password: string;
  mfaCode?: string;
}

export interface AuthResult {
  user: User;
  sessionId: string;
  jti: string;
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  expiresAt?: Date;
  lastUsed?: Date;
  usageCount: number;
}

export class AuthService {
  constructor(
    private db: Pool,
    private config: AppConfig
  ) {}

  async createUser(request: CreateUserRequest, createdBy?: string): Promise<User> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Check if user already exists
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1 OR username = $2',
        [request.email, request.username]
      );

      if (existingUser.rows.length > 0) {
        const error: SecurityError = new Error('User already exists');
        error.statusCode = 409;
        error.code = 'USER_EXISTS';
        error.securityLevel = 'medium';
        throw error;
      }

      // Hash password with security-first approach
      const passwordHash = await bcrypt.hash(request.password, this.config.bcryptRounds);

      // Validate password strength
      if (!this.isPasswordStrong(request.password)) {
        const error: SecurityError = new Error('Password does not meet security requirements');
        error.statusCode = 422;
        error.code = 'WEAK_PASSWORD';
        error.securityLevel = 'medium';
        throw error;
      }

      // Insert user
      const result = await client.query(`
        INSERT INTO users (
          email, username, password_hash, role, permissions, 
          created_by, terms_accepted_at, privacy_policy_accepted_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING id, email, username, role, permissions, account_locked, 
                  mfa_enabled, email_verified, created_at
      `, [
        request.email.toLowerCase(),
        request.username,
        passwordHash,
        request.role || 'user',
        JSON.stringify(request.permissions || []),
        createdBy || null
      ]);

      await client.query('COMMIT');

      return this.mapUserFromDb(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async authenticateUser(request: LoginRequest, clientIp: string, userAgent?: string): Promise<AuthResult> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Get user by email or username
      const userResult = await client.query(`
        SELECT id, email, username, password_hash, role, permissions, 
               account_locked, locked_until, failed_login_attempts, 
               mfa_enabled, mfa_secret, last_login
        FROM users 
        WHERE (email = $1 OR username = $1) AND NOT account_locked
      `, [request.identifier.toLowerCase()]);

      if (userResult.rows.length === 0) {
        // Log failed login attempt
        await this.logFailedLogin(request.identifier, clientIp, 'user_not_found');
        
        const error: SecurityError = new Error('Invalid credentials');
        error.statusCode = 401;
        error.code = 'INVALID_CREDENTIALS';
        error.securityLevel = 'high';
        throw error;
      }

      const userRow = userResult.rows[0];

      // Check account lock status
      if (userRow.account_locked && userRow.locked_until && new Date() < userRow.locked_until) {
        const error: SecurityError = new Error('Account temporarily locked');
        error.statusCode = 423;
        error.code = 'ACCOUNT_LOCKED';
        error.securityLevel = 'critical';
        throw error;
      }

      // Verify password
      const passwordValid = await bcrypt.compare(request.password, userRow.password_hash);
      if (!passwordValid) {
        await this.handleFailedLogin(userRow.id, clientIp);
        
        const error: SecurityError = new Error('Invalid credentials');
        error.statusCode = 401;
        error.code = 'INVALID_CREDENTIALS';
        error.securityLevel = 'high';
        throw error;
      }

      // Handle MFA if enabled
      if (userRow.mfa_enabled && !request.mfaCode) {
        const error: SecurityError = new Error('MFA code required');
        error.statusCode = 401;
        error.code = 'MFA_REQUIRED';
        error.securityLevel = 'medium';
        throw error;
      }

      if (userRow.mfa_enabled && request.mfaCode) {
        const mfaValid = await this.verifyMfaCode(userRow.mfa_secret, request.mfaCode);
        if (!mfaValid) {
          await this.handleFailedLogin(userRow.id, clientIp);
          
          const error: SecurityError = new Error('Invalid MFA code');
          error.statusCode = 401;
          error.code = 'INVALID_MFA';
          error.securityLevel = 'high';
          throw error;
        }
      }

      // Generate session
      const sessionId = nanoid();
      const jti = nanoid(32); // JWT ID for blacklisting
      const fingerprint = this.generateFingerprint(clientIp, userAgent);

      // Create session record
      await client.query(`
        INSERT INTO user_sessions (
          user_id, jti, ip_address, user_agent, fingerprint, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        userRow.id,
        jti,
        clientIp,
        userAgent || 'unknown',
        fingerprint,
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      ]);

      // Update user login info and reset failed attempts
      await client.query(`
        UPDATE users 
        SET last_login = NOW(), failed_login_attempts = 0, 
            locked_until = NULL, last_login_ip = $2
        WHERE id = $1
      `, [userRow.id, clientIp]);

      await client.query('COMMIT');

      return {
        user: this.mapUserFromDb(userRow),
        sessionId,
        jti
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async createApiKey(
    userId: string, 
    name: string, 
    permissions: string[] = [],
    expiresAt?: Date
  ): Promise<{ apiKey: ApiKey; key: string }> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Generate API key
      const key = `${this.config.apiKeyPrefix}${nanoid(this.config.apiKeyLength)}`;
      const keyHash = createHash('sha256').update(key).digest('hex');
      const keyPrefix = key.substring(0, this.config.apiKeyPrefix.length + 8);

      // Insert API key
      const result = await client.query(`
        INSERT INTO api_keys (
          user_id, name, key_hash, key_prefix, permissions, expires_at, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $1)
        RETURNING id, name, key_prefix, permissions, expires_at, 
                  last_used, usage_count, created_at
      `, [
        userId,
        name,
        keyHash,
        keyPrefix,
        JSON.stringify(permissions),
        expiresAt || null
      ]);

      await client.query('COMMIT');

      const apiKey: ApiKey = {
        id: result.rows[0].id,
        name: result.rows[0].name,
        keyPrefix: result.rows[0].key_prefix,
        permissions: JSON.parse(result.rows[0].permissions || '[]'),
        expiresAt: result.rows[0].expires_at,
        lastUsed: result.rows[0].last_used,
        usageCount: result.rows[0].usage_count
      };

      return { apiKey, key };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async validateApiKey(key: string): Promise<{ user: User; apiKey: ApiKey } | null> {
    const keyHash = createHash('sha256').update(key).digest('hex');
    
    const result = await this.db.query(`
      SELECT 
        ak.id as api_key_id, ak.name, ak.key_prefix, ak.permissions as api_permissions,
        ak.expires_at, ak.last_used, ak.usage_count,
        u.id, u.email, u.username, u.role, u.permissions as user_permissions,
        u.account_locked, u.mfa_enabled, u.email_verified, u.created_at
      FROM api_keys ak
      JOIN users u ON ak.user_id = u.id
      WHERE ak.key_hash = $1 AND ak.revoked = FALSE 
        AND (ak.expires_at IS NULL OR ak.expires_at > NOW())
        AND u.account_locked = FALSE
    `, [keyHash]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    // Update usage statistics
    await this.db.query(`
      UPDATE api_keys 
      SET last_used = NOW(), usage_count = usage_count + 1
      WHERE id = $1
    `, [row.api_key_id]);

    const user: User = this.mapUserFromDb(row);
    const apiKey: ApiKey = {
      id: row.api_key_id,
      name: row.name,
      keyPrefix: row.key_prefix,
      permissions: JSON.parse(row.api_permissions || '[]'),
      expiresAt: row.expires_at,
      lastUsed: new Date(),
      usageCount: row.usage_count + 1
    };

    return { user, apiKey };
  }

  private async handleFailedLogin(userId: string, clientIp: string): Promise<void> {
    const result = await this.db.query(`
      UPDATE users 
      SET failed_login_attempts = failed_login_attempts + 1
      WHERE id = $1
      RETURNING failed_login_attempts
    `, [userId]);

    const attempts = result.rows[0]?.failed_login_attempts || 0;

    // Lock account after multiple failed attempts
    if (attempts >= 5) {
      await this.db.query(`
        UPDATE users 
        SET account_locked = TRUE, locked_until = NOW() + INTERVAL '24 hours'
        WHERE id = $1
      `, [userId]);
    }

    // Log the failed attempt
    await this.logFailedLogin(userId, clientIp, 'invalid_password');
  }

  private async logFailedLogin(identifier: string, clientIp: string, reason: string): Promise<void> {
    await this.db.query(`
      INSERT INTO audit_logs (action, resource, ip_address, security_level, metadata)
      VALUES ('failed_login', 'authentication', $1, 'critical', $2)
    `, [clientIp, JSON.stringify({ identifier, reason, timestamp: new Date() })]);
  }

  private isPasswordStrong(password: string): boolean {
    return (
      password.length >= 12 &&
      /[a-z]/.test(password) &&
      /[A-Z]/.test(password) &&
      /\d/.test(password) &&
      /[^a-zA-Z\d]/.test(password)
    );
  }

  private generateFingerprint(ip: string, userAgent?: string): string {
    return createHash('sha256')
      .update(`${ip}:${userAgent || 'unknown'}`)
      .digest('hex')
      .substring(0, 16);
  }

  private async verifyMfaCode(secret: string, code: string): Promise<boolean> {
    // This would integrate with a TOTP library like speakeasy
    // For now, return a placeholder
    return code === '123456'; // TODO: Implement real MFA
  }

  private mapUserFromDb(row: any): User {
    return {
      id: row.id,
      email: row.email,
      username: row.username,
      role: row.role,
      permissions: JSON.parse(row.permissions || '[]'),
      accountLocked: row.account_locked,
      mfaEnabled: row.mfa_enabled,
      emailVerified: row.email_verified,
      createdAt: new Date(row.created_at),
      lastLogin: row.last_login ? new Date(row.last_login) : undefined
    };
  }
}