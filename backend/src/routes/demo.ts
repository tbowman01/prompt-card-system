import { Router, Request, Response } from 'express';
import { db } from '../database/connection';
import path from 'path';
import fs from 'fs';

const router = Router();

interface DemoPromptCard {
  title: string;
  description: string;
  prompt_template: string;
  variables: any[];
  category?: string;
  tags?: string[];
}

interface DemoTestCase {
  prompt_card_id: number;
  name: string;
  description: string;
  input_variables: any;
  expected_output?: string;
  assertions: any[];
}

/**
 * Load demo data into the database
 * POST /api/demo/load
 */
router.post('/load', async (req: Request, res: Response) => {
  try {
    const demoPath = path.join(__dirname, '../../demo');
    
    // Check if demo files exist
    const promptCardsFile = path.join(demoPath, 'demo-prompt-cards.json');
    const testCasesFile = path.join(demoPath, 'demo-test-cases.json');
    
    if (!fs.existsSync(promptCardsFile) || !fs.existsSync(testCasesFile)) {
      return res.status(404).json({
        success: false,
        error: 'Demo data files not found'
      });
    }

    // Read demo data
    const promptCardsData = JSON.parse(fs.readFileSync(promptCardsFile, 'utf8'));
    const testCasesData = JSON.parse(fs.readFileSync(testCasesFile, 'utf8'));

    // Clear existing data (for demo purposes)
    db.prepare('DELETE FROM test_cases').run();
    db.prepare('DELETE FROM prompt_cards').run();

    // Insert prompt cards
    const insertPromptCard = db.prepare(`
      INSERT INTO prompt_cards (title, description, prompt_template, variables, created_at, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    const insertTestCase = db.prepare(`
      INSERT INTO test_cases (prompt_card_id, name, description, input_variables, expected_output, assertions, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    const insertedCards: any[] = [];
    let totalTestCases = 0;

    // Begin transaction
    const transaction = db.transaction(() => {
      // Insert prompt cards
      for (const card of promptCardsData.promptCards) {
        const result = insertPromptCard.run(
          card.title,
          card.description,
          card.prompt_template,
          JSON.stringify(card.variables || [])
        );
        
        const cardId = result.lastInsertRowid;
        insertedCards.push({ ...card, id: cardId });

        // Insert test cases for this card
        const cardTestCases = testCasesData.testCases[card.title] || [];
        for (const testCase of cardTestCases) {
          insertTestCase.run(
            cardId,
            testCase.name,
            testCase.description,
            JSON.stringify(testCase.input_variables),
            testCase.expected_output || null,
            JSON.stringify(testCase.assertions || [])
          );
          totalTestCases++;
        }
      }
    });

    // Execute transaction
    transaction();

    // Create demo session marker
    const sessionData = {
      demoMode: true,
      loadedAt: new Date().toISOString(),
      promptCardsCount: insertedCards.length,
      testCasesCount: totalTestCases
    };

    // Save session data to file for frontend detection
    const sessionFile = path.join(demoPath, 'session-state.json');
    fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2));

    return res.json({
      success: true,
      message: 'Demo data loaded successfully',
      data: {
        promptCardsLoaded: insertedCards.length,
        testCasesLoaded: totalTestCases,
        session: sessionData
      }
    });

  } catch (error) {
    console.error('Demo data loading error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load demo data'
    });
  }
});

/**
 * Check demo mode status
 * GET /api/demo/status
 */
router.get('/status', (req: Request, res: Response) => {
  try {
    const isDemoMode = process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'demo';
    const demoPath = path.join(__dirname, '../../demo');
    const sessionFile = path.join(demoPath, 'session-state.json');
    
    let sessionData = null;
    if (fs.existsSync(sessionFile)) {
      sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
    }

    // Check if demo data is loaded by counting prompt cards
    const promptCardCount = db.prepare('SELECT COUNT(*) as count FROM prompt_cards').get() as { count: number };
    const hasData = promptCardCount.count > 0;

    return res.json({
      success: true,
      data: {
        demoModeEnabled: isDemoMode,
        hasData,
        promptCardCount: promptCardCount.count,
        session: sessionData
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check demo status'
    });
  }
});

/**
 * Clear demo data
 * DELETE /api/demo/clear
 */
router.delete('/clear', (req: Request, res: Response) => {
  try {
    // Clear database
    db.prepare('DELETE FROM test_cases').run();
    db.prepare('DELETE FROM prompt_cards').run();

    // Clear session data
    const demoPath = path.join(__dirname, '../../demo');
    const sessionFile = path.join(demoPath, 'session-state.json');
    if (fs.existsSync(sessionFile)) {
      fs.unlinkSync(sessionFile);
    }

    return res.json({
      success: true,
      message: 'Demo data cleared successfully'
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear demo data'
    });
  }
});

export { router as demoRoutes };