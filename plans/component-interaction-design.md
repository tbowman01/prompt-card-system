# Component Interaction Design

## Overview

This document defines the comprehensive component interaction patterns for the Prompt Card System MVP, designed to ensure efficient data flow, optimal performance, and maintainable architecture.

## Core Interaction Patterns

### 1. Frontend-Backend Communication

#### API Communication Flow
```
Frontend Components → API Client → HTTP Requests → Backend Routes → Service Layer → Data Layer
                   ←              ←               ←                ←              ←
```

#### React Query Integration
```typescript
// Optimized data fetching with caching
const usePromptCards = () => {
  return useQuery({
    queryKey: ['promptCards'],
    queryFn: async () => {
      const response = await apiClient.get('/api/prompt-cards');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Optimistic updates for better UX
const useCreatePromptCard = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (newCard) => {
      return await apiClient.post('/api/prompt-cards', newCard);
    },
    onMutate: async (newCard) => {
      // Optimistic update
      await queryClient.cancelQueries(['promptCards']);
      const previousCards = queryClient.getQueryData(['promptCards']);
      queryClient.setQueryData(['promptCards'], old => [...old, newCard]);
      return { previousCards };
    },
    onError: (err, newCard, context) => {
      // Rollback on error
      queryClient.setQueryData(['promptCards'], context.previousCards);
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries(['promptCards']);
    },
  });
};
```

### 2. Backend Service Architecture

#### Service Layer Pattern
```typescript
// Service orchestration for complex operations
export class PromptCardService {
  constructor(
    private promptCardRepository: PromptCardRepository,
    private testCaseRepository: TestCaseRepository,
    private yamlService: YamlService,
    private validationService: ValidationService,
    private eventEmitter: EventEmitter
  ) {}

  async createPromptCard(data: CreatePromptCardDto): Promise<PromptCard> {
    // Validate input
    await this.validationService.validatePromptCard(data);
    
    // Create card
    const card = await this.promptCardRepository.create(data);
    
    // Emit event for other services
    this.eventEmitter.emit('promptCard.created', card);
    
    return card;
  }

  async executeTests(cardId: string): Promise<TestResults> {
    // Get card with test cases
    const card = await this.promptCardRepository.findByIdWithTests(cardId);
    
    // Generate promptfoo config
    const config = await this.yamlService.generatePromptfooConfig(card);
    
    // Execute tests asynchronously
    const executionId = await this.testExecutionService.executeAsync(config);
    
    // Emit event for real-time updates
    this.eventEmitter.emit('testExecution.started', { cardId, executionId });
    
    return { executionId, status: 'started' };
  }
}
```

### 3. LLM Integration Pattern

#### Ollama Client Abstraction
```typescript
export class OllamaClient {
  private baseUrl: string;
  private healthCheckInterval: NodeJS.Timeout;

  constructor(baseUrl = 'http://ollama:11434') {
    this.baseUrl = baseUrl;
    this.startHealthCheck();
  }

  async generate(prompt: string, options: GenerateOptions = {}): Promise<GenerateResponse> {
    const response = await this.makeRequest('/api/generate', {
      model: options.model || 'llama2:7b',
      prompt,
      stream: false,
      options: {
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 1000,
        ...options.modelOptions
      }
    });
    
    return response;
  }

  async streamGenerate(prompt: string, options: GenerateOptions = {}): Promise<AsyncIterable<string>> {
    const response = await this.makeRequest('/api/generate', {
      model: options.model || 'llama2:7b',
      prompt,
      stream: true,
      options: options.modelOptions
    });
    
    return this.processStream(response);
  }

  private async startHealthCheck() {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.makeRequest('/api/version');
      } catch (error) {
        console.error('Ollama health check failed:', error);
        // Implement reconnection logic
      }
    }, 30000); // Check every 30 seconds
  }
}
```

### 4. Event-Driven Architecture

#### Event System for Real-Time Updates
```typescript
export class EventSystem {
  private eventEmitter: EventEmitter;
  private webSocketServer: WebSocket.Server;

  constructor() {
    this.eventEmitter = new EventEmitter();
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Test execution progress
    this.eventEmitter.on('testExecution.progress', (data) => {
      this.broadcastToClients('testProgress', data);
    });

    // Test completion
    this.eventEmitter.on('testExecution.completed', (data) => {
      this.broadcastToClients('testCompleted', data);
    });

    // System health updates
    this.eventEmitter.on('system.health', (data) => {
      this.broadcastToClients('systemHealth', data);
    });
  }

  private broadcastToClients(event: string, data: any) {
    this.webSocketServer.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ event, data }));
      }
    });
  }
}
```

### 5. Database Interaction Patterns

#### Repository Pattern with Optimization
```typescript
export class PromptCardRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async findByIdWithTests(id: string): Promise<PromptCard | null> {
    // Optimized query with joins
    const stmt = this.db.prepare(`
      SELECT 
        pc.*,
        json_group_array(
          json_object(
            'id', tc.id,
            'name', tc.name,
            'input_variables', tc.input_variables,
            'expected_output', tc.expected_output,
            'assertions', tc.assertions
          )
        ) as test_cases
      FROM prompt_cards pc
      LEFT JOIN test_cases tc ON pc.id = tc.prompt_card_id
      WHERE pc.id = ?
      GROUP BY pc.id
    `);
    
    const result = stmt.get(id);
    if (!result) return null;
    
    // Transform result
    return {
      ...result,
      test_cases: JSON.parse(result.test_cases).filter(tc => tc.id !== null)
    };
  }

  async findAllWithPagination(page: number, limit: number): Promise<PaginatedResult<PromptCard>> {
    const offset = (page - 1) * limit;
    
    // Get total count
    const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM prompt_cards');
    const { count } = countStmt.get();
    
    // Get paginated results
    const stmt = this.db.prepare(`
      SELECT * FROM prompt_cards 
      ORDER BY updated_at DESC 
      LIMIT ? OFFSET ?
    `);
    
    const items = stmt.all(limit, offset);
    
    return {
      items,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit)
    };
  }
}
```

## Data Flow Strategies

### 1. Unidirectional Data Flow
```
User Action → Component → API Call → Backend Service → Database → Response → Component Update
```

### 2. State Management Strategy
```typescript
// Context for global state
export const AppContext = createContext<AppContextType | null>(null);

// Custom hook for state management
export const useAppState = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppState must be used within AppProvider');
  }
  return context;
};

// Provider component
export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  
  const value = {
    state,
    dispatch,
    // Derived state
    isTestRunning: state.testExecution.status === 'running',
    hasUnsavedChanges: state.ui.hasUnsavedChanges,
  };
  
  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};
```

### 3. Caching Strategy
```typescript
// Multi-level caching
export class CacheManager {
  private memoryCache: Map<string, any>;
  private diskCache: NodeCache;
  
  constructor() {
    this.memoryCache = new Map();
    this.diskCache = new NodeCache({ stdTTL: 600 }); // 10 minutes
  }
  
  async get(key: string): Promise<any> {
    // Check memory cache first
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key);
    }
    
    // Check disk cache
    const diskResult = this.diskCache.get(key);
    if (diskResult) {
      // Promote to memory cache
      this.memoryCache.set(key, diskResult);
      return diskResult;
    }
    
    return null;
  }
  
  async set(key: string, value: any, ttl?: number): Promise<void> {
    // Store in both caches
    this.memoryCache.set(key, value);
    this.diskCache.set(key, value, ttl || 600);
  }
}
```

## API Design Principles

### 1. RESTful API Design
```typescript
// Consistent endpoint structure
GET    /api/prompt-cards           // List all cards
POST   /api/prompt-cards           // Create new card
GET    /api/prompt-cards/:id       // Get specific card
PUT    /api/prompt-cards/:id       // Update card
DELETE /api/prompt-cards/:id       // Delete card

// Nested resources
GET    /api/prompt-cards/:id/test-cases     // Get test cases for card
POST   /api/prompt-cards/:id/test-cases     // Create test case
PUT    /api/test-cases/:id                  // Update test case
DELETE /api/test-cases/:id                  // Delete test case

// Actions
POST   /api/prompt-cards/:id/execute        // Execute tests
GET    /api/executions/:id/status           // Get execution status
GET    /api/executions/:id/results          // Get results
```

### 2. Response Standardization
```typescript
// Standard response format
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    timestamp: string;
    version: string;
    requestId: string;
  };
}

// Error response format
interface ApiError {
  success: false;
  error: string;
  details?: {
    field?: string;
    message: string;
    code: string;
  }[];
  meta: {
    timestamp: string;
    requestId: string;
  };
}
```

### 3. Input Validation
```typescript
// Zod schema for validation
const CreatePromptCardSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  prompt_template: z.string().min(1),
  test_cases: z.array(z.object({
    name: z.string().min(1),
    input_variables: z.record(z.any()),
    expected_output: z.string().optional(),
    assertions: z.array(z.object({
      type: z.enum(['contains', 'equals', 'regex', 'length']),
      value: z.any(),
      operator: z.enum(['gt', 'lt', 'gte', 'lte', 'eq']).optional()
    })).optional()
  })).optional()
});

// Middleware for validation
const validateInput = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code
          }))
        });
      }
      next(error);
    }
  };
};
```

## Scalability Considerations

### 1. Database Optimization
```sql
-- Indexes for performance
CREATE INDEX idx_prompt_cards_updated_at ON prompt_cards(updated_at);
CREATE INDEX idx_test_cases_prompt_card_id ON test_cases(prompt_card_id);
CREATE INDEX idx_test_results_execution_id ON test_results(execution_id);

-- Composite indexes
CREATE INDEX idx_test_cases_card_status ON test_cases(prompt_card_id, status);
```

### 2. Connection Pooling
```typescript
// Database connection pool
export class DatabasePool {
  private pool: Pool;
  
  constructor(config: DatabaseConfig) {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      min: 2,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  
  async query(text: string, params?: any[]): Promise<any> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result.rows;
    } finally {
      client.release();
    }
  }
}
```

### 3. Async Processing
```typescript
// Queue system for long-running operations
export class TaskQueue {
  private queue: Queue;
  
  constructor() {
    this.queue = new Queue('test-execution', {
      connection: {
        host: 'redis',
        port: 6379,
      }
    });
    
    this.setupWorkers();
  }
  
  private setupWorkers() {
    this.queue.process('executeTests', async (job) => {
      const { cardId, config } = job.data;
      
      // Execute tests
      const results = await this.executePromptfooTests(config);
      
      // Store results
      await this.storeTestResults(cardId, results);
      
      // Notify completion
      this.eventEmitter.emit('testExecution.completed', {
        cardId,
        results
      });
      
      return results;
    });
  }
  
  async addTestExecution(cardId: string, config: any): Promise<string> {
    const job = await this.queue.add('executeTests', { cardId, config });
    return job.id;
  }
}
```

This component interaction design ensures efficient, scalable, and maintainable communication between all system components while providing optimal user experience and performance.