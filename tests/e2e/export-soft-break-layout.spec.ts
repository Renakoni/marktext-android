import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// Browser layout coverage for the marktext#3676 export soft-break rendering:
// authored soft breaks render as `<br>` at the inline text leaf
// (`exportSoftBreaks`), and NO stylesheet whitespace rules exist any more —
// the withdrawn pre-wrap approach re-interpreted every newline it inherited
// into (phantom rows from serializer output, collapsed raw HTML, broken
// inline-restyling themes). These pin the pixel outcome in real Chromium
// against the real export stylesheet; the emitted markup is pinned by
// third_party/muya/src/state/__tests__/softBreakExportHtml.spec.ts.

// Playwright runs from the repo root; the config's testDir keeps that cwd.
const exportCss = readFileSync('third_party/muya/src/assets/styles/exportStyle.css', 'utf8')

async function measure(page: Page, bodyHtml: string, selector: string, extraCss = '') {
  await page.setContent(
    `<!doctype html><style>${exportCss}</style><style>${extraCss}</style>` +
      `<article class="markdown-body">${bodyHtml}</article>`,
  )
  return page.evaluate(
    sel => document.querySelector(sel)!.getBoundingClientRect().height,
    selector,
  )
}

test('a soft break renders as a real second line (paragraph and tight item)', async ({ page }) => {
  const pSingle = await measure(page, '<p>line one</p>', 'p')
  const pSoft = await measure(page, '<p>line one<br>line two</p>', 'p')
  expect(pSoft).toBeGreaterThan(pSingle * 1.8)

  const liSingle = await measure(page, '<ul><li>line A</li></ul>', 'li')
  const liSoft = await measure(page, '<ul><li>line A<br>line B</li></ul>', 'li')
  expect(liSoft).toBeGreaterThan(liSingle * 1.8)
})

test("marked's canonical serializer newlines create no phantom rows", async ({ page }) => {
  // The exact canonical shape for `- line A\n  - child` — two text lines,
  // no stylesheet rule left to re-interpret the structural newlines.
  const canonical = '<ul>\n<li>line A<ul>\n<li>child</li>\n</ul>\n</li>\n</ul>'
  const single = await measure(page, '<ul><li>line A</li></ul>', 'li')
  const nested = await measure(page, canonical, 'li')

  expect(nested).toBeGreaterThan(single * 1.6)
  expect(nested).toBeLessThan(single * 2.6)
})

test('raw HTML keeps normal whitespace semantics everywhere', async ({ page }) => {
  // Measure the CONTAINER (review round 7: the first <strong> stays one
  // line tall even when the second wraps onto another row — only the
  // container height catches the regression).
  const cases: Array<[string, string]> = [
    ['<p>\n<strong>left</strong>\n<strong>right</strong>\n</p>', 'p'],
    ['<ul><li><div>\n<strong>left</strong>\n<strong>right</strong>\n</div></li></ul>', 'div'],
    ['<ul><li><section>\n<strong>left</strong>\n<strong>right</strong>\n</section></li></ul>', 'section'],
    ['<ul><li><menu>\n<strong>left</strong>\n<strong>right</strong>\n</menu></li></ul>', 'menu'],
  ]
  const reference = await measure(page, '<p><strong>left</strong> <strong>right</strong></p>', 'p')

  for (const [html, selector] of cases) {
    const height = await measure(page, html, selector)
    // Both strongs sit on ONE line: the container is single-line tall,
    // which only holds when the newlines collapse.
    expect(height, html).toBeLessThan(reference * 1.4)
  }
})

test('inline-restyling export themes keep their separating space', async ({ page }) => {
  // `- # left\n  right` exports with marked's canonical `</h1>\n` separator;
  // a theme that inlines headings must see "left right" on one line.
  const html = '<ul><li><h1>left</h1>\nright</li></ul>'
  const theme = '.markdown-body h1 { display: inline; margin: 0; padding: 0; font-size: 1em; }'
  const reference = await measure(page, '<ul><li>left right</li></ul>', 'li', theme)
  const height = await measure(page, html, 'li', theme)

  expect(height).toBe(reference)

  // The document currently shows the themed markup: the canonical newline
  // is still in the DOM (a theme could restyle it further) and lays out as
  // the single separating space.
  const text = await page.evaluate(() => document.querySelector('li')!.textContent)
  expect(text).toContain('left\nright')
})
