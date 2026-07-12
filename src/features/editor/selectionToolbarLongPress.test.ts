// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSelectionToolbarLongPress } from './selectionToolbarLongPress'

function buildEditorHost() {
  const host = document.createElement('div')
  const paragraph = document.createElement('p')
  paragraph.textContent = 'Alpha bravo charlie'
  host.append(paragraph)
  document.body.append(host)
  return { host, paragraph }
}

function placeCaret(node: Node, offset = 0) {
  const range = document.createRange()
  range.setStart(node.firstChild ?? node, offset)
  range.collapse(true)
  const selection = document.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
}

function selectText(node: Node) {
  const range = document.createRange()
  range.selectNodeContents(node)
  const selection = document.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
}

// happy-dom does not dispatch selectionchange on its own; fire it manually
// after mutating the selection, the way real browsers do asynchronously.
function fireSelectionChange() {
  document.dispatchEvent(new Event('selectionchange'))
}

interface HarnessOverrides {
  canActivate?: () => boolean
  clipboardText?: () => Promise<boolean>
}

function createHarness(overrides: HarnessOverrides = {}) {
  const { host, paragraph } = buildEditorHost()
  const longPress = createSelectionToolbarLongPress({
    isEditorReady: () => true,
    getEditorHost: () => host,
    canActivate: overrides.canActivate ?? (() => true),
    queryClipboardHasText: overrides.clipboardText ?? (() => Promise.resolve(true)),
    logger: { debug: vi.fn() },
  })
  return { longPress, host, paragraph }
}

afterEach(() => {
  document.getSelection()?.removeAllRanges()
  document.body.innerHTML = ''
})

describe('createSelectionToolbarLongPress', () => {
  it('opens a caret session for a collapsed caret and refreshes the clipboard state', async () => {
    const { longPress, paragraph } = createHarness()
    placeCaret(paragraph, 2)

    await longPress.enterFromContextRequest('test')

    expect(longPress.caretSessionActive.value).toBe(true)
    expect(longPress.clipboardHasText.value).toBe(true)
  })

  it('only refreshes the clipboard state when a selection already exists', async () => {
    const { longPress, paragraph } = createHarness({
      clipboardText: () => Promise.resolve(false),
    })
    selectText(paragraph)

    await longPress.enterFromContextRequest('test')

    expect(longPress.caretSessionActive.value).toBe(false)
    expect(longPress.clipboardHasText.value).toBe(false)
  })

  it('refuses to enter while a competing surface owns the interaction', async () => {
    const { longPress, paragraph } = createHarness({ canActivate: () => false })
    placeCaret(paragraph)

    await longPress.enterFromContextRequest('test')

    expect(longPress.caretSessionActive.value).toBe(false)
  })

  it('ends the caret session on an ordinary tap outside the floating toolbar', async () => {
    const { longPress, paragraph } = createHarness()
    placeCaret(paragraph)
    await longPress.enterFromContextRequest('test')

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))

    expect(longPress.caretSessionActive.value).toBe(false)
  })

  it('keeps the session alive for taps on the floating toolbar itself', async () => {
    const { longPress, paragraph } = createHarness()
    const toolbar = document.createElement('div')
    toolbar.dataset.testid = 'mobile-selection-toolbar'
    const button = document.createElement('button')
    toolbar.append(button)
    document.body.append(toolbar)
    placeCaret(paragraph)
    await longPress.enterFromContextRequest('test')

    button.dispatchEvent(new Event('pointerdown', { bubbles: true }))

    expect(longPress.caretSessionActive.value).toBe(true)
  })

  it('ends the caret session when the caret moves', async () => {
    const { longPress, paragraph } = createHarness()
    placeCaret(paragraph, 1)
    await longPress.enterFromContextRequest('test')

    placeCaret(paragraph, 5)
    fireSelectionChange()

    expect(longPress.caretSessionActive.value).toBe(false)
  })

  it('hands over to the selection-driven display when the caret widens', async () => {
    const { longPress, paragraph } = createHarness()
    placeCaret(paragraph, 1)
    await longPress.enterFromContextRequest('test')

    selectText(paragraph)
    fireSelectionChange()

    // The caret session ends; the selection itself keeps the toolbar shown
    // through the existing selection-driven path.
    expect(longPress.caretSessionActive.value).toBe(false)
  })

  it('ends the caret session on edits, command runs, and document replacement', async () => {
    const { longPress, paragraph } = createHarness()

    placeCaret(paragraph)
    await longPress.enterFromContextRequest('edit case')
    longPress.notifyDocumentEdited()
    expect(longPress.caretSessionActive.value).toBe(false)

    placeCaret(paragraph)
    await longPress.enterFromContextRequest('command case')
    longPress.notifyCommandRun()
    expect(longPress.caretSessionActive.value).toBe(false)

    placeCaret(paragraph)
    await longPress.enterFromContextRequest('reset case')
    longPress.resetForNewDocument()
    expect(longPress.caretSessionActive.value).toBe(false)
    expect(longPress.clipboardHasText.value).toBe(false)
  })

  it('drops a stale entry when a surface opened during the clipboard query', async () => {
    let activatable = true
    let resolveClipboard: (value: boolean) => void = () => {}
    const { longPress, paragraph } = createHarness({
      canActivate: () => activatable,
      clipboardText: () => new Promise(resolve => (resolveClipboard = resolve)),
    })
    placeCaret(paragraph)

    const entry = longPress.enterFromContextRequest('test')
    activatable = false
    resolveClipboard(true)
    await entry

    expect(longPress.caretSessionActive.value).toBe(false)
  })
})
