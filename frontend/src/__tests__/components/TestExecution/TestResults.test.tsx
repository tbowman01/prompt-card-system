import { render, screen } from '@testing-library/react'
import { TestResults } from '@/components/TestExecution/TestResults'
import { TestResult } from '@/types'

const mockTestResults: TestResult[] = [
  {
    id: 1,
    test_case_id: 1,
    test_case_name: 'Friendly response test',
    status: 'passed',
    actual_output: 'I apologize for the inconvenience with your damaged product...',
    expected_output: 'Professional and empathetic response',
    assertion_results: [
      {
        type: 'contains',
        expected: 'sorry',
        actual: 'apologize',
        passed: true,
        description: 'Should apologize',
      },
      {
        type: 'not-contains',
        expected: 'angry',
        actual: 'I apologize for the inconvenience',
        passed: true,
        description: 'Should not be angry',
      },
    ],
    execution_time_ms: 1250,
    model_used: 'gpt-4',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    test_case_id: 2,
    test_case_name: 'Professional response test',
    status: 'failed',
    actual_output: 'Please contact customer service for assistance.',
    expected_output: 'Detailed return policy information',
    assertion_results: [
      {
        type: 'contains',
        expected: 'return',
        actual: 'Please contact customer service for assistance.',
        passed: false,
        description: 'Should mention returns',
      },
    ],
    execution_time_ms: 950,
    model_used: 'gpt-4',
    created_at: '2024-01-01T00:00:00Z',
    error_message: 'Response did not contain required terms',
  },
  {
    id: 3,
    test_case_id: 3,
    test_case_name: 'Error test case',
    status: 'error',
    actual_output: '',
    assertion_results: [],
    execution_time_ms: 0,
    model_used: 'gpt-4',
    created_at: '2024-01-01T00:00:00Z',
    error_message: 'Network timeout occurred',
  },
]

describe('TestResults', () => {
  it('renders test results correctly', () => {
    render(<TestResults results={mockTestResults} />)

    // Check for all test case names
    expect(screen.getByText('Friendly response test')).toBeInTheDocument()
    expect(screen.getByText('Professional response test')).toBeInTheDocument()
    expect(screen.getByText('Error test case')).toBeInTheDocument()
  })

  it('displays passed test with correct styling', () => {
    render(<TestResults results={[mockTestResults[0]]} />)

    const passedTest = screen.getByText('Friendly response test').closest('div')
    expect(passedTest).toHaveClass('border-green-200')
    expect(screen.getByText('PASSED')).toHaveClass('bg-green-100')
  })

  it('displays failed test with correct styling', () => {
    render(<TestResults results={[mockTestResults[1]]} />)

    const failedTest = screen.getByText('Professional response test').closest('div')
    expect(failedTest).toHaveClass('border-red-200')
    expect(screen.getByText('FAILED')).toHaveClass('bg-red-100')
  })

  it('displays error test with correct styling', () => {
    render(<TestResults results={[mockTestResults[2]]} />)

    const errorTest = screen.getByText('Error test case').closest('div')
    expect(errorTest).toHaveClass('border-yellow-200')
    expect(screen.getByText('ERROR')).toHaveClass('bg-yellow-100')
  })

  it('shows execution times', () => {
    render(<TestResults results={mockTestResults} />)

    expect(screen.getByText('1.25s')).toBeInTheDocument() // 1250ms formatted
    expect(screen.getByText('0.95s')).toBeInTheDocument() // 950ms formatted
  })

  it('displays model information', () => {
    render(<TestResults results={mockTestResults} />)

    const modelBadges = screen.getAllByText('gpt-4')
    expect(modelBadges).toHaveLength(3) // All tests use gpt-4
  })

  it('shows assertion results for passed tests', () => {
    render(<TestResults results={[mockTestResults[0]]} />)

    expect(screen.getByText('Should apologize')).toBeInTheDocument()
    expect(screen.getByText('Should not be angry')).toBeInTheDocument()
    
    // Check for passed assertion styling
    const assertions = screen.getAllByText('✓')
    expect(assertions).toHaveLength(2)
  })

  it('shows assertion results for failed tests', () => {
    render(<TestResults results={[mockTestResults[1]]} />)

    expect(screen.getByText('Should mention returns')).toBeInTheDocument()
    
    // Check for failed assertion styling
    expect(screen.getByText('✗')).toBeInTheDocument()
  })

  it('displays error messages when present', () => {
    render(<TestResults results={[mockTestResults[1], mockTestResults[2]]} />)

    expect(screen.getByText('Response did not contain required terms')).toBeInTheDocument()
    expect(screen.getByText('Network timeout occurred')).toBeInTheDocument()
  })

  it('shows actual and expected output', () => {
    render(<TestResults results={[mockTestResults[0]]} />)

    expect(screen.getByText(/I apologize for the inconvenience/)).toBeInTheDocument()
    expect(screen.getByText('Professional and empathetic response')).toBeInTheDocument()
  })

  it('handles empty results gracefully', () => {
    render(<TestResults results={[]} />)

    expect(screen.getByText('No test results available')).toBeInTheDocument()
  })

  it('formats execution time correctly', () => {
    const quickTest: TestResult = {
      ...mockTestResults[0],
      execution_time_ms: 150, // Should show as 150ms
    }

    const slowTest: TestResult = {
      ...mockTestResults[0],
      execution_time_ms: 5500, // Should show as 5.5s
    }

    render(<TestResults results={[quickTest, slowTest]} />)

    expect(screen.getByText('150ms')).toBeInTheDocument()
    expect(screen.getByText('5.5s')).toBeInTheDocument()
  })

  it('provides summary statistics', () => {
    render(<TestResults results={mockTestResults} />)

    // Should show overall statistics
    expect(screen.getByText(/Total: 3/)).toBeInTheDocument()
    expect(screen.getByText(/Passed: 1/)).toBeInTheDocument()
    expect(screen.getByText(/Failed: 1/)).toBeInTheDocument()
    expect(screen.getByText(/Errors: 1/)).toBeInTheDocument()
  })

  it('is accessible with proper ARIA attributes', () => {
    render(<TestResults results={mockTestResults} />)

    // Check for proper headings
    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument()
    
    // Check for list structure
    expect(screen.getByRole('list')).toBeInTheDocument()
    
    // Check for proper status indicators
    const statusElements = screen.getAllByText(/PASSED|FAILED|ERROR/)
    statusElements.forEach(element => {
      expect(element).toHaveAttribute('aria-label')
    })
  })

  it('allows expanding/collapsing detailed results', () => {
    render(<TestResults results={[mockTestResults[0]]} />)

    // Should have collapsible sections for detailed output
    const detailButtons = screen.getAllByRole('button', { name: /details|expand|show/i })
    expect(detailButtons.length).toBeGreaterThan(0)
  })

  it('highlights search terms when provided', () => {
    render(<TestResults results={mockTestResults} searchTerm="apologize" />)

    // Should highlight the search term in results
    const highlighted = screen.getByText('apologize')
    expect(highlighted).toHaveClass('bg-yellow-200')
  })

  it('sorts results by status correctly', () => {
    render(<TestResults results={mockTestResults} sortBy="status" />)

    // Get all test case names in order
    const testNames = screen.getAllByText(/test$/)
    
    // Should be sorted: errors first, then failed, then passed
    expect(testNames[0]).toHaveTextContent('Error test case')
    expect(testNames[1]).toHaveTextContent('Professional response test')
    expect(testNames[2]).toHaveTextContent('Friendly response test')
  })
})