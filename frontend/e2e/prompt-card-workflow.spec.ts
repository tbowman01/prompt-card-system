import { test, expect, Page } from '@playwright/test'

test.describe('Prompt Card Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/')
  })

  test('complete prompt card creation and testing workflow', async ({ page }) => {
    // Step 1: Navigate to create new prompt card
    await page.click('text=Create New Prompt Card')
    await expect(page).toHaveURL('/prompt-cards/new')

    // Step 2: Fill out the prompt card form
    await page.fill('input[name="title"]', 'E2E Test Prompt Card')
    await page.fill('textarea[name="description"]', 'A test prompt card created during E2E testing')
    await page.fill('textarea[name="template"]', 'Generate a response for: {{query}}\nTone: {{tone}}')

    // Step 3: Submit the form
    await page.click('button[type="submit"]')
    
    // Step 4: Verify redirection to prompt cards list
    await expect(page).toHaveURL('/prompt-cards')
    await expect(page.locator('text=E2E Test Prompt Card')).toBeVisible()

    // Step 5: Navigate to the created card
    await page.click('text=E2E Test Prompt Card')
    
    // Step 6: Verify card details page
    await expect(page.locator('h1')).toContainText('E2E Test Prompt Card')
    await expect(page.locator('text=query')).toBeVisible() // Variable badge
    await expect(page.locator('text=tone')).toBeVisible() // Variable badge

    // Step 7: Add a test case
    await page.click('text=Add Test Case')
    await page.fill('input[name="testCaseName"]', 'Friendly response test')
    await page.fill('input[name="query"]', 'How do I reset my password?')
    await page.fill('input[name="tone"]', 'friendly')
    await page.fill('textarea[name="expectedOutput"]', 'Helpful and friendly response')
    
    // Add assertion
    await page.click('text=Add Assertion')
    await page.selectOption('select[name="assertionType"]', 'contains')
    await page.fill('input[name="assertionValue"]', 'password')
    await page.fill('input[name="assertionDescription"]', 'Should mention password')
    
    await page.click('button:has-text("Save Test Case")')

    // Step 8: Run the test
    await page.click('text=Run Tests')
    
    // Step 9: Verify test execution starts
    await expect(page.locator('text=Running tests')).toBeVisible()
    
    // Step 10: Wait for test completion and verify results
    await expect(page.locator('text=Test completed')).toBeVisible({ timeout: 30000 })
    await expect(page.locator('text=Friendly response test')).toBeVisible()
  })

  test('analytics dashboard displays metrics', async ({ page }) => {
    // Navigate to analytics
    await page.goto('/analytics')
    
    // Verify dashboard loads
    await expect(page.locator('h1')).toContainText('Analytics Dashboard')
    
    // Check for metric cards
    await expect(page.locator('text=Real-time Metrics')).toBeVisible()
    await expect(page.locator('text=Active Tests')).toBeVisible()
    await expect(page.locator('text=Success Rate')).toBeVisible()
    await expect(page.locator('text=Historical Overview')).toBeVisible()
    
    // Verify charts load (may take time for data)
    await expect(page.locator('[data-testid="performance-chart"]')).toBeVisible({ timeout: 10000 })
  })

  test('health dashboard shows system status', async ({ page }) => {
    // Navigate to health dashboard
    await page.goto('/health')
    
    // Verify health status
    await expect(page.locator('h1')).toContainText('System Health')
    await expect(page.locator('text=Overall Status')).toBeVisible()
    
    // Check service status indicators
    await expect(page.locator('text=Database')).toBeVisible()
    await expect(page.locator('text=Ollama')).toBeVisible()
    
    // Verify status badges (should be green for healthy)
    await expect(page.locator('.bg-green-100').first()).toBeVisible()
  })

  test('responsive design works on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    // Navigate to main page
    await page.goto('/')
    
    // Verify mobile navigation
    await page.click('[data-testid="mobile-menu-button"]')
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible()
    
    // Navigate to prompt cards
    await page.click('text=Prompt Cards')
    await expect(page).toHaveURL('/prompt-cards')
    
    // Verify responsive layout
    await expect(page.locator('.grid')).toHaveClass(/grid-cols-1/)
  })

  test('error handling and loading states', async ({ page }) => {
    // Test loading states
    await page.goto('/prompt-cards')
    
    // Should show loading spinner initially
    await expect(page.locator('.animate-spin')).toBeVisible()
    
    // Wait for content to load
    await expect(page.locator('text=Prompt Cards')).toBeVisible()
    await expect(page.locator('.animate-spin')).not.toBeVisible()
    
    // Test error state by navigating to non-existent card
    await page.goto('/prompt-cards/99999')
    await expect(page.locator('text=not found').or(page.locator('text=error'))).toBeVisible()
  })

  test('search and filtering functionality', async ({ page }) => {
    await page.goto('/prompt-cards')
    
    // Wait for initial load
    await expect(page.locator('text=Prompt Cards')).toBeVisible()
    
    // Test search functionality
    const searchInput = page.locator('input[placeholder*="search"]')
    if (await searchInput.isVisible()) {
      await searchInput.fill('Customer Service')
      await page.keyboard.press('Enter')
      
      // Verify filtered results
      await expect(page.locator('text=Customer Service')).toBeVisible()
    }
    
    // Clear search
    if (await searchInput.isVisible()) {
      await searchInput.clear()
      await page.keyboard.press('Enter')
    }
  })
})

test.describe('Accessibility', () => {
  test('keyboard navigation works', async ({ page }) => {
    await page.goto('/')
    
    // Test keyboard navigation
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Enter')
    
    // Should navigate somewhere
    await expect(page).not.toHaveURL('/')
  })

  test('proper ARIA labels and roles', async ({ page }) => {
    await page.goto('/')
    
    // Check for proper headings
    await expect(page.locator('h1')).toBeVisible()
    
    // Check for button roles
    const buttons = page.locator('button')
    expect(await buttons.count()).toBeGreaterThan(0)
    
    // Check for form labels
    await page.goto('/prompt-cards/new')
    await expect(page.locator('label[for="title"]')).toBeVisible()
    await expect(page.locator('label[for="description"]')).toBeVisible()
  })
})

// Helper functions for common actions
async function createPromptCard(page: Page, title: string, template: string) {
  await page.goto('/prompt-cards/new')
  await page.fill('input[name="title"]', title)
  await page.fill('textarea[name="template"]', template)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('/prompt-cards')
}

async function addTestCase(page: Page, name: string, variables: Record<string, string>) {
  await page.click('text=Add Test Case')
  await page.fill('input[name="testCaseName"]', name)
  
  for (const [key, value] of Object.entries(variables)) {
    await page.fill(`input[name="${key}"]`, value)
  }
  
  await page.click('button:has-text("Save Test Case")')
}