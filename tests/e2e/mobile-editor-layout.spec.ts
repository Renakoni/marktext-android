import { expect, test, type Page } from '@playwright/test'
import { openLocalDraft } from './helpers/drafts'

test.describe.configure({ timeout: 60000 })

// The responsive width contract: Muya's .mu-container owns the horizontal
// gutter through var(--editor-gutter) and the host shell adds no horizontal
// padding of its own, so host and editor spacing can never stack. Phones
// (≤720px) use 16px gutters; wider screens keep the historical 50px gutter
// with the centered 800px column.

const MARKDOWN = `# Layout Probe

A paragraph that is long enough to wrap across several lines on a phone so the effective measure is visible.
`

async function openProbe(page: Page, settings: Record<string, string> = {}) {
  await openLocalDraft(page, {
    id: 'layout-probe-draft',
    markdown: MARKDOWN,
    title: /Layout Probe/,
    settings,
  })
}

interface LayoutMetrics {
  viewportWidth: number
  shellWidth: number
  editorPaddingLeft: number
  editorPaddingRight: number
  containerWidth: number
  containerPaddingLeft: number
  containerPaddingRight: number
  containerOffsetLeft: number
  paragraphContentWidth: number
}

function readLayoutMetrics(page: Page): Promise<LayoutMetrics> {
  return page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>('.editor-host-shell')!
    const editor = shell.querySelector<HTMLElement>('.mu-editor')!
    const container = shell.querySelector<HTMLElement>('.mu-container')!
    const paragraph = container.querySelector<HTMLElement>('p.mu-paragraph')!
    const editorStyle = getComputedStyle(editor)
    const containerStyle = getComputedStyle(container)

    return {
      viewportWidth: window.innerWidth,
      shellWidth: shell.getBoundingClientRect().width,
      editorPaddingLeft: Number.parseFloat(editorStyle.paddingLeft),
      editorPaddingRight: Number.parseFloat(editorStyle.paddingRight),
      containerWidth: container.getBoundingClientRect().width,
      containerPaddingLeft: Number.parseFloat(containerStyle.paddingLeft),
      containerPaddingRight: Number.parseFloat(containerStyle.paddingRight),
      containerOffsetLeft: container.getBoundingClientRect().left,
      paragraphContentWidth: paragraph.getBoundingClientRect().width,
    }
  })
}

test('portrait phones use 16px gutters with no stacked host padding', async ({ page }) => {
  await openProbe(page)

  const metrics = await readLayoutMetrics(page)
  expect(metrics.viewportWidth).toBe(393)
  // The host contributes no horizontal padding of its own...
  expect(metrics.editorPaddingLeft).toBe(0)
  expect(metrics.editorPaddingRight).toBe(0)
  // ...the container owns exactly one 16px gutter per side...
  expect(metrics.containerPaddingLeft).toBe(16)
  expect(metrics.containerPaddingRight).toBe(16)
  // ...so the text measure is the full viewport minus the two gutters.
  expect(metrics.paragraphContentWidth).toBeCloseTo(393 - 32, 0)
})

test('narrow phones keep the same single-gutter rule', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await openProbe(page)

  const metrics = await readLayoutMetrics(page)
  expect(metrics.containerPaddingLeft).toBe(16)
  expect(metrics.paragraphContentWidth).toBeCloseTo(320 - 32, 0)
})

test('landscape and wide screens keep the centered column with 50px gutters', async ({ page }) => {
  await page.setViewportSize({ width: 851, height: 393 })
  await openProbe(page)

  const metrics = await readLayoutMetrics(page)
  // Above the phone breakpoint the classic layout applies: the column caps
  // at 800px, centers inside the shell, and keeps the historical gutter.
  expect(metrics.containerPaddingLeft).toBe(50)
  expect(metrics.containerWidth).toBe(800)
  expect(metrics.paragraphContentWidth).toBeCloseTo(800 - 100, 0)
  expect(metrics.containerOffsetLeft).toBeGreaterThan(0)
  // Still no stacked host padding.
  expect(metrics.editorPaddingLeft).toBe(0)
})

test('the text measure is continuous across the old 720px breakpoint', async ({ page }) => {
  // A hard gutter breakpoint used to shrink the measure by ~104px when the
  // viewport grew from 720px to 721px (split screen, foldables, resizable
  // windows). The fluid gutter keeps the measure monotonic: it rises to the
  // classic 700px cap and never steps down.
  const measureAt = async (width: number) => {
    await page.setViewportSize({ width, height: 700 })
    return (await readLayoutMetrics(page)).paragraphContentWidth
  }

  await openProbe(page)

  const at719 = await measureAt(719)
  const at721 = await measureAt(721)
  const at780 = await measureAt(780)
  const at815 = await measureAt(815)
  const at900 = await measureAt(900)

  // No cliff at the old breakpoint (the hairline frame border may cost ~1px).
  expect(Math.abs(at721 - at719)).toBeLessThan(5)
  // Monotonic growth up to the classic 700px cap, then stable while the
  // frame padding fades in.
  expect(at780).toBeGreaterThanOrEqual(at721 - 1)
  expect(at780).toBeGreaterThan(690)
  expect(at815).toBeGreaterThan(694)
  expect(at815).toBeLessThan(706)
  expect(at900).toBeGreaterThan(694)
  expect(at900).toBeLessThan(706)
})

test('a long inline formula scrolls inside itself instead of widening the editor', async ({
  page,
}) => {
  const longMath = Array.from({ length: 30 }, (_, i) => `a_{${i}} x^{${i}}`).join(' + ')
  await openLocalDraft(page, {
    id: 'layout-math-draft',
    markdown: `# Math Probe\n\nInline formula $${longMath}$ inside a paragraph.\n`,
    title: /Math Probe/,
  })

  await expect.poll(() => page.locator('.katex').count()).toBeGreaterThan(0)

  const metrics = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>('.editor-host-shell')!
    const paragraph = [...document.querySelectorAll<HTMLElement>('.mu-container > p')].find(p =>
      p.textContent?.includes('Inline formula'),
    )!
    const render = paragraph.querySelector<HTMLElement>('.mu-math-render')!
    return {
      paragraphWidth: paragraph.getBoundingClientRect().width,
      renderWidth: render.getBoundingClientRect().width,
      renderScrollWidth: render.scrollWidth,
      shellClientWidth: shell.clientWidth,
      shellScrollWidth: shell.scrollWidth,
    }
  })

  // The formula is genuinely wider than the column, scrolls inside its own
  // box, and never makes the editor shell horizontally scrollable.
  expect(metrics.renderScrollWidth).toBeGreaterThan(metrics.paragraphWidth)
  expect(metrics.renderWidth).toBeLessThanOrEqual(metrics.paragraphWidth + 1)
  expect(metrics.shellScrollWidth).toBe(metrics.shellClientWidth)
})

test('the editor line width setting caps the measure on top of the gutters', async ({ page }) => {
  await openProbe(page, { editorLineWidth: '30ch' })

  const metrics = await readLayoutMetrics(page)
  // calc(2 * 16px + 30ch) resolves below the phone viewport, so the column
  // is narrower than full width and the measure honors the setting.
  expect(metrics.containerWidth).toBeLessThan(393 - 32)
  expect(metrics.paragraphContentWidth).toBeCloseTo(metrics.containerWidth - 32, 0)
  // The capped column still centers.
  expect(metrics.containerOffsetLeft).toBeCloseTo((393 - metrics.containerWidth) / 2, 0)
})
