import { EventEmitter } from 'events';
import { ProgressService } from '../websocket/ProgressService';
import { PerformanceMonitor } from '../performance/PerformanceMonitor';
import { AlertingSystem } from '../health/AlertingSystem';

export interface PipelineEvent {
  id: string;
  type: 'started' | 'completed' | 'failed' | 'cancelled';
  pipelineId: string;
  jobId?: string;
  timestamp: string;
  metadata?: any;
}

export interface PipelineWebhook {
  action: string;
  workflow_run: {
    id: number;
    name: string;
    status: 'requested' | 'queued' | 'in_progress' | 'completed';
    conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null;
    head_branch: string;
    head_sha: string;
    html_url: string;
    created_at: string;
    updated_at: string;
    run_started_at: string;
    jobs_url: string;
  };
  workflow: {
    name: string;
    path: string;
  };
  repository: {
    name: string;
    full_name: string;
  };
}

export class PipelineService extends EventEmitter {
  private progressService: ProgressService;
  private performanceMonitor: PerformanceMonitor;
  private alertingSystem: AlertingSystem;
  private activePipelines: Map<string, any> = new Map();
  private pipelineMetrics: Map<string, any> = new Map();

  constructor(
    progressService: ProgressService,
    performanceMonitor: PerformanceMonitor,
    alertingSystem: AlertingSystem
  ) {
    super();
    this.progressService = progressService;
    this.performanceMonitor = performanceMonitor;
    this.alertingSystem = alertingSystem;
  }

  /**
   * Process GitHub Actions webhook payload
   */
  processWebhook(payload: PipelineWebhook): void {
    const pipelineId = payload.workflow_run.id.toString();
    const startTime = new Date(payload.workflow_run.run_started_at || payload.workflow_run.created_at);
    
    try {
      switch (payload.action) {
        case 'requested':
        case 'queued':
          this.handlePipelineQueued(pipelineId, payload);
          break;
        case 'in_progress':
          this.handlePipelineStarted(pipelineId, payload);
          break;
        case 'completed':
          this.handlePipelineCompleted(pipelineId, payload);
          break;
      }
    } catch (error) {
      console.error(`Error processing pipeline webhook for ${pipelineId}:`, error);
      this.emit('error', {
        pipelineId,
        error: error.message,
        payload
      });
    }
  }

  /**
   * Handle pipeline queued event
   */
  private handlePipelineQueued(pipelineId: string, payload: PipelineWebhook): void {
    const pipelineData = {
      id: pipelineId,
      name: payload.workflow.name,
      status: 'pending',
      branch: payload.workflow_run.head_branch,
      commit: payload.workflow_run.head_sha.substring(0, 7),
      queuedAt: payload.workflow_run.created_at,
      url: payload.workflow_run.html_url,
      repository: payload.repository.full_name
    };

    this.activePipelines.set(pipelineId, pipelineData);
    
    // Emit to WebSocket clients
    this.progressService.broadcastMessage('pipeline-update', pipelineData);
    
    this.emit('pipeline-queued', { pipelineId, data: pipelineData });
  }

  /**
   * Handle pipeline started event
   */
  private handlePipelineStarted(pipelineId: string, payload: PipelineWebhook): void {
    const existingPipeline = this.activePipelines.get(pipelineId);
    const startTime = new Date(payload.workflow_run.run_started_at);
    
    const pipelineData = {
      ...existingPipeline,
      id: pipelineId,
      status: 'running',
      startTime: startTime.toISOString(),
      estimatedDuration: this.getEstimatedDuration(payload.workflow.name),
    };

    this.activePipelines.set(pipelineId, pipelineData);
    
    // Start performance monitoring
    this.performanceMonitor.recordMetric('pipeline_started', 1, {
      pipelineId,
      name: payload.workflow.name,
      branch: payload.workflow_run.head_branch
    });

    // Emit to WebSocket clients
    this.progressService.broadcastMessage('pipeline-update', pipelineData);
    
    this.emit('pipeline-started', { pipelineId, data: pipelineData });
  }

  /**
   * Handle pipeline completed event
   */
  private handlePipelineCompleted(pipelineId: string, payload: PipelineWebhook): void {
    const existingPipeline = this.activePipelines.get(pipelineId);
    const endTime = new Date(payload.workflow_run.updated_at);
    const startTime = new Date(payload.workflow_run.run_started_at || payload.workflow_run.created_at);
    const duration = endTime.getTime() - startTime.getTime();
    
    const status = this.mapConclusionToStatus(payload.workflow_run.conclusion);
    
    const pipelineData = {
      ...existingPipeline,
      id: pipelineId,
      status,
      endTime: endTime.toISOString(),
      duration,
      conclusion: payload.workflow_run.conclusion
    };

    this.activePipelines.set(pipelineId, pipelineData);
    
    // Record performance metrics
    this.performanceMonitor.recordMetric('pipeline_completed', 1, {
      pipelineId,
      name: payload.workflow.name,
      branch: payload.workflow_run.head_branch,
      status,
      duration
    });

    this.performanceMonitor.recordMetric('pipeline_duration', duration, {
      pipelineId,
      name: payload.workflow.name,
      status
    });

    // Update pipeline metrics
    this.updatePipelineMetrics(payload.workflow.name, status, duration);

    // Handle failures
    if (status === 'failure') {
      this.handlePipelineFailure(pipelineId, payload);
    }

    // Emit to WebSocket clients
    this.progressService.broadcastMessage('pipeline-update', pipelineData);
    
    this.emit('pipeline-completed', { pipelineId, data: pipelineData });

    // Clean up after some time
    setTimeout(() => {
      this.activePipelines.delete(pipelineId);
    }, 5 * 60 * 1000); // Keep for 5 minutes
  }

  /**
   * Handle pipeline failure
   */
  private handlePipelineFailure(pipelineId: string, payload: PipelineWebhook): void {
    const alert = {
      id: `pipeline-failure-${pipelineId}`,
      title: `Pipeline Failed: ${payload.workflow.name}`,
      message: `Pipeline failed on branch ${payload.workflow_run.head_branch}`,
      severity: 'high' as const,
      category: 'pipeline',
      source: 'pipeline-service',
      metadata: {
        pipelineId,
        branch: payload.workflow_run.head_branch,
        commit: payload.workflow_run.head_sha,
        url: payload.workflow_run.html_url
      }
    };

    this.alertingSystem.createAlert(alert);
    
    // Emit failure event
    this.emit('pipeline-failed', {
      pipelineId,
      payload,
      alert
    });
  }

  /**
   * Map GitHub Actions conclusion to our status
   */
  private mapConclusionToStatus(conclusion: string | null): string {
    switch (conclusion) {
      case 'success':
        return 'success';
      case 'failure':
        return 'failure';
      case 'cancelled':
        return 'cancelled';
      case 'skipped':
        return 'skipped';
      default:
        return 'unknown';
    }
  }

  /**
   * Get estimated duration based on historical data
   */
  private getEstimatedDuration(workflowName: string): number {
    const metrics = this.pipelineMetrics.get(workflowName);
    if (metrics && metrics.averageDuration) {
      return metrics.averageDuration;
    }
    
    // Default estimates by workflow type
    const defaultDurations: Record<string, number> = {
      'CI': 8 * 60 * 1000, // 8 minutes
      'Build': 5 * 60 * 1000, // 5 minutes
      'Deploy': 10 * 60 * 1000, // 10 minutes
      'Test': 15 * 60 * 1000, // 15 minutes
    };

    for (const [key, duration] of Object.entries(defaultDurations)) {
      if (workflowName.toLowerCase().includes(key.toLowerCase())) {
        return duration;
      }
    }

    return 10 * 60 * 1000; // Default 10 minutes
  }

  /**
   * Update pipeline metrics
   */
  private updatePipelineMetrics(workflowName: string, status: string, duration: number): void {
    const existing = this.pipelineMetrics.get(workflowName) || {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      totalDuration: 0,
      averageDuration: 0,
      successRate: 0
    };

    existing.totalRuns++;
    existing.totalDuration += duration;
    existing.averageDuration = existing.totalDuration / existing.totalRuns;

    if (status === 'success') {
      existing.successfulRuns++;
    } else if (status === 'failure') {
      existing.failedRuns++;
    }

    existing.successRate = (existing.successfulRuns / existing.totalRuns) * 100;

    this.pipelineMetrics.set(workflowName, existing);
  }

  /**
   * Get current pipeline metrics
   */
  getPipelineMetrics(workflowName?: string): any {
    if (workflowName) {
      return this.pipelineMetrics.get(workflowName) || null;
    }
    
    return Object.fromEntries(this.pipelineMetrics.entries());
  }

  /**
   * Get active pipelines
   */
  getActivePipelines(): any[] {
    return Array.from(this.activePipelines.values());
  }

  /**
   * Simulate pipeline progress updates (for testing)
   */
  simulatePipelineProgress(pipelineId: string): void {
    const pipeline = this.activePipelines.get(pipelineId);
    if (!pipeline || pipeline.status !== 'running') {
      return;
    }

    const jobs = [
      'setup-dependencies',
      'lint-and-format', 
      'test-backend',
      'test-frontend',
      'build',
      'deploy'
    ];

    let currentJob = 0;
    const interval = setInterval(() => {
      if (currentJob >= jobs.length) {
        // Complete pipeline
        const completedPipeline = {
          ...pipeline,
          status: 'success',
          endTime: new Date().toISOString(),
          duration: Date.now() - new Date(pipeline.startTime).getTime()
        };
        
        this.activePipelines.set(pipelineId, completedPipeline);
        this.progressService.broadcastMessage('pipeline-update', completedPipeline);
        
        clearInterval(interval);
        return;
      }

      // Update current job
      const updatedPipeline = {
        ...pipeline,
        currentJob: jobs[currentJob],
        progress: Math.round(((currentJob + 1) / jobs.length) * 100)
      };
      
      this.activePipelines.set(pipelineId, updatedPipeline);
      this.progressService.broadcastMessage('pipeline-update', updatedPipeline);
      
      currentJob++;
    }, 2000); // Update every 2 seconds
  }

  /**
   * Process job-level updates
   */
  processJobUpdate(pipelineId: string, jobData: any): void {
    const pipeline = this.activePipelines.get(pipelineId);
    if (!pipeline) return;

    const updatedPipeline = {
      ...pipeline,
      jobs: {
        ...pipeline.jobs,
        [jobData.name]: jobData
      }
    };

    this.activePipelines.set(pipelineId, updatedPipeline);
    this.progressService.broadcastMessage('pipeline-job-update', {
      pipelineId,
      job: jobData
    });
  }

  /**
   * Trigger deployment notification
   */
  notifyDeploymentStatus(deploymentData: any): void {
    this.progressService.broadcastMessage('deployment-update', deploymentData);
    
    if (deploymentData.status === 'failure') {
      const alert = {
        id: `deployment-failure-${deploymentData.id}`,
        title: `Deployment Failed: ${deploymentData.environment}`,
        message: `Deployment to ${deploymentData.environment} failed`,
        severity: 'critical' as const,
        category: 'deployment',
        source: 'pipeline-service',
        metadata: deploymentData
      };

      this.alertingSystem.createAlert(alert);
    }
  }

  /**
   * Get pipeline statistics
   */
  getStatistics(): any {
    const allMetrics = Array.from(this.pipelineMetrics.values());
    
    if (allMetrics.length === 0) {
      return {
        totalPipelines: 0,
        averageSuccessRate: 0,
        averageDuration: 0,
        totalRuns: 0
      };
    }

    const totalRuns = allMetrics.reduce((sum, m) => sum + m.totalRuns, 0);
    const totalSuccessful = allMetrics.reduce((sum, m) => sum + m.successfulRuns, 0);
    const totalDuration = allMetrics.reduce((sum, m) => sum + m.totalDuration, 0);

    return {
      totalPipelines: this.pipelineMetrics.size,
      averageSuccessRate: totalRuns > 0 ? (totalSuccessful / totalRuns) * 100 : 0,
      averageDuration: totalRuns > 0 ? totalDuration / totalRuns : 0,
      totalRuns,
      activePipelines: this.activePipelines.size
    };
  }
}

export default PipelineService;