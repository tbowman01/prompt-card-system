/**
 * Enhanced Operational Transformation Service
 * Provides advanced conflict resolution, change attribution, and performance optimization
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';

export interface Operation {
  id: string;
  documentId: string;
  userId: string;
  type: 'insert' | 'delete' | 'retain' | 'format';
  position: number;
  content?: string;
  length?: number;
  attributes?: Record<string, any>;
  timestamp: number;
  clientId: string;
  sequenceNumber: number;
  dependencies?: string[];
  metadata?: {
    selectionBefore?: { start: number; end: number };
    selectionAfter?: { start: number; end: number };
    authorName?: string;
    reason?: string;
  };
}

export interface DocumentState {
  id: string;
  content: string;
  version: number;
  operations: Operation[];
  participants: Map<string, ParticipantState>;
  lastModified: Date;
  checkpoints: DocumentCheckpoint[];
}

interface ParticipantState {
  userId: string;
  username: string;
  lastSequenceNumber: number;
  pendingOperations: Operation[];
  acknowledgedOperations: Set<string>;
  cursor?: {
    position: number;
    selection?: { start: number; end: number };
  };
}

interface DocumentCheckpoint {
  version: number;
  content: string;
  timestamp: Date;
  operationCount: number;
}

interface TransformResult {
  operation: Operation;
  inverse?: Operation;
  conflicts?: ConflictInfo[];
}

interface ConflictInfo {
  type: 'position' | 'content' | 'attribute';
  description: string;
  resolution: 'automatic' | 'manual_required';
  metadata: Record<string, any>;
}

interface OperationMetrics {
  totalOperations: number;
  operationsPerSecond: number;
  averageTransformTime: number;
  conflictResolutionRate: number;
  participantCount: number;
}

export class EnhancedOperationalTransform extends EventEmitter {
  private documents: Map<string, DocumentState> = new Map();
  private redis: Redis;
  private operationQueue: Map<string, Operation[]> = new Map();
  private transformCache: Map<string, TransformResult> = new Map();
  private metrics: Map<string, OperationMetrics> = new Map();
  private readonly maxOperationsInMemory = 1000;
  private readonly checkpointInterval = 100;
  private readonly cacheTimeout = 300000; // 5 minutes

  constructor(redisConfig?: any) {
    super();
    this.redis = new Redis(redisConfig || process.env.REDIS_URL);
    this.setupRedisSubscriptions();
    this.startCleanupWorker();
  }

  /**
   * Initialize document for collaborative editing
   */
  public async initializeDocument(documentId: string, initialContent: string = '', userId: string): Promise<DocumentState> {
    let document = this.documents.get(documentId);
    
    if (!document) {
      document = {
        id: documentId,
        content: initialContent,
        version: 0,
        operations: [],
        participants: new Map(),
        lastModified: new Date(),
        checkpoints: [{
          version: 0,
          content: initialContent,
          timestamp: new Date(),
          operationCount: 0
        }]
      };

      this.documents.set(documentId, document);
      this.operationQueue.set(documentId, []);
      this.initializeMetrics(documentId);

      // Persist to Redis for scalability
      await this.persistDocumentState(documentId, document);
    }

    return document;
  }

  /**
   * Add participant to document
   */
  public async addParticipant(documentId: string, userId: string, username: string): Promise<void> {
    const document = await this.ensureDocumentLoaded(documentId);
    
    if (!document.participants.has(userId)) {
      document.participants.set(userId, {
        userId,
        username,
        lastSequenceNumber: 0,
        pendingOperations: [],
        acknowledgedOperations: new Set()
      });

      this.emit('participant-joined', {
        documentId,
        userId,
        username,
        participantCount: document.participants.size
      });

      await this.persistDocumentState(documentId, document);
    }
  }

  /**
   * Remove participant from document
   */
  public async removeParticipant(documentId: string, userId: string): Promise<void> {
    const document = this.documents.get(documentId);
    if (document && document.participants.has(userId)) {
      document.participants.delete(userId);
      
      this.emit('participant-left', {
        documentId,
        userId,
        participantCount: document.participants.size
      });

      await this.persistDocumentState(documentId, document);
    }
  }

  /**
   * Apply operation with enhanced conflict resolution
   */
  public async applyOperation(operation: Operation): Promise<TransformResult> {
    const startTime = Date.now();
    const document = await this.ensureDocumentLoaded(operation.documentId);
    
    try {
      // Validate operation
      this.validateOperation(operation, document);

      // Add to queue for ordered processing
      const queue = this.operationQueue.get(operation.documentId) || [];
      queue.push(operation);
      queue.sort((a, b) => a.sequenceNumber - b.sequenceNumber);

      // Process all ready operations
      const results: TransformResult[] = [];
      let processedOperation: Operation | undefined;

      while (queue.length > 0) {
        const nextOp = queue[0];
        
        // Check if we can process this operation (no gaps in sequence)
        if (this.canProcessOperation(nextOp, document)) {
          queue.shift();
          const result = await this.processOperation(nextOp, document);
          results.push(result);
          
          if (nextOp.id === operation.id) {
            processedOperation = nextOp;
          }
        } else {
          break;
        }
      }

      // Update metrics
      this.updateMetrics(operation.documentId, Date.now() - startTime, results);

      // Emit events for processed operations
      for (const result of results) {
        this.emit('operation-applied', {
          documentId: operation.documentId,
          operation: result.operation,
          conflicts: result.conflicts,
          newContent: document.content,
          version: document.version
        });
      }

      // Create checkpoint if needed
      if (document.operations.length % this.checkpointInterval === 0) {
        await this.createCheckpoint(operation.documentId, document);
      }

      // Return result for the original operation
      return results.find(r => r.operation.id === operation.id) || {
        operation,
        conflicts: [{
          type: 'position',
          description: 'Operation queued for processing',
          resolution: 'automatic',
          metadata: { queued: true }
        }]
      };
    } catch (error) {
      console.error('Error applying operation:', error);
      throw error;
    }
  }

  /**
   * Transform operation against document state
   */
  private async transformOperation(operation: Operation, document: DocumentState): Promise<TransformResult> {
    const cacheKey = this.generateCacheKey(operation, document.version);
    const cached = this.transformCache.get(cacheKey);
    
    if (cached && Date.now() - cached.operation.timestamp < this.cacheTimeout) {
      return cached;
    }

    const conflicts: ConflictInfo[] = [];
    let transformedOp = { ...operation };
    
    // Transform against recent operations
    const recentOps = document.operations.slice(-50); // Last 50 operations for efficiency
    
    for (const existingOp of recentOps) {
      if (existingOp.userId !== operation.userId && this.operationsOverlap(operation, existingOp)) {
        const transformResult = this.transformAgainstOperation(transformedOp, existingOp);
        transformedOp = transformResult.transformed;
        
        if (transformResult.conflict) {
          conflicts.push(transformResult.conflict);
        }
      }
    }

    // Generate inverse operation for undo functionality
    const inverse = this.generateInverseOperation(transformedOp, document.content);

    const result: TransformResult = {
      operation: transformedOp,
      inverse,
      conflicts
    };

    // Cache the result
    this.transformCache.set(cacheKey, result);
    
    // Clean cache periodically
    setTimeout(() => this.transformCache.delete(cacheKey), this.cacheTimeout);

    return result;
  }

  /**
   * Process individual operation
   */
  private async processOperation(operation: Operation, document: DocumentState): Promise<TransformResult> {
    // Transform operation
    const transformResult = await this.transformOperation(operation, document);
    const transformedOp = transformResult.operation;

    // Apply to document content
    document.content = this.applyOperationToContent(document.content, transformedOp);
    document.version += 1;
    document.lastModified = new Date();
    
    // Add to operations history
    document.operations.push(transformedOp);
    
    // Trim operations history if too large
    if (document.operations.length > this.maxOperationsInMemory) {
      document.operations = document.operations.slice(-this.maxOperationsInMemory / 2);
    }

    // Update participant state
    const participant = document.participants.get(operation.userId);
    if (participant) {
      participant.lastSequenceNumber = operation.sequenceNumber;
      participant.acknowledgedOperations.add(operation.id);
    }

    // Broadcast to Redis for other instances
    await this.broadcastOperation(transformedOp);
    await this.persistDocumentState(operation.documentId, document);

    return transformResult;
  }

  /**
   * Transform one operation against another
   */
  private transformAgainstOperation(op1: Operation, op2: Operation): { transformed: Operation; conflict?: ConflictInfo } {
    let transformed = { ...op1 };
    let conflict: ConflictInfo | undefined;

    if (op1.type === 'insert' && op2.type === 'insert') {
      if (op1.position <= op2.position) {
        transformed.position = op1.position;
      } else {
        transformed.position = op1.position + (op2.content?.length || 0);
      }
    } else if (op1.type === 'insert' && op2.type === 'delete') {
      if (op1.position <= op2.position) {
        transformed.position = op1.position;
      } else if (op1.position > op2.position + (op2.length || 0)) {
        transformed.position = op1.position - (op2.length || 0);
      } else {
        // Insert position is within deleted range - potential conflict
        transformed.position = op2.position;
        conflict = {
          type: 'position',
          description: 'Insert position adjusted due to concurrent deletion',
          resolution: 'automatic',
          metadata: {
            originalPosition: op1.position,
            adjustedPosition: transformed.position,
            conflictingOperation: op2.id
          }
        };
      }
    } else if (op1.type === 'delete' && op2.type === 'insert') {
      if (op2.position <= op1.position) {
        transformed.position = op1.position + (op2.content?.length || 0);
      }
    } else if (op1.type === 'delete' && op2.type === 'delete') {
      if (op2.position < op1.position) {
        transformed.position = Math.max(op1.position - (op2.length || 0), op2.position);
      } else if (op2.position < op1.position + (op1.length || 0)) {
        // Overlapping deletes
        const overlapStart = Math.max(op1.position, op2.position);
        const overlapEnd = Math.min(
          op1.position + (op1.length || 0),
          op2.position + (op2.length || 0)
        );
        const overlapLength = overlapEnd - overlapStart;
        
        transformed.length = (op1.length || 0) - overlapLength;
        
        if (transformed.length <= 0) {
          // Delete operation is completely covered by other delete
          transformed.type = 'retain';
          transformed.length = 0;
        }
        
        conflict = {
          type: 'content',
          description: 'Overlapping delete operations detected',
          resolution: 'automatic',
          metadata: {
            originalLength: op1.length,
            adjustedLength: transformed.length,
            overlapLength,
            conflictingOperation: op2.id
          }
        };
      }
    }

    return { transformed, conflict };
  }

  /**
   * Apply operation to document content
   */
  private applyOperationToContent(content: string, operation: Operation): string {
    switch (operation.type) {
      case 'insert':
        return content.slice(0, operation.position) + 
               (operation.content || '') + 
               content.slice(operation.position);
      
      case 'delete':
        return content.slice(0, operation.position) + 
               content.slice(operation.position + (operation.length || 0));
      
      case 'retain':
        return content; // No change for retain operations
      
      case 'format':
        // Formatting operations don't change content, just attributes
        return content;
      
      default:
        return content;
    }
  }

  /**
   * Generate inverse operation for undo
   */
  private generateInverseOperation(operation: Operation, content: string): Operation {
    const inverse: Operation = {
      ...operation,
      id: uuidv4(),
      timestamp: Date.now()
    };

    switch (operation.type) {
      case 'insert':
        inverse.type = 'delete';
        inverse.length = operation.content?.length || 0;
        delete inverse.content;
        break;
      
      case 'delete':
        inverse.type = 'insert';
        inverse.content = content.slice(operation.position, operation.position + (operation.length || 0));
        delete inverse.length;
        break;
      
      case 'format':
        // Inverse formatting would restore original attributes
        // This would require storing the original attributes
        break;
    }

    return inverse;
  }

  /**
   * Check if operations overlap in their effects
   */
  private operationsOverlap(op1: Operation, op2: Operation): boolean {
    const op1End = op1.position + (op1.type === 'insert' ? 0 : (op1.length || 0));
    const op2End = op2.position + (op2.type === 'insert' ? 0 : (op2.length || 0));
    
    return !(op1End <= op2.position || op2End <= op1.position);
  }

  /**
   * Validate operation before processing
   */
  private validateOperation(operation: Operation, document: DocumentState): void {
    if (!operation.id || !operation.documentId || !operation.userId) {
      throw new Error('Invalid operation: missing required fields');
    }

    if (operation.position < 0 || operation.position > document.content.length) {
      throw new Error('Invalid operation: position out of bounds');
    }

    if (operation.type === 'delete' && operation.position + (operation.length || 0) > document.content.length) {
      throw new Error('Invalid operation: delete length exceeds content');
    }
  }

  /**
   * Check if operation can be processed (no sequence gaps)
   */
  private canProcessOperation(operation: Operation, document: DocumentState): boolean {
    const participant = document.participants.get(operation.userId);
    if (!participant) {
      return true; // New participant
    }

    return operation.sequenceNumber === participant.lastSequenceNumber + 1;
  }

  /**
   * Generate cache key for transform results
   */
  private generateCacheKey(operation: Operation, documentVersion: number): string {
    return `${operation.id}_${documentVersion}_${operation.type}_${operation.position}`;
  }

  /**
   * Update metrics for performance monitoring
   */
  private updateMetrics(documentId: string, transformTime: number, results: TransformResult[]): void {
    let metrics = this.metrics.get(documentId);
    if (!metrics) {
      metrics = {
        totalOperations: 0,
        operationsPerSecond: 0,
        averageTransformTime: 0,
        conflictResolutionRate: 0,
        participantCount: 0
      };
      this.metrics.set(documentId, metrics);
    }

    metrics.totalOperations += results.length;
    metrics.averageTransformTime = (metrics.averageTransformTime + transformTime) / 2;
    
    const conflictCount = results.reduce((sum, r) => sum + (r.conflicts?.length || 0), 0);
    metrics.conflictResolutionRate = conflictCount / results.length;

    const document = this.documents.get(documentId);
    if (document) {
      metrics.participantCount = document.participants.size;
    }
  }

  /**
   * Initialize metrics for document
   */
  private initializeMetrics(documentId: string): void {
    this.metrics.set(documentId, {
      totalOperations: 0,
      operationsPerSecond: 0,
      averageTransformTime: 0,
      conflictResolutionRate: 0,
      participantCount: 0
    });
  }

  /**
   * Create checkpoint for document state
   */
  private async createCheckpoint(documentId: string, document: DocumentState): Promise<void> {
    const checkpoint: DocumentCheckpoint = {
      version: document.version,
      content: document.content,
      timestamp: new Date(),
      operationCount: document.operations.length
    };

    document.checkpoints.push(checkpoint);
    
    // Keep only last 10 checkpoints
    if (document.checkpoints.length > 10) {
      document.checkpoints = document.checkpoints.slice(-10);
    }

    // Persist checkpoint to Redis
    await this.redis.set(
      `checkpoint:${documentId}:${checkpoint.version}`,
      JSON.stringify(checkpoint),
      'EX',
      86400 // 24 hours
    );
  }

  /**
   * Ensure document is loaded in memory
   */
  private async ensureDocumentLoaded(documentId: string): Promise<DocumentState> {
    let document = this.documents.get(documentId);
    
    if (!document) {
      // Try to load from Redis
      const cached = await this.redis.get(`document:${documentId}`);
      if (cached) {
        const data = JSON.parse(cached);
        document = {
          ...data,
          participants: new Map(data.participants),
          lastModified: new Date(data.lastModified)
        };
        this.documents.set(documentId, document);
      } else {
        throw new Error(`Document ${documentId} not found`);
      }
    }

    return document;
  }

  /**
   * Persist document state to Redis
   */
  private async persistDocumentState(documentId: string, document: DocumentState): Promise<void> {
    const data = {
      ...document,
      participants: Array.from(document.participants.entries()),
      lastModified: document.lastModified.toISOString()
    };

    await this.redis.set(
      `document:${documentId}`,
      JSON.stringify(data),
      'EX',
      3600 // 1 hour
    );
  }

  /**
   * Broadcast operation to other instances via Redis
   */
  private async broadcastOperation(operation: Operation): Promise<void> {
    await this.redis.publish('collaboration:operations', JSON.stringify(operation));
  }

  /**
   * Setup Redis subscriptions for multi-instance coordination
   */
  private setupRedisSubscriptions(): void {
    this.redis.subscribe('collaboration:operations');
    
    this.redis.on('message', (channel: string, message: string) => {
      if (channel === 'collaboration:operations') {
        try {
          const operation: Operation = JSON.parse(message);
          this.emit('remote-operation', operation);
        } catch (error) {
          console.error('Error processing remote operation:', error);
        }
      }
    });
  }

  /**
   * Start cleanup worker for memory management
   */
  private startCleanupWorker(): void {
    setInterval(() => {
      const now = Date.now();
      
      // Clean up inactive documents
      for (const [docId, document] of this.documents.entries()) {
        const timeSinceLastModified = now - document.lastModified.getTime();
        if (timeSinceLastModified > 3600000) { // 1 hour
          this.documents.delete(docId);
          this.operationQueue.delete(docId);
          this.metrics.delete(docId);
        }
      }
      
      // Clean up old cache entries
      for (const [key, result] of this.transformCache.entries()) {
        if (now - result.operation.timestamp > this.cacheTimeout) {
          this.transformCache.delete(key);
        }
      }
    }, 300000); // Run every 5 minutes
  }

  /**
   * Get document state
   */
  public async getDocumentState(documentId: string): Promise<DocumentState | undefined> {
    return await this.ensureDocumentLoaded(documentId);
  }

  /**
   * Get metrics for document
   */
  public getMetrics(documentId?: string): OperationMetrics | Map<string, OperationMetrics> {
    if (documentId) {
      return this.metrics.get(documentId) || {
        totalOperations: 0,
        operationsPerSecond: 0,
        averageTransformTime: 0,
        conflictResolutionRate: 0,
        participantCount: 0
      };
    }
    return this.metrics;
  }

  /**
   * Get operation history for document
   */
  public getOperationHistory(documentId: string, limit: number = 50): Operation[] {
    const document = this.documents.get(documentId);
    if (!document) {
      return [];
    }
    
    return document.operations.slice(-limit);
  }

  /**
   * Rollback to specific version or checkpoint
   */
  public async rollbackToVersion(documentId: string, targetVersion: number): Promise<boolean> {
    try {
      const document = await this.ensureDocumentLoaded(documentId);
      
      // Find the closest checkpoint
      const checkpoint = document.checkpoints
        .filter(cp => cp.version <= targetVersion)
        .sort((a, b) => b.version - a.version)[0];
      
      if (checkpoint) {
        // Restore from checkpoint and replay operations
        document.content = checkpoint.content;
        document.version = checkpoint.version;
        
        // Replay operations from checkpoint to target version
        const replayOps = document.operations
          .filter(op => op.sequenceNumber > checkpoint.version && op.sequenceNumber <= targetVersion)
          .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
        
        for (const op of replayOps) {
          document.content = this.applyOperationToContent(document.content, op);
          document.version++;
        }
        
        document.lastModified = new Date();
        await this.persistDocumentState(documentId, document);
        
        this.emit('document-rollback', {
          documentId,
          targetVersion,
          newContent: document.content,
          newVersion: document.version
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Rollback error:', error);
      return false;
    }
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    await this.redis.quit();
    this.documents.clear();
    this.operationQueue.clear();
    this.transformCache.clear();
    this.metrics.clear();
  }
}

export default EnhancedOperationalTransform;