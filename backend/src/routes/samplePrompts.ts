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
    
    const initResult = await sampleService.initializeSamplePrompts();
    
    let testCaseStats = null;
    if (includeTestCases && initResult.created > 0) {
      await testCaseService.initializeAllTestCases();
      testCaseStats = testCaseService.getTestCaseStats();
    }
    
    return res.json({
      success: true,
      message: `Sample prompts initialization: ${initResult.created} created, ${initResult.existing} existing, ${initResult.errors.length} errors`,
      data: {
        initResult,
        promptStats: sampleService.getSamplePromptStats(),
        testCaseStats
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

// Advanced search endpoint
router.get('/search', (req: Request, res: Response) => {
  try {
    const { 
      q: query = '', 
      categories, 
      maxResults = '50', 
      fuzzyMatch = 'true' 
    } = req.query;

    const categoriesArray = categories ? 
      (Array.isArray(categories) ? categories : [categories]) as string[] : 
      [];

    const searchOptions = {
      categories: categoriesArray,
      maxResults: parseInt(maxResults as string, 10),
      fuzzyMatch: fuzzyMatch === 'true'
    };

    const results = sampleService.searchSamplePrompts(query as string, searchOptions);
    
    return res.json({
      success: true,
      data: results,
      meta: {
        query: query,
        categories: categoriesArray,
        resultsCount: results.length,
        maxResults: searchOptions.maxResults
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search sample prompts'
    });
  }
});

// Paginated sample prompts endpoint
router.get('/paginated', (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '10',
      category,
      sortBy = 'title',
      sortOrder = 'asc'
    } = req.query;

    const options = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
      category: category as string,
      sortBy: sortBy as 'title' | 'category' | 'variables' | 'created',
      sortOrder: sortOrder as 'asc' | 'desc'
    };

    const result = sampleService.getSamplePromptsPaginated(options);
    
    return res.json({
      success: true,
      data: result.samples,
      meta: result.pagination
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get paginated sample prompts'
    });
  }
});

// Bulk create prompt cards from samples
router.post('/bulk-create', async (req: Request, res: Response) => {
  try {
    const { sampleTitles = [], skipExisting = true } = req.body;
    
    if (!Array.isArray(sampleTitles) || sampleTitles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'sampleTitles array is required and must not be empty'
      });
    }

    const result = await sampleService.bulkCreatePromptsFromSamples(
      sampleTitles, 
      { skipExisting }
    );
    
    return res.json({
      success: true,
      data: result,
      message: `Bulk creation completed: ${result.created.length} created, ${result.skipped.length} skipped, ${result.errors.length} errors`
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to bulk create prompt cards'
    });
  }
});

// Export sample prompts
router.get('/export/:format', (req: Request, res: Response) => {
  try {
    const { format } = req.params;
    const { category, includeStats = 'false' } = req.query;
    
    if (!['json', 'yaml', 'csv'].includes(format)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid format. Supported formats: json, yaml, csv'
      });
    }

    const options = {
      category: category as string,
      includeStats: includeStats === 'true'
    };

    const exportData = sampleService.exportSamplePrompts(format as 'json' | 'yaml' | 'csv', options);
    
    // Set appropriate content type and headers
    const contentTypes = {
      json: 'application/json',
      yaml: 'text/yaml',
      csv: 'text/csv'
    };
    
    const filename = `sample-prompts-${category || 'all'}-${new Date().toISOString().split('T')[0]}.${format}`;
    
    res.setHeader('Content-Type', contentTypes[format as keyof typeof contentTypes]);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    return res.send(exportData);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to export sample prompts'
    });
  }
});

// Get template complexity analysis
router.get('/:title/complexity', (req: Request, res: Response) => {
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

    const complexity = sampleService.getTemplateComplexity(sample);
    
    return res.json({
      success: true,
      data: {
        title: sample.title,
        complexity
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze template complexity'
    });
  }
});

// Validate all sample prompts
router.get('/validation/report', (req: Request, res: Response) => {
  try {
    const report = sampleService.validateAllSamplePrompts();
    
    return res.json({
      success: true,
      data: report,
      message: `Validation complete: ${report.valid} valid, ${report.invalid} invalid`
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to validate sample prompts'
    });
  }
});

export { router as samplePromptRoutes };