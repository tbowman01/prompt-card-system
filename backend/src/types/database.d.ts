import { Database as BetterSqlite3Database } from 'better-sqlite3';

declare global {
  type Database = BetterSqlite3Database;
  
  // Prepared statement interface for both sync and async operations
  interface PreparedStatement {
    run: (...params: any[]) => any;
    get: (...params: any[]) => any;
    all: (...params: any[]) => any[];
  }
  
  interface AsyncPreparedStatement {
    run: (...params: any[]) => Promise<any>;
    get: (...params: any[]) => Promise<any>;
    all: (...params: any[]) => Promise<any[]>;
  }
  
  interface DatabaseConnection {
    // Sync methods for backward compatibility
    prepare: (sql: string) => PreparedStatement;
    exec: (sql: string) => any;
    pragma: (pragma: string) => any;
    close: () => void;
    transaction: (operations: (db: Database) => any) => any;
    getStats: () => {
      total: number;
      available: number;
      busy: number;
      initialized: boolean;
    };
  }
  
  // Async database interface
  interface AsyncDatabaseConnection {
    prepare: (sql: string) => AsyncPreparedStatement;
    exec: (sql: string) => Promise<any>;
    pragma: (pragma: string) => Promise<any>;
    close: () => void;
    transaction: (operations: (db: Database) => any) => Promise<any>;
    getStats: () => {
      total: number;
      available: number;
      busy: number;
      initialized: boolean;
    };
  }
}

export {};