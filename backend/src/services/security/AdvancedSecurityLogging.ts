/**
 * Advanced Security Logging and Monitoring System
 * P2 Enhancement: Comprehensive security event logging with threat detection
 */

import { Request, Response } from 'express';
import winston from 'winston';
import crypto from 'crypto';
import geoip from 'geoip-lite';
import rateLimit from 'express-rate-limit';
import { EventEmitter } from 'events';

export interface SecurityEvent {
  id: string;
  timestamp: Date;
  type: SecurityEventType;
  severity: SecuritySeverity;
  source: {
    ip: string;
    userAgent?: string;
    country?: string;
    city?: string;
  };
  target?: {
    userId?: string;
    endpoint?: string;
    resource?: string;
  };
  details: Record<string, any>;
  risk_score: number;
  session_id?: string;
  correlation_id?: string;
}

export enum SecurityEventType {
  AUTHENTICATION_FAILURE = 'auth_failure',
  AUTHENTICATION_SUCCESS = 'auth_success',
  AUTHORIZATION_FAILURE = 'authz_failure',
  SUSPICIOUS_LOGIN = 'suspicious_login',
  BRUTE_FORCE_ATTEMPT = 'brute_force',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  SQL_INJECTION_ATTEMPT = 'sql_injection',
  XSS_ATTEMPT = 'xss_attempt',
  CSRF_ATTEMPT = 'csrf_attempt',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  DATA_BREACH_ATTEMPT = 'data_breach',
  MALWARE_DETECTED = 'malware_detected',
  ANOMALOUS_BEHAVIOR = 'anomalous_behavior',
  SYSTEM_INTRUSION = 'system_intrusion',
  CONFIGURATION_CHANGE = 'config_change',
  SENSITIVE_DATA_ACCESS = 'sensitive_data_access'
}

export enum SecuritySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ThreatIntelligence {
  ip_reputation: number;
  is_tor: boolean;
  is_proxy: boolean;
  is_vpn: boolean;
  threat_types: string[];
  malware_families: string[];
  last_seen: Date;
}

export interface SecurityMetrics {
  total_events: number;
  events_by_type: Record<SecurityEventType, number>;
  events_by_severity: Record<SecuritySeverity, number>;
  top_threat_sources: Array<{ ip: string; count: number; risk_score: number }>;
  attack_patterns: Array<{ pattern: string; frequency: number }>;
  false_positive_rate: number;
}

export class AdvancedSecurityLogger extends EventEmitter {
  private logger: winston.Logger;
  private eventBuffer: SecurityEvent[] = [];
  private threatIntelCache = new Map<string, ThreatIntelligence>();
  private suspiciousIPs = new Map<string, { count: number; last_seen: Date }>();
  private sessionTracking = new Map<string, { events: SecurityEvent[]; risk_score: number }>();
  private metrics: SecurityMetrics;

  constructor() {
    super();
    this.initializeLogger();
    this.initializeMetrics();
    this.startBackgroundProcessing();
  }

  private initializeLogger(): void {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return JSON.stringify({
            '@timestamp': timestamp,
            level,
            message,
            ...meta,
            service: 'prompt-card-security',
            environment: process.env.NODE_ENV || 'development'
          });
        })
      ),
      transports: [
        new winston.transports.File({
          filename: 'logs/security-events.log',
          maxsize: 50 * 1024 * 1024, // 50MB
          maxFiles: 10,
          tailable: true
        }),
        new winston.transports.File({
          filename: 'logs/security-critical.log',
          level: 'error',
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5
        }),
        new winston.transports.Console({
          level: process.env.NODE_ENV === 'development' ? 'debug' : 'warn',
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });
  }

  private initializeMetrics(): void {
    this.metrics = {
      total_events: 0,
      events_by_type: Object.values(SecurityEventType).reduce((acc, type) => {
        acc[type] = 0;
        return acc;
      }, {} as Record<SecurityEventType, number>),
      events_by_severity: Object.values(SecuritySeverity).reduce((acc, severity) => {
        acc[severity] = 0;
        return acc;
      }, {} as Record<SecuritySeverity, number>),
      top_threat_sources: [],
      attack_patterns: [],
      false_positive_rate: 0
    };
  }

  /**
   * Log a security event with advanced threat detection
   */
  public async logSecurityEvent(
    type: SecurityEventType,
    req: Request,
    details: Record<string, any> = {},
    severity?: SecuritySeverity
  ): Promise<void> {
    const event = await this.createSecurityEvent(type, req, details, severity);
    
    // Add to buffer for batch processing
    this.eventBuffer.push(event);
    
    // Log immediately for critical events
    if (event.severity === SecuritySeverity.CRITICAL) {
      await this.processEventImmediately(event);
    }

    // Update metrics
    this.updateMetrics(event);

    // Emit event for real-time monitoring
    this.emit('securityEvent', event);

    // Check for attack patterns
    await this.detectAttackPatterns(event);
  }

  /**
   * Create a comprehensive security event
   */
  private async createSecurityEvent(
    type: SecurityEventType,
    req: Request,
    details: Record<string, any>,
    severity?: SecuritySeverity
  ): Promise<SecurityEvent> {
    const ip = this.extractClientIP(req);
    const geoData = geoip.lookup(ip);
    
    // Calculate risk score
    const riskScore = await this.calculateRiskScore(type, ip, req, details);
    
    // Determine severity if not provided
    const eventSeverity = severity || this.determineSeverity(type, riskScore);

    const event: SecurityEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type,
      severity: eventSeverity,
      source: {
        ip,
        userAgent: req.get('User-Agent'),
        country: geoData?.country,
        city: geoData?.city
      },
      target: {
        userId: (req as any).user?.id,
        endpoint: `${req.method} ${req.path}`,
        resource: req.params.id || req.body?.id
      },
      details: {
        ...details,
        headers: this.sanitizeHeaders(req.headers),
        query: req.query,
        body_hash: req.body ? crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex') : undefined,
        referrer: req.get('Referrer'),
        origin: req.get('Origin')
      },
      risk_score: riskScore,
      session_id: (req as any).sessionID,
      correlation_id: req.get('X-Correlation-ID') || crypto.randomUUID()
    };

    return event;
  }

  /**
   * Calculate risk score based on multiple factors
   */
  private async calculateRiskScore(
    type: SecurityEventType,
    ip: string,
    req: Request,
    details: Record<string, any>
  ): Promise<number> {
    let score = 0;

    // Base score by event type
    const typeScores = {
      [SecurityEventType.AUTHENTICATION_FAILURE]: 10,
      [SecurityEventType.AUTHENTICATION_SUCCESS]: 0,
      [SecurityEventType.AUTHORIZATION_FAILURE]: 15,
      [SecurityEventType.SUSPICIOUS_LOGIN]: 25,
      [SecurityEventType.BRUTE_FORCE_ATTEMPT]: 40,
      [SecurityEventType.RATE_LIMIT_EXCEEDED]: 20,
      [SecurityEventType.SQL_INJECTION_ATTEMPT]: 60,
      [SecurityEventType.XSS_ATTEMPT]: 50,
      [SecurityEventType.CSRF_ATTEMPT]: 45,
      [SecurityEventType.PRIVILEGE_ESCALATION]: 70,
      [SecurityEventType.DATA_BREACH_ATTEMPT]: 80,
      [SecurityEventType.MALWARE_DETECTED]: 90,
      [SecurityEventType.ANOMALOUS_BEHAVIOR]: 30,
      [SecurityEventType.SYSTEM_INTRUSION]: 95,
      [SecurityEventType.CONFIGURATION_CHANGE]: 35,
      [SecurityEventType.SENSITIVE_DATA_ACCESS]: 25
    };

    score += typeScores[type] || 10;

    // IP reputation
    const threatIntel = await this.getThreatIntelligence(ip);
    score += (100 - threatIntel.ip_reputation) * 0.3;

    // Geographic risk
    const geoData = geoip.lookup(ip);
    const highRiskCountries = ['CN', 'RU', 'KP', 'IR'];
    if (geoData && highRiskCountries.includes(geoData.country)) {
      score += 15;
    }

    // Suspicious IP history
    const suspiciousEntry = this.suspiciousIPs.get(ip);
    if (suspiciousEntry) {
      score += Math.min(suspiciousEntry.count * 5, 30);
    }

    // Time-based factors
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) {
      score += 5; // Off-hours activity
    }

    // User agent anomalies
    const userAgent = req.get('User-Agent');
    if (!userAgent || userAgent.length < 10) {
      score += 10;
    }

    // Request anomalies
    if (details.malformed_request) {
      score += 15;
    }

    if (details.suspicious_headers) {
      score += 20;
    }

    // Frequency-based scoring
    const recentEvents = this.getRecentEventsForIP(ip, 300000); // 5 minutes
    if (recentEvents.length > 10) {
      score += 25;
    }

    return Math.min(score, 100);
  }

  /**
   * Determine severity based on event type and risk score
   */
  private determineSeverity(type: SecurityEventType, riskScore: number): SecuritySeverity {
    const criticalEvents = [
      SecurityEventType.SYSTEM_INTRUSION,
      SecurityEventType.DATA_BREACH_ATTEMPT,
      SecurityEventType.MALWARE_DETECTED
    ];

    if (criticalEvents.includes(type) || riskScore >= 80) {
      return SecuritySeverity.CRITICAL;
    }

    if (riskScore >= 60) {
      return SecuritySeverity.HIGH;
    }

    if (riskScore >= 30) {
      return SecuritySeverity.MEDIUM;
    }

    return SecuritySeverity.LOW;
  }

  /**
   * Process critical events immediately
   */
  private async processEventImmediately(event: SecurityEvent): Promise<void> {
    this.logger.error('CRITICAL SECURITY EVENT', {
      event_id: event.id,
      type: event.type,
      risk_score: event.risk_score,
      source_ip: event.source.ip,
      target: event.target,
      details: event.details
    });

    // Send immediate alerts
    this.emit('criticalSecurityEvent', event);

    // Auto-block if risk score is extremely high
    if (event.risk_score >= 95) {
      this.emit('autoBlock', { ip: event.source.ip, reason: event.type });
    }
  }

  /**
   * Detect attack patterns and coordinated attacks
   */
  private async detectAttackPatterns(event: SecurityEvent): Promise<void> {
    const ip = event.source.ip;
    const timeWindow = 600000; // 10 minutes

    // Check for brute force patterns
    if (event.type === SecurityEventType.AUTHENTICATION_FAILURE) {
      const recentFailures = this.getRecentEventsForIP(ip, timeWindow)
        .filter(e => e.type === SecurityEventType.AUTHENTICATION_FAILURE);
      
      if (recentFailures.length >= 5) {
        await this.logSecurityEvent(
          SecurityEventType.BRUTE_FORCE_ATTEMPT,
          { ip } as any,
          { 
            failure_count: recentFailures.length,
            pattern: 'authentication_brute_force',
            time_window_ms: timeWindow
          },
          SecuritySeverity.HIGH
        );
      }
    }

    // Check for distributed attacks
    const recentSimilarEvents = this.eventBuffer
      .filter(e => 
        e.type === event.type && 
        Date.now() - e.timestamp.getTime() < timeWindow
      );

    if (recentSimilarEvents.length >= 10) {
      const uniqueIPs = new Set(recentSimilarEvents.map(e => e.source.ip));
      if (uniqueIPs.size >= 5) {
        this.emit('distributedAttack', {
          type: event.type,
          event_count: recentSimilarEvents.length,
          unique_ips: uniqueIPs.size,
          pattern: 'distributed_attack'
        });
      }
    }
  }

  /**
   * Get threat intelligence for an IP address
   */
  private async getThreatIntelligence(ip: string): Promise<ThreatIntelligence> {
    // Check cache first
    if (this.threatIntelCache.has(ip)) {
      return this.threatIntelCache.get(ip)!;
    }

    // Default threat intelligence
    const intel: ThreatIntelligence = {
      ip_reputation: 50, // Neutral
      is_tor: false,
      is_proxy: false,
      is_vpn: false,
      threat_types: [],
      malware_families: [],
      last_seen: new Date()
    };

    // In a real implementation, you would query external threat intelligence APIs
    // For now, we'll implement basic reputation scoring
    
    // Private/internal IPs get higher reputation
    if (this.isPrivateIP(ip)) {
      intel.ip_reputation = 90;
    }

    // Cache the result
    this.threatIntelCache.set(ip, intel);
    
    return intel;
  }

  /**
   * Check if IP is private/internal
   */
  private isPrivateIP(ip: string): boolean {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,
      /^192\.168\./,
      /^127\./,
      /^169\.254\./,
      /^::1$/,
      /^fc00:/i,
      /^fe80:/i
    ];

    return privateRanges.some(range => range.test(ip));
  }

  /**
   * Extract client IP from request
   */
  private extractClientIP(req: Request): string {
    return (
      req.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
      req.get('X-Real-IP') ||
      req.get('X-Client-IP') ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      '0.0.0.0'
    );
  }

  /**
   * Sanitize headers for logging
   */
  private sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
    const sanitized = { ...headers };
    
    // Remove sensitive headers
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Get recent events for an IP address
   */
  private getRecentEventsForIP(ip: string, timeWindow: number): SecurityEvent[] {
    const cutoff = Date.now() - timeWindow;
    return this.eventBuffer.filter(event => 
      event.source.ip === ip && 
      event.timestamp.getTime() > cutoff
    );
  }

  /**
   * Update security metrics
   */
  private updateMetrics(event: SecurityEvent): void {
    this.metrics.total_events++;
    this.metrics.events_by_type[event.type]++;
    this.metrics.events_by_severity[event.severity]++;

    // Update top threat sources
    const existingSource = this.metrics.top_threat_sources.find(s => s.ip === event.source.ip);
    if (existingSource) {
      existingSource.count++;
      existingSource.risk_score = Math.max(existingSource.risk_score, event.risk_score);
    } else {
      this.metrics.top_threat_sources.push({
        ip: event.source.ip,
        count: 1,
        risk_score: event.risk_score
      });
    }

    // Keep only top 20 threat sources
    this.metrics.top_threat_sources = this.metrics.top_threat_sources
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }

  /**
   * Start background processing
   */
  private startBackgroundProcessing(): void {
    // Process event buffer every 30 seconds
    setInterval(() => {
      this.processEventBuffer();
    }, 30000);

    // Clean old data every hour
    setInterval(() => {
      this.cleanOldData();
    }, 3600000);

    // Update threat intelligence every 6 hours
    setInterval(() => {
      this.updateThreatIntelligence();
    }, 21600000);
  }

  /**
   * Process buffered events
   */
  private processEventBuffer(): void {
    if (this.eventBuffer.length === 0) return;

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    events.forEach(event => {
      this.logger.info('Security event', {
        event_id: event.id,
        type: event.type,
        severity: event.severity,
        risk_score: event.risk_score,
        source_ip: event.source.ip,
        target: event.target
      });
    });

    // Emit batch processed event
    this.emit('batchProcessed', { count: events.length });
  }

  /**
   * Clean old data to prevent memory leaks
   */
  private cleanOldData(): void {
    const oneDayAgo = Date.now() - 86400000; // 24 hours

    // Clean old events from buffer
    this.eventBuffer = this.eventBuffer.filter(
      event => event.timestamp.getTime() > oneDayAgo
    );

    // Clean old suspicious IPs
    for (const [ip, data] of this.suspiciousIPs.entries()) {
      if (data.last_seen.getTime() < oneDayAgo) {
        this.suspiciousIPs.delete(ip);
      }
    }

    // Clean old threat intelligence cache
    const threeDaysAgo = Date.now() - 259200000; // 3 days
    for (const [ip, intel] of this.threatIntelCache.entries()) {
      if (intel.last_seen.getTime() < threeDaysAgo) {
        this.threatIntelCache.delete(ip);
      }
    }
  }

  /**
   * Update threat intelligence from external sources
   */
  private async updateThreatIntelligence(): Promise<void> {
    // In a real implementation, this would query external threat intelligence APIs
    // For now, we'll just refresh the cache timestamps
    for (const [ip, intel] of this.threatIntelCache.entries()) {
      intel.last_seen = new Date();
    }
  }

  /**
   * Get security metrics
   */
  public getMetrics(): SecurityMetrics {
    return { ...this.metrics };
  }

  /**
   * Generate security report
   */
  public generateSecurityReport(timeframe: number = 86400000): any {
    const cutoff = Date.now() - timeframe;
    const recentEvents = this.eventBuffer.filter(
      event => event.timestamp.getTime() > cutoff
    );

    return {
      timeframe_ms: timeframe,
      total_events: recentEvents.length,
      events_by_severity: recentEvents.reduce((acc, event) => {
        acc[event.severity] = (acc[event.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      top_attack_types: Object.entries(
        recentEvents.reduce((acc, event) => {
          acc[event.type] = (acc[event.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      )
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10),
      high_risk_events: recentEvents.filter(event => event.risk_score >= 70),
      unique_threat_sources: new Set(recentEvents.map(event => event.source.ip)).size,
      generated_at: new Date()
    };
  }

  /**
   * Export security events for external analysis
   */
  public exportSecurityEvents(
    startTime: Date, 
    endTime: Date, 
    eventTypes?: SecurityEventType[]
  ): SecurityEvent[] {
    return this.eventBuffer.filter(event => {
      const timeMatch = event.timestamp >= startTime && event.timestamp <= endTime;
      const typeMatch = !eventTypes || eventTypes.includes(event.type);
      return timeMatch && typeMatch;
    });
  }
}

// Singleton instance
export const securityLogger = new AdvancedSecurityLogger();

// Express middleware for automatic security logging
export const securityLoggingMiddleware = (req: Request, res: Response, next: Function) => {
  const originalSend = res.send;
  
  res.send = function(data: any) {
    const statusCode = res.statusCode;
    
    // Log security-relevant HTTP responses
    if (statusCode === 401) {
      securityLogger.logSecurityEvent(SecurityEventType.AUTHENTICATION_FAILURE, req, {
        status_code: statusCode,
        response_size: data?.length || 0
      });
    } else if (statusCode === 403) {
      securityLogger.logSecurityEvent(SecurityEventType.AUTHORIZATION_FAILURE, req, {
        status_code: statusCode,
        response_size: data?.length || 0
      });
    } else if (statusCode === 429) {
      securityLogger.logSecurityEvent(SecurityEventType.RATE_LIMIT_EXCEEDED, req, {
        status_code: statusCode,
        response_size: data?.length || 0
      });
    }

    return originalSend.call(this, data);
  };

  next();
};

export default AdvancedSecurityLogger;