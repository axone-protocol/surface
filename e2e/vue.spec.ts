import { test, expect } from '@playwright/test'

test('shows unavailable wallet providers without an extension', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.surface-camera')).toHaveAttribute('data-active-facet', 'current')
  await expect(page.locator('h1')).toHaveText('GOVERNACT')
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
  await expect(page.locator('.surface-dropdown-heading')).toHaveText('WALLET')
  await expect(page.locator('.wallet-provider')).toHaveText('Keplr')
  const walletTrigger = page.getByRole('button', {
    name: 'Inspect Wallet address: axone1walletprivateaddress',
  })
  await expect(walletTrigger).toHaveText('axone1wall…ddress')
  await page.getByRole('menuitem', { name: 'Disconnect' }).click()
  await expect(connectTrigger).toHaveText('Connect▾')
})

test('pans only from empty space and preserves native text selection', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Desktop camera contract')
  await page.goto('/')

  const camera = page.locator('.surface-camera')
  const establishedFacet = page.locator('[data-facet="established"]')
  await expect(camera).toHaveAttribute('data-active-facet', 'current')
  await expect(establishedFacet).toHaveCSS('overflow-y', 'auto')
  await expect(camera).toHaveCSS('height', `${await page.evaluate(() => window.innerHeight)}px`)

  const navigator = page.locator('.surface-navigator')
  await expect(navigator).toHaveCSS('position', 'fixed')
  await expect(navigator).toContainText('ESTABLISHED')
  await expect(navigator).toContainText('INITIATED')
  const thumb = navigator.locator('.surface-navigator-thumb')
  await expect(thumb).toHaveClass(/is-centered/)
  const navigatorBox = await navigator.boundingBox()
  if (!navigatorBox) {
    throw new Error('Surface navigator is not visible')
  }
  const viewport = page.viewportSize()
  expect(
    Math.abs(navigatorBox.x + navigatorBox.width / 2 - (viewport?.width ?? 0) / 2),
  ).toBeLessThan(1)
  const thumbBeforePan = await thumb.boundingBox()
  if (!thumbBeforePan) {
    throw new Error('Surface navigator thumb is not visible')
  }
  const box = await camera.boundingBox()
  if (!box) {
    throw new Error('Surface camera is not visible')
  }

  const title = page.locator('h1')
  const titleBox = await title.boundingBox()
  if (!titleBox) {
    throw new Error('Surface title is not visible')
  }
  await page.mouse.move(titleBox.x + 8, titleBox.y + titleBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(titleBox.x + titleBox.width * 0.8, titleBox.y + titleBox.height / 2, {
    steps: 8,
  })
  await page.mouse.up()
  await expect(camera).toHaveAttribute('data-active-facet', 'current')
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString() ?? ''))
    .toMatch(/\S/)
  await page.evaluate(() => window.getSelection()?.removeAllRanges())

  const x = box.x + box.width / 2
  const y = box.y + box.height - 120
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x - 160, y, { steps: 8 })
  await expect
    .poll(async () => (await thumb.boundingBox())?.x ?? -Infinity)
    .toBeGreaterThan(thumbBeforePan.x)
  await page.mouse.up()
  await expect(camera).toHaveAttribute('data-active-facet', 'initiated')
  await expect(thumb).not.toHaveClass(/is-centered/)

  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 160, y, { steps: 8 })
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString() ?? '')).toBe('')
  await page.mouse.up()
  await expect(camera).toHaveAttribute('data-active-facet', 'current')

  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 160, y, { steps: 8 })
  await page.mouse.up()
  await expect(camera).toHaveAttribute('data-active-facet', 'established')
  await establishedFacet.evaluate((facet) => {
    const spacer = document.createElement('div')
    spacer.style.height = '1500px'
    facet.querySelector('.surface-facet-inner')?.append(spacer)
    facet.scrollTo({ top: 600 })
  })
  await expect.poll(() => establishedFacet.evaluate((facet) => facet.scrollTop)).toBeGreaterThan(0)

  await camera.focus()
  await camera.press('ArrowRight')
  await expect(camera).toHaveAttribute('data-active-facet', 'current')
  await camera.press('ArrowLeft')
  await expect(camera).toHaveAttribute('data-active-facet', 'established')
  await expect.poll(() => establishedFacet.evaluate((facet) => facet.scrollTop)).toBe(0)

  await page.mouse.move(x, y)
  await page.mouse.wheel(800, 0)
  await page.waitForTimeout(140)
  await expect(camera).toHaveAttribute('data-active-facet', 'current')
})

test('moves the mobile camera with one touch without horizontal overflow', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'Mobile Chrome', 'Mobile camera contract')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  const camera = page.locator('.surface-camera')
  await expect(camera).toHaveAttribute('data-active-facet', 'current')
  const box = await camera.boundingBox()
  if (!box) {
    throw new Error('Surface camera is not visible')
  }

  const title = page.locator('h1')

  const y = box.y + 160
  const startX = box.x + 280
  await title.evaluate(
    (element, coordinates) => {
      const dispatchTouch = (type: 'touchstart' | 'touchmove' | 'touchend', clientX: number) => {
        const touch = new Touch({
          identifier: 1,
          target: element,
          clientX,
          clientY: coordinates.y,
        })
        element.dispatchEvent(
          new TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            changedTouches: [touch],
            touches: type === 'touchend' ? [] : [touch],
          }),
        )
      }

      dispatchTouch('touchstart', coordinates.startX)
      dispatchTouch('touchmove', coordinates.startX - 150)
      dispatchTouch('touchend', coordinates.startX - 150)
    },
    { startX, y },
  )
  await expect(camera).toHaveAttribute('data-active-facet', 'initiated')
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth === window.innerWidth))
    .toBe(true)
})
