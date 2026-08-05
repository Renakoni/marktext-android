import type { MuyaEditor } from './editorRuntime'

/**
 * The seven v1 table-structure commands (issue #144). Column alignment is
 * deliberately out of scope.
 */
export const TABLE_COMMAND_IDS = [
  'table-insert-row-above',
  'table-insert-row-below',
  'table-insert-column-left',
  'table-insert-column-right',
  'table-delete-row',
  'table-delete-column',
  'table-delete-table',
] as const

export type TableCommandId = (typeof TABLE_COMMAND_IDS)[number]

// Narrow structural views of the Muya block tree — just enough for the
// caret climb and the seven mutations. The full block classes stay out of
// the app's type surface on purpose.
interface TableTreeNode {
  readonly blockName: string
  readonly parent: TableTreeNode | null
  offset(child: TableTreeNode): number
}

interface TableCaretContent extends TableTreeNode {
  setCursor(begin: number, end: number, needUpdate?: boolean): void
}

interface MuyaTableBlock extends TableTreeNode {
  readonly rowCount: number
  readonly columnCount: number
  insertRow(offset: number): TableCaretContent
  insertColumn(offset: number, align?: string): TableCaretContent
  removeRow(offset: number): TableCaretContent | null | undefined
  removeColumn(offset: number): TableCaretContent | null | undefined
  remove(): void
  nextContentInContext(): TableCaretContent | null | undefined
  previousContentInContext(): TableCaretContent | null | undefined
}

export interface TableContext {
  table: MuyaTableBlock
  /** Zero-based; row 0 is the GFM header row. */
  rowOffset: number
  columnOffset: number
  rowCount: number
  columnCount: number
}

/**
 * Resolves the table the caret currently sits in, or null. The climb is
 * verified block-name by block-name (content → cell → row → inner → table)
 * so a partially detached tree can never yield a bogus context.
 */
export function resolveTableContext(editor: MuyaEditor | null): TableContext | null {
  const content = (editor?.editor.activeContentBlock ?? null) as TableTreeNode | null
  if (!content || content.blockName !== 'table.cell.content') {
    return null
  }

  const cell = content.parent
  const row = cell?.parent ?? null
  const inner = row?.parent ?? null
  const table = inner?.parent ?? null
  if (
    cell?.blockName !== 'table.cell' ||
    row?.blockName !== 'table.row' ||
    inner?.blockName !== 'table.inner' ||
    table?.blockName !== 'table'
  ) {
    return null
  }

  const tableBlock = table as MuyaTableBlock
  return {
    table: tableBlock,
    rowOffset: inner.offset(row),
    columnOffset: row.offset(cell),
    rowCount: tableBlock.rowCount,
    columnCount: tableBlock.columnCount,
  }
}

/**
 * Runs one structure command against the table the caret is in. Returns
 * false when the caret is not in a table (the command is a no-op then).
 *
 * Every command is exactly one undo step: the history coalesces by time
 * window, so it is boundary-cut on both sides of the synchronous dispatch
 * (the same contract the find-bar replace pins in Muya's search.spec).
 * Every command leaves the caret on a surviving cell — or, when the whole
 * table goes away, on the neighbouring content block the engine captures
 * before detaching (never inside removed DOM).
 */
export function runTableCommand(editor: MuyaEditor | null, commandId: TableCommandId): boolean {
  const context = resolveTableContext(editor)
  if (!editor || !context) {
    return false
  }

  const { table, rowOffset, columnOffset } = context
  const inner = editor.editor

  inner.history.cutoff()
  let caret: TableCaretContent | null | undefined
  switch (commandId) {
    case 'table-insert-row-above':
      // Row 0 is the GFM header; inserting above it makes the new blank
      // row the header (engine semantics, matched by the desktop menus).
      caret = table.insertRow(rowOffset)
      break
    case 'table-insert-row-below':
      caret = table.insertRow(rowOffset + 1)
      break
    case 'table-insert-column-left':
      caret = table.insertColumn(columnOffset)
      break
    case 'table-insert-column-right':
      caret = table.insertColumn(columnOffset + 1)
      break
    case 'table-delete-row':
      caret = table.removeRow(rowOffset)
      break
    case 'table-delete-column':
      caret = table.removeColumn(columnOffset)
      break
    case 'table-delete-table':
      // Same pattern as the engine's own whole-table removals: capture the
      // outside neighbour BEFORE detaching so the caret never lands in a
      // removed subtree.
      caret = table.nextContentInContext() ?? table.previousContentInContext()
      table.remove()
      break
  }

  caret?.setCursor(0, 0, true)
  inner.jsonState.flush()
  inner.history.cutoff()
  return true
}
