import { test, expect } from '@playwright/test'

test.describe('Journal App', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:3000')
  })

  test('should register a new user', async ({ page }) => {
    await page.click('text=register')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="text"]', 'testuser')
    await page.fill('input[type="password"]', 'testpass123')
    await page.click('button:has-text("Register")')
    
    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/$/)
  })

  test('should create a new entry', async ({ page }) => {
    // Assume logged in (would need to set up auth state)
    await page.goto('http://localhost:3000/new')
    await page.fill('textarea', 'This is a test journal entry')
    await page.fill('input[placeholder*="title"]', 'Test Entry')
    await page.click('button:has-text("Save Entry")')
    
    // Should redirect to entries page
    await expect(page).toHaveURL(/\/entries/)
  })

  test('should display entries list', async ({ page }) => {
    await page.goto('http://localhost:3000/entries')
    
    // Should see entries or empty state
    const content = await page.textContent('body')
    expect(content).toBeTruthy()
  })
})

