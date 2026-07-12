import { ref, type Ref } from 'vue'

interface SelectionToolbarLongPressLogger {
  debug(message: string, context?: Record<string, unknown>): void
}

export interface CreateSelectionToolbarLongPressOptions {
  isEditorReady: () => boolean
  /** Muya's live editor root; taps and carets are qualified against it. */
  getEditorHost: () => HTMLElement | null
  /** False while a sheet/prompt/menu owns the interaction surface. */
  canActivate: () => boolean
  /** Resolve whether the clipboard currently holds pasteable text. */
  queryClipboardHasText: () => Promise<boolean>
  logger?: SelectionToolbarLongPressLogger
}

export interface SelectionToolbarLongPress {
  /** A long-press placed a collapsed caret and the toolbar shows for it. */
  caretSessionActive: Ref<boolean>
  /** Content-aware paste availability, refreshed on every context request. */
  clipboardHasText: Ref<boolean>
  /**
   * The suppressed native ActionMode started (long-press selection,
   * double-tap word select, insertion-caret menu) — refresh the clipboard
   * state and, for a collapsed caret, open a caret session.
   */
  enterFromContextRequest(source: string): Promise<void>
  /** A toolbar command finished; paste and select-all end the caret session. */
  notifyCommandRun(): void
  /** Content changed through typing or other edits. */
  notifyDocumentEdited(): void
  /** A competing surface takes the interaction. */
  endCaretSession(reason: string): void
  /**
   * In-page fallbacks for environments without the native ActionMode signal
   * (web dev and e2e): Chromium fires contextmenu for long-press and
   * right-click, and a selection created without any signal still refreshes
   * the clipboard state. Deliberately NOT used on Android, where the native
   * signal covers every entry path and preventing contextmenu can interfere
   * with the native touch-selection flow.
   */
  attachWebFallbacks(): void
  /** Drop everything on document replacement or editor destruction. */
  resetForNewDocument(): void
}

/**
 * Long-press session state for the floating selection toolbar. The existing
 * selection-driven display is untouched: this only adds the caret rows of
 * the state table (paste / select-all without a selection) and keeps the
 * paste action truthful to the actual clipboard content. A caret session
 * follows the native insertion-menu conventions: it ends on an ordinary tap,
 * on caret movement, on edits, when a competing surface opens, or when the
 * caret widens into a selection (the selection-driven display takes over).
 */
export function createSelectionToolbarLongPress({
  isEditorReady,
  getEditorHost,
  canActivate,
  queryClipboardHasText,
  logger,
}: CreateSelectionToolbarLongPressOptions): SelectionToolbarLongPress {
  const caretSessionActive = ref(false)
  const clipboardHasText = ref(false)

  let generation = 0
  let sessionCleanup: (() => void) | null = null
  let contextMenuCleanup: (() => void) | null = null
  let selectionRefreshCleanup: (() => void) | null = null
  // The DOM caret the session was opened for; movement ends the session.
  let sessionAnchorNode: Node | null = null
  let sessionAnchorOffset = -1

  function getCollapsedEditorCaret(): { node: Node; offset: number } | null {
    const host = getEditorHost()
    const selection = document.getSelection()
    if (!host || !selection || selection.rangeCount === 0 || !selection.isCollapsed) {
      return null
    }

    const range = selection.getRangeAt(0)
    if (!host.contains(range.startContainer)) {
      return null
    }

    return { node: range.startContainer, offset: range.startOffset }
  }

  function hasEditorSelection(): boolean {
    const host = getEditorHost()
    const selection = document.getSelection()
    if (!host || !selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return false
    }

    const range = selection.getRangeAt(0)
    return host.contains(range.startContainer) && host.contains(range.endContainer)
  }

  async function refreshClipboardHasText() {
    const requestGeneration = generation
    let hasText: boolean
    try {
      hasText = await queryClipboardHasText()
    } catch {
      hasText = false
    }

    if (generation === requestGeneration) {
      clipboardHasText.value = hasText
    }
  }

  function installCaretSessionWatch() {
    removeCaretSessionWatch()

    const onPointerDown = (event: Event) => {
      // Taps on the floating toolbar belong to the session; anything else —
      // an ordinary tap, a caret move — ends it, matching the native
      // insertion menu.
      if (
        event.target instanceof Node &&
        event.target instanceof Element &&
        event.target.closest('[data-testid="mobile-selection-toolbar"]')
      ) {
        return
      }

      endCaretSession('pointer down')
    }

    const onSelectionChange = () => {
      if (!caretSessionActive.value) {
        return
      }

      if (hasEditorSelection()) {
        // The insertion handle was dragged into a selection: the existing
        // selection-driven display takes over seamlessly.
        endCaretSession('selection created')
        return
      }

      const caret = getCollapsedEditorCaret()
      if (
        !caret ||
        caret.node !== sessionAnchorNode ||
        caret.offset !== sessionAnchorOffset
      ) {
        // Ordinary caret movement (or the caret left the editor entirely).
        endCaretSession('caret moved')
      }
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('selectionchange', onSelectionChange)
    sessionCleanup = () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('selectionchange', onSelectionChange)
    }
  }

  function removeCaretSessionWatch() {
    sessionCleanup?.()
    sessionCleanup = null
  }

  async function enterFromContextRequest(source: string) {
    if (!isEditorReady() || !canActivate() || !getEditorHost()) {
      return
    }

    // The request is bound to the caret that existed at the long-press
    // itself, BEFORE the asynchronous clipboard query: anything that moves
    // the caret during the query (an ordinary tap, typing, arrow keys) came
    // from an ordinary interaction and must not open the toolbar.
    const entryCaret = getCollapsedEditorCaret()

    generation += 1
    const requestGeneration = generation
    await refreshClipboardHasText()
    // Every dismissal path (surfaces, edits, command runs, document
    // replacement) advances the generation and invalidates this request
    // even though the toolbar never became visible.
    if (generation !== requestGeneration || !isEditorReady() || !canActivate()) {
      return
    }

    // A non-collapsed selection is already handled by the selection-driven
    // display; the clipboard refresh above was all it needed.
    if (!entryCaret) {
      logger?.debug('selection toolbar clipboard state refreshed', {
        source,
        canPaste: clipboardHasText.value,
      })
      return
    }

    const caret = getCollapsedEditorCaret()
    if (!caret || caret.node !== entryCaret.node || caret.offset !== entryCaret.offset) {
      logger?.debug('selection toolbar caret session dropped: caret became stale', { source })
      return
    }

    sessionAnchorNode = caret.node
    sessionAnchorOffset = caret.offset
    installCaretSessionWatch()

    if (!caretSessionActive.value) {
      caretSessionActive.value = true
      logger?.debug('selection toolbar caret session entered', {
        source,
        canPaste: clipboardHasText.value,
      })
    }
  }

  function notifyCommandRun() {
    // Paste ends the caret interaction; select-all replaces it with a real
    // selection that the selection-driven display owns. Either way the caret
    // session itself is over. (Selection-driven copy/cut never involve it.)
    endCaretSession('command run')
  }

  function notifyDocumentEdited() {
    // Unconditional: an edit must also invalidate a context request whose
    // clipboard query is still pending, not just an already-visible session.
    endCaretSession('document edited')
  }

  function endCaretSession(reason: string) {
    // Also invalidates a context request whose clipboard query is still in
    // flight — dismissal applies before the toolbar ever becomes visible.
    generation += 1
    removeCaretSessionWatch()
    sessionAnchorNode = null
    sessionAnchorOffset = -1

    if (!caretSessionActive.value) {
      return
    }

    caretSessionActive.value = false
    logger?.debug('selection toolbar caret session ended', { reason })
  }

  function detachContextMenuFallback() {
    contextMenuCleanup?.()
    contextMenuCleanup = null
  }

  function attachContextMenuFallback() {
    detachContextMenuFallback()
    const host = getEditorHost()
    if (!host) {
      return
    }

    const onContextMenu = (event: Event) => {
      if (!isEditorReady() || !canActivate()) {
        return
      }

      event.preventDefault()
      void enterFromContextRequest('contextmenu')
    }

    host.addEventListener('contextmenu', onContextMenu)
    contextMenuCleanup = () => host.removeEventListener('contextmenu', onContextMenu)
  }

  // Without the native signal (web dev/e2e), a selection created by other
  // means still needs a truthful paste action: refresh the clipboard state
  // when a selection appears inside the editor.
  function installSelectionRefreshWatch() {
    removeSelectionRefreshWatch()

    let hadSelection = false
    const onSelectionChange = () => {
      const nowHasSelection = hasEditorSelection()
      if (nowHasSelection && !hadSelection) {
        void refreshClipboardHasText()
      }
      hadSelection = nowHasSelection
    }

    document.addEventListener('selectionchange', onSelectionChange)
    selectionRefreshCleanup = () => {
      document.removeEventListener('selectionchange', onSelectionChange)
    }
  }

  function removeSelectionRefreshWatch() {
    selectionRefreshCleanup?.()
    selectionRefreshCleanup = null
  }

  function resetForNewDocument() {
    generation += 1
    endCaretSession('document replaced')
    detachContextMenuFallback()
    removeSelectionRefreshWatch()
    clipboardHasText.value = false
  }

  function attachWebFallbacks() {
    installSelectionRefreshWatch()
    attachContextMenuFallback()
  }

  return {
    caretSessionActive,
    clipboardHasText,
    enterFromContextRequest,
    notifyCommandRun,
    notifyDocumentEdited,
    endCaretSession,
    attachWebFallbacks,
    resetForNewDocument,
  }
}
