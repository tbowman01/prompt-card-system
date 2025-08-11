'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../ui/card';
import { Tabs } from '../ui/tabs';
import { Badge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { SearchInput } from '../ui/SearchInput';
import {
  Shield,
  AlertTriangle,
  TrendingUp,
  Package,
  Clock,
  Filter,
  Download,
  Settings,
  RefreshCw,
  BarChart3,
  GitBranch,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  Users,
  Calendar
} from 'lucide-react';
import {
  DependencyInfo,
  VulnerabilityInfo,
  UpdateInfo,
  DashboardMetrics,
  DependencyFilter,
  SortOption,
  SeverityLevel,
  DependencyType,
  DependencyLocation
} from '../../types/dependency';

import DependencyOverview from './DependencyOverview';
import VulnerabilityTracker from './VulnerabilityTracker';
import UpdateManager from './UpdateManager';
import RiskAssessment from './RiskAssessment';
import ComplianceMonitor from './ComplianceMonitor';
import DependencyTree from './DependencyTree';

interface DependencyDashboardProps {
  className?: string;
}

const DependencyDashboard: React.FC<DependencyDashboardProps> = ({
  className = ''
}) => {
  const [dependencies, setDependencies] = useState<DependencyInfo[]>([]);
  const [vulnerabilities, setVulnerabilities] = useState<VulnerabilityInfo[]>([]);
  const [updates, setUpdates] = useState<UpdateInfo[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [filters, setFilters] = useState<DependencyFilter>({});
  const [sortOption, setSortOption] = useState<SortOption>({
    field: 'name',
    direction: 'asc'
  });
  const [refreshing, setRefreshing] = useState(false);

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [depsRes, vulnRes, updatesRes, metricsRes] = await Promise.all([
        fetch('/api/dependencies'),
        fetch('/api/dependencies/vulnerabilities'),
        fetch('/api/dependencies/updates'),
        fetch('/api/dependencies/metrics')
      ]);

      if (!depsRes.ok || !vulnRes.ok || !updatesRes.ok || !metricsRes.ok) {
        throw new Error('Failed to load dashboard data');
      }

      const [depsData, vulnData, updatesData, metricsData] = await Promise.all([
        depsRes.json(),
        vulnRes.json(),
        updatesRes.json(),
        metricsRes.json()
      ]);

      setDependencies(depsData.dependencies || []);
      setVulnerabilities(vulnData.vulnerabilities || []);
      setUpdates(updatesData.updates || []);
      setMetrics(metricsData);

    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh data
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadDashboardData();
    } finally {
      setRefreshing(false);
    }
  }, [loadDashboardData]);

  // Initialize dashboard
  useEffect(() => {
    loadDashboardData();
    
    // Set up auto-refresh every 5 minutes
    const interval = setInterval(loadDashboardData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadDashboardData]);

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: Partial<DependencyFilter>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  // Handle sort changes
  const handleSortChange = useCallback((field: string) => {
    setSortOption(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  // Get severity color
  const getSeverityColor = (severity: SeverityLevel): string => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'high': return 'text-red-500 bg-red-50';
      case 'moderate': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  // Get severity icon
  const getSeverityIcon = (severity: SeverityLevel) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'high': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'moderate': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'low': return <Info className="w-4 h-4 text-blue-600" />;
      default: return <Info className="w-4 h-4 text-gray-600" />;
    }
  };

  // Tab configuration
  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <BarChart3 className="w-4 h-4" />,
      count: metrics?.totalDependencies
    },
    {
      id: 'vulnerabilities',
      label: 'Vulnerabilities',
      icon: <Shield className="w-4 h-4" />,
      count: Object.values(metrics?.vulnerabilities || {}).reduce((a, b) => a + b, 0),
      severity: metrics && Object.values(metrics.vulnerabilities).reduce((a, b) => a + b, 0) > 0 ? 
        (metrics.vulnerabilities.critical > 0 ? 'critical' : 
         metrics.vulnerabilities.high > 0 ? 'high' : 
         metrics.vulnerabilities.moderate > 0 ? 'moderate' : 'low') : undefined
    },
    {
      id: 'updates',
      label: 'Updates',
      icon: <TrendingUp className="w-4 h-4" />,
      count: metrics?.pendingUpdates
    },
    {
      id: 'risk',
      label: 'Risk Assessment',
      icon: <AlertTriangle className="w-4 h-4" />,
      score: metrics?.riskScore
    },
    {
      id: 'compliance',
      label: 'Compliance',
      icon: <CheckCircle className="w-4 h-4" />,
      count: metrics?.licenseIssues
    },
    {
      id: 'tree',
      label: 'Dependency Tree',
      icon: <GitBranch className="w-4 h-4" />
    }
  ];

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner size="large" />
        <span className="ml-2 text-gray-600">Loading dependency dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6 border-red-200 bg-red-50">
        <div className="flex items-center space-x-2">
          <XCircle className="w-5 h-5 text-red-600" />
          <h3 className="text-lg font-semibold text-red-800">Error Loading Dashboard</h3>
        </div>
        <p className="mt-2 text-red-700">{error}</p>
        <button
          onClick={handleRefresh}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          disabled={refreshing}
        >
          {refreshing ? 'Retrying...' : 'Retry'}
        </button>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dependency Dashboard</h1>
          <p className="text-gray-600">
            Comprehensive dependency management and security monitoring
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
          <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Dependencies</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.totalDependencies}</p>
              </div>
              <Package className="w-8 h-8 text-blue-600" />
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Vulnerabilities</p>
                <p className="text-2xl font-bold text-red-600">
                  {Object.values(metrics.vulnerabilities).reduce((a, b) => a + b, 0)}
                </p>
              </div>
              <Shield className="w-8 h-8 text-red-600" />
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Outdated</p>
                <p className="text-2xl font-bold text-yellow-600">{metrics.outdatedDependencies}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Risk Score</p>
                <p className={`text-2xl font-bold ${
                  metrics.riskScore >= 80 ? 'text-red-600' : 
                  metrics.riskScore >= 60 ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  {metrics.riskScore}
                </p>
              </div>
              <AlertTriangle className={`w-8 h-8 ${
                metrics.riskScore >= 80 ? 'text-red-600' : 
                metrics.riskScore >= 60 ? 'text-yellow-600' : 'text-green-600'
              }`} />
            </div>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Card className="flex-1">
        <div className="border-b border-gray-200">
          <div className="flex items-center justify-between p-4">
            <div className="flex space-x-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-700 border border-blue-300'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <Badge 
                      variant={tab.severity ? 'destructive' : 'secondary'}
                      className={tab.severity ? getSeverityColor(tab.severity as SeverityLevel) : ''}
                    >
                      {tab.count}
                    </Badge>
                  )}
                  {tab.score !== undefined && (
                    <Badge 
                      variant={tab.score >= 80 ? 'destructive' : tab.score >= 60 ? 'warning' : 'success'}
                    >
                      {tab.score}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
            
            <div className="flex items-center space-x-2">
              <SearchInput
                placeholder="Search dependencies..."
                value={filters.searchTerm || ''}
                onChange={(value) => handleFilterChange({ searchTerm: value })}
                className="w-64"
              />
              <button className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Tab Content */}
          {activeTab === 'overview' && (
            <DependencyOverview 
              dependencies={dependencies}
              metrics={metrics}
              filters={filters}
              onFilterChange={handleFilterChange}
            />
          )}
          
          {activeTab === 'vulnerabilities' && (
            <VulnerabilityTracker 
              vulnerabilities={vulnerabilities}
              dependencies={dependencies}
              onRefresh={handleRefresh}
            />
          )}
          
          {activeTab === 'updates' && (
            <UpdateManager 
              updates={updates}
              dependencies={dependencies}
              onUpdateApproved={handleRefresh}
            />
          )}
          
          {activeTab === 'risk' && (
            <RiskAssessment 
              dependencies={dependencies}
              vulnerabilities={vulnerabilities}
              updates={updates}
            />
          )}
          
          {activeTab === 'compliance' && (
            <ComplianceMonitor 
              dependencies={dependencies}
              onComplianceCheck={handleRefresh}
            />
          )}
          
          {activeTab === 'tree' && (
            <DependencyTree 
              dependencies={dependencies}
              filters={filters}
            />
          )}
        </div>
      </Card>

      {/* Footer */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <div className="flex items-center space-x-4">
          <span>Last updated: {metrics?.lastScan ? new Date(metrics.lastScan).toLocaleString() : 'Never'}</span>
          <span>Next scan: {metrics?.nextScheduledScan ? new Date(metrics.nextScheduledScan).toLocaleString() : 'Not scheduled'}</span>
        </div>
        <div className="flex items-center space-x-2">
          <Calendar className="w-4 h-4" />
          <span>Auto-refresh: 5min</span>
        </div>
      </div>
    </div>
  );
};

export default DependencyDashboard;