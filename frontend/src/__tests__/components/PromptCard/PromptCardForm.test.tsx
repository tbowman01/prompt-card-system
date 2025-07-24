import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import PromptCardForm from '@/components/PromptCard/PromptCardForm'
import { PromptCard } from '@/types'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  prefetch: jest.fn(),
}

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>

describe('PromptCardForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseRouter.mockReturnValue(mockRouter)
  })

  it('renders create form correctly', () => {
    render(<PromptCardForm />)

    expect(screen.getByText('Create New Prompt Card')).toBeInTheDocument()
    expect(screen.getByText('Create a new prompt template with test cases')).toBeInTheDocument()
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/template/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create card/i })).toBeInTheDocument()
  })

  it('renders edit form with initial data', () => {
    const initialData: PromptCard = {
      id: 1,
      title: 'Test Card',
      description: 'Test description',
      prompt_template: 'Hello {{name}}',
      variables: ['name'],
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }

    render(<PromptCardForm cardId={1} initialData={initialData} />)

    expect(screen.getByText('Edit Prompt Card')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Test Card')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Test description')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Hello {{name}}')).toBeInTheDocument()
    expect(screen.getByText('name')).toBeInTheDocument() // Variable badge
    expect(screen.getByRole('button', { name: /update card/i })).toBeInTheDocument()
  })

  it('extracts variables from prompt template', () => {
    render(<PromptCardForm />)

    const templateInput = screen.getByLabelText(/template/i)
    fireEvent.change(templateInput, {
      target: { value: 'Hello {{name}}, you are {{age}} years old. Welcome {{name}}!' }
    })

    // Should show unique variables
    expect(screen.getByText('name')).toBeInTheDocument()
    expect(screen.getByText('age')).toBeInTheDocument()
    
    // Should only show unique variables (name appears twice but should only show once)
    const nameBadges = screen.getAllByText('name')
    expect(nameBadges).toHaveLength(1)
  })

  it('shows validation errors for empty required fields', async () => {
    render(<PromptCardForm />)

    const submitButton = screen.getByRole('button', { name: /create card/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Title and prompt template are required')).toBeInTheDocument()
    })
  })

  it('submits form successfully for new card', async () => {
    render(<PromptCardForm />)

    // Fill out the form
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: 'New Test Card' }
    })
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'Test description' }
    })
    fireEvent.change(screen.getByLabelText(/template/i), {
      target: { value: 'Hello {{name}}' }
    })

    const submitButton = screen.getByRole('button', { name: /create card/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/prompt-cards')
    })
  })

  it('handles form submission errors', async () => {
    // Mock fetch to return error
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: async () => ({ success: false, error: 'Server error' }),
    })

    render(<PromptCardForm />)

    // Fill out the form
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: 'Test Card' }
    })
    fireEvent.change(screen.getByLabelText(/template/i), {
      target: { value: 'Hello {{name}}' }
    })

    const submitButton = screen.getByRole('button', { name: /create card/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument()
    })
  })

  it('handles network errors', async () => {
    // Mock fetch to throw network error
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'))

    render(<PromptCardForm />)

    // Fill out the form
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: 'Test Card' }
    })
    fireEvent.change(screen.getByLabelText(/template/i), {
      target: { value: 'Hello {{name}}' }
    })

    const submitButton = screen.getByRole('button', { name: /create card/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Network error: Failed to save prompt card')).toBeInTheDocument()
    })
  })

  it('navigates back on cancel', () => {
    render(<PromptCardForm />)

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    fireEvent.click(cancelButton)

    expect(mockRouter.push).toHaveBeenCalledWith('/prompt-cards')
  })

  it('loads existing card data when cardId is provided', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: async () => ({
        success: true,
        data: {
          id: 1,
          title: 'Loaded Card',
          description: 'Loaded description',
          prompt_template: 'Hello {{user}}',
          variables: ['user'],
          test_cases: [],
        },
      }),
    })

    render(<PromptCardForm cardId={1} />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Loaded Card')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Loaded description')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Hello {{user}}')).toBeInTheDocument()
    })
  })

  it('shows loading state while submitting', async () => {
    // Mock fetch with delay
    global.fetch = jest.fn().mockImplementation(() => 
      new Promise(resolve => 
        setTimeout(() => resolve({
          json: async () => ({ success: true, data: {} }),
        }), 100)
      )
    )

    render(<PromptCardForm />)

    // Fill out form
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: 'Test Card' }
    })
    fireEvent.change(screen.getByLabelText(/template/i), {
      target: { value: 'Hello {{name}}' }
    })

    const submitButton = screen.getByRole('button', { name: /create card/i })
    fireEvent.click(submitButton)

    // Should show loading spinner in button
    expect(submitButton).toBeDisabled()
    expect(submitButton.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('shows test runner button for existing cards with test cases', () => {
    const initialData: PromptCard = {
      id: 1,
      title: 'Test Card',
      prompt_template: 'Hello {{name}}',
      variables: ['name'],
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      test_cases: [
        {
          id: 1,
          prompt_card_id: 1,
          name: 'Test case 1',
          input_variables: { name: 'John' },
          assertions: [],
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 2,
          prompt_card_id: 1,
          name: 'Test case 2',
          input_variables: { name: 'Jane' },
          assertions: [],
          created_at: '2024-01-01T00:00:00Z',
        },
      ],
    }

    render(<PromptCardForm cardId={1} initialData={initialData} />)

    const testButton = screen.getByRole('button', { name: /run tests \(2\)/i })
    expect(testButton).toBeInTheDocument()
    
    fireEvent.click(testButton)
    expect(mockRouter.push).toHaveBeenCalledWith('/prompt-cards/1/test')
  })

  it('shows helpful tip for new cards', () => {
    render(<PromptCardForm />)

    expect(screen.getByText(/After creating the prompt card/)).toBeInTheDocument()
    expect(screen.getByText(/you'll be able to add test cases/)).toBeInTheDocument()
  })
})