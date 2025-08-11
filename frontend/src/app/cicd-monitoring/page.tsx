'use client';

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/Badge';
import {
  PipelineMonitoring,
  BuildStatusVisualization,
  DeploymentMonitoring,
  ErrorReporting
} from '@/components/Monitoring';
import {
  Activity,
  BarChart3,
  Server,
  AlertTriangle,
  GitBranch,
  Zap,
  Clock,
  Target,
  TrendingUp
} from 'lucide-react';

export default function CICDMonitoringPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [systemStats, setSystemStats] = useState({
    activePipelines: 2,
    successRate: 94.2,
    avgBuildTime: 8.5,
    deploymentsToday: 5,
    openErrors: 3,
    systemHealth: 'healthy'
  });

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">CI/CD Monitoring Dashboard</h1>
            <p className="text-gray-600 mt-2">
              Comprehensive monitoring for continuous integration and deployment pipelines
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={systemStats.systemHealth === 'healthy' ? 'default' : 'destructive'}>
              {systemStats.systemHealth === 'healthy' ? '✅ Healthy' : '❌ Issues Detected'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Pipelines</CardTitle>
            <Activity className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{systemStats.activePipelines}</div>
            <p className="text-xs text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <Target className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{systemStats.successRate}%</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Build Time</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{systemStats.avgBuildTime}m</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 inline mr-1" />
              -12% from last week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deployments</CardTitle>
            <Zap className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{systemStats.deploymentsToday}</div>
            <p className="text-xs text-muted-foreground">Today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Errors</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{systemStats.openErrors}</div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Server className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">✓</div>
            <p className="text-xs text-muted-foreground">All systems operational</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center space-x-2">
            <Activity className="h-4 w-4" />
            <span>Overview</span>
          </TabsTrigger>
          <TabsTrigger value="pipelines" className="flex items-center space-x-2">
            <GitBranch className="h-4 w-4" />
            <span>Pipelines</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center space-x-2">
            <BarChart3 className="h-4 w-4" />
            <span>Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="deployments" className="flex items-center space-x-2">
            <Server className="h-4 w-4" />
            <span>Deployments</span>
          </TabsTrigger>
          <TabsTrigger value="errors" className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4" />
            <span>Error Reports</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="h-5 w-5 mr-2" />
                  Recent Pipeline Activity
                </CardTitle>
                <CardDescription>Latest pipeline runs and their status</CardDescription>
              </CardHeader>
              <CardContent>
                <PipelineMonitoring />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Server className="h-5 w-5 mr-2" />
                  Deployment Status
                </CardTitle>
                <CardDescription>Current deployment status across environments</CardDescription>
              </CardHeader>
              <CardContent>
                <DeploymentMonitoring />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="h-5 w-5 mr-2" />
                Build Performance Overview
              </CardTitle>
              <CardDescription>Key metrics and trends for build performance</CardDescription>
            </CardHeader>
            <CardContent>
              <BuildStatusVisualization />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pipelines" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <GitBranch className="h-5 w-5 mr-2" />
                Pipeline Monitoring
              </CardTitle>
              <CardDescription>
                Real-time monitoring of CI/CD pipelines with detailed status tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PipelineMonitoring />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="h-5 w-5 mr-2" />
                Build Analytics & Historical Trends
              </CardTitle>
              <CardDescription>
                Comprehensive analytics with historical data and performance insights
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BuildStatusVisualization />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deployments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Server className="h-5 w-5 mr-2" />
                Deployment Monitoring
              </CardTitle>
              <CardDescription>
                Monitor deployments across environments with health checks and rollback capabilities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DeploymentMonitoring />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2" />
                Error Reporting & Diagnostics
              </CardTitle>
              <CardDescription>
                Comprehensive error tracking with detailed diagnostics and resolution tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ErrorReporting />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer Information */}
      <div className="mt-12 p-6 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-gray-600">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Pipeline Features</h4>
            <ul className="space-y-1">
              <li>• Real-time status updates via WebSocket</li>
              <li>• Detailed job-level progress tracking</li>
              <li>• Pipeline performance metrics</li>
              <li>• Historical trend analysis</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Deployment Features</h4>
            <ul className="space-y-1">
              <li>• Multi-environment monitoring</li>
              <li>• Health check validation</li>
              <li>• Rollback capabilities</li>
              <li>• Infrastructure metrics</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Error Management</h4>
            <ul className="space-y-1">
              <li>• Comprehensive error tracking</li>
              <li>• Severity-based categorization</li>
              <li>• Stack trace analysis</li>
              <li>• Impact metrics and reporting</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}