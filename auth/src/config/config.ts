import { z } from 'zod';

const configSchema = z.object({
  port: z.number().default(8005),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  
  // JWT Configuration
  jwtSecret: z.string().min(32),
  jwtExpiresIn: z.string().default('15m'),
  jwtRefreshExpiresIn: z.string().default('7d'),
  
  // Database Configuration
  database: z.object({
    host: z.string().default('localhost'),
    port: z.number().default(5432),
    database: z.string().default('authdb'),
    username: z.string().default('authuser'),
    password: z.string(),
    ssl: z.boolean().default(false)
  }),
  
  // Redis Configuration
  redis: z.object({
    host: z.string().default('localhost'),
    port: z.number().default(6379),
    password: z.string().optional(),
    db: z.number().default(0)
  }),
  
  // Rate Limiting
  rateLimit: z.object({
    max: z.number().default(100),
    timeWindow: z.string().default('15m'),
    loginAttempts: z.number().default(5),
    loginWindow: z.string().default('15m')
  }),
  
  // Security Settings
  bcryptRounds: z.number().min(10).max(15).default(12),
  corsOrigins: z.array(z.string()).default(['http://localhost:3000']),
  
  // API Key Settings
  apiKeyPrefix: z.string().default('vllm_'),
  apiKeyLength: z.number().default(32),
  
  // Audit Settings
  auditLogLevel: z.enum(['minimal', 'standard', 'verbose']).default('verbose'),
  auditRetentionDays: z.number().default(90)
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(): AppConfig {
  const config = {
    port: parseInt(process.env.PORT || '8005'),
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    
    jwtSecret: process.env.JWT_SECRET_KEY || generateSecureSecret(),
    jwtExpiresIn: process.env.JWT_EXPIRY || '15m',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRY || '7d',
    
    database: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'authdb',
      username: process.env.DB_USER || 'authuser',
      password: process.env.DB_PASSWORD || 'defaultpassword',
      ssl: process.env.DB_SSL === 'true'
    },
    
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0')
    },
    
    rateLimit: {
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
      timeWindow: process.env.RATE_LIMIT_WINDOW || '15m',
      loginAttempts: parseInt(process.env.LOGIN_ATTEMPT_LIMIT || '5'),
      loginWindow: process.env.LOGIN_ATTEMPT_WINDOW || '15m'
    },
    
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    
    apiKeyPrefix: process.env.API_KEY_PREFIX || 'vllm_',
    apiKeyLength: parseInt(process.env.API_KEY_LENGTH || '32'),
    
    auditLogLevel: process.env.AUDIT_LOG_LEVEL || 'verbose',
    auditRetentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS || '90')
  };

  return configSchema.parse(config);
}

function generateSecureSecret(): string {
  const crypto = require('crypto');
  return crypto.randomBytes(64).toString('hex');
}