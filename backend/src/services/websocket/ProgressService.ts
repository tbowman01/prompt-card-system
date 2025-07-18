import { Server as SocketIOServer } from 'socket.io';
import { ExecutionProgress } from '../testing/TestQueueManager';

export interface TestExecutionResult {
  execution_id: string;
  test_case_id: number;
  passed: boolean;
  llm_output: string;
  execution_time_ms: number;
  model: string;
  prompt_used: string;
  created_at: Date;
}

export class ProgressService {
  private io: SocketIOServer;
  private connectedClients: Map<string, Set<string>> = new Map(); // socketId -> subscribed executionIds

  constructor(io: SocketIOServer) {
    this.io = io;
    this.setupEventHandlers();
  }

  /**
   * Emit progress update to subscribed clients
   */
  emitProgressUpdate(progress: ExecutionProgress): void {
    this.io.to(`test-${progress.job_id}`).emit('progress', progress);
  }

  /**
   * Emit test result to subscribed clients
   */
  emitTestResult(testId: string, result: TestExecutionResult): void {
    this.io.to(`test-${testId}`).emit('test-complete', result);
  }

  /**
   * Emit system resource updates
   */
  emitResourceUpdate(resources: any): void {
    this.io.emit('system-resources', resources);
  }

  /**
   * Emit queue statistics updates
   */
  emitQueueStats(stats: any): void {
    this.io.emit('queue-stats', stats);
  }

  /**
   * Get connected clients count
   */
  getConnectedClientsCount(): number {
    return this.io.sockets.sockets.size;
  }

  /**
   * Get subscriptions for a specific execution
   */
  getSubscriptionCount(executionId: string): number {
    return this.io.sockets.adapter.rooms.get(`test-${executionId}`)?.size || 0;
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      console.log(`WebSocket client connected: ${socket.id}`);
      this.connectedClients.set(socket.id, new Set());

      // Handle test execution subscription
      socket.on('subscribe-test', (executionId: string) => {
        if (typeof executionId === 'string' && executionId.length > 0) {
          socket.join(`test-${executionId}`);
          this.connectedClients.get(socket.id)?.add(executionId);
          console.log(`Client ${socket.id} subscribed to test ${executionId}`);
          
          // Send acknowledgment
          socket.emit('subscription-confirmed', { executionId, status: 'subscribed' });
        }
      });

      // Handle test execution unsubscription
      socket.on('unsubscribe-test', (executionId: string) => {
        if (typeof executionId === 'string' && executionId.length > 0) {
          socket.leave(`test-${executionId}`);
          this.connectedClients.get(socket.id)?.delete(executionId);
          console.log(`Client ${socket.id} unsubscribed from test ${executionId}`);
          
          // Send acknowledgment
          socket.emit('subscription-confirmed', { executionId, status: 'unsubscribed' });
        }
      });

      // Handle request for current progress
      socket.on('get-progress', (executionId: string) => {
        if (typeof executionId === 'string' && executionId.length > 0) {
          // This would typically query the TestQueueManager for current progress
          // For now, we'll emit a response indicating the request was received
          socket.emit('progress-request-received', { executionId });
        }
      });

      // Handle system resource subscription
      socket.on('subscribe-system-resources', () => {
        socket.join('system-resources');
        console.log(`Client ${socket.id} subscribed to system resources`);
        socket.emit('subscription-confirmed', { type: 'system-resources', status: 'subscribed' });
      });

      // Handle system resource unsubscription
      socket.on('unsubscribe-system-resources', () => {
        socket.leave('system-resources');
        console.log(`Client ${socket.id} unsubscribed from system resources`);
        socket.emit('subscription-confirmed', { type: 'system-resources', status: 'unsubscribed' });
      });

      // Handle queue statistics subscription
      socket.on('subscribe-queue-stats', () => {
        socket.join('queue-stats');
        console.log(`Client ${socket.id} subscribed to queue statistics`);
        socket.emit('subscription-confirmed', { type: 'queue-stats', status: 'subscribed' });
      });

      // Handle queue statistics unsubscription
      socket.on('unsubscribe-queue-stats', () => {
        socket.leave('queue-stats');
        console.log(`Client ${socket.id} unsubscribed from queue statistics`);
        socket.emit('subscription-confirmed', { type: 'queue-stats', status: 'unsubscribed' });
      });

      // Handle client disconnect
      socket.on('disconnect', (reason) => {
        console.log(`WebSocket client disconnected: ${socket.id}, reason: ${reason}`);
        this.connectedClients.delete(socket.id);
      });

      // Handle errors
      socket.on('error', (error) => {
        console.error(`WebSocket error for client ${socket.id}:`, error);
      });
    });

    // Handle adapter errors
    this.io.on('error', (error) => {
      console.error('Socket.IO server error:', error);
    });
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcastMessage(event: string, data: any): void {
    this.io.emit(event, data);
  }

  /**
   * Send message to specific client
   */
  sendToClient(socketId: string, event: string, data: any): void {
    this.io.to(socketId).emit(event, data);
  }

  /**
   * Get all active rooms (subscriptions)
   */
  getActiveRooms(): string[] {
    return Array.from(this.io.sockets.adapter.rooms.keys());
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.connectedClients.clear();
    this.io.removeAllListeners();
  }
}