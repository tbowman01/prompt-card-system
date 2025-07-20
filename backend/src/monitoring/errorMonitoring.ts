/**
 * Advanced Error Monitoring System
 * 
 * Provides comprehensive error tracking, monitoring, and alerting capabilities.
 * Includes error classification, rate limiting, recovery strategies, and integration
 * with external monitoring services.
 */

import { Request, Response, NextFunction } from 'express';
import { getTelemetryManager } from '../telemetry/tracer';
import { SpanStatusCode } from '@opentelemetry/api';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  userAgent?: string;
  ip?: string;
  endpoint?: string;
  method?: string;
  timestamp: Date;
  environment: string;
  serviceVersion: string;
  additional?: Record<string, any>;
}

export interface ErrorFingerprint {
  hash: string;
  type: string;
  message: string;
  stack?: string;
  context: ErrorContext;
}

export interface ErrorMetrics {
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  affectedUsers: Set<string>;
  endpoints: Set<string>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'resolved' | 'ignored';
}

export interface AlertRule {
  id: string;
  name: string;
  condition: (error: ErrorFingerprint, metrics: ErrorMetrics) => boolean;
  action: (error: ErrorFingerprint, metrics: ErrorMetrics) => Promise<void>;
  enabled: boolean;
  rateLimit?: {
    maxAlerts: number;
    timeWindow: number; // in milliseconds
  };
}

export class ErrorMonitoringSystem {
  private errorStore: Map<string, ErrorMetrics> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private recentAlerts: Map<string, number[]> = new Map();
  private errorLogPath: string;
  private config: {
    maxStoredErrors: number;
    errorRetentionDays: number;
    enableStackTrace: boolean;
    enableUserTracking: boolean;
    enablePerformanceImpact: boolean;
    alertingEnabled: boolean;
    environment: string;
    serviceVersion: string;
  };

  constructor(options: Partial<typeof ErrorMonitoringSystem.prototype.config> = {}) {
    this.config = {
      maxStoredErrors: parseInt(process.env.ERROR_MONITORING_MAX_ERRORS || '10000'),
      errorRetentionDays: parseInt(process.env.ERROR_MONITORING_RETENTION_DAYS || '30'),
      enableStackTrace: process.env.ERROR_MONITORING_STACK_TRACE !== 'false',
      enableUserTracking: process.env.ERROR_MONITORING_USER_TRACKING !== 'false',
      enablePerformanceImpact: process.env.ERROR_MONITORING_PERFORMANCE !== 'false',
      alertingEnabled: process.env.ERROR_MONITORING_ALERTS !== 'false',
      environment: process.env.NODE_ENV || 'development',
      serviceVersion: process.env.npm_package_version || '1.0.0',
      ...options,
    };

    this.errorLogPath = path.join(process.cwd(), 'logs', 'errors');
    this.initializeAlertRules();
    this.startMaintenanceTasks();
  }

  /**
   * Initialize default alert rules
   */
  private initializeAlertRules(): void {
    // High error rate alert
    this.addAlertRule({
      id: 'high-error-rate',
      name: 'High Error Rate',
      condition: (error, metrics) => {
        const recentCount = this.getRecentErrorCount(error.hash, 5 * 60 * 1000); // 5 minutes
        return recentCount >= 10;
      },
      action: async (error, metrics) => {
        await this.sendAlert('high-error-rate', {
          title: 'High Error Rate Detected',
          message: `Error "${error.message}" occurred ${metrics.count} times in the last 5 minutes`,
          severity: 'critical',
          error,
          metrics,
        });
      },
      enabled: true,
      rateLimit: {
        maxAlerts: 1,
        timeWindow: 30 * 60 * 1000, // 30 minutes
      },
    });

    // New error type alert
    this.addAlertRule({
      id: 'new-error-type',
      name: 'New Error Type',
      condition: (error, metrics) => metrics.count === 1,
      action: async (error, metrics) => {
        await this.sendAlert('new-error-type', {
          title: 'New Error Type Detected',
          message: `New error type: ${error.type} - ${error.message}`,
          severity: 'medium',
          error,
          metrics,
        });
      },
      enabled: true,
      rateLimit: {
        maxAlerts: 5,
        timeWindow: 60 * 60 * 1000, // 1 hour
      },
    });

    // Critical error alert
    this.addAlertRule({
      id: 'critical-error',
      name: 'Critical Error',
      condition: (error, metrics) => {
        const criticalPatterns = [
          /database.*connection/i,
          /memory.*leak/i,
          /cannot.*connect/i,
          /timeout/i,
          /out.*of.*memory/i,
        ];
        return criticalPatterns.some(pattern => pattern.test(error.message));
      },
      action: async (error, metrics) => {
        await this.sendAlert('critical-error', {
          title: 'Critical System Error',
          message: `Critical error detected: ${error.message}`,
          severity: 'critical',
          error,
          metrics,
        });
      },
      enabled: true,
      rateLimit: {
        maxAlerts: 3,
        timeWindow: 15 * 60 * 1000, // 15 minutes
      },
    });

    // Multiple users affected alert
    this.addAlertRule({
      id: 'multiple-users-affected',
      name: 'Multiple Users Affected',
      condition: (error, metrics) => metrics.affectedUsers.size >= 5,
      action: async (error, metrics) => {
        await this.sendAlert('multiple-users-affected', {
          title: 'Multiple Users Affected',
          message: `Error affecting ${metrics.affectedUsers.size} users: ${error.message}`,
          severity: 'high',
          error,
          metrics,
        });
      },
      enabled: true,
      rateLimit: {
        maxAlerts: 2,
        timeWindow: 20 * 60 * 1000, // 20 minutes
      },
    });
  }

  /**
   * Create error fingerprint for deduplication
   */
  private createFingerprint(error: Error, context: Partial<ErrorContext>): ErrorFingerprint {
    const errorType = error.constructor.name;
    const message = error.message || 'Unknown error';
    const stack = this.config.enableStackTrace ? error.stack : undefined;

    // Create hash for deduplication
    const hashInput = `${errorType}:${message}:${this.extractStackSignature(error.stack)}`;
    const hash = crypto.createHash('sha256').update(hashInput).digest('hex').substring(0, 16);

    const fullContext: ErrorContext = {
      timestamp: new Date(),
      environment: this.config.environment,
      serviceVersion: this.config.serviceVersion,
      ...context,
    };

    return {
      hash,
      type: errorType,
      message,
      stack,
      context: fullContext,
    };
  }

  /**
   * Extract meaningful stack signature for error grouping
   */
  private extractStackSignature(stack?: string): string {
    if (!stack) return '';
    
    // Take first few frames excluding node_modules
    const frames = stack
      .split('\n')
      .slice(1, 6) // Skip error message line, take next 5 frames
      .filter(frame => !frame.includes('node_modules'))
      .map(frame => {
        // Extract file and line number
        const match = frame.match(/at\s+.*\s+\((.+):(\d+):\d+\)/) || frame.match(/at\s+(.+):(\d+):\d+/);
        return match ? `${path.basename(match[1])}:${match[2]}` : frame.trim();
      })
      .slice(0, 3); // Keep top 3 relevant frames

    return frames.join('|');
  }

  /**
   * Record and analyze error
   */
  public async recordError(error: Error, context: Partial<ErrorContext> = {}): Promise<void> {
    try {
      const fingerprint = this.createFingerprint(error, context);
      const existingMetrics = this.errorStore.get(fingerprint.hash);

      const metrics: ErrorMetrics = existingMetrics || {
        count: 0,
        firstSeen: fingerprint.context.timestamp,
        lastSeen: fingerprint.context.timestamp,
        affectedUsers: new Set(),
        endpoints: new Set(),
        severity: this.calculateSeverity(error, context),
        status: 'active',
      };

      // Update metrics
      metrics.count++;
      metrics.lastSeen = fingerprint.context.timestamp;
      
      if (context.userId && this.config.enableUserTracking) {
        metrics.affectedUsers.add(context.userId);
      }
      
      if (context.endpoint) {
        metrics.endpoints.add(context.endpoint);
      }

      this.errorStore.set(fingerprint.hash, metrics);

      // Record in telemetry
      const telemetry = getTelemetryManager();
      if (telemetry) {
        telemetry.recordError(fingerprint.type, context.endpoint || 'unknown', fingerprint.message);
      }

      // Log to file
      await this.logErrorToFile(fingerprint, metrics);

      // Check alert rules
      if (this.config.alertingEnabled) {
        await this.checkAlertRules(fingerprint, metrics);
      }

      // Enforce storage limits
      await this.enforceStorageLimits();

    } catch (monitoringError) {
      console.error('❌ Error in error monitoring system:', monitoringError);
      // Don't let monitoring errors break the application
    }
  }

  /**
   * Calculate error severity based on error type and context
   */
  private calculateSeverity(error: Error, context: Partial<ErrorContext>): 'low' | 'medium' | 'high' | 'critical' {
    const errorMessage = error.message.toLowerCase();
    const errorType = error.constructor.name;

    // Critical patterns
    if (
      errorMessage.includes('database') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('memory') ||
      errorType === 'ReferenceError' ||
      errorType === 'TypeError' && errorMessage.includes('cannot read')
    ) {
      return 'critical';
    }

    // High severity patterns
    if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('forbidden') ||
      errorType === 'ValidationError'
    ) {
      return 'high';
    }

    // Medium severity patterns
    if (
      errorMessage.includes('not found') ||
      errorMessage.includes('invalid') ||
      errorType === 'SyntaxError'
    ) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Log error to file for persistence
   */
  private async logErrorToFile(fingerprint: ErrorFingerprint, metrics: ErrorMetrics): Promise<void> {
    try {
      await fs.mkdir(this.errorLogPath, { recursive: true });
      
      const logEntry = {
        timestamp: fingerprint.context.timestamp.toISOString(),
        hash: fingerprint.hash,
        type: fingerprint.type,
        message: fingerprint.message,
        severity: metrics.severity,
        count: metrics.count,
        context: fingerprint.context,
        stack: fingerprint.stack,
      };

      const logFile = path.join(
        this.errorLogPath,
        `errors-${fingerprint.context.timestamp.toISOString().split('T')[0]}.jsonl`
      );

      await fs.appendFile(logFile, JSON.stringify(logEntry) + '\n');
    } catch (error) {
      console.error('❌ Failed to log error to file:', error);
    }
  }

  /**
   * Check and trigger alert rules
   */
  private async checkAlertRules(fingerprint: ErrorFingerprint, metrics: ErrorMetrics): Promise<void> {
    for (const [ruleId, rule] of this.alertRules) {
      if (!rule.enabled) continue;

      try {
        if (rule.condition(fingerprint, metrics)) {
          // Check rate limiting
          if (rule.rateLimit && !this.canSendAlert(ruleId, rule.rateLimit)) {
            continue;
          }

          await rule.action(fingerprint, metrics);
          this.recordAlert(ruleId);
        }
      } catch (error) {
        console.error(`❌ Error in alert rule ${ruleId}:`, error);
      }
    }
  }

  /**
   * Check if alert can be sent based on rate limiting
   */
  private canSendAlert(ruleId: string, rateLimit: { maxAlerts: number; timeWindow: number }): boolean {
    const now = Date.now();
    const recentAlerts = this.recentAlerts.get(ruleId) || [];
    
    // Remove old alerts outside time window
    const validAlerts = recentAlerts.filter(alertTime => now - alertTime < rateLimit.timeWindow);
    
    return validAlerts.length < rateLimit.maxAlerts;
  }

  /**
   * Record alert sending
   */
  private recordAlert(ruleId: string): void {
    const now = Date.now();
    const recentAlerts = this.recentAlerts.get(ruleId) || [];
    recentAlerts.push(now);
    this.recentAlerts.set(ruleId, recentAlerts);
  }

  /**
   * Get recent error count for a specific error
   */
  private getRecentErrorCount(errorHash: string, timeWindow: number): number {
    // This is a simplified implementation
    // In production, you'd want to track timestamps for each occurrence
    const metrics = this.errorStore.get(errorHash);
    if (!metrics) return 0;
    
    const timeSinceLastSeen = Date.now() - metrics.lastSeen.getTime();
    return timeSinceLastSeen < timeWindow ? metrics.count : 0;
  }

  /**
   * Send alert notification
   */
  private async sendAlert(type: string, alertData: any): Promise<void> {
    try {
      // Log alert
      console.warn(`🚨 ALERT [${type}]: ${alertData.title} - ${alertData.message}`);

      // In production, integrate with external services like:
      // - Slack
      // - PagerDuty
      // - Email
      // - SMS
      // - Discord
      // - Microsoft Teams

      // Example webhook integration
      if (process.env.ALERT_WEBHOOK_URL) {
        const webhook = {
          text: `🚨 ${alertData.title}`,
          attachments: [{
            color: alertData.severity === 'critical' ? 'danger' : 'warning',
            fields: [
              { title: 'Message', value: alertData.message, short: false },
              { title: 'Environment', value: this.config.environment, short: true },
              { title: 'Service', value: 'prompt-card-backend', short: true },
              { title: 'Time', value: new Date().toISOString(), short: true },
            ],
          }],
        };

        // Send webhook (implementation would go here)
        console.log('📤 Sending webhook alert:', webhook);
      }

    } catch (error) {
      console.error('❌ Failed to send alert:', error);
    }
  }

  /**
   * Add custom alert rule
   */
  public addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
  }

  /**
   * Remove alert rule
   */
  public removeAlertRule(ruleId: string): boolean {
    return this.alertRules.delete(ruleId);
  }

  /**
   * Get error statistics
   */
  public getErrorStatistics(): {
    totalErrors: number;
    uniqueErrors: number;
    errorsByType: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    topErrors: Array<{ hash: string; count: number; message: string; severity: string }>;
  } {
    const totalErrors = Array.from(this.errorStore.values()).reduce((sum, metrics) => sum + metrics.count, 0);
    const uniqueErrors = this.errorStore.size;
    
    const errorsByType: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = {};
    
    // This is simplified - in production you'd store error types
    for (const [hash, metrics] of this.errorStore) {
      errorsBySeverity[metrics.severity] = (errorsBySeverity[metrics.severity] || 0) + metrics.count;
    }

    const topErrors = Array.from(this.errorStore.entries())
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 10)
      .map(([hash, metrics]) => ({
        hash,
        count: metrics.count,
        message: 'Error message would be stored separately', // Simplified
        severity: metrics.severity,
      }));

    return {
      totalErrors,
      uniqueErrors,
      errorsByType,
      errorsBySeverity,
      topErrors,
    };
  }

  /**
   * Enforce storage limits to prevent memory issues
   */
  private async enforceStorageLimits(): Promise<void> {
    if (this.errorStore.size <= this.config.maxStoredErrors) return;

    // Remove oldest errors
    const sortedErrors = Array.from(this.errorStore.entries())
      .sort(([, a], [, b]) => a.lastSeen.getTime() - b.lastSeen.getTime());

    const toRemove = sortedErrors.slice(0, sortedErrors.length - this.config.maxStoredErrors);
    
    for (const [hash] of toRemove) {
      this.errorStore.delete(hash);
    }
  }

  /**
   * Start maintenance tasks
   */
  private startMaintenanceTasks(): void {
    // Clean up old errors every hour
    setInterval(() => {
      this.cleanupOldErrors();
    }, 60 * 60 * 1000);

    // Clean up old alerts every 30 minutes
    setInterval(() => {
      this.cleanupOldAlerts();
    }, 30 * 60 * 1000);
  }

  /**
   * Clean up old errors based on retention policy
   */
  private cleanupOldErrors(): void {
    const cutoffTime = new Date(Date.now() - this.config.errorRetentionDays * 24 * 60 * 60 * 1000);
    
    for (const [hash, metrics] of this.errorStore) {
      if (metrics.lastSeen < cutoffTime) {
        this.errorStore.delete(hash);
      }
    }
  }

  /**
   * Clean up old alert records
   */
  private cleanupOldAlerts(): void {
    const now = Date.now();
    
    for (const [ruleId, alerts] of this.recentAlerts) {
      const validAlerts = alerts.filter(alertTime => now - alertTime < 24 * 60 * 60 * 1000); // Keep 24 hours
      
      if (validAlerts.length === 0) {
        this.recentAlerts.delete(ruleId);
      } else {
        this.recentAlerts.set(ruleId, validAlerts);
      }
    }
  }

  /**
   * Express middleware for automatic error monitoring
   */
  public middleware() {
    return (error: Error, req: Request, res: Response, next: NextFunction) => {
      // Extract context from request
      const context: Partial<ErrorContext> = {
        userId: (req as any).user?.id,
        sessionId: req.session?.id || req.sessionID,
        requestId: req.headers['x-request-id'] as string,
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.connection.remoteAddress,
        endpoint: req.originalUrl || req.url,
        method: req.method,
      };

      // Record error asynchronously
      this.recordError(error, context).catch(err => {
        console.error('❌ Failed to record error in monitoring system:', err);
      });

      // Continue with normal error handling
      next(error);
    };
  }
}

// Singleton instance
let errorMonitoringSystem: ErrorMonitoringSystem | null = null;

/**
 * Initialize error monitoring system
 */
export function initializeErrorMonitoring(config: any = {}): ErrorMonitoringSystem {
  if (!errorMonitoringSystem) {
    errorMonitoringSystem = new ErrorMonitoringSystem(config);
    console.log('🔍 Error Monitoring System initialized');
  }
  return errorMonitoringSystem;
}

/**
 * Get error monitoring system instance
 */
export function getErrorMonitoringSystem(): ErrorMonitoringSystem | null {
  return errorMonitoringSystem;
}

export default ErrorMonitoringSystem;