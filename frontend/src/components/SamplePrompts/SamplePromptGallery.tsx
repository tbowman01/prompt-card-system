'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SamplePromptCard from './SamplePromptCard';
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

interface SamplePromptStats {
  totalSamples: number;
  categories: number;
  categoriesBreakdown: Array<{
    category: string;
    count: number;
  }>;
  averageVariables: number;
  totalVariables: number;
}

export default function SamplePromptGallery() {
  const router = useRouter();
  const [samples, setSamples] = useState<SamplePrompt[]>([]);
  const [stats, setStats] = useState<SamplePromptStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchSamples();
    fetchStats();
  }, []);

  const fetchSamples = async (category?: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const url = category && category !== 'all' 
        ? `/api/sample-prompts?category=${encodeURIComponent(category)}`
        : '/api/sample-prompts';
      
      const response = await fetch(url);
      const result = await response.json();
      
      if (result.success) {
        setSamples(result.data);
      } else {
        setError(result.error || 'Failed to fetch sample prompts');
      }
    } catch (err) {
      setError('Network error: Failed to fetch sample prompts');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/sample-prompts/stats');
      const result = await response.json();
      
      if (result.success) {
        setStats(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    fetchSamples(category);
  };

  const handleCreateFromSample = async (title: string, includeTestCases: boolean) => {
    try {
      const response = await fetch(`/api/sample-prompts/${encodeURIComponent(title)}/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ includeTestCases })
      });

      const result = await response.json();

      if (result.success) {
        // Navigate to the newly created prompt card
        router.push(`/prompt-cards/${result.data.id}`);
      } else {
        throw new Error(result.error || 'Failed to create prompt card');
      }
    } catch (error) {
      console.error('Failed to create prompt from sample:', error);
      setError(error instanceof Error ? error.message : 'Failed to create prompt card');
    }
  };

  const handleInitializeSamples = async () => {
    try {
      setInitializing(true);
      setError(null);

      const response = await fetch('/api/sample-prompts/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ includeTestCases: true })
      });

      const result = await response.json();

      if (result.success) {
        setStats(result.data.promptStats);
        await fetchSamples(selectedCategory);
      } else {
        setError(result.error || 'Failed to initialize sample prompts');
      }
    } catch (err) {
      setError('Network error: Failed to initialize sample prompts');
    } finally {
      setInitializing(false);
    }
  };

  const filteredSamples = samples.filter(sample => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      sample.title.toLowerCase().includes(searchLower) ||
      sample.description.toLowerCase().includes(searchLower) ||
      sample.tags.some(tag => tag.toLowerCase().includes(searchLower))
    );
  });

  const categories = stats?.categoriesBreakdown || [];
  const allCategories = [
    { category: 'all', count: stats?.totalSamples || 0 },
    ...categories
  ];

  if (loading && samples.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Sample Prompts</h1>
            <p className="text-gray-600 mt-2">
              Explore our collection of high-quality prompt templates for various use cases
            </p>
          </div>
          <Button
            onClick={handleInitializeSamples}
            disabled={initializing}
            variant="outline"
            className="min-w-32"
          >
            {initializing ? <LoadingSpinner size="sm" /> : 'Initialize Samples'}
          </Button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-900">{stats.totalSamples}</div>
              <div className="text-sm text-blue-700">Total Samples</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-900">{stats.categories}</div>
              <div className="text-sm text-green-700">Categories</div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-900">{stats.averageVariables}</div>
              <div className="text-sm text-purple-700">Avg Variables</div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-900">{stats.totalVariables}</div>
              <div className="text-sm text-orange-700">Total Variables</div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            {allCategories.map(({ category, count }) => (
              <button
                key={category}
                onClick={() => handleCategoryChange(category)}
                className={`px-3 py-2 text-sm font-medium rounded-md border transition-colors ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {category === 'all' ? 'All' : category} ({count})
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="w-full md:w-80">
            <input
              type="text"
              placeholder="Search prompts, descriptions, or tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Sample Cards */}
      {loading ? (
        <div className="flex justify-center items-center min-h-32">
          <LoadingSpinner />
        </div>
      ) : filteredSamples.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500 mb-4">
            {searchTerm ? 'No samples match your search criteria' : 'No sample prompts available'}
          </div>
          {!searchTerm && (
            <Button
              onClick={handleInitializeSamples}
              disabled={initializing}
            >
              {initializing ? 'Initializing...' : 'Initialize Sample Prompts'}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredSamples.map((sample) => (
            <SamplePromptCard
              key={sample.title}
              prompt={sample}
              onCreateFromSample={handleCreateFromSample}
            />
          ))}
        </div>
      )}

      {/* Footer Info */}
      {filteredSamples.length > 0 && (
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-blue-800 text-sm">
            <strong>Tip:</strong> Each sample prompt comes with pre-configured test cases to help you validate your AI responses. 
            Click "Create with Tests" to get started immediately, or "Create Only" if you prefer to add your own test cases.
          </p>
        </div>
      )}
    </div>
  );
}