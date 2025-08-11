declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // Server configuration
      NODE_ENV: 'development' | 'production' | 'test';
      PORT?: string;
      HOST?: string;
      
      // Database configuration
      DATABASE_PATH?: string;
      DB_MAX_CONNECTIONS?: string;
      DB_IDLE_TIMEOUT?: string;
      DB_RETRY_ATTEMPTS?: string;
      DB_RETRY_DELAY?: string;
      
      // LLM Service configuration
      OLLAMA_BASE_URL?: string;
      OLLAMA_DEFAULT_MODEL?: string;
      
      // Redis configuration
      REDIS_URL?: string;
      REDIS_PREFIX?: string;
      
      // Security configuration
      SESSION_SECRET?: string;
      JWT_SECRET?: string;
      CSRF_SECRET?: string;
      
      // Rate limiting
      RATE_LIMIT_WINDOW_MS?: string;
      RATE_LIMIT_MAX_REQUESTS?: string;
      API_RATE_LIMIT_MAX?: string;
      
      // Performance and monitoring
      ENABLE_PERFORMANCE_MONITORING?: string;
      METRICS_PORT?: string;
      LOG_LEVEL?: 'error' | 'warn' | 'info' | 'debug';
      
      // Testing configuration
      TEST_TIMEOUT?: string;
      PARALLEL_TEST_WORKERS?: string;
      
      // External services
      WEBHOOK_URL?: string;
      NOTIFICATION_SERVICE_URL?: string;
      
      // Feature flags
      ENABLE_WEBSOCKETS?: string;
      ENABLE_ANALYTICS?: string;
      ENABLE_CACHING?: string;
    }
  }
}

export {};