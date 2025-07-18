'use client';

import React, { useState } from 'react';
import { ProgressTracker, QueueMonitor, ParallelTestRunner } from '@/components/TestExecution';

const ProgressTrackingDemo = () => {
  const [activeTab, setActiveTab] = useState<'tracker' | 'queue' | 'runner'>('tracker');
  const [executionId, setExecutionId] = useState('');
  const [testResults, setTestResults] = useState(null);

  const handleExecutionComplete = (results: any) => {
    setTestResults(results);
    console.log('Test execution completed:', results);
  };

  const handleExecutionError = (error: string) => {
    console.error('Test execution error:', error);
  };

  const handleExecutionCancel = () => {
    console.log('Test execution cancelled');
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            WebSocket Progress Tracking Demo
          </h1>
          <p className="text-gray-600 mb-6">
            Demonstrate real-time progress tracking for parallel test execution with WebSocket integration.
          </p>

          {/* Tab Navigation */}
          <div className="flex space-x-1 mb-6">
            <button
              onClick={() => setActiveTab('tracker')}
              className={`px-4 py-2 rounded-md font-medium ${
                activeTab === 'tracker'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Progress Tracker
            </button>
            <button
              onClick={() => setActiveTab('queue')}
              className={`px-4 py-2 rounded-md font-medium ${
                activeTab === 'queue'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Queue Monitor
            </button>
            <button
              onClick={() => setActiveTab('runner')}
              className={`px-4 py-2 rounded-md font-medium ${
                activeTab === 'runner'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Test Runner
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'tracker' && (
            <div className="space-y-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <h3 className="font-semibold text-yellow-800 mb-2">Progress Tracker Demo</h3>
                <p className="text-sm text-yellow-700 mb-4">
                  To test the progress tracker, you need an active execution ID. Start a test execution 
                  from the Test Runner tab first, then enter the execution ID here.
                </p>
                <div className="flex space-x-4">
                  <input
                    type="text"
                    value={executionId}
                    onChange={(e) => setExecutionId(e.target.value)}
                    placeholder="Enter execution ID (e.g., 12345678-1234-1234-1234-123456789012)"
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() => setExecutionId('')}
                    className="px-4 py-2 bg-gray-500 text-white rounded-md text-sm hover:bg-gray-600"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {executionId ? (
                <ProgressTracker
                  executionId={executionId}
                  onComplete={handleExecutionComplete}
                  onError={handleExecutionError}
                  onCancel={handleExecutionCancel}
                  showCancelButton={true}
                  autoStart={true}
                />
              ) : (
                <div className="bg-gray-50 rounded-lg p-12 text-center">
                  <div className="text-gray-400 mb-4">
                    <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Execution ID</h3>
                  <p className="text-gray-600">
                    Enter an execution ID above to track progress in real-time.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'queue' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <h3 className="font-semibold text-blue-800 mb-2">Queue Monitor</h3>
                <p className="text-sm text-blue-700">
                  Monitor the test execution queue and view active executions in real-time.
                  This updates automatically via WebSocket connections.
                </p>
              </div>

              <QueueMonitor
                autoRefresh={true}
                refreshInterval={5000}
              />
            </div>
          )}

          {activeTab === 'runner' && (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <h3 className="font-semibold text-green-800 mb-2">Parallel Test Runner</h3>
                <p className="text-sm text-green-700">
                  Start a new parallel test execution. This will create a new execution ID that you can 
                  use in the Progress Tracker tab to monitor progress.
                </p>
              </div>

              <ParallelTestRunner
                promptCardId={1}
                testCaseIds={[1, 2, 3, 4, 5]}
                onComplete={handleExecutionComplete}
                onError={handleExecutionError}
                autoStart={false}
              />
            </div>
          )}
        </div>

        {/* Results Display */}
        {testResults && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Test Results</h2>
            <div className="bg-gray-50 rounded-md p-4">
              <pre className="text-sm text-gray-700 overflow-x-auto">
                {JSON.stringify(testResults, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* WebSocket Connection Status */}
        <div className="bg-white rounded-lg shadow-lg p-6 mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">WebSocket Connection Status</h2>
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 rounded-full bg-green-500"></div>
              <span className="text-sm text-gray-700">Connected to WebSocket server</span>
            </div>
            <div className="text-sm text-gray-600">
              <p><strong>Server:</strong> {process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:3001'}</p>
              <p><strong>Features:</strong> Real-time progress updates, queue monitoring, execution cancellation</p>
            </div>
          </div>
        </div>

        {/* Demo Instructions */}
        <div className="bg-white rounded-lg shadow-lg p-6 mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Demo Instructions</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-gray-800">1. Start a Test Execution</h3>
              <p className="text-sm text-gray-600">
                Go to the "Test Runner" tab and configure a parallel test execution. Click "Start Parallel Execution" 
                to queue the tests and get an execution ID.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">2. Monitor Progress</h3>
              <p className="text-sm text-gray-600">
                Copy the execution ID and paste it into the "Progress Tracker" tab. You'll see real-time updates 
                as tests are executed in parallel.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">3. View Queue Status</h3>
              <p className="text-sm text-gray-600">
                Check the "Queue Monitor" tab to see overall queue statistics and all active executions.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">4. Cancel Execution</h3>
              <p className="text-sm text-gray-600">
                From the Progress Tracker, you can cancel running executions with a reason. This demonstrates 
                the real-time cancellation capability.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressTrackingDemo;