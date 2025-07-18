import { ReportTemplate } from '../../../types/reports';

export class ReportTemplates {
  private static templates: Map<string, ReportTemplate> = new Map();

  static initialize(): void {
    // Executive Summary Template
    this.templates.set('executive-summary', {
      id: 'executive-summary',
      name: 'Executive Summary',
      description: 'High-level overview of test execution metrics and cost analysis',
      type: 'executive',
      fields: [
        {
          key: 'overview-metrics',
          label: 'Overview Metrics',
          type: 'metric',
          required: true,
          description: 'Key performance indicators and success metrics'
        },
        {
          key: 'cost-summary',
          label: 'Cost Summary',
          type: 'chart',
          required: true,
          description: 'Cost breakdown by model and time period',
          chartType: 'pie'
        },
        {
          key: 'performance-trends',
          label: 'Performance Trends',
          type: 'chart',
          required: true,
          description: 'Performance metrics over time',
          chartType: 'line'
        },
        {
          key: 'key-insights',
          label: 'Key Insights',
          type: 'insight',
          required: true,
          description: 'AI-generated insights and recommendations'
        }
      ],
      defaultFilters: {
        period: '30d',
        status: 'all'
      },
      supportedFormats: ['pdf', 'excel', 'json'],
      customizable: true
    });

    // Detailed Test Execution Template
    this.templates.set('detailed-execution', {
      id: 'detailed-execution',
      name: 'Detailed Test Execution Report',
      description: 'Comprehensive analysis of test execution with full analytics',
      type: 'detailed',
      fields: [
        {
          key: 'execution-overview',
          label: 'Execution Overview',
          type: 'metric',
          required: true,
          description: 'Overall execution statistics and success rates'
        },
        {
          key: 'model-performance',
          label: 'Model Performance Comparison',
          type: 'table',
          required: true,
          description: 'Performance metrics by model'
        },
        {
          key: 'failure-analysis',
          label: 'Failure Analysis',
          type: 'chart',
          required: true,
          description: 'Analysis of test failures and common issues',
          chartType: 'bar'
        },
        {
          key: 'execution-timeline',
          label: 'Execution Timeline',
          type: 'chart',
          required: true,
          description: 'Test execution timeline with performance metrics',
          chartType: 'line'
        },
        {
          key: 'detailed-results',
          label: 'Detailed Results',
          type: 'table',
          required: true,
          description: 'Detailed test results with execution data'
        },
        {
          key: 'recommendations',
          label: 'Optimization Recommendations',
          type: 'insight',
          required: true,
          description: 'Performance and cost optimization suggestions'
        }
      ],
      defaultFilters: {
        period: '7d',
        status: 'all',
        includeFailures: true
      },
      supportedFormats: ['pdf', 'excel', 'json', 'csv'],
      customizable: true
    });

    // Cost Analysis Template
    this.templates.set('cost-analysis', {
      id: 'cost-analysis',
      name: 'Cost Analysis Report',
      description: 'Detailed cost breakdown with optimization recommendations',
      type: 'cost',
      fields: [
        {
          key: 'cost-overview',
          label: 'Cost Overview',
          type: 'metric',
          required: true,
          description: 'Total costs and key cost metrics'
        },
        {
          key: 'cost-by-model',
          label: 'Cost by Model',
          type: 'chart',
          required: true,
          description: 'Cost distribution across different models',
          chartType: 'pie'
        },
        {
          key: 'cost-trends',
          label: 'Cost Trends',
          type: 'chart',
          required: true,
          description: 'Cost trends over time',
          chartType: 'line'
        },
        {
          key: 'usage-patterns',
          label: 'Usage Patterns',
          type: 'table',
          required: true,
          description: 'Token usage and execution patterns'
        },
        {
          key: 'roi-analysis',
          label: 'ROI Analysis',
          type: 'metric',
          required: true,
          description: 'Return on investment calculations'
        },
        {
          key: 'cost-optimization',
          label: 'Cost Optimization',
          type: 'insight',
          required: true,
          description: 'Cost reduction recommendations and strategies'
        }
      ],
      defaultFilters: {
        period: '30d',
        includeProjections: true
      },
      supportedFormats: ['pdf', 'excel', 'json'],
      customizable: true
    });

    // Performance Analysis Template
    this.templates.set('performance-analysis', {
      id: 'performance-analysis',
      name: 'Performance Analysis Report',
      description: 'Comprehensive performance metrics and trend analysis',
      type: 'performance',
      fields: [
        {
          key: 'performance-overview',
          label: 'Performance Overview',
          type: 'metric',
          required: true,
          description: 'Key performance metrics and benchmarks'
        },
        {
          key: 'response-times',
          label: 'Response Time Analysis',
          type: 'chart',
          required: true,
          description: 'Response time distribution and trends',
          chartType: 'line'
        },
        {
          key: 'throughput-analysis',
          label: 'Throughput Analysis',
          type: 'chart',
          required: true,
          description: 'Tests per second and throughput metrics',
          chartType: 'bar'
        },
        {
          key: 'performance-by-model',
          label: 'Performance by Model',
          type: 'table',
          required: true,
          description: 'Performance comparison across models'
        },
        {
          key: 'bottleneck-analysis',
          label: 'Bottleneck Analysis',
          type: 'insight',
          required: true,
          description: 'Performance bottlenecks and optimization opportunities'
        },
        {
          key: 'performance-trends',
          label: 'Performance Trends',
          type: 'chart',
          required: true,
          description: 'Historical performance trends',
          chartType: 'area'
        }
      ],
      defaultFilters: {
        period: '7d',
        includeSystemMetrics: true
      },
      supportedFormats: ['pdf', 'excel', 'json'],
      customizable: true
    });

    // Custom Report Template
    this.templates.set('custom-report', {
      id: 'custom-report',
      name: 'Custom Report',
      description: 'Customizable report template with flexible fields',
      type: 'custom',
      fields: [
        {
          key: 'custom-metrics',
          label: 'Custom Metrics',
          type: 'metric',
          required: false,
          description: 'User-defined metrics and KPIs'
        },
        {
          key: 'custom-charts',
          label: 'Custom Charts',
          type: 'chart',
          required: false,
          description: 'User-defined charts and visualizations'
        },
        {
          key: 'custom-tables',
          label: 'Custom Tables',
          type: 'table',
          required: false,
          description: 'User-defined data tables'
        },
        {
          key: 'custom-insights',
          label: 'Custom Insights',
          type: 'insight',
          required: false,
          description: 'User-defined insights and analysis'
        }
      ],
      defaultFilters: {},
      supportedFormats: ['pdf', 'excel', 'json', 'csv'],
      customizable: true
    });

    console.log(`Initialized ${this.templates.size} report templates`);
  }

  static getTemplate(id: string): ReportTemplate | undefined {
    return this.templates.get(id);
  }

  static getAllTemplates(): ReportTemplate[] {
    return Array.from(this.templates.values());
  }

  static getTemplatesByType(type: ReportTemplate['type']): ReportTemplate[] {
    return Array.from(this.templates.values()).filter(template => template.type === type);
  }

  static addCustomTemplate(template: ReportTemplate): void {
    this.templates.set(template.id, template);
  }

  static removeTemplate(id: string): boolean {
    return this.templates.delete(id);
  }

  static updateTemplate(id: string, updates: Partial<ReportTemplate>): boolean {
    const template = this.templates.get(id);
    if (!template) return false;

    const updatedTemplate = { ...template, ...updates };
    this.templates.set(id, updatedTemplate);
    return true;
  }

  static validateTemplate(template: ReportTemplate): string[] {
    const errors: string[] = [];

    if (!template.id) {
      errors.push('Template ID is required');
    }

    if (!template.name) {
      errors.push('Template name is required');
    }

    if (!template.type) {
      errors.push('Template type is required');
    }

    if (!template.fields || template.fields.length === 0) {
      errors.push('Template must have at least one field');
    }

    if (!template.supportedFormats || template.supportedFormats.length === 0) {
      errors.push('Template must support at least one export format');
    }

    // Validate fields
    template.fields?.forEach((field, index) => {
      if (!field.key) {
        errors.push(`Field ${index + 1} is missing key`);
      }
      if (!field.label) {
        errors.push(`Field ${index + 1} is missing label`);
      }
      if (!field.type) {
        errors.push(`Field ${index + 1} is missing type`);
      }
    });

    return errors;
  }
}

// Initialize templates on module load
ReportTemplates.initialize();