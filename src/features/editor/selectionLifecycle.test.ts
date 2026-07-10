// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createEditorSelectionLifecycle } from './selectionLifecycle'
import type { MuyaEditor } from './editorRuntime'
import {
  addAndroidSelectionTapListener,
  finishAndroidEditorSelectionActionMode,
  isAndroidSelectionControlAvailable,
  performAndroidNativeSelectAll,
  setAndroidEditorSelectionMenuSuppressed,
  writeAndroidClipboardText,
} from '../../lib/androidSelection'

vi.mock('../../lib/androidSelection', () => ({
  addAndroidSelectionTapListener: vi.fn(async () => vi.fn(async () => {})),
  finishAndroidEditorSelectionActionMode: vi.fn(async () => true),
  isAndroidSelectionControlAvailable: vi.fn(() => false),
  performAndroidNativeSelectAll: vi.fn(async () => true),
  setAndroidEditorSelectionMenuSuppressed: vi.fn(async () => ({ native: true })),
  writeAndroidClipboardText: vi.fn(async () => true),
}))

vi.mock('./selectionToolbar', () => ({
  caretRangeAtPoint: vi.fn(() => null),
}))

const logger = { debug: vi.fn(), warn: vi.fn() }

function createFakeEditor(root: HTMLElement) {
  return {
    domNode: root,
    editor: {
      selection: {
        getSelection: vi.fn(() => ({
          anchor: { offset: 0 },
          focus: { offset: 1, block: { id: 'block-1' } },
        })),
        setSelection: vi.fn(),
        clear: vi.fn(),
      },
      activeContentBlock: null as unknown,
      clipboard: {
        getClipboardData: vi.fn(() => ({ text: 'copied text' })),
        cutSelectionToClipboardData: vi.fn(() => ({ text: 'cut text' })),
        cutHandler: vi.fn(),
        pasteAsPlainText: vi.fn(async () => {}),
      },
    },
    selectAll: vi.fn(),
    getMarkdown: vi.fn(() => '# markdown'),
  } as unknown as MuyaEditor
}

function createHarness(overrides: { editorReady?: boolean, screen?: string } = {}) {
  document.body.innerHTML = ''
  const root = document.createElement('div')
  root.textContent = 'selected words here'
  document.body.appendChild(root)
  const fakeEditor = createFakeEditor(root)

  const lifecycle = createEditorSelectionLifecycle({
    currentScreen: ref(overrides.screen ?? 'editor'),
    editorReady: ref(overrides.editorReady ?? true),
    androidInputDiagnosticsEnabled: ref(false),
    getEditor: () => fakeEditor,
    getEditorElement: () => root,
    describeEditorInputState: () => ({}),
    logger,
  })

  return { lifecycle, root, fakeEditor }
}

function selectAllOf(root: HTMLElement) {
  const range = document.createRange()
  range.selectNodeContents(root)
  const selection = document.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
  return range.cloneRange()
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(isAndroidSelectionControlAvailable).mockReturnValue(false)
  vi.mocked(finishAndroidEditorSelectionActionMode).mockResolvedValue(true)
  document.execCommand = vi.fn(() => true)
  document.elementFromPoint = vi.fn(() => null)
})

describe('selectionLifecycle', () => {
  it('captures the current selection inside the editor root', () => {
    const { lifecycle, root } = createHarness()
    selectAllOf(root)

    const captured = lifecycle.captureEditorSelection()

    expect(captured?.toString()).toBe('selected words here')
  })

  it('restores an expanded range and syncs the Muya selection model', () => {
    const { lifecycle, root, fakeEditor } = createHarness()
    const range = selectAllOf(root)
    document.getSelection()!.removeAllRanges()

    const restored = lifecycle.restoreEditorSelectionRange(fakeEditor, range)

    expect(restored).toBe(true)
    expect(document.getSelection()!.toString()).toBe('selected words here')
    expect(fakeEditor.editor.selection.setSelection).toHaveBeenCalled()
    expect(fakeEditor.editor.activeContentBlock).toEqual({ id: 'block-1' })
  })

  it('copies through execCommand on the web path and dismisses the action mode', async () => {
    const { lifecycle, root } = createHarness()
    const range = selectAllOf(root)

    await lifecycle.runSelectionToolbarCommand('copy', range)

    expect(document.execCommand).toHaveBeenCalledWith('copy')
    expect(finishAndroidEditorSelectionActionMode).toHaveBeenCalledWith('selection-toolbar-copy')
    expect(document.getSelection()!.isCollapsed).toBe(true)
  })

  it('cuts through the native clipboard bridge when Android selection control exists', async () => {
    vi.mocked(isAndroidSelectionControlAvailable).mockReturnValue(true)
    const { lifecycle, root, fakeEditor } = createHarness()
    const range = selectAllOf(root)

    await lifecycle.runSelectionToolbarCommand('cut', range)

    expect(fakeEditor.editor.clipboard.cutSelectionToClipboardData).toHaveBeenCalled()
    expect(writeAndroidClipboardText).toHaveBeenCalledWith('cut text')
    expect(document.execCommand).not.toHaveBeenCalled()
  })

  it('skips the clipboard write when the payload and fallback are both empty', async () => {
    vi.mocked(isAndroidSelectionControlAvailable).mockReturnValue(true)
    const { lifecycle, root, fakeEditor } = createHarness()
    vi.mocked(fakeEditor.editor.clipboard.getClipboardData).mockReturnValue({ html: '', text: '' })
    root.textContent = ''

    await lifecycle.runSelectionToolbarCommand('copy', null)

    expect(writeAndroidClipboardText).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(
      'selection clipboard payload empty, command skipped',
      expect.objectContaining({ commandId: 'copy' }),
    )
  })

  it('pastes as plain text after restoring the target range', async () => {
    const { lifecycle, root, fakeEditor } = createHarness()
    const range = selectAllOf(root)

    await lifecycle.runSelectionToolbarCommand('paste', range)

    expect(fakeEditor.editor.clipboard.pasteAsPlainText).toHaveBeenCalled()
    expect(finishAndroidEditorSelectionActionMode).toHaveBeenCalledWith('selection-toolbar-paste')
  })

  it('prefers the native select-all and falls back to Muya select-all', async () => {
    vi.mocked(isAndroidSelectionControlAvailable).mockReturnValue(true)
    const native = createHarness()
    await native.lifecycle.runSelectionToolbarCommand('selectAll', null)
    expect(performAndroidNativeSelectAll).toHaveBeenCalledWith('selection-toolbar')
    expect(native.fakeEditor.selectAll).not.toHaveBeenCalled()

    vi.mocked(performAndroidNativeSelectAll).mockResolvedValue(false)
    const fallback = createHarness()
    await fallback.lifecycle.runSelectionToolbarCommand('selectAll', null)
    expect(fallback.fakeEditor.selectAll).toHaveBeenCalled()
  })

  it('reports but never throws when menu suppression fails', async () => {
    const { lifecycle } = createHarness()
    vi.mocked(setAndroidEditorSelectionMenuSuppressed).mockRejectedValue(new Error('bridge gone'))

    await expect(
      lifecycle.setEditorSelectionMenuSuppression(true, 'test'),
    ).resolves.toBeUndefined()

    expect(logger.warn).toHaveBeenCalledWith(
      'Android editor selection menu suppression update failed',
      expect.any(Error),
    )
  })

  it('reinstalls the native tap listener idempotently and cleans up on uninstall', async () => {
    const firstCleanup = vi.fn(async () => {})
    const secondCleanup = vi.fn(async () => {})
    vi.mocked(addAndroidSelectionTapListener)
      .mockResolvedValueOnce(firstCleanup)
      .mockResolvedValueOnce(secondCleanup)
    const { lifecycle } = createHarness()

    await lifecycle.installNativeSelectionTapListener()
    await lifecycle.installNativeSelectionTapListener()
    expect(firstCleanup).toHaveBeenCalledTimes(1)

    await lifecycle.uninstallNativeSelectionTapListener()
    expect(secondCleanup).toHaveBeenCalledTimes(1)
  })

  it('dismisses the toolbar only for expanded selections outside it', async () => {
    const { lifecycle, root } = createHarness()
    await lifecycle.installNativeSelectionTapListener()
    const tapHandler = vi.mocked(addAndroidSelectionTapListener).mock.calls[0][0]

    // Collapsed selection: nothing to dismiss.
    document.getSelection()!.removeAllRanges()
    tapHandler({ x: 10, y: 10 })
    expect(finishAndroidEditorSelectionActionMode).not.toHaveBeenCalled()

    // Expanded selection + tap outside the toolbar: dismiss.
    selectAllOf(root)
    tapHandler({ x: 10, y: 10 })
    await Promise.resolve()
    expect(finishAndroidEditorSelectionActionMode).toHaveBeenCalledWith(
      'selection-toolbar-outside-tap',
    )
  })

  it('keeps the selection when the tap lands on a selection-toolbar button', async () => {
    const { lifecycle, root } = createHarness()
    const toolbar = document.createElement('div')
    toolbar.dataset.testid = 'mobile-selection-toolbar'
    const button = document.createElement('button')
    toolbar.appendChild(button)
    document.body.appendChild(toolbar)
    document.elementFromPoint = vi.fn(() => button)

    await lifecycle.installNativeSelectionTapListener()
    const tapHandler = vi.mocked(addAndroidSelectionTapListener).mock.calls[0][0]
    selectAllOf(root)

    tapHandler({ x: 10, y: 10 })
    await Promise.resolve()

    // Tapping Copy/Cut/Paste/Select-All must not tear down the selection the
    // command is about to operate on.
    expect(finishAndroidEditorSelectionActionMode).not.toHaveBeenCalled()
    expect(document.getSelection()!.isCollapsed).toBe(false)
  })

  it('ignores taps while the editor screen is not active', async () => {
    const { lifecycle, root } = createHarness({ screen: 'home' })
    await lifecycle.installNativeSelectionTapListener()
    const tapHandler = vi.mocked(addAndroidSelectionTapListener).mock.calls[0][0]
    selectAllOf(root)

    tapHandler({ x: 10, y: 10 })

    expect(finishAndroidEditorSelectionActionMode).not.toHaveBeenCalled()
  })
})
