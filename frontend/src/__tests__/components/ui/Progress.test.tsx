import { render, screen } from '@testing-library/react'
import { Progress } from '@/components/ui/progress'

describe('Progress', () => {
  it('renders with default props', () => {
    render(<Progress value={50} />)
    
    const progressContainer = screen.getByRole('progressbar')
    expect(progressContainer).toBeInTheDocument()
    expect(progressContainer).toHaveClass(
      'relative',
      'h-4',
      'w-full',
      'overflow-hidden',
      'rounded-full',
      'bg-gray-200'
    )
  })

  it('displays correct progress value', () => {
    render(<Progress value={75} />)
    
    const progressBar = screen.getByRole('progressbar').firstElementChild
    expect(progressBar).toHaveStyle('transform: translateX(-25%)')
  })

  it('handles 0% progress', () => {
    render(<Progress value={0} />)
    
    const progressBar = screen.getByRole('progressbar').firstElementChild
    expect(progressBar).toHaveStyle('transform: translateX(-100%)')
  })

  it('handles 100% progress', () => {
    render(<Progress value={100} />)
    
    const progressBar = screen.getByRole('progressbar').firstElementChild
    expect(progressBar).toHaveStyle('transform: translateX(0%)')
  })

  it('clamps values above max to 100%', () => {
    render(<Progress value={150} />)
    
    const progressBar = screen.getByRole('progressbar').firstElementChild
    expect(progressBar).toHaveStyle('transform: translateX(0%)')
  })

  it('clamps negative values to 0%', () => {
    render(<Progress value={-50} />)
    
    const progressBar = screen.getByRole('progressbar').firstElementChild
    expect(progressBar).toHaveStyle('transform: translateX(-100%)')
  })

  describe('Custom max value', () => {
    it('calculates percentage based on custom max', () => {
      render(<Progress value={25} max={50} />)
      
      // 25 out of 50 = 50%
      const progressBar = screen.getByRole('progressbar').firstElementChild
      expect(progressBar).toHaveStyle('transform: translateX(-50%)')
    })

    it('handles max value of 0 gracefully', () => {
      render(<Progress value={10} max={0} />)
      
      // Should show 100% when max is 0 (to avoid division by zero)
      const progressBar = screen.getByRole('progressbar').firstElementChild
      expect(progressBar).toHaveStyle('transform: translateX(0%)')
    })

    it('works with decimal values', () => {
      render(<Progress value={7.5} max={10} />)
      
      // 7.5 out of 10 = 75%
      const progressBar = screen.getByRole('progressbar').firstElementChild
      expect(progressBar).toHaveStyle('transform: translateX(-25%)')
    })
  })

  describe('Styling', () => {
    it('applies custom className', () => {
      render(<Progress value={50} className="custom-progress" />)
      
      const progressContainer = screen.getByRole('progressbar')
      expect(progressContainer).toHaveClass('custom-progress')
      expect(progressContainer).toHaveClass('relative', 'h-4') // Base classes should remain
    })

    it('has correct progress bar styling', () => {
      render(<Progress value={50} />)
      
      const progressBar = screen.getByRole('progressbar').firstElementChild
      expect(progressBar).toHaveClass(
        'h-full',
        'w-full',
        'flex-1',
        'bg-blue-600',
        'transition-all'
      )
    })

    it('maintains consistent height', () => {
      render(<Progress value={30} />)
      
      const progressContainer = screen.getByRole('progressbar')
      const progressBar = progressContainer.firstElementChild
      
      expect(progressContainer).toHaveClass('h-4')
      expect(progressBar).toHaveClass('h-full')
    })
  })

  describe('Progress Calculations', () => {
    const testCases = [
      { value: 0, max: 100, expected: 'translateX(-100%)' },
      { value: 25, max: 100, expected: 'translateX(-75%)' },
      { value: 50, max: 100, expected: 'translateX(-50%)' },
      { value: 75, max: 100, expected: 'translateX(-25%)' },
      { value: 100, max: 100, expected: 'translateX(0%)' },
      { value: 1, max: 4, expected: 'translateX(-75%)' },
      { value: 2, max: 4, expected: 'translateX(-50%)' },
      { value: 3, max: 4, expected: 'translateX(-25%)' },
      { value: 4, max: 4, expected: 'translateX(0%)' },
      { value: 33, max: 66, expected: 'translateX(-50%)' },
      { value: 0.5, max: 1, expected: 'translateX(-50%)' },
    ]

    testCases.forEach(({ value, max, expected }) => {
      it(`calculates ${value}/${max} correctly`, () => {
        render(<Progress value={value} max={max} />)
        
        const progressBar = screen.getByRole('progressbar').firstElementChild
        expect(progressBar).toHaveStyle(`transform: ${expected}`)
      })
    })
  })

  describe('Edge Cases', () => {
    it('handles very large numbers', () => {
      render(<Progress value={1000000} max={2000000} />)
      
      // Should be 50%
      const progressBar = screen.getByRole('progressbar').firstElementChild
      expect(progressBar).toHaveStyle('transform: translateX(-50%)')
    })

    it('handles very small decimal numbers', () => {
      render(<Progress value={0.001} max={0.002} />)
      
      // Should be 50%
      const progressBar = screen.getByRole('progressbar').firstElementChild
      expect(progressBar).toHaveStyle('transform: translateX(-50%)')
    })

    it('handles NaN values gracefully', () => {
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {})
      
      render(<Progress value={NaN} max={100} />)
      
      // NaN should be treated as 0
      const progressBar = screen.getByRole('progressbar').firstElementChild
      expect(progressBar).toHaveStyle('transform: translateX(-100%)')
      
      consoleWarn.mockRestore()
    })

    it('handles Infinity values gracefully', () => {
      render(<Progress value={Infinity} max={100} />)
      
      // Infinity should be clamped to 100%
      const progressBar = screen.getByRole('progressbar').firstElementChild
      expect(progressBar).toHaveStyle('transform: translateX(0%)')
    })
  })

  describe('Accessibility', () => {
    it('uses correct ARIA role', () => {
      render(<Progress value={50} />)
      
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toBeInTheDocument()
    })

    it('can be enhanced with ARIA attributes', () => {
      render(
        <Progress 
          value={75} 
          max={100}
          aria-label="Task completion progress"
          aria-describedby="progress-description"
        />
      )
      
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-label', 'Task completion progress')
      expect(progressBar).toHaveAttribute('aria-describedby', 'progress-description')
    })

    it('can be used with screen reader friendly text', () => {
      render(
        <div>
          <Progress value={60} max={100} aria-labelledby="progress-label" />
          <div id="progress-label">Upload Progress: 60%</div>
        </div>
      )
      
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-labelledby', 'progress-label')
      expect(screen.getByText('Upload Progress: 60%')).toBeInTheDocument()
    })
  })

  describe('Visual States', () => {
    it('shows empty state correctly', () => {
      render(<Progress value={0} />)
      
      const progressContainer = screen.getByRole('progressbar')
      const progressBar = progressContainer.firstElementChild
      
      // Container should have background color
      expect(progressContainer).toHaveClass('bg-gray-200')
      // Progress bar should be fully hidden
      expect(progressBar).toHaveStyle('transform: translateX(-100%)')
    })

    it('shows full state correctly', () => {
      render(<Progress value={100} />)
      
      const progressContainer = screen.getByRole('progressbar')
      const progressBar = progressContainer.firstElementChild
      
      // Progress bar should be fully visible
      expect(progressBar).toHaveStyle('transform: translateX(0%)')
      expect(progressBar).toHaveClass('bg-blue-600')
    })

    it('shows partial progress correctly', () => {
      render(<Progress value={33} />)
      
      const progressBar = screen.getByRole('progressbar').firstElementChild
      expect(progressBar).toHaveStyle('transform: translateX(-67%)')
    })
  })

  describe('Animation and Transitions', () => {
    it('has transition classes for smooth animation', () => {
      render(<Progress value={50} />)
      
      const progressBar = screen.getByRole('progressbar').firstElementChild
      expect(progressBar).toHaveClass('transition-all')
    })

    it('updates transform when value changes', () => {
      const { rerender } = render(<Progress value={25} />)
      
      let progressBar = screen.getByRole('progressbar').firstElementChild
      expect(progressBar).toHaveStyle('transform: translateX(-75%)')
      
      rerender(<Progress value={75} />)
      
      progressBar = screen.getByRole('progressbar').firstElementChild
      expect(progressBar).toHaveStyle('transform: translateX(-25%)')
    })
  })

  describe('Multiple Progress Bars', () => {
    it('renders multiple independent progress bars', () => {
      render(
        <div>
          <Progress value={25} aria-label="Progress 1" />
          <Progress value={75} aria-label="Progress 2" />
        </div>
      )
      
      const progressBars = screen.getAllByRole('progressbar')
      expect(progressBars).toHaveLength(2)
      
      const [progress1, progress2] = progressBars
      expect(progress1.firstElementChild).toHaveStyle('transform: translateX(-75%)')
      expect(progress2.firstElementChild).toHaveStyle('transform: translateX(-25%)')
    })
  })

  describe('Performance', () => {
    it('does not cause unnecessary re-renders', () => {
      const renderSpy = jest.spyOn(React, 'createElement')
      const initialCallCount = renderSpy.mock.calls.length
      
      const { rerender } = render(<Progress value={50} />)
      
      // Re-render with same props
      rerender(<Progress value={50} />)
      
      // Should not cause significant additional renders
      const finalCallCount = renderSpy.mock.calls.length
      expect(finalCallCount - initialCallCount).toBeLessThan(10) // Allow some React overhead
      
      renderSpy.mockRestore()
    })
  })

  describe('Math Edge Cases', () => {
    it('handles precision correctly with decimal percentages', () => {
      render(<Progress value={1} max={3} />)
      
      // 1/3 = 33.333...% = translateX(-66.666...%)
      const progressBar = screen.getByRole('progressbar').firstElementChild
      const transform = progressBar.getAttribute('style')
      expect(transform).toContain('translateX(-66.6')
    })

    it('ensures percentage never exceeds bounds', () => {
      render(<Progress value={200} max={100} />)
      
      const progressBar = screen.getByRole('progressbar').firstElementChild
      expect(progressBar).toHaveStyle('transform: translateX(0%)') // Clamped to 100%
    })

    it('ensures percentage never goes below bounds', () => {
      render(<Progress value={-50} max={100} />)
      
      const progressBar = screen.getByRole('progressbar').firstElementChild
      expect(progressBar).toHaveStyle('transform: translateX(-100%)') // Clamped to 0%
    })
  })
})