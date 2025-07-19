import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '@/components/ui/Button'

describe('Button', () => {
  it('renders with default props', () => {
    render(<Button>Click me</Button>)
    
    const button = screen.getByRole('button', { name: 'Click me' })
    expect(button).toBeInTheDocument()
    expect(button).toHaveClass('bg-primary-600') // default primary variant
    expect(button).toHaveClass('px-4 py-2 text-sm') // default medium size
  })

  it('applies different variants correctly', () => {
    const { rerender } = render(<Button variant="secondary">Secondary</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-secondary-600')

    rerender(<Button variant="outline">Outline</Button>)
    expect(screen.getByRole('button')).toHaveClass('border border-gray-300')

    rerender(<Button variant="danger">Danger</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-red-600')
  })

  it('applies different sizes correctly', () => {
    const { rerender } = render(<Button size="sm">Small</Button>)
    expect(screen.getByRole('button')).toHaveClass('px-3 py-1.5 text-sm')

    rerender(<Button size="lg">Large</Button>)
    expect(screen.getByRole('button')).toHaveClass('px-6 py-3 text-base')
  })

  it('shows loading state', () => {
    render(<Button loading>Loading button</Button>)
    
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    
    // Check for loading spinner SVG
    const spinner = button.querySelector('svg')
    expect(spinner).toBeInTheDocument()
    expect(spinner).toHaveClass('animate-spin')
  })

  it('handles disabled state', () => {
    render(<Button disabled>Disabled button</Button>)
    
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveClass('disabled:opacity-50')
  })

  it('handles click events', () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick}>Clickable</Button>)
    
    const button = screen.getByRole('button')
    fireEvent.click(button)
    
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('does not call onClick when disabled', () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick} disabled>Disabled</Button>)
    
    const button = screen.getByRole('button')
    fireEvent.click(button)
    
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('does not call onClick when loading', () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick} loading>Loading</Button>)
    
    const button = screen.getByRole('button')
    fireEvent.click(button)
    
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('applies custom className', () => {
    render(<Button className="custom-class">Custom</Button>)
    
    const button = screen.getByRole('button')
    expect(button).toHaveClass('custom-class')
  })

  it('passes through HTML button attributes', () => {
    render(<Button type="submit" id="submit-btn">Submit</Button>)
    
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('type', 'submit')
    expect(button).toHaveAttribute('id', 'submit-btn')
  })

  it('has proper accessibility attributes', () => {
    render(<Button>Accessible button</Button>)
    
    const button = screen.getByRole('button')
    expect(button).toHaveClass('focus:outline-none')
    expect(button).toHaveClass('focus:ring-2')
  })
})