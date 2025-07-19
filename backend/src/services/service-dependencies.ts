/**
 * Service Dependency Mapping Configuration
 * 
 * This file defines the dependency relationships between services in the system.
 * Used by the Health Orchestrator for dependency checking and cascade failure prevention.
 */

export interface ServiceDependency {
  name: string;
  dependencies: string[];
  criticalService: boolean;
  fallbackAvailable: boolean;
  maxToleratedDowntime: number; // in milliseconds
  retryPolicy: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
  };
}

export const SERVICE_DEPENDENCIES: Record<string, ServiceDependency> = {
  // Core Infrastructure
  database: {
    name: 'database',
    dependencies: [],
    criticalService: true,
    fallbackAvailable: false,
    maxToleratedDowntime: 0, // No downtime tolerated
    retryPolicy: {
      maxRetries: 5,
      retryDelay: 1000,
      backoffMultiplier: 2
    }
  },

  redis: {
    name: 'redis',
    dependencies: [],
    criticalService: true,
    fallbackAvailable: true, // In-memory cache fallback
    maxToleratedDowntime: 30000, // 30 seconds
    retryPolicy: {
      maxRetries: 3,
      retryDelay: 1000,
      backoffMultiplier: 1.5
    }
  },

  // AI/ML Services
  ollama: {
    name: 'ollama',
    dependencies: [],
    criticalService: true,
    fallbackAvailable: true, // Mock responses fallback
    maxToleratedDowntime: 60000, // 1 minute
    retryPolicy: {
      maxRetries: 3,
      retryDelay: 2000,
      backoffMultiplier: 2
    }
  },

  'model-health': {
    name: 'model-health',
    dependencies: ['ollama'],
    criticalService: false,
    fallbackAvailable: true, // Disable AI features gracefully
    maxToleratedDowntime: 300000, // 5 minutes
    retryPolicy: {
      maxRetries: 2,
      retryDelay: 5000,
      backoffMultiplier: 2
    }
  },

  // Application Services
  backend: {
    name: 'backend',
    dependencies: ['database', 'ollama', 'redis'],
    criticalService: true,
    fallbackAvailable: false,
    maxToleratedDowntime: 5000, // 5 seconds
    retryPolicy: {
      maxRetries: 3,
      retryDelay: 1000,
      backoffMultiplier: 1.5
    }
  },

  frontend: {
    name: 'frontend',
    dependencies: ['backend'],
    criticalService: true,
    fallbackAvailable: false,
    maxToleratedDowntime: 10000, // 10 seconds
    retryPolicy: {
      maxRetries: 2,
      retryDelay: 2000,
      backoffMultiplier: 2
    }
  }
};

/**
 * Get all dependencies for a service (including transitive dependencies)
 */
export function getAllDependencies(serviceName: string): string[] {
  const visited = new Set<string>();
  const dependencies: string[] = [];

  function collectDependencies(name: string) {
    if (visited.has(name)) return;
    visited.add(name);

    const service = SERVICE_DEPENDENCIES[name];
    if (service) {
      for (const dep of service.dependencies) {
        collectDependencies(dep);
        if (!dependencies.includes(dep)) {
          dependencies.push(dep);
        }
      }
    }
  }

  collectDependencies(serviceName);
  return dependencies;
}

/**
 * Check if a service has any critical dependencies
 */
export function hasCriticalDependencies(serviceName: string): boolean {
  const deps = getAllDependencies(serviceName);
  return deps.some(dep => SERVICE_DEPENDENCIES[dep]?.criticalService);
}