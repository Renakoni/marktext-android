import type { I18nKey } from '../../lib/i18n'

export type SelectionToolbarCommandId = 'copy' | 'cut' | 'paste' | 'selectAll'
export type SelectionToolbarIconName = 'copy' | 'cut' | 'paste' | 'selectAll'

export interface SelectionToolbarCommand {
  commandId: SelectionToolbarCommandId
  labelKey: I18nKey
  iconName: SelectionToolbarIconName
}

export const SELECTION_TOOLBAR_COMMANDS: readonly SelectionToolbarCommand[] = [
  { commandId: 'copy', labelKey: 'editor.selection.copy', iconName: 'copy' },
  { commandId: 'cut', labelKey: 'editor.selection.cut', iconName: 'cut' },
  { commandId: 'paste', labelKey: 'editor.selection.paste', iconName: 'paste' },
  { commandId: 'selectAll', labelKey: 'editor.selection.selectAll', iconName: 'selectAll' },
]

export function getSelectionToolbarCommands(canPaste: boolean) {
  return canPaste
    ? SELECTION_TOOLBAR_COMMANDS
    : SELECTION_TOOLBAR_COMMANDS.filter(command => command.commandId !== 'paste')
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
}): boolean {
  const { editorReady, suspended, snapshot } = input
  if (!editorReady || suspended || !snapshot) {
    return false
  }

  // A selection without visible text (an empty block or the quick-insert
  // placeholder hint) has nothing for copy/cut/select-all to operate on.
  return (
    !snapshot.collapsed &&
    snapshot.withinEditor &&
    snapshot.rect !== null &&
    snapshot.text.trim().length > 0
  )
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
