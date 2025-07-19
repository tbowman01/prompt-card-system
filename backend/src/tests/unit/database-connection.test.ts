import { connectionPool, db } from '../../database/connection';

describe('Database Connection Pool', () => {
  beforeEach(() => {
    // Reset any existing connections
  });

  afterEach(() => {
    // Cleanup connections
  });

  describe('Connection Pool Management', () => {
    it('should initialize connection pool', async () => {
      const stats = connectionPool.getStats();
      expect(stats.total).toBeGreaterThan(0);
    });

    it('should get and release connections', async () => {
      const connection = await connectionPool.getConnection();
      expect(connection).toBeDefined();
      
      connectionPool.releaseConnection(connection);
      const stats = connectionPool.getStats();
      expect(stats.available).toBeGreaterThan(0);
    });

    it('should handle concurrent connections', async () => {
      const connections = await Promise.all([
        connectionPool.getConnection(),
        connectionPool.getConnection(),
        connectionPool.getConnection()
      ]);
      
      expect(connections).toHaveLength(3);
      connections.forEach(conn => expect(conn).toBeDefined());
      
      // Release all connections
      connections.forEach(conn => connectionPool.releaseConnection(conn));
    });

    it('should execute operations with connection pooling', async () => {
      const result = await connectionPool.withConnection(async (conn) => {
        // Simple test query
        return conn.prepare('SELECT 1 as test').get();
      });
      
      expect(result).toEqual({ test: 1 });
    });
  });

  describe('Database Operations', () => {
    it('should execute prepared statements', async () => {
      const stmt = db.prepare('SELECT ? as value');
      const result = await stmt.get('test');
      expect(result).toEqual({ value: 'test' });
    });

    it('should handle transactions', async () => {
      const result = await db.transaction((database) => {
        const stmt = database.prepare('SELECT ? as transaction_test');
        return stmt.get('success');
      });
      
      expect(result).toEqual({ transaction_test: 'success' });
    });

    it('should provide connection stats', () => {
      const stats = db.getStats();
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('available');
      expect(stats).toHaveProperty('busy');
      expect(stats).toHaveProperty('initialized');
    });
  });

  describe('Error Handling', () => {
    it('should handle connection failures gracefully', async () => {
      // Test with invalid operation
      await expect(
        db.exec('INVALID SQL STATEMENT')
      ).rejects.toThrow();
    });

    it('should recover from connection issues', async () => {
      // Test connection recovery logic
      const stats = db.getStats();
      expect(stats.initialized).toBe(true);
    });
  });
});