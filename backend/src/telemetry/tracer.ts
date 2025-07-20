/**
 * OpenTelemetry Tracing Configuration
 * 
 * Provides distributed tracing for the Prompt Card System backend.
 * Integrates with Jaeger for trace visualization and Prometheus for metrics.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { BatchSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { WinstonInstrumentation } from '@opentelemetry/instrumentation-winston';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis-4';
import { SqliteInstrumentation } from '@opentelemetry/instrumentation-sqlite3';
import { SocketIoInstrumentation } from '@opentelemetry/instrumentation-socket.io';
import { trace, metrics, Span, SpanStatusCode } from '@opentelemetry/api';

export interface TelemetryConfig {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  jaegerEndpoint?: string;
  prometheusPort?: number;
  enableConsoleExporter?: boolean;
  enableDetailedLogs?: boolean;
  enableCustomMetrics?: boolean;
}

export class TelemetryManager {
  private sdk: NodeSDK | null = null;
  private config: TelemetryConfig;
  private tracer: any;
  private meter: any;

  // Custom metrics
  private requestCounter: any;
  private requestDuration: any;
  private errorCounter: any;
  private activeConnections: any;
  private dbOperationDuration: any;
  private customMetrics: Map<string, any> = new Map();

  constructor(config: TelemetryConfig) {
    this.config = {
      serviceName: 'prompt-card-backend',
      serviceVersion: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      jaegerEndpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
      prometheusPort: parseInt(process.env.PROMETHEUS_PORT || '9090'),
      enableConsoleExporter: process.env.NODE_ENV === 'development',
      enableDetailedLogs: process.env.TELEMETRY_DETAILED_LOGS === 'true',
      enableCustomMetrics: process.env.TELEMETRY_CUSTOM_METRICS !== 'false',
      ...config
    };
  }

  /**
   * Initialize OpenTelemetry SDK with all instrumentations
   */
  public initialize(): void {
    try {
      // Create resource identification
      const resource = new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: this.config.serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: this.config.serviceVersion,
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: this.config.environment,
        [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: process.env.HOSTNAME || `${this.config.serviceName}-${Date.now()}`,
      });

      // Configure span processors
      const spanProcessors = [];

      // Jaeger exporter for production tracing
      if (this.config.jaegerEndpoint && this.config.environment !== 'test') {
        const jaegerExporter = new JaegerExporter({
          endpoint: this.config.jaegerEndpoint,
        });
        spanProcessors.push(new BatchSpanProcessor(jaegerExporter));
      }

      // Console exporter for development
      if (this.config.enableConsoleExporter) {
        spanProcessors.push(new BatchSpanProcessor(new ConsoleSpanExporter()));
      }

      // Prometheus metrics exporter
      const prometheusExporter = new PrometheusExporter({
        port: this.config.prometheusPort,
        preventServerStart: true, // We'll integrate with main Express server
      });

      // Configure SDK
      this.sdk = new NodeSDK({
        resource,
        spanProcessors,
        metricReader: new PeriodicExportingMetricReader({
          exporter: prometheusExporter,
          exportIntervalMillis: 10000, // Export every 10 seconds
        }),
        instrumentations: [
          getNodeAutoInstrumentations({
            // Disable default console instrumentation to avoid noise
            '@opentelemetry/instrumentation-console': {
              enabled: false,
            },
            // Configure specific instrumentations
            '@opentelemetry/instrumentation-http': {
              enabled: true,
              ignoreBoundariesInstrumentation: false,
            },
            '@opentelemetry/instrumentation-express': {
              enabled: true,
            },
            '@opentelemetry/instrumentation-fs': {
              enabled: this.config.enableDetailedLogs,
            },
          }),
          new WinstonInstrumentation({
            enabled: true,
          }),
          new HttpInstrumentation({
            enabled: true,
            requestHook: (span: Span, request: any) => {
              span.setAttributes({
                'http.request.body.size': request.headers['content-length'] || 0,
                'custom.api.version': request.headers['api-version'] || 'v1',
              });
            },
            responseHook: (span: Span, response: any) => {
              span.setAttributes({
                'http.response.body.size': response.get('content-length') || 0,
              });
            },
          }),
          new ExpressInstrumentation({
            enabled: true,
            requestHook: (span: Span, request: any) => {
              span.setAttributes({
                'express.route': request.route?.path || 'unknown',
                'express.method': request.method,
              });
            },
          }),
          new RedisInstrumentation({
            enabled: true,
          }),
          new SqliteInstrumentation({
            enabled: true,
          }),
          new SocketIoInstrumentation({
            enabled: true,
          }),
        ],
      });

      // Start the SDK
      this.sdk.start();

      // Initialize tracers and meters
      this.tracer = trace.getTracer(this.config.serviceName, this.config.serviceVersion);
      this.meter = metrics.getMeter(this.config.serviceName, this.config.serviceVersion);

      // Initialize custom metrics if enabled
      if (this.config.enableCustomMetrics) {
        this.initializeCustomMetrics();
      }

      console.log(`🔍 OpenTelemetry initialized for ${this.config.serviceName} v${this.config.serviceVersion}`);
      console.log(`📊 Metrics endpoint: http://localhost:${this.config.prometheusPort}/metrics`);
      console.log(`🔗 Jaeger endpoint: ${this.config.jaegerEndpoint}`);

    } catch (error) {
      console.error('❌ Failed to initialize OpenTelemetry:', error);
      throw error;
    }
  }

  /**
   * Initialize custom metrics for business logic monitoring
   */
  private initializeCustomMetrics(): void {
    // HTTP request metrics
    this.requestCounter = this.meter.createCounter('http_requests_total', {
      description: 'Total number of HTTP requests',
    });

    this.requestDuration = this.meter.createHistogram('http_request_duration_seconds', {
      description: 'HTTP request duration in seconds',
      boundaries: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10], // Define latency buckets
    });

    this.errorCounter = this.meter.createCounter('application_errors_total', {
      description: 'Total number of application errors',
    });

    // WebSocket connection metrics
    this.activeConnections = this.meter.createUpDownCounter('websocket_connections_active', {
      description: 'Current number of active WebSocket connections',
    });

    // Database operation metrics
    this.dbOperationDuration = this.meter.createHistogram('database_operation_duration_seconds', {
      description: 'Database operation duration in seconds',
      boundaries: [0.001, 0.01, 0.1, 0.5, 1, 5], // DB operation latency buckets
    });

    // Business metrics
    this.customMetrics.set('prompt_cards_created', this.meter.createCounter('prompt_cards_created_total', {
      description: 'Total number of prompt cards created',
    }));

    this.customMetrics.set('test_executions', this.meter.createCounter('test_executions_total', {
      description: 'Total number of test executions',
    }));

    this.customMetrics.set('ai_model_requests', this.meter.createCounter('ai_model_requests_total', {
      description: 'Total number of AI model requests',
    }));

    this.customMetrics.set('cache_operations', this.meter.createCounter('cache_operations_total', {
      description: 'Total number of cache operations',
    }));
  }

  /**
   * Create a new span for operation tracing
   */
  public startSpan(name: string, attributes?: Record<string, any>): Span {
    const span = this.tracer.startSpan(name, {
      attributes: {
        'service.name': this.config.serviceName,
        'service.version': this.config.serviceVersion,
        ...attributes,
      },
    });
    return span;
  }

  /**
   * Create an active span that automatically manages context
   */
  public withSpan<T>(name: string, fn: (span: Span) => T, attributes?: Record<string, any>): T {
    const span = this.startSpan(name, attributes);
    try {
      const result = trace.setSpan(trace.active(), span).with(fn)(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Record HTTP request metrics
   */
  public recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void {
    if (!this.config.enableCustomMetrics) return;

    this.requestCounter?.add(1, {
      method,
      route,
      status_code: statusCode.toString(),
    });

    this.requestDuration?.record(duration, {
      method,
      route,
      status_code: statusCode.toString(),
    });
  }

  /**
   * Record application error
   */
  public recordError(errorType: string, operation: string, message?: string): void {
    if (!this.config.enableCustomMetrics) return;

    this.errorCounter?.add(1, {
      error_type: errorType,
      operation,
      message: message || 'unknown',
    });
  }

  /**
   * Record WebSocket connection change
   */
  public recordWebSocketConnection(delta: number): void {
    if (!this.config.enableCustomMetrics) return;
    this.activeConnections?.add(delta);
  }

  /**
   * Record database operation metrics
   */
  public recordDatabaseOperation(operation: string, table: string, duration: number, success: boolean): void {
    if (!this.config.enableCustomMetrics) return;

    this.dbOperationDuration?.record(duration, {
      operation,
      table,
      success: success.toString(),
    });
  }

  /**
   * Record custom business metric
   */
  public recordCustomMetric(metricName: string, value: number, attributes?: Record<string, any>): void {
    if (!this.config.enableCustomMetrics) return;

    const metric = this.customMetrics.get(metricName);
    if (metric) {
      metric.add(value, attributes || {});
    }
  }

  /**
   * Get the tracer instance
   */
  public getTracer(): any {
    return this.tracer;
  }

  /**
   * Get the meter instance
   */
  public getMeter(): any {
    return this.meter;
  }

  /**
   * Gracefully shutdown telemetry
   */
  public async shutdown(): Promise<void> {
    try {
      if (this.sdk) {
        await this.sdk.shutdown();
        console.log('🔍 OpenTelemetry shutdown completed');
      }
    } catch (error) {
      console.error('❌ Error during OpenTelemetry shutdown:', error);
    }
  }
}

// Singleton instance
let telemetryManager: TelemetryManager | null = null;

/**
 * Initialize telemetry with configuration
 */
export function initializeTelemetry(config: Partial<TelemetryConfig> = {}): TelemetryManager {
  if (!telemetryManager) {
    telemetryManager = new TelemetryManager(config as TelemetryConfig);
    telemetryManager.initialize();
  }
  return telemetryManager;
}

/**
 * Get the current telemetry manager instance
 */
export function getTelemetryManager(): TelemetryManager | null {
  return telemetryManager;
}

/**
 * Utility function to create traced decorators for class methods
 */
export function traced(operationName?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const spanName = operationName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = function (...args: any[]) {
      const telemetry = getTelemetryManager();
      if (!telemetry) {
        return originalMethod.apply(this, args);
      }

      return telemetry.withSpan(spanName, (span: Span) => {
        span.setAttributes({
          'method.class': target.constructor.name,
          'method.name': propertyKey,
          'method.args.count': args.length,
        });
        return originalMethod.apply(this, args);
      });
    };

    return descriptor;
  };
}

export default TelemetryManager;