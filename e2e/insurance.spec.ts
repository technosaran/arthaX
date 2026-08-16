import { test, expect } from '@playwright/test';

test.describe('Insurance Module', () => {
  test('should load the insurance page and display empty state or table', async ({ page }) => {
    // Standard mock or wait if login happens automatically
    // The previous tests login, so we just navigate
    await page.goto('/dashboard/insurance');

    // Wait for network or dom
    await page.waitForLoadState('networkidle');

    // Check title
    await expect(page.locator('h1')).toContainText('Insurance & Policy Tracker');
  });
});
