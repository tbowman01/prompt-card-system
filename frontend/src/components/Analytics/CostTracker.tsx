'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { CostData } from '@/types';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface CostTrackerProps {
  timeframe?: '24h' | '7d' | '30d' | '90d';
}

export const CostTracker: React.FC<CostTrackerProps> = ({ timeframe = '24h' }) => {
  const [costData, setCostData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState(timeframe);

  useEffect(() => {
    const fetchCostData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Since we don't have a specific cost endpoint yet, we'll simulate cost data
        // In a real implementation, this would call api.getCostData(selectedTimeframe)
        const mockCostData: CostData = {
          totalCost: 24.67,
          costByModel: {
            'llama3.1:8b': 12.34,
            'llama3.1:70b': 8.45,
            'mistral:7b': 2.89,
            'codellama:7b': 0.99,
          },
          costOverTime: Array.from({ length: 30 }, (_, i) => ({
            timestamp: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000),
            cost: Math.random() * 5 + 0.5,
          })),
          tokenUsage: {
            totalTokens: 1234567,
            promptTokens: 567890,
            completionTokens: 666677,
          },
        };
        
        setCostData(mockCostData);
      } catch (err) {
        console.error('Error fetching cost data:', err);
        setError('Failed to load cost data');
      } finally {
        setLoading(false);
      }
    };

    fetchCostData();
  }, [selectedTimeframe]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  if (!costData) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-gray-600">No cost data available</p>
      </div>
    );
  }

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const getModelColor = (index: number): string => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-purple-500',
      'bg-red-500',
      'bg-indigo-500',
      'bg-pink-500',
      'bg-gray-500',
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="space-y-6">
      {/* Timeframe Controls */}
      <div className="flex gap-2">
        {(['24h', '7d', '30d', '90d'] as const).map((tf) => (
          <Button
            key={tf}
            variant={selectedTimeframe === tf ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setSelectedTimeframe(tf)}
          >
            {tf}
          </Button>
        ))}
      </div>

      {/* Cost Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Cost</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(costData.totalCost)}</p>
            </div>
            <div className="text-green-600">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Tokens</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(costData.tokenUsage.totalTokens)}</p>
            </div>
            <div className="text-blue-600">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Prompt Tokens</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(costData.tokenUsage.promptTokens)}</p>
            </div>
            <div className="text-purple-600">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completion Tokens</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(costData.tokenUsage.completionTokens)}</p>
            </div>
            <div className="text-yellow-600">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Cost by Model */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost by Model</h3>
        <div className="space-y-4">
          {Object.entries(costData.costByModel)
            .sort(([, a], [, b]) => b - a)
            .map(([model, cost], index) => {
              const percentage = (cost / costData.totalCost) * 100;
              return (
                <div key={model} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-4 h-4 rounded-full ${getModelColor(index)}`}></div>
                    <span className="font-medium text-gray-900">{model}</span>
                    <Badge variant="secondary">{percentage.toFixed(1)}%</Badge>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-gray-900">{formatCurrency(cost)}</span>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Cost Over Time Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost Over Time</h3>
        <div className="h-64 flex items-end space-x-1">
          {costData.costOverTime.map((point, index) => {
            const maxCost = Math.max(...costData.costOverTime.map(p => p.cost));
            const height = (point.cost / maxCost) * 100;
            
            return (
              <div
                key={index}
                className="flex-1 bg-blue-500 rounded-t-sm relative group"
                style={{ height: `${height}%` }}
              >
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity">
                  {formatCurrency(point.cost)}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex justify-between text-sm text-gray-500">
          <span>{costData.costOverTime.length} days ago</span>
          <span>Today</span>
        </div>
      </div>

      {/* Cost Analysis */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost Analysis</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Most Expensive Model</h4>
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <span className="text-red-800">
                {Object.entries(costData.costByModel).sort(([, a], [, b]) => b - a)[0][0]}
              </span>
              <span className="font-semibold text-red-900">
                {formatCurrency(Math.max(...Object.values(costData.costByModel)))}
              </span>
            </div>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 mb-2">Most Efficient Model</h4>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <span className="text-green-800">
                {Object.entries(costData.costByModel).sort(([, a], [, b]) => a - b)[0][0]}
              </span>
              <span className="font-semibold text-green-900">
                {formatCurrency(Math.min(...Object.values(costData.costByModel)))}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
          <h4 className="font-medium text-yellow-800 mb-2">Cost Optimization Tips</h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• Consider using smaller models for simple tasks</li>
            <li>• Implement caching for frequently used prompts</li>
            <li>• Monitor token usage to identify inefficient prompts</li>
            <li>• Use batch processing for multiple similar requests</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CostTracker;