/**
 * Semaphore implementation for controlling concurrency
 */
export class Semaphore {
  private currentCount: number;
  private maxCount: number;
  private waitingQueue: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
  }> = [];

  constructor(maxCount: number) {
    this.currentCount = 0;
    this.maxCount = maxCount;
  }

  /**
   * Acquire a permit, resolving when one becomes available
   */
  async acquire(): Promise<() => void> {
    return new Promise((resolve, reject) => {
      if (this.currentCount < this.maxCount) {
        this.currentCount++;
        const release = this.createReleaseFunction();
        resolve(release);
      } else {
        this.waitingQueue.push({
          resolve: () => {
            this.currentCount++;
            const release = this.createReleaseFunction();
            resolve(release);
          },
          reject
        });
      }
    });
  }

  /**
   * Try to acquire a permit without waiting
   */
  tryAcquire(): (() => void) | null {
    if (this.currentCount < this.maxCount) {
      this.currentCount++;
      return this.createReleaseFunction();
    }
    return null;
  }

  /**
   * Get current number of acquired permits
   */
  getCurrentCount(): number {
    return this.currentCount;
  }

  /**
   * Get number of waiting requests
   */
  getWaitingCount(): number {
    return this.waitingQueue.length;
  }

  /**
   * Get available permits
   */
  getAvailableCount(): number {
    return this.maxCount - this.currentCount;
  }

  private createReleaseFunction(): () => void {
    let released = false;
    
    return () => {
      if (released) {
        throw new Error('Semaphore permit already released');
      }
      
      released = true;
      this.currentCount--;
      
      if (this.waitingQueue.length > 0) {
        const waiter = this.waitingQueue.shift()!;
        waiter.resolve();
      }
    };
  }
}

/**
 * Resource-aware semaphore that considers system resources
 */
export class ResourceSemaphore extends Semaphore {
  private resourceChecker: () => Promise<boolean>;
  private checkInterval: number;

  constructor(
    maxCount: number,
    resourceChecker: () => Promise<boolean>,
    checkInterval: number = 1000
  ) {
    super(maxCount);
    this.resourceChecker = resourceChecker;
    this.checkInterval = checkInterval;
    this.startResourceMonitoring();
  }

  async acquire(): Promise<() => void> {
    // Check resources before acquiring
    const hasResources = await this.resourceChecker();
    if (!hasResources) {
      throw new Error('Insufficient system resources');
    }
    
    return super.acquire();
  }

  private startResourceMonitoring(): void {
    setInterval(async () => {
      const hasResources = await this.resourceChecker();
      if (!hasResources && this.getCurrentCount() > 0) {
        // Log resource constraint but don't interrupt running tasks
        console.warn('System resources constrained, new tasks will be queued');
      }
    }, this.checkInterval);
  }
}