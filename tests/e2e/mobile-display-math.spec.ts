import { expect, test } from '@playwright/test'
import { openLocalDraft } from './helpers/drafts'

test.describe.configure({ timeout: 60000 })

// Upstream marktext#4935 (issue #4904): `$$...$$` on the same line as other
// text renders as display math instead of showing raw `$$` markers — markdown
// pasted from pandoc/GitHub-style sources now displays correctly. The Muya
// unit specs cover tokenization and serialization in happy-dom; this covers
// what happy-dom cannot: the shipped CSS renders the hidden preview as a
// full-width centered block in a real Chromium layout, while single-dollar
// math stays inline.

const MARKDOWN = 'Energy is $$E=mc^2$$ conserved, inline $x$ stays inline.'

test('renders same-line double-dollar math as a centered display block', async ({ page }) => {
  await openLocalDraft(page, {
    id: 'display-math-draft',
    markdown: MARKDOWN,
    title: /Energy is/,
  })

  const display = page.locator('.mu-math.mu-display-math').first()
  await expect(display).toBeVisible()
  await expect(display.locator('.katex-display')).toHaveCount(1)

  const layout = await display.evaluate(element => {
    const paragraph = element.closest('p.mu-paragraph')!
    const katex = element.querySelector('.katex')!
    const elementRect = element.getBoundingClientRect()
    const paragraphRect = paragraph.getBoundingClientRect()
    const katexRect = katex.getBoundingClientRect()

    return {
      display: getComputedStyle(element).display,
      widthDelta: Math.abs(elementRect.width - paragraphRect.width),
      centerDelta: Math.abs(
        katexRect.left + katexRect.width / 2 - (paragraphRect.left + paragraphRect.width / 2),
      ),
    }
  })
  expect(layout.display).toBe('block')
  expect(layout.widthDelta).toBeLessThanOrEqual(2)
  expect(layout.centerDelta).toBeLessThanOrEqual(2)

  // Single-dollar math is untouched: inline preview, no display block.
  const inline = page.locator('.mu-math:not(.mu-display-math)').first()
  await expect(inline).toBeVisible()
  await expect(inline.locator('.katex-display')).toHaveCount(0)
})
