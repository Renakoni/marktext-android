import { expect, test, type Page } from '@playwright/test'
import { openLocalDraft } from './helpers/drafts'

test.describe.configure({ timeout: 60000 })

// Pressing Enter rebuilds the paragraph DOM and re-applies the selection
// programmatically, so the WebView's native caret-follow (which covers typed
// characters) never fires. The caretFollow module must keep the collapsed
// caret inside the shell viewport after every structural edit; without it the
// caret walks off the bottom edge line by line.

const MARKDOWN = `# Caret Follow

${Array.from({ length: 40 }, (_, index) => `Line ${index + 1}`).join('\n\n')}
`

interface CaretMetrics {
  caretBottom: number
  shellBottom: number
  scrollTop: number
}

function readCaretMetrics(page: Page): Promise<CaretMetrics | null> {
  return page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>('.editor-host-shell')
    const selection = window.getSelection()
    if (!shell || !selection || selection.rangeCount === 0) {
      return null
    }

    const range = selection.getRangeAt(0).cloneRange()
    const rects = range.getClientRects()
    let rect: DOMRect | undefined = rects.length > 0 ? rects[rects.length - 1] : undefined
    if (!rect) {
      const node = range.startContainer
      const element = node instanceof Element ? node : node.parentElement
      rect = element?.getBoundingClientRect()
    }

    if (!rect) {
      return null
    }

    return {
      caretBottom: rect.bottom,
      shellBottom: shell.getBoundingClientRect().bottom,
      scrollTop: shell.scrollTop,
    }
  })
}

test('keeps the caret visible while Enter appends lines at the bottom', async ({ page }) => {
  await openLocalDraft(page, {
    id: 'caret-follow-draft',
    markdown: MARKDOWN,
    title: /Caret Follow/,
  })

  // Scroll to the end and put the caret into the last line.
  await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>('.editor-host-shell')!
    shell.scrollTop = shell.scrollHeight
  })
  const lastParagraph = page.locator('.mu-editor p.mu-paragraph').last()
  await lastParagraph.click()

  const initial = await readCaretMetrics(page)
  expect(initial).not.toBeNull()

  // Enough presses to walk well past the shell height even with generous
  // editor bottom padding; the invariant must hold after every single one.
  for (let press = 0; press < 30; press += 1) {
    await page.keyboard.press('Enter')
    const metrics = await readCaretMetrics(page)
    expect(metrics, `caret metrics after Enter #${press + 1}`).not.toBeNull()
    expect(
      metrics!.caretBottom,
      `caret left the viewport after Enter #${press + 1}`,
    ).toBeLessThanOrEqual(metrics!.shellBottom + 1)
  }

  const final = await readCaretMetrics(page)
  expect(final!.scrollTop).toBeGreaterThan(initial!.scrollTop)
})
