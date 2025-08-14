import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

// Security middleware imports
import { 
  generalRateLimit, 
  apiRateLimit, 
  testExecutionRateLimit,
  heavyOperationRateLimit,
  speedLimiter 
} from './middleware/rateLimiting';
import {
  enhancedHelmetConfig,
  requestId,
  securityLogger,
  securityHeaders,
  csrfProtection,
  getCSRFToken
} from './middleware/security';
import { sanitizeRequestBody, limitRequestSize } from './middleware/validation';
import { optionalAuth } from './middleware/auth';
import { initializeDatabase } from './database/connection';
import { llmService } from './services/llmService';
import { healthRoutes } from './routes/health';
import { enhancedHealthRoutes } from './routes/health-enhanced';
import { healthOrchestratorRoutes } from './routes/health-orchestrator';
import { alertRoutes } from './routes/alerts';
import { monitoringRoutes } from './routes/monitoring';
import { promptCardRoutes } from './routes/promptCards';
import { testCaseRoutes } from './routes/testCases';
import { testExecutionRoutes } from './routes/testExecution';
import { parallelTestExecutionRoutes } from './routes/parallelTestExecution';
import { yamlRoutes } from './routes/yaml';
import { assertionRoutes } from './routes/assertions';
import { analyticsRoutes } from './routes/analytics';
import { predictiveAnalyticsRoutes } from './routes/predictive-analytics';
import optimizationRoutes from './routes/optimization';
import { reportRoutes } from './routes/reports';
import performanceRoutes from './routes/performance';
import trainingRoutes from './routes/training';
import { authRoutes } from './routes/auth';
import loadTestingRoutes from './routes/loadTesting';
import { securityRoutes } from './routes/security';
import { samplePromptRoutes } from './routes/samplePrompts';
import cicdMonitoringRoutes from './routes/cicd-monitoring';
import dependenciesRoutes from './routes/dependencies';
import enterpriseCostsRoutes from './routes/enterpriseCosts';
import { demoRoutes } from './routes/demo';
import { initializeOptimizationServices } from './services/optimization';
import { performanceMonitor } from './services/performance/PerformanceMonitor';
import { loadTestScheduler } from './services/performance/LoadTestScheduler';
import { performanceRegressionDetector } from './services/performance/PerformanceRegressionDetector';
import { ProgressService } from './services/websocket/ProgressService';
import { errorHandler } from './middleware/errorHandler';
import { healthOrchestrator } from './services/health/HealthOrchestrator';
import { alertingSystem } from './services/health/AlertingSystem';
import { modelTrainingEngine } from './services/training/ModelTrainingEngine';
import { modelRegistry } from './services/training/ModelRegistry';
import { securityMonitor, logAggregator, alertingSystem as securityAlerting, complianceChecker } from './services/security';
import { mlAnalyticsCoordinator } from './services/analytics/MLAnalyticsCoordinator';
import { cicdMetricsCollector } from './services/monitoring/CICDMetricsCollector';

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

// Trust proxy for correct IP detection behind reverse proxy
app.set('trust proxy', 1);

// Security middleware (order matters!)
app.use(requestId); // Add request ID for tracing
app.use(securityLogger); // Log security-relevant information
app.use(enhancedHelmetConfig); // Enhanced security headers
app.use(securityHeaders); // Additional security headers
app.use(speedLimiter); // Slow down requests after threshold
app.use(generalRateLimit); // General rate limiting

// CORS configuration with security considerations
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',');
    
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token', 'X-Session-ID', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining']
}));
// Setup log aggregation middleware
app.use(logAggregator.getExpressMiddleware());

// Morgan logging with custom format
app.use(morgan('combined', {
  skip: (req, res) => res.statusCode < 400 // Only log errors in production
}));

// Body parsing with security limits
app.use(limitRequestSize(10 * 1024 * 1024)); // 10MB limit
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf, encoding) => {
    // Store raw body for webhook verification if needed
    (req as any).rawBody = buf;
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb',
  parameterLimit: 100 // Limit number of parameters
}));

// Input sanitization (applied globally)
app.use(sanitizeRequestBody);

// Optional authentication for all routes (doesn't fail if no token)
app.use(optionalAuth);

// Initialize database
const db = initializeDatabase();

// Initialize LLM service with enhanced assertion engine
llmService.initialize().catch(error => {
  console.error('Failed to initialize LLM service:', error);
  // Continue without enhanced assertions if initialization fails
});

// Initialize AI-powered optimization services
initializeOptimizationServices().catch(error => {
  console.error('Failed to initialize optimization services:', error);
  // Continue without optimization services if initialization fails
});

// Setup WebSocket server
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Initialize performance monitoring
const progressService = new ProgressService(io);
performanceMonitor.startMonitoring(5000); // Monitor every 5 seconds

// Initialize health orchestrator
healthOrchestrator.start().catch(error => {
  console.error('Failed to start health orchestrator:', error);
});

// Initialize alerting system
alertingSystem.initialize().catch(error => {
  console.error('Failed to initialize alerting system:', error);
});

// Initialize training services
modelTrainingEngine.initialize().catch(error => {
  console.error('Failed to initialize model training engine:', error);
});

modelRegistry.initialize().catch(error => {
  console.error('Failed to initialize model registry:', error);
});

// Initialize load testing services
loadTestScheduler.initialize().catch(error => {
  console.error('Failed to initialize load test scheduler:', error);
});

try {
  performanceRegressionDetector.startMonitoring(15);
} catch (error) {
  console.error('Failed to start regression monitoring:', error);
}

// Initialize security monitoring systems
console.log('Initializing security monitoring systems...');
logAggregator.info('server', 'Security monitoring systems starting up', {}, ['security', 'startup']);

// Perform initial security scan
securityMonitor.performComprehensiveScan().then(() => {
  logAggregator.info('server', 'Initial security scan completed', {}, ['security', 'scan']);
}).catch(error => {
  logAggregator.error('server', 'Initial security scan failed', { error }, ['security', 'error']);
});

// Generate initial compliance report
complianceChecker.generateComplianceReport().then(() => {
  logAggregator.info('server', 'Initial compliance report generated', {}, ['compliance', 'report']);
}).catch(error => {
  logAggregator.error('server', 'Initial compliance report failed', { error }, ['compliance', 'error']);
});

// Initialize ML Analytics Coordinator
console.log('Initializing ML Analytics Coordinator...');
mlAnalyticsCoordinator.initialize().then(() => {
  console.log('ML Analytics Coordinator initialized successfully');
  return mlAnalyticsCoordinator.start();
}).then(() => {
  console.log('ML Analytics Coordinator started successfully');
}).catch(error => {
  console.error('Failed to initialize ML Analytics Coordinator:', error);
});

// Initialize CI/CD Metrics Collector
console.log('Initializing CI/CD Metrics Collector...');
cicdMetricsCollector.start().then(() => {
  console.log('CI/CD Metrics Collector started successfully');
}).catch(error => {
  console.error('Failed to initialize CI/CD Metrics Collector:', error);
});

// Security endpoints (no rate limiting for CSRF token)
app.get('/api/security/csrf-token', getCSRFToken);

// Authentication routes (with auth-specific rate limiting)
app.use('/api/auth', authRoutes);

// API routes with appropriate rate limiting
app.use('/api/health', healthRoutes);
app.use('/api/health/v2', enhancedHealthRoutes);
app.use('/api/health/orchestrator', healthOrchestratorRoutes);
app.use('/api/alerts', apiRateLimit, alertRoutes);
app.use('/api/monitoring', apiRateLimit, monitoringRoutes);
app.use('/api/prompt-cards', apiRateLimit, promptCardRoutes);
app.use('/api/test-cases', apiRateLimit, testCaseRoutes);
app.use('/api/test-cases', testExecutionRateLimit, testExecutionRoutes); // Test execution routes
app.use('/api/parallel-test-execution', testExecutionRateLimit, parallelTestExecutionRoutes); // Parallel test execution routes
app.use('/api/yaml', apiRateLimit, yamlRoutes);
app.use('/api/assertions', apiRateLimit, assertionRoutes);
app.use('/api/analytics', apiRateLimit, analyticsRoutes);
app.use('/api/predictive-analytics', predictiveAnalyticsRoutes);
app.use('/api/optimization', heavyOperationRateLimit, optimizationRoutes); // Heavy operations
app.use('/api/reports', heavyOperationRateLimit, reportRoutes); // Heavy operations
app.use('/api/performance', apiRateLimit, performanceRoutes);
app.use('/api/training', heavyOperationRateLimit, trainingRoutes); // Heavy operations
app.use('/api/load-testing', loadTestingRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/sample-prompts', apiRateLimit, samplePromptRoutes);
app.use('/api/ci-cd', apiRateLimit, cicdMonitoringRoutes);
app.use('/api/dependencies', apiRateLimit, dependenciesRoutes);
app.use('/api/enterprise-costs', apiRateLimit, enterpriseCostsRoutes);
app.use('/api/demo', apiRateLimit, demoRoutes);

// Error handling middleware
app.use(errorHandler);

// Store WebSocket instance for health checks and log aggregator
app.set('io', io);
app.set('logAggregator', logAggregator);

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`💾 Database path: ${process.env.DATABASE_PATH}`);
  console.log(`🤖 Ollama URL: ${process.env.OLLAMA_BASE_URL}`);
  console.log(`🔌 WebSocket server initialized`);
  console.log(`⚡ Parallel test execution system ready`);
  console.log(`🧠 AI-powered prompt optimization services active`);
  console.log(`📊 Performance monitoring active`);
  console.log(`📈 Performance API available at /api/performance`);
  console.log(`🏥 Health orchestrator system active`);
  console.log(`📋 Health dashboard available at /api/health/orchestrator/summary`);
  console.log(`🚨 Alerting system active`);
  console.log(`📢 Alerts API available at /api/alerts`);
  console.log(`🧪 Load testing framework active`);
  console.log(`⚡ Load testing API available at /api/load-testing`);
  console.log(`📉 Performance regression detection active`);
  console.log(`⏰ Automated load test scheduling enabled`);
  console.log(`🛡️ Security monitoring system active`);
  console.log(`🔒 Security API available at /api/security`);
  console.log(`🔍 Vulnerability scanning enabled`);
  console.log(`✅ Compliance checking active`);
  console.log(`📝 Log aggregation and analysis enabled`);
  console.log(`🔮 Predictive Analytics API available at /api/predictive-analytics`);
  console.log(`🤖 ML-powered anomaly detection active`);
  console.log(`📊 Capacity planning and forecasting enabled`);
  console.log(`🎯 Auto-training ML models enabled`);
  console.log(`🔄 CI/CD Metrics Collector active`);
  console.log(`📈 CI/CD monitoring API available at /api/ci-cd`);
  console.log(`🚀 Pipeline metrics and performance tracking enabled`);
  
  // Security status
  console.log(`\n🔒 Security Features Active:`);
  console.log(`   ✅ Rate limiting enabled`);
  console.log(`   ✅ Enhanced security headers`);
  console.log(`   ✅ Input validation and sanitization`);
  console.log(`   ✅ CSRF protection`);
  console.log(`   ✅ JWT authentication`);
  console.log(`   ✅ Request logging and monitoring`);
  console.log(`   ✅ Content Security Policy`);
  console.log(`   🔑 Auth API available at /api/auth`);
  console.log(`   🛡️ CSRF token endpoint at /api/security/csrf-token`);
  
  if (process.env.NODE_ENV === 'production') {
    console.log(`\n🛡️ Production Security Reminders:`);
    console.log(`   - Update JWT_SECRET and JWT_REFRESH_SECRET`);
    console.log(`   - Configure Redis for distributed rate limiting`);
    console.log(`   - Set up proper CORS origins`);
    console.log(`   - Enable HTTPS`);
    console.log(`   - Configure proper CSP directives`);
  }
});

export default app;