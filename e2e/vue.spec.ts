import { test, expect } from '@playwright/test'

test('shows unavailable wallet providers without an extension', async ({ page }) => {
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
  await expect(page.getByText('Install Keplr or Leap to connect a wallet.')).toBeVisible()
})

test('connects Keplr without discovering identities', async ({ page }) => {
  await page.addInitScript(() => {
    let releaseEnable: (() => void) | undefined
    const enablePromise = new Promise<void>((resolve) => {
      releaseEnable = resolve
    })
    Object.assign(window, {
      __releaseKeplrEnable: () => releaseEnable?.(),
      keplr: {
        enable: () => enablePromise,
        getKey: async () => ({ bech32Address: 'axone1walletprivateaddress' }),
      },
    })
  })

  await page.goto('/')
  const connectTrigger = page.locator('.top-connect')
  await expect(connectTrigger).toHaveText('Connect▾')
  await connectTrigger.click()
  await page.getByRole('menuitem', { name: 'Keplr available' }).click()
  await expect(connectTrigger).toBeDisabled()
  await expect(connectTrigger).toHaveText('Waiting for wallet...')

  await page.evaluate(() => {
    const controlledWindow = window as typeof window & {
      __releaseKeplrEnable: () => void
    }
    controlledWindow.__releaseKeplrEnable()
  })

  await expect(connectTrigger).toHaveText('Connected▾')
  await connectTrigger.click()
  await expect(page.locator('.wallet-register-head')).toHaveText('WALLET')
  await expect(page.locator('.wallet-provider')).toHaveText('Keplr')
  await expect(page.locator('.wallet-address')).toHaveText('axone1wall...ddress')
  await expect(page.locator('.wallet-address-copy')).toHaveAttribute(
    'title',
    'axone1walletprivateaddress',
  )
  await page.getByRole('menuitem', { name: 'Disconnect' }).click()
  await expect(connectTrigger).toHaveText('Connect▾')
})
