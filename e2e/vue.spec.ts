import { test, expect } from '@playwright/test'

test('visits the app root url', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('text=AXONE / SURFACE')).toBeVisible()
  await expect(page.locator('h1')).toHaveText('GOVERN ACT')
  await page.getByRole('button', { name: 'Connect identity' }).click()
  await expect(page.getByRole('menuitem', { name: 'Keplr unavailable' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Leap unavailable' })).toBeVisible()
  await expect(page.getByText('Install Keplr or Leap to connect an Axone identity.')).toBeVisible()
})
