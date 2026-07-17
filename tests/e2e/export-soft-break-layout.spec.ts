import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// Browser layout coverage for the #3676 export soft-break fix (PR review):
// the export stylesheet renders tight list items `white-space: pre-wrap`, and
// `white-space` inherits — so marked's formatting-only newlines around nested
// block children would each render as a visible empty line box. The export
// pipeline strips that serializer whitespace (markdownToHtml,
// `_stripListFormattingWhitespace`; shape pinned by
// third_party/muya/src/state/__tests__/softBreakExportHtml.spec.ts). This
// spec closes the loop in a real Chromium: the stylesheet plus the pipeline's
// output shape lay out without phantom blank rows, while authored soft
// breaks still render as real line breaks.

// Playwright runs from the repo root; the config's testDir keeps that cwd.
const exportCss = readFileSync('third_party/muya/src/assets/styles/exportStyle.css', 'utf8')

async function measureListItemHeight(page: Page, listInner: string, extraCss = '') {
  await page.setContent(
    `<!doctype html><style>${exportCss}</style><style>${extraCss}</style>` +
      `<article class="markdown-body"><ul>${listInner}</ul></article>`,
  )
  return page.evaluate(
    () => document.querySelector('.markdown-body > ul > li')!.getBoundingClientRect().height,
  )
}

test('an authored soft break in a tight item renders as a real second line', async ({ page }) => {
  const single = await measureListItemHeight(page, '<li>line A</li>')
  const soft = await measureListItemHeight(page, '<li>line A\nline B</li>')

  expect(soft).toBeGreaterThan(single * 1.8)
  expect(soft).toBeLessThan(single * 2.6)
})

test('a soft break between inline-wrapped lines renders as a real second line', async ({ page }) => {
  // The authored newline lives in a whitespace-only text node BETWEEN two
  // inline elements — the strip must not eat it (review round 2).
  const single = await measureListItemHeight(page, '<li><strong>left</strong></li>')
  const soft = await measureListItemHeight(
    page,
    '<li><strong>left</strong>\n<strong>right</strong></li>',
  )

  expect(soft).toBeGreaterThan(single * 1.8)
  expect(soft).toBeLessThan(single * 2.6)
})

test('the cleaned nested-list shape adds no phantom blank rows', async ({ page }) => {
  // Exactly what the export pipeline emits for `- line A\n  - child`.
  const cleaned = '<li>line A<ul><li>child</li></ul></li>'
  const withPreWrap = await measureListItemHeight(page, cleaned)
  const control = await measureListItemHeight(
    page,
    cleaned,
    '.markdown-body li { white-space: normal !important; }',
  )

  expect(withPreWrap).toBe(control)
})

test("marked's uncleaned serializer newlines DO create blank rows (premise)", async ({ page }) => {
  // marked's raw serialization for the same markdown — the shape the
  // pipeline strip exists to prevent. If this stops failing tall, the strip
  // (and this suite) can be reconsidered.
  const raw = '<li>line A\n<ul>\n<li>child</li>\n</ul>\n</li>'
  const withPreWrap = await measureListItemHeight(page, raw)
  const control = await measureListItemHeight(
    page,
    raw,
    '.markdown-body li { white-space: normal !important; }',
  )

  expect(withPreWrap).toBeGreaterThan(control)
})

test('the cleaned nested-blockquote shape adds no phantom blank rows', async ({ page }) => {
  const cleaned = '<li>line A<blockquote><p>quoted</p></blockquote></li>'
  const withPreWrap = await measureListItemHeight(page, cleaned)
  const control = await measureListItemHeight(
    page,
    cleaned,
    '.markdown-body li { white-space: normal !important; }',
  )

  expect(withPreWrap).toBe(control)
})
