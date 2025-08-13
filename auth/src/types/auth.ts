export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export type UserRole = 'admin' | 'ml-engineer' | 'developer' | 'analyst' | 'user';

export interface ApiKey {
  id: string;
  userId: string;
  keyHash: string;
  name: string;
  permissions: string[];
  isActive: boolean;
  lastUsedAt?: Date;
  createdAt: Date;
  expiresAt?: Date;
}

export interface JwtPayload {
  sub: string; // user id
  username: string;
  role: UserRole;
  permissions: string[];
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  sub: string;
  tokenId: string;
  iat: number;
  exp: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    username: string;
    role: UserRole;
    permissions: string[];
  };
}

export interface CreateApiKeyRequest {
  name: string;
  permissions: string[];
  expiresAt?: string; // ISO date string
}

export interface CreateApiKeyResponse {
  apiKey: string;
  keyId: string;
  name: string;
  permissions: string[];
  expiresAt?: Date;
}

export interface PermissionCheckRequest {
  permission: string;
  resource?: Record<string, any>;
}

export interface PermissionCheckResponse {
  hasPermission: boolean;
  reason?: string;
}

export interface AuditLogEntry {
  id: string;
  userId?: string;
  eventType: AuditEventType;
  eventData: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  timestamp: Date;
}

export type AuditEventType = 
  | 'user.register'
  | 'user.login'
  | 'user.logout'
  | 'auth.verify'
  | 'auth.refresh'
  | 'apikey.create'
  | 'apikey.revoke'
  | 'apikey.use'
  | 'permission.check'
  | 'security.violation';

// Role-based permissions mapping
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ['*'], // Full access
  'ml-engineer': [
    'models.*',
    'inference.*', 
    'training.*',
    'orchestrator.tasks.*',
    'memory.write',
    'tasks.create',
    'tasks.read',
    'tasks.update'
  ],
  developer: [
    'orchestrator.*',
    'agents.*',
    'memory.*',
    'tasks.create',
    'tasks.read',
    'tasks.update',
    'workflows.*'
  ],
  analyst: [
    'tasks.read',
    'memory.read',
    'stats.read',
    'metrics.*',
    'observability.*',
    'reports.read'
  ],
  user: [
    'tasks.create',
    'tasks.read',
    'agents.query',
    'memory.read:own'
  ]
};