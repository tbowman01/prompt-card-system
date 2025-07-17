import { Router } from 'express';
import * as yaml from 'js-yaml';
import { db } from '../database/connection';
import { PromptCard } from '../types/promptCard';

const router = Router();

// Import prompt cards from YAML
router.post('/import', (req, res) => {
  try {
    const { yamlContent } = req.body;
    
    if (!yamlContent) {
      return res.status(400).json({
        success: false,
        error: 'YAML content is required'
      });
    }

    // Parse YAML
    const config = yaml.load(yamlContent) as any;
    
    if (!config || !config.prompts || !Array.isArray(config.prompts)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid YAML format: prompts array is required'
      });
    }

    const importedCards = [];
    
    // Process each prompt
    for (let i = 0; i < config.prompts.length; i++) {
      const prompt = config.prompts[i];
      
      // Extract variables from prompt template
      const variables = extractVariables(prompt);
      
      // Create prompt card
      const result = db.prepare(`
        INSERT INTO prompt_cards (title, description, prompt_template, variables)
        VALUES (?, ?, ?, ?)
      `).run(
        `Imported Prompt ${i + 1}`,
        'Imported from YAML configuration',
        prompt,
        JSON.stringify(variables)
      );

      const cardId = result.lastInsertRowid;
      
      // Create test cases from YAML tests
      if (config.tests && Array.isArray(config.tests)) {
        for (const test of config.tests) {
          if (test.vars) {
            db.prepare(`
              INSERT INTO test_cases (prompt_card_id, name, input_variables, expected_output, assertions)
              VALUES (?, ?, ?, ?, ?)
            `).run(
              cardId,
              `Test case ${importedCards.length + 1}`,
              JSON.stringify(test.vars),
              test.expected || '',
              JSON.stringify(test.assert || [])
            );
          }
        }
      }
      
      importedCards.push(cardId);
    }

    res.json({
      success: true,
      message: `Successfully imported ${importedCards.length} prompt cards`,
      data: { imported_card_ids: importedCards }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to import YAML'
    });
  }
});

// Export prompt card to YAML
router.get('/export/:id', (req, res) => {
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
      SELECT * FROM test_cases WHERE prompt_card_id = ?
    `).all(id);

    // Build Promptfoo configuration
    const config = {
      prompts: [card.prompt_template],
      providers: ['ollama:chat:llama2:7b'],
      tests: testCases.map(tc => ({
        vars: JSON.parse(tc.input_variables),
        expected: tc.expected_output,
        assert: JSON.parse(tc.assertions || '[]')
      }))
    };

    const yamlContent = yaml.dump(config, {
      indent: 2,
      lineWidth: 120,
      noRefs: true
    });

    res.json({
      success: true,
      data: {
        yaml: yamlContent,
        filename: `${card.title.replace(/[^a-zA-Z0-9]/g, '_')}.yaml`
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to export YAML'
    });
  }
});

// Export all prompt cards to YAML
router.get('/export', (req, res) => {
  try {
    const cards = db.prepare(`
      SELECT * FROM prompt_cards ORDER BY created_at DESC
    `).all() as PromptCard[];

    const configurations = [];
    
    for (const card of cards) {
      const testCases = db.prepare(`
        SELECT * FROM test_cases WHERE prompt_card_id = ?
      `).all(card.id);

      const config = {
        description: card.title,
        prompts: [card.prompt_template],
        providers: ['ollama:chat:llama2:7b'],
        tests: testCases.map(tc => ({
          vars: JSON.parse(tc.input_variables),
          expected: tc.expected_output,
          assert: JSON.parse(tc.assertions || '[]')
        }))
      };

      configurations.push(config);
    }

    const yamlContent = yaml.dump({
      configurations
    }, {
      indent: 2,
      lineWidth: 120,
      noRefs: true
    });

    res.json({
      success: true,
      data: {
        yaml: yamlContent,
        filename: 'all_prompt_cards.yaml'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to export all YAML'
    });
  }
});

// Helper function to extract variables from prompt template
function extractVariables(prompt: string): string[] {
  const variableRegex = /\{\{(\w+)\}\}/g;
  const variables: string[] = [];
  let match;
  
  while ((match = variableRegex.exec(prompt)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }
  
  return variables;
}

export { router as yamlRoutes };