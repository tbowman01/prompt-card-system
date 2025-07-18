import express from 'express';
import { llmService } from '../services/llmService';
import { assertionEngine } from '../services/assertions';
import { EnhancedAssertionType } from '../services/assertions/AssertionEngine';

export const assertionRoutes = express.Router();

/**
 * Get available assertion types
 */
assertionRoutes.get('/types', async (req, res) => {
  try {
    const types = llmService.getAvailableAssertionTypes();
    const typeDefinitions = types.map(type => {
      const definition = assertionEngine.getRegisteredTypes().includes(type) ? 
        assertionEngine.getStatistics() : null;
      return {
        name: type,
        description: `${type} assertion validation`,
        supported: true
      };
    });

    res.json({
      success: true,
      data: {
        types: typeDefinitions,
        totalTypes: types.length
      }
    });
  } catch (error) {
    console.error('Error getting assertion types:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get assertion execution statistics
 */
assertionRoutes.get('/statistics', async (req, res) => {
  try {
    const stats = llmService.getAssertionStatistics();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting assertion statistics:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Test assertion validation with sample data
 */
assertionRoutes.post('/test', async (req, res) => {
  try {
    const { output, assertions, context } = req.body;

    if (!output || !assertions || !Array.isArray(assertions)) {
      return res.status(400).json({
        success: false,
        error: 'output and assertions array are required'
      });
    }

    const results = await llmService.validateAssertions(output, assertions, context);
    
    const summary = {
      totalAssertions: results.length,
      passedAssertions: results.filter(r => r.passed).length,
      failedAssertions: results.filter(r => !r.passed).length,
      averageExecutionTime: results.reduce((sum, r) => sum + (r.executionTime || 0), 0) / results.length,
      overallPassed: results.every(r => r.passed)
    };

    res.json({
      success: true,
      data: {
        results,
        summary
      }
    });
  } catch (error) {
    console.error('Error testing assertions:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Validate custom assertion code
 */
assertionRoutes.post('/validate-custom', async (req, res) => {
  try {
    const { code, sampleOutput, description } = req.body;

    if (!code || !sampleOutput) {
      return res.status(400).json({
        success: false,
        error: 'code and sampleOutput are required'
      });
    }

    const customAssertion: EnhancedAssertionType = {
      type: 'custom',
      value: code,
      description: description || 'Custom assertion validation'
    };

    const results = await llmService.validateAssertions(sampleOutput, [customAssertion]);
    
    const result = results[0];
    
    res.json({
      success: true,
      data: {
        valid: !result.error,
        result: result.passed,
        error: result.error,
        executionTime: result.executionTime,
        metadata: result.metadata
      }
    });
  } catch (error) {
    console.error('Error validating custom assertion:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get semantic similarity score between two texts
 */
assertionRoutes.post('/semantic-similarity', async (req, res) => {
  try {
    const { text1, text2, threshold } = req.body;

    if (!text1 || !text2) {
      return res.status(400).json({
        success: false,
        error: 'text1 and text2 are required'
      });
    }

    const assertion: EnhancedAssertionType = {
      type: 'semantic-similarity',
      value: text2,
      threshold: threshold || 0.8
    };

    const results = await llmService.validateAssertions(text1, [assertion]);
    const result = results[0];
    
    res.json({
      success: true,
      data: {
        similarity: result.score || 0,
        threshold: threshold || 0.8,
        passed: result.passed,
        metadata: result.metadata
      }
    });
  } catch (error) {
    console.error('Error computing semantic similarity:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Analyze text sentiment
 */
assertionRoutes.post('/sentiment', async (req, res) => {
  try {
    const { text, expectedSentiment, threshold } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'text is required'
      });
    }

    const assertion: EnhancedAssertionType = {
      type: 'sentiment',
      value: expectedSentiment || 'neutral',
      threshold: threshold || 0.6
    };

    const results = await llmService.validateAssertions(text, [assertion]);
    const result = results[0];
    
    res.json({
      success: true,
      data: {
        sentiment: result.metadata?.actualSentiment || 'unknown',
        confidence: result.score || 0,
        expectedSentiment: expectedSentiment || 'neutral',
        passed: result.passed,
        metadata: result.metadata
      }
    });
  } catch (error) {
    console.error('Error analyzing sentiment:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Detect text language
 */
assertionRoutes.post('/language', async (req, res) => {
  try {
    const { text, expectedLanguage } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'text is required'
      });
    }

    const assertion: EnhancedAssertionType = {
      type: 'language',
      value: expectedLanguage || 'en'
    };

    const results = await llmService.validateAssertions(text, [assertion]);
    const result = results[0];
    
    res.json({
      success: true,
      data: {
        detectedLanguage: result.metadata?.detectedLanguage || 'unknown',
        confidence: result.score || 0,
        expectedLanguage: expectedLanguage || 'en',
        passed: result.passed,
        alternatives: result.metadata?.alternatives || []
      }
    });
  } catch (error) {
    console.error('Error detecting language:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Check text toxicity
 */
assertionRoutes.post('/toxicity', async (req, res) => {
  try {
    const { text, maxToxicity } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'text is required'
      });
    }

    const assertion: EnhancedAssertionType = {
      type: 'toxicity',
      value: maxToxicity || 0.5
    };

    const results = await llmService.validateAssertions(text, [assertion]);
    const result = results[0];
    
    res.json({
      success: true,
      data: {
        toxicityScore: result.score || 0,
        maxToxicity: maxToxicity || 0.5,
        passed: result.passed,
        categories: result.metadata?.categories || {},
        isToxic: (result.score || 0) > 0.7
      }
    });
  } catch (error) {
    console.error('Error checking toxicity:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Export assertion type definitions
 */
assertionRoutes.get('/export', async (req, res) => {
  try {
    const exportData = assertionEngine.exportTypes();
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="assertion-types.json"');
    res.send(exportData);
  } catch (error) {
    console.error('Error exporting assertion types:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Import assertion type definitions
 */
assertionRoutes.post('/import', async (req, res) => {
  try {
    const { data } = req.body;

    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'data is required'
      });
    }

    const jsonData = typeof data === 'string' ? data : JSON.stringify(data);
    await assertionEngine.importTypes(jsonData);
    
    res.json({
      success: true,
      message: 'Assertion types imported successfully'
    });
  } catch (error) {
    console.error('Error importing assertion types:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Register a new custom assertion type
 */
assertionRoutes.post('/register', async (req, res) => {
  try {
    const { name, description, validatorCode, parameters, examples } = req.body;

    if (!name || !validatorCode) {
      return res.status(400).json({
        success: false,
        error: 'name and validatorCode are required'
      });
    }

    // Create validator function from code
    const validator = new Function('output', 'assertion', 'context', `
      return (async function() {
        ${validatorCode}
      })();
    `);

    await assertionEngine.registerAssertionType(name, validator as any);
    
    res.json({
      success: true,
      message: `Assertion type '${name}' registered successfully`
    });
  } catch (error) {
    console.error('Error registering assertion type:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Health check for assertion system
 */
assertionRoutes.get('/health', async (req, res) => {
  try {
    const stats = llmService.getAssertionStatistics();
    const types = llmService.getAvailableAssertionTypes();
    
    res.json({
      success: true,
      data: {
        status: 'healthy',
        availableTypes: types.length,
        totalExecutions: stats.totalAssertions,
        systemReady: true
      }
    });
  } catch (error) {
    console.error('Error checking assertion system health:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default assertionRoutes;