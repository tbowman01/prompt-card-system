import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchInput } from '@/components/ui/SearchInput'

describe('SearchInput', () => {
  const defaultProps = {
    value: '',
    onChange: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders with default props', () => {
    render(<SearchInput {...defaultProps} />)
    
    const input = screen.getByPlaceholderText('Search...')
    expect(input).toBeInTheDocument()
    expect(input).toHaveValue('')
    
    // Check for search icon
    const searchIcon = screen.getByRole('img', { hidden: true })
    expect(searchIcon).toBeInTheDocument()
  })

  it('displays the correct value', () => {
    render(<SearchInput {...defaultProps} value="test search" />)
    
    const input = screen.getByDisplayValue('test search')
    expect(input).toBeInTheDocument()
  })

  it('calls onChange when text is typed', async () => {
    const user = userEvent.setup()
    const onChange = jest.fn()
    
    render(<SearchInput {...defaultProps} onChange={onChange} />)
    
    const input = screen.getByPlaceholderText('Search...')
    await user.type(input, 'hello')
    
    expect(onChange).toHaveBeenCalledTimes(5) // called for each character
    expect(onChange).toHaveBeenLastCalledWith('hello')
  })

  it('calls onChange with correct value on each keystroke', () => {
    const onChange = jest.fn()
    render(<SearchInput {...defaultProps} onChange={onChange} />)
    
    const input = screen.getByPlaceholderText('Search...')
    
    fireEvent.change(input, { target: { value: 'a' } })
    expect(onChange).toHaveBeenCalledWith('a')
    
    fireEvent.change(input, { target: { value: 'ab' } })
    expect(onChange).toHaveBeenCalledWith('ab')
    
    fireEvent.change(input, { target: { value: 'abc' } })
    expect(onChange).toHaveBeenCalledWith('abc')
  })

  it('uses custom placeholder when provided', () => {
    render(<SearchInput {...defaultProps} placeholder="Find items..." />)
    
    const input = screen.getByPlaceholderText('Find items...')
    expect(input).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument()
  })

  it('applies custom className to wrapper', () => {
    render(<SearchInput {...defaultProps} className="custom-search" />)
    
    const wrapper = screen.getByPlaceholderText('Search...').parentElement
    expect(wrapper).toHaveClass('custom-search')
    expect(wrapper).toHaveClass('relative') // base class should still be there
  })

  it('maintains focus and accessibility features', async () => {
    const user = userEvent.setup()
    render(<SearchInput {...defaultProps} />)
    
    const input = screen.getByPlaceholderText('Search...')
    
    await user.click(input)
    expect(input).toHaveFocus()
    
    // Check focus styles classes
    expect(input).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-primary-500')
  })

  it('handles clearing the input', async () => {
    const user = userEvent.setup()
    const onChange = jest.fn()
    
    render(<SearchInput value="initial text" onChange={onChange} />)
    
    const input = screen.getByDisplayValue('initial text')
    
    await user.clear(input)
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('handles paste operations', async () => {
    const user = userEvent.setup()
    const onChange = jest.fn()
    
    render(<SearchInput {...defaultProps} onChange={onChange} />)
    
    const input = screen.getByPlaceholderText('Search...')
    await user.click(input)
    await user.paste('pasted content')
    
    expect(onChange).toHaveBeenCalledWith('pasted content')
  })

  describe('keyboard navigation', () => {
    it('handles keyboard events', async () => {
      const user = userEvent.setup()
      const onChange = jest.fn()
      
      render(<SearchInput {...defaultProps} onChange={onChange} />)
      
      const input = screen.getByPlaceholderText('Search...')
      
      await user.click(input)
      await user.keyboard('test{Enter}')
      
      expect(onChange).toHaveBeenCalledWith('test')
    })

    it('handles backspace correctly', async () => {
      const user = userEvent.setup()
      const onChange = jest.fn()
      
      render(<SearchInput value="hello" onChange={onChange} />)
      
      const input = screen.getByDisplayValue('hello')
      
      await user.click(input)
      await user.keyboard('{Backspace}')
      
      expect(onChange).toHaveBeenCalledWith('hell')
    })
  })

  describe('visual elements', () => {
    it('renders search icon with correct properties', () => {
      render(<SearchInput {...defaultProps} />)
      
      const icon = screen.getByRole('img', { hidden: true })
      expect(icon).toHaveClass('h-5', 'w-5', 'text-gray-400')
      expect(icon).toHaveAttribute('fill', 'none')
      expect(icon).toHaveAttribute('viewBox', '0 0 24 24')
    })

    it('positions search icon correctly', () => {
      render(<SearchInput {...defaultProps} />)
      
      const iconWrapper = screen.getByRole('img', { hidden: true }).parentElement
      expect(iconWrapper).toHaveClass('absolute', 'inset-y-0', 'left-0', 'pl-3', 'flex', 'items-center', 'pointer-events-none')
    })

    it('applies correct styling to input', () => {
      render(<SearchInput {...defaultProps} />)
      
      const input = screen.getByPlaceholderText('Search...')
      expect(input).toHaveClass(
        'block',
        'w-full',
        'pl-10', // space for icon
        'pr-3',
        'py-2',
        'border',
        'border-gray-300',
        'rounded-md',
        'leading-5',
        'bg-white',
        'placeholder-gray-400'
      )
    })
  })

  describe('controlled component behavior', () => {
    it('updates value when prop changes', () => {
      const { rerender } = render(<SearchInput {...defaultProps} value="initial" />)
      
      let input = screen.getByDisplayValue('initial')
      expect(input).toBeInTheDocument()
      
      rerender(<SearchInput {...defaultProps} value="updated" />)
      
      input = screen.getByDisplayValue('updated')
      expect(input).toBeInTheDocument()
    })

    it('does not update without onChange prop being called', async () => {
      const user = userEvent.setup()
      
      // Simulate parent not updating value (bad practice, but should still work)
      render(<SearchInput value="fixed" onChange={() => {}} />)
      
      const input = screen.getByDisplayValue('fixed')
      await user.type(input, 'new text')
      
      // Value should remain the same since parent didn't update
      expect(input).toHaveValue('fixed')
    })
  })

  describe('edge cases', () => {
    it('handles very long search terms', async () => {
      const user = userEvent.setup()
      const onChange = jest.fn()
      const longText = 'a'.repeat(1000)
      
      render(<SearchInput {...defaultProps} onChange={onChange} />)
      
      const input = screen.getByPlaceholderText('Search...')
      await user.type(input, longText)
      
      expect(onChange).toHaveBeenCalledWith(longText)
    })

    it('handles special characters correctly', async () => {
      const user = userEvent.setup()
      const onChange = jest.fn()
      const specialText = '!@#$%^&*()[]{}|\\:";\'<>?,./'
      
      render(<SearchInput {...defaultProps} onChange={onChange} />)
      
      const input = screen.getByPlaceholderText('Search...')
      await user.type(input, specialText)
      
      expect(onChange).toHaveBeenCalledWith(specialText)
    })

    it('handles unicode characters', async () => {
      const user = userEvent.setup()
      const onChange = jest.fn()
      const unicodeText = '🔍 Emoji search 中文'
      
      render(<SearchInput {...defaultProps} onChange={onChange} />)
      
      const input = screen.getByPlaceholderText('Search...')
      await user.type(input, unicodeText)
      
      expect(onChange).toHaveBeenCalledWith(unicodeText)
    })
  })

  describe('accessibility', () => {
    it('has proper accessibility attributes', () => {
      render(<SearchInput {...defaultProps} />)
      
      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('type', 'text')
    })

    it('supports screen readers with proper placeholder', () => {
      render(<SearchInput {...defaultProps} placeholder="Search for products" />)
      
      const input = screen.getByLabelText('Search for products')
      expect(input).toBeInTheDocument()
    })

    it('maintains focus ring for keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<SearchInput {...defaultProps} />)
      
      const input = screen.getByPlaceholderText('Search...')
      
      await user.tab() // Focus via keyboard
      expect(input).toHaveFocus()
      expect(input).toHaveClass('focus:ring-2')
    })
  })
})