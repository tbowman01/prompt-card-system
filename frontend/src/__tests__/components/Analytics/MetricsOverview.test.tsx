import { render, screen, waitFor } from '@testing-library/react'
import { MetricsOverview } from '@/components/Analytics/MetricsOverview'
import { api } from '@/lib/api'
import { DashboardMetrics } from '@/types'

// Mock the API
jest.mock('@/lib/api', () => ({
  api: {
    getDashboardMetrics: jest.fn(),
  },
}))

const mockApiMetrics = api as jest.Mocked<typeof api>

const mockMetrics: DashboardMetrics = {
  realtime: {
    activeTests: 5,
    testsPerSecond: 2.5,
    successRate: 0.85,
    averageResponseTime: 1500,
    errorRate: 0.15,
  },
  historical: {
    totalTests: 1250,
    totalExecutions: 450,
    overallSuccessRate: 0.92,
    averageExecutionTime: 1200,
    mostUsedModels: [
      { model: 'gpt-4', count: 500 },
      { model: 'claude-3', count: 300 },
      { model: 'gpt-3.5-turbo', count: 200 },
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
      title: 'High Error Rate Detected',
      description: 'Error rate has increased to 15% in the last hour',
      severity: 'high',
      data: {},
      timestamp: new Date(),
      recommendations: ['Check API endpoints', 'Review model configurations'],
    },
    {
      id: '2',
      type: 'anomaly',
      title: 'Slow Response Times',
      description: 'Average response time is above normal thresholds',
      severity: 'medium',
      data: {},
      timestamp: new Date(),
    },
  ],
}

describe('MetricsOverview', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Clear any existing intervals
    jest.clearAllTimers()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('shows loading state initially', () => {
    mockApiMetrics.getDashboardMetrics.mockImplementation(() => 
      new Promise(() => {}) // Never resolves
    )

    render(<MetricsOverview />)
    
    expect(screen.getByRole('generic')).toHaveClass('animate-spin')
  })

  it('displays metrics when loaded successfully', async () => {
    mockApiMetrics.getDashboardMetrics.mockResolvedValue(mockMetrics)

    render(<MetricsOverview />)

    await waitFor(() => {
      expect(screen.getByText('Real-time Metrics')).toBeInTheDocument()
    })

    // Check real-time metrics
    expect(screen.getByText('Active Tests')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('Tests/Second')).toBeInTheDocument()
    expect(screen.getByText('2.5')).toBeInTheDocument()
    expect(screen.getByText('Success Rate')).toBeInTheDocument()
    expect(screen.getByText('85.0%')).toBeInTheDocument()

    // Check historical metrics
    expect(screen.getByText('Historical Overview')).toBeInTheDocument()
    expect(screen.getByText('Total Tests')).toBeInTheDocument()
    expect(screen.getByText('1.3K')).toBeInTheDocument() // Formatted number

    // Check most used models
    expect(screen.getByText('Most Used Models')).toBeInTheDocument()
    expect(screen.getByText('gpt-4')).toBeInTheDocument()
    expect(screen.getByText('500 tests')).toBeInTheDocument()
  })

  it('displays insights when available', async () => {
    mockApiMetrics.getDashboardMetrics.mockResolvedValue(mockMetrics)

    render(<MetricsOverview />)

    await waitFor(() => {
      expect(screen.getByText('System Insights')).toBeInTheDocument()
    })

    expect(screen.getByText('High Error Rate Detected')).toBeInTheDocument()
    expect(screen.getByText('Error rate has increased to 15% in the last hour')).toBeInTheDocument()
    expect(screen.getByText('Slow Response Times')).toBeInTheDocument()

    // Check recommendations
    expect(screen.getByText('Recommendations:')).toBeInTheDocument()
    expect(screen.getByText('Check API endpoints')).toBeInTheDocument()
    expect(screen.getByText('Review model configurations')).toBeInTheDocument()
  })

  it('applies correct severity colors for metrics', async () => {
    mockApiMetrics.getDashboardMetrics.mockResolvedValue(mockMetrics)

    render(<MetricsOverview />)

    await waitFor(() => {
      expect(screen.getByText('Success Rate')).toBeInTheDocument()
    })

    // Find the success rate metric card (85% should be warning)
    const successRateCard = screen.getByText('85.0%').closest('div')
    expect(successRateCard).toHaveClass('bg-yellow-50', 'border-yellow-200')

    // Error rate (15%) should be error severity
    const errorRateCard = screen.getByText('15.0%').closest('div')
    expect(errorRateCard).toHaveClass('bg-red-50', 'border-red-200')
  })

  it('handles API errors gracefully', async () => {
    mockApiMetrics.getDashboardMetrics.mockRejectedValue(new Error('API Error'))

    render(<MetricsOverview />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load metrics')).toBeInTheDocument()
    })

    expect(screen.getByText('Failed to load metrics').closest('div'))
      .toHaveClass('bg-red-50', 'border-red-200')
  })

  it('shows no metrics message when data is null', async () => {
    mockApiMetrics.getDashboardMetrics.mockResolvedValue(null)

    render(<MetricsOverview />)

    await waitFor(() => {
      expect(screen.getByText('No metrics available')).toBeInTheDocument()
    })
  })

  it('refreshes metrics every 30 seconds', async () => {
    mockApiMetrics.getDashboardMetrics.mockResolvedValue(mockMetrics)

    render(<MetricsOverview />)

    await waitFor(() => {
      expect(mockApiMetrics.getDashboardMetrics).toHaveBeenCalledTimes(1)
    })

    // Fast-forward 30 seconds
    jest.advanceTimersByTime(30000)

    await waitFor(() => {
      expect(mockApiMetrics.getDashboardMetrics).toHaveBeenCalledTimes(2)
    })
  })

  it('formats numbers correctly', async () => {
    const largeNumberMetrics = {
      ...mockMetrics,
      historical: {
        ...mockMetrics.historical,
        totalTests: 1500000, // Should format to 1.5M
        totalExecutions: 2500, // Should format to 2.5K
      },
    }

    mockApiMetrics.getDashboardMetrics.mockResolvedValue(largeNumberMetrics)

    render(<MetricsOverview />)

    await waitFor(() => {
      expect(screen.getByText('1.5M')).toBeInTheDocument()
      expect(screen.getByText('2.5K')).toBeInTheDocument()
    })
  })

  it('formats time correctly', async () => {
    mockApiMetrics.getDashboardMetrics.mockResolvedValue(mockMetrics)

    render(<MetricsOverview />)

    await waitFor(() => {
      // 1500ms should be formatted as 1.5s
      expect(screen.getByText('1.5s')).toBeInTheDocument()
      // 1200ms should be formatted as 1.2s
      expect(screen.getByText('1.2s')).toBeInTheDocument()
    })
  })

  it('cleans up interval on unmount', async () => {
    mockApiMetrics.getDashboardMetrics.mockResolvedValue(mockMetrics)

    const { unmount } = render(<MetricsOverview />)

    await waitFor(() => {
      expect(mockApiMetrics.getDashboardMetrics).toHaveBeenCalledTimes(1)
    })

    unmount()

    // Fast-forward time - should not trigger additional API calls
    jest.advanceTimersByTime(30000)
    expect(mockApiMetrics.getDashboardMetrics).toHaveBeenCalledTimes(1)
  })
})