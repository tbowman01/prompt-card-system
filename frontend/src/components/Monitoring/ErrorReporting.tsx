'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useWebSocket } from '@/hooks/useWebSocket';
import { api } from '@/lib/api';
import {
  AlertTriangle,
  XCircle,
  Clock,
  RefreshCw,
  Filter,
  Search,
  Download,
  TrendingUp,
  TrendingDown,
  Activity,
  Bug,
  Code,
  Server,
  Database,
  Network,
  GitCommit,
  Calendar,
  Timer,
  Users,
  BarChart3,
  PieChart,
  Eye,
  ExternalLink,
  CheckCircle
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell
} from 'recharts';

export interface ErrorReport {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'build' | 'test' | 'deployment' | 'infrastructure' | 'security';
  environment: 'staging' | 'production' | 'development';
  status: 'open' | 'investigating' | 'resolved' | 'wontfix';
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  assignedTo?: string;
  affectedComponents: string[];
  pipeline?: {
    id: string;
    name: string;
    job: string;
    commit: string;
    branch: string;
  };
  stackTrace?: string;
  logs?: string[];
  relatedIssues?: string[];
  impactMetrics?: {
    affectedUsers: number;
    downtime: number;
    buildsFailed: number;
  };
}

export interface ErrorTrend {
  date: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  resolved: number;
}

export interface ErrorMetrics {
  totalErrors: number;
  openErrors: number;
  resolvedErrors: number;
  criticalErrors: number;
  averageResolutionTime: number;
  errorRate: number;
  mttr: number; // Mean Time To Resolution
  categoryBreakdown: Record<string, number>;
  severityBreakdown: Record<string, number>;
  topComponents: Array<{ name: string; errors: number }>;
}

const SEVERITY_COLORS = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#F59E0B',
  low: '#10B981'
};

const CATEGORY_COLORS = {
  build: '#3B82F6',
  test: '#8B5CF6',
  deployment: '#EC4899',
  infrastructure: '#06B6D4',
  security: '#EF4444'
};

const ErrorReporting: React.FC = () => {
  const [errors, setErrors] = useState<ErrorReport[]>([]);
  const [metrics, setMetrics] = useState<ErrorMetrics | null>(null);
  const [trendData, setTrendData] = useState<ErrorTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedError, setSelectedError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    severity: 'all',
    category: 'all',
    status: 'all',
    environment: 'all'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  const { socket, isConnected } = useWebSocket();

  const fetchErrorData = useCallback(async () => {
    try {
      setError(null);
      const [errorsResponse, metricsResponse, trendsResponse] = await Promise.all([
        api.get('/errors/reports', { params: { ...filters, search: searchTerm, limit: 50 } }),
        api.get('/errors/metrics'),
        api.get(`/errors/trends?range=${timeRange}`)
      ]);

      setErrors(errorsResponse.data || generateMockErrorData());
      setMetrics(metricsResponse.data || generateMockMetrics());
      setTrendData(trendsResponse.data || generateMockTrendData());
    } catch (err) {
      console.error('Error fetching error data:', err);
      setError('Failed to load error data');
      // Use mock data as fallback
      setErrors(generateMockErrorData());
      setMetrics(generateMockMetrics());
      setTrendData(generateMockTrendData());
    } finally {
      setLoading(false);
    }
  }, [filters, searchTerm, timeRange]);

  useEffect(() => {
    fetchErrorData();
  }, [fetchErrorData]);

  useEffect(() => {
    if (socket && isConnected) {
      // Real-time error updates
      socket.on('new-error', (newError: ErrorReport) => {
        setErrors(prev => [newError, ...prev]);
      });

      socket.on('error-resolved', (errorId: string) => {
        setErrors(prev => prev.map(err => 
          err.id === errorId ? { ...err, status: 'resolved', resolvedAt: new Date().toISOString() } : err
        ));
      });

      return () => {
        socket.off('new-error');
        socket.off('error-resolved');
      };
    }
  }, [socket, isConnected]);

  const generateMockErrorData = (): ErrorReport[] => [
    {
      id: 'err-1',
      title: 'Build Failed: TypeScript Compilation Error',
      description: 'Property \'user\' does not exist on type \'Request\'',
      severity: 'high',
      category: 'build',
      environment: 'staging',
      status: 'open',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      assignedTo: 'alice',
      affectedComponents: ['backend/src/middleware/auth.ts', 'backend/src/routes/users.ts'],
      pipeline: {
        id: 'pipeline-123',
        name: 'CI Pipeline',
        job: 'test-backend',
        commit: 'a1b2c3d',
        branch: 'feature/user-auth'
      },
      stackTrace: 'TypeError: Property \'user\' does not exist on type \'Request\'\n  at auth.ts:45:12\n  at users.ts:23:8',
      impactMetrics: {
        affectedUsers: 0,
        downtime: 0,
        buildsFailed: 3
      }
    },
    {
      id: 'err-2',
      title: 'Deployment Failed: Container Health Check Timeout',
      description: 'Health check failed for backend container after 300s timeout',
      severity: 'critical',
      category: 'deployment',
      environment: 'production',
      status: 'investigating',
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      assignedTo: 'bob',
      affectedComponents: ['backend', 'load-balancer'],
      pipeline: {
        id: 'pipeline-124',
        name: 'Production Deploy',
        job: 'deploy-production',
        commit: 'x9y8z7w',
        branch: 'main'
      },
      impactMetrics: {
        affectedUsers: 1250,
        downtime: 15 * 60 * 1000, // 15 minutes
        buildsFailed: 1
      }
    },
    {
      id: 'err-3',
      title: 'Test Suite Timeout: Integration Tests',
      description: 'Integration tests exceeded 10 minute timeout limit',
      severity: 'medium',
      category: 'test',
      environment: 'staging',
      status: 'resolved',
      createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
      resolvedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      resolvedBy: 'charlie',
      affectedComponents: ['integration-tests'],
      pipeline: {
        id: 'pipeline-125',
        name: 'CI Pipeline',
        job: 'test-integration',
        commit: 'p1q2r3s',
        branch: 'develop'
      },
      impactMetrics: {
        affectedUsers: 0,
        downtime: 0,
        buildsFailed: 2
      }
    }
  ];

  const generateMockMetrics = (): ErrorMetrics => ({
    totalErrors: 47,
    openErrors: 12,
    resolvedErrors: 35,
    criticalErrors: 3,
    averageResolutionTime: 4.5 * 60 * 60 * 1000, // 4.5 hours
    errorRate: 8.3, // errors per day
    mttr: 3.2 * 60 * 60 * 1000, // 3.2 hours
    categoryBreakdown: {
      build: 18,
      test: 12,
      deployment: 8,
      infrastructure: 6,
      security: 3
    },
    severityBreakdown: {
      critical: 3,
      high: 8,
      medium: 15,
      low: 21
    },
    topComponents: [
      { name: 'backend/auth', errors: 8 },
      { name: 'frontend/dashboard', errors: 6 },
      { name: 'database/migrations', errors: 5 },
      { name: 'ci/docker', errors: 4 },
      { name: 'deployment/k8s', errors: 3 }
    ]
  });

  const generateMockTrendData = (): ErrorTrend[] => {
    const days = parseInt(timeRange.replace('d', ''));
    return Array.from({ length: days }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - days + i + 1);
      
      return {
        date: date.toISOString().split('T')[0],
        critical: Math.floor(Math.random() * 3),
        high: Math.floor(Math.random() * 5) + 1,
        medium: Math.floor(Math.random() * 8) + 2,
        low: Math.floor(Math.random() * 10) + 3,
        resolved: Math.floor(Math.random() * 12) + 5
      };
    });
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'medium':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'low':
        return <Activity className="h-4 w-4 text-blue-500" />;
      default:
        return <Bug className="h-4 w-4 text-gray-500" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'build':
        return <Code className="h-4 w-4" />;
      case 'test':
        return <Bug className="h-4 w-4" />;
      case 'deployment':
        return <Server className="h-4 w-4" />;
      case 'infrastructure':
        return <Network className="h-4 w-4" />;
      case 'security':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 text-red-800';
      case 'investigating':
        return 'bg-yellow-100 text-yellow-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'wontfix':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const formatDuration = (ms: number) => {
    if (!ms) return 'N/A';
    
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const filteredErrors = errors.filter(error => {
    const matchesSeverity = filters.severity === 'all' || error.severity === filters.severity;
    const matchesCategory = filters.category === 'all' || error.category === filters.category;
    const matchesStatus = filters.status === 'all' || error.status === filters.status;
    const matchesEnvironment = filters.environment === 'all' || error.environment === filters.environment;
    const matchesSearch = !searchTerm || 
      error.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      error.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      error.affectedComponents.some(comp => comp.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesSeverity && matchesCategory && matchesStatus && matchesEnvironment && matchesSearch;
  });

  const selectedErrorData = selectedError ? errors.find(e => e.id === selectedError) : null;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-lg">Loading error reports...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center text-red-800">
            <AlertTriangle className="h-5 w-5 mr-2" />
            Error Reporting System Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-700 mb-4">{error}</p>
          <Button onClick={fetchErrorData} variant="outline" className="w-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (selectedErrorData) {
    return (
      <div className="space-y-6">
        {/* Error Detail Header */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => setSelectedError(null)}>
            ← Back to Errors
          </Button>
          <div className="flex items-center space-x-2">
            <Badge className={getStatusColor(selectedErrorData.status)}>
              {selectedErrorData.status.toUpperCase()}
            </Badge>
            <Badge variant="outline">
              {selectedErrorData.severity.toUpperCase()}
            </Badge>
          </div>
        </div>

        {/* Error Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              {getSeverityIcon(selectedErrorData.severity)}
              <span className="ml-2">{selectedErrorData.title}</span>
            </CardTitle>
            <CardDescription>{selectedErrorData.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Error Information</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Category:</span>
                    <span className="flex items-center">
                      {getCategoryIcon(selectedErrorData.category)}
                      <span className="ml-1 capitalize">{selectedErrorData.category}</span>
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Environment:</span>
                    <span className="capitalize">{selectedErrorData.environment}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Created:</span>
                    <span>{new Date(selectedErrorData.createdAt).toLocaleString()}</span>
                  </div>
                  {selectedErrorData.resolvedAt && (
                    <div className="flex justify-between">
                      <span>Resolved:</span>
                      <span>{new Date(selectedErrorData.resolvedAt).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Assignment & Pipeline</h4>
                <div className="space-y-2 text-sm">
                  {selectedErrorData.assignedTo && (
                    <div className="flex justify-between">
                      <span>Assigned to:</span>
                      <span>{selectedErrorData.assignedTo}</span>
                    </div>
                  )}
                  {selectedErrorData.pipeline && (
                    <>
                      <div className="flex justify-between">
                        <span>Pipeline:</span>
                        <span>{selectedErrorData.pipeline.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Job:</span>
                        <span>{selectedErrorData.pipeline.job}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Branch:</span>
                        <span>{selectedErrorData.pipeline.branch}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Commit:</span>
                        <span className="flex items-center">
                          <GitCommit className="h-3 w-3 mr-1" />
                          {selectedErrorData.pipeline.commit}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Affected Components */}
            <div>
              <h4 className="font-medium mb-2">Affected Components</h4>
              <div className="flex flex-wrap gap-2">
                {selectedErrorData.affectedComponents.map((component, index) => (
                  <Badge key={index} variant="outline">{component}</Badge>
                ))}
              </div>
            </div>

            {/* Impact Metrics */}
            {selectedErrorData.impactMetrics && (
              <div>
                <h4 className="font-medium mb-2">Impact Metrics</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-3 border rounded">
                    <div className="text-2xl font-bold text-orange-600">
                      {selectedErrorData.impactMetrics.affectedUsers.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Affected Users</div>
                  </div>
                  <div className="text-center p-3 border rounded">
                    <div className="text-2xl font-bold text-red-600">
                      {formatDuration(selectedErrorData.impactMetrics.downtime)}
                    </div>
                    <div className="text-sm text-gray-600">Downtime</div>
                  </div>
                  <div className="text-center p-3 border rounded">
                    <div className="text-2xl font-bold text-blue-600">
                      {selectedErrorData.impactMetrics.buildsFailed}
                    </div>
                    <div className="text-sm text-gray-600">Failed Builds</div>
                  </div>
                </div>
              </div>
            )}

            {/* Stack Trace */}
            {selectedErrorData.stackTrace && (
              <div>
                <h4 className="font-medium mb-2">Stack Trace</h4>
                <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
                  {selectedErrorData.stackTrace}
                </pre>
              </div>
            )}

            {/* Logs */}
            {selectedErrorData.logs && selectedErrorData.logs.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Recent Logs</h4>
                <div className="bg-black text-green-400 p-3 rounded text-sm font-mono overflow-x-auto max-h-64 overflow-y-auto">
                  {selectedErrorData.logs.map((log, index) => (
                    <div key={index}>{log}</div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Error Reporting & Diagnostics</h2>
        
        <div className="flex items-center space-x-4">
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>

          <Button variant="outline" size="sm" onClick={fetchErrorData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Metrics Overview */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
              <Bug className="h-4 w-4 text-gray-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalErrors}</div>
              <p className="text-xs text-muted-foreground">
                {metrics.openErrors} open, {metrics.resolvedErrors} resolved
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Critical Errors</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{metrics.criticalErrors}</div>
              <p className="text-xs text-muted-foreground">Require immediate attention</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">MTTR</CardTitle>
              <Timer className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{formatDuration(metrics.mttr)}</div>
              <p className="text-xs text-muted-foreground">Mean time to resolution</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
              <BarChart3 className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{metrics.errorRate.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground">Errors per day</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Trends and Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Error Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="critical" stroke={SEVERITY_COLORS.critical} strokeWidth={2} />
                <Line type="monotone" dataKey="high" stroke={SEVERITY_COLORS.high} strokeWidth={2} />
                <Line type="monotone" dataKey="medium" stroke={SEVERITY_COLORS.medium} strokeWidth={2} />
                <Line type="monotone" dataKey="resolved" stroke="#10B981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {metrics && (
          <Card>
            <CardHeader>
              <CardTitle>Error Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={Object.entries(metrics.categoryBreakdown).map(([name, value]) => ({ name, value }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Filter & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search errors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm w-full"
              />
            </div>

            <select 
              value={filters.severity} 
              onChange={(e) => setFilters(prev => ({ ...prev, severity: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select 
              value={filters.category} 
              onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="all">All Categories</option>
              <option value="build">Build</option>
              <option value="test">Test</option>
              <option value="deployment">Deployment</option>
              <option value="infrastructure">Infrastructure</option>
              <option value="security">Security</option>
            </select>

            <select 
              value={filters.status} 
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
              <option value="wontfix">Won't Fix</option>
            </select>

            <select 
              value={filters.environment} 
              onChange={(e) => setFilters(prev => ({ ...prev, environment: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="all">All Environments</option>
              <option value="production">Production</option>
              <option value="staging">Staging</option>
              <option value="development">Development</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Error List */}
      <Card>
        <CardHeader>
          <CardTitle>Error Reports ({filteredErrors.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredErrors.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="text-gray-500">No errors found for the selected filters</p>
              </div>
            ) : (
              filteredErrors.map((error) => (
                <div 
                  key={error.id} 
                  className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedError(error.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      {getSeverityIcon(error.severity)}
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 hover:text-blue-600">
                          {error.title}
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">{error.description}</p>
                        
                        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                          <span className="flex items-center">
                            {getCategoryIcon(error.category)}
                            <span className="ml-1 capitalize">{error.category}</span>
                          </span>
                          <span className="capitalize">{error.environment}</span>
                          <span>{new Date(error.createdAt).toLocaleDateString()}</span>
                          {error.assignedTo && (
                            <span className="flex items-center">
                              <Users className="h-3 w-3 mr-1" />
                              {error.assignedTo}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-1 mt-2">
                          {error.affectedComponents.slice(0, 3).map((component, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {component}
                            </Badge>
                          ))}
                          {error.affectedComponents.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{error.affectedComponents.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <Badge className={getStatusColor(error.status)} variant="outline">
                        {error.status}
                      </Badge>
                      <Eye className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ErrorReporting;