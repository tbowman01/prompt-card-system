'use client';

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  AlertCircle, 
  TrendingUp, 
  Calendar,
  Target,
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  Building,
  Globe,
  Tag
} from 'lucide-react';

interface Budget {
  id: number;
  name: string;
  description?: string;
  type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  amount: number;
  currency: string;
  scope: 'global' | 'workspace' | 'team' | 'user' | 'resource_type';
  scope_id?: string;
  current_spend: number;
  percentage_used: number;
  status: 'active' | 'warning' | 'exceeded' | 'paused';
  start_date: string;
  end_date: string;
  auto_reset: boolean;
  rollover_unused: boolean;
  created_by: string;
  created_at: string;
}

interface BudgetAlert {
  id: number;
  budget_id: number;
  name: string;
  alert_type: 'threshold' | 'forecast' | 'anomaly';
  threshold_percentage: number;
  status: 'active' | 'triggered' | 'resolved';
  severity: 'info' | 'warning' | 'critical';
  notification_channels: string[];
}

interface NewBudget {
  name: string;
  description: string;
  type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  amount: number;
  scope: 'global' | 'workspace' | 'team' | 'user' | 'resource_type';
  scope_id: string;
  start_date: string;
  end_date: string;
  auto_reset: boolean;
  rollover_unused: boolean;
}

export const BudgetManager: React.FC = () => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newBudget, setNewBudget] = useState<NewBudget>({
    name: '',
    description: '',
    type: 'monthly',
    amount: 0,
    scope: 'global',
    scope_id: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    auto_reset: false,
    rollover_unused: false
  });

  useEffect(() => {
    fetchBudgets();
    fetchAlerts();
  }, []);

  const fetchBudgets = async () => {
    try {
      setLoading(true);
      // Mock API call - replace with actual API
      const mockBudgets: Budget[] = [
        {
          id: 1,
          name: 'Engineering Team Monthly',
          description: 'Budget for engineering team infrastructure and services',
          type: 'monthly',
          amount: 15000,
          currency: 'USD',
          scope: 'team',
          scope_id: 'engineering',
          current_spend: 12450.75,
          percentage_used: 83.0,
          status: 'warning',
          start_date: '2024-01-01',
          end_date: '2024-01-31',
          auto_reset: true,
          rollover_unused: false,
          created_by: 'admin@company.com',
          created_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 2,
          name: 'Global Infrastructure',
          description: 'Overall infrastructure budget across all teams',
          type: 'monthly',
          amount: 25000,
          currency: 'USD',
          scope: 'global',
          current_spend: 18750.25,
          percentage_used: 75.0,
          status: 'active',
          start_date: '2024-01-01',
          end_date: '2024-01-31',
          auto_reset: true,
          rollover_unused: true,
          created_by: 'admin@company.com',
          created_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 3,
          name: 'Data Science Compute',
          description: 'ML training and compute resources for data science team',
          type: 'monthly',
          amount: 8000,
          currency: 'USD',
          scope: 'team',
          scope_id: 'data-science',
          current_spend: 8240.50,
          percentage_used: 103.0,
          status: 'exceeded',
          start_date: '2024-01-01',
          end_date: '2024-01-31',
          auto_reset: true,
          rollover_unused: false,
          created_by: 'ds-lead@company.com',
          created_at: '2024-01-01T00:00:00Z'
        }
      ];
      setBudgets(mockBudgets);
    } catch (err) {
      setError('Failed to load budgets');
      console.error('Error fetching budgets:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      // Mock API call
      const mockAlerts: BudgetAlert[] = [
        {
          id: 1,
          budget_id: 1,
          name: 'Engineering 80% Warning',
          alert_type: 'threshold',
          threshold_percentage: 80,
          status: 'triggered',
          severity: 'warning',
          notification_channels: ['email', 'slack']
        },
        {
          id: 2,
          budget_id: 3,
          name: 'Data Science Budget Exceeded',
          alert_type: 'threshold',
          threshold_percentage: 100,
          status: 'triggered',
          severity: 'critical',
          notification_channels: ['email', 'slack', 'pagerduty']
        }
      ];
      setAlerts(mockAlerts);
    } catch (err) {
      console.error('Error fetching alerts:', err);
    }
  };

  const handleCreateBudget = async () => {
    try {
      // Mock API call - replace with actual API
      const newBudgetData: Budget = {
        id: budgets.length + 1,
        ...newBudget,
        currency: 'USD',
        current_spend: 0,
        percentage_used: 0,
        status: 'active',
        created_by: 'current-user@company.com',
        created_at: new Date().toISOString()
      };

      setBudgets([...budgets, newBudgetData]);
      setShowCreateModal(false);
      setNewBudget({
        name: '',
        description: '',
        type: 'monthly',
        amount: 0,
        scope: 'global',
        scope_id: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        auto_reset: false,
        rollover_unused: false
      });
    } catch (err) {
      setError('Failed to create budget');
      console.error('Error creating budget:', err);
    }
  };

  const handleDeleteBudget = async (budgetId: number) => {
    if (!confirm('Are you sure you want to delete this budget?')) return;
    
    try {
      // Mock API call
      setBudgets(budgets.filter(b => b.id !== budgetId));
    } catch (err) {
      setError('Failed to delete budget');
      console.error('Error deleting budget:', err);
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'exceeded': return 'text-red-600 bg-red-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'active': return 'text-green-600 bg-green-100';
      case 'paused': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'exceeded': return <XCircle className="h-4 w-4" />;
      case 'warning': return <AlertCircle className="h-4 w-4" />;
      case 'active': return <CheckCircle className="h-4 w-4" />;
      case 'paused': return <Clock className="h-4 w-4" />;
      default: return <CheckCircle className="h-4 w-4" />;
    }
  };

  const getScopeIcon = (scope: string) => {
    switch (scope) {
      case 'global': return <Globe className="h-4 w-4" />;
      case 'workspace': return <Building className="h-4 w-4" />;
      case 'team': return <Users className="h-4 w-4" />;
      case 'user': return <Users className="h-4 w-4" />;
      case 'resource_type': return <Tag className="h-4 w-4" />;
      default: return <Globe className="h-4 w-4" />;
    }
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
          <h2 className="text-2xl font-bold text-gray-900">Budget Management</h2>
          <p className="text-gray-600">Create, monitor, and manage cost budgets across teams and resources</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Budget
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

      {/* Budget Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Budgets</p>
              <p className="text-2xl font-bold text-gray-900">{budgets.length}</p>
            </div>
            <Target className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Allocated</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(budgets.reduce((sum, b) => sum + b.amount, 0))}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Alerts</p>
              <p className="text-2xl font-bold text-gray-900">
                {alerts.filter(a => a.status === 'triggered').length}
              </p>
            </div>
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* Budget List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Budget Overview</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Budget Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Scope
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usage
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Period
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {budgets.map((budget) => (
                <tr key={budget.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{budget.name}</div>
                      {budget.description && (
                        <div className="text-sm text-gray-500">{budget.description}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      {getScopeIcon(budget.scope)}
                      <span className="ml-2 text-sm text-gray-900 capitalize">
                        {budget.scope}
                        {budget.scope_id && (
                          <span className="text-gray-500"> ({budget.scope_id})</span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {formatCurrency(budget.amount)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{formatCurrency(budget.current_spend)}</span>
                        <span>{budget.percentage_used.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            budget.percentage_used > 100 ? 'bg-red-500' :
                            budget.percentage_used > 80 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(budget.percentage_used, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(budget.status)}`}>
                      {getStatusIcon(budget.status)}
                      <span className="ml-1 capitalize">{budget.status}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      {budget.type.charAt(0).toUpperCase() + budget.type.slice(1)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => setSelectedBudget(budget)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteBudget(budget.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Budget Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Create New Budget</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Budget Name</label>
                  <input
                    type="text"
                    value={newBudget.name}
                    onChange={(e) => setNewBudget({ ...newBudget, name: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Enter budget name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    value={newBudget.description}
                    onChange={(e) => setNewBudget({ ...newBudget, description: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    rows={3}
                    placeholder="Enter budget description"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Budget Type</label>
                    <select
                      value={newBudget.type}
                      onChange={(e) => setNewBudget({ ...newBudget, type: e.target.value as any })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Budget Amount ($)</label>
                    <input
                      type="number"
                      value={newBudget.amount}
                      onChange={(e) => setNewBudget({ ...newBudget, amount: parseFloat(e.target.value) || 0 })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Scope</label>
                    <select
                      value={newBudget.scope}
                      onChange={(e) => setNewBudget({ ...newBudget, scope: e.target.value as any })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="global">Global</option>
                      <option value="workspace">Workspace</option>
                      <option value="team">Team</option>
                      <option value="user">User</option>
                      <option value="resource_type">Resource Type</option>
                    </select>
                  </div>

                  {newBudget.scope !== 'global' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Scope ID</label>
                      <input
                        type="text"
                        value={newBudget.scope_id}
                        onChange={(e) => setNewBudget({ ...newBudget, scope_id: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        placeholder="Enter scope identifier"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Start Date</label>
                    <input
                      type="date"
                      value={newBudget.start_date}
                      onChange={(e) => setNewBudget({ ...newBudget, start_date: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">End Date</label>
                    <input
                      type="date"
                      value={newBudget.end_date}
                      onChange={(e) => setNewBudget({ ...newBudget, end_date: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newBudget.auto_reset}
                      onChange={(e) => setNewBudget({ ...newBudget, auto_reset: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">Auto-reset budget at end of period</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newBudget.rollover_unused}
                      onChange={(e) => setNewBudget({ ...newBudget, rollover_unused: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">Rollover unused budget</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end mt-6 space-x-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-500 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateBudget}
                  disabled={!newBudget.name || newBudget.amount <= 0}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Create Budget
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};