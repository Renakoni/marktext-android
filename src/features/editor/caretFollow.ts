// Keeps the caret visible after Muya-driven edits (Enter, undo/redo, toolbar
// commands). The WebView scrolls the caret into view on its own only for
// native contenteditable input; structural edits rebuild DOM and re-apply the
// selection programmatically, which never triggers that native follow, so a
// caret at the bottom edge silently leaves the viewport. Muya deliberately
// leaves scroll-follow to its shell — its `selection-change` event carries a
// viewport-relative caret rect (`cursorCoords`) for exactly this purpose, and
// desktop MarkText implements the same follow there (upstream #628/#3329).
//
// Android constraints this module adds over the desktop handler:
// - container-relative math (the scroll container sits below the app header);
// - collapsed carets only, so native selection-handle drags are untouched;
// - only while the editor owns focus, so editor init and resume-position
//   restores never fight over scrollTop;
// - margins clamped for short viewports (landscape plus soft keyboard).

interface CaretFollowEditor {
  domNode: HTMLElement
}

interface CaretFollowLogger {
  debug(message: string, context?: Record<string, unknown>): void
}

export interface CreateCaretFollowOptions {
  getEditor: () => CaretFollowEditor | null
  logger?: CaretFollowLogger
}

// Desktop keeps the caret at least 100px clear of the container edges.
const CARET_FOLLOW_MARGIN_PX = 100

export interface CaretFollowInput {
  caretTop: number
  caretBottom: number
  containerTop: number
  containerHeight: number
}

/**
 * How far the container must scroll (positive = down) so the caret sits inside
 * the comfortable band. Zero when the caret is already within it.
 */
export function computeCaretFollowScrollDelta({
  caretTop,
  caretBottom,
  containerTop,
  containerHeight,
}: CaretFollowInput): number {
  if (containerHeight <= 0) {
    return 0
  }

  // On a short visible area (landscape with the soft keyboard up) the fixed
  // desktop margins would overlap; keep the band at least half the viewport.
  const margin = Math.min(CARET_FOLLOW_MARGIN_PX, Math.floor(containerHeight / 4))
  const top = caretTop - containerTop
  const bottom = caretBottom - containerTop

  if (bottom > containerHeight - margin) {
    return bottom - (containerHeight - margin)
  }

  if (top < margin) {
    return top - margin
  }

  return 0
}

// Muya's `cursorCoords` is null when a collapsed caret has no client rect
// (empty paragraph text nodes) — recover the rect the way the desktop shell
// does, by falling back to the caret's nearest element.
function readCaretRect(): { top: number; bottom: number } | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) {
    return null
  }

  const range = selection.getRangeAt(0).cloneRange()
  let rects: DOMRectList | null = range.getClientRects()
  if (rects.length === 0) {
    const node = range.startContainer
    const element = node instanceof Element ? node : node.parentElement
    rects = element ? element.getClientRects() : null
  }

  if (!rects || rects.length === 0) {
    return null
  }

  const rect = rects[rects.length - 1]
  return { top: rect.top, bottom: rect.bottom }
}

interface SelectionChangePayload {
  isCollapsed?: boolean
  cursorCoords?: { top: number; bottom: number } | null
}

export function createCaretFollow(options: CreateCaretFollowOptions) {
  function onEditorSelectionChange(...args: unknown[]) {
    const editor = options.getEditor()
    const container = editor?.domNode.parentElement
    if (!editor || !container) {
      return
    }

    const active = document.activeElement
    if (!(active instanceof HTMLElement) || !editor.domNode.contains(active)) {
      return
    }

    const payload = args[0] as SelectionChangePayload | undefined
    if (payload?.isCollapsed !== true) {
      return
    }

    const rect = payload.cursorCoords ?? readCaretRect()
    if (!rect) {
      return
    }

    const delta = computeCaretFollowScrollDelta({
      caretTop: rect.top,
      caretBottom: rect.bottom,
      containerTop: container.getBoundingClientRect().top,
      containerHeight: container.clientHeight,
    })

    if (delta !== 0) {
      container.scrollTop += delta
      options.logger?.debug('caret follow scrolled', { delta })
    }
  }

  return { onEditorSelectionChange }
}
