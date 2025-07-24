import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Import database types
import type { DatabaseConnection, AsyncDatabaseConnection, PreparedStatement, AsyncPreparedStatement } from '../types/database';

const DATABASE_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../../data/database.sqlite');

// Connection pool configuration
interface ConnectionPoolConfig {
  maxConnections: number;
  idleTimeout: number;
  retryAttempts: number;
  retryDelay: number;
}

const poolConfig: ConnectionPoolConfig = {
  maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '5'),
  idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
  retryAttempts: parseInt(process.env.DB_RETRY_ATTEMPTS || '3'),
  retryDelay: parseInt(process.env.DB_RETRY_DELAY || '1000')
};

// Connection pool implementation
class DatabaseConnectionPool {
  private connections: Database.Database[] = [];
  private availableConnections: Database.Database[] = [];
  private busyConnections: Set<Database.Database> = new Set();
  private initialized = false;
  private retryCount = 0;

  constructor(private dbPath: string, private config: ConnectionPoolConfig) {}

  private createConnection(): Database.Database {
    // Ensure data directory exists
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const connection = new Database(this.dbPath, {
      verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
      timeout: 5000 // 5 second timeout
    });

    // Enable foreign keys and optimize for concurrent access
    connection.pragma('foreign_keys = ON');
    connection.pragma('journal_mode = WAL');
    connection.pragma('synchronous = NORMAL');
    connection.pragma('cache_size = 1000');
    connection.pragma('temp_store = memory');
    
    return connection;
  }

  private async initializePool(): Promise<void> {
    if (this.initialized) return;

    try {
      // Create initial connections
      for (let i = 0; i < this.config.maxConnections; i++) {
        const connection = this.createConnection();
        this.connections.push(connection);
        this.availableConnections.push(connection);
      }
      
      this.initialized = true;
      this.retryCount = 0;
      console.log(`Database connection pool initialized with ${this.config.maxConnections} connections`);
    } catch (error) {
      console.error('Failed to initialize database connection pool:', error);
      await this.retryConnection();
    }
  }

  private async retryConnection(): Promise<void> {
    if (this.retryCount >= this.config.retryAttempts) {
      throw new Error(`Failed to connect to database after ${this.config.retryAttempts} attempts`);
    }

    this.retryCount++;
    console.log(`Retrying database connection (attempt ${this.retryCount}/${this.config.retryAttempts})...`);
    
    await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * this.retryCount));
    await this.initializePool();
  }

  async getConnection(): Promise<Database.Database> {
    if (!this.initialized) {
      await this.initializePool();
    }

    if (this.availableConnections.length === 0) {
      // Wait for a connection to become available
      await new Promise(resolve => setTimeout(resolve, 10));
      return this.getConnection();
    }

    const connection = this.availableConnections.pop()!;
    this.busyConnections.add(connection);
    return connection;
  }

  releaseConnection(connection: Database.Database): void {
    if (this.busyConnections.has(connection)) {
      this.busyConnections.delete(connection);
      this.availableConnections.push(connection);
    }
  }

  async withConnection<T>(operation: (db: Database.Database) => Promise<T> | T): Promise<T> {
    const connection = await this.getConnection();
    try {
      return await operation(connection);
    } finally {
      this.releaseConnection(connection);
    }
  }

  getStats() {
    return {
      total: this.connections.length,
      available: this.availableConnections.length,
      busy: this.busyConnections.size,
      initialized: this.initialized
    };
  }

  close(): void {
    this.connections.forEach(conn => {
      try {
        conn.close();
      } catch (error) {
        console.error('Error closing database connection:', error);
      }
    });
    this.connections = [];
    this.availableConnections = [];
    this.busyConnections.clear();
    this.initialized = false;
  }
}

// Create global connection pool
const connectionPool = new DatabaseConnectionPool(DATABASE_PATH, poolConfig);

// Export properly typed db interface
export const db: DatabaseConnection = {
  prepare: (sql: string): PreparedStatement => {
    // Return sync interface for existing code compatibility
    const stmt = {
      run: (...params: any[]) => {
        // Synchronous wrapper around async pool
        const conn = connectionPool.connections[0]; // Use first available connection
        if (!conn) throw new Error('No database connection available');
        return conn.prepare(sql).run(...params);
      },
      get: (...params: any[]) => {
        const conn = connectionPool.connections[0];
        if (!conn) throw new Error('No database connection available');
        return conn.prepare(sql).get(...params);
      },
      all: (...params: any[]) => {
        const conn = connectionPool.connections[0];
        if (!conn) throw new Error('No database connection available');
        return conn.prepare(sql).all(...params);
      }
    };
    return stmt;
  },
  exec: (sql: string) => {
    // Synchronous exec for compatibility
    const conn = connectionPool.connections[0];
    if (!conn) throw new Error('No database connection available');
    try {
      return conn.exec(sql);
    } catch (error) {
      throw error;
    }
  },
  pragma: (pragma: string) => {
    const conn = connectionPool.connections[0];
    if (!conn) throw new Error('No database connection available');
    return conn.pragma(pragma);
  },
  close: () => connectionPool.close(),
  transaction: (operations: (db: Database.Database) => any) => {
    const conn = connectionPool.connections[0];
    if (!conn) throw new Error('No database connection available');
    const transaction = conn.transaction(operations);
    return transaction(conn);
  },
  getStats: () => connectionPool.getStats()
};

// Export async database interface for modern services
export const asyncDb: AsyncDatabaseConnection = {
  prepare: (sql: string): AsyncPreparedStatement => {
    return {
      run: async (...params: any[]) => {
        return connectionPool.withConnection((conn) => {
          const stmt = conn.prepare(sql);
          return stmt.run(...params);
        });
      },
      get: async (...params: any[]) => {
        return connectionPool.withConnection((conn) => {
          const stmt = conn.prepare(sql);
          return stmt.get(...params);
        });
      },
      all: async (...params: any[]) => {
        return connectionPool.withConnection((conn) => {
          const stmt = conn.prepare(sql);
          return stmt.all(...params);
        });
      }
    };
  },
  exec: async (sql: string) => {
    return connectionPool.withConnection((conn) => {
      try {
        return conn.exec(sql);
      } catch (error) {
        throw error;
      }
    });
  },
  pragma: async (pragma: string) => {
    return connectionPool.withConnection((conn) => conn.pragma(pragma));
  },
  close: () => connectionPool.close(),
  transaction: (operations: (db: Database.Database) => any) => {
    return connectionPool.withConnection((conn) => {
      const transaction = conn.transaction(operations);
      return transaction(conn);
    });
  },
  getStats: () => connectionPool.getStats()
};

// Export connection pool for advanced usage
export { connectionPool };

// Initialize database tables
export async function initializeDatabase(): Promise<any> {
  console.log('Initializing database...');
  
  try {
    // Create prompt_cards table
    await db.exec(`
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
    await db.exec(`
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
    await db.exec(`
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
    await db.exec(`
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

    // Create assertion_types table for advanced assertion system
    await db.exec(`
      CREATE TABLE IF NOT EXISTS assertion_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT NOT NULL,
        parameters TEXT NOT NULL, -- JSON
        examples TEXT NOT NULL, -- JSON
        validator_code TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create assertion execution stats table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS assertion_execution_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assertion_type TEXT NOT NULL,
        total_executions INTEGER DEFAULT 0,
        successful_executions INTEGER DEFAULT 0,
        failed_executions INTEGER DEFAULT 0,
        total_execution_time INTEGER DEFAULT 0,
        last_executed DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(assertion_type)
      )
    `);

    // Create indexes for better performance
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_prompt_cards_title ON prompt_cards(title);
      CREATE INDEX IF NOT EXISTS idx_test_cases_prompt_card_id ON test_cases(prompt_card_id);
      CREATE INDEX IF NOT EXISTS idx_test_results_test_case_id ON test_results(test_case_id);
      CREATE INDEX IF NOT EXISTS idx_test_results_execution_id ON test_results(execution_id);
      CREATE INDEX IF NOT EXISTS idx_test_queue_status ON test_execution_queue(status);
      CREATE INDEX IF NOT EXISTS idx_test_queue_priority ON test_execution_queue(priority DESC);
      CREATE INDEX IF NOT EXISTS idx_assertion_types_name ON assertion_types(name);
      CREATE INDEX IF NOT EXISTS idx_assertion_stats_type ON assertion_execution_stats(assertion_type);
    `);

    console.log('Database initialized successfully');
    return db;
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Closing database connection...');
  db.close();
  process.exit(0);
});

export default db;