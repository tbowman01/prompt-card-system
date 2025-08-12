/**
 * Scalability Service
 * Handles Redis pub/sub, load balancing, and microservices coordination for collaboration
 */

import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';

export interface ServiceInstance {
  id: string;
  type: 'collaboration' | 'notification' | 'analytics' | 'workflow';
  host: string;
  port: number;
  status: 'active' | 'inactive' | 'overloaded';
  load: {
    cpu: number;
    memory: number;
    connections: number;
    operations: number;
  };
  lastHeartbeat: Date;
  capabilities: string[];
  metadata: Record<string, any>;
}

export interface LoadBalancerConfig {
  strategy: 'round_robin' | 'least_connections' | 'weighted' | 'health_based';
  healthCheckInterval: number;
  maxRetries: number;
  timeout: number;
  weights: Map<string, number>;
}

export interface ServiceDiscoveryConfig {
  registry: 'redis' | 'consul' | 'etcd';
  refreshInterval: number;
  healthCheck: {
    enabled: boolean;
    endpoint: string;
    timeout: number;
    interval: number;
  };
}

export interface MessageBusConfig {
  persistence: boolean;
  acknowledgments: boolean;
  messageRetention: number; // seconds
  maxMessageSize: number; // bytes
  compression: boolean;
}

export interface PubSubMessage {
  id: string;
  type: string;
  source: string;
  destination?: string;
  data: any;
  timestamp: number;
  retries: number;
  ttl?: number;
}

export interface HealthMetrics {
  cpu: number;
  memory: number;
  connections: number;
  operationsPerSecond: number;
  errorRate: number;
  responseTime: number;
  uptime: number;
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half_open';
  failures: number;
  lastFailureTime: Date;
  nextAttempt: Date;
  successCount: number;
}

export class ScalabilityService extends EventEmitter {
  private redis: Redis;
  private redisSubscriber: Redis;
  private redisPublisher: Redis;
  private io: Server;
  private instanceId: string;
  private serviceRegistry: Map<string, ServiceInstance> = new Map();
  private loadBalancerConfig: LoadBalancerConfig;
  private messageBusConfig: MessageBusConfig;
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private healthMetrics: HealthMetrics;
  private connectionPool: Map<string, Socket[]> = new Map();
  private operationQueues: Map<string, PubSubMessage[]> = new Map();
  private processingStats: Map<string, { count: number; avgTime: number }> = new Map();

  constructor(
    io: Server,
    redisConfig?: any,
    loadBalancerConfig?: Partial<LoadBalancerConfig>,
    messageBusConfig?: Partial<MessageBusConfig>
  ) {
    super();
    this.io = io;
    this.instanceId = `collab-${os.hostname()}-${process.pid}-${Date.now()}`;
    
    // Initialize Redis connections
    this.redis = new Redis(redisConfig || process.env.REDIS_URL);
    this.redisSubscriber = new Redis(redisConfig || process.env.REDIS_URL);
    this.redisPublisher = new Redis(redisConfig || process.env.REDIS_URL);

    // Configuration
    this.loadBalancerConfig = {
      strategy: 'health_based',
      healthCheckInterval: 30000,
      maxRetries: 3,
      timeout: 5000,
      weights: new Map(),
      ...loadBalancerConfig
    };

    this.messageBusConfig = {
      persistence: true,
      acknowledgments: true,
      messageRetention: 86400, // 24 hours
      maxMessageSize: 1024 * 1024, // 1MB
      compression: true,
      ...messageBusConfig
    };

    this.healthMetrics = {
      cpu: 0,
      memory: 0,
      connections: 0,
      operationsPerSecond: 0,
      errorRate: 0,
      responseTime: 0,
      uptime: process.uptime()
    };

    this.initialize();
  }

  /**
   * Initialize scalability services
   */
  private async initialize(): Promise<void> {
    try {
      // Register this service instance
      await this.registerServiceInstance();

      // Setup message bus
      await this.setupMessageBus();

      // Start health monitoring
      this.startHealthMonitoring();

      // Setup load balancing
      this.setupLoadBalancing();

      // Start service discovery
      this.startServiceDiscovery();

      // Setup connection management
      this.setupConnectionManagement();

      console.log(`Scalability service initialized: ${this.instanceId}`);
    } catch (error) {
      console.error('Error initializing scalability service:', error);
      throw error;
    }
  }

  /**
   * Register this service instance in the registry
   */
  private async registerServiceInstance(): Promise<void> {
    const instance: ServiceInstance = {
      id: this.instanceId,
      type: 'collaboration',
      host: process.env.HOST || 'localhost',
      port: parseInt(process.env.PORT || '3001'),
      status: 'active',
      load: {
        cpu: 0,
        memory: 0,
        connections: 0,
        operations: 0
      },
      lastHeartbeat: new Date(),
      capabilities: [
        'realtime_editing',
        'comments',
        'presence',
        'notifications',
        'reviews'
      ],
      metadata: {
        version: process.env.npm_package_version || '1.0.0',
        nodeVersion: process.version,
        platform: os.platform(),
        arch: os.arch()
      }
    };

    await this.redis.hset(
      'service:instances',
      this.instanceId,
      JSON.stringify(instance)
    );

    // Set TTL for service discovery
    await this.redis.expire(`service:instance:${this.instanceId}`, 60);

    this.serviceRegistry.set(this.instanceId, instance);
  }

  /**
   * Setup Redis pub/sub message bus
   */
  private async setupMessageBus(): Promise<void> {
    // Subscribe to collaboration channels
    await this.redisSubscriber.subscribe(
      'collab:operations',
      'collab:presence',
      'collab:comments',
      'collab:notifications',
      'collab:system',
      `collab:instance:${this.instanceId}`
    );

    this.redisSubscriber.on('message', async (channel: string, message: string) => {
      try {
        await this.handlePubSubMessage(channel, message);
      } catch (error) {
        console.error('Error handling pub/sub message:', error);
        this.updateErrorRate(1);
      }
    });

    // Setup pattern subscriptions for dynamic routing
    await this.redisSubscriber.psubscribe('collab:*', 'user:*', 'document:*', 'workspace:*');

    this.redisSubscriber.on('pmessage', async (pattern: string, channel: string, message: string) => {
      try {
        await this.handlePatternMessage(pattern, channel, message);
      } catch (error) {
        console.error('Error handling pattern message:', error);
        this.updateErrorRate(1);
      }
    });
  }

  /**
   * Publish message to Redis pub/sub with reliability features
   */
  public async publishMessage(
    channel: string,
    data: any,
    options?: {
      persistent?: boolean;
      ttl?: number;
      retries?: number;
      destination?: string;
    }
  ): Promise<boolean> {
    const message: PubSubMessage = {
      id: uuidv4(),
      type: channel.split(':')[1] || 'unknown',
      source: this.instanceId,
      destination: options?.destination,
      data,
      timestamp: Date.now(),
      retries: 0,
      ttl: options?.ttl
    };

    try {
      const messageStr = JSON.stringify(message);
      
      // Check message size
      if (Buffer.byteLength(messageStr, 'utf8') > this.messageBusConfig.maxMessageSize) {
        throw new Error('Message exceeds maximum size');
      }

      // Publish to channel
      const result = await this.redisPublisher.publish(channel, messageStr);

      // Store for persistence if enabled
      if (this.messageBusConfig.persistence && options?.persistent !== false) {
        await this.redis.lpush(`messages:${channel}`, messageStr);
        await this.redis.expire(`messages:${channel}`, this.messageBusConfig.messageRetention);
      }

      // Update processing stats
      this.updateProcessingStats('publish', Date.now() - message.timestamp);

      return result > 0;
    } catch (error) {
      console.error('Error publishing message:', error);
      this.updateErrorRate(1);
      
      // Retry logic
      if (options?.retries && message.retries < options.retries) {
        message.retries++;
        setTimeout(() => {
          this.publishMessage(channel, data, options);
        }, Math.pow(2, message.retries) * 1000);
      }
      
      return false;
    }
  }

  /**
   * Handle incoming pub/sub messages
   */
  private async handlePubSubMessage(channel: string, messageStr: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      const message: PubSubMessage = JSON.parse(messageStr);
      
      // Skip messages from this instance to avoid loops
      if (message.source === this.instanceId) {
        return;
      }

      // Check if message is intended for this instance
      if (message.destination && message.destination !== this.instanceId) {
        return;
      }

      // Check TTL
      if (message.ttl && Date.now() - message.timestamp > message.ttl * 1000) {
        return; // Message expired
      }

      // Route message based on channel
      switch (channel) {
        case 'collab:operations':
          await this.handleOperationMessage(message);
          break;
        
        case 'collab:presence':
          await this.handlePresenceMessage(message);
          break;
        
        case 'collab:comments':
          await this.handleCommentMessage(message);
          break;
        
        case 'collab:notifications':
          await this.handleNotificationMessage(message);
          break;
        
        case 'collab:system':
          await this.handleSystemMessage(message);
          break;
        
        default:
          if (channel.startsWith(`collab:instance:${this.instanceId}`)) {
            await this.handleInstanceMessage(message);
          }
      }

      // Send acknowledgment if required
      if (this.messageBusConfig.acknowledgments && message.id) {
        await this.sendAcknowledgment(message.id, message.source);
      }

      this.updateProcessingStats(channel, Date.now() - startTime);
    } catch (error) {
      console.error('Error processing pub/sub message:', error);
      this.updateErrorRate(1);
    }
  }

  /**
   * Handle pattern-based messages
   */
  private async handlePatternMessage(pattern: string, channel: string, messageStr: string): Promise<void> {
    try {
      const message: PubSubMessage = JSON.parse(messageStr);
      
      // Route based on pattern
      if (pattern === 'user:*') {
        const userId = channel.split(':')[1];
        await this.routeToUserConnections(userId, message);
      } else if (pattern === 'document:*') {
        const documentId = channel.split(':')[1];
        await this.routeToDocumentParticipants(documentId, message);
      } else if (pattern === 'workspace:*') {
        const workspaceId = channel.split(':')[1];
        await this.routeToWorkspaceMembers(workspaceId, message);
      }
    } catch (error) {
      console.error('Error handling pattern message:', error);
      this.updateErrorRate(1);
    }
  }

  /**
   * Route message to user's socket connections
   */
  private async routeToUserConnections(userId: string, message: PubSubMessage): Promise<void> {
    const userConnections = this.connectionPool.get(userId) || [];
    
    for (const socket of userConnections) {
      if (socket.connected) {
        socket.emit(message.type, message.data);
      }
    }
  }

  /**
   * Route message to document participants
   */
  private async routeToDocumentParticipants(documentId: string, message: PubSubMessage): Promise<void> {
    this.io.to(documentId).emit(message.type, message.data);
  }

  /**
   * Route message to workspace members
   */
  private async routeToWorkspaceMembers(workspaceId: string, message: PubSubMessage): Promise<void> {
    this.io.to(`workspace:${workspaceId}`).emit(message.type, message.data);
  }

  /**
   * Handle different message types
   */
  private async handleOperationMessage(message: PubSubMessage): Promise<void> {
    // Broadcast operation to connected clients
    const { documentId, operation } = message.data;
    this.io.to(documentId).emit('remote-operation', operation);
  }

  private async handlePresenceMessage(message: PubSubMessage): Promise<void> {
    // Broadcast presence update
    const { documentId, presence } = message.data;
    this.io.to(documentId).emit('presence-update', presence);
  }

  private async handleCommentMessage(message: PubSubMessage): Promise<void> {
    // Broadcast comment update
    const { documentId, comment, action } = message.data;
    this.io.to(documentId).emit(`comment-${action}`, comment);
  }

  private async handleNotificationMessage(message: PubSubMessage): Promise<void> {
    // Send notification to specific user
    const { userId, notification } = message.data;
    this.io.to(`user:${userId}`).emit('notification', notification);
  }

  private async handleSystemMessage(message: PubSubMessage): Promise<void> {
    // Handle system-wide messages
    switch (message.data.type) {
      case 'shutdown':
        await this.gracefulShutdown();
        break;
      
      case 'scale_up':
        await this.scaleUp(message.data.instances);
        break;
      
      case 'scale_down':
        await this.scaleDown(message.data.instances);
        break;
      
      case 'health_check':
        await this.respondToHealthCheck(message.source);
        break;
    }
  }

  private async handleInstanceMessage(message: PubSubMessage): Promise<void> {
    // Handle instance-specific messages
    console.log('Received instance message:', message.type, message.data);
  }

  /**
   * Setup connection management for load balancing
   */
  private setupConnectionManagement(): void {
    this.io.on('connection', (socket: Socket) => {
      // Track connection for load balancing
      this.healthMetrics.connections++;
      
      socket.on('authenticate', (data: { userId: string; token: string }) => {
        // Add to user connection pool
        const userConnections = this.connectionPool.get(data.userId) || [];
        userConnections.push(socket);
        this.connectionPool.set(data.userId, userConnections);
        
        socket.join(`user:${data.userId}`);
      });
      
      socket.on('join-workspace', (workspaceId: string) => {
        socket.join(`workspace:${workspaceId}`);
      });
      
      socket.on('disconnect', () => {
        this.healthMetrics.connections--;
        
        // Remove from connection pools
        for (const [userId, connections] of this.connectionPool.entries()) {
          const filteredConnections = connections.filter(conn => conn.id !== socket.id);
          if (filteredConnections.length === 0) {
            this.connectionPool.delete(userId);
          } else {
            this.connectionPool.set(userId, filteredConnections);
          }
        }
      });
    });
  }

  /**
   * Setup load balancing
   */
  private setupLoadBalancing(): void {
    // Implement sticky sessions for WebSocket connections
    this.io.engine.on('connection_error', (err: any) => {
      console.log('Connection error:', err);
      this.updateErrorRate(1);
    });

    // Monitor connection distribution
    setInterval(() => {
      this.redistributeConnections();
    }, 60000); // Check every minute
  }

  /**
   * Start service discovery
   */
  private startServiceDiscovery(): void {
    // Periodic health checks and service registration
    setInterval(async () => {
      await this.updateServiceRegistry();
      await this.performHealthChecks();
    }, this.loadBalancerConfig.healthCheckInterval);
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    setInterval(() => {
      this.updateHealthMetrics();
      this.publishHealthMetrics();
    }, 10000); // Update every 10 seconds
  }

  /**
   * Update health metrics
   */
  private updateHealthMetrics(): void {
    const cpuUsage = process.cpuUsage();
    const memoryUsage = process.memoryUsage();
    
    this.healthMetrics = {
      cpu: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
      memory: memoryUsage.heapUsed / memoryUsage.heapTotal,
      connections: this.healthMetrics.connections,
      operationsPerSecond: this.calculateOpsPerSecond(),
      errorRate: this.calculateErrorRate(),
      responseTime: this.calculateAvgResponseTime(),
      uptime: process.uptime()
    };
  }

  /**
   * Publish health metrics
   */
  private async publishHealthMetrics(): Promise<void> {
    const instance = this.serviceRegistry.get(this.instanceId);
    if (instance) {
      instance.load = {
        cpu: this.healthMetrics.cpu,
        memory: this.healthMetrics.memory,
        connections: this.healthMetrics.connections,
        operations: this.healthMetrics.operationsPerSecond
      };
      instance.lastHeartbeat = new Date();
      
      // Determine status based on load
      if (this.healthMetrics.cpu > 0.8 || this.healthMetrics.memory > 0.9) {
        instance.status = 'overloaded';
      } else {
        instance.status = 'active';
      }
      
      await this.redis.hset(
        'service:instances',
        this.instanceId,
        JSON.stringify(instance)
      );
      
      // Publish health update
      await this.publishMessage('collab:system', {
        type: 'health_update',
        instanceId: this.instanceId,
        metrics: this.healthMetrics
      });
    }
  }

  /**
   * Update service registry with current instances
   */
  private async updateServiceRegistry(): Promise<void> {
    try {
      const instances = await this.redis.hgetall('service:instances');
      const now = Date.now();
      
      for (const [instanceId, instanceData] of Object.entries(instances)) {
        try {
          const instance: ServiceInstance = JSON.parse(instanceData);
          
          // Check if instance is stale
          const timeSinceHeartbeat = now - new Date(instance.lastHeartbeat).getTime();
          if (timeSinceHeartbeat > this.loadBalancerConfig.healthCheckInterval * 2) {
            // Mark as inactive
            instance.status = 'inactive';
            await this.redis.hdel('service:instances', instanceId);
            this.serviceRegistry.delete(instanceId);
          } else {
            this.serviceRegistry.set(instanceId, instance);
          }
        } catch (error) {
          console.error('Error parsing instance data:', error);
          await this.redis.hdel('service:instances', instanceId);
        }
      }
    } catch (error) {
      console.error('Error updating service registry:', error);
    }
  }

  /**
   * Perform health checks on other instances
   */
  private async performHealthChecks(): Promise<void> {
    for (const [instanceId, instance] of this.serviceRegistry.entries()) {
      if (instanceId === this.instanceId) continue;
      
      const circuitBreaker = this.getCircuitBreaker(instanceId);
      
      if (circuitBreaker.state === 'open') {
        // Check if we should try half-open
        if (Date.now() >= circuitBreaker.nextAttempt.getTime()) {
          circuitBreaker.state = 'half_open';
        } else {
          continue;
        }
      }
      
      try {
        await this.checkInstanceHealth(instance);
        
        // Reset circuit breaker on success
        circuitBreaker.failures = 0;
        circuitBreaker.state = 'closed';
        circuitBreaker.successCount++;
      } catch (error) {
        console.error(`Health check failed for ${instanceId}:`, error);
        
        circuitBreaker.failures++;
        circuitBreaker.lastFailureTime = new Date();
        
        if (circuitBreaker.failures >= this.loadBalancerConfig.maxRetries) {
          circuitBreaker.state = 'open';
          circuitBreaker.nextAttempt = new Date(Date.now() + 30000); // Try again in 30 seconds
          
          // Mark instance as inactive
          instance.status = 'inactive';
        }
      }
    }
  }

  /**
   * Check health of specific instance
   */
  private async checkInstanceHealth(instance: ServiceInstance): Promise<void> {
    // For now, we'll check if the instance is responding to Redis
    // In a real implementation, you might make HTTP health check requests
    const healthResponse = await this.redis.ping();
    if (healthResponse !== 'PONG') {
      throw new Error('Redis health check failed');
    }
  }

  /**
   * Get or create circuit breaker for instance
   */
  private getCircuitBreaker(instanceId: string): CircuitBreakerState {
    let breaker = this.circuitBreakers.get(instanceId);
    if (!breaker) {
      breaker = {
        state: 'closed',
        failures: 0,
        lastFailureTime: new Date(),
        nextAttempt: new Date(),
        successCount: 0
      };
      this.circuitBreakers.set(instanceId, breaker);
    }
    return breaker;
  }

  /**
   * Redistribute connections across instances
   */
  private async redistributeConnections(): Promise<void> {
    // Check if this instance is overloaded
    if (this.healthMetrics.cpu > 0.8 || this.healthMetrics.memory > 0.9) {
      // Find healthier instances to redirect new connections
      const healthyInstances = Array.from(this.serviceRegistry.values())
        .filter(instance => instance.status === 'active' && instance.id !== this.instanceId)
        .sort((a, b) => (a.load.cpu + a.load.memory) - (b.load.cpu + b.load.memory));
      
      if (healthyInstances.length > 0) {
        // Publish load balancing recommendation
        await this.publishMessage('collab:system', {
          type: 'load_balance',
          overloadedInstance: this.instanceId,
          recommendedInstances: healthyInstances.slice(0, 3).map(i => i.id)
        });
      }
    }
  }

  // Utility methods

  private calculateOpsPerSecond(): number {
    const totalOps = Array.from(this.processingStats.values())
      .reduce((sum, stat) => sum + stat.count, 0);
    return totalOps / 60; // Operations per second over last minute
  }

  private calculateErrorRate(): number {
    // This would be implemented with proper error tracking
    return 0; // Placeholder
  }

  private calculateAvgResponseTime(): number {
    const stats = Array.from(this.processingStats.values());
    if (stats.length === 0) return 0;
    
    const totalTime = stats.reduce((sum, stat) => sum + stat.avgTime, 0);
    return totalTime / stats.length;
  }

  private updateErrorRate(increment: number): void {
    // Implementation for error rate tracking
  }

  private updateProcessingStats(operation: string, duration: number): void {
    const stats = this.processingStats.get(operation) || { count: 0, avgTime: 0 };
    stats.count++;
    stats.avgTime = (stats.avgTime + duration) / 2;
    this.processingStats.set(operation, stats);
  }

  private async sendAcknowledgment(messageId: string, sourceInstance: string): Promise<void> {
    await this.publishMessage(`collab:instance:${sourceInstance}`, {
      type: 'ack',
      messageId,
      timestamp: Date.now()
    });
  }

  private async respondToHealthCheck(sourceInstance: string): Promise<void> {
    await this.publishMessage(`collab:instance:${sourceInstance}`, {
      type: 'health_response',
      instanceId: this.instanceId,
      metrics: this.healthMetrics,
      timestamp: Date.now()
    });
  }

  private async scaleUp(targetInstances: number): Promise<void> {
    console.log(`Scale up requested: ${targetInstances} instances`);
    // Implementation would spawn new instances
  }

  private async scaleDown(targetInstances: number): Promise<void> {
    console.log(`Scale down requested: ${targetInstances} instances`);
    // Implementation would gracefully shutdown excess instances
  }

  private async gracefulShutdown(): Promise<void> {
    console.log('Graceful shutdown initiated');
    
    // Stop accepting new connections
    this.io.close();
    
    // Finish processing pending messages
    await this.processPendingMessages();
    
    // Remove from service registry
    await this.redis.hdel('service:instances', this.instanceId);
    
    // Close Redis connections
    await this.redis.quit();
    await this.redisSubscriber.quit();
    await this.redisPublisher.quit();
    
    process.exit(0);
  }

  private async processPendingMessages(): Promise<void> {
    // Process any pending messages in queues
    for (const [channel, messages] of this.operationQueues.entries()) {
      for (const message of messages) {
        try {
          await this.handlePubSubMessage(channel, JSON.stringify(message));
        } catch (error) {
          console.error('Error processing pending message:', error);
        }
      }
    }
  }

  /**
   * Get service metrics
   */
  public getMetrics(): {
    health: HealthMetrics;
    instances: ServiceInstance[];
    circuitBreakers: Map<string, CircuitBreakerState>;
    processingStats: Map<string, { count: number; avgTime: number }>;
  } {
    return {
      health: this.healthMetrics,
      instances: Array.from(this.serviceRegistry.values()),
      circuitBreakers: this.circuitBreakers,
      processingStats: this.processingStats
    };
  }

  /**
   * Get load balancer recommendations
   */
  public getLoadBalancerRecommendations(): ServiceInstance[] {
    return Array.from(this.serviceRegistry.values())
      .filter(instance => instance.status === 'active')
      .sort((a, b) => {
        switch (this.loadBalancerConfig.strategy) {
          case 'least_connections':
            return a.load.connections - b.load.connections;
          
          case 'health_based':
            const aHealth = a.load.cpu + a.load.memory;
            const bHealth = b.load.cpu + b.load.memory;
            return aHealth - bHealth;
          
          case 'weighted':
            const aWeight = this.loadBalancerConfig.weights.get(a.id) || 1;
            const bWeight = this.loadBalancerConfig.weights.get(b.id) || 1;
            return bWeight - aWeight;
          
          default: // round_robin
            return 0; // Maintain original order for round-robin
        }
      });
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    await this.gracefulShutdown();
  }
}

export default ScalabilityService;