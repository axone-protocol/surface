import { test, expect } from '@playwright/test'

test('visits the app root url', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('text=AXONE / SURFACE')).toBeVisible()
  await expect(page.locator('h1')).toHaveText('GOVERN ACT')
  await page.getByRole('button', { name: 'Connect' }).click()
  await expect(page.getByRole('menuitem', { name: 'Keplr unavailable' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Leap unavailable' })).toBeVisible()
  const walletStatusGutters = await page
    .locator('.wallet-option-status')
    .evaluateAll((statuses) => statuses.map((status) => status.getBoundingClientRect().left))
  expect(walletStatusGutters[0]).toBe(walletStatusGutters[1])
  await expect(page.getByText('Install Keplr or Leap to connect an Axone identity.')).toBeVisible()
})
