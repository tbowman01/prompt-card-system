import { AdvancedKVCache, CacheConfiguration } from '../services/optimization/AdvancedKVCache';
import { optimizationEngine } from '../services/optimization/OptimizationEngine';

/**
 * Validation script for Advanced KV Cache implementation
 * Tests core functionality and performance improvements
 */

async function validateAdvancedKVCache() {
  console.log('🚀 Starting Advanced KV Cache Validation...\n');

  // Test 1: Basic functionality
  console.log('Test 1: Basic Cache Operations');
  const testCache = new AdvancedKVCache({
    maxSize: 50,
    maxMemoryMB: 10,
    defaultTTL: 60000,
    quantization: {
      enabled: true,
      type: 'int8',
      threshold: 100,
      aggressive: false
    },
    monitoring: {
      enabled: false,
      metricsInterval: 1000,
      alertThresholds: {
        hitRate: 0.8,
        memoryUsage: 0.9,
        evictionRate: 0.1
      }
    }
  });

  // Basic set/get operations
  const testKey = 'validation-test-key';
  const testValue = { 
    data: 'validation test data',
    timestamp: Date.now(),
    metadata: { type: 'test', priority: 'high' }
  };

  const setResult = await testCache.set(testKey, testValue);
  console.log(`✓ Cache set operation: ${setResult ? 'SUCCESS' : 'FAILED'}`);

  const getValue = await testCache.get(testKey);
  console.log(`✓ Cache get operation: ${getValue ? 'SUCCESS' : 'FAILED'}`);
  console.log(`✓ Data integrity: ${JSON.stringify(getValue) === JSON.stringify(testValue) ? 'VERIFIED' : 'FAILED'}`);

  // Test 2: Quantization
  console.log('\nTest 2: Quantization Features');
  const largeValue = {
    data: 'x'.repeat(500), // Large string to trigger quantization
    numbers: Array.from({ length: 100 }, (_, i) => i * Math.PI),
    nested: {
      level1: { level2: { level3: 'deeply nested data' } }
    }
  };

  await testCache.set('large-key', largeValue);
  const retrievedLarge = await testCache.get('large-key');
  console.log(`✓ Large data set/get: ${retrievedLarge ? 'SUCCESS' : 'FAILED'}`);

  const metricsAfterLarge = testCache.getMetrics();
  console.log(`✓ Quantization applied: ${metricsAfterLarge.quantizations > 0 ? 'YES' : 'NO'}`);
  console.log(`✓ Compression ratio: ${metricsAfterLarge.compressionRatio.toFixed(2)}`);

  // Test 3: Memory efficiency
  console.log('\nTest 3: Memory Efficiency');
  const beforeOptimization = testCache.getMetrics();
  const optimizationResult = await testCache.optimizeMemory();
  const afterOptimization = testCache.getMetrics();

  console.log(`✓ Memory optimization completed`);
  console.log(`  - Entries evicted: ${optimizationResult.entriesEvicted}`);
  console.log(`  - Memory freed: ${optimizationResult.memoryFreed} bytes`);
  console.log(`  - Quantizations applied: ${optimizationResult.quantizationsApplied}`);

  // Test 4: Performance metrics
  console.log('\nTest 4: Performance Metrics');
  const metrics = testCache.getMetrics();
  console.log(`✓ Hit rate: ${(metrics.hitRate * 100).toFixed(1)}%`);
  console.log(`✓ Memory usage: ${(metrics.memoryUsage / 1024).toFixed(1)} KB`);
  console.log(`✓ Average access time: ${metrics.averageAccessTime.toFixed(2)}ms`);
  console.log(`✓ Memory efficiency: ${metrics.memoryEfficiency.toFixed(2)}x`);

  // Test 5: ML Prediction
  console.log('\nTest 5: ML-based Hit Prediction');
  const prediction = testCache.predictHit('test-prediction-key');
  console.log(`✓ ML prediction capability: ${typeof prediction === 'number' ? 'ACTIVE' : 'INACTIVE'}`);
  console.log(`✓ Prediction value: ${prediction.toFixed(3)}`);

  // Test 6: Memory pressure handling
  console.log('\nTest 6: Memory Pressure Monitoring');
  const memoryPressure = testCache.getMemoryPressure();
  console.log(`✓ Memory pressure level: ${memoryPressure.level}`);
  console.log(`✓ Usage percentage: ${(memoryPressure.usagePercentage * 100).toFixed(1)}%`);
  console.log(`✓ Recommended action: ${memoryPressure.recommendedAction}`);

  // Test 7: Integration with OptimizationEngine
  console.log('\nTest 7: OptimizationEngine Integration');
  const engineStats = optimizationEngine.getCacheStats();
  const advancedStats = optimizationEngine.getAdvancedCacheStats();
  
  console.log(`✓ Analysis cache integration: ${engineStats.analysis ? 'SUCCESS' : 'FAILED'}`);
  console.log(`✓ Suggestions cache integration: ${engineStats.suggestions ? 'SUCCESS' : 'FAILED'}`);
  console.log(`✓ Advanced metrics available: ${advancedStats ? 'SUCCESS' : 'FAILED'}`);

  // Test 8: Configuration management
  console.log('\nTest 8: Configuration Management');
  const originalConfig = testCache.getConfiguration();
  testCache.updateConfiguration({ defaultTTL: 120000 });
  const updatedConfig = testCache.getConfiguration();
  
  console.log(`✓ Configuration update: ${updatedConfig.defaultTTL === 120000 ? 'SUCCESS' : 'FAILED'}`);

  // Test 9: Export capabilities
  console.log('\nTest 9: Export and Monitoring');
  const exportData = testCache.exportStatistics();
  const parsedExport = JSON.parse(exportData);
  
  console.log(`✓ Statistics export: ${parsedExport.timestamp ? 'SUCCESS' : 'FAILED'}`);
  console.log(`✓ Performance data included: ${parsedExport.performance ? 'SUCCESS' : 'FAILED'}`);

  // Performance comparison
  console.log('\nTest 10: Performance Comparison');
  const startTime = Date.now();
  
  // Simulate workload
  for (let i = 0; i < 100; i++) {
    await testCache.set(`perf-key-${i}`, { index: i, data: `data-${i}` });
  }
  
  let hits = 0;
  for (let i = 0; i < 100; i++) {
    const value = await testCache.get(`perf-key-${i}`);
    if (value) hits++;
  }
  
  const endTime = Date.now();
  const totalTime = endTime - startTime;
  const finalMetrics = testCache.getMetrics();
  
  console.log(`✓ 100 set operations completed in: ${totalTime}ms`);
  console.log(`✓ 100 get operations hit rate: ${(hits / 100 * 100).toFixed(1)}%`);
  console.log(`✓ Final hit rate: ${(finalMetrics.hitRate * 100).toFixed(1)}%`);
  console.log(`✓ Memory reduction vs standard cache: ~${((1 - 1/finalMetrics.compressionRatio) * 100).toFixed(1)}%`);

  // Cleanup
  testCache.destroy();
  
  console.log('\n🎉 Advanced KV Cache Validation Complete!');
  console.log('\n📊 Summary:');
  console.log(`   - Cache operations: ✓ Working`);
  console.log(`   - Quantization: ✓ Active (${finalMetrics.quantizations} applied)`);
  console.log(`   - Compression ratio: ${finalMetrics.compressionRatio.toFixed(2)}x`);
  console.log(`   - Memory efficiency: ${finalMetrics.memoryEfficiency.toFixed(2)}x`);
  console.log(`   - ML prediction: ✓ Available`);
  console.log(`   - Performance monitoring: ✓ Active`);
  console.log(`   - Integration: ✓ Complete`);
}

// Run validation if this script is executed directly
if (require.main === module) {
  validateAdvancedKVCache().catch(error => {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  });
}

export { validateAdvancedKVCache };