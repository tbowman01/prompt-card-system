/**
 * Operational Transform (OT) Service for Real-time Collaborative Editing
 * Implements transformation algorithms to handle concurrent edits
 */

export interface Operation {
  id: string;
  type: 'insert' | 'delete' | 'retain';
  position: number;
  content?: string;
  length?: number;
  userId: string;
  timestamp: number;
  documentId: string;
}

export interface TransformResult {
  transformed: Operation;
  priority: number;
}

export interface DocumentState {
  id: string;
  content: string;
  version: number;
  lastModified: number;
  operations: Operation[];
}

export class OperationalTransform {
  private documents: Map<string, DocumentState> = new Map();
  private pendingOperations: Map<string, Operation[]> = new Map();

  /**
   * Transform operation against another operation
   * Implements operational transformation algorithms for conflict resolution
   */
  public transform(op1: Operation, op2: Operation): TransformResult {
    // If operations are from the same user, no transformation needed
    if (op1.userId === op2.userId) {
      return { transformed: op1, priority: 0 };
    }

    // Transform based on operation types
    switch (`${op1.type}-${op2.type}`) {
      case 'insert-insert':
        return this.transformInsertInsert(op1, op2);
      case 'insert-delete':
        return this.transformInsertDelete(op1, op2);
      case 'delete-insert':
        return this.transformDeleteInsert(op1, op2);
      case 'delete-delete':
        return this.transformDeleteDelete(op1, op2);
      case 'insert-retain':
        return this.transformInsertRetain(op1, op2);
      case 'delete-retain':
        return this.transformDeleteRetain(op1, op2);
      default:
        return { transformed: op1, priority: 0 };
    }
  }

  /**
   * Transform insert operations against each other
   */
  private transformInsertInsert(op1: Operation, op2: Operation): TransformResult {
    if (op1.position <= op2.position) {
      // op1 comes before op2, adjust op2's position
      return {
        transformed: {
          ...op1,
          position: op1.position
        },
        priority: op1.timestamp < op2.timestamp ? 1 : -1
      };
    } else {
      // op2 comes before op1, adjust op1's position
      return {
        transformed: {
          ...op1,
          position: op1.position + (op2.content?.length || 0)
        },
        priority: op1.timestamp < op2.timestamp ? 1 : -1
      };
    }
  }

  /**
   * Transform insert against delete operation
   */
  private transformInsertDelete(op1: Operation, op2: Operation): TransformResult {
    if (op1.position <= op2.position) {
      // Insert before delete, no transformation needed
      return { transformed: op1, priority: 1 };
    } else if (op1.position >= op2.position + (op2.length || 0)) {
      // Insert after delete, adjust position
      return {
        transformed: {
          ...op1,
          position: op1.position - (op2.length || 0)
        },
        priority: 1
      };
    } else {
      // Insert within delete range, position at delete start
      return {
        transformed: {
          ...op1,
          position: op2.position
        },
        priority: 1
      };
    }
  }

  /**
   * Transform delete against insert operation
   */
  private transformDeleteInsert(op1: Operation, op2: Operation): TransformResult {
    if (op2.position <= op1.position) {
      // Insert before delete, adjust delete position
      return {
        transformed: {
          ...op1,
          position: op1.position + (op2.content?.length || 0)
        },
        priority: -1
      };
    } else if (op2.position >= op1.position + (op1.length || 0)) {
      // Insert after delete, no transformation needed
      return { transformed: op1, priority: 1 };
    } else {
      // Insert within delete range, split delete operation
      return {
        transformed: {
          ...op1,
          length: (op1.length || 0) + (op2.content?.length || 0)
        },
        priority: -1
      };
    }
  }

  /**
   * Transform delete operations against each other
   */
  private transformDeleteDelete(op1: Operation, op2: Operation): TransformResult {
    const op1End = op1.position + (op1.length || 0);
    const op2End = op2.position + (op2.length || 0);

    if (op1End <= op2.position) {
      // op1 before op2, no overlap
      return { transformed: op1, priority: 0 };
    } else if (op2End <= op1.position) {
      // op2 before op1, adjust op1 position
      return {
        transformed: {
          ...op1,
          position: op1.position - (op2.length || 0)
        },
        priority: 0
      };
    } else {
      // Overlapping deletes, resolve based on timestamp
      const priority = op1.timestamp < op2.timestamp ? 1 : -1;
      
      if (op1.position <= op2.position && op1End >= op2End) {
        // op1 contains op2, reduce op1 length
        return {
          transformed: {
            ...op1,
            length: (op1.length || 0) - (op2.length || 0)
          },
          priority
        };
      } else if (op2.position <= op1.position && op2End >= op1End) {
        // op2 contains op1, op1 becomes no-op
        return {
          transformed: {
            ...op1,
            type: 'retain',
            length: 0
          },
          priority
        };
      } else {
        // Partial overlap, adjust based on priority
        return {
          transformed: op1,
          priority
        };
      }
    }
  }

  /**
   * Transform insert against retain operation
   */
  private transformInsertRetain(op1: Operation, op2: Operation): TransformResult {
    return { transformed: op1, priority: 0 };
  }

  /**
   * Transform delete against retain operation
   */
  private transformDeleteRetain(op1: Operation, op2: Operation): TransformResult {
    return { transformed: op1, priority: 0 };
  }

  /**
   * Apply operation to document
   */
  public applyOperation(operation: Operation, documentState: DocumentState): DocumentState {
    let content = documentState.content;
    
    switch (operation.type) {
      case 'insert':
        content = content.slice(0, operation.position) + 
                 (operation.content || '') + 
                 content.slice(operation.position);
        break;
      case 'delete':
        content = content.slice(0, operation.position) + 
                 content.slice(operation.position + (operation.length || 0));
        break;
      case 'retain':
        // No change to content
        break;
    }

    return {
      ...documentState,
      content,
      version: documentState.version + 1,
      lastModified: Date.now(),
      operations: [...documentState.operations, operation]
    };
  }

  /**
   * Get document state
   */
  public getDocumentState(documentId: string): DocumentState | undefined {
    return this.documents.get(documentId);
  }

  /**
   * Initialize document
   */
  public initializeDocument(documentId: string, initialContent: string = ''): DocumentState {
    const state: DocumentState = {
      id: documentId,
      content: initialContent,
      version: 0,
      lastModified: Date.now(),
      operations: []
    };
    
    this.documents.set(documentId, state);
    return state;
  }

  /**
   * Process operation queue for document
   */
  public processOperationQueue(documentId: string): DocumentState | undefined {
    const document = this.documents.get(documentId);
    const operations = this.pendingOperations.get(documentId) || [];
    
    if (!document || operations.length === 0) {
      return document;
    }

    // Sort operations by timestamp
    operations.sort((a, b) => a.timestamp - b.timestamp);

    let currentState = document;
    const processedOps: Operation[] = [];

    for (const operation of operations) {
      // Transform against all previously processed operations
      let transformedOp = operation;
      
      for (const processedOp of processedOps) {
        const result = this.transform(transformedOp, processedOp);
        transformedOp = result.transformed;
      }

      // Apply transformed operation
      currentState = this.applyOperation(transformedOp, currentState);
      processedOps.push(transformedOp);
    }

    // Update document state
    this.documents.set(documentId, currentState);
    this.pendingOperations.delete(documentId);

    return currentState;
  }

  /**
   * Add operation to pending queue
   */
  public addPendingOperation(operation: Operation): void {
    const pending = this.pendingOperations.get(operation.documentId) || [];
    pending.push(operation);
    this.pendingOperations.set(operation.documentId, pending);
  }

  /**
   * Get operational transform metrics
   */
  public getMetrics(): {
    documentsCount: number;
    pendingOperationsCount: number;
    averageOperationsPerDocument: number;
  } {
    const documentsCount = this.documents.size;
    const totalPendingOps = Array.from(this.pendingOperations.values())
      .reduce((sum, ops) => sum + ops.length, 0);
    
    const totalOps = Array.from(this.documents.values())
      .reduce((sum, doc) => sum + doc.operations.length, 0);

    return {
      documentsCount,
      pendingOperationsCount: totalPendingOps,
      averageOperationsPerDocument: documentsCount > 0 ? totalOps / documentsCount : 0
    };
  }
}

export default OperationalTransform;