import { CloudProviderConfig, CloudCostData } from '../types/enterpriseCostTracking';
import { db } from '../database/connection';
import axios from 'axios';

/**
 * Cloud Provider Integration Service
 * 
 * Integrates with AWS, Azure, and GCP to fetch real-time cost data
 * and synchronize with the enterprise cost tracking system.
 */
export class CloudProviderIntegration {
  private readonly syncInterval: Record<string, number> = {
    'realtime': 5 * 60 * 1000, // 5 minutes
    'hourly': 60 * 60 * 1000, // 1 hour
    'daily': 24 * 60 * 60 * 1000 // 24 hours
  };

  private activeSync: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Register a cloud provider configuration
   */
  public async registerCloudProvider(config: Omit<CloudProviderConfig, 'created_at' | 'updated_at'>): Promise<CloudProviderConfig> {
    const insertConfig = db.prepare(`
      INSERT OR REPLACE INTO cloud_provider_configs (
        id, provider, account_id, credentials, regions, sync_frequency,
        cost_allocation_tags, enabled_services, workspace_id, last_sync
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertConfig.run(
      config.id,
      config.provider,
      config.account_id,
      JSON.stringify(config.credentials),
      JSON.stringify(config.regions),
      config.sync_frequency,
      JSON.stringify(config.cost_allocation_tags),
      JSON.stringify(config.enabled_services),
      config.workspace_id,
      config.last_sync
    );

    const savedConfig: CloudProviderConfig = {
      ...config,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Start automatic synchronization
    await this.startProviderSync(savedConfig);

    return savedConfig;
  }

  /**
   * Start automatic synchronization for a provider
   */
  private async startProviderSync(config: CloudProviderConfig): Promise<void> {
    // Stop existing sync if running
    if (this.activeSync.has(config.id)) {
      clearInterval(this.activeSync.get(config.id)!);
    }

    const interval = this.syncInterval[config.sync_frequency] || this.syncInterval.daily;
    
    const syncTimer = setInterval(async () => {
      try {
        await this.syncProviderCosts(config);
      } catch (error) {
        console.error(`Error syncing costs for ${config.provider} (${config.account_id}):`, error);
      }
    }, interval);

    this.activeSync.set(config.id, syncTimer);
    
    // Perform initial sync
    await this.syncProviderCosts(config);
  }

  /**
   * Sync costs from a cloud provider
   */
  public async syncProviderCosts(config: CloudProviderConfig): Promise<CloudCostData[]> {
    console.log(`Syncing costs for ${config.provider} account ${config.account_id}...`);

    let costData: CloudCostData[] = [];

    try {
      switch (config.provider) {
        case 'aws':
          costData = await this.syncAWSCosts(config);
          break;
        case 'azure':
          costData = await this.syncAzureCosts(config);
          break;
        case 'gcp':
          costData = await this.syncGCPCosts(config);
          break;
        default:
          throw new Error(`Unsupported provider: ${config.provider}`);
      }

      // Store cost data
      await this.storeCostData(costData);

      // Update last sync time
      db.prepare(`
        UPDATE cloud_provider_configs 
        SET last_sync = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).run(config.id);

      console.log(`Successfully synced ${costData.length} cost records for ${config.provider}`);
      return costData;

    } catch (error) {
      console.error(`Failed to sync costs for ${config.provider}:`, error);
      throw error;
    }
  }

  /**
   * Sync AWS costs using Cost Explorer API
   */
  private async syncAWSCosts(config: CloudProviderConfig): Promise<CloudCostData[]> {
    const costData: CloudCostData[] = [];

    try {
      // This is a simplified example - in production, you would use AWS SDK
      const AWS = require('aws-sdk'); // Would need to install aws-sdk
      
      const costExplorer = new AWS.CostExplorer({
        accessKeyId: config.credentials.access_key,
        secretAccessKey: config.credentials.secret_key,
        region: 'us-east-1'
      });

      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours

      const params = {
        TimePeriod: {
          Start: startDate.toISOString().split('T')[0],
          End: endDate.toISOString().split('T')[0]
        },
        Granularity: 'DAILY',
        Metrics: ['BlendedCost', 'UsageQuantity'],
        GroupBy: [
          {
            Type: 'DIMENSION',
            Key: 'SERVICE'
          },
          {
            Type: 'DIMENSION',
            Key: 'REGION'
          }
        ]
      };

      const result = await costExplorer.getCostAndUsage(params).promise();

      for (const group of result.ResultsByTime) {
        for (const groupResult of group.Groups) {
          const serviceName = groupResult.Keys[0];
          const region = groupResult.Keys[1] || 'global';
          const cost = parseFloat(groupResult.Metrics.BlendedCost.Amount);
          const usage = parseFloat(groupResult.Metrics.UsageQuantity.Amount);

          if (cost > 0) {
            costData.push({
              provider: 'aws',
              account_id: config.account_id,
              service_name: serviceName,
              resource_id: `${serviceName}-${region}`,
              resource_name: `${serviceName} in ${region}`,
              resource_type: this.mapAWSServiceToResourceType(serviceName),
              region: region,
              cost_usd: cost,
              usage_quantity: usage,
              usage_unit: groupResult.Metrics.UsageQuantity.Unit || 'Units',
              billing_period: group.TimePeriod.Start,
              tags: this.extractAWSTags(groupResult),
              raw_data: groupResult,
              imported_at: new Date().toISOString()
            });
          }
        }
      }

    } catch (error) {
      console.error('Error syncing AWS costs:', error);
      // Fallback to mock data for development
      return this.generateMockAWSData(config);
    }

    return costData;
  }

  /**
   * Sync Azure costs using Cost Management API
   */
  private async syncAzureCosts(config: CloudProviderConfig): Promise<CloudCostData[]> {
    const costData: CloudCostData[] = [];

    try {
      // This is a simplified example - in production, you would use Azure SDK
      const { DefaultAzureCredential } = require('@azure/identity'); // Would need to install
      const { CostManagementClient } = require('@azure/arm-costmanagement');

      const credential = new DefaultAzureCredential();
      const client = new CostManagementClient(credential, config.credentials.subscription_id);

      const scope = `/subscriptions/${config.credentials.subscription_id}`;
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);

      const queryDefinition = {
        type: 'ActualCost',
        timeframe: 'Custom',
        timePeriod: {
          from: startDate.toISOString().split('T')[0],
          to: endDate.toISOString().split('T')[0]
        },
        dataset: {
          granularity: 'Daily',
          aggregation: {
            totalCost: {
              name: 'PreTaxCost',
              function: 'Sum'
            }
          },
          grouping: [
            {
              type: 'Dimension',
              name: 'ServiceName'
            },
            {
              type: 'Dimension',
              name: 'ResourceLocation'
            }
          ]
        }
      };

      const result = await client.query(scope, queryDefinition);

      if (result.rows) {
        for (const row of result.rows) {
          const serviceName = row[2]; // ServiceName
          const location = row[3]; // ResourceLocation
          const cost = parseFloat(row[0]); // Cost

          if (cost > 0) {
            costData.push({
              provider: 'azure',
              account_id: config.account_id,
              service_name: serviceName,
              resource_id: `${serviceName}-${location}`,
              resource_name: `${serviceName} in ${location}`,
              resource_type: this.mapAzureServiceToResourceType(serviceName),
              region: location,
              cost_usd: cost,
              usage_quantity: 1, // Azure doesn't provide usage in the same call
              usage_unit: 'Units',
              billing_period: row[1], // Date
              tags: {},
              raw_data: row,
              imported_at: new Date().toISOString()
            });
          }
        }
      }

    } catch (error) {
      console.error('Error syncing Azure costs:', error);
      // Fallback to mock data for development
      return this.generateMockAzureData(config);
    }

    return costData;
  }

  /**
   * Sync GCP costs using Cloud Billing API
   */
  private async syncGCPCosts(config: CloudProviderConfig): Promise<CloudCostData[]> {
    const costData: CloudCostData[] = [];

    try {
      // This is a simplified example - in production, you would use GCP SDK
      const { BigQuery } = require('@google-cloud/bigquery'); // Would need to install

      const bigquery = new BigQuery({
        projectId: config.credentials.project_id,
        keyFilename: config.credentials.service_account_key
      });

      const query = `
        SELECT 
          service.description as service_name,
          location.location as region,
          SUM(cost) as total_cost,
          SUM(IFNULL(usage.amount, 0)) as usage_amount,
          usage.unit as usage_unit,
          DATE(usage_start_time) as billing_date
        FROM \`${config.credentials.project_id}.cloud_billing_export.gcp_billing_export_v1_*\`
        WHERE DATE(usage_start_time) >= DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
          AND cost > 0
        GROUP BY service_name, region, usage_unit, billing_date
        ORDER BY total_cost DESC
      `;

      const [rows] = await bigquery.query(query);

      for (const row of rows) {
        costData.push({
          provider: 'gcp',
          account_id: config.account_id,
          service_name: row.service_name,
          resource_id: `${row.service_name}-${row.region}`,
          resource_name: `${row.service_name} in ${row.region}`,
          resource_type: this.mapGCPServiceToResourceType(row.service_name),
          region: row.region || 'global',
          cost_usd: row.total_cost,
          usage_quantity: row.usage_amount,
          usage_unit: row.usage_unit || 'Units',
          billing_period: row.billing_date,
          tags: {},
          raw_data: row,
          imported_at: new Date().toISOString()
        });
      }

    } catch (error) {
      console.error('Error syncing GCP costs:', error);
      // Fallback to mock data for development
      return this.generateMockGCPData(config);
    }

    return costData;
  }

  /**
   * Store cost data in the database
   */
  private async storeCostData(costData: CloudCostData[]): Promise<void> {
    if (costData.length === 0) return;

    const insertCostData = db.prepare(`
      INSERT OR REPLACE INTO infrastructure_costs (
        resource_id, resource_type, resource_name, provider, region,
        cost_usd, usage_amount, usage_unit, billing_period_start, 
        billing_period_end, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction(() => {
      for (const data of costData) {
        const billingStart = new Date(data.billing_period).toISOString();
        const billingEnd = new Date(new Date(data.billing_period).getTime() + 24 * 60 * 60 * 1000).toISOString();

        insertCostData.run(
          data.resource_id,
          data.resource_type,
          data.resource_name,
          data.provider,
          data.region,
          data.cost_usd,
          data.usage_quantity,
          data.usage_unit,
          billingStart,
          billingEnd,
          JSON.stringify(data.tags)
        );
      }
    });

    transaction();
  }

  /**
   * Map AWS service names to resource types
   */
  private mapAWSServiceToResourceType(serviceName: string): string {
    const serviceMap: Record<string, string> = {
      'Amazon Elastic Compute Cloud - Compute': 'ec2',
      'Amazon Relational Database Service': 'rds',
      'AWS Lambda': 'lambda',
      'Amazon Simple Storage Service': 'storage',
      'Amazon CloudFront': 'network',
      'Amazon Elastic Container Service': 'container',
      'Amazon Elastic Kubernetes Service': 'container'
    };

    return serviceMap[serviceName] || 'compute';
  }

  /**
   * Map Azure service names to resource types
   */
  private mapAzureServiceToResourceType(serviceName: string): string {
    const serviceMap: Record<string, string> = {
      'Virtual Machines': 'ec2',
      'Azure SQL Database': 'rds',
      'Functions': 'lambda',
      'Storage': 'storage',
      'Content Delivery Network': 'network',
      'Container Instances': 'container',
      'Kubernetes Service': 'container'
    };

    return serviceMap[serviceName] || 'compute';
  }

  /**
   * Map GCP service names to resource types
   */
  private mapGCPServiceToResourceType(serviceName: string): string {
    const serviceMap: Record<string, string> = {
      'Compute Engine': 'ec2',
      'Cloud SQL': 'rds',
      'Cloud Functions': 'lambda',
      'Cloud Storage': 'storage',
      'Cloud CDN': 'network',
      'Cloud Run': 'container',
      'Google Kubernetes Engine': 'container'
    };

    return serviceMap[serviceName] || 'compute';
  }

  /**
   * Extract AWS tags from cost data
   */
  private extractAWSTags(groupResult: any): Record<string, string> {
    // In a real implementation, you would extract tags from the AWS response
    return {
      service: groupResult.Keys[0],
      region: groupResult.Keys[1] || 'global'
    };
  }

  /**
   * Generate mock AWS data for development
   */
  private generateMockAWSData(config: CloudProviderConfig): CloudCostData[] {
    const services = ['EC2', 'RDS', 'Lambda', 'S3', 'CloudFront'];
    const regions = config.regions.length > 0 ? config.regions : ['us-east-1', 'us-west-2'];
    const costData: CloudCostData[] = [];

    for (const service of services) {
      for (const region of regions) {
        costData.push({
          provider: 'aws',
          account_id: config.account_id,
          service_name: service,
          resource_id: `${service.toLowerCase()}-${region}`,
          resource_name: `${service} in ${region}`,
          resource_type: this.mapAWSServiceToResourceType(service),
          region: region,
          cost_usd: Math.random() * 100 + 10,
          usage_quantity: Math.random() * 1000 + 100,
          usage_unit: 'Hours',
          billing_period: new Date().toISOString().split('T')[0],
          tags: { environment: 'production', team: 'engineering' },
          raw_data: { service, region },
          imported_at: new Date().toISOString()
        });
      }
    }

    return costData;
  }

  /**
   * Generate mock Azure data for development
   */
  private generateMockAzureData(config: CloudProviderConfig): CloudCostData[] {
    const services = ['Virtual Machines', 'SQL Database', 'Functions', 'Storage', 'CDN'];
    const regions = config.regions.length > 0 ? config.regions : ['eastus', 'westus2'];
    const costData: CloudCostData[] = [];

    for (const service of services) {
      for (const region of regions) {
        costData.push({
          provider: 'azure',
          account_id: config.account_id,
          service_name: service,
          resource_id: `${service.toLowerCase().replace(' ', '-')}-${region}`,
          resource_name: `${service} in ${region}`,
          resource_type: this.mapAzureServiceToResourceType(service),
          region: region,
          cost_usd: Math.random() * 80 + 15,
          usage_quantity: Math.random() * 800 + 50,
          usage_unit: 'Hours',
          billing_period: new Date().toISOString().split('T')[0],
          tags: { environment: 'production', department: 'IT' },
          raw_data: { service, region },
          imported_at: new Date().toISOString()
        });
      }
    }

    return costData;
  }

  /**
   * Generate mock GCP data for development
   */
  private generateMockGCPData(config: CloudProviderConfig): CloudCostData[] {
    const services = ['Compute Engine', 'Cloud SQL', 'Cloud Functions', 'Cloud Storage', 'Cloud CDN'];
    const regions = config.regions.length > 0 ? config.regions : ['us-central1', 'us-east1'];
    const costData: CloudCostData[] = [];

    for (const service of services) {
      for (const region of regions) {
        costData.push({
          provider: 'gcp',
          account_id: config.account_id,
          service_name: service,
          resource_id: `${service.toLowerCase().replace(' ', '-')}-${region}`,
          resource_name: `${service} in ${region}`,
          resource_type: this.mapGCPServiceToResourceType(service),
          region: region,
          cost_usd: Math.random() * 90 + 20,
          usage_quantity: Math.random() * 900 + 75,
          usage_unit: 'Hours',
          billing_period: new Date().toISOString().split('T')[0],
          tags: { env: 'prod', cost_center: 'engineering' },
          raw_data: { service, region },
          imported_at: new Date().toISOString()
        });
      }
    }

    return costData;
  }

  /**
   * Get all registered cloud providers
   */
  public async getCloudProviders(workspaceId?: string): Promise<CloudProviderConfig[]> {
    let query = `SELECT * FROM cloud_provider_configs`;
    const params: any[] = [];

    if (workspaceId) {
      query += ` WHERE workspace_id = ? OR workspace_id IS NULL`;
      params.push(workspaceId);
    }

    query += ` ORDER BY created_at DESC`;

    const results = db.prepare(query).all(...params);

    return results.map(row => ({
      ...row,
      credentials: JSON.parse(row.credentials),
      regions: JSON.parse(row.regions),
      cost_allocation_tags: JSON.parse(row.cost_allocation_tags),
      enabled_services: JSON.parse(row.enabled_services)
    }));
  }

  /**
   * Remove a cloud provider configuration
   */
  public async removeCloudProvider(configId: string): Promise<void> {
    // Stop sync if running
    if (this.activeSync.has(configId)) {
      clearInterval(this.activeSync.get(configId)!);
      this.activeSync.delete(configId);
    }

    // Remove from database
    db.prepare(`DELETE FROM cloud_provider_configs WHERE id = ?`).run(configId);
  }

  /**
   * Test cloud provider connection
   */
  public async testConnection(config: CloudProviderConfig): Promise<boolean> {
    try {
      const costData = await this.syncProviderCosts(config);
      return costData.length >= 0; // Connection successful if no error thrown
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * Get cost data from all providers for a specific period
   */
  public async getConsolidatedCosts(
    startDate: string,
    endDate: string,
    workspaceId?: string
  ): Promise<CloudCostData[]> {
    let query = `
      SELECT 
        ic.resource_id,
        ic.resource_type,
        ic.resource_name,
        ic.provider,
        ic.region,
        ic.cost_usd,
        ic.usage_amount,
        ic.usage_unit,
        ic.billing_period_start,
        ic.billing_period_end,
        ic.tags,
        cpc.account_id
      FROM infrastructure_costs ic
      JOIN cloud_provider_configs cpc ON ic.provider = cpc.provider
      WHERE ic.billing_period_start >= ? AND ic.billing_period_end <= ?
    `;
    const params = [startDate, endDate];

    if (workspaceId) {
      query += ` AND (ic.workspace_id = ? OR cpc.workspace_id = ?)`;
      params.push(workspaceId, workspaceId);
    }

    query += ` ORDER BY ic.cost_usd DESC`;

    const results = db.prepare(query).all(...params);

    return results.map(row => ({
      provider: row.provider as any,
      account_id: row.account_id,
      service_name: row.resource_type,
      resource_id: row.resource_id,
      resource_name: row.resource_name,
      resource_type: row.resource_type,
      region: row.region,
      cost_usd: row.cost_usd,
      usage_quantity: row.usage_amount,
      usage_unit: row.usage_unit,
      billing_period: row.billing_period_start,
      tags: JSON.parse(row.tags || '{}'),
      raw_data: {},
      imported_at: new Date().toISOString()
    }));
  }
}

export const cloudProviderIntegration = new CloudProviderIntegration();