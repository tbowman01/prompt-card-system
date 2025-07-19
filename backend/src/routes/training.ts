import express from 'express';
import { modelTrainingEngine } from '../services/training/ModelTrainingEngine';
import { modelRegistry } from '../services/training/ModelRegistry';
import { validation } from '../middleware/validation';
import Joi from 'joi';

const router = express.Router();

// Validation schemas
const trainingConfigSchema = Joi.object({
  name: Joi.string().required().min(1).max(100),
  model: Joi.string().required(),
  trainingData: Joi.object({
    source: Joi.string().valid('file', 'database', 'api', 'synthetic').required(),
    path: Joi.string().when('source', { is: 'file', then: Joi.required() }),
    query: Joi.string().when('source', { is: 'database', then: Joi.required() }),
    endpoint: Joi.string().when('source', { is: 'api', then: Joi.required() }),
    format: Joi.string().valid('jsonl', 'csv', 'txt', 'parquet').required(),
    validation_split: Joi.number().min(0.1).max(0.9).required()
  }).required(),
  hyperparameters: Joi.object({
    learning_rate: Joi.number().min(0.00001).max(1).required(),
    batch_size: Joi.number().integer().min(1).max(1024).required(),
    epochs: Joi.number().integer().min(1).max(1000).required(),
    warmup_steps: Joi.number().integer().min(0).default(0),
    weight_decay: Joi.number().min(0).max(1).default(0.01),
    dropout_rate: Joi.number().min(0).max(1).default(0.1),
    gradient_clip_norm: Joi.number().min(0).default(1.0)
  }).required(),
  optimization: Joi.object({
    optimizer: Joi.string().valid('adam', 'adamw', 'sgd', 'rmsprop').default('adamw'),
    scheduler: Joi.string().valid('linear', 'cosine', 'exponential', 'polynomial').default('linear'),
    early_stopping: Joi.object({
      enabled: Joi.boolean().default(true),
      patience: Joi.number().integer().min(1).default(5),
      metric: Joi.string().default('validation_loss'),
      min_delta: Joi.number().min(0).default(0.001)
    }).default()
  }).default(),
  evaluation: Joi.object({
    metrics: Joi.array().items(Joi.string()).default(['accuracy', 'f1_score']),
    benchmark_datasets: Joi.array().items(Joi.string()).default([]),
    validation_frequency: Joi.number().integer().min(1).default(1),
    save_best_model: Joi.boolean().default(true)
  }).default(),
  resources: Joi.object({
    gpu_memory_limit: Joi.number().integer().min(1),
    cpu_cores: Joi.number().integer().min(1),
    memory_limit: Joi.number().integer().min(1),
    storage_limit: Joi.number().integer().min(1)
  }).default({}),
  deployment: Joi.object({
    auto_deploy: Joi.boolean().default(false),
    deployment_target: Joi.string().valid('ollama', 'huggingface', 'local', 'cloud').default('local'),
    rollback_on_failure: Joi.boolean().default(true),
    health_check_enabled: Joi.boolean().default(true)
  }).default(),
  metadata: Joi.object({
    description: Joi.string().default(''),
    tags: Joi.array().items(Joi.string()).default([]),
    base_model: Joi.string(),
    training_objective: Joi.string().default('general_improvement')
  }).default()
});

const syntheticDataSchema = Joi.object({
  template_prompts: Joi.array().items(Joi.string()).min(1).required(),
  generation_config: Joi.object({
    num_samples: Joi.number().integer().min(1).max(100000).required(),
    temperature: Joi.number().min(0).max(2).default(0.7),
    max_tokens: Joi.number().integer().min(10).max(4096).default(512),
    diversity_penalty: Joi.number().min(0).max(2).default(0.5),
    quality_filter: Joi.boolean().default(true)
  }).required(),
  output_format: Joi.string().valid('jsonl', 'csv', 'txt').default('jsonl')
});

const modelRegistrationSchema = Joi.object({
  name: Joi.string().required().min(1).max(100),
  version: Joi.string().required(),
  description: Joi.string().required(),
  author: Joi.string().required(),
  license: Joi.string().required(),
  tags: Joi.array().items(Joi.string()).default([]),
  model_type: Joi.string().valid('foundation', 'fine_tuned', 'specialized', 'custom').required(),
  base_model: Joi.string(),
  training_job_id: Joi.string(),
  size_mb: Joi.number().integer().min(1).required(),
  parameter_count: Joi.number().integer().min(1).required(),
  architecture: Joi.object({
    model_family: Joi.string().required(),
    layers: Joi.number().integer().min(1).required(),
    hidden_size: Joi.number().integer().min(1).required(),
    attention_heads: Joi.number().integer().min(1).required(),
    vocab_size: Joi.number().integer().min(1).required(),
    max_sequence_length: Joi.number().integer().min(1).required()
  }).required(),
  capabilities: Joi.object({
    text_generation: Joi.boolean().default(false),
    text_classification: Joi.boolean().default(false),
    question_answering: Joi.boolean().default(false),
    summarization: Joi.boolean().default(false),
    code_generation: Joi.boolean().default(false),
    embedding_generation: Joi.boolean().default(false),
    multimodal: Joi.boolean().default(false)
  }).default(),
  performance_metrics: Joi.object({
    accuracy: Joi.number().min(0).max(1),
    f1_score: Joi.number().min(0).max(1),
    bleu_score: Joi.number().min(0).max(1),
    rouge_score: Joi.number().min(0).max(1),
    perplexity: Joi.number().min(1),
    inference_latency_ms: Joi.number().min(0).required(),
    throughput_tokens_per_sec: Joi.number().min(0).required(),
    memory_usage_mb: Joi.number().min(0).required()
  }).required(),
  file_path: Joi.string(),
  config_path: Joi.string(),
  tokenizer_path: Joi.string()
});

const modelSearchSchema = Joi.object({
  query: Joi.string().allow(''),
  filters: Joi.object({
    model_type: Joi.array().items(Joi.string().valid('foundation', 'fine_tuned', 'specialized', 'custom')),
    capabilities: Joi.array().items(Joi.string()),
    size_range: Joi.object({
      min_mb: Joi.number().integer().min(0),
      max_mb: Joi.number().integer().min(0)
    }),
    performance_threshold: Joi.object().pattern(Joi.string(), Joi.number()),
    deployment_status: Joi.array().items(Joi.string().valid('pending', 'deployed', 'deprecated', 'failed')),
    tags: Joi.array().items(Joi.string()),
    created_after: Joi.date().iso(),
    created_before: Joi.date().iso()
  }).default({}),
  sort_by: Joi.string().valid('name', 'created_at', 'size_mb', 'performance', 'usage').default('created_at'),
  sort_order: Joi.string().valid('asc', 'desc').default('desc'),
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0)
});

/**
 * @route POST /api/training/jobs
 * @desc Create a new training job
 */
router.post('/jobs', validation(trainingConfigSchema), async (req, res) => {
  try {
    const job = await modelTrainingEngine.createTrainingJob(req.body);
    
    res.status(201).json({
      success: true,
      data: {
        job_id: job.id,
        status: job.status,
        config: job.config,
        created_at: job.config.metadata.created_at
      }
    });
  } catch (error) {
    console.error('Error creating training job:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create training job'
    });
  }
});

/**
 * @route POST /api/training/jobs/:jobId/start
 * @desc Start a training job
 */
router.post('/jobs/:jobId/start', async (req, res) => {
  try {
    const { jobId } = req.params;
    await modelTrainingEngine.startTrainingJob(jobId);
    
    res.json({
      success: true,
      message: `Training job ${jobId} started successfully`
    });
  } catch (error) {
    console.error('Error starting training job:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start training job'
    });
  }
});

/**
 * @route GET /api/training/jobs/:jobId
 * @desc Get training job details
 */
router.get('/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = modelTrainingEngine.getTrainingJob(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Training job not found'
      });
    }
    
    res.json({
      success: true,
      data: job
    });
  } catch (error) {
    console.error('Error getting training job:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get training job'
    });
  }
});

/**
 * @route GET /api/training/jobs
 * @desc List training jobs with filters
 */
router.get('/jobs', async (req, res) => {
  try {
    const filters: any = {};
    
    if (req.query.status) filters.status = req.query.status as string;
    if (req.query.model) filters.model = req.query.model as string;
    if (req.query.created_after) filters.created_after = new Date(req.query.created_after as string);
    if (req.query.created_before) filters.created_before = new Date(req.query.created_before as string);
    
    const jobs = modelTrainingEngine.listTrainingJobs(filters);
    
    res.json({
      success: true,
      data: {
        jobs,
        total_count: jobs.length
      }
    });
  } catch (error) {
    console.error('Error listing training jobs:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list training jobs'
    });
  }
});

/**
 * @route POST /api/training/jobs/:jobId/cancel
 * @desc Cancel a training job
 */
router.post('/jobs/:jobId/cancel', async (req, res) => {
  try {
    const { jobId } = req.params;
    await modelTrainingEngine.cancelTrainingJob(jobId);
    
    res.json({
      success: true,
      message: `Training job ${jobId} cancelled successfully`
    });
  } catch (error) {
    console.error('Error cancelling training job:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel training job'
    });
  }
});

/**
 * @route POST /api/training/synthetic-data
 * @desc Generate synthetic training data
 */
router.post('/synthetic-data', validation(syntheticDataSchema), async (req, res) => {
  try {
    const outputPath = await modelTrainingEngine.generateSyntheticData(req.body);
    
    res.json({
      success: true,
      data: {
        output_path: outputPath,
        generation_config: req.body.generation_config,
        template_count: req.body.template_prompts.length
      }
    });
  } catch (error) {
    console.error('Error generating synthetic data:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate synthetic data'
    });
  }
});

/**
 * @route POST /api/training/evaluate/:modelName
 * @desc Evaluate model performance
 */
router.post('/evaluate/:modelName', async (req, res) => {
  try {
    const { modelName } = req.params;
    const { benchmark_datasets = [], custom_metrics = [] } = req.body;
    
    const evaluation = await modelTrainingEngine.evaluateModel(
      modelName,
      benchmark_datasets,
      custom_metrics
    );
    
    res.json({
      success: true,
      data: evaluation
    });
  } catch (error) {
    console.error('Error evaluating model:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to evaluate model'
    });
  }
});

/**
 * @route POST /api/training/deploy/:modelVersionId
 * @desc Deploy a trained model
 */
router.post('/deploy/:modelVersionId', async (req, res) => {
  try {
    const { modelVersionId } = req.params;
    const {
      target = 'local',
      auto_rollback = true,
      health_check_timeout = 30000,
      deployment_tags = []
    } = req.body;
    
    const deployment = await modelTrainingEngine.deployModel(
      modelVersionId,
      target,
      {
        auto_rollback,
        health_check_timeout,
        deployment_tags
      }
    );
    
    res.json({
      success: true,
      data: deployment
    });
  } catch (error) {
    console.error('Error deploying model:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to deploy model'
    });
  }
});

/**
 * @route GET /api/training/statistics
 * @desc Get training system statistics
 */
router.get('/statistics', async (req, res) => {
  try {
    const stats = modelTrainingEngine.getTrainingStatistics();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting training statistics:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get training statistics'
    });
  }
});

// Model Registry Routes

/**
 * @route POST /api/training/models
 * @desc Register a new model
 */
router.post('/models', validation(modelRegistrationSchema), async (req, res) => {
  try {
    const model = await modelRegistry.registerModel(req.body);
    
    res.status(201).json({
      success: true,
      data: model
    });
  } catch (error) {
    console.error('Error registering model:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to register model'
    });
  }
});

/**
 * @route GET /api/training/models/:modelId
 * @desc Get model details
 */
router.get('/models/:modelId', async (req, res) => {
  try {
    const { modelId } = req.params;
    const model = modelRegistry.getModel(modelId);
    
    if (!model) {
      return res.status(404).json({
        success: false,
        error: 'Model not found'
      });
    }
    
    res.json({
      success: true,
      data: model
    });
  } catch (error) {
    console.error('Error getting model:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get model'
    });
  }
});

/**
 * @route POST /api/training/models/search
 * @desc Search models with filters
 */
router.post('/models/search', validation(modelSearchSchema), async (req, res) => {
  try {
    const searchResult = modelRegistry.searchModels(req.body);
    
    res.json({
      success: true,
      data: searchResult
    });
  } catch (error) {
    console.error('Error searching models:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search models'
    });
  }
});

/**
 * @route POST /api/training/models/compare
 * @desc Compare two models
 */
router.post('/models/compare', async (req, res) => {
  try {
    const { model_a_id, model_b_id } = req.body;
    
    if (!model_a_id || !model_b_id) {
      return res.status(400).json({
        success: false,
        error: 'Both model_a_id and model_b_id are required'
      });
    }
    
    const comparison = await modelRegistry.compareModels(model_a_id, model_b_id);
    
    res.json({
      success: true,
      data: comparison
    });
  } catch (error) {
    console.error('Error comparing models:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to compare models'
    });
  }
});

/**
 * @route GET /api/training/models/:modelId/usage
 * @desc Get model usage statistics
 */
router.get('/models/:modelId/usage', async (req, res) => {
  try {
    const { modelId } = req.params;
    const timeRange = req.query.start && req.query.end ? {
      start: new Date(req.query.start as string),
      end: new Date(req.query.end as string)
    } : undefined;
    
    const usage = modelRegistry.getModelUsageStats(modelId, timeRange);
    
    res.json({
      success: true,
      data: usage
    });
  } catch (error) {
    console.error('Error getting model usage:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get model usage'
    });
  }
});

/**
 * @route GET /api/training/models/:modelId/versions
 * @desc Get model version history
 */
router.get('/models/:modelId/versions', async (req, res) => {
  try {
    const { modelId } = req.params;
    const versions = modelRegistry.getModelVersionHistory(modelId);
    
    res.json({
      success: true,
      data: {
        model_id: modelId,
        versions,
        total_versions: versions.length
      }
    });
  } catch (error) {
    console.error('Error getting model versions:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get model versions'
    });
  }
});

/**
 * @route PUT /api/training/models/:modelId
 * @desc Update model metadata
 */
router.put('/models/:modelId', async (req, res) => {
  try {
    const { modelId } = req.params;
    const updatedModel = await modelRegistry.updateModel(modelId, req.body);
    
    res.json({
      success: true,
      data: updatedModel
    });
  } catch (error) {
    console.error('Error updating model:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update model'
    });
  }
});

/**
 * @route DELETE /api/training/models/:modelId
 * @desc Delete a model
 */
router.delete('/models/:modelId', async (req, res) => {
  try {
    const { modelId } = req.params;
    const force = req.query.force === 'true';
    
    await modelRegistry.deleteModel(modelId, force);
    
    res.json({
      success: true,
      message: `Model ${modelId} deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting model:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete model'
    });
  }
});

/**
 * @route GET /api/training/registry/statistics
 * @desc Get model registry statistics
 */
router.get('/registry/statistics', async (req, res) => {
  try {
    const stats = modelRegistry.getRegistryStatistics();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting registry statistics:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get registry statistics'
    });
  }
});

/**
 * @route GET /api/training/health
 * @desc Health check for training system
 */
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date(),
      components: {
        training_engine: 'healthy',
        model_registry: 'healthy',
        tensorflow: 'healthy'
      },
      statistics: {
        active_jobs: modelTrainingEngine.listTrainingJobs({ status: 'training' }).length,
        total_models: modelRegistry.getRegistryStatistics().total_models,
        system_load: process.cpuUsage(),
        memory_usage: process.memoryUsage()
      }
    };
    
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    console.error('Error getting training health:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Training system health check failed'
    });
  }
});

export default router;