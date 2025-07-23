import * as os from 'os';
import { EventEmitter } from 'events';

export interface ResourceRequirement {
  cpu_percent: number;
  memory_mb: number;
  concurrent_tests: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface ResourceUsage {
  cpu_percent: number;
  memory_mb: number;
  memory_total_mb: number;
  active_tests: number;
  queue_length: number;
  load_average: number[];
  timestamp: Date;
}

export interface ResourceLimits {
  max_cpu_percent: number;
  max_memory_mb: number;
  max_concurrent_tests: number;
  emergency_threshold_cpu: number;
  emergency_threshold_memory: number;
}

export class ResourceManager extends EventEmitter {
  private reservedResources: Map<string, ResourceRequirement> = new Map();
  private currentUsage: ResourceUsage;
  private limits: ResourceLimits;
  private monitoringInterval?: NodeJS.Timeout;

  constructor(limits?: Partial<ResourceLimits>) {
    super();
    
    this.limits = {
      max_cpu_percent: 80,
      max_memory_mb: Math.floor(os.totalmem() / 1024 / 1024 * 0.8), // 80% of system memory
      max_concurrent_tests: 10,
      emergency_threshold_cpu: 90,
      emergency_threshold_memory: Math.floor(os.totalmem() / 1024 / 1024 * 0.9), // 90% of system memory
      ...limits
    };

    this.currentUsage = {
      cpu_percent: 0,
      memory_mb: 0,
      memory_total_mb: Math.floor(os.totalmem() / 1024 / 1024),
      active_tests: 0,
      queue_length: 0,
      load_average: os.loadavg(),
      timestamp: new Date()
    };

    this.startMonitoring();
  }

  /**
   * Check if resources are available for the given requirement
   */
  async checkResourceAvailability(requirement: ResourceRequirement): Promise<boolean> {
    await this.updateCurrentUsage();
    
    // Calculate projected usage
    const projectedCpu = this.currentUsage.cpu_percent + requirement.cpu_percent;
    const projectedMemory = this.currentUsage.memory_mb + requirement.memory_mb;
    const projectedTests = this.currentUsage.active_tests + requirement.concurrent_tests;

    // Check against limits
    const cpuOk = projectedCpu <= this.limits.max_cpu_percent;
    const memoryOk = projectedMemory <= this.limits.max_memory_mb;
    const testsOk = projectedTests <= this.limits.max_concurrent_tests;

    // Priority-based overrides
    if (requirement.priority === 'critical') {
      // Critical tasks can use emergency thresholds
      const emergencyCpuOk = projectedCpu <= this.limits.emergency_threshold_cpu;
      const emergencyMemoryOk = projectedMemory <= this.limits.emergency_threshold_memory;
      return emergencyCpuOk && emergencyMemoryOk;
    }

    return cpuOk && memoryOk && testsOk;
  }

  /**
   * Reserve resources for a specific task
   */
  async reserveResources(taskId: string, requirement: ResourceRequirement): Promise<void> {
    const isAvailable = await this.checkResourceAvailability(requirement);
    
    if (!isAvailable) {
      throw new Error(`Insufficient resources for task ${taskId}`);
    }

    this.reservedResources.set(taskId, requirement);
    this.emit('resourcesReserved', { taskId, requirement });
  }

  /**
   * Release resources for a specific task
   */
  async releaseResources(taskId: string): Promise<void> {
    const requirement = this.reservedResources.get(taskId);
    if (requirement) {
      this.reservedResources.delete(taskId);
      this.emit('resourcesReleased', { taskId, requirement });
    }
  }

  /**
   * Get current resource usage
   */
  getCurrentUsage(): ResourceUsage {
    return { ...this.currentUsage };
  }

  /**
   * Get resource limits
   */
  getLimits(): ResourceLimits {
    return { ...this.limits };
  }

  /**
   * Set resource limits
   */
  setLimits(newLimits: Partial<ResourceLimits>): void {
    this.limits = { ...this.limits, ...newLimits };
    this.emit('limitsUpdated', this.limits);
  }

  /**
   * Initialize the resource manager
   */
  async initialize(): Promise<void> {
    await this.updateCurrentUsage();
    console.log('ResourceManager initialized');
  }

  /**
   * Cleanup and shutdown the resource manager
   */
  async cleanup(): Promise<void> {
    this.destroy();
    console.log('ResourceManager cleaned up');
  }

  /**
   * Get reserved resources summary
   */
  getReservedResourcesSummary(): {
    total_reserved_cpu: number;
    total_reserved_memory: number;
    total_reserved_tests: number;
    active_reservations: number;
  } {
    let totalCpu = 0;
    let totalMemory = 0;
    let totalTests = 0;

    for (const requirement of this.reservedResources.values()) {
      totalCpu += requirement.cpu_percent;
      totalMemory += requirement.memory_mb;
      totalTests += requirement.concurrent_tests;
    }

    return {
      total_reserved_cpu: totalCpu,
      total_reserved_memory: totalMemory,
      total_reserved_tests: totalTests,
      active_reservations: this.reservedResources.size
    };
  }

  /**
   * Check if system is under stress
   */
  isSystemUnderStress(): boolean {
    const cpuStress = this.currentUsage.cpu_percent > (this.limits.max_cpu_percent * 0.8);
    const memoryStress = this.currentUsage.memory_mb > (this.limits.max_memory_mb * 0.8);
    const loadStress = this.currentUsage.load_average[0] > os.cpus().length * 0.8;

    return cpuStress || memoryStress || loadStress;
  }

  /**
   * Get optimal concurrency level based on current resources
   */
  getOptimalConcurrency(): number {
    const cpuBasedConcurrency = Math.max(1, Math.floor(
      (this.limits.max_cpu_percent - this.currentUsage.cpu_percent) / 15
    ));
    
    const memoryBasedConcurrency = Math.max(1, Math.floor(
      (this.limits.max_memory_mb - this.currentUsage.memory_mb) / 100
    ));

    return Math.min(
      cpuBasedConcurrency,
      memoryBasedConcurrency,
      this.limits.max_concurrent_tests
    );
  }

  /**
   * Update current resource usage
   */
  private async updateCurrentUsage(): Promise<void> {
    return new Promise((resolve) => {
      // Use a simple CPU usage calculation
      const memUsage = process.memoryUsage();
      const loadAvg = os.loadavg();
      
      // Estimate CPU usage from load average
      const cpuCount = os.cpus().length;
      const estimatedCpu = Math.min(100, (loadAvg[0] / cpuCount) * 100);

      this.currentUsage = {
        cpu_percent: estimatedCpu,
        memory_mb: Math.floor(memUsage.rss / 1024 / 1024),
        memory_total_mb: Math.floor(os.totalmem() / 1024 / 1024),
        active_tests: this.reservedResources.size,
        queue_length: 0, // Will be updated by queue manager
        load_average: loadAvg,
        timestamp: new Date()
      };

      resolve();
    });
  }

  /**
   * Start monitoring system resources
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      await this.updateCurrentUsage();
      
      // Emit events for significant changes
      if (this.isSystemUnderStress()) {
        this.emit('systemStress', this.currentUsage);
      }

      // Check for resource violations
      if (this.currentUsage.cpu_percent > this.limits.emergency_threshold_cpu) {
        this.emit('emergencyThreshold', { type: 'cpu', usage: this.currentUsage });
      }

      if (this.currentUsage.memory_mb > this.limits.emergency_threshold_memory) {
        this.emit('emergencyThreshold', { type: 'memory', usage: this.currentUsage });
      }

      this.emit('resourcesUpdated', this.currentUsage);
    }, 5000); // Update every 5 seconds
  }

  /**
   * Stop monitoring and cleanup
   */
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    this.removeAllListeners();
  }
}