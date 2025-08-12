/**
 * Enhanced Collaboration Service
 * Orchestrates all collaboration features: real-time editing, communication, workflows, analytics
 */

import { EventEmitter } from 'events';
import { Server, Socket } from 'socket.io';
import { DatabaseConnection } from '../../database/connection';
import EnterpriseAuthService from '../auth/EnterpriseAuthService';
import EnhancedOperationalTransform from './EnhancedOperationalTransform';
import CommunicationService from './CommunicationService';
import ReviewWorkflowService from './ReviewWorkflowService';
import ScalabilityService from './ScalabilityService';
import CollaborationAnalytics from './CollaborationAnalytics';
import { UserPresence, CollaborativeDocument } from '../../types/collaboration';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

export interface CollaborationSession {
  id: string;
  userId: string;
  documentId: string;
  workspaceId: string;
  socketId: string;
  joinedAt: Date;
  lastActivity: Date;
  permissions: string[];
  metadata: Record<string, any>;
}

export interface CollaborationConfig {
  maxConcurrentUsers: number;
  operationBatchSize: number;
  presenceUpdateInterval: number;
  analyticsEnabled: boolean;
  cacheTimeout: number;
  performanceMonitoring: boolean;
}

export interface DocumentLock {
  documentId: string;
  userId: string;
  lockType: 'exclusive' | 'shared';
  acquiredAt: Date;
  expiresAt: Date;
  metadata?: Record<string, any>;
}

export interface CollaborationMetrics {
  activeSessions: number;
  totalOperations: number;
  averageLatency: number;
  errorRate: number;
  peakConcurrentUsers: number;
  documentsActive: number;
  workspacesActive: number;
}

export interface WorkspaceSettings {
  maxCollaborators: number;
  allowGuestUsers: boolean;
  requireReviews: boolean;
  defaultWorkflow?: string;
  permissions: {
    createDocuments: string[];
    editDocuments: string[];
    deleteDocuments: string[];
    manageWorkspace: string[];
  };
  integrations: {
    slack?: { webhookUrl: string; channel: string };
    teams?: { webhookUrl: string };
    github?: { repoUrl: string; token: string };
  };
}

export class EnhancedCollaborationService extends EventEmitter {
  private io: Server;
  private db: DatabaseConnection;
  private redis: Redis;
  private authService: EnterpriseAuthService;
  private operationalTransform: EnhancedOperationalTransform;
  private communicationService: CommunicationService;
  private reviewService: ReviewWorkflowService;
  private scalabilityService: ScalabilityService;
  private analytics: CollaborationAnalytics;
  
  private activeSessions: Map<string, CollaborationSession> = new Map();
  private documentSessions: Map<string, Set<string>> = new Map();
  private userSessions: Map<string, Set<string>> = new Map();
  private documentLocks: Map<string, DocumentLock> = new Map();
  private workspaceSettings: Map<string, WorkspaceSettings> = new Map();
  private performanceMetrics: CollaborationMetrics;
  
  private config: CollaborationConfig;
  
  constructor(
    io: Server,
    config: Partial<CollaborationConfig> = {},
    redisConfig?: any
  ) {
    super();
    
    this.io = io;
    this.db = new DatabaseConnection();
    this.redis = new Redis(redisConfig || process.env.REDIS_URL);
    
    this.config = {
      maxConcurrentUsers: 100,
      operationBatchSize: 10,
      presenceUpdateInterval: 5000,
      analyticsEnabled: true,
      cacheTimeout: 300000,
      performanceMonitoring: true,
      ...config
    };
    
    this.performanceMetrics = {
      activeSessions: 0,
      totalOperations: 0,
      averageLatency: 0,
      errorRate: 0,
      peakConcurrentUsers: 0,
      documentsActive: 0,
      workspacesActive: 0
    };
    
    this.initializeServices();
    this.setupSocketHandlers();
    this.startPerformanceMonitoring();
  }

  /**
   * Initialize all collaboration services
   */
  private async initializeServices(): Promise<void> {
    try {
      // Initialize core services
      this.authService = new EnterpriseAuthService();
      this.operationalTransform = new EnhancedOperationalTransform();
      this.communicationService = new CommunicationService(this.io);
      this.reviewService = new ReviewWorkflowService(this.io, this.communicationService);
      this.scalabilityService = new ScalabilityService(this.io);
      
      if (this.config.analyticsEnabled) {
        this.analytics = new CollaborationAnalytics();
      }
      
      // Setup event listeners
      this.setupEventListeners();
      
      console.log('Enhanced collaboration service initialized');
    } catch (error) {
      console.error('Error initializing collaboration services:', error);
      throw error;
    }
  }

  /**
   * Setup Socket.IO event handlers
   */
  private setupSocketHandlers(): void {
    this.io.on('connection', async (socket: Socket) => {
      console.log(`Client connected: ${socket.id}`);
      
      // Authentication
      socket.on('authenticate', async (data: { token: string }) => {
        await this.handleAuthentication(socket, data);
      });
      
      // Document collaboration
      socket.on('join-document', async (data: { documentId: string; workspaceId: string }) => {
        await this.handleJoinDocument(socket, data);
      });
      
      socket.on('leave-document', async (data: { documentId: string }) => {
        await this.handleLeaveDocument(socket, data);
      });
      
      // Real-time editing
      socket.on('operation', async (operation: any) => {
        await this.handleOperation(socket, operation);
      });
      
      socket.on('cursor-update', async (data: any) => {
        await this.handleCursorUpdate(socket, data);
      });
      
      // Communication
      socket.on('create-comment', async (data: any) => {
        await this.handleCreateComment(socket, data);
      });
      
      socket.on('update-comment', async (data: any) => {
        await this.handleUpdateComment(socket, data);
      });
      
      // Reviews and workflows
      socket.on('start-review', async (data: any) => {
        await this.handleStartReview(socket, data);
      });
      
      socket.on('submit-review', async (data: any) => {
        await this.handleSubmitReview(socket, data);
      });
      
      // Workspace management
      socket.on('join-workspace', async (data: { workspaceId: string }) => {
        await this.handleJoinWorkspace(socket, data);
      });
      
      socket.on('leave-workspace', async (data: { workspaceId: string }) => {
        await this.handleLeaveWorkspace(socket, data);
      });
      
      // Document locking
      socket.on('acquire-lock', async (data: { documentId: string; lockType: 'exclusive' | 'shared' }) => {
        await this.handleAcquireLock(socket, data);
      });
      
      socket.on('release-lock', async (data: { documentId: string }) => {
        await this.handleReleaseLock(socket, data);
      });
      
      // Presence updates
      socket.on('presence-update', async (data: UserPresence) => {
        await this.handlePresenceUpdate(socket, data);
      });
      
      // Disconnect handling
      socket.on('disconnect', async () => {
        await this.handleDisconnect(socket);
      });
      
      // Error handling
      socket.on('error', (error: Error) => {
        console.error(`Socket error for ${socket.id}:`, error);
        this.updateErrorRate(1);
      });
    });
  }

  /**
   * Setup event listeners for service coordination
   */
  private setupEventListeners(): void {
    // Operational Transform events
    this.operationalTransform.on('operation-applied', (data) => {
      this.recordAnalytics('operation_applied', data);
      this.updatePerformanceMetrics('operation', Date.now() - data.operation.timestamp);
    });
    
    // Communication events
    this.communicationService.on('comment-created', (comment) => {
      this.recordAnalytics('comment_created', comment);
    });
    
    // Review workflow events
    this.reviewService.on('review-started', (review) => {
      this.recordAnalytics('review_started', review);
    });
    
    this.reviewService.on('review-completed', (review) => {
      this.recordAnalytics('review_completed', review);
    });
    
    // Scalability events
    this.scalabilityService.on('instance-overloaded', (data) => {
      console.log('Instance overloaded:', data);
      // Handle load balancing
    });
  }

  /**
   * Handle user authentication
   */
  private async handleAuthentication(socket: Socket, data: { token: string }): Promise<void> {
    try {
      const user = await this.authService.verifyToken(data.token);
      if (!user) {
        socket.emit('auth-error', { message: 'Invalid token' });
        return;
      }
      
      // Store user info in socket
      socket.data.user = user;
      socket.join(`user:${user.id}`);
      
      // Create session
      const sessionId = uuidv4();
      socket.data.sessionId = sessionId;
      
      socket.emit('authenticated', {
        user: {
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          permissions: user.permissions
        },
        sessionId
      });
      
      console.log(`User authenticated: ${user.username} (${user.id})`);
    } catch (error) {
      console.error('Authentication error:', error);
      socket.emit('auth-error', { message: 'Authentication failed' });
    }
  }

  /**
   * Handle joining a document
   */
  private async handleJoinDocument(socket: Socket, data: { documentId: string; workspaceId: string }): Promise<void> {
    try {
      const user = socket.data.user;
      if (!user) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }
      
      // Check permissions
      const hasAccess = await this.authService.checkDocumentAccess(user.id, data.documentId, 'read');
      if (!hasAccess) {
        socket.emit('error', { message: 'Insufficient permissions' });
        return;
      }
      
      // Check concurrent user limit
      const documentSessions = this.documentSessions.get(data.documentId) || new Set();
      if (documentSessions.size >= this.config.maxConcurrentUsers) {
        socket.emit('error', { message: 'Document at maximum capacity' });
        return;
      }
      
      // Create collaboration session
      const session: CollaborationSession = {
        id: uuidv4(),
        userId: user.id,
        documentId: data.documentId,
        workspaceId: data.workspaceId,
        socketId: socket.id,
        joinedAt: new Date(),
        lastActivity: new Date(),
        permissions: user.permissions,
        metadata: {
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName
        }
      };
      
      // Store session
      this.activeSessions.set(session.id, session);
      socket.data.sessionId = session.id;
      
      // Update document sessions
      documentSessions.add(session.id);
      this.documentSessions.set(data.documentId, documentSessions);
      
      // Update user sessions
      const userSessions = this.userSessions.get(user.id) || new Set();
      userSessions.add(session.id);
      this.userSessions.set(user.id, userSessions);
      
      // Join document room
      socket.join(data.documentId);
      socket.join(data.workspaceId);
      
      // Initialize document in OT service
      const document = await this.getOrCreateDocument(data.documentId);
      await this.operationalTransform.initializeDocument(data.documentId, document.content, user.id);
      await this.operationalTransform.addParticipant(data.documentId, user.id, user.username);
      
      // Get current document state
      const documentState = await this.operationalTransform.getDocumentState(data.documentId);
      
      // Get current participants
      const participants = await this.getDocumentParticipants(data.documentId);
      
      // Send initial state to user
      socket.emit('document-joined', {
        document,
        documentState,
        participants,
        session: {
          id: session.id,
          permissions: user.permissions
        }
      });
      
      // Notify other participants
      socket.to(data.documentId).emit('participant-joined', {
        userId: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        sessionId: session.id
      });
      
      // Record analytics
      this.recordAnalytics('document_joined', {
        documentId: data.documentId,
        userId: user.id,
        workspaceId: data.workspaceId
      });
      
      // Update metrics
      this.updateMetrics();
      
      console.log(`User ${user.username} joined document ${data.documentId}`);
    } catch (error) {
      console.error('Error joining document:', error);
      socket.emit('error', { message: 'Failed to join document' });
    }
  }

  /**
   * Handle leaving a document
   */
  private async handleLeaveDocument(socket: Socket, data: { documentId: string }): Promise<void> {
    try {
      const sessionId = socket.data.sessionId;
      const session = this.activeSessions.get(sessionId);
      
      if (!session || session.documentId !== data.documentId) {
        return;
      }
      
      // Remove from document sessions
      const documentSessions = this.documentSessions.get(data.documentId);
      if (documentSessions) {
        documentSessions.delete(sessionId);
        if (documentSessions.size === 0) {
          this.documentSessions.delete(data.documentId);
        }
      }
      
      // Remove from user sessions
      const userSessions = this.userSessions.get(session.userId);
      if (userSessions) {
        userSessions.delete(sessionId);
        if (userSessions.size === 0) {
          this.userSessions.delete(session.userId);
        }
      }
      
      // Remove participant from OT service
      await this.operationalTransform.removeParticipant(data.documentId, session.userId);
      
      // Leave document room
      socket.leave(data.documentId);
      
      // Notify other participants
      socket.to(data.documentId).emit('participant-left', {
        userId: session.userId,
        username: session.metadata.username,
        sessionId
      });
      
      // Release any locks
      const lock = this.documentLocks.get(data.documentId);
      if (lock && lock.userId === session.userId) {
        this.documentLocks.delete(data.documentId);
        socket.to(data.documentId).emit('lock-released', { documentId: data.documentId });
      }
      
      // Remove session
      this.activeSessions.delete(sessionId);
      
      // Record analytics
      this.recordAnalytics('document_left', {
        documentId: data.documentId,
        userId: session.userId,
        sessionDuration: Date.now() - session.joinedAt.getTime()
      });
      
      // Update metrics
      this.updateMetrics();
      
      console.log(`User ${session.metadata.username} left document ${data.documentId}`);
    } catch (error) {
      console.error('Error leaving document:', error);
    }
  }

  /**
   * Handle document operation
   */
  private async handleOperation(socket: Socket, operation: any): Promise<void> {
    const startTime = Date.now();
    
    try {
      const sessionId = socket.data.sessionId;
      const session = this.activeSessions.get(sessionId);
      
      if (!session) {
        socket.emit('error', { message: 'No active session' });
        return;
      }
      
      // Check edit permissions
      const hasPermission = await this.authService.checkDocumentAccess(
        session.userId,
        session.documentId,
        'write'
      );
      
      if (!hasPermission) {
        socket.emit('error', { message: 'Insufficient permissions to edit' });
        return;
      }
      
      // Check document lock
      const lock = this.documentLocks.get(session.documentId);
      if (lock && lock.lockType === 'exclusive' && lock.userId !== session.userId) {
        socket.emit('error', { message: 'Document is locked by another user' });
        return;
      }
      
      // Apply operation
      const result = await this.operationalTransform.applyOperation({
        ...operation,
        userId: session.userId,
        documentId: session.documentId
      });
      
      // Broadcast to other participants
      socket.to(session.documentId).emit('operation', result.operation);
      
      // Send acknowledgment
      socket.emit('operation-ack', {
        operationId: operation.id,
        success: true,
        conflicts: result.conflicts
      });
      
      // Update session activity
      session.lastActivity = new Date();
      
      // Record analytics
      this.recordAnalytics('operation', {
        documentId: session.documentId,
        userId: session.userId,
        operationType: operation.type,
        conflictCount: result.conflicts?.length || 0
      });
      
      // Update performance metrics
      this.updatePerformanceMetrics('operation', Date.now() - startTime);
      
    } catch (error) {
      console.error('Error handling operation:', error);
      socket.emit('operation-ack', {
        operationId: operation.id,
        success: false,
        error: error.message
      });
      this.updateErrorRate(1);
    }
  }

  /**
   * Handle cursor position updates
   */
  private async handleCursorUpdate(socket: Socket, data: any): Promise<void> {
    try {
      const sessionId = socket.data.sessionId;
      const session = this.activeSessions.get(sessionId);
      
      if (!session) {
        return;
      }
      
      // Broadcast cursor update to other participants
      socket.to(session.documentId).emit('cursor-update', {
        userId: session.userId,
        username: session.metadata.username,
        position: data.position,
        selection: data.selection
      });
      
      // Update session activity
      session.lastActivity = new Date();
    } catch (error) {
      console.error('Error handling cursor update:', error);
    }
  }

  /**
   * Handle comment creation
   */
  private async handleCreateComment(socket: Socket, data: any): Promise<void> {
    try {
      const sessionId = socket.data.sessionId;
      const session = this.activeSessions.get(sessionId);
      
      if (!session) {
        socket.emit('error', { message: 'No active session' });
        return;
      }
      
      const comment = await this.communicationService.createComment({
        documentId: session.documentId,
        authorId: session.userId,
        content: data.content,
        parentCommentId: data.parentCommentId,
        positionData: data.positionData
      });
      
      // Broadcast to document participants
      this.io.to(session.documentId).emit('comment-created', comment);
      
      socket.emit('comment-ack', {
        tempId: data.tempId,
        comment
      });
    } catch (error) {
      console.error('Error creating comment:', error);
      socket.emit('error', { message: 'Failed to create comment' });
    }
  }

  /**
   * Handle comment updates
   */
  private async handleUpdateComment(socket: Socket, data: any): Promise<void> {
    try {
      const sessionId = socket.data.sessionId;
      const session = this.activeSessions.get(sessionId);
      
      if (!session) {
        socket.emit('error', { message: 'No active session' });
        return;
      }
      
      const updatedComment = await this.communicationService.updateComment(
        data.commentId,
        {
          content: data.content,
          resolved: data.resolved,
          resolvedBy: data.resolved ? session.userId : undefined
        }
      );
      
      if (updatedComment) {
        this.io.to(session.documentId).emit('comment-updated', updatedComment);
      }
    } catch (error) {
      console.error('Error updating comment:', error);
      socket.emit('error', { message: 'Failed to update comment' });
    }
  }

  /**
   * Handle review workflow start
   */
  private async handleStartReview(socket: Socket, data: any): Promise<void> {
    try {
      const sessionId = socket.data.sessionId;
      const session = this.activeSessions.get(sessionId);
      
      if (!session) {
        socket.emit('error', { message: 'No active session' });
        return;
      }
      
      const review = await this.reviewService.startReview({
        documentId: session.documentId,
        workflowId: data.workflowId,
        requestedBy: session.userId,
        customReviewers: data.customReviewers,
        priority: data.priority || 'medium',
        comments: data.comments
      });
      
      socket.emit('review-started', review);
      
      // Notify workspace members
      this.io.to(session.workspaceId).emit('review-notification', {
        type: 'review_started',
        review,
        document: { id: session.documentId }
      });
    } catch (error) {
      console.error('Error starting review:', error);
      socket.emit('error', { message: 'Failed to start review' });
    }
  }

  /**
   * Handle review submission
   */
  private async handleSubmitReview(socket: Socket, data: any): Promise<void> {
    try {
      const sessionId = socket.data.sessionId;
      const session = this.activeSessions.get(sessionId);
      
      if (!session) {
        socket.emit('error', { message: 'No active session' });
        return;
      }
      
      const success = await this.reviewService.submitReview(data.assignmentId, {
        decision: data.decision,
        feedback: data.feedback,
        timeSpent: data.timeSpent,
        suggestions: data.suggestions
      });
      
      socket.emit('review-submitted', { success, assignmentId: data.assignmentId });
    } catch (error) {
      console.error('Error submitting review:', error);
      socket.emit('error', { message: 'Failed to submit review' });
    }
  }

  /**
   * Handle workspace join
   */
  private async handleJoinWorkspace(socket: Socket, data: { workspaceId: string }): Promise<void> {
    try {
      const user = socket.data.user;
      if (!user) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }
      
      // Check workspace access
      const hasAccess = await this.authService.checkWorkspaceAccess(user.id, data.workspaceId, 'read');
      if (!hasAccess) {
        socket.emit('error', { message: 'Access denied to workspace' });
        return;
      }
      
      socket.join(`workspace:${data.workspaceId}`);
      socket.emit('workspace-joined', { workspaceId: data.workspaceId });
      
      console.log(`User ${user.username} joined workspace ${data.workspaceId}`);
    } catch (error) {
      console.error('Error joining workspace:', error);
      socket.emit('error', { message: 'Failed to join workspace' });
    }
  }

  /**
   * Handle workspace leave
   */
  private async handleLeaveWorkspace(socket: Socket, data: { workspaceId: string }): Promise<void> {
    socket.leave(`workspace:${data.workspaceId}`);
    socket.emit('workspace-left', { workspaceId: data.workspaceId });
  }

  /**
   * Handle document lock acquisition
   */
  private async handleAcquireLock(socket: Socket, data: { documentId: string; lockType: 'exclusive' | 'shared' }): Promise<void> {
    try {
      const sessionId = socket.data.sessionId;
      const session = this.activeSessions.get(sessionId);
      
      if (!session || session.documentId !== data.documentId) {
        socket.emit('error', { message: 'Invalid session or document' });
        return;
      }
      
      // Check if document is already locked
      const existingLock = this.documentLocks.get(data.documentId);
      if (existingLock) {
        if (existingLock.lockType === 'exclusive' || data.lockType === 'exclusive') {
          socket.emit('lock-denied', {
            documentId: data.documentId,
            reason: 'Document is already locked',
            lockedBy: existingLock.userId
          });
          return;
        }
      }
      
      // Acquire lock
      const lock: DocumentLock = {
        documentId: data.documentId,
        userId: session.userId,
        lockType: data.lockType,
        acquiredAt: new Date(),
        expiresAt: new Date(Date.now() + 300000) // 5 minutes
      };
      
      this.documentLocks.set(data.documentId, lock);
      
      socket.emit('lock-acquired', { documentId: data.documentId, lock });
      socket.to(data.documentId).emit('document-locked', {
        documentId: data.documentId,
        lockType: data.lockType,
        lockedBy: {
          userId: session.userId,
          username: session.metadata.username
        }
      });
    } catch (error) {
      console.error('Error acquiring lock:', error);
      socket.emit('error', { message: 'Failed to acquire lock' });
    }
  }

  /**
   * Handle document lock release
   */
  private async handleReleaseLock(socket: Socket, data: { documentId: string }): Promise<void> {
    try {
      const sessionId = socket.data.sessionId;
      const session = this.activeSessions.get(sessionId);
      
      if (!session) {
        return;
      }
      
      const lock = this.documentLocks.get(data.documentId);
      if (lock && lock.userId === session.userId) {
        this.documentLocks.delete(data.documentId);
        
        socket.emit('lock-released', { documentId: data.documentId });
        socket.to(data.documentId).emit('document-unlocked', { documentId: data.documentId });
      }
    } catch (error) {
      console.error('Error releasing lock:', error);
    }
  }

  /**
   * Handle presence updates
   */
  private async handlePresenceUpdate(socket: Socket, data: UserPresence): Promise<void> {
    try {
      const sessionId = socket.data.sessionId;
      const session = this.activeSessions.get(sessionId);
      
      if (!session) {
        return;
      }
      
      // Update session activity
      session.lastActivity = new Date();
      
      // Broadcast presence update
      socket.to(session.documentId).emit('presence-update', {
        userId: session.userId,
        username: session.metadata.username,
        status: data.status,
        cursorPosition: data.cursorPosition,
        selection: data.selection,
        lastSeen: new Date()
      });
    } catch (error) {
      console.error('Error handling presence update:', error);
    }
  }

  /**
   * Handle client disconnect
   */
  private async handleDisconnect(socket: Socket): Promise<void> {
    try {
      const sessionId = socket.data.sessionId;
      const session = this.activeSessions.get(sessionId);
      
      if (!session) {
        return;
      }
      
      // Leave document if in one
      if (session.documentId) {
        await this.handleLeaveDocument(socket, { documentId: session.documentId });
      }
      
      // Release any locks
      for (const [documentId, lock] of this.documentLocks.entries()) {
        if (lock.userId === session.userId) {
          this.documentLocks.delete(documentId);
          this.io.to(documentId).emit('document-unlocked', { documentId });
        }
      }
      
      // Clean up session data
      this.activeSessions.delete(sessionId);
      
      // Update metrics
      this.updateMetrics();
      
      console.log(`Client disconnected: ${socket.id}`);
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  }

  // Utility methods

  private async getOrCreateDocument(documentId: string): Promise<CollaborativeDocument> {
    try {
      const result = await this.db.query(`
        SELECT * FROM collaboration.documents WHERE id = $1
      `, [documentId]);
      
      if (result.rows.length > 0) {
        const doc = result.rows[0];
        return {
          id: doc.id,
          title: doc.title,
          content: doc.content,
          version: doc.version || 0,
          participants: [], // Will be populated from active sessions
          permissions: {
            owner: doc.created_by,
            editors: [],
            viewers: [],
            public: false
          },
          createdAt: new Date(doc.created_at),
          updatedAt: new Date(doc.updated_at)
        };
      } else {
        throw new Error('Document not found');
      }
    } catch (error) {
      console.error('Error getting document:', error);
      throw error;
    }
  }

  private async getDocumentParticipants(documentId: string): Promise<any[]> {
    const documentSessions = this.documentSessions.get(documentId) || new Set();
    const participants = [];
    
    for (const sessionId of documentSessions) {
      const session = this.activeSessions.get(sessionId);
      if (session) {
        participants.push({
          userId: session.userId,
          username: session.metadata.username,
          firstName: session.metadata.firstName,
          lastName: session.metadata.lastName,
          joinedAt: session.joinedAt,
          lastActivity: session.lastActivity
        });
      }
    }
    
    return participants;
  }

  private recordAnalytics(eventType: string, data: any): void {
    if (this.config.analyticsEnabled && this.analytics) {
      // Map event types to metric types
      const metricTypeMap: Record<string, any> = {
        operation: 'edit_count',
        comment_created: 'comment_count',
        review_started: 'review_count',
        document_joined: 'document_views'
      };
      
      const metricType = metricTypeMap[eventType];
      if (metricType) {
        this.analytics.recordMetric({
          workspaceId: data.workspaceId,
          documentId: data.documentId,
          userId: data.userId,
          metricType,
          value: 1,
          dimensions: data
        });
      }
    }
  }

  private updatePerformanceMetrics(operation: string, duration: number): void {
    if (this.config.performanceMonitoring) {
      this.performanceMetrics.totalOperations++;
      
      // Update average latency
      if (this.performanceMetrics.averageLatency === 0) {
        this.performanceMetrics.averageLatency = duration;
      } else {
        this.performanceMetrics.averageLatency = 
          (this.performanceMetrics.averageLatency + duration) / 2;
      }
    }
  }

  private updateMetrics(): void {
    this.performanceMetrics.activeSessions = this.activeSessions.size;
    this.performanceMetrics.documentsActive = this.documentSessions.size;
    
    // Update peak concurrent users
    if (this.activeSessions.size > this.performanceMetrics.peakConcurrentUsers) {
      this.performanceMetrics.peakConcurrentUsers = this.activeSessions.size;
    }
  }

  private updateErrorRate(increment: number): void {
    // Simple error rate tracking - in production would be more sophisticated
    this.performanceMetrics.errorRate += increment;
  }

  private startPerformanceMonitoring(): void {
    if (this.config.performanceMonitoring) {
      setInterval(() => {
        console.log('Collaboration Metrics:', this.performanceMetrics);
        
        // Publish metrics to Redis for monitoring
        this.scalabilityService.publishMessage('collab:metrics', {
          instanceId: process.env.INSTANCE_ID || 'default',
          metrics: this.performanceMetrics,
          timestamp: Date.now()
        });
      }, 60000); // Every minute
    }
  }

  /**
   * Get current collaboration metrics
   */
  public getMetrics(): CollaborationMetrics {
    this.updateMetrics();
    return { ...this.performanceMetrics };
  }

  /**
   * Get active sessions for document
   */
  public getDocumentSessions(documentId: string): CollaborationSession[] {
    const sessionIds = this.documentSessions.get(documentId) || new Set();
    const sessions = [];
    
    for (const sessionId of sessionIds) {
      const session = this.activeSessions.get(sessionId);
      if (session) {
        sessions.push(session);
      }
    }
    
    return sessions;
  }

  /**
   * Force disconnect user from document
   */
  public async forceDisconnectFromDocument(userId: string, documentId: string): Promise<boolean> {
    const userSessions = this.userSessions.get(userId) || new Set();
    
    for (const sessionId of userSessions) {
      const session = this.activeSessions.get(sessionId);
      if (session && session.documentId === documentId) {
        const socket = this.io.sockets.sockets.get(session.socketId);
        if (socket) {
          socket.emit('force-disconnect', {
            reason: 'Disconnected by administrator',
            documentId
          });
          socket.disconnect();
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    try {
      await this.operationalTransform.cleanup();
      await this.communicationService.cleanup();
      await this.reviewService.cleanup();
      await this.scalabilityService.cleanup();
      
      if (this.analytics) {
        await this.analytics.cleanup();
      }
      
      await this.redis.quit();
      
      this.activeSessions.clear();
      this.documentSessions.clear();
      this.userSessions.clear();
      this.documentLocks.clear();
      this.workspaceSettings.clear();
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

export default EnhancedCollaborationService;