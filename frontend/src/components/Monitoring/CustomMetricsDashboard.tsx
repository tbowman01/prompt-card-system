'use client';

import React, { useState, useEffect } from 'react';
import { Line, Bar, Doughnut, Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { 
  BarChart3, 
  TrendingUp, 
  Target, 
  Plus, 
  Edit, 
  Trash2, 
  Settings,
  Eye,
  EyeOff,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface CustomMetric {
  id: string;
  name: string;
  description: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  query: string;
  unit: string;
  target?: number;
  threshold?: {
    warning: number;
    critical: number;
  };
  tags: string[];
  chartType: 'line' | 'bar' | 'doughnut' | 'radar';
  color: string;
  enabled: boolean;
  position: { x: number; y: number; width: number; height: number };
  refreshInterval: number;
  lastValue?: number;
  trend?: 'up' | 'down' | 'stable';
  status?: 'normal' | 'warning' | 'critical';
}

interface KPI {
  id: string;
  name: string;
  value: number;
  previousValue: number;
  target: number;
  unit: string;
  category: string;
  trend: 'up' | 'down' | 'stable';
  status: 'normal' | 'warning' | 'critical';
  description: string;
}

interface CustomMetricsDashboardProps {
  data: any;
  config?: any;
  isFullscreen?: boolean;
}

const CustomMetricsDashboard: React.FC<CustomMetricsDashboardProps> = ({
  data,
  config = {},
  isFullscreen = false
}) => {
  const [customMetrics, setCustomMetrics] = useState<CustomMetric[]>([]);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<CustomMetric | null>(null);
  const [editingMetric, setEditingMetric] = useState<CustomMetric | null>(null);
  const [showMetricModal, setShowMetricModal] = useState(false);
  const [showKpiModal, setShowKpiModal] = useState(false);
  const [viewMode, setViewMode] = useState<'metrics' | 'kpis' | 'combined'>('combined');
  const [metricData, setMetricData] = useState<Record<string, any>>({});

  useEffect(() => {
    if (data?.customMetrics) {
      setCustomMetrics(data.customMetrics.metrics || []);
      setKpis(data.customMetrics.kpis || []);
      setMetricData(data.customMetrics.data || {});
    }
  }, [data]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'normal':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal':
        return 'bg-green-100 text-green-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'critical':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-3 w-3 text-green-500" />;
      case 'down':
        return <TrendingUp className="h-3 w-3 text-red-500 transform rotate-180" />;
      default:
        return <Target className="h-3 w-3 text-gray-400" />;
    }
  };

  const formatValue = (value: number, unit: string): string => {
    if (unit === '%') return `${value.toFixed(1)}%`;
    if (unit === 'ms') {
      if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
      return `${value.toFixed(0)}ms`;
    }
    if (unit === 'bytes') {
      if (value >= 1024 * 1024 * 1024) return `${(value / (1024 * 1024 * 1024)).toFixed(1)}GB`;
      if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)}MB`;
      if (value >= 1024) return `${(value / 1024).toFixed(1)}KB`;
      return `${value}B`;
    }
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toLocaleString();
  };

  const renderChart = (metric: CustomMetric) => {
    const data = metricData[metric.id];
    if (!data) {
      return (
        <div className="flex items-center justify-center h-full text-gray-500">
          <div className="text-center">
            <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No data available</p>
          </div>
        </div>
      );
    }

    const chartData = {
      labels: data.labels || [],
      datasets: [{
        label: metric.name,
        data: data.values || [],
        borderColor: metric.color,
        backgroundColor: metric.chartType === 'doughnut' ? 
          data.values?.map((_, i) => `${metric.color}${Math.floor(255 * (1 - i * 0.1)).toString(16)}`) :
          `${metric.color}20`,
        fill: metric.chartType === 'line',
        tension: 0.4,
        pointRadius: 2,
        pointHoverRadius: 4,
        borderWidth: 2
      }]
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (context: any) => `${metric.name}: ${formatValue(context.parsed.y, metric.unit)}`
          }
        }
      },
      scales: metric.chartType === 'doughnut' || metric.chartType === 'radar' ? {} : {
        x: {
          display: true,
          grid: { color: 'rgba(0, 0, 0, 0.1)' }
        },
        y: {
          display: true,
          grid: { color: 'rgba(0, 0, 0, 0.1)' },
          beginAtZero: true,
          ticks: {
            callback: (value: any) => formatValue(value, metric.unit)
          }
        }
      }
    };

    switch (metric.chartType) {
      case 'bar':
        return <Bar data={chartData} options={options} />;
      case 'doughnut':
        return <Doughnut data={chartData} options={options} />;
      case 'radar':
        return <Radar data={chartData} options={options} />;
      case 'line':
      default:
        return <Line data={chartData} options={options} />;
    }
  };

  const handleMetricToggle = (metricId: string) => {
    setCustomMetrics(prev => prev.map(metric => 
      metric.id === metricId 
        ? { ...metric, enabled: !metric.enabled }
        : metric
    ));
  };

  const handleRefreshMetric = async (metricId: string) => {
    try {
      // API call to refresh metric data
      const response = await fetch(`/api/metrics/custom/${metricId}/refresh`, {
        method: 'POST'
      });
      const newData = await response.json();
      
      setMetricData(prev => ({
        ...prev,
        [metricId]: newData
      }));
    } catch (error) {
      console.error('Error refreshing metric:', error);
    }
  };

  const renderKpiCard = (kpi: KPI) => {
    const changePercent = kpi.previousValue > 0 
      ? ((kpi.value - kpi.previousValue) / kpi.previousValue) * 100 
      : 0;

    const targetPercent = kpi.target > 0 
      ? (kpi.value / kpi.target) * 100 
      : 0;

    return (
      <div key={kpi.id} className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h4 className="font-medium text-gray-900">{kpi.name}</h4>
            <p className="text-xs text-gray-500">{kpi.category}</p>
          </div>
          <div className="flex items-center space-x-1">
            {getStatusIcon(kpi.status)}
            {getTrendIcon(kpi.trend)}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900">
              {formatValue(kpi.value, kpi.unit)}
            </span>
            <Badge className={getStatusColor(kpi.status)}>
              {kpi.status.toUpperCase()}
            </Badge>
          </div>

          <div className="text-sm text-gray-600">
            <div className="flex items-center justify-between">
              <span>vs Previous:</span>
              <span className={changePercent >= 0 ? 'text-green-600' : 'text-red-600'}>
                {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>vs Target:</span>
              <span className={targetPercent >= 100 ? 'text-green-600' : 'text-yellow-600'}>
                {targetPercent.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Progress bar to target */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${
                targetPercent >= 100 ? 'bg-green-500' : 
                targetPercent >= 80 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(100, targetPercent)}%` }}
            />
          </div>

          <p className="text-xs text-gray-500">{kpi.description}</p>
        </div>
      </div>
    );
  };

  const renderMetricCard = (metric: CustomMetric) => {
    return (
      <div key={metric.id} className="bg-white rounded-lg border border-gray-200">
        <div className="p-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h4 className="font-medium text-gray-900">{metric.name}</h4>
              <Badge className={getStatusColor(metric.status || 'normal')}>
                {(metric.status || 'normal').toUpperCase()}
              </Badge>
            </div>
            
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRefreshMetric(metric.id)}
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleMetricToggle(metric.id)}
              >
                {metric.enabled ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingMetric(metric);
                  setShowMetricModal(true);
                }}
              >
                <Edit className="h-3 w-3" />
              </Button>
            </div>
          </div>
          
          {metric.lastValue !== undefined && (
            <div className="flex items-center space-x-2 mt-1">
              <span className="text-lg font-bold" style={{ color: metric.color }}>
                {formatValue(metric.lastValue, metric.unit)}
              </span>
              {getTrendIcon(metric.trend || 'stable')}
            </div>
          )}
        </div>

        <div className="p-3">
          <div className="h-32">
            {metric.enabled ? renderChart(metric) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <EyeOff className="h-8 w-8" />
              </div>
            )}
          </div>
        </div>

        <div className="px-3 pb-3">
          <div className="flex flex-wrap gap-1">
            {metric.tags.map(tag => (
              <span key={tag} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const enabledMetrics = customMetrics.filter(m => m.enabled);
  const normalKpis = kpis.filter(k => k.status === 'normal').length;
  const warningKpis = kpis.filter(k => k.status === 'warning').length;
  const criticalKpis = kpis.filter(k => k.status === 'critical').length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-gray-600" />
            <span className="font-semibold">Custom Metrics & KPIs</span>
          </div>
          <div className="flex space-x-2">
            <Badge variant="outline">Metrics: {enabledMetrics.length}</Badge>
            <Badge variant="outline">KPIs: {kpis.length}</Badge>
            <Badge variant="default">Normal: {normalKpis}</Badge>
            <Badge variant="secondary">Warning: {warningKpis}</Badge>
            <Badge variant="destructive">Critical: {criticalKpis}</Badge>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex space-x-1">
            <Button
              variant={viewMode === 'metrics' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('metrics')}
            >
              Metrics
            </Button>
            <Button
              variant={viewMode === 'kpis' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('kpis')}
            >
              KPIs
            </Button>
            <Button
              variant={viewMode === 'combined' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('combined')}
            >
              Combined
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingMetric(null);
              setShowMetricModal(true);
            }}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Metric
          </Button>

          <Button variant="outline" size="sm">
            <Settings className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {viewMode === 'metrics' || viewMode === 'combined' ? (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Custom Metrics</h3>
            <div className={`grid gap-4 ${
              isFullscreen 
                ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                : 'grid-cols-1 md:grid-cols-2'
            }`}>
              {enabledMetrics.length > 0 ? enabledMetrics.map(renderMetricCard) : (
                <div className="col-span-full text-center py-8 text-gray-500">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No custom metrics configured</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => {
                      setEditingMetric(null);
                      setShowMetricModal(true);
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add First Metric
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {viewMode === 'kpis' || viewMode === 'combined' ? (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Key Performance Indicators</h3>
            <div className={`grid gap-4 ${
              isFullscreen 
                ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
                : 'grid-cols-1 md:grid-cols-3'
            }`}>
              {kpis.length > 0 ? kpis.map(renderKpiCard) : (
                <div className="col-span-full text-center py-8 text-gray-500">
                  <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No KPIs configured</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => setShowKpiModal(true)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add First KPI
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Metric Configuration Modal */}
      <Modal
        isOpen={showMetricModal}
        onClose={() => {
          setShowMetricModal(false);
          setEditingMetric(null);
        }}
        title={editingMetric ? 'Edit Metric' : 'Add Custom Metric'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Metric name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="counter">Counter</option>
              <option value="gauge">Gauge</option>
              <option value="histogram">Histogram</option>
              <option value="summary">Summary</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chart Type</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="line">Line Chart</option>
              <option value="bar">Bar Chart</option>
              <option value="doughnut">Doughnut Chart</option>
              <option value="radar">Radar Chart</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="ms, %, bytes, etc."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <input
                type="color"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm h-10"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Query</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              rows={3}
              placeholder="PromQL or custom query"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="performance, api, database"
            />
          </div>

          <div className="flex space-x-2 pt-4">
            <Button className="flex-1">
              {editingMetric ? 'Update Metric' : 'Create Metric'}
            </Button>
            <Button 
              variant="outline"
              onClick={() => {
                setShowMetricModal(false);
                setEditingMetric(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* KPI Configuration Modal */}
      <Modal
        isOpen={showKpiModal}
        onClose={() => setShowKpiModal(false)}
        title="Add KPI"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">KPI Name</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="KPI name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Performance, Quality, etc."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="%, ms, count, etc."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Value</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Value</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              rows={2}
              placeholder="KPI description"
            />
          </div>

          <div className="flex space-x-2 pt-4">
            <Button className="flex-1">Create KPI</Button>
            <Button variant="outline" onClick={() => setShowKpiModal(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CustomMetricsDashboard;