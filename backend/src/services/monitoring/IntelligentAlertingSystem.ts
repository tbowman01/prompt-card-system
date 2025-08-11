/**
 * Intelligent Alerting System with Multiple Notification Channels
 * P2 Enhancement: Advanced monitoring alerts with escalation policies and smart notifications
 */

import { EventEmitter } from 'events';
import nodemailer from 'nodemailer';
import axios from 'axios';
import twilio from 'twilio';
import winston from 'winston';

export interface Alert {
  id: string;
  timestamp: Date;
  severity: AlertSeverity;
  source: string;
  title: string;
  description: string;
  metadata: Record<string, any>;
  tags: string[];
  resolved: boolean;
  resolved_at?: Date;
  escalation_level: number;
  notification_attempts: number;
  suppression_window?: number;
}

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  severity: AlertSeverity;
  enabled: boolean;
  tags: string[];
  suppression_window?: number; // in minutes
  escalation_policy?: EscalationPolicy;
  notification_channels: NotificationChannel[];
}

export interface EscalationPolicy {
  levels: EscalationLevel[];
  repeat_interval?: number; // in minutes
  max_escalations?: number;
}

export interface EscalationLevel {
  level: number;
  delay_minutes: number;
  channels: NotificationChannel[];
  recipients: string[];
}

export interface NotificationChannel {
  type: 'email' | 'slack' | 'webhook' | 'sms' | 'discord' | 'pagerduty';
  config: Record<string, any>;
  enabled: boolean;
  priority: number;
}

export interface AlertMetrics {
  total_alerts: number;
  alerts_by_severity: Record<AlertSeverity, number>;
  active_alerts: number;
  resolved_alerts: number;
  avg_resolution_time: number;
  escalation_rate: number;
  notification_success_rate: number;
}

export class IntelligentAlertingSystem extends EventEmitter {
  private alerts: Map<string, Alert> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private suppressionCache: Map<string, Date> = new Map();
  private escalationTimers: Map<string, NodeJS.Timeout> = new Map();
  private logger: winston.Logger;
  private metrics: AlertMetrics;
  
  // Notification clients
  private emailTransporter?: nodemailer.Transporter;
  private twilioClient?: any;

  constructor() {
    super();
    this.initializeLogger();
    this.initializeMetrics();
    this.setupNotificationClients();
    this.loadAlertRules();
    this.startBackgroundTasks();
  }

  private initializeLogger(): void {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({
          filename: 'logs/alerts.log',
          maxsize: 50 * 1024 * 1024,
          maxFiles: 5
        }),
        new winston.transports.Console({
          level: process.env.NODE_ENV === 'development' ? 'debug' : 'warn'
        })
      ]
    });
  }

  private initializeMetrics(): void {
    this.metrics = {
      total_alerts: 0,
      alerts_by_severity: {
        [AlertSeverity.LOW]: 0,
        [AlertSeverity.MEDIUM]: 0,
        [AlertSeverity.HIGH]: 0,
        [AlertSeverity.CRITICAL]: 0
      },
      active_alerts: 0,
      resolved_alerts: 0,
      avg_resolution_time: 0,
      escalation_rate: 0,
      notification_success_rate: 0
    };
  }

  private setupNotificationClients(): void {
    // Email client setup
    if (process.env.SMTP_HOST) {
      this.emailTransporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD
        }
      });
    }

    // Twilio client setup
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    }
  }

  private loadAlertRules(): void {
    // Default alert rules for the system
    const defaultRules: AlertRule[] = [
      {
        id: 'high-cpu-usage',
        name: 'High CPU Usage',
        condition: 'cpu_usage_percent > 80',
        severity: AlertSeverity.HIGH,
        enabled: true,
        tags: ['performance', 'cpu'],
        suppression_window: 5,
        escalation_policy: {
          levels: [
            {
              level: 1,
              delay_minutes: 0,
              channels: [{ type: 'slack', config: {}, enabled: true, priority: 1 }],
              recipients: ['dev-team']
            },
            {
              level: 2,
              delay_minutes: 10,
              channels: [{ type: 'email', config: {}, enabled: true, priority: 1 }],
              recipients: ['ops-team']
            },
            {
              level: 3,
              delay_minutes: 30,
              channels: [{ type: 'sms', config: {}, enabled: true, priority: 1 }],
              recipients: ['on-call']
            }
          ],
          repeat_interval: 60,
          max_escalations: 3
        },
        notification_channels: [
          { type: 'slack', config: { webhook_url: process.env.SLACK_WEBHOOK_URL }, enabled: true, priority: 1 },
          { type: 'email', config: { recipients: ['alerts@company.com'] }, enabled: true, priority: 2 }
        ]
      },
      {
        id: 'high-memory-usage',
        name: 'High Memory Usage',
        condition: 'memory_usage_percent > 85',
        severity: AlertSeverity.HIGH,
        enabled: true,
        tags: ['performance', 'memory'],
        suppression_window: 5,
        notification_channels: [
          { type: 'slack', config: { webhook_url: process.env.SLACK_WEBHOOK_URL }, enabled: true, priority: 1 }
        ]
      },
      {
        id: 'database-connection-failure',
        name: 'Database Connection Failure',
        condition: 'database_connection_status == "down"',
        severity: AlertSeverity.CRITICAL,
        enabled: true,
        tags: ['database', 'connection'],
        suppression_window: 1,
        escalation_policy: {
          levels: [
            {
              level: 1,
              delay_minutes: 0,
              channels: [{ type: 'slack', config: {}, enabled: true, priority: 1 }],
              recipients: ['dev-team', 'ops-team']
            },
            {
              level: 2,
              delay_minutes: 5,
              channels: [{ type: 'sms', config: {}, enabled: true, priority: 1 }],
              recipients: ['on-call']
            }
          ],
          repeat_interval: 15,
          max_escalations: 5
        },
        notification_channels: [
          { type: 'slack', config: { webhook_url: process.env.SLACK_WEBHOOK_URL }, enabled: true, priority: 1 },
          { type: 'email', config: { recipients: ['alerts@company.com'] }, enabled: true, priority: 1 },
          { type: 'sms', config: { recipients: [process.env.ALERT_PHONE_NUMBER] }, enabled: true, priority: 1 }
        ]
      },
      {
        id: 'high-error-rate',
        name: 'High Error Rate',
        condition: 'error_rate_percent > 5',
        severity: AlertSeverity.MEDIUM,
        enabled: true,
        tags: ['errors', 'application'],
        suppression_window: 10,
        notification_channels: [
          { type: 'slack', config: { webhook_url: process.env.SLACK_WEBHOOK_URL }, enabled: true, priority: 1 }
        ]
      },
      {
        id: 'security-threat-detected',
        name: 'Security Threat Detected',
        condition: 'security_risk_score > 70',
        severity: AlertSeverity.CRITICAL,
        enabled: true,
        tags: ['security', 'threat'],
        suppression_window: 0,
        escalation_policy: {
          levels: [
            {
              level: 1,
              delay_minutes: 0,
              channels: [{ type: 'slack', config: {}, enabled: true, priority: 1 }],
              recipients: ['security-team', 'ops-team']
            },
            {
              level: 2,
              delay_minutes: 2,
              channels: [{ type: 'email', config: {}, enabled: true, priority: 1 }],
              recipients: ['security-team']
            },
            {
              level: 3,
              delay_minutes: 5,
              channels: [{ type: 'sms', config: {}, enabled: true, priority: 1 }],
              recipients: ['security-lead', 'on-call']
            }
          ],
          repeat_interval: 30,
          max_escalations: 10
        },
        notification_channels: [
          { type: 'slack', config: { webhook_url: process.env.SECURITY_SLACK_WEBHOOK_URL }, enabled: true, priority: 1 },
          { type: 'email', config: { recipients: ['security@company.com'] }, enabled: true, priority: 1 }
        ]
      }
    ];

    defaultRules.forEach(rule => {
      this.alertRules.set(rule.id, rule);
    });
  }

  /**
   * Trigger an alert
   */
  public async triggerAlert(
    ruleId: string,
    metadata: Record<string, any> = {},
    customTitle?: string,
    customDescription?: string
  ): Promise<void> {
    const rule = this.alertRules.get(ruleId);
    if (!rule || !rule.enabled) {
      return;
    }

    const alertId = `${ruleId}-${Date.now()}`;
    const suppressionKey = this.getSuppressionKey(rule, metadata);

    // Check suppression window
    if (this.isAlertSuppressed(suppressionKey, rule.suppression_window)) {
      this.logger.debug(`Alert suppressed: ${ruleId}`, { suppressionKey });
      return;
    }

    // Create alert
    const alert: Alert = {
      id: alertId,
      timestamp: new Date(),
      severity: rule.severity,
      source: ruleId,
      title: customTitle || rule.name,
      description: customDescription || `Alert triggered for rule: ${rule.name}`,
      metadata,
      tags: rule.tags,
      resolved: false,
      escalation_level: 0,
      notification_attempts: 0
    };

    this.alerts.set(alertId, alert);
    this.updateSuppressionCache(suppressionKey);
    this.updateMetrics(alert);

    this.logger.info('Alert triggered', {
      alert_id: alertId,
      rule_id: ruleId,
      severity: rule.severity,
      metadata
    });

    // Send initial notifications
    await this.sendNotifications(alert, rule);

    // Setup escalation if policy exists
    if (rule.escalation_policy) {
      this.setupEscalation(alert, rule);
    }

    this.emit('alertTriggered', alert);
  }

  /**
   * Resolve an alert
   */
  public async resolveAlert(
    alertId: string,
    resolution_note?: string
  ): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.resolved) {
      return;
    }

    alert.resolved = true;
    alert.resolved_at = new Date();
    alert.metadata.resolution_note = resolution_note;

    // Clear escalation timer
    const timer = this.escalationTimers.get(alertId);
    if (timer) {
      clearTimeout(timer);
      this.escalationTimers.delete(alertId);
    }

    this.updateMetrics(alert);

    this.logger.info('Alert resolved', {
      alert_id: alertId,
      resolution_time: alert.resolved_at.getTime() - alert.timestamp.getTime(),
      resolution_note
    });

    // Send resolution notifications
    const rule = this.alertRules.get(alert.source);
    if (rule) {
      await this.sendResolutionNotifications(alert, rule);
    }

    this.emit('alertResolved', alert);
  }

  /**
   * Send notifications for an alert
   */
  private async sendNotifications(alert: Alert, rule: AlertRule): Promise<void> {
    const notifications = rule.notification_channels
      .filter(channel => channel.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const channel of notifications) {
      try {
        await this.sendNotification(alert, channel);
        alert.notification_attempts++;
      } catch (error) {
        this.logger.error('Failed to send notification', {
          alert_id: alert.id,
          channel_type: channel.type,
          error: error.message
        });
      }
    }
  }

  /**
   * Send a single notification
   */
  private async sendNotification(alert: Alert, channel: NotificationChannel): Promise<void> {
    switch (channel.type) {
      case 'email':
        await this.sendEmailNotification(alert, channel);
        break;
      case 'slack':
        await this.sendSlackNotification(alert, channel);
        break;
      case 'webhook':
        await this.sendWebhookNotification(alert, channel);
        break;
      case 'sms':
        await this.sendSMSNotification(alert, channel);
        break;
      case 'discord':
        await this.sendDiscordNotification(alert, channel);
        break;
      case 'pagerduty':
        await this.sendPagerDutyNotification(alert, channel);
        break;
      default:
        this.logger.warn(`Unknown notification channel type: ${channel.type}`);
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(alert: Alert, channel: NotificationChannel): Promise<void> {
    if (!this.emailTransporter) {
      throw new Error('Email transporter not configured');
    }

    const recipients = channel.config.recipients || ['alerts@company.com'];
    const subject = `[${alert.severity.toUpperCase()}] ${alert.title}`;
    const html = this.generateEmailTemplate(alert);

    await this.emailTransporter.sendMail({
      from: process.env.SMTP_FROM || 'alerts@company.com',
      to: recipients.join(', '),
      subject,
      html
    });

    this.logger.info('Email notification sent', {
      alert_id: alert.id,
      recipients: recipients.length
    });
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(alert: Alert, channel: NotificationChannel): Promise<void> {
    const webhookUrl = channel.config.webhook_url || process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error('Slack webhook URL not configured');
    }

    const color = this.getSeverityColor(alert.severity);
    const payload = {
      text: `Alert: ${alert.title}`,
      attachments: [
        {
          color,
          title: alert.title,
          text: alert.description,
          fields: [
            {
              title: 'Severity',
              value: alert.severity.toUpperCase(),
              short: true
            },
            {
              title: 'Source',
              value: alert.source,
              short: true
            },
            {
              title: 'Timestamp',
              value: alert.timestamp.toISOString(),
              short: true
            },
            {
              title: 'Tags',
              value: alert.tags.join(', '),
              short: true
            }
          ]
        }
      ]
    };

    await axios.post(webhookUrl, payload);

    this.logger.info('Slack notification sent', { alert_id: alert.id });
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(alert: Alert, channel: NotificationChannel): Promise<void> {
    const webhookUrl = channel.config.url;
    if (!webhookUrl) {
      throw new Error('Webhook URL not configured');
    }

    const payload = {
      alert_id: alert.id,
      timestamp: alert.timestamp,
      severity: alert.severity,
      title: alert.title,
      description: alert.description,
      metadata: alert.metadata,
      tags: alert.tags
    };

    await axios.post(webhookUrl, payload, {
      headers: channel.config.headers || {},
      timeout: 5000
    });

    this.logger.info('Webhook notification sent', {
      alert_id: alert.id,
      webhook_url: webhookUrl
    });
  }

  /**
   * Send SMS notification
   */
  private async sendSMSNotification(alert: Alert, channel: NotificationChannel): Promise<void> {
    if (!this.twilioClient) {
      throw new Error('Twilio client not configured');
    }

    const recipients = channel.config.recipients || [process.env.ALERT_PHONE_NUMBER];
    const message = `[${alert.severity.toUpperCase()}] ${alert.title}: ${alert.description}`;

    for (const recipient of recipients) {
      await this.twilioClient.messages.create({
        body: message.substring(0, 160), // SMS character limit
        from: process.env.TWILIO_PHONE_NUMBER,
        to: recipient
      });
    }

    this.logger.info('SMS notification sent', {
      alert_id: alert.id,
      recipients: recipients.length
    });
  }

  /**
   * Send Discord notification
   */
  private async sendDiscordNotification(alert: Alert, channel: NotificationChannel): Promise<void> {
    const webhookUrl = channel.config.webhook_url;
    if (!webhookUrl) {
      throw new Error('Discord webhook URL not configured');
    }

    const color = this.getSeverityColorHex(alert.severity);
    const payload = {
      embeds: [
        {
          title: `🚨 ${alert.title}`,
          description: alert.description,
          color: parseInt(color.replace('#', ''), 16),
          fields: [
            {
              name: 'Severity',
              value: alert.severity.toUpperCase(),
              inline: true
            },
            {
              name: 'Source',
              value: alert.source,
              inline: true
            },
            {
              name: 'Tags',
              value: alert.tags.join(', ') || 'None',
              inline: true
            }
          ],
          timestamp: alert.timestamp.toISOString()
        }
      ]
    };

    await axios.post(webhookUrl, payload);

    this.logger.info('Discord notification sent', { alert_id: alert.id });
  }

  /**
   * Send PagerDuty notification
   */
  private async sendPagerDutyNotification(alert: Alert, channel: NotificationChannel): Promise<void> {
    const integrationKey = channel.config.integration_key;
    if (!integrationKey) {
      throw new Error('PagerDuty integration key not configured');
    }

    const payload = {
      routing_key: integrationKey,
      event_action: 'trigger',
      dedup_key: alert.id,
      payload: {
        summary: alert.title,
        source: alert.source,
        severity: alert.severity,
        timestamp: alert.timestamp.toISOString(),
        custom_details: alert.metadata
      }
    };

    await axios.post('https://events.pagerduty.com/v2/enqueue', payload);

    this.logger.info('PagerDuty notification sent', { alert_id: alert.id });
  }

  /**
   * Send resolution notifications
   */
  private async sendResolutionNotifications(alert: Alert, rule: AlertRule): Promise<void> {
    const notifications = rule.notification_channels
      .filter(channel => channel.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const channel of notifications) {
      try {
        if (channel.type === 'slack') {
          await this.sendSlackResolutionNotification(alert, channel);
        } else if (channel.type === 'email') {
          await this.sendEmailResolutionNotification(alert, channel);
        } else if (channel.type === 'pagerduty') {
          await this.sendPagerDutyResolutionNotification(alert, channel);
        }
      } catch (error) {
        this.logger.error('Failed to send resolution notification', {
          alert_id: alert.id,
          channel_type: channel.type,
          error: error.message
        });
      }
    }
  }

  /**
   * Send Slack resolution notification
   */
  private async sendSlackResolutionNotification(alert: Alert, channel: NotificationChannel): Promise<void> {
    const webhookUrl = channel.config.webhook_url || process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      return;
    }

    const resolutionTime = alert.resolved_at 
      ? Math.round((alert.resolved_at.getTime() - alert.timestamp.getTime()) / 1000 / 60)
      : 0;

    const payload = {
      text: `✅ Alert Resolved: ${alert.title}`,
      attachments: [
        {
          color: 'good',
          title: `✅ ${alert.title}`,
          text: `Alert has been resolved after ${resolutionTime} minutes`,
          fields: [
            {
              title: 'Resolution Time',
              value: `${resolutionTime} minutes`,
              short: true
            },
            {
              title: 'Original Severity',
              value: alert.severity.toUpperCase(),
              short: true
            }
          ]
        }
      ]
    };

    await axios.post(webhookUrl, payload);
  }

  /**
   * Send email resolution notification
   */
  private async sendEmailResolutionNotification(alert: Alert, channel: NotificationChannel): Promise<void> {
    if (!this.emailTransporter) {
      return;
    }

    const recipients = channel.config.recipients || ['alerts@company.com'];
    const subject = `[RESOLVED] ${alert.title}`;
    const html = this.generateResolutionEmailTemplate(alert);

    await this.emailTransporter.sendMail({
      from: process.env.SMTP_FROM || 'alerts@company.com',
      to: recipients.join(', '),
      subject,
      html
    });
  }

  /**
   * Send PagerDuty resolution notification
   */
  private async sendPagerDutyResolutionNotification(alert: Alert, channel: NotificationChannel): Promise<void> {
    const integrationKey = channel.config.integration_key;
    if (!integrationKey) {
      return;
    }

    const payload = {
      routing_key: integrationKey,
      event_action: 'resolve',
      dedup_key: alert.id
    };

    await axios.post('https://events.pagerduty.com/v2/enqueue', payload);
  }

  /**
   * Setup escalation for an alert
   */
  private setupEscalation(alert: Alert, rule: AlertRule): void {
    if (!rule.escalation_policy || alert.escalation_level >= rule.escalation_policy.levels.length) {
      return;
    }

    const currentLevel = rule.escalation_policy.levels[alert.escalation_level];
    const delayMs = currentLevel.delay_minutes * 60 * 1000;

    const timer = setTimeout(async () => {
      if (this.alerts.get(alert.id)?.resolved) {
        return;
      }

      alert.escalation_level++;
      this.logger.info('Escalating alert', {
        alert_id: alert.id,
        escalation_level: alert.escalation_level
      });

      // Send escalation notifications
      for (const channel of currentLevel.channels) {
        try {
          await this.sendNotification(alert, channel);
        } catch (error) {
          this.logger.error('Failed to send escalation notification', {
            alert_id: alert.id,
            escalation_level: alert.escalation_level,
            error: error.message
          });
        }
      }

      // Setup next escalation level
      this.setupEscalation(alert, rule);

      // Setup repeat escalation if configured
      if (rule.escalation_policy!.repeat_interval) {
        this.setupRepeatEscalation(alert, rule, currentLevel);
      }

      this.emit('alertEscalated', alert);
    }, delayMs);

    this.escalationTimers.set(alert.id, timer);
  }

  /**
   * Setup repeat escalation
   */
  private setupRepeatEscalation(alert: Alert, rule: AlertRule, level: EscalationLevel): void {
    if (!rule.escalation_policy?.repeat_interval) {
      return;
    }

    const intervalMs = rule.escalation_policy.repeat_interval * 60 * 1000;
    
    const repeatTimer = setTimeout(async () => {
      if (this.alerts.get(alert.id)?.resolved) {
        return;
      }

      // Check max escalations
      if (rule.escalation_policy!.max_escalations && 
          alert.escalation_level >= rule.escalation_policy!.max_escalations) {
        return;
      }

      // Send repeat notifications
      for (const channel of level.channels) {
        try {
          await this.sendNotification(alert, channel);
        } catch (error) {
          this.logger.error('Failed to send repeat escalation notification', {
            alert_id: alert.id,
            error: error.message
          });
        }
      }

      // Schedule next repeat
      this.setupRepeatEscalation(alert, rule, level);
    }, intervalMs);

    // Store timer for cleanup
    this.escalationTimers.set(`${alert.id}-repeat`, repeatTimer);
  }

  /**
   * Check if alert is suppressed
   */
  private isAlertSuppressed(suppressionKey: string, suppressionWindow?: number): boolean {
    if (!suppressionWindow) {
      return false;
    }

    const lastTrigger = this.suppressionCache.get(suppressionKey);
    if (!lastTrigger) {
      return false;
    }

    const windowMs = suppressionWindow * 60 * 1000;
    return Date.now() - lastTrigger.getTime() < windowMs;
  }

  /**
   * Update suppression cache
   */
  private updateSuppressionCache(suppressionKey: string): void {
    this.suppressionCache.set(suppressionKey, new Date());
  }

  /**
   * Get suppression key for an alert
   */
  private getSuppressionKey(rule: AlertRule, metadata: Record<string, any>): string {
    // Create a unique key based on rule and relevant metadata
    const metadataKeys = Object.keys(metadata).sort();
    const metadataString = metadataKeys.map(key => `${key}:${metadata[key]}`).join('|');
    return `${rule.id}:${metadataString}`;
  }

  /**
   * Update metrics
   */
  private updateMetrics(alert: Alert): void {
    if (!alert.resolved) {
      this.metrics.total_alerts++;
      this.metrics.alerts_by_severity[alert.severity]++;
      this.metrics.active_alerts++;
    } else {
      this.metrics.active_alerts--;
      this.metrics.resolved_alerts++;

      if (alert.resolved_at) {
        const resolutionTime = alert.resolved_at.getTime() - alert.timestamp.getTime();
        this.metrics.avg_resolution_time = 
          (this.metrics.avg_resolution_time * (this.metrics.resolved_alerts - 1) + resolutionTime) / 
          this.metrics.resolved_alerts;
      }
    }

    // Calculate escalation rate
    const escalatedAlerts = Array.from(this.alerts.values()).filter(a => a.escalation_level > 0).length;
    this.metrics.escalation_rate = this.metrics.total_alerts > 0 ? 
      (escalatedAlerts / this.metrics.total_alerts) * 100 : 0;
  }

  /**
   * Get severity color for notifications
   */
  private getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.LOW:
        return 'good';
      case AlertSeverity.MEDIUM:
        return 'warning';
      case AlertSeverity.HIGH:
        return 'danger';
      case AlertSeverity.CRITICAL:
        return 'danger';
      default:
        return 'warning';
    }
  }

  /**
   * Get severity color in hex format
   */
  private getSeverityColorHex(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.LOW:
        return '#36a64f';
      case AlertSeverity.MEDIUM:
        return '#ff9900';
      case AlertSeverity.HIGH:
        return '#ff4444';
      case AlertSeverity.CRITICAL:
        return '#cc0000';
      default:
        return '#ff9900';
    }
  }

  /**
   * Generate email template for alerts
   */
  private generateEmailTemplate(alert: Alert): string {
    return `
      <html>
        <body style="font-family: Arial, sans-serif;">
          <div style="border-left: 5px solid ${this.getSeverityColorHex(alert.severity)}; padding-left: 20px;">
            <h2>🚨 Alert: ${alert.title}</h2>
            <p><strong>Severity:</strong> ${alert.severity.toUpperCase()}</p>
            <p><strong>Source:</strong> ${alert.source}</p>
            <p><strong>Timestamp:</strong> ${alert.timestamp.toISOString()}</p>
            <p><strong>Description:</strong></p>
            <p>${alert.description}</p>
            
            ${alert.tags.length > 0 ? `<p><strong>Tags:</strong> ${alert.tags.join(', ')}</p>` : ''}
            
            ${Object.keys(alert.metadata).length > 0 ? `
              <h3>Metadata:</h3>
              <ul>
                ${Object.entries(alert.metadata).map(([key, value]) => 
                  `<li><strong>${key}:</strong> ${JSON.stringify(value)}</li>`
                ).join('')}
              </ul>
            ` : ''}
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate email template for alert resolutions
   */
  private generateResolutionEmailTemplate(alert: Alert): string {
    const resolutionTime = alert.resolved_at 
      ? Math.round((alert.resolved_at.getTime() - alert.timestamp.getTime()) / 1000 / 60)
      : 0;

    return `
      <html>
        <body style="font-family: Arial, sans-serif;">
          <div style="border-left: 5px solid #36a64f; padding-left: 20px;">
            <h2>✅ Alert Resolved: ${alert.title}</h2>
            <p><strong>Original Severity:</strong> ${alert.severity.toUpperCase()}</p>
            <p><strong>Resolution Time:</strong> ${resolutionTime} minutes</p>
            <p><strong>Resolved At:</strong> ${alert.resolved_at?.toISOString()}</p>
            
            ${alert.metadata.resolution_note ? `
              <p><strong>Resolution Note:</strong> ${alert.metadata.resolution_note}</p>
            ` : ''}
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Start background tasks
   */
  private startBackgroundTasks(): void {
    // Clean up old alerts every hour
    setInterval(() => {
      this.cleanupOldAlerts();
    }, 3600000);

    // Clean up suppression cache every 15 minutes
    setInterval(() => {
      this.cleanupSuppressionCache();
    }, 900000);

    // Update metrics every 5 minutes
    setInterval(() => {
      this.calculateMetrics();
    }, 300000);
  }

  /**
   * Clean up old resolved alerts
   */
  private cleanupOldAlerts(): void {
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
    
    for (const [alertId, alert] of this.alerts.entries()) {
      if (alert.resolved && alert.resolved_at && alert.resolved_at.getTime() < cutoff) {
        this.alerts.delete(alertId);
      }
    }
  }

  /**
   * Clean up old suppression cache entries
   */
  private cleanupSuppressionCache(): void {
    const cutoff = Date.now() - (60 * 60 * 1000); // 1 hour
    
    for (const [key, timestamp] of this.suppressionCache.entries()) {
      if (timestamp.getTime() < cutoff) {
        this.suppressionCache.delete(key);
      }
    }
  }

  /**
   * Calculate and update metrics
   */
  private calculateMetrics(): void {
    const totalNotifications = Array.from(this.alerts.values())
      .reduce((sum, alert) => sum + alert.notification_attempts, 0);
    
    const successfulNotifications = totalNotifications; // Simplified for now
    
    this.metrics.notification_success_rate = totalNotifications > 0 ? 
      (successfulNotifications / totalNotifications) * 100 : 100;
  }

  /**
   * Get current metrics
   */
  public getMetrics(): AlertMetrics {
    return { ...this.metrics };
  }

  /**
   * Get active alerts
   */
  public getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Get alert by ID
   */
  public getAlert(alertId: string): Alert | undefined {
    return this.alerts.get(alertId);
  }

  /**
   * Add or update alert rule
   */
  public addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    this.logger.info('Alert rule added/updated', { rule_id: rule.id });
  }

  /**
   * Remove alert rule
   */
  public removeAlertRule(ruleId: string): void {
    this.alertRules.delete(ruleId);
    this.logger.info('Alert rule removed', { rule_id: ruleId });
  }

  /**
   * Get all alert rules
   */
  public getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  /**
   * Test notification channels
   */
  public async testNotificationChannels(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const rule of this.alertRules.values()) {
      for (const channel of rule.notification_channels) {
        if (!channel.enabled) continue;

        const testAlert: Alert = {
          id: 'test-alert',
          timestamp: new Date(),
          severity: AlertSeverity.LOW,
          source: 'test',
          title: 'Test Alert',
          description: 'This is a test alert to verify notification channels',
          metadata: { test: true },
          tags: ['test'],
          resolved: false,
          escalation_level: 0,
          notification_attempts: 0
        };

        try {
          await this.sendNotification(testAlert, channel);
          results[channel.type] = true;
        } catch (error) {
          results[channel.type] = false;
          this.logger.error(`Test notification failed for ${channel.type}:`, error);
        }
      }
    }

    return results;
  }
}

// Singleton instance
export const alertingSystem = new IntelligentAlertingSystem();

export default IntelligentAlertingSystem;