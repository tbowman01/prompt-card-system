'use client';

import React, { useState, useEffect } from 'react';
import { Line, Bar, Doughnut, Scatter } from 'react-chartjs-2';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  Filter,
  BarChart3,
  PieChart,
  LineChart,
  Activity,
  DollarSign,
  Users,
  Server,
  Globe,
  Clock,
  Target,
  AlertTriangle,
  CheckCircle,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';

interface TimeSeriesData {
  date: string;
  cost: number;
  tokens: number;
  executions: number;
  unique_users: number;
  resource_utilization: number;
}

interface UsageAnalytics {
  period: { start: string; end: string };
  summary: {
    total_cost: number;
    total_tokens: number;
    total_executions: number;
    total_resources: number;
    unique_users: number;
    unique_workspaces: number;
  };
  daily_metrics: {
    average_cost_per_day: number;
    peak_usage_day: string;
    peak_usage_cost: number;
    cost_volatility: number;
  };
  trends: {
    cost_trend: TimeSeriesData[];
    growth_rate: {
      cost_growth_rate: number;
      usage_growth_rate: number;
      user_growth_rate: number;
    };
  };
  breakdowns: {
    by_model: Array<{ model: string; cost: number; percentage: number; efficiency_score: number }>;
    by_workspace: Array<{ workspace_id: string; workspace_name: string; cost: number; percentage: number }>;
    by_team: Array<{ team_id: string; team_name: string; cost: number; percentage: number }>;
    by_resource_type: Array<{ resource_type: string; cost: number; percentage: number; utilization: number }>;
    by_region: Array<{ region: string; cost: number; percentage: number }>;
  };
  efficiency_metrics: {
    cost_per_successful_execution: number;
    resource_utilization_rate: number;
    idle_resource_cost: number;
  };
}

interface CostForecast {
  predicted_cost: number;
  confidence_score: number;
  trend_analysis: {
    overall_trend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
    trend_strength: number;
  };
  scenario_analysis: {
    best_case: number;
    worst_case: number;
    most_likely: number;
  };
}

export const CostAnalytics: React.FC = () => {
  const [analytics, setAnalytics] = useState<UsageAnalytics | null>(null);
  const [forecast, setForecast] = useState<CostForecast | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState('30d');
  const [selectedView, setSelectedView] = useState<'overview' | 'trends' | 'breakdown' | 'forecast'>('overview');
  const [selectedBreakdown, setSelectedBreakdown] = useState<'model' | 'workspace' | 'team' | 'resource_type' | 'region'>('model');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
    fetchForecast();
  }, [selectedTimeRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      // Mock API call - replace with actual API
      const endDate = new Date();
      const startDate = new Date();
      
      switch (selectedTimeRange) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        default:
          startDate.setDate(endDate.getDate() - 30);
      }

      const mockAnalytics: UsageAnalytics = {
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        summary: {
          total_cost: 45672.89,
          total_tokens: 2847563,
          total_executions: 15847,
          total_resources: 234,
          unique_users: 89,
          unique_workspaces: 12
        },
        daily_metrics: {
          average_cost_per_day: 1522.43,
          peak_usage_day: '2024-01-15',
          peak_usage_cost: 2890.45,
          cost_volatility: 0.23
        },
        trends: {
          cost_trend: generateTrendData(parseInt(selectedTimeRange)),
          growth_rate: {
            cost_growth_rate: 12.5,
            usage_growth_rate: 18.3,
            user_growth_rate: 8.7
          }
        },
        breakdowns: {
          by_model: [
            { model: 'gpt-4', cost: 18234.56, percentage: 39.9, efficiency_score: 8.2 },
            { model: 'gpt-3.5-turbo', cost: 12456.78, percentage: 27.3, efficiency_score: 9.1 },
            { model: 'claude-3-sonnet', cost: 8765.43, percentage: 19.2, efficiency_score: 8.7 },
            { model: 'llama3', cost: 4321.09, percentage: 9.5, efficiency_score: 7.8 },
            { model: 'other', cost: 1895.03, percentage: 4.1, efficiency_score: 6.9 }
          ],
          by_workspace: [
            { workspace_id: 'eng', workspace_name: 'Engineering', cost: 22836.45, percentage: 50.0 },
            { workspace_id: 'ds', workspace_name: 'Data Science', cost: 13701.87, percentage: 30.0 },
            { workspace_id: 'product', workspace_name: 'Product', cost: 6850.93, percentage: 15.0 },
            { workspace_id: 'marketing', workspace_name: 'Marketing', cost: 2283.64, percentage: 5.0 }
          ],
          by_team: [
            { team_id: 'backend', team_name: 'Backend Team', cost: 15867.92, percentage: 34.7 },
            { team_id: 'frontend', team_name: 'Frontend Team', cost: 11403.51, percentage: 25.0 },
            { team_id: 'ml-ops', team_name: 'ML Operations', cost: 9134.58, percentage: 20.0 },
            { team_id: 'devops', team_name: 'DevOps', cost: 6850.93, percentage: 15.0 },
            { team_id: 'qa', team_name: 'Quality Assurance', cost: 2415.95, percentage: 5.3 }
          ],
          by_resource_type: [
            { resource_type: 'compute', cost: 22836.45, percentage: 50.0, utilization: 0.78 },
            { resource_type: 'storage', cost: 9134.58, percentage: 20.0, utilization: 0.65 },
            { resource_type: 'network', cost: 6850.93, percentage: 15.0, utilization: 0.89 },
            { resource_type: 'database', cost: 4567.29, percentage: 10.0, utilization: 0.82 },
            { resource_type: 'api', cost: 2283.64, percentage: 5.0, utilization: 0.91 }
          ],
          by_region: [
            { region: 'us-east-1', cost: 20052.60, percentage: 43.9 },
            { region: 'us-west-2', cost: 13701.87, percentage: 30.0 },
            { region: 'eu-west-1', cost: 7851.40, percentage: 17.2 },
            { region: 'ap-southeast-1', cost: 4067.02, percentage: 8.9 }
          ]
        },
        efficiency_metrics: {
          cost_per_successful_execution: 2.88,
          resource_utilization_rate: 0.76,
          idle_resource_cost: 4567.29
        }
      };

      setAnalytics(mockAnalytics);
    } catch (err) {
      setError('Failed to load analytics data');
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchForecast = async () => {
    try {
      const mockForecast: CostForecast = {
        predicted_cost: 52890.34,
        confidence_score: 87.5,
        trend_analysis: {
          overall_trend: 'increasing',
          trend_strength: 0.65
        },
        scenario_analysis: {
          best_case: 47601.31,
          worst_case: 58179.37,
          most_likely: 52890.34
        }
      };
      setForecast(mockForecast);
    } catch (err) {
      console.error('Error fetching forecast:', err);
    }
  };

  const generateTrendData = (days: number): TimeSeriesData[] => {
    const data: TimeSeriesData[] = [];
    const baseDate = new Date();
    
    for (let i = days; i >= 0; i--) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() - i);
      
      // Generate realistic cost data with some variance
      const baseCost = 1500;
      const variance = 300;
      const cost = baseCost + (Math.random() - 0.5) * variance;
      
      data.push({
        date: date.toISOString().split('T')[0],
        cost: cost + (Math.sin(i / 7) * 200), // Weekly pattern
        tokens: cost * 1200 + Math.random() * 10000,
        executions: Math.floor(cost / 3) + Math.random() * 100,
        unique_users: Math.floor(30 + Math.random() * 20),
        resource_utilization: 0.6 + Math.random() * 0.3
      });
    }
    
    return data;
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatPercentage = (num: number): string => {
    return `${num.toFixed(1)}%`;
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing': return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'decreasing': return <TrendingDown className="h-4 w-4 text-green-500" />;
      case 'stable': return <Minus className="h-4 w-4 text-blue-500" />;
      default: return <Activity className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getGrowthIcon = (rate: number) => {
    if (rate > 0) return <ArrowUp className="h-4 w-4 text-red-500" />;
    if (rate < 0) return <ArrowDown className="h-4 w-4 text-green-500" />;
    return <Minus className="h-4 w-4 text-blue-500" />;
  };

  const exportData = () => {
    // Implementation for data export
    const csvContent = analytics?.trends.cost_trend.map(item => 
      `${item.date},${item.cost},${item.tokens},${item.executions}`
    ).join('\n');
    
    const blob = new Blob([`Date,Cost,Tokens,Executions\n${csvContent}`], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cost-analytics.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
          <p className="text-red-800">Failed to load analytics data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Cost Analytics</h2>
          <p className="text-gray-600">Comprehensive cost analysis and insights</p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
          <button
            onClick={exportData}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* View Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'trends', label: 'Trends', icon: LineChart },
            { id: 'breakdown', label: 'Breakdown', icon: PieChart },
            { id: 'forecast', label: 'Forecast', icon: TrendingUp }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedView(tab.id as any)}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                selectedView === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4 mr-2" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {selectedView === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Cost</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(analytics.summary.total_cost)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-blue-500" />
              </div>
              <div className="mt-4 flex items-center">
                {getGrowthIcon(analytics.trends.growth_rate.cost_growth_rate)}
                <span className={`ml-1 text-sm font-medium ${
                  analytics.trends.growth_rate.cost_growth_rate > 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {Math.abs(analytics.trends.growth_rate.cost_growth_rate).toFixed(1)}%
                </span>
                <span className="text-sm text-gray-500 ml-2">vs previous period</span>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Executions</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatNumber(analytics.summary.total_executions)}
                  </p>
                </div>
                <Activity className="h-8 w-8 text-green-500" />
              </div>
              <div className="mt-4 flex items-center">
                {getGrowthIcon(analytics.trends.growth_rate.usage_growth_rate)}
                <span className={`ml-1 text-sm font-medium ${
                  analytics.trends.growth_rate.usage_growth_rate > 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {Math.abs(analytics.trends.growth_rate.usage_growth_rate).toFixed(1)}%
                </span>
                <span className="text-sm text-gray-500 ml-2">usage growth</span>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Users</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatNumber(analytics.summary.unique_users)}
                  </p>
                </div>
                <Users className="h-8 w-8 text-purple-500" />
              </div>
              <div className="mt-4 flex items-center">
                {getGrowthIcon(analytics.trends.growth_rate.user_growth_rate)}
                <span className={`ml-1 text-sm font-medium ${
                  analytics.trends.growth_rate.user_growth_rate > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {Math.abs(analytics.trends.growth_rate.user_growth_rate).toFixed(1)}%
                </span>
                <span className="text-sm text-gray-500 ml-2">user growth</span>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Efficiency Score</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatPercentage(analytics.efficiency_metrics.resource_utilization_rate * 100)}
                  </p>
                </div>
                <Target className="h-8 w-8 text-orange-500" />
              </div>
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-orange-500 h-2 rounded-full"
                    style={{ width: `${analytics.efficiency_metrics.resource_utilization_rate * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Cost Trend Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost Trends</h3>
            <div style={{ height: '300px' }}>
              <Line
                data={{
                  labels: analytics.trends.cost_trend.map(item => 
                    new Date(item.date).toLocaleDateString()
                  ),
                  datasets: [
                    {
                      label: 'Daily Cost',
                      data: analytics.trends.cost_trend.map(item => item.cost),
                      borderColor: '#3B82F6',
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      fill: true,
                      tension: 0.4
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: false
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: function(value) {
                          return formatCurrency(value as number);
                        }
                      }
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Trends Tab */}
      {selectedView === 'trends' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cost vs Usage Correlation */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost vs Usage Correlation</h3>
              <div style={{ height: '300px' }}>
                <Scatter
                  data={{
                    datasets: [
                      {
                        label: 'Cost vs Executions',
                        data: analytics.trends.cost_trend.map(item => ({
                          x: item.executions,
                          y: item.cost
                        })),
                        backgroundColor: 'rgba(59, 130, 246, 0.6)',
                        borderColor: '#3B82F6'
                      }
                    ]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      x: {
                        title: {
                          display: true,
                          text: 'Daily Executions'
                        }
                      },
                      y: {
                        title: {
                          display: true,
                          text: 'Daily Cost ($)'
                        }
                      }
                    }
                  }}
                />
              </div>
            </div>

            {/* Resource Utilization Trend */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Resource Utilization</h3>
              <div style={{ height: '300px' }}>
                <Line
                  data={{
                    labels: analytics.trends.cost_trend.map(item => 
                      new Date(item.date).toLocaleDateString()
                    ),
                    datasets: [
                      {
                        label: 'Utilization Rate',
                        data: analytics.trends.cost_trend.map(item => item.resource_utilization * 100),
                        borderColor: '#10B981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        fill: true,
                        tension: 0.4
                      }
                    ]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        display: false
                      }
                    },
                    scales: {
                      y: {
                        min: 0,
                        max: 100,
                        ticks: {
                          callback: function(value) {
                            return `${value}%`;
                          }
                        }
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Multi-metric Trend */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Multi-Metric Trends</h3>
            <div style={{ height: '400px' }}>
              <Line
                data={{
                  labels: analytics.trends.cost_trend.map(item => 
                    new Date(item.date).toLocaleDateString()
                  ),
                  datasets: [
                    {
                      label: 'Cost ($)',
                      data: analytics.trends.cost_trend.map(item => item.cost),
                      borderColor: '#3B82F6',
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      yAxisID: 'y',
                      tension: 0.4
                    },
                    {
                      label: 'Executions',
                      data: analytics.trends.cost_trend.map(item => item.executions),
                      borderColor: '#10B981',
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      yAxisID: 'y1',
                      tension: 0.4
                    },
                    {
                      label: 'Active Users',
                      data: analytics.trends.cost_trend.map(item => item.unique_users),
                      borderColor: '#F59E0B',
                      backgroundColor: 'rgba(245, 158, 11, 0.1)',
                      yAxisID: 'y2',
                      tension: 0.4
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: {
                    mode: 'index',
                    intersect: false,
                  },
                  scales: {
                    y: {
                      type: 'linear',
                      display: true,
                      position: 'left',
                      title: {
                        display: true,
                        text: 'Cost ($)'
                      }
                    },
                    y1: {
                      type: 'linear',
                      display: true,
                      position: 'right',
                      title: {
                        display: true,
                        text: 'Executions'
                      },
                      grid: {
                        drawOnChartArea: false,
                      },
                    },
                    y2: {
                      type: 'linear',
                      display: false,
                      position: 'right',
                    }
                  },
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Breakdown Tab */}
      {selectedView === 'breakdown' && (
        <div className="space-y-6">
          {/* Breakdown Filter */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center space-x-4">
              <Filter className="h-5 w-5 text-gray-500" />
              <select
                value={selectedBreakdown}
                onChange={(e) => setSelectedBreakdown(e.target.value as any)}
                className="border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="model">By Model</option>
                <option value="workspace">By Workspace</option>
                <option value="team">By Team</option>
                <option value="resource_type">By Resource Type</option>
                <option value="region">By Region</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Breakdown Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 capitalize">
                Cost Breakdown {selectedBreakdown.replace('_', ' ')}
              </h3>
              <div style={{ height: '300px' }}>
                <Doughnut
                  data={{
                    labels: analytics.breakdowns[`by_${selectedBreakdown}`].map((item: any) => 
                      item.model || item.workspace_name || item.team_name || item.resource_type || item.region
                    ),
                    datasets: [{
                      data: analytics.breakdowns[`by_${selectedBreakdown}`].map((item: any) => item.cost),
                      backgroundColor: [
                        '#3B82F6',
                        '#10B981',
                        '#F59E0B',
                        '#EF4444',
                        '#8B5CF6',
                        '#06B6D4',
                        '#84CC16',
                        '#F97316'
                      ],
                      borderWidth: 2,
                      borderColor: '#fff'
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom'
                      }
                    }
                  }}
                />
              </div>
            </div>

            {/* Breakdown Table */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Detailed Breakdown</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Cost
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        %
                      </th>
                      {selectedBreakdown === 'model' && (
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Efficiency
                        </th>
                      )}
                      {selectedBreakdown === 'resource_type' && (
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Utilization
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {analytics.breakdowns[`by_${selectedBreakdown}`].map((item: any, index: number) => (
                      <tr key={index}>
                        <td className="px-4 py-4 text-sm text-gray-900">
                          {item.model || item.workspace_name || item.team_name || item.resource_type || item.region}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900">
                          {formatCurrency(item.cost)}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-500">
                          {formatPercentage(item.percentage)}
                        </td>
                        {selectedBreakdown === 'model' && (
                          <td className="px-4 py-4 text-sm text-gray-500">
                            {item.efficiency_score?.toFixed(1) || 'N/A'}
                          </td>
                        )}
                        {selectedBreakdown === 'resource_type' && (
                          <td className="px-4 py-4 text-sm text-gray-500">
                            {formatPercentage(item.utilization * 100)}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Forecast Tab */}
      {selectedView === 'forecast' && forecast && (
        <div className="space-y-6">
          {/* Forecast Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Predicted Cost</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(forecast.predicted_cost)}
                  </p>
                </div>
                {getTrendIcon(forecast.trend_analysis.overall_trend)}
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-500 capitalize">
                  Trend: {forecast.trend_analysis.overall_trend}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Confidence</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatPercentage(forecast.confidence_score)}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-blue-500" />
              </div>
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${forecast.confidence_score}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Trend Strength</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {formatPercentage(forecast.trend_analysis.trend_strength * 100)}
                  </p>
                </div>
                <Activity className="h-8 w-8 text-purple-500" />
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-500">
                  {forecast.trend_analysis.trend_strength > 0.5 ? 'Strong' : 'Moderate'} trend
                </p>
              </div>
            </div>
          </div>

          {/* Scenario Analysis */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Scenario Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-green-800">Best Case</h4>
                  <TrendingDown className="h-5 w-5 text-green-600" />
                </div>
                <p className="text-2xl font-bold text-green-900 mt-2">
                  {formatCurrency(forecast.scenario_analysis.best_case)}
                </p>
                <p className="text-sm text-green-700 mt-1">
                  {formatPercentage((forecast.scenario_analysis.best_case / forecast.predicted_cost - 1) * 100)} vs predicted
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-blue-800">Most Likely</h4>
                  <Target className="h-5 w-5 text-blue-600" />
                </div>
                <p className="text-2xl font-bold text-blue-900 mt-2">
                  {formatCurrency(forecast.scenario_analysis.most_likely)}
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  Base forecast scenario
                </p>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-red-800">Worst Case</h4>
                  <TrendingUp className="h-5 w-5 text-red-600" />
                </div>
                <p className="text-2xl font-bold text-red-900 mt-2">
                  {formatCurrency(forecast.scenario_analysis.worst_case)}
                </p>
                <p className="text-sm text-red-700 mt-1">
                  {formatPercentage((forecast.scenario_analysis.worst_case / forecast.predicted_cost - 1) * 100)} vs predicted
                </p>
              </div>
            </div>
          </div>

          {/* Forecast Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost Forecast</h3>
            <div style={{ height: '300px' }}>
              <Line
                data={{
                  labels: [...analytics.trends.cost_trend.map(item => 
                    new Date(item.date).toLocaleDateString()
                  ), 'Forecast'],
                  datasets: [
                    {
                      label: 'Historical Cost',
                      data: [...analytics.trends.cost_trend.map(item => item.cost), null],
                      borderColor: '#3B82F6',
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      fill: false,
                      tension: 0.4
                    },
                    {
                      label: 'Predicted Cost',
                      data: [...Array(analytics.trends.cost_trend.length - 1).fill(null), 
                             analytics.trends.cost_trend[analytics.trends.cost_trend.length - 1].cost,
                             forecast.predicted_cost],
                      borderColor: '#EF4444',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      borderDash: [5, 5],
                      fill: false,
                      tension: 0.4
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'top'
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: function(value) {
                          return formatCurrency(value as number);
                        }
                      }
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};