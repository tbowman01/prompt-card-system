import { Router } from 'express';
import { db } from '../database/connection';
import yaml from 'js-yaml';
import { PromptCard, CreatePromptCardRequest } from '../types/promptCard';
import { CreateTestCaseRequest, AssertionType } from '../types/testCase';

const router = Router();

interface PromptfooConfig {
  prompts: string[];
  providers: string[];
  tests: Array<{
    vars: Record<string, any>;
    assert?: Array<{
      type: string;
      value: string | number;
      description?: string;
    }>;
  }>;
  description?: string;
}

// Export prompt card(s) to YAML
router.get('/export/:id?', (req, res) => {
  try {
    const { id } = req.params;
    let promptCards: any[];

    if (id) {
      // Export single prompt card
      const card = db.prepare(`
        SELECT * FROM prompt_cards WHERE id = ?
      `).get(id);

      if (!card) {
        return res.status(404).json({
          success: false,
          error: 'Prompt card not found'
        });
      }

      const testCases = db.prepare(`
        SELECT * FROM test_cases WHERE prompt_card_id = ?
      `).all(id);

      promptCards = [{
        ...card,
        test_cases: testCases
      }];
    } else {
      // Export all prompt cards
      const cards = db.prepare('SELECT * FROM prompt_cards ORDER BY created_at DESC').all() as PromptCard[];
      promptCards = cards.map((card: PromptCard) => {
        const testCases = db.prepare(`
          SELECT * FROM test_cases WHERE prompt_card_id = ?
        `).all(card.id);
        return { ...card, test_cases: testCases };
      });
    }

    // Convert to Promptfoo format
    const promptfooConfigs = promptCards.map(card => {
      const config: PromptfooConfig = {
        prompts: [card.prompt_template],
        providers: ['ollama:chat:llama2:7b'], // Default provider
        tests: card.test_cases.map((tc: any) => ({
          vars: JSON.parse(tc.input_variables),
          assert: JSON.parse(tc.assertions || '[]')
        })),
        description: card.description || card.title
      };
      return config;
    });

    // If single card, return single config, otherwise return array
    const yamlContent = yaml.dump(promptCards.length === 1 ? promptfooConfigs[0] : promptfooConfigs);

    res.setHeader('Content-Type', 'application/x-yaml');
    res.setHeader('Content-Disposition', `attachment; filename="prompt-cards-${Date.now()}.yaml"`);
    return res.send(yamlContent);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to export YAML'
    });
  }
});

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
    const parsed = yaml.load(yamlContent);
    if (!parsed) {
      return res.status(400).json({
        success: false,
        error: 'Invalid YAML content'
      });
    }

    // Handle both single config and array of configs
    const configs = Array.isArray(parsed) ? parsed : [parsed];
    const importedCards: any[] = [];

    // Begin transaction
    const transaction = db.transaction((configs: PromptfooConfig[]) => {
      for (const config of configs) {
        // Validate config structure
        if (!config.prompts || !Array.isArray(config.prompts) || config.prompts.length === 0) {
          throw new Error('Invalid config: prompts array is required');
        }

        if (!config.tests || !Array.isArray(config.tests)) {
          throw new Error('Invalid config: tests array is required');
        }

        // Extract variables from prompt template
        const promptTemplate = config.prompts[0];
        const variableMatches = promptTemplate.match(/\{\{(\w+)\}\}/g) || [];
        const variables = variableMatches.map(match => match.replace(/\{\{|\}\}/g, ''));

        // Create prompt card
        const cardData: CreatePromptCardRequest = {
          title: config.description || `Imported Prompt ${Date.now()}`,
          description: config.description,
          prompt_template: promptTemplate,
          variables
        };

        const cardResult = db.prepare(`
          INSERT INTO prompt_cards (title, description, prompt_template, variables)
          VALUES (?, ?, ?, ?)
        `).run(
          cardData.title,
          cardData.description,
          cardData.prompt_template,
          JSON.stringify(cardData.variables || [])
        );

        const promptCardId = cardResult.lastInsertRowid as number;

        // Create test cases
        for (let i = 0; i < config.tests.length; i++) {
          const test = config.tests[i];
          const testCaseData: CreateTestCaseRequest = {
            prompt_card_id: promptCardId,
            name: `Test Case ${i + 1}`,
            input_variables: test.vars || {},
            assertions: (test.assert || []) as AssertionType[]
          };

          db.prepare(`
            INSERT INTO test_cases (prompt_card_id, name, input_variables, expected_output, assertions)
            VALUES (?, ?, ?, ?, ?)
          `).run(
            testCaseData.prompt_card_id,
            testCaseData.name,
            JSON.stringify(testCaseData.input_variables),
            testCaseData.expected_output || null,
            JSON.stringify(testCaseData.assertions || [])
          );
        }

        // Get the created card with test cases
        const createdCard = db.prepare(`
          SELECT * FROM prompt_cards WHERE id = ?
        `).get(promptCardId) as PromptCard;

        const testCases = db.prepare(`
          SELECT * FROM test_cases WHERE prompt_card_id = ?
        `).all(promptCardId);

        importedCards.push({
          ...createdCard,
          variables: JSON.parse(createdCard.variables || '[]'),
          test_cases: testCases.map((tc: any) => ({
            ...tc,
            input_variables: JSON.parse(tc.input_variables),
            assertions: JSON.parse(tc.assertions || '[]')
          }))
        });
      }
    });

    transaction(configs);

    return res.status(201).json({
      success: true,
      data: importedCards as any[],
      message: `Successfully imported ${importedCards.length} prompt card(s)`
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to import YAML'
    });
  }
});

// Validate YAML format
router.post('/validate', (req, res) => {
  try {
    const { yamlContent } = req.body;

    if (!yamlContent) {
      return res.status(400).json({
        success: false,
        error: 'YAML content is required'
      });
    }

    // Parse YAML
    const parsed = yaml.load(yamlContent);
    if (!parsed) {
      return res.status(400).json({
        success: false,
        error: 'Invalid YAML syntax'
      });
    }

    // Validate structure
    const configs = Array.isArray(parsed) ? parsed : [parsed];
    const validationErrors = [];

    for (let i = 0; i < configs.length; i++) {
      const config = configs[i];
      const prefix = configs.length > 1 ? `Config ${i + 1}: ` : '';

      if (!config.prompts || !Array.isArray(config.prompts) || config.prompts.length === 0) {
        validationErrors.push(`${prefix}prompts array is required and must not be empty`);
      }

      if (!config.tests || !Array.isArray(config.tests)) {
        validationErrors.push(`${prefix}tests array is required`);
      } else {
        config.tests.forEach((test: any, testIndex: number) => {
          if (!test.vars || typeof test.vars !== 'object') {
            validationErrors.push(`${prefix}Test ${testIndex + 1}: vars object is required`);
          }
        });
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationErrors
      });
    }

    return res.json({
      success: true,
      message: 'YAML is valid',
      configCount: configs.length
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to validate YAML'
    });
  }
});

export { router as yamlRoutes };