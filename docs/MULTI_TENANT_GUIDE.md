# Multi-Tenant Architecture Guide

## 🏢 Overview

The Multi-Tenant Architecture enables multiple organizations to use the prompt card system while maintaining complete data isolation, independent billing, and customized configurations. Each workspace operates as an independent instance with its own users, data, and settings.

## 🌟 Key Features

### Workspace Isolation
- **Complete Data Separation**: Each workspace has isolated data
- **Independent User Management**: Separate user bases per workspace
- **Custom Configuration**: Workspace-specific settings and branding
- **Resource Quotas**: Configurable limits per workspace plan

### Enterprise Features
- **Role-based Access Control**: Owner, Admin, Member, Viewer roles
- **Invitation System**: Secure workspace member invitations
- **API Key Management**: Programmatic access with granular permissions
- **Audit Logging**: Comprehensive activity tracking per workspace

### Billing & Plans
- **Flexible Plans**: Free, Pro, Enterprise tiers
- **Usage Tracking**: Monitor resource consumption
- **Billing Events**: Automated billing and payment processing
- **Trial Management**: Configurable trial periods

## 🚀 Getting Started

### Environment Setup
```bash
# Enable multi-tenant mode
MULTI_TENANT_MODE=true
DEFAULT_WORKSPACE_PLAN=free
MAX_WORKSPACES_PER_USER=5
BILLING_PROVIDER=stripe
```

### Database Migration
```bash
# Run multi-tenant migration
npm run migrate:multi-tenant

# This creates:
# - workspaces table
# - users table  
# - workspace_members table
# - user_sessions table
# - workspace_invitations table
# - usage tracking tables
# - billing events table
# - audit logs table
```

## 🏗️ Database Schema

### Core Tables

#### Workspaces
```sql
CREATE TABLE workspaces (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  domain TEXT,
  settings_json TEXT DEFAULT '{}',
  plan_type TEXT DEFAULT 'free',
  max_users INTEGER DEFAULT 10,
  max_prompt_cards INTEGER DEFAULT 100,
  max_test_executions_per_month INTEGER DEFAULT 1000,
  storage_limit_mb INTEGER DEFAULT 1024,
  is_active BOOLEAN DEFAULT TRUE,
  trial_ends_at DATETIME,
  subscription_id TEXT,
  billing_email TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### Users
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  email_verification_token TEXT,
  password_reset_token TEXT,
  last_login_at DATETIME,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### Workspace Members
```sql
CREATE TABLE workspace_members (
  id INTEGER PRIMARY KEY,
  workspace_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  permissions_json TEXT DEFAULT '{}',
  invited_by INTEGER,
  invited_at DATETIME,
  joined_at DATETIME,
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(workspace_id, user_id)
);
```

## 👥 User Management

### User Registration
```typescript
import { UserService } from './services/UserService';

// Register new user
const user = await UserService.register({
  email: 'user@example.com',
  password: 'securepassword',
  firstName: 'John',
  lastName: 'Doe'
});

// Create default workspace for user
const workspace = await WorkspaceService.createWorkspace({
  name: 'John\'s Workspace',
  slug: 'johns-workspace',
  ownerId: user.id,
  planType: 'free'
});
```

### User Authentication
```typescript
// Login with email/password
const session = await AuthService.login(
  'user@example.com',
  'password',
  'workspace-slug'
);

// Session includes:
// - user information
// - current workspace
// - permissions
// - token for API access
```

### Role Management
```typescript
interface WorkspaceRole {
  role: 'owner' | 'admin' | 'member' | 'viewer';
  permissions: {
    canManageUsers: boolean;
    canEditSettings: boolean;
    canCreatePrompts: boolean;
    canRunTests: boolean;
    canViewAnalytics: boolean;
    canManageBilling: boolean;
  };
}

// Add user to workspace
await WorkspaceService.addMember({
  workspaceId: 'workspace123',
  userId: 'user456',
  role: 'editor',
  invitedBy: 'owner789'
});
```

## 🏠 Workspace Management

### Workspace Creation
```typescript
// Create new workspace
const workspace = await WorkspaceService.create({
  name: 'Acme Corporation',
  slug: 'acme-corp',
  description: 'AI testing workspace for Acme',
  planType: 'pro',
  ownerId: 'user123',
  settings: {
    allowPublicSharing: false,
    defaultTestTimeout: 30000,
    retentionPeriodDays: 90
  }
});
```

### Workspace Configuration
```typescript
interface WorkspaceSettings {
  // Feature toggles
  enableVoiceInterface: boolean;
  enableBlockchainAudit: boolean;
  enableCollaboration: boolean;
  
  // Security settings
  requireTwoFactor: boolean;
  allowGuestAccess: boolean;
  passwordPolicy: PasswordPolicy;
  
  // Operational settings
  defaultTestTimeout: number;
  maxConcurrentTests: number;
  dataRetentionDays: number;
  
  // Branding
  logoUrl?: string;
  primaryColor?: string;
  customDomain?: string;
}
```

### Workspace Switching
```typescript
// Switch user's active workspace
await UserService.switchWorkspace(userId, newWorkspaceId);

// Update session with new workspace context
const updatedSession = await AuthService.refreshSession(sessionToken);
```

## 💰 Billing & Plans

### Plan Definitions
```typescript
interface PlanLimits {
  maxUsers: number;
  maxPromptCards: number;
  maxTestExecutionsPerMonth: number;
  storageLimitMB: number;
  features: {
    advancedAnalytics: boolean;
    voiceInterface: boolean;
    blockchainAudit: boolean;
    prioritySupport: boolean;
    customBranding: boolean;
    apiAccess: boolean;
  };
}

const plans: Record<string, PlanLimits> = {
  free: {
    maxUsers: 3,
    maxPromptCards: 25,
    maxTestExecutionsPerMonth: 500,
    storageLimitMB: 256,
    features: { /* basic features only */ }
  },
  pro: {
    maxUsers: 25,
    maxPromptCards: 500,
    maxTestExecutionsPerMonth: 10000,
    storageLimitMB: 5120,
    features: { /* most features enabled */ }
  },
  enterprise: {
    maxUsers: -1, // unlimited
    maxPromptCards: -1,
    maxTestExecutionsPerMonth: -1,
    storageLimitMB: -1,
    features: { /* all features enabled */ }
  }
};
```

### Usage Tracking
```typescript
// Track workspace usage
await UsageTracker.record({
  workspaceId: 'workspace123',
  metricType: 'test_executions',
  metricValue: 1,
  periodStart: startOfMonth,
  periodEnd: endOfMonth,
  metadata: {
    userId: 'user456',
    promptCardId: 'prompt789'
  }
});

// Check usage against limits
const usage = await UsageTracker.getUsage('workspace123', 'current_month');
const isOverLimit = usage.testExecutions > workspace.maxTestExecutionsPerMonth;
```

### Billing Events
```typescript
// Record billing event
await BillingService.recordEvent({
  workspaceId: 'workspace123',
  eventType: 'payment_success',
  amount: 29.99,
  currency: 'USD',
  externalTransactionId: 'txn_abc123',
  metadata: {
    planType: 'pro',
    billingPeriod: 'monthly'
  }
});
```

## 🔐 Security & Permissions

### Row-Level Security
```sql
-- Implement row-level security for data isolation
CREATE POLICY workspace_isolation ON prompt_cards
  FOR ALL TO authenticated_users
  USING (workspace_id = current_workspace_id());

CREATE POLICY workspace_isolation ON test_results
  FOR ALL TO authenticated_users  
  USING (workspace_id = current_workspace_id());
```

### API Key Management
```typescript
// Create API key for workspace
const apiKey = await APIKeyService.create({
  workspaceId: 'workspace123',
  name: 'Production API Key',
  permissions: {
    'prompts:read': true,
    'prompts:write': true,
    'tests:execute': true,
    'analytics:read': true
  },
  expiresAt: new Date('2024-12-31'),
  createdBy: 'user123'
});

// Validate API key with permissions
const isValid = await APIKeyService.validate(
  apiKeyHash,
  'prompts:write',
  'workspace123'
);
```

### Audit Logging
```typescript
// Log workspace activity
await AuditLogger.log({
  workspaceId: 'workspace123',
  userId: 'user456',
  action: 'prompt_card_created',
  resourceType: 'prompt_card',
  resourceId: 'prompt789',
  oldValues: null,
  newValues: { title: 'New Prompt', content: '...' },
  ipAddress: '192.168.1.100',
  userAgent: 'Mozilla/5.0...',
  metadata: { source: 'web_ui' }
});
```

## 📧 Invitation System

### Sending Invitations
```typescript
// Invite user to workspace
const invitation = await InvitationService.create({
  workspaceId: 'workspace123',
  email: 'newuser@example.com',
  role: 'member',
  invitedBy: 'admin456',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
});

// Send invitation email
await EmailService.sendInvitation(invitation);
```

### Accepting Invitations
```typescript
// Accept invitation
const membership = await InvitationService.accept({
  invitationToken: 'token_abc123',
  userId: 'user789' // accepting user
});

// User is now member of workspace
```

### Managing Invitations
```typescript
// List pending invitations
const pendingInvitations = await InvitationService.getPending('workspace123');

// Revoke invitation
await InvitationService.revoke('invitation456', 'admin123');
```

## 📊 Analytics & Monitoring

### Workspace Analytics
```typescript
// Get workspace-specific analytics
const analytics = await AnalyticsService.getWorkspaceMetrics('workspace123', {
  timeframe: 'last_30_days',
  metrics: ['test_executions', 'success_rate', 'active_users', 'storage_usage']
});

// Compare with previous period
const comparison = await AnalyticsService.compareMetrics(
  'workspace123',
  'last_30_days',
  'previous_30_days'
);
```

### Cross-Workspace Analytics (Admin Only)
```typescript
// System-wide metrics for platform administrators
const systemMetrics = await AdminAnalyticsService.getSystemMetrics({
  totalWorkspaces: true,
  totalUsers: true,
  planDistribution: true,
  usagePatterns: true,
  revenueMetrics: true
});
```

## 🛠️ API Reference

### Workspace API
```typescript
// Create workspace
POST /api/workspaces
{
  "name": "My Workspace",
  "slug": "my-workspace",
  "planType": "pro"
}

// Get workspace details
GET /api/workspaces/{workspaceId}

// Update workspace settings
PUT /api/workspaces/{workspaceId}/settings
{
  "enableVoiceInterface": true,
  "defaultTestTimeout": 45000
}

// Get workspace members
GET /api/workspaces/{workspaceId}/members

// Add workspace member
POST /api/workspaces/{workspaceId}/members
{
  "email": "user@example.com",
  "role": "member"
}
```

### User API
```typescript
// Register user
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "securepassword",
  "firstName": "John",
  "lastName": "Doe"
}

// Login
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password",
  "workspaceSlug": "my-workspace"
}

// Switch workspace
POST /api/auth/switch-workspace
{
  "workspaceId": "workspace123"
}
```

### Usage API
```typescript
// Get current usage
GET /api/workspaces/{workspaceId}/usage

// Get usage history
GET /api/workspaces/{workspaceId}/usage/history?period=last_3_months

// Get billing events
GET /api/workspaces/{workspaceId}/billing/events
```

## 🔧 Configuration

### Environment Variables
```bash
# Multi-tenant settings
MULTI_TENANT_MODE=true
DEFAULT_WORKSPACE_PLAN=free
MAX_WORKSPACES_PER_USER=5
WORKSPACE_SLUG_MIN_LENGTH=3
WORKSPACE_SLUG_MAX_LENGTH=63

# Billing settings
BILLING_PROVIDER=stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email settings
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxx
FROM_EMAIL=noreply@yourapp.com

# Security settings
SESSION_SECRET=your_session_secret
JWT_SECRET=your_jwt_secret
PASSWORD_HASH_ROUNDS=12
```

## 🎯 Best Practices

### Data Isolation
- **Always filter by workspace_id** in database queries
- **Validate workspace membership** before allowing access
- **Use workspace-scoped sessions** for authentication
- **Implement row-level security** policies

### Performance Optimization
- **Index workspace_id columns** for fast filtering
- **Cache workspace settings** to reduce database calls
- **Use connection pooling** for database connections
- **Implement query optimization** for multi-tenant queries

### Security Guidelines
- **Validate all workspace access** at the API level
- **Use parameterized queries** to prevent SQL injection
- **Implement rate limiting** per workspace
- **Log all sensitive operations** for audit trails

### Billing Best Practices
- **Track usage in real-time** to prevent overages
- **Implement soft limits** with warnings before hard limits
- **Provide usage dashboards** for workspace administrators
- **Automate billing event processing** for accuracy

---

**The Multi-Tenant Architecture provides enterprise-grade isolation and management capabilities, enabling the platform to scale from individual users to large organizations.**