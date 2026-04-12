import { test, expect } from '@playwright/test'

test('login page loads and navigate to register', async ({ page }) => {
  await page.goto('/')
  // Target the heading specifically to avoid matching the Login button
  await expect(page.getByRole('heading', { name: 'LOGIN' })).toBeVisible()
  // Click the Sign up link/button and verify register page
  await page.click('text=Sign up')
  await expect(page.getByRole('heading', { name: 'REGISTER' })).toBeVisible()
})
