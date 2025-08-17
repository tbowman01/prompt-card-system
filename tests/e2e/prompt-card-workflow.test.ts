/**
 * End-to-End Prompt Card Workflow Tests
 * @description Complete user workflow tests from frontend to backend
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { chromium, Browser, Page, BrowserContext } from 'playwright';

describe('E2E Prompt Card Workflow Tests', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({
      headless: process.env.CI === 'true',
      slowMo: process.env.CI === 'true' ? 0 : 100,
    });
  }, global.E2E_CONFIG.TEST_TIMEOUT);

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: true,
    });
    
    page = await context.newPage();
    
    // Setup console and error logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('Browser console error:', msg.text());
      }
    });
    
    page.on('pageerror', error => {
      console.error('Page error:', error);
    });
  });

  afterEach(async () => {
    await context.close();
  });

  describe('User Authentication Flow', () => {
    it('should complete login workflow', async () => {
      // Navigate to login page
      await page.goto(`${global.E2E_CONFIG.FRONTEND_URL}/login`);
      await page.waitForLoadState('networkidle');

      // Fill login form
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPass123!');
      
      // Submit form
      await page.click('[data-testid="login-button"]');
      
      // Wait for navigation
      await page.waitForURL('**/dashboard', { timeout: global.E2E_CONFIG.PAGE_LOAD_TIMEOUT });
      
      // Verify successful login
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
      await expect(page.locator('text=Welcome')).toBeVisible();
    });

    it('should handle login errors gracefully', async () => {
      await page.goto(`${global.E2E_CONFIG.FRONTEND_URL}/login`);
      
      // Try invalid credentials
      await page.fill('[data-testid="email-input"]', 'invalid@example.com');
      await page.fill('[data-testid="password-input"]', 'wrongpassword');
      await page.click('[data-testid="login-button"]');
      
      // Verify error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('text=Invalid credentials')).toBeVisible();
    });
  });

  describe('Prompt Card Creation Workflow', () => {
    beforeEach(async () => {
      // Login before each test
      await page.goto(`${global.E2E_CONFIG.FRONTEND_URL}/login`);
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPass123!');
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('**/dashboard');
    });

    it('should create a new prompt card successfully', async () => {
      // Navigate to create prompt card page
      await page.click('[data-testid="create-prompt-card-button"]');
      await page.waitForURL('**/prompt-cards/new');

      // Fill prompt card form
      await page.fill('[data-testid="title-input"]', 'E2E Test Card');
      await page.fill('[data-testid="description-input"]', 'This is a test card created by E2E tests');
      await page.fill('[data-testid="prompt-input"]', 'Generate a summary for: {{input}}');
      await page.selectOption('[data-testid="category-select"]', 'General');
      await page.fill('[data-testid="tags-input"]', 'e2e, test, automation');
      await page.fill('[data-testid="expected-output-input"]', 'A concise summary');

      // Add variable
      await page.click('[data-testid="add-variable-button"]');
      await page.fill('[data-testid="variable-name-input-0"]', 'input');
      await page.selectOption('[data-testid="variable-type-select-0"]', 'string');
      await page.check('[data-testid="variable-required-checkbox-0"]');

      // Save prompt card
      await page.click('[data-testid="save-button"]');
      
      // Wait for success message
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      await expect(page.locator('text=Prompt card created successfully')).toBeVisible();

      // Verify navigation to card detail page
      await page.waitForURL('**/prompt-cards/*');
      await expect(page.locator('[data-testid="card-title"]')).toHaveText('E2E Test Card');
    });

    it('should validate form inputs', async () => {
      await page.click('[data-testid="create-prompt-card-button"]');
      await page.waitForURL('**/prompt-cards/new');

      // Try to save without required fields
      await page.click('[data-testid="save-button"]');

      // Verify validation errors
      await expect(page.locator('[data-testid="title-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="prompt-error"]')).toBeVisible();

      // Fill title but leave prompt empty
      await page.fill('[data-testid="title-input"]', 'Test Card');
      await page.click('[data-testid="save-button"]');

      // Title error should disappear, prompt error should remain
      await expect(page.locator('[data-testid="title-error"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="prompt-error"]')).toBeVisible();
    });

    it('should auto-detect variables from prompt', async () => {
      await page.click('[data-testid="create-prompt-card-button"]');
      await page.waitForURL('**/prompt-cards/new');

      // Enter prompt with variables
      await page.fill('[data-testid="prompt-input"]', 'Translate {{text}} to {{language}}');
      
      // Click auto-detect button
      await page.click('[data-testid="auto-detect-variables-button"]');

      // Verify variables were detected
      await expect(page.locator('[data-testid="variable-name-input-0"]')).toHaveValue('text');
      await expect(page.locator('[data-testid="variable-name-input-1"]')).toHaveValue('language');
    });
  });

  describe('Prompt Card List and Search', () => {
    beforeEach(async () => {
      // Login and create test data
      await page.goto(`${global.E2E_CONFIG.FRONTEND_URL}/login`);
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPass123!');
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('**/dashboard');
      
      // Navigate to prompt cards list
      await page.click('[data-testid="prompt-cards-nav"]');
      await page.waitForURL('**/prompt-cards');
    });

    it('should display prompt cards list', async () => {
      // Verify list is displayed
      await expect(page.locator('[data-testid="prompt-cards-list"]')).toBeVisible();
      
      // Verify at least one card is displayed (assuming test data exists)
      const cardCount = await page.locator('[data-testid="prompt-card-item"]').count();
      expect(cardCount).toBeGreaterThan(0);
    });

    it('should search prompt cards', async () => {
      // Enter search term
      await page.fill('[data-testid="search-input"]', 'E2E Test');
      await page.press('[data-testid="search-input"]', 'Enter');

      // Wait for search results
      await page.waitForTimeout(1000);

      // Verify search results
      const searchResults = page.locator('[data-testid="prompt-card-item"]');
      const count = await searchResults.count();
      
      if (count > 0) {
        // If results exist, verify they match search term
        const firstResult = searchResults.first();
        await expect(firstResult.locator('[data-testid="card-title"]')).toContainText('E2E Test', { ignoreCase: true });
      }
    });

    it('should filter by category', async () => {
      // Select category filter
      await page.selectOption('[data-testid="category-filter"]', 'General');
      
      // Wait for filtering
      await page.waitForTimeout(1000);

      // Verify filtered results
      const filteredCards = page.locator('[data-testid="prompt-card-item"]');
      const count = await filteredCards.count();
      
      if (count > 0) {
        // Verify all visible cards are from selected category
        for (let i = 0; i < count; i++) {
          const card = filteredCards.nth(i);
          await expect(card.locator('[data-testid="card-category"]')).toHaveText('General');
        }
      }
    });

    it('should paginate results', async () => {
      // Check if pagination exists
      const paginationExists = await page.locator('[data-testid="pagination"]').isVisible();
      
      if (paginationExists) {
        const currentPage = await page.locator('[data-testid="current-page"]').textContent();
        expect(currentPage).toBe('1');

        // Check if next page button exists and is enabled
        const nextButton = page.locator('[data-testid="next-page-button"]');
        const isNextEnabled = await nextButton.isEnabled();
        
        if (isNextEnabled) {
          await nextButton.click();
          await page.waitForTimeout(1000);
          
          const newPage = await page.locator('[data-testid="current-page"]').textContent();
          expect(newPage).toBe('2');
        }
      }
    });
  });

  describe('Prompt Card Testing Workflow', () => {
    beforeEach(async () => {
      // Login and navigate to a prompt card
      await page.goto(`${global.E2E_CONFIG.FRONTEND_URL}/login`);
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPass123!');
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('**/dashboard');
      
      await page.click('[data-testid="prompt-cards-nav"]');
      await page.waitForURL('**/prompt-cards');
      
      // Click on first prompt card
      await page.click('[data-testid="prompt-card-item"]:first-child');
      await page.waitForURL('**/prompt-cards/*');
    });

    it('should test prompt card execution', async () => {
      // Click test button
      await page.click('[data-testid="test-prompt-button"]');
      
      // Wait for test panel to open
      await expect(page.locator('[data-testid="test-panel"]')).toBeVisible();

      // Fill variable inputs (assuming a card with 'input' variable exists)
      const inputField = page.locator('[data-testid="variable-input-input"]');
      if (await inputField.isVisible()) {
        await inputField.fill('This is a test input for the prompt card execution.');
      }

      // Select model
      await page.selectOption('[data-testid="model-select"]', 'llama2');

      // Execute test
      await page.click('[data-testid="execute-test-button"]');

      // Wait for results (with longer timeout for LLM generation)
      await expect(page.locator('[data-testid="test-results"]')).toBeVisible({ timeout: 30000 });
      
      // Verify results contain expected elements
      await expect(page.locator('[data-testid="test-output"]')).not.toBeEmpty();
      await expect(page.locator('[data-testid="execution-time"]')).toBeVisible();
    });

    it('should handle test execution errors', async () => {
      await page.click('[data-testid="test-prompt-button"]');
      await expect(page.locator('[data-testid="test-panel"]')).toBeVisible();

      // Try to execute without filling required variables
      await page.click('[data-testid="execute-test-button"]');

      // Verify error handling
      await expect(page.locator('[data-testid="test-error"]')).toBeVisible();
      await expect(page.locator('text=Please fill all required variables')).toBeVisible();
    });
  });

  describe('Prompt Card Management', () => {
    beforeEach(async () => {
      // Login
      await page.goto(`${global.E2E_CONFIG.FRONTEND_URL}/login`);
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPass123!');
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('**/dashboard');
    });

    it('should edit existing prompt card', async () => {
      // Navigate to prompt cards and select one
      await page.click('[data-testid="prompt-cards-nav"]');
      await page.waitForURL('**/prompt-cards');
      await page.click('[data-testid="prompt-card-item"]:first-child');
      await page.waitForURL('**/prompt-cards/*');

      // Click edit button
      await page.click('[data-testid="edit-prompt-button"]');
      await page.waitForURL('**/prompt-cards/*/edit');

      // Modify title
      const titleInput = page.locator('[data-testid="title-input"]');
      await titleInput.clear();
      await titleInput.fill('Updated E2E Test Card');

      // Save changes
      await page.click('[data-testid="save-button"]');

      // Verify success
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="card-title"]')).toHaveText('Updated E2E Test Card');
    });

    it('should delete prompt card', async () => {
      // Navigate to prompt cards and select one
      await page.click('[data-testid="prompt-cards-nav"]');
      await page.waitForURL('**/prompt-cards');
      
      const initialCount = await page.locator('[data-testid="prompt-card-item"]').count();
      
      await page.click('[data-testid="prompt-card-item"]:first-child');
      await page.waitForURL('**/prompt-cards/*');

      // Click delete button
      await page.click('[data-testid="delete-prompt-button"]');

      // Confirm deletion in modal
      await expect(page.locator('[data-testid="delete-confirmation-modal"]')).toBeVisible();
      await page.click('[data-testid="confirm-delete-button"]');

      // Verify navigation back to list
      await page.waitForURL('**/prompt-cards');

      // Verify card was deleted
      const newCount = await page.locator('[data-testid="prompt-card-item"]').count();
      expect(newCount).toBe(initialCount - 1);
    });
  });

  describe('Dashboard Analytics', () => {
    beforeEach(async () => {
      await page.goto(`${global.E2E_CONFIG.FRONTEND_URL}/login`);
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPass123!');
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('**/dashboard');
    });

    it('should display dashboard metrics', async () => {
      // Verify key metrics are displayed
      await expect(page.locator('[data-testid="total-cards-metric"]')).toBeVisible();
      await expect(page.locator('[data-testid="active-cards-metric"]')).toBeVisible();
      await expect(page.locator('[data-testid="recent-activity"]')).toBeVisible();

      // Verify charts are rendered
      await expect(page.locator('[data-testid="usage-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="category-chart"]')).toBeVisible();
    });

    it('should update metrics in real-time', async () => {
      // Get initial count
      const initialCount = await page.locator('[data-testid="total-cards-metric"]').textContent();
      const initialNum = parseInt(initialCount?.replace(/\D/g, '') || '0');

      // Create a new prompt card
      await page.click('[data-testid="create-prompt-card-button"]');
      await page.waitForURL('**/prompt-cards/new');
      await page.fill('[data-testid="title-input"]', 'Real-time Test Card');
      await page.fill('[data-testid="prompt-input"]', 'Test prompt');
      await page.click('[data-testid="save-button"]');

      // Navigate back to dashboard
      await page.click('[data-testid="dashboard-nav"]');
      await page.waitForURL('**/dashboard');

      // Verify count updated
      await page.waitForTimeout(2000); // Allow time for metric update
      const updatedCount = await page.locator('[data-testid="total-cards-metric"]').textContent();
      const updatedNum = parseInt(updatedCount?.replace(/\D/g, '') || '0');

      expect(updatedNum).toBe(initialNum + 1);
    });
  });

  describe('Accessibility', () => {
    beforeEach(async () => {
      await page.goto(`${global.E2E_CONFIG.FRONTEND_URL}/login`);
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPass123!');
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('**/dashboard');
    });

    it('should support keyboard navigation', async () => {
      // Test tab navigation
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toBeVisible();

      // Test Enter key activation
      await page.keyboard.press('Enter');
      // Verify the focused element was activated (depends on implementation)
    });

    it('should have proper ARIA labels', async () => {
      // Check for ARIA labels on interactive elements
      const navButtons = page.locator('[role="button"], [role="link"]');
      const count = await navButtons.count();

      for (let i = 0; i < count; i++) {
        const element = navButtons.nth(i);
        const ariaLabel = await element.getAttribute('aria-label');
        const text = await element.textContent();
        
        // Element should have either aria-label or visible text
        expect(ariaLabel || text).toBeTruthy();
      }
    });

    it('should provide screen reader announcements', async () => {
      // Create a prompt card to trigger success announcement
      await page.click('[data-testid="create-prompt-card-button"]');
      await page.waitForURL('**/prompt-cards/new');
      await page.fill('[data-testid="title-input"]', 'Accessibility Test');
      await page.fill('[data-testid="prompt-input"]', 'Test prompt');
      await page.click('[data-testid="save-button"]');

      // Verify aria-live region announces success
      await expect(page.locator('[aria-live="polite"]')).toBeVisible();
      await expect(page.locator('[aria-live="polite"]')).toContainText('success');
    });
  });

  describe('Responsive Design', () => {
    it('should work on mobile devices', async () => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto(`${global.E2E_CONFIG.FRONTEND_URL}/login`);
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPass123!');
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('**/dashboard');

      // Verify mobile navigation
      await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
      
      // Open mobile menu
      await page.click('[data-testid="mobile-menu-button"]');
      await expect(page.locator('[data-testid="mobile-nav-menu"]')).toBeVisible();

      // Navigate to prompt cards
      await page.click('[data-testid="mobile-prompt-cards-nav"]');
      await page.waitForURL('**/prompt-cards');

      // Verify list is still functional on mobile
      await expect(page.locator('[data-testid="prompt-cards-list"]')).toBeVisible();
    });

    it('should work on tablet devices', async () => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });

      await page.goto(`${global.E2E_CONFIG.FRONTEND_URL}/dashboard`);
      
      // Verify responsive layout
      await expect(page.locator('[data-testid="dashboard-content"]')).toBeVisible();
      
      // Check that all major components are visible and functional
      const components = [
        '[data-testid="metrics-section"]',
        '[data-testid="charts-section"]',
        '[data-testid="recent-activity"]',
      ];

      for (const component of components) {
        await expect(page.locator(component)).toBeVisible();
      }
    });
  });
});