'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TestExecution, TestResult, AssertionResult } from '@/types';

interface TestResultsProps {
  execution: TestExecution;
  onClear?: () => void;
}

export default function TestResults({ execution, onClear }: TestResultsProps) {
  const [expandedResults, setExpandedResults] = useState<Set<number>>(new Set());

  const toggleExpanded = (testId: number) => {
    setExpandedResults(prev => {
      const newSet = new Set(prev);
      if (newSet.has(testId)) {
        newSet.delete(testId);
      } else {
        newSet.add(testId);
      }
      return newSet;
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'passed':
        return <Badge variant="success">Passed</Badge>;
      case 'failed':
        return <Badge variant="danger">Failed</Badge>;
      case 'error':
        return <Badge variant="warning">Error</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const getAssertionBadge = (passed: boolean) => {
    return passed 
      ? <Badge variant="success" size="sm">✓</Badge>
      : <Badge variant="danger" size="sm">✗</Badge>;
  };

  const formatExecutionTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Test Results</h3>
          <p className="text-sm text-gray-500">
            Executed at {new Date(execution.created_at).toLocaleString()}
          </p>
        </div>
        {onClear && (
          <Button variant="outline" size="sm" onClick={onClear}>
            Clear Results
          </Button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{execution.total_tests}</div>
          <div className="text-sm text-gray-500">Total Tests</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{execution.passed_tests}</div>
          <div className="text-sm text-gray-500">Passed</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">{execution.failed_tests}</div>
          <div className="text-sm text-gray-500">Failed</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-700">{formatExecutionTime(execution.execution_time_ms)}</div>
          <div className="text-sm text-gray-500">Duration</div>
        </div>
      </div>

      {/* Execution Info */}
      <div className="flex flex-wrap items-center gap-4 mb-6 p-3 bg-blue-50 rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Status:</span>
          {getStatusBadge(execution.status)}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Model:</span>
          <Badge variant="outline">{execution.model_used}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Execution ID:</span>
          <code className="text-xs bg-white px-2 py-1 rounded border">{execution.id}</code>
        </div>
      </div>

      {/* Error Message */}
      {execution.error_message && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-sm font-medium text-red-800 mb-1">Execution Error</div>
          <div className="text-sm text-red-700">{execution.error_message}</div>
        </div>
      )}

      {/* Individual Test Results */}
      <div className="space-y-4">
        <h4 className="text-md font-semibold text-gray-900">Individual Results</h4>
        
        {execution.test_results.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No test results available
          </div>
        ) : (
          execution.test_results.map((result) => (
            <div key={result.id} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Test Header */}
              <div 
                className="p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => toggleExpanded(result.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusBadge(result.status)}
                    <span className="font-medium text-gray-900">{result.test_case_name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500">
                      {formatExecutionTime(result.execution_time_ms)}
                    </span>
                    <Button variant="outline" size="sm">
                      {expandedResults.has(result.id) ? 'Collapse' : 'Expand'}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Expanded Content */}
              {expandedResults.has(result.id) && (
                <div className="p-4 border-t border-gray-200">
                  {/* Error Message */}
                  {result.error_message && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                      <div className="text-sm font-medium text-red-800 mb-1">Error</div>
                      <div className="text-sm text-red-700">{result.error_message}</div>
                    </div>
                  )}

                  {/* Assertions */}
                  {result.assertion_results.length > 0 && (
                    <div className="mb-4">
                      <div className="text-sm font-medium text-gray-700 mb-2">Assertions</div>
                      <div className="space-y-2">
                        {result.assertion_results.map((assertion, index) => (
                          <div key={index} className="flex items-start gap-3 p-2 bg-gray-50 rounded">
                            {getAssertionBadge(assertion.passed)}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm">
                                <span className="font-medium">{assertion.type}:</span> 
                                <span className="ml-1">Expected "{assertion.expected}", got "{assertion.actual}"</span>
                              </div>
                              {assertion.description && (
                                <div className="text-xs text-gray-500 mt-1">{assertion.description}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Output Comparison */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Expected Output */}
                    {result.expected_output && (
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-2">Expected Output</div>
                        <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                          <pre className="text-sm text-green-800 whitespace-pre-wrap">{result.expected_output}</pre>
                        </div>
                      </div>
                    )}

                    {/* Actual Output */}
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-2">Actual Output</div>
                      <div className={`p-3 border rounded-md ${
                        result.status === 'passed' 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-red-50 border-red-200'
                      }`}>
                        <pre className={`text-sm whitespace-pre-wrap ${
                          result.status === 'passed' ? 'text-green-800' : 'text-red-800'
                        }`}>
                          {result.actual_output}
                        </pre>
                      </div>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500">
                    <span>Test Case ID: {result.test_case_id}</span>
                    <span>Model: {result.model_used}</span>
                    <span>Execution Time: {formatExecutionTime(result.execution_time_ms)}</span>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}