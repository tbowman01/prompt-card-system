import { EventEmitter } from 'events';

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',       // Normal operation
  OPEN = 'OPEN',           // Circuit is open, requests fail fast
  HALF_OPEN = 'HALF_OPEN'  // Testing if service has recovered
}

interface CircuitBreakerConfig {
  failureThreshold: number;    // Number of failures before opening
  resetTimeout: number;        // Time to wait before trying again (ms)
  monitoringPeriod: number;    // Time window for failure counting (ms)
  successThreshold: number;    // Successes needed to close from half-open
}

interface CircuitBreakerStats {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  nextAttempt: Date | null;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
  uptime: number;
  lastFailure: Date | null;
  lastSuccess: Date | null;
}

export class CircuitBreaker extends EventEmitter {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private nextAttempt: Date | null = null;
  private config: CircuitBreakerConfig;
  private readonly serviceName: string;
  
  // Statistics
  private totalRequests = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private lastFailure: Date | null = null;
  private lastSuccess: Date | null = null;
  private startTime = new Date();

  constructor(serviceName: string, config: Partial<CircuitBreakerConfig> = {}) {
    super();
    this.serviceName = serviceName;
    this.config = {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      monitoringPeriod: 300000, // 5 minutes
      successThreshold: 3,
      ...config
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.successCount = 0;
        console.log(`🔄 Circuit breaker for ${this.serviceName} moved to HALF_OPEN`);
        this.emit('stateChanged', { 
          serviceName: this.serviceName, 
          state: this.state,
          reason: 'Reset timeout elapsed'
        });
      } else {
        const error = new Error(`Circuit breaker OPEN for ${this.serviceName}. Next attempt: ${this.nextAttempt}`);
        this.emit('requestRejected', { 
          serviceName: this.serviceName, 
          reason: 'Circuit breaker open',
          nextAttempt: this.nextAttempt
        });
        throw error;
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  private onSuccess(): void {
    this.totalSuccesses++;
    this.lastSuccess = new Date();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.reset();
      }
    } else if (this.state === CircuitBreakerState.CLOSED) {
      this.failureCount = 0; // Reset failure count on success
    }

    this.emit('success', { 
      serviceName: this.serviceName, 
      state: this.state,
      successCount: this.successCount
    });
  }

  private onFailure(error: any): void {
    this.totalFailures++;
    this.lastFailure = new Date();
    this.failureCount++;

    this.emit('failure', { 
      serviceName: this.serviceName, 
      state: this.state,
      failureCount: this.failureCount,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      // Any failure in half-open state moves back to open
      this.trip();
    } else if (this.state === CircuitBreakerState.CLOSED) {
      if (this.failureCount >= this.config.failureThreshold) {
        this.trip();
      }
    }
  }

  private trip(): void {
    this.state = CircuitBreakerState.OPEN;
    this.nextAttempt = new Date(Date.now() + this.config.resetTimeout);
    
    console.log(`🚨 Circuit breaker OPENED for ${this.serviceName}. Next attempt: ${this.nextAttempt}`);
    
    this.emit('opened', { 
      serviceName: this.serviceName, 
      failureCount: this.failureCount,
      nextAttempt: this.nextAttempt,
      reason: `Failure threshold reached (${this.config.failureThreshold} failures)`
    });
  }

  private reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = null;
    
    console.log(`✅ Circuit breaker CLOSED for ${this.serviceName} - Service recovered`);
    
    this.emit('closed', { 
      serviceName: this.serviceName,
      reason: `Service recovered (${this.config.successThreshold} successful requests)`
    });
  }

  private shouldAttemptReset(): boolean {
    return this.nextAttempt !== null && new Date() >= this.nextAttempt;
  }

  public getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttempt: this.nextAttempt,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      uptime: Date.now() - this.startTime.getTime(),
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess
    };
  }

  public forceOpen(): void {
    this.state = CircuitBreakerState.OPEN;
    this.nextAttempt = new Date(Date.now() + this.config.resetTimeout);
    
    console.log(`🔧 Circuit breaker MANUALLY OPENED for ${this.serviceName}`);
    
    this.emit('forceOpened', { 
      serviceName: this.serviceName,
      reason: 'Manual intervention'
    });
  }

  public forceClose(): void {
    this.reset();
    
    console.log(`🔧 Circuit breaker MANUALLY CLOSED for ${this.serviceName}`);
    
    this.emit('forceClosed', { 
      serviceName: this.serviceName,
      reason: 'Manual intervention'
    });
  }

  public get isOpen(): boolean {
    return this.state === CircuitBreakerState.OPEN;
  }

  public recordFailure(): void {
    this.onFailure(new Error('Recorded failure'));
  }

  public updateConfig(newConfig: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    this.emit('configUpdated', { 
      serviceName: this.serviceName,
      config: this.config
    });
  }
}

export class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();

  getBreaker(serviceName: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(serviceName)) {
      const breaker = new CircuitBreaker(serviceName, config);
      this.breakers.set(serviceName, breaker);
      
      // Forward events
      breaker.on('opened', (data) => this.emit('breakerOpened', data));
      breaker.on('closed', (data) => this.emit('breakerClosed', data));
      breaker.on('stateChanged', (data) => this.emit('breakerStateChanged', data));
      breaker.on('failure', (data) => this.emit('breakerFailure', data));
      breaker.on('success', (data) => this.emit('breakerSuccess', data));
    }
    
    return this.breakers.get(serviceName)!;
  }

  getAllBreakers(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  getStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    
    for (const [serviceName, breaker] of this.breakers) {
      stats[serviceName] = breaker.getStats();
    }
    
    return stats;
  }

  removeBreaker(serviceName: string): boolean {
    return this.breakers.delete(serviceName);
  }

  clear(): void {
    this.breakers.clear();
  }

  // Event emitter functionality
  private eventEmitter = new EventEmitter();
  
  on(event: string, listener: (...args: any[]) => void): this {
    this.eventEmitter.on(event, listener);
    return this;
  }
  
  emit(event: string, ...args: any[]): boolean {
    return this.eventEmitter.emit(event, ...args);
  }
  
  off(event: string, listener: (...args: any[]) => void): this {
    this.eventEmitter.off(event, listener);
    return this;
  }
}

export const circuitBreakerRegistry = new CircuitBreakerRegistry();