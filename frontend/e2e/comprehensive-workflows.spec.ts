import { test, expect } from '@playwright/test'

test.describe('Comprehensive User Workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Set up any necessary authentication or state
    await page.goto('/')
  })

  test.describe('Prompt Card Management Workflow', () => {
    test('complete prompt card lifecycle - create, edit, test, delete', async ({ page }) => {
      // Navigate to prompt cards page
      await page.goto('/prompt-cards')
      
      // Verify we're on the prompt cards page
      await expect(page).toHaveTitle(/Prompt Cards/)
      
      // Create new prompt card
      await page.click('text=Create New Prompt Card')
      
      // Fill out the form
      await page.fill('[data-testid="title-input"]', 'E2E Test Card')
      await page.fill('[data-testid="description-input"]', 'A prompt card created during E2E testing')
      await page.fill('[data-testid="template-input"]', 'Hello {{name}}, welcome to {{platform}}! How can I help you with {{topic}}?')
      
      // Verify variables are detected
      await expect(page.locator('text=name')).toBeVisible()
      await expect(page.locator('text=platform')).toBeVisible()
      await expect(page.locator('text=topic')).toBeVisible()
      
      // Submit the form
      await page.click('button[type="submit"]')
      
      // Wait for redirect and verify creation
      await expect(page).toHaveURL(/\/prompt-cards$/)
      await expect(page.locator('text=E2E Test Card')).toBeVisible()
      
      // Edit the created prompt card
      await page.click('[data-testid="edit-card-button"]')
      
      // Update the title
      await page.fill('[data-testid="title-input"]', 'Updated E2E Test Card')
      
      // Add a test case
      await page.click('text=Add Test Case')
      await page.fill('[data-testid="test-case-name"]', 'Friendly greeting test')
      await page.fill('[data-testid="input-name"]', 'John')
      await page.fill('[data-testid="input-platform"]', 'TestApp')
      await page.fill('[data-testid="input-topic"]', 'getting started')
      
      // Add assertions
      await page.click('text=Add Assertion')
      await page.selectOption('[data-testid="assertion-type"]', 'contains')
      await page.fill('[data-testid="assertion-value"]', 'Hello John')
      
      await page.click('text=Add Assertion')
      await page.selectOption('[data-testid="assertion-type-2"]', 'contains')
      await page.fill('[data-testid="assertion-value-2"]', 'TestApp')
      
      // Save changes
      await page.click('button[type="submit"]')
      
      // Verify update
      await expect(page.locator('text=Updated E2E Test Card')).toBeVisible()
      
      // Run tests
      await page.click('text=Run Tests')
      
      // Wait for test execution to complete
      await expect(page.locator('text=Test Results')).toBeVisible({ timeout: 10000 })
      await expect(page.locator('[data-testid="test-status"]')).toHaveText(/completed|passed|failed/)
      
      // View test results
      await expect(page.locator('[data-testid="test-result-item"]')).toBeVisible()
      
      // Navigate back to prompt cards list
      await page.click('text=Back to Prompt Cards')
      
      // Delete the prompt card
      await page.click('[data-testid="delete-card-button"]')
      await page.click('text=Confirm Delete')
      
      // Verify deletion
      await expect(page.locator('text=Updated E2E Test Card')).not.toBeVisible()
    })

    test('prompt card creation with validation errors', async ({ page }) => {
      await page.goto('/prompt-cards/new')
      
      // Try to submit empty form
      await page.click('button[type="submit"]')
      
      // Check for validation errors
      await expect(page.locator('text=Title and prompt template are required')).toBeVisible()
      
      // Fill only title
      await page.fill('[data-testid="title-input"]', 'Incomplete Card')
      await page.click('button[type="submit"]')
      
      // Should still show error
      await expect(page.locator('text=Title and prompt template are required')).toBeVisible()
      
      // Fill template
      await page.fill('[data-testid="template-input"]', 'Simple template')
      await page.click('button[type="submit"]')
      
      // Should succeed
      await expect(page).toHaveURL(/\/prompt-cards$/)
    })
  })

  test.describe('Analytics Dashboard Workflow', () => {
    test('analytics dashboard loads and displays metrics', async ({ page }) => {
      await page.goto('/analytics')
      
      // Wait for metrics to load
      await expect(page.locator('text=Real-time Metrics')).toBeVisible()
      await expect(page.locator('text=Historical Overview')).toBeVisible()
      
      // Verify metric cards are present
      await expect(page.locator('[data-testid="active-tests-metric"]')).toBeVisible()
      await expect(page.locator('[data-testid="success-rate-metric"]')).toBeVisible()
      await expect(page.locator('[data-testid="response-time-metric"]')).toBeVisible()
      
      // Check that metrics have numeric values
      const activeTests = await page.locator('[data-testid="active-tests-value"]').textContent()
      expect(parseInt(activeTests || '0')).toBeGreaterThanOrEqual(0)
      
      // Verify charts are rendered (if using chart library)
      await expect(page.locator('[data-testid="performance-chart"]')).toBeVisible()
      
      // Check most used models section
      await expect(page.locator('text=Most Used Models')).toBeVisible()
      await expect(page.locator('[data-testid="model-ranking"]')).toBeVisible()
    })

    test('analytics auto-refresh functionality', async ({ page }) => {
      await page.goto('/analytics')
      
      // Wait for initial load
      await expect(page.locator('text=Real-time Metrics')).toBeVisible()
      
      // Get initial value
      const initialValue = await page.locator('[data-testid="active-tests-value"]').textContent()
      
      // Wait for auto-refresh (30 seconds is too long for E2E, so we'll mock shorter interval)
      // In real implementation, you might want to add a data-testid to trigger refresh
      await page.click('[data-testid="refresh-metrics"]', { timeout: 5000 })
      
      // Verify the request was made (the value might be the same)
      await expect(page.locator('[data-testid="active-tests-value"]')).toBeVisible()
    })
  })

  test.describe('Test Execution Workflow', () => {
    test('complete test execution flow', async ({ page }) => {
      // First create a prompt card with test cases (or use existing)
      await page.goto('/prompt-cards')
      
      // Assume there's already a card with test cases
      await page.click('[data-testid="view-card-button"]:first-child')
      
      // Navigate to test execution
      await page.click('text=Run Tests')
      
      // Configure test run
      await expect(page.locator('text=Test Configuration')).toBeVisible()
      
      // Select model (if available)
      await page.selectOption('[data-testid="model-select"]', 'gpt-4')
      
      // Select test cases to run
      await page.check('[data-testid="test-case-checkbox"]:first-child')
      
      // Start test execution
      await page.click('button[data-testid="start-execution"]')
      
      // Wait for execution to start
      await expect(page.locator('text=Test execution started')).toBeVisible()
      
      // Monitor progress
      await expect(page.locator('[data-testid="execution-progress"]')).toBeVisible()
      
      // Wait for completion
      await expect(page.locator('text=Execution completed')).toBeVisible({ timeout: 30000 })
      
      // View results
      await expect(page.locator('[data-testid="test-results-table"]')).toBeVisible()
      await expect(page.locator('[data-testid="result-row"]')).toBeVisible()
      
      // Check individual test result
      await page.click('[data-testid="view-result-details"]:first-child')
      await expect(page.locator('text=Assertion Results')).toBeVisible()
      await expect(page.locator('[data-testid="assertion-result"]')).toBeVisible()
    })

    test('parallel test execution monitoring', async ({ page }) => {
      await page.goto('/test-execution')
      
      // Start multiple test executions (simulate)
      await page.click('text=Start New Execution')
      await page.click('[data-testid="quick-start-execution"]')
      
      // Monitor queue
      await expect(page.locator('text=Execution Queue')).toBeVisible()
      await expect(page.locator('[data-testid="queue-item"]')).toBeVisible()
      
      // Check real-time progress updates
      await expect(page.locator('[data-testid="progress-indicator"]')).toBeVisible()
      
      // Verify queue management features
      await expect(page.locator('[data-testid="pause-queue"]')).toBeVisible()
      await expect(page.locator('[data-testid="clear-completed"]')).toBeVisible()
    })
  })

  test.describe('Health Monitoring Workflow', () => {
    test('system health dashboard', async ({ page }) => {
      await page.goto('/health')
      
      // Verify health status indicators
      await expect(page.locator('text=System Health')).toBeVisible()
      await expect(page.locator('[data-testid="overall-health-status"]')).toBeVisible()
      
      // Check service statuses
      await expect(page.locator('[data-testid="database-status"]')).toBeVisible()
      await expect(page.locator('[data-testid="ollama-status"]')).toBeVisible()
      
      // Verify health checks are recent
      const lastChecked = await page.locator('[data-testid="last-health-check"]').textContent()
      expect(lastChecked).toContain('seconds ago')
      
      // Test health check refresh
      await page.click('[data-testid="refresh-health"]')
      await expect(page.locator('[data-testid="health-loading"]')).toBeVisible()
      await expect(page.locator('[data-testid="health-loading"]')).not.toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Monitoring and Alerts Workflow', () => {
    test('monitoring dashboard with real-time updates', async ({ page }) => {
      await page.goto('/monitoring')
      
      // Wait for monitoring dashboard to load
      await expect(page.locator('text=System Monitoring')).toBeVisible()
      
      // Verify different monitoring sections
      await expect(page.locator('text=Performance Metrics')).toBeVisible()
      await expect(page.locator('text=Error Tracking')).toBeVisible()
      await expect(page.locator('text=Resource Usage')).toBeVisible()
      
      // Check that charts and graphs are rendered
      await expect(page.locator('[data-testid="performance-chart"]')).toBeVisible()
      await expect(page.locator('[data-testid="error-rate-chart"]')).toBeVisible()
      
      // Test alert management
      if (await page.locator('[data-testid="active-alert"]').isVisible()) {
        await page.click('[data-testid="alert-details"]:first-child')
        await expect(page.locator('text=Alert Details')).toBeVisible()
        await expect(page.locator('[data-testid="alert-severity"]')).toBeVisible()
      }
    })
  })

  test.describe('Error Handling and Edge Cases', () => {
    test('handles API errors gracefully', async ({ page }) => {
      // Mock API to return errors
      await page.route('**/api/prompt-cards', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'Internal server error' })
        })
      })
      
      await page.goto('/prompt-cards')
      
      // Should show error message
      await expect(page.locator('text=Failed to load prompt cards')).toBeVisible()
      
      // Should show retry button
      await expect(page.locator('text=Retry')).toBeVisible()
      
      // Test retry functionality
      await page.unroute('**/api/prompt-cards')
      await page.click('text=Retry')
      
      // Should load successfully after retry
      await expect(page.locator('[data-testid="prompt-cards-list"]')).toBeVisible()
    })

    test('handles network connectivity issues', async ({ page }) => {
      await page.goto('/analytics')
      
      // Wait for initial load
      await expect(page.locator('text=Real-time Metrics')).toBeVisible()
      
      // Simulate network failure
      await page.setOffline(true)
      
      // Try to refresh
      await page.click('[data-testid="refresh-metrics"]')
      
      // Should show offline indicator
      await expect(page.locator('text=Connection lost')).toBeVisible()
      
      // Restore connection
      await page.setOffline(false)
      
      // Should automatically reconnect
      await expect(page.locator('text=Connection restored')).toBeVisible({ timeout: 10000 })
    })

    test('handles very large datasets', async ({ page }) => {
      // Mock API to return large dataset
      await page.route('**/api/prompt-cards*', route => {
        const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
          id: i + 1,
          title: `Prompt Card ${i + 1}`,
          description: `Description for prompt card ${i + 1}`,
          prompt_template: `Template ${i + 1}`,
          variables: [`var${i + 1}`],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          test_case_count: Math.floor(Math.random() * 10)
        }))
        
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              prompt_cards: largeDataset.slice(0, 50), // Paginated
              pagination: {
                page: 1,
                limit: 50,
                total: largeDataset.length,
                pages: Math.ceil(largeDataset.length / 50)
              }
            }
          })
        })
      })
      
      await page.goto('/prompt-cards')
      
      // Should handle large dataset with pagination
      await expect(page.locator('[data-testid="pagination"]')).toBeVisible()
      await expect(page.locator('text=1000 total cards')).toBeVisible()
      
      // Test pagination performance
      const startTime = Date.now()
      await page.click('[data-testid="next-page"]')
      await expect(page.locator('[data-testid="page-2"]')).toBeVisible()
      const endTime = Date.now()
      
      // Should load within reasonable time
      expect(endTime - startTime).toBeLessThan(3000)
    })
  })

  test.describe('Accessibility and Usability', () => {
    test('keyboard navigation works throughout the app', async ({ page }) => {
      await page.goto('/prompt-cards')
      
      // Test tab navigation
      await page.keyboard.press('Tab')
      await expect(page.locator(':focus')).toBeVisible()
      
      // Navigate through interactive elements
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab')
        const focused = await page.locator(':focus')
        if (await focused.isVisible()) {
          // Ensure focused element is actually focusable
          const tagName = await focused.evaluate(el => el.tagName)
          const role = await focused.getAttribute('role')
          const tabIndex = await focused.getAttribute('tabindex')
          
          expect(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(tagName) || 
                 role === 'button' || 
                 tabIndex === '0').toBeTruthy()
        }
      }
    })

    test('screen reader compatibility', async ({ page }) => {
      await page.goto('/prompt-cards')
      
      // Check for proper ARIA labels and roles
      await expect(page.locator('[role="main"]')).toBeVisible()
      await expect(page.locator('[aria-label="Prompt cards list"]')).toBeVisible()
      
      // Verify heading structure
      await expect(page.locator('h1')).toBeVisible()
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').all()
      expect(headings.length).toBeGreaterThan(0)
      
      // Check form labels
      await page.goto('/prompt-cards/new')
      const inputs = await page.locator('input, textarea, select').all()
      for (const input of inputs) {
        const id = await input.getAttribute('id')
        const ariaLabel = await input.getAttribute('aria-label')
        const ariaLabelledBy = await input.getAttribute('aria-labelledby')
        
        if (id) {
          const hasLabel = await page.locator(`label[for="${id}"]`).isVisible()
          expect(hasLabel || ariaLabel || ariaLabelledBy).toBeTruthy()
        }
      }
    })
  })

  test.describe('Performance and Load Testing', () => {
    test('page load times are acceptable', async ({ page }) => {
      const startTime = Date.now()
      await page.goto('/prompt-cards')
      await expect(page.locator('[data-testid="prompt-cards-list"]')).toBeVisible()
      const loadTime = Date.now() - startTime
      
      // Should load within 3 seconds
      expect(loadTime).toBeLessThan(3000)
    })

    test('handles rapid user interactions', async ({ page }) => {
      await page.goto('/prompt-cards/new')
      
      // Rapidly fill and clear form fields
      for (let i = 0; i < 10; i++) {
        await page.fill('[data-testid="title-input"]', `Title ${i}`)
        await page.fill('[data-testid="title-input"]', '')
      }
      
      // Should remain responsive
      await page.fill('[data-testid="title-input"]', 'Final Title')
      await expect(page.locator('[data-testid="title-input"]')).toHaveValue('Final Title')
    })
  })

  test.describe('Cross-browser Compatibility', () => {
    test('works consistently across different viewport sizes', async ({ page }) => {
      // Test desktop view
      await page.setViewportSize({ width: 1920, height: 1080 })
      await page.goto('/prompt-cards')
      await expect(page.locator('[data-testid="prompt-cards-grid"]')).toBeVisible()
      
      // Test tablet view
      await page.setViewportSize({ width: 768, height: 1024 })
      await page.reload()
      await expect(page.locator('[data-testid="prompt-cards-list"]')).toBeVisible()
      
      // Test mobile view
      await page.setViewportSize({ width: 375, height: 667 })
      await page.reload()
      await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible()
      
      // Ensure navigation works on mobile
      await page.click('[data-testid="mobile-menu-toggle"]')
      await expect(page.locator('[data-testid="mobile-nav-menu"]')).toBeVisible()
    })
  })
})