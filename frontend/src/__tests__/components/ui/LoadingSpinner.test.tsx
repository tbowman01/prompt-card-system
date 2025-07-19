import { render, screen } from '@testing-library/react'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

describe('LoadingSpinner', () => {
  it('renders with default props', () => {
    render(<LoadingSpinner />)
    
    const spinner = screen.getByRole('generic')
    expect(spinner).toBeInTheDocument()
    expect(spinner).toHaveClass('animate-spin')
    expect(spinner).toHaveClass('h-8 w-8') // default medium size
    
    const srText = screen.getByText('Loading...')
    expect(srText).toBeInTheDocument()
    expect(srText).toHaveClass('sr-only')
  })

  it('applies small size correctly', () => {
    render(<LoadingSpinner size="sm" />)
    
    const spinner = screen.getByRole('generic')
    expect(spinner).toHaveClass('h-4 w-4')
  })

  it('applies large size correctly', () => {
    render(<LoadingSpinner size="lg" />)
    
    const spinner = screen.getByRole('generic')
    expect(spinner).toHaveClass('h-12 w-12')
  })

  it('applies custom className', () => {
    const customClass = 'custom-spinner-class'
    render(<LoadingSpinner className={customClass} />)
    
    const spinner = screen.getByRole('generic')
    expect(spinner).toHaveClass(customClass)
  })

  it('maintains accessibility with screen reader text', () => {
    render(<LoadingSpinner />)
    
    const srText = screen.getByText('Loading...')
    expect(srText).toHaveClass('sr-only')
  })

  it('has correct default styling classes', () => {
    render(<LoadingSpinner />)
    
    const spinner = screen.getByRole('generic')
    expect(spinner).toHaveClass('animate-spin')
    expect(spinner).toHaveClass('rounded-full')
    expect(spinner).toHaveClass('border-b-2')
    expect(spinner).toHaveClass('border-primary-600')
  })
})