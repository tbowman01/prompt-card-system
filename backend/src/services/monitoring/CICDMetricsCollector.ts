import { EventEmitter } from 'events';
import axios from 'axios';
import { db } from '../../database/connection';
import { register, Histogram, Counter, Gauge } from 'prom-client';

// GitHub API configuration
interface GitHubConfig {
  owner: string;
  repo: string;
  token?: string;
  baseUrl: string;
}

interface PipelineMetrics {
  pipeline_name: string;
  branch: string;
  status: 'success' | 'failed' | 'in_progress' | 'cancelled';
  duration_seconds: number;
  started_at: Date;
  completed_at?: Date;
  workflow_id: string;
  run_id: string;
  commit_sha: string;
  author: string;
  event_type: string;
}

interface BuildMetrics {
  job_name: string;
  status: 'success' | 'failed' | 'in_progress';
  duration_seconds: number;
  build_number: string;
  branch: string;
  commit_sha: string;
  build_size_mb?: number;
}

interface TestMetrics {
  test_suite: string;
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  skipped_tests: number;
  duration_seconds: number;
  coverage_percentage?: number;
  branch: string;
  commit_sha: string;
}

interface DeploymentMetrics {
  service_name: string;
  environment: string;
  status: 'success' | 'failed' | 'in_progress' | 'rolled_back';
  duration_seconds: number;
  version: string;
  deployed_at: Date;
  deployment_id: string;
}

interface SecurityMetrics {
  service_name: string;
  scan_type: 'sast' | 'dependency' | 'container' | 'secrets';
  vulnerabilities_found: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  scan_duration_seconds: number;
  scan_status: 'success' | 'failed';
  scanned_at: Date;
}

export class CICDMetricsCollector extends EventEmitter {
  private githubConfig: GitHubConfig;
  private isRunning = false;
  private collectionInterval?: NodeJS.Timeout;
  
  // Prometheus metrics
  private pipelineDuration: Histogram<string>;
  private pipelineStatus: Gauge<string>;
  private pipelineCount: Counter<string>;
  private buildDuration: Histogram<string>;
  private testDuration: Histogram<string>;
  private testResults: Counter<string>;
  private deploymentDuration: Histogram<string>;
  private deploymentStatus: Gauge<string>;
  private securityVulnerabilities: Gauge<string>;
  private artifactSize: Gauge<string>;
  private queueLength: Gauge<string>;
  private runnerUtilization: Gauge<string>;
  private externalServiceStatus: Gauge<string>;
  
  constructor(config?: Partial<GitHubConfig>) {
    super();
    
    this.githubConfig = {
      owner: process.env.GITHUB_OWNER || 'tbowman01',
      repo: process.env.GITHUB_REPO || 'prompt-card-system',
      token: process.env.GITHUB_TOKEN,
      baseUrl: 'https://api.github.com',
      ...config
    };

    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    // Pipeline metrics
    this.pipelineDuration = new Histogram({
      name: 'cicd_pipeline_duration_seconds',
      help: 'Duration of CI/CD pipeline executions',
      labelNames: ['pipeline_name', 'branch', 'status', 'event_type'],
      buckets: [30, 60, 120, 300, 600, 1200, 1800, 3600] // 30s to 1h
    });

    this.pipelineStatus = new Gauge({
      name: 'cicd_pipeline_status',
      help: 'Current status of CI/CD pipelines (1=success, 0=failed, 2=in_progress)',
      labelNames: ['pipeline_name', 'branch', 'status']
    });

    this.pipelineCount = new Counter({
      name: 'cicd_pipeline_executions_total',
      help: 'Total number of pipeline executions',
      labelNames: ['pipeline_name', 'branch', 'status', 'event_type']
    });

    // Build metrics
    this.buildDuration = new Histogram({
      name: 'cicd_build_duration_seconds',
      help: 'Duration of build processes',
      labelNames: ['job_name', 'branch', 'status'],
      buckets: [60, 120, 300, 600, 900, 1800, 2400] // 1m to 40m
    });

    // Test metrics
    this.testDuration = new Histogram({
      name: 'cicd_test_duration_seconds',
      help: 'Duration of test execution',
      labelNames: ['test_suite', 'branch'],
      buckets: [10, 30, 60, 120, 300, 600, 900] // 10s to 15m
    });

    this.testResults = new Counter({
      name: 'cicd_test_executions_total',
      help: 'Total test executions by result',
      labelNames: ['test_suite', 'status', 'branch']
    });

    // Deployment metrics
    this.deploymentDuration = new Histogram({
      name: 'cicd_deployment_duration_seconds',
      help: 'Duration of deployment processes',
      labelNames: ['service_name', 'environment', 'status'],
      buckets: [30, 60, 120, 300, 600, 1200] // 30s to 20m
    });

    this.deploymentStatus = new Gauge({
      name: 'cicd_deployment_status',
      help: 'Current deployment status (1=success, 0=failed, 2=in_progress)',
      labelNames: ['service_name', 'environment', 'status']
    });

    // Security metrics
    this.securityVulnerabilities = new Gauge({
      name: 'cicd_security_vulnerabilities_total',
      help: 'Number of security vulnerabilities found',
      labelNames: ['service_name', 'severity', 'scan_type']
    });

    // Infrastructure metrics
    this.artifactSize = new Gauge({
      name: 'cicd_artifact_size_bytes',
      help: 'Size of build artifacts in bytes',
      labelNames: ['artifact_type', 'service_name']
    });

    this.queueLength = new Gauge({
      name: 'cicd_pipeline_queue_length',
      help: 'Number of pipelines waiting in queue',
      labelNames: ['runner_type']
    });

    this.runnerUtilization = new Gauge({
      name: 'cicd_runner_utilization_percentage',
      help: 'CI runner utilization percentage',
      labelNames: ['runner_name', 'runner_type']
    });

    this.externalServiceStatus = new Gauge({
      name: 'cicd_external_service_up',
      help: 'External service availability (1=up, 0=down)',
      labelNames: ['service_name', 'service_type']
    });

    // Register all metrics
    register.registerMetric(this.pipelineDuration);
    register.registerMetric(this.pipelineStatus);
    register.registerMetric(this.pipelineCount);
    register.registerMetric(this.buildDuration);
    register.registerMetric(this.testDuration);
    register.registerMetric(this.testResults);
    register.registerMetric(this.deploymentDuration);
    register.registerMetric(this.deploymentStatus);
    register.registerMetric(this.securityVulnerabilities);
    register.registerMetric(this.artifactSize);
    register.registerMetric(this.queueLength);
    register.registerMetric(this.runnerUtilization);
    register.registerMetric(this.externalServiceStatus);
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log('🔄 CI/CD Metrics Collector already running');
      return;
    }

    console.log('📊 Starting CI/CD Metrics Collector...');
    this.isRunning = true;

    // Initial collection
    await this.collectMetrics();

    // Set up periodic collection (every 2 minutes)
    this.collectionInterval = setInterval(async () => {
      await this.collectMetrics();
    }, 120000);

    console.log('✅ CI/CD Metrics Collector started successfully');
    this.emit('started');
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log('🔄 Stopping CI/CD Metrics Collector...');
    this.isRunning = false;

    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = undefined;
    }

    console.log('✅ CI/CD Metrics Collector stopped');
    this.emit('stopped');
  }

  private async collectMetrics(): Promise<void> {
    try {
      console.log('📈 Collecting CI/CD metrics...');
      
      await Promise.allSettled([
        this.collectGitHubActionsMetrics(),
        this.collectDeploymentMetrics(),
        this.collectTestMetrics(),
        this.collectSecurityMetrics(),
        this.collectInfrastructureMetrics(),
        this.checkExternalServices()
      ]);

      console.log('✅ CI/CD metrics collection completed');
      this.emit('metricsCollected', { timestamp: new Date() });
    } catch (error) {
      console.error('❌ Error collecting CI/CD metrics:', error);
      this.emit('error', error);
    }
  }

  private async collectGitHubActionsMetrics(): Promise<void> {
    if (!this.githubConfig.token) {
      console.log('ℹ️ No GitHub token provided, skipping GitHub Actions metrics');
      return;
    }

    try {
      const headers = {
        'Authorization': `token ${this.githubConfig.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'PromptCardSystem/1.0'
      };

      // Get recent workflow runs
      const workflowRunsResponse = await axios.get(
        `${this.githubConfig.baseUrl}/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/actions/runs`,
        {
          headers,
          params: {
            per_page: 50,
            created: `>${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()}` // Last 24 hours
          }
        }
      );

      const runs = workflowRunsResponse.data.workflow_runs;
      
      for (const run of runs) {
        const startTime = new Date(run.created_at);
        const endTime = run.updated_at ? new Date(run.updated_at) : new Date();
        const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

        // Update pipeline metrics
        const status = this.mapGitHubStatusToMetric(run.status, run.conclusion);
        const labels = {
          pipeline_name: run.name,
          branch: run.head_branch || 'unknown',
          status: status,
          event_type: run.event
        };

        this.pipelineDuration.observe(labels, duration);
        this.pipelineCount.inc(labels);
        
        // Set current status
        this.pipelineStatus.set({
          pipeline_name: run.name,
          branch: run.head_branch || 'unknown',
          status: status
        }, status === 'success' ? 1 : status === 'failed' ? 0 : 2);

        // Store in database for historical analysis
        await this.storePipelineMetrics({
          pipeline_name: run.name,
          branch: run.head_branch || 'unknown',
          status: status as any,
          duration_seconds: duration,
          started_at: startTime,
          completed_at: endTime,
          workflow_id: run.workflow_id.toString(),
          run_id: run.id.toString(),
          commit_sha: run.head_sha,
          author: run.head_commit?.author?.name || 'unknown',
          event_type: run.event
        });
      }

      // Get job details for build metrics
      for (const run of runs.slice(0, 10)) { // Limit to recent 10 runs
        await this.collectJobMetrics(run.id, headers);
      }

    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        console.log('ℹ️ Repository not found or no access to GitHub Actions');
      } else {
        console.error('❌ Error collecting GitHub Actions metrics:', error);
      }
    }
  }

  private async collectJobMetrics(runId: number, headers: any): Promise<void> {
    try {
      const jobsResponse = await axios.get(
        `${this.githubConfig.baseUrl}/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/actions/runs/${runId}/jobs`,
        { headers }
      );

      const jobs = jobsResponse.data.jobs;
      
      for (const job of jobs) {
        if (job.started_at && job.completed_at) {
          const startTime = new Date(job.started_at);
          const endTime = new Date(job.completed_at);
          const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
          const status = this.mapGitHubStatusToMetric(job.status, job.conclusion);

          this.buildDuration.observe({
            job_name: job.name,
            branch: 'unknown', // Would need to get from run context
            status: status
          }, duration);
        }
      }
    } catch (error) {
      console.error(`❌ Error collecting job metrics for run ${runId}:`, error);
    }
  }

  private mapGitHubStatusToMetric(status: string, conclusion?: string): string {
    if (status === 'completed') {
      return conclusion === 'success' ? 'success' : 'failed';
    }
    return status === 'in_progress' ? 'in_progress' : 'failed';
  }

  private async collectDeploymentMetrics(): Promise<void> {
    // Mock deployment metrics - in real scenario, this would connect to deployment systems
    // like Kubernetes, Docker Swarm, or cloud platforms
    
    const mockDeployments: DeploymentMetrics[] = [
      {
        service_name: 'prompt-card-backend',
        environment: 'production',
        status: 'success',
        duration_seconds: 120,
        version: process.env.npm_package_version || '1.0.0',
        deployed_at: new Date(),
        deployment_id: `deploy-${Date.now()}`
      },
      {
        service_name: 'prompt-card-frontend',
        environment: 'production',
        status: 'success',
        duration_seconds: 90,
        version: process.env.npm_package_version || '1.0.0',
        deployed_at: new Date(),
        deployment_id: `deploy-${Date.now()}`
      }
    ];

    for (const deployment of mockDeployments) {
      this.deploymentDuration.observe({
        service_name: deployment.service_name,
        environment: deployment.environment,
        status: deployment.status
      }, deployment.duration_seconds);

      this.deploymentStatus.set({
        service_name: deployment.service_name,
        environment: deployment.environment,
        status: deployment.status
      }, deployment.status === 'success' ? 1 : 0);
    }
  }

  private async collectTestMetrics(): Promise<void> {
    // Get test results from database or test reports
    try {
      const testSuites = ['backend-unit', 'backend-integration', 'frontend-unit'];
      
      for (const suite of testSuites) {
        // Mock test metrics - would integrate with actual test results
        const totalTests = Math.floor(Math.random() * 100) + 50;
        const failedTests = Math.floor(Math.random() * 5);
        const passedTests = totalTests - failedTests;
        const duration = Math.floor(Math.random() * 300) + 30;
        const coverage = Math.floor(Math.random() * 20) + 80;

        this.testDuration.observe({
          test_suite: suite,
          branch: 'main'
        }, duration);

        this.testResults.inc({
          test_suite: suite,
          status: 'passed',
          branch: 'main'
        }, passedTests);

        this.testResults.inc({
          test_suite: suite,
          status: 'failed',
          branch: 'main'
        }, failedTests);

        // Store coverage as a separate gauge (would need to add this metric)
        // this.testCoverage.set({ service_name: suite.split('-')[0] }, coverage);
      }
    } catch (error) {
      console.error('❌ Error collecting test metrics:', error);
    }
  }

  private async collectSecurityMetrics(): Promise<void> {
    // Mock security scan results
    const securityScans: SecurityMetrics[] = [
      {
        service_name: 'prompt-card-backend',
        scan_type: 'dependency',
        vulnerabilities_found: { critical: 0, high: 2, medium: 5, low: 10 },
        scan_duration_seconds: 45,
        scan_status: 'success',
        scanned_at: new Date()
      },
      {
        service_name: 'prompt-card-frontend',
        scan_type: 'dependency',
        vulnerabilities_found: { critical: 0, high: 1, medium: 3, low: 7 },
        scan_duration_seconds: 30,
        scan_status: 'success',
        scanned_at: new Date()
      }
    ];

    for (const scan of securityScans) {
      Object.entries(scan.vulnerabilities_found).forEach(([severity, count]) => {
        this.securityVulnerabilities.set({
          service_name: scan.service_name,
          severity,
          scan_type: scan.scan_type
        }, count);
      });
    }
  }

  private async collectInfrastructureMetrics(): Promise<void> {
    // Mock infrastructure metrics
    this.queueLength.set({ runner_type: 'ubuntu-latest' }, Math.floor(Math.random() * 5));
    this.runnerUtilization.set({ runner_name: 'runner-1', runner_type: 'ubuntu-latest' }, Math.random() * 100);
    
    // Mock artifact sizes
    this.artifactSize.set({ artifact_type: 'docker-image', service_name: 'backend' }, 500 * 1024 * 1024); // 500MB
    this.artifactSize.set({ artifact_type: 'docker-image', service_name: 'frontend' }, 200 * 1024 * 1024); // 200MB
  }

  private async checkExternalServices(): Promise<void> {
    const services = [
      { name: 'github', type: 'git', url: 'https://api.github.com' },
      { name: 'dockerhub', type: 'registry', url: 'https://registry-1.docker.io' },
      { name: 'npm', type: 'package', url: 'https://registry.npmjs.org' }
    ];

    for (const service of services) {
      try {
        const response = await axios.get(service.url, { timeout: 5000 });
        this.externalServiceStatus.set({
          service_name: service.name,
          service_type: service.type
        }, response.status === 200 ? 1 : 0);
      } catch (error) {
        this.externalServiceStatus.set({
          service_name: service.name,
          service_type: service.type
        }, 0);
      }
    }
  }

  private async storePipelineMetrics(metrics: PipelineMetrics): Promise<void> {
    try {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO cicd_pipeline_metrics (
          pipeline_name, branch, status, duration_seconds, started_at,
          completed_at, workflow_id, run_id, commit_sha, author, event_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        metrics.pipeline_name,
        metrics.branch,
        metrics.status,
        metrics.duration_seconds,
        metrics.started_at.toISOString(),
        metrics.completed_at?.toISOString(),
        metrics.workflow_id,
        metrics.run_id,
        metrics.commit_sha,
        metrics.author,
        metrics.event_type
      );
    } catch (error) {
      // If table doesn't exist, create it
      if (error instanceof Error && error.message.includes('no such table')) {
        await this.createMetricsTables();
        // Retry the insert
        await this.storePipelineMetrics(metrics);
      } else {
        console.error('❌ Error storing pipeline metrics:', error);
      }
    }
  }

  private async createMetricsTables(): Promise<void> {
    const createPipelineMetricsTable = `
      CREATE TABLE IF NOT EXISTS cicd_pipeline_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pipeline_name TEXT NOT NULL,
        branch TEXT NOT NULL,
        status TEXT NOT NULL,
        duration_seconds INTEGER NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        workflow_id TEXT NOT NULL,
        run_id TEXT UNIQUE NOT NULL,
        commit_sha TEXT NOT NULL,
        author TEXT NOT NULL,
        event_type TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createDeploymentMetricsTable = `
      CREATE TABLE IF NOT EXISTS cicd_deployment_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_name TEXT NOT NULL,
        environment TEXT NOT NULL,
        status TEXT NOT NULL,
        duration_seconds INTEGER NOT NULL,
        version TEXT NOT NULL,
        deployed_at TEXT NOT NULL,
        deployment_id TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    db.exec(createPipelineMetricsTable);
    db.exec(createDeploymentMetricsTable);
    
    console.log('✅ CI/CD metrics tables created');
  }

  public getMetrics(): string {
    return register.metrics();
  }

  public async getHistoricalData(
    metricType: 'pipeline' | 'deployment',
    timeRange: '1h' | '24h' | '7d' | '30d' = '24h'
  ): Promise<any[]> {
    const timeMap = {
      '1h': 1,
      '24h': 24,
      '7d': 24 * 7,
      '30d': 24 * 30
    };

    const hours = timeMap[timeRange];
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    try {
      if (metricType === 'pipeline') {
        const stmt = db.prepare(`
          SELECT * FROM cicd_pipeline_metrics 
          WHERE started_at > ? 
          ORDER BY started_at DESC
        `);
        return stmt.all(since);
      } else {
        const stmt = db.prepare(`
          SELECT * FROM cicd_deployment_metrics 
          WHERE deployed_at > ? 
          ORDER BY deployed_at DESC
        `);
        return stmt.all(since);
      }
    } catch (error) {
      console.error('❌ Error fetching historical data:', error);
      return [];
    }
  }
}

// Singleton instance
export const cicdMetricsCollector = new CICDMetricsCollector();