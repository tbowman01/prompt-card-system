'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Badge } from '@/components/ui/Badge';
import { TestCase, TestExecution, RunTestsRequest } from '@/types';
import { api } from '@/lib/api';

interface TestRunnerProps {
  promptCardId: number;
  testCases: TestCase[];
  onTestComplete?: (execution: TestExecution) => void;
  onError?: (error: string) => void;
}

export default function TestRunner({
  promptCardId,
  testCases,
  onTestComplete,
  onError
}: TestRunnerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [selectedTests, setSelectedTests] = useState<number[]>([]);
  const [selectedModel, setSelectedModel] = useState('llama3.2');
  const [allSelected, setAllSelected] = useState(false);
  const [executionMode, setExecutionMode] = useState<'sequential' | 'parallel'>('sequential');

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedTests([]);
    } else {
      setSelectedTests(testCases.map(tc => tc.id));
    }
    setAllSelected(!allSelected);
  };

  const handleTestSelection = (testCaseId: number) => {
    setSelectedTests(prev => {
      if (prev.includes(testCaseId)) {
        return prev.filter(id => id !== testCaseId);
      } else {
        return [...prev, testCaseId];
      }
    });
  };

  const handleRunTests = async () => {
    if (selectedTests.length === 0 && !allSelected) {
      onError?.('Please select at least one test to run');
      return;
    }

    setIsRunning(true);
    try {
      const testCaseIds = allSelected ? testCases.map(tc => tc.id) : selectedTests;

      if (executionMode === 'parallel') {
        // Use parallel execution endpoint
        const response = await fetch('/api/test-cases/execute-parallel', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt_card_id: promptCardId,
            test_case_ids: testCaseIds,
            model: selectedModel,
            configuration: {
              max_concurrent_tests: 3,
              timeout_per_test: 30000,
              retry_failed_tests: false,
              max_retries: 1,
              resource_limits: {
                memory_mb: 1024,
                cpu_percent: 50
              }
            },
            priority: 0
          })
        });

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to start parallel execution');
        }

        // For parallel execution, we'll need to handle the progress tracking differently
        // This would typically redirect to a progress page or show a modal
        onTestComplete?.({
          execution_id: data.data.execution_id,
          status: 'running',
          mode: 'parallel'
        } as any);
      } else {
        // Use sequential execution (existing API)
        const request: RunTestsRequest = {
          prompt_card_id: promptCardId,
          model: selectedModel,
          test_case_ids: allSelected ? undefined : selectedTests
        };

        const response = await api.runTests(request);
        
        if (response.execution) {
          onTestComplete?.(response.execution);
        } else {
          // Handle async execution - you might want to poll for results
          setTimeout(async () => {
            try {
              const execution = await api.getTestExecution(response.execution_id);
              onTestComplete?.(execution);
            } catch (error) {
              onError?.(error instanceof Error ? error.message : 'Failed to get test results');
            }
          }, 1000);
        }
      }
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Failed to run tests');
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunSingleTest = async (testCaseId: number) => {
    try {
      const result = await api.runSingleTest(testCaseId, { model: selectedModel });
      // Handle single test result - you might want a different callback
      console.log('Single test result:', result);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Failed to run test');
    }
  };

  if (testCases.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <div className="text-gray-500 mb-2">
          <svg className="mx-auto h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
        <p className="text-gray-600">No test cases available to run</p>
        <p className="text-sm text-gray-500 mt-1">Create test cases first to start testing</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Test Runner</h3>
        <Badge variant="default">{testCases.length} test cases</Badge>
      </div>

      {/* Model Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Model
        </label>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={isRunning}
        >
          <option value="llama3.2">Llama 3.2</option>
          <option value="llama3.1">Llama 3.1</option>
          <option value="mistral">Mistral</option>
          <option value="codellama">CodeLlama</option>
        </select>
      </div>

      {/* Execution Mode Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Execution Mode
        </label>
        <div className="flex space-x-4">
          <label className="flex items-center">
            <input
              type="radio"
              name="executionMode"
              value="sequential"
              checked={executionMode === 'sequential'}
              onChange={(e) => setExecutionMode(e.target.value as 'sequential' | 'parallel')}
              disabled={isRunning}
              className="mr-2"
            />
            <span className="text-sm">Sequential</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="executionMode"
              value="parallel"
              checked={executionMode === 'parallel'}
              onChange={(e) => setExecutionMode(e.target.value as 'sequential' | 'parallel')}
              disabled={isRunning}
              className="mr-2"
            />
            <span className="text-sm">Parallel</span>
            <span className="ml-1 text-xs text-blue-600">⚡ Faster</span>
          </label>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {executionMode === 'sequential' 
            ? 'Run tests one at a time (traditional mode)'
            : 'Run multiple tests simultaneously with real-time progress tracking'
          }
        </p>
      </div>

      {/* Test Selection */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-gray-700">
            Select Tests to Run
          </label>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            disabled={isRunning}
          >
            {allSelected ? 'Deselect All' : 'Select All'}
          </Button>
        </div>

        <div className="space-y-2 max-h-48 overflow-y-auto">
          {testCases.map((testCase) => (
            <div key={testCase.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-md">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id={`test-${testCase.id}`}
                  checked={allSelected || selectedTests.includes(testCase.id)}
                  onChange={() => handleTestSelection(testCase.id)}
                  disabled={isRunning}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor={`test-${testCase.id}`} className="text-sm text-gray-900 cursor-pointer">
                  {testCase.name}
                </label>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRunSingleTest(testCase.id)}
                disabled={isRunning}
                className="text-xs"
              >
                Run Solo
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Run Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleRunTests}
          disabled={isRunning || (selectedTests.length === 0 && !allSelected)}
          loading={isRunning}
          className="px-6"
        >
          {isRunning ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              {executionMode === 'parallel' ? 'Starting Parallel Tests...' : 'Running Tests...'}
            </>
          ) : (
            <>
              {executionMode === 'parallel' ? '⚡ ' : ''}
              Run {allSelected ? 'All' : selectedTests.length} Test{(allSelected ? testCases.length : selectedTests.length) !== 1 ? 's' : ''}
              {executionMode === 'parallel' ? ' (Parallel)' : ''}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}