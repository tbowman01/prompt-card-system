import { render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { SearchInput } from '@/components/ui/SearchInput'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Modal } from '@/components/ui/Modal'

// Add jest-axe matcher
expect.extend(toHaveNoViolations)

describe('Accessibility Tests', () => {
  describe('UI Components Accessibility', () => {
    it('Button component has no accessibility violations', async () => {
      const { container } = render(
        <div>
          <Button>Default Button</Button>
          <Button variant="primary" disabled>Disabled Button</Button>
          <Button variant="secondary" loading>Loading Button</Button>
          <Button variant="outline" size="lg">Large Button</Button>
        </div>
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('Badge component has no accessibility violations', async () => {
      const { container } = render(
        <div>
          <Badge>Default Badge</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="danger">Error</Badge>
          <Badge size="sm">Small</Badge>
        </div>
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('Card components have no accessibility violations', async () => {
      const { container } = render(
        <Card>
          <CardHeader>
            <CardTitle>Test Card Title</CardTitle>
          </CardHeader>
          <CardContent>
            <p>This is the card content with proper semantic structure.</p>
            <Button>Action Button</Button>
          </CardContent>
        </Card>
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('Tabs components have no accessibility violations', async () => {
      const { container } = render(
        <Tabs defaultValue="tab1">
          <TabsList role="tablist" aria-label="Main navigation tabs">
            <TabsTrigger value="tab1" role="tab" aria-controls="tab1-content">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2" role="tab" aria-controls="tab2-content">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1" role="tabpanel" id="tab1-content" aria-labelledby="tab1">
            <h2>Content for Tab 1</h2>
            <p>This is the content for the first tab.</p>
          </TabsContent>
          <TabsContent value="tab2" role="tabpanel" id="tab2-content" aria-labelledby="tab2">
            <h2>Content for Tab 2</h2>
            <p>This is the content for the second tab.</p>
          </TabsContent>
        </Tabs>
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('Progress component has no accessibility violations', async () => {
      const { container } = render(
        <div>
          <label htmlFor="progress-1">Loading Progress</label>
          <Progress value={50} aria-labelledby="progress-1" role="progressbar" aria-valuenow={50} aria-valuemax={100} />
          
          <label htmlFor="progress-2">Upload Progress: 75%</label>
          <Progress value={75} max={100} aria-labelledby="progress-2" role="progressbar" aria-valuenow={75} aria-valuemax={100} />
        </div>
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('SearchInput component has no accessibility violations', async () => {
      const { container } = render(
        <div>
          <SearchInput 
            value=""
            onChange={() => {}}
            placeholder="Search for items"
            aria-label="Search input"
          />
          
          <label htmlFor="search-2">Find products</label>
          <SearchInput 
            value=""
            onChange={() => {}}
            id="search-2"
            placeholder="Enter product name"
          />
        </div>
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('LoadingSpinner component has no accessibility violations', async () => {
      const { container } = render(
        <div>
          <LoadingSpinner aria-label="Loading content" />
          <LoadingSpinner size="lg" aria-label="Loading large content" />
        </div>
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('Modal component has no accessibility violations', async () => {
      const { container } = render(
        <Modal isOpen={true} onClose={() => {}} title="Test Modal">
          <div>
            <h2>Modal Title</h2>
            <p>This is modal content with proper accessibility.</p>
            <Button onClick={() => {}}>Close</Button>
          </div>
        </Modal>
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('Form Accessibility', () => {
    it('form with proper labels has no violations', async () => {
      const { container } = render(
        <form>
          <div>
            <label htmlFor="name">Full Name *</label>
            <input 
              type="text" 
              id="name" 
              required 
              aria-describedby="name-help"
            />
            <div id="name-help">Enter your full legal name</div>
          </div>
          
          <div>
            <label htmlFor="email">Email Address *</label>
            <input 
              type="email" 
              id="email" 
              required 
              aria-describedby="email-error"
              aria-invalid="false"
            />
            <div id="email-error" role="alert"></div>
          </div>
          
          <fieldset>
            <legend>Preferred Contact Method</legend>
            <label>
              <input type="radio" name="contact" value="email" />
              Email
            </label>
            <label>
              <input type="radio" name="contact" value="phone" />
              Phone
            </label>
          </fieldset>
          
          <button type="submit">Submit Form</button>
        </form>
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('form with validation errors maintains accessibility', async () => {
      const { container } = render(
        <form>
          <div>
            <label htmlFor="email-error">Email Address *</label>
            <input 
              type="email" 
              id="email-error" 
              required 
              aria-describedby="email-error-msg"
              aria-invalid="true"
            />
            <div id="email-error-msg" role="alert" style={{ color: 'red' }}>
              Please enter a valid email address
            </div>
          </div>
          
          <button type="submit">Submit</button>
        </form>
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('Navigation and Structure Accessibility', () => {
    it('proper heading hierarchy has no violations', async () => {
      const { container } = render(
        <div>
          <header>
            <h1>Main Page Title</h1>
          </header>
          
          <nav aria-label="Main navigation">
            <ul>
              <li><a href="/home">Home</a></li>
              <li><a href="/about">About</a></li>
              <li><a href="/contact">Contact</a></li>
            </ul>
          </nav>
          
          <main>
            <h2>Section Title</h2>
            <p>Main content goes here.</p>
            
            <section>
              <h3>Subsection Title</h3>
              <p>Subsection content.</p>
            </section>
          </main>
          
          <footer>
            <h2>Footer Information</h2>
            <p>Footer content.</p>
          </footer>
        </div>
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('list with proper structure has no violations', async () => {
      const { container } = render(
        <div>
          <h2>Task List</h2>
          <ul>
            <li>
              <h3>Task 1</h3>
              <p>Description of task 1</p>
              <Button>Edit</Button>
            </li>
            <li>
              <h3>Task 2</h3>
              <p>Description of task 2</p>
              <Button>Edit</Button>
            </li>
          </ul>
        </div>
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('data table with proper headers has no violations', async () => {
      const { container } = render(
        <table>
          <caption>Test Results Summary</caption>
          <thead>
            <tr>
              <th scope="col">Test Name</th>
              <th scope="col">Status</th>
              <th scope="col">Duration</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">User Login Test</th>
              <td>Passed</td>
              <td>1.2s</td>
              <td>
                <Button size="sm">View</Button>
              </td>
            </tr>
            <tr>
              <th scope="row">Password Reset Test</th>
              <td>Failed</td>
              <td>0.8s</td>
              <td>
                <Button size="sm">View</Button>
              </td>
            </tr>
          </tbody>
        </table>
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('Interactive Elements Accessibility', () => {
    it('buttons with different states maintain accessibility', async () => {
      const { container } = render(
        <div>
          <Button>Normal Button</Button>
          <Button disabled>Disabled Button</Button>
          <Button loading aria-describedby="loading-text">
            Loading Button
          </Button>
          <div id="loading-text" aria-live="polite">
            Operation in progress
          </div>
          
          <button 
            type="button"
            aria-expanded="false"
            aria-controls="dropdown-menu"
            aria-haspopup="menu"
          >
            Menu Button
          </button>
          
          <div 
            id="dropdown-menu" 
            role="menu" 
            hidden
            aria-labelledby="menu-button"
          >
            <button role="menuitem">Option 1</button>
            <button role="menuitem">Option 2</button>
          </div>
        </div>
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('links with proper context have no violations', async () => {
      const { container } = render(
        <div>
          <nav aria-label="Breadcrumb navigation">
            <ol>
              <li><a href="/">Home</a></li>
              <li><a href="/products">Products</a></li>
              <li><a href="/products/123" aria-current="page">Product Details</a></li>
            </ol>
          </nav>
          
          <p>
            Read more about our{' '}
            <a href="/privacy" aria-describedby="privacy-description">
              privacy policy
            </a>
            .
          </p>
          <div id="privacy-description" hidden>
            Opens in new window with detailed privacy information
          </div>
          
          <a href="/download" download aria-describedby="download-info">
            Download Report (PDF, 2MB)
          </a>
          <div id="download-info" hidden>
            This will download a PDF file to your device
          </div>
        </div>
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('Dynamic Content Accessibility', () => {
    it('live regions for dynamic updates have no violations', async () => {
      const { container } = render(
        <div>
          <button aria-describedby="status-message">
            Refresh Data
          </button>
          
          <div 
            id="status-message" 
            aria-live="polite" 
            aria-atomic="true"
            role="status"
          >
            Last updated: 2 minutes ago
          </div>
          
          <div aria-live="assertive" role="alert">
            {/* Error messages would appear here */}
          </div>
          
          <section aria-labelledby="results-title">
            <h2 id="results-title">Search Results</h2>
            <div aria-live="polite" aria-atomic="false">
              <p>Showing 1-10 of 250 results</p>
            </div>
          </section>
        </div>
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('Custom Component Accessibility', () => {
    it('complex interactive component maintains accessibility', async () => {
      const { container } = render(
        <div>
          <div 
            role="combobox" 
            aria-expanded="false"
            aria-haspopup="listbox"
            aria-labelledby="search-label"
          >
            <label id="search-label">Search Options</label>
            <input 
              type="text"
              aria-autocomplete="list"
              aria-controls="search-results"
            />
          </div>
          
          <ul 
            id="search-results" 
            role="listbox"
            hidden
            aria-labelledby="search-label"
          >
            <li role="option" tabIndex={-1}>Option 1</li>
            <li role="option" tabIndex={-1}>Option 2</li>
            <li role="option" tabIndex={-1}>Option 3</li>
          </ul>
        </div>
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('Color and Contrast Accessibility', () => {
    it('components with various color schemes maintain contrast', async () => {
      const { container } = render(
        <div>
          <Badge variant="success">Success Message</Badge>
          <Badge variant="warning">Warning Message</Badge>
          <Badge variant="danger">Error Message</Badge>
          
          <Button variant="primary">Primary Action</Button>
          <Button variant="secondary">Secondary Action</Button>
          <Button variant="outline">Outline Button</Button>
          
          <div style={{ background: '#f3f4f6', padding: '16px' }}>
            <p style={{ color: '#374151' }}>
              Text with sufficient contrast on light background
            </p>
          </div>
          
          <div style={{ background: '#1f2937', padding: '16px' }}>
            <p style={{ color: '#f9fafb' }}>
              Text with sufficient contrast on dark background
            </p>
          </div>
        </div>
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('Focus Management Accessibility', () => {
    it('focusable elements have proper focus indicators', async () => {
      const { container } = render(
        <div>
          <button className="focus:ring-2 focus:ring-blue-500 focus:outline-none">
            Focusable Button
          </button>
          
          <input 
            type="text"
            className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Focusable input"
          />
          
          <a 
            href="#content"
            className="focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            Skip to content
          </a>
          
          <div id="content">
            <h2>Main Content</h2>
            <p>Content that can be skipped to.</p>
          </div>
        </div>
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })
})

// Utility function to test component accessibility
export const testComponentAccessibility = async (component: React.ReactElement) => {
  const { container } = render(component)
  const results = await axe(container)
  expect(results).toHaveNoViolations()
  return results
}

// Custom accessibility testing utility
export const checkAccessibility = {
  async hasProperLabels(container: HTMLElement) {
    const inputs = container.querySelectorAll('input, select, textarea')
    const results = []
    
    for (const input of inputs) {
      const id = input.getAttribute('id')
      const ariaLabel = input.getAttribute('aria-label')
      const ariaLabelledBy = input.getAttribute('aria-labelledby')
      const hasLabel = id ? container.querySelector(`label[for="${id}"]`) : null
      
      results.push({
        element: input,
        hasLabel: !!(hasLabel || ariaLabel || ariaLabelledBy),
        id,
        ariaLabel,
        ariaLabelledBy
      })
    }
    
    return results
  },

  async hasProperHeadingStructure(container: HTMLElement) {
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6')
    const levels = Array.from(headings).map(h => parseInt(h.tagName[1]))
    
    // Check if heading levels are properly nested (no skipping levels)
    for (let i = 1; i < levels.length; i++) {
      if (levels[i] > levels[i-1] + 1) {
        return {
          valid: false,
          issue: `Heading level ${levels[i]} follows level ${levels[i-1]}, skipping levels`
        }
      }
    }
    
    return { valid: true, headings: levels }
  },

  async hasFocusManagement(container: HTMLElement) {
    const focusable = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    
    return Array.from(focusable).map(el => ({
      element: el,
      tabIndex: el.getAttribute('tabindex'),
      ariaHidden: el.getAttribute('aria-hidden'),
      disabled: el.hasAttribute('disabled')
    }))
  }
}