import React, { useEffect, useState } from 'react';
import { useWebSocket, ExecutionProgress, TestExecutionResult } from '../../hooks/useWebSocket';

interface ProgressTrackerProps {
  executionId: string;
  onComplete?: (results: TestExecutionResult[]) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
  showCancelButton?: boolean;
  autoStart?: boolean;
}

const ProgressTracker: React.FC<ProgressTrackerProps> = ({
  executionId,
  onComplete,
  onError,
  onCancel,
  showCancelButton = true,
  autoStart = true
}) => {
  const [progress, setProgress] = useState<ExecutionProgress | null>(null);
  const [testResults, setTestResults] = useState<TestExecutionResult[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const { socket, isConnected, subscribeToTest, unsubscribeFromTest, cancelExecution } = useWebSocket();

  useEffect(() => {
    if (!socket || !isConnected || !autoStart) return;

    // Subscribe to test execution updates
    subscribeToTest(executionId);

    // Set up event handlers
    const handleProgress = (progressData: ExecutionProgress) => {
      if (progressData.execution_id === executionId) {
        setProgress(progressData);
        
        if (progressData.status === 'completed') {
          setIsFinished(true);
        } else if (progressData.status === 'failed') {
          setError(progressData.message);
          setIsFinished(true);
          onError?.(progressData.message);
        } else if (progressData.status === 'cancelled') {
          setIsFinished(true);
          onCancel?.();
        }
      }
    };

    const handleTestResult = (result: TestExecutionResult) => {
      setTestResults(prev => [...prev, result]);
    };

    const handleExecutionComplete = (data: { execution_id: string; results: TestExecutionResult[] }) => {
      if (data.execution_id === executionId) {
        setTestResults(data.results);
        setIsFinished(true);
        onComplete?.(data.results);
      }
    };

    const handleExecutionError = (data: { execution_id: string; error: string }) => {
      if (data.execution_id === executionId) {
        setError(data.error);
        setIsFinished(true);
        onError?.(data.error);
      }
    };

    socket.on('progress', handleProgress);
    socket.on('test-result', handleTestResult);
    socket.on('execution-complete', handleExecutionComplete);
    socket.on('execution-error', handleExecutionError);

    return () => {
      socket.off('progress', handleProgress);
      socket.off('test-result', handleTestResult);
      socket.off('execution-complete', handleExecutionComplete);
      socket.off('execution-error', handleExecutionError);
      unsubscribeFromTest(executionId);
    };
  }, [socket, isConnected, executionId, autoStart, onComplete, onError, onCancel]);

  const handleCancelClick = () => {
    setShowCancelDialog(true);
  };

  const handleCancelConfirm = () => {
    if (cancelReason.trim()) {
      cancelExecution(executionId, cancelReason);
      setShowCancelDialog(false);
      setCancelReason('');
    }
  };

  const handleCancelCancel = () => {
    setShowCancelDialog(false);
    setCancelReason('');
  };

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const formatEstimatedTime = (ms: number): string => {
    if (ms <= 0) return 'Unknown';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-600';
      case 'running':
        return 'text-blue-600';
      case 'completed':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      case 'cancelled':
        return 'text-gray-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'running':
        return '🔄';
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      case 'cancelled':
        return '🚫';
      default:
        return '❓';
    }
  };

  if (!progress) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading execution progress...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Test Execution Progress</h3>
          <div className="flex items-center space-x-2">
            <span className="text-2xl">{getStatusIcon(progress.status)}</span>
            <span className={`font-medium ${getStatusColor(progress.status)}`}>
              {progress.status.toUpperCase()}
            </span>
          </div>
        </div>
        {showCancelButton && !isFinished && progress.status !== 'cancelled' && (
          <button
            onClick={handleCancelClick}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium"
            disabled={!isConnected}
          >
            Cancel Execution
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>Progress</span>
          <span>{Math.round(progress.overall_progress_percent)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${Math.max(0, Math.min(100, progress.overall_progress_percent))}%` }}
          ></div>
        </div>
      </div>

      {/* Test Statistics */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{progress.total_tests}</div>
          <div className="text-sm text-gray-600">Total Tests</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{progress.completed_tests}</div>
          <div className="text-sm text-gray-600">Completed</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">{progress.failed_tests}</div>
          <div className="text-sm text-gray-600">Failed</div>
        </div>
      </div>

      {/* Current Test Info */}
      {progress.current_test && progress.status === 'running' && (
        <div className="bg-gray-50 rounded-md p-4 mb-4">
          <h4 className="font-medium mb-2">Currently Running:</h4>
          <div className="text-sm space-y-1">
            <div><span className="font-medium">Test Case:</span> #{progress.current_test.test_case_id}</div>
            <div><span className="font-medium">Model:</span> {progress.current_test.model}</div>
            <div><span className="font-medium">Started:</span> {new Date(progress.current_test.started_at).toLocaleTimeString()}</div>
          </div>
        </div>
      )}

      {/* Status Message */}
      <div className="bg-gray-50 rounded-md p-4 mb-4">
        <p className="text-sm text-gray-700">{progress.message}</p>
      </div>

      {/* Time Information */}
      {progress.status === 'running' && progress.estimated_time_remaining > 0 && (
        <div className="flex justify-between text-sm text-gray-600 mb-4">
          <span>Estimated Time Remaining: {formatEstimatedTime(progress.estimated_time_remaining)}</span>
          <span>Last Updated: {new Date(progress.updated_at).toLocaleTimeString()}</span>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
          <h4 className="font-medium text-red-800 mb-2">Error</h4>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Real-time Test Results */}
      {testResults.length > 0 && (
        <div className="border-t pt-4">
          <h4 className="font-medium mb-2">Recent Test Results:</h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {testResults.slice(-5).map((result, index) => (
              <div key={index} className="flex items-center justify-between bg-gray-50 rounded-md p-2">
                <span className="text-sm">Test #{result.test_case_id}</span>
                <div className="flex items-center space-x-2">
                  <span className={`text-sm font-medium ${result.passed ? 'text-green-600' : 'text-red-600'}`}>
                    {result.passed ? '✅ PASS' : '❌ FAIL'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatTime(result.execution_time_ms)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connection Status */}
      {!isConnected && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mt-4">
          <p className="text-sm text-yellow-700">
            ⚠️ Connection lost. Progress updates may be delayed.
          </p>
        </div>
      )}

      {/* Cancel Dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Cancel Test Execution</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to cancel this test execution? This action cannot be undone.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for cancellation:
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                placeholder="e.g., Taking too long, incorrect configuration"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={handleCancelCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Keep Running
              </button>
              <button
                onClick={handleCancelConfirm}
                disabled={!cancelReason.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-md hover:bg-red-600 disabled:bg-red-300"
              >
                Cancel Execution
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgressTracker;