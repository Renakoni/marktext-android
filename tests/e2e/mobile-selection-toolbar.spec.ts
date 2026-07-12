import { expect, test, type Page } from '@playwright/test'
import { installAndroidAppMock, type MockCapacitorWindow } from './helpers/androidAppMock'
import { expectEditorReady } from './helpers/editor'

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

function toolbarCommandIds(page: Page) {
  return page.evaluate(() =>
    Array.from(
      document.querySelectorAll('[data-testid="mobile-selection-toolbar"] [data-command-id]'),
    ).map(button => button.getAttribute('data-command-id')),
  )
}

// The long-press entry: on the web build the contextmenu event is the
// fallback signal (real Android uses the suppressed native ActionMode).
async function longPressParagraph(page: Page, needle: string) {
  await page
    .locator('[data-testid="editor-host"] .mu-editor p')
    .filter({ hasText: needle })
    .first()
    .click({ button: 'right' })
}

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

test('selection actions follow the state table with clipboard content', async ({ page }) => {
  await openDraft(page)

  // Selected + clipboard has content: Cut, Copy, Paste, Select all.
  await page.evaluate(() => navigator.clipboard.writeText('clipboard-payload'))
  await selectParagraph(page, 'Alpha bravo')
  const toolbar = page.getByTestId('mobile-selection-toolbar')
  await expect(toolbar).toBeVisible()
  await expect
    .poll(() => toolbarCommandIds(page))
    .toEqual(['cut', 'copy', 'paste', 'selectAll'])

  // Selected + clipboard empty: Cut, Copy, Select all.
  await page.evaluate(() => document.getSelection()?.removeAllRanges())
  await expect(toolbar).toBeHidden()
  await page.evaluate(() => navigator.clipboard.writeText(''))
  await selectParagraph(page, 'Alpha bravo')
  await expect(toolbar).toBeVisible()
  await expect.poll(() => toolbarCommandIds(page)).toEqual(['cut', 'copy', 'selectAll'])
})

test('a long-press caret offers paste and select all', async ({ page }) => {
  await openDraft(page)
  await page.evaluate(() => navigator.clipboard.writeText('clipboard-payload'))

  await longPressParagraph(page, 'Alpha bravo')

  const toolbar = page.getByTestId('mobile-selection-toolbar')
  await expect(toolbar).toBeVisible()
  await expect.poll(() => toolbarCommandIds(page)).toEqual(['paste', 'selectAll'])
})

test('a long-press caret with an empty clipboard offers select all only', async ({ page }) => {
  await openDraft(page)
  await page.evaluate(() => navigator.clipboard.writeText(''))

  await longPressParagraph(page, 'Alpha bravo')

  await expect(page.getByTestId('mobile-selection-toolbar')).toBeVisible()
  await expect.poll(() => toolbarCommandIds(page)).toEqual(['selectAll'])
})

test('a long-press in an empty document still offers select all', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByTestId('new-document-button').click()
  await expectEditorReady(page)
  await page.evaluate(() => navigator.clipboard.writeText(''))

  await page
    .locator('[data-testid="editor-host"] .mu-editor p')
    .first()
    .click({ button: 'right' })

  await expect(page.getByTestId('mobile-selection-toolbar')).toBeVisible()
  await expect.poll(() => toolbarCommandIds(page)).toEqual(['selectAll'])
})

test('paste lands at the long-pressed caret and ends the session', async ({ page }) => {
  await openDraft(page)
  await page.evaluate(() => navigator.clipboard.writeText('pasted-at-caret'))

  // Deterministic caret: a click-derived caret position depends on the
  // responsive text measure, so place the collapsed caret at a KNOWN offset
  // (after "Second", before " paragraph") and fire the context request from
  // exactly that position — dispatching contextmenu does not move a caret.
  await page.evaluate(() => {
    const paragraph = Array.from(
      document.querySelectorAll('[data-testid="editor-host"] .mu-editor p'),
    ).find(node => node.textContent?.includes('Second paragraph tail'))!
    const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT)
    const text = walker.nextNode() as Text
    const range = document.createRange()
    range.setStart(text, 'Second'.length)
    range.collapse(true)
    const selection = document.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  })
  await page
    .locator('[data-testid="editor-host"] .mu-editor p')
    .filter({ hasText: 'Second paragraph tail' })
    .first()
    .dispatchEvent('contextmenu')

  const toolbar = page.getByTestId('mobile-selection-toolbar')
  await expect(toolbar).toBeVisible()
  await toolbar.getByTestId('selection-command-paste').click()

  // Nothing was replaced: the other paragraph survives untouched...
  await expect(page.getByTestId('editor-host')).toContainText('Alpha bravo charlie delta echo')
  // ...and the payload sits EXACTLY at the long-pressed caret, between the
  // known prefix and suffix.
  const paragraphWithPayload = await page.evaluate(
    () =>
      Array.from(document.querySelectorAll('[data-testid="editor-host"] .mu-editor p'))
        .map(node => node.textContent ?? '')
        .find(text => text.includes('pasted-at-caret')) ?? '',
  )
  expect(paragraphWithPayload).toBe('Secondpasted-at-caret paragraph tail')
  await expect(toolbar).toBeHidden()
})

test('select all from a long-press caret selects progressively and keeps the toolbar', async ({
  page,
}) => {
  await openDraft(page)
  await page.evaluate(() => navigator.clipboard.writeText(''))

  await longPressParagraph(page, 'Alpha bravo')
  const toolbar = page.getByTestId('mobile-selection-toolbar')
  await expect(toolbar).toBeVisible()
  await toolbar.getByTestId('selection-command-selectAll').click()

  // Muya's select-all is progressive: from a caret it first selects the
  // long-pressed block — which also proves the caret landed in it — and the
  // selection-driven display takes over with the selection actions.
  await expect
    .poll(() => page.evaluate(() => document.getSelection()?.toString() ?? ''))
    .toContain('Alpha bravo charlie delta echo')
  await expect(toolbar).toBeVisible()
  await expect.poll(() => toolbarCommandIds(page)).toEqual(['cut', 'copy', 'selectAll'])

  // A second select-all widens to the whole document.
  await toolbar.getByTestId('selection-command-selectAll').click()
  await expect
    .poll(() => page.evaluate(() => document.getSelection()?.toString() ?? ''))
    .toContain('Second paragraph tail')
  await expect(toolbar).toBeVisible()
})

test('an ordinary tap or typing never opens the toolbar', async ({ page }) => {
  await openDraft(page)
  await page.evaluate(() => navigator.clipboard.writeText('clipboard-payload'))
  const toolbar = page.getByTestId('mobile-selection-toolbar')

  // Ordinary caret placement.
  await page
    .locator('[data-testid="editor-host"] .mu-editor p')
    .filter({ hasText: 'Alpha bravo' })
    .first()
    .click()
  await page.waitForTimeout(400)
  await expect(toolbar).toBeHidden()

  // Normal typing and caret movement.
  await page.keyboard.type('x')
  await page.keyboard.press('ArrowLeft')
  await page.waitForTimeout(400)
  await expect(toolbar).toBeHidden()
})

test('a subsequent tap dismisses the long-press caret toolbar', async ({ page }) => {
  await openDraft(page)
  await page.evaluate(() => navigator.clipboard.writeText('clipboard-payload'))

  await longPressParagraph(page, 'Alpha bravo')
  const toolbar = page.getByTestId('mobile-selection-toolbar')
  await expect(toolbar).toBeVisible()

  await page
    .locator('[data-testid="editor-host"] .mu-editor p')
    .filter({ hasText: 'Second paragraph tail' })
    .first()
    .click()

  await expect(toolbar).toBeHidden()
})

test('an unwritable source URI keeps the full editing clipboard actions', async ({ page }) => {
  const now = '2026-07-12T08:00:00.000Z'
  const document = {
    sourceUri: 'content://test/read-only-selection',
    displayName: 'Read Only Probe.md',
    markdown: '# Read Only Probe\n\nProtected paragraph body\n',
    canWrite: false,
  }
  await installAndroidAppMock(page, document)
  await page.goto('/')
  await page.evaluate(
    ({ now, document }) => {
      localStorage.clear()
      localStorage.setItem(
        'marktext-for-android:recent-documents',
        JSON.stringify([
          {
            id: `android-document:${document.sourceUri}`,
            kind: 'android-document',
            displayName: document.displayName,
            title: 'Read Only Probe',
            sourceUri: document.sourceUri,
            providerName: 'Test Documents',
            pathHint: document.displayName,
            markdownPreview: null,
            updatedAt: now,
            lastOpenedAt: now,
            lastSavedAt: null,
            autosaveState: 'clean',
            canWrite: false,
          },
        ]),
      )
    },
    { now, document },
  )
  await page.reload()
  await page.getByRole('button', { name: /Read Only Probe/ }).click()
  await expectEditorReady(page)
  await page.evaluate(() => navigator.clipboard.writeText('clipboard-payload'))

  // Under the Android mock the app takes the NATIVE entry path: the
  // suppressed-ActionMode signal, not the web contextmenu fallback.
  const emitContextRequest = () =>
    page.evaluate(() =>
      (window as unknown as MockCapacitorWindow).__emitAndroidSelectionContextRequest?.(),
    )
  const placeCaretInParagraph = () =>
    page.evaluate(() => {
      const paragraph = Array.from(
        document.querySelectorAll('[data-testid="editor-host"] .mu-editor p'),
      ).find(node => node.textContent?.includes('Protected paragraph'))!
      const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT)
      const text = walker.nextNode() as Text
      const range = document.createRange()
      range.setStart(text, 2)
      range.collapse(true)
      const selection = document.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
    })
  const toolbar = page.getByTestId('mobile-selection-toolbar')

  // The source URI cannot be overwritten (canWrite: false), but the EDITOR
  // is still fully editable — the user can modify the content and save it
  // as a copy. Cut and Paste therefore stay available; the read-only table
  // rows are about editor editability, not source-write capability.
  await selectParagraph(page, 'Protected paragraph')
  await emitContextRequest()
  await expect(toolbar).toBeVisible()
  await expect
    .poll(() => toolbarCommandIds(page))
    .toEqual(['cut', 'copy', 'paste', 'selectAll'])

  await page.evaluate(() => document.getSelection()?.removeAllRanges())
  await expect(toolbar).toBeHidden()
  await placeCaretInParagraph()
  await emitContextRequest()
  await expect(toolbar).toBeVisible()
  await expect.poll(() => toolbarCommandIds(page)).toEqual(['paste', 'selectAll'])

  // A genuinely non-editable editor surface DOES activate the read-only
  // rows: Copy + Select all with a selection, Select all alone at a caret.
  await page.evaluate(() => document.getSelection()?.removeAllRanges())
  await expect(toolbar).toBeHidden()
  await page.evaluate(() =>
    document
      .querySelector('[data-testid="editor-host"] .mu-editor')
      ?.setAttribute('contenteditable', 'false'),
  )
  await selectParagraph(page, 'Protected paragraph')
  await emitContextRequest()
  await expect(toolbar).toBeVisible()
  await expect.poll(() => toolbarCommandIds(page)).toEqual(['copy', 'selectAll'])

  await page.evaluate(() => document.getSelection()?.removeAllRanges())
  await expect(toolbar).toBeHidden()
  await placeCaretInParagraph()
  await emitContextRequest()
  await expect(toolbar).toBeVisible()
  await expect.poll(() => toolbarCommandIds(page)).toEqual(['selectAll'])
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
