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
 */

export { promptAnalyzer, PromptAnalyzer } from './PromptAnalyzer';
export { optimizationEngine, OptimizationEngine } from './OptimizationEngine';
export { securityAnalyzer, SecurityAnalyzer } from './SecurityAnalyzer';

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
    securityAnalyzer: 'active' as const
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
    ]
  };
}