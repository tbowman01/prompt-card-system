// Core collaboration types
export interface UserPresence {
  userId: string;
  documentId: string; // Add missing documentId property
  status: 'online' | 'offline' | 'away';
  lastSeen: Date;
  socketId?: string;
  cursorPosition?: {
    line: number;
    column: number;
  };
  selection?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

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