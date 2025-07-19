export interface Workspace {
  id: number;
  name: string;
  slug: string;
  description?: string;
  domain?: string;
  settings: WorkspaceSettings;
  planType: 'free' | 'pro' | 'enterprise';
  maxUsers: number;
  maxPromptCards: number;
  maxTestExecutionsPerMonth: number;
  storageLimitMb: number;
  isActive: boolean;
  trialEndsAt?: string;
  subscriptionId?: string;
  billingEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceSettings {
  branding?: {
    logo?: string;
    primaryColor?: string;
    favicon?: string;
  };
  features?: {
    analyticsEnabled?: boolean;
    apiAccessEnabled?: boolean;
    customModelsEnabled?: boolean;
    webhooksEnabled?: boolean;
  };
  security?: {
    enforceSSO?: boolean;
    allowedDomains?: string[];
    sessionTimeoutMinutes?: number;
    mfaRequired?: boolean;
  };
  notifications?: {
    emailNotifications?: boolean;
    slackWebhook?: string;
    discordWebhook?: string;
  };
}

export interface User {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  emailVerified: boolean;
  lastLoginAt?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  id: number;
  workspaceId: number;
  userId: number;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  permissions: MemberPermissions;
  invitedBy?: number;
  invitedAt?: string;
  joinedAt?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Joined data
  user?: User;
  workspace?: Workspace;
}

export interface MemberPermissions {
  // Prompt Cards
  canCreatePromptCards?: boolean;
  canEditPromptCards?: boolean;
  canDeletePromptCards?: boolean;
  canViewPromptCards?: boolean;
  
  // Test Cases
  canCreateTestCases?: boolean;
  canEditTestCases?: boolean;
  canDeleteTestCases?: boolean;
  canRunTests?: boolean;
  
  // Analytics
  canViewAnalytics?: boolean;
  canExportData?: boolean;
  
  // Workspace Management
  canManageMembers?: boolean;
  canManageSettings?: boolean;
  canManageBilling?: boolean;
  canViewAuditLogs?: boolean;
  
  // API Access
  canCreateApiKeys?: boolean;
  canManageApiKeys?: boolean;
}

export interface UserSession {
  id: number;
  userId: number;
  workspaceId?: number;
  sessionToken: string;
  refreshToken?: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: string;
  createdAt: string;
  lastUsedAt: string;
}

export interface WorkspaceInvitation {
  id: number;
  workspaceId: number;
  email: string;
  role: 'admin' | 'member' | 'viewer';
  invitationToken: string;
  invitedBy: number;
  expiresAt: string;
  acceptedAt?: string;
  declinedAt?: string;
  createdAt: string;
  // Joined data
  workspace?: Workspace;
  invitedByUser?: User;
}

export interface WorkspaceUsage {
  id: number;
  workspaceId: number;
  metricType: 'storage' | 'api_calls' | 'test_executions' | 'users';
  metricValue: number;
  periodStart: string;
  periodEnd: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface WorkspaceBillingEvent {
  id: number;
  workspaceId: number;
  eventType: 'subscription_created' | 'payment_success' | 'payment_failed' | 'usage_overage';
  amount?: number;
  currency: string;
  externalTransactionId?: string;
  metadata: Record<string, any>;
  processedAt?: string;
  createdAt: string;
}

export interface WorkspaceApiKey {
  id: number;
  workspaceId: number;
  name: string;
  keyHash: string;
  keyPrefix: string; // First 8 chars for display
  permissions: ApiKeyPermissions;
  lastUsedAt?: string;
  expiresAt?: string;
  isActive: boolean;
  createdBy: number;
  createdAt: string;
}

export interface ApiKeyPermissions {
  scopes: string[]; // e.g., ['prompt-cards:read', 'test-cases:write', 'analytics:read']
  rateLimitPerHour?: number;
  allowedIps?: string[];
}

export interface AuditLog {
  id: number;
  workspaceId?: number;
  userId?: number;
  action: string;
  resourceType: string;
  resourceId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  metadata: Record<string, any>;
  createdAt: string;
  // Joined data
  user?: User;
  workspace?: Workspace;
}

// Request/Response types
export interface CreateWorkspaceRequest {
  name: string;
  slug: string;
  description?: string;
  planType?: 'free' | 'pro' | 'enterprise';
}

export interface UpdateWorkspaceRequest {
  name?: string;
  description?: string;
  settings?: Partial<WorkspaceSettings>;
}

export interface InviteUserRequest {
  email: string;
  role: 'admin' | 'member' | 'viewer';
  permissions?: Partial<MemberPermissions>;
}

export interface UpdateMemberRequest {
  role?: 'admin' | 'member' | 'viewer';
  permissions?: Partial<MemberPermissions>;
}

export interface CreateApiKeyRequest {
  name: string;
  permissions: ApiKeyPermissions;
  expiresAt?: string;
}

export interface WorkspaceContext {
  workspace: Workspace;
  user: User;
  member: WorkspaceMember;
  permissions: MemberPermissions;
}

// Default permission sets
export const DEFAULT_PERMISSIONS: Record<string, MemberPermissions> = {
  owner: {
    canCreatePromptCards: true,
    canEditPromptCards: true,
    canDeletePromptCards: true,
    canViewPromptCards: true,
    canCreateTestCases: true,
    canEditTestCases: true,
    canDeleteTestCases: true,
    canRunTests: true,
    canViewAnalytics: true,
    canExportData: true,
    canManageMembers: true,
    canManageSettings: true,
    canManageBilling: true,
    canViewAuditLogs: true,
    canCreateApiKeys: true,
    canManageApiKeys: true,
  },
  admin: {
    canCreatePromptCards: true,
    canEditPromptCards: true,
    canDeletePromptCards: true,
    canViewPromptCards: true,
    canCreateTestCases: true,
    canEditTestCases: true,
    canDeleteTestCases: true,
    canRunTests: true,
    canViewAnalytics: true,
    canExportData: true,
    canManageMembers: true,
    canManageSettings: true,
    canManageBilling: false,
    canViewAuditLogs: true,
    canCreateApiKeys: true,
    canManageApiKeys: true,
  },
  member: {
    canCreatePromptCards: true,
    canEditPromptCards: true,
    canDeletePromptCards: false,
    canViewPromptCards: true,
    canCreateTestCases: true,
    canEditTestCases: true,
    canDeleteTestCases: false,
    canRunTests: true,
    canViewAnalytics: true,
    canExportData: false,
    canManageMembers: false,
    canManageSettings: false,
    canManageBilling: false,
    canViewAuditLogs: false,
    canCreateApiKeys: false,
    canManageApiKeys: false,
  },
  viewer: {
    canCreatePromptCards: false,
    canEditPromptCards: false,
    canDeletePromptCards: false,
    canViewPromptCards: true,
    canCreateTestCases: false,
    canEditTestCases: false,
    canDeleteTestCases: false,
    canRunTests: false,
    canViewAnalytics: true,
    canExportData: false,
    canManageMembers: false,
    canManageSettings: false,
    canManageBilling: false,
    canViewAuditLogs: false,
    canCreateApiKeys: false,
    canManageApiKeys: false,
  },
};