import { expect, test, type Page } from '@playwright/test'
import {
  getDraftStorage,
  getStoredDraftMarkdown,
  newBlankDocument,
  openLocalDraft,
} from './helpers/drafts'
import { expectEditorReady } from './helpers/editor'

test.describe.configure({ timeout: 60000 })

const SETTINGS_STORAGE_KEY = 'marktext-for-android:settings-ui'

interface MockCapacitorWindow {
  androidBridge?: unknown
  __lastAndroidImagePickOptions?: Record<string, unknown>
  Capacitor?: {
    PluginHeaders?: Array<{
      name: string
      methods: Array<{ name: string; rtype: string }>
    }>
    nativePromise?: (
      pluginName: string,
      methodName: string,
      options?: Record<string, unknown>,
    ) => Promise<unknown>
    nativeCallback?: (
      pluginName: string,
      methodName: string,
      options: Record<string, unknown>,
      callback?: (data: unknown) => void,
    ) => Promise<string>
  }
}

async function selectTextInFirstParagraph(page: Page, text: string) {
  await page.evaluate(selectedText => {
    const paragraph = document.querySelector('[data-testid="editor-host"] .mu-editor p')
    if (!paragraph?.textContent?.includes(selectedText)) {
      throw new Error(`paragraph text not found: ${selectedText}`)
    }

    const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT)
    const remainingStart = paragraph.textContent.indexOf(selectedText)
    const remainingEnd = remainingStart + selectedText.length
    let startNode: Text | null = null
    let endNode: Text | null = null
    let startOffset = 0
    let endOffset = 0
    let cursor = 0

    while (walker.nextNode()) {
      const node = walker.currentNode as Text
      const nextCursor = cursor + node.length
      if (!startNode && remainingStart >= cursor && remainingStart <= nextCursor) {
        startNode = node
        startOffset = remainingStart - cursor
      }
      if (!endNode && remainingEnd >= cursor && remainingEnd <= nextCursor) {
        endNode = node
        endOffset = remainingEnd - cursor
      }
      cursor = nextCursor
    }

    if (!startNode || !endNode) {
      throw new Error(`selection text nodes not found: ${selectedText}`)
    }

    const range = document.createRange()
    range.setStart(startNode, startOffset)
    range.setEnd(endNode, endOffset)
    const selection = document.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
  }, text)
}

async function openToolbarSettings(page: Page) {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByTestId('bottom-nav-settings').click()
  await expect(page.getByTestId('settings-screen')).toBeVisible()
  await page.getByTestId('settings-entry-toolbar').click()
  await expect(page.getByTestId('settings-title')).toContainText('Toolbar')
}

async function selectToolbarPanel(page: Page, panelId: string) {
  const body = page.getByTestId('mobile-editor-toolbar-body')
  if (await body.isHidden()) {
    await page.getByTestId('toolbar-expand-button').click()
  }
  await page.getByTestId('toolbar-group-switcher').click()
  await expect(page.getByTestId('mobile-editor-toolbar-panel')).toBeVisible()
  await page.getByTestId(`toolbar-section-option-${panelId}`).click()
  await expect(page.getByTestId('mobile-editor-toolbar-panel')).toBeHidden()
}

async function installAndroidImagePickerMock(page: Page) {
  await page.addInitScript(() => {
    const win = window as unknown as MockCapacitorWindow

    win.androidBridge = {}
    win.Capacitor = {
      ...(win.Capacitor ?? {}),
      PluginHeaders: [
        ...((win.Capacitor?.PluginHeaders ?? []).filter(
          header => header.name !== 'App' && header.name !== 'AndroidDocuments',
        )),
        {
          name: 'App',
          methods: [
            { name: 'addListener', rtype: 'callback' },
            { name: 'removeListener', rtype: 'promise' },
            { name: 'exitApp', rtype: 'promise' },
          ],
        },
        {
          name: 'AndroidDocuments',
          methods: [
            { name: 'addListener', rtype: 'callback' },
            { name: 'removeListener', rtype: 'promise' },
            { name: 'getImportedImageDirectory', rtype: 'promise' },
            { name: 'pickImageDocument', rtype: 'promise' },
          ],
        },
      ],
      nativeCallback(pluginName, methodName, options) {
        if (pluginName === 'App' && methodName === 'addListener') {
          return Promise.resolve(`app-listener-${String(options.eventName)}`)
        }

        if (pluginName === 'AndroidDocuments' && methodName === 'addListener') {
          return Promise.resolve(`android-documents-listener-${String(options.eventName)}`)
        }

        return Promise.reject({
          code: 'UNIMPLEMENTED',
          message: `${pluginName}.${methodName} is not mocked`,
        })
      },
      nativePromise(pluginName, methodName, options = {}) {
        if (pluginName === 'App' && methodName === 'exitApp') {
          return Promise.resolve()
        }

        if (methodName === 'removeListener') {
          return Promise.resolve()
        }

        if (pluginName === 'AndroidDocuments' && methodName === 'getImportedImageDirectory') {
          return Promise.resolve({
            fileUri: 'file:///mock/images',
            webBaseUri: location.origin,
          })
        }

        if (pluginName === 'AndroidDocuments' && methodName === 'pickImageDocument') {
          win.__lastAndroidImagePickOptions = options
          return Promise.resolve({
            canceled: false,
            sourceUri: 'content://test/picked-image',
            displayName: 'favicon.svg',
            mimeType: 'image/svg+xml',
            markdownSrc: 'marktext-image://local/favicon.svg',
            fileUri: 'file:///mock/images/favicon.svg',
            bytes: 512,
          })
        }

        return Promise.reject({
          code: 'UNIMPLEMENTED',
          message: `${pluginName}.${methodName} is not mocked`,
        })
      },
    }
  })
}

test('applies quick toolbar inline formatting to selected editor text', async ({ page }) => {
  await newBlankDocument(page)

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('bold from mobile toolbar')
  await page.keyboard.press('Control+A')
  await page.getByTestId('toolbar-command-format.strong').click()

  // Markdown result AND the rendered inline structure.
  await expect.poll(() => getDraftStorage(page)).toContain('**bold from mobile toolbar**')
  await expect(
    page.getByTestId('editor-host').locator('strong.mu-inline-rule'),
  ).toContainText('bold from mobile toolbar')
})

test('keeps selected text active while chaining quick inline formatting', async ({ page }) => {
  await newBlankDocument(page)

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('abc')
  await selectTextInFirstParagraph(page, 'abc')
  await expect.poll(() => page.evaluate(() => document.getSelection()?.toString() ?? '')).toBe('abc')
  await page.evaluate(() => document.getSelection()?.removeAllRanges())

  await page.getByTestId('toolbar-command-format.strong').tap()

  await expect.poll(() => getDraftStorage(page)).toContain('**abc**')
  await expect.poll(() => page.evaluate(() => document.getSelection()?.toString() ?? '')).toBe('abc')
  await page.evaluate(() => document.getSelection()?.removeAllRanges())

  await page.getByTestId('toolbar-command-format.emphasis').tap()

  await expect.poll(() => getDraftStorage(page)).toContain('***abc***')
  // The chained result renders as nested strong + em inline structures.
  await expect(page.getByTestId('editor-host').locator('strong.mu-inline-rule')).toContainText('abc')
  await expect(page.getByTestId('editor-host').locator('em.mu-inline-rule')).toContainText('abc')
  await expect.poll(() => page.evaluate(() => document.getSelection()?.toString() ?? '')).toBe('abc')
})

test('applies inline format commands from their panels to selected editor text', async ({ page }) => {
  const cases = [
    {
      commandId: 'format.inline-code',
      text: 'inline code from mobile toolbar',
      expected: '`inline code from mobile toolbar`',
      panelId: 'markdown',
    },
    {
      commandId: 'format.underline',
      text: 'underlined from mobile toolbar',
      expected: '<u>underlined from mobile toolbar</u>',
    },
    {
      commandId: 'format.strike',
      text: 'struck from mobile toolbar',
      expected: '~~struck from mobile toolbar~~',
      panelId: 'format',
    },
    {
      commandId: 'format.highlight',
      text: 'highlighted from mobile toolbar',
      expected: '<mark>highlighted from mobile toolbar</mark>',
      panelId: 'format',
    },
    {
      commandId: 'format.superscript',
      text: 'sup from mobile toolbar',
      expected: '<sup>sup from mobile toolbar</sup>',
      panelId: 'markdown',
    },
    {
      commandId: 'format.subscript',
      text: 'sub from mobile toolbar',
      expected: '<sub>sub from mobile toolbar</sub>',
      panelId: 'markdown',
    },
    {
      commandId: 'format.inline-math',
      text: 'x + y',
      expected: '$x + y$',
      panelId: 'markdown',
    },
  ] as const

  for (const testCase of cases) {
    const { commandId, text, expected } = testCase
    const panelId = 'panelId' in testCase ? testCase.panelId : null

    await test.step(commandId, async () => {
      await newBlankDocument(page)

      await page.getByTestId('editor-host').click()
      await page.keyboard.type(text)
      await page.keyboard.press('Control+A')
      if (panelId) {
        await selectToolbarPanel(page, panelId)
      }
      await page.getByTestId(`toolbar-command-${commandId}`).scrollIntoViewIfNeeded()
      await page.getByTestId(`toolbar-command-${commandId}`).click()

      await expect.poll(() => getDraftStorage(page)).toContain(expected)
    })
  }
})

test('clears inline formatting back to plain text', async ({ page }) => {
  await newBlankDocument(page)

  const editor = page.getByTestId('editor-host')
  await editor.click()
  await page.keyboard.type('formatted away')
  await page.keyboard.press('Control+A')
  await page.getByTestId('toolbar-command-format.strong').click()
  await expect.poll(() => getDraftStorage(page)).toContain('**formatted away**')
  await expect(editor.locator('strong.mu-inline-rule')).toContainText('formatted away')

  await selectToolbarPanel(page, 'format')
  await page.getByTestId('toolbar-command-format.clear-format').scrollIntoViewIfNeeded()
  await page.getByTestId('toolbar-command-format.clear-format').click()

  // The parsed Markdown is exactly the plain text again, and the rendered
  // strong structure is gone.
  await expect.poll(() => getStoredDraftMarkdown(page)).toBe('formatted away\n')
  await expect(editor.locator('strong.mu-inline-rule')).toHaveCount(0)
})

test('undo and redo from the toolbar walk the edit history', async ({ page }) => {
  await newBlankDocument(page)

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('history probe')
  await expect.poll(() => getDraftStorage(page)).toContain('history probe')

  await page.getByTestId('toolbar-command-edit.undo').click()
  await expect.poll(() => getDraftStorage(page)).not.toContain('history probe')

  // Redo lives in the expanded toolbar header next to undo.
  await page.getByTestId('toolbar-expand-button').click()
  await page.getByTestId('toolbar-command-edit.redo').click()
  await expect.poll(() => getDraftStorage(page)).toContain('history probe')
})

test('converts the current paragraph through every heading level and back', async ({ page }) => {
  await newBlankDocument(page)

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('Heading matrix probe')
  await selectToolbarPanel(page, 'paragraph')

  const editor = page.getByTestId('editor-host')
  for (let level = 1; level <= 6; level += 1) {
    await page.getByTestId(`toolbar-command-paragraph.heading-${level}`).scrollIntoViewIfNeeded()
    await page.getByTestId(`toolbar-command-paragraph.heading-${level}`).click()

    // Markdown result AND the rendered Muya block structure.
    await expect
      .poll(() => getDraftStorage(page))
      .toContain(`${'#'.repeat(level)} Heading matrix probe`)
    await expect(editor.locator(`h${level}.mu-atx-heading`)).toContainText('Heading matrix probe')
  }

  // The explicit Paragraph command converts the heading leaf back.
  await page.getByTestId('toolbar-command-paragraph.paragraph').scrollIntoViewIfNeeded()
  await page.getByTestId('toolbar-command-paragraph.paragraph').click()
  await expect.poll(() => getDraftStorage(page)).not.toContain('# Heading matrix probe')
  await expect.poll(() => getDraftStorage(page)).toContain('Heading matrix probe')
  await expect(editor.locator('p.mu-paragraph')).toContainText('Heading matrix probe')
})

test('promotes and demotes the current heading level', async ({ page }) => {
  await newBlankDocument(page)

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('### Level three')
  await expect.poll(() => getDraftStorage(page)).toContain('### Level three')

  await selectToolbarPanel(page, 'paragraph')
  await page.getByTestId('toolbar-command-paragraph.upgrade-heading').scrollIntoViewIfNeeded()
  await page.getByTestId('toolbar-command-paragraph.upgrade-heading').click()
  await expect.poll(() => getDraftStorage(page)).toContain('## Level three')
  await expect.poll(() => getDraftStorage(page)).not.toContain('### Level three')

  await page.getByTestId('toolbar-command-paragraph.degrade-heading').click()
  await expect.poll(() => getDraftStorage(page)).toContain('### Level three')
  await page.getByTestId('toolbar-command-paragraph.degrade-heading').click()
  await expect.poll(() => getDraftStorage(page)).toContain('#### Level three')
})

test('toggles bullet and ordered lists from the quick strip', async ({ page }) => {
  await newBlankDocument(page)

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('first entry')
  await page.getByTestId('toolbar-command-paragraph.bullet-list').click()
  await expect.poll(() => getDraftStorage(page)).toContain('- first entry')
  await expect(
    page.getByTestId('editor-host').locator('ul.mu-bullet-list').filter({ hasText: 'first entry' }),
  ).toHaveCount(1)

  // Converting the same list to an ordered list swaps the kind in place.
  await page.getByTestId('toolbar-command-paragraph.order-list').click()
  await expect.poll(() => getDraftStorage(page)).toContain('1. first entry')
  await expect.poll(() => getDraftStorage(page)).not.toContain('- first entry')
  await expect(
    page.getByTestId('editor-host').locator('ol.mu-order-list').filter({ hasText: 'first entry' }),
  ).toHaveCount(1)
})

test('toggles list looseness from the paragraph panel', async ({ page }) => {
  // A tight list loaded from Markdown parses as loose: false, so the first
  // toggle makes it loose and the second returns it to tight.
  await openLocalDraft(page, {
    id: 'loose-list-draft',
    markdown: '- alpha\n- beta\n',
    title: /alpha/,
  })

  await page
    .locator('[data-testid="editor-host"] .mu-list-item')
    .filter({ hasText: 'alpha' })
    .click()
  await selectToolbarPanel(page, 'paragraph')
  await page.getByTestId('toolbar-command-paragraph.loose-list-item').scrollIntoViewIfNeeded()
  await page.getByTestId('toolbar-command-paragraph.loose-list-item').click()

  await expect.poll(() => getStoredDraftMarkdown(page)).toBe('- alpha\n\n- beta\n')

  await page.getByTestId('toolbar-command-paragraph.loose-list-item').click()
  await expect.poll(() => getStoredDraftMarkdown(page)).toBe('- alpha\n- beta\n')
})

test('inserts a fenced code block from the paragraph panel', async ({ page }) => {
  await newBlankDocument(page)

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('above the fence')
  await selectToolbarPanel(page, 'paragraph')
  await page.getByTestId('toolbar-command-paragraph.code-fence').scrollIntoViewIfNeeded()
  await page.getByTestId('toolbar-command-paragraph.code-fence').click()

  await expect(page.getByTestId('editor-host').locator('.mu-code-block')).toHaveCount(1)
  await expect.poll(() => getDraftStorage(page)).toContain('above the fence')

  // The cursor lands in the new fence's language field; Enter moves it into
  // the code body.
  await page.keyboard.type('js')
  await page.keyboard.press('Enter')
  await page.keyboard.type('const fenced = true')
  await expect.poll(() => getDraftStorage(page)).toContain('```js\\nconst fenced = true\\n```')
})

// Android WebView scales marker GLYPHS by the user's system font size
// (textZoom) but not the fence markers' fixed px offsets, so Muya's literal
// ``` fence pseudo-markers collided with the language label above and the box
// border below. They are desktop editing chrome, redundant with the box, the
// language field, and the corner "fenced" tag, so the Android build hides
// them; the box and tag stay.
test('hides the literal fence pseudo-markers on an active code block', async ({ page }) => {
  await newBlankDocument(page)

  await page.getByTestId('editor-host').click()
  await selectToolbarPanel(page, 'paragraph')
  await page.getByTestId('toolbar-command-paragraph.code-fence').scrollIntoViewIfNeeded()
  await page.getByTestId('toolbar-command-paragraph.code-fence').click()

  const fence = page.getByTestId('editor-host').locator('pre.mu-code-block.mu-fenced-code')
  await expect(fence).toHaveCount(1)
  // The block is active (just inserted, cursor inside): the app override must
  // win the cascade over Muya's own marker rule.
  await expect(fence).toHaveClass(/mu-active/)

  const markerContent = await fence.evaluate(node => [
    getComputedStyle(node, '::before').content,
    getComputedStyle(node, '::after').content,
  ])
  expect(markerContent).toEqual(['none', 'none'])

  // The "fenced" tag (a different pseudo-element on .mu-code) is untouched.
  await expect(
    page.getByTestId('editor-host').locator('.mu-fenced-code.mu-active .mu-code'),
  ).toHaveCount(1)
})

// The Table command opens the size sheet (steppers, default 3×3) and inserts
// through `muya.createTable`. It must not route to `updateParagraph('table')`:
// that Muya path emits `muya-table-picker`, whose only subscriber is the
// desktop hover-grid chessboard, deliberately not registered on Android.
test('inserts a table from the insert panel through the size sheet', async ({ page }) => {
  await newBlankDocument(page)

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('above the table')
  await selectToolbarPanel(page, 'insert')
  await page.getByTestId('toolbar-command-paragraph.table').scrollIntoViewIfNeeded()
  await page.getByTestId('toolbar-command-paragraph.table').click()

  const sheet = page.getByTestId('table-insert-sheet')
  await expect(sheet).toBeVisible()
  await expect(page.getByTestId('table-rows-value')).toHaveText('3')
  await expect(page.getByTestId('table-columns-value')).toHaveText('3')
  await page.getByTestId('table-insert-button').click()

  await expect(sheet).toBeHidden()
  const table = page.getByTestId('editor-host').locator('figure.mu-table')
  await expect(table).toHaveCount(1)
  await expect(table.locator('tr')).toHaveCount(3)
  await expect(table.locator('tr').first().locator('th, td')).toHaveCount(3)
  // The typed paragraph survives above the inserted table.
  await expect.poll(() => getStoredDraftMarkdown(page)).toMatch(
    /above the table[\s\S]*\|.*\|\n\| ?-+/,
  )
})

test('the table sheet steppers choose a custom size within the mobile limits', async ({
  page,
}) => {
  await newBlankDocument(page)

  await page.getByTestId('editor-host').click()
  await selectToolbarPanel(page, 'insert')
  await page.getByTestId('toolbar-command-paragraph.table').click()
  await expect(page.getByTestId('table-insert-sheet')).toBeVisible()

  await page.getByTestId('table-rows-increment').click()
  await page.getByTestId('table-columns-decrement').click()
  await page.getByTestId('table-columns-decrement').click()
  await expect(page.getByTestId('table-rows-value')).toHaveText('4')
  await expect(page.getByTestId('table-columns-value')).toHaveText('1')
  // The column minimum is 1: the decrement control disables at the bound.
  await expect(page.getByTestId('table-columns-decrement')).toBeDisabled()

  await page.getByTestId('table-insert-button').click()

  const table = page.getByTestId('editor-host').locator('figure.mu-table')
  await expect(table).toHaveCount(1)
  await expect(table.locator('tr')).toHaveCount(4)
  await expect(table.locator('tr').first().locator('th, td')).toHaveCount(1)
})

test('the table lands at the toolbar-cached selection, not a later moved caret', async ({
  page,
}) => {
  await newBlankDocument(page)

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('First paragraph selected')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Second paragraph fallback')

  // The toolbar caches this non-collapsed pre-tap selection...
  await selectTextInFirstParagraph(page, 'First paragraph selected')

  // ...then an Android toolbar interaction may move the LIVE caret before
  // the command handler runs — simulate it collapsing into the second
  // paragraph. A collapsed selection never overwrites the toolbar cache,
  // and the cached range must win over the moved live caret.
  await page.evaluate(() => {
    const second = Array.from(
      document.querySelectorAll('[data-testid="editor-host"] .mu-editor p'),
    ).find(node => node.textContent?.includes('Second paragraph fallback'))!
    const walker = document.createTreeWalker(second, NodeFilter.SHOW_TEXT)
    const text = walker.nextNode() as Text
    const range = document.createRange()
    range.setStart(text, text.length)
    range.collapse(true)
    const selection = document.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  })

  await selectToolbarPanel(page, 'insert')
  await page.getByTestId('toolbar-command-paragraph.table').click()
  await expect(page.getByTestId('table-insert-sheet')).toBeVisible()
  await page.getByTestId('table-insert-button').click()

  // Document order: first paragraph, TABLE, second paragraph.
  await expect(page.getByTestId('editor-host').locator('figure.mu-table')).toHaveCount(1)
  await expect.poll(() => getStoredDraftMarkdown(page)).toMatch(
    /First paragraph selected[\s\S]*\|[\s\S]*Second paragraph fallback/,
  )
})

test('opening the link sheet closes the in-document search overlay', async ({ page }) => {
  await newBlankDocument(page)

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('searchable content')
  await page.getByTestId('search-open-button').click()
  await expect(page.getByTestId('editor-search-bar')).toBeVisible()

  await selectToolbarPanel(page, 'insert')
  await page.getByTestId('toolbar-command-format.hyperlink').click()

  await expect(page.getByTestId('link-insert-sheet')).toBeVisible()
  await expect(page.getByTestId('editor-search-bar')).toBeHidden()
})

test('the link sheet contains keyboard focus and rescues it on cancel', async ({ page }) => {
  await newBlankDocument(page)

  await page.getByTestId('editor-host').click()
  await selectToolbarPanel(page, 'insert')
  await page.getByTestId('toolbar-command-format.hyperlink').click()
  await expect(page.getByTestId('link-insert-sheet')).toBeVisible()

  const activeTestId = () =>
    page.evaluate(
      () =>
        document.activeElement?.getAttribute('data-testid') ??
        document.activeElement?.tagName ??
        'none',
    )

  // Initial focus leads to the URL field; with it empty the Insert button is
  // disabled, so forward Tab reaches Cancel and WRAPS to the text field
  // instead of escaping through the scrim into the app chrome.
  await expect.poll(activeTestId).toBe('link-url-input')
  await page.keyboard.press('Tab')
  await expect.poll(activeTestId).toBe('link-cancel-button')
  await page.keyboard.press('Tab')
  await expect.poll(activeTestId).toBe('link-text-input')

  // Shift+Tab from the first control wraps back to the last.
  await page.keyboard.press('Shift+Tab')
  await expect.poll(activeTestId).toBe('link-cancel-button')

  // Closing without inserting must not leave focus dangling on <body>.
  await page.getByTestId('link-cancel-button').click()
  await expect(page.getByTestId('link-insert-sheet')).toBeHidden()
  await expect.poll(activeTestId).toBe('toolbar-expand-button')
})

test('opening the table sheet closes the in-document search overlay', async ({ page }) => {
  await newBlankDocument(page)

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('searchable content')
  await page.getByTestId('search-open-button').click()
  await expect(page.getByTestId('editor-search-bar')).toBeVisible()

  // The bottom toolbar stays reachable under the search overlay; the modal
  // sheet must not silently stack on top of an active search session.
  await selectToolbarPanel(page, 'insert')
  await page.getByTestId('toolbar-command-paragraph.table').click()

  await expect(page.getByTestId('table-insert-sheet')).toBeVisible()
  await expect(page.getByTestId('editor-search-bar')).toBeHidden()
})

test('the table sheet contains keyboard focus and rescues it on cancel', async ({ page }) => {
  await newBlankDocument(page)

  await page.getByTestId('editor-host').click()
  await selectToolbarPanel(page, 'insert')
  await page.getByTestId('toolbar-command-paragraph.table').click()
  await expect(page.getByTestId('table-insert-sheet')).toBeVisible()

  const activeTestId = () =>
    page.evaluate(
      () =>
        document.activeElement?.getAttribute('data-testid') ??
        document.activeElement?.tagName ??
        'none',
    )

  // Initial focus leads to the ready-to-confirm Insert action.
  await expect.poll(activeTestId).toBe('table-insert-button')

  // Forward Tab reaches Cancel, then WRAPS to the first stepper control
  // instead of escaping through the scrim into the app chrome.
  await page.keyboard.press('Tab')
  await expect.poll(activeTestId).toBe('table-cancel-button')
  await page.keyboard.press('Tab')
  await expect.poll(activeTestId).toBe('table-rows-decrement')

  // Shift+Tab from the first control wraps back to the last.
  await page.keyboard.press('Shift+Tab')
  await expect.poll(activeTestId).toBe('table-cancel-button')

  // Closing without inserting must not leave focus dangling on <body>.
  await page.getByTestId('table-cancel-button').click()
  await expect(page.getByTestId('table-insert-sheet')).toBeHidden()
  await expect.poll(activeTestId).toBe('toolbar-expand-button')
})

test('cancelling the table sheet inserts nothing and keeps the document intact', async ({
  page,
}) => {
  await newBlankDocument(page)

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('untouched paragraph')
  await selectToolbarPanel(page, 'insert')
  await page.getByTestId('toolbar-command-paragraph.table').click()
  await expect(page.getByTestId('table-insert-sheet')).toBeVisible()

  await page.getByTestId('table-cancel-button').click()

  await expect(page.getByTestId('table-insert-sheet')).toBeHidden()
  await expect(page.getByTestId('editor-host').locator('figure.mu-table')).toHaveCount(0)
  await expect(page.getByTestId('editor-host')).toContainText('untouched paragraph')
  await expect.poll(() => getStoredDraftMarkdown(page)).not.toContain('|')
})

test('inserts a horizontal rule from the insert panel', async ({ page }) => {
  await newBlankDocument(page)

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('above the rule')
  await selectToolbarPanel(page, 'insert')
  await page.getByTestId('toolbar-command-paragraph.horizontal-line').scrollIntoViewIfNeeded()
  await page.getByTestId('toolbar-command-paragraph.horizontal-line').click()

  await expect(page.getByTestId('editor-host').locator('.mu-thematic-break')).toHaveCount(1)
  await expect.poll(() => getDraftStorage(page)).toContain('above the rule\\n\\n---')
})

test('inserts a math block from the markdown panel', async ({ page }) => {
  await newBlankDocument(page)

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('lead paragraph')
  await selectToolbarPanel(page, 'markdown')

  await page.getByTestId('toolbar-command-paragraph.math-formula').scrollIntoViewIfNeeded()
  await page.getByTestId('toolbar-command-paragraph.math-formula').click()

  await expect(page.getByTestId('editor-host').locator('.mu-math-block')).toHaveCount(1)
  await expect.poll(() => getDraftStorage(page)).toContain('$$\\n\\n$$')
})

test('inserts an HTML block from the markdown panel', async ({ page }) => {
  await newBlankDocument(page)

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('lead paragraph')
  await selectToolbarPanel(page, 'markdown')

  await page.getByTestId('toolbar-command-paragraph.html-block').scrollIntoViewIfNeeded()
  await page.getByTestId('toolbar-command-paragraph.html-block').click()

  await expect(page.getByTestId('editor-host').locator('.mu-html-block')).toHaveCount(1)
  await expect.poll(() => getDraftStorage(page)).toContain('<div>\\n\\n</div>')
})

test('prepends a single front matter block from the markdown panel', async ({ page }) => {
  await newBlankDocument(page)

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('lead paragraph')
  await selectToolbarPanel(page, 'markdown')

  const editor = page.getByTestId('editor-host')
  await page.getByTestId('toolbar-command-paragraph.front-matter').scrollIntoViewIfNeeded()
  await page.getByTestId('toolbar-command-paragraph.front-matter').click()

  // Front matter always prepends at the document start...
  await expect(editor.locator('pre.mu-frontmatter')).toHaveCount(1)
  await expect.poll(() => getStoredDraftMarkdown(page)).toMatch(/^---\n/)
  await expect.poll(() => getStoredDraftMarkdown(page)).toContain('lead paragraph')

  // ...and stays a single block when invoked again (idempotent).
  await page.getByTestId('toolbar-command-paragraph.front-matter').click()
  await expect(editor.locator('pre.mu-frontmatter')).toHaveCount(1)
})

test('renders the toolbar visual system: icons, letterforms, accessible names', async ({
  page,
}) => {
  await newBlankDocument(page)

  // Collapsed quick strip: undo, the two lists, and Italic are icons (a
  // sans-serif italic "I" reads as a slash, so Italic gets a drawn glyph);
  // B/U stay letterforms that demonstrate their own effect.
  const quick = page.getByTestId('mobile-editor-toolbar')
  await expect(quick.locator('button[data-command-id="edit.undo"] svg')).toHaveCount(1)
  await expect(quick.locator('button[data-command-id="paragraph.bullet-list"] svg')).toHaveCount(1)
  await expect(quick.locator('button[data-command-id="paragraph.order-list"] svg')).toHaveCount(1)
  await expect(quick.locator('button[data-command-id="format.strong"]')).toHaveText('B')
  await expect(quick.locator('button[data-command-id="format.emphasis"] svg')).toHaveCount(1)

  // Insert panel: former abbreviations ([], Img, HR) are now icons, each
  // keeping its accessible name.
  await selectToolbarPanel(page, 'insert')
  for (const [commandId, name] of [
    ['format.hyperlink', 'Link'],
    ['format.image', 'Image'],
    ['paragraph.table', 'Table'],
    ['paragraph.horizontal-line', 'Horizontal rule'],
  ] as const) {
    const button = page.getByTestId(`toolbar-command-${commandId}`)
    await expect(button.locator('svg')).toHaveCount(1)
    await expect(button).toHaveAttribute('aria-label', name)
  }

  // Markdown panel: the script commands stay typographic, COMPOSED from
  // primary-font glyphs (base x + scaled mark) instead of Unicode ²/₂ whose
  // Android font fallback breaks baseline alignment; the math pair uses
  // icons whose only difference is composition (inline within a text line
  // versus a block on its own line), not a math operation.
  await selectToolbarPanel(page, 'markdown')
  await expect(page.getByTestId('toolbar-command-format.inline-math').locator('svg')).toHaveCount(1)
  await expect(page.getByTestId('toolbar-command-format.superscript')).toHaveText('x2')
  await expect(
    page.getByTestId('toolbar-command-format.superscript').locator('.toolbar-script-mark.is-super'),
  ).toHaveCount(1)
  await expect(
    page.getByTestId('toolbar-command-format.subscript').locator('.toolbar-script-mark.is-sub'),
  ).toHaveCount(1)
  await expect(
    page.getByTestId('toolbar-command-paragraph.math-formula').locator('svg'),
  ).toHaveCount(1)
  await expect(
    page.getByTestId('toolbar-command-paragraph.front-matter').locator('svg'),
  ).toHaveCount(1)

  // Every visible toolbar button exposes an accessible name — an explicit
  // aria-label for icon buttons, or visible text (the panel switcher).
  const unnamed = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll('[data-testid="mobile-editor-toolbar"] button'),
    ).filter(button => {
      const ariaLabel = (button.getAttribute('aria-label') ?? '').trim()
      const text = (button.textContent ?? '').trim()
      return !ariaLabel && !text
    }).length,
  )
  expect(unnamed).toBe(0)
})

test('the settings quick bar preview renders the same command visuals', async ({ page }) => {
  await openToolbarSettings(page)
  await page.getByTestId('settings-editing-quickbar-content-option-custom').click()
  await expect(page.getByTestId('settings-editing-quickbar-custom')).toBeVisible()

  // Icon commands preview as icons; letterform commands as letterforms —
  // rendered by the same shared component as the live toolbar.
  await expect(
    page.getByTestId('settings-quickbar-slot-fixed').locator('svg'),
  ).toHaveCount(1)
  await expect(page.getByTestId('settings-quickbar-slot-0')).toHaveText('B')
  await expect(
    page
      .getByTestId('settings-quickbar-preview')
      .locator('[data-command-id="paragraph.bullet-list"] button svg'),
  ).toHaveCount(1)
})

test('exposes mobile syntax sections without collapsing everything into paragraph', async ({
  page,
}) => {
  await newBlankDocument(page)

  await page.getByTestId('toolbar-expand-button').click()
  await page.getByTestId('toolbar-group-switcher').click()
  await expect(page.getByTestId('toolbar-section-option-format')).toBeVisible()
  await expect(page.getByTestId('toolbar-section-option-paragraph')).toBeVisible()
  await expect(page.getByTestId('toolbar-section-option-insert')).toBeVisible()
  await expect(page.getByTestId('toolbar-section-option-markdown')).toBeVisible()
})

test('applies toolbar display and panel settings without changing Markdown', async ({ page }) => {
  await newBlankDocument(page, {
    toolbarDefaultPanel: 'paragraph',
    toolbarRememberPanel: false,
    toolbarCompact: true,
  })

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('Toolbar settings stay inert')
  await expect.poll(() => getDraftStorage(page)).toContain('Toolbar settings stay inert')
  const storedDraft = await getDraftStorage(page)

  await page.getByTestId('toolbar-expand-button').click()
  await expect(page.getByTestId('toolbar-group-switcher')).toContainText('Paragraph')
  await selectToolbarPanel(page, 'insert')
  await page.getByTestId('toolbar-expand-button').click()
  await page.getByTestId('toolbar-expand-button').click()
  await expect(page.getByTestId('toolbar-group-switcher')).toContainText('Paragraph')
  await expect(page.getByTestId('mobile-editor-toolbar')).toHaveClass(/is-compact/)

  await expect.poll(() => getDraftStorage(page)).toBe(storedDraft)

  await newBlankDocument(page, { toolbarDisplayMode: 'hidden' })
  await expect(page.getByTestId('mobile-editor-toolbar')).toHaveCount(0)
})

test('customizes the collapsed quick toolbar from Settings', async ({ page }) => {
  await openToolbarSettings(page)

  await page.getByTestId('settings-editing-quickbar-content-option-custom').click()
  await expect(page.getByTestId('settings-editing-quickbar-custom')).toBeVisible()
  await expect(page.getByTestId('settings-quickbar-slot-fixed')).toHaveAttribute(
    'aria-label',
    'Undo, fixed',
  )
  await expect(page.getByTestId('settings-quickbar-slot-0')).toContainText('B')
  await expect(page.getByTestId('settings-quickbar-slot-1').locator('svg')).toHaveCount(1)

  await page.getByTestId('settings-quickbar-command-paragraph-heading-1').click()
  await expect(page.getByTestId('settings-quickbar-slot-5')).toContainText('H1')

  await page.getByTestId('settings-quickbar-button-format-strong').dispatchEvent('pointerdown', {
    pointerId: 1,
    pointerType: 'touch',
    clientX: 120,
    clientY: 700,
  })
  await expect(page.getByTestId('settings-quickbar-done')).toBeVisible({ timeout: 1700 })
  await page.getByTestId('settings-quickbar-preview').dispatchEvent('pointerup', {
    pointerId: 1,
    pointerType: 'touch',
    clientX: 120,
    clientY: 700,
  })

  await expect.poll(() =>
    page
      .getByTestId('settings-quickbar-button-format-strong')
      .evaluate(element => getComputedStyle(element).touchAction),
  ).toBe('pan-x')

  const boldButtonBox = await page
    .getByTestId('settings-quickbar-button-format-strong')
    .boundingBox()
  const headingSlotBox = await page.getByTestId('settings-quickbar-slot-5').boundingBox()
  expect(boldButtonBox).not.toBeNull()
  expect(headingSlotBox).not.toBeNull()

  await page.mouse.move(
    boldButtonBox!.x + boldButtonBox!.width / 2,
    boldButtonBox!.y + boldButtonBox!.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    headingSlotBox!.x + headingSlotBox!.width + 8,
    headingSlotBox!.y + headingSlotBox!.height / 2,
    { steps: 8 },
  )
  await page.mouse.up()

  const movedBoldButtonBox = await page
    .getByTestId('settings-quickbar-button-format-strong')
    .boundingBox()
  const firstEditableSlotBox = await page.getByTestId('settings-quickbar-slot-0').boundingBox()
  expect(movedBoldButtonBox).not.toBeNull()
  expect(firstEditableSlotBox).not.toBeNull()

  await page.mouse.move(
    movedBoldButtonBox!.x + movedBoldButtonBox!.width / 2,
    movedBoldButtonBox!.y + movedBoldButtonBox!.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    firstEditableSlotBox!.x + 2,
    firstEditableSlotBox!.y + firstEditableSlotBox!.height / 2,
    { steps: 8 },
  )
  await page.mouse.up()

  await page.getByTestId('settings-quickbar-done').click()
  await expect(page.getByTestId('settings-quickbar-done')).toHaveCount(0)

  await expect.poll(() =>
    page.evaluate(settingsKey => {
      const settings = JSON.parse(localStorage.getItem(settingsKey) ?? '{}') as Record<
        string,
        unknown
      >
      return settings
    }, SETTINGS_STORAGE_KEY),
  ).toMatchObject({
    toolbarQuickBarMode: 'custom',
    toolbarCustomQuickCommands:
      'format.strong,format.emphasis,format.underline,paragraph.bullet-list,paragraph.order-list,paragraph.heading-1',
  })

  await page.getByTestId('settings-detail-back').click()
  await page.getByTestId('bottom-nav-documents').click()
  await page.getByTestId('new-document-button').click()
  await expectEditorReady(page)

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('Custom quick heading')
  await page.getByTestId('toolbar-command-paragraph.heading-1').click()

  await expect.poll(() => getDraftStorage(page)).toContain('# Custom quick heading')
  await expect(page.getByTestId('toolbar-command-format.strike')).toHaveCount(0)
})

test('applies expanded heading and block commands from their mobile sections', async ({ page }) => {
  await newBlankDocument(page)

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('Mobile subheading')
  await selectToolbarPanel(page, 'paragraph')
  await page.getByTestId('toolbar-command-paragraph.heading-4').click()

  await expect.poll(() => getDraftStorage(page)).toContain('#### Mobile subheading')

  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Quoted from toolbar')
  await selectToolbarPanel(page, 'paragraph')
  await page.getByTestId('toolbar-command-paragraph.quote-block').click()

  await expect.poll(() => getDraftStorage(page)).toContain('> Quoted from toolbar')
})

test('inserts a link from selected editor text through the mobile link sheet', async ({ page }) => {
  await newBlankDocument(page)

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('MarkText for Android')
  await page.keyboard.press('Control+A')
  await selectToolbarPanel(page, 'insert')
  await page.getByTestId('toolbar-command-format.hyperlink').click()

  await expect(page.getByTestId('link-insert-sheet')).toBeVisible()
  await expect(page.getByTestId('link-text-input')).toHaveValue('MarkText for Android')
  await page.getByTestId('link-url-input').fill('https://github.com/Renakoni/marktext-android')
  await page.getByTestId('link-insert-button').click()

  await expect(page.getByTestId('link-insert-sheet')).toBeHidden()
  await expect.poll(() => getDraftStorage(page)).toContain(
    '[MarkText for Android](https://github.com/Renakoni/marktext-android)',
  )
})

test('inserts a link at a collapsed cursor through the mobile link sheet', async ({ page }) => {
  await newBlankDocument(page)

  await page.getByTestId('editor-host').click()
  await selectToolbarPanel(page, 'insert')
  await page.getByTestId('toolbar-command-format.hyperlink').click()

  await expect(page.getByTestId('link-insert-sheet')).toBeVisible()
  await expect(page.getByTestId('link-text-input')).toHaveValue('')
  await page.getByTestId('link-text-input').fill('Project repo')
  await page.getByTestId('link-url-input').fill('example.com')
  await page.getByTestId('link-insert-button').click()

  await expect(page.getByTestId('link-insert-sheet')).toBeHidden()
  await expect.poll(() => getDraftStorage(page)).toContain('[Project repo](example.com)')
})

test('inserts an Android-picked image from selected text through the insert section', async ({ page }) => {
  await installAndroidImagePickerMock(page)
  await newBlankDocument(page)

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('Picked icon')
  await page.keyboard.press('Control+A')
  await selectToolbarPanel(page, 'insert')
  await page.getByTestId('toolbar-command-format.image').scrollIntoViewIfNeeded()
  await page.getByTestId('toolbar-command-format.image').click()

  await expect.poll(() => getDraftStorage(page)).toContain(
    '![Picked icon](marktext-image://local/favicon.svg)',
  )

  const editor = page.getByTestId('editor-host')
  await expect(editor.locator('.mu-inline-image img[alt="Picked icon"]')).toHaveCount(1)
  await expect.poll(() => editor.locator('.mu-inline-image.mu-image-success').count()).toBeGreaterThan(0)
  await expect.poll(() =>
    page.evaluate(() => {
      const win = window as unknown as MockCapacitorWindow
      return win.__lastAndroidImagePickOptions?.copyImage
    }),
  ).toBe(true)
})

test('passes the copy images setting to the Android image picker', async ({ page }) => {
  await installAndroidImagePickerMock(page)
  await newBlankDocument(page, { imageCopyImages: false })

  await selectToolbarPanel(page, 'insert')
  await page.getByTestId('toolbar-command-format.image').scrollIntoViewIfNeeded()
  await page.getByTestId('toolbar-command-format.image').click()

  await expect.poll(() =>
    page.evaluate(() => {
      const win = window as unknown as MockCapacitorWindow
      return win.__lastAndroidImagePickOptions?.copyImage
    }),
  ).toBe(false)
})

test('switches toolbar sections and applies paragraph commands to the current paragraph', async ({
  page,
}) => {
  await newBlankDocument(page)

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('Toolbar heading')

  await selectToolbarPanel(page, 'paragraph')
  await page.getByTestId('toolbar-command-paragraph.heading-1').click()

  await expect.poll(() => getDraftStorage(page)).toContain('# Toolbar heading')

  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('next action')
  await selectToolbarPanel(page, 'paragraph')
  await page.getByTestId('toolbar-command-paragraph.task-list').click()

  await expect.poll(() => getDraftStorage(page)).toContain('- [ ] next action')
})
