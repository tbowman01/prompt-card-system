import { render, screen } from '@testing-library/react'
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent, 
  CardFooter 
} from '@/components/ui/card'

describe('Card Components', () => {
  describe('Card', () => {
    it('renders with default styling', () => {
      render(<Card data-testid="card">Card Content</Card>)
      
      const card = screen.getByTestId('card')
      expect(card).toBeInTheDocument()
      expect(card).toHaveClass(
        'rounded-lg',
        'border',
        'border-gray-200',
        'bg-white',
        'shadow-sm'
      )
    })

    it('applies custom className', () => {
      render(<Card data-testid="card" className="custom-class">Content</Card>)
      
      const card = screen.getByTestId('card')
      expect(card).toHaveClass('custom-class')
      expect(card).toHaveClass('rounded-lg') // base classes should still be there
    })

    it('renders children correctly', () => {
      render(
        <Card>
          <div>Child 1</div>
          <span>Child 2</span>
        </Card>
      )
      
      expect(screen.getByText('Child 1')).toBeInTheDocument()
      expect(screen.getByText('Child 2')).toBeInTheDocument()
    })
  })

  describe('CardHeader', () => {
    it('renders with default styling', () => {
      render(<CardHeader data-testid="header">Header Content</CardHeader>)
      
      const header = screen.getByTestId('header')
      expect(header).toBeInTheDocument()
      expect(header).toHaveClass('p-6', 'pb-0')
    })

    it('applies custom className', () => {
      render(<CardHeader data-testid="header" className="custom-header">Content</CardHeader>)
      
      const header = screen.getByTestId('header')
      expect(header).toHaveClass('custom-header')
      expect(header).toHaveClass('p-6', 'pb-0')
    })

    it('renders children correctly', () => {
      render(<CardHeader>Header Text</CardHeader>)
      expect(screen.getByText('Header Text')).toBeInTheDocument()
    })
  })

  describe('CardTitle', () => {
    it('renders as h3 with default styling', () => {
      render(<CardTitle>Title Text</CardTitle>)
      
      const title = screen.getByRole('heading', { level: 3 })
      expect(title).toBeInTheDocument()
      expect(title).toHaveTextContent('Title Text')
      expect(title).toHaveClass(
        'text-lg',
        'font-semibold',
        'leading-none',
        'tracking-tight'
      )
    })

    it('applies custom className', () => {
      render(<CardTitle className="custom-title">Title</CardTitle>)
      
      const title = screen.getByRole('heading', { level: 3 })
      expect(title).toHaveClass('custom-title')
      expect(title).toHaveClass('text-lg', 'font-semibold')
    })

    it('renders complex children', () => {
      render(
        <CardTitle>
          <span>Complex</span> Title
        </CardTitle>
      )
      
      const title = screen.getByRole('heading', { level: 3 })
      expect(title).toBeInTheDocument()
      expect(screen.getByText('Complex')).toBeInTheDocument()
      expect(screen.getByText('Title')).toBeInTheDocument()
    })
  })

  describe('CardDescription', () => {
    it('renders as paragraph with default styling', () => {
      render(<CardDescription>Description text</CardDescription>)
      
      const description = screen.getByText('Description text')
      expect(description).toBeInTheDocument()
      expect(description.tagName).toBe('P')
      expect(description).toHaveClass('text-sm', 'text-gray-600')
    })

    it('applies custom className', () => {
      render(<CardDescription className="custom-desc">Description</CardDescription>)
      
      const description = screen.getByText('Description')
      expect(description).toHaveClass('custom-desc')
      expect(description).toHaveClass('text-sm', 'text-gray-600')
    })
  })

  describe('CardContent', () => {
    it('renders with default styling', () => {
      render(<CardContent data-testid="content">Content text</CardContent>)
      
      const content = screen.getByTestId('content')
      expect(content).toBeInTheDocument()
      expect(content).toHaveClass('p-6', 'pt-0')
    })

    it('applies custom className', () => {
      render(<CardContent data-testid="content" className="custom-content">Content</CardContent>)
      
      const content = screen.getByTestId('content')
      expect(content).toHaveClass('custom-content')
      expect(content).toHaveClass('p-6', 'pt-0')
    })

    it('renders complex content', () => {
      render(
        <CardContent>
          <p>Paragraph 1</p>
          <p>Paragraph 2</p>
          <ul>
            <li>List item</li>
          </ul>
        </CardContent>
      )
      
      expect(screen.getByText('Paragraph 1')).toBeInTheDocument()
      expect(screen.getByText('Paragraph 2')).toBeInTheDocument()
      expect(screen.getByText('List item')).toBeInTheDocument()
    })
  })

  describe('CardFooter', () => {
    it('renders with default styling', () => {
      render(<CardFooter data-testid="footer">Footer content</CardFooter>)
      
      const footer = screen.getByTestId('footer')
      expect(footer).toBeInTheDocument()
      expect(footer).toHaveClass('flex', 'items-center', 'p-6', 'pt-0')
    })

    it('applies custom className', () => {
      render(<CardFooter data-testid="footer" className="custom-footer">Footer</CardFooter>)
      
      const footer = screen.getByTestId('footer')
      expect(footer).toHaveClass('custom-footer')
      expect(footer).toHaveClass('flex', 'items-center', 'p-6', 'pt-0')
    })

    it('properly aligns items with flex', () => {
      render(
        <CardFooter data-testid="footer">
          <button>Button 1</button>
          <button>Button 2</button>
        </CardFooter>
      )
      
      const footer = screen.getByTestId('footer')
      expect(footer).toHaveClass('flex', 'items-center')
      expect(screen.getByText('Button 1')).toBeInTheDocument()
      expect(screen.getByText('Button 2')).toBeInTheDocument()
    })
  })

  describe('Complete Card Layout', () => {
    it('renders a complete card with all components', () => {
      render(
        <Card data-testid="complete-card">
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
            <CardDescription>Card Description</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Main content goes here</p>
          </CardContent>
          <CardFooter>
            <button>Action</button>
          </CardFooter>
        </Card>
      )
      
      const card = screen.getByTestId('complete-card')
      expect(card).toBeInTheDocument()
      
      // Check all components are rendered
      expect(screen.getByRole('heading', { level: 3, name: 'Card Title' })).toBeInTheDocument()
      expect(screen.getByText('Card Description')).toBeInTheDocument()
      expect(screen.getByText('Main content goes here')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
    })

    it('maintains proper spacing between components', () => {
      render(
        <Card>
          <CardHeader data-testid="header">
            <CardTitle>Title</CardTitle>
          </CardHeader>
          <CardContent data-testid="content">
            Content
          </CardContent>
          <CardFooter data-testid="footer">
            Footer
          </CardFooter>
        </Card>
      )
      
      const header = screen.getByTestId('header')
      const content = screen.getByTestId('content')
      const footer = screen.getByTestId('footer')
      
      // Check spacing classes
      expect(header).toHaveClass('p-6', 'pb-0') // No bottom padding
      expect(content).toHaveClass('p-6', 'pt-0') // No top padding
      expect(footer).toHaveClass('p-6', 'pt-0') // No top padding
    })
  })

  describe('Accessibility', () => {
    it('maintains semantic HTML structure', () => {
      render(
        <Card role="article">
          <CardHeader>
            <CardTitle>Accessible Title</CardTitle>
            <CardDescription>Accessible Description</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Content paragraph</p>
          </CardContent>
        </Card>
      )
      
      const article = screen.getByRole('article')
      expect(article).toBeInTheDocument()
      
      const heading = screen.getByRole('heading', { level: 3 })
      expect(heading).toBeInTheDocument()
      
      const paragraph = screen.getByText('Content paragraph')
      expect(paragraph.tagName).toBe('P')
    })

    it('supports ARIA attributes', () => {
      render(
        <Card aria-label="Product card">
          <CardTitle>Product Name</CardTitle>
          <CardContent aria-describedby="product-desc">
            <p id="product-desc">Product description</p>
          </CardContent>
        </Card>
      )
      
      const card = screen.getByLabelText('Product card')
      expect(card).toBeInTheDocument()
      
      const content = screen.getByText('Product description').parentElement
      expect(content).toHaveAttribute('aria-describedby', 'product-desc')
    })
  })

  describe('Edge Cases', () => {
    it('handles empty children gracefully', () => {
      render(<Card data-testid="empty-card"></Card>)
      
      const card = screen.getByTestId('empty-card')
      expect(card).toBeInTheDocument()
      expect(card).toBeEmptyDOMElement()
    })

    it('handles null/undefined className', () => {
      render(<Card className={undefined} data-testid="undefined-class">Content</Card>)
      
      const card = screen.getByTestId('undefined-class')
      expect(card).toBeInTheDocument()
      expect(card).toHaveClass('rounded-lg') // Should still have base classes
    })

    it('handles multiple custom classes', () => {
      render(
        <Card className="class1 class2 class3" data-testid="multi-class">
          Content
        </Card>
      )
      
      const card = screen.getByTestId('multi-class')
      expect(card).toHaveClass('class1', 'class2', 'class3')
      expect(card).toHaveClass('rounded-lg') // Base classes should be preserved
    })
  })
})