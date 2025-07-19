-- PostgreSQL Initialization Script for Prompt Card System
-- This script sets up the database schema for production use

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS prompt_cards;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS system;

-- Set default schema
SET search_path TO prompt_cards, public;

-- Prompt Cards table
CREATE TABLE IF NOT EXISTS prompt_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    description TEXT,
    tags JSONB DEFAULT '[]',
    category VARCHAR(100),
    variables JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    is_active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1
);

-- Test Cases table
CREATE TABLE IF NOT EXISTS test_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt_card_id UUID REFERENCES prompt_cards(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    input_variables JSONB DEFAULT '{}',
    expected_output TEXT,
    test_type VARCHAR(50) DEFAULT 'functional',
    assertions JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Test Executions table
CREATE TABLE IF NOT EXISTS test_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_case_id UUID REFERENCES test_cases(id) ON DELETE CASCADE,
    prompt_card_id UUID REFERENCES prompt_cards(id) ON DELETE CASCADE,
    execution_id UUID NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    actual_output TEXT,
    execution_time_ms INTEGER,
    model_used VARCHAR(100),
    error_message TEXT,
    assertion_results JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by UUID
);

-- Analytics Events table
CREATE TABLE IF NOT EXISTS analytics.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    entity_type VARCHAR(50),
    properties JSONB DEFAULT '{}',
    session_id VARCHAR(255),
    user_id UUID,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);

-- System Metrics table
CREATE TABLE IF NOT EXISTS system.metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC,
    metric_type VARCHAR(50),
    tags JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Performance Logs table
CREATE TABLE IF NOT EXISTS system.performance_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation VARCHAR(100) NOT NULL,
    duration_ms INTEGER NOT NULL,
    resource_usage JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_prompt_cards_title ON prompt_cards USING gin(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_prompt_cards_content ON prompt_cards USING gin(content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_prompt_cards_tags ON prompt_cards USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_prompt_cards_category ON prompt_cards(category);
CREATE INDEX IF NOT EXISTS idx_prompt_cards_created_at ON prompt_cards(created_at);
CREATE INDEX IF NOT EXISTS idx_prompt_cards_active ON prompt_cards(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_test_cases_prompt_card_id ON test_cases(prompt_card_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_type ON test_cases(test_type);
CREATE INDEX IF NOT EXISTS idx_test_cases_active ON test_cases(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_test_executions_test_case_id ON test_executions(test_case_id);
CREATE INDEX IF NOT EXISTS idx_test_executions_execution_id ON test_executions(execution_id);
CREATE INDEX IF NOT EXISTS idx_test_executions_status ON test_executions(status);
CREATE INDEX IF NOT EXISTS idx_test_executions_started_at ON test_executions(started_at);

CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics.events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_entity ON analytics.events(entity_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics.events(timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON analytics.events(session_id);

CREATE INDEX IF NOT EXISTS idx_system_metrics_name ON system.metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system.metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_system_metrics_tags ON system.metrics USING gin(tags);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_prompt_cards_updated_at 
    BEFORE UPDATE ON prompt_cards 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_test_cases_updated_at 
    BEFORE UPDATE ON test_cases 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views for common queries
CREATE OR REPLACE VIEW prompt_cards_with_stats AS
SELECT 
    pc.*,
    COUNT(tc.id) as test_count,
    COUNT(CASE WHEN te.status = 'passed' THEN 1 END) as passed_tests,
    COUNT(CASE WHEN te.status = 'failed' THEN 1 END) as failed_tests,
    COALESCE(AVG(te.execution_time_ms), 0) as avg_execution_time
FROM prompt_cards pc
LEFT JOIN test_cases tc ON pc.id = tc.prompt_card_id AND tc.is_active = true
LEFT JOIN test_executions te ON tc.id = te.test_case_id
WHERE pc.is_active = true
GROUP BY pc.id;

-- Partitioning for large tables (analytics events)
CREATE TABLE IF NOT EXISTS analytics.events_y2024m01 PARTITION OF analytics.events
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE IF NOT EXISTS analytics.events_y2024m02 PARTITION OF analytics.events
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Add more partitions as needed...

-- Performance monitoring function
CREATE OR REPLACE FUNCTION system.log_performance(
    operation_name VARCHAR(100),
    duration_ms INTEGER,
    resource_data JSONB DEFAULT NULL,
    meta_data JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO system.performance_logs (operation, duration_ms, resource_usage, metadata)
    VALUES (operation_name, duration_ms, COALESCE(resource_data, '{}'), COALESCE(meta_data, '{}'))
    RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- Analytics function for event tracking
CREATE OR REPLACE FUNCTION analytics.track_event(
    event_name VARCHAR(100),
    entity_uuid UUID DEFAULT NULL,
    entity_type_name VARCHAR(50) DEFAULT NULL,
    event_properties JSONB DEFAULT NULL,
    session_uuid VARCHAR(255) DEFAULT NULL,
    user_uuid UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    event_id UUID;
BEGIN
    INSERT INTO analytics.events (event_type, entity_id, entity_type, properties, session_id, user_id)
    VALUES (event_name, entity_uuid, entity_type_name, COALESCE(event_properties, '{}'), session_uuid, user_uuid)
    RETURNING id INTO event_id;
    
    RETURN event_id;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT USAGE ON SCHEMA prompt_cards TO promptcard;
GRANT USAGE ON SCHEMA analytics TO promptcard;
GRANT USAGE ON SCHEMA system TO promptcard;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA prompt_cards TO promptcard;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA analytics TO promptcard;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA system TO promptcard;

GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA prompt_cards TO promptcard;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA analytics TO promptcard;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA system TO promptcard;

-- Initial data (optional)
INSERT INTO prompt_cards (title, content, description, category, tags) VALUES
('Welcome Prompt', 'Welcome to the Prompt Card System! This is a sample prompt.', 'A sample welcome prompt for testing', 'general', '["welcome", "sample"]'),
('Test Generation', 'Generate comprehensive test cases for the following functionality: {{functionality}}', 'Helps generate test cases for any functionality', 'testing', '["testing", "automation"]'),
('Code Review', 'Please review the following code and provide feedback: {{code}}', 'Template for code review prompts', 'development', '["code", "review", "development"]')
ON CONFLICT DO NOTHING;

-- Database maintenance tasks
CREATE OR REPLACE FUNCTION system.cleanup_old_analytics() RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM analytics.events 
    WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create a maintenance schedule (requires pg_cron extension if available)
-- SELECT cron.schedule('cleanup-analytics', '0 2 * * *', 'SELECT system.cleanup_old_analytics();');

COMMIT;