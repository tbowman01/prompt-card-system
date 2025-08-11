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
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Activity,
  Zap,
  Server,
  Database,
  Cloud,
  Shield,
  Globe,
  RefreshCw,
  PlayCircle,
  StopCircle,
  ArrowLeft,
  GitCommit,
  Calendar,
  Timer,
  Users,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Download,
  Upload,
  Monitor
} from 'lucide-react';

export interface DeploymentEnvironment {
  id: string;
  name: 'staging' | 'production' | 'development';
  displayName: string;
  url: string;
  status: 'healthy' | 'degraded' | 'down' | 'deploying';
  currentVersion: string;
  previousVersion?: string;
  lastDeployment: string;
  deployedBy: string;
  uptime: number;
  healthChecks: HealthCheck[];
  infrastructure: InfrastructureStatus;
  rollbackAvailable: boolean;
}

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastCheck: string;
  responseTime?: number;
  details?: string;
  endpoint?: string;
}

export interface InfrastructureStatus {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  containers: ContainerStatus[];
  services: ServiceStatus[];
}

export interface ContainerStatus {
  name: string;
  status: 'running' | 'stopped' | 'error';
  image: string;
  uptime: number;
  cpu: number;
  memory: number;
  restarts: number;
}

export interface ServiceStatus {
  name: string;
  type: 'database' | 'cache' | 'queue' | 'storage' | 'external';
  status: 'healthy' | 'degraded' | 'down';
  responseTime?: number;
  connections?: number;
  lastCheck: string;
}

export interface DeploymentHistory {
  id: string;
  version: string;
  environment: string;
  status: 'success' | 'failure' | 'in_progress' | 'rolled_back';
  startTime: string;
  endTime?: string;
  duration?: number;
  deployedBy: string;
  commitHash: string;
  commitMessage: string;
  changes: string[];
  rollbackReason?: string;
}

const DeploymentMonitoring: React.FC = () => {
  const [environments, setEnvironments] = useState<DeploymentEnvironment[]>([]);
  const [deploymentHistory, setDeploymentHistory] = useState<DeploymentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEnvironment, setSelectedEnvironment] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { socket, isConnected } = useWebSocket();

  const fetchDeploymentData = useCallback(async () => {
    try {
      setError(null);
      const [envResponse, historyResponse] = await Promise.all([
        api.get('/deployments/environments'),
        api.get('/deployments/history?limit=20')
      ]);

      setEnvironments(envResponse.data || generateMockEnvironmentData());
      setDeploymentHistory(historyResponse.data || generateMockHistoryData());
    } catch (err) {
      console.error('Error fetching deployment data:', err);
      setError('Failed to load deployment data');
      // Use mock data as fallback
      setEnvironments(generateMockEnvironmentData());
      setDeploymentHistory(generateMockHistoryData());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeploymentData();
  }, [fetchDeploymentData]);

  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(fetchDeploymentData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [autoRefresh, fetchDeploymentData]);

  useEffect(() => {
    if (socket && isConnected) {
      // Real-time deployment updates
      socket.on('deployment-status-update', (update: Partial<DeploymentEnvironment>) => {
        setEnvironments(prev => prev.map(env => 
          env.id === update.id ? { ...env, ...update } : env
        ));
      });

      socket.on('health-check-update', (update: { environmentId: string; healthChecks: HealthCheck[] }) => {
        setEnvironments(prev => prev.map(env => 
          env.id === update.environmentId 
            ? { ...env, healthChecks: update.healthChecks }
            : env
        ));
      });

      return () => {
        socket.off('deployment-status-update');
        socket.off('health-check-update');
      };
    }
  }, [socket, isConnected]);

  const generateMockEnvironmentData = (): DeploymentEnvironment[] => [
    {
      id: 'staging',
      name: 'staging',
      displayName: 'Staging',
      url: 'https://staging.prompt-cards.dev',
      status: 'healthy',
      currentVersion: 'v1.2.3-rc.1',
      previousVersion: 'v1.2.2',
      lastDeployment: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      deployedBy: 'alice',
      uptime: 99.8,
      rollbackAvailable: true,
      healthChecks: [
        { name: 'API Health', status: 'healthy', lastCheck: new Date().toISOString(), responseTime: 120 },
        { name: 'Database', status: 'healthy', lastCheck: new Date().toISOString(), responseTime: 45 },
        { name: 'Redis Cache', status: 'healthy', lastCheck: new Date().toISOString(), responseTime: 12 }
      ],
      infrastructure: {
        cpu: 35,
        memory: 68,
        disk: 42,
        network: 15,
        containers: [
          { name: 'frontend', status: 'running', image: 'prompt-cards/frontend:v1.2.3-rc.1', uptime: 7200, cpu: 15, memory: 512, restarts: 0 },
          { name: 'backend', status: 'running', image: 'prompt-cards/backend:v1.2.3-rc.1', uptime: 7200, cpu: 20, memory: 1024, restarts: 0 }
        ],
        services: [
          { name: 'PostgreSQL', type: 'database', status: 'healthy', responseTime: 45, connections: 12, lastCheck: new Date().toISOString() },
          { name: 'Redis', type: 'cache', status: 'healthy', responseTime: 12, connections: 8, lastCheck: new Date().toISOString() }
        ]
      }
    },
    {
      id: 'production',
      name: 'production',
      displayName: 'Production',
      url: 'https://prompt-cards.app',
      status: 'healthy',
      currentVersion: 'v1.2.2',
      previousVersion: 'v1.2.1',
      lastDeployment: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      deployedBy: 'bob',
      uptime: 99.95,
      rollbackAvailable: true,
      healthChecks: [
        { name: 'API Health', status: 'healthy', lastCheck: new Date().toISOString(), responseTime: 85 },
        { name: 'Database', status: 'healthy', lastCheck: new Date().toISOString(), responseTime: 32 },
        { name: 'Redis Cache', status: 'degraded', lastCheck: new Date().toISOString(), responseTime: 180, details: 'High latency detected' },
        { name: 'Load Balancer', status: 'healthy', lastCheck: new Date().toISOString(), responseTime: 25 }
      ],
      infrastructure: {
        cpu: 52,
        memory: 74,
        disk: 38,
        network: 28,
        containers: [
          { name: 'frontend-1', status: 'running', image: 'prompt-cards/frontend:v1.2.2', uptime: 21600, cpu: 18, memory: 512, restarts: 0 },
          { name: 'frontend-2', status: 'running', image: 'prompt-cards/frontend:v1.2.2', uptime: 21600, cpu: 16, memory: 512, restarts: 0 },
          { name: 'backend-1', status: 'running', image: 'prompt-cards/backend:v1.2.2', uptime: 21600, cpu: 25, memory: 1024, restarts: 1 },
          { name: 'backend-2', status: 'running', image: 'prompt-cards/backend:v1.2.2', uptime: 18000, cpu: 22, memory: 1024, restarts: 0 }
        ],
        services: [
          { name: 'PostgreSQL Primary', type: 'database', status: 'healthy', responseTime: 32, connections: 45, lastCheck: new Date().toISOString() },
          { name: 'PostgreSQL Replica', type: 'database', status: 'healthy', responseTime: 28, connections: 12, lastCheck: new Date().toISOString() },
          { name: 'Redis Cluster', type: 'cache', status: 'degraded', responseTime: 180, connections: 32, lastCheck: new Date().toISOString() }
        ]
      }
    }
  ];

  const generateMockHistoryData = (): DeploymentHistory[] => [
    {
      id: 'deploy-1',
      version: 'v1.2.3-rc.1',
      environment: 'staging',
      status: 'success',
      startTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() - 2 * 60 * 60 * 1000 + 5 * 60 * 1000).toISOString(),
      duration: 5 * 60 * 1000,
      deployedBy: 'alice',
      commitHash: 'a1b2c3d',
      commitMessage: 'feat: add CI/CD monitoring dashboard',
      changes: ['Added pipeline monitoring components', 'Implemented real-time status updates', 'Enhanced error reporting']
    },
    {
      id: 'deploy-2',
      version: 'v1.2.2',
      environment: 'production',
      status: 'success',
      startTime: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() - 6 * 60 * 60 * 1000 + 8 * 60 * 1000).toISOString(),
      duration: 8 * 60 * 1000,
      deployedBy: 'bob',
      commitHash: 'x9y8z7w',
      commitMessage: 'fix: resolve memory leak in analytics engine',
      changes: ['Fixed memory leak in analytics', 'Updated dependencies', 'Improved performance']
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'down':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'deploying':
        return <Activity className="h-4 w-4 text-blue-500 animate-pulse" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800';
      case 'down':
        return 'bg-red-100 text-red-800';
      case 'deploying':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const formatUptime = (ms: number) => {
    const hours = Math.floor(ms / 3600);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else {
      return `${hours}h`;
    }
  };

  const formatDuration = (ms: number) => {
    if (!ms) return 'N/A';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-lg">Loading deployment status...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center text-red-800">
            <AlertTriangle className="h-5 w-5 mr-2" />
            Deployment Monitoring Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-700 mb-4">{error}</p>
          <Button onClick={fetchDeploymentData} variant="outline" className="w-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const selectedEnv = selectedEnvironment ? environments.find(e => e.id === selectedEnvironment) : null;

  if (selectedEnv) {
    return (
      <div className="space-y-6">
        {/* Environment Detail Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" onClick={() => setSelectedEnvironment(null)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h2 className="text-xl font-semibold flex items-center">
                {getStatusIcon(selectedEnv.status)}
                <span className="ml-2">{selectedEnv.displayName} Environment</span>
              </h2>
              <p className="text-gray-600">{selectedEnv.url}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Badge className={getStatusColor(selectedEnv.status)}>
              {selectedEnv.status.toUpperCase()}
            </Badge>
            <span className="text-sm text-gray-500">
              Uptime: {selectedEnv.uptime}%
            </span>
          </div>
        </div>

        {/* Environment Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Version</CardTitle>
              <GitCommit className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{selectedEnv.currentVersion}</div>
              <p className="text-xs text-muted-foreground">
                Deployed by {selectedEnv.deployedBy}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Last Deployment</CardTitle>
              <Calendar className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.floor((Date.now() - new Date(selectedEnv.lastDeployment).getTime()) / (1000 * 60 * 60))}h
              </div>
              <p className="text-xs text-muted-foreground">ago</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Health Checks</CardTitle>
              <Monitor className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {selectedEnv.healthChecks.filter(h => h.status === 'healthy').length} / {selectedEnv.healthChecks.length}
              </div>
              <p className="text-xs text-muted-foreground">passing</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Containers</CardTitle>
              <Server className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {selectedEnv.infrastructure.containers.filter(c => c.status === 'running').length} / {selectedEnv.infrastructure.containers.length}
              </div>
              <p className="text-xs text-muted-foreground">running</p>
            </CardContent>
          </Card>
        </div>

        {/* Infrastructure Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="h-5 w-5 mr-2" />
                Infrastructure Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>CPU Usage</span>
                  <span>{selectedEnv.infrastructure.cpu}%</span>
                </div>
                <Progress value={selectedEnv.infrastructure.cpu} />
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Memory Usage</span>
                  <span>{selectedEnv.infrastructure.memory}%</span>
                </div>
                <Progress value={selectedEnv.infrastructure.memory} />
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Disk Usage</span>
                  <span>{selectedEnv.infrastructure.disk}%</span>
                </div>
                <Progress value={selectedEnv.infrastructure.disk} />
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Network I/O</span>
                  <span>{selectedEnv.infrastructure.network}%</span>
                </div>
                <Progress value={selectedEnv.infrastructure.network} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="h-5 w-5 mr-2" />
                Health Checks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {selectedEnv.healthChecks.map((check, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(check.status)}
                      <span className="text-sm font-medium">{check.name}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      {check.responseTime && <span>{check.responseTime}ms</span>}
                      <span>{new Date(check.lastCheck).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Containers and Services */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Server className="h-5 w-5 mr-2" />
                Containers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {selectedEnv.infrastructure.containers.map((container, index) => (
                  <div key={index} className="border rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {container.status === 'running' && <CheckCircle className="h-4 w-4 text-green-500" />}
                        {container.status === 'stopped' && <StopCircle className="h-4 w-4 text-red-500" />}
                        {container.status === 'error' && <XCircle className="h-4 w-4 text-red-500" />}
                        <span className="font-medium">{container.name}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {formatUptime(container.uptime)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mb-2">{container.image}</p>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>CPU: {container.cpu}%</div>
                      <div>Memory: {container.memory}MB</div>
                      <div>Restarts: {container.restarts}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Database className="h-5 w-5 mr-2" />
                Services
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {selectedEnv.infrastructure.services.map((service, index) => (
                  <div key={index} className="border rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(service.status)}
                        <span className="font-medium">{service.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {service.type}
                        </Badge>
                      </div>
                      {service.responseTime && (
                        <span className="text-xs text-gray-500">
                          {service.responseTime}ms
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      {service.connections && <span>Connections: {service.connections}</span>}
                      <span>Last check: {new Date(service.lastCheck).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Deployment Monitoring</h2>
        
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600">
              {isConnected ? 'Live' : 'Offline'}
            </span>
          </div>

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
            onClick={fetchDeploymentData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Environment Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {environments.map((env) => (
          <Card 
            key={env.id} 
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => setSelectedEnvironment(env.id)}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  {getStatusIcon(env.status)}
                  <span className="ml-2">{env.displayName}</span>
                </CardTitle>
                <Badge className={getStatusColor(env.status)}>
                  {env.status}
                </Badge>
              </div>
              <CardDescription>{env.url}</CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Version</p>
                  <p className="font-medium">{env.currentVersion}</p>
                </div>
                <div>
                  <p className="text-gray-600">Uptime</p>
                  <p className="font-medium">{env.uptime}%</p>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Health Checks</span>
                  <span>
                    {env.healthChecks.filter(h => h.status === 'healthy').length} / {env.healthChecks.length}
                  </span>
                </div>
                <Progress 
                  value={(env.healthChecks.filter(h => h.status === 'healthy').length / env.healthChecks.length) * 100} 
                />
              </div>

              <div className="flex justify-between text-sm text-gray-600 pt-2 border-t">
                <span>Last deployed: {Math.floor((Date.now() - new Date(env.lastDeployment).getTime()) / (1000 * 60 * 60))}h ago</span>
                <span>by {env.deployedBy}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Deployment History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="h-5 w-5 mr-2" />
            Recent Deployments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {deploymentHistory.slice(0, 10).map((deployment) => (
              <div key={deployment.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-4">
                    {deployment.status === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                    {deployment.status === 'failure' && <XCircle className="h-4 w-4 text-red-500" />}
                    {deployment.status === 'in_progress' && <Activity className="h-4 w-4 text-blue-500 animate-pulse" />}
                    {deployment.status === 'rolled_back' && <ArrowLeft className="h-4 w-4 text-yellow-500" />}
                    
                    <div>
                      <h4 className="font-medium">
                        {deployment.version} → {deployment.environment}
                      </h4>
                      <p className="text-sm text-gray-600">{deployment.commitMessage}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    {deployment.duration && (
                      <span className="flex items-center">
                        <Timer className="h-3 w-3 mr-1" />
                        {formatDuration(deployment.duration)}
                      </span>
                    )}
                    <span className="flex items-center">
                      <Users className="h-3 w-3 mr-1" />
                      {deployment.deployedBy}
                    </span>
                    <span>{new Date(deployment.startTime).toLocaleString()}</span>
                  </div>
                </div>

                {deployment.changes.length > 0 && (
                  <div className="mt-2">
                    <details className="text-sm">
                      <summary className="cursor-pointer text-gray-600 hover:text-gray-900">
                        View changes ({deployment.changes.length})
                      </summary>
                      <ul className="mt-2 ml-4 space-y-1 text-gray-600">
                        {deployment.changes.map((change, index) => (
                          <li key={index} className="list-disc">{change}</li>
                        ))}
                      </ul>
                    </details>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DeploymentMonitoring;