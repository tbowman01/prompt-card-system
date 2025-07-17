# Data Flow and Storage Strategy

## Overview

This document defines the comprehensive data flow and storage strategy for the Prompt Card System MVP, ensuring optimal performance, data integrity, and scalability.

## Data Flow Architecture

### 1. User Interface Data Flow

```
User Interaction → Component State → API Client → Backend Service → Database → Response Chain
                                                                                     ↓
Frontend State Update ← Component Re-render ← Data Processing ← API Response ← Service Response
```

#### Frontend Data Flow Pattern
```typescript
// Data flow through React components
const PromptCardList: React.FC = () => {
  // 1. Data fetching with React Query
  const { data: cards, isLoading, error } = usePromptCards();
  
  // 2. Local state for UI interactions
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // 3. Derived state
  const filteredCards = useMemo(() => {
    return cards?.filter(card => 
      card.title.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];
  }, [cards, searchTerm]);
  
  // 4. Mutation handling
  const deleteCard = useDeletePromptCard();
  
  const handleDelete = async (cardId: string) => {
    try {
      await deleteCard.mutateAsync(cardId);
      // React Query will automatically update the UI
    } catch (error) {
      toast.error('Failed to delete card');
    }
  };
  
  return (
    <div>
      <SearchInput value={searchTerm} onChange={setSearchTerm} />
      {isLoading && <LoadingSpinner />}
      {error && <ErrorMessage error={error} />}
      {filteredCards.map(card => (
        <PromptCardItem 
          key={card.id} 
          card={card} 
          onDelete={() => handleDelete(card.id)}
          onSelect={() => setSelectedCard(card.id)}
        />
      ))}
    </div>
  );
};
```

### 2. Backend Data Flow

```
HTTP Request → Route Handler → Middleware → Controller → Service → Repository → Database
                                                                                    ↓
HTTP Response ← Response Formatter ← Error Handler ← Service Response ← Data Transform
```

#### Service Layer Data Flow
```typescript
// Backend service orchestration
export class PromptCardService {
  async createWithTests(data: CreatePromptCardWithTestsDto): Promise<PromptCard> {
    // 1. Input validation
    const validatedData = await this.validationService.validate(data);
    
    // 2. Database transaction
    return this.db.transaction(async (trx) => {
      // 3. Create prompt card
      const card = await this.promptCardRepository.create(validatedData, trx);
      
      // 4. Create test cases
      if (validatedData.testCases) {
        await this.testCaseRepository.createMany(
          validatedData.testCases.map(tc => ({
            ...tc,
            promptCardId: card.id
          })),
          trx
        );
      }
      
      // 5. Extract variables from template
      const variables = this.templateService.extractVariables(card.promptTemplate);
      await this.promptCardRepository.updateVariables(card.id, variables, trx);
      
      // 6. Emit event for other services
      this.eventEmitter.emit('promptCard.created', card);
      
      return card;
    });
  }
  
  async executeTests(cardId: string, options: ExecutionOptions = {}): Promise<ExecutionResult> {
    // 1. Get card with test cases
    const card = await this.promptCardRepository.findByIdWithTests(cardId);
    if (!card) throw new NotFoundError('Prompt card not found');
    
    // 2. Validate test cases
    if (!card.testCases || card.testCases.length === 0) {
      throw new ValidationError('No test cases found');
    }
    
    // 3. Generate execution configuration
    const config = await this.yamlService.generatePromptfooConfig(card, options);
    
    // 4. Queue execution (async)
    const executionId = await this.testExecutionQueue.add('executeTests', {
      cardId,
      config,
      options
    });
    
    // 5. Return execution reference
    return {
      executionId,
      status: 'queued',
      cardId,
      createdAt: new Date().toISOString()
    };
  }
}
```

### 3. Test Execution Data Flow

```
Test Request → Queue → Background Worker → Promptfoo Engine → LLM Service → Results Processing
                                                                                       ↓
Database Storage ← Result Aggregation ← Assertion Checking ← Response Processing ← LLM Response
```

#### Test Execution Worker
```typescript
// Background worker for test execution
export class TestExecutionWorker {
  async processTestExecution(job: Job<TestExecutionData>): Promise<TestResults> {
    const { cardId, config, options } = job.data;
    
    try {
      // 1. Update execution status
      await this.updateExecutionStatus(job.id, 'running');
      
      // 2. Initialize promptfoo
      const promptfoo = new PromptfooEngine(config);
      
      // 3. Execute tests with progress tracking
      const results = await promptfoo.evaluate({
        onProgress: (progress) => {
          job.progress(progress.percentage);
          this.eventEmitter.emit('testExecution.progress', {
            executionId: job.id,
            cardId,
            progress
          });
        }
      });
      
      // 4. Process results
      const processedResults = await this.processResults(results, cardId);
      
      // 5. Store results
      await this.storeResults(job.id, processedResults);
      
      // 6. Update execution status
      await this.updateExecutionStatus(job.id, 'completed');
      
      // 7. Emit completion event
      this.eventEmitter.emit('testExecution.completed', {
        executionId: job.id,
        cardId,
        results: processedResults
      });
      
      return processedResults;
      
    } catch (error) {
      // Error handling
      await this.updateExecutionStatus(job.id, 'failed', error.message);
      
      this.eventEmitter.emit('testExecution.failed', {
        executionId: job.id,
        cardId,
        error: error.message
      });
      
      throw error;
    }
  }
}
```

## Storage Strategy

### 1. Database Schema Design

#### Optimized Table Structure
```sql
-- Prompt cards with optimized indexes
CREATE TABLE prompt_cards (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    title TEXT NOT NULL,
    description TEXT,
    prompt_template TEXT NOT NULL,
    variables JSON DEFAULT '[]',
    metadata JSON DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    version INTEGER DEFAULT 1
);

-- Test cases with foreign key constraints
CREATE TABLE test_cases (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    prompt_card_id TEXT NOT NULL,
    name TEXT NOT NULL,
    input_variables JSON NOT NULL,
    expected_output TEXT,
    assertions JSON DEFAULT '[]',
    metadata JSON DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (prompt_card_id) REFERENCES prompt_cards(id) ON DELETE CASCADE
);

-- Test executions tracking
CREATE TABLE test_executions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    prompt_card_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
    config JSON NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    metadata JSON DEFAULT '{}',
    FOREIGN KEY (prompt_card_id) REFERENCES prompt_cards(id) ON DELETE CASCADE
);

-- Test results with execution reference
CREATE TABLE test_results (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    execution_id TEXT NOT NULL,
    test_case_id TEXT NOT NULL,
    llm_output TEXT NOT NULL,
    execution_time_ms INTEGER,
    passed BOOLEAN NOT NULL,
    assertion_results JSON DEFAULT '[]',
    metadata JSON DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (execution_id) REFERENCES test_executions(id) ON DELETE CASCADE,
    FOREIGN KEY (test_case_id) REFERENCES test_cases(id) ON DELETE CASCADE
);

-- Performance indexes
CREATE INDEX idx_prompt_cards_updated_at ON prompt_cards(updated_at DESC);
CREATE INDEX idx_test_cases_prompt_card_id ON test_cases(prompt_card_id);
CREATE INDEX idx_test_executions_card_status ON test_executions(prompt_card_id, status);
CREATE INDEX idx_test_results_execution_id ON test_results(execution_id);
CREATE INDEX idx_test_results_passed ON test_results(passed);

-- Full-text search index
CREATE VIRTUAL TABLE prompt_cards_fts USING fts5(
    title, description, prompt_template,
    content='prompt_cards',
    content_rowid='rowid'
);
```

### 2. Data Access Layer

#### Repository Pattern Implementation
```typescript
// Base repository with common functionality
export abstract class BaseRepository<T> {
  protected db: Database;
  protected tableName: string;
  
  constructor(db: Database, tableName: string) {
    this.db = db;
    this.tableName = tableName;
  }
  
  // Generic CRUD operations
  async findById(id: string): Promise<T | null> {
    const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`);
    const result = stmt.get(id);
    return result ? this.mapFromDb(result) : null;
  }
  
  async findMany(filters: Record<string, any> = {}): Promise<T[]> {
    const { whereClause, values } = this.buildWhereClause(filters);
    const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} ${whereClause} ORDER BY updated_at DESC`);
    const results = stmt.all(...values);
    return results.map(result => this.mapFromDb(result));
  }
  
  async create(data: Partial<T>): Promise<T> {
    const mappedData = this.mapToDb(data);
    const columns = Object.keys(mappedData).join(', ');
    const placeholders = Object.keys(mappedData).map(() => '?').join(', ');
    const values = Object.values(mappedData);
    
    const stmt = this.db.prepare(`
      INSERT INTO ${this.tableName} (${columns}) 
      VALUES (${placeholders})
      RETURNING *
    `);
    
    const result = stmt.get(...values);
    return this.mapFromDb(result);
  }
  
  // Abstract methods for subclasses
  protected abstract mapFromDb(row: any): T;
  protected abstract mapToDb(entity: Partial<T>): Record<string, any>;
}

// Specific repository implementation
export class PromptCardRepository extends BaseRepository<PromptCard> {
  constructor(db: Database) {
    super(db, 'prompt_cards');
  }
  
  async findByIdWithTests(id: string): Promise<PromptCardWithTests | null> {
    const stmt = this.db.prepare(`
      SELECT 
        pc.*,
        json_group_array(
          CASE 
            WHEN tc.id IS NOT NULL THEN 
              json_object(
                'id', tc.id,
                'name', tc.name,
                'input_variables', json(tc.input_variables),
                'expected_output', tc.expected_output,
                'assertions', json(tc.assertions),
                'created_at', tc.created_at,
                'updated_at', tc.updated_at
              )
            ELSE NULL
          END
        ) as test_cases
      FROM prompt_cards pc
      LEFT JOIN test_cases tc ON pc.id = tc.prompt_card_id
      WHERE pc.id = ?
      GROUP BY pc.id
    `);
    
    const result = stmt.get(id);
    if (!result) return null;
    
    return {
      ...this.mapFromDb(result),
      testCases: JSON.parse(result.test_cases).filter(tc => tc !== null)
    };
  }
  
  async searchByText(query: string, limit: number = 10): Promise<PromptCard[]> {
    const stmt = this.db.prepare(`
      SELECT pc.* 
      FROM prompt_cards pc
      JOIN prompt_cards_fts fts ON pc.rowid = fts.rowid
      WHERE prompt_cards_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `);
    
    const results = stmt.all(query, limit);
    return results.map(result => this.mapFromDb(result));
  }
  
  protected mapFromDb(row: any): PromptCard {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      promptTemplate: row.prompt_template,
      variables: JSON.parse(row.variables || '[]'),
      metadata: JSON.parse(row.metadata || '{}'),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      version: row.version
    };
  }
  
  protected mapToDb(entity: Partial<PromptCard>): Record<string, any> {
    return {
      title: entity.title,
      description: entity.description,
      prompt_template: entity.promptTemplate,
      variables: JSON.stringify(entity.variables || []),
      metadata: JSON.stringify(entity.metadata || {}),
      updated_at: new Date().toISOString()
    };
  }
}
```

### 3. Caching Strategy

#### Multi-Level Cache Implementation
```typescript
// Comprehensive caching system
export class CacheManager {
  private l1Cache: Map<string, CacheEntry>; // Memory cache
  private l2Cache: NodeCache; // Disk cache
  private l3Cache: RedisCache; // Distributed cache (future)
  
  constructor() {
    this.l1Cache = new Map();
    this.l2Cache = new NodeCache({
      stdTTL: 600, // 10 minutes
      checkperiod: 120 // Check for expired keys every 2 minutes
    });
  }
  
  async get<T>(key: string): Promise<T | null> {
    // L1 (Memory) cache
    const l1Entry = this.l1Cache.get(key);
    if (l1Entry && !this.isExpired(l1Entry)) {
      return l1Entry.value;
    }
    
    // L2 (Disk) cache
    const l2Value = this.l2Cache.get<T>(key);
    if (l2Value) {
      // Promote to L1
      this.l1Cache.set(key, {
        value: l2Value,
        expiry: Date.now() + 300000 // 5 minutes in L1
      });
      return l2Value;
    }
    
    return null;
  }
  
  async set<T>(key: string, value: T, ttl: number = 600): Promise<void> {
    // Store in L1 (shorter TTL)
    this.l1Cache.set(key, {
      value,
      expiry: Date.now() + Math.min(ttl, 300) * 1000
    });
    
    // Store in L2 (longer TTL)
    this.l2Cache.set(key, value, ttl);
  }
  
  async invalidate(pattern: string): Promise<void> {
    // Invalidate L1 cache
    for (const [key] of this.l1Cache) {
      if (key.includes(pattern)) {
        this.l1Cache.delete(key);
      }
    }
    
    // Invalidate L2 cache
    const keys = this.l2Cache.keys();
    for (const key of keys) {
      if (key.includes(pattern)) {
        this.l2Cache.del(key);
      }
    }
  }
  
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() > entry.expiry;
  }
}

// Cache-aware repository decorator
export class CachedPromptCardRepository extends PromptCardRepository {
  constructor(
    db: Database,
    private cacheManager: CacheManager
  ) {
    super(db);
  }
  
  async findById(id: string): Promise<PromptCard | null> {
    const cacheKey = `promptCard:${id}`;
    
    // Try cache first
    const cached = await this.cacheManager.get<PromptCard>(cacheKey);
    if (cached) return cached;
    
    // Fetch from database
    const result = await super.findById(id);
    
    // Cache the result
    if (result) {
      await this.cacheManager.set(cacheKey, result, 300); // 5 minutes
    }
    
    return result;
  }
  
  async create(data: Partial<PromptCard>): Promise<PromptCard> {
    const result = await super.create(data);
    
    // Cache the new entity
    await this.cacheManager.set(`promptCard:${result.id}`, result, 300);
    
    // Invalidate list caches
    await this.cacheManager.invalidate('promptCards:list');
    
    return result;
  }
}
```

### 4. Data Validation Strategy

#### Schema Validation with Zod
```typescript
// Comprehensive validation schemas
export const PromptCardSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
  description: z.string().optional(),
  promptTemplate: z.string().min(1, 'Prompt template is required'),
  variables: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional()
});

export const TestCaseSchema = z.object({
  name: z.string().min(1, 'Test case name is required'),
  inputVariables: z.record(z.any()),
  expectedOutput: z.string().optional(),
  assertions: z.array(z.object({
    type: z.enum(['contains', 'equals', 'regex', 'length', 'json_path']),
    value: z.any(),
    operator: z.enum(['gt', 'lt', 'gte', 'lte', 'eq']).optional(),
    path: z.string().optional() // for json_path assertions
  })).optional()
});

// Validation service
export class ValidationService {
  async validatePromptCard(data: any): Promise<PromptCard> {
    const validated = PromptCardSchema.parse(data);
    
    // Additional business logic validation
    if (validated.promptTemplate) {
      const extractedVars = this.extractVariables(validated.promptTemplate);
      if (validated.variables && !this.arraysEqual(extractedVars, validated.variables)) {
        throw new ValidationError('Variables mismatch with template');
      }
    }
    
    return validated;
  }
  
  async validateTestCase(data: any, promptCard: PromptCard): Promise<TestCase> {
    const validated = TestCaseSchema.parse(data);
    
    // Validate input variables match prompt template
    const requiredVars = promptCard.variables || [];
    const providedVars = Object.keys(validated.inputVariables);
    
    const missingVars = requiredVars.filter(v => !providedVars.includes(v));
    if (missingVars.length > 0) {
      throw new ValidationError(`Missing required variables: ${missingVars.join(', ')}`);
    }
    
    return validated;
  }
  
  private extractVariables(template: string): string[] {
    const regex = /\{\{([^}]+)\}\}/g;
    const variables: string[] = [];
    let match;
    
    while ((match = regex.exec(template)) !== null) {
      variables.push(match[1].trim());
    }
    
    return [...new Set(variables)];
  }
}
```

### 5. Backup and Recovery Strategy

#### Automated Backup System
```typescript
// Backup management system
export class BackupManager {
  private backupDir: string;
  private retentionDays: number;
  
  constructor(backupDir: string = './backups', retentionDays: number = 30) {
    this.backupDir = backupDir;
    this.retentionDays = retentionDays;
  }
  
  async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `backup-${timestamp}.sql`);
    
    // Create backup using SQLite .dump command
    const command = `sqlite3 ${DATABASE_PATH} .dump`;
    const dumpOutput = await exec(command);
    
    // Write to backup file
    await fs.writeFile(backupPath, dumpOutput.stdout);
    
    // Compress backup
    const compressedPath = `${backupPath}.gz`;
    await this.compressFile(backupPath, compressedPath);
    await fs.unlink(backupPath);
    
    // Clean old backups
    await this.cleanOldBackups();
    
    return compressedPath;
  }
  
  async restoreBackup(backupPath: string): Promise<void> {
    // Verify backup file exists
    if (!await fs.pathExists(backupPath)) {
      throw new Error('Backup file not found');
    }
    
    // Decompress if needed
    const sqlPath = backupPath.endsWith('.gz') 
      ? await this.decompressFile(backupPath)
      : backupPath;
    
    // Create backup of current database
    const currentBackup = await this.createBackup();
    console.log(`Current database backed up to: ${currentBackup}`);
    
    try {
      // Restore from backup
      const command = `sqlite3 ${DATABASE_PATH} < ${sqlPath}`;
      await exec(command);
      
      console.log('Database restored successfully');
    } catch (error) {
      console.error('Restore failed, current database preserved');
      throw error;
    }
  }
  
  private async cleanOldBackups(): Promise<void> {
    const files = await fs.readdir(this.backupDir);
    const backupFiles = files.filter(f => f.startsWith('backup-') && f.endsWith('.gz'));
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
    
    for (const file of backupFiles) {
      const filePath = path.join(this.backupDir, file);
      const stats = await fs.stat(filePath);
      
      if (stats.mtime < cutoffDate) {
        await fs.unlink(filePath);
        console.log(`Cleaned old backup: ${file}`);
      }
    }
  }
}
```

This comprehensive data flow and storage strategy ensures optimal performance, data integrity, and scalability for the Prompt Card System MVP while providing robust backup and recovery capabilities.