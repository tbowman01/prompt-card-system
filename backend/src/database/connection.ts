import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATABASE_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../../data/database.sqlite');

// Ensure data directory exists
const dataDir = path.dirname(DATABASE_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db: any = new Database(DATABASE_PATH, {
  verbose: process.env.NODE_ENV === 'development' ? console.log : undefined
});

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database tables
export function initializeDatabase(): any {
  console.log('Initializing database...');
  
  // Create prompt_cards table
  db.exec(`
    CREATE TABLE IF NOT EXISTS prompt_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      prompt_template TEXT NOT NULL,
      variables TEXT DEFAULT '[]', -- JSON array of variable names
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create test_cases table
  db.exec(`
    CREATE TABLE IF NOT EXISTS test_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prompt_card_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      input_variables TEXT NOT NULL, -- JSON object
      expected_output TEXT,
      assertions TEXT DEFAULT '[]', -- JSON array of assertion objects
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (prompt_card_id) REFERENCES prompt_cards(id) ON DELETE CASCADE
    )
  `);

  // Create enhanced test_results table for Phase 4
  db.exec(`
    CREATE TABLE IF NOT EXISTS test_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_case_id INTEGER NOT NULL,
      execution_id TEXT NOT NULL,
      model TEXT NOT NULL,
      response TEXT NOT NULL,
      passed BOOLEAN NOT NULL,
      assertions TEXT DEFAULT '[]', -- JSON array of assertion results
      execution_time_ms INTEGER,
      error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (test_case_id) REFERENCES test_cases(id) ON DELETE CASCADE
    )
  `);

  // Create test execution queue table
  db.exec(`
    CREATE TABLE IF NOT EXISTS test_execution_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      execution_id TEXT UNIQUE NOT NULL,
      prompt_card_id INTEGER NOT NULL,
      test_case_ids TEXT NOT NULL, -- JSON array
      model TEXT NOT NULL,
      status TEXT DEFAULT 'pending', -- pending, running, completed, failed, cancelled
      priority INTEGER DEFAULT 0,
      configuration TEXT, -- JSON
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      started_at DATETIME,
      completed_at DATETIME,
      error_message TEXT,
      FOREIGN KEY (prompt_card_id) REFERENCES prompt_cards(id)
    )
  `);

  // Create cost tracking tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS cost_tracking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      execution_id TEXT NOT NULL,
      model TEXT NOT NULL,
      prompt_tokens INTEGER NOT NULL DEFAULT 0,
      completion_tokens INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      cost_usd REAL NOT NULL DEFAULT 0,
      execution_time_ms INTEGER NOT NULL DEFAULT 0,
      test_case_id INTEGER,
      prompt_card_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (test_case_id) REFERENCES test_cases(id) ON DELETE CASCADE,
      FOREIGN KEY (prompt_card_id) REFERENCES prompt_cards(id) ON DELETE CASCADE
    )
  `);

  // Model pricing table
  db.exec(`
    CREATE TABLE IF NOT EXISTS model_pricing (
      model TEXT PRIMARY KEY,
      prompt_token_cost REAL NOT NULL,
      completion_token_cost REAL NOT NULL,
      context_window INTEGER NOT NULL,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Budget alerts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS budget_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('daily', 'weekly', 'monthly', 'total')),
      threshold REAL NOT NULL,
      current_amount REAL DEFAULT 0,
      percentage_used REAL DEFAULT 0,
      status TEXT DEFAULT 'active' CHECK (status IN ('active', 'triggered', 'exceeded')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      triggered_at DATETIME
    )
  `);

  // Cost optimization settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS cost_optimization_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      enable_auto_optimization BOOLEAN DEFAULT 1,
      cost_threshold REAL DEFAULT 10.0,
      token_threshold INTEGER DEFAULT 100000,
      model_preferences TEXT DEFAULT '[]',
      prompt_optimization BOOLEAN DEFAULT 1,
      batching_enabled BOOLEAN DEFAULT 1,
      caching_enabled BOOLEAN DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes for better performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_prompt_cards_title ON prompt_cards(title);
    CREATE INDEX IF NOT EXISTS idx_test_cases_prompt_card_id ON test_cases(prompt_card_id);
    CREATE INDEX IF NOT EXISTS idx_test_results_test_case_id ON test_results(test_case_id);
    CREATE INDEX IF NOT EXISTS idx_test_results_execution_id ON test_results(execution_id);
    CREATE INDEX IF NOT EXISTS idx_test_queue_status ON test_execution_queue(status);
    CREATE INDEX IF NOT EXISTS idx_test_queue_priority ON test_execution_queue(priority DESC);
    CREATE INDEX IF NOT EXISTS idx_cost_tracking_execution_id ON cost_tracking(execution_id);
    CREATE INDEX IF NOT EXISTS idx_cost_tracking_model ON cost_tracking(model);
    CREATE INDEX IF NOT EXISTS idx_cost_tracking_created_at ON cost_tracking(created_at);
  `);

  console.log('Database initialized successfully');
  return db;
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Closing database connection...');
  db.close();
  process.exit(0);
});

export default db;