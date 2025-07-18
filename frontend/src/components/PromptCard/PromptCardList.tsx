'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PromptCard } from '@/types';
import { SearchInput } from '@/components/ui/SearchInput';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Badge } from '@/components/ui/Badge';

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface PromptCardListResponse {
  success: boolean;
  data: PromptCard[];
  pagination: PaginationInfo;
  error?: string;
}

export default function PromptCardList() {
  const [cards, setCards] = useState<PromptCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });

  const fetchCards = async (page: number = 1, search: string = '') => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10'
      });
      
      if (search.trim()) {
        params.append('search', search.trim());
      }

      const response = await fetch(`/api/prompt-cards?${params}`);
      const result: PromptCardListResponse = await response.json();

      if (result.success) {
        setCards(result.data);
        setPagination(result.pagination);
        setError(null);
      } else {
        setError(result.error || 'Failed to fetch prompt cards');
      }
    } catch (err) {
      setError('Network error: Failed to fetch prompt cards');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    fetchCards(1, term);
  };

  const handlePageChange = (newPage: number) => {
    fetchCards(newPage, searchTerm);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this prompt card?')) {
      return;
    }

    try {
      const response = await fetch(`/api/prompt-cards/${id}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Refresh the list
        fetchCards(pagination.page, searchTerm);
      } else {
        setError(result.error || 'Failed to delete prompt card');
      }
    } catch (err) {
      setError('Network error: Failed to delete prompt card');
    }
  };

  useEffect(() => {
    fetchCards();
  }, []);

  if (loading && cards.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Prompt Cards</h1>
          <p className="text-gray-600 mt-2">
            Manage your prompt templates and test cases
          </p>
        </div>
        <Link href="/prompt-cards/new">
          <Button>Create New Card</Button>
        </Link>
      </div>

      {/* Search */}
      <div className="flex justify-between items-center">
        <SearchInput
          placeholder="Search prompt cards..."
          value={searchTerm}
          onChange={handleSearch}
          className="max-w-md"
        />
        <div className="text-sm text-gray-500">
          {pagination.total} cards total
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Cards Grid */}
      {cards.length === 0 && !loading ? (
        <div className="text-center py-12">
          <div className="text-gray-500 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No prompt cards found</h3>
          <p className="text-gray-500 mb-4">
            {searchTerm ? 'No cards match your search criteria.' : 'Get started by creating your first prompt card.'}
          </p>
          <Link href="/prompt-cards/new">
            <Button>Create Your First Card</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <div key={card.id} className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">
                    {card.title}
                  </h3>
                  <div className="flex space-x-1">
                    <Link href={`/prompt-cards/${card.id}`}>
                      <Button variant="outline" size="sm">Edit</Button>
                    </Link>
                    <Link href={`/prompt-cards/${card.id}/test`}>
                      <Button variant="outline" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50">
                        Run Tests
                      </Button>
                    </Link>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleDelete(card.id)}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                
                {card.description && (
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                    {card.description}
                  </p>
                )}
                
                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-1">Prompt Template:</p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded p-2 font-mono line-clamp-3">
                    {card.prompt_template}
                  </p>
                </div>
                
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center space-x-4">
                    <Badge variant="outline">
                      {card.test_case_count || 0} tests
                    </Badge>
                    {card.variables.length > 0 && (
                      <Badge variant="outline">
                        {card.variables.length} variables
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs">
                    {new Date(card.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center items-center space-x-4 mt-8">
          <Button
            variant="outline"
            disabled={!pagination.hasPrev || loading}
            onClick={() => handlePageChange(pagination.page - 1)}
          >
            Previous
          </Button>
          
          <div className="flex items-center space-x-2">
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              const page = i + 1;
              const isActive = page === pagination.page;
              return (
                <Button
                  key={page}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  disabled={loading}
                  onClick={() => handlePageChange(page)}
                >
                  {page}
                </Button>
              );
            })}
          </div>
          
          <Button
            variant="outline"
            disabled={!pagination.hasNext || loading}
            onClick={() => handlePageChange(pagination.page + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {loading && cards.length > 0 && (
        <div className="flex justify-center mt-4">
          <LoadingSpinner size="sm" />
        </div>
      )}
    </div>
  );
}