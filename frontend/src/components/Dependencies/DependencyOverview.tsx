'use client';

import React, { useState, useMemo } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/Badge';
import { 
  Package, 
  TrendingUp, 
  AlertTriangle, 
  Calendar, 
  ExternalLink,
  Filter,
  ArrowUpDown,
  Download,
  Users,
  Globe,
  Shield,
  Clock,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import {
  DependencyInfo,
  DashboardMetrics,
  DependencyFilter,
  DependencyType,
  DependencyLocation,
  SeverityLevel
} from '../../types/dependency';

interface DependencyOverviewProps {
  dependencies: DependencyInfo[];
  metrics: DashboardMetrics | null;
  filters: DependencyFilter;
  onFilterChange: (filters: Partial<DependencyFilter>) => void;
}

const DependencyOverview: React.FC<DependencyOverviewProps> = ({
  dependencies,
  metrics,
  filters,
  onFilterChange
}) => {
  const [sortBy, setSortBy] = useState<'name' | 'version' | 'size' | 'updated'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedTypes, setSelectedTypes] = useState<DependencyType[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<DependencyLocation[]>([]);

  // Filter and sort dependencies
  const filteredDependencies = useMemo(() => {
    let filtered = dependencies.filter(dep => {
      // Search term filter
      if (filters.searchTerm && !dep.name.toLowerCase().includes(filters.searchTerm.toLowerCase())) {
        return false;
      }
      
      // Type filter
      if (selectedTypes.length > 0 && !selectedTypes.includes(dep.type)) {
        return false;
      }
      
      // Location filter
      if (selectedLocations.length > 0 && !selectedLocations.includes(dep.location)) {
        return false;
      }
      
      // Vulnerability filter
      if (filters.hasVulnerabilities !== undefined) {
        const hasVulns = dep.severity && dep.severity !== 'info';
        if (filters.hasVulnerabilities !== hasVulns) {
          return false;
        }
      }
      
      // Outdated filter
      if (filters.outdated !== undefined) {
        const isOutdated = dep.latestVersion && dep.version !== dep.latestVersion;
        if (filters.outdated !== isOutdated) {
          return false;
        }
      }
      
      return true;
    });

    // Sort dependencies
    filtered.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortBy) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'version':
          aVal = a.version;
          bVal = b.version;
          break;
        case 'size':
          aVal = a.size || 0;
          bVal = b.size || 0;
          break;
        case 'updated':
          aVal = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
          bVal = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
          break;
        default:
          return 0;
      }

      if (sortDirection === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

    return filtered;
  }, [dependencies, filters, selectedTypes, selectedLocations, sortBy, sortDirection]);

  // Statistics
  const stats = useMemo(() => {
    const total = dependencies.length;
    const outdated = dependencies.filter(d => d.latestVersion && d.version !== d.latestVersion).length;
    const withVulns = dependencies.filter(d => d.severity && d.severity !== 'info').length;
    const production = dependencies.filter(d => d.type === 'production').length;
    const development = dependencies.filter(d => d.type === 'development').length;

    return {
      total,
      outdated,
      withVulnerabilities: withVulns,
      production,
      development,
      outdatedPercentage: total > 0 ? Math.round((outdated / total) * 100) : 0,
      vulnerabilityPercentage: total > 0 ? Math.round((withVulns / total) * 100) : 0
    };
  }, [dependencies]);

  // Handle sorting
  const handleSort = (field: typeof sortBy) => {
    if (field === sortBy) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  };

  // Get dependency type color
  const getTypeColor = (type: DependencyType): string => {
    switch (type) {
      case 'production': return 'bg-green-100 text-green-800';
      case 'development': return 'bg-blue-100 text-blue-800';
      case 'peer': return 'bg-purple-100 text-purple-800';
      case 'optional': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Get location color
  const getLocationColor = (location: DependencyLocation): string => {
    switch (location) {
      case 'frontend': return 'bg-cyan-100 text-cyan-800';
      case 'backend': return 'bg-indigo-100 text-indigo-800';
      case 'root': return 'bg-orange-100 text-orange-800';
      case 'docker': return 'bg-blue-100 text-blue-800';
      case 'github-actions': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Get severity color
  const getSeverityColor = (severity?: SeverityLevel): string => {
    if (!severity || severity === 'info') return '';
    
    switch (severity) {
      case 'critical': return 'border-red-500 bg-red-50';
      case 'high': return 'border-red-400 bg-red-50';
      case 'moderate': return 'border-yellow-400 bg-yellow-50';
      case 'low': return 'border-blue-400 bg-blue-50';
      default: return '';
    }
  };

  // Format file size
  const formatSize = (bytes?: number): string => {
    if (!bytes) return 'Unknown';
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total</p>
              <p className="text-xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Package className="w-6 h-6 text-blue-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Production</p>
              <p className="text-xl font-bold text-green-600">{stats.production}</p>
            </div>
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Development</p>
              <p className="text-xl font-bold text-blue-600">{stats.development}</p>
            </div>
            <Package className="w-6 h-6 text-blue-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Outdated</p>
              <p className="text-xl font-bold text-yellow-600">
                {stats.outdated} ({stats.outdatedPercentage}%)
              </p>
            </div>
            <Clock className="w-6 h-6 text-yellow-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">With Issues</p>
              <p className="text-xl font-bold text-red-600">
                {stats.withVulnerabilities} ({stats.vulnerabilityPercentage}%)
              </p>
            </div>
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
        </Card>
      </div>

      {/* Filters and Controls */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Type Filters */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">Type:</span>
              {['production', 'development', 'peer', 'optional'].map(type => (
                <button
                  key={type}
                  onClick={() => {
                    const newTypes = selectedTypes.includes(type as DependencyType)
                      ? selectedTypes.filter(t => t !== type)
                      : [...selectedTypes, type as DependencyType];
                    setSelectedTypes(newTypes);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedTypes.includes(type as DependencyType)
                      ? getTypeColor(type as DependencyType)
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Location Filters */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">Location:</span>
              {['frontend', 'backend', 'root', 'docker'].map(location => (
                <button
                  key={location}
                  onClick={() => {
                    const newLocations = selectedLocations.includes(location as DependencyLocation)
                      ? selectedLocations.filter(l => l !== location)
                      : [...selectedLocations, location as DependencyLocation];
                    setSelectedLocations(newLocations);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedLocations.includes(location as DependencyLocation)
                      ? getLocationColor(location as DependencyLocation)
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {location}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Sort Controls */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="name">Name</option>
              <option value="version">Version</option>
              <option value="size">Size</option>
              <option value="updated">Last Updated</option>
            </select>
            
            <button
              onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
              className="p-1 border border-gray-300 rounded hover:bg-gray-50"
            >
              <ArrowUpDown className={`w-4 h-4 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
            </button>

            {/* View Mode */}
            <div className="flex border border-gray-300 rounded">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1 text-sm ${
                  viewMode === 'grid' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 text-sm border-l border-gray-300 ${
                  viewMode === 'list' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                List
              </button>
            </div>
          </div>
        </div>

        {/* Active Filters */}
        {(selectedTypes.length > 0 || selectedLocations.length > 0 || filters.searchTerm) && (
          <div className="mt-4 flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Active filters:</span>
            {selectedTypes.map(type => (
              <Badge key={type} className={getTypeColor(type)}>
                {type}
                <button
                  onClick={() => setSelectedTypes(selectedTypes.filter(t => t !== type))}
                  className="ml-1 hover:bg-white hover:bg-opacity-30 rounded"
                >
                  <XCircle className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            {selectedLocations.map(location => (
              <Badge key={location} className={getLocationColor(location)}>
                {location}
                <button
                  onClick={() => setSelectedLocations(selectedLocations.filter(l => l !== location))}
                  className="ml-1 hover:bg-white hover:bg-opacity-30 rounded"
                >
                  <XCircle className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            {filters.searchTerm && (
              <Badge className="bg-gray-100 text-gray-800">
                Search: {filters.searchTerm}
                <button
                  onClick={() => onFilterChange({ searchTerm: '' })}
                  className="ml-1 hover:bg-white hover:bg-opacity-30 rounded"
                >
                  <XCircle className="w-3 h-3" />
                </button>
              </Badge>
            )}
            <button
              onClick={() => {
                setSelectedTypes([]);
                setSelectedLocations([]);
                onFilterChange({ searchTerm: '' });
              }}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Clear all
            </button>
          </div>
        )}
      </Card>

      {/* Dependencies Display */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDependencies.map((dep) => (
            <Card key={dep.id} className={`p-4 hover:shadow-lg transition-shadow ${getSeverityColor(dep.severity)}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{dep.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">v{dep.version}</p>
                  {dep.description && (
                    <p className="text-sm text-gray-500 mt-2 line-clamp-2">{dep.description}</p>
                  )}
                </div>
                {dep.severity && dep.severity !== 'info' && (
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                )}
              </div>

              <div className="flex items-center justify-between mt-4">
                <div className="flex space-x-1">
                  <Badge className={getTypeColor(dep.type)}>{dep.type}</Badge>
                  <Badge className={getLocationColor(dep.location)}>{dep.location}</Badge>
                </div>
                
                {dep.latestVersion && dep.version !== dep.latestVersion && (
                  <Badge variant="warning" className="text-xs">
                    Update available
                  </Badge>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                <span>Size: {formatSize(dep.size)}</span>
                {dep.homepage && (
                  <a
                    href={dep.homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 hover:text-blue-600"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Info</span>
                  </a>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-900">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-900">Version</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-900">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-900">Location</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-900">Size</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-900">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-900">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredDependencies.map((dep) => (
                  <tr key={dep.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">{dep.name}</span>
                        {dep.severity && dep.severity !== 'info' && (
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{dep.version}</td>
                    <td className="px-4 py-3">
                      <Badge className={getTypeColor(dep.type)}>{dep.type}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={getLocationColor(dep.location)}>{dep.location}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatSize(dep.size)}</td>
                    <td className="px-4 py-3">
                      {dep.latestVersion && dep.version !== dep.latestVersion ? (
                        <Badge variant="warning">Outdated</Badge>
                      ) : (
                        <Badge variant="success">Current</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {dep.lastUpdated ? new Date(dep.lastUpdated).toLocaleDateString() : 'Unknown'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          Showing {filteredDependencies.length} of {dependencies.length} dependencies
        </span>
        {filteredDependencies.length !== dependencies.length && (
          <span className="text-blue-600">
            {dependencies.length - filteredDependencies.length} filtered out
          </span>
        )}
      </div>
    </div>
  );
};

export default DependencyOverview;