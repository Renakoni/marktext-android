import { expect, test, type Page } from '@playwright/test'
import { openLocalDraft } from './helpers/drafts'

test.describe.configure({ timeout: 60000 })

// Upstream marktext#4931 (issue #4926): emoji are stored as UTF-16 surrogate
// pairs, and a deletion at the offset between the two units left a lone
// surrogate in the document. ot-text-unicode cannot encode a lone surrogate,
// so the next text operation threw "Invalid offset - splits unicode bytes"
// and crashed the renderer. Mobile hits this harder than desktop: soft
// keyboards make emoji input and Backspace far more common.

const EMOJI = '\u{1F642}'
const MIXED_TEXT = `${EMOJI}(微笑)\u{1F600}(大笑)`
const TEXT_AFTER_FIRST_EMOJI = MIXED_TEXT.slice(EMOJI.length)
const DELETE_KEYS = ['Backspace', 'Delete'] as const

function paragraph(page: Page) {
  return page.locator('.mu-editor p.mu-paragraph').first()
}

function collectPageErrors(page: Page) {
  const errors: Error[] = []
  page.on('pageerror', error => errors.push(error))
  return errors
}

async function openDraftWithText(page: Page, markdown: string, title: RegExp) {
  await openLocalDraft(page, { id: 'emoji-deletion-draft', markdown, title })
  await paragraph(page).click()
}

/**
 * Rest the collapsed DOM caret at `unitOffset` UTF-16 units into the first
 * text node containing `needle`, then let Muya adopt the selection the way a
 * user tap would.
 */
async function placeCaret(page: Page, needle: string, unitOffset: number) {
  const placed = await page.evaluate(
    ({ needle, unitOffset }) => {
      const target = document.querySelector('.mu-editor p.mu-paragraph')
      if (!target) {
        return false
      }

      const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT)
      let textNode = walker.nextNode()
      while (textNode instanceof Text && !textNode.data.includes(needle)) {
        textNode = walker.nextNode()
      }
      if (!(textNode instanceof Text)) {
        return false
      }

      const offset = textNode.data.indexOf(needle) + unitOffset
      const range = document.createRange()
      range.setStart(textNode, offset)
      range.collapse(true)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      document.dispatchEvent(new Event('selectionchange'))
      return true
    },
    { needle, unitOffset },
  )
  expect(placed).toBe(true)
}

for (const key of DELETE_KEYS) {
  test(`${key} inside an emoji removes the whole code point without corruption`, async ({
    page,
  }) => {
    const errors = collectPageErrors(page)
    await openDraftWithText(page, MIXED_TEXT, /微笑/)

    // Offset 1 is between the emoji's two UTF-16 code units.
    await placeCaret(page, EMOJI, 1)
    await page.keyboard.press(key)
    await expect(paragraph(page)).toHaveText(TEXT_AFTER_FIRST_EMOJI)

    // A follow-up edit must still apply cleanly — a lone surrogate would make
    // this (not the deletion itself) throw inside the ot layer.
    await placeCaret(page, '(', 0)
    await page.keyboard.type('x')
    await expect(paragraph(page)).toHaveText(`x${TEXT_AFTER_FIRST_EMOJI}`)
    expect(errors).toEqual([])
  })
}

test('Backspace removes a trailing emoji as one code point', async ({ page }) => {
  const errors = collectPageErrors(page)
  await openDraftWithText(page, `abc${EMOJI}`, /abc/)

  await placeCaret(page, 'abc', `abc${EMOJI}`.length)
  await page.keyboard.press('Backspace')
  await expect(paragraph(page)).toHaveText('abc')

  await page.keyboard.type('x')
  await expect(paragraph(page)).toHaveText('abcx')
  expect(errors).toEqual([])
})
