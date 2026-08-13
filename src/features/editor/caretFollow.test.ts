// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest'
import { computeCaretFollowScrollDelta, createCaretFollow } from './caretFollow'

describe('computeCaretFollowScrollDelta', () => {
  const CONTAINER = { containerTop: 80, containerHeight: 400 }

  it('returns 0 when the caret sits inside the comfortable band', () => {
    expect(
      computeCaretFollowScrollDelta({ caretTop: 280, caretBottom: 300, ...CONTAINER }),
    ).toBe(0)
  })

  it('scrolls down when the caret drops into the bottom margin', () => {
    // Caret bottom 20px above the container bottom edge (band ends at 300).
    expect(
      computeCaretFollowScrollDelta({ caretTop: 440, caretBottom: 460, ...CONTAINER }),
    ).toBe(80)
  })

  it('scrolls down when the caret is fully below the container', () => {
    expect(
      computeCaretFollowScrollDelta({ caretTop: 520, caretBottom: 540, ...CONTAINER }),
    ).toBe(160)
  })

  it('scrolls up when the caret rises into the top margin', () => {
    // Caret top 40px below the container top edge (band starts at 100).
    expect(
      computeCaretFollowScrollDelta({ caretTop: 120, caretBottom: 140, ...CONTAINER }),
    ).toBe(-60)
  })

  it('scrolls up when the caret is fully above the container', () => {
    expect(
      computeCaretFollowScrollDelta({ caretTop: 0, caretBottom: 20, ...CONTAINER }),
    ).toBe(-180)
  })

  it('clamps the margin on short viewports so the band never collapses', () => {
    // 160px visible height (landscape + keyboard): margin becomes 40, not 100.
    expect(
      computeCaretFollowScrollDelta({
        caretTop: 80,
        caretBottom: 96,
        containerTop: 0,
        containerHeight: 160,
      }),
    ).toBe(0)
    expect(
      computeCaretFollowScrollDelta({
        caretTop: 130,
        caretBottom: 150,
        containerTop: 0,
        containerHeight: 160,
      }),
    ).toBe(30)
  })

  it('ignores a container that has no height yet', () => {
    expect(
      computeCaretFollowScrollDelta({
        caretTop: 10,
        caretBottom: 20,
        containerTop: 0,
        containerHeight: 0,
      }),
    ).toBe(0)
  })
})

function buildEditorDom() {
  const container = document.createElement('div')
  const editorRoot = document.createElement('div')
  const focusable = document.createElement('div')
  focusable.tabIndex = -1
  editorRoot.appendChild(focusable)
  container.appendChild(editorRoot)
  document.body.appendChild(container)

  container.getBoundingClientRect = () =>
    ({ top: 0, bottom: 400, left: 0, right: 360, width: 360, height: 400 }) as DOMRect
  Object.defineProperty(container, 'clientHeight', { value: 400 })
  container.scrollBy = vi.fn(options => {
    const top = typeof options === 'object' ? options.top ?? 0 : 0
    container.scrollTop += top
  })

  return { container, editorRoot, focusable }
}

describe('createCaretFollow', () => {
  it('scrolls the editor parent when a collapsed caret leaves the visible band', () => {
    const { container, editorRoot, focusable } = buildEditorDom()
    focusable.focus()

    const follow = createCaretFollow({ getEditor: () => ({ domNode: editorRoot }) })
    follow.onEditorSelectionChange({
      isCollapsed: true,
      cursorCoords: { top: 380, bottom: 396 },
    })

    expect(container.scrollTop).toBe(96)
    container.remove()
  })

  it('does not move a pointer-placed caret that is already visible near an edge', () => {
    const { container, editorRoot, focusable } = buildEditorDom()
    focusable.focus()

    const follow = createCaretFollow({ getEditor: () => ({ domNode: editorRoot }) })
    follow.onEditorSelectionChange({
      source: 'user-pointer',
      isCollapsed: true,
      cursorCoords: { top: 380, bottom: 396 },
    })

    expect(container.scrollTop).toBe(0)
    expect(container.scrollBy).not.toHaveBeenCalled()
    container.remove()
  })

  it('smoothly reveals only the clipped part of a pointer-placed caret', () => {
    const { container, editorRoot, focusable } = buildEditorDom()
    focusable.focus()

    const follow = createCaretFollow({ getEditor: () => ({ domNode: editorRoot }) })
    follow.onEditorSelectionChange({
      source: 'user-pointer',
      isCollapsed: true,
      cursorCoords: { top: 400, bottom: 420 },
    })

    expect(container.scrollBy).toHaveBeenCalledWith({ top: 36, behavior: 'smooth' })
    expect(container.scrollTop).toBe(36)
    container.remove()
  })

  it('does nothing while the editor does not own focus', () => {
    const { container, editorRoot } = buildEditorDom()

    const follow = createCaretFollow({ getEditor: () => ({ domNode: editorRoot }) })
    follow.onEditorSelectionChange({
      isCollapsed: true,
      cursorCoords: { top: 380, bottom: 396 },
    })

    expect(container.scrollTop).toBe(0)
    container.remove()
  })

  it('leaves non-collapsed selections alone for native handle drags', () => {
    const { container, editorRoot, focusable } = buildEditorDom()
    focusable.focus()

    const follow = createCaretFollow({ getEditor: () => ({ domNode: editorRoot }) })
    follow.onEditorSelectionChange({
      isCollapsed: false,
      cursorCoords: { top: 380, bottom: 396 },
    })

    expect(container.scrollTop).toBe(0)
    container.remove()
  })

  it('skips silently when no caret rect is recoverable', () => {
    const { container, editorRoot, focusable } = buildEditorDom()
    focusable.focus()
    window.getSelection()?.removeAllRanges()

    const follow = createCaretFollow({ getEditor: () => ({ domNode: editorRoot }) })
    follow.onEditorSelectionChange({ isCollapsed: true, cursorCoords: null })

    expect(container.scrollTop).toBe(0)
    container.remove()
  })
})
