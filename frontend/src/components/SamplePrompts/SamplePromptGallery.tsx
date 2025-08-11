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
  const [sortBy, setSortBy] = useState<'title' | 'category' | 'variables'>('title');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  useEffect(() => {
    fetchSamples();
    fetchStats();
  }, []);

  const fetchSamples = async (category?: string, search?: string) => {
    try {
      setLoading(true);
      setError(null);
      
      let url = '/api/sample-prompts';
      const params = new URLSearchParams();
      
      // Use search endpoint if there's a search term
      if (search && search.trim()) {
        url = '/api/sample-prompts/search';
        params.append('q', search.trim());
        if (category && category !== 'all') {
          params.append('categories', category);
        }
        params.append('maxResults', '50');
        params.append('fuzzyMatch', 'true');
      } else if (category && category !== 'all') {
        params.append('category', category);
      }
      
      if (params.toString()) {
        url += '?' + params.toString();
      }
      
      const response = await fetch(url);
      const result = await response.json();
      
      if (result.success) {
        let fetchedSamples = result.data;
        
        // Apply client-side sorting
        fetchedSamples.sort((a: SamplePrompt, b: SamplePrompt) => {
          let aValue: any, bValue: any;
          
          switch (sortBy) {
            case 'title':
              aValue = a.title.toLowerCase();
              bValue = b.title.toLowerCase();
              break;
            case 'category':
              aValue = a.category.toLowerCase();
              bValue = b.category.toLowerCase();
              break;
            case 'variables':
              aValue = a.variables.length;
              bValue = b.variables.length;
              break;
            default:
              aValue = a.title.toLowerCase();
              bValue = b.title.toLowerCase();
          }

          if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
          return 0;
        });
        
        setSamples(fetchedSamples);
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
    fetchSamples(category, searchTerm);
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    fetchSamples(selectedCategory, term);
  };

  const handleSortChange = (newSortBy: 'title' | 'category' | 'variables', newSortOrder: 'asc' | 'desc') => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    fetchSamples(selectedCategory, searchTerm);
  };

  const exportSamples = async (format: 'json' | 'yaml' | 'csv') => {
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') {
        params.append('category', selectedCategory);
      }
      params.append('includeStats', 'true');
      
      const url = `/api/sample-prompts/export/${format}?${params.toString()}`;
      const response = await fetch(url);
      
      if (response.ok) {
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `sample-prompts-${selectedCategory}-${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);
      } else {
        throw new Error('Export failed');
      }
    } catch (error) {
      setError('Failed to export samples: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
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
        await fetchSamples(selectedCategory, searchTerm);
      } else {
        setError(result.error || 'Failed to initialize sample prompts');
      }
    } catch (err) {
      setError('Network error: Failed to initialize sample prompts');
    } finally {
      setInitializing(false);
    }
  };

  // Samples are already filtered by the backend search, so no need for client-side filtering
  const filteredSamples = samples;

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
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            {/* Search */}
            <div className="w-full md:w-80">
              <input
                type="text"
                placeholder="Search prompts, descriptions, or tags..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                {showAdvancedFilters ? 'Hide Filters' : 'Show Filters'}
              </button>
              
              <div className="relative">
                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [newSortBy, newSortOrder] = e.target.value.split('-') as ['title' | 'category' | 'variables', 'asc' | 'desc'];
                    handleSortChange(newSortBy, newSortOrder);
                  }}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="title-asc">Title A-Z</option>
                  <option value="title-desc">Title Z-A</option>
                  <option value="category-asc">Category A-Z</option>
                  <option value="category-desc">Category Z-A</option>
                  <option value="variables-asc">Variables (Low)</option>
                  <option value="variables-desc">Variables (High)</option>
                </select>
              </div>

              {/* Export Dropdown */}
              <div className="relative">
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      exportSamples(e.target.value as 'json' | 'yaml' | 'csv');
                      e.target.value = '';
                    }
                  }}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-green-50 hover:bg-green-100"
                >
                  <option value="">Export...</option>
                  <option value="json">JSON</option>
                  <option value="yaml">YAML</option>
                  <option value="csv">CSV</option>
                </select>
              </div>
            </div>
          </div>

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <div className="p-4 bg-gray-50 rounded-md border">
              <div className="flex flex-col gap-4">
                <h4 className="text-sm font-medium text-gray-900">Filter by Category</h4>
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
              </div>
            </div>
          )}
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
        <div className="mt-8 space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-blue-800 text-sm">
              <strong>Tip:</strong> Each sample prompt comes with pre-configured test cases to help you validate your AI responses. 
              Click "Create with Tests" to get started immediately, or "Create Only" if you prefer to add your own test cases.
            </p>
          </div>
          
          {/* Results Summary */}
          <div className="flex items-center justify-between text-sm text-gray-600 border-t pt-4">
            <div>
              Showing {filteredSamples.length} of {stats?.totalSamples || 0} sample prompts
              {selectedCategory !== 'all' && ` in "${selectedCategory}" category`}
              {searchTerm && ` matching "${searchTerm}"`}
            </div>
            <div>
              Sorted by {sortBy} ({sortOrder === 'asc' ? 'ascending' : 'descending'})
            </div>
          </div>
        </div>
      )}
    </div>
  );
}