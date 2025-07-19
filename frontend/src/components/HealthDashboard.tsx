'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Heart, 
  AlertTriangle, 
  XCircle, 
  Circle, 
  RefreshCw, 
  Activity,
  Database,
  Server,
  Brain,
  Wifi,
  BarChart3,
  Clock
} from 'lucide-react';

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
  lastCheck: string;
  responseTime: number;
  message?: string;
  details?: any;
  criticalService: boolean;
}

interface SystemHealth {
  overallStatus: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
  totalServices: number;
  healthyServices: number;
  degradedServices: number;
  unhealthyServices: number;
  offlineServices: number;
  lastCheck: string;
  healthPercentage: number;
  criticalServices: ServiceHealth[];
  recentIssues: Array<{
    service: string;
    status: string;
    message: string;
    lastCheck: string;
  }>;
}

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'healthy':
      return <Heart className="h-4 w-4 text-green-500" />;
    case 'degraded':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case 'unhealthy':
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Circle className="h-4 w-4 text-gray-500" />;
  }
};

const StatusBadge = ({ status }: { status: string }) => {
  const colors = {
    healthy: 'bg-green-100 text-green-800',
    degraded: 'bg-yellow-100 text-yellow-800',
    unhealthy: 'bg-red-100 text-red-800',
    offline: 'bg-gray-100 text-gray-800'
  };

  return (
    <Badge className={colors[status as keyof typeof colors] || colors.offline}>
      {status.toUpperCase()}
    </Badge>
  );
};

const ServiceIcon = ({ serviceName }: { serviceName: string }) => {
  const iconMap: Record<string, React.ReactNode> = {
    database: <Database className="h-5 w-5" />,
    redis: <Database className="h-5 w-5" />,
    ollama: <Brain className="h-5 w-5" />,
    frontend: <Server className="h-5 w-5" />,
    backend: <Server className="h-5 w-5" />,
    websocket: <Wifi className="h-5 w-5" />,
    prometheus: <BarChart3 className="h-5 w-5" />,
    grafana: <BarChart3 className="h-5 w-5" />
  };

  return iconMap[serviceName] || <Activity className="h-5 w-5" />;
};

export default function HealthDashboard() {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [services, setServices] = useState<Record<string, ServiceHealth>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchHealthData = async () => {
    try {
      setError(null);
      
      // Fetch system health summary
      const summaryResponse = await fetch('/api/health/orchestrator/summary');
      if (!summaryResponse.ok) {
        throw new Error(`HTTP ${summaryResponse.status}: ${summaryResponse.statusText}`);
      }
      const summaryData = await summaryResponse.json();
      setSystemHealth(summaryData);

      // Fetch detailed service health
      const systemResponse = await fetch('/api/health/orchestrator/system');
      if (systemResponse.ok) {
        const systemData = await systemResponse.json();
        setServices(systemData.services || {});
      }
    } catch (err) {
      console.error('Failed to fetch health data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch health data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchHealthData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const formatResponseTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatLastCheck = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2 text-lg">Loading health data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="m-4">
        <CardHeader>
          <CardTitle className="flex items-center text-red-600">
            <XCircle className="h-5 w-5 mr-2" />
            Health Dashboard Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={fetchHealthData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!systemHealth) {
    return (
      <Card className="m-4">
        <CardContent className="p-8 text-center">
          <p>No health data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">System Health Dashboard</h1>
          <p className="text-gray-600">Real-time monitoring of all services</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? 'Disable' : 'Enable'} Auto-refresh
          </Button>
          <Button onClick={fetchHealthData} size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <StatusIcon status={systemHealth.overallStatus} />
            <span className="ml-2">Overall System Status</span>
            <StatusBadge status={systemHealth.overallStatus} />
          </CardTitle>
          <CardDescription>
            Last checked: {formatLastCheck(systemHealth.lastCheck)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{systemHealth.healthyServices}</div>
              <div className="text-sm text-gray-600">Healthy</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{systemHealth.degradedServices}</div>
              <div className="text-sm text-gray-600">Degraded</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{systemHealth.unhealthyServices}</div>
              <div className="text-sm text-gray-600">Unhealthy</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">{systemHealth.offlineServices}</div>
              <div className="text-sm text-gray-600">Offline</div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>System Health</span>
              <span>{systemHealth.healthPercentage}%</span>
            </div>
            <Progress value={systemHealth.healthPercentage} className="h-2" />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="services" className="space-y-4">
        <TabsList>
          <TabsTrigger value="services">All Services</TabsTrigger>
          <TabsTrigger value="critical">Critical Services</TabsTrigger>
          <TabsTrigger value="issues">Recent Issues</TabsTrigger>
        </TabsList>

        {/* All Services Tab */}
        <TabsContent value="services">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(services).map(([name, service]) => (
              <Card key={name}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <div className="flex items-center">
                      <ServiceIcon serviceName={name} />
                      <span className="ml-2 capitalize">{name}</span>
                    </div>
                    <StatusBadge status={service.status} />
                  </CardTitle>
                  {service.criticalService && (
                    <Badge variant="outline" className="w-fit">Critical</Badge>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2 text-sm">
                    {service.message && (
                      <p className="text-gray-600">{service.message}</p>
                    )}
                    <div className="flex justify-between">
                      <span>Response Time:</span>
                      <span className={service.responseTime > 5000 ? 'text-red-600' : 'text-green-600'}>
                        {formatResponseTime(service.responseTime)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Last Check:</span>
                      <span>{formatLastCheck(service.lastCheck)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Critical Services Tab */}
        <TabsContent value="critical">
          <div className="grid gap-4 md:grid-cols-2">
            {systemHealth.criticalServices.map((service) => (
              <Card key={service.name} className="border-l-4 border-l-blue-500">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center">
                      <ServiceIcon serviceName={service.name} />
                      <span className="ml-2 capitalize">{service.name}</span>
                    </div>
                    <StatusBadge status={service.status} />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {service.message && (
                      <p className="text-gray-600">{service.message}</p>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-gray-500">Response Time:</span>
                        <div className={service.responseTime > 5000 ? 'text-red-600 font-medium' : 'text-green-600'}>
                          {formatResponseTime(service.responseTime)}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500">Last Check:</span>
                        <div>{formatLastCheck(service.lastCheck)}</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Recent Issues Tab */}
        <TabsContent value="issues">
          {systemHealth.recentIssues.length > 0 ? (
            <div className="space-y-4">
              {systemHealth.recentIssues.map((issue, index) => (
                <Card key={index}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <StatusIcon status={issue.status} />
                        <div className="ml-3">
                          <div className="font-medium capitalize">{issue.service}</div>
                          <div className="text-sm text-gray-600">{issue.message}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <StatusBadge status={issue.status} />
                        <div className="text-xs text-gray-500 mt-1">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {formatLastCheck(issue.lastCheck)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-8 text-center">
                <Heart className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="text-lg font-medium">No Recent Issues</p>
                <p className="text-gray-600">All services are running smoothly!</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}