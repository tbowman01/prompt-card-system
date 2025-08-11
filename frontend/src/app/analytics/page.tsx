'use client';

import React, { useState } from 'react';
import { MetricsOverview } from '@/components/Analytics/MetricsOverview';
import { PerformanceCharts } from '@/components/Analytics/PerformanceCharts';
import { CostTracker } from '@/components/Analytics/CostTracker';
import { RealTimeMonitor } from '@/components/Analytics/RealTimeMonitor';
import { Button } from '@/components/ui/Button';

type TabType = 'overview' | 'performance' | 'costs' | 'realtime';

interface Tab {
  id: TabType;
  name: string;
  icon: string;
  description: string;
}

const tabs: Tab[] = [
  {
    id: 'overview',
    name: 'Overview',
    icon: '📊',
    description: 'Key metrics and system insights'
  },
  {
    id: 'performance',
    name: 'Performance',
    icon: '⚡',
    description: 'Charts and trends analysis'
  },
  {
    id: 'costs',
    name: 'Costs',
    icon: '💰',
    description: 'Cost tracking and optimization'
  },
  {
    id: 'realtime',
    name: 'Real-time',
    icon: '🔴',
    description: 'Live monitoring and events'
  }
];

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <MetricsOverview />;
      case 'performance':
        return <PerformanceCharts />;
      case 'costs':
        return <CostTracker />;
      case 'realtime':
        return <RealTimeMonitor />;
      default:
        return <MetricsOverview />;
    }
  };

  const getTabDescription = () => {
    return tabs.find(tab => tab.id === activeTab)?.description || '';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Monitor test execution performance, costs, and system insights
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-sm font-medium text-gray-700">System Operational</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
            >
              🔄 Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-0" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center space-x-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }
                `}
              >
                <span className="text-lg">{tab.icon}</span>
                <span>{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Tab Description */}
          <div className="mb-6">
            <p className="text-sm text-gray-600">{getTabDescription()}</p>
          </div>

          {/* Tab Content */}
          {renderTabContent()}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => window.open('/prompt-cards', '_blank')}
          >
            <span className="mr-2">🧪</span>
            Run Tests
          </Button>
          
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => {
              // Export analytics data
              const data = {
                exported_at: new Date().toISOString(),
                tab: activeTab,
                note: 'Analytics data export'
              };
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `analytics-${activeTab}-${new Date().toISOString().split('T')[0]}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <span className="mr-2">📥</span>
            Export Data
          </Button>
          
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => window.open('/prompt-cards/new', '_blank')}
          >
            <span className="mr-2">➕</span>
            New Test
          </Button>
          
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => setActiveTab('realtime')}
          >
            <span className="mr-2">👁️</span>
            Monitor Live
          </Button>
        </div>
      </div>

      {/* Footer Info */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center space-x-4">
            <span>Analytics Engine: Active</span>
            <span>•</span>
            <span>Last Updated: {new Date().toLocaleString()}</span>
          </div>
          <div className="flex items-center space-x-4">
            <span>Data Retention: 90 days</span>
            <span>•</span>
            <span>Refresh Rate: 30s</span>
          </div>
        </div>
      </div>
    </div>
  );
}