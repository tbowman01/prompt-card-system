'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import { DashboardMetrics } from '@/types';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface RealTimeEvent {
  id: string;
  type: 'test_execution' | 'batch_execution' | 'model_usage' | 'system_alert';
  timestamp: Date;
  message: string;
  data: any;
  severity: 'info' | 'warning' | 'error' | 'success';
}

interface RealTimeMonitorProps {
  refreshInterval?: number;
  maxEvents?: number;
}

export const RealTimeMonitor: React.FC<RealTimeMonitorProps> = ({ 
  refreshInterval = 5000, 
  maxEvents = 50 
}) => {
  const [metrics, setMetrics] = useState<DashboardMetrics['realtime'] | null>(null);
  const [events, setEvents] = useState<RealTimeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  const { socket, isConnected: wsConnected, connect, disconnect } = useWebSocket();

  useEffect(() => {
    if (socket) {
      // Listen for real-time events
      socket.on('analytics-update', (data) => {
        if (!isPaused) {
          setMetrics(data.realtime);
        }
      });

      socket.on('test-execution-event', (data) => {
        if (!isPaused) {
          const event: RealTimeEvent = {
            id: Date.now().toString(),
            type: 'test_execution',
            timestamp: new Date(data.timestamp),
            message: `Test ${data.passed ? 'passed' : 'failed'} for ${data.model}`,
            data: data,
            severity: data.passed ? 'success' : 'error'
          };
          
          setEvents(prev => [event, ...prev.slice(0, maxEvents - 1)]);
        }
      });

      socket.on('batch-execution-event', (data) => {
        if (!isPaused) {
          const event: RealTimeEvent = {
            id: Date.now().toString(),
            type: 'batch_execution',
            timestamp: new Date(data.timestamp),
            message: `Batch execution: ${data.passed_tests}/${data.total_tests} tests passed`,
            data: data,
            severity: data.passed_tests / data.total_tests > 0.8 ? 'success' : 'warning'
          };
          
          setEvents(prev => [event, ...prev.slice(0, maxEvents - 1)]);
        }
      });

      socket.on('system-alert', (data) => {
        if (!isPaused) {
          const event: RealTimeEvent = {
            id: Date.now().toString(),
            type: 'system_alert',
            timestamp: new Date(data.timestamp),
            message: data.message,
            data: data,
            severity: data.severity
          };
          
          setEvents(prev => [event, ...prev.slice(0, maxEvents - 1)]);
        }
      });

      setIsConnected(true);
    }

    return () => {
      if (socket) {
        socket.off('analytics-update');
        socket.off('test-execution-event');
        socket.off('batch-execution-event');
        socket.off('system-alert');
      }
    };
  }, [socket, isPaused, maxEvents]);

  useEffect(() => {
    const fetchRealtimeMetrics = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getRealtimeMetrics();
        setMetrics(data);
      } catch (err) {
        console.error('Error fetching real-time metrics:', err);
        setError('Failed to load real-time metrics');
      } finally {
        setLoading(false);
      }
    };

    fetchRealtimeMetrics();
    
    // Fallback polling if WebSocket is not connected
    let interval: NodeJS.Timeout;
    if (!wsConnected && !isPaused) {
      interval = setInterval(fetchRealtimeMetrics, refreshInterval);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [wsConnected, isPaused, refreshInterval]);

  const handleTogglePause = () => {
    setIsPaused(!isPaused);
  };

  const handleClearEvents = () => {
    setEvents([]);
  };

  const handleReconnect = () => {
    disconnect();
    setTimeout(() => connect(), 1000);
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const getSeverityColor = (severity: RealTimeEvent['severity']): string => {
    switch (severity) {
      case 'success':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getEventIcon = (type: RealTimeEvent['type']): string => {
    switch (type) {
      case 'test_execution':
        return '🧪';
      case 'batch_execution':
        return '📦';
      case 'model_usage':
        return '🤖';
      case 'system_alert':
        return '⚠️';
      default:
        return '📊';
    }
  };

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

  return (
    <div className="space-y-6">
      {/* Connection Status & Controls */}
      <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm font-medium text-gray-700">
              {wsConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <Badge variant={isPaused ? 'secondary' : 'default'}>
            {isPaused ? 'Paused' : 'Live'}
          </Badge>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTogglePause}
          >
            {isPaused ? '▶️ Resume' : '⏸️ Pause'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearEvents}
          >
            🧹 Clear
          </Button>
          {!wsConnected && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReconnect}
            >
              🔄 Reconnect
            </Button>
          )}
        </div>
      </div>

      {/* Current Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Tests</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.activeTests}</p>
              </div>
              <div className="text-blue-600">
                <div className={`w-3 h-3 rounded-full ${metrics.activeTests > 0 ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}`}></div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tests/sec</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.testsPerSecond.toFixed(1)}</p>
              </div>
              <div className="text-green-600">⚡</div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Success Rate</p>
                <p className="text-2xl font-bold text-gray-900">{(metrics.successRate * 100).toFixed(1)}%</p>
              </div>
              <div className={`text-${metrics.successRate >= 0.9 ? 'green' : metrics.successRate >= 0.7 ? 'yellow' : 'red'}-600`}>
                {metrics.successRate >= 0.9 ? '✅' : metrics.successRate >= 0.7 ? '⚠️' : '❌'}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Response</p>
                <p className="text-2xl font-bold text-gray-900">
                  {metrics.averageResponseTime >= 1000 
                    ? `${(metrics.averageResponseTime / 1000).toFixed(1)}s`
                    : `${metrics.averageResponseTime.toFixed(0)}ms`
                  }
                </p>
              </div>
              <div className="text-purple-600">⏱️</div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Error Rate</p>
                <p className="text-2xl font-bold text-gray-900">{(metrics.errorRate * 100).toFixed(1)}%</p>
              </div>
              <div className={`text-${metrics.errorRate <= 0.1 ? 'green' : metrics.errorRate <= 0.3 ? 'yellow' : 'red'}-600`}>
                {metrics.errorRate <= 0.1 ? '✅' : metrics.errorRate <= 0.3 ? '⚠️' : '🚨'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Events */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Real-time Events</h3>
          <p className="text-sm text-gray-500 mt-1">
            {events.length} events • {isPaused ? 'Paused' : 'Live updates'}
          </p>
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {events.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No events yet. Events will appear here as they occur.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {events.map((event) => (
                <div key={event.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 text-lg">
                      {getEventIcon(event.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-gray-900">{event.message}</p>
                        <Badge variant="outline" className={getSeverityColor(event.severity)}>
                          {event.severity}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatTime(event.timestamp)} • {event.type.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* System Status */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">System Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <div>
              <p className="text-sm font-medium text-gray-900">Backend API</p>
              <p className="text-xs text-gray-500">Operational</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <div>
              <p className="text-sm font-medium text-gray-900">WebSocket</p>
              <p className="text-xs text-gray-500">{wsConnected ? 'Connected' : 'Disconnected'}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <div>
              <p className="text-sm font-medium text-gray-900">Analytics Engine</p>
              <p className="text-xs text-gray-500">Running</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealTimeMonitor;