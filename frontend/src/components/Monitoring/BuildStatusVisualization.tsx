'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Progress } from '@/components/ui/progress';
import { useWebSocket } from '@/hooks/useWebSocket';
import { api } from '@/lib/api';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Calendar,
  GitBranch,
  Users,
  Target,
  Zap,
  BarChart3,
  Filter,
  Download
} from 'lucide-react';

export interface BuildMetrics {
  totalBuilds: number;
  successfulBuilds: number;
  failedBuilds: number;
  averageDuration: number;
  successRate: number;
  failureRate: number;
  buildTrend: 'up' | 'down' | 'stable';
  deploymentFrequency: number;
  meanTimeToRecovery: number;
  testCoverage: number;
}

export interface BuildHistoryData {
  date: string;
  successful: number;
  failed: number;
  cancelled: number;
  averageDuration: number;
  testCoverage: number;
  deployments: number;
}

export interface BranchMetrics {
  branch: string;
  totalBuilds: number;
  successRate: number;
  averageDuration: number;
  lastBuild: string;
  status: 'success' | 'failure' | 'running';
  contributors: number;
}

export interface BuildPerformance {
  jobName: string;
  averageDuration: number;
  successRate: number;
  failureRate: number;
  trend: 'improving' | 'degrading' | 'stable';
  lastRun: string;
}

export interface TestCoverageData {
  date: string;
  backend: number;
  frontend: number;
  integration: number;
  overall: number;
}

const COLORS = ['#10B981', '#EF4444', '#F59E0B', '#6B7280', '#3B82F6'];

const BuildStatusVisualization: React.FC = () => {
  const [metrics, setMetrics] = useState<BuildMetrics | null>(null);
  const [historyData, setHistoryData] = useState<BuildHistoryData[]>([]);
  const [branchMetrics, setBranchMetrics] = useState<BranchMetrics[]>([]);
  const [performanceData, setPerformanceData] = useState<BuildPerformance[]>([]);
  const [coverageData, setCoverageData] = useState<TestCoverageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [selectedView, setSelectedView] = useState<'overview' | 'history' | 'branches' | 'performance' | 'coverage'>('overview');

  const { socket, isConnected } = useWebSocket();

  const fetchBuildMetrics = useCallback(async () => {
    try {
      setError(null);
      const [
        metricsResponse,
        historyResponse,
        branchResponse,
        performanceResponse,
        coverageResponse
      ] = await Promise.all([
        api.get('/ci-cd/metrics'),
        api.get(`/ci-cd/history?range=${selectedTimeRange}`),
        api.get('/ci-cd/branches'),
        api.get('/ci-cd/performance'),
        api.get(`/ci-cd/coverage?range=${selectedTimeRange}`)
      ]);

      setMetrics(metricsResponse.data);
      setHistoryData(historyResponse.data || []);
      setBranchMetrics(branchResponse.data || []);
      setPerformanceData(performanceResponse.data || []);
      setCoverageData(coverageResponse.data || []);
    } catch (err) {
      console.error('Error fetching build metrics:', err);
      setError('Failed to load build metrics');
    } finally {
      setLoading(false);
    }
  }, [selectedTimeRange]);

  useEffect(() => {
    fetchBuildMetrics();
  }, [fetchBuildMetrics]);

  useEffect(() => {
    if (socket && isConnected) {
      socket.on('build-metrics-update', (update: Partial<BuildMetrics>) => {
        setMetrics(prev => prev ? { ...prev, ...update } : null);
      });

      return () => {
        socket.off('build-metrics-update');
      };
    }
  }, [socket, isConnected]);

  const formatDuration = (ms: number) => {
    if (!ms) return 'N/A';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down':
      case 'degrading':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const exportData = () => {
    const exportData = {
      metrics,
      historyData,
      branchMetrics,
      performanceData,
      coverageData,
      exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `build-metrics-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-lg">Loading build analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center text-red-800">
            <AlertTriangle className="h-5 w-5 mr-2" />
            Build Analytics Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-700 mb-4">{error}</p>
          <Button onClick={fetchBuildMetrics} variant="outline" className="w-full">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const pieChartData = metrics ? [
    { name: 'Successful', value: metrics.successfulBuilds, color: '#10B981' },
    { name: 'Failed', value: metrics.failedBuilds, color: '#EF4444' },
    { name: 'Cancelled', value: metrics.totalBuilds - metrics.successfulBuilds - metrics.failedBuilds, color: '#6B7280' }
  ] : [];

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Build Analytics & Trends</h2>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <select 
              value={selectedTimeRange} 
              onChange={(e) => setSelectedTimeRange(e.target.value as any)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </div>

          <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-md">
            {['overview', 'history', 'branches', 'performance', 'coverage'].map((view) => (
              <button
                key={view}
                onClick={() => setSelectedView(view as any)}
                className={`px-3 py-1 rounded text-sm font-medium capitalize transition-colors ${
                  selectedView === view 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {view}
              </button>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={exportData}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Overview View */}
      {selectedView === 'overview' && metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Key Metrics */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Builds</CardTitle>
              <Activity className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalBuilds}</div>
              <div className="flex items-center mt-2">
                {getTrendIcon(metrics.buildTrend)}
                <span className="text-xs text-muted-foreground ml-1">
                  {selectedTimeRange.replace('d', ' days')}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{metrics.successRate.toFixed(1)}%</div>
              <Progress value={metrics.successRate} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
              <Clock className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{formatDuration(metrics.averageDuration)}</div>
              <p className="text-xs text-muted-foreground mt-2">Per build</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Test Coverage</CardTitle>
              <Target className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{metrics.testCoverage.toFixed(1)}%</div>
              <Progress value={metrics.testCoverage} className="mt-2" />
            </CardContent>
          </Card>

          {/* Build Status Distribution */}
          <Card className="col-span-1 md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="h-5 w-5 mr-2" />
                Build Status Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Key Performance Indicators */}
          <Card className="col-span-1 md:col-span-2">
            <CardHeader>
              <CardTitle>Key Performance Indicators</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center">
                  <Zap className="h-4 w-4 mr-2 text-blue-500" />
                  Deployment Frequency
                </span>
                <Badge variant="outline">{metrics.deploymentFrequency} per day</Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="flex items-center">
                  <Clock className="h-4 w-4 mr-2 text-orange-500" />
                  Mean Time to Recovery
                </span>
                <Badge variant="outline">{formatDuration(metrics.meanTimeToRecovery)}</Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="flex items-center">
                  <XCircle className="h-4 w-4 mr-2 text-red-500" />
                  Failure Rate
                </span>
                <Badge variant="outline">{metrics.failureRate.toFixed(1)}%</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* History View */}
      {selectedView === 'history' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Build History Trends</CardTitle>
              <CardDescription>Build success/failure trends over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={historyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="successful" 
                    stackId="1" 
                    stroke="#10B981" 
                    fill="#10B981"
                    name="Successful"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="failed" 
                    stackId="1" 
                    stroke="#EF4444" 
                    fill="#EF4444"
                    name="Failed"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="cancelled" 
                    stackId="1" 
                    stroke="#6B7280" 
                    fill="#6B7280"
                    name="Cancelled"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Build Duration Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={historyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatDuration(value as number)} />
                    <Line 
                      type="monotone" 
                      dataKey="averageDuration" 
                      stroke="#F59E0B" 
                      strokeWidth={2}
                      name="Avg Duration"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Deployment Frequency</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={historyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="deployments" fill="#3B82F6" name="Deployments" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Branches View */}
      {selectedView === 'branches' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <GitBranch className="h-5 w-5 mr-2" />
              Branch Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {branchMetrics.map((branch) => (
                <div key={branch.branch} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <GitBranch className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">{branch.branch}</span>
                      {branch.status === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                      {branch.status === 'failure' && <XCircle className="h-4 w-4 text-red-500" />}
                      {branch.status === 'running' && <Activity className="h-4 w-4 text-blue-500 animate-pulse" />}
                    </div>
                    <div className="flex items-center space-x-4">
                      <Badge variant="outline">
                        {branch.successRate.toFixed(1)}% success
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {branch.totalBuilds} builds
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div className="text-center">
                      <div className="text-lg font-bold">{formatDuration(branch.averageDuration)}</div>
                      <div className="text-sm text-gray-600">Avg Duration</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-lg font-bold flex items-center justify-center">
                        <Users className="h-4 w-4 mr-1" />
                        {branch.contributors}
                      </div>
                      <div className="text-sm text-gray-600">Contributors</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-lg font-bold">{new Date(branch.lastBuild).toLocaleDateString()}</div>
                      <div className="text-sm text-gray-600">Last Build</div>
                    </div>
                  </div>

                  <Progress value={branch.successRate} className="mt-4" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance View */}
      {selectedView === 'performance' && (
        <Card>
          <CardHeader>
            <CardTitle>Job Performance Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {performanceData.map((job) => (
                <div key={job.jobName} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <span className="font-medium">{job.jobName}</span>
                      {getTrendIcon(job.trend)}
                    </div>
                    <div className="flex items-center space-x-4">
                      <Badge variant="outline">
                        {job.successRate.toFixed(1)}% success
                      </Badge>
                      <span className="text-sm text-gray-500">
                        Last: {new Date(job.lastRun).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <div className="text-lg font-bold">{formatDuration(job.averageDuration)}</div>
                      <div className="text-sm text-gray-600">Average Duration</div>
                    </div>
                    
                    <div>
                      <div className="text-lg font-bold text-green-600">{job.successRate.toFixed(1)}%</div>
                      <div className="text-sm text-gray-600">Success Rate</div>
                    </div>
                    
                    <div>
                      <div className="text-lg font-bold text-red-600">{job.failureRate.toFixed(1)}%</div>
                      <div className="text-sm text-gray-600">Failure Rate</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Coverage View */}
      {selectedView === 'coverage' && (
        <Card>
          <CardHeader>
            <CardTitle>Test Coverage Trends</CardTitle>
            <CardDescription>Test coverage across different components over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={coverageData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(value) => `${(value as number).toFixed(1)}%`} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="backend" 
                  stroke="#10B981" 
                  strokeWidth={2}
                  name="Backend"
                />
                <Line 
                  type="monotone" 
                  dataKey="frontend" 
                  stroke="#3B82F6" 
                  strokeWidth={2}
                  name="Frontend"
                />
                <Line 
                  type="monotone" 
                  dataKey="integration" 
                  stroke="#F59E0B" 
                  strokeWidth={2}
                  name="Integration"
                />
                <Line 
                  type="monotone" 
                  dataKey="overall" 
                  stroke="#8B5CF6" 
                  strokeWidth={3}
                  name="Overall"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BuildStatusVisualization;