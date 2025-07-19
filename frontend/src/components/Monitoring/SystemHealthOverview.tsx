'use client';

import React, { useState } from 'react';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { 
  Server, 
  Database, 
  Wifi, 
  Brain, 
  Activity, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Clock,
  Zap,
  HardDrive
} from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

interface SystemHealthProps {
  data: any;
  config?: any;
  isFullscreen?: boolean;
}

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
  responseTime: number;
  uptime: number;
  cpu: number;
  memory: number;
  errors: number;
  lastCheck: string;
}

interface SystemHealth {
  overallHealth: number;
  services: ServiceHealth[];
  infrastructure: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
  alerts: Array<{
    level: 'info' | 'warning' | 'error';
    message: string;
    timestamp: string;
  }>;
}

const SystemHealthOverview: React.FC<SystemHealthProps> = ({
  data,
  config = {},
  isFullscreen = false
}) => {
  const [selectedView, setSelectedView] = useState<'overview' | 'services' | 'infrastructure'>('overview');

  const systemHealth: SystemHealth = data?.systemHealth || {
    overallHealth: 95,
    services: [],
    infrastructure: { cpu: 45, memory: 62, disk: 78, network: 23 },
    alerts: []
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'unhealthy':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <XCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800';
      case 'unhealthy':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getServiceIcon = (serviceName: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      api: <Server className="h-5 w-5" />,
      database: <Database className="h-5 w-5" />,
      redis: <Database className="h-5 w-5" />,
      websocket: <Wifi className="h-5 w-5" />,
      ollama: <Brain className="h-5 w-5" />,
      frontend: <Server className="h-5 w-5" />,
      backend: <Server className="h-5 w-5" />
    };
    return iconMap[serviceName.toLowerCase()] || <Activity className="h-5 w-5" />;
  };

  const healthStatusData = {
    labels: ['Healthy', 'Degraded', 'Unhealthy', 'Offline'],
    datasets: [{
      data: [
        systemHealth.services.filter(s => s.status === 'healthy').length,
        systemHealth.services.filter(s => s.status === 'degraded').length,
        systemHealth.services.filter(s => s.status === 'unhealthy').length,
        systemHealth.services.filter(s => s.status === 'offline').length
      ],
      backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#6b7280'],
      borderWidth: 0
    }]
  };

  const infrastructureData = {
    labels: ['CPU', 'Memory', 'Disk', 'Network'],
    datasets: [{
      label: 'Usage %',
      data: [
        systemHealth.infrastructure.cpu,
        systemHealth.infrastructure.memory,
        systemHealth.infrastructure.disk,
        systemHealth.infrastructure.network
      ],
      backgroundColor: ['#3b82f6', '#8b5cf6', '#f59e0b', '#06b6d4'],
      borderRadius: 4
    }]
  };

  const formatUptime = (uptime: number): string => {
    const days = Math.floor(uptime / (24 * 60 * 60));
    const hours = Math.floor((uptime % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((uptime % (60 * 60)) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatResponseTime = (ms: number): string => {
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
    return `${ms}ms`;
  };

  const renderOverview = () => (
    <div className="space-y-4">
      {/* Overall Health Score */}
      <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Overall Health</h3>
            <p className="text-3xl font-bold text-green-600">{systemHealth.overallHealth}%</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600">
              {systemHealth.services.filter(s => s.status === 'healthy').length} / {systemHealth.services.length} services healthy
            </div>
          </div>
        </div>
      </div>

      {/* Health Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg p-4 border">
          <h4 className="font-medium text-gray-900 mb-3">Service Status Distribution</h4>
          <div className="h-32">
            <Doughnut 
              data={healthStatusData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'bottom',
                    labels: { usePointStyle: true, pointStyle: 'circle' }
                  }
                }
              }}
            />
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border">
          <h4 className="font-medium text-gray-900 mb-3">Infrastructure Usage</h4>
          <div className="h-32">
            <Bar 
              data={infrastructureData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  y: { beginAtZero: true, max: 100 }
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Recent Alerts */}
      {systemHealth.alerts.length > 0 && (
        <div className="bg-white rounded-lg border">
          <div className="p-4 border-b">
            <h4 className="font-medium text-gray-900">Recent Alerts</h4>
          </div>
          <div className="divide-y">
            {systemHealth.alerts.slice(0, isFullscreen ? 10 : 3).map((alert, index) => (
              <div key={index} className="p-4 flex items-center space-x-3">
                <div className={`w-2 h-2 rounded-full ${
                  alert.level === 'error' ? 'bg-red-500' :
                  alert.level === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                }`} />
                <div className="flex-1">
                  <p className="text-sm text-gray-900">{alert.message}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(alert.timestamp).toLocaleString()}
                  </p>
                </div>
                <Badge variant={
                  alert.level === 'error' ? 'destructive' :
                  alert.level === 'warning' ? 'secondary' : 'default'
                }>
                  {alert.level.toUpperCase()}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderServices = () => (
    <div className="space-y-3">
      {systemHealth.services.map((service, index) => (
        <div key={index} className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              {getServiceIcon(service.name)}
              <div>
                <h4 className="font-medium text-gray-900 capitalize">{service.name}</h4>
                <p className="text-sm text-gray-500">
                  Uptime: {formatUptime(service.uptime)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center space-x-2 mb-1">
                {getStatusIcon(service.status)}
                <Badge className={getStatusColor(service.status)}>
                  {service.status.toUpperCase()}
                </Badge>
              </div>
              <p className="text-sm text-gray-500">
                {formatResponseTime(service.responseTime)}
              </p>
            </div>
          </div>

          {isFullscreen && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="flex items-center space-x-2">
                <Zap className="h-3 w-3 text-gray-400" />
                <span className="text-gray-600">CPU:</span>
                <span className="font-medium">{service.cpu}%</span>
              </div>
              <div className="flex items-center space-x-2">
                <HardDrive className="h-3 w-3 text-gray-400" />
                <span className="text-gray-600">Memory:</span>
                <span className="font-medium">{service.memory}%</span>
              </div>
              <div className="flex items-center space-x-2">
                <XCircle className="h-3 w-3 text-gray-400" />
                <span className="text-gray-600">Errors:</span>
                <span className="font-medium">{service.errors}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="h-3 w-3 text-gray-400" />
                <span className="text-gray-600">Last check:</span>
                <span className="font-medium">
                  {new Date(service.lastCheck).toLocaleTimeString()}
                </span>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const renderInfrastructure = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(systemHealth.infrastructure).map(([key, value]) => {
          const getIcon = () => {
            switch (key) {
              case 'cpu': return <Zap className="h-5 w-5" />;
              case 'memory': return <HardDrive className="h-5 w-5" />;
              case 'disk': return <Database className="h-5 w-5" />;
              case 'network': return <Wifi className="h-5 w-5" />;
              default: return <Activity className="h-5 w-5" />;
            }
          };

          const getStatusColor = () => {
            if (value >= 90) return 'text-red-600 bg-red-50';
            if (value >= 70) return 'text-yellow-600 bg-yellow-50';
            return 'text-green-600 bg-green-50';
          };

          return (
            <div key={key} className={`rounded-lg p-4 ${getStatusColor()}`}>
              <div className="flex items-center justify-between">
                {getIcon()}
                <span className="text-2xl font-bold">{value}%</span>
              </div>
              <p className="text-sm font-medium mt-2 capitalize">{key}</p>
              <div className="w-full bg-white bg-opacity-50 rounded-full h-2 mt-2">
                <div 
                  className="h-2 rounded-full bg-current opacity-70"
                  style={{ width: `${value}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {isFullscreen && (
        <div className="bg-white rounded-lg border p-4">
          <h4 className="font-medium text-gray-900 mb-3">Infrastructure Trends</h4>
          <div className="h-64">
            <Bar 
              data={infrastructureData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (context) => `${context.dataset.label}: ${context.parsed.y}%`
                    }
                  }
                },
                scales: {
                  y: { 
                    beginAtZero: true, 
                    max: 100,
                    ticks: {
                      callback: (value) => `${value}%`
                    }
                  }
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Navigation */}
      <div className="flex space-x-1 mb-4">
        <Button
          variant={selectedView === 'overview' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedView('overview')}
        >
          Overview
        </Button>
        <Button
          variant={selectedView === 'services' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedView('services')}
        >
          Services
        </Button>
        <Button
          variant={selectedView === 'infrastructure' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedView('infrastructure')}
        >
          Infrastructure
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {selectedView === 'overview' && renderOverview()}
        {selectedView === 'services' && renderServices()}
        {selectedView === 'infrastructure' && renderInfrastructure()}
      </div>
    </div>
  );
};

export default SystemHealthOverview;