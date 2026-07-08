import { expect, test, type Page } from '@playwright/test'
import { expectEditorReady } from './helpers/editor'

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

async function openDraft(page: Page) {
  const now = '2026-07-01T09:00:00.000Z'
  await page.goto('/')
  await page.evaluate(now => {
    localStorage.clear()
    localStorage.setItem(
      'marktext-for-android:drafts',
      JSON.stringify([
        {
          id: 'chain-probe-draft',
          markdown:
            '# Chain Probe\n\nAlpha bravo charlie delta echo\n\nSecond paragraph tail\n',
          updatedAt: now,
          lastSavedAt: now,
        },
      ]),
    )
  }, now)
  await page.reload()
  await page.getByRole('button', { name: /Chain Probe/ }).click()
  await expectEditorReady(page)
}

async function selectParagraph(page: Page, needle: string) {
  await page.evaluate(needle => {
    const paragraph = Array.from(
      document.querySelectorAll('[data-testid="editor-host"] .mu-editor p'),
    ).find(node => node.textContent?.includes(needle))
    if (!paragraph) {
      throw new Error(`paragraph not found: ${needle}`)
    }

    // Anchor in text nodes with offsets, matching the selection shape a
    // native Android long-press produces (not an element-anchored range).
    const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT)
    const firstText = walker.nextNode() as Text | null
    let lastText: Text | null = firstText
    while (walker.nextNode()) {
      lastText = walker.currentNode as Text
    }
    if (!firstText || !lastText) {
      throw new Error(`paragraph has no text nodes: ${needle}`)
    }

    const range = document.createRange()
    range.setStart(firstText, 0)
    range.setEnd(lastText, lastText.length)
    const selection = document.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }, needle)
}

test('copy places the selected text on the real clipboard', async ({ page }) => {
  await openDraft(page)
  await page.evaluate(() => navigator.clipboard.writeText('sentinel-before-copy'))

  await selectParagraph(page, 'Alpha bravo')
  const toolbar = page.getByTestId('mobile-selection-toolbar')
  await expect(toolbar).toBeVisible()

  await toolbar.getByTestId('selection-command-copy').tap()

  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain('Alpha bravo charlie delta echo')
  await expect.poll(() => page.evaluate(() => document.getSelection()?.isCollapsed)).toBe(true)
  await expect(toolbar).toBeHidden()
})

test('cut removes the text, fills the clipboard, and undo restores it', async ({ page }) => {
  await openDraft(page)

  await selectParagraph(page, 'Alpha bravo')
  const toolbar = page.getByTestId('mobile-selection-toolbar')
  await expect(toolbar).toBeVisible()

  await toolbar.getByTestId('selection-command-cut').tap()

  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain('Alpha bravo charlie delta echo')
  await expect(page.getByTestId('editor-host')).not.toContainText('Alpha bravo')

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByTestId('editor-host')).toContainText('Alpha bravo charlie delta echo')
})

test('select all expands to the document and stays selected', async ({ page }) => {
  await openDraft(page)

  await selectParagraph(page, 'Alpha bravo')
  const toolbar = page.getByTestId('mobile-selection-toolbar')
  await expect(toolbar).toBeVisible()

  await toolbar.getByTestId('selection-command-selectAll').tap()
  await expect
    .poll(() => page.evaluate(() => document.getSelection()?.toString() ?? ''))
    .toContain('Second paragraph tail')

  // The selection must hold instead of flashing away.
  await page.waitForTimeout(700)
  const stillSelected = await page.evaluate(() => document.getSelection()?.toString() ?? '')
  expect(stillSelected).toContain('Chain Probe')
  expect(stillSelected).toContain('Second paragraph tail')
  await expect(toolbar).toBeVisible()

  const clickPoint = await page.evaluate(() => {
    const paragraph = Array.from(
      document.querySelectorAll('[data-testid="editor-host"] .mu-editor p'),
    ).find(node => node.textContent?.includes('Second paragraph tail'))
    if (!paragraph) {
      throw new Error('second paragraph not found')
    }

    const rect = paragraph.getBoundingClientRect()
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    }
  })

  await page.mouse.click(clickPoint.x, clickPoint.y)
  await expect.poll(() => page.evaluate(() => document.getSelection()?.isCollapsed)).toBe(true)
  await expect(toolbar).toBeHidden()
})

test('paste replaces the selection with clipboard text', async ({ page }) => {
  await openDraft(page)
  await page.evaluate(() => navigator.clipboard.writeText('pasted-payload-123'))

  await selectParagraph(page, 'Alpha bravo')
  const toolbar = page.getByTestId('mobile-selection-toolbar')
  await expect(toolbar).toBeVisible()

  await toolbar.getByTestId('selection-command-paste').tap()

  await expect(page.getByTestId('editor-host')).toContainText('pasted-payload-123')
  await expect(page.getByTestId('editor-host')).not.toContainText('Alpha bravo charlie')
})

test('toolbar stays hidden for the empty-document placeholder selection', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByTestId('new-document-button').click()
  await expectEditorReady(page)

  await page.evaluate(() => {
    const block = document.querySelector('[data-testid="editor-host"] .mu-editor p')
    if (!block) {
      throw new Error('empty paragraph not found')
    }

    const range = document.createRange()
    range.selectNodeContents(block)
    const selection = document.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  })

  await page.waitForTimeout(400)
  await expect(page.getByTestId('mobile-selection-toolbar')).toBeHidden()
})
