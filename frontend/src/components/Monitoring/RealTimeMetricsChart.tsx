'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface RealTimeMetricsProps {
  data: any;
  config?: any;
  isFullscreen?: boolean;
  onFullscreen?: () => void;
  onExitFullscreen?: () => void;
}

interface MetricData {
  timestamp: number;
  value: number;
}

interface RealTimeMetrics {
  responseTime: MetricData[];
  throughput: MetricData[];
  errorRate: MetricData[];
  cpuUsage: MetricData[];
  memoryUsage: MetricData[];
  activeConnections: MetricData[];
}

const RealTimeMetricsChart: React.FC<RealTimeMetricsProps> = ({
  data,
  config = {},
  isFullscreen = false
}) => {
  const [selectedMetric, setSelectedMetric] = useState<keyof RealTimeMetrics>('responseTime');
  const [timeRange, setTimeRange] = useState<'5m' | '15m' | '1h' | '4h'>('15m');
  const [viewType, setViewType] = useState<'line' | 'bar' | 'area'>('line');
  const chartRef = useRef<ChartJS>(null);

  const metrics: RealTimeMetrics = data?.realTimeMetrics || {
    responseTime: [],
    throughput: [],
    errorRate: [],
    cpuUsage: [],
    memoryUsage: [],
    activeConnections: []
  };

  const metricConfigs = {
    responseTime: {
      label: 'Response Time',
      unit: 'ms',
      color: '#3b82f6',
      icon: Activity,
      threshold: { warning: 1000, critical: 5000 }
    },
    throughput: {
      label: 'Throughput',
      unit: 'req/s',
      color: '#10b981',
      icon: TrendingUp,
      threshold: { warning: 100, critical: 50 }
    },
    errorRate: {
      label: 'Error Rate',
      unit: '%',
      color: '#ef4444',
      icon: TrendingDown,
      threshold: { warning: 5, critical: 10 }
    },
    cpuUsage: {
      label: 'CPU Usage',
      unit: '%',
      color: '#f59e0b',
      icon: Activity,
      threshold: { warning: 70, critical: 90 }
    },
    memoryUsage: {
      label: 'Memory Usage',
      unit: '%',
      color: '#8b5cf6',
      icon: Activity,
      threshold: { warning: 80, critical: 95 }
    },
    activeConnections: {
      label: 'Active Connections',
      unit: '',
      color: '#06b6d4',
      icon: Activity,
      threshold: { warning: 1000, critical: 5000 }
    }
  };

  const getCurrentValue = (metricKey: keyof RealTimeMetrics): number => {
    const metric = metrics[metricKey];
    return metric && metric.length > 0 ? metric[metric.length - 1].value : 0;
  };

  const getTrend = (metricKey: keyof RealTimeMetrics): 'up' | 'down' | 'stable' => {
    const metric = metrics[metricKey];
    if (!metric || metric.length < 2) return 'stable';
    
    const current = metric[metric.length - 1].value;
    const previous = metric[metric.length - 2].value;
    
    if (current > previous * 1.05) return 'up';
    if (current < previous * 0.95) return 'down';
    return 'stable';
  };

  const getStatus = (metricKey: keyof RealTimeMetrics): 'normal' | 'warning' | 'critical' => {
    const value = getCurrentValue(metricKey);
    const config = metricConfigs[metricKey];
    
    if (value >= config.threshold.critical) return 'critical';
    if (value >= config.threshold.warning) return 'warning';
    return 'normal';
  };

  const getChartData = () => {
    const metric = metrics[selectedMetric];
    if (!metric || metric.length === 0) {
      return {
        labels: [],
        datasets: []
      };
    }

    const labels = metric.map(point => 
      new Date(point.timestamp).toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      })
    );

    const config = metricConfigs[selectedMetric];
    
    const dataset = {
      label: config.label,
      data: metric.map(point => point.value),
      borderColor: config.color,
      backgroundColor: viewType === 'area' ? config.color + '20' : config.color,
      fill: viewType === 'area',
      tension: 0.4,
      pointRadius: 2,
      pointHoverRadius: 4,
      borderWidth: 2
    };

    return {
      labels,
      datasets: [dataset]
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index' as const
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: metricConfigs[selectedMetric].color,
        borderWidth: 1,
        callbacks: {
          label: (context: any) => {
            const config = metricConfigs[selectedMetric];
            return `${config.label}: ${context.parsed.y}${config.unit}`;
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        },
        ticks: {
          maxTicksLimit: isFullscreen ? 12 : 6
        }
      },
      y: {
        display: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        },
        beginAtZero: true,
        ticks: {
          callback: (value: any) => {
            const config = metricConfigs[selectedMetric];
            return `${value}${config.unit}`;
          }
        }
      }
    },
    animation: {
      duration: 300
    }
  };

  const renderChart = () => {
    const chartData = getChartData();
    
    switch (viewType) {
      case 'bar':
        return <Bar ref={chartRef} data={chartData} options={chartOptions} />;
      case 'area':
      case 'line':
      default:
        return <Line ref={chartRef} data={chartData} options={chartOptions} />;
    }
  };

  const formatValue = (value: number, unit: string): string => {
    if (unit === '%') return `${value.toFixed(1)}%`;
    if (unit === 'ms') {
      if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
      return `${value.toFixed(0)}ms`;
    }
    if (unit === 'req/s') return `${value.toFixed(1)} req/s`;
    return value.toLocaleString();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between mb-4 gap-2">
        <div className="flex gap-1 flex-wrap">
          {Object.entries(metricConfigs).map(([key, config]) => {
            const status = getStatus(key as keyof RealTimeMetrics);
            const trend = getTrend(key as keyof RealTimeMetrics);
            const value = getCurrentValue(key as keyof RealTimeMetrics);
            
            return (
              <Button
                key={key}
                variant={selectedMetric === key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedMetric(key as keyof RealTimeMetrics)}
                className="relative"
              >
                <config.icon className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">{config.label}</span>
                <span className="sm:hidden">{config.label.slice(0, 3)}</span>
                
                {/* Status indicator */}
                <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
                  status === 'critical' ? 'bg-red-500' :
                  status === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
                }`} />
                
                {/* Trend indicator */}
                <div className="ml-1">
                  {trend === 'up' && <TrendingUp className="h-2 w-2 text-green-600" />}
                  {trend === 'down' && <TrendingDown className="h-2 w-2 text-red-600" />}
                  {trend === 'stable' && <Minus className="h-2 w-2 text-gray-400" />}
                </div>
              </Button>
            );
          })}
        </div>

        <div className="flex gap-1">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="px-2 py-1 text-xs border border-gray-300 rounded"
          >
            <option value="5m">5m</option>
            <option value="15m">15m</option>
            <option value="1h">1h</option>
            <option value="4h">4h</option>
          </select>

          <select
            value={viewType}
            onChange={(e) => setViewType(e.target.value as any)}
            className="px-2 py-1 text-xs border border-gray-300 rounded"
          >
            <option value="line">Line</option>
            <option value="area">Area</option>
            <option value="bar">Bar</option>
          </select>
        </div>
      </div>

      {/* Current Value Display */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {metricConfigs[selectedMetric].label}
            </h3>
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-bold" style={{ color: metricConfigs[selectedMetric].color }}>
                {formatValue(getCurrentValue(selectedMetric), metricConfigs[selectedMetric].unit)}
              </span>
              <Badge variant={
                getStatus(selectedMetric) === 'critical' ? 'destructive' :
                getStatus(selectedMetric) === 'warning' ? 'secondary' : 'default'
              }>
                {getStatus(selectedMetric).toUpperCase()}
              </Badge>
            </div>
          </div>
          <div className="text-right text-sm text-gray-500">
            <div>Last {timeRange}</div>
            <div>{metrics[selectedMetric]?.length || 0} data points</div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        {metrics[selectedMetric]?.length > 0 ? (
          renderChart()
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No data available</p>
              <p className="text-xs">Waiting for metrics...</p>
            </div>
          </div>
        )}
      </div>

      {/* Statistics */}
      {isFullscreen && (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {Object.entries(metricConfigs).map(([key, config]) => {
            const value = getCurrentValue(key as keyof RealTimeMetrics);
            const status = getStatus(key as keyof RealTimeMetrics);
            
            return (
              <div key={key} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <config.icon className="h-4 w-4 text-gray-600" />
                  <div className={`w-2 h-2 rounded-full ${
                    status === 'critical' ? 'bg-red-500' :
                    status === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
                  }`} />
                </div>
                <div className="mt-2">
                  <p className="text-xs text-gray-600">{config.label}</p>
                  <p className="font-semibold">{formatValue(value, config.unit)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RealTimeMetricsChart;