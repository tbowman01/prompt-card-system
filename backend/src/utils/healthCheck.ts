import axios from 'axios';

interface HealthCheckOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

interface ServiceHealthCheck {
  name: string;
  url: string;
  check: () => Promise<boolean>;
}

export class HealthCheckManager {
  private services: ServiceHealthCheck[] = [];
  
  constructor() {
    this.initializeServices();
  }
  
  private initializeServices() {
    // Ollama health check
    this.services.push({
      name: 'ollama',
      url: process.env.OLLAMA_BASE_URL || 'http://ollama:11434',
      check: async () => {
        try {
          const response = await axios.get(`${process.env.OLLAMA_BASE_URL}/api/version`, {
            timeout: 3000
          });
          return response.status === 200;
        } catch {
          return false;
        }
      }
    });
    
    // Redis health check
    if (process.env.REDIS_URL) {
      this.services.push({
        name: 'redis',
        url: process.env.REDIS_URL,
        check: async () => {
          // This would be implemented with redis client
          // For now, we'll assume it's healthy if configured
          return true;
        }
      });
    }
  }
  
  async checkService(serviceName: string, options: HealthCheckOptions = {}): Promise<boolean> {
    const service = this.services.find(s => s.name === serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not found`);
    }
    
    const { retries = 3, retryDelay = 1000 } = options;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const isHealthy = await service.check();
        if (isHealthy) return true;
      } catch (error) {
        console.error(`Health check failed for ${serviceName} (attempt ${attempt}/${retries}):`, error);
      }
      
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    return false;
  }
  
  async checkAllServices(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    await Promise.all(
      this.services.map(async (service) => {
        results[service.name] = await this.checkService(service.name);
      })
    );
    
    return results;
  }
  
  async waitForServices(timeout = 60000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const results = await this.checkAllServices();
      const allHealthy = Object.values(results).every(status => status);
      
      if (allHealthy) {
        console.log('✅ All services are healthy');
        return;
      }
      
      console.log('⏳ Waiting for services...', results);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    throw new Error(`Services did not become healthy within ${timeout}ms`);
  }
}

export const healthCheckManager = new HealthCheckManager();