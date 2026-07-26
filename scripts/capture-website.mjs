import { writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 800 } })
  page.setDefaultTimeout(120_000)

  await page.goto('https://surface.axone.xyz/', {
    waitUntil: 'domcontentloaded',
    timeout: 120_000,
  })
  await page.waitForTimeout(15_000)
  const session = await page.context().newCDPSession(page)
  const { data } = await session.send('Page.captureScreenshot', {
    format: 'webp',
    quality: 70,
    captureBeyondViewport: true,
  })
  await writeFile('surface.webp', Buffer.from(data, 'base64'))
} finally {
  await browser.close()
}
