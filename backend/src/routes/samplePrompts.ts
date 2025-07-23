import { Router, Request, Response } from 'express';
import { SamplePromptService } from '../services/SamplePromptService';
import { SampleTestCaseService } from '../services/SampleTestCaseService';

const router = Router();
const sampleService = SamplePromptService.getInstance();
const testCaseService = SampleTestCaseService.getInstance();

// Get all sample prompts
router.get('/', (req: Request, res: Response) => {
  try {
    const category = req.query.category as string;
    
    let samples;
    if (category) {
      samples = sampleService.getSamplePromptsByCategory(category);
    } else {
      samples = sampleService.getSamplePrompts();
    }

    return res.json({
      success: true,
      data: samples,
      meta: {
        total: samples.length,
        category: category || 'all'
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch sample prompts'
    });
  }
});

// Get sample prompt categories
router.get('/categories', (req: Request, res: Response) => {
  try {
    const categories = sampleService.getCategories();
    
    return res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch categories'
    });
  }
});

// Get sample prompt statistics
router.get('/stats', (req: Request, res: Response) => {
  try {
    const stats = sampleService.getSamplePromptStats();
    
    return res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch statistics'
    });
  }
});

// Get specific sample prompt preview
router.get('/:title/preview', (req: Request, res: Response) => {
  try {
    const { title } = req.params;
    const decodedTitle = decodeURIComponent(title);
    
    const sample = sampleService.getSamplePromptPreview(decodedTitle);
    
    if (!sample) {
      return res.status(404).json({
        success: false,
        error: 'Sample prompt not found'
      });
    }

    // Validate the sample
    const validation = sampleService.validateSamplePrompt(sample);
    
    return res.json({
      success: true,
      data: {
        ...sample,
        validation
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch sample prompt'
    });
  }
});

// Create prompt card from sample with test cases
router.post('/:title/create', async (req: Request, res: Response) => {
  try {
    const { title } = req.params;
    const { includeTestCases = true } = req.body;
    const decodedTitle = decodeURIComponent(title);
    
    const promptCard = await sampleService.createPromptFromSample(decodedTitle);
    
    if (!promptCard) {
      return res.status(404).json({
        success: false,
        error: 'Sample prompt not found'
      });
    }

    let testCases = [];
    if (includeTestCases) {
      testCases = await testCaseService.createTestCasesForPrompt(promptCard.id, decodedTitle);
    }

    return res.status(201).json({
      success: true,
      data: {
        ...promptCard,
        test_cases: testCases
      },
      message: `Prompt card created successfully from sample${includeTestCases ? ' with test cases' : ''}`
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create prompt card from sample'
    });
  }
});

// Initialize sample prompts in database
router.post('/initialize', async (req: Request, res: Response) => {
  try {
    const { includeTestCases = true } = req.body;
    
    await sampleService.initializeSamplePrompts();
    
    if (includeTestCases) {
      await testCaseService.initializeAllTestCases();
    }
    
    return res.json({
      success: true,
      message: `Sample prompts initialized successfully${includeTestCases ? ' with test cases' : ''}`,
      data: {
        promptStats: sampleService.getSamplePromptStats(),
        testCaseStats: includeTestCases ? testCaseService.getTestCaseStats() : null
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initialize sample prompts'
    });
  }
});

// Validate sample prompt
router.post('/validate', (req: Request, res: Response) => {
  try {
    const samplePrompt = req.body;
    
    if (!samplePrompt) {
      return res.status(400).json({
        success: false,
        error: 'Sample prompt data is required'
      });
    }

    const validation = sampleService.validateSamplePrompt(samplePrompt);
    
    return res.json({
      success: true,
      data: validation
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to validate sample prompt'
    });
  }
});

// Get test case templates for a prompt
router.get('/:title/test-cases', (req: Request, res: Response) => {
  try {
    const { title } = req.params;
    const decodedTitle = decodeURIComponent(title);
    
    const testCases = testCaseService.getTestCaseTemplatesForPrompt(decodedTitle);
    
    return res.json({
      success: true,
      data: testCases,
      meta: {
        prompt: decodedTitle,
        testCaseCount: testCases.length
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch test case templates'
    });
  }
});

// Get test case statistics
router.get('/test-cases/stats', (req: Request, res: Response) => {
  try {
    const stats = testCaseService.getTestCaseStats();
    
    return res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch test case statistics'
    });
  }
});

export { router as samplePromptRoutes };