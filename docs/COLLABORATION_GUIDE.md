# Real-time Collaboration System Guide

## 🤝 Overview

The Real-time Collaboration System enables multiple users to work together on prompt cards, test cases, and documents simultaneously. It provides conflict-free collaborative editing with operational transforms, real-time presence, and comprehensive permission management.

## 🌟 Key Features

### Real-time Collaborative Editing
- **Operational Transform (OT)**: Conflict-free concurrent editing
- **CRDT Implementation**: Conflict-free replicated data types
- **Live Cursors**: Real-time cursor and selection tracking
- **Instant Synchronization**: Sub-second update propagation

### Presence & Awareness
- **User Presence**: See who's online and active
- **Live Cursors**: Visual indicators of other users' positions
- **Activity Status**: Active, idle, and offline states
- **User Information**: Names, roles, and avatars

### Permission Management
- **Role-based Access**: Owner, Editor, Viewer permissions
- **Granular Controls**: Fine-grained permission settings
- **Document Sharing**: Public and private document access
- **Invitation System**: Invite users to collaborate

## 🚀 Getting Started

### Environment Setup
```bash
# Enable collaboration features
ENABLE_COLLABORATION=true
WEBSOCKET_PORT=3002
COLLABORATION_SECRET=your_secure_secret
```

### Basic Implementation
```typescript
import { CollaborationService } from './services/collaboration/CollaborationService';
import { Server } from 'socket.io';

// Initialize collaboration service
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const collaborationService = new CollaborationService(io);
```

## 📡 WebSocket Events

### Client-Side Events

#### Join Document
```typescript
socket.emit('join-document', {
  documentId: 'doc_123',
  userId: 'user_456',
  username: 'John Doe'
});
```

#### Send Operation
```typescript
socket.emit('operation', {
  id: 'op_789',
  type: 'insert',
  position: 10,
  content: 'New text',
  userId: 'user_456',
  documentId: 'doc_123',
  timestamp: Date.now()
});
```

#### Update Cursor
```typescript
socket.emit('cursor-update', {
  documentId: 'doc_123',
  userId: 'user_456',
  position: 25,
  selection: { start: 20, end: 30 }
});
```

### Server-Side Events

#### Document State
```typescript
socket.on('document-state', (data) => {
  console.log('Document loaded:', data.document);
  console.log('OT State:', data.otState);
  console.log('CRDT State:', data.crdtState);
});
```

#### Receive Operation
```typescript
socket.on('operation', (operation) => {
  // Apply operation to local document
  applyOperation(operation);
});
```

#### User Updates
```typescript
socket.on('user-joined', (user) => {
  console.log('User joined:', user.username);
});

socket.on('user-left', (user) => {
  console.log('User left:', user.username);
});
```

## 🔧 Operational Transform

### Operation Types
```typescript
interface Operation {
  id: string;
  type: 'insert' | 'delete' | 'retain';
  position: number;
  content?: string;
  length?: number;
  userId: string;
  documentId: string;
  timestamp: number;
}
```

### Operation Processing
```typescript
// Insert operation
const insertOp: Operation = {
  id: 'op_001',
  type: 'insert',
  position: 10,
  content: 'Hello ',
  userId: 'user123',
  documentId: 'doc456',
  timestamp: Date.now()
};

// Delete operation
const deleteOp: Operation = {
  id: 'op_002',
  type: 'delete',
  position: 5,
  length: 3,
  userId: 'user123',
  documentId: 'doc456',
  timestamp: Date.now()
};
```

### Conflict Resolution
The system automatically resolves conflicts using operational transform algorithms:
1. **Transform Operations**: Adjust operations based on concurrent changes
2. **Apply Order**: Maintain consistent operation ordering
3. **State Sync**: Ensure all clients reach the same final state

## 🏗️ CRDT Implementation

### CRDT Operations
```typescript
interface CRDTOperation {
  id: string;
  type: 'insert' | 'delete';
  position: LogicalPosition;
  character?: string;
  userId: string;
  timestamp: number;
  causality: string[];
}

interface LogicalPosition {
  before: string;
  after: string;
  identifier: string;
}
```

### Advantages of CRDT
- **Convergence**: All replicas eventually converge to the same state
- **Commutativity**: Operations can be applied in any order
- **Idempotency**: Duplicate operations have no effect
- **Partition Tolerance**: Works during network partitions

## 👥 User Presence System

### Presence States
```typescript
interface UserPresence {
  userId: string;
  username: string;
  documentId: string;
  status: 'active' | 'idle' | 'offline';
  lastSeen: Date;
  cursor: {
    position: number;
    selection?: { start: number; end: number };
  };
}
```

### Presence Updates
```typescript
// Update user presence
presenceService.updatePresence({
  userId: 'user123',
  username: 'John Doe',
  documentId: 'doc456',
  status: 'active',
  lastSeen: new Date(),
  cursor: { position: 25 }
});

// Get all users in document
const participants = presenceService.getDocumentParticipants('doc456');
```

## 🔐 Permission System

### Permission Levels
```typescript
interface DocumentPermissions {
  owner: string;           // Document owner (full access)
  editors: string[];       // Can edit content
  viewers: string[];       // Can view only
  public: boolean;         // Public access
}
```

### Role Capabilities
- **Owner**: Full control, can change permissions
- **Editor**: Edit content, view all changes
- **Viewer**: Read-only access, see live changes
- **Public**: Limited viewer access (if enabled)

### Permission Checks
```typescript
// Check user permission
const canEdit = collaborationService.checkPermission(
  document,
  'user123',
  'edit'
);

// Update permissions (owner only)
await collaborationService.updatePermissions(documentId, {
  owner: 'owner123',
  editors: ['user456', 'user789'],
  viewers: ['user101'],
  public: false
});
```

## 📄 Document Management

### Document Creation
```typescript
// Create collaborative document
const document = await collaborationService.createDocument(
  'doc_123',
  'My Prompt Card',
  'Initial content...',
  'owner_user_id'
);
```

### Document Structure
```typescript
interface CollaborativeDocument {
  id: string;
  title: string;
  content: string;
  version: number;
  participants: string[];
  permissions: DocumentPermissions;
  createdAt: Date;
  updatedAt: Date;
}
```

### Version Control
- **Version Tracking**: Every change increments document version
- **Operation History**: Complete log of all operations
- **Rollback Support**: Ability to revert to previous versions
- **Conflict Resolution**: Automatic merge conflict handling

## 📊 Monitoring & Analytics

### Collaboration Metrics
```typescript
const metrics = collaborationService.getMetrics();
console.log({
  activeDocuments: metrics.activeDocuments,
  activeSessions: metrics.activeSessions,
  totalOperations: metrics.totalOperations,
  averageParticipants: metrics.averageParticipantsPerDocument
});
```

### Performance Tracking
- **Operation Latency**: Time from operation to synchronization
- **Conflict Rate**: Frequency of operation conflicts
- **User Activity**: Active collaboration patterns
- **System Load**: Resource usage during collaboration

## 🛠️ Frontend Integration

### React Components
```typescript
import { useCollaboration } from './hooks/useCollaboration';

function CollaborativeEditor({ documentId, userId }) {
  const {
    document,
    participants,
    sendOperation,
    updateCursor
  } = useCollaboration(documentId, userId);

  const handleTextChange = (operation) => {
    sendOperation(operation);
  };

  const handleCursorMove = (position) => {
    updateCursor(position);
  };

  return (
    <div>
      <ParticipantsList participants={participants} />
      <Editor 
        content={document.content}
        onChange={handleTextChange}
        onCursorMove={handleCursorMove}
      />
    </div>
  );
}
```

### Live Cursors Component
```typescript
function LiveCursors({ participants, documentContent }) {
  return (
    <div className="relative">
      {participants.map(participant => (
        <CursorIndicator
          key={participant.userId}
          user={participant}
          position={participant.cursor.position}
          selection={participant.cursor.selection}
        />
      ))}
    </div>
  );
}
```

## 🔧 Configuration Options

### WebSocket Configuration
```typescript
const collaborationConfig = {
  port: 3002,
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
};
```

### Operational Transform Settings
```typescript
const otConfig = {
  operationTimeout: 5000,      // Operation timeout in ms
  maxPendingOps: 100,          // Maximum pending operations
  transformStrategy: 'simple', // Transform algorithm
  conflictResolution: 'last_write_wins'
};
```

### Presence Configuration
```typescript
const presenceConfig = {
  idleTimeout: 300000,         // 5 minutes
  offlineTimeout: 600000,      // 10 minutes
  heartbeatInterval: 30000,    // 30 seconds
  broadcastThrottle: 100       // 100ms throttle
};
```

## 🚀 Advanced Features

### Custom Operation Types
```typescript
// Define custom operation
interface CustomOperation extends Operation {
  type: 'format' | 'comment' | 'highlight';
  style?: FormatStyle;
  commentText?: string;
  highlightColor?: string;
}

// Register custom operation handler
collaborationService.registerOperationHandler('format', handleFormatOperation);
```

### Collaborative Cursors with Rich Information
```typescript
interface EnhancedCursor {
  userId: string;
  username: string;
  avatar: string;
  color: string;
  position: number;
  selection?: Selection;
  isTyping: boolean;
  lastActivity: Date;
}
```

### Document Branching
```typescript
// Create document branch
const branchId = await collaborationService.createBranch(
  documentId,
  'feature-branch',
  'user123'
);

// Merge branch back
await collaborationService.mergeBranch(
  documentId,
  branchId,
  'main',
  'user123'
);
```

## 🛡️ Security Considerations

### Data Validation
- **Input Sanitization**: All operations sanitized before processing
- **Operation Validation**: Verify operation integrity and permissions
- **Rate Limiting**: Prevent operation flooding
- **Session Management**: Secure WebSocket authentication

### Privacy Protection
- **Encrypted Communication**: WebSocket traffic encryption
- **Access Controls**: Strict permission enforcement
- **Audit Logging**: All collaboration activities logged
- **Data Isolation**: Multi-tenant data separation

## 🎯 Best Practices

### Performance Optimization
- **Operation Batching**: Batch multiple operations for efficiency
- **Debounced Updates**: Throttle rapid cursor movements
- **Connection Pooling**: Reuse WebSocket connections
- **Memory Management**: Clean up inactive sessions

### User Experience
- **Smooth Animations**: Fluid cursor and selection animations
- **Clear Indicators**: Visible user presence indicators
- **Conflict Notifications**: Inform users of merge conflicts
- **Offline Support**: Handle temporary disconnections gracefully

### Error Handling
- **Graceful Degradation**: Fall back to single-user mode on errors
- **Automatic Reconnection**: Retry failed connections
- **State Recovery**: Restore state after reconnection
- **User Feedback**: Clear error messages and recovery options

---

**The Real-time Collaboration System transforms individual prompt development into a seamless team experience, enabling unprecedented cooperation and productivity.**