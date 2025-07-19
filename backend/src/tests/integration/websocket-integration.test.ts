import request from 'supertest';
import assert from 'assert';
import { io as Client, Socket } from 'socket.io-client';
import app from '../../server';
import { ProgressService } from '../../services/websocket/ProgressService';
import http from 'http';

describe('WebSocket Integration Tests', () => {
  let server: http.Server;
  let clientSocket: Socket;
  let progressService: ProgressService;
  const testCardId = 'test-websocket-card-123';
  const testSessionId = 'test-websocket-session-456';

  beforeEach(async () => {
    // Start server
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        resolve();
      });
    });

    const port = (server.address() as any).port;
    
    // Create client socket
    clientSocket = Client(`http://localhost:${port}`, {
      autoConnect: false,
      transports: ['websocket']
    });

    // Create mock Socket.IO server
    const { Server } = require('socket.io');
    const io = new Server(server);
    progressService = new ProgressService(io);
    
    // Connect client
    return new Promise<void>((resolve) => {
      clientSocket.on('connect', () => {
        resolve();
      });
      clientSocket.connect();
    });
  });

  afterEach(async () => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  describe('Real-time Progress Updates', () => {
    it('should receive test execution progress updates', async () => {
      const progressUpdates: any[] = [];
      
      // Listen for progress updates
      clientSocket.on('test_progress', (data) => {
        progressUpdates.push(data);
      });

      // Join the test session room
      clientSocket.emit('join_session', {
        sessionId: testSessionId,
        cardId: testCardId
      });

      // Wait for join confirmation
      await new Promise<void>((resolve) => {
        clientSocket.on('session_joined', () => {
          resolve();
        });
      });

      // Start a test execution
      const response = await request(app)
        .post('/api/test-execution/run')
        .send({
          cardId: testCardId,
          sessionId: testSessionId,
          testCases: [
            {
              id: 'progress-test-1',
              input: 'Test input 1',
              expectedOutput: 'Expected output 1'
            },
            {
              id: 'progress-test-2',
              input: 'Test input 2',
              expectedOutput: 'Expected output 2'
            }
          ],
          model: 'gpt-3.5-turbo',
          enableRealTimeUpdates: true
        })
        .expect(200);

      // Wait for progress updates
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 5000); // Wait 5 seconds
      });

      // Should have received progress updates
      expect(progressUpdates.length).to.be.greaterThan(0);
      
      // Check progress update structure
      const firstUpdate = progressUpdates[0];
      expect(firstUpdate).to.have.property('sessionId', testSessionId);
      expect(firstUpdate).to.have.property('cardId', testCardId);
      expect(firstUpdate).to.have.property('progress');
      expect(firstUpdate).to.have.property('currentTest');
      expect(firstUpdate).to.have.property('timestamp');
    });

    it('should receive analytics updates in real-time', async () => {
      const analyticsUpdates: any[] = [];
      
      // Listen for analytics updates
      clientSocket.on('analytics_update', (data) => {
        analyticsUpdates.push(data);
      });

      // Subscribe to analytics updates
      clientSocket.emit('subscribe_analytics', {
        cardId: testCardId
      });

      // Wait for subscription confirmation
      await new Promise<void>((resolve) => {
        clientSocket.on('analytics_subscribed', () => {
          resolve();
        });
      });

      // Trigger analytics update through test execution
      await request(app)
        .post('/api/test-execution/run')
        .send({
          cardId: testCardId,
          testCases: [
            {
              id: 'analytics-test',
              input: 'Analytics test input',
              expectedOutput: 'Expected output'
            }
          ],
          model: 'gpt-3.5-turbo',
          enableAnalytics: true
        })
        .expect(200);

      // Wait for analytics updates
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 3000);
      });

      // Should have received analytics updates
      expect(analyticsUpdates.length).to.be.greaterThan(0);
      
      const firstUpdate = analyticsUpdates[0];
      expect(firstUpdate).to.have.property('cardId', testCardId);
      expect(firstUpdate).to.have.property('metrics');
      expect(firstUpdate.metrics).to.have.property('totalTests');
      expect(firstUpdate.metrics).to.have.property('successRate');
    });

    it('should handle cost tracking updates', async () => {
      const costUpdates: any[] = [];
      
      // Listen for cost updates
      clientSocket.on('cost_update', (data) => {
        costUpdates.push(data);
      });

      // Subscribe to cost updates
      clientSocket.emit('subscribe_costs', {
        cardId: testCardId
      });

      // Trigger cost tracking through test execution
      await request(app)
        .post('/api/test-execution/run')
        .send({
          cardId: testCardId,
          testCases: [
            {
              id: 'cost-test',
              input: 'Cost tracking test',
              expectedOutput: 'Expected output'
            }
          ],
          model: 'gpt-4', // More expensive model
          enableCostTracking: true
        })
        .expect(200);

      // Wait for cost updates
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 3000);
      });

      // Should have received cost updates
      expect(costUpdates.length).to.be.greaterThan(0);
      
      const firstUpdate = costUpdates[0];
      expect(firstUpdate).to.have.property('cardId', testCardId);
      expect(firstUpdate).to.have.property('totalCost');
      expect(firstUpdate).to.have.property('costPerTest');
      expect(firstUpdate).to.have.property('tokenUsage');
    });
  });

  describe('Multi-Agent Coordination', () => {
    it('should coordinate multiple agents via WebSocket', async () => {
      const agentUpdates: any[] = [];
      
      // Listen for agent coordination messages
      clientSocket.on('agent_coordination', (data) => {
        agentUpdates.push(data);
      });

      // Join agent coordination room
      clientSocket.emit('join_agent_coordination', {
        agentId: 'test-agent-1',
        capabilities: ['testing', 'analysis']
      });

      // Simulate multi-agent test execution
      await request(app)
        .post('/api/test-execution/multi-agent')
        .send({
          cardId: testCardId,
          agents: [
            {
              id: 'agent-1',
              role: 'executor',
              capabilities: ['testing']
            },
            {
              id: 'agent-2',
              role: 'analyzer',
              capabilities: ['analysis']
            }
          ],
          testCases: [
            {
              id: 'multi-agent-test',
              input: 'Multi-agent test input',
              expectedOutput: 'Expected output'
            }
          ],
          coordinationEnabled: true
        })
        .expect(200);

      // Wait for agent coordination
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 4000);
      });

      // Should have received coordination messages
      expect(agentUpdates.length).to.be.greaterThan(0);
      
      const firstUpdate = agentUpdates[0];
      expect(firstUpdate).to.have.property('type');
      expect(firstUpdate).to.have.property('fromAgent');
      expect(firstUpdate).to.have.property('message');
    });
  });

  describe('Queue Status Updates', () => {
    it('should receive queue status updates', async () => {
      const queueUpdates: any[] = [];
      
      // Listen for queue updates
      clientSocket.on('queue_status', (data) => {
        queueUpdates.push(data);
      });

      // Subscribe to queue updates
      clientSocket.emit('subscribe_queue', {
        queueName: 'test-queue'
      });

      // Submit multiple tests to create queue activity
      const testPromises = [];
      for (let i = 0; i < 5; i++) {
        testPromises.push(
          request(app)
            .post('/api/test-execution/parallel')
            .send({
              cardId: testCardId,
              testCases: [
                {
                  id: `queue-test-${i}`,
                  input: `Queue test ${i}`,
                  expectedOutput: `Expected ${i}`
                }
              ],
              model: 'gpt-3.5-turbo'
            })
        );
      }

      await Promise.all(testPromises);

      // Wait for queue updates
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 3000);
      });

      // Should have received queue updates
      expect(queueUpdates.length).to.be.greaterThan(0);
      
      const firstUpdate = queueUpdates[0];
      expect(firstUpdate).to.have.property('queueLength');
      expect(firstUpdate).to.have.property('processing');
      expect(firstUpdate).to.have.property('completed');
    });
  });

  describe('Resource Monitoring', () => {
    it('should broadcast resource usage updates', async () => {
      const resourceUpdates: any[] = [];
      
      // Listen for resource updates
      clientSocket.on('resource_update', (data) => {
        resourceUpdates.push(data);
      });

      // Subscribe to resource monitoring
      clientSocket.emit('subscribe_resources', {
        interval: 1000 // 1 second intervals
      });

      // Start resource-intensive operation
      await request(app)
        .post('/api/test-execution/resource-intensive')
        .send({
          cardId: testCardId,
          testCases: Array.from({ length: 10 }, (_, i) => ({
            id: `resource-test-${i}`,
            input: `Resource test ${i}`,
            expectedOutput: `Expected ${i}`
          })),
          model: 'gpt-4'
        })
        .expect(200);

      // Wait for resource updates
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 5000);
      });

      // Should have received resource updates
      expect(resourceUpdates.length).to.be.greaterThan(0);
      
      const firstUpdate = resourceUpdates[0];
      expect(firstUpdate).to.have.property('cpu');
      expect(firstUpdate).to.have.property('memory');
      expect(firstUpdate).to.have.property('activeConnections');
      expect(firstUpdate).to.have.property('timestamp');
    });
  });

  describe('Error Handling', () => {
    it('should handle WebSocket connection errors gracefully', async () => {
      const errorEvents: any[] = [];
      
      // Listen for error events
      clientSocket.on('error', (error) => {
        errorEvents.push(error);
      });

      // Try to join invalid session
      clientSocket.emit('join_session', {
        sessionId: 'invalid-session-id',
        cardId: 'invalid-card-id'
      });

      // Wait for error response
      await new Promise<void>((resolve) => {
        clientSocket.on('session_error', (error) => {
          expect(error).to.have.property('message');
          expect(error.message).to.include('Invalid session');
          resolve();
        });
      });
    });

    it('should handle disconnection and reconnection', async () => {
      let reconnected = false;
      
      // Listen for reconnection
      clientSocket.on('reconnect', () => {
        reconnected = true;
      });

      // Disconnect
      clientSocket.disconnect();
      
      // Wait a moment
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 1000);
      });

      // Reconnect
      clientSocket.connect();
      
      // Wait for reconnection
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 2000);
      });

      assert(clientSocket.connected === true);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent WebSocket connections', async () => {
      const clients: Socket[] = [];
      const connections = 10;
      
      // Create multiple connections
      for (let i = 0; i < connections; i++) {
        const client = Client(`http://localhost:${(server.address() as any).port}`, {
          autoConnect: false,
          transports: ['websocket']
        });
        
        clients.push(client);
        
        await new Promise<void>((resolve) => {
          client.on('connect', () => {
            resolve();
          });
          client.connect();
        });
      }

      // All clients should be connected
      expect(clients.length).to.equal(connections);
      for (const client of clients) {
        assert(client.connected === true);
      }

      // Broadcast message to all clients
      const messagesReceived: any[] = [];
      
      clients.forEach((client, index) => {
        client.on('broadcast_message', (data) => {
          messagesReceived.push({ clientIndex: index, data });
        });
      });

      // Trigger broadcast
      await request(app)
        .post('/api/websocket/broadcast')
        .send({
          event: 'broadcast_message',
          data: { message: 'Test broadcast', timestamp: Date.now() }
        })
        .expect(200);

      // Wait for messages
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 2000);
      });

      // All clients should have received the message
      expect(messagesReceived.length).to.equal(connections);

      // Clean up
      clients.forEach(client => client.disconnect());
    });
  });

  describe('Security', () => {
    it('should validate WebSocket authentication', async () => {
      const unauthenticatedClient = Client(`http://localhost:${(server.address() as any).port}`, {
        autoConnect: false,
        transports: ['websocket'],
        auth: {
          token: 'invalid-token'
        }
      });

      let authError = false;
      
      unauthenticatedClient.on('connect_error', (error) => {
        authError = true;
        expect(error.message).to.include('authentication');
      });

      unauthenticatedClient.connect();
      
      // Wait for connection attempt
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 2000);
      });

      assert(authError === true);
      expect(unauthenticatedClient.connected).to.be.false;
      
      unauthenticatedClient.disconnect();
    });

    it('should prevent unauthorized access to sensitive events', async () => {
      let unauthorizedAccess = false;
      
      // Try to access admin-only events
      clientSocket.emit('admin_command', {
        command: 'shutdown_system'
      });

      clientSocket.on('unauthorized', (error) => {
        unauthorizedAccess = true;
        expect(error.message).to.include('unauthorized');
      });

      // Wait for response
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 1000);
      });

      assert(unauthorizedAccess === true);
    });
  });
});