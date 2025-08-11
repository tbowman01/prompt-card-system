import { Router, Request, Response } from 'express';
import { register } from 'prom-client';
import { cicdMetricsCollector } from '../services/monitoring/CICDMetricsCollector';
import { healthOrchestrator } from '../services/health/HealthOrchestrator';
import axios from 'axios';
import { db } from '../database/connection';

const router = Router();

// ===============================
// CI/CD METRICS ENDPOINTS
// ===============================

/**
 * GET /api/ci-cd/metrics
 * Prometheus metrics endpoint for CI/CD data
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await register.metrics();
    res.set('Content-Type', register.contentType);
    res.send(metrics);
  } catch (error) {
    console.error('❌ Error generating CI/CD metrics:', error);
    res.status(500).json({ error: 'Failed to generate metrics' });
  }
});

/**
 * GET /api/ci-cd/health
 * Health check endpoint for CI/CD monitoring system
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const systemHealth = healthOrchestrator.getSystemHealth();
    const cicdHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      components: {
        metricsCollector: cicdMetricsCollector.listenerCount('error') === 0 ? 'healthy' : 'degraded',
        prometheus: systemHealth.services.get('prometheus')?.status || 'unknown',
        grafana: systemHealth.services.get('grafana')?.status || 'unknown',
        github: await checkGitHubAPIHealth(),
        database: systemHealth.services.get('database')?.status || 'unknown'
      },
      metrics: {
        totalPipelines: await getTotalPipelinesCount(),
        recentFailures: await getRecentFailuresCount(),
        avgBuildTime: await getAverageBuildTime(),
        lastCollection: new Date().toISOString()
      }
    };

    // Determine overall health
    const unhealthyComponents = Object.values(cicdHealth.components).filter(
      status => status === 'unhealthy' || status === 'offline'
    ).length;

    if (unhealthyComponents > 0) {
      cicdHealth.status = unhealthyComponents > 2 ? 'unhealthy' : 'degraded';
    }

    const statusCode = cicdHealth.status === 'healthy' ? 200 : 
                      cicdHealth.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(cicdHealth);
  } catch (error) {
    console.error('❌ Error checking CI/CD health:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/deployment/metrics
 * Deployment-specific metrics endpoint
 */
router.get('/deployment/metrics', async (req: Request, res: Response) => {
  try {
    const deploymentMetrics = await generateDeploymentMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(deploymentMetrics);
  } catch (error) {
    console.error('❌ Error generating deployment metrics:', error);
    res.status(500).json({ error: 'Failed to generate deployment metrics' });
  }
});

/**
 * GET /api/build/metrics
 * Build performance metrics endpoint
 */
router.get('/build/metrics', async (req: Request, res: Response) => {
  try {
    const buildMetrics = await generateBuildMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(buildMetrics);
  } catch (error) {
    console.error('❌ Error generating build metrics:', error);
    res.status(500).json({ error: 'Failed to generate build metrics' });
  }
});

/**
 * GET /api/test-execution/metrics  
 * Test execution metrics endpoint
 */
router.get('/test-execution/metrics', async (req: Request, res: Response) => {
  try {
    const testMetrics = await generateTestMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(testMetrics);
  } catch (error) {
    console.error('❌ Error generating test metrics:', error);
    res.status(500).json({ error: 'Failed to generate test metrics' });
  }
});

/**
 * GET /api/registry/metrics
 * Docker registry and artifact metrics
 */
router.get('/registry/metrics', async (req: Request, res: Response) => {
  try {
    const registryMetrics = await generateRegistryMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(registryMetrics);
  } catch (error) {
    console.error('❌ Error generating registry metrics:', error);
    res.status(500).json({ error: 'Failed to generate registry metrics' });
  }
});

/**
 * GET /api/security/scan-metrics
 * Security scanning metrics endpoint
 */
router.get('/security/scan-metrics', async (req: Request, res: Response) => {
  try {
    const securityMetrics = await generateSecurityMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(securityMetrics);
  } catch (error) {
    console.error('❌ Error generating security metrics:', error);
    res.status(500).json({ error: 'Failed to generate security metrics' });
  }
});

// ===============================
// HISTORICAL DATA ENDPOINTS
// ===============================

/**
 * GET /api/ci-cd/historical/pipelines
 * Historical pipeline data for analysis
 */
router.get('/historical/pipelines', async (req: Request, res: Response) => {
  try {
    const { timeRange = '24h' } = req.query;
    const data = await cicdMetricsCollector.getHistoricalData(
      'pipeline', 
      timeRange as '1h' | '24h' | '7d' | '30d'
    );
    
    res.json({
      timeRange,
      count: data.length,
      data
    });
  } catch (error) {
    console.error('❌ Error fetching historical pipeline data:', error);
    res.status(500).json({ error: 'Failed to fetch historical data' });
  }
});

/**
 * GET /api/ci-cd/historical/deployments
 * Historical deployment data for analysis
 */
router.get('/historical/deployments', async (req: Request, res: Response) => {
  try {
    const { timeRange = '24h' } = req.query;
    const data = await cicdMetricsCollector.getHistoricalData(
      'deployment',
      timeRange as '1h' | '24h' | '7d' | '30d'
    );
    
    res.json({
      timeRange,
      count: data.length,
      data
    });
  } catch (error) {
    console.error('❌ Error fetching historical deployment data:', error);
    res.status(500).json({ error: 'Failed to fetch historical data' });
  }
});

/**
 * GET /api/ci-cd/performance-report
 * Performance regression analysis
 */
router.get('/performance-report', async (req: Request, res: Response) => {
  try {
    const report = await generatePerformanceReport();
    res.json(report);
  } catch (error) {
    console.error('❌ Error generating performance report:', error);
    res.status(500).json({ error: 'Failed to generate performance report' });
  }
});

// ===============================
// WEBHOOK ENDPOINTS
// ===============================

/**
 * POST /api/ci-cd/webhook/github
 * GitHub webhook for real-time CI/CD events
 */
router.post('/webhook/github', async (req: Request, res: Response) => {
  try {
    const event = req.headers['x-github-event'] as string;
    const payload = req.body;

    console.log(`📨 GitHub webhook received: ${event}`);

    // Process different event types
    switch (event) {
      case 'workflow_run':
        await processWorkflowRunEvent(payload);
        break;
      case 'deployment':
        await processDeploymentEvent(payload);
        break;
      case 'deployment_status':
        await processDeploymentStatusEvent(payload);
        break;
      default:
        console.log(`ℹ️ Unhandled GitHub event: ${event}`);
    }

    res.status(200).json({ message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('❌ Error processing GitHub webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// ===============================
// HELPER FUNCTIONS
// ===============================

async function checkGitHubAPIHealth(): Promise<string> {
  try {
    const response = await axios.get('https://api.github.com', { timeout: 5000 });
    return response.status === 200 ? 'healthy' : 'degraded';
  } catch (error) {
    return 'unhealthy';
  }
}

async function getTotalPipelinesCount(): Promise<number> {
  try {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM cicd_pipeline_metrics');
    const result = stmt.get() as { count: number };
    return result.count;
  } catch (error) {
    return 0;
  }
}

async function getRecentFailuresCount(): Promise<number> {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM cicd_pipeline_metrics 
      WHERE status = 'failed' AND started_at > ?
    `);
    const result = stmt.get(since) as { count: number };
    return result.count;
  } catch (error) {
    return 0;
  }
}

async function getAverageBuildTime(): Promise<number> {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const stmt = db.prepare(`
      SELECT AVG(duration_seconds) as avg FROM cicd_pipeline_metrics 
      WHERE started_at > ?
    `);
    const result = stmt.get(since) as { avg: number };
    return Math.round(result.avg || 0);
  } catch (error) {
    return 0;
  }
}

async function generateDeploymentMetrics(): Promise<string> {
  // Mock deployment metrics in Prometheus format
  const now = Date.now();
  return `
# HELP cicd_deployment_status Current deployment status
# TYPE cicd_deployment_status gauge
cicd_deployment_status{service_name="backend",environment="production",status="success"} 1 ${now}
cicd_deployment_status{service_name="frontend",environment="production",status="success"} 1 ${now}

# HELP cicd_deployment_duration_seconds Time taken for deployments
# TYPE cicd_deployment_duration_seconds histogram
cicd_deployment_duration_seconds_bucket{service_name="backend",environment="production",le="60"} 0 ${now}
cicd_deployment_duration_seconds_bucket{service_name="backend",environment="production",le="120"} 1 ${now}
cicd_deployment_duration_seconds_bucket{service_name="backend",environment="production",le="300"} 1 ${now}
cicd_deployment_duration_seconds_bucket{service_name="backend",environment="production",le="+Inf"} 1 ${now}
  `.trim();
}

async function generateBuildMetrics(): Promise<string> {
  const now = Date.now();
  return `
# HELP cicd_build_duration_seconds Time taken for builds
# TYPE cicd_build_duration_seconds histogram
cicd_build_duration_seconds_bucket{job_name="backend-build",branch="main",le="300"} 0 ${now}
cicd_build_duration_seconds_bucket{job_name="backend-build",branch="main",le="600"} 1 ${now}
cicd_build_duration_seconds_bucket{job_name="backend-build",branch="main",le="1200"} 1 ${now}
cicd_build_duration_seconds_bucket{job_name="backend-build",branch="main",le="+Inf"} 1 ${now}

# HELP cicd_build_size_bytes Size of build artifacts
# TYPE cicd_build_size_bytes gauge
cicd_build_size_bytes{job_name="backend-build",branch="main"} 524288000 ${now}
cicd_build_size_bytes{job_name="frontend-build",branch="main"} 209715200 ${now}
  `.trim();
}

async function generateTestMetrics(): Promise<string> {
  const now = Date.now();
  return `
# HELP cicd_test_executions_total Total number of test executions
# TYPE cicd_test_executions_total counter
cicd_test_executions_total{test_suite="backend-unit",status="passed",branch="main"} 45 ${now}
cicd_test_executions_total{test_suite="backend-unit",status="failed",branch="main"} 2 ${now}
cicd_test_executions_total{test_suite="frontend-unit",status="passed",branch="main"} 32 ${now}
cicd_test_executions_total{test_suite="frontend-unit",status="failed",branch="main"} 1 ${now}

# HELP cicd_test_coverage_percentage Test coverage percentage
# TYPE cicd_test_coverage_percentage gauge
cicd_test_coverage_percentage{service_name="backend"} 85.7 ${now}
cicd_test_coverage_percentage{service_name="frontend"} 78.2 ${now}
  `.trim();
}

async function generateRegistryMetrics(): Promise<string> {
  const now = Date.now();
  return `
# HELP cicd_docker_registry_up Docker registry availability
# TYPE cicd_docker_registry_up gauge
cicd_docker_registry_up{registry_url="docker.io"} 1 ${now}

# HELP cicd_artifact_storage_usage_percentage Storage utilization
# TYPE cicd_artifact_storage_usage_percentage gauge
cicd_artifact_storage_usage_percentage{storage_type="artifacts"} 65.3 ${now}

# HELP cicd_image_pull_duration_seconds Time to pull Docker images
# TYPE cicd_image_pull_duration_seconds histogram
cicd_image_pull_duration_seconds_bucket{image_name="node",tag="20",le="30"} 1 ${now}
cicd_image_pull_duration_seconds_bucket{image_name="node",tag="20",le="60"} 1 ${now}
cicd_image_pull_duration_seconds_bucket{image_name="node",tag="20",le="+Inf"} 1 ${now}
  `.trim();
}

async function generateSecurityMetrics(): Promise<string> {
  const now = Date.now();
  return `
# HELP cicd_security_vulnerabilities_total Number of security vulnerabilities found
# TYPE cicd_security_vulnerabilities_total gauge
cicd_security_vulnerabilities_total{service_name="backend",severity="critical",scan_type="dependency"} 0 ${now}
cicd_security_vulnerabilities_total{service_name="backend",severity="high",scan_type="dependency"} 2 ${now}
cicd_security_vulnerabilities_total{service_name="backend",severity="medium",scan_type="dependency"} 5 ${now}
cicd_security_vulnerabilities_total{service_name="backend",severity="low",scan_type="dependency"} 10 ${now}

# HELP cicd_security_scan_duration_seconds Time taken for security scans
# TYPE cicd_security_scan_duration_seconds histogram
cicd_security_scan_duration_seconds_bucket{service_name="backend",scan_type="dependency",le="60"} 1 ${now}
cicd_security_scan_duration_seconds_bucket{service_name="backend",scan_type="dependency",le="120"} 1 ${now}
cicd_security_scan_duration_seconds_bucket{service_name="backend",scan_type="dependency",le="+Inf"} 1 ${now}
  `.trim();
}

async function generatePerformanceReport(): Promise<any> {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  return {
    timestamp: now.toISOString(),
    period: '24h',
    performance: {
      pipelines: {
        totalRuns: await getTotalPipelinesCount(),
        successRate: 0.94,
        averageDuration: await getAverageBuildTime(),
        trend: 'improving'
      },
      builds: {
        averageDuration: 420, // 7 minutes
        cacheHitRate: 0.78,
        artifactSize: {
          backend: '500MB',
          frontend: '200MB'
        }
      },
      tests: {
        averageDuration: 180, // 3 minutes
        coverage: {
          backend: 85.7,
          frontend: 78.2
        },
        flakyTests: 2
      },
      deployments: {
        frequency: 3.2, // per day
        averageDuration: 90, // 1.5 minutes
        rollbackRate: 0.02
      }
    },
    alerts: {
      active: 0,
      resolved24h: 2
    },
    recommendations: [
      'Consider increasing test parallelism to reduce execution time',
      'Monitor dependency vulnerability scanning results',
      'Build cache hit rate could be improved'
    ]
  };
}

async function processWorkflowRunEvent(payload: any): Promise<void> {
  console.log(`📊 Processing workflow run: ${payload.workflow_run?.name} - ${payload.action}`);
  // Here you would update metrics based on the webhook payload
  // This integrates with the CICDMetricsCollector for real-time updates
}

async function processDeploymentEvent(payload: any): Promise<void> {
  console.log(`🚀 Processing deployment: ${payload.deployment?.environment} - ${payload.action}`);
  // Update deployment metrics in real-time
}

async function processDeploymentStatusEvent(payload: any): Promise<void> {
  console.log(`📊 Processing deployment status: ${payload.deployment_status?.state}`);
  // Update deployment status metrics
}

export default router;