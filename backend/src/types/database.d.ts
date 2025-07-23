import { Database as BetterSqlite3Database } from 'better-sqlite3';

declare global {
  type Database = BetterSqlite3Database;
  
  interface DatabaseConnection {
    prepare: (sql: string) => {
      run: (...params: any[]) => Promise<any>;
      get: (...params: any[]) => Promise<any>;
      all: (...params: any[]) => Promise<any[]>;
    };
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