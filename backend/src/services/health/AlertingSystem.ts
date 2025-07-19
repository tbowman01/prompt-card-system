import { EventEmitter } from 'events';
import { healthOrchestrator } from './HealthOrchestrator';
import { circuitBreakerRegistry } from './CircuitBreaker';

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical'
}

export enum AlertType {
  SERVICE_DOWN = 'service_down',
  SERVICE_DEGRADED = 'service_degraded',
  SERVICE_RECOVERED = 'service_recovered',
  HIGH_RESPONSE_TIME = 'high_response_time',
  CIRCUIT_BREAKER_OPENED = 'circuit_breaker_opened',
  CIRCUIT_BREAKER_CLOSED = 'circuit_breaker_closed',
  SYSTEM_UNHEALTHY = 'system_unhealthy',
  DEPENDENCY_FAILURE = 'dependency_failure'
}

interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  service: string;
  message: string;
  details: any;
  timestamp: Date;
  acknowledged: boolean;
  resolvedAt?: Date;
}

interface AlertRule {
  id: string;
  name: string;
  type: AlertType;
  severity: AlertSeverity;
  enabled: boolean;
  conditions: {
    services?: string[];
    thresholds?: {
      responseTime?: number;
      errorRate?: number;
      consecutiveFailures?: number;
    };
    cooldownPeriod?: number; // minutes
  };
  actions: {
    email?: string[];
    webhook?: string;
    slack?: {
      channel: string;
      webhook: string;
    };
  };
}

interface AlertingConfig {
  enabled: boolean;
  defaultCooldownPeriod: number; // minutes
  maxAlertsPerHour: number;
  retentionDays: number;
}

export class AlertingSystem extends EventEmitter {
  private alerts: Map<string, Alert> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private config: AlertingConfig;
  private alertCounts: Map<string, number> = new Map();
  private lastAlerts: Map<string, Date> = new Map();
  private isInitialized = false;

  constructor(config: Partial<AlertingConfig> = {}) {
    super();
    
    this.config = {
      enabled: true,
      defaultCooldownPeriod: 15, // 15 minutes
      maxAlertsPerHour: 10,
      retentionDays: 30,
      ...config
    };

    this.initializeDefaultRules();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('🚨 Initializing Alerting System...');

    // Listen to health orchestrator events
    healthOrchestrator.on('serviceStatusChanged', this.handleServiceStatusChange.bind(this));
    healthOrchestrator.on('criticalServiceDown', this.handleCriticalServiceDown.bind(this));
    healthOrchestrator.on('fullHealthCheckComplete', this.handleFullHealthCheck.bind(this));

    // Listen to circuit breaker events
    circuitBreakerRegistry.on('breakerOpened', this.handleCircuitBreakerOpened.bind(this));
    circuitBreakerRegistry.on('breakerClosed', this.handleCircuitBreakerClosed.bind(this));

    // Start cleanup process
    this.startCleanupProcess();

    this.isInitialized = true;
    console.log('✅ Alerting System initialized');
  }

  private initializeDefaultRules(): void {
    // Critical service down rule
    this.addAlertRule({
      id: 'critical-service-down',
      name: 'Critical Service Down',
      type: AlertType.SERVICE_DOWN,
      severity: AlertSeverity.CRITICAL,
      enabled: true,
      conditions: {
        services: ['database', 'ollama', 'frontend', 'backend']
      },
      actions: {
        // Configure these based on your notification preferences
        webhook: process.env.ALERT_WEBHOOK_URL
      }
    });

    // High response time rule
    this.addAlertRule({
      id: 'high-response-time',
      name: 'High Response Time',
      type: AlertType.HIGH_RESPONSE_TIME,
      severity: AlertSeverity.WARNING,
      enabled: true,
      conditions: {
        thresholds: {
          responseTime: 10000 // 10 seconds
        },
        cooldownPeriod: 5 // 5 minutes
      },
      actions: {
        webhook: process.env.ALERT_WEBHOOK_URL
      }
    });

    // Circuit breaker opened rule
    this.addAlertRule({
      id: 'circuit-breaker-opened',
      name: 'Circuit Breaker Opened',
      type: AlertType.CIRCUIT_BREAKER_OPENED,
      severity: AlertSeverity.CRITICAL,
      enabled: true,
      conditions: {
        cooldownPeriod: 1 // 1 minute
      },
      actions: {
        webhook: process.env.ALERT_WEBHOOK_URL
      }
    });

    // System unhealthy rule
    this.addAlertRule({
      id: 'system-unhealthy',
      name: 'System Unhealthy',
      type: AlertType.SYSTEM_UNHEALTHY,
      severity: AlertSeverity.CRITICAL,
      enabled: true,
      conditions: {
        cooldownPeriod: 10 // 10 minutes
      },
      actions: {
        webhook: process.env.ALERT_WEBHOOK_URL
      }
    });
  }

  private handleServiceStatusChange(event: any): void {
    const { serviceName, previousStatus, newStatus, responseTime, message } = event;

    // Check for service down/recovery
    if (previousStatus !== 'unhealthy' && newStatus === 'unhealthy') {
      this.checkAndCreateAlert({
        type: AlertType.SERVICE_DOWN,
        service: serviceName,
        message: `Service ${serviceName} is down: ${message}`,
        details: { previousStatus, newStatus, responseTime }
      });
    } else if (previousStatus === 'unhealthy' && newStatus === 'healthy') {
      this.checkAndCreateAlert({
        type: AlertType.SERVICE_RECOVERED,
        service: serviceName,
        message: `Service ${serviceName} has recovered`,
        details: { previousStatus, newStatus, responseTime }
      });
    } else if (previousStatus !== 'degraded' && newStatus === 'degraded') {
      this.checkAndCreateAlert({
        type: AlertType.SERVICE_DEGRADED,
        service: serviceName,
        message: `Service ${serviceName} is degraded: ${message}`,
        details: { previousStatus, newStatus, responseTime }
      });
    }

    // Check for high response time
    if (responseTime > 0) {
      const rule = this.alertRules.get('high-response-time');
      if (rule?.enabled && rule.conditions.thresholds?.responseTime) {
        if (responseTime > rule.conditions.thresholds.responseTime) {
          this.checkAndCreateAlert({
            type: AlertType.HIGH_RESPONSE_TIME,
            service: serviceName,
            message: `High response time for ${serviceName}: ${responseTime}ms`,
            details: { responseTime, threshold: rule.conditions.thresholds.responseTime }
          });
        }
      }
    }
  }

  private handleCriticalServiceDown(event: any): void {
    const { serviceName, message, details } = event;
    
    this.checkAndCreateAlert({
      type: AlertType.SERVICE_DOWN,
      service: serviceName,
      message: `Critical service ${serviceName} is down: ${message}`,
      details,
      forceSeverity: AlertSeverity.CRITICAL
    });
  }

  private handleFullHealthCheck(event: any): void {
    const { systemHealth } = event;
    
    if (systemHealth.overallStatus === 'unhealthy') {
      this.checkAndCreateAlert({
        type: AlertType.SYSTEM_UNHEALTHY,
        service: 'system',
        message: `System is unhealthy: ${systemHealth.unhealthyServices} unhealthy services`,
        details: {
          totalServices: systemHealth.totalServices,
          healthyServices: systemHealth.healthyServices,
          unhealthyServices: systemHealth.unhealthyServices,
          degradedServices: systemHealth.degradedServices
        }
      });
    }
  }

  private handleCircuitBreakerOpened(event: any): void {
    const { serviceName, failureCount, reason } = event;
    
    this.checkAndCreateAlert({
      type: AlertType.CIRCUIT_BREAKER_OPENED,
      service: serviceName,
      message: `Circuit breaker opened for ${serviceName}: ${reason}`,
      details: { failureCount, reason }
    });
  }

  private handleCircuitBreakerClosed(event: any): void {
    const { serviceName, reason } = event;
    
    this.checkAndCreateAlert({
      type: AlertType.CIRCUIT_BREAKER_CLOSED,
      service: serviceName,
      message: `Circuit breaker closed for ${serviceName}: ${reason}`,
      details: { reason },
      forceSeverity: AlertSeverity.INFO
    });
  }

  private checkAndCreateAlert(params: {
    type: AlertType;
    service: string;
    message: string;
    details: any;
    forceSeverity?: AlertSeverity;
  }): void {
    if (!this.config.enabled) return;

    const rule = this.findMatchingRule(params.type, params.service);
    if (!rule?.enabled) return;

    // Check cooldown period
    const cooldownKey = `${params.type}-${params.service}`;
    const lastAlert = this.lastAlerts.get(cooldownKey);
    const cooldownPeriod = rule.conditions.cooldownPeriod || this.config.defaultCooldownPeriod;
    
    if (lastAlert) {
      const timeSinceLastAlert = Date.now() - lastAlert.getTime();
      const cooldownMs = cooldownPeriod * 60 * 1000;
      
      if (timeSinceLastAlert < cooldownMs) {
        console.log(`Alert suppressed due to cooldown: ${params.type} for ${params.service}`);
        return;
      }
    }

    // Check rate limiting
    const hourKey = Math.floor(Date.now() / (60 * 60 * 1000));
    const countKey = `${hourKey}-${params.service}`;
    const hourlyCount = this.alertCounts.get(countKey) || 0;
    
    if (hourlyCount >= this.config.maxAlertsPerHour) {
      console.log(`Alert rate limit exceeded for ${params.service}`);
      return;
    }

    // Create alert
    const alert = this.createAlert({
      ...params,
      severity: params.forceSeverity || rule.severity
    });

    // Update tracking
    this.lastAlerts.set(cooldownKey, new Date());
    this.alertCounts.set(countKey, hourlyCount + 1);

    // Send notifications
    this.sendNotifications(alert, rule);

    console.log(`🚨 Alert created: ${alert.type} for ${alert.service} - ${alert.message}`);
  }

  private findMatchingRule(type: AlertType, service: string): AlertRule | undefined {
    for (const rule of this.alertRules.values()) {
      if (rule.type === type) {
        if (!rule.conditions.services || rule.conditions.services.includes(service)) {
          return rule;
        }
      }
    }
    return undefined;
  }

  private createAlert(params: {
    type: AlertType;
    service: string;
    message: string;
    details: any;
    severity: AlertSeverity;
  }): Alert {
    const alert: Alert = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: params.type,
      severity: params.severity,
      service: params.service,
      message: params.message,
      details: params.details,
      timestamp: new Date(),
      acknowledged: false
    };

    this.alerts.set(alert.id, alert);
    this.emit('alertCreated', alert);
    
    return alert;
  }

  private async sendNotifications(alert: Alert, rule: AlertRule): Promise<void> {
    try {
      // Webhook notification
      if (rule.actions.webhook) {
        await this.sendWebhookNotification(alert, rule.actions.webhook);
      }

      // Slack notification (if configured)
      if (rule.actions.slack) {
        await this.sendSlackNotification(alert, rule.actions.slack);
      }

      // Email notification (if configured)
      if (rule.actions.email && rule.actions.email.length > 0) {
        await this.sendEmailNotification(alert, rule.actions.email);
      }
    } catch (error) {
      console.error('Failed to send alert notification:', error);
    }
  }

  private async sendWebhookNotification(alert: Alert, webhookUrl: string): Promise<void> {
    try {
      const payload = {
        alert: {
          id: alert.id,
          type: alert.type,
          severity: alert.severity,
          service: alert.service,
          message: alert.message,
          timestamp: alert.timestamp.toISOString()
        },
        system: 'prompt-card-health-monitor'
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Webhook notification failed:', error);
    }
  }

  private async sendSlackNotification(alert: Alert, slackConfig: { channel: string; webhook: string }): Promise<void> {
    try {
      const color = {
        [AlertSeverity.INFO]: '#36a64f',
        [AlertSeverity.WARNING]: '#ffeb3b',
        [AlertSeverity.CRITICAL]: '#f44336'
      }[alert.severity];

      const payload = {
        channel: slackConfig.channel,
        attachments: [{
          color,
          title: `${alert.severity.toUpperCase()}: ${alert.type.replace('_', ' ').toUpperCase()}`,
          text: alert.message,
          fields: [
            {
              title: 'Service',
              value: alert.service,
              short: true
            },
            {
              title: 'Time',
              value: alert.timestamp.toISOString(),
              short: true
            }
          ]
        }]
      };

      const response = await fetch(slackConfig.webhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Slack notification failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Slack notification failed:', error);
    }
  }

  private async sendEmailNotification(alert: Alert, emails: string[]): Promise<void> {
    // Email implementation would depend on your email service
    // This is a placeholder for the email notification logic
    console.log(`Email notification sent to ${emails.join(', ')} for alert: ${alert.message}`);
  }

  public addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    console.log(`Alert rule added: ${rule.name}`);
  }

  public removeAlertRule(ruleId: string): boolean {
    const removed = this.alertRules.delete(ruleId);
    if (removed) {
      console.log(`Alert rule removed: ${ruleId}`);
    }
    return removed;
  }

  public updateAlertRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const rule = this.alertRules.get(ruleId);
    if (!rule) return false;

    const updatedRule = { ...rule, ...updates };
    this.alertRules.set(ruleId, updatedRule);
    console.log(`Alert rule updated: ${ruleId}`);
    return true;
  }

  public acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.acknowledged = true;
    this.alerts.set(alertId, alert);
    this.emit('alertAcknowledged', alert);
    return true;
  }

  public resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.resolvedAt = new Date();
    this.alerts.set(alertId, alert);
    this.emit('alertResolved', alert);
    return true;
  }

  public getAlerts(filters?: {
    service?: string;
    severity?: AlertSeverity;
    acknowledged?: boolean;
    resolved?: boolean;
    limit?: number;
  }): Alert[] {
    let alerts = Array.from(this.alerts.values());

    if (filters) {
      if (filters.service) {
        alerts = alerts.filter(a => a.service === filters.service);
      }
      if (filters.severity) {
        alerts = alerts.filter(a => a.severity === filters.severity);
      }
      if (filters.acknowledged !== undefined) {
        alerts = alerts.filter(a => a.acknowledged === filters.acknowledged);
      }
      if (filters.resolved !== undefined) {
        const hasResolved = (alert: Alert) => !!alert.resolvedAt;
        alerts = alerts.filter(a => hasResolved(a) === filters.resolved);
      }
    }

    // Sort by timestamp (newest first)
    alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (filters?.limit) {
      alerts = alerts.slice(0, filters.limit);
    }

    return alerts;
  }

  public getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  public getAlertStats(): {
    total: number;
    bySeverity: Record<AlertSeverity, number>;
    byService: Record<string, number>;
    acknowledged: number;
    resolved: number;
  } {
    const alerts = Array.from(this.alerts.values());
    const stats = {
      total: alerts.length,
      bySeverity: {
        [AlertSeverity.INFO]: 0,
        [AlertSeverity.WARNING]: 0,
        [AlertSeverity.CRITICAL]: 0
      },
      byService: {} as Record<string, number>,
      acknowledged: 0,
      resolved: 0
    };

    for (const alert of alerts) {
      stats.bySeverity[alert.severity]++;
      stats.byService[alert.service] = (stats.byService[alert.service] || 0) + 1;
      
      if (alert.acknowledged) stats.acknowledged++;
      if (alert.resolvedAt) stats.resolved++;
    }

    return stats;
  }

  private startCleanupProcess(): void {
    // Clean up old alerts daily
    setInterval(() => {
      this.cleanupOldAlerts();
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  private cleanupOldAlerts(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    let removedCount = 0;
    for (const [id, alert] of this.alerts) {
      if (alert.timestamp < cutoffDate) {
        this.alerts.delete(id);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`Cleaned up ${removedCount} old alerts`);
    }
  }

  public updateConfig(newConfig: Partial<AlertingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Alerting system configuration updated');
  }

  public async shutdown(): Promise<void> {
    console.log('Shutting down alerting system...');
    this.isInitialized = false;
    this.removeAllListeners();
    console.log('Alerting system shutdown complete');
  }
}

export const alertingSystem = new AlertingSystem();