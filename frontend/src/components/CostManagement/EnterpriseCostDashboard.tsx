'use client';

import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  DollarSign, 
  Activity,
  Cloud,
  Users,
  Server,
  Target,
  Zap,
  BarChart3,
  PieChart,
  Settings,
  Download,
  Refresh
} from 'lucide-react';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface RealTimeCostMetrics {
  current_spend_rate: number;
  projected_daily_cost: number;
  projected_monthly_cost: number;
  cost_velocity: number;
  active_resources: number;
  cost_by_service: Record<string, number>;
  cost_by_region: Record<string, number>;
  cost_by_team: Record<string, number>;
  anomalies_detected: number;
  budget_utilization: Record<string, number>;
  last_updated: string;
}

interface CostAnomaly {
  id: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resource_type: string;
  deviation_percentage: number;
  actual_cost: number;
  baseline_cost: number;
  detected_at: string;
  status: string;
}

interface OptimizationRecommendation {
  id: string;
  title: string;
  description: string;
  estimated_savings: number;
  estimated_savings_percentage: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  confidence_score: number;
  auto_implementable: boolean;
}

interface Budget {
  id: number;
  name: string;
  amount: number;
  current_spend: number;
  percentage_used: number;
  status: 'active' | 'warning' | 'exceeded';
  type: string;
}

export const EnterpriseCostDashboard: React.FC = () => {
  // State management
  const [realTimeMetrics, setRealTimeMetrics] = useState<RealTimeCostMetrics | null>(null);
  const [anomalies, setAnomalies] = useState<CostAnomaly[]>([]);
  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');
  const [selectedView, setSelectedView] = useState<'overview' | 'analytics' | 'budgets' | 'optimization'>('overview');

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // In a real implementation, these would be actual API calls
        // For now, using mock data
        await Promise.all([
          fetchRealTimeMetrics(),
          fetchAnomalies(),
          fetchRecommendations(),
          fetchBudgets()
        ]);

      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [selectedTimeRange]);

  const fetchRealTimeMetrics = async () => {
    // Mock API call - replace with actual fetch
    const mockMetrics: RealTimeCostMetrics = {
      current_spend_rate: 45.67,
      projected_daily_cost: 1096.08,
      projected_monthly_cost: 32882.40,
      cost_velocity: 2.3,
      active_resources: 847,
      cost_by_service: {
        'compute': 450.23,
        'storage': 123.45,
        'network': 89.12,
        'database': 234.56,
        'api': 67.89
      },
      cost_by_region: {
        'us-east-1': 520.34,
        'us-west-2': 345.67,
        'eu-west-1': 199.24
      },
      cost_by_team: {
        'engineering': 678.90,
        'data-science': 234.56,
        'product': 151.79
      },
      anomalies_detected: 3,
      budget_utilization: {
        'Monthly Development': 78.5,
        'Infrastructure': 92.1,
        'API Usage': 45.3
      },
      last_updated: new Date().toISOString()
    };
    setRealTimeMetrics(mockMetrics);
  };

  const fetchAnomalies = async () => {
    const mockAnomalies: CostAnomaly[] = [
      {
        id: 1,
        severity: 'high',
        resource_type: 'compute',
        deviation_percentage: 245,
        actual_cost: 450.00,
        baseline_cost: 180.00,
        detected_at: new Date().toISOString(),
        status: 'open'
      },
      {
        id: 2,
        severity: 'medium',
        resource_type: 'storage',
        deviation_percentage: 156,
        actual_cost: 89.50,
        baseline_cost: 57.30,
        detected_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        status: 'investigating'
      }
    ];
    setAnomalies(mockAnomalies);
  };

  const fetchRecommendations = async () => {
    const mockRecommendations: OptimizationRecommendation[] = [
      {
        id: '1',
        title: 'Rightsize EC2 instances',
        description: 'Multiple instances are underutilized and can be downsized',
        estimated_savings: 1234.56,
        estimated_savings_percentage: 35,
        priority: 'high',
        confidence_score: 92,
        auto_implementable: false
      },
      {
        id: '2',
        title: 'Enable scheduled scaling',
        description: 'Implement auto-scaling during off-peak hours',
        estimated_savings: 856.78,
        estimated_savings_percentage: 22,
        priority: 'medium',
        confidence_score: 87,
        auto_implementable: true
      }
    ];
    setRecommendations(mockRecommendations);
  };

  const fetchBudgets = async () => {
    const mockBudgets: Budget[] = [
      {
        id: 1,
        name: 'Monthly Development',
        amount: 15000,
        current_spend: 11775,
        percentage_used: 78.5,
        status: 'active',
        type: 'monthly'
      },
      {
        id: 2,
        name: 'Infrastructure',
        amount: 8000,
        current_spend: 7368,
        percentage_used: 92.1,
        status: 'warning',
        type: 'monthly'
      },
      {
        id: 3,
        name: 'API Usage',
        amount: 2000,
        current_spend: 906,
        percentage_used: 45.3,
        status: 'active',
        type: 'monthly'
      }
    ];
    setBudgets(mockBudgets);
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-red-400';
      case 'medium': return 'bg-yellow-400';
      case 'low': return 'bg-blue-400';
      default: return 'bg-gray-400';
    }
  };

  const getBudgetStatusColor = (status: string): string => {
    switch (status) {
      case 'exceeded': return 'bg-red-500';
      case 'warning': return 'bg-yellow-500';
      case 'active': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Enterprise Cost Management</h1>
          <p className="text-gray-600">
            Real-time cost tracking, budgeting, and optimization insights
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center"
          >
            <Refresh className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'analytics', label: 'Analytics', icon: Activity },
            { id: 'budgets', label: 'Budgets', icon: Target },
            { id: 'optimization', label: 'Optimization', icon: Zap }
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

      {selectedView === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Current Spend Rate</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(realTimeMetrics?.current_spend_rate || 0)}/hr
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <DollarSign className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center">
                {(realTimeMetrics?.cost_velocity || 0) > 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <span className={`ml-1 text-sm font-medium ${
                  (realTimeMetrics?.cost_velocity || 0) > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {Math.abs(realTimeMetrics?.cost_velocity || 0).toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Projected Monthly</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(realTimeMetrics?.projected_monthly_cost || 0)}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-sm text-gray-600">
                  Daily: {formatCurrency(realTimeMetrics?.projected_daily_cost || 0)}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Resources</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {realTimeMetrics?.active_resources || 0}
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <Server className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-sm text-gray-600">Across all providers</span>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Anomalies</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {realTimeMetrics?.anomalies_detected || 0}
                  </p>
                </div>
                <div className="p-3 bg-red-100 rounded-full">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-sm text-gray-600">Require attention</span>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cost by Service Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost by Service</h3>
              <div style={{ height: '300px' }}>
                <Doughnut
                  data={{
                    labels: Object.keys(realTimeMetrics?.cost_by_service || {}),
                    datasets: [{
                      data: Object.values(realTimeMetrics?.cost_by_service || {}),
                      backgroundColor: [
                        '#3B82F6',
                        '#10B981',
                        '#F59E0B',
                        '#EF4444',
                        '#8B5CF6',
                        '#06B6D4'
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
                        position: 'right'
                      }
                    }
                  }}
                />
              </div>
            </div>

            {/* Budget Utilization */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget Utilization</h3>
              <div className="space-y-4">
                {budgets.map((budget) => (
                  <div key={budget.id} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">{budget.name}</span>
                      <span className="text-sm text-gray-500">
                        {formatCurrency(budget.current_spend)} / {formatCurrency(budget.amount)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${getBudgetStatusColor(budget.status)}`}
                        style={{ width: `${Math.min(budget.percentage_used, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-600">
                      <span>{budget.percentage_used.toFixed(1)}% used</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        budget.status === 'exceeded' ? 'bg-red-100 text-red-800' :
                        budget.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {budget.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Anomalies and Recommendations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Anomalies */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Anomalies</h3>
              <div className="space-y-4">
                {anomalies.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No anomalies detected</p>
                ) : (
                  anomalies.map((anomaly) => (
                    <div key={anomaly.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center">
                            <div className={`w-3 h-3 rounded-full ${getSeverityColor(anomaly.severity)} mr-2`} />
                            <h4 className="text-sm font-medium text-gray-900 capitalize">
                              {anomaly.resource_type} Cost Spike
                            </h4>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {anomaly.deviation_percentage}% increase detected
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatCurrency(anomaly.actual_cost)} vs {formatCurrency(anomaly.baseline_cost)} baseline
                          </p>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(anomaly.detected_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Top Recommendations */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Optimization Recommendations</h3>
              <div className="space-y-4">
                {recommendations.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No recommendations available</p>
                ) : (
                  recommendations.map((rec) => (
                    <div key={rec.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center">
                            <h4 className="text-sm font-medium text-gray-900">{rec.title}</h4>
                            <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                              rec.priority === 'critical' ? 'bg-red-100 text-red-800' :
                              rec.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                              rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {rec.priority.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                          <div className="flex items-center mt-2 space-x-4">
                            <span className="text-sm font-medium text-green-600">
                              Save {formatCurrency(rec.estimated_savings)}
                            </span>
                            <span className="text-sm text-gray-500">
                              {rec.confidence_score}% confidence
                            </span>
                            {rec.auto_implementable && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                                <Zap className="h-3 w-3 mr-1" />
                                Auto-fix
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Other view content would go here */}
      {selectedView === 'analytics' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Advanced Analytics</h3>
          <p className="text-gray-600">
            Detailed analytics dashboard with cost trends, forecasting, and usage patterns will be displayed here.
          </p>
        </div>
      )}

      {selectedView === 'budgets' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget Management</h3>
          <p className="text-gray-600">
            Budget creation, management, and monitoring interface will be displayed here.
          </p>
        </div>
      )}

      {selectedView === 'optimization' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost Optimization</h3>
          <p className="text-gray-600">
            Detailed optimization recommendations and implementation tools will be displayed here.
          </p>
        </div>
      )}

      {/* Last Updated */}
      <div className="text-center text-sm text-gray-500">
        Last updated: {realTimeMetrics?.last_updated ? new Date(realTimeMetrics.last_updated).toLocaleString() : 'Never'}
      </div>
    </div>
  );
};