'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { 
  Bell, 
  AlertTriangle, 
  XCircle, 
  CheckCircle, 
  Filter, 
  Search, 
  Clock,
  User,
  Tag,
  ExternalLink,
  Settings,
  Trash2,
  Archive,
  Eye,
  EyeOff
} from 'lucide-react';

interface Alert {
  id: string;
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'acknowledged' | 'resolved' | 'muted';
  source: string;
  category: string;
  timestamp: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  tags: string[];
  metadata: any;
  actions?: Array<{
    label: string;
    action: string;
    url?: string;
  }>;
}

interface AlertsManagerProps {
  data: any;
  config?: any;
  isFullscreen?: boolean;
}

const AlertsManager: React.FC<AlertsManagerProps> = ({
  data,
  config = {},
  isFullscreen = false
}) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<Alert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [filter, setFilter] = useState({
    severity: 'all',
    status: 'all',
    category: 'all',
    search: ''
  });
  const [sortBy, setSortBy] = useState<'timestamp' | 'severity' | 'status'>('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [alertDetailModal, setAlertDetailModal] = useState(false);

  useEffect(() => {
    if (data?.alerts) {
      setAlerts(data.alerts);
    }
  }, [data]);

  useEffect(() => {
    let filtered = [...alerts];

    // Apply filters
    if (filter.severity !== 'all') {
      filtered = filtered.filter(alert => alert.severity === filter.severity);
    }
    if (filter.status !== 'all') {
      filtered = filtered.filter(alert => alert.status === filter.status);
    }
    if (filter.category !== 'all') {
      filtered = filtered.filter(alert => alert.category === filter.category);
    }
    if (filter.search) {
      const searchTerm = filter.search.toLowerCase();
      filtered = filtered.filter(alert => 
        alert.title.toLowerCase().includes(searchTerm) ||
        alert.message.toLowerCase().includes(searchTerm) ||
        alert.source.toLowerCase().includes(searchTerm) ||
        alert.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'severity':
          const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          aValue = severityOrder[a.severity];
          bValue = severityOrder[b.severity];
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'timestamp':
        default:
          aValue = new Date(a.timestamp).getTime();
          bValue = new Date(b.timestamp).getTime();
          break;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredAlerts(filtered);
  }, [alerts, filter, sortBy, sortOrder]);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'medium':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'low':
        return <Bell className="h-4 w-4 text-blue-500" />;
      default:
        return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-red-100 text-red-800';
      case 'acknowledged':
        return 'bg-yellow-100 text-yellow-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'muted':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleAlertAction = async (alertId: string, action: string) => {
    try {
      // API call to perform action
      await fetch(`/api/alerts/${alertId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      // Update local state
      setAlerts(prev => prev.map(alert => {
        if (alert.id === alertId) {
          const now = new Date().toISOString();
          switch (action) {
            case 'acknowledge':
              return { 
                ...alert, 
                status: 'acknowledged', 
                acknowledgedBy: 'Current User',
                acknowledgedAt: now 
              };
            case 'resolve':
              return { 
                ...alert, 
                status: 'resolved', 
                resolvedAt: now 
              };
            case 'mute':
              return { ...alert, status: 'muted' };
            case 'delete':
              return null;
            default:
              return alert;
          }
        }
        return alert;
      }).filter(Boolean) as Alert[]);

      setSelectedAlert(null);
    } catch (error) {
      console.error('Error performing alert action:', error);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const categories = [...new Set(alerts.map(alert => alert.category))];
  const severityLevels = ['low', 'medium', 'high', 'critical'];
  const statusOptions = ['active', 'acknowledged', 'resolved', 'muted'];

  const getAlertCounts = () => {
    return {
      total: alerts.length,
      active: alerts.filter(a => a.status === 'active').length,
      critical: alerts.filter(a => a.severity === 'critical').length,
      high: alerts.filter(a => a.severity === 'high').length
    };
  };

  const counts = getAlertCounts();

  return (
    <div className="h-full flex flex-col">
      {/* Header with counts and controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Bell className="h-5 w-5 text-gray-600" />
            <span className="font-semibold">Alerts</span>
          </div>
          <div className="flex space-x-2">
            <Badge variant="outline">Total: {counts.total}</Badge>
            <Badge variant="destructive">Active: {counts.active}</Badge>
            <Badge variant="secondary">Critical: {counts.critical}</Badge>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-3 w-3 mr-1" />
            Filter
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search alerts..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
              value={filter.search}
              onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="timestamp">Sort by Time</option>
            <option value="severity">Sort by Severity</option>
            <option value="status">Sort by Status</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </Button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <select
              value={filter.severity}
              onChange={(e) => setFilter(prev => ({ ...prev, severity: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All Severities</option>
              {severityLevels.map(level => (
                <option key={level} value={level}>{level.charAt(0).toUpperCase() + level.slice(1)}</option>
              ))}
            </select>

            <select
              value={filter.status}
              onChange={(e) => setFilter(prev => ({ ...prev, status: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All Statuses</option>
              {statusOptions.map(status => (
                <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
              ))}
            </select>

            <select
              value={filter.category}
              onChange={(e) => setFilter(prev => ({ ...prev, category: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilter({ severity: 'all', status: 'all', category: 'all', search: '' })}
            >
              Clear Filters
            </Button>
          </div>
        )}
      </div>

      {/* Alerts List */}
      <div className="flex-1 overflow-auto space-y-2">
        {filteredAlerts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No alerts found</p>
            <p className="text-xs">Try adjusting your filters</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow cursor-pointer"
              onClick={() => {
                setSelectedAlert(alert);
                setAlertDetailModal(true);
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  {getSeverityIcon(alert.severity)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {alert.title}
                      </h4>
                      <Badge className={getSeverityColor(alert.severity)}>
                        {alert.severity.toUpperCase()}
                      </Badge>
                      <Badge className={getStatusColor(alert.status)}>
                        {alert.status.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                      {alert.message}
                    </p>
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span className="flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatTimestamp(alert.timestamp)}
                      </span>
                      <span className="flex items-center">
                        <Tag className="h-3 w-3 mr-1" />
                        {alert.category}
                      </span>
                      <span>{alert.source}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-1 ml-2">
                  {alert.status === 'active' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAlertAction(alert.id, 'acknowledge');
                        }}
                      >
                        <CheckCircle className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAlertAction(alert.id, 'mute');
                        }}
                      >
                        <EyeOff className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {alert.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {alert.tags.map(tag => (
                    <span key={tag} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Alert Detail Modal */}
      <Modal
        isOpen={alertDetailModal}
        onClose={() => {
          setAlertDetailModal(false);
          setSelectedAlert(null);
        }}
        title="Alert Details"
      >
        {selectedAlert && (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                {getSeverityIcon(selectedAlert.severity)}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {selectedAlert.title}
                  </h3>
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge className={getSeverityColor(selectedAlert.severity)}>
                      {selectedAlert.severity.toUpperCase()}
                    </Badge>
                    <Badge className={getStatusColor(selectedAlert.status)}>
                      {selectedAlert.status.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-700">{selectedAlert.message}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="font-medium text-gray-700">Source:</label>
                <p className="text-gray-600">{selectedAlert.source}</p>
              </div>
              <div>
                <label className="font-medium text-gray-700">Category:</label>
                <p className="text-gray-600">{selectedAlert.category}</p>
              </div>
              <div>
                <label className="font-medium text-gray-700">Created:</label>
                <p className="text-gray-600">{new Date(selectedAlert.timestamp).toLocaleString()}</p>
              </div>
              {selectedAlert.acknowledgedAt && (
                <div>
                  <label className="font-medium text-gray-700">Acknowledged:</label>
                  <p className="text-gray-600">
                    {new Date(selectedAlert.acknowledgedAt).toLocaleString()}
                    {selectedAlert.acknowledgedBy && ` by ${selectedAlert.acknowledgedBy}`}
                  </p>
                </div>
              )}
            </div>

            {selectedAlert.tags.length > 0 && (
              <div>
                <label className="font-medium text-gray-700 block mb-2">Tags:</label>
                <div className="flex flex-wrap gap-1">
                  {selectedAlert.tags.map(tag => (
                    <span key={tag} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedAlert.actions && selectedAlert.actions.length > 0 && (
              <div>
                <label className="font-medium text-gray-700 block mb-2">Quick Actions:</label>
                <div className="flex flex-wrap gap-2">
                  {selectedAlert.actions.map((action, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (action.url) {
                          window.open(action.url, '_blank');
                        } else {
                          handleAlertAction(selectedAlert.id, action.action);
                        }
                      }}
                    >
                      {action.url && <ExternalLink className="h-3 w-3 mr-1" />}
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex space-x-2 pt-4 border-t">
              {selectedAlert.status === 'active' && (
                <>
                  <Button
                    onClick={() => handleAlertAction(selectedAlert.id, 'acknowledge')}
                    className="flex-1"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Acknowledge
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleAlertAction(selectedAlert.id, 'resolve')}
                  >
                    Resolve
                  </Button>
                </>
              )}
              {selectedAlert.status === 'acknowledged' && (
                <Button
                  onClick={() => handleAlertAction(selectedAlert.id, 'resolve')}
                  className="flex-1"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Resolve
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => handleAlertAction(selectedAlert.id, 'mute')}
              >
                <EyeOff className="h-4 w-4 mr-2" />
                Mute
              </Button>
              <Button
                variant="outline"
                onClick={() => handleAlertAction(selectedAlert.id, 'delete')}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AlertsManager;