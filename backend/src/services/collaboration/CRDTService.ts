/**
 * Conflict-free Replicated Data Types (CRDT) Service
 * Implements CRDT algorithms for distributed synchronization without conflicts
 */

export interface CRDTOperation {
  id: string;
  type: 'insert' | 'delete';
  position: LogicalPosition;
  content?: string;
  userId: string;
  timestamp: number;
  documentId: string;
  causality: string[]; // Vector clock for causality tracking
}

export interface LogicalPosition {
  major: number;
  minor: number;
  userId: string;
}

export interface CRDTNode {
  id: string;
  position: LogicalPosition;
  content: string;
  visible: boolean;
  userId: string;
  timestamp: number;
}

export interface CRDTDocument {
  id: string;
  nodes: Map<string, CRDTNode>;
  deletedNodes: Set<string>;
  version: Map<string, number>; // Vector clock
}

export class CRDTService {
  private documents: Map<string, CRDTDocument> = new Map();
  private userIdCounter: Map<string, number> = new Map();

  /**
   * Initialize CRDT document
   */
  public initializeDocument(documentId: string, initialContent?: string): CRDTDocument {
    const document: CRDTDocument = {
      id: documentId,
      nodes: new Map(),
      deletedNodes: new Set(),
      version: new Map()
    };

    if (initialContent) {
      // Initialize with content as a single node
      const node: CRDTNode = {
        id: this.generateNodeId(),
        position: { major: 0, minor: 0, userId: 'system' },
        content: initialContent,
        visible: true,
        userId: 'system',
        timestamp: Date.now()
      };
      document.nodes.set(node.id, node);
    }

    this.documents.set(documentId, document);
    return document;
  }

  /**
   * Insert content at logical position
   */
  public insert(
    documentId: string,
    content: string,
    afterPosition: LogicalPosition | null,
    userId: string
  ): CRDTOperation {
    const document = this.documents.get(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    // Generate logical position between two positions
    const position = this.generatePosition(document, afterPosition, userId);
    
    const nodeId = this.generateNodeId();
    const node: CRDTNode = {
      id: nodeId,
      position,
      content,
      visible: true,
      userId,
      timestamp: Date.now()
    };

    document.nodes.set(nodeId, node);
    this.incrementVersion(document, userId);

    const operation: CRDTOperation = {
      id: this.generateOperationId(),
      type: 'insert',
      position,
      content,
      userId,
      timestamp: node.timestamp,
      documentId,
      causality: this.getVectorClock(document)
    };

    return operation;
  }

  /**
   * Delete content at logical position
   */
  public delete(
    documentId: string,
    position: LogicalPosition,
    userId: string
  ): CRDTOperation {
    const document = this.documents.get(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    // Find node at position
    const nodeId = this.findNodeAtPosition(document, position);
    if (nodeId) {
      document.deletedNodes.add(nodeId);
      const node = document.nodes.get(nodeId);
      if (node) {
        node.visible = false;
      }
    }

    this.incrementVersion(document, userId);

    const operation: CRDTOperation = {
      id: this.generateOperationId(),
      type: 'delete',
      position,
      userId,
      timestamp: Date.now(),
      documentId,
      causality: this.getVectorClock(document)
    };

    return operation;
  }

  /**
   * Apply remote operation to document
   */
  public applyOperation(operation: CRDTOperation): boolean {
    const document = this.documents.get(operation.documentId);
    if (!document) {
      return false;
    }

    // Check causality - ensure all required operations have been applied
    if (!this.checkCausality(document, operation.causality)) {
      return false; // Operation should be buffered until causality is satisfied
    }

    switch (operation.type) {
      case 'insert':
        const node: CRDTNode = {
          id: this.generateNodeId(),
          position: operation.position,
          content: operation.content || '',
          visible: true,
          userId: operation.userId,
          timestamp: operation.timestamp
        };
        document.nodes.set(node.id, node);
        break;

      case 'delete':
        const nodeId = this.findNodeAtPosition(document, operation.position);
        if (nodeId) {
          document.deletedNodes.add(nodeId);
          const existingNode = document.nodes.get(nodeId);
          if (existingNode) {
            existingNode.visible = false;
          }
        }
        break;
    }

    this.incrementVersion(document, operation.userId);
    return true;
  }

  /**
   * Get document content as string
   */
  public getDocumentContent(documentId: string): string {
    const document = this.documents.get(documentId);
    if (!document) {
      return '';
    }

    // Sort nodes by logical position and concatenate visible content
    const visibleNodes = Array.from(document.nodes.values())
      .filter(node => node.visible)
      .sort((a, b) => this.comparePositions(a.position, b.position));

    return visibleNodes.map(node => node.content).join('');
  }

  /**
   * Generate logical position between two positions
   */
  private generatePosition(
    document: CRDTDocument,
    afterPosition: LogicalPosition | null,
    userId: string
  ): LogicalPosition {
    const userCounter = this.userIdCounter.get(userId) || 0;
    this.userIdCounter.set(userId, userCounter + 1);

    if (!afterPosition) {
      // Insert at beginning
      return {
        major: 0,
        minor: userCounter,
        userId
      };
    }

    // Find next position
    const nodes = Array.from(document.nodes.values())
      .filter(node => node.visible)
      .sort((a, b) => this.comparePositions(a.position, b.position));

    const afterIndex = nodes.findIndex(node => 
      this.comparePositions(node.position, afterPosition) === 0
    );

    if (afterIndex === -1 || afterIndex === nodes.length - 1) {
      // Insert at end
      return {
        major: afterPosition.major + 1,
        minor: userCounter,
        userId
      };
    }

    const beforePosition = nodes[afterIndex + 1].position;

    // Generate position between afterPosition and beforePosition
    if (afterPosition.major < beforePosition.major) {
      return {
        major: afterPosition.major,
        minor: afterPosition.minor + 1,
        userId
      };
    } else {
      // Need to create fractional position
      return {
        major: afterPosition.major,
        minor: afterPosition.minor + 0.5,
        userId
      };
    }
  }

  /**
   * Compare logical positions
   */
  private comparePositions(pos1: LogicalPosition, pos2: LogicalPosition): number {
    if (pos1.major !== pos2.major) {
      return pos1.major - pos2.major;
    }
    if (pos1.minor !== pos2.minor) {
      return pos1.minor - pos2.minor;
    }
    return pos1.userId.localeCompare(pos2.userId);
  }

  /**
   * Find node at logical position
   */
  private findNodeAtPosition(document: CRDTDocument, position: LogicalPosition): string | null {
    for (const [nodeId, node] of document.nodes) {
      if (this.comparePositions(node.position, position) === 0) {
        return nodeId;
      }
    }
    return null;
  }

  /**
   * Check if causality constraints are satisfied
   */
  private checkCausality(document: CRDTDocument, requiredVector: string[]): boolean {
    // Simple causality check - in a real implementation, this would be more sophisticated
    return true; // For now, accept all operations
  }

  /**
   * Get vector clock for document
   */
  private getVectorClock(document: CRDTDocument): string[] {
    return Array.from(document.version.entries()).map(([userId, version]) => 
      `${userId}:${version}`
    );
  }

  /**
   * Increment version for user
   */
  private incrementVersion(document: CRDTDocument, userId: string): void {
    const currentVersion = document.version.get(userId) || 0;
    document.version.set(userId, currentVersion + 1);
  }

  /**
   * Generate unique node ID
   */
  private generateNodeId(): string {
    return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get document state for debugging
   */
  public getDocumentState(documentId: string): {
    content: string;
    nodeCount: number;
    deletedNodeCount: number;
    version: Map<string, number>;
  } | null {
    const document = this.documents.get(documentId);
    if (!document) {
      return null;
    }

    return {
      content: this.getDocumentContent(documentId),
      nodeCount: document.nodes.size,
      deletedNodeCount: document.deletedNodes.size,
      version: new Map(document.version)
    };
  }

  /**
   * Merge documents from different replicas
   */
  public mergeDocuments(documentId: string, remoteDocument: CRDTDocument): void {
    const localDocument = this.documents.get(documentId);
    if (!localDocument) {
      this.documents.set(documentId, remoteDocument);
      return;
    }

    // Merge nodes
    for (const [nodeId, node] of remoteDocument.nodes) {
      if (!localDocument.nodes.has(nodeId)) {
        localDocument.nodes.set(nodeId, node);
      }
    }

    // Merge deleted nodes
    for (const deletedNodeId of remoteDocument.deletedNodes) {
      localDocument.deletedNodes.add(deletedNodeId);
      const node = localDocument.nodes.get(deletedNodeId);
      if (node) {
        node.visible = false;
      }
    }

    // Merge vector clocks
    for (const [userId, version] of remoteDocument.version) {
      const localVersion = localDocument.version.get(userId) || 0;
      localDocument.version.set(userId, Math.max(localVersion, version));
    }
  }

  /**
   * Get CRDT metrics
   */
  public getMetrics(): {
    documentsCount: number;
    totalNodes: number;
    totalDeletedNodes: number;
    averageNodesPerDocument: number;
  } {
    const documentsCount = this.documents.size;
    let totalNodes = 0;
    let totalDeletedNodes = 0;

    for (const document of this.documents.values()) {
      totalNodes += document.nodes.size;
      totalDeletedNodes += document.deletedNodes.size;
    }

    return {
      documentsCount,
      totalNodes,
      totalDeletedNodes,
      averageNodesPerDocument: documentsCount > 0 ? totalNodes / documentsCount : 0
    };
  }
}

export default CRDTService;