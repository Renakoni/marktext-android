import { describe, expect, it, vi } from 'vitest'
import {
  resolveTableContext,
  runTableCommand,
  TABLE_COMMAND_IDS,
  type TableCommandId,
} from './tableCommands'
import type { MuyaEditor } from './editorRuntime'

interface FakeTreeOptions {
  rowOffset?: number
  columnOffset?: number
  rowCount?: number
  columnCount?: number
  /** Break the climb by renaming one link in the chain. */
  breakAt?: 'content' | 'cell' | 'row' | 'inner' | 'table'
  /** Simulate a removed table: internal links intact, no scroll-page parent. */
  detached?: boolean
  /** Have every remove* engine call report no survivor. */
  survivorless?: boolean
  outsideContent?: boolean
  /** The scroll page reports zero children after the mutation. */
  pageEmptyAfter?: boolean
  /** cellAt cannot resolve the freshly inserted cell. */
  cellAtMisses?: boolean
}

function fakeCaret() {
  return { setCursor: vi.fn() }
}

function createFakeEditor({
  rowOffset = 1,
  columnOffset = 1,
  rowCount = 3,
  columnCount = 3,
  breakAt,
  detached = false,
  survivorless = false,
  outsideContent = true,
  pageEmptyAfter = false,
  cellAtMisses = false,
}: FakeTreeOptions = {}) {
  const insertedCaret = fakeCaret()
  const survivorCaret = fakeCaret()
  const outsideCaret = fakeCaret()
  const bodyCellCaret = fakeCaret()
  const recoveredCaret = fakeCaret()

  const scrollPage = {
    blockName: 'scrollpage',
    length: vi.fn(() => (pageEmptyAfter ? 0 : 1)),
    resetToSingleEmptyParagraph: vi.fn(() => recoveredCaret),
  }
  const table = {
    blockName: breakAt === 'table' ? 'paragraph' : 'table',
    // Attached tables hang off the scroll page; a removed one has null.
    parent: detached ? null : scrollPage,
    rowCount,
    columnCount,
    offset: vi.fn(),
    insertRow: vi.fn(() => insertedCaret),
    insertColumn: vi.fn(() => insertedCaret),
    removeRow: vi.fn(() => (survivorless ? null : survivorCaret)),
    removeColumn: vi.fn(() => (survivorless ? null : survivorCaret)),
    remove: vi.fn(),
    cellAt: vi.fn(() => (cellAtMisses ? null : { firstChild: bodyCellCaret })),
    outsideContentInContext: vi.fn(() => (outsideContent ? outsideCaret : null)),
  }
  const inner = {
    blockName: breakAt === 'inner' ? 'paragraph' : 'table.inner',
    parent: table,
    offset: vi.fn(() => rowOffset),
  }
  const row = {
    blockName: breakAt === 'row' ? 'paragraph' : 'table.row',
    parent: inner,
    offset: vi.fn(() => columnOffset),
  }
  const cell = {
    blockName: breakAt === 'cell' ? 'paragraph' : 'table.cell',
    parent: row,
    offset: vi.fn(),
  }
  const content = {
    blockName: breakAt === 'content' ? 'paragraph.content' : 'table.cell.content',
    parent: cell,
    offset: vi.fn(),
  }

  const history = { cutoff: vi.fn() }
  const jsonState = { flush: vi.fn() }
  const editor = {
    editor: { activeContentBlock: content, history, jsonState, scrollPage },
  } as unknown as MuyaEditor

  return {
    editor,
    table,
    scrollPage,
    history,
    jsonState,
    insertedCaret,
    survivorCaret,
    outsideCaret,
    bodyCellCaret,
    recoveredCaret,
  }
}

describe('resolveTableContext', () => {
  it('resolves the table and both offsets from the caret cell', () => {
    const { editor, table } = createFakeEditor({ rowOffset: 2, columnOffset: 1 })

    const context = resolveTableContext(editor)

    expect(context).not.toBeNull()
    expect(context!.table).toBe(table as never)
    expect(context!.rowOffset).toBe(2)
    expect(context!.columnOffset).toBe(1)
    expect(context!.rowCount).toBe(3)
    expect(context!.columnCount).toBe(3)
  })

  it('returns null without an editor or outside a table cell', () => {
    expect(resolveTableContext(null)).toBeNull()
    expect(resolveTableContext(createFakeEditor({ breakAt: 'content' }).editor)).toBeNull()
  })

  it.each(['cell', 'row', 'inner', 'table'] as const)(
    'returns null when the %s link of the climb is not a table block',
    breakAt => {
      expect(resolveTableContext(createFakeEditor({ breakAt }).editor)).toBeNull()
    },
  )

  it('returns null when the caret block sits in a detached (removed) table', () => {
    // After a whole-table removal the active content block can still point
    // into the detached subtree, whose internal parent links stay intact —
    // only an attached table owns the caret.
    expect(resolveTableContext(createFakeEditor({ detached: true }).editor)).toBeNull()
  })
})

describe('runTableCommand', () => {
  const ENGINE_CALLS: [TableCommandId, (t: ReturnType<typeof createFakeEditor>) => void][] = [
    [
      'table-insert-row-above',
      ({ table }) => expect(table.insertRow).toHaveBeenCalledWith(1),
    ],
    [
      'table-insert-row-below',
      ({ table }) => expect(table.insertRow).toHaveBeenCalledWith(2),
    ],
    [
      'table-insert-column-left',
      ({ table }) => expect(table.insertColumn).toHaveBeenCalledWith(1),
    ],
    [
      'table-insert-column-right',
      ({ table }) => expect(table.insertColumn).toHaveBeenCalledWith(2),
    ],
    ['table-delete-row', ({ table }) => expect(table.removeRow).toHaveBeenCalledWith(1)],
    [
      'table-delete-column',
      ({ table }) => expect(table.removeColumn).toHaveBeenCalledWith(1),
    ],
    ['table-delete-table', ({ table }) => expect(table.remove).toHaveBeenCalledTimes(1)],
  ]

  it.each(ENGINE_CALLS)('%s drives the engine with caret-relative offsets', (id, verify) => {
    const harness = createFakeEditor({ rowOffset: 1, columnOffset: 1 })

    expect(runTableCommand(harness.editor, id)).toBe(true)
    verify(harness)
  })

  it('places the caret on the inserted cell and bounds the undo step', () => {
    const harness = createFakeEditor()

    runTableCommand(harness.editor, 'table-insert-row-below')

    expect(harness.insertedCaret.setCursor).toHaveBeenCalledWith(0, 0, true)
    // cutoff -> mutate -> flush -> cutoff: one undo step per tap, pinned
    // engine-side in Muya's search.spec undo-boundary contract.
    expect(harness.history.cutoff).toHaveBeenCalledTimes(2)
    expect(harness.jsonState.flush).toHaveBeenCalledTimes(1)
    const flushOrder = harness.jsonState.flush.mock.invocationCallOrder[0]
    const [firstCut, secondCut] = harness.history.cutoff.mock.invocationCallOrder
    expect(firstCut).toBeLessThan(flushOrder)
    expect(secondCut).toBeGreaterThan(flushOrder)
  })

  it('places the caret on the survivor after a delete', () => {
    const harness = createFakeEditor()

    runTableCommand(harness.editor, 'table-delete-row')

    expect(harness.survivorCaret.setCursor).toHaveBeenCalledWith(0, 0, true)
  })

  it('keeps the caret in the originating row after a column insert', () => {
    const harness = createFakeEditor({ rowOffset: 2, columnOffset: 1 })

    runTableCommand(harness.editor, 'table-insert-column-right')

    // The engine returns the new column's header-row cell; the caret must
    // resolve through cellAt(caret row, new column) instead.
    expect(harness.table.cellAt).toHaveBeenCalledWith(2, 2)
    expect(harness.bodyCellCaret.setCursor).toHaveBeenCalledWith(0, 0, true)
    expect(harness.insertedCaret.setCursor).not.toHaveBeenCalled()
  })

  it('falls back to the engine-returned cell when cellAt cannot resolve one', () => {
    const harness = createFakeEditor({ cellAtMisses: true })

    runTableCommand(harness.editor, 'table-insert-column-left')

    expect(harness.insertedCaret.setCursor).toHaveBeenCalledWith(0, 0, true)
  })

  it('restores the one-empty-paragraph invariant when a removal empties the page', () => {
    for (const id of [
      'table-delete-row',
      'table-delete-column',
      'table-delete-table',
    ] as const) {
      const harness = createFakeEditor({
        survivorless: true,
        outsideContent: false,
        pageEmptyAfter: true,
      })

      expect(runTableCommand(harness.editor, id)).toBe(true)
      expect(harness.scrollPage.resetToSingleEmptyParagraph).toHaveBeenCalledTimes(1)
      expect(harness.recoveredCaret.setCursor).toHaveBeenCalledWith(0, 0, true)
    }
  })

  it('leaves a non-empty page alone when the delete has no survivor', () => {
    const harness = createFakeEditor({
      survivorless: true,
      outsideContent: false,
      pageEmptyAfter: false,
    })

    expect(runTableCommand(harness.editor, 'table-delete-row')).toBe(true)
    expect(harness.scrollPage.resetToSingleEmptyParagraph).not.toHaveBeenCalled()
    expect(harness.jsonState.flush).toHaveBeenCalledTimes(1)
  })

  it('moves the caret outside before removing the whole table', () => {
    const harness = createFakeEditor()

    runTableCommand(harness.editor, 'table-delete-table')

    expect(harness.outsideCaret.setCursor).toHaveBeenCalledWith(0, 0, true)
    const captureOrder = harness.table.outsideContentInContext.mock.invocationCallOrder[0]
    const removeOrder = harness.table.remove.mock.invocationCallOrder[0]
    expect(captureOrder).toBeLessThan(removeOrder)
  })

  it('is a guarded no-op outside a table: no history boundary is cut', () => {
    const outside = createFakeEditor({ breakAt: 'content' })

    for (const id of TABLE_COMMAND_IDS) {
      expect(runTableCommand(outside.editor, id)).toBe(false)
    }
    expect(runTableCommand(null, 'table-delete-row')).toBe(false)
    expect(outside.history.cutoff).not.toHaveBeenCalled()
    expect(outside.jsonState.flush).not.toHaveBeenCalled()
  })
})
