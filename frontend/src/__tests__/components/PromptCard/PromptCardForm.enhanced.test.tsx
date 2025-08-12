import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import PromptCardForm from '@/components/PromptCard/PromptCardForm'
import { PromptCard, TestCase } from '@/types'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

// Mock the TestCaseEditor component
jest.mock('@/components/TestCase/TestCaseEditor', () => {
  return function MockTestCaseEditor({ onTestCasesChange, testCases, variables }: any) {
    return (
      <div data-testid="test-case-editor">
        <div>Variables: {variables.join(', ')}</div>
        <div>Test Cases: {testCases.length}</div>
        <button 
          onClick={() => onTestCasesChange([...testCases, { id: Date.now(), name: 'New Test' }])}
        >
          Add Test Case
        </button>
      </div>
    )
  }
})

// Mock fetch globally
global.fetch = jest.fn()

const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  replace: jest.fn(),
}

const mockFetch = fetch as jest.MockedFunction<typeof fetch>

describe('PromptCardForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
    mockFetch.mockClear()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('Create Mode', () => {
    it('renders create form with correct title and fields', () => {
      render(<PromptCardForm />)

      expect(screen.getByText('Create New Prompt Card')).toBeInTheDocument()
      expect(screen.getByText('Create a new prompt template with test cases')).toBeInTheDocument()

      // Check form fields
      expect(screen.getByLabelText(/Title \*/)).toBeInTheDocument()
      expect(screen.getByLabelText('Description')).toBeInTheDocument()
      expect(screen.getByLabelText(/Template \*/)).toBeInTheDocument()

      // Check buttons
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Create Card' })).toBeInTheDocument()

      // Should show tip for new cards
      expect(screen.getByText(/After creating the prompt card/)).toBeInTheDocument()
    })

    it('does not show test case editor for new cards', () => {
      render(<PromptCardForm />)

      expect(screen.queryByTestId('test-case-editor')).not.toBeInTheDocument()
      expect(screen.queryByText('Test Cases')).not.toBeInTheDocument()
    })

    it('validates required fields on submit', async () => {
      render(<PromptCardForm />)

      const submitButton = screen.getByRole('button', { name: 'Create Card' })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Title and prompt template are required')).toBeInTheDocument()
      })

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('submits form with valid data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { id: 1 } }),
      } as Response)

      render(<PromptCardForm />)

      // Fill form
      fireEvent.change(screen.getByLabelText(/Title \*/), { target: { value: 'Test Card' } })
      fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Test Description' } })
      fireEvent.change(screen.getByLabelText(/Template \*/), { 
        target: { value: 'Hello {{name}}, how are you?' } 
      })

      // Submit
      fireEvent.click(screen.getByRole('button', { name: 'Create Card' }))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/prompt-cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Test Card',
            description: 'Test Description',
            prompt_template: 'Hello {{name}}, how are you?',
            variables: ['name'],
          }),
        })
      })

      expect(mockRouter.push).toHaveBeenCalledWith('/prompt-cards')
    })

    it('handles API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false, error: 'Title already exists' }),
      } as Response)

      render(<PromptCardForm />)

      fireEvent.change(screen.getByLabelText(/Title \*/), { target: { value: 'Test Card' } })
      fireEvent.change(screen.getByLabelText(/Template \*/), { target: { value: 'Test template' } })
      fireEvent.click(screen.getByRole('button', { name: 'Create Card' }))

      await waitFor(() => {
        expect(screen.getByText('Title already exists')).toBeInTheDocument()
      })

      expect(mockRouter.push).not.toHaveBeenCalled()
    })

    it('handles network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      render(<PromptCardForm />)

      fireEvent.change(screen.getByLabelText(/Title \*/), { target: { value: 'Test Card' } })
      fireEvent.change(screen.getByLabelText(/Template \*/), { target: { value: 'Test template' } })
      fireEvent.click(screen.getByRole('button', { name: 'Create Card' }))

      await waitFor(() => {
        expect(screen.getByText('Network error: Failed to save prompt card')).toBeInTheDocument()
      })
    })
  })

  describe('Edit Mode with cardId', () => {
    const mockCard: PromptCard = {
      id: 1,
      title: 'Existing Card',
      description: 'Existing Description',
      prompt_template: 'Hello {{user}}, welcome to {{platform}}!',
      variables: ['user', 'platform'],
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      test_cases: [
        {
          id: 1,
          prompt_card_id: 1,
          name: 'Test Case 1',
          input_variables: { user: 'John', platform: 'TestApp' },
          assertions: [],
          created_at: '2024-01-01T00:00:00Z',
        },
      ],
    }

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockCard }),
      } as Response)
    })

    it('renders edit form with correct title', async () => {
      render(<PromptCardForm cardId={1} />)

      await waitFor(() => {
        expect(screen.getByText('Edit Prompt Card')).toBeInTheDocument()
        expect(screen.getByText('Update your prompt template and test cases')).toBeInTheDocument()
      })
    })

    it('loads and displays existing card data', async () => {
      render(<PromptCardForm cardId={1} />)

      await waitFor(() => {
        expect(screen.getByDisplayValue('Existing Card')).toBeInTheDocument()
        expect(screen.getByDisplayValue('Existing Description')).toBeInTheDocument()
        expect(screen.getByDisplayValue('Hello {{user}}, welcome to {{platform}}!')).toBeInTheDocument()
      })

      // Check detected variables
      expect(screen.getByText('user')).toBeInTheDocument()
      expect(screen.getByText('platform')).toBeInTheDocument()
    })

    it('shows test case editor for existing cards', async () => {
      render(<PromptCardForm cardId={1} />)

      await waitFor(() => {
        expect(screen.getByTestId('test-case-editor')).toBeInTheDocument()
        expect(screen.getByText('Test Cases')).toBeInTheDocument()
        expect(screen.getByText('Variables: user, platform')).toBeInTheDocument()
        expect(screen.getByText('Test Cases: 1')).toBeInTheDocument()
      })
    })

    it('shows run tests button when test cases exist', async () => {
      render(<PromptCardForm cardId={1} />)

      await waitFor(() => {
        expect(screen.getByText('Run Tests (1)')).toBeInTheDocument()
      })

      const runTestsButton = screen.getByRole('button', { name: 'Run Tests (1)' })
      fireEvent.click(runTestsButton)

      expect(mockRouter.push).toHaveBeenCalledWith('/prompt-cards/1/test')
    })

    it('updates existing card successfully', async () => {
      // Mock the initial load
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockCard }),
      } as Response)

      // Mock the update
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { ...mockCard, title: 'Updated Card' } }),
      } as Response)

      render(<PromptCardForm cardId={1} />)

      await waitFor(() => {
        expect(screen.getByDisplayValue('Existing Card')).toBeInTheDocument()
      })

      // Update title
      const titleInput = screen.getByDisplayValue('Existing Card')
      fireEvent.change(titleInput, { target: { value: 'Updated Card' } })

      // Submit
      fireEvent.click(screen.getByRole('button', { name: 'Update Card' }))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenLastCalledWith('/api/prompt-cards/1', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Updated Card',
            description: 'Existing Description',
            prompt_template: 'Hello {{user}}, welcome to {{platform}}!',
            variables: ['user', 'platform'],
          }),
        })
      })

      expect(mockRouter.push).toHaveBeenCalledWith('/prompt-cards')
    })

    it('handles loading errors when fetching existing card', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false, error: 'Card not found' }),
      } as Response)

      render(<PromptCardForm cardId={1} />)

      await waitFor(() => {
        expect(screen.getByText('Card not found')).toBeInTheDocument()
      })
    })
  })

  describe('Edit Mode with initialData', () => {
    const mockCard: PromptCard = {
      id: 2,
      title: 'Initial Data Card',
      description: 'From props',
      prompt_template: 'Template from {{source}}',
      variables: ['source'],
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      test_cases: [],
    }

    it('uses initialData instead of fetching', async () => {
      render(<PromptCardForm cardId={2} initialData={mockCard} />)

      // Should immediately show the data without loading
      expect(screen.getByDisplayValue('Initial Data Card')).toBeInTheDocument()
      expect(screen.getByDisplayValue('From props')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Template from {{source}}')).toBeInTheDocument()

      // Should not have called fetch
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('Variable Detection', () => {
    it('extracts variables from prompt template', () => {
      render(<PromptCardForm />)

      const templateInput = screen.getByLabelText(/Template \*/)
      fireEvent.change(templateInput, { 
        target: { value: 'Hello {{name}}, your {{item}} order is {{status}}!' } 
      })

      expect(screen.getByText('Detected Variables:')).toBeInTheDocument()
      expect(screen.getByText('name')).toBeInTheDocument()
      expect(screen.getByText('item')).toBeInTheDocument()
      expect(screen.getByText('status')).toBeInTheDocument()
    })

    it('handles duplicate variables correctly', () => {
      render(<PromptCardForm />)

      const templateInput = screen.getByLabelText(/Template \*/)
      fireEvent.change(templateInput, { 
        target: { value: 'Hello {{name}}, {{name}} is a great {{name}}!' } 
      })

      // Should only show 'name' once
      const nameElements = screen.getAllByText('name')
      expect(nameElements).toHaveLength(1)
    })

    it('handles templates without variables', () => {
      render(<PromptCardForm />)

      const templateInput = screen.getByLabelText(/Template \*/)
      fireEvent.change(templateInput, { target: { value: 'This is a static template' } })

      expect(screen.queryByText('Detected Variables:')).not.toBeInTheDocument()
    })

    it('handles malformed variable syntax', () => {
      render(<PromptCardForm />)

      const templateInput = screen.getByLabelText(/Template \*/)
      fireEvent.change(templateInput, { 
        target: { value: 'Hello {name} and {{valid}} and {{{invalid}}}' } 
      })

      // Should only extract properly formatted variables
      expect(screen.getByText('valid')).toBeInTheDocument()
      expect(screen.queryByText('name')).not.toBeInTheDocument()
      expect(screen.queryByText('invalid')).not.toBeInTheDocument()
    })

    it('updates TestCaseEditor with new variables', async () => {
      const mockCard: PromptCard = {
        id: 1,
        title: 'Test Card',
        prompt_template: '{{old}} template',
        variables: ['old'],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        test_cases: [],
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockCard }),
      } as Response)

      render(<PromptCardForm cardId={1} />)

      await waitFor(() => {
        expect(screen.getByText('Variables: old')).toBeInTheDocument()
      })

      // Change template to add new variables
      const templateInput = screen.getByDisplayValue('{{old}} template')
      fireEvent.change(templateInput, { 
        target: { value: '{{new}} {{variables}} template' } 
      })

      expect(screen.getByText('Variables: new, variables')).toBeInTheDocument()
    })
  })

  describe('Loading States', () => {
    it('shows loading spinner while fetching card data', () => {
      mockFetch.mockReturnValue(new Promise(() => {})) // Never resolves

      render(<PromptCardForm cardId={1} />)

      expect(screen.getByRole('status')).toBeInTheDocument() // LoadingSpinner
      expect(screen.queryByText('Edit Prompt Card')).not.toBeInTheDocument()
    })

    it('shows loading state on form submission', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

      render(<PromptCardForm />)

      fireEvent.change(screen.getByLabelText(/Title \*/), { target: { value: 'Test' } })
      fireEvent.change(screen.getByLabelText(/Template \*/), { target: { value: 'Template' } })
      fireEvent.click(screen.getByRole('button', { name: 'Create Card' }))

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /Create Card/ })
        expect(submitButton).toBeDisabled()
        // Should show loading spinner inside button
        expect(submitButton.querySelector('[role="status"]')).toBeInTheDocument()
      })
    })

    it('disables form elements during submission', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {}))

      render(<PromptCardForm />)

      fireEvent.change(screen.getByLabelText(/Title \*/), { target: { value: 'Test' } })
      fireEvent.change(screen.getByLabelText(/Template \*/), { target: { value: 'Template' } })
      fireEvent.click(screen.getByRole('button', { name: 'Create Card' }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
      })
    })
  })

  describe('Navigation', () => {
    it('navigates back on cancel', () => {
      render(<PromptCardForm />)

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(mockRouter.push).toHaveBeenCalledWith('/prompt-cards')
    })

    it('does not navigate on cancel during loading', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {}))

      render(<PromptCardForm />)

      fireEvent.change(screen.getByLabelText(/Title \*/), { target: { value: 'Test' } })
      fireEvent.change(screen.getByLabelText(/Template \*/), { target: { value: 'Template' } })
      fireEvent.click(screen.getByRole('button', { name: 'Create Card' }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
      })

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

      // Should not navigate while loading
      expect(mockRouter.push).not.toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('has proper form labels and structure', () => {
      render(<PromptCardForm />)

      expect(screen.getByRole('form')).toBeInTheDocument()
      expect(screen.getByLabelText(/Title \*/)).toBeInTheDocument()
      expect(screen.getByLabelText('Description')).toBeInTheDocument()
      expect(screen.getByLabelText(/Template \*/)).toBeInTheDocument()
    })

    it('marks required fields appropriately', () => {
      render(<PromptCardForm />)

      expect(screen.getByLabelText(/Title \*/).getAttribute('required')).toBe('')
      expect(screen.getByLabelText(/Template \*/).getAttribute('required')).toBe('')
      expect(screen.getByLabelText('Description').getAttribute('required')).toBe(null)
    })

    it('provides helpful placeholder text', () => {
      render(<PromptCardForm />)

      expect(screen.getByPlaceholderText('Enter a descriptive title for your prompt')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Describe what this prompt does and when to use it')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Enter your prompt template here. Use {{variable_name}} for dynamic content.')).toBeInTheDocument()
    })

    it('shows error messages with proper styling', async () => {
      render(<PromptCardForm />)

      fireEvent.click(screen.getByRole('button', { name: 'Create Card' }))

      await waitFor(() => {
        const errorMessage = screen.getByText('Title and prompt template are required')
        expect(errorMessage).toBeInTheDocument()
        expect(errorMessage).toHaveClass('text-red-800')
        expect(errorMessage.closest('div')).toHaveClass('bg-red-50', 'border', 'border-red-200')
      })
    })
  })
})