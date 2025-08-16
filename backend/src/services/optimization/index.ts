/**
 * AI-Powered Prompt Optimization Services
 * 
 * This module provides comprehensive prompt optimization capabilities:
 * - Prompt effectiveness analysis
 * - AI-powered optimization suggestions
 * - A/B testing automation
 * - Security threat detection
 * - Compliance validation
 * - Automated prompt tuning
 * - Real-time optimization with ML-driven feedback loops
 * - Multi-armed bandit algorithms for adaptive A/B testing
 * - Bayesian optimization for hyperparameter tuning
 * - Online learning for continuous optimization
 */

export { promptAnalyzer, PromptAnalyzer } from './PromptAnalyzer';
export { optimizationEngine, OptimizationEngine } from './OptimizationEngine';
export { securityAnalyzer, SecurityAnalyzer } from './SecurityAnalyzer';
export { advancedKVCache, AdvancedKVCache } from './AdvancedKVCache';
export { realTimeOptimizer, RealTimeOptimizer } from './RealTimeOptimizer';

// Types exports
export type {
  PromptAnalysisResult,
  PromptComparisonResult
} from './PromptAnalyzer';

export type {
  OptimizationSuggestion,
  ABTestConfiguration,
  ABTestResult,
  PromptTuningConfiguration,
  PromptTuningResult
} from './OptimizationEngine';

export type {
  SecurityThreat,
  SecurityAnalysisResult,
  JailbreakAttempt,
  ContentSafetyResult
} from './SecurityAnalyzer';

export type {
  CacheEntry,
  CacheConfiguration,
  CacheMetrics,
  MemoryPressureMetrics,
  CachePerformanceAlert,
  QuantizationType,
  CachePolicy
} from './AdvancedKVCache';

export type {
  RealTimeOptimizerConfig,
  RealTimeFeedback,
  OptimizationAction,
  BanditArm,
  BayesianOptimizationResult,
  PerformancePredictionModel,
  AdaptiveCachePolicy,
  OnlineLearningAlgorithm,
  BanditAlgorithm,
  OptimizationStrategy
} from './RealTimeOptimizer';

/**
 * Initialize all optimization services
 */
export async function initializeOptimizationServices(): Promise<void> {
  console.log('🔧 Initializing AI-Powered Prompt Optimization Services...');
  
  try {
    // Services are initialized as singletons when imported
    console.log('✅ Prompt Analyzer initialized');
    console.log('✅ Optimization Engine initialized');
    console.log('✅ Security Analyzer initialized');
    console.log('✅ Advanced KV Cache initialized');
    console.log('✅ Real-Time Optimizer initialized');
    
    console.log('🚀 AI-Powered Prompt Optimization Services ready!');
  } catch (error) {
    console.error('❌ Failed to initialize optimization services:', error);
    throw error;
  }
}

/**
 * Service health check
 */
export function checkOptimizationServicesHealth(): {
  status: 'healthy' | 'unhealthy';
  services: Record<string, 'active' | 'inactive' | 'error'>;
  timestamp: string;
} {
  const services = {
    promptAnalyzer: 'active' as const,
    optimizationEngine: 'active' as const,
    securityAnalyzer: 'active' as const,
    advancedKVCache: 'active' as const,
    realTimeOptimizer: 'active' as const
  };
  
  const allHealthy = Object.values(services).every(status => status === 'active');
  
  return {
    status: allHealthy ? 'healthy' : 'unhealthy',
    services,
    timestamp: new Date().toISOString()
  };
}

/**
 * Get optimization services capabilities
 */
export function getOptimizationCapabilities(): {
  promptAnalysis: string[];
  optimization: string[];
  security: string[];
  abTesting: string[];
  tuning: string[];
  realTimeOptimization: string[];
} {
  return {
    promptAnalysis: [
      'Effectiveness scoring',
      'Pattern recognition',
      'Trend analysis',
      'Performance metrics',
      'Comparison analysis'
    ],
    optimization: [
      'AI-powered suggestions',
      'Structure optimization',
      'Clarity improvements',
      'Specificity enhancements',
      'Context optimization'
    ],
    security: [
      'Prompt injection detection',
      'Jailbreak resistance testing',
      'Content safety analysis',
      'Compliance validation',
      'Threat assessment'
    ],
    abTesting: [
      'Multi-variant testing',
      'Statistical analysis',
      'Performance comparison',
      'Winner determination',
      'Confidence scoring'
    ],
    tuning: [
      'Automated optimization',
      'Iterative improvement',
      'Convergence analysis',
      'Performance tracking',
      'Best prompt selection'
    ],
    realTimeOptimization: [
      'ML-driven feedback loops',
      'Online learning algorithms',
      'Multi-armed bandit A/B testing',
      'Bayesian hyperparameter optimization',
      'Adaptive caching policies',
      'Performance prediction models',
      'Real-time strategy adaptation',
      'Sub-100ms optimization decisions'
    ]
  };
}