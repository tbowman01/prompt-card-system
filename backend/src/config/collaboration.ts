/**
 * Collaboration Configuration
 * Performance optimizations and settings for enterprise collaboration
 */

export interface CollaborationConfig {
  // Performance settings
  maxConcurrentUsers: number;
  maxDocumentsPerUser: number;
  operationBatchSize: number;
  operationQueueSize: number;
  presenceUpdateInterval: number;
  heartbeatInterval: number;
  
  // Real-time editing
  operationalTransform: {
    maxOperationsInMemory: number;
    checkpointInterval: number;
    conflictResolutionTimeout: number;
    cacheTimeout: number;
  };
  
  // WebSocket settings
  websocket: {
    pingTimeout: number;
    pingInterval: number;
    upgradeTimeout: number;
    maxBufferSize: number;
    compression: boolean;
    
    // Rate limiting
    rateLimit: {
      points: number; // Number of requests
      duration: number; // Per duration in seconds
      blockDuration: number; // Block for duration in seconds
    };
  };
  
  // Redis configuration
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
    keyPrefix: string;
    
    // Connection pool
    maxRetriesPerRequest: number;
    retryDelayOnFailover: number;
    lazyConnect: boolean;
    keepAlive: number;
    
    // Pub/Sub
    pubsub: {
      messageRetention: number;
      maxMessageSize: number;
      compression: boolean;
    };
  };
  
  // Analytics
  analytics: {
    enabled: boolean;
    samplingRate: number;
    metricsInterval: number;
    retentionPeriod: number;
    
    // Batch processing
    batchSize: number;
    flushInterval: number;
  };
  
  // Security
  security: {
    maxSessionDuration: number;
    tokenRefreshThreshold: number;
    encryptSensitiveData: boolean;
    auditTrail: boolean;
    
    // CORS settings
    cors: {
      origins: string[];
      credentials: boolean;
      methods: string[];
    };
  };
  
  // Load balancing
  loadBalancing: {
    strategy: 'round_robin' | 'least_connections' | 'weighted' | 'health_based';
    healthCheckInterval: number;
    maxRetries: number;
    timeout: number;
    
    // Circuit breaker
    circuitBreaker: {
      failureThreshold: number;
      resetTimeout: number;
      monitoringPeriod: number;
    };
  };
  
  // Integrations
  integrations: {
    enabled: boolean;
    rateLimitWindow: number;
    maxRetries: number;
    timeout: number;
    
    // External services
    slack: {
      enabled: boolean;
      rateLimitRpm: number;
    };
    
    teams: {
      enabled: boolean;
      rateLimitRpm: number;
    };
    
    github: {
      enabled: boolean;
      rateLimitRpm: number;
    };
  };
}

// Development configuration
export const developmentConfig: CollaborationConfig = {
  maxConcurrentUsers: 50,
  maxDocumentsPerUser: 10,
  operationBatchSize: 10,
  operationQueueSize: 1000,
  presenceUpdateInterval: 5000,
  heartbeatInterval: 25000,
  
  operationalTransform: {
    maxOperationsInMemory: 500,
    checkpointInterval: 50,
    conflictResolutionTimeout: 5000,
    cacheTimeout: 300000
  },
  
  websocket: {
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 10000,
    maxBufferSize: 1048576, // 1MB
    compression: false,
    
    rateLimit: {
      points: 100,
      duration: 60,
      blockDuration: 60
    }
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: 'collab:dev:',
    
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    lazyConnect: true,
    keepAlive: 30000,
    
    pubsub: {
      messageRetention: 3600, // 1 hour
      maxMessageSize: 1048576, // 1MB
      compression: false
    }
  },
  
  analytics: {
    enabled: true,
    samplingRate: 1.0,
    metricsInterval: 30000,
    retentionPeriod: 604800, // 7 days
    
    batchSize: 100,
    flushInterval: 10000
  },
  
  security: {
    maxSessionDuration: 86400, // 24 hours
    tokenRefreshThreshold: 3600, // 1 hour
    encryptSensitiveData: false,
    auditTrail: true,
    
    cors: {
      origins: ['http://localhost:3000', 'http://localhost:3001'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    }
  },
  
  loadBalancing: {
    strategy: 'health_based',
    healthCheckInterval: 30000,
    maxRetries: 3,
    timeout: 5000,
    
    circuitBreaker: {
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringPeriod: 120000
    }
  },
  
  integrations: {
    enabled: true,
    rateLimitWindow: 60000,
    maxRetries: 3,
    timeout: 30000,
    
    slack: {
      enabled: true,
      rateLimitRpm: 60
    },
    
    teams: {
      enabled: true,
      rateLimitRpm: 60
    },
    
    github: {
      enabled: true,
      rateLimitRpm: 60
    }
  }
};

// Production configuration (optimized for high performance)
export const productionConfig: CollaborationConfig = {
  maxConcurrentUsers: 500,
  maxDocumentsPerUser: 50,
  operationBatchSize: 50,
  operationQueueSize: 10000,
  presenceUpdateInterval: 3000,
  heartbeatInterval: 20000,
  
  operationalTransform: {
    maxOperationsInMemory: 2000,
    checkpointInterval: 100,
    conflictResolutionTimeout: 3000,
    cacheTimeout: 600000
  },
  
  websocket: {
    pingTimeout: 45000,
    pingInterval: 20000,
    upgradeTimeout: 5000,
    maxBufferSize: 2097152, // 2MB
    compression: true,
    
    rateLimit: {
      points: 200,
      duration: 60,
      blockDuration: 300
    }
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'redis-cluster.internal',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: 'collab:prod:',
    
    maxRetriesPerRequest: 5,
    retryDelayOnFailover: 50,
    lazyConnect: false,
    keepAlive: 60000,
    
    pubsub: {
      messageRetention: 86400, // 24 hours
      maxMessageSize: 2097152, // 2MB
      compression: true
    }
  },
  
  analytics: {
    enabled: true,
    samplingRate: 0.1, // Sample 10% for performance
    metricsInterval: 10000,
    retentionPeriod: 2592000, // 30 days
    
    batchSize: 500,
    flushInterval: 5000
  },
  
  security: {
    maxSessionDuration: 43200, // 12 hours
    tokenRefreshThreshold: 1800, // 30 minutes
    encryptSensitiveData: true,
    auditTrail: true,
    
    cors: {
      origins: process.env.ALLOWED_ORIGINS?.split(',') || ['https://app.promptcard.io'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE']
    }
  },
  
  loadBalancing: {
    strategy: 'health_based',
    healthCheckInterval: 15000,
    maxRetries: 3,
    timeout: 3000,
    
    circuitBreaker: {
      failureThreshold: 10,
      resetTimeout: 30000,
      monitoringPeriod: 60000
    }
  },
  
  integrations: {
    enabled: true,
    rateLimitWindow: 60000,
    maxRetries: 5,
    timeout: 15000,
    
    slack: {
      enabled: true,
      rateLimitRpm: 120
    },
    
    teams: {
      enabled: true,
      rateLimitRpm: 120
    },
    
    github: {
      enabled: true,
      rateLimitRpm: 120
    }
  }
};

// Enterprise configuration (maximum performance and features)
export const enterpriseConfig: CollaborationConfig = {
  maxConcurrentUsers: 1000,
  maxDocumentsPerUser: 100,
  operationBatchSize: 100,
  operationQueueSize: 50000,
  presenceUpdateInterval: 2000,
  heartbeatInterval: 15000,
  
  operationalTransform: {
    maxOperationsInMemory: 5000,
    checkpointInterval: 200,
    conflictResolutionTimeout: 2000,
    cacheTimeout: 900000
  },
  
  websocket: {
    pingTimeout: 30000,
    pingInterval: 15000,
    upgradeTimeout: 3000,
    maxBufferSize: 5242880, // 5MB
    compression: true,
    
    rateLimit: {
      points: 500,
      duration: 60,
      blockDuration: 600
    }
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'redis-cluster.internal',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: 'collab:enterprise:',
    
    maxRetriesPerRequest: 10,
    retryDelayOnFailover: 25,
    lazyConnect: false,
    keepAlive: 120000,
    
    pubsub: {
      messageRetention: 259200, // 3 days
      maxMessageSize: 5242880, // 5MB
      compression: true
    }
  },
  
  analytics: {
    enabled: true,
    samplingRate: 1.0,
    metricsInterval: 5000,
    retentionPeriod: 7776000, // 90 days
    
    batchSize: 1000,
    flushInterval: 2000
  },
  
  security: {
    maxSessionDuration: 28800, // 8 hours
    tokenRefreshThreshold: 900, // 15 minutes
    encryptSensitiveData: true,
    auditTrail: true,
    
    cors: {
      origins: process.env.ALLOWED_ORIGINS?.split(',') || ['https://enterprise.promptcard.io'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE']
    }
  },
  
  loadBalancing: {
    strategy: 'weighted',
    healthCheckInterval: 10000,
    maxRetries: 5,
    timeout: 2000,
    
    circuitBreaker: {
      failureThreshold: 15,
      resetTimeout: 20000,
      monitoringPeriod: 30000
    }
  },
  
  integrations: {
    enabled: true,
    rateLimitWindow: 60000,
    maxRetries: 10,
    timeout: 10000,
    
    slack: {
      enabled: true,
      rateLimitRpm: 300
    },
    
    teams: {
      enabled: true,
      rateLimitRpm: 300
    },
    
    github: {
      enabled: true,
      rateLimitRpm: 300
    }
  }
};

// Function to get configuration based on environment
export function getCollaborationConfig(): CollaborationConfig {
  const env = process.env.NODE_ENV || 'development';
  const tier = process.env.COLLABORATION_TIER || 'standard';
  
  if (env === 'production') {
    return tier === 'enterprise' ? enterpriseConfig : productionConfig;
  }
  
  return developmentConfig;
}

// Performance monitoring thresholds
export const performanceThresholds = {
  // Latency thresholds (milliseconds)
  latency: {
    excellent: 25,
    good: 50,
    acceptable: 100,
    poor: 200
  },
  
  // Memory usage thresholds (percentage)
  memory: {
    low: 50,
    medium: 70,
    high: 85,
    critical: 95
  },
  
  // CPU usage thresholds (percentage)
  cpu: {
    low: 40,
    medium: 60,
    high: 80,
    critical: 95
  },
  
  // Connection thresholds
  connections: {
    warning: 0.8, // 80% of max
    critical: 0.95 // 95% of max
  },
  
  // Operation queue thresholds
  operationQueue: {
    warning: 0.7, // 70% of max
    critical: 0.9 // 90% of max
  }
};

// Auto-scaling configuration
export const autoScalingConfig = {
  // Scale up triggers
  scaleUp: {
    cpuThreshold: 70,
    memoryThreshold: 80,
    connectionThreshold: 80,
    latencyThreshold: 100,
    sustainedDuration: 300000 // 5 minutes
  },
  
  // Scale down triggers
  scaleDown: {
    cpuThreshold: 30,
    memoryThreshold: 50,
    connectionThreshold: 40,
    sustainedDuration: 600000 // 10 minutes
  },
  
  // Scaling limits
  limits: {
    minInstances: 1,
    maxInstances: 10,
    scaleUpCooldown: 300000, // 5 minutes
    scaleDownCooldown: 600000 // 10 minutes
  }
};

export default {
  getCollaborationConfig,
  developmentConfig,
  productionConfig,
  enterpriseConfig,
  performanceThresholds,
  autoScalingConfig
};