-- Production Database Initialization Script
-- Prompt Card System Production Database Setup

-- Create database if it doesn't exist
-- (This is handled by Docker environment variables)

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create application user with limited privileges
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user WITH LOGIN PASSWORD 'CHANGE_ME_APP_USER_PASSWORD';
    END IF;
END
$$;

-- Grant necessary permissions
GRANT CONNECT ON DATABASE promptcard_prod TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT CREATE ON SCHEMA public TO app_user;

-- Create audit log table for blockchain functionality
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    user_id VARCHAR(100),
    entity_type VARCHAR(50),
    entity_id VARCHAR(100),
    old_data JSONB,
    new_data JSONB,
    metadata JSONB,
    blockchain_hash VARCHAR(256),
    block_index INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);

-- Create indexes for audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);

-- Create workspaces table for multi-tenant support
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    plan_type VARCHAR(50) DEFAULT 'free',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) DEFAULT 'user',
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    settings JSONB DEFAULT '{}',
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create prompt_cards table
CREATE TABLE IF NOT EXISTS prompt_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    prompt_template TEXT NOT NULL,
    variables JSONB DEFAULT '[]',
    category VARCHAR(100),
    tags JSONB DEFAULT '[]',
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create test_cases table
CREATE TABLE IF NOT EXISTS test_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    prompt_card_id UUID REFERENCES prompt_cards(id) ON DELETE CASCADE,
    input_variables JSONB DEFAULT '{}',
    expected_output TEXT,
    assertions JSONB DEFAULT '[]',
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create test_executions table
CREATE TABLE IF NOT EXISTS test_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_case_id UUID REFERENCES test_cases(id) ON DELETE CASCADE,
    model VARCHAR(100) NOT NULL,
    parameters JSONB DEFAULT '{}',
    actual_output TEXT,
    execution_time INTEGER, -- milliseconds
    token_usage JSONB DEFAULT '{}',
    cost DECIMAL(10,6),
    status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    executed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create collaboration_documents table
CREATE TABLE IF NOT EXISTS collaboration_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    content JSONB DEFAULT '{}',
    document_type VARCHAR(50) DEFAULT 'prompt_card',
    permissions JSONB DEFAULT '{}',
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    last_modified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    version INTEGER DEFAULT 1,
    is_locked BOOLEAN DEFAULT false,
    locked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    locked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create collaboration_operations table (for operational transform)
CREATE TABLE IF NOT EXISTS collaboration_operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES collaboration_documents(id) ON DELETE CASCADE,
    operation JSONB NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    version INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create api_keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    permissions JSONB DEFAULT '{}',
    last_used TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create blockchain_blocks table
CREATE TABLE IF NOT EXISTS blockchain_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    block_index INTEGER UNIQUE NOT NULL,
    previous_hash VARCHAR(256),
    merkle_root VARCHAR(256) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    nonce BIGINT DEFAULT 0,
    hash VARCHAR(256) UNIQUE NOT NULL,
    difficulty INTEGER DEFAULT 1,
    events_count INTEGER DEFAULT 0
);

-- Create quality_tokens table
CREATE TABLE IF NOT EXISTS quality_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(20,8) NOT NULL,
    reason VARCHAR(255),
    transaction_hash VARCHAR(256),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create performance_metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_type VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,6) NOT NULL,
    labels JSONB DEFAULT '{}',
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_workspace_id ON users(workspace_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_prompt_cards_workspace_id ON prompt_cards(workspace_id);
CREATE INDEX IF NOT EXISTS idx_prompt_cards_created_by ON prompt_cards(created_by);
CREATE INDEX IF NOT EXISTS idx_test_cases_prompt_card_id ON test_cases(prompt_card_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_workspace_id ON test_cases(workspace_id);
CREATE INDEX IF NOT EXISTS idx_test_executions_test_case_id ON test_executions(test_case_id);
CREATE INDEX IF NOT EXISTS idx_test_executions_workspace_id ON test_executions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_test_executions_created_at ON test_executions(created_at);
CREATE INDEX IF NOT EXISTS idx_collaboration_documents_workspace_id ON collaboration_documents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_operations_document_id ON collaboration_operations(document_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_operations_version ON collaboration_operations(document_id, version);
CREATE INDEX IF NOT EXISTS idx_api_keys_workspace_id ON api_keys(workspace_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_blockchain_blocks_index ON blockchain_blocks(block_index);
CREATE INDEX IF NOT EXISTS idx_quality_tokens_user_id ON quality_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_type ON performance_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_recorded_at ON performance_metrics(recorded_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_workspaces_updated_at ON workspaces;
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_prompt_cards_updated_at ON prompt_cards;
CREATE TRIGGER update_prompt_cards_updated_at BEFORE UPDATE ON prompt_cards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_test_cases_updated_at ON test_cases;
CREATE TRIGGER update_test_cases_updated_at BEFORE UPDATE ON test_cases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_collaboration_documents_updated_at ON collaboration_documents;
CREATE TRIGGER update_collaboration_documents_updated_at BEFORE UPDATE ON collaboration_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions to app_user
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;

-- Create default workspace for getting started
INSERT INTO workspaces (name, slug, description, plan_type) 
VALUES ('Default Workspace', 'default', 'Default workspace for getting started', 'pro')
ON CONFLICT (slug) DO NOTHING;

-- Performance optimization settings
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET pg_stat_statements.track = all;
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_duration = on;
ALTER SYSTEM SET log_min_duration_statement = 1000;

-- Vacuum and analyze for optimal performance
VACUUM ANALYZE;