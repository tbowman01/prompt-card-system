'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Brain, 
  DollarSign, 
  TrendingUp, 
  Activity, 
  BarChart3, 
  Target, 
  Zap, 
  Users,
  Globe,
  AlertTriangle,
  CheckCircle,
  Clock,
  Cpu,
  Settings,
  Download,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Lightbulb,
  Shield,
  Gauge
} from 'lucide-react';
import { Line, Bar, Doughnut, Area } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface IntegratedMetrics {
  ai_performance: {
    total_optimizations: number;
    success_rate: number;
    average_improvement: number;
    cost_savings_generated: number;
  };
  cost_efficiency: {
    current_monthly_spend: number;
    projected_savings: number;
    optimization_roi: number;
    cost_per_optimization: number;
  };
  system_performance: {
    average_response_time: number;
    throughput_ops_per_second: number;
    error_rate: number;
    uptime_percentage: number;
  };
  user_satisfaction: {
    satisfaction_score: number;
    completion_rate: number;
    user_retention: number;
    feedback_sentiment: number;
  };
}

interface OptimizationImpact {
  time_period: string;
  ai_optimizations: number;
  cost_reduction: number;
  performance_gain: number;
  user_satisfaction: number;
  cumulative_savings: number;
}

interface AlertSummary {
  id: string;
  type: 'cost_spike' | 'performance_degradation' | 'optimization_opportunity' | 'budget_alert';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  potential_impact: number;
  recommended_action: string;
  created_at: string;
}

const IntegratedAnalyticsDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [integratedMetrics, setIntegratedMetrics] = useState<IntegratedMetrics | null>(null);
  const [impactData, setImpactData] = useState<OptimizationImpact[]>([]);
  const [alerts, setAlerts] = useState<AlertSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  // WebSocket for real-time updates
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    loadIntegratedAnalytics();
    setupWebSocket();
    
    // Auto-refresh every 30 seconds
    const refreshInterval = setInterval(loadIntegratedAnalytics, 30000);
    
    return () => {
      clearInterval(refreshInterval);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const setupWebSocket = () => {
    const ws = new WebSocket(`ws://localhost:3001/ws/integrated-analytics`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'metrics_update') {
        setIntegratedMetrics(data.metrics);
        setLastUpdated(new Date());
      } else if (data.type === 'alert_update') {
        setAlerts(data.alerts);
      }
    };

    ws.onclose = () => {
      // Reconnect after 5 seconds
      setTimeout(setupWebSocket, 5000);
    };
  };

  const loadIntegratedAnalytics = async () => {
    setIsLoading(true);
    try {
      // Fetch integrated analytics data
      const [metricsResponse, impactResponse, alertsResponse] = await Promise.all([
        fetch('/api/analytics/integrated-metrics'),
        fetch('/api/analytics/optimization-impact'),
        fetch('/api/analytics/alert-summary')
      ]);

      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        setIntegratedMetrics(metricsData.data);
      }

      if (impactResponse.ok) {
        const impactResponseData = await impactResponse.json();
        setImpactData(impactResponseData.data);
      }

      if (alertsResponse.ok) {
        const alertsData = await alertsResponse.json();
        setAlerts(alertsData.data);
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading integrated analytics:', error);
      // Fallback to mock data for demo
      loadMockData();
    } finally {
      setIsLoading(false);
    }
  };

  const loadMockData = () => {
    setIntegratedMetrics({
      ai_performance: {
        total_optimizations: 12847,
        success_rate: 94.2,
        average_improvement: 32.5,
        cost_savings_generated: 18750.50
      },
      cost_efficiency: {
        current_monthly_spend: 45230.75,
        projected_savings: 8945.25,
        optimization_roi: 4.8,
        cost_per_optimization: 2.35
      },
      system_performance: {
        average_response_time: 85,
        throughput_ops_per_second: 847,
        error_rate: 0.3,
        uptime_percentage: 99.8
      },
      user_satisfaction: {
        satisfaction_score: 91.5,
        completion_rate: 87.3,
        user_retention: 92.1,
        feedback_sentiment: 85.7
      }
    });

    setImpactData([
      { time_period: 'Week 1', ai_optimizations: 2845, cost_reduction: 3420, performance_gain: 28, user_satisfaction: 85, cumulative_savings: 3420 },
      { time_period: 'Week 2', ai_optimizations: 3156, cost_reduction: 4280, performance_gain: 31, user_satisfaction: 87, cumulative_savings: 7700 },
      { time_period: 'Week 3', ai_optimizations: 3420, cost_reduction: 5125, performance_gain: 35, user_satisfaction: 89, cumulative_savings: 12825 },
      { time_period: 'Week 4', ai_optimizations: 3426, cost_reduction: 5870, performance_gain: 38, user_satisfaction: 91, cumulative_savings: 18695 }
    ]);

    setAlerts([
      {
        id: '1',
        type: 'cost_spike',
        severity: 'high',
        title: 'Unusual cost increase detected',
        description: 'GPU usage has increased 45% in the last hour',
        potential_impact: 2850,
        recommended_action: 'Review recent model deployments and consider auto-scaling',
        created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString()
      },
      {
        id: '2',
        type: 'optimization_opportunity',
        severity: 'medium',
        title: 'High-impact optimization available',
        description: 'Switch to GPT-3.5-turbo could save 60% on simple tasks',
        potential_impact: 1240,
        recommended_action: 'Implement intelligent model routing',
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      },
      {
        id: '3',
        type: 'performance_degradation',
        severity: 'low',
        title: 'Edge node latency increase',
        description: 'Asia-Pacific nodes showing 15ms average latency increase',
        potential_impact: 0,
        recommended_action: 'Monitor regional performance and consider rebalancing',
        created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
      }
    ]);
  };

  // Chart data configurations
  const performanceImpactChart = {
    labels: impactData.map(d => d.time_period),
    datasets: [
      {
        label: 'Cost Savings ($)',
        data: impactData.map(d => d.cost_reduction),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true,
        tension: 0.4,
        yAxisID: 'y'
      },
      {
        label: 'Performance Gain (%)',
        data: impactData.map(d => d.performance_gain),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        yAxisID: 'y1'
      },
      {
        label: 'User Satisfaction',
        data: impactData.map(d => d.user_satisfaction),
        borderColor: 'rgb(139, 92, 246)',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        fill: true,
        tension: 0.4,
        yAxisID: 'y1'
      }
    ]
  };

  const cumulativeSavingsChart = {
    labels: impactData.map(d => d.time_period),
    datasets: [
      {
        label: 'Cumulative Savings ($)',
        data: impactData.map(d => d.cumulative_savings),
        backgroundColor: 'rgba(34, 197, 94, 0.6)',
        borderColor: 'rgb(34, 197, 94)',
        borderWidth: 2
      }
    ]
  };

  const systemHealthChart = {
    labels: ['AI Performance', 'Cost Efficiency', 'System Performance', 'User Satisfaction'],
    datasets: [
      {
        data: integratedMetrics ? [
          integratedMetrics.ai_performance.success_rate,
          (integratedMetrics.cost_efficiency.optimization_roi / 5) * 100,
          integratedMetrics.system_performance.uptime_percentage,
          integratedMetrics.user_satisfaction.satisfaction_score
        ] : [0, 0, 0, 0],
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(139, 92, 246, 0.8)'
        ],
        borderWidth: 0
      }
    ]
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'cost_spike': return <TrendingUp className="h-4 w-4" />;
      case 'performance_degradation': return <Gauge className="h-4 w-4" />;
      case 'optimization_opportunity': return <Lightbulb className="h-4 w-4" />;
      case 'budget_alert': return <AlertTriangle className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Key Performance Indicators */}
      {integratedMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">AI Optimizations</h3>
                <p className="text-3xl font-bold">{integratedMetrics.ai_performance.total_optimizations.toLocaleString()}</p>
              </div>
              <Brain className="h-8 w-8 opacity-80" />
            </div>
            <div className="mt-4 flex items-center">
              <ArrowUpRight className="h-4 w-4 mr-1" />
              <span className="text-sm">{integratedMetrics.ai_performance.success_rate}% success rate</span>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-green-500 to-green-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Cost Savings</h3>
                <p className="text-3xl font-bold">{formatCurrency(integratedMetrics.ai_performance.cost_savings_generated)}</p>
              </div>
              <DollarSign className="h-8 w-8 opacity-80" />
            </div>
            <div className="mt-4 flex items-center">
              <TrendingUp className="h-4 w-4 mr-1" />
              <span className="text-sm">{integratedMetrics.cost_efficiency.optimization_roi}x ROI</span>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Avg Response Time</h3>
                <p className="text-3xl font-bold">{integratedMetrics.system_performance.average_response_time}ms</p>
              </div>
              <Gauge className="h-8 w-8 opacity-80" />
            </div>
            <div className="mt-4">
              <Progress value={100 - (integratedMetrics.system_performance.average_response_time / 200) * 100} className="bg-purple-400" />
              <span className="text-sm mt-1 block">Target: &lt;100ms</span>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">User Satisfaction</h3>
                <p className="text-3xl font-bold">{integratedMetrics.user_satisfaction.satisfaction_score}%</p>
              </div>
              <Users className="h-8 w-8 opacity-80" />
            </div>
            <div className="mt-4 flex items-center">
              <ArrowUpRight className="h-4 w-4 mr-1" />
              <span className="text-sm">{integratedMetrics.user_satisfaction.completion_rate}% completion rate</span>
            </div>
          </Card>
        </div>
      )}

      {/* Performance Impact Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            Performance Impact Over Time
          </h3>
          <div className="h-80">
            <Line
              data={performanceImpactChart}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                  y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: 'Cost Savings ($)' }
                  },
                  y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: { display: true, text: 'Performance & Satisfaction (%)' },
                    grid: { drawOnChartArea: false }
                  }
                },
                plugins: {
                  legend: { position: 'top' }
                }
              }}
            />
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Target className="h-5 w-5 mr-2" />
            System Health Score
          </h3>
          <div className="h-80">
            <Doughnut
              data={systemHealthChart}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'bottom' }
                }
              }}
            />
          </div>
        </Card>
      </div>

      {/* Cumulative Savings */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <TrendingUp className="h-5 w-5 mr-2" />
          Cumulative Cost Savings
        </h3>
        <div className="h-64">
          <Bar
            data={cumulativeSavingsChart}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: { y: { beginAtZero: true } },
              plugins: {
                legend: { display: false }
              }
            }}
          />
        </div>
      </Card>
    </div>
  );

  const renderAlertsTab = () => (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            System Alerts & Recommendations
          </h3>
          <div className="flex space-x-2">
            <Button 
              onClick={loadIntegratedAnalytics}
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {alerts.map((alert) => (
            <div key={alert.id} className={`p-4 rounded-lg border-l-4 ${getSeverityColor(alert.severity)}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className="mt-1">{getTypeIcon(alert.type)}</div>
                  <div className="flex-1">
                    <h4 className="font-semibold flex items-center">
                      {alert.title}
                      <Badge className={`ml-2 ${getSeverityColor(alert.severity)}`}>
                        {alert.severity.toUpperCase()}
                      </Badge>
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">{alert.description}</p>
                    <p className="text-sm font-medium mt-2">
                      <strong>Recommended Action:</strong> {alert.recommended_action}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {alert.potential_impact > 0 && (
                    <div className="text-sm">
                      <span className="text-gray-600">Potential Impact:</span>
                      <div className="font-bold text-orange-600">
                        {formatCurrency(alert.potential_impact)}
                      </div>
                    </div>
                  )}
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(alert.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {alerts.length === 0 && (
          <div className="text-center py-12">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">All Systems Optimal</h3>
            <p className="text-gray-600">No alerts or optimization opportunities detected.</p>
          </div>
        )}
      </Card>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <BarChart3 className="h-8 w-8 mr-3 text-blue-600" />
            Integrated Analytics Dashboard
          </h1>
          <p className="text-gray-600 mt-1">
            Comprehensive AI optimization impact and cost efficiency monitoring
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right text-sm text-gray-600">
            <div>Last updated</div>
            <div className="font-medium">{lastUpdated.toLocaleTimeString()}</div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-600">Live Monitoring</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview" className="flex items-center">
            <Activity className="h-4 w-4 mr-2" />
            Performance Overview
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Alerts & Recommendations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          {renderOverviewTab()}
        </TabsContent>

        <TabsContent value="alerts" className="mt-6">
          {renderAlertsTab()}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default IntegratedAnalyticsDashboard;