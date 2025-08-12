import { test, expect } from '@playwright/test'

test.describe('Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set consistent viewport for screenshots
    await page.setViewportSize({ width: 1280, height: 720 })
  })

  test.describe('Component Visual Tests', () => {
    test('UI components maintain visual consistency', async ({ page }) => {
      await page.goto('/storybook') // Assuming Storybook or component showcase page
      
      // Test different button variants
      await page.click('text=Buttons')
      await expect(page.locator('[data-testid="button-showcase"]')).toHaveScreenshot('buttons-showcase.png')
      
      // Test form components
      await page.click('text=Forms')
      await expect(page.locator('[data-testid="form-showcase"]')).toHaveScreenshot('forms-showcase.png')
      
      // Test card components
      await page.click('text=Cards')
      await expect(page.locator('[data-testid="cards-showcase"]')).toHaveScreenshot('cards-showcase.png')
    })

    test('dark mode consistency', async ({ page, context }) => {
      // Set dark mode preference
      await context.addInitScript(() => {
        localStorage.setItem('theme', 'dark')
      })
      
      await page.goto('/')
      
      // Wait for dark mode to apply
      await page.waitForFunction(() => document.documentElement.classList.contains('dark'))
      
      await expect(page).toHaveScreenshot('homepage-dark-mode.png')
      
      // Test specific components in dark mode
      await page.goto('/prompt-cards')
      await expect(page.locator('[data-testid="prompt-cards-page"]')).toHaveScreenshot('prompt-cards-dark-mode.png')
    })

    test('responsive design consistency', async ({ page }) => {
      // Test desktop view
      await page.setViewportSize({ width: 1920, height: 1080 })
      await page.goto('/prompt-cards')
      await expect(page).toHaveScreenshot('prompt-cards-desktop.png', { fullPage: true })
      
      // Test tablet view
      await page.setViewportSize({ width: 768, height: 1024 })
      await page.goto('/prompt-cards')
      await expect(page).toHaveScreenshot('prompt-cards-tablet.png', { fullPage: true })
      
      // Test mobile view
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/prompt-cards')
      await expect(page).toHaveScreenshot('prompt-cards-mobile.png', { fullPage: true })
    })
  })

  test.describe('Page Visual Tests', () => {
    test('homepage visual consistency', async ({ page }) => {
      await page.goto('/')
      
      // Wait for content to load
      await page.waitForLoadState('networkidle')
      
      await expect(page).toHaveScreenshot('homepage.png', {
        fullPage: true,
        animations: 'disabled'
      })
    })

    test('analytics dashboard visual consistency', async ({ page }) => {
      await page.goto('/analytics')
      
      // Wait for charts to render
      await page.waitForSelector('[data-testid="performance-chart"]')
      await page.waitForTimeout(2000) // Allow time for animations to complete
      
      await expect(page).toHaveScreenshot('analytics-dashboard.png', {
        fullPage: true,
        animations: 'disabled'
      })
    })

    test('prompt card form visual consistency', async ({ page }) => {
      await page.goto('/prompt-cards/new')
      
      // Fill form to show various states
      await page.fill('[data-testid="title-input"]', 'Visual Test Card')
      await page.fill('[data-testid="description-input"]', 'This card is for visual regression testing')
      await page.fill('[data-testid="template-input"]', 'Hello {{name}}, welcome to {{platform}}!')
      
      await expect(page).toHaveScreenshot('prompt-card-form-filled.png', {
        fullPage: true
      })
      
      // Test validation error state
      await page.fill('[data-testid="title-input"]', '')
      await page.click('button[type="submit"]')
      
      await expect(page).toHaveScreenshot('prompt-card-form-validation-errors.png')
    })

    test('monitoring dashboard visual consistency', async ({ page }) => {
      await page.goto('/monitoring')
      
      // Wait for all monitoring widgets to load
      await page.waitForSelector('[data-testid="performance-metrics"]')
      await page.waitForSelector('[data-testid="error-tracking"]')
      await page.waitForTimeout(3000) // Allow time for real-time data to load
      
      await expect(page).toHaveScreenshot('monitoring-dashboard.png', {
        fullPage: true,
        animations: 'disabled'
      })
    })
  })

  test.describe('State Visual Tests', () => {
    test('loading states visual consistency', async ({ page }) => {
      // Mock slow API to capture loading states
      await page.route('**/api/analytics/dashboard', route => {
        setTimeout(() => {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                realtime: { activeTests: 5, testsPerSecond: 2.5, successRate: 0.85 },
                historical: { totalTests: 1000, totalExecutions: 150 },
                trends: { testsOverTime: [], successRateOverTime: [], performanceOverTime: [] },
                insights: []
              }
            })
          })
        }, 2000)
      })
      
      await page.goto('/analytics')
      
      // Capture loading state
      await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible()
      await expect(page).toHaveScreenshot('analytics-loading-state.png')
      
      // Wait for content to load and capture final state
      await page.waitForSelector('[data-testid="metrics-overview"]')
      await expect(page).toHaveScreenshot('analytics-loaded-state.png')
    })

    test('error states visual consistency', async ({ page }) => {
      // Mock API error
      await page.route('**/api/prompt-cards', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'Server error' })
        })
      })
      
      await page.goto('/prompt-cards')
      
      // Capture error state
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
      await expect(page).toHaveScreenshot('prompt-cards-error-state.png')
    })

    test('empty states visual consistency', async ({ page }) => {
      // Mock empty data response
      await page.route('**/api/prompt-cards*', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              prompt_cards: [],
              pagination: { page: 1, limit: 10, total: 0, pages: 0 }
            }
          })
        })
      })
      
      await page.goto('/prompt-cards')
      
      // Capture empty state
      await expect(page.locator('[data-testid="empty-state"]')).toBeVisible()
      await expect(page).toHaveScreenshot('prompt-cards-empty-state.png')
    })
  })

  test.describe('Interactive State Visual Tests', () => {
    test('hover and focus states visual consistency', async ({ page }) => {
      await page.goto('/prompt-cards')
      
      // Test button hover state
      const createButton = page.locator('[data-testid="create-button"]')
      await createButton.hover()
      await expect(createButton).toHaveScreenshot('button-hover-state.png')
      
      // Test input focus state
      await page.goto('/prompt-cards/new')
      const titleInput = page.locator('[data-testid="title-input"]')
      await titleInput.focus()
      await expect(titleInput).toHaveScreenshot('input-focus-state.png')
    })

    test('modal and overlay visual consistency', async ({ page }) => {
      await page.goto('/prompt-cards')
      
      // Open delete confirmation modal
      await page.click('[data-testid="delete-button"]')
      await expect(page.locator('[data-testid="delete-modal"]')).toBeVisible()
      await expect(page).toHaveScreenshot('delete-confirmation-modal.png')
      
      // Test modal backdrop
      await expect(page.locator('[data-testid="modal-backdrop"]')).toHaveScreenshot('modal-backdrop.png')
    })

    test('dropdown and menu visual consistency', async ({ page }) => {
      await page.goto('/prompt-cards')
      
      // Open action menu
      await page.click('[data-testid="action-menu-trigger"]')
      await expect(page.locator('[data-testid="action-menu"]')).toBeVisible()
      await expect(page).toHaveScreenshot('action-menu-dropdown.png')
      
      // Test menu item hover
      await page.hover('[data-testid="menu-item-edit"]')
      await expect(page.locator('[data-testid="action-menu"]')).toHaveScreenshot('action-menu-hover.png')
    })
  })

  test.describe('Animation Visual Tests', () => {
    test('transition animations visual consistency', async ({ page }) => {
      await page.goto('/prompt-cards')
      
      // Test page transition
      await page.click('text=Analytics')
      
      // Capture mid-transition (if any)
      await page.waitForTimeout(100)
      await expect(page).toHaveScreenshot('page-transition-mid.png')
      
      // Capture final state
      await page.waitForLoadState('networkidle')
      await expect(page).toHaveScreenshot('analytics-page-final.png')
    })

    test('loading animation visual consistency', async ({ page }) => {
      // Mock slow loading to capture animation
      await page.route('**/api/prompt-cards*', route => {
        setTimeout(() => {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: { prompt_cards: [], pagination: { page: 1, limit: 10, total: 0, pages: 0 } }
            })
          })
        }, 1000)
      })
      
      await page.goto('/prompt-cards')
      
      // Capture different phases of loading animation
      await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible()
      await expect(page.locator('[data-testid="loading-spinner"]')).toHaveScreenshot('loading-spinner-animation.png')
    })
  })

  test.describe('Cross-browser Visual Tests', () => {
    test('consistent rendering across browsers', async ({ page, browserName }) => {
      await page.goto('/prompt-cards')
      
      // Take browser-specific screenshots
      await expect(page).toHaveScreenshot(`prompt-cards-${browserName}.png`, {
        fullPage: true,
        threshold: 0.3 // Allow slight differences between browsers
      })
    })

    test('font rendering consistency', async ({ page }) => {
      await page.goto('/')
      
      // Test different text elements
      await expect(page.locator('h1')).toHaveScreenshot('heading-font-rendering.png')
      await expect(page.locator('p')).toHaveScreenshot('paragraph-font-rendering.png')
      await expect(page.locator('button')).toHaveScreenshot('button-font-rendering.png')
    })
  })

  test.describe('Accessibility Visual Tests', () => {
    test('high contrast mode visual consistency', async ({ page }) => {
      // Enable high contrast mode
      await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' })
      
      await page.goto('/prompt-cards')
      await expect(page).toHaveScreenshot('prompt-cards-high-contrast.png')
    })

    test('focus indicators visual consistency', async ({ page }) => {
      await page.goto('/prompt-cards/new')
      
      // Tab through focusable elements and capture focus states
      await page.keyboard.press('Tab')
      await expect(page.locator(':focus')).toHaveScreenshot('first-focus-indicator.png')
      
      await page.keyboard.press('Tab')
      await expect(page.locator(':focus')).toHaveScreenshot('second-focus-indicator.png')
    })

    test('reduced motion visual consistency', async ({ page }) => {
      // Enable reduced motion preference
      await page.emulateMedia({ reducedMotion: 'reduce' })
      
      await page.goto('/analytics')
      await page.waitForLoadState('networkidle')
      
      // Should show static version of animated elements
      await expect(page).toHaveScreenshot('analytics-reduced-motion.png', {
        animations: 'disabled'
      })
    })
  })

  test.describe('Print Styles Visual Tests', () => {
    test('print layout visual consistency', async ({ page }) => {
      await page.goto('/prompt-cards')
      
      // Emulate print media
      await page.emulateMedia({ media: 'print' })
      
      await expect(page).toHaveScreenshot('prompt-cards-print-layout.png', {
        fullPage: true
      })
    })

    test('print-specific elements visual consistency', async ({ page }) => {
      await page.goto('/analytics')
      await page.emulateMedia({ media: 'print' })
      
      // Charts and interactive elements should have print-friendly versions
      await expect(page).toHaveScreenshot('analytics-print-layout.png', {
        fullPage: true
      })
    })
  })
})