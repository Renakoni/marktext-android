import type { Ref } from 'vue'
import type { MuyaEditor } from './editorRuntime'
import { captureSelectionWithin, resolveEditorDomNode } from './editorInlineInsert'
import { caretRangeAtPoint, type SelectionToolbarCommandId } from './selectionToolbar'
import {
  addAndroidSelectionContextListener,
  addAndroidSelectionTapListener,
  finishAndroidEditorSelectionActionMode,
  isAndroidSelectionControlAvailable,
  performAndroidNativeSelectAll,
  setAndroidEditorSelectionMenuSuppressed,
  writeAndroidClipboardText,
  type AndroidSelectionTapEvent,
} from '../../lib/androidSelection'

interface SelectionLogger {
  debug(message: string, context?: unknown): void
  warn(message: string, context?: unknown): void
}

export interface EditorSelectionLifecycleOptions {
  currentScreen: Ref<string>
  editorReady: Ref<boolean>
  androidInputDiagnosticsEnabled: Ref<boolean>
  getEditor: () => MuyaEditor | null
  getEditorElement: () => HTMLElement | null
  describeEditorInputState: () => Record<string, unknown>
  /**
   * The suppressed native floating ActionMode started — the moment Android
   * would have shown its own clipboard menu (long-press selection,
   * double-tap word select, insertion-caret menu).
   */
  onSelectionContextRequest?: () => void
  logger: SelectionLogger
}

export interface EditorSelectionLifecycle {
  captureEditorSelection(): Range | null
  restoreEditorSelectionRange(activeEditor: MuyaEditor, restoreRange: Range | null): boolean
  restoreEditorInsertionCaret(activeEditor: MuyaEditor, range: Range | null): boolean
  finishSelectionToolbarOutsideTap(caretRange: Range | null): void
  runSelectionToolbarCommand(
    commandId: SelectionToolbarCommandId,
    restoreRange: Range | null,
  ): Promise<void>
  setEditorSelectionMenuSuppression(suppressed: boolean, reason: string): Promise<void>
  installNativeSelectionTapListener(): Promise<void>
  uninstallNativeSelectionTapListener(): Promise<void>
}

/**
 * Owns the editor selection lifecycle on Android: DOM range capture/restore
 * kept in sync with Muya's selection model, the selection-toolbar command
 * sequencing (clipboard bridging, caret placement, ActionMode dismissal), the
 * ActionMode menu suppression bridge, and the native selection-tap listener
 * used to dismiss the selection toolbar. Muya internals and the toolbar UI
 * are untouched.
 */
export function createEditorSelectionLifecycle(
  options: EditorSelectionLifecycleOptions,
): EditorSelectionLifecycle {
  let nativeSelectionTapCleanup: (() => Promise<void>) | null = null
  let nativeSelectionContextCleanup: (() => Promise<void>) | null = null

  function captureEditorSelection() {
    return captureSelectionWithin(
      resolveEditorDomNode(options.getEditor(), options.getEditorElement()),
    )
  }

  // The Android tap that presses a toolbar button can collapse the selection
  // before the command handler runs; put the captured selection back so the
  // clipboard commands still have a range to operate on.
  function restoreEditorSelectionIfCollapsed(restoreRange: Range | null) {
    if (!restoreRange || restoreRange.collapsed) {
      return
    }

    const selection = document.getSelection()
    if (!selection || (selection.rangeCount > 0 && !selection.isCollapsed)) {
      return
    }

    try {
      selection.removeAllRanges()
      selection.addRange(restoreRange)
    } catch (error) {
      options.logger.debug('selection restore skipped', { error })
    }
  }

  function restoreEditorSelectionRange(activeEditor: MuyaEditor, restoreRange: Range | null) {
    if (!restoreRange || restoreRange.collapsed) {
      return false
    }

    const selection = document.getSelection()
    if (!selection) {
      return false
    }

    try {
      selection.removeAllRanges()
      selection.addRange(restoreRange.cloneRange())
      syncMuyaSelectionFromDom(activeEditor)
      return true
    } catch (error) {
      options.logger.debug('selection range restore skipped', { error })
      return false
    }
  }

  function getCurrentSelectionRangeClone() {
    const selection = document.getSelection()
    if (!selection || selection.rangeCount === 0) {
      return null
    }

    try {
      return selection.getRangeAt(0).cloneRange()
    } catch {
      return null
    }
  }

  function focusEditorDomNode(activeEditor: MuyaEditor) {
    try {
      activeEditor.domNode.focus({ preventScroll: true })
    } catch {
      activeEditor.domNode.focus()
    }
  }

  function syncMuyaSelectionFromDom(activeEditor: MuyaEditor) {
    const selectionController = activeEditor.editor.selection
    const liveSelection = selectionController.getSelection()
    if (!liveSelection) {
      return false
    }

    selectionController.setSelection(liveSelection.anchor, liveSelection.focus)
    activeEditor.editor.activeContentBlock = liveSelection.focus.block
    return true
  }

  function restoreCollapsedEditorRange(activeEditor: MuyaEditor, range: Range | null) {
    if (!range || !range.collapsed) {
      return false
    }

    const selection = document.getSelection()
    if (!selection) {
      return false
    }

    try {
      selection.removeAllRanges()
      selection.addRange(range.cloneRange())
      focusEditorDomNode(activeEditor)
      syncMuyaSelectionFromDom(activeEditor)
      return true
    } catch (error) {
      options.logger.debug('collapsed selection restore skipped', { error })
      return false
    }
  }

  function collapseEditorSelectionToRangeEdge(
    activeEditor: MuyaEditor,
    range: Range | null,
    edge: 'start' | 'end',
  ) {
    if (!range) {
      return false
    }

    const selection = document.getSelection()
    if (!selection) {
      return false
    }

    try {
      const collapsedRange = range.cloneRange()
      collapsedRange.collapse(edge === 'start')
      selection.removeAllRanges()
      selection.addRange(collapsedRange)
      focusEditorDomNode(activeEditor)
      syncMuyaSelectionFromDom(activeEditor)
      return true
    } catch (error) {
      options.logger.debug('selection collapse skipped', { edge, error })
      return false
    }
  }

  // Restore the insertion point captured before a sheet took the focus: a
  // caret restores in place; an expanded selection collapses to its end so a
  // block insert lands after the selected content instead of replacing it.
  function restoreEditorInsertionCaret(activeEditor: MuyaEditor, range: Range | null) {
    if (!range) {
      return false
    }

    return range.collapsed
      ? restoreCollapsedEditorRange(activeEditor, range)
      : collapseEditorSelectionToRangeEdge(activeEditor, range, 'end')
  }

  function clearEditorSelectionIfStillExpanded(activeEditor: MuyaEditor) {
    const selection = document.getSelection()
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      selection.removeAllRanges()
      activeEditor.editor.selection.clear()
    }
  }

  async function finishEditorSelectionActionMode(reason: string) {
    const finished = await finishAndroidEditorSelectionActionMode(reason)
    if (finished) {
      options.logger.debug('Android editor selection action mode finished', { reason })
    }
    return finished
  }

  async function finishEditorSelectionActionModeAndRestoreCaret(
    reason: string,
    activeEditor: MuyaEditor,
    caretRange: Range | null,
  ) {
    const finished = await finishEditorSelectionActionMode(reason)
    if (finished && caretRange) {
      restoreCollapsedEditorRange(activeEditor, caretRange)
    }
    return finished
  }

  function finishSelectionToolbarOutsideTap(caretRange: Range | null) {
    const activeEditor = options.editorReady.value ? options.getEditor() : null
    if (!activeEditor) {
      void finishEditorSelectionActionMode('selection-toolbar-outside-tap')
      return
    }

    if (caretRange) {
      restoreCollapsedEditorRange(activeEditor, caretRange)
    }
    void finishEditorSelectionActionModeAndRestoreCaret(
      'selection-toolbar-outside-tap',
      activeEditor,
      caretRange,
    ).then((finished) => {
      if (finished) {
        options.logger.debug('selection toolbar outside tap dismissed', {
          restoredCaret: Boolean(caretRange),
        })
      }
    })
  }

  function getSelectionTextFallback(range: Range | null) {
    const rangeText = range?.toString() ?? ''
    if (rangeText.length > 0) {
      return rangeText
    }

    return document.getSelection()?.toString() ?? ''
  }

  async function runSelectionToolbarCommand(
    commandId: SelectionToolbarCommandId,
    restoreRange: Range | null,
  ) {
    const activeEditor = options.editorReady.value ? options.getEditor() : null
    if (!activeEditor) {
      return
    }

    try {
      const rangeBeforeCommand = restoreRange?.cloneRange() ?? getCurrentSelectionRangeClone()
      if (options.androidInputDiagnosticsEnabled.value) {
        options.logger.debug('selection command state', {
          commandId,
          phase: 'before',
          rangeText: (rangeBeforeCommand?.toString() ?? '').slice(0, 32),
          ...options.describeEditorInputState(),
        })
      }
      if (commandId === 'copy' || commandId === 'cut') {
        const restoredRange = restoreEditorSelectionRange(activeEditor, rangeBeforeCommand)
        if (!restoredRange) {
          restoreEditorSelectionIfCollapsed(restoreRange)
        }

        if (isAndroidSelectionControlAvailable()) {
          // Deterministic Android path: serialize the selection with Muya's own
          // clipboard pipeline and write it through the native clipboard bridge.
          // This avoids depending on execCommand + ClipboardEvent behavior in
          // OEM WebViews, which cannot be debugged remotely.
          const fallbackSelectionText = getSelectionTextFallback(rangeBeforeCommand)
          const payload
            = commandId === 'cut'
              ? activeEditor.editor.clipboard.cutSelectionToClipboardData()
              : activeEditor.editor.clipboard.getClipboardData()
          const clipboardText = payload.text || fallbackSelectionText
          if (!clipboardText) {
            options.logger.warn('selection clipboard payload empty, command skipped', {
              commandId,
              hadRestoreRange: Boolean(rangeBeforeCommand),
            })
            return
          }

          const written = await writeAndroidClipboardText(clipboardText)
          if (!written) {
            options.logger.warn('android clipboard write failed', { commandId })
            return
          }
        } else {
          // Web path: execCommand routes through Muya's document-level copy/cut
          // handlers, which own Markdown serialization and history-safe deletion.
          const executed = document.execCommand(commandId)
          if (!executed) {
            const selectionText = document.getSelection()?.toString() ?? ''
            const written
              = selectionText.length > 0 && (await writeAndroidClipboardText(selectionText))
            if (commandId === 'cut' && written) {
              activeEditor.editor.clipboard.cutHandler()
            }
            options.logger.warn('selection execCommand rejected, used clipboard fallback', {
              commandId,
              written,
            })
          }
        }

        if (commandId === 'copy') {
          collapseEditorSelectionToRangeEdge(activeEditor, rangeBeforeCommand, 'end')
        } else if (!document.getSelection()?.isCollapsed) {
          const collapsed = collapseEditorSelectionToRangeEdge(
            activeEditor,
            rangeBeforeCommand,
            'start',
          )
          if (!collapsed) {
            clearEditorSelectionIfStillExpanded(activeEditor)
          }
        }
        await finishEditorSelectionActionModeAndRestoreCaret(
          `selection-toolbar-${commandId}`,
          activeEditor,
          getCurrentSelectionRangeClone(),
        )
      } else if (commandId === 'paste') {
        const restored = restoreEditorSelectionRange(activeEditor, restoreRange)
        if (!restored) {
          // Long-press caret paste: no expanded range to restore. Adopt the
          // live collapsed DOM caret into Muya's selection model so the
          // paste lands at the long-pressed position instead of a stale
          // cached selection.
          syncMuyaSelectionFromDom(activeEditor)
        }
        await activeEditor.editor.clipboard.pasteAsPlainText()
        await finishEditorSelectionActionModeAndRestoreCaret(
          'selection-toolbar-paste',
          activeEditor,
          getCurrentSelectionRangeClone(),
        )
      } else {
        // Prefer the native select-all: it keeps Chromium's touch-selection
        // session (and its drag handles) alive. Muya's JS select-all replaces
        // the range programmatically, which never shows handles on Android.
        const nativeSelectAll
          = isAndroidSelectionControlAvailable()
            && (await performAndroidNativeSelectAll('selection-toolbar'))
        if (!nativeSelectAll) {
          activeEditor.selectAll()
        }
      }

      options.logger.debug('selection toolbar command handled', {
        commandId,
        modelCharacters: activeEditor.getMarkdown().length,
      })
    } catch (error) {
      options.logger.warn('selection toolbar command failed', { commandId, error })
    }
  }

  async function setEditorSelectionMenuSuppression(suppressed: boolean, reason: string) {
    try {
      const state = await setAndroidEditorSelectionMenuSuppressed(suppressed, reason)
      if (state.native) {
        options.logger.debug('Android editor selection menu suppression updated', state)
      }
    } catch (error) {
      options.logger.warn('Android editor selection menu suppression update failed', error)
    }
  }

  function handleNativeSelectionTap(event: AndroidSelectionTapEvent) {
    if (options.currentScreen.value !== 'editor' || !options.editorReady.value) {
      return
    }

    const selection = document.getSelection()
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return
    }

    const hitElement = document.elementFromPoint(event.x, event.y)
    if (hitElement?.closest('[data-testid="mobile-selection-toolbar"]')) {
      return
    }

    const caret = caretRangeAtPoint(event.x, event.y)
    options.logger.debug('native selection tap dismissal', {
      x: Math.round(event.x),
      y: Math.round(event.y),
      hasCaret: Boolean(caret),
    })
    finishSelectionToolbarOutsideTap(caret)
  }

  function handleNativeSelectionContextRequest() {
    if (options.currentScreen.value !== 'editor' || !options.editorReady.value) {
      return
    }

    options.onSelectionContextRequest?.()
  }

  async function installNativeSelectionTapListener() {
    await uninstallNativeSelectionTapListener()
    nativeSelectionTapCleanup = await addAndroidSelectionTapListener(handleNativeSelectionTap)
    if (options.onSelectionContextRequest) {
      nativeSelectionContextCleanup = await addAndroidSelectionContextListener(
        handleNativeSelectionContextRequest,
      )
    }
  }

  async function uninstallNativeSelectionTapListener() {
    const cleanup = nativeSelectionTapCleanup
    const contextCleanup = nativeSelectionContextCleanup
    nativeSelectionTapCleanup = null
    nativeSelectionContextCleanup = null
    if (cleanup) {
      try {
        await cleanup()
      } catch (error) {
        options.logger.debug('native selection tap listener cleanup failed', { error })
      }
    }
    if (contextCleanup) {
      try {
        await contextCleanup()
      } catch (error) {
        options.logger.debug('native selection context listener cleanup failed', { error })
      }
    }
  }

  return {
    captureEditorSelection,
    restoreEditorSelectionRange,
    restoreEditorInsertionCaret,
    finishSelectionToolbarOutsideTap,
    runSelectionToolbarCommand,
    setEditorSelectionMenuSuppression,
    installNativeSelectionTapListener,
    uninstallNativeSelectionTapListener,
  }
}
