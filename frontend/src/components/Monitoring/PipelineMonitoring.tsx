'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Progress } from '@/components/ui/progress';
import { useWebSocket } from '@/hooks/useWebSocket';
import { api } from '@/lib/api';
import {
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  GitBranch,
  GitCommit,
  GitPullRequest,
  Zap,
  AlertTriangle,
  RefreshCw,
  PlayCircle,
  PauseCircle,
  StopCircle,
  Calendar,
  Timer,
  Target,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';

export interface PipelineStatus {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'failure' | 'cancelled';
  branch: string;
  commit: string;
  commitMessage: string;
  author: string;
  startTime: string;
  duration?: number;
  endTime?: string;
  triggeredBy: string;
  jobs: PipelineJob[];
  metrics: PipelineMetrics;
}

export interface PipelineJob {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'failure' | 'cancelled' | 'skipped';
  startTime?: string;
  duration?: number;
  endTime?: string;
  logs?: string[];
  steps: JobStep[];
}

export interface JobStep {
  name: string;
  status: 'pending' | 'running' | 'success' | 'failure' | 'cancelled' | 'skipped';
  startTime?: string;
  duration?: number;
  endTime?: string;
}

export interface PipelineMetrics {
  totalRuns: number;
  successRate: number;
  averageDuration: number;
  failureRate: number;
  buildTrend: 'up' | 'down' | 'stable';
  testCoverage?: number;
  deploymentFrequency: number;
  meanTimeToRecovery: number;
}

export interface DeploymentStatus {
  id: string;
  environment: 'staging' | 'production';
  status: 'pending' | 'deploying' | 'success' | 'failure' | 'rolled_back';
  version: string;
  commit: string;
  deployedAt?: string;
  deployedBy: string;
  duration?: number;
  rollbackAvailable: boolean;
  healthChecks: HealthCheck[];
}

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastCheck: string;
  details?: string;
}

const PipelineMonitoring: React.FC = () => {
  const [pipelines, setPipelines] = useState<PipelineStatus[]>([]);
  const [deployments, setDeployments] = useState<DeploymentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPipeline, setSelectedPipeline] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filter, setFilter] = useState<'all' | 'running' | 'failed' | 'success'>('all');

  const { socket, isConnected } = useWebSocket();

  const fetchPipelineData = useCallback(async () => {
    try {
      setError(null);
      const [pipelineData, deploymentData] = await Promise.all([
        api.get('/ci-cd/pipelines'),
        api.get('/ci-cd/deployments')
      ]);

      setPipelines(pipelineData.data || []);
      setDeployments(deploymentData.data || []);
    } catch (err) {
      console.error('Error fetching pipeline data:', err);
      setError('Failed to load pipeline data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPipelineData();
  }, [fetchPipelineData]);

  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(fetchPipelineData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [autoRefresh, fetchPipelineData]);

  useEffect(() => {
    if (socket && isConnected) {
      // Real-time pipeline updates
      socket.on('pipeline-update', (update: Partial<PipelineStatus>) => {
        setPipelines(prev => prev.map(p => 
          p.id === update.id ? { ...p, ...update } : p
        ));
      });

      socket.on('deployment-update', (update: Partial<DeploymentStatus>) => {
        setDeployments(prev => prev.map(d => 
          d.id === update.id ? { ...d, ...update } : d
        ));
      });

      return () => {
        socket.off('pipeline-update');
        socket.off('deployment-update');
      };
    }
  }, [socket, isConnected]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'running':
        return <Activity className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failure':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled':
        return <StopCircle className="h-4 w-4 text-gray-500" />;
      case 'skipped':
        return <Minus className="h-4 w-4 text-gray-400" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'failure':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      case 'skipped':
        return 'bg-gray-50 text-gray-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatDuration = (ms: number) => {
    if (!ms) return 'N/A';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const filteredPipelines = pipelines.filter(pipeline => {
    if (filter === 'all') return true;
    return pipeline.status === filter;
  });

  const runningPipelines = pipelines.filter(p => p.status === 'running').length;
  const failedPipelines = pipelines.filter(p => p.status === 'failure').length;
  const overallSuccessRate = pipelines.length > 0 ? 
    pipelines.filter(p => p.status === 'success').length / pipelines.length * 100 : 0;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-lg">Loading pipeline status...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center text-red-800">
            <AlertTriangle className="h-5 w-5 mr-2" />
            Pipeline Monitoring Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-700 mb-4">{error}</p>
          <Button onClick={fetchPipelineData} variant="outline" className="w-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pipeline Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Pipelines</CardTitle>
            <Activity className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{runningPipelines}</div>
            <p className="text-xs text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <Target className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{overallSuccessRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Builds</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{failedPipelines}</div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Timer className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {pipelines.length > 0 ? formatDuration(
                pipelines.reduce((sum, p) => sum + (p.duration || 0), 0) / pipelines.length
              ) : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">Build time</p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-semibold">CI/CD Pipelines</h2>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600">
              {isConnected ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">All</option>
            <option value="running">Running</option>
            <option value="failed">Failed</option>
            <option value="success">Success</option>
          </select>

          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? 'Auto ON' : 'Auto OFF'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchPipelineData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Pipeline List */}
      <div className="space-y-4">
        {filteredPipelines.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No pipelines found for the selected filter</p>
            </CardContent>
          </Card>
        ) : (
          filteredPipelines.map((pipeline) => (
            <Card key={pipeline.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {getStatusIcon(pipeline.status)}
                    <div>
                      <CardTitle className="text-base">{pipeline.name}</CardTitle>
                      <CardDescription className="flex items-center space-x-4">
                        <span className="flex items-center">
                          <GitBranch className="h-3 w-3 mr-1" />
                          {pipeline.branch}
                        </span>
                        <span className="flex items-center">
                          <GitCommit className="h-3 w-3 mr-1" />
                          {pipeline.commit.substring(0, 7)}
                        </span>
                        <span>by {pipeline.author}</span>
                      </CardDescription>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Badge className={getStatusColor(pipeline.status)}>
                      {pipeline.status.toUpperCase()}
                    </Badge>
                    {pipeline.duration && (
                      <span className="text-sm text-gray-500">
                        {formatDuration(pipeline.duration)}
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  {/* Commit Message */}
                  <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                    {pipeline.commitMessage}
                  </p>

                  {/* Pipeline Progress */}
                  {pipeline.status === 'running' && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span>
                          {pipeline.jobs.filter(j => j.status === 'success').length} / {pipeline.jobs.length} jobs
                        </span>
                      </div>
                      <Progress 
                        value={(pipeline.jobs.filter(j => j.status === 'success').length / pipeline.jobs.length) * 100} 
                        className="w-full"
                      />
                    </div>
                  )}

                  {/* Jobs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                    {pipeline.jobs.map((job) => (
                      <div key={job.id} className="flex items-center space-x-2 p-2 border rounded-md hover:bg-gray-50">
                        {getStatusIcon(job.status)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{job.name}</p>
                          {job.duration && (
                            <p className="text-xs text-gray-500">{formatDuration(job.duration)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pipeline Metrics */}
                  <div className="flex items-center justify-between text-sm text-gray-600 pt-2 border-t">
                    <div className="flex items-center space-x-4">
                      <span className="flex items-center">
                        <Calendar className="h-3 w-3 mr-1" />
                        {new Date(pipeline.startTime).toLocaleString()}
                      </span>
                      <span>Triggered by {pipeline.triggeredBy}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getTrendIcon(pipeline.metrics.buildTrend)}
                      <span>{pipeline.metrics.successRate.toFixed(1)}% success rate</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Deployment Status */}
      {deployments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Zap className="h-5 w-5 mr-2" />
              Deployments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {deployments.map((deployment) => (
                <div key={deployment.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(deployment.status)}
                      <span className="font-medium capitalize">{deployment.environment}</span>
                    </div>
                    <Badge className={getStatusColor(deployment.status)}>
                      {deployment.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>

                  <div className="space-y-1 text-sm text-gray-600">
                    <p>Version: {deployment.version}</p>
                    <p>Commit: {deployment.commit.substring(0, 7)}</p>
                    {deployment.deployedAt && (
                      <p>Deployed: {new Date(deployment.deployedAt).toLocaleString()}</p>
                    )}
                    {deployment.duration && (
                      <p>Duration: {formatDuration(deployment.duration)}</p>
                    )}
                  </div>

                  {/* Health Checks */}
                  {deployment.healthChecks.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <h4 className="text-sm font-medium mb-2">Health Checks</h4>
                      <div className="space-y-1">
                        {deployment.healthChecks.map((check, index) => (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <span>{check.name}</span>
                            <div className="flex items-center space-x-2">
                              {check.status === 'healthy' && <CheckCircle className="h-3 w-3 text-green-500" />}
                              {check.status === 'unhealthy' && <XCircle className="h-3 w-3 text-red-500" />}
                              {check.status === 'unknown' && <Clock className="h-3 w-3 text-yellow-500" />}
                              <span className={`text-xs ${
                                check.status === 'healthy' ? 'text-green-600' :
                                check.status === 'unhealthy' ? 'text-red-600' : 'text-yellow-600'
                              }`}>
                                {check.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Rollback Button */}
                  {deployment.rollbackAvailable && deployment.status === 'failure' && (
                    <div className="mt-3 pt-3 border-t">
                      <Button size="sm" variant="outline" className="w-full">
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Rollback
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PipelineMonitoring;