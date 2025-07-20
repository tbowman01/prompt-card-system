import { test, expect, Page, BrowserContext } from '@playwright/test'

/**
 * Critical User Workflows E2E Tests
 * Tests for mission-critical user journeys that must work flawlessly
 */

test.describe('Critical User Workflows', () => {
  let context: BrowserContext
  let page: Page

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      // Enable performance monitoring
      recordVideo: {
        dir: 'e2e/artifacts/videos',
        size: { width: 1280, height: 720 }
      },
      recordHar: {
        path: 'e2e/artifacts/critical-workflows.har'
      }
    })
    page = await context.newPage()
    
    // Enable console logging for debugging
    page.on('console', msg => console.log(`[${msg.type()}] ${msg.text()}`))
    page.on('pageerror', err => console.error(`[PAGE ERROR] ${err.message}`))
  })

  test.afterAll(async () => {
    await context.close()
  })

  test.describe('End-to-End Prompt Card Lifecycle', () => {
    test('complete prompt card creation, testing, and optimization workflow', async () => {
      // Performance tracking
      const startTime = Date.now()
      
      // Step 1: Navigate to application and verify load time
      await page.goto('/', { waitUntil: 'networkidle' })
      await expect(page).toHaveTitle(/Prompt Card System/)
      
      const loadTime = Date.now() - startTime
      console.log(`[PERF] Initial page load: ${loadTime}ms`)
      expect(loadTime).toBeLessThan(3000) // Page should load within 3s
      
      // Step 2: Create new prompt card with comprehensive data
      await page.click('text=Create New Prompt Card')
      await expect(page).toHaveURL('/prompt-cards/new')
      
      const promptData = {
        title: 'E2E Critical Test - Customer Support Bot',
        description: 'A comprehensive customer support assistant for handling inquiries',
        template: `You are a professional customer support assistant for {{company}}.

Customer Issue: {{issue}}
Customer Tier: {{tier}}
Urgency Level: {{urgency}}

Please provide a {{tone}} response that:
1. Acknowledges the customer's concern
2. Provides a clear solution or next steps
3. Maintains a {{tone}} tone
4. Includes relevant {{company}} policies if applicable

Response:`,
        variables: [
          { name: 'company', type: 'text', default: 'TechCorp' },
          { name: 'issue', type: 'text', required: true },
          { name: 'tier', type: 'select', options: ['Basic', 'Premium', 'Enterprise'] },
          { name: 'urgency', type: 'select', options: ['Low', 'Medium', 'High', 'Critical'] },
          { name: 'tone', type: 'select', options: ['professional', 'friendly', 'empathetic'] }
        ]
      }
      
      // Fill form with realistic data
      await page.fill('input[name="title"]', promptData.title)
      await page.fill('textarea[name="description"]', promptData.description)
      await page.fill('textarea[name="template"]', promptData.template)
      
      // Submit and verify creation
      await page.click('button[type="submit"]')
      await expect(page).toHaveURL('/prompt-cards')
      await expect(page.locator(`text=${promptData.title}`)).toBeVisible()
      
      // Step 3: Navigate to created card and verify details
      await page.click(`text=${promptData.title}`)
      await expect(page.locator('h1')).toContainText(promptData.title)
      
      // Verify all template variables are detected
      for (const variable of ['company', 'issue', 'tier', 'urgency', 'tone']) {
        await expect(page.locator(`text=${variable}`)).toBeVisible()
      }
      
      // Step 4: Create comprehensive test cases
      const testCases = [
        {
          name: 'Basic Billing Inquiry',
          variables: {
            company: 'TechCorp',
            issue: 'Customer cannot find their latest invoice',
            tier: 'Basic',
            urgency: 'Low',
            tone: 'professional'
          },
          expectedOutput: 'Invoice location and access instructions',
          assertions: [
            { type: 'contains', value: 'invoice', description: 'Should mention invoice' },
            { type: 'contains', value: 'TechCorp', description: 'Should include company name' },
            { type: 'length', min: 100, description: 'Should be detailed response' }
          ]
        },
        {
          name: 'Critical Service Outage',
          variables: {
            company: 'TechCorp',
            issue: 'Complete service outage affecting production systems',
            tier: 'Enterprise',
            urgency: 'Critical',
            tone: 'empathetic'
          },
          expectedOutput: 'Immediate escalation and resolution steps',
          assertions: [
            { type: 'contains', value: 'priority', description: 'Should acknowledge priority' },
            { type: 'contains', value: 'escalate', description: 'Should mention escalation' },
            { type: 'sentiment', value: 'empathetic', description: 'Should be empathetic' }
          ]
        },
        {
          name: 'Feature Request',
          variables: {
            company: 'TechCorp',
            issue: 'Request for new dashboard customization features',
            tier: 'Premium',
            urgency: 'Medium',
            tone: 'friendly'
          },
          expectedOutput: 'Feature request process and timeline',
          assertions: [
            { type: 'contains', value: 'feature', description: 'Should address feature request' },
            { type: 'contains', value: 'timeline', description: 'Should mention timeline' },
            { type: 'tone', value: 'friendly', description: 'Should maintain friendly tone' }
          ]
        }
      ]
      
      // Create and configure each test case
      for (const testCase of testCases) {
        await page.click('text=Add Test Case')
        await page.fill('input[name="testCaseName"]', testCase.name)
        
        // Fill variable values
        for (const [key, value] of Object.entries(testCase.variables)) {
          const input = page.locator(`input[name="${key}"], select[name="${key}"]`)
          if (await input.getAttribute('type') === 'select' || await input.tagName() === 'SELECT') {
            await input.selectOption(value)
          } else {
            await input.fill(value)
          }
        }
        
        await page.fill('textarea[name="expectedOutput"]', testCase.expectedOutput)
        
        // Add assertions
        for (const assertion of testCase.assertions) {
          await page.click('text=Add Assertion')
          await page.selectOption('select[name="assertionType"]', assertion.type)
          
          if (assertion.type === 'length') {
            await page.fill('input[name="minLength"]', assertion.min?.toString() || '0')
          } else {
            await page.fill('input[name="assertionValue"]', assertion.value)
          }
          
          await page.fill('input[name="assertionDescription"]', assertion.description)
        }
        
        await page.click('button:has-text("Save Test Case")')
        await expect(page.locator(`text=${testCase.name}`)).toBeVisible()
      }
      
      // Step 5: Execute test suite with performance monitoring
      const testStartTime = Date.now()
      await page.click('text=Run All Tests')
      
      // Verify test execution starts
      await expect(page.locator('text=Running tests')).toBeVisible()
      
      // Monitor progress with timeout
      await page.waitForSelector('text=All tests completed', { timeout: 120000 })
      
      const testDuration = Date.now() - testStartTime
      console.log(`[PERF] Test execution time: ${testDuration}ms`)
      
      // Step 6: Verify test results and analyze performance
      await expect(page.locator('text=Test Results')).toBeVisible()
      
      // Check each test case result
      for (const testCase of testCases) {
        const resultRow = page.locator(`tr:has-text("${testCase.name}")`)
        await expect(resultRow).toBeVisible()
        
        // Verify test passed or get failure details
        const status = await resultRow.locator('.status-badge').textContent()
        if (status?.includes('Failed')) {
          const errorDetails = await resultRow.locator('.error-details').textContent()
          console.error(`[TEST FAILURE] ${testCase.name}: ${errorDetails}`)
        }
      }
      
      // Step 7: Access analytics and performance data
      await page.click('text=View Analytics')
      await expect(page).toHaveURL(/.*analytics.*/)
      
      // Verify analytics dashboard loads
      await expect(page.locator('text=Test Performance')).toBeVisible()
      await expect(page.locator('text=Success Rate')).toBeVisible()
      await expect(page.locator('text=Average Response Time')).toBeVisible()
      
      // Check performance metrics
      const avgResponseTime = await page.locator('[data-testid="avg-response-time"]').textContent()
      console.log(`[ANALYTICS] Average response time: ${avgResponseTime}`)
      
      // Step 8: Export test results
      await page.click('text=Export Results')
      await page.selectOption('select[name="exportFormat"]', 'json')
      
      const downloadPromise = page.waitForEvent('download')
      await page.click('button:has-text("Download")')
      const download = await downloadPromise
      
      // Verify download
      expect(download.suggestedFilename()).toMatch(/test-results.*\.json/)
      
      console.log(`[SUCCESS] Complete workflow test passed in ${Date.now() - startTime}ms`)
    })
  })

  test.describe('Real-time Collaboration Workflow', () => {
    test('multiple users collaborating on prompt cards simultaneously', async () => {
      // Create second browser context for collaboration
      const context2 = await page.context().browser()!.newContext()
      const page2 = await context2.newPage()
      
      try {
        // User 1: Create a prompt card
        await page.goto('/prompt-cards/new')
        await page.fill('input[name="title"]', 'Collaboration Test Prompt')
        await page.fill('textarea[name="template"]', 'Initial template: {{variable1}}')
        await page.click('button[type="submit"]')
        
        // Get the created card URL
        const cardUrl = page.url()
        
        // User 2: Join the same prompt card
        await page2.goto(cardUrl)
        
        // Verify real-time updates
        // User 1 edits the template
        await page.click('text=Edit')
        await page.fill('textarea[name="template"]', 'Updated template: {{variable1}} {{variable2}}')
        await page.click('button:has-text("Save")')
        
        // User 2 should see the update in real-time
        await expect(page2.locator('text=variable2')).toBeVisible({ timeout: 5000 })
        
        // User 2 adds a test case
        await page2.click('text=Add Test Case')
        await page2.fill('input[name="testCaseName"]', 'Collaborative Test Case')
        await page2.click('button:has-text("Save Test Case")')
        
        // User 1 should see the new test case
        await expect(page.locator('text=Collaborative Test Case')).toBeVisible({ timeout: 5000 })
        
        console.log('[SUCCESS] Real-time collaboration workflow passed')
        
      } finally {
        await context2.close()
      }
    })
  })

  test.describe('Performance and Load Handling', () => {
    test('system handles concurrent operations gracefully', async () => {
      const operations = []
      
      // Simulate concurrent operations
      for (let i = 0; i < 5; i++) {
        operations.push(
          (async () => {
            const context = await page.context().browser()!.newContext()
            const testPage = await context.newPage()
            
            try {
              await testPage.goto('/')
              await testPage.click('text=Create New Prompt Card')
              await testPage.fill('input[name="title"]', `Concurrent Test ${i}`)
              await testPage.fill('textarea[name="template"]', `Template ${i}: {{variable}}`)
              await testPage.click('button[type="submit"]')
              
              await expect(testPage.locator(`text=Concurrent Test ${i}`)).toBeVisible()
              return true
            } catch (error) {
              console.error(`[CONCURRENT ERROR] Operation ${i}: ${error}`)
              return false
            } finally {
              await context.close()
            }
          })()
        )
      }
      
      const results = await Promise.all(operations)
      const successCount = results.filter(Boolean).length
      
      console.log(`[CONCURRENCY] ${successCount}/5 concurrent operations succeeded`)
      expect(successCount).toBeGreaterThanOrEqual(4) // Allow for 1 failure
    })

    test('handles large datasets efficiently', async () => {
      await page.goto('/prompt-cards')
      
      // Create multiple prompt cards to test pagination
      for (let i = 0; i < 15; i++) {
        await page.click('text=Create New Prompt Card')
        await page.fill('input[name="title"]', `Bulk Test Card ${i}`)
        await page.fill('textarea[name="template"]', `Bulk template ${i}`)
        await page.click('button[type="submit"]')
        await page.waitForURL('/prompt-cards')
      }
      
      // Test pagination
      await expect(page.locator('.pagination')).toBeVisible()
      await page.click('text=Next')
      await expect(page.locator('text=Bulk Test Card 10')).toBeVisible()
      
      // Test search with large dataset
      await page.fill('input[placeholder*="search"]', 'Bulk Test Card 5')
      await page.keyboard.press('Enter')
      await expect(page.locator('text=Bulk Test Card 5')).toBeVisible()
      await expect(page.locator('text=Bulk Test Card 1')).not.toBeVisible()
      
      console.log('[SUCCESS] Large dataset handling test passed')
    })
  })

  test.describe('Error Recovery and Resilience', () => {
    test('gracefully handles network interruptions', async () => {
      // Simulate network failure during operation
      await page.goto('/prompt-cards/new')
      await page.fill('input[name="title"]', 'Network Test Card')
      await page.fill('textarea[name="template"]', 'Test template')
      
      // Simulate network failure
      await page.route('**/api/**', route => route.abort())
      
      await page.click('button[type="submit"]')
      
      // Should show error message
      await expect(page.locator('text=Network error')).toBeVisible()
      
      // Restore network and retry
      await page.unroute('**/api/**')
      await page.click('button:has-text("Retry")')
      
      // Should succeed on retry
      await expect(page).toHaveURL('/prompt-cards')
      await expect(page.locator('text=Network Test Card')).toBeVisible()
      
      console.log('[SUCCESS] Network error recovery test passed')
    })

    test('handles API errors gracefully', async () => {
      // Mock API to return errors
      await page.route('**/api/prompt-cards', route => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Internal server error' })
        })
      })
      
      await page.goto('/prompt-cards')
      
      // Should show error state
      await expect(page.locator('text=Error loading prompt cards')).toBeVisible()
      await expect(page.locator('button:has-text("Retry")')).toBeVisible()
      
      // Restore API and retry
      await page.unroute('**/api/prompt-cards')
      await page.click('button:has-text("Retry")')
      
      // Should load successfully
      await expect(page.locator('text=Prompt Cards')).toBeVisible()
      
      console.log('[SUCCESS] API error handling test passed')
    })
  })

  test.describe('Security and Validation', () => {
    test('prevents XSS and validates inputs properly', async () => {
      await page.goto('/prompt-cards/new')
      
      // Test XSS prevention
      const xssAttempt = '<script>alert("xss")</script>'
      await page.fill('input[name="title"]', xssAttempt)
      await page.fill('textarea[name="template"]', xssAttempt)
      
      await page.click('button[type="submit"]')
      await expect(page).toHaveURL('/prompt-cards')
      
      // Verify XSS was sanitized
      await page.click(`text=${xssAttempt}`)
      const pageContent = await page.textContent('body')
      expect(pageContent).not.toContain('<script>')
      
      // Test input validation
      await page.goto('/prompt-cards/new')
      await page.fill('input[name="title"]', '') // Empty title
      await page.click('button[type="submit"]')
      
      await expect(page.locator('text=Title is required')).toBeVisible()
      
      console.log('[SUCCESS] Security validation test passed')
    })
  })
})