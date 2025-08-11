'use client';

import { useState } from 'react';
import React from 'react';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface SamplePrompt {
  title: string;
  description: string;
  prompt_template: string;
  variables: string[];
  category: string;
  tags: string[];
}

interface SamplePromptCardProps {
  prompt: SamplePrompt;
  onCreateFromSample: (title: string, includeTestCases: boolean) => Promise<void>;
}

export default function SamplePromptCard({ prompt, onCreateFromSample }: SamplePromptCardProps) {
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [complexity, setComplexity] = useState<{
    score: number;
    level: 'simple' | 'moderate' | 'complex' | 'advanced';
  } | null>(null);

  const handleCreatePrompt = async (includeTestCases: boolean = true) => {
    try {
      setLoading(true);
      await onCreateFromSample(prompt.title, includeTestCases);
    } catch (error) {
      console.error('Failed to create prompt from sample:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      creative: 'bg-purple-100 text-purple-800 border-purple-200',
      technical: 'bg-blue-100 text-blue-800 border-blue-200',
      analytics: 'bg-green-100 text-green-800 border-green-200',
      'problem-solving': 'bg-orange-100 text-orange-800 border-orange-200',
      development: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      business: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      education: 'bg-teal-100 text-teal-800 border-teal-200',
      marketing: 'bg-pink-100 text-pink-800 border-pink-200',
      legal: 'bg-gray-100 text-gray-800 border-gray-200',
      health: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      'project-management': 'bg-violet-100 text-violet-800 border-violet-200'
    };
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const truncateTemplate = (template: string, maxLength: number = 200) => {
    if (template.length <= maxLength) return template;
    return template.substring(0, maxLength) + '...';
  };

  const getComplexityColor = (level: string) => {
    const colors = {
      simple: 'bg-green-100 text-green-700 border-green-300',
      moderate: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      complex: 'bg-orange-100 text-orange-700 border-orange-300',
      advanced: 'bg-red-100 text-red-700 border-red-300'
    };
    return colors[level as keyof typeof colors] || 'bg-gray-100 text-gray-700 border-gray-300';
  };

  const fetchComplexity = async () => {
    try {
      const response = await fetch(`/api/sample-prompts/${encodeURIComponent(prompt.title)}/complexity`);
      if (response.ok) {
        const result = await response.json();
        setComplexity(result.data.complexity);
      }
    } catch (error) {
      console.error('Failed to fetch complexity:', error);
    }
  };

  // Fetch complexity when component mounts
  React.useEffect(() => {
    fetchComplexity();
  }, [prompt.title]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{prompt.title}</h3>
          <div className="flex items-center gap-2 mb-3">
            <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getCategoryColor(prompt.category)}`}>
              {prompt.category}
            </span>
            <span className="text-sm text-gray-500">
              {prompt.variables.length} variable{prompt.variables.length !== 1 ? 's' : ''}
            </span>
            {complexity && (
              <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getComplexityColor(complexity.level)}`}>
                {complexity.level} ({complexity.score})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-gray-600 text-sm mb-4 leading-relaxed">
        {prompt.description}
      </p>

      {/* Variables */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Variables:</h4>
        <div className="flex flex-wrap gap-1">
          {prompt.variables.slice(0, 6).map((variable) => (
            <span 
              key={variable}
              className="inline-flex items-center px-2 py-1 rounded text-xs font-mono bg-gray-100 text-gray-700"
            >
              {`{{${variable}}}`}
            </span>
          ))}
          {prompt.variables.length > 6 && (
            <span className="inline-flex items-center px-2 py-1 rounded text-xs text-gray-500">
              +{prompt.variables.length - 6} more
            </span>
          )}
        </div>
      </div>

      {/* Template Preview */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-gray-700">Template Preview:</h4>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded p-3">
          <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap leading-relaxed">
            {expanded ? prompt.prompt_template : truncateTemplate(prompt.prompt_template)}
          </pre>
        </div>
      </div>

      {/* Tags */}
      {prompt.tags && prompt.tags.length > 0 && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-1">
            {prompt.tags.map((tag) => (
              <span 
                key={tag}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-200"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="flex space-x-2">
          <Button
            size="sm"
            onClick={() => handleCreatePrompt(true)}
            disabled={loading}
            className="min-w-24"
          >
            {loading ? <LoadingSpinner size="sm" /> : 'Create with Tests'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleCreatePrompt(false)}
            disabled={loading}
          >
            Create Only
          </Button>
        </div>
        <div className="text-xs text-gray-500">
          Sample prompt
        </div>
      </div>
    </div>
  );
}