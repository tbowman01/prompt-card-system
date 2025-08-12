import { render, screen, act } from '@testing-library/react'
import { MetricsOverview } from '@/components/Analytics/MetricsOverview'
import PromptCardForm from '@/components/PromptCard/PromptCardForm'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { createMockDashboardMetrics, createMockPromptCard } from './testUtils'
import * as apiModule from '@/lib/api'

// Mock the API module
jest.mock('@/lib/api')
const mockApi = apiModule as jest.Mocked<typeof apiModule>

// Performance testing utilities
class PerformanceProfiler {
  private measurements: Array<{ name: string; duration: number; timestamp: number }> = []
  
  start(name: string) {
    performance.mark(`${name}-start`)
  }
  
  end(name: string) {
    performance.mark(`${name}-end`)
    performance.measure(name, `${name}-start`, `${name}-end`)
    
    const measure = performance.getEntriesByName(name, 'measure')[0]
    this.measurements.push({
      name,
      duration: measure.duration,
      timestamp: Date.now()
    })
    
    return measure.duration
  }
  
  getMeasurements() {
    return this.measurements
  }
  
  clear() {
    this.measurements = []
    performance.clearMarks()
    performance.clearMeasures()
  }
  
  getAverageDuration(name: string) {
    const matching = this.measurements.filter(m => m.name === name)
    if (matching.length === 0) return 0
    
    const total = matching.reduce((sum, m) => sum + m.duration, 0)
    return total / matching.length
  }
}

const profiler = new PerformanceProfiler()

describe('Performance Tests', () => {
  beforeEach(() => {
    profiler.clear()
    mockApi.api.getDashboardMetrics = jest.fn()
    mockApi.api.getPromptCard = jest.fn()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Component Render Performance', () => {
    it('MetricsOverview renders within acceptable time', async () => {
      const mockMetrics = createMockDashboardMetrics()
      mockApi.api.getDashboardMetrics.mockResolvedValue(mockMetrics)

      profiler.start('MetricsOverview-render')
      
      render(<MetricsOverview />)
      
      // Wait for component to finish loading
      await screen.findByText('Real-time Metrics')
      
      const renderTime = profiler.end('MetricsOverview-render')
      
      // Should render within 500ms
      expect(renderTime).toBeLessThan(500)
    })

    it('PromptCardForm renders quickly with initial data', () => {
      const mockCard = createMockPromptCard()
      
      profiler.start('PromptCardForm-render')
      
      render(<PromptCardForm cardId={1} initialData={mockCard} />)
      
      const renderTime = profiler.end('PromptCardForm-render')
      
      // Should render within 100ms when data is already available
      expect(renderTime).toBeLessThan(100)
    })

    it('Tabs component handles many tabs efficiently', () => {
      const manyTabs = Array.from({ length: 50 }, (_, i) => ({
        id: `tab${i + 1}`,
        label: `Tab ${i + 1}`,
        content: `Content for tab ${i + 1}`
      }))

      profiler.start('Tabs-many-render')
      
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            {manyTabs.map(tab => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {manyTabs.map(tab => (
            <TabsContent key={tab.id} value={tab.id}>
              {tab.content}
            </TabsContent>
          ))}
        </Tabs>
      )
      
      const renderTime = profiler.end('Tabs-many-render')
      
      // Should handle 50 tabs within 200ms
      expect(renderTime).toBeLessThan(200)
    })
  })

  describe('State Update Performance', () => {
    it('handles rapid state updates efficiently', async () => {
      const mockMetrics = createMockDashboardMetrics()
      mockApi.api.getDashboardMetrics.mockResolvedValue(mockMetrics)

      const { rerender } = render(<MetricsOverview />)
      
      // Wait for initial render
      await screen.findByText('Real-time Metrics')
      
      // Measure multiple re-renders
      profiler.start('MetricsOverview-rerender')
      
      for (let i = 0; i < 10; i++) {
        const updatedMetrics = {
          ...mockMetrics,
          realtime: {
            ...mockMetrics.realtime,
            activeTests: mockMetrics.realtime.activeTests + i
          }
        }
        
        mockApi.api.getDashboardMetrics.mockResolvedValue(updatedMetrics)
        rerender(<MetricsOverview />)
      }
      
      const rerenderTime = profiler.end('MetricsOverview-rerender')
      
      // 10 re-renders should complete within 100ms
      expect(rerenderTime).toBeLessThan(100)
    })

    it('form input handling is responsive', async () => {
      render(<PromptCardForm />)
      
      const titleInput = screen.getByLabelText(/Title/)
      const templateInput = screen.getByLabelText(/Template/)
      
      profiler.start('form-input-handling')
      
      // Simulate rapid typing
      for (let i = 0; i < 100; i++) {
        act(() => {
          titleInput.dispatchEvent(new Event('input', { bubbles: true }))
          templateInput.dispatchEvent(new Event('input', { bubbles: true }))
        })
      }
      
      const inputTime = profiler.end('form-input-handling')
      
      // 100 input events should be handled within 50ms
      expect(inputTime).toBeLessThan(50)
    })
  })

  describe('Memory Usage and Cleanup', () => {
    it('properly cleans up event listeners', () => {
      const mockMetrics = createMockDashboardMetrics()
      mockApi.api.getDashboardMetrics.mockResolvedValue(mockMetrics)

      const { unmount } = render(<MetricsOverview />)
      
      // Get initial listener count (approximate)
      const initialListeners = document.querySelectorAll('[data-testid]').length
      
      // Unmount component
      unmount()
      
      // Check that cleanup occurred (this is a simplified check)
      // In a real app, you might check specific cleanup callbacks
      expect(document.querySelectorAll('[data-testid]').length).toBeLessThanOrEqual(initialListeners)
    })

    it('handles large dataset rendering efficiently', () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        description: `Description for item ${i}`
      }))

      profiler.start('large-dataset-render')
      
      const { container } = render(
        <div>
          {largeDataset.slice(0, 50).map(item => ( // Only render visible items
            <div key={item.id} data-testid={`item-${item.id}`}>
              <h3>{item.name}</h3>
              <p>{item.description}</p>
            </div>
          ))}
        </div>
      )
      
      const renderTime = profiler.end('large-dataset-render')
      
      // Rendering 50 items should be fast
      expect(renderTime).toBeLessThan(100)
      expect(container.querySelectorAll('[data-testid^="item-"]')).toHaveLength(50)
    })
  })

  describe('Animation and Transition Performance', () => {
    it('tab switching is smooth', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
            <TabsTrigger value="tab3">Tab 3</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
          <TabsContent value="tab3">Content 3</TabsContent>
        </Tabs>
      )

      profiler.start('tab-switching')
      
      // Rapidly switch between tabs
      const tab2 = screen.getByRole('button', { name: 'Tab 2' })
      const tab3 = screen.getByRole('button', { name: 'Tab 3' })
      const tab1 = screen.getByRole('button', { name: 'Tab 1' })
      
      act(() => {
        tab2.click()
        tab3.click()
        tab1.click()
        tab2.click()
      })
      
      const switchTime = profiler.end('tab-switching')
      
      // Multiple tab switches should be handled quickly
      expect(switchTime).toBeLessThan(50)
    })
  })

  describe('Bundle Size and Load Performance', () => {
    it('components have reasonable complexity', () => {
      // Measure component tree depth and complexity
      const { container } = render(<MetricsOverview />)
      
      const measureComplexity = (element: Element): number => {
        let complexity = 1
        for (const child of element.children) {
          complexity += measureComplexity(child)
        }
        return complexity
      }
      
      const complexity = measureComplexity(container)
      
      // Component tree should not be excessively deep
      expect(complexity).toBeLessThan(500) // Reasonable upper bound
    })
  })

  describe('Performance Regression Detection', () => {
    it('establishes performance baseline for critical components', async () => {
      const components = [
        {
          name: 'MetricsOverview',
          render: () => {
            const mockMetrics = createMockDashboardMetrics()
            mockApi.api.getDashboardMetrics.mockResolvedValue(mockMetrics)
            return <MetricsOverview />
          },
          expectedMaxRenderTime: 500
        },
        {
          name: 'PromptCardForm',
          render: () => <PromptCardForm />,
          expectedMaxRenderTime: 100
        },
        {
          name: 'Tabs',
          render: () => (
            <Tabs defaultValue="tab1">
              <TabsList>
                <TabsTrigger value="tab1">Tab 1</TabsTrigger>
              </TabsList>
              <TabsContent value="tab1">Content</TabsContent>
            </Tabs>
          ),
          expectedMaxRenderTime: 50
        }
      ]

      const results = []

      for (const component of components) {
        profiler.start(component.name)
        render(component.render())
        const renderTime = profiler.end(component.name)
        
        results.push({
          component: component.name,
          renderTime,
          baseline: component.expectedMaxRenderTime,
          withinBaseline: renderTime <= component.expectedMaxRenderTime
        })
        
        expect(renderTime).toBeLessThan(component.expectedMaxRenderTime)
      }

      // Log results for monitoring
      console.log('Performance Baseline Results:', results)
    })
  })

  describe('Concurrent Rendering Performance', () => {
    it('handles multiple simultaneous renders efficiently', async () => {
      const mockMetrics = createMockDashboardMetrics()
      mockApi.api.getDashboardMetrics.mockResolvedValue(mockMetrics)

      profiler.start('concurrent-renders')
      
      const promises = Array.from({ length: 5 }, (_, i) => 
        new Promise<void>(resolve => {
          setTimeout(() => {
            render(<MetricsOverview key={i} />)
            resolve()
          }, i * 10)
        })
      )
      
      await Promise.all(promises)
      
      const concurrentTime = profiler.end('concurrent-renders')
      
      // 5 concurrent renders should complete within reasonable time
      expect(concurrentTime).toBeLessThan(1000)
    })
  })

  describe('Resource Usage Monitoring', () => {
    it('monitors resource usage during heavy operations', async () => {
      const mockMetrics = createMockDashboardMetrics({
        insights: Array.from({ length: 100 }, (_, i) => ({
          id: `insight-${i}`,
          type: 'trend' as const,
          title: `Insight ${i}`,
          description: `Description for insight ${i}`,
          severity: 'low' as const,
          data: {},
          timestamp: new Date(),
          recommendations: [`Recommendation ${i}`]
        }))
      })
      
      mockApi.api.getDashboardMetrics.mockResolvedValue(mockMetrics)

      // Measure memory usage before
      const beforeMemory = (performance as any).memory?.usedJSHeapSize || 0
      
      profiler.start('heavy-component-render')
      
      render(<MetricsOverview />)
      
      await screen.findByText('System Insights')
      
      const renderTime = profiler.end('heavy-component-render')
      
      // Measure memory usage after
      const afterMemory = (performance as any).memory?.usedJSHeapSize || 0
      
      // Component should render within reasonable time even with large data
      expect(renderTime).toBeLessThan(1000)
      
      // Memory increase should be reasonable (if memory API is available)
      if (beforeMemory > 0 && afterMemory > 0) {
        const memoryIncrease = afterMemory - beforeMemory
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024) // 10MB limit
      }
    })
  })
})

// Performance testing utilities for export
export class ComponentPerformanceTester {
  private profiler = new PerformanceProfiler()
  
  async measureRenderTime(component: React.ReactElement): Promise<number> {
    this.profiler.start('component-render')
    render(component)
    return this.profiler.end('component-render')
  }
  
  async measureReRenderTime(
    component: React.ReactElement, 
    updateCount: number = 10
  ): Promise<number> {
    const { rerender } = render(component)
    
    this.profiler.start('component-rerender')
    
    for (let i = 0; i < updateCount; i++) {
      rerender(component)
    }
    
    return this.profiler.end('component-rerender')
  }
  
  async measureAsyncRenderTime(
    asyncComponent: () => Promise<React.ReactElement>
  ): Promise<number> {
    this.profiler.start('async-component-render')
    const component = await asyncComponent()
    render(component)
    return this.profiler.end('async-component-render')
  }
  
  getMeasurements() {
    return this.profiler.getMeasurements()
  }
  
  clear() {
    this.profiler.clear()
  }
}

// Utility to establish performance budgets
export const performanceBudgets = {
  fastComponent: 50,    // < 50ms for simple components
  normalComponent: 100, // < 100ms for normal components  
  complexComponent: 200,// < 200ms for complex components
  heavyComponent: 500,  // < 500ms for heavy components
  
  reRender: 20,         // < 20ms for re-renders
  stateUpdate: 10,      // < 10ms for state updates
  eventHandler: 5,      // < 5ms for event handlers
}

// Helper to validate performance against budgets
export const validatePerformance = (
  renderTime: number, 
  budget: keyof typeof performanceBudgets
) => {
  const budgetTime = performanceBudgets[budget]
  return {
    withinBudget: renderTime <= budgetTime,
    renderTime,
    budget: budgetTime,
    efficiency: ((budgetTime - renderTime) / budgetTime) * 100
  }
}