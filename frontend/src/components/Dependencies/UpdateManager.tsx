'use client';

import React, { useState, useMemo } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { 
  TrendingUp, 
  Calendar, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  XCircle, 
  Eye,
  GitBranch,
  Download,
  Settings,
  Play,
  Pause,
  RotateCcw,
  MessageSquare,
  User,
  ExternalLink,
  Shield,
  Zap,
  Package
} from 'lucide-react';
import {
  UpdateInfo,
  DependencyInfo,
  UpdateApproval,
  ApprovalStatus,
  UpdateType,
  TestResult
} from '../../types/dependency';

interface UpdateManagerProps {
  updates: UpdateInfo[];
  dependencies: DependencyInfo[];
  onUpdateApproved: () => void;
}

const UpdateManager: React.FC<UpdateManagerProps> = ({
  updates,
  dependencies,
  onUpdateApproved
}) => {
  const [selectedUpdate, setSelectedUpdate] = useState<UpdateInfo | null>(null);
  const [approvals, setApprovals] = useState<UpdateApproval[]>([]);
  const [filterType, setFilterType] = useState<UpdateType | 'all'>('all');
  const [showSecurityOnly, setShowSecurityOnly] = useState(false);
  const [showBreakingOnly, setShowBreakingOnly] = useState(false);
  const [processing, setProcessing] = useState<Set<string>>(new Set());

  // Update statistics
  const stats = useMemo(() => {
    const total = updates.length;
    const major = updates.filter(u => u.updateType === 'major').length;
    const minor = updates.filter(u => u.updateType === 'minor').length;
    const patch = updates.filter(u => u.updateType === 'patch').length;
    const security = updates.filter(u => u.securityFix).length;
    const breaking = updates.filter(u => u.breakingChanges).length;
    const autoApproved = approvals.filter(a => a.status === 'approved').length;

    return {
      total,
      major,
      minor,
      patch,
      security,
      breaking,
      autoApproved,
      securityPercentage: total > 0 ? Math.round((security / total) * 100) : 0,
      breakingPercentage: total > 0 ? Math.round((breaking / total) * 100) : 0
    };
  }, [updates, approvals]);

  // Filter updates
  const filteredUpdates = useMemo(() => {
    return updates.filter(update => {
      // Type filter
      if (filterType !== 'all' && update.updateType !== filterType) {
        return false;
      }

      // Security filter
      if (showSecurityOnly && !update.securityFix) {
        return false;
      }

      // Breaking changes filter
      if (showBreakingOnly && !update.breakingChanges) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      // Sort by priority: security first, then breaking changes, then by update type
      if (a.securityFix && !b.securityFix) return -1;
      if (!a.securityFix && b.securityFix) return 1;
      
      if (a.breakingChanges && !b.breakingChanges) return -1;
      if (!a.breakingChanges && b.breakingChanges) return 1;

      const typeOrder = { major: 0, minor: 1, patch: 2, prerelease: 3 };
      return typeOrder[a.updateType] - typeOrder[b.updateType];
    });
  }, [updates, filterType, showSecurityOnly, showBreakingOnly]);

  // Get update type styling
  const getUpdateTypeColor = (type: UpdateType): string => {
    switch (type) {
      case 'major': return 'bg-red-100 text-red-800';
      case 'minor': return 'bg-yellow-100 text-yellow-800';
      case 'patch': return 'bg-green-100 text-green-800';
      case 'prerelease': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Get dependency name
  const getDependencyName = (dependencyId: string): string => {
    const dep = dependencies.find(d => d.id === dependencyId);
    return dep?.name || 'Unknown';
  };

  // Handle update approval
  const handleApproval = async (updateId: string, action: 'approve' | 'reject') => {
    setProcessing(prev => new Set([...prev, updateId]));
    
    try {
      const response = await fetch(`/api/dependencies/updates/${updateId}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          comment: `${action === 'approve' ? 'Approved' : 'Rejected'} via dashboard`
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} update`);
      }

      // Update local state
      const approval = await response.json();
      setApprovals(prev => [...prev.filter(a => a.dependencyId !== updateId), approval]);
      
      if (action === 'approve') {
        onUpdateApproved();
      }
    } catch (error) {
      console.error(`Failed to ${action} update:`, error);
    } finally {
      setProcessing(prev => {
        const newSet = new Set(prev);
        newSet.delete(updateId);
        return newSet;
      });
    }
  };

  // Handle bulk update
  const handleBulkUpdate = async (type: 'patch' | 'security') => {
    const targetUpdates = updates.filter(u => 
      type === 'patch' ? u.updateType === 'patch' && !u.breakingChanges :
      type === 'security' ? u.securityFix : false
    );

    for (const update of targetUpdates) {
      await handleApproval(update.dependencyId, 'approve');
    }
  };

  // Get approval status for update
  const getApprovalStatus = (updateId: string): ApprovalStatus | null => {
    const approval = approvals.find(a => a.dependencyId === updateId);
    return approval?.status || null;
  };

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total</p>
              <p className="text-xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <TrendingUp className="w-6 h-6 text-blue-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Major</p>
              <p className="text-xl font-bold text-red-600">{stats.major}</p>
            </div>
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Minor</p>
              <p className="text-xl font-bold text-yellow-600">{stats.minor}</p>
            </div>
            <Package className="w-6 h-6 text-yellow-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Patch</p>
              <p className="text-xl font-bold text-green-600">{stats.patch}</p>
            </div>
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Security</p>
              <p className="text-xl font-bold text-red-500">{stats.security}</p>
            </div>
            <Shield className="w-6 h-6 text-red-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Breaking</p>
              <p className="text-xl font-bold text-orange-600">{stats.breaking}</p>
            </div>
            <Zap className="w-6 h-6 text-orange-600" />
          </div>
        </Card>
      </div>

      {/* Controls */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Type Filter */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">Type:</span>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as UpdateType | 'all')}
                className="px-3 py-1 border border-gray-300 rounded text-sm"
              >
                <option value="all">All Types</option>
                <option value="major">Major</option>
                <option value="minor">Minor</option>
                <option value="patch">Patch</option>
                <option value="prerelease">Prerelease</option>
              </select>
            </div>

            {/* Security Filter */}
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={showSecurityOnly}
                onChange={(e) => setShowSecurityOnly(e.target.checked)}
                className="rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-sm font-medium text-gray-700">Security fixes only</span>
            </label>

            {/* Breaking Changes Filter */}
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={showBreakingOnly}
                onChange={(e) => setShowBreakingOnly(e.target.checked)}
                className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
              />
              <span className="text-sm font-medium text-gray-700">Breaking changes only</span>
            </label>
          </div>

          <div className="flex items-center space-x-2">
            {/* Bulk Actions */}
            <button
              onClick={() => handleBulkUpdate('patch')}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Auto-approve Patches</span>
            </button>

            <button
              onClick={() => handleBulkUpdate('security')}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              <Shield className="w-4 h-4" />
              <span>Auto-approve Security</span>
            </button>

            <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Updates List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {filteredUpdates.length > 0 ? (
            filteredUpdates.map((update) => {
              const approvalStatus = getApprovalStatus(update.dependencyId);
              const isProcessing = processing.has(update.dependencyId);

              return (
                <Card 
                  key={update.dependencyId} 
                  className={`p-4 cursor-pointer transition-all hover:shadow-lg ${
                    selectedUpdate?.dependencyId === update.dependencyId ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                  } ${approvalStatus === 'approved' ? 'bg-green-50 border-green-200' : ''} ${approvalStatus === 'rejected' ? 'bg-red-50 border-red-200' : ''}`}
                  onClick={() => setSelectedUpdate(update)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge className={getUpdateTypeColor(update.updateType)}>
                          {update.updateType.toUpperCase()}
                        </Badge>
                        {update.securityFix && (
                          <Badge className="bg-red-100 text-red-800">
                            <Shield className="w-3 h-3 mr-1" />
                            Security Fix
                          </Badge>
                        )}
                        {update.breakingChanges && (
                          <Badge className="bg-orange-100 text-orange-800">
                            <Zap className="w-3 h-3 mr-1" />
                            Breaking
                          </Badge>
                        )}
                        {approvalStatus && (
                          <Badge className={
                            approvalStatus === 'approved' ? 'bg-green-100 text-green-800' :
                            approvalStatus === 'rejected' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }>
                            {approvalStatus}
                          </Badge>
                        )}
                      </div>

                      <h3 className="font-semibold text-gray-900 mb-1">
                        {getDependencyName(update.dependencyId)}
                      </h3>
                      <p className="text-sm text-gray-600 mb-2">
                        {update.currentVersion} → {update.targetVersion}
                      </p>
                      
                      {update.releaseDate && (
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(update.releaseDate).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-shrink-0">
                      {!approvalStatus && !isProcessing && (
                        <div className="flex space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApproval(update.dependencyId, 'approve');
                            }}
                            className="p-1 text-green-600 hover:bg-green-100 rounded"
                            title="Approve"
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApproval(update.dependencyId, 'reject');
                            }}
                            className="p-1 text-red-600 hover:bg-red-100 rounded"
                            title="Reject"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                      {isProcessing && (
                        <LoadingSpinner size="small" />
                      )}
                    </div>
                  </div>

                  {(update.requiredBy.length > 0 || update.blockedBy.length > 0) && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      {update.requiredBy.length > 0 && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Required by:</span> {update.requiredBy.join(', ')}
                        </p>
                      )}
                      {update.blockedBy.length > 0 && (
                        <p className="text-sm text-red-600">
                          <span className="font-medium">Blocked by:</span> {update.blockedBy.join(', ')}
                        </p>
                      )}
                    </div>
                  )}
                </Card>
              );
            })
          ) : (
            <Card className="p-8 text-center">
              <TrendingUp className="w-12 h-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">All Up to Date!</h3>
              <p className="text-gray-600">
                {updates.length === 0 
                  ? "All dependencies are up to date."
                  : "No updates match your current filters."
                }
              </p>
            </Card>
          )}
        </div>

        {/* Update Details Panel */}
        <div className="lg:sticky lg:top-4">
          {selectedUpdate ? (
            <Card className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">
                    {getDependencyName(selectedUpdate.dependencyId)}
                  </h2>
                  <div className="flex items-center space-x-2 mb-2">
                    <Badge className={getUpdateTypeColor(selectedUpdate.updateType)}>
                      {selectedUpdate.updateType.toUpperCase()}
                    </Badge>
                    {selectedUpdate.securityFix && (
                      <Badge className="bg-red-100 text-red-800">Security Fix</Badge>
                    )}
                    {selectedUpdate.breakingChanges && (
                      <Badge className="bg-orange-100 text-orange-800">Breaking Changes</Badge>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedUpdate(null)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <XCircle className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Version Info */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Version Update</h3>
                  <div className="flex items-center space-x-2 text-lg">
                    <span className="font-mono text-gray-600">{selectedUpdate.currentVersion}</span>
                    <TrendingUp className="w-4 h-4 text-gray-400" />
                    <span className="font-mono font-semibold text-gray-900">{selectedUpdate.targetVersion}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Size: {(selectedUpdate.size / 1024).toFixed(1)} KB
                  </p>
                </div>

                {/* Release Info */}
                {selectedUpdate.releaseDate && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Release Information</h3>
                    <div className="text-sm text-gray-600">
                      <p>Released: {new Date(selectedUpdate.releaseDate).toLocaleDateString()}</p>
                      {selectedUpdate.changelogUrl && (
                        <a
                          href={selectedUpdate.changelogUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 mt-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>View Changelog</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Dependencies */}
                {(selectedUpdate.requiredBy.length > 0 || selectedUpdate.blockedBy.length > 0) && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Dependencies</h3>
                    {selectedUpdate.requiredBy.length > 0 && (
                      <div className="mb-2">
                        <p className="text-sm font-medium text-gray-700">Required by:</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedUpdate.requiredBy.map((dep, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {dep}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedUpdate.blockedBy.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-red-700">Blocked by:</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedUpdate.blockedBy.map((dep, index) => (
                            <Badge key={index} className="bg-red-100 text-red-800 text-xs">
                              {dep}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Security Information */}
                {selectedUpdate.securityFix && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center space-x-2 mb-1">
                      <Shield className="w-4 h-4 text-red-600" />
                      <span className="font-medium text-red-800">Security Fix</span>
                    </div>
                    <p className="text-sm text-red-700">
                      This update contains important security fixes. Consider prioritizing this update.
                    </p>
                  </div>
                )}

                {/* Breaking Changes Warning */}
                {selectedUpdate.breakingChanges && (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex items-center space-x-2 mb-1">
                      <Zap className="w-4 h-4 text-orange-600" />
                      <span className="font-medium text-orange-800">Breaking Changes</span>
                    </div>
                    <p className="text-sm text-orange-700">
                      This update contains breaking changes that may require code modifications.
                      Review the changelog carefully before applying.
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex space-x-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => handleApproval(selectedUpdate.dependencyId, 'approve')}
                    disabled={processing.has(selectedUpdate.dependencyId)}
                    className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Approve Update</span>
                  </button>
                  <button
                    onClick={() => handleApproval(selectedUpdate.dependencyId, 'reject')}
                    disabled={processing.has(selectedUpdate.dependencyId)}
                    className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject Update</span>
                  </button>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-8 text-center">
              <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Select an Update</h3>
              <p className="text-gray-600">
                Click on an update from the list to see detailed information and manage approval.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          Showing {filteredUpdates.length} of {updates.length} updates
        </span>
        <span>
          {stats.autoApproved} approved automatically
        </span>
      </div>
    </div>
  );
};

export default UpdateManager;