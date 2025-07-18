'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import TestRunner from '@/components/TestExecution/TestRunner';
import TestResults from '@/components/TestExecution/TestResults';
import { PromptCard, TestExecution } from '@/types';
import { api } from '@/lib/api';

export default function TestExecutionPage() {
  const params = useParams();
  const router = useRouter();
  const promptCardId = parseInt(params?.id as string);

  const [promptCard, setPromptCard] = useState<PromptCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testExecution, setTestExecution] = useState<TestExecution | null>(null);

  useEffect(() => {
    if (!promptCardId || isNaN(promptCardId)) {
      setError('Invalid prompt card ID');
      setLoading(false);
      return;
    }

    fetchPromptCard();
  }, [promptCardId]);

  const fetchPromptCard = async () => {
    try {
      setLoading(true);
      const card = await api.getPromptCard(promptCardId);
      setPromptCard(card);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch prompt card');
    } finally {
      setLoading(false);
    }
  };

  const handleTestComplete = (execution: TestExecution) => {
    setTestExecution(execution);
  };

  const handleTestError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const handleClearResults = () => {
    setTestExecution(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center min-h-64">
            <LoadingSpinner />
          </div>
        </div>
      </div>
    );
  }

  if (error || !promptCard) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-md p-6 max-w-2xl mx-auto">
            <h1 className="text-lg font-semibold text-red-800 mb-2">Error</h1>
            <p className="text-red-700 mb-4">{error || 'Prompt card not found'}</p>
            <div className="flex space-x-3">
              <Button onClick={() => router.back()}>Go Back</Button>
              <Link href="/prompt-cards">
                <Button variant="outline">View All Cards</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Test Execution</h1>
              <p className="text-gray-600 mt-2">Run and analyze tests for your prompt card</p>
            </div>
            <div className="flex space-x-3">
              <Link href={`/prompt-cards/${promptCardId}`}>
                <Button variant="outline">Edit Card</Button>
              </Link>
              <Link href="/prompt-cards">
                <Button variant="outline">Back to Cards</Button>
              </Link>
            </div>
          </div>

          {/* Prompt Card Info */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">{promptCard.title}</h2>
                {promptCard.description && (
                  <p className="text-gray-600 mb-4">{promptCard.description}</p>
                )}
                <div className="bg-gray-50 rounded-md p-4">
                  <p className="text-sm text-gray-500 mb-2">Prompt Template:</p>
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                    {promptCard.prompt_template}
                  </pre>
                </div>
              </div>
            </div>
            
            {promptCard.variables.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-gray-500 mb-2">Variables:</p>
                <div className="flex flex-wrap gap-2">
                  {promptCard.variables.map((variable, index) => (
                    <span 
                      key={index}
                      className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm"
                    >
                      {variable}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setError(null)}
              className="mt-2"
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Test Runner */}
          <div>
            <TestRunner
              promptCardId={promptCardId}
              testCases={promptCard.test_cases || []}
              onTestComplete={handleTestComplete}
              onError={handleTestError}
            />
          </div>

          {/* Test Results */}
          <div>
            {testExecution ? (
              <TestResults 
                execution={testExecution} 
                onClear={handleClearResults}
              />
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
                <div className="text-gray-500 mb-4">
                  <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Test Results</h3>
                <p className="text-gray-600 mb-4">
                  Run tests to see results and analysis here
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Test Execution Tips</h3>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc list-inside space-y-1">
                  <li>Select specific test cases or run all tests for comprehensive validation</li>
                  <li>Choose the appropriate model for your use case (Llama, Mistral, etc.)</li>
                  <li>Review assertion results to understand why tests pass or fail</li>
                  <li>Use execution metadata to track performance and model behavior</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}