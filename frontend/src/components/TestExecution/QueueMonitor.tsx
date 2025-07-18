import React, { useEffect, useState } from 'react';
import { useWebSocket, ExecutionProgress } from '../../hooks/useWebSocket';

interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

interface QueueMonitorProps {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const QueueMonitor: React.FC<QueueMonitorProps> = ({
  autoRefresh = true,
  refreshInterval = 5000
}) => {
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [activeExecutions, setActiveExecutions] = useState<ExecutionProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { socket, isConnected, subscribeToProgress, unsubscribeFromProgress, getActiveExecutions } = useWebSocket();

  const fetchQueueStats = async () => {
    try {
      const response = await fetch('/api/test-cases/queue/stats');
      if (!response.ok) {
        throw new Error('Failed to fetch queue statistics');
      }
      const data = await response.json();
      setQueueStats(data.data);
    } catch (err) {
      console.error('Error fetching queue stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch queue statistics');
    }
  };

  const fetchActiveExecutions = async () => {
    try {
      const response = await fetch('/api/test-cases/executions/active');
      if (!response.ok) {
        throw new Error('Failed to fetch active executions');
      }
      const data = await response.json();
      setActiveExecutions(data.data);
    } catch (err) {
      console.error('Error fetching active executions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch active executions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      await Promise.all([fetchQueueStats(), fetchActiveExecutions()]);
      setIsLoading(false);
    };

    initialize();

    if (autoRefresh) {
      const interval = setInterval(fetchQueueStats, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    // Subscribe to general progress updates
    subscribeToProgress();

    // Handle real-time updates
    const handleProgress = (progress: ExecutionProgress) => {
      setActiveExecutions(prev => {
        const filtered = prev.filter(p => p.execution_id !== progress.execution_id);
        if (progress.status === 'running' || progress.status === 'pending') {
          return [...filtered, progress];
        }
        return filtered;
      });
    };

    const handleActiveExecutions = (executions: ExecutionProgress[]) => {
      setActiveExecutions(executions);
    };

    socket.on('progress', handleProgress);
    socket.on('active-executions', handleActiveExecutions);

    // Get initial active executions
    getActiveExecutions();

    return () => {
      socket.off('progress', handleProgress);
      socket.off('active-executions', handleActiveExecutions);
      unsubscribeFromProgress();
    };
  }, [socket, isConnected]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString();
  };

  const formatDuration = (ms: number): string => {
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

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Loading queue information...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Error</h3>
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Queue Statistics */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Queue Statistics</h3>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        {queueStats && (
          <div className="grid grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{queueStats.waiting}</div>
              <div className="text-sm text-gray-600">Waiting</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{queueStats.active}</div>
              <div className="text-sm text-gray-600">Active</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{queueStats.completed}</div>
              <div className="text-sm text-gray-600">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{queueStats.failed}</div>
              <div className="text-sm text-gray-600">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">{queueStats.delayed}</div>
              <div className="text-sm text-gray-600">Delayed</div>
            </div>
          </div>
        )}
      </div>

      {/* Active Executions */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Active Executions</h3>
        
        {activeExecutions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">🎉</div>
            <p>No active test executions</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeExecutions.map((execution) => (
              <div
                key={execution.execution_id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <span className="font-mono text-sm text-gray-600">
                      {execution.execution_id.substring(0, 8)}...
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(execution.status)}`}>
                      {execution.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    Updated: {formatTime(execution.updated_at.toString())}
                  </div>
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Progress</span>
                    <span>{Math.round(execution.overall_progress_percent)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(0, Math.min(100, execution.overall_progress_percent))}%` }}
                    ></div>
                  </div>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <div className="flex space-x-4">
                    <span className="text-gray-600">
                      Tests: {execution.completed_tests}/{execution.total_tests}
                    </span>
                    {execution.failed_tests > 0 && (
                      <span className="text-red-600">
                        Failed: {execution.failed_tests}
                      </span>
                    )}
                  </div>
                  {execution.estimated_time_remaining > 0 && (
                    <span className="text-gray-500">
                      ETA: {formatDuration(execution.estimated_time_remaining)}
                    </span>
                  )}
                </div>

                <div className="mt-2 text-sm text-gray-600">
                  {execution.message}
                </div>

                {execution.current_test && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-md">
                    <div className="text-sm font-medium mb-1">Currently Running:</div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>Test Case #{execution.current_test.test_case_id}</div>
                      <div>Model: {execution.current_test.model}</div>
                      <div>Started: {formatTime(execution.current_test.started_at.toString())}</div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default QueueMonitor;