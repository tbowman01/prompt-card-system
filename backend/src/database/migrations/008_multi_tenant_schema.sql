-- Multi-Tenant Architecture Migration
-- This migration transforms the system from single-tenant to multi-tenant with workspace isolation

-- Enable Row Level Security
PRAGMA foreign_keys = OFF;

-- 1. Create workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL, -- URL-friendly identifier
  description TEXT,
  domain TEXT, -- Custom domain for workspace
  settings_json TEXT DEFAULT '{}', -- Workspace-specific settings
  plan_type TEXT DEFAULT 'free' CHECK (plan_type IN ('free', 'pro', 'enterprise')),
  max_users INTEGER DEFAULT 10,
  max_prompt_cards INTEGER DEFAULT 100,
  max_test_executions_per_month INTEGER DEFAULT 1000,
  storage_limit_mb INTEGER DEFAULT 1024, -- 1GB default
  is_active BOOLEAN DEFAULT TRUE,
  trial_ends_at DATETIME,
  subscription_id TEXT, -- External billing system ID
  billing_email TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  email_verification_token TEXT,
  password_reset_token TEXT,
  password_reset_expires DATETIME,
  last_login_at DATETIME,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create workspace_members table for user-workspace relationships
CREATE TABLE IF NOT EXISTS workspace_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  permissions_json TEXT DEFAULT '{}', -- Custom permissions override
  invited_by INTEGER, -- User ID who invited this member
  invited_at DATETIME,
  joined_at DATETIME,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(workspace_id, user_id)
);

-- 4. Create user_sessions table for authentication
CREATE TABLE IF NOT EXISTS user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  workspace_id INTEGER, -- Current active workspace
  session_token TEXT UNIQUE NOT NULL,
  refresh_token TEXT,
  ip_address TEXT,
  user_agent TEXT,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
);

-- 5. Create workspace_invitations table
CREATE TABLE IF NOT EXISTS workspace_invitations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
  invitation_token TEXT UNIQUE NOT NULL,
  invited_by INTEGER NOT NULL,
  expires_at DATETIME NOT NULL,
  accepted_at DATETIME,
  declined_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. Add workspace_id to existing tables
ALTER TABLE prompt_cards ADD COLUMN workspace_id INTEGER;
ALTER TABLE test_cases ADD COLUMN workspace_id INTEGER;
ALTER TABLE test_results ADD COLUMN workspace_id INTEGER;
ALTER TABLE test_execution_queue ADD COLUMN workspace_id INTEGER;

-- Add foreign key constraints to existing tables
-- Note: SQLite doesn't support adding foreign keys to existing tables, so we'll handle this in the application

-- 7. Create workspace_usage_tracking table
CREATE TABLE IF NOT EXISTS workspace_usage_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL,
  metric_type TEXT NOT NULL, -- 'storage', 'api_calls', 'test_executions', 'users'
  metric_value INTEGER NOT NULL,
  period_start DATETIME NOT NULL,
  period_end DATETIME NOT NULL,
  metadata_json TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- 8. Create workspace_billing_events table
CREATE TABLE IF NOT EXISTS workspace_billing_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL,
  event_type TEXT NOT NULL, -- 'subscription_created', 'payment_success', 'payment_failed', 'usage_overage'
  amount DECIMAL(10,2),
  currency TEXT DEFAULT 'USD',
  external_transaction_id TEXT,
  metadata_json TEXT DEFAULT '{}',
  processed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- 9. Create workspace_api_keys table for programmatic access
CREATE TABLE IF NOT EXISTS workspace_api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT UNIQUE NOT NULL,
  key_prefix TEXT NOT NULL, -- First 8 chars for identification
  permissions_json TEXT DEFAULT '{}', -- API permissions
  last_used_at DATETIME,
  expires_at DATETIME,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- 10. Create audit_logs table for compliance and tracking
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER,
  user_id INTEGER,
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'login', 'logout', 'invite', etc.
  resource_type TEXT NOT NULL, -- 'prompt_card', 'test_case', 'user', 'workspace', etc.
  resource_id TEXT,
  old_values_json TEXT, -- Previous state for updates/deletes
  new_values_json TEXT, -- New state for creates/updates
  ip_address TEXT,
  user_agent TEXT,
  metadata_json TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(slug);
CREATE INDEX IF NOT EXISTS idx_workspaces_is_active ON workspaces(is_active);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_role ON workspace_members(role);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace_id ON workspace_invitations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email ON workspace_invitations(email);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_token ON workspace_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_prompt_cards_workspace_id ON prompt_cards(workspace_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_workspace_id ON test_cases(workspace_id);
CREATE INDEX IF NOT EXISTS idx_test_results_workspace_id ON test_results(workspace_id);
CREATE INDEX IF NOT EXISTS idx_test_execution_queue_workspace_id ON test_execution_queue(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_usage_tracking_workspace_id ON workspace_usage_tracking(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_usage_tracking_period ON workspace_usage_tracking(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_workspace_billing_events_workspace_id ON workspace_billing_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_api_keys_workspace_id ON workspace_api_keys(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_api_keys_key_hash ON workspace_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_id ON audit_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Insert default workspace for migration compatibility
INSERT INTO workspaces (id, name, slug, description, plan_type, is_active) 
VALUES (1, 'Default Workspace', 'default', 'Default workspace for existing data', 'enterprise', TRUE)
ON CONFLICT DO NOTHING;

-- Update existing data to belong to default workspace
UPDATE prompt_cards SET workspace_id = 1 WHERE workspace_id IS NULL;
UPDATE test_cases SET workspace_id = 1 WHERE workspace_id IS NULL;
UPDATE test_results SET workspace_id = 1 WHERE workspace_id IS NULL;
UPDATE test_execution_queue SET workspace_id = 1 WHERE workspace_id IS NULL;

-- Create default admin user (password should be changed immediately)
INSERT INTO users (id, email, password_hash, first_name, last_name, email_verified, is_active)
VALUES (1, 'admin@localhost', '$2b$10$example.hash.change.this', 'System', 'Administrator', TRUE, TRUE)
ON CONFLICT DO NOTHING;

-- Add admin user to default workspace as owner
INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
VALUES (1, 1, 'owner', CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

PRAGMA foreign_keys = ON;