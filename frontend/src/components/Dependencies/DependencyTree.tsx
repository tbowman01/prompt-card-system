'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/Badge';
import { 
  GitBranch, 
  Package, 
  AlertTriangle, 
  ChevronRight, 
  ChevronDown,
  Search,
  Filter,
  Maximize2,
  Minimize2,
  RotateCcw,
  Download,
  Eye,
  EyeOff,
  Layers
} from 'lucide-react';
import {
  DependencyInfo,
  DependencyTreeNode,
  DependencyFilter,
  DependencyType,
  DependencyLocation,
  SeverityLevel
} from '../../types/dependency';

interface DependencyTreeProps {
  dependencies: DependencyInfo[];
  filters: DependencyFilter;
}

const DependencyTree: React.FC<DependencyTreeProps> = ({
  dependencies,
  filters
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'tree' | 'graph'>('tree');
  const [showOnlyProblematic, setShowOnlyProblematic] = useState(false);
  const [maxDepth, setMaxDepth] = useState<number>(5);
  const [searchTerm, setSearchTerm] = useState('');
  const treeRef = useRef<HTMLDivElement>(null);

  // Build dependency tree structure
  const dependencyTree = useMemo(() => {
    // Mock tree structure - in real app, this would come from package manager analysis
    const buildTreeNode = (dep: DependencyInfo, depth: number = 0, visited: Set<string> = new Set()): DependencyTreeNode => {
      // Prevent circular dependencies
      if (visited.has(dep.id) || depth >= maxDepth) {
        return {
          id: dep.id,
          name: dep.name,
          version: dep.version,
          depth,
          children: [],
          vulnerabilities: dep.severity && dep.severity !== 'info' ? 1 : 0,
          outdated: !!(dep.latestVersion && dep.version !== dep.latestVersion),
          size: dep.size || 0,
          optional: dep.type === 'optional'
        };
      }

      const newVisited = new Set([...visited, dep.id]);
      
      // Mock children based on dependency type and name patterns
      const children: DependencyTreeNode[] = [];
      
      if (depth < 3) { // Limit depth for demo
        // Create mock child dependencies
        const childDeps = dependencies.filter(d => {
          // Mock logic: create relationships based on naming patterns
          if (dep.name.includes('react') && d.name.includes('react') && d.id !== dep.id) return true;
          if (dep.name.includes('express') && (d.name.includes('middleware') || d.name.includes('cors'))) return true;
          if (dep.name.includes('@types') && d.name.includes(dep.name.replace('@types/', ''))) return true;
          return Math.random() < 0.1; // Random relationships for demo
        }).slice(0, Math.floor(Math.random() * 4) + 1); // 1-4 children

        children.push(...childDeps.map(childDep => buildTreeNode(childDep, depth + 1, newVisited)));
      }

      return {
        id: dep.id,
        name: dep.name,
        version: dep.version,
        depth,
        children,
        vulnerabilities: dep.severity && dep.severity !== 'info' ? 1 : 0,
        outdated: !!(dep.latestVersion && dep.version !== dep.latestVersion),
        size: dep.size || 0,
        optional: dep.type === 'optional'
      };
    };

    // Get root dependencies (production and development)
    const rootDeps = dependencies.filter(dep => 
      dep.type === 'production' || dep.type === 'development'
    );

    return rootDeps.map(dep => buildTreeNode(dep));
  }, [dependencies, maxDepth]);

  // Filter tree nodes
  const filteredTree = useMemo(() => {
    const filterNode = (node: DependencyTreeNode): DependencyTreeNode | null => {
      // Search filter
      if (searchTerm && !node.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        // Check if any children match
        const filteredChildren = node.children.map(filterNode).filter(Boolean) as DependencyTreeNode[];
        if (filteredChildren.length === 0) {
          return null;
        }
        return { ...node, children: filteredChildren };
      }

      // Problematic filter
      if (showOnlyProblematic && !node.vulnerabilities && !node.outdated) {
        const filteredChildren = node.children.map(filterNode).filter(Boolean) as DependencyTreeNode[];
        if (filteredChildren.length === 0) {
          return null;
        }
        return { ...node, children: filteredChildren };
      }

      // Recursively filter children
      const filteredChildren = node.children.map(filterNode).filter(Boolean) as DependencyTreeNode[];
      return { ...node, children: filteredChildren };
    };

    return dependencyTree.map(filterNode).filter(Boolean) as DependencyTreeNode[];
  }, [dependencyTree, searchTerm, showOnlyProblematic]);

  // Calculate tree statistics
  const treeStats = useMemo(() => {
    const calculateStats = (nodes: DependencyTreeNode[]) => {
      let totalNodes = 0;
      let totalVulnerabilities = 0;
      let totalOutdated = 0;
      let totalSize = 0;
      let maxDepthFound = 0;

      const traverse = (node: DependencyTreeNode) => {
        totalNodes++;
        totalVulnerabilities += node.vulnerabilities;
        if (node.outdated) totalOutdated++;
        totalSize += node.size;
        maxDepthFound = Math.max(maxDepthFound, node.depth);

        node.children.forEach(traverse);
      };

      nodes.forEach(traverse);

      return {
        totalNodes,
        totalVulnerabilities,
        totalOutdated,
        totalSize,
        maxDepthFound
      };
    };

    return calculateStats(filteredTree);
  }, [filteredTree]);

  // Toggle node expansion
  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  // Expand/collapse all nodes
  const expandAll = () => {
    const allNodeIds = new Set<string>();
    const traverse = (node: DependencyTreeNode) => {
      allNodeIds.add(node.id);
      node.children.forEach(traverse);
    };
    filteredTree.forEach(traverse);
    setExpandedNodes(allNodeIds);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  // Get node styling
  const getNodeColor = (node: DependencyTreeNode): string => {
    if (node.vulnerabilities > 0) return 'border-red-200 bg-red-50';
    if (node.outdated) return 'border-yellow-200 bg-yellow-50';
    if (node.optional) return 'border-gray-200 bg-gray-50';
    return 'border-blue-200 bg-blue-50';
  };

  const getNodeIcon = (node: DependencyTreeNode) => {
    if (node.vulnerabilities > 0) return <AlertTriangle className="w-4 h-4 text-red-600" />;
    return <Package className="w-4 h-4 text-blue-600" />;
  };

  // Format size
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  // Render tree node
  const renderTreeNode = (node: DependencyTreeNode, level: number = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children.length > 0;
    const isSelected = selectedNode === node.id;

    return (
      <div key={node.id} className={`${level > 0 ? 'ml-6' : ''}`}>
        <div
          className={`flex items-center space-x-2 p-2 rounded-lg border cursor-pointer transition-all hover:shadow-sm ${
            getNodeColor(node)
          } ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
          onClick={() => setSelectedNode(node.id)}
          style={{ marginLeft: `${level * 20}px` }}
        >
          {/* Expand/collapse button */}
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleNode(node.id);
              }}
              className="flex-shrink-0 p-1 hover:bg-gray-200 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-600" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-600" />
              )}
            </button>
          )}
          
          {!hasChildren && (
            <div className="w-6 h-6 flex-shrink-0" />
          )}

          {/* Node icon */}
          <div className="flex-shrink-0">
            {getNodeIcon(node)}
          </div>

          {/* Node content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className="font-medium text-gray-900 truncate">{node.name}</span>
              <span className="text-sm text-gray-600">v{node.version}</span>
              
              {/* Badges */}
              {node.vulnerabilities > 0 && (
                <Badge className="bg-red-100 text-red-800 text-xs">
                  {node.vulnerabilities} vuln{node.vulnerabilities > 1 ? 's' : ''}
                </Badge>
              )}
              {node.outdated && (
                <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                  Outdated
                </Badge>
              )}
              {node.optional && (
                <Badge className="bg-gray-100 text-gray-800 text-xs">
                  Optional
                </Badge>
              )}
            </div>
            
            {/* Size info */}
            {node.size > 0 && (
              <div className="text-xs text-gray-500 mt-1">
                Size: {formatSize(node.size)}
              </div>
            )}
          </div>

          {/* Children count */}
          {hasChildren && (
            <div className="flex-shrink-0">
              <Badge variant="outline" className="text-xs">
                {node.children.length}
              </Badge>
            </div>
          )}
        </div>

        {/* Render children */}
        {hasChildren && isExpanded && (
          <div className="mt-2 space-y-2">
            {node.children.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Nodes</p>
              <p className="text-xl font-bold text-gray-900">{treeStats.totalNodes}</p>
            </div>
            <GitBranch className="w-6 h-6 text-blue-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Max Depth</p>
              <p className="text-xl font-bold text-purple-600">{treeStats.maxDepthFound}</p>
            </div>
            <Layers className="w-6 h-6 text-purple-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Vulnerabilities</p>
              <p className="text-xl font-bold text-red-600">{treeStats.totalVulnerabilities}</p>
            </div>
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Outdated</p>
              <p className="text-xl font-bold text-yellow-600">{treeStats.totalOutdated}</p>
            </div>
            <Package className="w-6 h-6 text-yellow-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Size</p>
              <p className="text-xl font-bold text-green-600">{formatSize(treeStats.totalSize)}</p>
            </div>
            <Package className="w-6 h-6 text-green-600" />
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

            {/* Filters */}
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={showOnlyProblematic}
                onChange={(e) => setShowOnlyProblematic(e.target.checked)}
                className="rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-sm font-medium text-gray-700">Show only problematic</span>
            </label>

            {/* Max Depth */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">Max depth:</span>
              <select
                value={maxDepth}
                onChange={(e) => setMaxDepth(Number(e.target.value))}
                className="px-3 py-1 border border-gray-300 rounded text-sm"
              >
                <option value={2}>2 levels</option>
                <option value={3}>3 levels</option>
                <option value={5}>5 levels</option>
                <option value={10}>10 levels</option>
                <option value={999}>Unlimited</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Tree actions */}
            <button
              onClick={expandAll}
              className="flex items-center space-x-2 px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Eye className="w-4 h-4" />
              <span>Expand All</span>
            </button>

            <button
              onClick={collapseAll}
              className="flex items-center space-x-2 px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <EyeOff className="w-4 h-4" />
              <span>Collapse All</span>
            </button>

            <button className="flex items-center space-x-2 px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Tree View */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Dependency Tree</h3>
          <div className="text-sm text-gray-600">
            Showing {filteredTree.length} root dependencies
          </div>
        </div>

        <div ref={treeRef} className="max-h-screen overflow-auto">
          {filteredTree.length > 0 ? (
            <div className="space-y-3">
              {filteredTree.map(node => renderTreeNode(node))}
            </div>
          ) : (
            <div className="text-center py-12">
              <GitBranch className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Dependencies Found</h3>
              <p className="text-gray-600">
                {searchTerm || showOnlyProblematic
                  ? "No dependencies match your current filters."
                  : "No dependency tree data available."
                }
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Selected Node Details */}
      {selectedNode && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Node Details: {(() => {
              const findNode = (nodes: DependencyTreeNode[], id: string): DependencyTreeNode | null => {
                for (const node of nodes) {
                  if (node.id === id) return node;
                  const found = findNode(node.children, id);
                  if (found) return found;
                }
                return null;
              };
              const node = findNode(filteredTree, selectedNode);
              return node?.name || 'Unknown';
            })()}
          </h3>
          
          {(() => {
            const findNode = (nodes: DependencyTreeNode[], id: string): DependencyTreeNode | null => {
              for (const node of nodes) {
                if (node.id === id) return node;
                const found = findNode(node.children, id);
                if (found) return found;
              }
              return null;
            };
            const node = findNode(filteredTree, selectedNode);
            
            if (!node) return <p className="text-gray-600">Node not found.</p>;
            
            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Basic Info</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Version:</span>
                      <span className="font-medium">{node.version}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Depth:</span>
                      <span className="font-medium">{node.depth}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Size:</span>
                      <span className="font-medium">{formatSize(node.size)}</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Status</h4>
                  <div className="space-y-2">
                    <Badge className={node.vulnerabilities > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
                      {node.vulnerabilities > 0 ? `${node.vulnerabilities} vulnerabilities` : 'No vulnerabilities'}
                    </Badge>
                    <Badge className={node.outdated ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}>
                      {node.outdated ? 'Outdated' : 'Up to date'}
                    </Badge>
                    {node.optional && (
                      <Badge className="bg-gray-100 text-gray-800">Optional</Badge>
                    )}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Children</h4>
                  <div className="text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Direct children:</span>
                      <span className="font-medium">{node.children.length}</span>
                    </div>
                    {node.children.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {node.children.slice(0, 3).map(child => (
                          <div key={child.id} className="text-xs text-gray-600 truncate">
                            {child.name} v{child.version}
                          </div>
                        ))}
                        {node.children.length > 3 && (
                          <div className="text-xs text-gray-500">
                            +{node.children.length - 3} more...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </Card>
      )}

      {/* Legend */}
      <Card className="p-4">
        <h4 className="font-medium text-gray-900 mb-3">Legend</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border border-red-200 bg-red-50 rounded"></div>
            <span>Has vulnerabilities</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border border-yellow-200 bg-yellow-50 rounded"></div>
            <span>Outdated version</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border border-gray-200 bg-gray-50 rounded"></div>
            <span>Optional dependency</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border border-blue-200 bg-blue-50 rounded"></div>
            <span>Normal dependency</span>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default DependencyTree;