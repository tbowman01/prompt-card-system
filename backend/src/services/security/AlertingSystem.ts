import { EventEmitter } from 'events';
import crypto from 'crypto';
import { securityMonitor, SecurityEvent } from './SecurityMonitor';
import { logAggregator, LogAnalysis } from './LogAggregator';

export interface Alert {
  id: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'security' | 'performance' | 'system' | 'compliance';
  title: string;
  message: string;
  source: string;
  metadata: any;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  actions: AlertAction[];
}

export interface AlertAction {
  id: string;
  type: 'email' | 'webhook' | 'sms' | 'slack' | 'log' | 'auto-remediate';
  target: string;
  config: any;
  executed: boolean;
  executedAt?: Date;
  result?: string;
  error?: string;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: {
    eventType?: string[];
    severity?: string[];
    source?: string[];
    pattern?: RegExp;
    threshold?: {
      count: number;
      timeWindow: number; // in minutes
    };
  };
  actions: Omit<AlertAction, 'id' | 'executed' | 'executedAt' | 'result' | 'error'>[];
  cooldown?: number; // minutes
  lastTriggered?: Date;
}

export interface NotificationChannel {
  id: string;
  type: 'email' | 'webhook' | 'slack' | 'sms';
  name: string;
  config: {
    email?: { to: string[]; from: string; smtp?: any };
    webhook?: { url: string; headers?: Record<string, string>; method?: string };
    slack?: { webhook: string; channel: string };
    sms?: { provider: string; credentials: any; to: string[] };
  };
  enabled: boolean;
}

export class AlertingSystem extends EventEmitter {
  private alerts: Alert[] = [];
  private rules: AlertRule[] = [];
  private channels: NotificationChannel[] = [];
  private eventCounts: Map<string, { count: number; firstSeen: Date }> = new Map();
  private cleanupInterval?: NodeJS.Timeout;

  constructor(private options: {
    maxAlerts?: number;
    alertRetentionDays?: number;
    enableAutoRemediation?: boolean;
  } = {}) {
    super();
    
    const {
      maxAlerts = 5000,
      alertRetentionDays = 90,
      enableAutoRemediation = false
    } = options;

    this.options = {
      maxAlerts,
      alertRetentionDays,
      enableAutoRemediation
    };

    this.setupDefaultRules();
    this.setupEventListeners();
    this.setupCleanup();
  }

  // Alert management
  createAlert(alertData: Omit<Alert, 'id' | 'timestamp' | 'acknowledged' | 'resolved' | 'actions'>): Alert {
    const alert: Alert = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      acknowledged: false,
      resolved: false,
      actions: [],
      ...alertData
    };

    this.alerts.push(alert);
    this.emit('alert', alert);

    // Execute alert actions
    this.executeAlertActions(alert);

    // Maintain alert limit
    if (this.alerts.length > this.options.maxAlerts!) {
      this.alerts = this.alerts.slice(-this.options.maxAlerts!);
    }

    return alert;
  }

  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert || alert.acknowledged) {
      return false;
    }

    alert.acknowledged = true;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date();

    this.emit('alertAcknowledged', alert);
    return true;
  }

  resolveAlert(alertId: string, resolvedBy: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert || alert.resolved) {
      return false;
    }

    alert.resolved = true;
    alert.resolvedBy = resolvedBy;
    alert.resolvedAt = new Date();

    this.emit('alertResolved', alert);
    return true;
  }

  getAlerts(filters?: {
    severity?: Alert['severity'][];
    type?: Alert['type'][];
    acknowledged?: boolean;
    resolved?: boolean;
    since?: Date;
    limit?: number;
  }): Alert[] {
    let filteredAlerts = [...this.alerts];

    if (filters) {
      if (filters.severity) {
        filteredAlerts = filteredAlerts.filter(a => filters.severity!.includes(a.severity));
      }
      if (filters.type) {
        filteredAlerts = filteredAlerts.filter(a => filters.type!.includes(a.type));
      }
      if (filters.acknowledged !== undefined) {
        filteredAlerts = filteredAlerts.filter(a => a.acknowledged === filters.acknowledged);
      }
      if (filters.resolved !== undefined) {
        filteredAlerts = filteredAlerts.filter(a => a.resolved === filters.resolved);
      }
      if (filters.since) {
        filteredAlerts = filteredAlerts.filter(a => a.timestamp >= filters.since!);
      }
      if (filters.limit) {
        filteredAlerts = filteredAlerts.slice(-filters.limit);
      }
    }

    return filteredAlerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Rule management
  addRule(rule: Omit<AlertRule, 'id'>): AlertRule {
    const newRule: AlertRule = {
      id: crypto.randomUUID(),
      ...rule
    };

    this.rules.push(newRule);
    this.emit('ruleAdded', newRule);
    return newRule;
  }

  updateRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const ruleIndex = this.rules.findIndex(r => r.id === ruleId);
    if (ruleIndex === -1) {
      return false;
    }

    this.rules[ruleIndex] = { ...this.rules[ruleIndex], ...updates };
    this.emit('ruleUpdated', this.rules[ruleIndex]);
    return true;
  }

  removeRule(ruleId: string): boolean {
    const ruleIndex = this.rules.findIndex(r => r.id === ruleId);
    if (ruleIndex === -1) {
      return false;
    }

    const rule = this.rules.splice(ruleIndex, 1)[0];
    this.emit('ruleRemoved', rule);
    return true;
  }

  getRules(): AlertRule[] {
    return [...this.rules];
  }

  // Notification channel management
  addChannel(channel: Omit<NotificationChannel, 'id'>): NotificationChannel {
    const newChannel: NotificationChannel = {
      id: crypto.randomUUID(),
      ...channel
    };

    this.channels.push(newChannel);
    this.emit('channelAdded', newChannel);
    return newChannel;
  }

  updateChannel(channelId: string, updates: Partial<NotificationChannel>): boolean {
    const channelIndex = this.channels.findIndex(c => c.id === channelId);
    if (channelIndex === -1) {
      return false;
    }

    this.channels[channelIndex] = { ...this.channels[channelIndex], ...updates };
    this.emit('channelUpdated', this.channels[channelIndex]);
    return true;
  }

  removeChannel(channelId: string): boolean {
    const channelIndex = this.channels.findIndex(c => c.id === channelId);
    if (channelIndex === -1) {
      return false;
    }

    const channel = this.channels.splice(channelIndex, 1)[0];
    this.emit('channelRemoved', channel);
    return true;
  }

  getChannels(): NotificationChannel[] {
    return [...this.channels];
  }

  // Alert processing
  private async executeAlertActions(alert: Alert): Promise<void> {
    const matchingRules = this.rules.filter(rule => 
      rule.enabled && this.doesEventMatchRule(alert, rule)
    );

    for (const rule of matchingRules) {
      // Check cooldown
      if (rule.cooldown && rule.lastTriggered) {
        const cooldownEnd = new Date(rule.lastTriggered.getTime() + rule.cooldown * 60 * 1000);
        if (new Date() < cooldownEnd) {
          continue;
        }
      }

      // Execute rule actions
      for (const actionTemplate of rule.actions) {
        const action: AlertAction = {
          id: crypto.randomUUID(),
          executed: false,
          ...actionTemplate
        };

        try {
          await this.executeAction(action, alert);
          action.executed = true;
          action.executedAt = new Date();
          action.result = 'success';
        } catch (error) {
          action.executed = false;
          action.error = error instanceof Error ? error.message : 'Unknown error';
        }

        alert.actions.push(action);
      }

      rule.lastTriggered = new Date();
    }
  }

  private doesEventMatchRule(alert: Alert, rule: AlertRule): boolean {
    const { conditions } = rule;

    if (conditions.eventType && !conditions.eventType.includes(alert.type)) {
      return false;
    }

    if (conditions.severity && !conditions.severity.includes(alert.severity)) {
      return false;
    }

    if (conditions.source && !conditions.source.some(s => alert.source.includes(s))) {
      return false;
    }

    if (conditions.pattern && !conditions.pattern.test(alert.message)) {
      return false;
    }

    if (conditions.threshold) {
      const key = `${rule.id}_${alert.type}_${alert.source}`;
      const now = new Date();
      
      if (!this.eventCounts.has(key)) {
        this.eventCounts.set(key, { count: 1, firstSeen: now });
        return false;
      }

      const eventData = this.eventCounts.get(key)!;
      const windowStart = new Date(now.getTime() - conditions.threshold.timeWindow * 60 * 1000);
      
      if (eventData.firstSeen < windowStart) {
        // Reset counter for new window
        this.eventCounts.set(key, { count: 1, firstSeen: now });
        return false;
      }

      eventData.count++;
      return eventData.count >= conditions.threshold.count;
    }

    return true;
  }

  private async executeAction(action: AlertAction, alert: Alert): Promise<void> {
    const channel = this.channels.find(c => c.id === action.target && c.enabled);
    if (!channel) {
      throw new Error(`Channel ${action.target} not found or disabled`);
    }

    switch (action.type) {
      case 'email':
        await this.sendEmailAlert(channel, alert, action);
        break;
      case 'webhook':
        await this.sendWebhookAlert(channel, alert, action);
        break;
      case 'slack':
        await this.sendSlackAlert(channel, alert, action);
        break;
      case 'sms':
        await this.sendSMSAlert(channel, alert, action);
        break;
      case 'log':
        await this.logAlert(alert, action);
        break;
      case 'auto-remediate':
        if (this.options.enableAutoRemediation) {
          await this.executeAutoRemediation(alert, action);
        }
        break;
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private async sendEmailAlert(channel: NotificationChannel, alert: Alert, action: AlertAction): Promise<void> {
    // Email implementation would go here
    // For now, just log the action
    logAggregator.info('alerting-system', `Email alert sent: ${alert.title}`, {
      channel: channel.name,
      alert: alert.id,
      severity: alert.severity
    }, ['alert', 'email']);
  }

  private async sendWebhookAlert(channel: NotificationChannel, alert: Alert, action: AlertAction): Promise<void> {
    const { webhook } = channel.config;
    if (!webhook) {
      throw new Error('Webhook configuration missing');
    }

    const payload = {
      alert: {
        id: alert.id,
        timestamp: alert.timestamp,
        severity: alert.severity,
        type: alert.type,
        title: alert.title,
        message: alert.message,
        source: alert.source,
        metadata: alert.metadata
      },
      action: action.config || {}
    };

    try {
      const response = await fetch(webhook.url, {
        method: webhook.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...webhook.headers
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
      }

      logAggregator.info('alerting-system', `Webhook alert sent: ${alert.title}`, {
        channel: channel.name,
        alert: alert.id,
        webhook: webhook.url,
        status: response.status
      }, ['alert', 'webhook']);
    } catch (error) {
      throw new Error(`Webhook failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async sendSlackAlert(channel: NotificationChannel, alert: Alert, action: AlertAction): Promise<void> {
    const { slack } = channel.config;
    if (!slack) {
      throw new Error('Slack configuration missing');
    }

    const severityEmoji = {
      low: '🟢',
      medium: '🟡',
      high: '🟠',
      critical: '🔴'
    };

    const payload = {
      channel: slack.channel,
      text: `${severityEmoji[alert.severity]} Security Alert: ${alert.title}`,
      attachments: [{
        color: alert.severity === 'critical' ? 'danger' : 
               alert.severity === 'high' ? 'warning' : 'good',
        fields: [
          { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
          { title: 'Type', value: alert.type, short: true },
          { title: 'Source', value: alert.source, short: true },
          { title: 'Time', value: alert.timestamp.toISOString(), short: true },
          { title: 'Message', value: alert.message, short: false }
        ],
        timestamp: Math.floor(alert.timestamp.getTime() / 1000)
      }]
    };

    try {
      const response = await fetch(slack.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Slack webhook returned ${response.status}: ${response.statusText}`);
      }

      logAggregator.info('alerting-system', `Slack alert sent: ${alert.title}`, {
        channel: channel.name,
        alert: alert.id,
        slackChannel: slack.channel
      }, ['alert', 'slack']);
    } catch (error) {
      throw new Error(`Slack alert failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async sendSMSAlert(channel: NotificationChannel, alert: Alert, action: AlertAction): Promise<void> {
    // SMS implementation would go here
    logAggregator.info('alerting-system', `SMS alert sent: ${alert.title}`, {
      channel: channel.name,
      alert: alert.id,
      severity: alert.severity
    }, ['alert', 'sms']);
  }

  private async logAlert(alert: Alert, action: AlertAction): Promise<void> {
    logAggregator.warn('alerting-system', `ALERT: ${alert.title}`, {
      alertId: alert.id,
      severity: alert.severity,
      type: alert.type,
      source: alert.source,
      message: alert.message,
      metadata: alert.metadata
    }, ['alert', 'logged']);
  }

  private async executeAutoRemediation(alert: Alert, action: AlertAction): Promise<void> {
    // Auto-remediation logic would go here
    logAggregator.info('alerting-system', `Auto-remediation triggered for: ${alert.title}`, {
      alert: alert.id,
      remediation: action.config
    }, ['alert', 'auto-remediation']);
  }

  // Event listeners setup
  private setupEventListeners(): void {
    // Listen to security events
    securityMonitor.on('securityEvent', (event: SecurityEvent) => {
      this.createAlert({
        severity: event.severity,
        type: 'security',
        title: `Security Event: ${event.type}`,
        message: event.message,
        source: event.source,
        metadata: {
          eventId: event.id,
          eventType: event.type,
          eventDetails: event.details
        }
      });
    });

    securityMonitor.on('criticalAlert', (event: SecurityEvent) => {
      this.createAlert({
        severity: 'critical',
        type: 'security',
        title: `CRITICAL: ${event.type}`,
        message: event.message,
        source: event.source,
        metadata: {
          eventId: event.id,
          eventType: event.type,
          eventDetails: event.details,
          critical: true
        }
      });
    });

    // Listen to log analysis events
    logAggregator.on('analysisComplete', (analysis: LogAnalysis) => {
      const criticalPatterns = analysis.patterns.filter(p => p.severity === 'critical');
      const highPatterns = analysis.patterns.filter(p => p.severity === 'high');
      
      if (criticalPatterns.length > 0) {
        this.createAlert({
          severity: 'critical',
          type: 'system',
          title: 'Critical Log Patterns Detected',
          message: `${criticalPatterns.length} critical patterns found in log analysis`,
          source: 'log-analyzer',
          metadata: {
            analysisId: analysis.id,
            patterns: criticalPatterns,
            timeRange: analysis.timeRange
          }
        });
      } else if (highPatterns.length > 0) {
        this.createAlert({
          severity: 'high',
          type: 'system',
          title: 'High-Severity Log Patterns Detected',
          message: `${highPatterns.length} high-severity patterns found in log analysis`,
          source: 'log-analyzer',
          metadata: {
            analysisId: analysis.id,
            patterns: highPatterns,
            timeRange: analysis.timeRange
          }
        });
      }
    });

    logAggregator.on('patternDetected', (data: any) => {
      if (data.pattern.severity === 'critical' || data.pattern.severity === 'high') {
        this.createAlert({
          severity: data.pattern.severity,
          type: data.pattern.type,
          title: `Pattern Detected: ${data.pattern.description}`,
          message: data.logEntry.message,
          source: data.logEntry.source,
          metadata: {
            pattern: data.pattern,
            logEntry: data.logEntry
          }
        });
      }
    });
  }

  // Default rules setup
  private setupDefaultRules(): void {
    const defaultRules: Omit<AlertRule, 'id'>[] = [
      {
        name: 'Critical Security Events',
        description: 'Alert on any critical security events',
        enabled: true,
        conditions: {
          eventType: ['security'],
          severity: ['critical']
        },
        actions: [
          { type: 'log', target: 'system', config: {} }
        ],
        cooldown: 5
      },
      {
        name: 'Multiple Authentication Failures',
        description: 'Alert when multiple authentication failures occur',
        enabled: true,
        conditions: {
          pattern: /authentication.*failed|login.*failed/i,
          threshold: { count: 5, timeWindow: 15 }
        },
        actions: [
          { type: 'log', target: 'system', config: {} }
        ],
        cooldown: 10
      },
      {
        name: 'System Performance Issues',
        description: 'Alert on system performance degradation',
        enabled: true,
        conditions: {
          eventType: ['performance'],
          severity: ['high', 'critical']
        },
        actions: [
          { type: 'log', target: 'system', config: {} }
        ],
        cooldown: 15
      }
    ];

    defaultRules.forEach(rule => this.addRule(rule));
  }

  // Analytics
  getAlertStatistics(): {
    total: number;
    bySeverity: Record<Alert['severity'], number>;
    byType: Record<Alert['type'], number>;
    acknowledged: number;
    resolved: number;
    recentActivity: { date: string; count: number }[];
  } {
    const stats = {
      total: this.alerts.length,
      bySeverity: { low: 0, medium: 0, high: 0, critical: 0 } as Record<Alert['severity'], number>,
      byType: { security: 0, performance: 0, system: 0, compliance: 0 } as Record<Alert['type'], number>,
      acknowledged: this.alerts.filter(a => a.acknowledged).length,
      resolved: this.alerts.filter(a => a.resolved).length,
      recentActivity: [] as { date: string; count: number }[]
    };

    this.alerts.forEach(alert => {
      stats.bySeverity[alert.severity]++;
      stats.byType[alert.type]++;
    });

    // Recent activity (last 7 days)
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      
      const count = this.alerts.filter(alert => 
        alert.timestamp >= dayStart && alert.timestamp < dayEnd
      ).length;
      
      stats.recentActivity.push({
        date: dayStart.toISOString().split('T')[0],
        count
      });
    }

    return stats;
  }

  // Cleanup
  private setupCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.options.alertRetentionDays!);
      
      this.alerts = this.alerts.filter(alert => alert.timestamp >= cutoffDate);
      
      // Clean up event counts older than 24 hours
      const eventCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      for (const [key, data] of this.eventCounts.entries()) {
        if (data.firstSeen < eventCutoff) {
          this.eventCounts.delete(key);
        }
      }
    }, 24 * 60 * 60 * 1000); // Daily cleanup
  }

  // Cleanup resources
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.removeAllListeners();
  }
}

export const alertingSystem = new AlertingSystem({
  maxAlerts: 5000,
  alertRetentionDays: 90,
  enableAutoRemediation: process.env.NODE_ENV === 'production'
});