'use client';

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Zap,
  CheckCircle,
  AlertCircle,
  Clock,
  Target,
  Cpu,
  Database,
  Cloud,
  Settings,
  Play,
  Pause,
  RotateCcw,
  ArrowRight,
  DollarSign,
  BarChart3,
  Lightbulb,
  Shield,
  Timer,
  Filter
} from 'lucide-react';
import { Line, Bar } from 'react-chartjs-2';

interface OptimizationRecommendation {
  id: string;
  type: 'model_suggestion' | 'prompt_optimization' | 'token_reduction' | 'execution_reduction' | 'resource_rightsizing' | 'schedule_optimization' | 'auto_scaling';
  category: 'cost_reduction' | 'performance_improvement' | 'resource_efficiency';
  title: string;
  description: string;
  detailed_analysis: string;
  estimated_savings: number;
  estimated_savings_percentage: number;
  confidence_score: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  action_required: string;
  implementation_steps: string[];
  affected_resources: string[];
  risk_assessment: string;
  business_impact: string;
  timeline_days: number;
  auto_implementable: boolean;
  status: 'pending' | 'approved' | 'implemented' | 'rejected';
  created_at: string;
}

interface OptimizationSettings {
  enable_auto_optimization: boolean;
  cost_threshold: number;
  token_threshold: number;
  model_preferences: string[];
  prompt_optimization: boolean;
  batching_enabled: boolean;
  caching_enabled: boolean;
  auto_scaling_enabled: boolean;
  rightsizing_enabled: boolean;
  schedule_optimization_enabled: boolean;
  anomaly_detection_enabled: boolean;
  risk_tolerance: 'conservative' | 'moderate' | 'aggressive';
}

interface SavingsProjection {
  current_monthly_cost: number;
  projected_savings: number;
  potential_monthly_cost: number;
  savings_percentage: number;
  payback_period_days: number;
}

export const CostOptimization: React.FC = () => {
  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([]);
  const [settings, setSettings] = useState<OptimizationSettings>({
    enable_auto_optimization: false,
    cost_threshold: 1000,
    token_threshold: 100000,
    model_preferences: ['gpt-3.5-turbo', 'llama3'],
    prompt_optimization: true,
    batching_enabled: true,
    caching_enabled: true,
    auto_scaling_enabled: false,
    rightsizing_enabled: true,
    schedule_optimization_enabled: false,
    anomaly_detection_enabled: true,
    risk_tolerance: 'moderate'
  });
  const [savingsProjection, setSavingsProjection] = useState<SavingsProjection>({
    current_monthly_cost: 25000,
    projected_savings: 8750,
    potential_monthly_cost: 16250,
    savings_percentage: 35,
    payback_period_days: 14
  });
  const [selectedFilters, setSelectedFilters] = useState({
    priority: 'all',
    category: 'all',
    status: 'all',
    auto_implementable: false
  });
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRecommendations();
    fetchSavingsProjection();
  }, [selectedFilters]);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      // Mock API call - replace with actual API
      const mockRecommendations: OptimizationRecommendation[] = [
        {
          id: '1',
          type: 'resource_rightsizing',
          category: 'cost_reduction',
          title: 'Rightsize EC2 instances in us-east-1',
          description: 'Multiple EC2 instances are running with consistently low CPU utilization (<30%)',
          detailed_analysis: 'Analysis of 14 EC2 instances over the past 30 days shows average CPU utilization of 24.5%. These instances can be downsized to save costs without impacting performance. Peak usage rarely exceeds 45%.',
          estimated_savings: 2450.75,
          estimated_savings_percentage: 42,
          confidence_score: 94,
          priority: 'high',
          impact: 'high',
          effort: 'low',
          action_required: 'Downsize instances from m5.large to m5.medium',
          implementation_steps: [
            'Analyze peak usage patterns over last 90 days',
            'Schedule maintenance window',
            'Stop instances and resize to m5.medium',
            'Start instances and monitor performance',
            'Validate application performance'
          ],
          affected_resources: ['i-1234567890abcdef0', 'i-0987654321fedcba0'],
          risk_assessment: 'Low risk - usage patterns show consistent underutilization',
          business_impact: 'No expected performance impact with 42% cost reduction',
          timeline_days: 3,
          auto_implementable: false,
          status: 'pending',
          created_at: new Date().toISOString()
        },
        {
          id: '2',
          type: 'model_suggestion',
          category: 'cost_reduction',
          title: 'Switch from GPT-4 to GPT-3.5-turbo for simple tasks',
          description: 'Many requests could use a less expensive model without quality degradation',
          detailed_analysis: 'Analysis shows 68% of GPT-4 requests have simple prompts that could be handled by GPT-3.5-turbo with 94% similar quality score but 90% lower cost.',
          estimated_savings: 1890.50,
          estimated_savings_percentage: 55,
          confidence_score: 89,
          priority: 'high',
          impact: 'medium',
          effort: 'medium',
          action_required: 'Implement intelligent model routing',
          implementation_steps: [
            'Implement prompt complexity analyzer',
            'Set up model routing logic',
            'Test with sample requests',
            'Monitor quality metrics',
            'Deploy to production'
          ],
          affected_resources: ['api-gateway', 'prompt-service'],
          risk_assessment: 'Medium risk - validate output quality before full rollout',
          business_impact: 'Potential minor quality differences for edge cases',
          timeline_days: 7,
          auto_implementable: true,
          status: 'pending',
          created_at: new Date().toISOString()
        },
        {
          id: '3',
          type: 'schedule_optimization',
          category: 'resource_efficiency',
          title: 'Implement scheduled scaling for dev environments',
          description: 'Development resources run 24/7 but are only used during business hours',
          detailed_analysis: 'Development and staging environments show near-zero usage between 7 PM and 7 AM (12 hours). Implementing scheduled shutdown can reduce costs by 50% for these environments.',
          estimated_savings: 1245.30,
          estimated_savings_percentage: 50,
          confidence_score: 96,
          priority: 'medium',
          impact: 'medium',
          effort: 'low',
          action_required: 'Set up automated start/stop schedules',
          implementation_steps: [
            'Identify all development resources',
            'Set up CloudWatch Events/Lambda for scheduling',
            'Configure start time (7 AM) and stop time (7 PM)',
            'Test automation with staging environment',
            'Apply to all development environments'
          ],
          affected_resources: ['dev-cluster', 'staging-cluster'],
          risk_assessment: 'Low risk - only affects non-production environments',
          business_impact: 'No impact on production, faster dev environment startup',
          timeline_days: 2,
          auto_implementable: true,
          status: 'approved',
          created_at: new Date().toISOString()
        },
        {
          id: '4',
          type: 'prompt_optimization',
          category: 'performance_improvement',
          title: 'Optimize token usage in chat prompts',
          description: 'Many prompts contain unnecessary context and verbose instructions',
          detailed_analysis: 'Analysis of 1000+ prompts reveals average token count of 180 with 35% redundant content. Optimizing prompts can reduce token usage by 30-40% while maintaining response quality.',
          estimated_savings: 890.25,
          estimated_savings_percentage: 32,
          confidence_score: 85,
          priority: 'medium',
          impact: 'medium',
          effort: 'medium',
          action_required: 'Implement prompt compression and optimization',
          implementation_steps: [
            'Audit existing prompt templates',
            'Remove redundant instructions',
            'Implement dynamic context loading',
            'A/B test optimized prompts',
            'Deploy optimized templates'
          ],
          affected_resources: ['chat-service', 'prompt-templates'],
          risk_assessment: 'Medium risk - thorough testing required',
          business_impact: 'Faster response times and lower costs',
          timeline_days: 10,
          auto_implementable: false,
          status: 'pending',
          created_at: new Date().toISOString()
        }
      ];
      
      setRecommendations(mockRecommendations);
    } catch (err) {
      setError('Failed to load recommendations');
      console.error('Error fetching recommendations:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSavingsProjection = async () => {
    try {
      // Calculate savings based on current recommendations
      const totalSavings = recommendations
        .filter(r => r.status === 'pending' || r.status === 'approved')
        .reduce((sum, r) => sum + r.estimated_savings, 0);
      
      setSavingsProjection({
        current_monthly_cost: 25000,
        projected_savings: totalSavings,
        potential_monthly_cost: 25000 - totalSavings,
        savings_percentage: (totalSavings / 25000) * 100,
        payback_period_days: 14
      });
    } catch (err) {
      console.error('Error calculating savings:', err);
    }
  };

  const handleImplementRecommendation = async (id: string) => {
    try {
      setRecommendations(recommendations.map(r => 
        r.id === id ? { ...r, status: 'implemented' } : r
      ));
      // Mock API call to implement recommendation
      console.log(`Implementing recommendation: ${id}`);
    } catch (err) {
      console.error('Error implementing recommendation:', err);
    }
  };

  const handleApproveRecommendation = async (id: string) => {
    try {
      setRecommendations(recommendations.map(r => 
        r.id === id ? { ...r, status: 'approved' } : r
      ));
    } catch (err) {
      console.error('Error approving recommendation:', err);
    }
  };

  const handleRejectRecommendation = async (id: string) => {
    try {
      setRecommendations(recommendations.map(r => 
        r.id === id ? { ...r, status: 'rejected' } : r
      ));
    } catch (err) {
      console.error('Error rejecting recommendation:', err);
    }
  };

  const filteredRecommendations = recommendations.filter(rec => {
    if (selectedFilters.priority !== 'all' && rec.priority !== selectedFilters.priority) {
      return false;
    }
    if (selectedFilters.category !== 'all' && rec.category !== selectedFilters.category) {
      return false;
    }
    if (selectedFilters.status !== 'all' && rec.status !== selectedFilters.status) {
      return false;
    }
    if (selectedFilters.auto_implementable && !rec.auto_implementable) {
      return false;
    }
    return true;
  });

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'resource_rightsizing': return <Cpu className="h-4 w-4" />;
      case 'model_suggestion': return <Lightbulb className="h-4 w-4" />;
      case 'schedule_optimization': return <Clock className="h-4 w-4" />;
      case 'prompt_optimization': return <Settings className="h-4 w-4" />;
      case 'auto_scaling': return <TrendingUp className="h-4 w-4" />;
      default: return <Target className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'implemented': return 'text-green-600';
      case 'approved': return 'text-blue-600';
      case 'rejected': return 'text-red-600';
      case 'pending': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Cost Optimization</h2>
          <p className="text-gray-600">AI-powered recommendations to reduce costs and improve efficiency</p>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center"
        >
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Savings Projection */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Potential Monthly Savings</h3>
            <p className="text-sm text-gray-600">Based on current recommendations</p>
          </div>
          <DollarSign className="h-8 w-8 text-green-600" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <div>
            <p className="text-sm text-gray-600">Current Monthly Cost</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(savingsProjection.current_monthly_cost)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Projected Savings</p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(savingsProjection.projected_savings)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Optimized Cost</p>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(savingsProjection.potential_monthly_cost)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Savings Percentage</p>
            <p className="text-2xl font-bold text-green-600">
              {savingsProjection.savings_percentage.toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-sm mb-1">
            <span>Cost Reduction Progress</span>
            <span>{savingsProjection.savings_percentage.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full"
              style={{ width: `${Math.min(savingsProjection.savings_percentage, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center space-x-4">
          <Filter className="h-5 w-5 text-gray-500" />
          <div className="flex space-x-4">
            <select
              value={selectedFilters.priority}
              onChange={(e) => setSelectedFilters({ ...selectedFilters, priority: e.target.value })}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm"
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              value={selectedFilters.category}
              onChange={(e) => setSelectedFilters({ ...selectedFilters, category: e.target.value })}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm"
            >
              <option value="all">All Categories</option>
              <option value="cost_reduction">Cost Reduction</option>
              <option value="performance_improvement">Performance</option>
              <option value="resource_efficiency">Efficiency</option>
            </select>

            <select
              value={selectedFilters.status}
              onChange={(e) => setSelectedFilters({ ...selectedFilters, status: e.target.value })}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="implemented">Implemented</option>
              <option value="rejected">Rejected</option>
            </select>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={selectedFilters.auto_implementable}
                onChange={(e) => setSelectedFilters({ ...selectedFilters, auto_implementable: e.target.checked })}
                className="rounded border-gray-300 mr-2"
              />
              <span className="text-sm text-gray-700">Auto-implementable only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Recommendations List */}
      <div className="space-y-4">
        {filteredRecommendations.map((recommendation) => (
          <div key={recommendation.id} className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4 flex-1">
                <div className="p-2 bg-blue-100 rounded-lg">
                  {getTypeIcon(recommendation.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{recommendation.title}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(recommendation.priority)}`}>
                      {recommendation.priority.toUpperCase()}
                    </span>
                    {recommendation.auto_implementable && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                        <Zap className="h-3 w-3 mr-1" />
                        Auto-fix
                      </span>
                    )}
                  </div>
                  
                  <p className="text-gray-600 mb-3">{recommendation.description}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div className="bg-green-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-600">Estimated Savings</p>
                      <p className="text-lg font-bold text-green-600">
                        {formatCurrency(recommendation.estimated_savings)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {recommendation.estimated_savings_percentage}% reduction
                      </p>
                    </div>
                    
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-600">Confidence</p>
                      <p className="text-lg font-bold text-blue-600">
                        {recommendation.confidence_score}%
                      </p>
                      <p className="text-xs text-gray-500">
                        {recommendation.confidence_score > 90 ? 'Very High' : 
                         recommendation.confidence_score > 70 ? 'High' : 'Medium'}
                      </p>
                    </div>
                    
                    <div className="bg-purple-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-600">Implementation</p>
                      <p className="text-lg font-bold text-purple-600">
                        {recommendation.timeline_days} days
                      </p>
                      <p className="text-xs text-gray-500 capitalize">
                        {recommendation.effort} effort
                      </p>
                    </div>
                    
                    <div className="bg-yellow-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-600">Impact</p>
                      <p className="text-lg font-bold text-yellow-600 capitalize">
                        {recommendation.impact}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">
                        {recommendation.category.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <span className={`text-sm font-medium ${getStatusColor(recommendation.status)}`}>
                        Status: {recommendation.status.charAt(0).toUpperCase() + recommendation.status.slice(1)}
                      </span>
                      <span className="text-sm text-gray-500">
                        {recommendation.affected_resources.length} resources affected
                      </span>
                    </div>
                    
                    <div className="flex space-x-2">
                      {recommendation.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApproveRecommendation(recommendation.id)}
                            className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm flex items-center"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectRecommendation(recommendation.id)}
                            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      
                      {recommendation.status === 'approved' && (
                        <button
                          onClick={() => handleImplementRecommendation(recommendation.id)}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm flex items-center"
                        >
                          <Play className="h-4 w-4 mr-1" />
                          {recommendation.auto_implementable ? 'Auto-Implement' : 'Implement'}
                        </button>
                      )}
                      
                      {recommendation.status === 'implemented' && (
                        <span className="bg-green-100 text-green-800 px-3 py-1 rounded text-sm flex items-center">
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Implemented
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Expandable Details */}
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-800">
                View Implementation Details
              </summary>
              <div className="mt-3 pl-6 border-l-2 border-blue-200">
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium text-gray-900">Detailed Analysis</h4>
                    <p className="text-sm text-gray-600">{recommendation.detailed_analysis}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900">Implementation Steps</h4>
                    <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
                      {recommendation.implementation_steps.map((step, index) => (
                        <li key={index}>{step}</li>
                      ))}
                    </ol>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900">Risk Assessment</h4>
                    <p className="text-sm text-gray-600">{recommendation.risk_assessment}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900">Business Impact</h4>
                    <p className="text-sm text-gray-600">{recommendation.business_impact}</p>
                  </div>
                </div>
              </div>
            </details>
          </div>
        ))}
      </div>

      {filteredRecommendations.length === 0 && (
        <div className="text-center py-12">
          <Lightbulb className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No recommendations found</h3>
          <p className="text-gray-600">
            {selectedFilters.priority !== 'all' || selectedFilters.category !== 'all' || selectedFilters.status !== 'all'
              ? 'Try adjusting your filters to see more recommendations.'
              : 'Your system is already optimized! Check back later for new recommendations.'}
          </p>
        </div>
      )}
    </div>
  );
};