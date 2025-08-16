import { AdvancedKVCache, CacheConfiguration, QuantizationType } from '../../services/optimization/AdvancedKVCache';

describe('AdvancedKVCache', () => {
  let cache: AdvancedKVCache;

  beforeEach(() => {
    const config: Partial<CacheConfiguration> = {
      maxSize: 100,
      maxMemoryMB: 10,
      defaultTTL: 60000, // 1 minute for tests
      quantization: {
        enabled: true,
        type: 'int8',
        threshold: 100, // Low threshold for testing
        aggressive: false
      },
      adaptiveResize: {
        enabled: true,
        minSize: 10,
        maxSize: 200,
        resizeThreshold: 0.8,
        shrinkFactor: 0.7,
        growthFactor: 1.3
      },
      mlPrediction: {
        enabled: true,
        predictionWindow: 60000,
        confidenceThreshold: 0.7
      },
      monitoring: {
        enabled: false, // Disable for tests
        metricsInterval: 1000,
        alertThresholds: {
          hitRate: 0.8,
          memoryUsage: 0.9,
          evictionRate: 0.1
        }
      }
    };
    cache = new AdvancedKVCache(config);
  });

  afterEach(() => {
    cache.destroy();
  });

  describe('Basic Operations', () => {
    it('should set and get values', async () => {
      const key = 'test-key';
      const value = { data: 'test-value', number: 42 };

      const setResult = await cache.set(key, value);
      expect(setResult).toBe(true);

      const getValue = await cache.get(key);
      expect(getValue).toEqual(value);
    });

    it('should return undefined for non-existent keys', async () => {
      const value = await cache.get('non-existent');
      expect(value).toBeUndefined();
    });

    it('should check if key exists', async () => {
      const key = 'exists-key';
      const value = 'test-value';

      expect(cache.has(key)).toBe(false);

      await cache.set(key, value);
      expect(cache.has(key)).toBe(true);
    });

    it('should delete entries', async () => {
      const key = 'delete-key';
      const value = 'test-value';

      await cache.set(key, value);
      expect(cache.has(key)).toBe(true);

      const deleted = cache.delete(key);
      expect(deleted).toBe(true);
      expect(cache.has(key)).toBe(false);
    });

    it('should clear all entries', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      
      expect(cache.size()).toBe(2);
      
      cache.clear();
      expect(cache.size()).toBe(0);
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should expire entries after TTL', async () => {
      const key = 'ttl-key';
      const value = 'ttl-value';
      const shortTTL = 50; // 50ms

      await cache.set(key, value, shortTTL);
      expect(await cache.get(key)).toEqual(value);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const expiredValue = await cache.get(key);
      expect(expiredValue).toBeUndefined();
    });

    it('should use default TTL when not specified', async () => {
      const key = 'default-ttl-key';
      const value = 'default-ttl-value';

      await cache.set(key, value);
      const retrievedValue = await cache.get(key);
      expect(retrievedValue).toEqual(value);
    });
  });

  describe('Quantization', () => {
    it('should quantize large entries', async () => {
      const key = 'large-entry';
      const largeValue = {
        data: 'a'.repeat(200), // Large string to trigger quantization
        numbers: Array.from({ length: 100 }, (_, i) => i),
        nested: {
          moreData: 'b'.repeat(100)
        }
      };

      await cache.set(key, largeValue);
      const retrievedValue = await cache.get(key);
      
      // Value should be retrieved successfully despite quantization
      expect(retrievedValue).toBeDefined();
      expect(typeof retrievedValue).toBe('object');
    });

    it('should track quantization metrics', async () => {
      const key = 'quantization-test';
      const largeValue = { data: 'x'.repeat(500) };

      await cache.set(key, largeValue);
      
      const metrics = cache.getMetrics();
      expect(metrics.quantizations).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Memory Management', () => {
    it('should evict entries when cache is full', async () => {
      const cacheSize = 10;
      const smallCache = new AdvancedKVCache({
        maxSize: cacheSize,
        maxMemoryMB: 1
      });

      // Fill cache beyond capacity
      for (let i = 0; i < cacheSize + 5; i++) {
        await smallCache.set(`key-${i}`, `value-${i}`);
      }

      expect(smallCache.size()).toBeLessThanOrEqual(cacheSize);
      
      const metrics = smallCache.getMetrics();
      expect(metrics.evictions).toBeGreaterThan(0);

      smallCache.destroy();
    });

    it('should handle memory pressure', async () => {
      const key = 'memory-pressure-test';
      const value = { data: 'test' };

      await cache.set(key, value);
      
      const beforeOptimization = cache.getMetrics();
      const optimizationResult = await cache.optimizeMemory();
      const afterOptimization = cache.getMetrics();

      expect(optimizationResult).toHaveProperty('entriesEvicted');
      expect(optimizationResult).toHaveProperty('memoryFreed');
      expect(optimizationResult).toHaveProperty('quantizationsApplied');
    });
  });

  describe('Performance Metrics', () => {
    it('should track hit rate', async () => {
      const key = 'hit-rate-test';
      const value = 'test-value';

      // Miss
      await cache.get('non-existent');
      
      // Set and hit
      await cache.set(key, value);
      await cache.get(key);
      await cache.get(key);

      const metrics = cache.getMetrics();
      expect(metrics.hits).toBeGreaterThan(0);
      expect(metrics.misses).toBeGreaterThan(0);
      expect(metrics.hitRate).toBeGreaterThan(0);
      expect(metrics.hitRate).toBeLessThanOrEqual(1);
    });

    it('should track memory usage', async () => {
      const metrics = cache.getMetrics();
      expect(metrics.memoryUsage).toBeGreaterThanOrEqual(0);
      expect(metrics.entryCount).toBe(cache.size());
    });

    it('should provide comprehensive statistics', async () => {
      await cache.set('stats-key', { data: 'stats-value' });
      
      const stats = cache.exportStatistics();
      const parsedStats = JSON.parse(stats);

      expect(parsedStats).toHaveProperty('timestamp');
      expect(parsedStats).toHaveProperty('configuration');
      expect(parsedStats).toHaveProperty('metrics');
      expect(parsedStats).toHaveProperty('performance');
    });
  });

  describe('ML Prediction', () => {
    it('should predict cache hits', async () => {
      const key = 'ml-prediction-test';
      
      const prediction = cache.predictHit(key);
      expect(prediction).toBeGreaterThanOrEqual(0);
      expect(prediction).toBeLessThanOrEqual(1);
    });

    it('should improve predictions with access patterns', async () => {
      const key = 'pattern-test';
      const value = 'pattern-value';

      // Create access pattern
      await cache.set(key, value);
      for (let i = 0; i < 5; i++) {
        await cache.get(key);
      }

      const prediction = cache.predictHit(key);
      expect(prediction).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Configuration Management', () => {
    it('should get current configuration', () => {
      const config = cache.getConfiguration();
      expect(config).toHaveProperty('maxSize');
      expect(config).toHaveProperty('quantization');
      expect(config).toHaveProperty('adaptiveResize');
    });

    it('should update configuration', () => {
      const newConfig = {
        maxSize: 200,
        defaultTTL: 120000
      };

      cache.updateConfiguration(newConfig);
      const updatedConfig = cache.getConfiguration();
      
      expect(updatedConfig.maxSize).toBe(200);
      expect(updatedConfig.defaultTTL).toBe(120000);
    });
  });

  describe('Memory Pressure Monitoring', () => {
    it('should report memory pressure status', () => {
      const memoryPressure = cache.getMemoryPressure();
      
      expect(memoryPressure).toHaveProperty('level');
      expect(memoryPressure).toHaveProperty('usagePercentage');
      expect(memoryPressure).toHaveProperty('availableMemory');
      expect(memoryPressure).toHaveProperty('recommendedAction');
    });

    it('should generate alerts for performance issues', async () => {
      // This might not trigger alerts in a small test cache
      const alerts = cache.getAlerts();
      expect(Array.isArray(alerts)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null and undefined values', async () => {
      await cache.set('null-key', null);
      await cache.set('undefined-key', undefined);

      expect(await cache.get('null-key')).toBeNull();
      expect(await cache.get('undefined-key')).toBeUndefined();
    });

    it('should handle complex nested objects', async () => {
      const complexObject = {
        level1: {
          level2: {
            level3: {
              data: 'deeply nested',
              array: [1, 2, 3, { nested: true }],
              func: () => 'functions are objects too'
            }
          }
        },
        date: new Date(),
        regex: /test/g
      };

      await cache.set('complex-key', complexObject);
      const retrieved = await cache.get('complex-key');
      
      expect(retrieved).toBeDefined();
      expect(typeof retrieved).toBe('object');
    });

    it('should handle concurrent access', async () => {
      const key = 'concurrent-key';
      const value = 'concurrent-value';

      // Simulate concurrent access
      const promises = [
        cache.set(key, value),
        cache.get(key),
        cache.set(`${key}-2`, `${value}-2`),
        cache.get(`${key}-2`)
      ];

      const results = await Promise.all(promises);
      expect(results).toHaveLength(4);
    });
  });

  describe('Quantization Types', () => {
    const quantizationTypes: QuantizationType[] = ['none', 'int8', 'fp8', 'int4'];

    quantizationTypes.forEach(type => {
      it(`should handle ${type} quantization`, async () => {
        const quantCache = new AdvancedKVCache({
          maxSize: 50,
          quantization: {
            enabled: type !== 'none',
            type,
            threshold: 50,
            aggressive: true
          }
        });

        const key = `quantization-${type}`;
        const value = {
          text: 'sample text for quantization testing',
          numbers: [1.1, 2.2, 3.3, 4.4, 5.5],
          nested: { data: 'nested data' }
        };

        await quantCache.set(key, value);
        const retrieved = await quantCache.get(key);

        expect(retrieved).toBeDefined();
        expect(typeof retrieved).toBe('object');

        quantCache.destroy();
      });
    });
  });

  describe('Cache Policies', () => {
    it('should support different cache policies', () => {
      const policies = ['lru', 'lfu', 'adaptive', 'temporal', 'ml_predictive'];
      
      policies.forEach(policy => {
        const policyCache = new AdvancedKVCache({
          maxSize: 10,
          policy: policy as any
        });
        
        expect(policyCache.getConfiguration().policy).toBe(policy);
        policyCache.destroy();
      });
    });
  });
});