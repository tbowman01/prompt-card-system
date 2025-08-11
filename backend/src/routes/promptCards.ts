import { Router, Request, Response } from 'express';
import { db } from '../database/connection';
import { validatePromptCard } from '../middleware/validation';
import { PromptCard, CreatePromptCardRequest } from '../types/promptCard';
import { TestCase } from '../types/testCase';

const router = Router();

// Get all prompt cards with pagination
router.get('/', (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search as string;

    // Build base query
    let whereClause = '';
    let params: any[] = [];

    if (search) {
      whereClause = 'WHERE pc.title LIKE ? OR pc.description LIKE ?';
      params = [`%${search}%`, `%${search}%`];
    }

    // Get total count
    const totalQuery = `
      SELECT COUNT(*) as total 
      FROM prompt_cards pc 
      ${whereClause}
    `;
    const totalResult = db.prepare(totalQuery).get(...params) as { total: number };
    const total = totalResult.total;

    // Get paginated results
    const dataQuery = `
      SELECT 
        pc.*,
        COUNT(tc.id) as test_case_count
      FROM prompt_cards pc
      LEFT JOIN test_cases tc ON pc.id = tc.prompt_card_id
      ${whereClause}
      GROUP BY pc.id
      ORDER BY pc.updated_at DESC
      LIMIT ? OFFSET ?
    `;
    const cards = db.prepare(dataQuery).all(...params, limit, offset) as PromptCard[];

    const totalPages = Math.ceil(total / limit);

    return res.json({
      success: true,
      data: cards.map(card => ({
        ...card,
        variables: JSON.parse(card.variables || '[]'),
        test_case_count: Number(card.test_case_count)
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch prompt cards'
    });
  }
});

// Get specific prompt card with test cases
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Get prompt card
    const card = db.prepare(`
      SELECT * FROM prompt_cards WHERE id = ?
    `).get(id) as PromptCard;

    if (!card) {
      return res.status(404).json({
        success: false,
        error: 'Prompt card not found'
      });
    }

    // Get test cases
    const testCases = db.prepare(`
      SELECT * FROM test_cases WHERE prompt_card_id = ? ORDER BY created_at DESC
    `).all(id) as TestCase[];

    return res.json({
      success: true,
      data: {
        ...card,
        variables: JSON.parse(card.variables || '[]'),
        test_cases: testCases.map((tc: TestCase) => ({
          ...tc,
          input_variables: JSON.parse(tc.input_variables),
          assertions: JSON.parse(tc.assertions || '[]')
        }))
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch prompt card'
    });
  }
});

// Create new prompt card
router.post('/', validatePromptCard, (req: Request, res: Response) => {
  try {
    const { title, description, prompt_template, variables } = req.body as CreatePromptCardRequest;
    
    const result = db.prepare(`
      INSERT INTO prompt_cards (title, description, prompt_template, variables)
      VALUES (?, ?, ?, ?)
    `).run(title, description, prompt_template, JSON.stringify(variables || []));

    const newCard = db.prepare(`
      SELECT * FROM prompt_cards WHERE id = ?
    `).get(result.lastInsertRowid) as PromptCard;

    return res.status(201).json({
      success: true,
      data: {
        ...newCard,
        variables: JSON.parse(newCard.variables || '[]')
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create prompt card'
    });
  }
});

// Update prompt card
router.put('/:id', validatePromptCard, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, prompt_template, variables } = req.body as CreatePromptCardRequest;
    
    const result = db.prepare(`
      UPDATE prompt_cards 
      SET title = ?, description = ?, prompt_template = ?, variables = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(title, description, prompt_template, JSON.stringify(variables || []), id);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'Prompt card not found'
      });
    }

    const updatedCard = db.prepare(`
      SELECT * FROM prompt_cards WHERE id = ?
    `).get(id) as PromptCard;

    return res.json({
      success: true,
      data: {
        ...updatedCard,
        variables: JSON.parse(updatedCard.variables || '[]')
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update prompt card'
    });
  }
});

// Delete prompt card
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = db.prepare(`
      DELETE FROM prompt_cards WHERE id = ?
    `).run(id);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'Prompt card not found'
      });
    }

    return res.json({
      success: true,
      message: 'Prompt card deleted successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete prompt card'
    });
  }
});

export { router as promptCardRoutes };