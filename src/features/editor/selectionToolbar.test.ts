import { describe, expect, it } from 'vitest'
import {
  computeSelectionToolbarPlacement,
  getSelectionToolbarCommands,
  shouldShowSelectionToolbar,
  type SelectionRect,
} from './selectionToolbar'

const VIEWPORT = { width: 400, height: 800 }
const TOOLBAR = { width: 240, height: 50 }

function createRect(overrides: Partial<SelectionRect> = {}): SelectionRect {
  return {
    left: 100,
    top: 300,
    right: 220,
    bottom: 320,
    width: 120,
    height: 20,
    ...overrides,
  }
}

function commandIds(input: { hasSelection: boolean; canPaste: boolean; canWrite: boolean }) {
  return getSelectionToolbarCommands(input).map(command => command.commandId)
}

describe('selection toolbar commands', () => {
  it('matches the product state table row by row', () => {
    // Editable, no selection, clipboard has pasteable content.
    expect(commandIds({ hasSelection: false, canPaste: true, canWrite: true })).toEqual([
      'paste',
      'selectAll',
    ])
    // Editable, no selection, clipboard empty.
    expect(commandIds({ hasSelection: false, canPaste: false, canWrite: true })).toEqual([
      'selectAll',
    ])
    // Editable, selection, clipboard has pasteable content.
    expect(commandIds({ hasSelection: true, canPaste: true, canWrite: true })).toEqual([
      'cut',
      'copy',
      'paste',
      'selectAll',
    ])
    // Editable, selection, clipboard empty.
    expect(commandIds({ hasSelection: true, canPaste: false, canWrite: true })).toEqual([
      'cut',
      'copy',
      'selectAll',
    ])
    // Read-only with selection: no cut, no paste even with clipboard content.
    expect(commandIds({ hasSelection: true, canPaste: true, canWrite: false })).toEqual([
      'copy',
      'selectAll',
    ])
    // Read-only without a selection.
    expect(commandIds({ hasSelection: false, canPaste: true, canWrite: false })).toEqual([
      'selectAll',
    ])
  })

  it('keeps select all available in every state', () => {
    for (const hasSelection of [true, false]) {
      for (const canPaste of [true, false]) {
        for (const canWrite of [true, false]) {
          expect(commandIds({ hasSelection, canPaste, canWrite })).toContain('selectAll')
        }
      }
    }
  })
})

describe('selection toolbar visibility', () => {
  const visibleSnapshot = {
    collapsed: false,
    withinEditor: true,
    text: 'Select this paragraph',
    rect: createRect(),
  }

  it('shows only for a non-collapsed selection inside the editor', () => {
    expect(
      shouldShowSelectionToolbar({
        editorReady: true,
        suspended: false,
        snapshot: visibleSnapshot,
      }),
    ).toBe(true)
  })

  it('hides when the editor is not ready or a sheet is open', () => {
    expect(
      shouldShowSelectionToolbar({
        editorReady: false,
        suspended: false,
        snapshot: visibleSnapshot,
      }),
    ).toBe(false)
    expect(
      shouldShowSelectionToolbar({
        editorReady: true,
        suspended: true,
        snapshot: visibleSnapshot,
      }),
    ).toBe(false)
  })

  it('hides for selections without visible text, like an empty block or the placeholder hint', () => {
    expect(
      shouldShowSelectionToolbar({
        editorReady: true,
        suspended: false,
        snapshot: { ...visibleSnapshot, text: '' },
      }),
    ).toBe(false)
    expect(
      shouldShowSelectionToolbar({
        editorReady: true,
        suspended: false,
        snapshot: { ...visibleSnapshot, text: '  \n  ' },
      }),
    ).toBe(false)
  })

  it('hides for collapsed, outside-editor, or missing selections', () => {
    expect(
      shouldShowSelectionToolbar({
        editorReady: true,
        suspended: false,
        snapshot: null,
      }),
    ).toBe(false)
    expect(
      shouldShowSelectionToolbar({
        editorReady: true,
        suspended: false,
        snapshot: { ...visibleSnapshot, collapsed: true },
      }),
    ).toBe(false)
    expect(
      shouldShowSelectionToolbar({
        editorReady: true,
        suspended: false,
        snapshot: { ...visibleSnapshot, withinEditor: false },
      }),
    ).toBe(false)
    expect(
      shouldShowSelectionToolbar({
        editorReady: true,
        suspended: false,
        snapshot: { ...visibleSnapshot, rect: null },
      }),
    ).toBe(false)
  })

  it('shows a collapsed caret only during a long-press session', () => {
    const caretSnapshot = { ...visibleSnapshot, collapsed: true, text: '' }

    // Ordinary caret placement never opens the toolbar...
    expect(
      shouldShowSelectionToolbar({
        editorReady: true,
        suspended: false,
        snapshot: caretSnapshot,
      }),
    ).toBe(false)

    // ...a long-press caret session does — including with empty text
    // (empty document), as long as a placement rect exists.
    expect(
      shouldShowSelectionToolbar({
        editorReady: true,
        suspended: false,
        snapshot: caretSnapshot,
        caretSession: true,
      }),
    ).toBe(true)

    // The session never overrides suspension, editor readiness, or bounds.
    expect(
      shouldShowSelectionToolbar({
        editorReady: true,
        suspended: true,
        snapshot: caretSnapshot,
        caretSession: true,
      }),
    ).toBe(false)
    expect(
      shouldShowSelectionToolbar({
        editorReady: true,
        suspended: false,
        snapshot: { ...caretSnapshot, withinEditor: false },
        caretSession: true,
      }),
    ).toBe(false)
    expect(
      shouldShowSelectionToolbar({
        editorReady: true,
        suspended: false,
        snapshot: { ...caretSnapshot, rect: null },
        caretSession: true,
      }),
    ).toBe(false)
  })
})

describe('selection toolbar placement', () => {
  it('centers above the selection when there is room', () => {
    const placed = computeSelectionToolbarPlacement(createRect(), TOOLBAR, VIEWPORT)

    expect(placed.placement).toBe('above')
    expect(placed.top).toBe(300 - 10 - TOOLBAR.height)
    expect(placed.left).toBe((100 + 220) / 2 - TOOLBAR.width / 2)
  })

  it('flips below the selection near the top of the viewport', () => {
    const placed = computeSelectionToolbarPlacement(
      createRect({ top: 20, bottom: 40 }),
      TOOLBAR,
      VIEWPORT,
    )

    expect(placed.placement).toBe('below')
    expect(placed.top).toBe(40 + 10)
  })

  it('clamps horizontally inside the viewport margins', () => {
    const nearLeft = computeSelectionToolbarPlacement(
      createRect({ left: 0, right: 10 }),
      TOOLBAR,
      VIEWPORT,
    )
    const nearRight = computeSelectionToolbarPlacement(
      createRect({ left: 390, right: 400 }),
      TOOLBAR,
      VIEWPORT,
    )

    expect(nearLeft.left).toBe(8)
    expect(nearRight.left).toBe(VIEWPORT.width - 8 - TOOLBAR.width)
  })

  it('pins to the top margin when the selection fills the viewport', () => {
    const placed = computeSelectionToolbarPlacement(
      createRect({ top: 0, bottom: 800 }),
      TOOLBAR,
      VIEWPORT,
    )

    expect(placed.placement).toBe('above')
    expect(placed.top).toBe(8)
  })
})
