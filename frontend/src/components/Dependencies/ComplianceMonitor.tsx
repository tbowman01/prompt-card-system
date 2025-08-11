'use client';

import React, { useState, useMemo } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  ExternalLink,
  FileText,
  Scale,
  Eye,
  Download,
  RefreshCw,
  Filter,
  Search,
  Users,
  Globe,
  Lock,
  Unlock,
  AlertCircle
} from 'lucide-react';
import {
  DependencyInfo,
  LicenseInfo,
  ComplianceCheck,
  PolicyViolation,
  LicenseCategory,
  SeverityLevel
} from '../../types/dependency';

interface ComplianceMonitorProps {
  dependencies: DependencyInfo[];
  onComplianceCheck: () => void;
}

const ComplianceMonitor: React.FC<ComplianceMonitorProps> = ({
  dependencies,
  onComplianceCheck
}) => {
  const [selectedDependency, setSelectedDependency] = useState<string | null>(null);
  const [filterLicense, setFilterLicense] = useState<LicenseCategory | 'all'>('all');
  const [filterCompliance, setFilterCompliance] = useState<'all' | 'compliant' | 'violations'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [scanning, setScanning] = useState(false);

  // Mock compliance data (in real app, this would come from API)
  const complianceData = useMemo(() => {
    return dependencies.map(dep => {
      // Mock license information
      const licenses: { [key: string]: LicenseInfo } = {
        'MIT': {
          spdxId: 'MIT',
          name: 'MIT License',
          url: 'https://opensource.org/licenses/MIT',
          category: 'permissive',
          permissions: ['Commercial use', 'Modification', 'Distribution', 'Private use'],
          conditions: ['License and copyright notice'],
          limitations: ['Liability', 'Warranty'],
          riskLevel: 'low'
        },
        'Apache-2.0': {
          spdxId: 'Apache-2.0',
          name: 'Apache License 2.0',
          url: 'https://opensource.org/licenses/Apache-2.0',
          category: 'permissive',
          permissions: ['Commercial use', 'Modification', 'Distribution', 'Patent use', 'Private use'],
          conditions: ['License and copyright notice', 'State changes'],
          limitations: ['Liability', 'Trademark use', 'Warranty'],
          riskLevel: 'low'
        },
        'GPL-3.0': {
          spdxId: 'GPL-3.0',
          name: 'GNU General Public License v3.0',
          url: 'https://opensource.org/licenses/GPL-3.0',
          category: 'copyleft',
          permissions: ['Commercial use', 'Modification', 'Distribution', 'Patent use', 'Private use'],
          conditions: ['Disclose source', 'License and copyright notice', 'Same license', 'State changes'],
          limitations: ['Liability', 'Warranty'],
          riskLevel: 'high'
        },
        'ISC': {
          spdxId: 'ISC',
          name: 'ISC License',
          url: 'https://opensource.org/licenses/ISC',
          category: 'permissive',
          permissions: ['Commercial use', 'Modification', 'Distribution', 'Private use'],
          conditions: ['License and copyright notice'],
          limitations: ['Liability', 'Warranty'],
          riskLevel: 'low'
        },
        'BSD-3-Clause': {
          spdxId: 'BSD-3-Clause',
          name: 'BSD 3-Clause License',
          url: 'https://opensource.org/licenses/BSD-3-Clause',
          category: 'permissive',
          permissions: ['Commercial use', 'Modification', 'Distribution', 'Private use'],
          conditions: ['License and copyright notice'],
          limitations: ['Liability', 'Warranty'],
          riskLevel: 'low'
        }
      };

      // Assign random license
      const licenseKeys = Object.keys(licenses);
      const randomLicense = licenseKeys[Math.floor(Math.random() * licenseKeys.length)];
      const licenseInfo = licenses[randomLicense];

      // Generate compliance violations based on license
      const violations: PolicyViolation[] = [];
      
      if (licenseInfo.category === 'copyleft') {
        violations.push({
          type: 'Copyleft License',
          severity: 'high' as SeverityLevel,
          description: 'This dependency uses a copyleft license that may require source code disclosure',
          resolution: 'Review legal requirements and consider alternative dependencies'
        });
      }

      if (dep.name.includes('crypto') || dep.name.includes('ssl')) {
        violations.push({
          type: 'Export Restrictions',
          severity: 'moderate' as SeverityLevel,
          description: 'Cryptographic software may be subject to export regulations',
          resolution: 'Verify compliance with export control laws'
        });
      }

      // Random policy violations for demonstration
      if (Math.random() < 0.1) {
        violations.push({
          type: 'Outdated License',
          severity: 'moderate' as SeverityLevel,
          description: 'License information may be outdated or incomplete',
          resolution: 'Update license information and verify with package maintainer'
        });
      }

      return {
        dependencyId: dep.id,
        license: licenseInfo,
        compliance: {
          dependencyId: dep.id,
          licenseCompatible: violations.length === 0,
          organizationPolicy: violations,
          securityCompliant: violations.filter(v => v.type.includes('Security')).length === 0,
          lastChecked: new Date().toISOString()
        } as ComplianceCheck
      };
    });
  }, [dependencies]);

  // Filter compliance data
  const filteredCompliance = useMemo(() => {
    return complianceData.filter(item => {
      const dep = dependencies.find(d => d.id === item.dependencyId);
      if (!dep) return false;

      // Search filter
      if (searchTerm && !dep.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !item.license.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      // License category filter
      if (filterLicense !== 'all' && item.license.category !== filterLicense) {
        return false;
      }

      // Compliance filter
      if (filterCompliance === 'compliant' && !item.compliance.licenseCompatible) {
        return false;
      }
      if (filterCompliance === 'violations' && item.compliance.licenseCompatible) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      // Sort by risk level, then by violations
      if (a.license.riskLevel !== b.license.riskLevel) {
        const riskOrder = { high: 0, moderate: 1, low: 2, info: 3 };
        return riskOrder[a.license.riskLevel] - riskOrder[b.license.riskLevel];
      }
      return b.compliance.organizationPolicy.length - a.compliance.organizationPolicy.length;
    });
  }, [complianceData, dependencies, searchTerm, filterLicense, filterCompliance]);

  // Statistics
  const stats = useMemo(() => {
    const total = complianceData.length;
    const compliant = complianceData.filter(item => item.compliance.licenseCompatible).length;
    const violations = total - compliant;
    const highRisk = complianceData.filter(item => item.license.riskLevel === 'high').length;
    
    const licenseCategories = complianceData.reduce((acc, item) => {
      acc[item.license.category] = (acc[item.license.category] || 0) + 1;
      return acc;
    }, {} as Record<LicenseCategory, number>);

    return {
      total,
      compliant,
      violations,
      highRisk,
      licenseCategories,
      compliancePercentage: total > 0 ? Math.round((compliant / total) * 100) : 100
    };
  }, [complianceData]);

  // Get license category color
  const getLicenseCategoryColor = (category: LicenseCategory): string => {
    switch (category) {
      case 'permissive': return 'bg-green-100 text-green-800';
      case 'copyleft': return 'bg-orange-100 text-orange-800';
      case 'proprietary': return 'bg-red-100 text-red-800';
      case 'public-domain': return 'bg-blue-100 text-blue-800';
      case 'unknown': return 'bg-gray-100 text-gray-800';
    }
  };

  // Get risk level color
  const getRiskLevelColor = (level: SeverityLevel): string => {
    switch (level) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-red-500 bg-red-50 border-red-200';
      case 'moderate': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  // Get dependency name
  const getDependencyName = (dependencyId: string): string => {
    const dep = dependencies.find(d => d.id === dependencyId);
    return dep?.name || 'Unknown';
  };

  // Handle compliance scan
  const handleScan = async () => {
    setScanning(true);
    try {
      // Simulate scan
      await new Promise(resolve => setTimeout(resolve, 3000));
      onComplianceCheck();
    } finally {
      setScanning(false);
    }
  };

  const selectedItem = selectedDependency ? 
    complianceData.find(item => item.dependencyId === selectedDependency) : null;

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Checked</p>
              <p className="text-xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Scale className="w-6 h-6 text-blue-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Compliant</p>
              <p className="text-xl font-bold text-green-600">
                {stats.compliant} ({stats.compliancePercentage}%)
              </p>
            </div>
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Violations</p>
              <p className="text-xl font-bold text-red-600">{stats.violations}</p>
            </div>
            <XCircle className="w-6 h-6 text-red-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">High Risk</p>
              <p className="text-xl font-bold text-orange-600">{stats.highRisk}</p>
            </div>
            <AlertTriangle className="w-6 h-6 text-orange-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Permissive</p>
              <p className="text-xl font-bold text-green-500">
                {stats.licenseCategories.permissive || 0}
              </p>
            </div>
            <Unlock className="w-6 h-6 text-green-500" />
          </div>
        </Card>
      </div>

      {/* Controls */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search dependencies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* License Category Filter */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">License:</span>
              {(['all', 'permissive', 'copyleft', 'proprietary'] as const).map(category => (
                <button
                  key={category}
                  onClick={() => setFilterLicense(category)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    filterLicense === category
                      ? category === 'all' ? 'bg-blue-100 text-blue-800' : getLicenseCategoryColor(category)
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            {/* Compliance Filter */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">Status:</span>
              {(['all', 'compliant', 'violations'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setFilterCompliance(status)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    filterCompliance === status
                      ? status === 'compliant' ? 'bg-green-100 text-green-800' :
                        status === 'violations' ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleScan}
              disabled={scanning}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
              <span>{scanning ? 'Scanning...' : 'Scan Compliance'}</span>
            </button>

            <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              <Download className="w-4 h-4" />
              <span>Export Report</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Compliance List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {filteredCompliance.length > 0 ? (
            filteredCompliance.map((item) => (
              <Card
                key={item.dependencyId}
                className={`p-4 cursor-pointer transition-all hover:shadow-lg border ${
                  selectedDependency === item.dependencyId ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                } ${!item.compliance.licenseCompatible ? 'border-red-200 bg-red-50' : ''}`}
                onClick={() => setSelectedDependency(item.dependencyId)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="font-semibold text-gray-900">
                        {getDependencyName(item.dependencyId)}
                      </h3>
                      {item.compliance.licenseCompatible ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      )}
                    </div>

                    <div className="flex items-center space-x-2 mb-2">
                      <Badge className={getLicenseCategoryColor(item.license.category)}>
                        {item.license.category}
                      </Badge>
                      <Badge className={getRiskLevelColor(item.license.riskLevel)}>
                        {item.license.riskLevel} risk
                      </Badge>
                    </div>

                    <p className="text-sm text-gray-600 mb-2">{item.license.name}</p>

                    {item.compliance.organizationPolicy.length > 0 && (
                      <div className="text-sm">
                        <span className="font-medium text-red-700">
                          {item.compliance.organizationPolicy.length} violation(s)
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-shrink-0">
                    <Badge className={
                      item.compliance.licenseCompatible ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }>
                      {item.compliance.licenseCompatible ? 'Compliant' : 'Issues'}
                    </Badge>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-8 text-center">
              <Shield className="w-12 h-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">All Dependencies Compliant</h3>
              <p className="text-gray-600">
                {complianceData.length === 0 
                  ? "No compliance data available. Run a scan to check dependencies."
                  : "No dependencies match your current filters."
                }
              </p>
            </Card>
          )}
        </div>

        {/* Compliance Details Panel */}
        <div className="lg:sticky lg:top-4">
          {selectedItem ? (
            <Card className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">
                    {getDependencyName(selectedItem.dependencyId)}
                  </h2>
                  <div className="flex items-center space-x-2">
                    <Badge className={getLicenseCategoryColor(selectedItem.license.category)}>
                      {selectedItem.license.category}
                    </Badge>
                    <Badge className={getRiskLevelColor(selectedItem.license.riskLevel)}>
                      {selectedItem.license.riskLevel} risk
                    </Badge>
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
                {/* License Information */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">License Information</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Name</span>
                      <span className="font-medium text-gray-900">{selectedItem.license.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">SPDX ID</span>
                      <span className="font-mono text-gray-900">{selectedItem.license.spdxId}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Category</span>
                      <Badge className={getLicenseCategoryColor(selectedItem.license.category)}>
                        {selectedItem.license.category}
                      </Badge>
                    </div>
                    {selectedItem.license.url && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">License Text</span>
                        <a
                          href={selectedItem.license.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-1 text-blue-600 hover:text-blue-800"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>View</span>
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Permissions */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Permissions</h3>
                  <div className="flex flex-wrap gap-1">
                    {selectedItem.license.permissions.map((permission, index) => (
                      <Badge key={index} className="bg-green-100 text-green-800 text-xs">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        {permission}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Conditions */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Conditions</h3>
                  <div className="flex flex-wrap gap-1">
                    {selectedItem.license.conditions.map((condition, index) => (
                      <Badge key={index} className="bg-blue-100 text-blue-800 text-xs">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        {condition}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Limitations */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Limitations</h3>
                  <div className="flex flex-wrap gap-1">
                    {selectedItem.license.limitations.map((limitation, index) => (
                      <Badge key={index} className="bg-red-100 text-red-800 text-xs">
                        <XCircle className="w-3 h-3 mr-1" />
                        {limitation}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Policy Violations */}
                {selectedItem.compliance.organizationPolicy.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Policy Violations</h3>
                    <div className="space-y-3">
                      {selectedItem.compliance.organizationPolicy.map((violation, index) => (
                        <div key={index} className="p-3 border rounded-lg bg-red-50 border-red-200">
                          <div className="flex items-start justify-between mb-2">
                            <span className="font-medium text-red-800">{violation.type}</span>
                            <Badge className={getRiskLevelColor(violation.severity)}>
                              {violation.severity}
                            </Badge>
                          </div>
                          <p className="text-sm text-red-700 mb-2">{violation.description}</p>
                          <div className="text-xs text-red-600">
                            <span className="font-medium">Resolution:</span> {violation.resolution}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Compliance Status */}
                <div className={`p-3 rounded-lg border ${
                  selectedItem.compliance.licenseCompatible 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center space-x-2 mb-1">
                    {selectedItem.compliance.licenseCompatible ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                    <span className={`font-medium ${
                      selectedItem.compliance.licenseCompatible ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {selectedItem.compliance.licenseCompatible ? 'Compliant' : 'Non-Compliant'}
                    </span>
                  </div>
                  <p className={`text-sm ${
                    selectedItem.compliance.licenseCompatible ? 'text-green-700' : 'text-red-700'
                  }`}>
                    Last checked: {new Date(selectedItem.compliance.lastChecked).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-8 text-center">
              <Scale className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Dependency</h3>
              <p className="text-gray-600">
                Click on a dependency from the list to see detailed license and compliance information.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          Showing {filteredCompliance.length} of {stats.total} dependencies
        </span>
        <span>
          Compliance rate: {stats.compliancePercentage}%
        </span>
      </div>
    </div>
  );
};

export default ComplianceMonitor;