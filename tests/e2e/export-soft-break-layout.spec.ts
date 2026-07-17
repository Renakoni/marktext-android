import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// Browser layout coverage for the #3676 export soft-break rendering (PR
// review rounds 1-5): the export render marks markdown-GENERATED paragraphs
// and list items with `data-md`, the stylesheet scopes `white-space:
// pre-wrap` to that marker, tight items' direct children are joined without
// marked's serializer newlines, and every HTML block container inside a
// tight item is reset to normal whitespace semantics. This spec pins the
// pixel outcome of each half in real Chromium against the real stylesheet;
// the emitted markup shapes are pinned by
// third_party/muya/src/state/__tests__/softBreakExportHtml.spec.ts.

// Playwright runs from the repo root; the config's testDir keeps that cwd.
const exportCss = readFileSync('third_party/muya/src/assets/styles/exportStyle.css', 'utf8')

const NO_PREWRAP_LI = '.markdown-body li { white-space: normal !important; }'

async function measureListItemHeight(page: Page, listInner: string, extraCss = '') {
  await page.setContent(
    `<!doctype html><style>${exportCss}</style><style>${extraCss}</style>` +
      `<article class="markdown-body"><ul>${listInner}</ul></article>`,
  )
  return page.evaluate(
    () => document.querySelector('.markdown-body > ul > li')!.getBoundingClientRect().height,
  )
}

async function measureParagraphHeight(page: Page, html: string, extraCss = '') {
  await page.setContent(
    `<!doctype html><style>${exportCss}</style><style>${extraCss}</style>` +
      `<article class="markdown-body">${html}</article>`,
  )
  return page.evaluate(
    () => document.querySelector('.markdown-body > p')!.getBoundingClientRect().height,
  )
}

test('an authored soft break in a tight item renders as a real second line', async ({ page }) => {
  const single = await measureListItemHeight(page, '<li data-md="">line A</li>')
  const soft = await measureListItemHeight(page, '<li data-md="">line A\nline B</li>')

  expect(soft).toBeGreaterThan(single * 1.8)
  expect(soft).toBeLessThan(single * 2.6)
})

test('a soft break between inline-wrapped lines renders as a real second line', async ({ page }) => {
  // The authored newline lives in a whitespace-only text node BETWEEN two
  // inline elements — the render must not lose it (review round 2).
  const single = await measureListItemHeight(page, '<li data-md=""><strong>left</strong></li>')
  const soft = await measureListItemHeight(
    page,
    '<li data-md=""><strong>left</strong>\n<strong>right</strong></li>',
  )

  expect(soft).toBeGreaterThan(single * 1.8)
  expect(soft).toBeLessThan(single * 2.6)
})

test('the emitted nested-list shape adds no phantom blank rows', async ({ page }) => {
  // Exactly what the export render emits for `- line A\n  - child`: direct
  // children joined without serializer newlines; the nested list keeps its
  // canonical interior (reset to normal whitespace by the stylesheet).
  const emitted = '<li data-md="">line A<ul>\n<li data-md="">child</li>\n</ul></li>'
  const withPreWrap = await measureListItemHeight(page, emitted)
  const control = await measureListItemHeight(page, emitted, NO_PREWRAP_LI)

  expect(withPreWrap).toBe(control)
})

test("marked's canonical serializer newlines WOULD create blank rows (premise)", async ({ page }) => {
  // marked's default serialization for the same markdown — the shape the
  // export render exists to avoid. If this stops measuring tall, the
  // tight-join (and this suite) can be reconsidered.
  const raw = '<li data-md="">line A\n<ul>\n<li data-md="">child</li>\n</ul>\n</li>'
  const withPreWrap = await measureListItemHeight(page, raw)
  const control = await measureListItemHeight(page, raw, NO_PREWRAP_LI)

  expect(withPreWrap).toBeGreaterThan(control)
})

test('a heading as the sole item child adds no phantom blank rows', async ({ page }) => {
  const emitted = '<li data-md=""><h1>heading</h1></li>'
  const withPreWrap = await measureListItemHeight(page, emitted)
  const control = await measureListItemHeight(page, emitted, NO_PREWRAP_LI)

  expect(withPreWrap).toBe(control)
})

test('raw-HTML newlines inside a tight item follow normal HTML semantics', async ({ page }) => {
  // Raw HTML passes through the pipeline verbatim; the container reset in
  // the export stylesheet must stop the item's pre-wrap from inheriting
  // into it (review round 4).
  const raw = '<li data-md=""><div>\n<strong>left</strong>\n<strong>right</strong>\n</div></li>'
  const withPreWrap = await measureListItemHeight(page, raw)
  const control = await measureListItemHeight(page, raw, NO_PREWRAP_LI)

  expect(withPreWrap).toBe(control)
})

test('the container reset covers the full HTML block set (section)', async ({ page }) => {
  // `<section>` (and article/aside/details/…) are block containers marked
  // passes through as raw HTML — an incomplete reset list leaves them
  // inheriting pre-wrap (review round 5).
  const raw =
    '<li data-md=""><section>\n<strong>left</strong>\n<strong>right</strong>\n</section></li>'
  const withPreWrap = await measureListItemHeight(page, raw)
  const control = await measureListItemHeight(page, raw, NO_PREWRAP_LI)

  expect(withPreWrap).toBe(control)
})

test('the emitted nested-blockquote shape adds no phantom blank rows', async ({ page }) => {
  const emitted =
    '<li data-md="">line A<blockquote>\n<p data-md="">quoted</p>\n</blockquote></li>'
  const withPreWrap = await measureListItemHeight(page, emitted)
  const control = await measureListItemHeight(page, emitted, NO_PREWRAP_LI)

  expect(withPreWrap).toBe(control)
})

test('a raw HTML paragraph keeps normal whitespace semantics', async ({ page }) => {
  // Raw `<p>` carries no `data-md` marker, so the pre-wrap rule must not
  // apply — its formatting newlines collapse to a single line exactly like
  // plain HTML (review round 5).
  const raw = '<p>\n<strong>left</strong>\n<strong>right</strong>\n</p>'
  const height = await measureParagraphHeight(page, raw)
  const control = await measureParagraphHeight(
    page,
    raw,
    '.markdown-body p { white-space: normal !important; }',
  )

  expect(height).toBe(control)
})

test('a generated paragraph still renders its soft break', async ({ page }) => {
  const single = await measureParagraphHeight(page, '<p data-md="">line one</p>')
  const soft = await measureParagraphHeight(page, '<p data-md="">line one\nline two</p>')

  expect(soft).toBeGreaterThan(single * 1.8)
  expect(soft).toBeLessThan(single * 2.6)
})
