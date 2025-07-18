import { Server as SocketIOServer } from 'socket.io';
import { ExecutionProgress } from '../testing/TestQueueManager';
import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';
import LRU from 'lru-cache';
import { promisify } from 'util';
import { setTimeout } from 'timers/promises';

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

export class ProgressService extends EventEmitter {
  private io: SocketIOServer;
  private connectedClients: Map<string, Set<string>> = new Map(); // socketId -> subscribed executionIds
  private messageQueue: Map<string, any[]> = new Map(); // Room -> queued messages
  private progressCache: LRUCache<string, ExecutionProgress>;
  private performanceMetrics: Map<string, number[]>;
  private batchTimer: NodeJS.Timeout | null = null;
  private compressionEnabled: boolean;
  private rateLimitMap: Map<string, number> = new Map();
  private lastActivity: Map<string, number> = new Map();

  constructor(io: SocketIOServer) {
    super();
    this.io = io;
    
    // Initialize performance optimizations
    this.progressCache = new LRUCache({
      max: 1000,
      ttl: 1000 * 60 * 5 // 5 minutes
    });
    
    this.performanceMetrics = new Map();
    this.compressionEnabled = true;
    
    // Configure Socket.IO for better performance
    this.optimizeSocketIO();
    
    this.setupEventHandlers();
    this.startBatchProcessor();
    this.startHealthMonitoring();
  }

  /**
   * Emit progress update to subscribed clients with batching
   */
  emitProgressUpdate(progress: ExecutionProgress): void {
    const startTime = performance.now();
    const roomName = `test-${progress.job_id}`;
    
    // Cache the progress
    this.progressCache.set(progress.job_id, progress);
    
    // Add to batch queue for efficient processing
    this.queueMessage(roomName, 'progress', progress);
    
    // Track performance
    this.trackPerformance('emitProgressUpdate', performance.now() - startTime);
  }

  /**
   * Emit test result to subscribed clients with compression
   */
  emitTestResult(testId: string, result: TestExecutionResult): void {
    const startTime = performance.now();
    const roomName = `test-${testId}`;
    
    // Compress large results if enabled
    const compressedResult = this.compressionEnabled ? 
      this.compressTestResult(result) : result;
    
    this.queueMessage(roomName, 'test-complete', compressedResult);
    
    // Track performance
    this.trackPerformance('emitTestResult', performance.now() - startTime);
  }

  /**
   * Emit system resource updates with rate limiting
   */
  emitResourceUpdate(resources: any): void {
    const now = Date.now();
    const lastEmit = this.lastActivity.get('system-resources') || 0;
    
    // Rate limit to prevent overwhelming clients (max 1 per second)
    if (now - lastEmit < 1000) {
      return;
    }
    
    this.lastActivity.set('system-resources', now);
    this.queueMessage('system-resources', 'system-resources', resources);
  }

  /**
   * Emit queue statistics updates with rate limiting
   */
  emitQueueStats(stats: any): void {
    const now = Date.now();
    const lastEmit = this.lastActivity.get('queue-stats') || 0;
    
    // Rate limit to prevent overwhelming clients (max 1 per 2 seconds)
    if (now - lastEmit < 2000) {
      return;
    }
    
    this.lastActivity.set('queue-stats', now);
    this.queueMessage('queue-stats', 'queue-stats', stats);
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
    this.messageQueue.clear();
    this.progressCache.clear();
    this.performanceMetrics.clear();
    this.rateLimitMap.clear();
    this.lastActivity.clear();
    
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }
    
    this.io.removeAllListeners();
    this.removeAllListeners();
  }
  
  /**
   * Queue message for batch processing
   */
  private queueMessage(room: string, event: string, data: any): void {
    if (!this.messageQueue.has(room)) {
      this.messageQueue.set(room, []);
    }
    
    const queue = this.messageQueue.get(room)!;
    queue.push({ event, data, timestamp: Date.now() });
    
    // Limit queue size to prevent memory issues
    if (queue.length > 100) {
      queue.shift();
    }
  }
  
  /**
   * Start batch processor for efficient message delivery
   */
  private startBatchProcessor(): void {
    this.batchTimer = setInterval(() => {
      this.processBatchedMessages();
    }, 100); // Process every 100ms
  }
  
  /**
   * Process batched messages
   */
  private processBatchedMessages(): void {
    const startTime = performance.now();
    let processedCount = 0;
    
    for (const [room, messages] of this.messageQueue) {
      if (messages.length === 0) continue;
      
      // Group messages by event type
      const eventGroups = new Map<string, any[]>();
      
      messages.forEach(msg => {
        if (!eventGroups.has(msg.event)) {
          eventGroups.set(msg.event, []);
        }
        eventGroups.get(msg.event)!.push(msg.data);
      });
      
      // Send grouped messages
      for (const [event, dataArray] of eventGroups) {
        if (dataArray.length === 1) {
          this.io.to(room).emit(event, dataArray[0]);
        } else {
          // Send as batch if multiple messages
          this.io.to(room).emit(`${event}-batch`, dataArray);
        }
      }
      
      processedCount += messages.length;
      messages.length = 0; // Clear the queue
    }
    
    if (processedCount > 0) {
      this.trackPerformance('processBatchedMessages', performance.now() - startTime);
    }
  }
  
  /**
   * Compress test result for efficient transmission
   */
  private compressTestResult(result: TestExecutionResult): any {
    // Create a compressed version by removing or truncating large fields
    const compressed = {
      ...result,
      llm_output: result.llm_output.length > 1000 ? 
        result.llm_output.substring(0, 1000) + '...[truncated]' : 
        result.llm_output,
      prompt_used: result.prompt_used.length > 500 ? 
        result.prompt_used.substring(0, 500) + '...[truncated]' : 
        result.prompt_used
    };
    
    return compressed;
  }
  
  /**
   * Optimize Socket.IO configuration
   */
  private optimizeSocketIO(): void {
    // Enable compression
    this.io.engine.compression = true;
    this.io.engine.perMessageDeflate = {
      threshold: 1024,
      concurrencyLimit: 10,
      memLevel: 7
    };
    
    // Set reasonable limits
    this.io.engine.maxHttpBufferSize = 1e6; // 1MB
    this.io.engine.pingTimeout = 20000; // 20 seconds
    this.io.engine.pingInterval = 10000; // 10 seconds
    
    console.log('WebSocket optimizations applied');
  }
  
  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    setInterval(() => {
      this.cleanupInactiveClients();
      this.logPerformanceStats();
    }, 1000 * 60 * 5); // Every 5 minutes
  }
  
  /**
   * Clean up inactive clients
   */
  private cleanupInactiveClients(): void {
    const now = Date.now();
    const inactiveThreshold = 1000 * 60 * 10; // 10 minutes
    
    for (const [clientId, lastActivity] of this.lastActivity) {
      if (now - lastActivity > inactiveThreshold) {
        this.lastActivity.delete(clientId);
        this.connectedClients.delete(clientId);
        this.rateLimitMap.delete(clientId);
      }
    }
  }
  
  /**
   * Track performance metrics
   */
  private trackPerformance(operation: string, duration: number): void {
    if (!this.performanceMetrics.has(operation)) {
      this.performanceMetrics.set(operation, []);
    }
    
    const metrics = this.performanceMetrics.get(operation)!;
    metrics.push(duration);
    
    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift();
    }
    
    // Log slow operations
    if (duration > 50) { // 50ms threshold
      console.warn(`Slow WebSocket operation: ${operation} took ${duration.toFixed(2)}ms`);
    }
  }
  
  /**
   * Log performance statistics
   */
  private logPerformanceStats(): void {
    const stats: Record<string, any> = {};
    
    for (const [operation, metrics] of this.performanceMetrics) {
      if (metrics.length > 0) {
        const avg = metrics.reduce((sum, time) => sum + time, 0) / metrics.length;
        const max = Math.max(...metrics);
        
        stats[operation] = {
          avg: Math.round(avg * 100) / 100,
          max: Math.round(max * 100) / 100,
          count: metrics.length
        };
      }
    }
    
    if (Object.keys(stats).length > 0) {
      console.log('WebSocket Performance Stats:', stats);
    }
  }
  
  /**
   * Get current progress for a job
   */
  public getCurrentProgress(jobId: string): ExecutionProgress | null {
    return this.progressCache.get(jobId) || null;
  }
  
  /**
   * Get performance statistics
   */
  public getPerformanceStats(): Record<string, { avg: number; max: number; min: number; count: number }> {
    const stats: Record<string, { avg: number; max: number; min: number; count: number }> = {};
    
    for (const [operation, metrics] of this.performanceMetrics) {
      if (metrics.length > 0) {
        const avg = metrics.reduce((sum, time) => sum + time, 0) / metrics.length;
        const max = Math.max(...metrics);
        const min = Math.min(...metrics);
        
        stats[operation] = {
          avg: Math.round(avg * 100) / 100,
          max: Math.round(max * 100) / 100,
          min: Math.round(min * 100) / 100,
          count: metrics.length
        };
      }
    }
    
    return stats;
  }
  
  /**
   * Get connection statistics
   */
  public getConnectionStats(): {
    totalConnections: number;
    activeRooms: number;
    messageQueueSize: number;
    cacheSize: number;
  } {
    return {
      totalConnections: this.connectedClients.size,
      activeRooms: this.getActiveRooms().length,
      messageQueueSize: Array.from(this.messageQueue.values()).reduce((sum, queue) => sum + queue.length, 0),
      cacheSize: this.progressCache.size
    };
  }
}