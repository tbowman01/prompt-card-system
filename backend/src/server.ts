import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { initializeDatabase } from './database/connection';
import { healthRoutes } from './routes/health';
import { promptCardRoutes } from './routes/promptCards';
import { testCaseRoutes } from './routes/testCases';
import { testExecutionRoutes } from './routes/testExecution';
import { yamlRoutes } from './routes/yaml';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
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
initializeDatabase();

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/prompt-cards', promptCardRoutes);
app.use('/api/test-cases', testCaseRoutes);
app.use('/api/test-cases', testExecutionRoutes); // Test execution routes
app.use('/api/yaml', yamlRoutes);

// Error handling middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Database path: ${process.env.DATABASE_PATH}`);
  console.log(`Ollama URL: ${process.env.OLLAMA_BASE_URL}`);
});

export default app;