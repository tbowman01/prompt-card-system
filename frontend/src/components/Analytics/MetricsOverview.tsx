'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { DashboardMetrics } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  trend?: 'up' | 'down' | 'stable';
  severity?: 'success' | 'warning' | 'error' | 'info';
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtext, trend, severity = 'info' }) => {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return '↗';
      case 'down':
        return '↘';
      case 'stable':
        return '→';
      default:
        return '';
    }
  };

  const getSeverityColor = () => {
    switch (severity) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className={`p-4 rounded-lg border-2 ${getSeverityColor()}`}>
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-sm font-medium text-gray-600">{title}</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtext && (
            <p className="text-sm text-gray-500 mt-1">{subtext}</p>
          )}
        </div>
        {trend && (
          <span className="text-lg text-gray-400">{getTrendIcon()}</span>
        )}
      </div>
    </div>
  );
};

export const MetricsOverview: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getDashboardMetrics();
        setMetrics(data as DashboardMetrics);
      } catch (err) {
        console.error('Error fetching metrics:', err);
        setError('Failed to load metrics');
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    
    // Refresh metrics every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-gray-600">No metrics available</p>
      </div>
    );
  }

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const formatPercentage = (num: number): string => {
    return `${(num * 100).toFixed(1)}%`;
  };

  const formatTime = (ms: number): string => {
    if (ms >= 1000) {
      return `${(ms / 1000).toFixed(1)}s`;
    }
    return `${ms.toFixed(0)}ms`;
  };

  return (
    <div className="space-y-6">
      {/* Real-time Metrics */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Real-time Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <MetricCard
            title="Active Tests"
            value={metrics.realtime.activeTests}
            severity={metrics.realtime.activeTests > 0 ? 'info' : 'success'}
          />
          <MetricCard
            title="Tests/Second"
            value={metrics.realtime.testsPerSecond.toFixed(1)}
            severity={metrics.realtime.testsPerSecond > 0 ? 'success' : 'info'}
          />
          <MetricCard
            title="Success Rate"
            value={formatPercentage(metrics.realtime.successRate)}
            severity={
              metrics.realtime.successRate >= 0.9 ? 'success' : 
              metrics.realtime.successRate >= 0.7 ? 'warning' : 'error'
            }
          />
          <MetricCard
            title="Avg Response Time"
            value={formatTime(metrics.realtime.averageResponseTime)}
            severity={
              metrics.realtime.averageResponseTime <= 1000 ? 'success' :
              metrics.realtime.averageResponseTime <= 5000 ? 'warning' : 'error'
            }
          />
          <MetricCard
            title="Error Rate"
            value={formatPercentage(metrics.realtime.errorRate)}
            severity={
              metrics.realtime.errorRate <= 0.1 ? 'success' :
              metrics.realtime.errorRate <= 0.3 ? 'warning' : 'error'
            }
          />
        </div>
      </div>

      {/* Historical Metrics */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Historical Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Tests"
            value={formatNumber(metrics.historical.totalTests)}
            subtext="All time"
          />
          <MetricCard
            title="Total Executions"
            value={formatNumber(metrics.historical.totalExecutions)}
            subtext="Unique test runs"
          />
          <MetricCard
            title="Overall Success Rate"
            value={formatPercentage(metrics.historical.overallSuccessRate)}
            subtext="Historical average"
            severity={
              metrics.historical.overallSuccessRate >= 0.9 ? 'success' : 
              metrics.historical.overallSuccessRate >= 0.7 ? 'warning' : 'error'
            }
          />
          <MetricCard
            title="Avg Execution Time"
            value={formatTime(metrics.historical.averageExecutionTime)}
            subtext="Per test"
          />
        </div>
      </div>

      {/* Most Used Models */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Most Used Models</h2>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {metrics.historical.mostUsedModels.slice(0, 6).map((model, index) => (
              <div key={model.model} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Badge variant="secondary">#{index + 1}</Badge>
                  <span className="font-medium text-gray-900">{model.model}</span>
                </div>
                <span className="text-sm text-gray-600">{formatNumber(model.count)} tests</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Insights */}
      {metrics.insights.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">System Insights</h2>
          <div className="space-y-3">
            {metrics.insights.map((insight) => (
              <div
                key={insight.id}
                className={`p-4 rounded-lg border-l-4 ${
                  insight.severity === 'critical' 
                    ? 'bg-red-50 border-red-500' 
                    : insight.severity === 'high' 
                    ? 'bg-orange-50 border-orange-500'
                    : insight.severity === 'medium'
                    ? 'bg-yellow-50 border-yellow-500'
                    : 'bg-blue-50 border-blue-500'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-medium text-gray-900">{insight.title}</h3>
                      <Badge 
                        variant={insight.severity === 'critical' ? 'destructive' : 'secondary'}
                      >
                        {insight.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{insight.description}</p>
                    {insight.recommendations && insight.recommendations.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-gray-700">Recommendations:</p>
                        <ul className="text-xs text-gray-600 mt-1 space-y-1">
                          {insight.recommendations.map((rec, index) => (
                            <li key={index} className="flex items-center">
                              <span className="w-1 h-1 bg-gray-400 rounded-full mr-2"></span>
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(insight.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MetricsOverview;