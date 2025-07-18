'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PromptCard, CreatePromptCardRequest, TestCase } from '@/types';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import TestCaseEditor from '@/components/TestCase/TestCaseEditor';

interface PromptCardFormProps {
  cardId?: number;
  initialData?: PromptCard;
}

export default function PromptCardForm({ cardId, initialData }: PromptCardFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreatePromptCardRequest>({
    title: '',
    description: '',
    prompt_template: '',
    variables: []
  });
  const [testCases, setTestCases] = useState<TestCase[]>([]);

  // Extract variables from prompt template
  const extractVariables = (template: string): string[] => {
    const matches = template.match(/\{\{(\w+)\}\}/g) || [];
    return [...new Set(matches.map(match => match.replace(/\{\{|\}\}/g, '')))];
  };

  // Update variables when prompt template changes
  const handleTemplateChange = (template: string) => {
    const variables = extractVariables(template);
    setFormData(prev => ({
      ...prev,
      prompt_template: template,
      variables
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.prompt_template.trim()) {
      setError('Title and prompt template are required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const url = cardId ? `/api/prompt-cards/${cardId}` : '/api/prompt-cards';
      const method = cardId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (result.success) {
        router.push('/prompt-cards');
      } else {
        setError(result.error || 'Failed to save prompt card');
      }
    } catch (err) {
      setError('Network error: Failed to save prompt card');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.push('/prompt-cards');
  };

  // Load existing data if editing
  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title,
        description: initialData.description || '',
        prompt_template: initialData.prompt_template,
        variables: initialData.variables || []
      });
      setTestCases(initialData.test_cases || []);
    } else if (cardId) {
      // Fetch card data
      const fetchCard = async () => {
        try {
          setLoading(true);
          const response = await fetch(`/api/prompt-cards/${cardId}`);
          const result = await response.json();

          if (result.success) {
            const card = result.data;
            setFormData({
              title: card.title,
              description: card.description || '',
              prompt_template: card.prompt_template,
              variables: card.variables || []
            });
            setTestCases(card.test_cases || []);
          } else {
            setError(result.error || 'Failed to load prompt card');
          }
        } catch (err) {
          setError('Network error: Failed to load prompt card');
        } finally {
          setLoading(false);
        }
      };

      fetchCard();
    }
  }, [cardId, initialData]);

  if (loading && !formData.title) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {cardId ? 'Edit Prompt Card' : 'Create New Prompt Card'}
        </h1>
        <p className="text-gray-600 mt-2">
          {cardId ? 'Update your prompt template and test cases' : 'Create a new prompt template with test cases'}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter a descriptive title for your prompt"
                required
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe what this prompt does and when to use it"
              />
            </div>
          </div>
        </div>

        {/* Prompt Template */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Prompt Template</h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="template" className="block text-sm font-medium text-gray-700 mb-1">
                Template *
              </label>
              <p className="text-sm text-gray-500 mb-2">
                Use <code className="bg-gray-100 px-1 rounded">{'{{variable_name}}'}</code> for variables that will be replaced during testing.
              </p>
              <textarea
                id="template"
                value={formData.prompt_template}
                onChange={(e) => handleTemplateChange(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="Enter your prompt template here. Use {{variable_name}} for dynamic content."
                required
              />
            </div>

            {formData.variables.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Detected Variables:</h3>
                <div className="flex flex-wrap gap-2">
                  {formData.variables.map((variable) => (
                    <span 
                      key={variable}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      {variable}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Test Cases */}
        {cardId && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Test Cases</h2>
            <TestCaseEditor 
              promptCardId={cardId}
              testCases={testCases}
              variables={formData.variables}
              onTestCasesChange={setTestCases}
            />
          </div>
        )}

        {/* Form Actions */}
        <div className="flex justify-between items-center pt-6 border-t border-gray-200">
          {/* Test Runner Button (only for existing cards with test cases) */}
          {cardId && testCases.length > 0 && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => router.push(`/prompt-cards/${cardId}/test`)}
              disabled={loading}
              className="text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              Run Tests ({testCases.length})
            </Button>
          )}
          
          {/* Main Form Actions */}
          <div className="flex space-x-4 ml-auto">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="min-w-24"
            >
              {loading ? <LoadingSpinner size="sm" /> : (cardId ? 'Update Card' : 'Create Card')}
            </Button>
          </div>
        </div>
      </form>

      {!cardId && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-blue-800 text-sm">
            <strong>Tip:</strong> After creating the prompt card, you'll be able to add test cases to validate your prompt's behavior.
          </p>
        </div>
      )}
    </div>
  );
}