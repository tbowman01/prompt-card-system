# Debugging and Troubleshooting Guide

This comprehensive guide helps developers debug issues in the Prompt Card System, covering common problems, debugging tools, and troubleshooting procedures for both development and production environments.

## Table of Contents

1. [Debugging Philosophy](#debugging-philosophy)
2. [Development Environment Debugging](#development-environment-debugging)
3. [Backend Debugging](#backend-debugging)
4. [Frontend Debugging](#frontend-debugging)
5. [Database Debugging](#database-debugging)
6. [Docker Debugging](#docker-debugging)
7. [AI/LLM Debugging](#aillm-debugging)
8. [Performance Debugging](#performance-debugging)
9. [Common Issues and Solutions](#common-issues-and-solutions)
10. [Production Debugging](#production-debugging)
11. [Monitoring and Observability](#monitoring-and-observability)
12. [Debugging Tools and Techniques](#debugging-tools-and-techniques)

## Debugging Philosophy

### 🔍 **Systematic Approach**
1. **Reproduce the Issue** - Ensure consistent reproduction
2. **Isolate the Problem** - Narrow down the scope
3. **Gather Information** - Collect logs, errors, and context
4. **Form Hypotheses** - Make educated guesses about causes
5. **Test Solutions** - Validate fixes systematically
6. **Document Findings** - Share knowledge with the team

### 🧠 **Debug Mindset**
- **Stay Curious** - Ask "why" and "how"
- **Be Patient** - Complex issues take time to resolve
- **Think Like a Detective** - Follow the evidence
- **Collaborate** - Two heads are better than one

## Development Environment Debugging

### Setting Up Debug Environment

1. **Enable Debug Mode**
   ```bash
   # Backend debug mode
   cd backend
   DEBUG=* npm run dev
   
   # Specific debug namespaces
   DEBUG=app:*,db:*,llm:* npm run dev
   
   # Enable TypeScript source maps
   NODE_OPTIONS="--enable-source-maps" npm run dev
   ```

2. **Environment Variables for Debugging**
   ```bash
   # .env
   NODE_ENV=development
   LOG_LEVEL=debug
   DEBUG_MODE=true
   DISABLE_CACHE=true
   OLLAMA_TIMEOUT=60000
   ```

### IDE Debugging Setup

#### VS Code Configuration

**Launch Configuration (.vscode/launch.json):**
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Backend",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/backend/src/server.ts",
      "outFiles": ["${workspaceFolder}/backend/dist/**/*.js"],
      "runtimeArgs": ["-r", "ts-node/register", "--inspect"],
      "env": {
        "NODE_ENV": "development",
        "DEBUG": "app:*"
      },
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "name": "Debug Frontend",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}/frontend",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 9229,
      "serverReadyAction": {
        "pattern": "ready - started server on",
        "uriFormat": "http://localhost:3000",
        "action": "openExternally"
      }
    },
    {
      "name": "Debug Jest Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand", "${relativeFile}"],
      "cwd": "${workspaceFolder}",
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    },
    {
      "name": "Attach to Docker Backend",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "restart": true,
      "localRoot": "${workspaceFolder}/backend",
      "remoteRoot": "/app"
    }
  ]
}
```

**Tasks Configuration (.vscode/tasks.json):**
```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Start Debug Backend",
      "type": "npm",
      "script": "dev:debug",
      "path": "backend/",
      "group": "build",
      "presentation": {
        "reveal": "always",
        "panel": "new"
      },
      "isBackground": true,
      "problemMatcher": {
        "owner": "typescript",
        "source": "ts",
        "applyTo": "closedDocuments",
        "fileLocation": ["relative", "${cwd}"],
        "pattern": "$tsc",
        "background": {
          "activeOnStart": true,
          "beginsPattern": "Starting compilation",
          "endsPattern": "Debugger listening on"
        }
      }
    }
  ]
}
```

## Backend Debugging

### Logging Strategy

1. **Structured Logging**
   ```typescript
   // src/utils/logger.ts
   import winston from 'winston';

   const logger = winston.createLogger({
     level: process.env.LOG_LEVEL || 'info',
     format: winston.format.combine(
       winston.format.timestamp(),
       winston.format.errors({ stack: true }),
       winston.format.json()
     ),
     transports: [
       new winston.transports.Console({
         format: winston.format.combine(
           winston.format.colorize(),
           winston.format.simple()
         )
       }),
       new winston.transports.File({ filename: 'logs/debug.log', level: 'debug' }),
       new winston.transports.File({ filename: 'logs/error.log', level: 'error' })
     ]
   });

   // Usage in services
   class PromptCardService {
     async createPromptCard(data: CreatePromptCardData) {
       logger.info('Creating prompt card', { 
         title: data.title, 
         userId: this.userId,
         timestamp: new Date().toISOString()
       });

       try {
         const result = await this.repository.create(data);
         logger.info('Prompt card created successfully', { 
           id: result.id, 
           title: result.title 
         });
         return { success: true, data: result };
       } catch (error) {
         logger.error('Failed to create prompt card', { 
           error: error.message, 
           stack: error.stack,
           data: data 
         });
         throw error;
       }
     }
   }
   ```

2. **Debug Middleware**
   ```typescript
   // src/middleware/debugMiddleware.ts
   export const debugMiddleware = (req: Request, res: Response, next: NextFunction) => {
     const start = Date.now();
     const { method, url, headers, body } = req;
     
     logger.debug('Incoming request', {
       method,
       url,
       headers: process.env.NODE_ENV === 'development' ? headers : undefined,
       body: process.env.NODE_ENV === 'development' ? body : undefined,
       timestamp: new Date().toISOString()
     });

     const originalSend = res.send;
     res.send = function(data) {
       const duration = Date.now() - start;
       logger.debug('Response sent', {
         method,
         url,
         statusCode: res.statusCode,
         duration: `${duration}ms`,
         responseSize: Buffer.byteLength(data)
       });
       return originalSend.call(this, data);
     };

     next();
   };
   ```

### Error Handling and Debugging

1. **Comprehensive Error Handling**
   ```typescript
   // src/middleware/errorHandler.ts
   export const errorHandler = (
     error: Error, 
     req: Request, 
     res: Response, 
     next: NextFunction
   ) => {
     const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
     
     logger.error('Unhandled error', {
       errorId,
       error: error.message,
       stack: error.stack,
       url: req.url,
       method: req.method,
       headers: req.headers,
       body: req.body,
       userId: req.user?.id,
       timestamp: new Date().toISOString()
     });

     // Send user-friendly error response
     if (error instanceof ValidationError) {
       return res.status(400).json({
         error: 'Validation failed',
         details: error.details,
         errorId
       });
     }

     if (error instanceof AuthenticationError) {
       return res.status(401).json({
         error: 'Authentication required',
         errorId
       });
     }

     // Generic server error
     res.status(500).json({
       error: process.env.NODE_ENV === 'production' 
         ? 'Internal server error' 
         : error.message,
       errorId,
       ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
     });
   };
   ```

2. **Request Tracing**
   ```typescript
   // src/middleware/tracing.ts
   import { v4 as uuidv4 } from 'uuid';

   export const tracingMiddleware = (req: Request, res: Response, next: NextFunction) => {
     const traceId = req.headers['x-trace-id'] || uuidv4();
     req.traceId = traceId;
     res.setHeader('x-trace-id', traceId);

     // Add trace ID to all log messages within this request
     const originalLogger = logger;
     req.logger = originalLogger.child({ traceId });

     next();
   };
   ```

### API Debugging

1. **API Response Debugging**
   ```typescript
   // Add to your route handlers
   app.use('/api', (req, res, next) => {
     if (process.env.DEBUG_API) {
       console.log('API Request:', {
         method: req.method,
         path: req.path,
         query: req.query,
         body: req.body,
         headers: req.headers
       });

       const originalSend = res.json;
       res.json = function(data) {
         console.log('API Response:', {
           status: res.statusCode,
           data: data
         });
         return originalSend.call(this, data);
       };
     }
     next();
   });
   ```

2. **Database Query Debugging**
   ```typescript
   // src/database/connection.ts
   const database = new Database(databasePath);

   if (process.env.DEBUG_SQL) {
     database.on('trace', (sql) => {
       logger.debug('SQL Query:', { sql, timestamp: new Date().toISOString() });
     });
   }

   // Measure query performance
   const originalPrepare = database.prepare.bind(database);
   database.prepare = function(sql) {
     const stmt = originalPrepare(sql);
     
     if (process.env.DEBUG_SQL_PERFORMANCE) {
       const originalRun = stmt.run.bind(stmt);
       const originalGet = stmt.get.bind(stmt);
       const originalAll = stmt.all.bind(stmt);

       stmt.run = function(...args) {
         const start = Date.now();
         const result = originalRun(...args);
         const duration = Date.now() - start;
         logger.debug('SQL Run Performance', { sql, duration, changes: result.changes });
         return result;
       };

       stmt.get = function(...args) {
         const start = Date.now();
         const result = originalGet(...args);
         const duration = Date.now() - start;
         logger.debug('SQL Get Performance', { sql, duration, hasResult: !!result });
         return result;
       };

       stmt.all = function(...args) {
         const start = Date.now();
         const result = originalAll(...args);
         const duration = Date.now() - start;
         logger.debug('SQL All Performance', { sql, duration, resultCount: result.length });
         return result;
       };
     }

     return stmt;
   };
   ```

## Frontend Debugging

### React Component Debugging

1. **Component Debug Hooks**
   ```typescript
   // src/hooks/useDebug.ts
   import { useEffect, useRef } from 'react';

   export const useDebug = (componentName: string, props: any, state?: any) => {
     const renderCount = useRef(0);
     renderCount.current++;

     useEffect(() => {
       console.group(`🔍 ${componentName} Debug Info`);
       console.log('Render count:', renderCount.current);
       console.log('Props:', props);
       if (state) console.log('State:', state);
       console.groupEnd();
     });

     useEffect(() => {
       console.log(`🔄 ${componentName} mounted`);
       return () => console.log(`💀 ${componentName} unmounted`);
     }, []);
   };

   // Usage in components
   const PromptCardForm = ({ onSubmit, initialData }) => {
     const [formData, setFormData] = useState(initialData);
     
     useDebug('PromptCardForm', { onSubmit, initialData }, { formData });

     return (
       // Component JSX
     );
   };
   ```

2. **React Developer Tools Integration**
   ```typescript
   // src/components/DebugPanel.tsx (development only)
   import { useState, useEffect } from 'react';

   const DebugPanel = ({ isVisible = false }) => {
     const [debugInfo, setDebugInfo] = useState({});

     useEffect(() => {
       if (process.env.NODE_ENV === 'development' && window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
         // Enhanced debugging for development
         window.debugApp = {
           getComponentState: (fiber) => {
             // Access component state for debugging
           },
           logRenders: (enabled) => {
             // Toggle render logging
           }
         };
       }
     }, []);

     if (process.env.NODE_ENV !== 'development' || !isVisible) {
       return null;
     }

     return (
       <div className="debug-panel">
         <h3>Debug Information</h3>
         <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
       </div>
     );
   };
   ```

### API Client Debugging

1. **HTTP Client Debugging**
   ```typescript
   // src/lib/api.ts
   class ApiClient {
     private baseURL: string;

     constructor(baseURL: string) {
       this.baseURL = baseURL;
     }

     async request(endpoint: string, options: RequestInit = {}) {
       const url = `${this.baseURL}${endpoint}`;
       const requestId = Math.random().toString(36).substr(2, 9);

       if (process.env.NODE_ENV === 'development') {
         console.group(`🌐 API Request [${requestId}]`);
         console.log('URL:', url);
         console.log('Method:', options.method || 'GET');
         console.log('Headers:', options.headers);
         if (options.body) {
           console.log('Body:', options.body);
         }
         console.groupEnd();
       }

       try {
         const response = await fetch(url, options);
         
         if (process.env.NODE_ENV === 'development') {
           console.group(`📥 API Response [${requestId}]`);
           console.log('Status:', response.status, response.statusText);
           console.log('Headers:', Object.fromEntries(response.headers.entries()));
         }

         if (!response.ok) {
           const errorData = await response.json();
           if (process.env.NODE_ENV === 'development') {
             console.error('Error Data:', errorData);
             console.groupEnd();
           }
           throw new ApiError(response.status, errorData);
         }

         const data = await response.json();
         
         if (process.env.NODE_ENV === 'development') {
           console.log('Data:', data);
           console.groupEnd();
         }

         return data;
       } catch (error) {
         if (process.env.NODE_ENV === 'development') {
           console.error(`❌ API Error [${requestId}]:`, error);
         }
         throw error;
       }
     }
   }
   ```

2. **State Management Debugging**
   ```typescript
   // src/hooks/usePromptCards.ts
   import { useEffect } from 'react';
   import useSWR from 'swr';

   export const usePromptCards = (params = {}) => {
     const { data, error, mutate } = useSWR(
       ['/api/prompt-cards', params],
       ([url, params]) => apiClient.get(url, { params })
     );

     // Debug state changes
     useEffect(() => {
       if (process.env.NODE_ENV === 'development') {
         console.log('usePromptCards state change:', {
           data: data?.length ? `${data.length} items` : data,
           error: error?.message,
           isLoading: !data && !error,
           timestamp: new Date().toISOString()
         });
       }
     }, [data, error]);

     return {
       promptCards: data?.data || [],
       isLoading: !data && !error,
       error,
       refresh: mutate,
       // Debug helpers
       ...(process.env.NODE_ENV === 'development' && {
         _debug: { data, error, mutate }
       })
     };
   };
   ```

### Browser Debugging Tools

1. **Console Commands for Debugging**
   ```javascript
   // Add to window for development debugging
   if (process.env.NODE_ENV === 'development') {
     window.debugTools = {
       // Inspect component props
       getProps: (element) => {
         const fiber = element._reactInternalFiber || element._reactInternals;
         return fiber?.memoizedProps;
       },

       // Log all API calls
       enableApiLogging: () => {
         const originalFetch = window.fetch;
         window.fetch = function(...args) {
           console.log('Fetch:', args[0], args[1]);
           return originalFetch.apply(this, args);
         };
       },

       // Performance monitoring
       measureComponent: (componentName) => {
         performance.mark(`${componentName}-start`);
         setTimeout(() => {
           performance.mark(`${componentName}-end`);
           performance.measure(componentName, `${componentName}-start`, `${componentName}-end`);
           const measure = performance.getEntriesByName(componentName)[0];
           console.log(`${componentName} render time:`, measure.duration);
         }, 0);
       }
     };
   }
   ```

## Database Debugging

### SQLite Debugging

1. **Query Analysis**
   ```bash
   # Access SQLite database directly
   sqlite3 backend/data/database.sqlite

   # Useful SQLite debugging commands
   .schema                          # Show all table schemas
   .tables                          # List all tables
   .indices                         # Show all indices
   .mode column                     # Display in column mode
   .headers on                      # Show column headers
   .timer on                        # Show query execution time

   # Analyze query performance
   EXPLAIN QUERY PLAN SELECT * FROM prompt_cards WHERE title LIKE '%test%';

   # Check database integrity
   PRAGMA integrity_check;

   # Show database stats
   PRAGMA database_list;
   PRAGMA table_info(prompt_cards);
   ```

2. **Database Debug Utilities**
   ```typescript
   // src/database/debug.ts
   export class DatabaseDebugger {
     constructor(private db: Database) {}

     logSlowQueries(thresholdMs = 100) {
       const originalPrepare = this.db.prepare.bind(this.db);
       
       this.db.prepare = function(sql: string) {
         const stmt = originalPrepare(sql);
         const originalRun = stmt.run.bind(stmt);
         const originalGet = stmt.get.bind(stmt);
         const originalAll = stmt.all.bind(stmt);

         const wrapMethod = (method: Function, methodName: string) => {
           return function(...args: any[]) {
             const start = performance.now();
             const result = method.apply(this, args);
             const duration = performance.now() - start;
             
             if (duration > thresholdMs) {
               logger.warn('Slow query detected', {
                 sql: sql,
                 method: methodName,
                 duration: `${duration.toFixed(2)}ms`,
                 args: args.length > 0 ? args : undefined
               });
             }
             
             return result;
           };
         };

         stmt.run = wrapMethod(originalRun, 'run');
         stmt.get = wrapMethod(originalGet, 'get');
         stmt.all = wrapMethod(originalAll, 'all');

         return stmt;
       };
     }

     analyzeTable(tableName: string) {
       const tableInfo = this.db.pragma(`table_info(${tableName})`);
       const indices = this.db.pragma(`index_list(${tableName})`);
       const stats = this.db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();

       console.log(`Table Analysis: ${tableName}`);
       console.log('Columns:', tableInfo);
       console.log('Indices:', indices);
       console.log('Row Count:', stats);

       return { tableInfo, indices, stats };
     }

     findLockingQueries() {
       // Note: SQLite doesn't have the same locking visibility as PostgreSQL
       // But we can check for long-running transactions
       const start = Date.now();
       
       try {
         this.db.exec('BEGIN IMMEDIATE');
         this.db.exec('ROLLBACK');
         const duration = Date.now() - start;
         
         if (duration > 1000) {
           logger.warn('Potential database locking detected', { duration });
         }
       } catch (error) {
         logger.error('Database lock check failed', { error: error.message });
       }
     }
   }
   ```

## Docker Debugging

### Container Debugging

1. **Container Inspection**
   ```bash
   # List running containers
   docker ps

   # Inspect container details
   docker inspect prompt-card-backend

   # View container logs
   docker logs prompt-card-backend -f --tail 100

   # Access container shell
   docker exec -it prompt-card-backend sh

   # Check container resource usage
   docker stats prompt-card-backend

   # View container processes
   docker exec prompt-card-backend ps aux
   ```

2. **Docker Compose Debugging**
   ```bash
   # Start services with detailed logging
   docker-compose -f docker-compose.dev.yml up --build --no-deps backend

   # View specific service logs
   docker-compose logs -f backend

   # Check service health
   docker-compose ps

   # Restart specific service
   docker-compose restart backend

   # Execute commands in running service
   docker-compose exec backend npm run db:migrate

   # Debug network issues
   docker network ls
   docker network inspect prompt-card-system_app-network
   ```

3. **Dockerfile Debugging**
   ```dockerfile
   # Add debugging layers to Dockerfile.dev
   FROM node:20-alpine AS debug

   # Install debugging tools
   RUN apk add --no-cache curl netcat-openbsd

   # Copy source with debugging
   COPY . .

   # Add health check
   HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
     CMD curl -f http://localhost:3001/health || exit 1

   # Enable debugging port
   EXPOSE 9229

   # Start with debugging
   CMD ["node", "--inspect=0.0.0.0:9229", "dist/server.js"]
   ```

### Network Debugging

```bash
# Test container connectivity
docker exec prompt-card-backend ping prompt-card-frontend
docker exec prompt-card-backend curl http://frontend:3000/health

# Check port mappings
docker port prompt-card-backend

# Inspect network configuration
docker network inspect bridge
```

## AI/LLM Debugging

### Ollama Debugging

1. **Ollama Connection Testing**
   ```typescript
   // src/services/ollama-debug.ts
   export class OllamaDebugger {
     constructor(private baseUrl: string) {}

     async diagnose() {
       const tests = [
         this.testConnection(),
         this.testModels(),
         this.testGeneration(),
         this.testPerformance()
       ];

       const results = await Promise.allSettled(tests);
       
       results.forEach((result, index) => {
         const testNames = ['Connection', 'Models', 'Generation', 'Performance'];
         if (result.status === 'fulfilled') {
           console.log(`✅ ${testNames[index]} test passed:`, result.value);
         } else {
           console.error(`❌ ${testNames[index]} test failed:`, result.reason);
         }
       });
     }

     async testConnection() {
       const response = await fetch(`${this.baseUrl}/api/version`);
       if (!response.ok) {
         throw new Error(`Connection failed: ${response.status}`);
       }
       return await response.json();
     }

     async testModels() {
       const response = await fetch(`${this.baseUrl}/api/tags`);
       if (!response.ok) {
         throw new Error(`Failed to fetch models: ${response.status}`);
       }
       const data = await response.json();
       return data.models?.length || 0;
     }

     async testGeneration() {
       const start = Date.now();
       const response = await fetch(`${this.baseUrl}/api/generate`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           model: 'llama2:7b',
           prompt: 'Say hello',
           stream: false
         })
       });

       if (!response.ok) {
         throw new Error(`Generation failed: ${response.status}`);
       }

       const data = await response.json();
       const duration = Date.now() - start;

       return {
         response: data.response,
         duration,
         tokensPerSecond: data.eval_count ? (data.eval_count / (data.eval_duration / 1000000000)).toFixed(2) : 'N/A'
       };
     }

     async testPerformance() {
       const runs = 3;
       const results = [];

       for (let i = 0; i < runs; i++) {
         const start = Date.now();
         await fetch(`${this.baseUrl}/api/generate`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             model: 'llama2:7b',
             prompt: 'Count to 5',
             stream: false
           })
         });
         results.push(Date.now() - start);
       }

       return {
         average: (results.reduce((a, b) => a + b, 0) / runs).toFixed(2),
         min: Math.min(...results),
         max: Math.max(...results)
       };
     }
   }

   // Usage in debugging
   if (process.env.NODE_ENV === 'development') {
     const debugger = new OllamaDebugger(process.env.OLLAMA_BASE_URL);
     debugger.diagnose();
   }
   ```

2. **LLM Response Analysis**
   ```typescript
   // src/utils/llm-debugger.ts
   export class LLMResponseDebugger {
     static analyzeResponse(prompt: string, response: string, metadata: any = {}) {
       console.group('🤖 LLM Response Analysis');
       
       console.log('Prompt:', prompt);
       console.log('Response:', response);
       console.log('Metadata:', metadata);
       
       // Basic analysis
       const analysis = {
         promptLength: prompt.length,
         responseLength: response.length,
         wordCount: response.split(/\s+/).length,
         sentenceCount: response.split(/[.!?]+/).length - 1,
         tokensUsed: metadata.eval_count || 'Unknown',
         processingTime: metadata.total_duration ? 
           `${(metadata.total_duration / 1000000).toFixed(2)}ms` : 'Unknown'
       };
       
       console.table(analysis);
       
       // Quality checks
       const qualityChecks = {
         hasContent: response.trim().length > 0,
         isRelevant: this.checkRelevance(prompt, response),
         isSafe: this.checkSafety(response),
         isCoherent: this.checkCoherence(response)
       };
       
       console.log('Quality Checks:', qualityChecks);
       console.groupEnd();
       
       return { analysis, qualityChecks };
     }

     static checkRelevance(prompt: string, response: string): boolean {
       // Simple keyword matching for relevance
       const promptWords = prompt.toLowerCase().split(/\s+/);
       const responseWords = response.toLowerCase().split(/\s+/);
       
       const commonWords = promptWords.filter(word => 
         responseWords.includes(word) && word.length > 3
       );
       
       return commonWords.length > 0;
     }

     static checkSafety(response: string): boolean {
       const unsafePatterns = [
         /harmful|dangerous|illegal/i,
         /password|secret|confidential/i,
         /<script|javascript:/i
       ];
       
       return !unsafePatterns.some(pattern => pattern.test(response));
     }

     static checkCoherence(response: string): boolean {
       // Basic coherence check
       return response.length > 10 && 
              !response.includes('undefined') && 
              !response.includes('null');
     }
   }
   ```

## Performance Debugging

### Backend Performance

1. **Memory Usage Monitoring**
   ```typescript
   // src/utils/memory-monitor.ts
   export class MemoryMonitor {
     private static instance: MemoryMonitor;
     private intervalId?: NodeJS.Timeout;

     static getInstance() {
       if (!this.instance) {
         this.instance = new MemoryMonitor();
       }
       return this.instance;
     }

     startMonitoring(intervalMs = 30000) {
       this.intervalId = setInterval(() => {
         const usage = process.memoryUsage();
         const formatBytes = (bytes: number) => (bytes / 1024 / 1024).toFixed(2) + 'MB';

         const memoryInfo = {
           rss: formatBytes(usage.rss),          // Resident Set Size
           heapTotal: formatBytes(usage.heapTotal), // Heap allocated
           heapUsed: formatBytes(usage.heapUsed),   // Heap used
           external: formatBytes(usage.external),   // External memory
           uptime: process.uptime()
         };

         logger.debug('Memory Usage', memoryInfo);

         // Alert on high memory usage
         const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100;
         if (heapUsedPercent > 80) {
           logger.warn('High memory usage detected', {
             heapUsedPercent: heapUsedPercent.toFixed(2) + '%',
             ...memoryInfo
           });
         }
       }, intervalMs);
     }

     stopMonitoring() {
       if (this.intervalId) {
         clearInterval(this.intervalId);
         this.intervalId = undefined;
       }
     }

     getSnapshot() {
       const usage = process.memoryUsage();
       return {
         timestamp: new Date().toISOString(),
         memoryUsage: usage,
         uptime: process.uptime(),
         pid: process.pid
       };
     }
   }

   // Start monitoring in development
   if (process.env.NODE_ENV === 'development') {
     MemoryMonitor.getInstance().startMonitoring();
   }
   ```

2. **Request Performance Tracking**
   ```typescript
   // src/middleware/performance.ts
   export const performanceMiddleware = (req: Request, res: Response, next: NextFunction) => {
     const start = Date.now();
     
     // Track database queries for this request
     let queryCount = 0;
     let queryTime = 0;

     const originalQuery = req.db?.query;
     if (originalQuery) {
       req.db.query = function(...args: any[]) {
         const queryStart = Date.now();
         const result = originalQuery.apply(this, args);
         queryTime += Date.now() - queryStart;
         queryCount++;
         return result;
       };
     }

     res.on('finish', () => {
       const duration = Date.now() - start;
       
       const performanceData = {
         method: req.method,
         url: req.url,
         statusCode: res.statusCode,
         duration: `${duration}ms`,
         queryCount,
         queryTime: `${queryTime}ms`,
         userAgent: req.headers['user-agent'],
         ip: req.ip
       };

       // Log slow requests
       if (duration > 1000) {
         logger.warn('Slow request detected', performanceData);
       } else if (process.env.DEBUG_PERFORMANCE) {
         logger.debug('Request performance', performanceData);
       }
     });

     next();
   };
   ```

### Frontend Performance

1. **React Performance Debugging**
   ```typescript
   // src/utils/performance-profiler.tsx
   import React, { Profiler, ProfilerOnRenderCallback } from 'react';

   const onRenderCallback: ProfilerOnRenderCallback = (
     id, 
     phase, 
     actualDuration, 
     baseDuration, 
     startTime, 
     commitTime
   ) => {
     if (process.env.NODE_ENV === 'development') {
       console.log('Profiler:', {
         component: id,
         phase,
         actualDuration: `${actualDuration.toFixed(2)}ms`,
         baseDuration: `${baseDuration.toFixed(2)}ms`,
         startTime: `${startTime.toFixed(2)}ms`,
         commitTime: `${commitTime.toFixed(2)}ms`
       });

       // Alert on slow renders
       if (actualDuration > 16) { // 60fps = 16.67ms per frame
         console.warn(`Slow render detected in ${id}: ${actualDuration.toFixed(2)}ms`);
       }
     }
   };

   export const PerformanceProfiler: React.FC<{ id: string; children: React.ReactNode }> = ({ 
     id, 
     children 
   }) => {
     if (process.env.NODE_ENV === 'development') {
       return (
         <Profiler id={id} onRender={onRenderCallback}>
           {children}
         </Profiler>
       );
     }
     return <>{children}</>;
   };

   // Usage
   const ExpensiveComponent = () => (
     <PerformanceProfiler id="ExpensiveComponent">
       <SomeComplexComponent />
     </PerformanceProfiler>
   );
   ```

2. **Bundle Size Analysis**
   ```bash
   # Analyze frontend bundle size
   cd frontend
   npm run build
   npx webpack-bundle-analyzer .next/static/chunks/

   # Check for duplicate dependencies
   npx duplicate-package-checker-webpack-plugin

   # Analyze what's in your bundle
   npx next-bundle-analyzer
   ```

## Common Issues and Solutions

### 1. Port Already in Use

**Problem:** `EADDRINUSE: address already in use :::3001`

**Solutions:**
```bash
# Find what's using the port
lsof -i :3001
netstat -tulpn | grep 3001

# Kill the process
kill -9 $(lsof -t -i:3001)

# Or use different port
PORT=3002 npm run dev
```

### 2. Database Locked

**Problem:** `SQLITE_BUSY: database is locked`

**Solutions:**
```bash
# Check for zombie processes
ps aux | grep node

# Remove database lock file
rm backend/data/database.sqlite-wal
rm backend/data/database.sqlite-shm

# Restart application
npm run dev
```

### 3. Ollama Connection Failed

**Problem:** `fetch failed to http://localhost:11434`

**Solutions:**
```bash
# Check Ollama status
curl http://localhost:11434/api/version

# Start Ollama if not running
ollama serve

# Check Docker Ollama
docker logs ollama-container

# Test with curl
curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model":"llama2:7b","prompt":"hello"}'
```

### 4. Memory Leaks

**Problem:** Application memory usage keeps growing

**Debug Steps:**
```bash
# Enable memory debugging
node --inspect --expose-gc server.js

# Take heap snapshots
kill -USR2 <pid>  # Creates heap dump

# Use clinic.js for analysis
npx clinic doctor -- node server.js
npx clinic bubbleprof -- node server.js
```

### 5. Frontend Build Failures

**Problem:** TypeScript or build errors

**Solutions:**
```bash
# Clear Next.js cache
rm -rf frontend/.next

# Clear node modules
rm -rf frontend/node_modules
npm install

# Check TypeScript errors
npm run type-check

# Build in verbose mode
npm run build --verbose
```

## Production Debugging

### Log Analysis

1. **Centralized Logging Setup**
   ```typescript
   // src/utils/production-logger.ts
   import winston from 'winston';

   const logger = winston.createLogger({
     level: 'info',
     format: winston.format.combine(
       winston.format.timestamp(),
       winston.format.errors({ stack: true }),
       winston.format.json()
     ),
     transports: [
       new winston.transports.File({ 
         filename: 'logs/error.log', 
         level: 'error',
         maxsize: 5242880, // 5MB
         maxFiles: 5
       }),
       new winston.transports.File({ 
         filename: 'logs/combined.log',
         maxsize: 5242880,
         maxFiles: 5
       })
     ]
   });

   // Add console transport in development
   if (process.env.NODE_ENV !== 'production') {
     logger.add(new winston.transports.Console({
       format: winston.format.simple()
     }));
   }

   export default logger;
   ```

2. **Error Tracking**
   ```bash
   # Monitor error logs
   tail -f logs/error.log

   # Search for specific errors
   grep "SQLITE_BUSY" logs/combined.log

   # Count error types
   grep -c "ValidationError" logs/error.log

   # Monitor with journalctl (systemd)
   journalctl -u prompt-card-system -f
   ```

### Performance Monitoring

```bash
# Monitor system resources
htop
iostat -x 1
free -h

# Monitor application performance
pm2 monit  # if using PM2
docker stats  # if using Docker

# Check database performance
sqlite3 data/database.sqlite "PRAGMA optimize;"
```

### Health Check Debugging

```bash
# Test health endpoints
curl -v http://localhost:3001/health
curl -v http://localhost:3000/api/health

# Check all dependencies
curl http://localhost:3001/health/detailed
```

## Monitoring and Observability

### Application Metrics

```typescript
// src/utils/metrics.ts
import prometheus from 'prom-client';

// Create metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'status_code', 'endpoint']
});

const databaseQueryDuration = new prometheus.Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table']
});

const llmRequestDuration = new prometheus.Histogram({
  name: 'llm_request_duration_seconds',
  help: 'Duration of LLM requests in seconds',
  labelNames: ['model', 'status']
});

// Export metrics endpoint
export const metricsHandler = (req: Request, res: Response) => {
  res.set('Content-Type', prometheus.register.contentType);
  res.send(prometheus.register.metrics());
};
```

### Alerting Setup

```yaml
# alertmanager.yml
global:
  smtp_smarthost: 'localhost:587'
  smtp_from: 'alerts@promptcard.com'

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'

receivers:
- name: 'web.hook'
  email_configs:
  - to: 'admin@promptcard.com'
    subject: 'Prompt Card System Alert'
    body: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
```

This comprehensive debugging guide provides the tools and techniques needed to effectively troubleshoot issues in the Prompt Card System. Regular use of these debugging practices will help maintain system stability and provide quick resolution of issues when they arise.