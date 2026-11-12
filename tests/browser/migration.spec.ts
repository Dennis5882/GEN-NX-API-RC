import { expect, test } from '@playwright/test'

const languages = [
  { code: 'ko', html: 'ko', font: 'Noto Sans KR', sample: '한글' },
  { code: 'en', html: 'en', font: 'Noto Sans KR', sample: '한글' },
  { code: 'zh-TW', html: 'zh-Hant', font: 'Noto Sans TC', sample: '繁體中文' },
  { code: 'zh-CN', html: 'zh-Hans', font: 'Noto Sans SC', sample: '简体中文' },
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
        expect(
          layout.font
            .split(',')[0]
            .trim()
            .replaceAll('"', '')
            .replaceAll("'", ''),
        ).toBe(language.font)
        const loaded = await page.evaluate(async ({ font, sample }) => {
          const faces = await document.fonts.load(`400 14px "${font}"`, sample)
          return faces.map(face => ({
            family: face.family.replaceAll('"', '').replaceAll("'", ''),
            status: face.status,
          }))
        }, language)
        expect(loaded.length).toBeGreaterThan(0)
        expect(
          loaded.every(
            face => face.family === language.font && face.status === 'loaded',
          ),
        ).toBe(true)
        await expect(page.locator('.send')).toHaveCSS('text-align', 'center')
        const glyph = await page.locator('.send').evaluate(button => {
          const range = document.createRange()
          range.selectNodeContents(button)
          const text = range.getBoundingClientRect(),
            box = button.getBoundingClientRect()
          return Math.abs(
            (text.left + text.right) / 2 - (box.left + box.right) / 2,
          )
        })
        expect(glyph).toBeLessThan(1)
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
    await page.getByRole('button', { name: /Walls & core/ }).click()
    await page.getByRole('switch', { name: /Shear-wall core/ }).check()
    await expect(page.getByRole('grid')).toBeVisible()
    const nativeControls = await page
      .locator('.plan-editor')
      .evaluate(editor => {
        const arrows = [...editor.querySelectorAll('button')].filter(button =>
          ['▲', '◀', '▶', '▼'].includes(button.textContent || ''),
        )
        const reference = document.createElement('button')
        reference.textContent = '▲'
        reference.style.cssText = 'padding: 2px 8px; min-width: 28px'
        editor.append(reference)
        const properties = [
          'backgroundColor',
          'borderTopWidth',
          'borderTopStyle',
          'fontFamily',
          'fontSize',
          'lineHeight',
          'textAlign',
        ] as const
        const read = (button: HTMLButtonElement) => {
          const style = getComputedStyle(button)
          return Object.fromEntries(
            properties.map(property => [property, style[property]]),
          )
        }
        const result = { reference: read(reference), arrows: arrows.map(read) }
        reference.remove()
        return result
      })
    expect(nativeControls.arrows).toHaveLength(4)
    for (const arrow of nativeControls.arrows)
      expect(arrow).toEqual(nativeControls.reference)
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
    const fonts = await page.evaluate(() => {
      const footer = document.querySelector('footer'),
        notes = document.querySelector('.rn-text'),
        dialog = document.querySelector('[role="dialog"]')
      if (!footer || !notes || !dialog)
        throw new Error('Release notes or footer is missing')
      return {
        footer: getComputedStyle(footer).fontFamily,
        notes: getComputedStyle(notes).fontFamily,
        dialogSize: getComputedStyle(dialog).fontSize,
        footerSize: getComputedStyle(footer).fontSize,
      }
    })
    expect(fonts.notes).toBe(fonts.footer)
    expect(fonts.dialogSize).toBe(fonts.footerSize)
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

test('required-item status guards the execute button', async ({ page }) => {
  await page.goto('/en/')
  const composer = page.locator('.composer textarea')
  await composer.fill('build a custom frame 3 stories')
  await composer.press('Enter')
  await expect(page.locator('.plan-editor')).toBeVisible()
  const status = page.locator('[data-slot=editor-section]').first().getByRole('status')
  await expect(status).toHaveAttribute('data-required', 'ok')
  const count = page.locator('.plan-editor input').first()
  await count.fill('')
  await expect(status).toHaveAttribute('data-required', 'missing')
  await expect(page.locator('.confirm-row .btn-c')).toBeDisabled()
  await count.fill('1')
  await expect(status).toHaveAttribute('data-required', 'ok')
  await expect(page.locator('.confirm-row .btn-c')).toBeEnabled()
})

test('stage bar shows three stages, starts not-run and switches panels', async ({ page }) => {
  await page.goto('/en/')
  const bar = page.getByRole('navigation', { name: 'Workflow stages' })
  await expect(bar).toBeVisible()
  for (const key of ['pre', 'solve', 'post']) {
    await expect(bar.locator(`[data-stage=${key}]`)).toHaveAttribute('data-status', 'none')
  }
  await bar.locator('[data-stage=post]').click()
  await expect(page.locator('#resP')).toHaveClass(/\bon\b/)
  await bar.locator('[data-stage=pre]').click()
  await expect(page.locator('#modelP')).toHaveClass(/\bon\b/)
})

test('stage bar fits the 390px layout without horizontal page scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/ko/')
  await expect(page.getByRole('navigation', { name: '작업 단계' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
})
