import { render, screen, fireEvent } from '@testing-library/react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

describe('Tabs Components', () => {
  const TabsExample = ({ 
    value, 
    onValueChange, 
    defaultValue = 'tab1' 
  }: { 
    value?: string
    onValueChange?: (value: string) => void
    defaultValue?: string 
  }) => (
    <Tabs value={value} onValueChange={onValueChange} defaultValue={defaultValue}>
      <TabsList>
        <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        <TabsTrigger value="tab3">Tab 3</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">Content for Tab 1</TabsContent>
      <TabsContent value="tab2">Content for Tab 2</TabsContent>
      <TabsContent value="tab3">Content for Tab 3</TabsContent>
    </Tabs>
  )

  describe('Tabs Container', () => {
    it('renders with default value', () => {
      render(<TabsExample />)

      expect(screen.getByText('Content for Tab 1')).toBeInTheDocument()
      expect(screen.queryByText('Content for Tab 2')).not.toBeInTheDocument()
      expect(screen.queryByText('Content for Tab 3')).not.toBeInTheDocument()
    })

    it('applies custom className', () => {
      render(
        <Tabs className="custom-tabs">
          <TabsList>
            <TabsTrigger value="test">Test</TabsTrigger>
          </TabsList>
          <TabsContent value="test">Test Content</TabsContent>
        </Tabs>
      )

      const tabsContainer = screen.getByText('Test').closest('.custom-tabs')
      expect(tabsContainer).toBeInTheDocument()
    })

    it('uses custom default value', () => {
      render(<TabsExample defaultValue="tab2" />)

      expect(screen.queryByText('Content for Tab 1')).not.toBeInTheDocument()
      expect(screen.getByText('Content for Tab 2')).toBeInTheDocument()
      expect(screen.queryByText('Content for Tab 3')).not.toBeInTheDocument()
    })
  })

  describe('TabsList', () => {
    it('renders with proper styling', () => {
      render(<TabsExample />)

      const tabsList = screen.getByRole('button', { name: 'Tab 1' }).parentElement
      expect(tabsList).toHaveClass(
        'inline-flex',
        'h-10',
        'items-center',
        'justify-center',
        'rounded-md',
        'bg-gray-100',
        'p-1',
        'text-gray-600'
      )
    })

    it('applies custom className', () => {
      render(
        <Tabs>
          <TabsList className="custom-list">
            <TabsTrigger value="test">Test</TabsTrigger>
          </TabsList>
          <TabsContent value="test">Content</TabsContent>
        </Tabs>
      )

      const tabsList = screen.getByRole('button', { name: 'Test' }).parentElement
      expect(tabsList).toHaveClass('custom-list')
    })
  })

  describe('TabsTrigger', () => {
    it('renders triggers with correct content', () => {
      render(<TabsExample />)

      expect(screen.getByRole('button', { name: 'Tab 1' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Tab 2' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Tab 3' })).toBeInTheDocument()
    })

    it('shows active state for current tab', () => {
      render(<TabsExample defaultValue="tab1" />)

      const tab1 = screen.getByRole('button', { name: 'Tab 1' })
      const tab2 = screen.getByRole('button', { name: 'Tab 2' })

      expect(tab1).toHaveClass('bg-white', 'text-gray-900', 'shadow-sm')
      expect(tab2).toHaveClass('text-gray-600', 'hover:text-gray-900')
      expect(tab2).not.toHaveClass('bg-white', 'shadow-sm')
    })

    it('switches tabs when clicked', () => {
      render(<TabsExample />)

      expect(screen.getByText('Content for Tab 1')).toBeInTheDocument()

      const tab2 = screen.getByRole('button', { name: 'Tab 2' })
      fireEvent.click(tab2)

      expect(screen.queryByText('Content for Tab 1')).not.toBeInTheDocument()
      expect(screen.getByText('Content for Tab 2')).toBeInTheDocument()

      // Check active states
      const tab1 = screen.getByRole('button', { name: 'Tab 1' })
      expect(tab1).not.toHaveClass('bg-white', 'shadow-sm')
      expect(tab2).toHaveClass('bg-white', 'text-gray-900', 'shadow-sm')
    })

    it('calls onValueChange when tab is clicked', () => {
      const onValueChange = jest.fn()
      render(<TabsExample onValueChange={onValueChange} />)

      const tab2 = screen.getByRole('button', { name: 'Tab 2' })
      fireEvent.click(tab2)

      expect(onValueChange).toHaveBeenCalledWith('tab2')
    })

    it('applies custom className', () => {
      render(
        <Tabs>
          <TabsList>
            <TabsTrigger value="test" className="custom-trigger">Test</TabsTrigger>
          </TabsList>
          <TabsContent value="test">Content</TabsContent>
        </Tabs>
      )

      const trigger = screen.getByRole('button', { name: 'Test' })
      expect(trigger).toHaveClass('custom-trigger')
    })

    it('has proper accessibility attributes', () => {
      render(<TabsExample />)

      const triggers = screen.getAllByRole('button')
      triggers.forEach(trigger => {
        expect(trigger).toHaveClass('focus-visible:outline-none')
        expect(trigger).toHaveClass('focus-visible:ring-2')
        expect(trigger).toHaveClass('focus-visible:ring-blue-500')
      })
    })

    it('throws error when used outside Tabs context', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      
      expect(() => {
        render(<TabsTrigger value="test">Test</TabsTrigger>)
      }).toThrow('TabsTrigger must be used within a Tabs component')

      consoleSpy.mockRestore()
    })
  })

  describe('TabsContent', () => {
    it('shows content for active tab only', () => {
      render(<TabsExample defaultValue="tab2" />)

      expect(screen.queryByText('Content for Tab 1')).not.toBeInTheDocument()
      expect(screen.getByText('Content for Tab 2')).toBeInTheDocument()
      expect(screen.queryByText('Content for Tab 3')).not.toBeInTheDocument()
    })

    it('switches content when tab changes', () => {
      render(<TabsExample />)

      expect(screen.getByText('Content for Tab 1')).toBeInTheDocument()

      const tab3 = screen.getByRole('button', { name: 'Tab 3' })
      fireEvent.click(tab3)

      expect(screen.queryByText('Content for Tab 1')).not.toBeInTheDocument()
      expect(screen.queryByText('Content for Tab 2')).not.toBeInTheDocument()
      expect(screen.getByText('Content for Tab 3')).toBeInTheDocument()
    })

    it('applies custom className to active content', () => {
      render(
        <Tabs defaultValue="test">
          <TabsList>
            <TabsTrigger value="test">Test</TabsTrigger>
          </TabsList>
          <TabsContent value="test" className="custom-content">
            Test Content
          </TabsContent>
        </Tabs>
      )

      const content = screen.getByText('Test Content')
      expect(content).toHaveClass('custom-content')
      expect(content).toHaveClass('mt-2', 'ring-offset-white')
    })

    it('supports complex content elements', () => {
      render(
        <Tabs defaultValue="complex">
          <TabsList>
            <TabsTrigger value="complex">Complex</TabsTrigger>
          </TabsList>
          <TabsContent value="complex">
            <div>
              <h2>Complex Content</h2>
              <p>With multiple elements</p>
              <button>Action Button</button>
            </div>
          </TabsContent>
        </Tabs>
      )

      expect(screen.getByRole('heading', { name: 'Complex Content' })).toBeInTheDocument()
      expect(screen.getByText('With multiple elements')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Action Button' })).toBeInTheDocument()
    })

    it('throws error when used outside Tabs context', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      
      expect(() => {
        render(<TabsContent value="test">Content</TabsContent>)
      }).toThrow('TabsContent must be used within a Tabs component')

      consoleSpy.mockRestore()
    })
  })

  describe('Controlled vs Uncontrolled', () => {
    it('works in uncontrolled mode with defaultValue', () => {
      render(<TabsExample defaultValue="tab2" />)

      expect(screen.getByText('Content for Tab 2')).toBeInTheDocument()

      const tab3 = screen.getByRole('button', { name: 'Tab 3' })
      fireEvent.click(tab3)

      expect(screen.getByText('Content for Tab 3')).toBeInTheDocument()
    })

    it('works in controlled mode', () => {
      const onValueChange = jest.fn()
      const { rerender } = render(
        <TabsExample value="tab1" onValueChange={onValueChange} />
      )

      expect(screen.getByText('Content for Tab 1')).toBeInTheDocument()

      const tab2 = screen.getByRole('button', { name: 'Tab 2' })
      fireEvent.click(tab2)

      // Should call onChange but not change content (controlled)
      expect(onValueChange).toHaveBeenCalledWith('tab2')
      expect(screen.getByText('Content for Tab 1')).toBeInTheDocument() // Still tab1 content

      // Parent should update value
      rerender(<TabsExample value="tab2" onValueChange={onValueChange} />)
      expect(screen.getByText('Content for Tab 2')).toBeInTheDocument()
    })

    it('prefers controlled value over internal state', () => {
      const { rerender } = render(<TabsExample value="tab2" defaultValue="tab1" />)

      // Should show controlled value, not default
      expect(screen.getByText('Content for Tab 2')).toBeInTheDocument()

      rerender(<TabsExample value="tab3" defaultValue="tab1" />)
      expect(screen.getByText('Content for Tab 3')).toBeInTheDocument()
    })
  })

  describe('Keyboard Navigation', () => {
    it('supports focus with keyboard', () => {
      render(<TabsExample />)

      const tab1 = screen.getByRole('button', { name: 'Tab 1' })
      tab1.focus()

      expect(tab1).toHaveFocus()
    })

    it('maintains focus ring classes for accessibility', () => {
      render(<TabsExample />)

      const triggers = screen.getAllByRole('button')
      triggers.forEach(trigger => {
        expect(trigger).toHaveClass(
          'focus-visible:outline-none',
          'focus-visible:ring-2',
          'focus-visible:ring-blue-500',
          'focus-visible:ring-offset-2'
        )
      })
    })
  })

  describe('Edge Cases', () => {
    it('handles empty tabs gracefully', () => {
      render(
        <Tabs>
          <TabsList />
        </Tabs>
      )

      // Should render without errors
      const tabsList = screen.getByRole('generic')
      expect(tabsList).toBeInTheDocument()
    })

    it('handles tab with no matching content', () => {
      render(
        <Tabs defaultValue="nonexistent">
          <TabsList>
            <TabsTrigger value="existing">Existing</TabsTrigger>
            <TabsTrigger value="nonexistent">Nonexistent</TabsTrigger>
          </TabsList>
          <TabsContent value="existing">Existing Content</TabsContent>
        </Tabs>
      )

      expect(screen.queryByText('Existing Content')).not.toBeInTheDocument()
      
      // Switch to existing tab
      const existingTab = screen.getByRole('button', { name: 'Existing' })
      fireEvent.click(existingTab)

      expect(screen.getByText('Existing Content')).toBeInTheDocument()
    })

    it('handles rapid tab switching', () => {
      render(<TabsExample />)

      const tab1 = screen.getByRole('button', { name: 'Tab 1' })
      const tab2 = screen.getByRole('button', { name: 'Tab 2' })
      const tab3 = screen.getByRole('button', { name: 'Tab 3' })

      // Rapidly switch between tabs
      fireEvent.click(tab2)
      fireEvent.click(tab3)
      fireEvent.click(tab1)
      fireEvent.click(tab2)

      expect(screen.getByText('Content for Tab 2')).toBeInTheDocument()
      expect(tab2).toHaveClass('bg-white', 'text-gray-900', 'shadow-sm')
    })

    it('handles undefined/null values gracefully', () => {
      render(
        <Tabs defaultValue="">
          <TabsList>
            <TabsTrigger value="">Empty</TabsTrigger>
            <TabsTrigger value="normal">Normal</TabsTrigger>
          </TabsList>
          <TabsContent value="">Empty Content</TabsContent>
          <TabsContent value="normal">Normal Content</TabsContent>
        </Tabs>
      )

      expect(screen.getByText('Empty Content')).toBeInTheDocument()

      const normalTab = screen.getByRole('button', { name: 'Normal' })
      fireEvent.click(normalTab)

      expect(screen.getByText('Normal Content')).toBeInTheDocument()
    })
  })

  describe('Performance', () => {
    it('only renders content for active tab', () => {
      let contentRenderCount = 0
      const ContentWithCounter = ({ children }: { children: React.ReactNode }) => {
        contentRenderCount++
        return <div>{children}</div>
      }

      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">
            <ContentWithCounter>Content 1</ContentWithCounter>
          </TabsContent>
          <TabsContent value="tab2">
            <ContentWithCounter>Content 2</ContentWithCounter>
          </TabsContent>
        </Tabs>
      )

      // Only active tab content should render
      expect(contentRenderCount).toBe(1)
      expect(screen.getByText('Content 1')).toBeInTheDocument()

      // Switch tabs
      const tab2 = screen.getByRole('button', { name: 'Tab 2' })
      fireEvent.click(tab2)

      expect(contentRenderCount).toBe(2) // Now both have rendered
      expect(screen.getByText('Content 2')).toBeInTheDocument()
      expect(screen.queryByText('Content 1')).not.toBeInTheDocument()
    })
  })
})