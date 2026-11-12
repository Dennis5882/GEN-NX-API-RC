import { expect, test } from '@playwright/test'

const languages = [
  { code: 'ko', html: 'ko', font: 'KR' },
  { code: 'en', html: 'en', font: 'KR' },
  { code: 'zh-TW', html: 'zh-Hant', font: 'TC' },
  { code: 'zh-CN', html: 'zh-Hans', font: 'SC' },
]

test.beforeEach(async ({ page }) => {
  // Real Gen NX and provider requests are never needed for these visual checks.
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    return url.hostname === '127.0.0.1' ||
      ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)
      ? route.continue()
      : route.abort()
  })
})

for (const theme of ['navy', 'cyber', 'light']) {
  for (const language of languages) {
    for (const width of [1440, 390]) {
      test(`${theme} / ${language.code} / ${width}px`, async ({
        page,
      }, info) => {
        await page.setViewportSize({
          width,
          height: width === 390 ? 844 : 1000,
        })
        await page.addInitScript(
          value => localStorage.setItem('nx_theme', value),
          theme,
        )
        const errors: string[] = []
        page.on('pageerror', error => errors.push(error.message))
        await page.goto(`/${language.code}/`)
        await expect(page.getByLabel('Language')).toHaveValue(language.code)
        await expect(page.locator('html')).toHaveAttribute(
          'lang',
          language.html,
        )
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
        await page.evaluate(() => document.fonts.ready)
        const layout = await page.evaluate(() => {
          const rect = (selector: string) => {
            const r = document.querySelector(selector)!.getBoundingClientRect()
            return {
              x: r.x,
              y: r.y,
              right: r.right,
              bottom: r.bottom,
              width: r.width,
              height: r.height,
            }
          }
          return {
            chat: rect('main > .chat'),
            right: rect('main > .right'),
            overflow: document.documentElement.scrollWidth > innerWidth,
            font: getComputedStyle(document.body).getPropertyValue('--cjk'),
            background: getComputedStyle(document.body).backgroundColor,
          }
        })
        expect(layout.font).toContain(language.font)
        expect(layout.background).toBe(
          theme === 'light'
            ? 'rgb(255, 255, 255)'
            : theme === 'navy'
              ? 'rgb(8, 9, 11)'
              : 'rgb(0, 0, 0)',
        )
        expect(layout.overflow).toBe(false)
        expect(layout.chat.height).toBeGreaterThan(100)
        expect(layout.right.height).toBeGreaterThan(100)
        if (width === 390)
          expect(layout.right.y).toBeGreaterThanOrEqual(layout.chat.bottom)
        else expect(layout.right.x).toBeGreaterThanOrEqual(layout.chat.right)
        await page.screenshot({
          path: info.outputPath('screen.png'),
          fullPage: true,
          animations: 'disabled',
        })
        await page.locator('#gearBtn').click()
        await expect(page.locator('#drawerMapi')).toBeVisible()
        await expect(page.locator('#mapiKey')).toHaveAttribute(
          'type',
          'password',
        )
        const drawer = await page.locator('#drawerMapi').boundingBox()
        expect(drawer!.width).toBeLessThanOrEqual(width)
        await page.keyboard.press('Escape')
        await expect(page.locator('#drawerMapi')).toBeHidden()
        await expect(page.locator('#gearBtn')).toBeFocused()
        expect(errors).toEqual([])
      })
    }
  }
}

test('split drag persists, clamps and resets the desktop column width', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/en/')
  const splitter = page.locator('.splitter')
  const box = await splitter.boundingBox()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + 30)
  await page.mouse.down()
  await page.mouse.move(1000, box!.y + 30, { steps: 8 })
  await page.mouse.up()
  const saved = await page.evaluate(() =>
    Number(localStorage.getItem('nx_split')),
  )
  expect(saved).toBeGreaterThan(65)
  expect(saved).toBeLessThan(75)
  await page.reload()
  await expect(page.locator('main')).toHaveCSS('--split', `${saved}%`)
  const current = await splitter.boundingBox()
  await page.mouse.move(current!.x + current!.width / 2, current!.y + 30)
  await page.mouse.down()
  await page.mouse.move(1430, current!.y + 30, { steps: 8 })
  await page.mouse.up()
  await expect(page.locator('main')).toHaveCSS('--split', '75%')
  await splitter.dblclick()
  await expect(page.locator('main')).toHaveCSS('--split', '49%')
  expect(await page.evaluate(() => localStorage.getItem('nx_split'))).toBe('49')
})

for (const width of [1440, 390]) {
  test(`edits a local plan and opens release notes at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
    await page.goto('/en/')
    const composer = page.locator('.composer textarea')
    await composer.fill('build a custom frame 3 stories')
    await composer.press('Enter')
    await expect(page.locator('.plan-editor')).toBeVisible()
    const count = page.locator('.plan-editor input').first()
    await count.fill('1')
    await expect(count).toHaveValue('1')
    await expect(page.locator('#viewP')).toBeVisible()
    await expect(page.locator('#viewP')).toHaveCSS('display', 'flex')
    await expect(page.locator('#plot .plot-container')).toBeVisible({
      timeout: 15000,
    })
    await page.screenshot({
      path: info.outputPath('editor.png'),
      fullPage: true,
      animations: 'disabled',
    })
    const version = page.locator('footer button').first()
    await version.click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(version).toBeFocused()
    const light = page.locator('footer button[aria-pressed]').nth(1)
    await light.click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await page.getByLabel('Language').selectOption('zh-TW')
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hant')
    await page.reload()
    await expect(page.getByLabel('Language')).toHaveValue('zh-TW')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  })
}
