import type { I18nKey } from '../../lib/i18n'

export type SelectionToolbarCommandId = 'copy' | 'cut' | 'paste' | 'selectAll'
export type SelectionToolbarIconName = 'copy' | 'cut' | 'paste' | 'selectAll'

export interface SelectionToolbarCommand {
  commandId: SelectionToolbarCommandId
  labelKey: I18nKey
  iconName: SelectionToolbarIconName
}

const CUT: SelectionToolbarCommand = {
  commandId: 'cut',
  labelKey: 'editor.selection.cut',
  iconName: 'cut',
}
const COPY: SelectionToolbarCommand = {
  commandId: 'copy',
  labelKey: 'editor.selection.copy',
  iconName: 'copy',
}
const PASTE: SelectionToolbarCommand = {
  commandId: 'paste',
  labelKey: 'editor.selection.paste',
  iconName: 'paste',
}
const SELECT_ALL: SelectionToolbarCommand = {
  commandId: 'selectAll',
  labelKey: 'editor.selection.selectAll',
  iconName: 'selectAll',
}

/**
 * The floating toolbar's action set, straight from the product state table:
 *
 *   editable + selection  → Cut, Copy, [Paste], Select all
 *   editable + caret      → [Paste], Select all
 *   read-only + selection → Copy, Select all
 *   read-only + caret     → Select all
 *
 * Paste appears only when the clipboard actually holds pasteable content.
 * Select all is always offered — including in an empty document.
 */
export function getSelectionToolbarCommands({
  hasSelection,
  canPaste,
  canWrite,
}: {
  hasSelection: boolean
  canPaste: boolean
  canWrite: boolean
}): SelectionToolbarCommand[] {
  const commands: SelectionToolbarCommand[] = []

  if (hasSelection && canWrite) {
    commands.push(CUT)
  }

  if (hasSelection) {
    commands.push(COPY)
  }

  if (canWrite && canPaste) {
    commands.push(PASTE)
  }

  commands.push(SELECT_ALL)
  return commands
}

export interface SelectionRect {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

export interface SelectionSnapshot {
  collapsed: boolean
  withinEditor: boolean
  text: string
  rect: SelectionRect | null
}

export function shouldShowSelectionToolbar(input: {
  editorReady: boolean
  suspended: boolean
  snapshot: SelectionSnapshot | null
  /** A long-press placed a caret: the toolbar shows for it too. */
  caretSession?: boolean
}): boolean {
  const { editorReady, suspended, snapshot, caretSession = false } = input
  if (!editorReady || suspended || !snapshot) {
    return false
  }

  if (!snapshot.withinEditor || snapshot.rect === null) {
    return false
  }

  // A long-press caret session shows the toolbar at the collapsed caret —
  // including in an empty document (paste / select-all need no text).
  if (snapshot.collapsed) {
    return caretSession
  }

  // A selection without visible text (an empty block or the quick-insert
  // placeholder hint) has nothing for copy/cut/select-all to operate on.
  return snapshot.text.trim().length > 0
}

export interface SelectionToolbarBox {
  width: number
  height: number
}

export interface SelectionToolbarPlacement {
  left: number
  top: number
  placement: 'above' | 'below'
}

const SELECTION_TOOLBAR_VIEWPORT_MARGIN = 8
const SELECTION_TOOLBAR_SELECTION_GAP = 10

export function computeSelectionToolbarPlacement(
  rect: SelectionRect,
  toolbar: SelectionToolbarBox,
  viewport: { width: number; height: number },
): SelectionToolbarPlacement {
  const margin = SELECTION_TOOLBAR_VIEWPORT_MARGIN
  const gap = SELECTION_TOOLBAR_SELECTION_GAP

  const centerX = (rect.left + rect.right) / 2
  const maxLeft = Math.max(margin, viewport.width - margin - toolbar.width)
  const left = clamp(centerX - toolbar.width / 2, margin, maxLeft)

  const aboveTop = rect.top - gap - toolbar.height
  if (aboveTop >= margin) {
    return { left, top: aboveTop, placement: 'above' }
  }

  const belowTop = rect.bottom + gap
  const maxTop = Math.max(margin, viewport.height - margin - toolbar.height)
  if (belowTop <= maxTop) {
    return { left, top: belowTop, placement: 'below' }
  }

  // The selection covers essentially the whole viewport (for example after
  // select-all): keep the toolbar visible at the top instead of overlapping
  // the selection midpoint or drifting off screen.
  return { left, top: margin, placement: 'above' }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

// ---- custom command paging ----
//
// Users pick the custom command LIST; the device owns the layout math. A
// page's capacity comes from the live viewport, and commands that do not fit
// PAGE instead of being trimmed — configuration must always match what is
// visible. Slot geometry mirrors the rendered buttons (44px + 3px gap); the
// budget stays inside the placement margins so a full page can never push
// the bar past the viewport clamp.
const SELECTION_SLOT_WIDTH = 47
const SELECTION_BAR_CHROME = 10
const SELECTION_WIDTH_BUDGET_RATIO = 0.85

export function computeSelectionToolbarPageCapacity(viewportWidth: number) {
  const budget = Math.min(
    viewportWidth * SELECTION_WIDTH_BUDGET_RATIO,
    viewportWidth - 2 * SELECTION_TOOLBAR_VIEWPORT_MARGIN,
  )

  return Math.max(1, Math.floor((budget - SELECTION_BAR_CHROME) / SELECTION_SLOT_WIDTH))
}

// Pages reserve slots only for the arrows they actually RENDER: an
// inapplicable arrow is hidden (not disabled — a grayed arrow reads as
// "there is more"), and its slot goes back to a command. `leadingBackArrow`
// marks pages that always carry a back arrow regardless of position — the
// single-row layout's custom pages, whose back arrow returns to the
// clipboard segment.
export function paginateSelectionCommands<T>(
  commands: readonly T[],
  capacity: number,
  { leadingBackArrow }: { leadingBackArrow: boolean },
): T[][] {
  const cap = Math.max(1, Math.floor(capacity))
  const pages: T[][] = []
  let index = 0

  while (index < commands.length) {
    const backSlots = leadingBackArrow || pages.length > 0 ? 1 : 0
    // Assume this page is the last; if the remainder does not fit, one slot
    // goes to the forward arrow instead.
    let size = Math.max(1, cap - backSlots)
    if (commands.length - index > size) {
      size = Math.max(1, cap - backSlots - 1)
    }

    pages.push(commands.slice(index, index + size))
    index += size
  }

  return pages
}

export function caretRangeAtPoint(x: number, y: number): Range | null {
  if (typeof document === 'undefined') {
    return null
  }

  const documentWithCaret = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
  }

  const range = documentWithCaret.caretRangeFromPoint?.(x, y)
  if (range) {
    return range
  }

  const position = documentWithCaret.caretPositionFromPoint?.(x, y)
  if (position) {
    const fallback = document.createRange()
    fallback.setStart(position.offsetNode, position.offset)
    fallback.collapse(true)
    return fallback
  }

  return null
}

export function getDomSelectionSnapshot(host: HTMLElement | null): SelectionSnapshot | null {
  if (!host || typeof document === 'undefined') {
    return null
  }

  const selection = document.getSelection()
  if (!selection || selection.rangeCount === 0) {
    return null
  }

  const range = selection.getRangeAt(0)
  const withinEditor =
    host.contains(range.startContainer) && host.contains(range.endContainer)
  const rect = range.getBoundingClientRect()
  const hasVisibleRect = rect.width > 0 || rect.height > 0

  // A collapsed caret in an empty block reports an all-zero range rect;
  // anchor the toolbar to the caret's block element instead so a long-press
  // in an empty document still has a placement target.
  if (!hasVisibleRect && selection.isCollapsed && withinEditor) {
    const node = range.startContainer
    const element = node instanceof Element ? node : node.parentElement
    const elementRect = element?.getBoundingClientRect()
    if (elementRect && (elementRect.width > 0 || elementRect.height > 0)) {
      return {
        collapsed: true,
        withinEditor,
        text: '',
        rect: {
          left: elementRect.left,
          top: elementRect.top,
          right: elementRect.left,
          bottom: elementRect.bottom,
          width: 0,
          height: elementRect.height,
        },
      }
    }
  }

  return {
    collapsed: selection.isCollapsed,
    withinEditor,
    text: selection.toString(),
    rect: hasVisibleRect
      ? {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        }
    : null,
  }
}

export function captureNonCollapsedSelectionRange(host: HTMLElement | null): Range | null {
  if (!host || typeof document === 'undefined') {
    return null
  }

  const selection = document.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null
  }

  const range = selection.getRangeAt(0)
  if (!host.contains(range.startContainer) || !host.contains(range.endContainer)) {
    return null
  }

  if (selection.toString().trim().length === 0) {
    return null
  }

  return range.cloneRange()
}
