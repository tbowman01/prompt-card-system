/**
 * Main Collaboration Service
 * Orchestrates real-time collaborative editing with operational transforms and presence
 */

import { Server, Socket } from 'socket.io';
import OperationalTransform, { Operation, DocumentState } from './OperationalTransform';
import CRDTService, { CRDTOperation } from './CRDTService';
import PresenceService, { UserPresence } from './PresenceService';

export interface CollaborativeDocument {
  id: string;
  title: string;
  content: string;
  version: number;
  participants: string[];
  permissions: DocumentPermissions;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentPermissions {
  owner: string;
  editors: string[];
  viewers: string[];
  public: boolean;
}

export interface UserSession {
  userId: string;
  username: string;
  socketId: string;
  documentId: string;
  role: 'owner' | 'editor' | 'viewer';
  lastActivity: Date;
}

export interface CollaborationEvent {
  type: 'operation' | 'presence' | 'cursor' | 'selection';
  data: any;
  userId: string;
  documentId: string;
  timestamp: number;
}

export class CollaborationService {
  private io: Server;
  private operationalTransform: OperationalTransform;
  private crdtService: CRDTService;
  private presenceService: PresenceService;
  private documents: Map<string, CollaborativeDocument> = new Map();
  private userSessions: Map<string, UserSession> = new Map();
  private documentParticipants: Map<string, Set<string>> = new Map();

  constructor(io: Server) {
    this.io = io;
    this.operationalTransform = new OperationalTransform();
    this.crdtService = new CRDTService();
    this.presenceService = new PresenceService();
    this.setupSocketHandlers();
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`Client connected: ${socket.id}`);

      // Join document room
      socket.on('join-document', async (data: { documentId: string; userId: string; username: string }) => {
        await this.handleJoinDocument(socket, data);
      });

      // Handle document operations
      socket.on('operation', async (operation: Operation) => {
        await this.handleOperation(socket, operation);
      });

      // Handle CRDT operations
      socket.on('crdt-operation', async (operation: CRDTOperation) => {
        await this.handleCRDTOperation(socket, operation);
      });

      // Handle cursor/selection updates
      socket.on('cursor-update', (data: { documentId: string; userId: string; position: number; selection?: { start: number; end: number } }) => {
        this.handleCursorUpdate(socket, data);
      });

      // Handle user presence
      socket.on('presence-update', (presence: UserPresence) => {
        this.handlePresenceUpdate(socket, presence);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });

      // Handle document creation
      socket.on('create-document', async (data: { title: string; content?: string; userId: string }) => {
        await this.handleCreateDocument(socket, data);
      });

      // Handle permission changes
      socket.on('update-permissions', async (data: { documentId: string; permissions: DocumentPermissions; userId: string }) => {
        await this.handleUpdatePermissions(socket, data);
      });
    });
  }

  /**
   * Handle user joining a document
   */
  private async handleJoinDocument(socket: Socket, data: { documentId: string; userId: string; username: string }): Promise<void> {
    const { documentId, userId, username } = data;

    // Check if document exists
    let document = this.documents.get(documentId);
    if (!document) {
      // Create new document if it doesn't exist
      document = await this.createDocument(documentId, 'Untitled Document', '', userId);
    }

    // Check permissions
    const hasPermission = this.checkPermission(document, userId, 'view');
    if (!hasPermission) {
      socket.emit('error', { message: 'Insufficient permissions' });
      return;
    }

    // Join document room
    socket.join(documentId);

    // Create user session
    const userRole = this.getUserRole(document, userId);
    const session: UserSession = {
      userId,
      username,
      socketId: socket.id,
      documentId,
      role: userRole,
      lastActivity: new Date()
    };

    this.userSessions.set(socket.id, session);

    // Add to document participants
    if (!this.documentParticipants.has(documentId)) {
      this.documentParticipants.set(documentId, new Set());
    }
    this.documentParticipants.get(documentId)!.add(userId);

    // Initialize document in OT and CRDT services
    this.operationalTransform.initializeDocument(documentId, document.content);
    this.crdtService.initializeDocument(documentId, document.content);

    // Send initial document state
    socket.emit('document-state', {
      document,
      otState: this.operationalTransform.getDocumentState(documentId),
      crdtState: this.crdtService.getDocumentState(documentId)
    });

    // Update presence
    this.presenceService.updatePresence({
      userId,
      username,
      documentId,
      status: 'active',
      lastSeen: new Date(),
      cursor: { position: 0 }
    });

    // Notify other participants
    socket.to(documentId).emit('user-joined', {
      userId,
      username,
      role: userRole
    });

    // Send current participants
    const participants = await this.getDocumentParticipants(documentId);
    socket.emit('participants-list', participants);
  }

  /**
   * Handle operational transform operation
   */
  private async handleOperation(socket: Socket, operation: Operation): Promise<void> {
    const session = this.userSessions.get(socket.id);
    if (!session) {
      socket.emit('error', { message: 'No active session' });
      return;
    }

    const document = this.documents.get(session.documentId);
    if (!document) {
      socket.emit('error', { message: 'Document not found' });
      return;
    }

    // Check edit permissions
    const hasPermission = this.checkPermission(document, session.userId, 'edit');
    if (!hasPermission) {
      socket.emit('error', { message: 'Insufficient permissions' });
      return;
    }

    // Add operation to queue and process
    this.operationalTransform.addPendingOperation(operation);
    const newState = this.operationalTransform.processOperationQueue(session.documentId);

    if (newState) {
      // Update document content
      document.content = newState.content;
      document.version = newState.version;
      document.updatedAt = new Date();

      // Broadcast operation to other participants
      socket.to(session.documentId).emit('operation', operation);

      // Send acknowledgment to sender
      socket.emit('operation-ack', {
        operationId: operation.id,
        newVersion: newState.version
      });
    }
  }

  /**
   * Handle CRDT operation
   */
  private async handleCRDTOperation(socket: Socket, operation: CRDTOperation): Promise<void> {
    const session = this.userSessions.get(socket.id);
    if (!session) {
      socket.emit('error', { message: 'No active session' });
      return;
    }

    const document = this.documents.get(session.documentId);
    if (!document) {
      socket.emit('error', { message: 'Document not found' });
      return;
    }

    // Check edit permissions
    const hasPermission = this.checkPermission(document, session.userId, 'edit');
    if (!hasPermission) {
      socket.emit('error', { message: 'Insufficient permissions' });
      return;
    }

    // Apply CRDT operation
    const success = this.crdtService.applyOperation(operation);
    
    if (success) {
      // Update document content
      document.content = this.crdtService.getDocumentContent(session.documentId);
      document.updatedAt = new Date();

      // Broadcast operation to other participants
      socket.to(session.documentId).emit('crdt-operation', operation);

      // Send acknowledgment to sender
      socket.emit('crdt-operation-ack', {
        operationId: operation.id,
        success: true
      });
    } else {
      socket.emit('crdt-operation-ack', {
        operationId: operation.id,
        success: false,
        error: 'Failed to apply operation'
      });
    }
  }

  /**
   * Handle cursor position updates
   */
  private handleCursorUpdate(socket: Socket, data: { documentId: string; userId: string; position: number; selection?: { start: number; end: number } }): void {
    const session = this.userSessions.get(socket.id);
    if (!session || session.documentId !== data.documentId) {
      return;
    }

    // Update presence with cursor position
    this.presenceService.updatePresence({
      userId: data.userId,
      username: session.username,
      documentId: data.documentId,
      status: 'active',
      lastSeen: new Date(),
      cursor: {
        position: data.position,
        selection: data.selection
      }
    });

    // Broadcast cursor update to other participants
    socket.to(data.documentId).emit('cursor-update', {
      userId: data.userId,
      username: session.username,
      position: data.position,
      selection: data.selection
    });
  }

  /**
   * Handle presence updates
   */
  private handlePresenceUpdate(socket: Socket, presence: UserPresence): void {
    const session = this.userSessions.get(socket.id);
    if (!session || session.documentId !== presence.documentId) {
      return;
    }

    this.presenceService.updatePresence(presence);

    // Broadcast presence update
    socket.to(presence.documentId).emit('presence-update', presence);
  }

  /**
   * Handle user disconnect
   */
  private handleDisconnect(socket: Socket): void {
    const session = this.userSessions.get(socket.id);
    if (!session) {
      return;
    }

    // Remove from participants
    const participants = this.documentParticipants.get(session.documentId);
    if (participants) {
      participants.delete(session.userId);
    }

    // Update presence to offline
    this.presenceService.updatePresence({
      userId: session.userId,
      username: session.username,
      documentId: session.documentId,
      status: 'offline',
      lastSeen: new Date(),
      cursor: { position: 0 }
    });

    // Notify other participants
    socket.to(session.documentId).emit('user-left', {
      userId: session.userId,
      username: session.username
    });

    // Clean up session
    this.userSessions.delete(socket.id);

    console.log(`Client disconnected: ${socket.id}`);
  }

  /**
   * Handle document creation
   */
  private async handleCreateDocument(socket: Socket, data: { title: string; content?: string; userId: string }): Promise<void> {
    const document = await this.createDocument(
      this.generateDocumentId(),
      data.title,
      data.content || '',
      data.userId
    );

    socket.emit('document-created', document);
  }

  /**
   * Handle permission updates
   */
  private async handleUpdatePermissions(socket: Socket, data: { documentId: string; permissions: DocumentPermissions; userId: string }): Promise<void> {
    const document = this.documents.get(data.documentId);
    if (!document) {
      socket.emit('error', { message: 'Document not found' });
      return;
    }

    // Check if user is owner
    if (document.permissions.owner !== data.userId) {
      socket.emit('error', { message: 'Only owner can update permissions' });
      return;
    }

    // Update permissions
    document.permissions = data.permissions;
    document.updatedAt = new Date();

    // Broadcast permission update
    this.io.to(data.documentId).emit('permissions-updated', data.permissions);
  }

  /**
   * Create a new document
   */
  private async createDocument(id: string, title: string, content: string, ownerId: string): Promise<CollaborativeDocument> {
    const document: CollaborativeDocument = {
      id,
      title,
      content,
      version: 0,
      participants: [ownerId],
      permissions: {
        owner: ownerId,
        editors: [],
        viewers: [],
        public: false
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.documents.set(id, document);
    return document;
  }

  /**
   * Check user permissions for document
   */
  private checkPermission(document: CollaborativeDocument, userId: string, action: 'view' | 'edit' | 'admin'): boolean {
    const { permissions } = document;

    if (permissions.owner === userId) {
      return true;
    }

    switch (action) {
      case 'view':
        return permissions.public || 
               permissions.editors.includes(userId) || 
               permissions.viewers.includes(userId);
      case 'edit':
        return permissions.editors.includes(userId);
      case 'admin':
        return permissions.owner === userId;
      default:
        return false;
    }
  }

  /**
   * Get user role in document
   */
  private getUserRole(document: CollaborativeDocument, userId: string): 'owner' | 'editor' | 'viewer' {
    if (document.permissions.owner === userId) {
      return 'owner';
    }
    if (document.permissions.editors.includes(userId)) {
      return 'editor';
    }
    return 'viewer';
  }

  /**
   * Get document participants with presence info
   */
  private async getDocumentParticipants(documentId: string): Promise<any[]> {
    const participants = this.documentParticipants.get(documentId) || new Set();
    const result = [];

    for (const userId of participants) {
      const presence = this.presenceService.getPresence(userId, documentId);
      const session = Array.from(this.userSessions.values())
        .find(s => s.userId === userId && s.documentId === documentId);

      result.push({
        userId,
        username: session?.username || 'Unknown',
        role: session?.role || 'viewer',
        presence,
        lastActivity: session?.lastActivity
      });
    }

    return result;
  }

  /**
   * Generate unique document ID
   */
  private generateDocumentId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get collaboration metrics
   */
  public getMetrics(): {
    activeDocuments: number;
    activeSessions: number;
    totalOperations: number;
    averageParticipantsPerDocument: number;
  } {
    const otMetrics = this.operationalTransform.getMetrics();
    const crdtMetrics = this.crdtService.getMetrics();
    
    const totalParticipants = Array.from(this.documentParticipants.values())
      .reduce((sum, participants) => sum + participants.size, 0);

    return {
      activeDocuments: this.documents.size,
      activeSessions: this.userSessions.size,
      totalOperations: otMetrics.pendingOperationsCount,
      averageParticipantsPerDocument: this.documents.size > 0 ? totalParticipants / this.documents.size : 0
    };
  }

  /**
   * Get document by ID
   */
  public getDocument(documentId: string): CollaborativeDocument | undefined {
    return this.documents.get(documentId);
  }

  /**
   * Get all documents for user
   */
  public getUserDocuments(userId: string): CollaborativeDocument[] {
    return Array.from(this.documents.values()).filter(doc => 
      doc.permissions.owner === userId ||
      doc.permissions.editors.includes(userId) ||
      doc.permissions.viewers.includes(userId) ||
      doc.permissions.public
    );
  }
}

export default CollaborationService;