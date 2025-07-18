import React, { useState } from 'react';
import ProgressTracker from './ProgressTracker';
import { TestExecutionResult } from '../../hooks/useWebSocket';

interface TestConfiguration {
  max_concurrent_tests: number;
  timeout_per_test: number;
  retry_failed_tests: boolean;
  max_retries: number;
  resource_limits: {
    memory_mb: number;
    cpu_percent: number;
  };
}

interface ParallelTestRunnerProps {
  promptCardId: number;
  testCaseIds: number[];
  onComplete?: (results: TestExecutionResult[]) => void;
  onError?: (error: string) => void;
  autoStart?: boolean;
}

const ParallelTestRunner: React.FC<ParallelTestRunnerProps> = ({
  promptCardId,
  testCaseIds,
  onComplete,
  onError,
  autoStart = false
}) => {
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [isConfiguring, setIsConfiguring] = useState(!autoStart);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Configuration state
  const [model, setModel] = useState('llama3.1');
  const [configuration, setConfiguration] = useState<TestConfiguration>({
    max_concurrent_tests: 3,
    timeout_per_test: 30000,
    retry_failed_tests: false,
    max_retries: 1,
    resource_limits: {
      memory_mb: 1024,
      cpu_percent: 50
    }
  });
  const [priority, setPriority] = useState(0);

  // Available models (this could be fetched from an API)
  const availableModels = [
    'llama3.1',
    'llama3.1:8b',
    'llama3.1:70b',
    'codellama',
    'mistral',
    'phi3'
  ];

  const startExecution = async () => {
    if (testCaseIds.length === 0) {
      setError('No test cases selected');
      return;
    }

    setIsStarting(true);
    setError(null);

    try {
      const response = await fetch('/api/test-cases/execute-parallel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt_card_id: promptCardId,
          test_case_ids: testCaseIds,
          model,
          configuration,
          priority
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start test execution');
      }

      setExecutionId(data.data.execution_id);
      setIsConfiguring(false);
      setIsStarting(false);
    } catch (err) {
      console.error('Error starting execution:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to start test execution';
      setError(errorMessage);
      setIsStarting(false);
      onError?.(errorMessage);
    }
  };

  const handleConfigurationChange = (field: keyof TestConfiguration, value: any) => {
    setConfiguration(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleResourceLimitChange = (field: keyof TestConfiguration['resource_limits'], value: number) => {
    setConfiguration(prev => ({
      ...prev,
      resource_limits: {
        ...prev.resource_limits,
        [field]: value
      }
    }));
  };

  const handleComplete = (results: TestExecutionResult[]) => {
    onComplete?.(results);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    onError?.(errorMessage);
  };

  const handleCancel = () => {
    setExecutionId(null);
    setIsConfiguring(true);
  };

  const resetConfiguration = () => {
    setConfiguration({
      max_concurrent_tests: 3,
      timeout_per_test: 30000,
      retry_failed_tests: false,
      max_retries: 1,
      resource_limits: {
        memory_mb: 1024,
        cpu_percent: 50
      }
    });
    setPriority(0);
    setModel('llama3.1');
  };

  // Auto-start if enabled
  React.useEffect(() => {
    if (autoStart && !executionId && !isStarting) {
      startExecution();
    }
  }, [autoStart]);

  if (executionId) {
    return (
      <ProgressTracker
        executionId={executionId}
        onComplete={handleComplete}
        onError={handleError}
        onCancel={handleCancel}
        showCancelButton={true}
        autoStart={true}
      />
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold">Parallel Test Execution</h3>
        <button
          onClick={resetConfiguration}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Reset to Defaults
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <h4 className="font-medium text-red-800 mb-2">Error</h4>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Test Summary */}
        <div className="bg-gray-50 rounded-md p-4">
          <h4 className="font-medium mb-2">Test Summary</h4>
          <div className="text-sm space-y-1">
            <div><span className="font-medium">Prompt Card ID:</span> {promptCardId}</div>
            <div><span className="font-medium">Test Cases:</span> {testCaseIds.length} selected</div>
            <div><span className="font-medium">Test Case IDs:</span> {testCaseIds.join(', ')}</div>
          </div>
        </div>

        {/* Model Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Language Model
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            {availableModels.map(modelName => (
              <option key={modelName} value={modelName}>
                {modelName}
              </option>
            ))}
          </select>
        </div>

        {/* Execution Configuration */}
        <div className="space-y-4">
          <h4 className="font-medium">Execution Configuration</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Concurrent Tests
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={configuration.max_concurrent_tests}
                onChange={(e) => handleConfigurationChange('max_concurrent_tests', parseInt(e.target.value))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">Number of tests to run simultaneously</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Timeout per Test (ms)
              </label>
              <input
                type="number"
                min="1000"
                max="300000"
                step="1000"
                value={configuration.timeout_per_test}
                onChange={(e) => handleConfigurationChange('timeout_per_test', parseInt(e.target.value))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">Maximum time per test execution</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={configuration.retry_failed_tests}
                onChange={(e) => handleConfigurationChange('retry_failed_tests', e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm">Retry failed tests</span>
            </label>

            {configuration.retry_failed_tests && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-700">Max retries:</span>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={configuration.max_retries}
                  onChange={(e) => handleConfigurationChange('max_retries', parseInt(e.target.value))}
                  className="w-16 border border-gray-300 rounded-md px-2 py-1 text-sm"
                />
              </div>
            )}
          </div>
        </div>

        {/* Resource Limits */}
        <div className="space-y-4">
          <h4 className="font-medium">Resource Limits</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Memory Limit (MB)
              </label>
              <input
                type="number"
                min="512"
                max="8192"
                step="256"
                value={configuration.resource_limits.memory_mb}
                onChange={(e) => handleResourceLimitChange('memory_mb', parseInt(e.target.value))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CPU Limit (%)
              </label>
              <input
                type="number"
                min="10"
                max="100"
                step="10"
                value={configuration.resource_limits.cpu_percent}
                onChange={(e) => handleResourceLimitChange('cpu_percent', parseInt(e.target.value))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Priority */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Priority
          </label>
          <select
            value={priority}
            onChange={(e) => setPriority(parseInt(e.target.value))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value={-2}>Low</option>
            <option value={0}>Normal</option>
            <option value={1}>High</option>
            <option value={2}>Critical</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">Higher priority executions run first</p>
        </div>

        {/* Estimated Resource Usage */}
        <div className="bg-blue-50 rounded-md p-4">
          <h4 className="font-medium mb-2">Estimated Resource Usage</h4>
          <div className="text-sm space-y-1">
            <div>
              <span className="font-medium">Expected Duration:</span> {' '}
              {Math.ceil((testCaseIds.length * configuration.timeout_per_test) / configuration.max_concurrent_tests / 1000)}s - {' '}
              {Math.ceil((testCaseIds.length * configuration.timeout_per_test) / 1000)}s
            </div>
            <div>
              <span className="font-medium">Memory Usage:</span> {' '}
              {configuration.resource_limits.memory_mb * configuration.max_concurrent_tests}MB
            </div>
            <div>
              <span className="font-medium">CPU Usage:</span> {' '}
              {configuration.resource_limits.cpu_percent}%
            </div>
          </div>
        </div>

        {/* Start Button */}
        <div className="flex justify-end">
          <button
            onClick={startExecution}
            disabled={isStarting || testCaseIds.length === 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-6 py-2 rounded-md font-medium"
          >
            {isStarting ? (
              <span className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Starting...
              </span>
            ) : (
              `Start Parallel Execution (${testCaseIds.length} tests)`
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ParallelTestRunner;