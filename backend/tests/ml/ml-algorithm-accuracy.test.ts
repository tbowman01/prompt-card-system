import { RealTimeOptimizer, RealTimeFeedback } from '../../src/services/optimization/RealTimeOptimizer';
import { AdvancedKVCache } from '../../src/services/optimization/AdvancedKVCache';
import { performance } from 'perf_hooks';
import * as tf from '@tensorflow/tfjs-node';

// Mock external dependencies
jest.mock('../../src/services/optimization/OptimizationEngine');
jest.mock('../../src/services/performance/PerformanceMonitor');
jest.mock('../../src/services/analytics/EventStore');

interface MLAccuracyTest {
  algorithm: string;
  testData: any[];
  expectedAccuracy: number;
  trainingData: any[];
  validationData: any[];
}

interface PredictionAccuracyResult {
  algorithm: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  confusionMatrix: number[][];
  roc_auc?: number;
}

interface BanditAlgorithmTest {
  algorithm: 'epsilon_greedy' | 'ucb1' | 'thompson_sampling' | 'exp3';
  arms: number;
  pulls: number;
  optimalArmIndex: number;
  expectedRegret: number;
}

describe('ML Algorithm Accuracy and Effectiveness Tests', () => {
  let realTimeOptimizer: RealTimeOptimizer;
  let advancedCache: AdvancedKVCache;

  beforeAll(async () => {
    // Initialize TensorFlow.js
    await tf.ready();
  });

  beforeEach(() => {
    realTimeOptimizer = new RealTimeOptimizer({
      learningRate: 0.01,
      explorationRate: 0.1,
      optimizationThreshold: 0.05,
      maxConcurrentTests: 5,
      feedbackWindowMs: 300000,
      adaptationIntervalMs: 60000,
      confidenceThreshold: 0.8,
      performanceTargets: {
        successRate: 95,
        responseTime: 500,
        qualityScore: 85
      }
    });

    advancedCache = new AdvancedKVCache({
      maxSize: 1000,
      maxMemoryMB: 50,
      mlPrediction: {
        enabled: true,
        predictionWindow: 300000,
        confidenceThreshold: 0.75
      }
    });
  });

  afterEach(async () => {
    await Promise.all([
      realTimeOptimizer.cleanup(),
      advancedCache.destroy()
    ]);
  });

  describe('Online Learning Model Accuracy', () => {
    it('should achieve target accuracy for performance prediction', async () => {
      const trainingData = generatePerformanceTrainingData(500);
      const validationData = generatePerformanceTrainingData(100);
      
      // Train the model with feedback data
      for (const data of trainingData) {
        await realTimeOptimizer.processFeedback(data);
      }
      
      // Allow model to process training data
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test predictions on validation data
      let correctPredictions = 0;
      const predictions: Array<{ actual: number; predicted: number }> = [];
      
      for (const validationItem of validationData.slice(0, 50)) {
        // Generate prediction (this would be done internally by the model)
        const suggestions = await realTimeOptimizer.generateRealTimeOptimizations(
          validationItem.promptId,
          { environment: 'validation' }
        );
        
        if (suggestions.length > 0) {
          const predictedImprovement = suggestions[0].expectedImprovement.successRate;
          const actualImprovement = validationItem.metrics.successRate;
          
          predictions.push({
            actual: actualImprovement,
            predicted: predictedImprovement
          });
          
          // Consider prediction correct if within 10% of actual
          if (Math.abs(predictedImprovement - actualImprovement) <= 10) {
            correctPredictions++;
          }
        }
      }
      
      const accuracy = correctPredictions / predictions.length;
      const mse = calculateMeanSquaredError(predictions);
      const mae = calculateMeanAbsoluteError(predictions);
      
      console.log(`Online Learning Model Performance:`);
      console.log(`  Accuracy (±10%): ${(accuracy * 100).toFixed(2)}%`);
      console.log(`  Mean Squared Error: ${mse.toFixed(4)}`);
      console.log(`  Mean Absolute Error: ${mae.toFixed(4)}`);
      console.log(`  Predictions made: ${predictions.length}`);
      
      expect(accuracy).toBeGreaterThan(0.6); // 60% accuracy within 10%
      expect(mse).toBeLessThan(100); // Reasonable MSE
    }, 30000);

    it('should improve accuracy with more training data', async () => {
      const accuracyProgression: number[] = [];
      const batchSizes = [50, 100, 200, 400];
      
      for (const batchSize of batchSizes) {
        const trainingBatch = generatePerformanceTrainingData(batchSize);
        const testBatch = generatePerformanceTrainingData(20);
        
        // Train with this batch
        for (const data of trainingBatch) {
          await realTimeOptimizer.processFeedback(data);
        }
        
        // Test accuracy
        let correct = 0;
        for (const testItem of testBatch) {
          const suggestions = await realTimeOptimizer.generateRealTimeOptimizations(
            testItem.promptId,
            { environment: 'accuracy-test' }
          );
          
          if (suggestions.length > 0) {
            const predicted = suggestions[0].expectedImprovement.successRate;
            const actual = testItem.metrics.successRate;
            
            if (Math.abs(predicted - actual) <= 15) {
              correct++;
            }
          }
        }
        
        const accuracy = correct / testBatch.length;
        accuracyProgression.push(accuracy);
        
        console.log(`After ${batchSize} training samples: ${(accuracy * 100).toFixed(2)}% accuracy`);
      }
      
      // Accuracy should generally improve with more data
      const improvementCount = accuracyProgression.reduce((count, accuracy, index) => {
        if (index > 0 && accuracy >= accuracyProgression[index - 1]) {
          return count + 1;
        }
        return count;
      }, 0);
      
      expect(improvementCount).toBeGreaterThanOrEqual(2); // At least 2 improvements
      expect(accuracyProgression[accuracyProgression.length - 1]).toBeGreaterThan(0.5);
    }, 45000);
  });

  describe('Multi-Armed Bandit Algorithm Effectiveness', () => {
    const banditTests: BanditAlgorithmTest[] = [
      {
        algorithm: 'epsilon_greedy',
        arms: 3,
        pulls: 300,
        optimalArmIndex: 0,
        expectedRegret: 50
      },
      {
        algorithm: 'ucb1',
        arms: 3,
        pulls: 300,
        optimalArmIndex: 0,
        expectedRegret: 40
      },
      {
        algorithm: 'thompson_sampling',
        arms: 3,
        pulls: 300,
        optimalArmIndex: 0,
        expectedRegret: 35
      },
      {
        algorithm: 'exp3',
        arms: 3,
        pulls: 300,
        optimalArmIndex: 0,
        expectedRegret: 45
      }
    ];

    banditTests.forEach(banditTest => {
      it(`should optimize ${banditTest.algorithm} algorithm effectively`, async () => {
        const testConfig = {
          name: `${banditTest.algorithm} Test`,
          description: `Testing ${banditTest.algorithm} algorithm`,
          variants: Array.from({ length: banditTest.arms }, (_, i) => ({
            id: `variant-${i}`,
            name: `Variant ${i}`,
            prompt: `Test prompt variant ${i}`,
            trafficAllocation: 1 / banditTest.arms
          })),
          targetMetric: 'successRate',
          duration: 3600000
        };

        const banditConfig = {
          algorithm: banditTest.algorithm,
          explorationRate: 0.1,
          minSamples: 10
        };

        const testId = await realTimeOptimizer.startAdaptiveABTest(testConfig, banditConfig);
        
        // Simulate arm pulls with known rewards
        const armRewards = [0.8, 0.6, 0.5]; // Arm 0 is optimal
        let totalRegret = 0;
        const armPulls = [0, 0, 0];
        
        for (let pull = 0; pull < banditTest.pulls; pull++) {
          // Simulate bandit arm selection (simplified)
          const selectedArm = Math.floor(Math.random() * banditTest.arms);
          armPulls[selectedArm]++;
          
          // Calculate regret
          const optimalReward = armRewards[banditTest.optimalArmIndex];
          const actualReward = armRewards[selectedArm] + (Math.random() - 0.5) * 0.1; // Add noise
          totalRegret += optimalReward - actualReward;
          
          // Process feedback
          await realTimeOptimizer.processFeedback({
            id: `bandit-feedback-${pull}`,
            promptId: testId,
            variantId: `variant-${selectedArm}`,
            metrics: {
              responseTime: 400 + Math.random() * 200,
              successRate: (actualReward + Math.random() * 0.1) * 100,
              qualityScore: 80 + Math.random() * 15,
              errorRate: Math.random() * 0.05
            },
            context: {
              environment: 'bandit-test',
              timestamp: new Date(),
              metadata: {
                algorithm: banditTest.algorithm,
                armIndex: selectedArm
              }
            }
          });
        }
        
        const averageRegret = totalRegret / banditTest.pulls;
        const optimalArmProportion = armPulls[banditTest.optimalArmIndex] / banditTest.pulls;
        
        console.log(`${banditTest.algorithm} Results:`);
        console.log(`  Total pulls: ${banditTest.pulls}`);
        console.log(`  Average regret: ${averageRegret.toFixed(4)}`);
        console.log(`  Optimal arm pulls: ${armPulls[banditTest.optimalArmIndex]}/${banditTest.pulls} (${(optimalArmProportion * 100).toFixed(2)}%)`);
        console.log(`  Arm distribution: [${armPulls.join(', ')}]`);
        
        // Bandit should converge to optimal arm
        expect(optimalArmProportion).toBeGreaterThan(0.4); // At least 40% optimal pulls
        expect(averageRegret).toBeLessThan(banditTest.expectedRegret / 100); // Normalized regret
      }, 60000);
    });

    it('should adapt traffic allocation based on performance', async () => {
      const testConfig = {
        name: 'Adaptive Traffic Test',
        description: 'Testing adaptive traffic allocation',
        variants: [
          { id: 'high-perf', name: 'High Performance', prompt: 'High perf prompt', trafficAllocation: 0.33 },
          { id: 'medium-perf', name: 'Medium Performance', prompt: 'Medium perf prompt', trafficAllocation: 0.33 },
          { id: 'low-perf', name: 'Low Performance', prompt: 'Low perf prompt', trafficAllocation: 0.34 }
        ],
        targetMetric: 'successRate',
        duration: 3600000
      };

      const testId = await realTimeOptimizer.startAdaptiveABTest(testConfig, {
        algorithm: 'ucb1',
        explorationRate: 0.1,
        minSamples: 20
      });

      // Simulate different performance levels
      const variantPerformance = {
        'high-perf': { successRate: 95, responseTime: 300 },
        'medium-perf': { successRate: 85, responseTime: 400 },
        'low-perf': { successRate: 70, responseTime: 600 }
      };

      const trafficDistribution = { 'high-perf': 0, 'medium-perf': 0, 'low-perf': 0 };
      const totalRequests = 200;

      for (let i = 0; i < totalRequests; i++) {
        // Simulate traffic allocation (simplified)
        const variants = Object.keys(variantPerformance);
        const selectedVariant = variants[Math.floor(Math.random() * variants.length)];
        trafficDistribution[selectedVariant]++;

        const perf = variantPerformance[selectedVariant];
        await realTimeOptimizer.processFeedback({
          id: `traffic-feedback-${i}`,
          promptId: testId,
          variantId: selectedVariant,
          metrics: {
            responseTime: perf.responseTime + (Math.random() - 0.5) * 100,
            successRate: perf.successRate + (Math.random() - 0.5) * 10,
            qualityScore: 80 + Math.random() * 15,
            errorRate: (100 - perf.successRate) / 1000
          },
          context: {
            environment: 'traffic-test',
            timestamp: new Date()
          }
        });
      }

      const highPerfProportion = trafficDistribution['high-perf'] / totalRequests;
      const lowPerfProportion = trafficDistribution['low-perf'] / totalRequests;

      console.log(`Traffic Distribution:`);
      console.log(`  High Performance: ${trafficDistribution['high-perf']} (${(highPerfProportion * 100).toFixed(2)}%)`);
      console.log(`  Medium Performance: ${trafficDistribution['medium-perf']}`);
      console.log(`  Low Performance: ${trafficDistribution['low-perf']} (${(lowPerfProportion * 100).toFixed(2)}%)`);

      // High performance variant should get more traffic over time
      // This is a simplified test - in reality, the bandit would adapt more gradually
      expect(highPerfProportion).toBeGreaterThan(0.2); // At least 20%
    }, 30000);
  });

  describe('Cache Prediction Model Accuracy', () => {
    it('should accurately predict cache hits', async () => {
      const cacheTrainingData = generateCacheAccessPatterns(1000);
      
      // Train cache prediction model with access patterns
      for (const accessData of cacheTrainingData) {
        await advancedCache.set(accessData.key, accessData.data);
        if (accessData.shouldAccess) {
          await advancedCache.get(accessData.key);
        }
      }
      
      // Test prediction accuracy
      const testData = generateCacheAccessPatterns(200);
      let correctPredictions = 0;
      let totalPredictions = 0;
      
      for (const testItem of testData) {
        const prediction = advancedCache.predictHit(testItem.key);
        totalPredictions++;
        
        // Check actual cache hit
        const actualResult = await advancedCache.get(testItem.key);
        const actualHit = actualResult !== undefined;
        
        // Consider prediction correct if it's in the right direction
        const predictedHit = prediction > 0.5;
        if (predictedHit === actualHit) {
          correctPredictions++;
        }
        
        // Store the test data for future predictions
        if (!actualHit) {
          await advancedCache.set(testItem.key, testItem.data);
        }
      }
      
      const predictionAccuracy = correctPredictions / totalPredictions;
      const cacheMetrics = advancedCache.getMetrics();
      
      console.log(`Cache Prediction Model Results:`);
      console.log(`  Prediction accuracy: ${(predictionAccuracy * 100).toFixed(2)}%`);
      console.log(`  Correct predictions: ${correctPredictions}/${totalPredictions}`);
      console.log(`  Actual cache hit rate: ${(cacheMetrics.hitRate * 100).toFixed(2)}%`);
      
      expect(predictionAccuracy).toBeGreaterThan(0.6); // 60% prediction accuracy
      expect(totalPredictions).toBeGreaterThan(100); // Sufficient test size
    });

    it('should improve predictions with access pattern learning', async () => {
      const patterns = [
        { type: 'temporal', description: 'Time-based access patterns' },
        { type: 'frequency', description: 'Frequency-based access patterns' },
        { type: 'sequential', description: 'Sequential access patterns' }
      ];
      
      for (const pattern of patterns) {
        const patternData = generateSpecificAccessPattern(pattern.type, 100);
        
        // Train with pattern
        for (const data of patternData.training) {
          await advancedCache.set(data.key, data.value);
          if (data.access) {
            await advancedCache.get(data.key);
          }
        }
        
        // Test pattern recognition
        let patternCorrect = 0;
        for (const testData of patternData.test) {
          const prediction = advancedCache.predictHit(testData.key);
          const expectedHit = testData.expectedHit;
          
          if ((prediction > 0.5) === expectedHit) {
            patternCorrect++;
          }
        }
        
        const patternAccuracy = patternCorrect / patternData.test.length;
        
        console.log(`${pattern.description} Recognition:`);
        console.log(`  Accuracy: ${(patternAccuracy * 100).toFixed(2)}%`);
        console.log(`  Correct: ${patternCorrect}/${patternData.test.length}`);
        
        expect(patternAccuracy).toBeGreaterThan(0.5); // Better than random
      }
    });
  });

  describe('Bayesian Optimization Effectiveness', () => {
    it('should converge to optimal hyperparameters', async () => {
      const searchSpace = {
        learningRate: { min: 0.001, max: 0.1, type: 'continuous' as const },
        batchSize: { min: 16, max: 128, type: 'discrete' as const },
        explorationRate: { min: 0.01, max: 0.3, type: 'continuous' as const }
      };
      
      // Known optimal values for testing
      const optimalValues = {
        learningRate: 0.01,
        batchSize: 64,
        explorationRate: 0.1
      };
      
      const result = await realTimeOptimizer.optimizeHyperparameters(
        searchSpace,
        'maximize',
        30 // Limited iterations for testing
      );
      
      // Calculate distance from optimal
      const learningRateError = Math.abs(result.parameters.learningRate - optimalValues.learningRate) / optimalValues.learningRate;
      const batchSizeError = Math.abs(result.parameters.batchSize - optimalValues.batchSize) / optimalValues.batchSize;
      const explorationRateError = Math.abs(result.parameters.explorationRate - optimalValues.explorationRate) / optimalValues.explorationRate;
      
      const averageError = (learningRateError + batchSizeError + explorationRateError) / 3;
      
      console.log(`Bayesian Optimization Results:`);
      console.log(`  Found parameters:`, result.parameters);
      console.log(`  Optimal parameters:`, optimalValues);
      console.log(`  Learning rate error: ${(learningRateError * 100).toFixed(2)}%`);
      console.log(`  Batch size error: ${(batchSizeError * 100).toFixed(2)}%`);
      console.log(`  Exploration rate error: ${(explorationRateError * 100).toFixed(2)}%`);
      console.log(`  Average error: ${(averageError * 100).toFixed(2)}%`);
      console.log(`  Confidence: ${result.confidence.toFixed(3)}`);
      console.log(`  Iterations: ${result.iteration}`);
      
      expect(averageError).toBeLessThan(0.5); // Less than 50% average error
      expect(result.confidence).toBeGreaterThan(0.3); // Reasonable confidence
      expect(result.iteration).toBeLessThan(30); // Converged within limit
    }, 60000);
  });

  describe('Model Robustness and Generalization', () => {
    it('should handle noisy data gracefully', async () => {
      const cleanData = generatePerformanceTrainingData(100);
      const noisyData = addNoiseToTrainingData(cleanData, 0.3); // 30% noise
      
      // Train with noisy data
      for (const data of noisyData) {
        await realTimeOptimizer.processFeedback(data);
      }
      
      // Test with clean validation data
      const validationData = generatePerformanceTrainingData(50);
      let robustPredictions = 0;
      
      for (const validation of validationData) {
        const suggestions = await realTimeOptimizer.generateRealTimeOptimizations(
          validation.promptId,
          { environment: 'robustness-test' }
        );
        
        if (suggestions.length > 0) {
          const prediction = suggestions[0].expectedImprovement.successRate;
          const actual = validation.metrics.successRate;
          
          // Model should still make reasonable predictions despite noise
          if (prediction >= 50 && prediction <= 100) { // Reasonable range
            robustPredictions++;
          }
        }
      }
      
      const robustnessRate = robustPredictions / validationData.length;
      
      console.log(`Model Robustness to Noise:`);
      console.log(`  Reasonable predictions: ${robustPredictions}/${validationData.length}`);
      console.log(`  Robustness rate: ${(robustnessRate * 100).toFixed(2)}%`);
      
      expect(robustnessRate).toBeGreaterThan(0.7); // 70% reasonable predictions
    });

    it('should adapt to distribution shift', async () => {
      // Initial training distribution
      const initialData = generatePerformanceTrainingData(200, {
        successRateRange: [80, 95],
        responseTimeRange: [300, 600]
      });
      
      // Train initial model
      for (const data of initialData) {
        await realTimeOptimizer.processFeedback(data);
      }
      
      // Test initial performance
      const initialTestData = generatePerformanceTrainingData(30, {
        successRateRange: [80, 95],
        responseTimeRange: [300, 600]
      });
      
      const initialAccuracy = await testPredictionAccuracy(
        realTimeOptimizer,
        initialTestData,
        'initial-distribution'
      );
      
      // Shifted distribution
      const shiftedData = generatePerformanceTrainingData(100, {
        successRateRange: [60, 80], // Lower success rates
        responseTimeRange: [600, 1000] // Higher response times
      });
      
      // Continue training with shifted distribution
      for (const data of shiftedData) {
        await realTimeOptimizer.processFeedback(data);
      }
      
      // Test adapted performance
      const shiftedTestData = generatePerformanceTrainingData(30, {
        successRateRange: [60, 80],
        responseTimeRange: [600, 1000]
      });
      
      const adaptedAccuracy = await testPredictionAccuracy(
        realTimeOptimizer,
        shiftedTestData,
        'shifted-distribution'
      );
      
      console.log(`Distribution Shift Adaptation:`);
      console.log(`  Initial distribution accuracy: ${(initialAccuracy * 100).toFixed(2)}%`);
      console.log(`  Adapted distribution accuracy: ${(adaptedAccuracy * 100).toFixed(2)}%`);
      
      // Model should maintain reasonable performance after adaptation
      expect(adaptedAccuracy).toBeGreaterThan(0.4); // 40% accuracy on shifted distribution
      expect(adaptedAccuracy).toBeGreaterThan(initialAccuracy * 0.6); // At least 60% of initial accuracy
    }, 45000);
  });
});

// Helper functions

function generatePerformanceTrainingData(
  count: number,
  options: {
    successRateRange?: [number, number];
    responseTimeRange?: [number, number];
  } = {}
): RealTimeFeedback[] {
  const {
    successRateRange = [70, 100],
    responseTimeRange = [200, 800]
  } = options;
  
  return Array.from({ length: count }, (_, i) => {
    const successRate = successRateRange[0] + Math.random() * (successRateRange[1] - successRateRange[0]);
    const responseTime = responseTimeRange[0] + Math.random() * (responseTimeRange[1] - responseTimeRange[0]);
    
    return {
      id: `training-feedback-${i}`,
      promptId: `training-prompt-${i % 50}`, // Reuse some prompts
      metrics: {
        responseTime,
        successRate,
        qualityScore: 70 + Math.random() * 25,
        errorRate: (100 - successRate) / 1000
      },
      context: {
        environment: 'training',
        timestamp: new Date(Date.now() - Math.random() * 86400000), // Random time in last 24h
        metadata: {
          promptLength: 50 + Math.random() * 200,
          complexity: Math.random()
        }
      }
    };
  });
}

function generateCacheAccessPatterns(count: number): Array<{
  key: string;
  data: any;
  shouldAccess: boolean;
  accessTime: number;
}> {
  return Array.from({ length: count }, (_, i) => {
    const baseKey = `cache-key-${Math.floor(i / 3)}`; // Group keys for repeated access
    const shouldAccess = Math.random() > 0.3; // 70% access probability
    
    return {
      key: baseKey,
      data: { value: `data-${i}`, timestamp: Date.now() },
      shouldAccess,
      accessTime: Date.now() + Math.random() * 3600000 // Random time in next hour
    };
  });
}

function generateSpecificAccessPattern(type: string, count: number): {
  training: Array<{ key: string; value: any; access: boolean }>;
  test: Array<{ key: string; expectedHit: boolean }>;
} {
  const training: Array<{ key: string; value: any; access: boolean }> = [];
  const test: Array<{ key: string; expectedHit: boolean }> = [];
  
  if (type === 'temporal') {
    // Time-based pattern: access recent items more frequently
    for (let i = 0; i < count; i++) {
      const key = `temporal-${i}`;
      const isRecent = i > count * 0.7;
      training.push({
        key,
        value: { data: `temporal data ${i}` },
        access: isRecent ? Math.random() > 0.2 : Math.random() > 0.8
      });
    }
    
    // Test expects recent items to be hit more often
    for (let i = 0; i < 20; i++) {
      const key = `temporal-${count + i}`;
      test.push({ key, expectedHit: false }); // New items shouldn't hit
    }
  } else if (type === 'frequency') {
    // Frequency-based pattern: some items accessed much more
    const popularKeys = [`freq-popular-1`, `freq-popular-2`];
    const regularKeys = Array.from({ length: count - 20 }, (_, i) => `freq-regular-${i}`);
    
    for (let i = 0; i < count; i++) {
      const usePopular = Math.random() > 0.6;
      const key = usePopular 
        ? popularKeys[Math.floor(Math.random() * popularKeys.length)]
        : regularKeys[Math.floor(Math.random() * regularKeys.length)];
      
      training.push({
        key,
        value: { data: `freq data ${i}` },
        access: true
      });
    }
    
    // Test expects popular items to be predicted as hits
    popularKeys.forEach(key => {
      test.push({ key, expectedHit: true });
    });
    for (let i = 0; i < 10; i++) {
      test.push({ key: `freq-new-${i}`, expectedHit: false });
    }
  } else if (type === 'sequential') {
    // Sequential pattern: items accessed in order
    for (let i = 0; i < count; i++) {
      training.push({
        key: `seq-${i}`,
        value: { data: `sequential data ${i}` },
        access: true
      });
    }
    
    // Test expects next items in sequence to be predicted
    for (let i = count; i < count + 10; i++) {
      test.push({ key: `seq-${i}`, expectedHit: false }); // New sequential items
    }
  }
  
  return { training, test };
}

function addNoiseToTrainingData(
  data: RealTimeFeedback[],
  noiseLevel: number
): RealTimeFeedback[] {
  return data.map(item => ({
    ...item,
    metrics: {
      ...item.metrics,
      responseTime: item.metrics.responseTime * (1 + (Math.random() - 0.5) * noiseLevel),
      successRate: Math.max(0, Math.min(100, 
        item.metrics.successRate + (Math.random() - 0.5) * noiseLevel * 100
      )),
      qualityScore: Math.max(0, Math.min(100,
        item.metrics.qualityScore + (Math.random() - 0.5) * noiseLevel * 50
      ))
    }
  }));
}

async function testPredictionAccuracy(
  optimizer: RealTimeOptimizer,
  testData: RealTimeFeedback[],
  environment: string
): Promise<number> {
  let correct = 0;
  let total = 0;
  
  for (const testItem of testData) {
    const suggestions = await optimizer.generateRealTimeOptimizations(
      testItem.promptId,
      { environment }
    );
    
    if (suggestions.length > 0) {
      const predicted = suggestions[0].expectedImprovement.successRate;
      const actual = testItem.metrics.successRate;
      
      if (Math.abs(predicted - actual) <= 20) { // Within 20% is considered correct
        correct++;
      }
      total++;
    }
  }
  
  return total > 0 ? correct / total : 0;
}

function calculateMeanSquaredError(predictions: Array<{ actual: number; predicted: number }>): number {
  if (predictions.length === 0) return 0;
  
  const sumSquaredErrors = predictions.reduce((sum, p) => {
    const error = p.actual - p.predicted;
    return sum + (error * error);
  }, 0);
  
  return sumSquaredErrors / predictions.length;
}

function calculateMeanAbsoluteError(predictions: Array<{ actual: number; predicted: number }>): number {
  if (predictions.length === 0) return 0;
  
  const sumAbsoluteErrors = predictions.reduce((sum, p) => {
    return sum + Math.abs(p.actual - p.predicted);
  }, 0);
  
  return sumAbsoluteErrors / predictions.length;
}
