/**
 * External Integrations Service
 * Handles integrations with Slack, Teams, GitHub, GitLab, Jira, and Asana
 */

import { EventEmitter } from 'events';
import axios, { AxiosInstance } from 'axios';
import { DatabaseConnection } from '../../database/connection';

export interface IntegrationConfig {
  id: string;
  organizationId: string;
  integrationType: 'slack' | 'teams' | 'github' | 'gitlab' | 'jira' | 'asana';
  name: string;
  configuration: Record<string, any>;
  credentials: Record<string, any>;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPayload {
  type: 'comment' | 'review' | 'document_update' | 'workspace_activity';
  title: string;
  message: string;
  data: Record<string, any>;
  recipients?: string[];
  urgency: 'low' | 'medium' | 'high';
}

export interface GitHubIntegrationConfig {
  repoOwner: string;
  repoName: string;
  accessToken: string;
  webhookSecret?: string;
  syncBranches: boolean;
  createIssues: boolean;
  syncPullRequests: boolean;
}

export interface SlackIntegrationConfig {
  webhookUrl: string;
  channel: string;
  botToken?: string;
  userToken?: string;
  enableThreads: boolean;
  mentionUsers: boolean;
}

export interface TeamsIntegrationConfig {
  webhookUrl: string;
  channelId?: string;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
}

export interface JiraIntegrationConfig {
  instanceUrl: string;
  email: string;
  apiToken: string;
  projectKey: string;
  issueType: string;
  createIssues: boolean;
}

export interface AsanaIntegrationConfig {
  accessToken: string;
  workspaceId: string;
  projectId: string;
  createTasks: boolean;
  syncComments: boolean;
}

export class ExternalIntegrations extends EventEmitter {
  private db: DatabaseConnection;
  private httpClient: AxiosInstance;
  private integrations: Map<string, IntegrationConfig> = new Map();
  private rateLimits: Map<string, { count: number; resetTime: number }> = new Map();

  constructor() {
    super();
    this.db = new DatabaseConnection();
    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': 'PromptCard-Collaboration/1.0'
      }
    });
    
    this.loadIntegrations();
    this.setupRateLimitHandling();
  }

  /**
   * Load active integrations from database
   */
  private async loadIntegrations(): Promise<void> {
    try {
      const result = await this.db.query(`
        SELECT * FROM collaboration.integrations WHERE is_active = true
      `);
      
      for (const row of result.rows) {
        const integration: IntegrationConfig = {
          id: row.id,
          organizationId: row.organization_id,
          integrationType: row.integration_type,
          name: row.name,
          configuration: JSON.parse(row.configuration || '{}'),
          credentials: JSON.parse(row.credentials || '{}'),
          isActive: row.is_active,
          createdBy: row.created_by,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at)
        };
        
        this.integrations.set(integration.id, integration);
      }
      
      console.log(`Loaded ${this.integrations.size} integrations`);
    } catch (error) {
      console.error('Error loading integrations:', error);
    }
  }

  /**
   * Setup rate limit handling for external APIs
   */
  private setupRateLimitHandling(): void {
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'] || 60;
          const integrationId = error.config?.integrationId;
          
          if (integrationId) {
            this.rateLimits.set(integrationId, {
              count: 0,
              resetTime: Date.now() + (retryAfter * 1000)
            });
          }
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Create new integration
   */
  public async createIntegration(integrationData: {
    organizationId: string;
    integrationType: IntegrationConfig['integrationType'];
    name: string;
    configuration: Record<string, any>;
    credentials: Record<string, any>;
    createdBy: string;
  }): Promise<IntegrationConfig> {
    try {
      const integrationId = require('uuid').v4();
      const now = new Date();
      
      // Validate integration configuration
      await this.validateIntegration(integrationData.integrationType, integrationData.configuration, integrationData.credentials);
      
      const integration: IntegrationConfig = {
        id: integrationId,
        organizationId: integrationData.organizationId,
        integrationType: integrationData.integrationType,
        name: integrationData.name,
        configuration: integrationData.configuration,
        credentials: integrationData.credentials,
        isActive: true,
        createdBy: integrationData.createdBy,
        createdAt: now,
        updatedAt: now
      };
      
      // Store in database
      await this.db.query(`
        INSERT INTO collaboration.integrations (
          id, organization_id, integration_type, name, configuration, credentials, is_active, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        integration.id,
        integration.organizationId,
        integration.integrationType,
        integration.name,
        JSON.stringify(integration.configuration),
        JSON.stringify(integration.credentials),
        integration.isActive,
        integration.createdBy,
        integration.createdAt,
        integration.updatedAt
      ]);
      
      // Cache integration
      this.integrations.set(integrationId, integration);
      
      this.emit('integration-created', integration);
      
      return integration;
    } catch (error) {
      console.error('Error creating integration:', error);
      throw error;
    }
  }

  /**
   * Send notification to integrated services
   */
  public async sendNotification(
    organizationId: string,
    payload: NotificationPayload,
    integrationType?: IntegrationConfig['integrationType']
  ): Promise<{ success: boolean; results: Array<{ integration: string; success: boolean; error?: string }> }> {
    try {
      const orgIntegrations = Array.from(this.integrations.values())
        .filter(integration => 
          integration.organizationId === organizationId && 
          integration.isActive &&
          (!integrationType || integration.integrationType === integrationType)
        );
      
      if (orgIntegrations.length === 0) {
        return { success: true, results: [] };
      }
      
      const results = await Promise.allSettled(
        orgIntegrations.map(integration => this.sendToIntegration(integration, payload))
      );
      
      const formattedResults = results.map((result, index) => ({
        integration: orgIntegrations[index].name,
        success: result.status === 'fulfilled',
        error: result.status === 'rejected' ? result.reason?.message : undefined
      }));
      
      const overallSuccess = formattedResults.every(result => result.success);
      
      return { success: overallSuccess, results: formattedResults };
    } catch (error) {
      console.error('Error sending notifications:', error);
      return { success: false, results: [] };
    }
  }

  /**
   * Send notification to specific integration
   */
  private async sendToIntegration(integration: IntegrationConfig, payload: NotificationPayload): Promise<void> {
    // Check rate limits
    const rateLimit = this.rateLimits.get(integration.id);
    if (rateLimit && Date.now() < rateLimit.resetTime) {
      throw new Error(`Rate limited for integration ${integration.name}`);
    }
    
    switch (integration.integrationType) {
      case 'slack':
        await this.sendSlackNotification(integration, payload);
        break;
      case 'teams':
        await this.sendTeamsNotification(integration, payload);
        break;
      case 'github':
        await this.sendGitHubNotification(integration, payload);
        break;
      case 'gitlab':
        await this.sendGitLabNotification(integration, payload);
        break;
      case 'jira':
        await this.sendJiraNotification(integration, payload);
        break;
      case 'asana':
        await this.sendAsanaNotification(integration, payload);
        break;
      default:
        throw new Error(`Unsupported integration type: ${integration.integrationType}`);
    }
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(integration: IntegrationConfig, payload: NotificationPayload): Promise<void> {
    try {
      const config = integration.configuration as SlackIntegrationConfig;
      
      const slackMessage = {
        channel: config.channel,
        text: payload.title,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: payload.title
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: payload.message
            }
          }
        ],
        attachments: []
      };
      
      // Add action buttons based on notification type
      if (payload.type === 'review') {
        slackMessage.attachments.push({
          color: payload.urgency === 'high' ? 'danger' : 'good',
          actions: [
            {
              type: 'button',
              text: 'View Review',
              url: payload.data.reviewUrl
            }
          ]
        });
      }
      
      // Send via webhook or bot API
      if (config.webhookUrl) {
        await this.httpClient.post(config.webhookUrl, slackMessage, {
          integrationId: integration.id
        } as any);
      } else if (config.botToken) {
        await this.httpClient.post('https://slack.com/api/chat.postMessage', slackMessage, {
          headers: {
            'Authorization': `Bearer ${config.botToken}`,
            'Content-Type': 'application/json'
          },
          integrationId: integration.id
        } as any);
      }
      
    } catch (error) {
      console.error('Error sending Slack notification:', error);
      throw error;
    }
  }

  /**
   * Send Microsoft Teams notification
   */
  private async sendTeamsNotification(integration: IntegrationConfig, payload: NotificationPayload): Promise<void> {
    try {
      const config = integration.configuration as TeamsIntegrationConfig;
      
      const teamsMessage = {
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        themeColor: payload.urgency === 'high' ? 'FF0000' : '0076D7',
        summary: payload.title,
        sections: [
          {
            activityTitle: payload.title,
            activitySubtitle: payload.message,
            facts: Object.entries(payload.data)
              .filter(([key]) => !key.includes('url'))
              .map(([name, value]) => ({ name, value: String(value) }))
          }
        ],
        potentialAction: []
      };
      
      // Add action buttons
      if (payload.data.actionUrl) {
        teamsMessage.potentialAction.push({
          '@type': 'OpenUri',
          name: 'View Details',
          targets: [{
            os: 'default',
            uri: payload.data.actionUrl
          }]
        });
      }
      
      await this.httpClient.post(config.webhookUrl, teamsMessage, {
        integrationId: integration.id
      } as any);
      
    } catch (error) {
      console.error('Error sending Teams notification:', error);
      throw error;
    }
  }

  /**
   * Send GitHub notification (create issue or comment)
   */
  private async sendGitHubNotification(integration: IntegrationConfig, payload: NotificationPayload): Promise<void> {
    try {
      const config = integration.configuration as GitHubIntegrationConfig;
      
      if (config.createIssues && payload.type === 'review') {
        const issueData = {
          title: `Review Required: ${payload.title}`,
          body: `${payload.message}\n\n**Details:**\n${JSON.stringify(payload.data, null, 2)}`,
          labels: ['review-required', `priority-${payload.urgency}`]
        };
        
        await this.httpClient.post(
          `https://api.github.com/repos/${config.repoOwner}/${config.repoName}/issues`,
          issueData,
          {
            headers: {
              'Authorization': `token ${config.accessToken}`,
              'Accept': 'application/vnd.github.v3+json'
            },
            integrationId: integration.id
          } as any
        );
      }
      
    } catch (error) {
      console.error('Error sending GitHub notification:', error);
      throw error;
    }
  }

  /**
   * Send GitLab notification
   */
  private async sendGitLabNotification(integration: IntegrationConfig, payload: NotificationPayload): Promise<void> {
    // Similar implementation to GitHub
    console.log('GitLab notification:', payload.title);
  }

  /**
   * Send Jira notification (create issue)
   */
  private async sendJiraNotification(integration: IntegrationConfig, payload: NotificationPayload): Promise<void> {
    try {
      const config = integration.configuration as JiraIntegrationConfig;
      
      if (config.createIssues && payload.type === 'review') {
        const issueData = {
          fields: {
            project: {
              key: config.projectKey
            },
            summary: `Review Required: ${payload.title}`,
            description: payload.message,
            issuetype: {
              name: config.issueType
            },
            priority: {
              name: payload.urgency === 'high' ? 'High' : payload.urgency === 'medium' ? 'Medium' : 'Low'
            }
          }
        };
        
        const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
        
        await this.httpClient.post(
          `${config.instanceUrl}/rest/api/3/issue`,
          issueData,
          {
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json'
            },
            integrationId: integration.id
          } as any
        );
      }
      
    } catch (error) {
      console.error('Error sending Jira notification:', error);
      throw error;
    }
  }

  /**
   * Send Asana notification (create task)
   */
  private async sendAsanaNotification(integration: IntegrationConfig, payload: NotificationPayload): Promise<void> {
    try {
      const config = integration.configuration as AsanaIntegrationConfig;
      
      if (config.createTasks && payload.type === 'review') {
        const taskData = {
          data: {
            name: `Review Required: ${payload.title}`,
            notes: payload.message,
            projects: [config.projectId],
            completed: false
          }
        };
        
        await this.httpClient.post(
          'https://app.asana.com/api/1.0/tasks',
          taskData,
          {
            headers: {
              'Authorization': `Bearer ${config.accessToken}`,
              'Content-Type': 'application/json'
            },
            integrationId: integration.id
          } as any
        );
      }
      
    } catch (error) {
      console.error('Error sending Asana notification:', error);
      throw error;
    }
  }

  /**
   * Validate integration configuration
   */
  private async validateIntegration(
    type: IntegrationConfig['integrationType'],
    configuration: Record<string, any>,
    credentials: Record<string, any>
  ): Promise<void> {
    try {
      switch (type) {
        case 'slack':
          await this.validateSlackIntegration(configuration, credentials);
          break;
        case 'teams':
          await this.validateTeamsIntegration(configuration, credentials);
          break;
        case 'github':
          await this.validateGitHubIntegration(configuration, credentials);
          break;
        case 'gitlab':
          await this.validateGitLabIntegration(configuration, credentials);
          break;
        case 'jira':
          await this.validateJiraIntegration(configuration, credentials);
          break;
        case 'asana':
          await this.validateAsanaIntegration(configuration, credentials);
          break;
        default:
          throw new Error(`Unsupported integration type: ${type}`);
      }
    } catch (error) {
      console.error(`Error validating ${type} integration:`, error);
      throw new Error(`Invalid ${type} integration configuration`);
    }
  }

  /**
   * Validate Slack integration
   */
  private async validateSlackIntegration(configuration: any, credentials: any): Promise<void> {
    const config = configuration as SlackIntegrationConfig;
    
    if (config.botToken) {
      // Test bot token
      const response = await this.httpClient.post(
        'https://slack.com/api/auth.test',
        {},
        {
          headers: {
            'Authorization': `Bearer ${config.botToken}`
          }
        }
      );
      
      if (!response.data.ok) {
        throw new Error('Invalid Slack bot token');
      }
    } else if (config.webhookUrl) {
      // Test webhook URL
      await this.httpClient.post(config.webhookUrl, {
        text: 'Integration test - please ignore'
      });
    } else {
      throw new Error('Either bot token or webhook URL is required for Slack integration');
    }
  }

  /**
   * Validate Teams integration
   */
  private async validateTeamsIntegration(configuration: any, credentials: any): Promise<void> {
    const config = configuration as TeamsIntegrationConfig;
    
    // Test webhook URL
    await this.httpClient.post(config.webhookUrl, {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      text: 'Integration test - please ignore'
    });
  }

  /**
   * Validate GitHub integration
   */
  private async validateGitHubIntegration(configuration: any, credentials: any): Promise<void> {
    const config = configuration as GitHubIntegrationConfig;
    
    // Test repository access
    const response = await this.httpClient.get(
      `https://api.github.com/repos/${config.repoOwner}/${config.repoName}`,
      {
        headers: {
          'Authorization': `token ${config.accessToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );
    
    if (response.status !== 200) {
      throw new Error('Unable to access GitHub repository');
    }
  }

  /**
   * Validate GitLab integration
   */
  private async validateGitLabIntegration(configuration: any, credentials: any): Promise<void> {
    // Implementation for GitLab validation
  }

  /**
   * Validate Jira integration
   */
  private async validateJiraIntegration(configuration: any, credentials: any): Promise<void> {
    const config = configuration as JiraIntegrationConfig;
    
    const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
    
    // Test authentication
    const response = await this.httpClient.get(
      `${config.instanceUrl}/rest/api/3/myself`,
      {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      }
    );
    
    if (response.status !== 200) {
      throw new Error('Invalid Jira credentials');
    }
    
    // Test project access
    const projectResponse = await this.httpClient.get(
      `${config.instanceUrl}/rest/api/3/project/${config.projectKey}`,
      {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      }
    );
    
    if (projectResponse.status !== 200) {
      throw new Error('Unable to access Jira project');
    }
  }

  /**
   * Validate Asana integration
   */
  private async validateAsanaIntegration(configuration: any, credentials: any): Promise<void> {
    const config = configuration as AsanaIntegrationConfig;
    
    // Test authentication
    const response = await this.httpClient.get(
      'https://app.asana.com/api/1.0/users/me',
      {
        headers: {
          'Authorization': `Bearer ${config.accessToken}`
        }
      }
    );
    
    if (response.status !== 200) {
      throw new Error('Invalid Asana access token');
    }
    
    // Test workspace access
    const workspaceResponse = await this.httpClient.get(
      `https://app.asana.com/api/1.0/workspaces/${config.workspaceId}`,
      {
        headers: {
          'Authorization': `Bearer ${config.accessToken}`
        }
      }
    );
    
    if (workspaceResponse.status !== 200) {
      throw new Error('Unable to access Asana workspace');
    }
  }

  /**
   * Get integrations for organization
   */
  public getOrganizationIntegrations(organizationId: string): IntegrationConfig[] {
    return Array.from(this.integrations.values())
      .filter(integration => integration.organizationId === organizationId);
  }

  /**
   * Update integration
   */
  public async updateIntegration(
    integrationId: string,
    updates: Partial<Pick<IntegrationConfig, 'name' | 'configuration' | 'credentials' | 'isActive'>>
  ): Promise<boolean> {
    try {
      const integration = this.integrations.get(integrationId);
      if (!integration) {
        return false;
      }
      
      // Validate updated configuration
      if (updates.configuration || updates.credentials) {
        await this.validateIntegration(
          integration.integrationType,
          updates.configuration || integration.configuration,
          updates.credentials || integration.credentials
        );
      }
      
      // Update database
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;
      
      if (updates.name !== undefined) {
        updateFields.push(`name = $${paramIndex++}`);
        updateValues.push(updates.name);
      }
      
      if (updates.configuration !== undefined) {
        updateFields.push(`configuration = $${paramIndex++}`);
        updateValues.push(JSON.stringify(updates.configuration));
      }
      
      if (updates.credentials !== undefined) {
        updateFields.push(`credentials = $${paramIndex++}`);
        updateValues.push(JSON.stringify(updates.credentials));
      }
      
      if (updates.isActive !== undefined) {
        updateFields.push(`is_active = $${paramIndex++}`);
        updateValues.push(updates.isActive);
      }
      
      updateFields.push(`updated_at = NOW()`);
      updateValues.push(integrationId);
      
      await this.db.query(`
        UPDATE collaboration.integrations
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
      `, updateValues);
      
      // Update cache
      Object.assign(integration, updates, { updatedAt: new Date() });
      
      this.emit('integration-updated', integration);
      
      return true;
    } catch (error) {
      console.error('Error updating integration:', error);
      return false;
    }
  }

  /**
   * Delete integration
   */
  public async deleteIntegration(integrationId: string): Promise<boolean> {
    try {
      const integration = this.integrations.get(integrationId);
      if (!integration) {
        return false;
      }
      
      // Remove from database
      await this.db.query(
        'DELETE FROM collaboration.integrations WHERE id = $1',
        [integrationId]
      );
      
      // Remove from cache
      this.integrations.delete(integrationId);
      
      this.emit('integration-deleted', integration);
      
      return true;
    } catch (error) {
      console.error('Error deleting integration:', error);
      return false;
    }
  }

  /**
   * Test integration
   */
  public async testIntegration(integrationId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const integration = this.integrations.get(integrationId);
      if (!integration) {
        return { success: false, error: 'Integration not found' };
      }
      
      await this.sendToIntegration(integration, {
        type: 'document_update',
        title: 'Integration Test',
        message: 'This is a test notification from PromptCard Collaboration. Please ignore.',
        data: { test: true },
        urgency: 'low'
      });
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get integration statistics
   */
  public getIntegrationStats(): {
    total: number;
    byType: Record<IntegrationConfig['integrationType'], number>;
    active: number;
    rateLimited: number;
  } {
    const stats = {
      total: this.integrations.size,
      byType: {} as Record<IntegrationConfig['integrationType'], number>,
      active: 0,
      rateLimited: this.rateLimits.size
    };
    
    for (const integration of this.integrations.values()) {
      stats.byType[integration.integrationType] = (stats.byType[integration.integrationType] || 0) + 1;
      if (integration.isActive) {
        stats.active++;
      }
    }
    
    return stats;
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    this.integrations.clear();
    this.rateLimits.clear();
  }
}

export default ExternalIntegrations;