/**
 * Enhanced Collaboration Service Tests
 * Comprehensive tests for real-time collaboration features
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { AddressInfo } from 'net';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import EnhancedCollaborationService from '../../services/collaboration/EnhancedCollaborationService';
import { DatabaseConnection } from '../../database/connection';

describe('Enhanced Collaboration Service', () => {
  let httpServer: any;
  let io: Server;
  let collaborationService: EnhancedCollaborationService;
  let clientSocket: ClientSocket;
  let serverSocket: any;
  let port: number;
  let db: DatabaseConnection;
  
  const testUser = {
    id: 'test-user-1',
    username: 'testuser',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    permissions: ['document:read', 'document:write']
  };
  
  const testDocument = {
    id: 'test-document-1',
    workspaceId: 'test-workspace-1',
    title: 'Test Document',
    content: 'Initial content'
  };

  beforeAll(async () => {
    // Setup test database
    db = new DatabaseConnection();
    
    // Create test data
    await setupTestData();
    
    // Setup HTTP server and Socket.IO
    httpServer = createServer();
    io = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    // Initialize collaboration service
    collaborationService = new EnhancedCollaborationService(io, {
      maxConcurrentUsers: 10,
      analyticsEnabled: false,
      performanceMonitoring: false
    });
    
    // Start server
    await new Promise<void>((resolve) => {
      httpServer.listen(() => {
        port = (httpServer.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    // Cleanup
    await collaborationService.cleanup();
    io.close();
    httpServer.close();
    await cleanupTestData();
  });

  beforeEach(async () => {
    // Create client socket for each test
    clientSocket = Client(`http://localhost:${port}`);
    
    await new Promise<void>((resolve) => {
      clientSocket.on('connect', () => {
        resolve();
      });
    });
    
    // Mock authentication
    clientSocket.emit('authenticate', {
      token: 'mock-jwt-token'
    });
    
    await new Promise<void>((resolve) => {
      clientSocket.on('authenticated', () => {
        resolve();
      });
    });
  });
  
  afterEach(() => {
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('Document Collaboration', () => {
    it('should allow user to join document', async () => {
      const joinPromise = new Promise<any>((resolve) => {
        clientSocket.on('document-joined', resolve);
      });
      
      clientSocket.emit('join-document', {
        documentId: testDocument.id,
        workspaceId: testDocument.workspaceId
      });
      
      const result = await joinPromise;
      
      expect(result).toHaveProperty('document');
      expect(result.document.id).toBe(testDocument.id);
      expect(result).toHaveProperty('documentState');
      expect(result).toHaveProperty('participants');
    });
    
    it('should track active participants', async () => {
      // First user joins
      clientSocket.emit('join-document', {
        documentId: testDocument.id,
        workspaceId: testDocument.workspaceId
      });
      
      await new Promise<void>((resolve) => {
        clientSocket.on('document-joined', () => resolve());
      });
      
      const sessions = collaborationService.getDocumentSessions(testDocument.id);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].userId).toBe(testUser.id);
    });
    
    it('should handle document operations', async () => {
      // Join document first
      clientSocket.emit('join-document', {
        documentId: testDocument.id,
        workspaceId: testDocument.workspaceId
      });
      
      await new Promise<void>((resolve) => {
        clientSocket.on('document-joined', () => resolve());
      });
      
      const operationPromise = new Promise<any>((resolve) => {
        clientSocket.on('operation-ack', resolve);
      });
      
      // Send operation
      clientSocket.emit('operation', {
        id: 'op-1',
        type: 'insert',
        position: 0,
        content: 'Hello ',
        timestamp: Date.now(),
        sequenceNumber: 1,
        clientId: 'client-1'
      });
      
      const ack = await operationPromise;
      
      expect(ack.success).toBe(true);
      expect(ack.operationId).toBe('op-1');
    });
    
    it('should broadcast operations to other participants', async () => {
      // Create second client
      const client2 = Client(`http://localhost:${port}`);
      
      await new Promise<void>((resolve) => {
        client2.on('connect', resolve);
      });
      
      // Both clients join document
      clientSocket.emit('join-document', {
        documentId: testDocument.id,
        workspaceId: testDocument.workspaceId
      });
      
      client2.emit('join-document', {
        documentId: testDocument.id,
        workspaceId: testDocument.workspaceId
      });
      
      await Promise.all([
        new Promise<void>((resolve) => {
          clientSocket.on('document-joined', () => resolve());
        }),
        new Promise<void>((resolve) => {
          client2.on('document-joined', () => resolve());
        })
      ]);
      
      // Setup listener for broadcasted operation
      const operationPromise = new Promise<any>((resolve) => {
        client2.on('operation', resolve);
      });
      
      // Client 1 sends operation
      clientSocket.emit('operation', {
        id: 'op-broadcast-1',
        type: 'insert',
        position: 5,
        content: 'World',
        timestamp: Date.now(),
        sequenceNumber: 1,
        clientId: 'client-1'
      });
      
      const receivedOperation = await operationPromise;
      
      expect(receivedOperation.id).toBe('op-broadcast-1');
      expect(receivedOperation.content).toBe('World');
      
      client2.disconnect();
    });
  });

  describe('Comments and Communication', () => {
    beforeEach(async () => {
      // Join document for comment tests
      clientSocket.emit('join-document', {
        documentId: testDocument.id,
        workspaceId: testDocument.workspaceId
      });
      
      await new Promise<void>((resolve) => {
        clientSocket.on('document-joined', () => resolve());
      });
    });
    
    it('should create comments', async () => {
      const commentPromise = new Promise<any>((resolve) => {
        clientSocket.on('comment-ack', resolve);
      });
      
      clientSocket.emit('create-comment', {
        tempId: 'temp-1',
        content: 'This is a test comment',
        positionData: {
          line: 1,
          character: 0
        }
      });
      
      const result = await commentPromise;
      
      expect(result).toHaveProperty('comment');
      expect(result.comment.content).toBe('This is a test comment');
      expect(result.tempId).toBe('temp-1');
    });
    
    it('should broadcast comments to participants', async () => {
      const client2 = Client(`http://localhost:${port}`);
      
      await new Promise<void>((resolve) => {
        client2.on('connect', resolve);
      });
      
      client2.emit('join-document', {
        documentId: testDocument.id,
        workspaceId: testDocument.workspaceId
      });
      
      await new Promise<void>((resolve) => {
        client2.on('document-joined', () => resolve());
      });
      
      const commentPromise = new Promise<any>((resolve) => {
        client2.on('comment-created', resolve);
      });
      
      clientSocket.emit('create-comment', {
        tempId: 'temp-broadcast-1',
        content: 'Broadcast comment test'
      });
      
      const receivedComment = await commentPromise;
      
      expect(receivedComment.content).toBe('Broadcast comment test');
      
      client2.disconnect();
    });
  });

  describe('Presence and Cursors', () => {
    beforeEach(async () => {
      clientSocket.emit('join-document', {
        documentId: testDocument.id,
        workspaceId: testDocument.workspaceId
      });
      
      await new Promise<void>((resolve) => {
        clientSocket.on('document-joined', () => resolve());
      });
    });
    
    it('should handle cursor updates', async () => {
      const client2 = Client(`http://localhost:${port}`);
      
      await new Promise<void>((resolve) => {
        client2.on('connect', resolve);
      });
      
      client2.emit('join-document', {
        documentId: testDocument.id,
        workspaceId: testDocument.workspaceId
      });
      
      await new Promise<void>((resolve) => {
        client2.on('document-joined', () => resolve());
      });
      
      const cursorPromise = new Promise<any>((resolve) => {
        client2.on('cursor-update', resolve);
      });
      
      clientSocket.emit('cursor-update', {
        position: 10,
        selection: { start: 5, end: 15 }
      });
      
      const cursorUpdate = await cursorPromise;
      
      expect(cursorUpdate.position).toBe(10);
      expect(cursorUpdate.selection).toEqual({ start: 5, end: 15 });
      
      client2.disconnect();
    });
    
    it('should handle presence updates', async () => {
      const client2 = Client(`http://localhost:${port}`);
      
      await new Promise<void>((resolve) => {
        client2.on('connect', resolve);
      });
      
      client2.emit('join-document', {
        documentId: testDocument.id,
        workspaceId: testDocument.workspaceId
      });
      
      await new Promise<void>((resolve) => {
        client2.on('document-joined', () => resolve());
      });
      
      const presencePromise = new Promise<any>((resolve) => {
        client2.on('presence-update', resolve);
      });
      
      clientSocket.emit('presence-update', {
        status: 'active',
        cursorPosition: { line: 1, column: 5 }
      });
      
      const presenceUpdate = await presencePromise;
      
      expect(presenceUpdate.status).toBe('active');
      expect(presenceUpdate.cursorPosition).toEqual({ line: 1, column: 5 });
      
      client2.disconnect();
    });
  });

  describe('Document Locking', () => {
    beforeEach(async () => {
      clientSocket.emit('join-document', {
        documentId: testDocument.id,
        workspaceId: testDocument.workspaceId
      });
      
      await new Promise<void>((resolve) => {
        clientSocket.on('document-joined', () => resolve());
      });
    });
    
    it('should acquire exclusive lock', async () => {
      const lockPromise = new Promise<any>((resolve) => {
        clientSocket.on('lock-acquired', resolve);
      });
      
      clientSocket.emit('acquire-lock', {
        documentId: testDocument.id,
        lockType: 'exclusive'
      });
      
      const lockResult = await lockPromise;
      
      expect(lockResult.documentId).toBe(testDocument.id);
      expect(lockResult.lock.lockType).toBe('exclusive');
    });
    
    it('should prevent conflicting locks', async () => {
      // First client acquires lock
      clientSocket.emit('acquire-lock', {
        documentId: testDocument.id,
        lockType: 'exclusive'
      });
      
      await new Promise<void>((resolve) => {
        clientSocket.on('lock-acquired', () => resolve());
      });
      
      // Second client tries to acquire lock
      const client2 = Client(`http://localhost:${port}`);
      
      await new Promise<void>((resolve) => {
        client2.on('connect', resolve);
      });
      
      client2.emit('join-document', {
        documentId: testDocument.id,
        workspaceId: testDocument.workspaceId
      });
      
      await new Promise<void>((resolve) => {
        client2.on('document-joined', () => resolve());
      });
      
      const denyPromise = new Promise<any>((resolve) => {
        client2.on('lock-denied', resolve);
      });
      
      client2.emit('acquire-lock', {
        documentId: testDocument.id,
        lockType: 'exclusive'
      });
      
      const denyResult = await denyPromise;
      
      expect(denyResult.documentId).toBe(testDocument.id);
      expect(denyResult.reason).toContain('already locked');
      
      client2.disconnect();
    });
  });

  describe('Performance and Metrics', () => {
    it('should track collaboration metrics', () => {
      const metrics = collaborationService.getMetrics();
      
      expect(metrics).toHaveProperty('activeSessions');
      expect(metrics).toHaveProperty('totalOperations');
      expect(metrics).toHaveProperty('averageLatency');
      expect(metrics).toHaveProperty('documentsActive');
      expect(typeof metrics.activeSessions).toBe('number');
    });
    
    it('should handle concurrent users within limit', async () => {
      const clients = [];
      const connectionPromises = [];
      
      // Create multiple concurrent connections (within limit)
      for (let i = 0; i < 5; i++) {
        const client = Client(`http://localhost:${port}`);
        clients.push(client);
        
        const promise = new Promise<void>((resolve) => {
          client.on('connect', () => {
            client.emit('join-document', {
              documentId: testDocument.id,
              workspaceId: testDocument.workspaceId
            });
            
            client.on('document-joined', () => resolve());
          });
        });
        
        connectionPromises.push(promise);
      }
      
      await Promise.all(connectionPromises);
      
      const sessions = collaborationService.getDocumentSessions(testDocument.id);
      expect(sessions.length).toBeGreaterThan(0);
      expect(sessions.length).toBeLessThanOrEqual(6); // Including main test client
      
      // Clean up
      clients.forEach(client => client.disconnect());
    });
  });

  describe('Error Handling', () => {
    it('should handle unauthenticated requests', async () => {
      const unauthClient = Client(`http://localhost:${port}`);
      
      await new Promise<void>((resolve) => {
        unauthClient.on('connect', resolve);
      });
      
      const errorPromise = new Promise<any>((resolve) => {
        unauthClient.on('error', resolve);
      });
      
      // Try to join document without authentication
      unauthClient.emit('join-document', {
        documentId: testDocument.id,
        workspaceId: testDocument.workspaceId
      });
      
      const error = await errorPromise;
      
      expect(error.message).toContain('authenticated');
      
      unauthClient.disconnect();
    });
    
    it('should handle invalid document operations', async () => {
      clientSocket.emit('join-document', {
        documentId: testDocument.id,
        workspaceId: testDocument.workspaceId
      });
      
      await new Promise<void>((resolve) => {
        clientSocket.on('document-joined', () => resolve());
      });
      
      const ackPromise = new Promise<any>((resolve) => {
        clientSocket.on('operation-ack', resolve);
      });
      
      // Send invalid operation (missing required fields)
      clientSocket.emit('operation', {
        id: 'invalid-op',
        type: 'insert'
        // Missing position, content, etc.
      });
      
      const ack = await ackPromise;
      
      expect(ack.success).toBe(false);
      expect(ack.error).toBeDefined();
    });
  });

  // Helper functions
  async function setupTestData(): Promise<void> {
    try {
      // Create test organization
      await db.query(`
        INSERT INTO collaboration.organizations (id, name, slug, created_at, updated_at) 
        VALUES ('test-org-1', 'Test Organization', 'test-org', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `);
      
      // Create test user
      await db.query(`
        INSERT INTO collaboration.users (id, email, username, first_name, last_name, created_at, updated_at) 
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `, [testUser.id, testUser.email, testUser.username, testUser.firstName, testUser.lastName]);
      
      // Create test workspace
      await db.query(`
        INSERT INTO collaboration.workspaces (id, organization_id, name, created_by, created_at, updated_at) 
        VALUES ('test-workspace-1', 'test-org-1', 'Test Workspace', $1, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `, [testUser.id]);
      
      // Add user to workspace
      await db.query(`
        INSERT INTO collaboration.workspace_memberships (id, workspace_id, user_id, role, joined_at) 
        VALUES ('test-membership-1', 'test-workspace-1', $1, 'admin', NOW())
        ON CONFLICT (workspace_id, user_id) DO NOTHING
      `, [testUser.id]);
      
      // Create test document
      await db.query(`
        INSERT INTO collaboration.documents (id, workspace_id, title, content, created_by, created_at, updated_at) 
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `, [testDocument.id, testDocument.workspaceId, testDocument.title, testDocument.content, testUser.id]);
      
    } catch (error) {
      console.error('Error setting up test data:', error);
    }
  }
  
  async function cleanupTestData(): Promise<void> {
    try {
      // Clean up in reverse order due to foreign key constraints
      await db.query('DELETE FROM collaboration.documents WHERE id LIKE \'test-%\'');
      await db.query('DELETE FROM collaboration.workspace_memberships WHERE id LIKE \'test-%\'');
      await db.query('DELETE FROM collaboration.workspaces WHERE id LIKE \'test-%\'');
      await db.query('DELETE FROM collaboration.users WHERE id LIKE \'test-%\'');
      await db.query('DELETE FROM collaboration.organizations WHERE id LIKE \'test-%\'');
    } catch (error) {
      console.error('Error cleaning up test data:', error);
    }
  }
});

// Mock authentication for tests
jest.mock('../../services/auth/EnterpriseAuthService', () => {
  return {
    EnterpriseAuthService: jest.fn().mockImplementation(() => ({
      verifyToken: jest.fn().mockResolvedValue({
        id: 'test-user-1',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        permissions: ['document:read', 'document:write']
      }),
      checkDocumentAccess: jest.fn().mockResolvedValue(true),
      checkWorkspaceAccess: jest.fn().mockResolvedValue(true)
    }))
  };
});