import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { securityMonitor, SecurityEvent } from './SecurityMonitor';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  source: string;
  message: string;
  metadata?: any;
  tags: string[];
  correlationId?: string;
}

export interface LogAnalysis {
  id: string;
  timestamp: Date;
  timeRange: { start: Date; end: Date };
  summary: {
    totalLogs: number;
    errorCount: number;
    warningCount: number;
    criticalCount: number;
    uniqueSources: number;
  };
  patterns: {
    type: 'security' | 'performance' | 'error' | 'anomaly';
    pattern: string;
    occurrences: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    firstSeen: Date;
    lastSeen: Date;
    samples: LogEntry[];
  }[];
  recommendations: string[];
  securityEvents: SecurityEvent[];
}

export interface LogFilter {
  level?: LogEntry['level'][];
  source?: string[];
  tags?: string[];
  timeRange?: { start: Date; end: Date };
  searchTerm?: string;
  limit?: number;
}

export class LogAggregator extends EventEmitter {
  private logs: LogEntry[] = [];
  private analyses: LogAnalysis[] = [];
  private analysisInterval?: NodeJS.Timeout;
  private logCleanupInterval?: NodeJS.Timeout;
  private logFile?: string;

  constructor(private options: {
    maxLogs?: number;
    logRetentionDays?: number;
    analysisIntervalMinutes?: number;
    enableFileLogging?: boolean;
    logFilePath?: string;
    enableRealTimeAnalysis?: boolean;
  } = {}) {
    super();
    
    const {
      maxLogs = 50000,
      logRetentionDays = 30,
      analysisIntervalMinutes = 15,
      enableFileLogging = true,
      logFilePath = './logs/security.log',
      enableRealTimeAnalysis = true
    } = options;

    this.options = {
      maxLogs,
      logRetentionDays,
      analysisIntervalMinutes,
      enableFileLogging,
      logFilePath,
      enableRealTimeAnalysis
    };

    if (enableFileLogging) {
      this.logFile = logFilePath;
      this.ensureLogDirectory();
    }

    this.setupLogCleanup();
    
    if (enableRealTimeAnalysis) {
      this.startPeriodicAnalysis();
    }

    // Listen to security events
    securityMonitor.on('securityEvent', (event: SecurityEvent) => {
      this.logSecurityEvent(event);
    });

    // Set up Express middleware integration
    this.setupExpressIntegration();
  }

  // Logging methods
  log(entry: Omit<LogEntry, 'id' | 'timestamp'>): void {
    const logEntry: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ...entry
    };

    this.logs.push(logEntry);
    this.emit('logEntry', logEntry);

    // Write to file if enabled
    if (this.options.enableFileLogging && this.logFile) {
      this.writeToFile(logEntry);
    }

    // Real-time analysis for critical events
    if (entry.level === 'critical' || entry.level === 'error') {
      this.analyzeLogEntry(logEntry);
    }

    // Maintain log limit
    if (this.logs.length > this.options.maxLogs!) {
      this.logs = this.logs.slice(-this.options.maxLogs!);
    }
  }

  debug(source: string, message: string, metadata?: any, tags: string[] = []): void {
    this.log({ level: 'debug', source, message, metadata, tags });
  }

  info(source: string, message: string, metadata?: any, tags: string[] = []): void {
    this.log({ level: 'info', source, message, metadata, tags });
  }

  warn(source: string, message: string, metadata?: any, tags: string[] = []): void {
    this.log({ level: 'warn', source, message, metadata, tags });
  }

  error(source: string, message: string, metadata?: any, tags: string[] = []): void {
    this.log({ level: 'error', source, message, metadata, tags });
  }

  critical(source: string, message: string, metadata?: any, tags: string[] = []): void {
    this.log({ level: 'critical', source, message, metadata, tags });
  }

  // Security-specific logging
  private logSecurityEvent(event: SecurityEvent): void {
    this.log({
      level: event.severity === 'critical' ? 'critical' : 
             event.severity === 'high' ? 'error' :
             event.severity === 'medium' ? 'warn' : 'info',
      source: 'security-monitor',
      message: `Security Event: ${event.message}`,
      metadata: {
        eventId: event.id,
        eventType: event.type,
        eventSource: event.source,
        eventDetails: event.details,
        resolved: event.resolved
      },
      tags: ['security', event.type, event.severity],
      correlationId: event.id
    });
  }

  // Log retrieval and filtering
  getLogs(filter?: LogFilter): LogEntry[] {
    let filteredLogs = [...this.logs];

    if (filter) {
      if (filter.level) {
        filteredLogs = filteredLogs.filter(log => filter.level!.includes(log.level));
      }
      if (filter.source) {
        filteredLogs = filteredLogs.filter(log => 
          filter.source!.some(source => log.source.includes(source))
        );
      }
      if (filter.tags) {
        filteredLogs = filteredLogs.filter(log => 
          filter.tags!.some(tag => log.tags.includes(tag))
        );
      }
      if (filter.timeRange) {
        filteredLogs = filteredLogs.filter(log => 
          log.timestamp >= filter.timeRange!.start && 
          log.timestamp <= filter.timeRange!.end
        );
      }
      if (filter.searchTerm) {
        const term = filter.searchTerm.toLowerCase();
        filteredLogs = filteredLogs.filter(log => 
          log.message.toLowerCase().includes(term) ||
          log.source.toLowerCase().includes(term) ||
          log.tags.some(tag => tag.toLowerCase().includes(term))
        );
      }
      if (filter.limit) {
        filteredLogs = filteredLogs.slice(-filter.limit);
      }
    }

    return filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Log analysis
  async analyzeLogEntry(entry: LogEntry): Promise<void> {
    // Real-time analysis for immediate threats
    const securityPatterns = [
      {
        pattern: /failed.*login|authentication.*failed|invalid.*credentials/i,
        type: 'security' as const,
        severity: 'high' as const,
        description: 'Authentication failure detected'
      },
      {
        pattern: /sql.*injection|xss|cross.*site|csrf/i,
        type: 'security' as const,
        severity: 'critical' as const,
        description: 'Potential security attack detected'
      },
      {
        pattern: /rate.*limit|too.*many.*requests|ddos/i,
        type: 'security' as const,
        severity: 'medium' as const,
        description: 'Potential abuse or DoS attack'
      },
      {
        pattern: /memory.*leak|out.*of.*memory|heap.*overflow/i,
        type: 'performance' as const,
        severity: 'high' as const,
        description: 'Memory-related issue detected'
      },
      {
        pattern: /unauthorized|forbidden|access.*denied/i,
        type: 'security' as const,
        severity: 'medium' as const,
        description: 'Unauthorized access attempt'
      }
    ];

    for (const patternDef of securityPatterns) {
      if (patternDef.pattern.test(entry.message)) {
        if (patternDef.type === 'security') {
          securityMonitor.logSecurityEvent({
            severity: patternDef.severity,
            type: 'intrusion',
            source: `log-analyzer:${entry.source}`,
            message: `${patternDef.description}: ${entry.message}`,
            details: {
              logEntry: entry,
              pattern: patternDef.pattern.source
            },
            resolved: false
          });
        }

        this.emit('patternDetected', {
          pattern: patternDef,
          logEntry: entry,
          timestamp: new Date()
        });
      }
    }
  }

  async performLogAnalysis(timeRange?: { start: Date; end: Date }): Promise<LogAnalysis> {
    const now = new Date();
    const range = timeRange || {
      start: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Last 24 hours
      end: now
    };

    const relevantLogs = this.getLogs({
      timeRange: range
    });

    const analysis: LogAnalysis = {
      id: crypto.randomUUID(),
      timestamp: now,
      timeRange: range,
      summary: {
        totalLogs: relevantLogs.length,
        errorCount: relevantLogs.filter(l => l.level === 'error').length,
        warningCount: relevantLogs.filter(l => l.level === 'warn').length,
        criticalCount: relevantLogs.filter(l => l.level === 'critical').length,
        uniqueSources: new Set(relevantLogs.map(l => l.source)).size
      },
      patterns: [],
      recommendations: [],
      securityEvents: securityMonitor.getSecurityEvents({
        since: range.start
      })
    };

    // Pattern detection
    const patterns = this.detectPatterns(relevantLogs);
    analysis.patterns = patterns;

    // Generate recommendations
    analysis.recommendations = this.generateRecommendations(analysis);

    this.analyses.push(analysis);
    this.emit('analysisComplete', analysis);

    return analysis;
  }

  private detectPatterns(logs: LogEntry[]): LogAnalysis['patterns'] {
    const patterns: LogAnalysis['patterns'] = [];
    const patternMap = new Map<string, {
      count: number;
      severity: 'low' | 'medium' | 'high' | 'critical';
      type: 'security' | 'performance' | 'error' | 'anomaly';
      firstSeen: Date;
      lastSeen: Date;
      samples: LogEntry[];
    }>();

    // Define pattern detection rules
    const rules = [
      {
        name: 'repeated_errors',
        regex: /(error|exception|fail)/i,
        type: 'error' as const,
        minOccurrences: 5
      },
      {
        name: 'security_violations',
        regex: /(unauthorized|forbidden|access.*denied|authentication.*failed)/i,
        type: 'security' as const,
        minOccurrences: 3
      },
      {
        name: 'performance_issues',
        regex: /(slow|timeout|high.*latency|memory.*usage)/i,
        type: 'performance' as const,
        minOccurrences: 3
      },
      {
        name: 'anomalous_activity',
        regex: /(unusual|suspicious|anomaly|unexpected)/i,
        type: 'anomaly' as const,
        minOccurrences: 2
      }
    ];

    // Analyze logs for patterns
    rules.forEach(rule => {
      const matchingLogs = logs.filter(log => rule.regex.test(log.message));
      
      if (matchingLogs.length >= rule.minOccurrences) {
        const severity = this.calculatePatternSeverity(matchingLogs.length, rule.type);
        
        patterns.push({
          type: rule.type,
          pattern: rule.name,
          occurrences: matchingLogs.length,
          severity,
          firstSeen: matchingLogs[matchingLogs.length - 1].timestamp,
          lastSeen: matchingLogs[0].timestamp,
          samples: matchingLogs.slice(0, 5) // First 5 samples
        });
      }
    });

    return patterns;
  }

  private calculatePatternSeverity(occurrences: number, type: string): 'low' | 'medium' | 'high' | 'critical' {
    if (type === 'security') {
      if (occurrences >= 20) return 'critical';
      if (occurrences >= 10) return 'high';
      if (occurrences >= 5) return 'medium';
      return 'low';
    }
    
    if (type === 'error') {
      if (occurrences >= 50) return 'critical';
      if (occurrences >= 25) return 'high';
      if (occurrences >= 10) return 'medium';
      return 'low';
    }
    
    // Default severity calculation
    if (occurrences >= 30) return 'high';
    if (occurrences >= 15) return 'medium';
    return 'low';
  }

  private generateRecommendations(analysis: LogAnalysis): string[] {
    const recommendations: string[] = [];

    // Security recommendations
    const securityPatterns = analysis.patterns.filter(p => p.type === 'security');
    if (securityPatterns.length > 0) {
      recommendations.push('Review and investigate security-related log patterns');
      recommendations.push('Consider implementing additional security measures');
      
      const criticalSecurity = securityPatterns.filter(p => p.severity === 'critical');
      if (criticalSecurity.length > 0) {
        recommendations.push('URGENT: Critical security patterns detected - immediate investigation required');
      }
    }

    // Error recommendations
    const errorPatterns = analysis.patterns.filter(p => p.type === 'error');
    if (errorPatterns.length > 0) {
      recommendations.push('Investigate recurring error patterns to improve system stability');
    }

    // Performance recommendations
    const perfPatterns = analysis.patterns.filter(p => p.type === 'performance');
    if (perfPatterns.length > 0) {
      recommendations.push('Review performance-related issues and optimize system resources');
    }

    // General recommendations
    if (analysis.summary.criticalCount > 0) {
      recommendations.push('Address all critical-level log entries immediately');
    }
    
    if (analysis.summary.errorCount > analysis.summary.totalLogs * 0.1) {
      recommendations.push('High error rate detected - consider system health review');
    }

    return recommendations;
  }

  // Express middleware integration
  private setupExpressIntegration(): void {
    // This would be used in the main server setup
  }

  getExpressMiddleware() {
    return (req: any, res: any, next: any) => {
      const startTime = Date.now();
      const correlationId = crypto.randomUUID();
      
      req.correlationId = correlationId;
      
      // Log request
      this.info('express', `${req.method} ${req.path}`, {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        correlationId
      }, ['request', 'http']);

      // Intercept response
      const originalSend = res.send;
      res.send = function(data: any) {
        const responseTime = Date.now() - startTime;
        const level = res.statusCode >= 500 ? 'error' : 
                     res.statusCode >= 400 ? 'warn' : 'info';
        
        // Use the log aggregator instance
        (req.app.get('logAggregator') as LogAggregator).log({
          level,
          source: 'express',
          message: `${req.method} ${req.path} - ${res.statusCode}`,
          metadata: {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            responseTime,
            ip: req.ip,
            correlationId
          },
          tags: ['response', 'http'],
          correlationId
        });
        
        return originalSend.call(this, data);
      };

      next();
    };
  }

  // File operations
  private async ensureLogDirectory(): Promise<void> {
    if (this.logFile) {
      const logDir = path.dirname(this.logFile);
      try {
        await fs.mkdir(logDir, { recursive: true });
      } catch (error) {
        console.error('Failed to create log directory:', error);
      }
    }
  }

  private async writeToFile(entry: LogEntry): Promise<void> {
    if (!this.logFile) return;
    
    try {
      const logLine = JSON.stringify({
        timestamp: entry.timestamp.toISOString(),
        level: entry.level,
        source: entry.source,
        message: entry.message,
        metadata: entry.metadata,
        tags: entry.tags,
        correlationId: entry.correlationId
      }) + '\n';
      
      await fs.appendFile(this.logFile, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  // Cleanup and maintenance
  private setupLogCleanup(): void {
    this.logCleanupInterval = setInterval(() => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.options.logRetentionDays!);
      
      this.logs = this.logs.filter(log => log.timestamp >= cutoffDate);
      this.analyses = this.analyses.filter(analysis => analysis.timestamp >= cutoffDate);
    }, 24 * 60 * 60 * 1000); // Daily cleanup
  }

  private startPeriodicAnalysis(): void {
    this.analysisInterval = setInterval(async () => {
      try {
        await this.performLogAnalysis();
      } catch (error) {
        this.error('log-aggregator', `Periodic analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`, { error });
      }
    }, this.options.analysisIntervalMinutes! * 60 * 1000);
  }

  // Analytics and reporting
  getAnalyses(limit = 10): LogAnalysis[] {
    return this.analyses
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  getLogStatistics(): {
    totalLogs: number;
    logsByLevel: Record<LogEntry['level'], number>;
    logsBySources: Record<string, number>;
    recentActivity: { hour: string; count: number }[];
  } {
    const stats = {
      totalLogs: this.logs.length,
      logsByLevel: {
        debug: 0,
        info: 0,
        warn: 0,
        error: 0,
        critical: 0
      } as Record<LogEntry['level'], number>,
      logsBySources: {} as Record<string, number>,
      recentActivity: [] as { hour: string; count: number }[]
    };

    // Count by level
    this.logs.forEach(log => {
      stats.logsByLevel[log.level]++;
      
      if (!stats.logsBySources[log.source]) {
        stats.logsBySources[log.source] = 0;
      }
      stats.logsBySources[log.source]++;
    });

    // Recent activity (last 24 hours by hour)
    const now = new Date();
    for (let i = 23; i >= 0; i--) {
      const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourStart = new Date(hour.getFullYear(), hour.getMonth(), hour.getDate(), hour.getHours());
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
      
      const count = this.logs.filter(log => 
        log.timestamp >= hourStart && log.timestamp < hourEnd
      ).length;
      
      stats.recentActivity.push({
        hour: hourStart.toISOString().substring(11, 16), // HH:MM format
        count
      });
    }

    return stats;
  }

  // Cleanup resources
  destroy(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }
    if (this.logCleanupInterval) {
      clearInterval(this.logCleanupInterval);
    }
    this.removeAllListeners();
  }
}

export const logAggregator = new LogAggregator({
  maxLogs: 50000,
  logRetentionDays: 30,
  analysisIntervalMinutes: 15,
  enableFileLogging: true,
  logFilePath: './logs/security.log',
  enableRealTimeAnalysis: true
});