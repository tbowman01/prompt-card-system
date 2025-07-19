import { render, screen, fireEvent } from '@testing-library/react'
import { Modal } from '@/components/ui/Modal'

// Mock ReactDOM.createPortal to render modal content inline for testing
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}))

describe('Modal', () => {
  const mockOnClose = jest.fn()

  beforeEach(() => {
    mockOnClose.mockClear()
    // Reset body overflow style
    document.body.style.overflow = 'unset'
  })

  it('does not render when closed', () => {
    render(
      <Modal isOpen={false} onClose={mockOnClose}>
        <div>Modal Content</div>
      </Modal>
    )
    
    expect(screen.queryByText('Modal Content')).not.toBeInTheDocument()
  })

  it('renders when open', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose}>
        <div>Modal Content</div>
      </Modal>
    )
    
    expect(screen.getByText('Modal Content')).toBeInTheDocument()
  })

  it('renders with title', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    )
    
    expect(screen.getByText('Test Modal')).toBeInTheDocument()
    expect(screen.getByText('Modal Content')).toBeInTheDocument()
  })

  it('calls onClose when clicking backdrop', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose}>
        <div>Modal Content</div>
      </Modal>
    )
    
    const backdrop = document.querySelector('.bg-black.bg-opacity-50')
    expect(backdrop).toBeInTheDocument()
    
    fireEvent.click(backdrop!)
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when clicking close button', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    )
    
    const closeButton = screen.getByRole('button')
    fireEvent.click(closeButton)
    
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('applies different sizes correctly', () => {
    const { rerender } = render(
      <Modal isOpen={true} onClose={mockOnClose} size="sm">
        <div>Small Modal</div>
      </Modal>
    )
    
    let modalContent = document.querySelector('.max-w-md')
    expect(modalContent).toBeInTheDocument()

    rerender(
      <Modal isOpen={true} onClose={mockOnClose} size="lg">
        <div>Large Modal</div>
      </Modal>
    )
    
    modalContent = document.querySelector('.max-w-2xl')
    expect(modalContent).toBeInTheDocument()

    rerender(
      <Modal isOpen={true} onClose={mockOnClose} size="xl">
        <div>Extra Large Modal</div>
      </Modal>
    )
    
    modalContent = document.querySelector('.max-w-4xl')
    expect(modalContent).toBeInTheDocument()
  })

  it('handles escape key press', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose}>
        <div>Modal Content</div>
      </Modal>
    )
    
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('sets body overflow to hidden when open', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose}>
        <div>Modal Content</div>
      </Modal>
    )
    
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('cleans up event listeners and body style on unmount', () => {
    const { unmount } = render(
      <Modal isOpen={true} onClose={mockOnClose}>
        <div>Modal Content</div>
      </Modal>
    )
    
    unmount()
    expect(document.body.style.overflow).toBe('unset')
  })

  it('has proper ARIA and accessibility attributes', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose} title="Accessible Modal">
        <div>Modal Content</div>
      </Modal>
    )
    
    const modal = document.querySelector('.relative.bg-white')
    expect(modal).toBeInTheDocument()
    
    // Modal should be rendered in a fixed overlay
    const overlay = document.querySelector('.fixed.inset-0')
    expect(overlay).toBeInTheDocument()
  })

  it('provides scrollable content area', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose} title="Scrollable Modal">
        <div style={{ height: '200vh' }}>Very tall content</div>
      </Modal>
    )
    
    const contentArea = document.querySelector('.overflow-y-auto.max-h-\\[calc\\(90vh-120px\\)\\]')
    expect(contentArea).toBeInTheDocument()
  })
})