'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs } from '@/components/ui/tabs';
import { 
  Brain, 
  Zap, 
  Target, 
  Globe, 
  Cpu, 
  BarChart3, 
  Sparkles, 
  Network,
  Gauge,
  TrendingUp,
  Search,
  Bot,
  Layers,
  Shield,
  Lightning,
  Activity,
  CheckCircle,
  AlertTriangle,
  Clock,
  Users
} from 'lucide-react';
import { Line, Bar, Doughnut, Scatter } from 'react-chartjs-2';
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

interface SemanticAnalysis {
  promptId: string;
  semanticVector: number[];
  similarPrompts: Array<{
    id: string;
    title: string;
    similarity: number;
    effectiveness: number;
  }>;
  topicClusters: Array<{
    cluster: string;
    confidence: number;
    relatedTerms: string[];
  }>;
  contextualFactors: {
    domain: string;
    complexity: 'low' | 'medium' | 'high' | 'expert';
    intent: string[];
    tone: 'formal' | 'casual' | 'technical' | 'creative';
  };
  semanticQuality: {
    coherence: number;
    specificity: number;
    clarity: number;
    completeness: number;
  };
}

interface GeneratedVariant {
  id: string;
  prompt: string;
  confidence: number;
  predictedMetrics: {
    effectiveness: number;
    responseTime: number;
    quality: number;
    clarity: number;
  };
  generationStrategy: {
    technique: string;
    reasoning: string;
    sources: string[];
  };
  optimizations: Array<{
    type: string;
    description: string;
    impact: number;
  }>;
}

interface EdgeMetrics {
  timestamp: Date;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  average_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  cache_hit_rate: number;
  throughput_rps: number;
  error_rate: number;
  regional_breakdown: Record<string, any>;
  node_performance: Record<string, any>;
}

interface OptimizationInsights {
  globalPatterns: Array<{
    pattern: string;
    frequency: number;
    averageImprovement: number;
    recommendedUse: string;
  }>;
  domainSpecificInsights: Record<string, any>;
  performanceAnalytics: {
    averageOptimizationTime: number;
    successRate: number;
    topImprovementAreas: string[];
    userSatisfactionScore: number;
  };
  recommendations: string[];
}

const AIOptimizationDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [semanticAnalysis, setSemanticAnalysis] = useState<SemanticAnalysis | null>(null);
  const [generatedVariants, setGeneratedVariants] = useState<GeneratedVariant[]>([]);
  const [edgeMetrics, setEdgeMetrics] = useState<EdgeMetrics | null>(null);
  const [insights, setInsights] = useState<OptimizationInsights | null>(null);
  const [realTimeMetrics, setRealTimeMetrics] = useState({
    requestsPerSecond: 0,
    averageLatency: 0,
    errorRate: 0,
    cacheHitRate: 0
  });

  const wsRef = useRef<WebSocket | null>(null);

  // WebSocket for real-time updates
  useEffect(() => {
    const connectWebSocket = () => {
      const ws = new WebSocket(`ws://localhost:3001/ws/ai-metrics`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Connected to AI metrics WebSocket');
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'real_time_metrics') {
          setRealTimeMetrics(data.metrics);
        }
      };

      ws.onclose = () => {
        console.log('AI metrics WebSocket disconnected');
        // Reconnect after 5 seconds
        setTimeout(connectWebSocket, 5000);
      };

      ws.onerror = (error) => {
        console.error('AI metrics WebSocket error:', error);
      };
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Load initial data
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [edgeResponse, insightsResponse] = await Promise.all([
        fetch('/api/ai/edge/global-metrics'),
        fetch('/api/ai/optimization-insights')
      ]);

      if (edgeResponse.ok) {
        const edgeData = await edgeResponse.json();
        setEdgeMetrics(edgeData.data);
      }

      if (insightsResponse.ok) {
        const insightsData = await insightsResponse.json();
        setInsights(insightsData.data);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const analyzePrompt = async () => {
    if (!currentPrompt.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/ai/semantic-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: currentPrompt,
          options: {
            includeSimilarity: true,
            includeTopics: true,
            includeContext: true,
            includeQuality: true
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSemanticAnalysis(data.data);
      }
    } catch (error) {
      console.error('Error analyzing prompt:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateVariants = async () => {
    if (!currentPrompt.trim() || !semanticAnalysis) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/ai/generate-variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: currentPrompt,
          requirements: {
            domain: semanticAnalysis.contextualFactors.domain,
            taskType: 'optimization',
            targetAudience: 'general',
            complexity: semanticAnalysis.contextualFactors.complexity,
            style: 'instructional',
            constraints: {
              maxLength: 1000
            }
          },
          context: {
            performanceGoals: {
              minEffectiveness: 0.8,
              maxResponseTime: 2000,
              targetAccuracy: 0.85
            }
          },
          numVariants: 5
        })
      });

      if (response.ok) {
        const data = await response.json();
        setGeneratedVariants(data.data.variants);
      }
    } catch (error) {
      console.error('Error generating variants:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Chart configurations
  const performanceChartData = {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    datasets: [
      {
        label: 'Effectiveness Score',
        data: [72, 78, 85, 92],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4
      },
      {
        label: 'Response Time (ms)',
        data: [150, 145, 120, 95],
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4,
        yAxisID: 'y1'
      }
    ]
  };

  const domainDistributionData = {
    labels: ['Technical', 'Creative', 'Business', 'Educational', 'General'],
    datasets: [
      {
        data: [35, 25, 20, 15, 5],
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(139, 92, 246, 0.8)'
        ],
        borderWidth: 0
      }
    ]
  };

  const latencyMapData = {
    datasets: [
      {
        label: 'Edge Node Performance',
        data: [
          { x: -74.006, y: 40.7128, r: 15 }, // New York
          { x: -118.2437, y: 34.0522, r: 12 }, // Los Angeles
          { x: -0.1276, y: 51.5074, r: 18 }, // London
          { x: 2.3522, y: 48.8566, r: 14 }, // Paris
          { x: 139.6917, y: 35.6895, r: 16 }, // Tokyo
          { x: 151.2093, y: -33.8688, r: 11 }, // Sydney
        ],
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: 'rgb(59, 130, 246)'
      }
    ]
  };

  const renderOverviewTab = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Real-time Metrics Cards */}
      <Card className="p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Requests/sec</h3>
            <p className="text-3xl font-bold">{realTimeMetrics.requestsPerSecond.toFixed(1)}</p>
          </div>
          <Activity className="h-8 w-8 opacity-80" />
        </div>
        <div className="mt-4">
          <div className="flex items-center">
            <TrendingUp className="h-4 w-4 mr-1" />
            <span className="text-sm">+12% vs last hour</span>
          </div>
        </div>
      </Card>

      <Card className="p-6 bg-gradient-to-br from-green-500 to-green-600 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Avg Latency</h3>
            <p className="text-3xl font-bold">{realTimeMetrics.averageLatency}ms</p>
          </div>
          <Gauge className="h-8 w-8 opacity-80" />
        </div>
        <div className="mt-4">
          <Progress value={100 - (realTimeMetrics.averageLatency / 200) * 100} className="bg-green-400" />
          <span className="text-sm mt-1 block">Target: &lt;100ms</span>
        </div>
      </Card>

      <Card className="p-6 bg-gradient-to-br from-purple-500 to-purple-600 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Cache Hit Rate</h3>
            <p className="text-3xl font-bold">{realTimeMetrics.cacheHitRate.toFixed(1)}%</p>
          </div>
          <Layers className="h-8 w-8 opacity-80" />
        </div>
        <div className="mt-4">
          <Progress value={realTimeMetrics.cacheHitRate} className="bg-purple-400" />
          <span className="text-sm mt-1 block">Excellent performance</span>
        </div>
      </Card>

      <Card className="p-6 bg-gradient-to-br from-orange-500 to-orange-600 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Error Rate</h3>
            <p className="text-3xl font-bold">{(realTimeMetrics.errorRate * 100).toFixed(2)}%</p>
          </div>
          <Shield className="h-8 w-8 opacity-80" />
        </div>
        <div className="mt-4">
          {realTimeMetrics.errorRate < 0.01 ? (
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 mr-1" />
              <span className="text-sm">System healthy</span>
            </div>
          ) : (
            <div className="flex items-center">
              <AlertTriangle className="h-4 w-4 mr-1" />
              <span className="text-sm">Monitoring alerts</span>
            </div>
          )}
        </div>
      </Card>

      {/* Performance Chart */}
      <Card className="p-6 md:col-span-2">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <BarChart3 className="h-5 w-5 mr-2" />
          Performance Trends
        </h3>
        <div className="h-64">
          <Line
            data={performanceChartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: { beginAtZero: true },
                y1: {
                  type: 'linear',
                  display: true,
                  position: 'right',
                  grid: { drawOnChartArea: false }
                }
              }
            }}
          />
        </div>
      </Card>

      {/* Domain Distribution */}
      <Card className="p-6 md:col-span-2">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Target className="h-5 w-5 mr-2" />
          Domain Distribution
        </h3>
        <div className="h-64">
          <Doughnut
            data={domainDistributionData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'right' }
              }
            }}
          />
        </div>
      </Card>
    </div>
  );

  const renderSemanticTab = () => (
    <div className="space-y-6">
      {/* Prompt Input */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Brain className="h-5 w-5 mr-2" />
          Semantic Analysis
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Enter Prompt for Analysis</label>
            <textarea
              value={currentPrompt}
              onChange={(e) => setCurrentPrompt(e.target.value)}
              className="w-full h-32 p-3 border border-gray-300 rounded-md resize-none"
              placeholder="Enter your prompt here for advanced semantic analysis..."
            />
          </div>
          <div className="flex gap-3">
            <Button
              onClick={analyzePrompt}
              disabled={isLoading || !currentPrompt.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Analyze Semantics
                </>
              )}
            </Button>
            {semanticAnalysis && (
              <Button
                onClick={generateVariants}
                disabled={isLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Bot className="h-4 w-4 mr-2" />
                    Generate Variants
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Semantic Analysis Results */}
      {semanticAnalysis && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quality Metrics */}
          <Card className="p-6">
            <h4 className="font-semibold mb-4 flex items-center">
              <Target className="h-4 w-4 mr-2" />
              Semantic Quality
            </h4>
            <div className="space-y-3">
              {Object.entries(semanticAnalysis.semanticQuality).map(([key, value]) => (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="capitalize">{key.replace('_', ' ')}</span>
                    <span>{Math.round(value * 100)}%</span>
                  </div>
                  <Progress value={value * 100} className="h-2" />
                </div>
              ))}
            </div>
          </Card>

          {/* Contextual Factors */}
          <Card className="p-6">
            <h4 className="font-semibold mb-4 flex items-center">
              <Network className="h-4 w-4 mr-2" />
              Contextual Analysis
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Domain</span>
                <Badge variant="outline">{semanticAnalysis.contextualFactors.domain}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Complexity</span>
                <Badge 
                  className={`${
                    semanticAnalysis.contextualFactors.complexity === 'expert' ? 'bg-red-100 text-red-800' :
                    semanticAnalysis.contextualFactors.complexity === 'high' ? 'bg-orange-100 text-orange-800' :
                    semanticAnalysis.contextualFactors.complexity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}
                >
                  {semanticAnalysis.contextualFactors.complexity}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Tone</span>
                <Badge variant="outline">{semanticAnalysis.contextualFactors.tone}</Badge>
              </div>
              <div>
                <span className="text-sm text-gray-600 block mb-2">Intent Keywords</span>
                <div className="flex flex-wrap gap-1">
                  {semanticAnalysis.contextualFactors.intent.map((intent, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {intent}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Similar Prompts */}
          <Card className="p-6 lg:col-span-2">
            <h4 className="font-semibold mb-4 flex items-center">
              <Search className="h-4 w-4 mr-2" />
              Similar Prompts
            </h4>
            <div className="space-y-2">
              {semanticAnalysis.similarPrompts.slice(0, 5).map((similar, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{similar.title}</p>
                    <p className="text-xs text-gray-600">ID: {similar.id}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {Math.round(similar.similarity * 100)}% similar
                    </div>
                    <div className="text-xs text-gray-600">
                      {Math.round(similar.effectiveness * 100)}% effective
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Topic Clusters */}
          <Card className="p-6 lg:col-span-2">
            <h4 className="font-semibold mb-4 flex items-center">
              <Layers className="h-4 w-4 mr-2" />
              Topic Clusters
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {semanticAnalysis.topicClusters.map((cluster, index) => (
                <div key={index} className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <h5 className="font-medium text-blue-900">{cluster.cluster}</h5>
                    <Badge className="bg-blue-600 text-white">
                      {Math.round(cluster.confidence * 100)}%
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {cluster.relatedTerms.map((term, termIndex) => (
                      <Badge key={termIndex} variant="outline" className="text-xs border-blue-300">
                        {term}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Generated Variants */}
      {generatedVariants.length > 0 && (
        <Card className="p-6">
          <h4 className="font-semibold mb-4 flex items-center">
            <Bot className="h-4 w-4 mr-2" />
            AI-Generated Variants
          </h4>
          <div className="space-y-4">
            {generatedVariants.map((variant, index) => (
              <div key={variant.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <h5 className="font-medium">Variant {index + 1}</h5>
                  <div className="flex items-center space-x-2">
                    <Badge 
                      className={`${
                        variant.confidence > 0.8 ? 'bg-green-100 text-green-800' :
                        variant.confidence > 0.6 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}
                    >
                      {Math.round(variant.confidence * 100)}% confidence
                    </Badge>
                    <Badge variant="outline">
                      {variant.generationStrategy.technique.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
                
                <p className="text-sm text-gray-700 mb-3 p-3 bg-gray-50 rounded border-l-4 border-blue-500">
                  {variant.prompt}
                </p>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <div>
                    <span className="text-xs text-gray-600">Effectiveness</span>
                    <div className="font-medium">{Math.round(variant.predictedMetrics.effectiveness * 100)}%</div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-600">Response Time</span>
                    <div className="font-medium">{Math.round(variant.predictedMetrics.responseTime)}ms</div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-600">Quality</span>
                    <div className="font-medium">{Math.round(variant.predictedMetrics.quality * 100)}%</div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-600">Clarity</span>
                    <div className="font-medium">{Math.round(variant.predictedMetrics.clarity * 100)}%</div>
                  </div>
                </div>
                
                <details className="text-sm">
                  <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                    View Optimizations & Strategy
                  </summary>
                  <div className="mt-3 space-y-2">
                    <p><strong>Strategy:</strong> {variant.generationStrategy.reasoning}</p>
                    <div>
                      <strong>Sources:</strong> {variant.generationStrategy.sources.join(', ')}
                    </div>
                    <div>
                      <strong>Optimizations:</strong>
                      <ul className="list-disc list-inside ml-4 space-y-1">
                        {variant.optimizations.map((opt, optIndex) => (
                          <li key={optIndex}>
                            <span className="capitalize">{opt.type}</span>: {opt.description} 
                            <Badge className="ml-2 text-xs">+{Math.round(opt.impact * 100)}%</Badge>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </details>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );

  const renderEdgeTab = () => (
    <div className="space-y-6">
      {/* Edge Network Status */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Globe className="h-5 w-5 mr-2" />
          Global Edge Network Status
        </h3>
        
        {edgeMetrics && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{edgeMetrics.total_requests}</div>
              <div className="text-sm text-gray-600">Total Requests</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{edgeMetrics.average_latency_ms}ms</div>
              <div className="text-sm text-gray-600">Avg Latency</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{Math.round(edgeMetrics.cache_hit_rate * 100)}%</div>
              <div className="text-sm text-gray-600">Cache Hit Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{edgeMetrics.throughput_rps}</div>
              <div className="text-sm text-gray-600">RPS</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{Math.round(edgeMetrics.error_rate * 100)}%</div>
              <div className="text-sm text-gray-600">Error Rate</div>
            </div>
          </div>
        )}

        {/* Global Latency Map */}
        <div className="h-64">
          <Scatter
            data={latencyMapData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                x: {
                  title: { display: true, text: 'Longitude' },
                  min: -180,
                  max: 180
                },
                y: {
                  title: { display: true, text: 'Latitude' },
                  min: -90,
                  max: 90
                }
              },
              plugins: {
                tooltip: {
                  callbacks: {
                    label: (context) => `Latency: ${context.raw.r * 10}ms`
                  }
                }
              }
            }}
          />
        </div>
      </Card>

      {/* Regional Performance */}
      {edgeMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6">
            <h4 className="font-semibold mb-4 flex items-center">
              <BarChart3 className="h-4 w-4 mr-2" />
              Regional Performance
            </h4>
            <div className="space-y-3">
              {Object.entries(edgeMetrics.regional_breakdown).map(([region, data]) => (
                <div key={region} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <span className="font-medium">{region}</span>
                  <div className="text-right">
                    <div className="text-sm font-medium">{data.avg_latency_ms}ms</div>
                    <div className="text-xs text-gray-600">{data.requests} requests</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h4 className="font-semibold mb-4 flex items-center">
              <Cpu className="h-4 w-4 mr-2" />
              Node Performance
            </h4>
            <div className="space-y-3">
              {Object.entries(edgeMetrics.node_performance).slice(0, 5).map(([nodeId, data]) => (
                <div key={nodeId} className="p-3 border border-gray-200 rounded">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-sm">{nodeId.slice(0, 12)}...</span>
                    <Badge 
                      className={`${
                        data.load < 0.5 ? 'bg-green-100 text-green-800' :
                        data.load < 0.8 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}
                    >
                      {Math.round(data.load * 100)}% load
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                    <div>Latency: {Math.round(data.latency_ms)}ms</div>
                    <div>Uptime: {data.uptime_percentage}%</div>
                    <div>Requests: {data.requests_served}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );

  const renderInsightsTab = () => (
    <div className="space-y-6">
      {insights && (
        <>
          {/* Performance Analytics */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Performance Analytics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 mb-1">
                  {insights.performanceAnalytics.averageOptimizationTime}ms
                </div>
                <div className="text-sm text-gray-600">Avg Optimization Time</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 mb-1">
                  {Math.round(insights.performanceAnalytics.successRate * 100)}%
                </div>
                <div className="text-sm text-gray-600">Success Rate</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600 mb-1">
                  {insights.performanceAnalytics.userSatisfactionScore}
                </div>
                <div className="text-sm text-gray-600">User Satisfaction</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600 mb-1">
                  {insights.performanceAnalytics.topImprovementAreas.length}
                </div>
                <div className="text-sm text-gray-600">Key Improvement Areas</div>
              </div>
            </div>
          </Card>

          {/* Global Patterns */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Brain className="h-5 w-5 mr-2" />
              Global Optimization Patterns
            </h3>
            <div className="space-y-4">
              {insights.globalPatterns.map((pattern, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium">{pattern.pattern}</h4>
                    <div className="text-right">
                      <Badge className="bg-blue-100 text-blue-800 mb-1">
                        {Math.round(pattern.frequency * 100)}% frequency
                      </Badge>
                      <div className="text-sm text-green-600 font-medium">
                        +{pattern.averageImprovement.toFixed(1)}% improvement
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{pattern.recommendedUse}</p>
                  <Progress value={pattern.frequency * 100} className="h-2" />
                </div>
              ))}
            </div>
          </Card>

          {/* Domain-Specific Insights */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Target className="h-5 w-5 mr-2" />
              Domain-Specific Insights
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(insights.domainSpecificInsights).map(([domain, domainData]) => (
                <div key={domain} className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium capitalize mb-3 flex items-center">
                    <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
                    {domain} Domain
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Avg Improvement</span>
                      <span className="font-medium text-green-600">
                        +{domainData.avgImprovement?.toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600 block mb-1">Common Issues</span>
                      <div className="flex flex-wrap gap-1">
                        {domainData.commonIssues?.map((issue: string, issueIndex: number) => (
                          <Badge key={issueIndex} variant="outline" className="text-xs">
                            {issue}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* System Recommendations */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Lightning className="h-5 w-5 mr-2" />
              AI System Recommendations
            </h3>
            <div className="space-y-3">
              {insights.recommendations.map((recommendation, index) => (
                <div key={index} className="flex items-start p-3 bg-blue-50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-blue-900">{recommendation}</p>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Brain className="h-8 w-8 mr-3 text-blue-600" />
            AI Prompt Optimization
          </h1>
          <p className="text-gray-600 mt-1">
            Advanced AI-powered prompt optimization with real-time performance monitoring
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-gray-600">AI Services Online</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: Activity },
            { id: 'semantic', label: 'Semantic Analysis', icon: Brain },
            { id: 'edge', label: 'Edge Deployment', icon: Globe },
            { id: 'insights', label: 'AI Insights', icon: TrendingUp }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                activeTab === id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="h-4 w-4 mr-2" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'semantic' && renderSemanticTab()}
        {activeTab === 'edge' && renderEdgeTab()}
        {activeTab === 'insights' && renderInsightsTab()}
      </div>
    </div>
  );
};

export default AIOptimizationDashboard;