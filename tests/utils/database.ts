/**
 * Database Test Utilities
 * @description Helper functions for database testing setup and cleanup
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import Database from 'better-sqlite3';

export interface TestDatabaseConfig {
  path: string;
  migrations: string[];
  seedData?: any[];
}

let testDb: Database.Database | null = null;

/**
 * Setup test database with schema and optional seed data
 */
export async function setupTestDatabase(config?: Partial<TestDatabaseConfig>): Promise<Database.Database> {
  const dbConfig: TestDatabaseConfig = {
    path: ':memory:',
    migrations: [
      path.join(__dirname, '../../database/init/01-init.sql'),
    ],
    ...config,
  };

  // Create database connection
  testDb = new Database(dbConfig.path);
  
  // Enable foreign keys
  testDb.pragma('foreign_keys = ON');
  
  // Run migrations
  for (const migrationPath of dbConfig.migrations) {
    try {
      const migrationSql = await fs.readFile(migrationPath, 'utf-8');
      testDb.exec(migrationSql);
      console.log(`✅ Applied migration: ${migrationPath}`);
    } catch (error) {
      console.error(`❌ Failed to apply migration ${migrationPath}:`, error);
      throw error;
    }
  }

  // Insert seed data if provided
  if (dbConfig.seedData && dbConfig.seedData.length > 0) {
    await insertSeedData(testDb, dbConfig.seedData);
  }

  console.log('🗄️ Test database setup complete');
  return testDb;
}

/**
 * Clean up test database
 */
export async function cleanupTestDatabase(): Promise<void> {
  if (testDb) {
    testDb.close();
    testDb = null;
    console.log('🗄️ Test database cleaned up');
  }
}

/**
 * Reset database to clean state
 */
export async function resetTestDatabase(): Promise<void> {
  if (!testDb) {
    throw new Error('Test database not initialized');
  }

  // Get all table names
  const tables = testDb.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
  `).all() as { name: string }[];

  // Disable foreign keys temporarily
  testDb.pragma('foreign_keys = OFF');

  // Clear all tables
  for (const table of tables) {
    testDb.prepare(`DELETE FROM ${table.name}`).run();
  }

  // Re-enable foreign keys
  testDb.pragma('foreign_keys = ON');

  console.log('🔄 Test database reset complete');
}

/**
 * Insert seed data into test database
 */
export async function insertSeedData(db: Database.Database, seedData: any[]): Promise<void> {
  for (const tableData of seedData) {
    const { table, data } = tableData;
    
    if (!Array.isArray(data) || data.length === 0) {
      continue;
    }

    // Get column names from first row
    const columns = Object.keys(data[0]);
    const placeholders = columns.map(() => '?').join(', ');
    
    const insertSql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
    const insertStmt = db.prepare(insertSql);

    // Insert all rows
    for (const row of data) {
      const values = columns.map(col => row[col]);
      insertStmt.run(...values);
    }

    console.log(`📊 Inserted ${data.length} rows into ${table}`);
  }
}

/**
 * Create test prompt cards
 */
export async function createTestPromptCards(count: number = 5): Promise<any[]> {
  if (!testDb) {
    throw new Error('Test database not initialized');
  }

  const testCards = [];
  const categories = ['General', 'Technical', 'Creative', 'Business', 'Educational'];
  const statuses = ['draft', 'active', 'archived'];

  const insertStmt = testDb.prepare(`
    INSERT INTO prompt_cards (
      id, title, description, prompt, category, tags, status, 
      variables, expected_output, metadata, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (let i = 1; i <= count; i++) {
    const card = {
      id: `test-card-${i}`,
      title: `Test Prompt Card ${i}`,
      description: `Description for test card ${i}`,
      prompt: `Test prompt ${i}: {{input}}`,
      category: categories[i % categories.length],
      tags: JSON.stringify([`tag${i}`, 'test']),
      status: statuses[i % statuses.length],
      variables: JSON.stringify([
        { name: 'input', type: 'string', required: true }
      ]),
      expected_output: `Expected output ${i}`,
      metadata: JSON.stringify({ author: 'test-user' }),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    insertStmt.run(
      card.id, card.title, card.description, card.prompt, card.category,
      card.tags, card.status, card.variables, card.expected_output,
      card.metadata, card.created_at, card.updated_at
    );

    testCards.push(card);
  }

  console.log(`📝 Created ${count} test prompt cards`);
  return testCards;
}

/**
 * Create test users
 */
export async function createTestUsers(count: number = 3): Promise<any[]> {
  if (!testDb) {
    throw new Error('Test database not initialized');
  }

  const testUsers = [];
  const roles = ['user', 'admin', 'moderator'];

  const insertStmt = testDb.prepare(`
    INSERT INTO users (
      id, email, password_hash, first_name, last_name, 
      role, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (let i = 1; i <= count; i++) {
    const user = {
      id: `test-user-${i}`,
      email: `testuser${i}@example.com`,
      password_hash: 'hashed-password',
      first_name: `Test${i}`,
      last_name: 'User',
      role: roles[i % roles.length],
      is_active: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    insertStmt.run(
      user.id, user.email, user.password_hash, user.first_name,
      user.last_name, user.role, user.is_active, user.created_at, user.updated_at
    );

    testUsers.push(user);
  }

  console.log(`👥 Created ${count} test users`);
  return testUsers;
}

/**
 * Execute raw SQL query for testing
 */
export function executeTestQuery(sql: string, params: any[] = []): any {
  if (!testDb) {
    throw new Error('Test database not initialized');
  }

  try {
    if (sql.trim().toLowerCase().startsWith('select')) {
      return testDb.prepare(sql).all(...params);
    } else {
      return testDb.prepare(sql).run(...params);
    }
  } catch (error) {
    console.error('Query execution failed:', sql, params, error);
    throw error;
  }
}

/**
 * Get database statistics for testing
 */
export function getDatabaseStats(): any {
  if (!testDb) {
    throw new Error('Test database not initialized');
  }

  const tables = testDb.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
  `).all() as { name: string }[];

  const stats: any = {};

  for (const table of tables) {
    const count = testDb.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get() as { count: number };
    stats[table.name] = count.count;
  }

  return stats;
}

/**
 * Backup test database state
 */
export async function backupDatabaseState(): Promise<string> {
  if (!testDb) {
    throw new Error('Test database not initialized');
  }

  const backupPath = path.join(__dirname, '../data/backup', `test-backup-${Date.now()}.sqlite`);
  
  // Ensure backup directory exists
  await fs.mkdir(path.dirname(backupPath), { recursive: true });

  // Create backup
  const backup = testDb.backup(backupPath);
  await backup.promise;

  console.log(`💾 Database backup created: ${backupPath}`);
  return backupPath;
}

/**
 * Restore database from backup
 */
export async function restoreDatabaseState(backupPath: string): Promise<void> {
  if (!testDb) {
    throw new Error('Test database not initialized');
  }

  // Close current database
  testDb.close();

  // Restore from backup
  testDb = new Database(backupPath, { readonly: true });
  
  console.log(`🔄 Database restored from: ${backupPath}`);
}

/**
 * Wait for database operation to complete
 */
export async function waitForDatabaseOperation(
  operation: () => any,
  timeout: number = 5000
): Promise<any> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const result = operation();
      return result;
    } catch (error) {
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  throw new Error(`Database operation timed out after ${timeout}ms`);
}

/**
 * Performance test helper for database operations
 */
export async function measureDatabasePerformance(
  operation: () => any,
  iterations: number = 100
): Promise<{
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  operationsPerSecond: number;
}> {
  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const startTime = process.hrtime.bigint();
    await operation();
    const endTime = process.hrtime.bigint();
    
    const operationTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    times.push(operationTime);
  }

  const totalTime = times.reduce((sum, time) => sum + time, 0);
  const averageTime = totalTime / iterations;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const operationsPerSecond = 1000 / averageTime;

  return {
    totalTime,
    averageTime,
    minTime,
    maxTime,
    operationsPerSecond,
  };
}

// Export database instance for direct access if needed
export function getTestDatabase(): Database.Database | null {
  return testDb;
}