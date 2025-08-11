import { Router, Request, Response } from 'express';
import { db } from '../database/connection';

const router = Router();

// Health check endpoint
router.get('/', (req: Request, res: Response) => {
  try {
    // Check database connection
    const dbCheck = db.prepare('SELECT 1').get();
    
    // Check Ollama connection (basic check)
    const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://ollama:11434';
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: dbCheck ? 'connected' : 'disconnected',
        ollama: {
          url: ollamaUrl,
          status: 'configured' // Will be enhanced in Phase 3
        }
      },
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Database status endpoint
router.get('/db', (req: Request, res: Response) => {
  try {
    const promptCardCount = db.prepare('SELECT COUNT(*) as count FROM prompt_cards').get() as { count: number };
    const testCaseCount = db.prepare('SELECT COUNT(*) as count FROM test_cases').get() as { count: number };
    
    res.json({
      status: 'connected',
      stats: {
        prompt_cards: promptCardCount.count,
        test_cases: testCaseCount.count
      },
      database_path: process.env.DATABASE_PATH
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Database connection failed'
    });
  }
});

export { router as healthRoutes };