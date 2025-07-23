import { EventEmitter } from 'events';
import { createClient } from 'redis';
import axios from 'axios';
import { db } from '../../database/connection';
import { llmService } from '../llmService';
import { ModelHealthMonitor } from '../models/ModelHealthMonitor';

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
  lastCheck: Date;
  responseTime: number;
  message?: string;
  details?: any;
  dependencies?: string[];
  criticalService: boolean;
}

interface SystemHealth {
  overallStatus: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
  services: Map<string, ServiceHealth>;
  lastFullCheck: Date;
  totalServices: number;
  healthyServices: number;
  degradedServices: number;
  unhealthyServices: number;
  offlineServices: number;
}

interface HealthCheckConfig {
  checkInterval: number;
  timeout: number;
  retries: number;
  retryDelay: number;
  criticalServices: string[];
  dependencies: Record<string, string[]>;
}

export class HealthOrchestrator extends EventEmitter {
  private services: Map<string, ServiceHealth> = new Map();
  private checkIntervals: Map<string, NodeJS.Timeout> = new Map();
  private config: HealthCheckConfig;
  private isRunning = false;
  private modelMonitor?: ModelHealthMonitor;
  private lastFullCheck = new Date(0);
  private fallbackMechanisms: Map<string, () => Promise<any>> = new Map();
  private circuitBreakers: Map<string, { isOpen: boolean; failures: number; lastFailure: Date }> = new Map();

  constructor(config: Partial<HealthCheckConfig> = {}) {
    super();
    
    this.config = {
      checkInterval: 30000, // 30 seconds
      timeout: 5000, // 5 seconds
      retries: 3,
      retryDelay: 1000, // 1 second
      criticalServices: ['database', 'ollama', 'frontend', 'backend'],
      dependencies: {
        'backend': ['database', 'ollama', 'redis'],
        'frontend': ['backend'],
        'model-health': ['ollama'],
        'websocket': ['backend', 'redis'],
        'prometheus': ['backend'],
        'grafana': ['prometheus']
      },
      ...config
    };

    this.initializeServices();
    this.initializeFallbackMechanisms();
    this.initializeCircuitBreakers();
  }

  private initializeServices() {
    // Define all services to monitor
    const servicesConfig = [
      {
        name: 'database',
        criticalService: true,
        dependencies: []
      },
      {
        name: 'redis', 
        criticalService: true,
        dependencies: []
      },
      {
        name: 'ollama',
        criticalService: true,
        dependencies: []
      },
      {
        name: 'frontend',
        criticalService: true,
        dependencies: ['backend']
      },
      {
        name: 'backend',
        criticalService: true,
        dependencies: ['database', 'ollama', 'redis']
      },
      {
        name: 'websocket',
        criticalService: false,
        dependencies: ['backend', 'redis']
      },
      {
        name: 'model-health',
        criticalService: false,
        dependencies: ['ollama']
      },
      {
        name: 'prometheus',
        criticalService: false,
        dependencies: ['backend']
      },
      {
        name: 'grafana',
        criticalService: false,
        dependencies: ['prometheus']
      },
      {
        name: 'model-init',
        criticalService: false,
        dependencies: ['ollama']
      }
    ];

    // Initialize service health status
    for (const serviceConfig of servicesConfig) {
      const service: ServiceHealth = {
        name: serviceConfig.name,
        status: 'offline',
        lastCheck: new Date(0),
        responseTime: 0,
        dependencies: serviceConfig.dependencies,
        criticalService: serviceConfig.criticalService
      };
      
      this.services.set(serviceConfig.name, service);
    }
  }

  private initializeFallbackMechanisms(): void {
    // Fallback for LLM/Ollama service - use mock responses
    this.fallbackMechanisms.set('ollama', async () => ({
      status: 'degraded',
      message: 'Using fallback mode - Ollama unavailable',
      details: {
        fallbackMode: true,
        capabilities: ['text-completion-mock', 'chat-mock'],
        note: 'AI features will use mock responses'
      }
    }));

    // Fallback for Redis - use in-memory cache
    this.fallbackMechanisms.set('redis', async () => ({
      status: 'degraded', 
      message: 'Using in-memory cache - Redis unavailable',
      details: {
        fallbackMode: true,
        cacheType: 'memory',
        note: 'Session data will not persist across restarts'
      }
    }));

    // Fallback for model health - disable AI features gracefully
    this.fallbackMechanisms.set('model-health', async () => ({
      status: 'degraded',
      message: 'AI features disabled - Model health monitoring unavailable',
      details: {
        fallbackMode: true,
        aiFeatures: 'disabled',
        note: 'Manual testing mode available'
      }
    }));
  }

  private initializeCircuitBreakers(): void {
    const serviceNames = Array.from(this.services.keys());
    for (const serviceName of serviceNames) {
      this.circuitBreakers.set(serviceName, {
        isOpen: false,
        failures: 0,
        lastFailure: new Date(0)
      });
    }
  }

  private async executeWithCircuitBreaker<T>(
    serviceName: string, 
    operation: () => Promise<T>
  ): Promise<T> {
    const breaker = this.circuitBreakers.get(serviceName);
    if (!breaker) throw new Error(`No circuit breaker for service: ${serviceName}`);

    // Check if circuit breaker is open
    if (breaker.isOpen) {
      const timeSinceLastFailure = Date.now() - breaker.lastFailure.getTime();
      const resetTimeout = 60000; // 1 minute

      if (timeSinceLastFailure < resetTimeout) {
        throw new Error(`Circuit breaker open for ${serviceName}`);
      } else {
        // Try to reset circuit breaker
        breaker.isOpen = false;
        breaker.failures = 0;
      }
    }

    try {
      const result = await operation();
      // Success - reset failure count
      breaker.failures = 0;
      return result;
    } catch (error) {
      // Failure - increment counter
      breaker.failures++;
      breaker.lastFailure = new Date();

      // Open circuit breaker after 3 failures
      if (breaker.failures >= 3) {
        breaker.isOpen = true;
        console.warn(`🔓 Circuit breaker opened for ${serviceName} after 3 failures`);
      }

      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('🏥 Health Orchestrator already running');
      return;
    }

    console.log('🏥 Starting Health Orchestrator...');
    this.isRunning = true;

    // Initialize model monitor
    try {
      this.modelMonitor = new ModelHealthMonitor({
        healthCheckInterval: 60000, // 1 minute
        benchmarkInterval: 300000, // 5 minutes
        maxResponseTime: 30000, // 30 seconds
        maxErrorRate: 10, // 10%
        minHealthScore: 70,
        alertThresholds: {
          responseTime: 15000, // 15 seconds
          errorRate: 10, // 10%
          memoryUsage: 85 // 85% memory usage threshold
        }
      });
      
      await this.modelMonitor.initialize();
      console.log('🤖 Model Health Monitor initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Model Health Monitor:', error);
    }

    // Start monitoring all services
    for (const serviceName of this.services.keys()) {
      this.startServiceMonitoring(serviceName);
    }

    // Perform initial full health check
    await this.performFullHealthCheck();

    // Start periodic full system health checks
    const fullCheckInterval = setInterval(() => {
      this.performFullHealthCheck();
    }, this.config.checkInterval * 2); // Less frequent full checks

    this.checkIntervals.set('__full_check__', fullCheckInterval);

    console.log('✅ Health Orchestrator started successfully');
    this.emit('started', { servicesCount: this.services.size });
  }

  private startServiceMonitoring(serviceName: string): void {
    const interval = setInterval(async () => {
      await this.checkServiceHealth(serviceName);
    }, this.config.checkInterval);

    this.checkIntervals.set(serviceName, interval);
  }

  private async checkServiceHealth(serviceName: string): Promise<void> {
    const service = this.services.get(serviceName);
    if (!service) return;

    const startTime = Date.now();
    let newStatus: ServiceHealth['status'] = 'offline';
    let message = '';
    let details: any = {};

    try {
      // Check dependencies first
      const dependencyResults = await this.checkDependencies(serviceName);
      const dependenciesHealthy = dependencyResults.every(dep => dep.healthy);

      if (!dependenciesHealthy) {
        newStatus = 'degraded';
        message = 'Dependencies unhealthy';
        details.dependencyStatus = dependencyResults;
      } else {
        // Perform service-specific health check with circuit breaker and fallback
        try {
          const healthResult = await this.executeWithCircuitBreaker(serviceName, () => 
            this.performServiceCheck(serviceName)
          );
          newStatus = healthResult.status;
          message = healthResult.message || '';
          details = { ...details, ...healthResult.details };
        } catch (circuitBreakerError) {
          // Try fallback mechanism
          const fallback = this.fallbackMechanisms.get(serviceName);
          if (fallback) {
            console.log(`🔄 Using fallback for ${serviceName}:`, circuitBreakerError);
            const fallbackResult = await fallback();
            newStatus = fallbackResult.status;
            message = fallbackResult.message || '';
            details = { ...details, ...fallbackResult.details, circuitBreakerError: circuitBreakerError.message };
          } else {
            throw circuitBreakerError;
          }
        }
      }
    } catch (error) {
      newStatus = 'unhealthy';
      message = error instanceof Error ? error.message : 'Health check failed';
      details.error = message;
    }

    const responseTime = Date.now() - startTime;
    
    // Update service status
    const updatedService: ServiceHealth = {
      ...service,
      status: newStatus,
      lastCheck: new Date(),
      responseTime,
      message,
      details
    };

    const previousStatus = service.status;
    this.services.set(serviceName, updatedService);

    // Emit events for status changes
    if (previousStatus !== newStatus) {
      this.emit('serviceStatusChanged', {
        serviceName,
        previousStatus,
        newStatus,
        responseTime,
        message
      });

      // Emit critical alerts
      if (service.criticalService && newStatus === 'unhealthy') {
        this.emit('criticalServiceDown', {
          serviceName,
          message,
          details,
          timestamp: new Date()
        });
      }
    }
  }

  private async checkDependencies(serviceName: string): Promise<Array<{ name: string; healthy: boolean }>> {
    const dependencies = this.config.dependencies[serviceName] || [];
    const results = [];

    for (const depName of dependencies) {
      const depService = this.services.get(depName);
      const healthy = depService ? ['healthy', 'degraded'].includes(depService.status) : false;
      results.push({ name: depName, healthy });
    }

    return results;
  }

  private async performServiceCheck(serviceName: string): Promise<{
    status: ServiceHealth['status'];
    message?: string;
    details?: any;
  }> {
    switch (serviceName) {
      case 'database':
        return this.checkDatabase();
      case 'redis':
        return this.checkRedis();
      case 'ollama':
        return this.checkOllama();
      case 'frontend':
        return this.checkFrontend();
      case 'backend':
        return this.checkBackend();
      case 'websocket':
        return this.checkWebSocket();
      case 'model-health':
        return this.checkModelHealth();
      case 'prometheus':
        return this.checkPrometheus();
      case 'grafana':
        return this.checkGrafana();
      case 'model-init':
        return this.checkModelInit();
      default:
        return {
          status: 'unhealthy',
          message: `Unknown service: ${serviceName}`
        };
    }
  }

  private async checkDatabase(): Promise<{ status: ServiceHealth['status']; message?: string; details?: any }> {
    try {
      const result = db.prepare('SELECT 1 as test').get() as { test: number };
      const stats = {
        promptCards: db.prepare('SELECT COUNT(*) as count FROM prompt_cards').get() as { count: number },
        testCases: db.prepare('SELECT COUNT(*) as count FROM test_cases').get() as { count: number }
      };

      return {
        status: result?.test === 1 ? 'healthy' : 'unhealthy',
        message: 'Database connection successful',
        details: { stats, path: process.env.DATABASE_PATH }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Database check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async checkRedis(): Promise<{ status: ServiceHealth['status']; message?: string; details?: any }> {
    const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
    
    try {
      const client = createClient({ url: redisUrl });
      await client.connect();
      const result = await client.ping();
      await client.disconnect();

      return {
        status: result === 'PONG' ? 'healthy' : 'unhealthy',
        message: 'Redis connection successful',
        details: { url: redisUrl, ping: result }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Redis check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { url: redisUrl }
      };
    }
  }

  private async checkOllama(): Promise<{ status: ServiceHealth['status']; message?: string; details?: any }> {
    const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://ollama:11434';
    
    try {
      const response = await axios.get(`${ollamaUrl}/api/version`, { timeout: this.config.timeout });
      const modelsResponse = await axios.get(`${ollamaUrl}/api/tags`, { timeout: this.config.timeout });
      const models = modelsResponse.data.models || [];

      return {
        status: models.length > 0 ? 'healthy' : 'degraded',
        message: models.length > 0 ? 'Ollama operational with models' : 'Ollama operational but no models',
        details: {
          url: ollamaUrl,
          version: response.data.version,
          modelCount: models.length,
          models: models.map((m: any) => m.name)
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Ollama check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { url: ollamaUrl }
      };
    }
  }

  private async checkFrontend(): Promise<{ status: ServiceHealth['status']; message?: string; details?: any }> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    try {
      const response = await axios.get(`${frontendUrl}/api/health`, { timeout: this.config.timeout });
      
      return {
        status: response.status === 200 ? 'healthy' : 'degraded',
        message: 'Frontend health check successful',
        details: {
          url: frontendUrl,
          statusCode: response.status,
          frontendStatus: response.data?.status
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Frontend check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { url: frontendUrl }
      };
    }
  }

  private async checkBackend(): Promise<{ status: ServiceHealth['status']; message?: string; details?: any }> {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    
    try {
      const response = await axios.get(`${backendUrl}/api/health/v2`, { timeout: this.config.timeout });
      
      return {
        status: response.data?.status === 'healthy' ? 'healthy' : 'degraded',
        message: 'Backend health check successful',
        details: {
          url: backendUrl,
          statusCode: response.status,
          backendStatus: response.data?.status,
          services: response.data?.services
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Backend check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { url: backendUrl }
      };
    }
  }

  private async checkWebSocket(): Promise<{ status: ServiceHealth['status']; message?: string; details?: any }> {
    // WebSocket health is checked via backend health endpoint
    // This is a simplified check - in production you might want to test actual WebSocket connection
    return {
      status: 'healthy',
      message: 'WebSocket service assumed healthy (checked via backend)',
      details: { note: 'Indirect check via backend service' }
    };
  }

  private async checkModelHealth(): Promise<{ status: ServiceHealth['status']; message?: string; details?: any }> {
    if (!this.modelMonitor) {
      return {
        status: 'offline',
        message: 'Model health monitor not initialized'
      };
    }

    try {
      const monitorStatus = this.modelMonitor.getStatus();
      const healthyModels = this.modelMonitor.getHealthyModels();
      const unhealthyModels = this.modelMonitor.getUnhealthyModels();

      let status: ServiceHealth['status'] = 'healthy';
      if (unhealthyModels.length > healthyModels.length) {
        status = 'degraded';
      }
      if (healthyModels.length === 0 && unhealthyModels.length > 0) {
        status = 'unhealthy';
      }

      return {
        status,
        message: `${healthyModels.length} healthy models, ${unhealthyModels.length} unhealthy`,
        details: {
          ...monitorStatus,
          healthyModels,
          unhealthyModels
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Model health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async checkPrometheus(): Promise<{ status: ServiceHealth['status']; message?: string; details?: any }> {
    const prometheusUrl = process.env.PROMETHEUS_URL || 'http://localhost:9090';
    
    try {
      const response = await axios.get(`${prometheusUrl}/-/healthy`, { timeout: this.config.timeout });
      
      return {
        status: response.status === 200 ? 'healthy' : 'degraded',
        message: 'Prometheus health check successful',
        details: { url: prometheusUrl, statusCode: response.status }
      };
    } catch (error) {
      return {
        status: 'offline',
        message: `Prometheus check failed: ${error instanceof Error ? error.message : 'Service not running'}`,
        details: { url: prometheusUrl }
      };
    }
  }

  private async checkGrafana(): Promise<{ status: ServiceHealth['status']; message?: string; details?: any }> {
    const grafanaUrl = process.env.GRAFANA_URL || 'http://localhost:3002';
    
    try {
      const response = await axios.get(`${grafanaUrl}/api/health`, { timeout: this.config.timeout });
      
      return {
        status: response.status === 200 ? 'healthy' : 'degraded',
        message: 'Grafana health check successful',
        details: { url: grafanaUrl, statusCode: response.status }
      };
    } catch (error) {
      return {
        status: 'offline',
        message: `Grafana check failed: ${error instanceof Error ? error.message : 'Service not running'}`,
        details: { url: grafanaUrl }
      };
    }
  }

  private async checkModelInit(): Promise<{ status: ServiceHealth['status']; message?: string; details?: any }> {
    // Model init is a one-time service that downloads models
    // Check if models exist to infer if init was successful
    try {
      const modelsResponse = await axios.get(`${process.env.OLLAMA_BASE_URL || 'http://ollama:11434'}/api/tags`);
      const models = modelsResponse.data.models || [];
      
      return {
        status: models.length > 0 ? 'healthy' : 'degraded',
        message: models.length > 0 ? 'Models initialized successfully' : 'No models found',
        details: { modelCount: models.length, models: models.map((m: any) => m.name) }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Model init check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async performFullHealthCheck(): Promise<void> {
    console.log('🔍 Performing full system health check...');
    
    // Check all services in parallel
    const checkPromises = Array.from(this.services.keys()).map(serviceName => 
      this.checkServiceHealth(serviceName)
    );
    
    await Promise.allSettled(checkPromises);
    this.lastFullCheck = new Date();
    
    const systemHealth = this.getSystemHealth();
    
    this.emit('fullHealthCheckComplete', {
      systemHealth,
      timestamp: this.lastFullCheck
    });
    
    console.log(`✅ Full health check complete: ${systemHealth.healthyServices}/${systemHealth.totalServices} services healthy`);
  }

  public getSystemHealth(): SystemHealth {
    const services = new Map(this.services);
    const totalServices = services.size;
    let healthyServices = 0;
    let degradedServices = 0;
    let unhealthyServices = 0;
    let offlineServices = 0;

    for (const service of services.values()) {
      switch (service.status) {
        case 'healthy':
          healthyServices++;
          break;
        case 'degraded':
          degradedServices++;
          break;
        case 'unhealthy':
          unhealthyServices++;
          break;
        case 'offline':
          offlineServices++;
          break;
      }
    }

    // Determine overall status
    let overallStatus: SystemHealth['overallStatus'] = 'healthy';
    
    // Check critical services
    const criticalServices = Array.from(services.values()).filter(s => s.criticalService);
    const criticalUnhealthy = criticalServices.filter(s => s.status === 'unhealthy' || s.status === 'offline');
    const criticalDegraded = criticalServices.filter(s => s.status === 'degraded');
    
    if (criticalUnhealthy.length > 0) {
      overallStatus = 'unhealthy';
    } else if (criticalDegraded.length > 0 || unhealthyServices > 0) {
      overallStatus = 'degraded';
    }

    return {
      overallStatus,
      services,
      lastFullCheck: this.lastFullCheck,
      totalServices,
      healthyServices,
      degradedServices,
      unhealthyServices,
      offlineServices
    };
  }

  public getServiceHealth(serviceName: string): ServiceHealth | undefined {
    return this.services.get(serviceName);
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log('🔄 Stopping Health Orchestrator...');
    this.isRunning = false;

    // Clear all intervals
    for (const interval of this.checkIntervals.values()) {
      clearInterval(interval);
    }
    this.checkIntervals.clear();

    // Shutdown model monitor
    if (this.modelMonitor) {
      await this.modelMonitor.shutdown();
    }

    console.log('✅ Health Orchestrator stopped');
    this.emit('stopped');
  }

  public updateConfig(newConfig: Partial<HealthCheckConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ Health Orchestrator configuration updated');
  }

  public getCircuitBreakerStatus(): Map<string, { isOpen: boolean; failures: number; lastFailure: Date }> {
    return new Map(this.circuitBreakers);
  }

  public getFallbackStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    for (const [serviceName] of this.fallbackMechanisms) {
      status[serviceName] = true;
    }
    return status;
  }

  public getServiceDependencyMap(): Record<string, string[]> {
    return { ...this.config.dependencies };
  }

  public async testFallbackMechanism(serviceName: string): Promise<any> {
    const fallback = this.fallbackMechanisms.get(serviceName);
    if (!fallback) {
      throw new Error(`No fallback mechanism configured for ${serviceName}`);
    }
    return await fallback();
  }
}

export const healthOrchestrator = new HealthOrchestrator();