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
import { promptCardRoutes } from './routes/promptCards';
import { testCaseRoutes } from './routes/testCases';
import { testExecutionRoutes } from './routes/testExecution';
import { parallelTestExecutionRoutes } from './routes/parallelTestExecution';
import { yamlRoutes } from './routes/yaml';
import { assertionRoutes } from './routes/assertions';
import { errorHandler } from './middleware/errorHandler';

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

// Setup WebSocket server
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/prompt-cards', promptCardRoutes);
app.use('/api/test-cases', testCaseRoutes);
app.use('/api/test-cases', testExecutionRoutes); // Test execution routes
app.use('/api/parallel-test-execution', parallelTestExecutionRoutes); // Parallel test execution routes
app.use('/api/yaml', yamlRoutes);
app.use('/api/assertions', assertionRoutes);

// Error handling middleware
app.use(errorHandler);

// Start server
server.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Database path: ${process.env.DATABASE_PATH}`);
  console.log(`Ollama URL: ${process.env.OLLAMA_BASE_URL}`);
  console.log(`WebSocket server initialized`);
  console.log(`Parallel test execution system ready`);
});

export default app;