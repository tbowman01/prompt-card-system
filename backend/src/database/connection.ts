import Database, { type Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATABASE_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../../data/database.sqlite');

// Ensure data directory exists
const dataDir = path.dirname(DATABASE_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db: DatabaseType = new Database(DATABASE_PATH, {
  verbose: process.env.NODE_ENV === 'development' ? console.log : undefined
});

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database tables
export function initializeDatabase() {
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

  // Create test_results table (optional for MVP)
  db.exec(`
    CREATE TABLE IF NOT EXISTS test_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_case_id INTEGER NOT NULL,
      execution_id TEXT NOT NULL,
      llm_output TEXT NOT NULL,
      passed BOOLEAN NOT NULL,
      assertion_results TEXT DEFAULT '[]', -- JSON array
      execution_time_ms INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (test_case_id) REFERENCES test_cases(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for better performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_prompt_cards_title ON prompt_cards(title);
    CREATE INDEX IF NOT EXISTS idx_test_cases_prompt_card_id ON test_cases(prompt_card_id);
    CREATE INDEX IF NOT EXISTS idx_test_results_test_case_id ON test_results(test_case_id);
    CREATE INDEX IF NOT EXISTS idx_test_results_execution_id ON test_results(execution_id);
  `);

  console.log('Database initialized successfully');
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Closing database connection...');
  db.close();
  process.exit(0);
});

export default db;