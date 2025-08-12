import { render, screen } from '@testing-library/react'
import { Badge } from '@/components/ui/Badge'

describe('Badge', () => {
  it('renders with default props', () => {
    render(<Badge>Default Badge</Badge>)
    
    const badge = screen.getByText('Default Badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('inline-flex', 'items-center', 'font-medium', 'rounded-full')
    expect(badge).toHaveClass('bg-gray-100', 'text-gray-800') // default variant
    expect(badge).toHaveClass('px-3', 'py-1', 'text-sm') // default size
  })

  describe('variant prop', () => {
    it('applies default variant correctly', () => {
      render(<Badge variant="default">Default</Badge>)
      const badge = screen.getByText('Default')
      expect(badge).toHaveClass('bg-gray-100', 'text-gray-800')
    })

    it('applies primary variant correctly', () => {
      render(<Badge variant="primary">Primary</Badge>)
      const badge = screen.getByText('Primary')
      expect(badge).toHaveClass('bg-blue-100', 'text-blue-800')
    })

    it('applies secondary variant correctly', () => {
      render(<Badge variant="secondary">Secondary</Badge>)
      const badge = screen.getByText('Secondary')
      expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-800')
    })

    it('applies success variant correctly', () => {
      render(<Badge variant="success">Success</Badge>)
      const badge = screen.getByText('Success')
      expect(badge).toHaveClass('bg-green-100', 'text-green-800')
    })

    it('applies warning variant correctly', () => {
      render(<Badge variant="warning">Warning</Badge>)
      const badge = screen.getByText('Warning')
      expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-800')
    })

    it('applies danger variant correctly', () => {
      render(<Badge variant="danger">Danger</Badge>)
      const badge = screen.getByText('Danger')
      expect(badge).toHaveClass('bg-red-100', 'text-red-800')
    })

    it('applies destructive variant correctly', () => {
      render(<Badge variant="destructive">Destructive</Badge>)
      const badge = screen.getByText('Destructive')
      expect(badge).toHaveClass('bg-red-100', 'text-red-800')
    })

    it('applies outline variant correctly', () => {
      render(<Badge variant="outline">Outline</Badge>)
      const badge = screen.getByText('Outline')
      expect(badge).toHaveClass('border', 'border-gray-300', 'bg-white', 'text-gray-700')
    })
  })

  describe('size prop', () => {
    it('applies small size correctly', () => {
      render(<Badge size="sm">Small</Badge>)
      const badge = screen.getByText('Small')
      expect(badge).toHaveClass('px-2', 'py-1', 'text-xs')
    })

    it('applies medium size correctly (default)', () => {
      render(<Badge size="md">Medium</Badge>)
      const badge = screen.getByText('Medium')
      expect(badge).toHaveClass('px-3', 'py-1', 'text-sm')
    })
  })

  describe('className prop', () => {
    it('applies custom className', () => {
      render(<Badge className="custom-class">Custom</Badge>)
      const badge = screen.getByText('Custom')
      expect(badge).toHaveClass('custom-class')
      // Should still have base classes
      expect(badge).toHaveClass('inline-flex', 'items-center', 'font-medium', 'rounded-full')
    })

    it('merges custom className with existing classes', () => {
      render(<Badge variant="primary" size="sm" className="border-2">Test</Badge>)
      const badge = screen.getByText('Test')
      expect(badge).toHaveClass('border-2') // custom
      expect(badge).toHaveClass('bg-blue-100', 'text-blue-800') // variant
      expect(badge).toHaveClass('px-2', 'py-1', 'text-xs') // size
    })
  })

  describe('children content', () => {
    it('renders text content', () => {
      render(<Badge>Text Badge</Badge>)
      expect(screen.getByText('Text Badge')).toBeInTheDocument()
    })

    it('renders numeric content', () => {
      render(<Badge>{42}</Badge>)
      expect(screen.getByText('42')).toBeInTheDocument()
    })

    it('renders JSX content', () => {
      render(
        <Badge>
          <span>Complex</span> Badge
        </Badge>
      )
      expect(screen.getByText('Complex')).toBeInTheDocument()
      expect(screen.getByText('Badge')).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('renders as a span element', () => {
      render(<Badge>Accessible Badge</Badge>)
      const badge = screen.getByText('Accessible Badge')
      expect(badge.tagName).toBe('SPAN')
    })

    it('maintains readable text with proper contrast classes', () => {
      // Test that all variants use appropriate text/background combinations
      const variants = ['default', 'primary', 'secondary', 'success', 'warning', 'danger', 'destructive', 'outline'] as const
      
      variants.forEach(variant => {
        const { unmount } = render(<Badge variant={variant}>{variant}</Badge>)
        const badge = screen.getByText(variant)
        
        // Each variant should have appropriate text color class
        expect(badge).toHaveClass(
          variant === 'outline' ? 'text-gray-700' :
          variant === 'primary' ? 'text-blue-800' :
          variant === 'secondary' || variant === 'warning' ? 'text-yellow-800' :
          variant === 'success' ? 'text-green-800' :
          variant === 'danger' || variant === 'destructive' ? 'text-red-800' :
          'text-gray-800' // default
        )
        unmount()
      })
    })
  })

  describe('edge cases', () => {
    it('handles empty content gracefully', () => {
      render(<Badge></Badge>)
      const badge = screen.getByRole('generic') // span without text
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveClass('inline-flex')
    })

    it('handles undefined variant and size gracefully', () => {
      // @ts-expect-error - testing runtime behavior
      render(<Badge variant={undefined} size={undefined}>Test</Badge>)
      const badge = screen.getByText('Test')
      expect(badge).toHaveClass('bg-gray-100', 'text-gray-800') // should fallback to default
      expect(badge).toHaveClass('px-3', 'py-1', 'text-sm') // should fallback to default
    })

    it('handles very long content', () => {
      const longText = 'This is a very long badge content that might wrap or overflow'
      render(<Badge>{longText}</Badge>)
      const badge = screen.getByText(longText)
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveClass('inline-flex') // should maintain layout
    })
  })

  describe('visual consistency', () => {
    it('maintains consistent height across different variants', () => {
      const variants = ['default', 'primary', 'success', 'danger'] as const
      
      variants.forEach(variant => {
        const { unmount } = render(<Badge variant={variant} size="md">Test</Badge>)
        const badge = screen.getByText('Test')
        expect(badge).toHaveClass('py-1') // same padding for consistent height
        unmount()
      })
    })

    it('maintains consistent height across different sizes', () => {
      const { rerender } = render(<Badge size="sm">Small</Badge>)
      const smallBadge = screen.getByText('Small')
      expect(smallBadge).toHaveClass('py-1')

      rerender(<Badge size="md">Medium</Badge>)
      const mediumBadge = screen.getByText('Medium')
      expect(mediumBadge).toHaveClass('py-1')
    })
  })
})