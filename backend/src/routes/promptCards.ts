import { Router } from 'express';
import { db } from '../database/connection';
import { validatePromptCard } from '../middleware/validation';
import { PromptCard, CreatePromptCardRequest } from '../types/promptCard';

const router = Router();

// Get all prompt cards
router.get('/', (req, res) => {
  try {
    const cards = db.prepare(`
      SELECT 
        pc.*,
        COUNT(tc.id) as test_case_count
      FROM prompt_cards pc
      LEFT JOIN test_cases tc ON pc.id = tc.prompt_card_id
      GROUP BY pc.id
      ORDER BY pc.updated_at DESC
    `).all() as PromptCard[];

    res.json({
      success: true,
      data: cards.map(card => ({
        ...card,
        variables: JSON.parse(card.variables || '[]'),
        test_case_count: Number(card.test_case_count)
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch prompt cards'
    });
  }
});

// Get specific prompt card with test cases
router.get('/:id', (req, res) => {
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
    `).all(id);

    res.json({
      success: true,
      data: {
        ...card,
        variables: JSON.parse(card.variables || '[]'),
        test_cases: testCases.map(tc => ({
          ...tc,
          input_variables: JSON.parse(tc.input_variables),
          assertions: JSON.parse(tc.assertions || '[]')
        }))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch prompt card'
    });
  }
});

// Create new prompt card
router.post('/', validatePromptCard, (req, res) => {
  try {
    const { title, description, prompt_template, variables } = req.body as CreatePromptCardRequest;
    
    const result = db.prepare(`
      INSERT INTO prompt_cards (title, description, prompt_template, variables)
      VALUES (?, ?, ?, ?)
    `).run(title, description, prompt_template, JSON.stringify(variables || []));

    const newCard = db.prepare(`
      SELECT * FROM prompt_cards WHERE id = ?
    `).get(result.lastInsertRowid) as PromptCard;

    res.status(201).json({
      success: true,
      data: {
        ...newCard,
        variables: JSON.parse(newCard.variables || '[]')
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create prompt card'
    });
  }
});

// Update prompt card
router.put('/:id', validatePromptCard, (req, res) => {
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

    res.json({
      success: true,
      data: {
        ...updatedCard,
        variables: JSON.parse(updatedCard.variables || '[]')
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update prompt card'
    });
  }
});

// Delete prompt card
router.delete('/:id', (req, res) => {
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

    res.json({
      success: true,
      message: 'Prompt card deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete prompt card'
    });
  }
});

export { router as promptCardRoutes };