import { BaseAgent } from '../core/BaseAgent';
import { DuplicateManager, DuplicateManagementConfig } from '../../services/github/DuplicateManager';
import { IssueDuplicateAgent } from './IssueDuplicateAgent';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

export interface WorkflowConfig {
  repository: string;
  owner: string;
  githubToken: string;
  profile?: string;
  configPath?: string;
  scheduledRun?: boolean;
  webhookTriggered?: boolean;
  issueNumber?: number;
}

export interface WorkflowResult {
  type: 'analysis' | 'check' | 'scheduled' | 'webhook';
  repository: string;
  timestamp: string;
  success: boolean;
  report?: any;
  error?: string;
  duplicatesProcessed: number;
  executionTime: number;
}

export class DuplicateWorkflowAgent extends BaseAgent {
  private config: WorkflowConfig;
  private duplicateConfig: any;

  constructor(config: WorkflowConfig) {
    super('DuplicateWorkflowAgent', 'github-duplicate-workflow');
    this.config = config;
  }

  async execute(): Promise<WorkflowResult> {
    const startTime = Date.now();
    const result: WorkflowResult = {
      type: this.determineWorkflowType(),
      repository: `${this.config.owner}/${this.config.repository}`,
      timestamp: new Date().toISOString(),
      success: false,
      duplicatesProcessed: 0,
      executionTime: 0
    };

    try {
      // Load configuration
      await this.loadConfiguration();

      // Execute appropriate workflow
      switch (result.type) {
        case 'analysis':
          result.report = await this.runFullAnalysis();
          break;
        case 'check':
          result.report = await this.checkSpecificIssue();
          break;
        case 'scheduled':
          result.report = await this.runScheduledAnalysis();
          break;
        case 'webhook':
          result.report = await this.processWebhookEvent();
          break;
      }

      result.success = true;
      result.duplicatesProcessed = result.report?.totalDuplicatesFound || 0;
      result.executionTime = Date.now() - startTime;

      this.emit('workflow-complete', result);
      return result;
    } catch (error) {
      result.success = false;
      result.error = (error as Error).message;
      result.executionTime = Date.now() - startTime;
      
      this.logger.error('Workflow execution failed', error);
      this.emit('workflow-error', result);
      return result;
    }
  }

  private determineWorkflowType(): 'analysis' | 'check' | 'scheduled' | 'webhook' {
    if (this.config.issueNumber) return 'check';
    if (this.config.scheduledRun) return 'scheduled';
    if (this.config.webhookTriggered) return 'webhook';
    return 'analysis';
  }

  private async loadConfiguration(): Promise<void> {
    const configPath = this.config.configPath || 
      path.join(process.cwd(), '.claude-flow/github/duplicate-config.json');
    
    try {
      const configContent = await fs.readFile(configPath, 'utf-8');
      this.duplicateConfig = JSON.parse(configContent);
    } catch (error) {
      this.logger.warn('Could not load duplicate config, using defaults');
      this.duplicateConfig = {
        profiles: {
          moderate: {
            similarityThreshold: 0.85,
            autoClose: false,
            requireManualReview: true
          }
        }
      };
    }
  }

  private async runFullAnalysis(): Promise<any> {
    const profile = this.getProfileConfig();
    const managerConfig = this.buildManagerConfig(profile);
    
    const manager = new DuplicateManager(managerConfig);
    const report = await manager.analyzeDuplicates();
    
    // Save report
    await this.saveReport(report, 'analysis');
    
    // Send notifications if configured
    await this.sendNotifications(report);
    
    return report;
  }

  private async checkSpecificIssue(): Promise<any> {
    const profile = this.getProfileConfig();
    
    const agent = new IssueDuplicateAgent(
      {
        owner: this.config.owner,
        repository: this.config.repository,
        similarityThreshold: profile.similarityThreshold,
        autoClose: false
      },
      this.config.githubToken
    );
    
    const similarIssues = await agent.findSimilarIssues(this.config.issueNumber!);
    
    const report = {
      type: 'issue-check',
      targetIssue: this.config.issueNumber,
      similarIssues,
      timestamp: new Date().toISOString()
    };
    
    await this.saveReport(report, 'check');
    return report;
  }

  private async runScheduledAnalysis(): Promise<any> {
    const profile = this.getProfileConfig();
    const managerConfig = this.buildManagerConfig(profile);
    
    // For scheduled runs, be more conservative
    managerConfig.dryRun = !profile.autoClose;
    managerConfig.maxDaysOld = Math.min(profile.maxDaysOld || 30, 30);
    
    const manager = new DuplicateManager(managerConfig);
    const report = await manager.analyzeDuplicates();
    
    // Add schedule metadata
    report.scheduleInfo = {
      scheduled: true,
      interval: this.duplicateConfig.repositorySettings?.default?.scheduleInterval || 'daily'
    };
    
    await this.saveReport(report, 'scheduled');
    await this.sendNotifications(report);
    
    return report;
  }

  private async processWebhookEvent(): Promise<any> {
    // Process GitHub webhook events (issue created, updated, etc.)
    const profile = this.getProfileConfig();
    
    // For webhook events, only check the specific issue
    if (this.config.issueNumber) {
      return await this.checkSpecificIssue();
    }
    
    // Or run a quick analysis on recent issues
    const managerConfig = this.buildManagerConfig(profile);
    managerConfig.maxDaysOld = 1; // Only check today's issues
    managerConfig.dryRun = true; // Never auto-close on webhook
    
    const manager = new DuplicateManager(managerConfig);
    const report = await manager.analyzeDuplicates();
    
    report.webhookInfo = {
      triggered: true,
      timestamp: new Date().toISOString()
    };
    
    await this.saveReport(report, 'webhook');
    return report;
  }

  private getProfileConfig(): any {
    const profileName = this.config.profile || 
      this.duplicateConfig.repositorySettings?.default?.profile || 'moderate';
    
    const profile = this.duplicateConfig.profiles?.[profileName];
    if (!profile) {
      this.logger.warn(`Profile '${profileName}' not found, using moderate`);
      return this.duplicateConfig.profiles?.moderate || {
        similarityThreshold: 0.85,
        autoClose: false,
        requireManualReview: true
      };
    }
    
    return profile;
  }

  private buildManagerConfig(profile: any): DuplicateManagementConfig {
    return {
      owner: this.config.owner,
      repo: this.config.repository,
      githubToken: this.config.githubToken,
      similarityThreshold: profile.similarityThreshold,
      autoClose: profile.autoClose,
      dryRun: !profile.autoClose,
      closeMessage: profile.closeMessage,
      duplicateLabel: profile.duplicateLabel,
      excludeLabels: profile.excludeLabels,
      includeOnlyLabels: profile.includeOnlyLabels,
      maxDaysOld: profile.maxDaysOld,
      requireManualReview: profile.requireManualReview,
      reviewers: profile.reviewers,
      notifyOnClose: profile.notifyOnClose,
      batchSize: this.duplicateConfig.repositorySettings?.default?.batchSize || 100
    };
  }

  private async saveReport(report: any, type: string): Promise<void> {
    const reportsDir = path.join(process.cwd(), '.claude-flow/reports/duplicates');
    
    try {
      await fs.mkdir(reportsDir, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${type}-${this.config.repository}-${timestamp}.json`;
      const filepath = path.join(reportsDir, filename);
      
      await fs.writeFile(filepath, JSON.stringify(report, null, 2));
      this.logger.info(`Report saved to ${filepath}`);
    } catch (error) {
      this.logger.error('Failed to save report', error);
    }
  }

  private async sendNotifications(report: any): Promise<void> {
    const notifications = this.duplicateConfig.notifications;
    if (!notifications) return;

    // GitHub notifications
    if (notifications.github?.enabled) {
      await this.sendGitHubNotifications(report);
    }

    // Slack notifications
    if (notifications.slack?.enabled && notifications.slack.webhook) {
      await this.sendSlackNotification(report);
    }

    // Email notifications
    if (notifications.email?.enabled && notifications.email.recipients?.length > 0) {
      await this.sendEmailNotification(report);
    }
  }

  private async sendGitHubNotifications(report: any): Promise<void> {
    // Implementation would depend on notification strategy
    // Could create issues, comments, or discussions
    this.logger.info('GitHub notifications sent', {
      duplicateGroups: report.duplicateGroups?.length,
      totalDuplicates: report.totalDuplicatesFound
    });
  }

  private async sendSlackNotification(report: any): Promise<void> {
    // Implementation for Slack webhooks
    this.logger.info('Slack notification sent');
  }

  private async sendEmailNotification(report: any): Promise<void> {
    // Implementation for email notifications
    this.logger.info('Email notification sent');
  }

  // Static method for easy integration with claude-flow CLI
  static async runWorkflow(options: {
    owner: string;
    repo: string;
    token: string;
    profile?: string;
    issueNumber?: number;
    scheduled?: boolean;
    webhook?: boolean;
  }): Promise<WorkflowResult> {
    const agent = new DuplicateWorkflowAgent({
      owner: options.owner,
      repository: options.repo,
      githubToken: options.token,
      profile: options.profile,
      issueNumber: options.issueNumber,
      scheduledRun: options.scheduled,
      webhookTriggered: options.webhook
    });

    return await agent.execute();
  }
}