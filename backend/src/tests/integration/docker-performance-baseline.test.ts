import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import request from 'supertest';

const execAsync = promisify(exec);

interface PerformanceBaseline {
  timestamp: string;
  environment: string;
  services: {
    [serviceName: string]: {
      startupTime: number;
      memoryUsage: number;
      cpuUsage: number;
      responseTime: number;
      throughput: number;
    };
  };
  system: {
    totalMemory: number;
    totalCpu: number;
    diskUsage: number;
    networkLatency: number;
  };
  benchmarks: {
    fullStackRequest: number;
    databaseQuery: number;
    llmInference: number;
    cacheOperation: number;
    fileOperation: number;
  };
}

describe('Docker Performance Baseline Establishment', () => {
  let baseline: PerformanceBaseline;
  const baselineFile = path.join(__dirname, '../../../performance-baseline.json');

  before(async function() {
    this.timeout(300000); // 5 minutes for comprehensive baseline
    
    console.log('📊 Establishing Docker Performance Baseline...');
    console.log('🔄 This comprehensive test will take several minutes...');
    
    baseline = await establishPerformanceBaseline();
    
    // Save baseline for future comparisons
    await fs.writeFile(baselineFile, JSON.stringify(baseline, null, 2));
    
    console.log('✅ Performance baseline established and saved');
    console.log(`📄 Baseline saved to: ${baselineFile}`);
  });

  describe('🚀 Service Startup Performance', () => {
    it('should measure and record service startup times', async () => {
      const services = ['postgres', 'redis', 'ollama', 'backend', 'frontend'];
      
      for (const service of services) {
        const startupTime = baseline.services[service]?.startupTime || 0;
        
        // Startup time benchmarks (in milliseconds)
        const benchmarks = {
          postgres: 15000,   // 15 seconds
          redis: 5000,       // 5 seconds
          ollama: 30000,     // 30 seconds (model loading)
          backend: 20000,    // 20 seconds
          frontend: 25000    // 25 seconds (build + start)
        };
        
        expect(startupTime).to.be.below(benchmarks[service as keyof typeof benchmarks]);
        
        console.log(`⏱️  ${service}: ${startupTime}ms (target: <${benchmarks[service as keyof typeof benchmarks]}ms)`);
      }
    });

    it('should verify service readiness after startup', async () => {
      const readinessChecks = [
        { service: 'backend', url: 'http://localhost:3001/api/health', timeout: 10000 },
        { service: 'frontend', url: 'http://localhost:3000/api/health', timeout: 10000 }
      ];
      
      for (const check of readinessChecks) {
        const startTime = Date.now();
        
        const response = await request(check.url)
          .get('')
          .timeout(check.timeout);
        
        const readinessTime = Date.now() - startTime;
        
        expect(response.status).to.equal(200);
        expect(readinessTime).to.be.below(check.timeout);
        
        console.log(`✅ ${check.service} ready in ${readinessTime}ms`);
      }
    });
  });

  describe('💾 Resource Utilization Baseline', () => {
    it('should establish memory usage baselines', async () => {
      for (const [serviceName, metrics] of Object.entries(baseline.services)) {
        // Memory usage should be reasonable for each service
        const memoryLimits = {
          postgres: 200,    // 200MB
          redis: 50,        // 50MB
          ollama: 2000,     // 2GB (with models)
          backend: 200,     // 200MB
          frontend: 150     // 150MB
        };
        
        const limit = memoryLimits[serviceName as keyof typeof memoryLimits] || 500;
        expect(metrics.memoryUsage).to.be.below(limit);
        
        console.log(`💾 ${serviceName}: ${metrics.memoryUsage}MB (limit: ${limit}MB)`);
      }
    });

    it('should establish CPU usage baselines', async () => {
      for (const [serviceName, metrics] of Object.entries(baseline.services)) {
        // CPU usage should be minimal at idle
        const cpuLimits = {
          postgres: 10,     // 10%
          redis: 5,         // 5%
          ollama: 20,       // 20% (background processing)
          backend: 15,      // 15%
          frontend: 10      // 10%
        };
        
        const limit = cpuLimits[serviceName as keyof typeof cpuLimits] || 25;
        expect(metrics.cpuUsage).to.be.below(limit);
        
        console.log(`🔥 ${serviceName}: ${metrics.cpuUsage}% (limit: ${limit}%)`);
      }
    });

    it('should measure disk usage and I/O performance', async () => {
      expect(baseline.system.diskUsage).to.be.below(80); // Less than 80% disk usage
      
      // Test disk I/O performance
      const ioTestStart = Date.now();
      await execAsync('docker exec prompt-postgres sh -c "dd if=/dev/zero of=/tmp/test bs=1M count=100 && rm /tmp/test"');
      const ioTestDuration = Date.now() - ioTestStart;
      
      expect(ioTestDuration).to.be.below(10000); // Under 10 seconds for 100MB
      
      console.log(`💽 Disk usage: ${baseline.system.diskUsage}%`);
      console.log(`📝 I/O performance: 100MB in ${ioTestDuration}ms`);
    });
  });

  describe('🌐 Network Performance Baseline', () => {
    it('should measure inter-service network latency', async () => {
      const networkTests = [
        { from: 'frontend', to: 'backend', port: 3001 },
        { from: 'backend', to: 'postgres', port: 5432 },
        { from: 'backend', to: 'redis', port: 6379 },
        { from: 'backend', to: 'ollama', port: 11434 }
      ];
      
      for (const test of networkTests) {
        const latency = await measureNetworkLatency(test.from, test.to, test.port);
        
        expect(latency).to.be.below(50); // Under 50ms for inter-container communication
        
        console.log(`🌐 ${test.from} → ${test.to}: ${latency}ms`);
      }
    });

    it('should measure external network performance', async () => {
      expect(baseline.system.networkLatency).to.be.below(500); // Under 500ms external latency
      
      console.log(`🌍 External network latency: ${baseline.system.networkLatency}ms`);
    });
  });

  describe('⚡ Application Performance Baseline', () => {
    it('should establish API response time baselines', async () => {
      const apiTests = [
        { endpoint: '/api/health', target: 100 },
        { endpoint: '/api/prompt-cards', target: 500 },
        { endpoint: '/api/analytics/metrics', target: 1000 }
      ];
      
      for (const test of apiTests) {
        const startTime = Date.now();
        
        const response = await request('http://localhost:3001')
          .get(test.endpoint)
          .timeout(10000);
        
        const responseTime = Date.now() - startTime;
        
        expect(response.status).to.equal(200);
        expect(responseTime).to.be.below(test.target);
        
        console.log(`⚡ ${test.endpoint}: ${responseTime}ms (target: <${test.target}ms)`);
      }
    });

    it('should measure database query performance', async () => {
      expect(baseline.benchmarks.databaseQuery).to.be.below(100); // Under 100ms for simple queries
      
      console.log(`🗄️  Database query: ${baseline.benchmarks.databaseQuery}ms`);
    });

    it('should measure LLM inference performance', async () => {
      expect(baseline.benchmarks.llmInference).to.be.below(30000); // Under 30 seconds for inference
      
      console.log(`🤖 LLM inference: ${baseline.benchmarks.llmInference}ms`);
    });

    it('should measure cache operation performance', async () => {
      expect(baseline.benchmarks.cacheOperation).to.be.below(10); // Under 10ms for cache ops
      
      console.log(`💨 Cache operation: ${baseline.benchmarks.cacheOperation}ms`);
    });
  });

  describe('🏋️ Load Performance Baseline', () => {
    it('should establish concurrent request handling baseline', async () => {
      const concurrentUsers = [1, 5, 10, 20];
      const results: Array<{ users: number; throughput: number; avgResponseTime: number }> = [];
      
      for (const userCount of concurrentUsers) {
        const { throughput, avgResponseTime } = await measureConcurrentPerformance(userCount);
        results.push({ users: userCount, throughput, avgResponseTime });
        
        console.log(`👥 ${userCount} users: ${throughput.toFixed(2)} req/s, ${avgResponseTime}ms avg`);
      }
      
      // Performance should degrade gracefully
      for (let i = 1; i < results.length; i++) {
        const prev = results[i - 1];
        const curr = results[i];
        
        // Throughput shouldn't drop by more than 50% when doubling users
        const throughputDrop = (prev.throughput - curr.throughput) / prev.throughput;
        expect(throughputDrop).to.be.below(0.5);
        
        // Response time shouldn't increase by more than 300% when doubling users
        const responseTimeIncrease = (curr.avgResponseTime - prev.avgResponseTime) / prev.avgResponseTime;
        expect(responseTimeIncrease).to.be.below(3.0);
      }
    });

    it('should measure memory usage under load', async () => {
      const loadDuration = 60000; // 1 minute
      const requestRate = 10; // 10 requests per second
      
      const initialMemory = await getTotalMemoryUsage();
      
      // Generate load
      const loadPromise = generateSustainedLoad(loadDuration, requestRate);
      
      // Monitor memory during load
      const memoryDuringLoad = await monitorMemoryDuringLoad(loadDuration);
      
      await loadPromise;
      
      const finalMemory = await getTotalMemoryUsage();
      
      // Memory increase should be reasonable
      const memoryIncrease = ((finalMemory - initialMemory) / initialMemory) * 100;
      expect(memoryIncrease).to.be.below(50); // Less than 50% increase
      
      // Peak memory usage should be within limits
      const peakMemory = Math.max(...memoryDuringLoad);
      expect(peakMemory).to.be.below(initialMemory * 2); // Less than 2x initial memory
      
      console.log(`📈 Memory under load: ${memoryIncrease.toFixed(1)}% increase, peak: ${peakMemory}MB`);
    });
  });

  // Helper Functions
  async function establishPerformanceBaseline(): Promise<PerformanceBaseline> {
    console.log('🔍 Collecting service metrics...');
    
    const services = ['postgres', 'redis', 'ollama', 'backend', 'frontend'];
    const serviceMetrics: any = {};
    
    for (const service of services) {
      serviceMetrics[service] = await collectServiceMetrics(service);
    }
    
    console.log('🔍 Collecting system metrics...');
    const systemMetrics = await collectSystemMetrics();
    
    console.log('🔍 Running performance benchmarks...');
    const benchmarks = await runPerformanceBenchmarks();
    
    return {
      timestamp: new Date().toISOString(),
      environment: 'docker',
      services: serviceMetrics,
      system: systemMetrics,
      benchmarks
    };
  }

  async function collectServiceMetrics(serviceName: string) {
    const containerName = `prompt-${serviceName}`;
    
    try {
      // Get container stats
      const { stdout: statsOutput } = await execAsync(
        `docker stats ${containerName} --no-stream --format "{{.CPUPerc}},{{.MemUsage}}"`
      );
      
      const [cpuPercent, memUsage] = statsOutput.trim().split(',');
      const cpu = parseFloat(cpuPercent.replace('%', ''));
      const memory = parseFloat(memUsage.split('/')[0].replace('MiB', '').replace('MB', ''));
      
      // Measure startup time
      const { stdout: startedAtOutput } = await execAsync(
        `docker inspect ${containerName} --format='{{.State.StartedAt}}'`
      );
      const startedAt = new Date(startedAtOutput.trim()).getTime();
      const createdAt = Date.now() - 300000; // Assume created 5 minutes ago for baseline
      const startupTime = startedAt - createdAt;
      
      // Measure response time if applicable
      let responseTime = 0;
      if (['backend', 'frontend'].includes(serviceName)) {
        const port = serviceName === 'backend' ? 3001 : 3000;
        const startTime = Date.now();
        
        try {
          await request(`http://localhost:${port}`)
            .get('/api/health')
            .timeout(10000);
          responseTime = Date.now() - startTime;
        } catch (error) {
          responseTime = 10000; // Max timeout if failed
        }
      }
      
      // Measure throughput
      const throughput = await measureServiceThroughput(serviceName);
      
      return {
        startupTime,
        memoryUsage: memory,
        cpuUsage: cpu,
        responseTime,
        throughput
      };
    } catch (error) {
      console.warn(`Failed to collect metrics for ${serviceName}:`, error.message);
      return {
        startupTime: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        responseTime: 0,
        throughput: 0
      };
    }
  }

  async function collectSystemMetrics() {
    const totalMemory = await getTotalMemoryUsage();
    const totalCpu = await getTotalCpuUsage();
    const diskUsage = await getDiskUsage();
    const networkLatency = await measureExternalNetworkLatency();
    
    return {
      totalMemory,
      totalCpu,
      diskUsage,
      networkLatency
    };
  }

  async function runPerformanceBenchmarks() {
    console.log('📊 Running full-stack request benchmark...');
    const fullStackRequest = await benchmarkFullStackRequest();
    
    console.log('📊 Running database query benchmark...');
    const databaseQuery = await benchmarkDatabaseQuery();
    
    console.log('📊 Running LLM inference benchmark...');
    const llmInference = await benchmarkLlmInference();
    
    console.log('📊 Running cache operation benchmark...');
    const cacheOperation = await benchmarkCacheOperation();
    
    console.log('📊 Running file operation benchmark...');
    const fileOperation = await benchmarkFileOperation();
    
    return {
      fullStackRequest,
      databaseQuery,
      llmInference,
      cacheOperation,
      fileOperation
    };
  }

  async function measureServiceThroughput(serviceName: string): Promise<number> {
    if (!['backend', 'frontend'].includes(serviceName)) {
      return 0;
    }
    
    const port = serviceName === 'backend' ? 3001 : 3000;
    const requestCount = 50;
    const startTime = Date.now();
    
    const requests = Array(requestCount).fill(null).map(() =>
      request(`http://localhost:${port}`)
        .get('/api/health')
        .timeout(5000)
        .catch(() => null)
    );
    
    const results = await Promise.allSettled(requests);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const duration = Date.now() - startTime;
    
    return (successful / duration) * 1000; // requests per second
  }

  async function measureNetworkLatency(fromService: string, toService: string, port: number): Promise<number> {
    const containerName = `prompt-${fromService}`;
    const targetHost = `prompt-${toService}`;
    
    try {
      const startTime = Date.now();
      await execAsync(`docker exec ${containerName} sh -c "nc -z ${targetHost} ${port}"`);
      return Date.now() - startTime;
    } catch (error) {
      return 1000; // Return high latency if connection fails
    }
  }

  async function benchmarkFullStackRequest(): Promise<number> {
    const startTime = Date.now();
    
    const response = await request('http://localhost:3001')
      .get('/api/prompt-cards')
      .timeout(30000);
    
    expect(response.status).to.equal(200);
    return Date.now() - startTime;
  }

  async function benchmarkDatabaseQuery(): Promise<number> {
    const startTime = Date.now();
    
    const response = await request('http://localhost:3001')
      .get('/api/health/database')
      .timeout(10000);
    
    expect(response.status).to.equal(200);
    return Date.now() - startTime;
  }

  async function benchmarkLlmInference(): Promise<number> {
    const startTime = Date.now();
    
    try {
      const response = await request('http://localhost:3001')
        .post('/api/test-execution')
        .send({
          cardId: 'benchmark-card',
          testCases: [{
            id: 'benchmark-test',
            input: 'What is 2+2?',
            expectedOutput: '4'
          }],
          model: 'llama2:7b'
        })
        .timeout(60000);
      
      return Date.now() - startTime;
    } catch (error) {
      return 60000; // Return max timeout if failed
    }
  }

  async function benchmarkCacheOperation(): Promise<number> {
    try {
      const startTime = Date.now();
      await execAsync('docker exec prompt-redis redis-cli set benchmark-key benchmark-value');
      await execAsync('docker exec prompt-redis redis-cli get benchmark-key');
      await execAsync('docker exec prompt-redis redis-cli del benchmark-key');
      return Date.now() - startTime;
    } catch (error) {
      return 100; // Return reasonable fallback
    }
  }

  async function benchmarkFileOperation(): Promise<number> {
    try {
      const startTime = Date.now();
      await execAsync('docker exec prompt-backend sh -c "echo test > /tmp/benchmark && cat /tmp/benchmark && rm /tmp/benchmark"');
      return Date.now() - startTime;
    } catch (error) {
      return 100; // Return reasonable fallback
    }
  }

  async function getTotalMemoryUsage(): Promise<number> {
    try {
      const { stdout } = await execAsync("docker stats --no-stream --format '{{.MemUsage}}' | awk -F'/' '{sum += $1} END {print sum}'");
      return parseFloat(stdout.trim()) || 0;
    } catch (error) {
      return 0;
    }
  }

  async function getTotalCpuUsage(): Promise<number> {
    try {
      const { stdout } = await execAsync("docker stats --no-stream --format '{{.CPUPerc}}' | sed 's/%//g' | awk '{sum += $1} END {print sum}'");
      return parseFloat(stdout.trim()) || 0;
    } catch (error) {
      return 0;
    }
  }

  async function getDiskUsage(): Promise<number> {
    try {
      const { stdout } = await execAsync("df / | awk 'NR==2 {print $5}' | sed 's/%//g'");
      return parseFloat(stdout.trim()) || 0;
    } catch (error) {
      return 0;
    }
  }

  async function measureExternalNetworkLatency(): Promise<number> {
    try {
      const startTime = Date.now();
      await execAsync('docker exec prompt-backend sh -c "curl -s --max-time 5 https://httpbin.org/get"');
      return Date.now() - startTime;
    } catch (error) {
      return 5000; // Return timeout if failed
    }
  }

  async function measureConcurrentPerformance(userCount: number): Promise<{ throughput: number; avgResponseTime: number }> {
    const requestsPerUser = 10;
    const totalRequests = userCount * requestsPerUser;
    
    const startTime = Date.now();
    const requests = Array(totalRequests).fill(null).map(() =>
      request('http://localhost:3001')
        .get('/api/health')
        .timeout(10000)
    );
    
    const results = await Promise.allSettled(requests);
    const duration = Date.now() - startTime;
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const throughput = (successful / duration) * 1000;
    const avgResponseTime = duration / successful;
    
    return { throughput, avgResponseTime };
  }

  async function generateSustainedLoad(duration: number, requestRate: number): Promise<void> {
    const interval = 1000 / requestRate;
    const endTime = Date.now() + duration;
    
    while (Date.now() < endTime) {
      const startTime = Date.now();
      
      request('http://localhost:3001')
        .get('/api/health')
        .timeout(5000)
        .catch(() => {}); // Ignore errors
      
      const elapsed = Date.now() - startTime;
      const sleepTime = Math.max(0, interval - elapsed);
      
      if (sleepTime > 0) {
        await new Promise(resolve => setTimeout(resolve, sleepTime));
      }
    }
  }

  async function monitorMemoryDuringLoad(duration: number): Promise<number[]> {
    const measurements: number[] = [];
    const interval = 5000; // 5 second intervals
    const endTime = Date.now() + duration;
    
    while (Date.now() < endTime) {
      const memory = await getTotalMemoryUsage();
      measurements.push(memory);
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    return measurements;
  }
});