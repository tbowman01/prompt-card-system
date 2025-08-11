'use client';

import React, { useState, useMemo } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/Badge';
import { 
  AlertTriangle, 
  TrendingUp, 
  Shield, 
  Clock, 
  Target,
  BarChart3,
  Zap,
  CheckCircle,
  XCircle,
  ArrowUp,
  ArrowDown,
  Minus,
  Activity
} from 'lucide-react';
import {
  DependencyInfo,
  VulnerabilityInfo,
  UpdateInfo,
  RiskAssessment as RiskAssessmentType,
  RiskRecommendation,
  SeverityLevel
} from '../../types/dependency';

interface RiskAssessmentProps {
  dependencies: DependencyInfo[];
  vulnerabilities: VulnerabilityInfo[];
  updates: UpdateInfo[];
}

const RiskAssessment: React.FC<RiskAssessmentProps> = ({
  dependencies,
  vulnerabilities,
  updates
}) => {
  const [selectedDependency, setSelectedDependency] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'risk' | 'name' | 'vulnerabilities'>('risk');
  const [filterRisk, setFilterRisk] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  // Calculate risk assessments for all dependencies
  const riskAssessments = useMemo(() => {
    return dependencies.map(dep => {
      const depVulns = vulnerabilities.filter(v => v.dependencyId === dep.id);
      const depUpdates = updates.filter(u => u.dependencyId === dep.id);
      
      // Calculate risk factors
      const factors = [];
      let totalScore = 0;

      // Vulnerability factor (40% weight)
      const criticalVulns = depVulns.filter(v => v.severity === 'critical').length;
      const highVulns = depVulns.filter(v => v.severity === 'high').length;
      const vulnerabilityScore = Math.min(100, (criticalVulns * 40) + (highVulns * 20) + (depVulns.length * 5));
      factors.push({
        type: 'Security Vulnerabilities',
        description: `${depVulns.length} vulnerabilities (${criticalVulns} critical, ${highVulns} high)`,
        weight: 0.4,
        score: vulnerabilityScore
      });
      totalScore += vulnerabilityScore * 0.4;

      // Outdated factor (20% weight)
      const isOutdated = dep.latestVersion && dep.version !== dep.latestVersion;
      const outdatedScore = isOutdated ? 60 : 0;
      factors.push({
        type: 'Version Status',
        description: isOutdated ? `Outdated (${dep.version} → ${dep.latestVersion})` : 'Up to date',
        weight: 0.2,
        score: outdatedScore
      });
      totalScore += outdatedScore * 0.2;

      // Dependency type factor (15% weight)
      const typeRisk = dep.type === 'production' ? 80 : dep.type === 'development' ? 20 : 40;
      factors.push({
        type: 'Dependency Type',
        description: `${dep.type} dependency`,
        weight: 0.15,
        score: typeRisk
      });
      totalScore += typeRisk * 0.15;

      // Maintenance factor (15% weight)
      const lastUpdated = dep.lastUpdated ? new Date(dep.lastUpdated) : null;
      const monthsSinceUpdate = lastUpdated ? 
        Math.floor((Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24 * 30)) : 12;
      const maintenanceScore = Math.min(100, monthsSinceUpdate * 8);
      factors.push({
        type: 'Maintenance Status',
        description: lastUpdated ? 
          `Last updated ${monthsSinceUpdate} months ago` : 
          'No update information',
        weight: 0.15,
        score: maintenanceScore
      });
      totalScore += maintenanceScore * 0.15;

      // Breaking changes factor (10% weight)
      const hasBreakingUpdate = depUpdates.some(u => u.breakingChanges);
      const breakingScore = hasBreakingUpdate ? 70 : 0;
      factors.push({
        type: 'Breaking Changes',
        description: hasBreakingUpdate ? 'Available updates contain breaking changes' : 'No breaking changes',
        weight: 0.1,
        score: breakingScore
      });
      totalScore += breakingScore * 0.1;

      // Determine recommendation
      let recommendation: RiskRecommendation;
      if (totalScore >= 80) recommendation = 'immediate';
      else if (totalScore >= 60) recommendation = 'scheduled';
      else if (totalScore >= 30) recommendation = 'monitor';
      else recommendation = 'defer';

      // Impact analysis
      const impactAnalysis = {
        breakingChanges: hasBreakingUpdate,
        apiChanges: hasBreakingUpdate ? ['Potential API breaking changes'] : [],
        dependentComponents: depUpdates.flatMap(u => u.requiredBy),
        testCoverage: 85, // Mock value
        rollbackComplexity: (totalScore >= 70 ? 'high' : totalScore >= 40 ? 'medium' : 'low') as 'low' | 'medium' | 'high'
      };

      return {
        dependencyId: dep.id,
        score: Math.round(totalScore),
        factors,
        recommendation,
        impactAnalysis,
        testRecommendations: [
          'Run full test suite',
          'Perform integration testing',
          'Check for breaking changes',
          'Validate in staging environment'
        ].slice(0, Math.ceil(totalScore / 25))
      } as RiskAssessmentType;
    });
  }, [dependencies, vulnerabilities, updates]);

  // Filter and sort assessments
  const filteredAssessments = useMemo(() => {
    let filtered = riskAssessments;

    // Apply risk filter
    if (filterRisk !== 'all') {
      filtered = filtered.filter(assessment => {
        if (filterRisk === 'high') return assessment.score >= 70;
        if (filterRisk === 'medium') return assessment.score >= 40 && assessment.score < 70;
        if (filterRisk === 'low') return assessment.score < 40;
        return true;
      });
    }

    // Sort assessments
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'risk':
          return b.score - a.score;
        case 'name':
          const aName = dependencies.find(d => d.id === a.dependencyId)?.name || '';
          const bName = dependencies.find(d => d.id === b.dependencyId)?.name || '';
          return aName.localeCompare(bName);
        case 'vulnerabilities':
          const aVulns = vulnerabilities.filter(v => v.dependencyId === a.dependencyId).length;
          const bVulns = vulnerabilities.filter(v => v.dependencyId === b.dependencyId).length;
          return bVulns - aVulns;
        default:
          return 0;
      }
    });
  }, [riskAssessments, filterRisk, sortBy, dependencies, vulnerabilities]);

  // Overall statistics
  const stats = useMemo(() => {
    const high = riskAssessments.filter(r => r.score >= 70).length;
    const medium = riskAssessments.filter(r => r.score >= 40 && r.score < 70).length;
    const low = riskAssessments.filter(r => r.score < 40).length;
    const avgScore = riskAssessments.reduce((sum, r) => sum + r.score, 0) / riskAssessments.length;
    
    const immediate = riskAssessments.filter(r => r.recommendation === 'immediate').length;
    const scheduled = riskAssessments.filter(r => r.recommendation === 'scheduled').length;

    return {
      high,
      medium,
      low,
      avgScore: Math.round(avgScore || 0),
      immediate,
      scheduled,
      total: riskAssessments.length
    };
  }, [riskAssessments]);

  // Get risk color
  const getRiskColor = (score: number): string => {
    if (score >= 80) return 'text-red-600 bg-red-50 border-red-200';
    if (score >= 60) return 'text-orange-600 bg-orange-50 border-orange-200';
    if (score >= 40) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  // Get risk icon
  const getRiskIcon = (score: number) => {
    if (score >= 80) return <AlertTriangle className="w-4 h-4 text-red-600" />;
    if (score >= 60) return <AlertTriangle className="w-4 h-4 text-orange-600" />;
    if (score >= 40) return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
    return <CheckCircle className="w-4 h-4 text-green-600" />;
  };

  // Get recommendation styling
  const getRecommendationColor = (recommendation: RiskRecommendation): string => {
    switch (recommendation) {
      case 'immediate': return 'bg-red-100 text-red-800';
      case 'scheduled': return 'bg-yellow-100 text-yellow-800';
      case 'monitor': return 'bg-blue-100 text-blue-800';
      case 'defer': return 'bg-gray-100 text-gray-800';
    }
  };

  // Get dependency name
  const getDependencyName = (dependencyId: string): string => {
    const dep = dependencies.find(d => d.id === dependencyId);
    return dep?.name || 'Unknown';
  };

  const selectedAssessment = selectedDependency ? 
    riskAssessments.find(r => r.dependencyId === selectedDependency) : null;

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Average Risk</p>
              <p className={`text-xl font-bold ${
                stats.avgScore >= 70 ? 'text-red-600' : 
                stats.avgScore >= 40 ? 'text-yellow-600' : 'text-green-600'
              }`}>
                {stats.avgScore}
              </p>
            </div>
            <Activity className="w-6 h-6 text-blue-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">High Risk</p>
              <p className="text-xl font-bold text-red-600">{stats.high}</p>
            </div>
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Medium Risk</p>
              <p className="text-xl font-bold text-yellow-600">{stats.medium}</p>
            </div>
            <AlertTriangle className="w-6 h-6 text-yellow-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Immediate Action</p>
              <p className="text-xl font-bold text-red-500">{stats.immediate}</p>
            </div>
            <Target className="w-6 h-6 text-red-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Scheduled</p>
              <p className="text-xl font-bold text-yellow-500">{stats.scheduled}</p>
            </div>
            <Clock className="w-6 h-6 text-yellow-500" />
          </div>
        </Card>
      </div>

      {/* Controls */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Risk Filter */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">Risk Level:</span>
              {(['all', 'high', 'medium', 'low'] as const).map(level => (
                <button
                  key={level}
                  onClick={() => setFilterRisk(level)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    filterRisk === level
                      ? level === 'high' ? 'bg-red-100 text-red-800' :
                        level === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        level === 'low' ? 'bg-green-100 text-green-800' :
                        'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="risk">Risk Score</option>
              <option value="name">Name</option>
              <option value="vulnerabilities">Vulnerabilities</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Risk Assessments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {filteredAssessments.map((assessment) => (
            <Card
              key={assessment.dependencyId}
              className={`p-4 cursor-pointer transition-all hover:shadow-lg border ${
                selectedDependency === assessment.dependencyId ? 'ring-2 ring-blue-500 bg-blue-50' : ''
              } ${getRiskColor(assessment.score)}`}
              onClick={() => setSelectedDependency(assessment.dependencyId)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-2">
                    {getRiskIcon(assessment.score)}
                    <h3 className="font-semibold text-gray-900">
                      {getDependencyName(assessment.dependencyId)}
                    </h3>
                  </div>

                  <div className="flex items-center space-x-2 mb-3">
                    <Badge className={getRecommendationColor(assessment.recommendation)}>
                      {assessment.recommendation.toUpperCase()}
                    </Badge>
                    <span className="text-sm text-gray-600">
                      Risk Score: <span className="font-semibold">{assessment.score}</span>
                    </span>
                  </div>

                  {/* Risk Factors Preview */}
                  <div className="space-y-1">
                    {assessment.factors.slice(0, 2).map((factor, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{factor.type}</span>
                        <span className={`font-medium ${
                          factor.score >= 70 ? 'text-red-600' : 
                          factor.score >= 40 ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                          {factor.score}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex-shrink-0 text-right">
                  <div className={`text-2xl font-bold ${
                    assessment.score >= 80 ? 'text-red-600' : 
                    assessment.score >= 60 ? 'text-orange-600' :
                    assessment.score >= 40 ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    {assessment.score}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {vulnerabilities.filter(v => v.dependencyId === assessment.dependencyId).length} vulns
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Risk Assessment Details */}
        <div className="lg:sticky lg:top-4">
          {selectedAssessment ? (
            <Card className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">
                    {getDependencyName(selectedAssessment.dependencyId)}
                  </h2>
                  <div className="flex items-center space-x-2">
                    <Badge className={getRecommendationColor(selectedAssessment.recommendation)}>
                      {selectedAssessment.recommendation.toUpperCase()}
                    </Badge>
                    <span className={`text-lg font-bold ${
                      selectedAssessment.score >= 80 ? 'text-red-600' : 
                      selectedAssessment.score >= 60 ? 'text-orange-600' :
                      selectedAssessment.score >= 40 ? 'text-yellow-600' : 'text-green-600'
                    }`}>
                      Risk Score: {selectedAssessment.score}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDependency(null)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <XCircle className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Risk Factors */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Risk Factors</h3>
                  <div className="space-y-3">
                    {selectedAssessment.factors.map((factor, index) => (
                      <div key={index} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">{factor.type}</span>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-600">
                              Weight: {Math.round(factor.weight * 100)}%
                            </span>
                            <span className={`font-semibold ${
                              factor.score >= 70 ? 'text-red-600' : 
                              factor.score >= 40 ? 'text-yellow-600' : 'text-green-600'
                            }`}>
                              {factor.score}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600">{factor.description}</p>
                        
                        {/* Risk bar */}
                        <div className="mt-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                factor.score >= 70 ? 'bg-red-500' : 
                                factor.score >= 40 ? 'bg-yellow-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${factor.score}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Impact Analysis */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Impact Analysis</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Breaking Changes</span>
                      <span className={`font-medium ${
                        selectedAssessment.impactAnalysis.breakingChanges ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {selectedAssessment.impactAnalysis.breakingChanges ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Test Coverage</span>
                      <span className="font-medium text-gray-900">
                        {selectedAssessment.impactAnalysis.testCoverage}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Rollback Complexity</span>
                      <Badge className={
                        selectedAssessment.impactAnalysis.rollbackComplexity === 'high' ? 'bg-red-100 text-red-800' :
                        selectedAssessment.impactAnalysis.rollbackComplexity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }>
                        {selectedAssessment.impactAnalysis.rollbackComplexity}
                      </Badge>
                    </div>
                    {selectedAssessment.impactAnalysis.dependentComponents.length > 0 && (
                      <div>
                        <span className="text-gray-600">Dependent Components:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedAssessment.impactAnalysis.dependentComponents.map((comp, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {comp}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Test Recommendations */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Recommended Tests</h3>
                  <ul className="space-y-2">
                    {selectedAssessment.testRecommendations.map((test, index) => (
                      <li key={index} className="flex items-center space-x-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <span className="text-gray-700">{test}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-8 text-center">
              <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Dependency</h3>
              <p className="text-gray-600">
                Click on a dependency from the list to see detailed risk assessment and recommendations.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          Showing {filteredAssessments.length} of {stats.total} risk assessments
        </span>
        <span>
          Average risk score: {stats.avgScore}/100
        </span>
      </div>
    </div>
  );
};

export default RiskAssessment;