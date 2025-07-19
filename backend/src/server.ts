import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { initializeDatabase } from './database/connection';
import { llmService } from './services/llmService';
import { healthRoutes } from './routes/health';
import { enhancedHealthRoutes } from './routes/health-enhanced';
import { healthOrchestratorRoutes } from './routes/health-orchestrator';
import { alertRoutes } from './routes/alerts';
import { promptCardRoutes } from './routes/promptCards';
import { testCaseRoutes } from './routes/testCases';
import { testExecutionRoutes } from './routes/testExecution';
import { parallelTestExecutionRoutes } from './routes/parallelTestExecution';
import { yamlRoutes } from './routes/yaml';
import { assertionRoutes } from './routes/assertions';
import { analyticsRoutes } from './routes/analytics';
import optimizationRoutes from './routes/optimization';
import { reportRoutes } from './routes/reports';
import performanceRoutes from './routes/performance';
import trainingRoutes from './routes/training';
import { initializeOptimizationServices } from './services/optimization';
import { performanceMonitor } from './services/performance/PerformanceMonitor';
import { ProgressService } from './services/websocket/ProgressService';
import { errorHandler } from './middleware/errorHandler';
import { healthOrchestrator } from './services/health/HealthOrchestrator';
import { alertingSystem } from './services/health/AlertingSystem';
import { modelTrainingEngine } from './services/training/ModelTrainingEngine';
import { modelRegistry } from './services/training/ModelRegistry';

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize database
const db = initializeDatabase();

// Initialize LLM service with enhanced assertion engine
llmService.initialize().catch(error => {
  console.error('Failed to initialize LLM service:', error);
  // Continue without enhanced assertions if initialization fails
});

// Initialize AI-powered optimization services
initializeOptimizationServices().catch(error => {
  console.error('Failed to initialize optimization services:', error);
  // Continue without optimization services if initialization fails
});

// Setup WebSocket server
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Initialize performance monitoring
const progressService = new ProgressService(io);
performanceMonitor.startMonitoring(5000); // Monitor every 5 seconds

// Initialize health orchestrator
healthOrchestrator.start().catch(error => {
  console.error('Failed to start health orchestrator:', error);
});

// Initialize alerting system
alertingSystem.initialize().catch(error => {
  console.error('Failed to initialize alerting system:', error);
});

// Initialize training services
modelTrainingEngine.initialize().catch(error => {
  console.error('Failed to initialize model training engine:', error);
});

modelRegistry.initialize().catch(error => {
  console.error('Failed to initialize model registry:', error);
});

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/health/v2', enhancedHealthRoutes);
app.use('/api/health/orchestrator', healthOrchestratorRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/prompt-cards', promptCardRoutes);
app.use('/api/test-cases', testCaseRoutes);
app.use('/api/test-cases', testExecutionRoutes); // Test execution routes
app.use('/api/parallel-test-execution', parallelTestExecutionRoutes); // Parallel test execution routes
app.use('/api/yaml', yamlRoutes);
app.use('/api/assertions', assertionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/optimization', optimizationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/training', trainingRoutes);

// Error handling middleware
app.use(errorHandler);

// Store WebSocket instance for health checks
app.set('io', io);

// Start server
server.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Database path: ${process.env.DATABASE_PATH}`);
  console.log(`Ollama URL: ${process.env.OLLAMA_BASE_URL}`);
  console.log(`WebSocket server initialized`);
  console.log(`Parallel test execution system ready`);
  console.log(`AI-powered prompt optimization services active`);
  console.log(`Performance monitoring active`);
  console.log(`Performance API available at /api/performance`);
  console.log(`Health orchestrator system active`);
  console.log(`Health dashboard available at /api/health/orchestrator/summary`);
  console.log(`Alerting system active`);
  console.log(`Alerts API available at /api/alerts`);
});

export default app;