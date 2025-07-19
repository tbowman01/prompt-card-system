'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import RealTimeMetricsChart from './RealTimeMetricsChart';
import SystemHealthOverview from './SystemHealthOverview';
import AlertsManager from './AlertsManager';
import DistributedTracingViz from './DistributedTracingViz';
import CustomMetricsDashboard from './CustomMetricsDashboard';
import PerformanceHeatmap from './PerformanceHeatmap';
import { useWebSocket } from '@/hooks/useWebSocket';
import { api } from '@/lib/api';
import { 
  Settings, 
  Maximize2, 
  Minimize2, 
  RefreshCw, 
  Download,
  Upload,
  Layout,
  Filter,
  Bell,
  Activity,
  BarChart3,
  TrendingUp,
  MapPin,
  Gauge
} from 'lucide-react';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface DashboardConfig {
  layouts: any;
  widgets: Array<{
    id: string;
    type: string;
    title: string;
    enabled: boolean;
    config: any;
  }>;
}

interface MonitoringData {
  realTimeMetrics: any;
  systemHealth: any;
  alerts: any[];
  traces: any[];
  customMetrics: any;
  performance: any;
}

const defaultLayout = {
  lg: [
    { i: 'realtime-metrics', x: 0, y: 0, w: 8, h: 4, minW: 4, minH: 3 },
    { i: 'system-health', x: 8, y: 0, w: 4, h: 4, minW: 3, minH: 3 },
    { i: 'alerts-manager', x: 0, y: 4, w: 6, h: 3, minW: 4, minH: 2 },
    { i: 'performance-heatmap', x: 6, y: 4, w: 6, h: 3, minW: 4, minH: 2 },
    { i: 'distributed-tracing', x: 0, y: 7, w: 12, h: 4, minW: 8, minH: 3 },
    { i: 'custom-metrics', x: 0, y: 11, w: 12, h: 3, minW: 6, minH: 2 }
  ],
  md: [
    { i: 'realtime-metrics', x: 0, y: 0, w: 6, h: 4 },
    { i: 'system-health', x: 6, y: 0, w: 4, h: 4 },
    { i: 'alerts-manager', x: 0, y: 4, w: 5, h: 3 },
    { i: 'performance-heatmap', x: 5, y: 4, w: 5, h: 3 },
    { i: 'distributed-tracing', x: 0, y: 7, w: 10, h: 4 },
    { i: 'custom-metrics', x: 0, y: 11, w: 10, h: 3 }
  ],
  sm: [
    { i: 'realtime-metrics', x: 0, y: 0, w: 6, h: 4 },
    { i: 'system-health', x: 0, y: 4, w: 6, h: 4 },
    { i: 'alerts-manager', x: 0, y: 8, w: 6, h: 3 },
    { i: 'performance-heatmap', x: 0, y: 11, w: 6, h: 3 },
    { i: 'distributed-tracing', x: 0, y: 14, w: 6, h: 4 },
    { i: 'custom-metrics', x: 0, y: 18, w: 6, h: 3 }
  ]
};

const defaultWidgets = [
  { id: 'realtime-metrics', type: 'realtime-metrics', title: 'Real-time Metrics', enabled: true, config: {} },
  { id: 'system-health', type: 'system-health', title: 'System Health', enabled: true, config: {} },
  { id: 'alerts-manager', type: 'alerts-manager', title: 'Alerts & Notifications', enabled: true, config: {} },
  { id: 'performance-heatmap', type: 'performance-heatmap', title: 'Performance Heatmap', enabled: true, config: {} },
  { id: 'distributed-tracing', type: 'distributed-tracing', title: 'Distributed Tracing', enabled: true, config: {} },
  { id: 'custom-metrics', type: 'custom-metrics', title: 'Custom Metrics & KPIs', enabled: true, config: {} }
];

export const MonitoringDashboard: React.FC = () => {
  const [layouts, setLayouts] = useState(defaultLayout);
  const [widgets, setWidgets] = useState(defaultWidgets);
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenWidget, setFullscreenWidget] = useState<string | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(30000);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const { socket, isConnected } = useWebSocket();

  const fetchMonitoringData = useCallback(async () => {
    try {
      setError(null);
      const [metrics, health, alerts, traces, customMetrics, performance] = await Promise.all([
        api.getRealtimeMetrics(),
        api.getSystemHealth(),
        api.getAlerts(),
        api.getDistributedTraces(),
        api.getCustomMetrics(),
        api.getPerformanceData()
      ]);

      setData({
        realTimeMetrics: metrics,
        systemHealth: health,
        alerts: alerts,
        traces: traces,
        customMetrics: customMetrics,
        performance: performance
      });
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error fetching monitoring data:', err);
      setError('Failed to load monitoring data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMonitoringData();
  }, [fetchMonitoringData]);

  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(fetchMonitoringData, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchMonitoringData]);

  useEffect(() => {
    if (socket && isConnected) {
      // Real-time updates via WebSocket
      socket.on('monitoring-update', (update) => {
        setData(prev => prev ? { ...prev, ...update } : null);
        setLastUpdate(new Date());
      });

      socket.on('alert-triggered', (alert) => {
        setData(prev => prev ? {
          ...prev,
          alerts: [alert, ...prev.alerts.slice(0, 99)]
        } : null);
      });

      return () => {
        socket.off('monitoring-update');
        socket.off('alert-triggered');
      };
    }
  }, [socket, isConnected]);

  const handleLayoutChange = (layout: any, layouts: any) => {
    setLayouts(layouts);
  };

  const handleWidgetToggle = (widgetId: string) => {
    setWidgets(prev => prev.map(widget => 
      widget.id === widgetId 
        ? { ...widget, enabled: !widget.enabled }
        : widget
    ));
  };

  const exportDashboardConfig = () => {
    const config = { layouts, widgets };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monitoring-dashboard-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importDashboardConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target?.result as string);
        if (config.layouts) setLayouts(config.layouts);
        if (config.widgets) setWidgets(config.widgets);
      } catch (err) {
        console.error('Error importing config:', err);
      }
    };
    reader.readAsText(file);
  };

  const renderWidget = (widget: any) => {
    if (!widget.enabled || !data) return null;

    const commonProps = {
      data: data,
      config: widget.config,
      isFullscreen: fullscreenWidget === widget.id,
      onFullscreen: () => setFullscreenWidget(widget.id),
      onExitFullscreen: () => setFullscreenWidget(null)
    };

    switch (widget.type) {
      case 'realtime-metrics':
        return <RealTimeMetricsChart {...commonProps} />;
      case 'system-health':
        return <SystemHealthOverview {...commonProps} />;
      case 'alerts-manager':
        return <AlertsManager {...commonProps} />;
      case 'performance-heatmap':
        return <PerformanceHeatmap {...commonProps} />;
      case 'distributed-tracing':
        return <DistributedTracingViz {...commonProps} />;
      case 'custom-metrics':
        return <CustomMetricsDashboard {...commonProps} />;
      default:
        return <div>Unknown widget type</div>;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-lg">Loading monitoring dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center text-red-600">
              <Activity className="h-5 w-5 mr-2" />
              Dashboard Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchMonitoringData} variant="outline" className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Advanced Monitoring Dashboard</h1>
            <p className="text-sm text-gray-600">
              Real-time system monitoring and analytics
              {lastUpdate && (
                <span className="ml-2">
                  • Last updated: {lastUpdate.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {/* Connection Status */}
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm text-gray-600">
                {isConnected ? 'Live' : 'Offline'}
              </span>
            </div>

            {/* Auto-refresh Toggle */}
            <Button
              variant={autoRefresh ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? 'Auto ON' : 'Auto OFF'}
            </Button>

            {/* Manual Refresh */}
            <Button
              variant="outline"
              size="sm"
              onClick={fetchMonitoringData}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>

            {/* Dashboard Configuration */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfigModalOpen(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>

            {/* Export Config */}
            <Button
              variant="outline"
              size="sm"
              onClick={exportDashboardConfig}
            >
              <Download className="h-4 w-4" />
            </Button>

            {/* Import Config */}
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={importDashboardConfig}
              />
              <Button variant="outline" size="sm" as="span">
                <Upload className="h-4 w-4" />
              </Button>
            </label>

            {/* Fullscreen Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Dashboard Grid */}
      <div className={`flex-1 overflow-auto p-4 ${isFullscreen ? 'fixed inset-0 z-50 bg-gray-50' : ''}`}>
        {fullscreenWidget ? (
          // Fullscreen widget view
          <div className="h-full">
            <div className="mb-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold">
                {widgets.find(w => w.id === fullscreenWidget)?.title}
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFullscreenWidget(null)}
              >
                <Minimize2 className="h-4 w-4 mr-2" />
                Exit Fullscreen
              </Button>
            </div>
            <div className="h-full">
              {renderWidget(widgets.find(w => w.id === fullscreenWidget))}
            </div>
          </div>
        ) : (
          // Grid layout
          <ResponsiveGridLayout
            className="layout"
            layouts={layouts}
            onLayoutChange={handleLayoutChange}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={60}
            margin={[16, 16]}
            containerPadding={[0, 0]}
            isDraggable={true}
            isResizable={true}
          >
            {widgets.filter(w => w.enabled).map((widget) => (
              <div key={widget.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-sm">
                      <span>{widget.title}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFullscreenWidget(widget.id)}
                      >
                        <Maximize2 className="h-3 w-3" />
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 pt-0">
                    {renderWidget(widget)}
                  </CardContent>
                </Card>
              </div>
            ))}
          </ResponsiveGridLayout>
        )}
      </div>

      {/* Configuration Modal */}
      <Modal
        isOpen={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        title="Dashboard Configuration"
      >
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium mb-3">Widget Visibility</h3>
            <div className="space-y-2">
              {widgets.map((widget) => (
                <div key={widget.id} className="flex items-center justify-between">
                  <span className="text-sm">{widget.title}</span>
                  <Button
                    variant={widget.enabled ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleWidgetToggle(widget.id)}
                  >
                    {widget.enabled ? 'Enabled' : 'Disabled'}
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-3">Refresh Settings</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Auto-refresh</span>
                <Button
                  variant={autoRefresh ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAutoRefresh(!autoRefresh)}
                >
                  {autoRefresh ? 'ON' : 'OFF'}
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Refresh Interval</span>
                <select
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                >
                  <option value={5000}>5 seconds</option>
                  <option value={10000}>10 seconds</option>
                  <option value={30000}>30 seconds</option>
                  <option value={60000}>1 minute</option>
                  <option value={300000}>5 minutes</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default MonitoringDashboard;