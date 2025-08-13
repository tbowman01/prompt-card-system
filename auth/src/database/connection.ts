import { Pool, PoolConfig } from 'pg';
import { AppConfig } from '../config/config';

let pool: Pool | null = null;

export async function initDatabase(config: AppConfig): Promise<Pool> {
  if (pool) {
    return pool;
  }

  const dbConfig: PoolConfig = {
    host: config.database.host,
    port: config.database.port,
    database: config.database.database,
    user: config.database.username,
    password: config.database.password,
    ssl: config.database.ssl,
    max: 20, // Maximum pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    maxUses: 7500 // Close connections after 7500 uses to prevent memory leaks
  };

  pool = new Pool(dbConfig);

  // Test connection
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log(`✅ Database connected to ${config.database.database}`);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }

  // Initialize database schema
  await initializeSchema(pool);

  return pool;
}

async function initializeSchema(pool: Pool): Promise<void> {
  const client = await pool.connect();
  
  try {
    // Enable UUID extension
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `);

    // Users table with comprehensive security features
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        permissions JSONB DEFAULT '[]'::jsonb,
        
        -- Security fields
        account_locked BOOLEAN DEFAULT FALSE,
        locked_until TIMESTAMP,
        failed_login_attempts INTEGER DEFAULT 0,
        last_login TIMESTAMP,
        last_password_change TIMESTAMP DEFAULT NOW(),
        
        -- MFA fields
        mfa_enabled BOOLEAN DEFAULT FALSE,
        mfa_secret VARCHAR(255),
        backup_codes JSONB DEFAULT '[]'::jsonb,
        
        -- Audit fields
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by UUID,
        last_login_ip INET,
        
        -- Compliance
        email_verified BOOLEAN DEFAULT FALSE,
        terms_accepted_at TIMESTAMP,
        privacy_policy_accepted_at TIMESTAMP
      );
    `);

    // API Keys table
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        key_hash VARCHAR(255) NOT NULL,
        key_prefix VARCHAR(20) NOT NULL,
        permissions JSONB DEFAULT '[]'::jsonb,
        
        -- Security
        last_used TIMESTAMP,
        usage_count INTEGER DEFAULT 0,
        rate_limit_override INTEGER,
        
        -- Lifecycle
        expires_at TIMESTAMP,
        revoked BOOLEAN DEFAULT FALSE,
        revoked_at TIMESTAMP,
        revoked_reason VARCHAR(500),
        
        -- Audit
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by UUID REFERENCES users(id)
      );
    `);

    // Sessions table for JWT blacklisting
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        jti VARCHAR(255) UNIQUE NOT NULL, -- JWT ID for blacklisting
        refresh_token_hash VARCHAR(255),
        
        -- Session tracking
        ip_address INET NOT NULL,
        user_agent TEXT,
        fingerprint VARCHAR(64),
        
        -- Security
        is_active BOOLEAN DEFAULT TRUE,
        expires_at TIMESTAMP NOT NULL,
        last_activity TIMESTAMP DEFAULT NOW(),
        
        -- Audit
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Audit logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id),
        action VARCHAR(100) NOT NULL,
        resource VARCHAR(100) NOT NULL,
        resource_id VARCHAR(255),
        
        -- Request details
        ip_address INET,
        user_agent TEXT,
        fingerprint VARCHAR(64),
        method VARCHAR(10),
        url TEXT,
        
        -- Response details
        status_code INTEGER,
        duration_ms INTEGER,
        
        -- Security classification
        security_level VARCHAR(20) DEFAULT 'info',
        risk_score INTEGER DEFAULT 0,
        
        -- Metadata
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create indexes for performance and security
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_users_account_locked ON users(account_locked);
      
      CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
      CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
      CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(revoked, expires_at);
      
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_jti ON user_sessions(jti);
      CREATE INDEX IF NOT EXISTS idx_sessions_active ON user_sessions(is_active, expires_at);
      
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_security_level ON audit_logs(security_level);
    `);

    console.log('✅ Database schema initialized');
  } finally {
    client.release();
  }
}

export function getDatabase(): Pool {
  if (!pool) {
    throw new Error('Database not initialized. Call initDatabase first.');
  }
  return pool;
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('✅ Database connection closed');
  }
}