import { expect, test, type Page } from '@playwright/test'
import { expectEditorReady } from './helpers/editor'

// Android IME clipboard chips insert text via InputConnection.commitText,
// which reaches the page as an insertText beforeinput (the same path
// page.keyboard.insertText uses). Multi-line commits used to bypass Muya's
// block model entirely: the browser cloned unlinked content spans and the
// text became invisible to cut/delete/save.

async function newBlankDocument(page: Page) {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByTestId('new-document-button').click()
  await expectEditorReady(page)
}

function getDraftMarkdown(page: Page) {
  return page.evaluate(() => {
    const drafts = JSON.parse(localStorage.getItem('marktext-for-android:drafts') ?? '[]')
    return drafts.length ? String(drafts[0].markdown) : ''
  })
}

test('multi-line IME text insert reaches the Muya model', async ({ page }) => {
  await newBlankDocument(page)

  await page.locator('.mu-editor p').first().click()
  // Blank lines between segments: normal-paste semantics split them into
  // separate paragraph blocks (a single \n is a markdown soft break).
  await page.keyboard.insertText('第一行文本\n\n第二行文本\n\n第三行文本')

  await expect(page.getByTestId('editor-host')).toContainText('第三行文本')
  await expect.poll(() => getDraftMarkdown(page)).toContain('第一行文本')
  await expect.poll(() => getDraftMarkdown(page)).toContain('第三行文本')

  const spanLinkage = await page.evaluate(() => {
    const blockKey = '__MUYA_BLOCK__'
    return Array.from(document.querySelectorAll('.mu-editor .mu-content')).map(span =>
      Boolean((span as unknown as Record<string, unknown>)[blockKey]),
    )
  })
  expect(spanLinkage.length).toBeGreaterThanOrEqual(3)
  expect(spanLinkage.every(Boolean)).toBe(true)
})

test('IME-inserted text stays editable: backspace and cut still work', async ({ page }) => {
  await newBlankDocument(page)

  await page.locator('.mu-editor p').first().click()
  await page.keyboard.insertText('甲乙丙丁\n戊己庚辛')
  await expect.poll(() => getDraftMarkdown(page)).toContain('戊己庚辛')

  await page.keyboard.press('Backspace')
  await expect(page.getByTestId('editor-host')).not.toContainText('戊己庚辛')
  await expect(page.getByTestId('editor-host')).toContainText('戊己庚')
  await expect.poll(() => getDraftMarkdown(page)).toContain('戊己庚')

  await page.evaluate(() => {
    const paragraph = Array.from(
      document.querySelectorAll('[data-testid="editor-host"] .mu-editor p'),
    ).find(node => node.textContent?.includes('甲乙丙丁'))
    if (!paragraph) {
      throw new Error('inserted paragraph not found')
    }

    const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT)
    const firstText = walker.nextNode() as Text | null
    if (!firstText) {
      throw new Error('inserted paragraph has no text nodes')
    }

    const range = document.createRange()
    range.setStart(firstText, 0)
    range.setEnd(firstText, firstText.length)
    const selection = document.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  })

  const toolbar = page.getByTestId('mobile-selection-toolbar')
  await expect(toolbar).toBeVisible()
  await toolbar.getByTestId('selection-command-cut').tap()

  await expect(page.getByTestId('editor-host')).not.toContainText('甲乙丙丁')
  await expect.poll(() => getDraftMarkdown(page)).not.toContain('甲乙丙丁')
})
