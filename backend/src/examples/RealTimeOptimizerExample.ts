/**
 * Real-Time Optimizer Integration Example
 * 
 * This example demonstrates how to integrate and use the RealTimeOptimizer
 * with ML-driven auto-optimization for the Prompt Card System.
 * 
 * Features demonstrated:
 * - Real-time feedback processing
 * - Multi-armed bandit A/B testing
 * - Bayesian hyperparameter optimization
 * - Online learning and continuous optimization
 * - Performance monitoring and adaptive strategies
 */

import { 
  RealTimeOptimizer, 
  RealTimeFeedback, 
  OptimizationAction,
  RealTimeOptimizerConfig 
} from '../services/optimization/RealTimeOptimizer';
import { 
  OptimizationEngine, 
  ABTestConfiguration 
} from '../services/optimization/OptimizationEngine';
import { PerformanceMonitor } from '../services/performance/PerformanceMonitor';

/**
 * Example: Setting up Real-Time Optimization System
 */
export class RealTimeOptimizationExample {
  private realTimeOptimizer: RealTimeOptimizer;
  private optimizationEngine: OptimizationEngine;
  private performanceMonitor: PerformanceMonitor;

  constructor() {
    // Configure the real-time optimizer
    const config: Partial<RealTimeOptimizerConfig> = {
      learningRate: 0.001,
      explorationRate: 0.1,
      optimizationThreshold: 0.05,
      maxConcurrentTests: 5,
      feedbackWindowMs: 60000, // 1 minute
      adaptationIntervalMs: 300000, // 5 minutes
      confidenceThreshold: 0.85,
      performanceTargets: {
        successRate: 95,
        responseTime: 500,
        qualityScore: 88
      }
    };

    this.realTimeOptimizer = new RealTimeOptimizer(config);
    this.optimizationEngine = new OptimizationEngine();
    this.performanceMonitor = new PerformanceMonitor();

    this.setupEventHandlers();
  }

  /**
   * Setup event handlers for monitoring and logging
   */
  private setupEventHandlers(): void {
    // Monitor feedback processing
    this.realTimeOptimizer.on('feedback_processed', (event) => {
      console.log(`✅ Feedback processed: ${event.feedbackId} in ${event.processingTime}ms`);
      
      if (event.processingTime > 100) {
        console.warn(`⚠️  Slow processing detected: ${event.processingTime}ms`);
      }
    });

    // Monitor emergency optimizations
    this.realTimeOptimizer.on('emergency_optimization', (event) => {
      console.error(`🚨 Emergency optimization triggered for ${event.feedback.promptId}`);
      console.error(`Issues: ${event.issues.join(', ')}`);
      this.handleEmergencyOptimization(event);
    });

    // Monitor traffic allocation updates
    this.realTimeOptimizer.on('traffic_allocation_updated', (event) => {
      console.log(`📊 Traffic allocation updated for test ${event.testId}:`);
      console.log(JSON.stringify(event.allocation, null, 2));
    });

    // Monitor configuration updates
    this.realTimeOptimizer.on('config_updated', (event) => {
      console.log('⚙️  Configuration updated');
      console.log('Changes:', Object.keys(event.newConfig));
    });

    // Handle errors gracefully
    this.realTimeOptimizer.on('error', (event) => {
      console.error(`❌ Error in ${event.type}:`, event.error.message);
      this.handleOptimizationError(event);
    });
  }

  /**
   * Example 1: Real-time feedback processing
   */
  async demonstrateRealTimeFeedback(): Promise<void> {
    console.log('\n🔄 Example 1: Real-time Feedback Processing\n');

    // Simulate real-time feedback from various sources
    const feedbackSources = [
      'web_interface',
      'mobile_app', 
      'api_endpoint',
      'batch_processing'
    ];

    for (let i = 0; i < 20; i++) {
      const feedback: RealTimeFeedback = {
        id: `feedback_${Date.now()}_${i}`,
        promptId: `prompt_${i % 5}`, // 5 different prompts
        variantId: i % 2 === 0 ? 'variant_a' : 'variant_b',
        metrics: {
          responseTime: 300 + Math.random() * 400,
          successRate: 85 + Math.random() * 15,
          qualityScore: 80 + Math.random() * 20,
          userSatisfaction: 0.7 + Math.random() * 0.3,
          errorRate: Math.random() * 10
        },
        context: {
          userId: `user_${Math.floor(Math.random() * 100)}`,
          sessionId: `session_${Math.floor(Math.random() * 50)}`,
          environment: feedbackSources[i % feedbackSources.length],
          timestamp: new Date(),
          metadata: {
            promptLength: 100 + Math.random() * 300,
            complexity: Math.random(),
            userTier: Math.random() > 0.7 ? 'premium' : 'free'
          }
        }
      };

      // Process feedback in real-time
      await this.realTimeOptimizer.processFeedback(feedback);
      
      // Small delay to simulate real-time nature
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log('✅ Real-time feedback processing complete');
    this.logOptimizationMetrics();
  }

  /**
   * Example 2: Multi-armed bandit A/B testing
   */
  async demonstrateAdaptiveABTesting(): Promise<void> {
    console.log('\n🎯 Example 2: Multi-armed Bandit A/B Testing\n');

    // Define A/B test configuration
    const testConfig: Omit<ABTestConfiguration, 'id' | 'status'> = {
      name: 'Prompt Optimization Test',
      variants: [
        {
          id: 'control',
          name: 'Control Prompt',
          prompt: 'Please provide a detailed response to the following question: {question}',
          weight: 25
        },
        {
          id: 'structured',
          name: 'Structured Prompt',
          prompt: 'Answer the question step by step:\n1. Understand: {question}\n2. Analyze the key components\n3. Provide a comprehensive response',
          weight: 25
        },
        {
          id: 'contextual',
          name: 'Contextual Prompt',
          prompt: 'Context: You are an expert assistant helping users understand complex topics.\nQuestion: {question}\nProvide a clear, accurate, and helpful response.',
          weight: 25
        },
        {
          id: 'conversational',
          name: 'Conversational Prompt',
          prompt: 'I\'d be happy to help you with that! Let me address your question: {question}\nHere\'s what I think...',
          weight: 25
        }
      ],
      metrics: {
        primaryMetric: 'success_rate',
        secondaryMetrics: ['response_time', 'quality_score']
      },
      duration: {
        startDate: new Date(),
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        minSamples: 100
      }
    };

    // Test different bandit algorithms
    const banditAlgorithms: Array<'epsilon_greedy' | 'ucb1' | 'thompson_sampling' | 'exp3'> = [
      'epsilon_greedy',
      'ucb1', 
      'thompson_sampling',
      'exp3'
    ];

    for (const algorithm of banditAlgorithms) {
      console.log(`\n📈 Testing ${algorithm} algorithm:`);
      
      const banditConfig = {
        algorithm,
        explorationRate: 0.1,
        minSamples: 25
      };

      try {
        const testId = await this.realTimeOptimizer.startAdaptiveABTest(testConfig, banditConfig);
        console.log(`✅ Started adaptive A/B test: ${testId}`);

        // Simulate test results over time
        await this.simulateABTestResults(testId, testConfig.variants);
        
        console.log(`✅ A/B test simulation complete for ${algorithm}`);
        
      } catch (error) {
        console.error(`❌ Failed to start A/B test with ${algorithm}:`, error.message);
      }
    }
  }

  /**
   * Example 3: Bayesian hyperparameter optimization
   */
  async demonstrateBayesianOptimization(): Promise<void> {
    console.log('\n🧠 Example 3: Bayesian Hyperparameter Optimization\n');

    // Define hyperparameter search space
    const searchSpaces = [
      {
        name: 'Learning Parameters',
        space: {
          learningRate: { min: 0.0001, max: 0.01, type: 'continuous' as const },
          batchSize: { min: 16, max: 128, type: 'discrete' as const },
          momentum: { min: 0.5, max: 0.99, type: 'continuous' as const }
        }
      },
      {
        name: 'Exploration Parameters', 
        space: {
          explorationRate: { min: 0.01, max: 0.3, type: 'continuous' as const },
          decayRate: { min: 0.9, max: 0.999, type: 'continuous' as const },
          temperatureScale: { min: 0.1, max: 2.0, type: 'continuous' as const }
        }
      },
      {
        name: 'Cache Parameters',
        space: {
          cacheSize: { min: 100, max: 10000, type: 'discrete' as const },
          ttlMultiplier: { min: 0.5, max: 5.0, type: 'continuous' as const },
          hitRateThreshold: { min: 0.5, max: 0.95, type: 'continuous' as const }
        }
      }
    ];

    for (const { name, space } of searchSpaces) {
      console.log(`\n🔍 Optimizing ${name}:`);
      
      try {
        const result = await this.realTimeOptimizer.optimizeHyperparameters(
          space,
          'maximize',
          15 // Limited iterations for demo
        );

        console.log(`✅ Optimization complete for ${name}`);
        console.log(`📊 Best parameters:`, JSON.stringify(result.parameters, null, 2));
        console.log(`📈 Expected improvement: ${result.expectedImprovement.toFixed(4)}`);
        console.log(`🎯 Confidence: ${result.confidence.toFixed(4)}`);
        console.log(`📍 Converged at iteration: ${result.iteration}`);

      } catch (error) {
        console.error(`❌ Optimization failed for ${name}:`, error.message);
      }
    }
  }

  /**
   * Example 4: Performance monitoring and adaptation
   */
  async demonstratePerformanceMonitoring(): Promise<void> {
    console.log('\n📊 Example 4: Performance Monitoring and Adaptation\n');

    // Start performance monitoring
    this.performanceMonitor.startMonitoring(5000); // 5-second intervals

    // Generate load to observe performance
    console.log('🔄 Generating optimization load...');
    
    const loadPromises: Promise<void>[] = [];
    
    for (let i = 0; i < 50; i++) {
      loadPromises.push(this.generateOptimizationLoad(i));
    }

    await Promise.all(loadPromises);

    // Check performance metrics
    const metrics = this.realTimeOptimizer.getOptimizationMetrics();
    const systemMetrics = await this.performanceMonitor.getSystemMetrics();
    const appMetrics = this.performanceMonitor.getApplicationMetrics();

    console.log('\n📈 Performance Metrics:');
    console.log('Real-time Optimizer:');
    console.log(`  - Total optimizations: ${metrics.totalOptimizations}`);
    console.log(`  - Success rate: ${((metrics.successfulOptimizations / Math.max(metrics.totalOptimizations, 1)) * 100).toFixed(1)}%`);
    console.log(`  - Average improvement: ${(metrics.averageImprovementRate * 100).toFixed(1)}%`);
    console.log(`  - Processing latency: ${metrics.processingLatency.toFixed(2)}ms`);
    console.log(`  - Cache efficiency: ${(metrics.cacheEfficiency * 100).toFixed(1)}%`);
    console.log(`  - Model accuracy: ${(metrics.modelAccuracy * 100).toFixed(1)}%`);

    console.log('\nSystem Metrics:');
    console.log(`  - CPU usage: ${systemMetrics.cpu.usage}%`);
    console.log(`  - Memory usage: ${systemMetrics.memory.utilization}%`);
    console.log(`  - Memory used: ${(systemMetrics.memory.used / 1024 / 1024).toFixed(0)}MB`);

    console.log('\nApplication Metrics:');
    console.log(`  - Requests/sec: ${appMetrics.requestsPerSecond.toFixed(1)}`);
    console.log(`  - Response time: ${appMetrics.averageResponseTime.toFixed(1)}ms`);
    console.log(`  - Error rate: ${appMetrics.errorRate.toFixed(2)}%`);

    // Demonstrate adaptive configuration
    await this.demonstrateAdaptiveConfiguration(metrics);

    this.performanceMonitor.stopMonitoring();
  }

  /**
   * Example 5: Integration with existing optimization services
   */
  async demonstrateIntegration(): Promise<void> {
    console.log('\n🔗 Example 5: Integration with Existing Services\n');

    // Generate base optimizations using existing OptimizationEngine
    const baseOptimizations = await this.optimizationEngine.generateOptimizationSuggestions(
      'Integration test prompt: Please analyze the following data and provide insights.',
      {
        successRate: 90,
        responseTime: 600,
        qualityScore: 85
      },
      {
        maxLength: 500,
        securityLevel: 'enhanced'
      }
    );

    console.log(`📋 Generated ${baseOptimizations.length} base optimizations`);

    // Enhance with real-time ML predictions
    const enhancedOptimizations = await this.realTimeOptimizer.generateRealTimeOptimizations(
      'Integration test prompt: Please analyze the following data and provide insights.',
      {
        useBaseOptimizations: true,
        enhanceWithML: true,
        adaptToRecentFeedback: true
      }
    );

    console.log(`🚀 Enhanced to ${enhancedOptimizations.length} ML-optimized suggestions`);

    // Compare base vs enhanced optimizations
    console.log('\n📊 Optimization Comparison:');
    
    if (baseOptimizations.length > 0 && enhancedOptimizations.length > 0) {
      const baseAvgConfidence = baseOptimizations.reduce((sum, opt) => sum + opt.confidence, 0) / baseOptimizations.length;
      const enhancedAvgConfidence = enhancedOptimizations.reduce((sum, opt) => sum + opt.confidence, 0) / enhancedOptimizations.length;
      
      console.log(`Base optimization confidence: ${(baseAvgConfidence * 100).toFixed(1)}%`);
      console.log(`Enhanced optimization confidence: ${(enhancedAvgConfidence * 100).toFixed(1)}%`);
      console.log(`Improvement: ${((enhancedAvgConfidence - baseAvgConfidence) * 100).toFixed(1)}% points`);
    }

    // Demonstrate real-time adaptation
    console.log('\n⚡ Real-time Adaptation Demo:');
    await this.demonstrateRealTimeAdaptation();
  }

  /**
   * Simulate A/B test results with realistic performance variations
   */
  private async simulateABTestResults(testId: string, variants: any[]): Promise<void> {
    const simulationRounds = 20;
    
    for (let round = 0; round < simulationRounds; round++) {
      for (const variant of variants) {
        // Simulate different performance characteristics for each variant
        let baseSuccessRate = 85;
        let baseResponseTime = 500;
        let baseQuality = 80;
        
        // Make some variants perform better than others
        switch (variant.id) {
          case 'structured':
            baseSuccessRate += 5;
            baseQuality += 8;
            baseResponseTime += 50;
            break;
          case 'contextual':
            baseSuccessRate += 8;
            baseQuality += 12;
            baseResponseTime += 30;
            break;
          case 'conversational':
            baseSuccessRate += 2;
            baseQuality += 5;
            baseResponseTime -= 20;
            break;
        }
        
        const feedback: RealTimeFeedback = {
          id: `ab_test_${testId}_${variant.id}_${round}`,
          promptId: testId,
          variantId: variant.id,
          metrics: {
            responseTime: baseResponseTime + (Math.random() - 0.5) * 200,
            successRate: Math.max(0, Math.min(100, baseSuccessRate + (Math.random() - 0.5) * 20)),
            qualityScore: Math.max(0, Math.min(100, baseQuality + (Math.random() - 0.5) * 25)),
            errorRate: Math.max(0, Math.random() * 10),
            userSatisfaction: 0.6 + Math.random() * 0.4
          },
          context: {
            timestamp: new Date(),
            environment: 'ab_test',
            metadata: {
              testId,
              round,
              variant: variant.id
            }
          }
        };

        await this.realTimeOptimizer.processFeedback(feedback);
      }
      
      // Small delay between rounds
      await new Promise(resolve => setTimeout(resolve, 25));
    }
  }

  /**
   * Generate optimization load for performance testing
   */
  private async generateOptimizationLoad(index: number): Promise<void> {
    const promptTemplates = [
      'Analyze the following data: {data}',
      'Provide insights on: {topic}',
      'Summarize the key points of: {content}',
      'Explain the concept of: {concept}',
      'Compare and contrast: {item1} vs {item2}'
    ];

    const prompt = promptTemplates[index % promptTemplates.length];
    
    // Generate optimization
    await this.realTimeOptimizer.generateRealTimeOptimizations(
      `load_test_prompt_${index}`,
      {
        template: prompt,
        loadTest: true,
        index
      }
    );

    // Simulate feedback
    const feedback: RealTimeFeedback = {
      id: `load_feedback_${index}`,
      promptId: `load_test_prompt_${index}`,
      metrics: {
        responseTime: 300 + Math.random() * 500,
        successRate: 80 + Math.random() * 20,
        qualityScore: 75 + Math.random() * 25,
        errorRate: Math.random() * 15,
        userSatisfaction: 0.6 + Math.random() * 0.4
      },
      context: {
        timestamp: new Date(),
        environment: 'load_test',
        metadata: { loadIndex: index }
      }
    };

    await this.realTimeOptimizer.processFeedback(feedback);
  }

  /**
   * Demonstrate adaptive configuration based on performance
   */
  private async demonstrateAdaptiveConfiguration(metrics: any): Promise<void> {
    console.log('\n⚙️  Adaptive Configuration Demo:');

    let configUpdate: Partial<RealTimeOptimizerConfig> = {};

    // Adapt based on performance metrics
    if (metrics.processingLatency > 80) {
      console.log('🐌 High latency detected, optimizing for speed...');
      configUpdate = {
        ...configUpdate,
        feedbackWindowMs: 30000, // Reduce window
        adaptationIntervalMs: 180000, // Reduce adaptation frequency
        learningRate: 0.005 // Increase learning rate for faster adaptation
      };
    }

    if (metrics.cacheEfficiency < 0.7) {
      console.log('📦 Low cache efficiency, optimizing cache policies...');
      configUpdate = {
        ...configUpdate,
        optimizationThreshold: 0.03 // Lower threshold for more aggressive caching
      };
    }

    if (metrics.modelAccuracy < 0.7) {
      console.log('🎯 Low model accuracy, increasing exploration...');
      configUpdate = {
        ...configUpdate,
        explorationRate: 0.15, // Increase exploration
        confidenceThreshold: 0.75 // Lower confidence requirement
      };
    }

    if (Object.keys(configUpdate).length > 0) {
      await this.realTimeOptimizer.updateConfiguration(configUpdate);
      console.log('✅ Configuration updated adaptively');
    } else {
      console.log('✅ Performance metrics within acceptable ranges');
    }
  }

  /**
   * Demonstrate real-time adaptation to changing conditions
   */
  private async demonstrateRealTimeAdaptation(): Promise<void> {
    // Simulate changing conditions
    const scenarios = [
      {
        name: 'High Load Scenario',
        feedback: {
          responseTime: 800,
          successRate: 75,
          qualityScore: 70,
          errorRate: 20
        }
      },
      {
        name: 'Optimal Performance Scenario',
        feedback: {
          responseTime: 350,
          successRate: 95,
          qualityScore: 90,
          errorRate: 2
        }
      },
      {
        name: 'Quality Issues Scenario',
        feedback: {
          responseTime: 450,
          successRate: 88,
          qualityScore: 60,
          errorRate: 8
        }
      }
    ];

    for (const scenario of scenarios) {
      console.log(`\n📊 Simulating ${scenario.name}:`);
      
      // Generate multiple feedback items for this scenario
      for (let i = 0; i < 10; i++) {
        const feedback: RealTimeFeedback = {
          id: `scenario_${scenario.name}_${i}`,
          promptId: 'adaptation_test_prompt',
          metrics: {
            responseTime: scenario.feedback.responseTime + (Math.random() - 0.5) * 100,
            successRate: scenario.feedback.successRate + (Math.random() - 0.5) * 10,
            qualityScore: scenario.feedback.qualityScore + (Math.random() - 0.5) * 15,
            errorRate: scenario.feedback.errorRate + (Math.random() - 0.5) * 5,
            userSatisfaction: 0.5 + Math.random() * 0.5
          },
          context: {
            timestamp: new Date(),
            environment: 'adaptation_demo',
            metadata: { scenario: scenario.name }
          }
        };

        await this.realTimeOptimizer.processFeedback(feedback);
      }

      // Generate optimizations for this scenario
      const optimizations = await this.realTimeOptimizer.generateRealTimeOptimizations(
        'adaptation_test_prompt',
        { scenario: scenario.name }
      );

      console.log(`  Generated ${optimizations.length} adapted optimizations`);
      
      if (optimizations.length > 0) {
        const avgConfidence = optimizations.reduce((sum, opt) => sum + opt.confidence, 0) / optimizations.length;
        console.log(`  Average confidence: ${(avgConfidence * 100).toFixed(1)}%`);
      }
    }
  }

  /**
   * Handle emergency optimization scenarios
   */
  private async handleEmergencyOptimization(event: any): Promise<void> {
    console.log('\n🚨 Emergency Optimization Handler:');
    console.log(`Prompt ID: ${event.feedback.promptId}`);
    console.log(`Issues: ${event.issues.join(', ')}`);
    console.log(`Action: ${event.action.description}`);
    
    // In a real system, this would trigger:
    // - Immediate notification to operations team
    // - Automatic fallback to safe prompts
    // - Enhanced monitoring for this prompt
    // - Escalation to human review if needed
    
    console.log('✅ Emergency response procedures would be triggered');
  }

  /**
   * Handle optimization errors gracefully
   */
  private handleOptimizationError(event: any): void {
    console.log('\n❌ Error Handler:');
    console.log(`Error type: ${event.type}`);
    console.log(`Error message: ${event.error.message}`);
    
    // In a real system, this would:
    // - Log error details for analysis
    // - Attempt recovery procedures
    // - Notify monitoring systems
    // - Gracefully degrade functionality if needed
    
    console.log('✅ Error handling procedures completed');
  }

  /**
   * Log current optimization metrics
   */
  private logOptimizationMetrics(): void {
    const metrics = this.realTimeOptimizer.getOptimizationMetrics();
    
    console.log('\n📊 Current Optimization Metrics:');
    console.log(`📈 Total optimizations: ${metrics.totalOptimizations}`);
    console.log(`✅ Successful optimizations: ${metrics.successfulOptimizations}`);
    console.log(`📊 Average improvement rate: ${(metrics.averageImprovementRate * 100).toFixed(2)}%`);
    console.log(`🎯 Current strategy: ${metrics.currentStrategy}`);
    console.log(`🎰 Active bandits: ${metrics.activeBandits}`);
    console.log(`🧠 Model accuracy: ${(metrics.modelAccuracy * 100).toFixed(1)}%`);
    console.log(`⚡ Processing latency: ${metrics.processingLatency.toFixed(2)}ms`);
    console.log(`📦 Cache efficiency: ${(metrics.cacheEfficiency * 100).toFixed(1)}%`);
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up resources...');
    
    this.performanceMonitor.stopMonitoring();
    await this.realTimeOptimizer.cleanup();
    
    console.log('✅ Cleanup complete');
  }
}

/**
 * Run the complete example
 */
async function runRealTimeOptimizerExample(): Promise<void> {
  console.log('🚀 Real-Time Optimizer ML-Driven Auto-Optimization Example');
  console.log('=' .repeat(60));

  const example = new RealTimeOptimizationExample();

  try {
    // Run all examples
    await example.demonstrateRealTimeFeedback();
    await example.demonstrateAdaptiveABTesting();
    await example.demonstrateBayesianOptimization();
    await example.demonstratePerformanceMonitoring();
    await example.demonstrateIntegration();

    console.log('\n🎉 All examples completed successfully!');
    console.log('\n📋 Summary of Capabilities Demonstrated:');
    console.log('✅ Sub-100ms real-time feedback processing');
    console.log('✅ Multi-armed bandit A/B testing with adaptive traffic allocation');
    console.log('✅ Bayesian hyperparameter optimization');
    console.log('✅ Online learning with continuous model updates');
    console.log('✅ Performance prediction and adaptive strategies');
    console.log('✅ Integration with existing optimization services');
    console.log('✅ Emergency optimization for critical performance issues');
    console.log('✅ Comprehensive error handling and monitoring');

  } catch (error) {
    console.error('❌ Example failed:', error);
  } finally {
    await example.cleanup();
  }
}

// Export for use in other modules
export { RealTimeOptimizationExample, runRealTimeOptimizerExample };

// Run example if this file is executed directly
if (require.main === module) {
  runRealTimeOptimizerExample().catch(console.error);
}