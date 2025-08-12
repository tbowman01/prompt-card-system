import { render, screen, waitFor, act } from '@testing-library/react'
import { MetricsOverview } from '@/components/Analytics/MetricsOverview'
import * as apiModule from '@/lib/api'
import { DashboardMetrics } from '@/types'

// Mock the API module
jest.mock('@/lib/api')
const mockApi = apiModule as jest.Mocked<typeof apiModule>

// Mock timers for interval testing
jest.useFakeTimers()

describe('MetricsOverview', () => {
  const mockMetrics: DashboardMetrics = {
    realtime: {
      activeTests: 5,
      testsPerSecond: 2.5,
      successRate: 0.92,
      averageResponseTime: 850,
      errorRate: 0.08,
    },
    historical: {
      totalTests: 12500,
      totalExecutions: 280,
      overallSuccessRate: 0.89,
      averageExecutionTime: 1200,
      mostUsedModels: [
        { model: 'gpt-4', count: 5000 },
        { model: 'claude-3', count: 3500 },
        { model: 'gpt-3.5-turbo', count: 2000 },
        { model: 'llama-2', count: 1500 },
        { model: 'mistral', count: 500 },
      ],
    },
    trends: {
      testsOverTime: [],
      successRateOverTime: [],
      performanceOverTime: [],
    },
    insights: [
      {
        id: '1',
        type: 'trend',
        title: 'Performance Improvement',
        description: 'Response times have improved by 20% this week',
        severity: 'low',
        data: {},
        timestamp: new Date('2024-01-15T10:00:00Z'),
        recommendations: ['Continue current optimizations', 'Monitor resource usage'],
      },
      {
        id: '2',
        type: 'anomaly',
        title: 'High Error Rate Detected',
        description: 'Error rate has increased significantly in the last hour',
        severity: 'critical',
        data: {},
        timestamp: new Date('2024-01-15T11:00:00Z'),
        recommendations: ['Check system logs', 'Investigate model performance'],
      },
    ],
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockApi.api.getDashboardMetrics = jest.fn()
  })

  afterEach(() => {
    jest.clearAllTimers()
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  describe('Loading State', () => {
    it('shows loading spinner while fetching data', () => {
      mockApi.api.getDashboardMetrics.mockReturnValue(new Promise(() => {})) // Never resolves
      
      render(<MetricsOverview />)
      
      expect(screen.getByRole('status')).toBeInTheDocument() // LoadingSpinner has status role
      expect(screen.queryByText('Real-time Metrics')).not.toBeInTheDocument()
    })

    it('shows correct loading message', () => {
      mockApi.api.getDashboardMetrics.mockReturnValue(new Promise(() => {}))
      
      render(<MetricsOverview />)
      
      const loadingElement = screen.getByRole('status')
      expect(loadingElement).toHaveClass('h-64') // Large loading area
    })
  })

  describe('Success State', () => {
    beforeEach(() => {
      mockApi.api.getDashboardMetrics.mockResolvedValue(mockMetrics)
    })

    it('renders real-time metrics section', async () => {
      render(<MetricsOverview />)
      
      await waitFor(() => {
        expect(screen.getByText('Real-time Metrics')).toBeInTheDocument()
      })

      expect(screen.getByText('Active Tests')).toBeInTheDocument()
      expect(screen.getByText('5')).toBeInTheDocument()

      expect(screen.getByText('Tests/Second')).toBeInTheDocument()
      expect(screen.getByText('2.5')).toBeInTheDocument()

      expect(screen.getByText('Success Rate')).toBeInTheDocument()
      expect(screen.getByText('92.0%')).toBeInTheDocument()

      expect(screen.getByText('Avg Response Time')).toBeInTheDocument()
      expect(screen.getByText('850ms')).toBeInTheDocument()

      expect(screen.getByText('Error Rate')).toBeInTheDocument()
      expect(screen.getByText('8.0%')).toBeInTheDocument()
    })

    it('renders historical metrics section', async () => {
      render(<MetricsOverview />)
      
      await waitFor(() => {
        expect(screen.getByText('Historical Overview')).toBeInTheDocument()
      })

      expect(screen.getByText('Total Tests')).toBeInTheDocument()
      expect(screen.getByText('12.5K')).toBeInTheDocument()

      expect(screen.getByText('Total Executions')).toBeInTheDocument()
      expect(screen.getByText('280')).toBeInTheDocument()

      expect(screen.getByText('Overall Success Rate')).toBeInTheDocument()
      expect(screen.getByText('89.0%')).toBeInTheDocument()

      expect(screen.getByText('Avg Execution Time')).toBeInTheDocument()
      expect(screen.getByText('1.2s')).toBeInTheDocument()
    })

    it('renders most used models section', async () => {
      render(<MetricsOverview />)
      
      await waitFor(() => {
        expect(screen.getByText('Most Used Models')).toBeInTheDocument()
      })

      expect(screen.getByText('gpt-4')).toBeInTheDocument()
      expect(screen.getByText('5.0K tests')).toBeInTheDocument()

      expect(screen.getByText('claude-3')).toBeInTheDocument()
      expect(screen.getByText('3.5K tests')).toBeInTheDocument()

      expect(screen.getByText('gpt-3.5-turbo')).toBeInTheDocument()
      expect(screen.getByText('2.0K tests')).toBeInTheDocument()

      // Check ranking badges
      expect(screen.getByText('#1')).toBeInTheDocument()
      expect(screen.getByText('#2')).toBeInTheDocument()
      expect(screen.getByText('#3')).toBeInTheDocument()
    })

    it('renders insights section when insights exist', async () => {
      render(<MetricsOverview />)
      
      await waitFor(() => {
        expect(screen.getByText('System Insights')).toBeInTheDocument()
      })

      expect(screen.getByText('Performance Improvement')).toBeInTheDocument()
      expect(screen.getByText('Response times have improved by 20% this week')).toBeInTheDocument()

      expect(screen.getByText('High Error Rate Detected')).toBeInTheDocument()
      expect(screen.getByText('Error rate has increased significantly in the last hour')).toBeInTheDocument()

      // Check severity badges
      expect(screen.getByText('low')).toBeInTheDocument()
      expect(screen.getByText('critical')).toBeInTheDocument()

      // Check recommendations
      expect(screen.getByText('Continue current optimizations')).toBeInTheDocument()
      expect(screen.getByText('Check system logs')).toBeInTheDocument()
    })

    it('does not render insights section when no insights', async () => {
      const metricsWithoutInsights = { ...mockMetrics, insights: [] }
      mockApi.api.getDashboardMetrics.mockResolvedValue(metricsWithoutInsights)
      
      render(<MetricsOverview />)
      
      await waitFor(() => {
        expect(screen.getByText('Historical Overview')).toBeInTheDocument()
      })

      expect(screen.queryByText('System Insights')).not.toBeInTheDocument()
    })
  })

  describe('Error State', () => {
    it('shows error message when API fails', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
      mockApi.api.getDashboardMetrics.mockRejectedValue(new Error('Network error'))
      
      render(<MetricsOverview />)
      
      await waitFor(() => {
        expect(screen.getByText('Failed to load metrics')).toBeInTheDocument()
      })

      const errorContainer = screen.getByText('Failed to load metrics').parentElement
      expect(errorContainer).toHaveClass('bg-red-50', 'border', 'border-red-200', 'rounded-lg', 'p-4')
      expect(screen.getByText('Failed to load metrics')).toHaveClass('text-red-800')

      consoleError.mockRestore()
    })

    it('handles API returning null/undefined', async () => {
      mockApi.api.getDashboardMetrics.mockResolvedValue(null as any)
      
      render(<MetricsOverview />)
      
      await waitFor(() => {
        expect(screen.getByText('No metrics available')).toBeInTheDocument()
      })

      const noDataContainer = screen.getByText('No metrics available').parentElement
      expect(noDataContainer).toHaveClass('bg-gray-50', 'border', 'border-gray-200', 'rounded-lg', 'p-4')
    })
  })

  describe('Metric Severity Indicators', () => {
    beforeEach(() => {
      mockApi.api.getDashboardMetrics.mockResolvedValue(mockMetrics)
    })

    it('applies correct severity colors for success rate', async () => {
      render(<MetricsOverview />)
      
      await waitFor(() => {
        expect(screen.getByText('Success Rate')).toBeInTheDocument()
      })

      const successRateCard = screen.getByText('Success Rate').closest('.bg-green-50')
      expect(successRateCard).toBeInTheDocument() // 92% success rate = green (success)
    })

    it('applies correct severity colors for response time', async () => {
      render(<MetricsOverview />)
      
      await waitFor(() => {
        expect(screen.getByText('Avg Response Time')).toBeInTheDocument()
      })

      const responseTimeCard = screen.getByText('Avg Response Time').closest('.bg-green-50')
      expect(responseTimeCard).toBeInTheDocument() // 850ms = green (success)
    })

    it('applies correct severity colors for error rate', async () => {
      render(<MetricsOverview />)
      
      await waitFor(() => {
        expect(screen.getByText('Error Rate')).toBeInTheDocument()
      })

      const errorRateCard = screen.getByText('Error Rate').closest('.bg-green-50')
      expect(errorRateCard).toBeInTheDocument() // 8% error rate = green (success)
    })
  })

  describe('Auto-refresh Functionality', () => {
    beforeEach(() => {
      mockApi.api.getDashboardMetrics.mockResolvedValue(mockMetrics)
    })

    it('fetches metrics on initial load', async () => {
      render(<MetricsOverview />)
      
      await waitFor(() => {
        expect(mockApi.api.getDashboardMetrics).toHaveBeenCalledTimes(1)
      })
    })

    it('sets up interval to refresh metrics every 30 seconds', async () => {
      render(<MetricsOverview />)
      
      await waitFor(() => {
        expect(mockApi.api.getDashboardMetrics).toHaveBeenCalledTimes(1)
      })

      // Fast-forward 30 seconds
      act(() => {
        jest.advanceTimersByTime(30000)
      })

      await waitFor(() => {
        expect(mockApi.api.getDashboardMetrics).toHaveBeenCalledTimes(2)
      })

      // Fast-forward another 30 seconds
      act(() => {
        jest.advanceTimersByTime(30000)
      })

      await waitFor(() => {
        expect(mockApi.api.getDashboardMetrics).toHaveBeenCalledTimes(3)
      })
    })

    it('clears interval on component unmount', async () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval')
      
      const { unmount } = render(<MetricsOverview />)
      
      await waitFor(() => {
        expect(mockApi.api.getDashboardMetrics).toHaveBeenCalledTimes(1)
      })

      unmount()

      expect(clearIntervalSpy).toHaveBeenCalled()
      clearIntervalSpy.mockRestore()
    })
  })

  describe('Data Formatting', () => {
    beforeEach(() => {
      mockApi.api.getDashboardMetrics.mockResolvedValue(mockMetrics)
    })

    it('formats large numbers correctly', async () => {
      render(<MetricsOverview />)
      
      await waitFor(() => {
        expect(screen.getByText('12.5K')).toBeInTheDocument() // 12,500 total tests
      })
    })

    it('formats millions correctly', async () => {
      const metricsWithMillions = {
        ...mockMetrics,
        historical: {
          ...mockMetrics.historical,
          totalTests: 2500000, // 2.5M
        },
      }
      
      mockApi.api.getDashboardMetrics.mockResolvedValue(metricsWithMillions)
      
      render(<MetricsOverview />)
      
      await waitFor(() => {
        expect(screen.getByText('2.5M')).toBeInTheDocument()
      })
    })

    it('formats percentages correctly', async () => {
      render(<MetricsOverview />)
      
      await waitFor(() => {
        expect(screen.getByText('92.0%')).toBeInTheDocument() // Success rate
        expect(screen.getByText('8.0%')).toBeInTheDocument() // Error rate
      })
    })

    it('formats time correctly', async () => {
      render(<MetricsOverview />)
      
      await waitFor(() => {
        expect(screen.getByText('850ms')).toBeInTheDocument() // Response time
        expect(screen.getByText('1.2s')).toBeInTheDocument() // Execution time
      })
    })

    it('formats timestamps correctly', async () => {
      render(<MetricsOverview />)
      
      await waitFor(() => {
        // Check if timestamps are formatted as locale strings
        const timestamps = screen.getAllByText(/1\/15\/2024/)
        expect(timestamps.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Responsive Design', () => {
    beforeEach(() => {
      mockApi.api.getDashboardMetrics.mockResolvedValue(mockMetrics)
    })

    it('applies responsive grid classes', async () => {
      render(<MetricsOverview />)
      
      await waitFor(() => {
        expect(screen.getByText('Real-time Metrics')).toBeInTheDocument()
      })

      // Check for responsive grid classes on real-time metrics
      const realTimeGrid = screen.getByText('Real-time Metrics').nextElementSibling
      expect(realTimeGrid).toHaveClass('grid', 'grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-5')

      // Check for responsive grid classes on historical metrics
      const historicalGrid = screen.getByText('Historical Overview').nextElementSibling
      expect(historicalGrid).toHaveClass('grid', 'grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-4')

      // Check for responsive grid classes on models
      const modelsGrid = screen.getByText('Most Used Models').nextElementSibling
      const innerGrid = modelsGrid?.querySelector('.grid')
      expect(innerGrid).toHaveClass('grid', 'grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3')
    })
  })

  describe('Performance Considerations', () => {
    it('does not cause unnecessary re-renders', async () => {
      const renderSpy = jest.spyOn(React, 'createElement')
      mockApi.api.getDashboardMetrics.mockResolvedValue(mockMetrics)
      
      const { rerender } = render(<MetricsOverview />)
      
      await waitFor(() => {
        expect(screen.getByText('Real-time Metrics')).toBeInTheDocument()
      })

      const initialCallCount = renderSpy.mock.calls.length
      
      // Re-render with same props shouldn't cause extra renders
      rerender(<MetricsOverview />)
      
      expect(renderSpy.mock.calls.length).toBe(initialCallCount)
      
      renderSpy.mockRestore()
    })
  })
})