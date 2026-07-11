import { describe, expect, it, vi } from 'vitest'
import { createDocumentSearch, handleSearchEnterKeydown } from './documentSearch'
import type { MuyaEditor } from './editorRuntime'

interface FakeEditorOptions {
  matchCounts?: Record<string, number>
}

function createFakeEditor({ matchCounts = {} }: FakeEditorOptions = {}) {
  let index = -1
  let matches: unknown[] = []

  const search = vi.fn((value: string) => {
    matches = new Array(matchCounts[value] ?? 0).fill(null)
    index = matches.length > 0 ? 0 : -1
    return { matches, index }
  })

  const find = vi.fn((action: 'previous' | 'next') => {
    const len = matches.length
    if (len > 0) {
      index = action === 'next' ? (index + 1) % len : (index - 1 + len) % len
    }
    return { matches, index }
  })

  const focus = vi.fn()

  return { search, find, focus } as unknown as MuyaEditor & {
    search: typeof search
    find: typeof find
    focus: typeof focus
  }
}

function createSearchHarness(options: FakeEditorOptions & { editorMissing?: boolean } = {}) {
  const editor = createFakeEditor(options)
  const scrollActiveMatchIntoView = vi.fn()
  const documentSearch = createDocumentSearch({
    getEditor: () => (options.editorMissing ? null : editor),
    scrollActiveMatchIntoView,
  })

  return { editor, scrollActiveMatchIntoView, documentSearch }
}

describe('createDocumentSearch', () => {
  it('opens the find bar without touching the editor', () => {
    const { editor, documentSearch } = createSearchHarness()

    documentSearch.openSearch()

    expect(documentSearch.searchOpen.value).toBe(true)
    expect(editor.search).not.toHaveBeenCalled()
  })

  it('runs the query, exposes match feedback, and scrolls to the active match', () => {
    const { editor, scrollActiveMatchIntoView, documentSearch } = createSearchHarness({
      matchCounts: { apple: 3 },
    })

    documentSearch.openSearch()
    documentSearch.setQuery('apple')

    expect(editor.search).toHaveBeenCalledWith('apple')
    expect(documentSearch.searchQuery.value).toBe('apple')
    expect(documentSearch.matchCount.value).toBe(3)
    expect(documentSearch.activeMatchIndex.value).toBe(0)
    expect(scrollActiveMatchIntoView).toHaveBeenCalledTimes(1)
  })

  it('reports zero matches without scrolling', () => {
    const { scrollActiveMatchIntoView, documentSearch } = createSearchHarness()

    documentSearch.openSearch()
    documentSearch.setQuery('missing')

    expect(documentSearch.matchCount.value).toBe(0)
    expect(documentSearch.activeMatchIndex.value).toBe(-1)
    expect(scrollActiveMatchIntoView).not.toHaveBeenCalled()
  })

  it('navigates matches in both directions with wrap-around', () => {
    const { editor, scrollActiveMatchIntoView, documentSearch } = createSearchHarness({
      matchCounts: { x: 3 },
    })

    documentSearch.openSearch()
    documentSearch.setQuery('x')

    documentSearch.findNext()
    expect(editor.find).toHaveBeenCalledWith('next')
    expect(documentSearch.activeMatchIndex.value).toBe(1)

    documentSearch.findPrevious()
    documentSearch.findPrevious()
    expect(editor.find).toHaveBeenCalledWith('previous')
    expect(documentSearch.activeMatchIndex.value).toBe(2)

    // Query scroll + three navigation scrolls.
    expect(scrollActiveMatchIntoView).toHaveBeenCalledTimes(4)
  })

  it('ignores navigation while there are no matches', () => {
    const { editor, documentSearch } = createSearchHarness()

    documentSearch.openSearch()
    documentSearch.findNext()
    documentSearch.findPrevious()

    expect(editor.find).not.toHaveBeenCalled()
  })

  it('closing clears highlights and restores the editor cursor via selectHighlight', () => {
    const { editor, documentSearch } = createSearchHarness({ matchCounts: { apple: 2 } })

    documentSearch.openSearch()
    documentSearch.setQuery('apple')
    documentSearch.closeSearch()

    expect(editor.search).toHaveBeenLastCalledWith('', { selectHighlight: true })
    // Muya's selectHighlight owns the cursor here; no focus fallback needed.
    expect(editor.focus).not.toHaveBeenCalled()
    expect(documentSearch.searchOpen.value).toBe(false)
    expect(documentSearch.searchQuery.value).toBe('')
    expect(documentSearch.matchCount.value).toBe(0)
    expect(documentSearch.activeMatchIndex.value).toBe(-1)
  })

  it('closing with an empty query falls back to editor focus', () => {
    const { editor, documentSearch } = createSearchHarness()

    documentSearch.openSearch()
    documentSearch.closeSearch()

    expect(editor.search).toHaveBeenLastCalledWith('', { selectHighlight: true })
    expect(editor.focus).toHaveBeenCalledTimes(1)
    expect(documentSearch.searchOpen.value).toBe(false)
  })

  it('closing with a no-match query falls back to editor focus', () => {
    const { editor, documentSearch } = createSearchHarness()

    documentSearch.openSearch()
    documentSearch.setQuery('missing')
    documentSearch.closeSearch()

    expect(editor.focus).toHaveBeenCalledTimes(1)
    expect(documentSearch.searchOpen.value).toBe(false)
  })

  it('closing when leaving the editor skips the cursor restore and the focus fallback', () => {
    const { editor, documentSearch } = createSearchHarness()

    documentSearch.openSearch()
    documentSearch.setQuery('missing')
    documentSearch.closeSearch({ restoreCursor: false })

    expect(editor.search).toHaveBeenLastCalledWith('', { selectHighlight: false })
    expect(editor.focus).not.toHaveBeenCalled()
    expect(documentSearch.searchOpen.value).toBe(false)
  })

  it('closing while already closed does nothing', () => {
    const { editor, documentSearch } = createSearchHarness()

    documentSearch.closeSearch()

    expect(editor.search).not.toHaveBeenCalled()
  })

  it('re-runs the open query after an edit and updates the counter', () => {
    const { editor, documentSearch } = createSearchHarness({ matchCounts: { apple: 2 } })

    documentSearch.openSearch()
    documentSearch.setQuery('apple')

    // The edit removed one occurrence.
    editor.search.mockImplementation(() => ({ matches: [null], index: 0 }))
    documentSearch.refreshAfterEdit()

    expect(editor.search).toHaveBeenLastCalledWith('apple')
    expect(documentSearch.matchCount.value).toBe(1)
    expect(documentSearch.activeMatchIndex.value).toBe(0)
  })

  it('skips the edit refresh when the bar is closed or the query is empty', () => {
    const { editor, documentSearch } = createSearchHarness({ matchCounts: { apple: 2 } })

    documentSearch.refreshAfterEdit()
    expect(editor.search).not.toHaveBeenCalled()

    documentSearch.openSearch()
    documentSearch.refreshAfterEdit()
    expect(editor.search).not.toHaveBeenCalled()
  })

  it('resets app state for a new document without calling the editor', () => {
    const { editor, documentSearch } = createSearchHarness({ matchCounts: { apple: 2 } })

    documentSearch.openSearch()
    documentSearch.setQuery('apple')
    editor.search.mockClear()

    documentSearch.resetForNewDocument()

    expect(editor.search).not.toHaveBeenCalled()
    expect(documentSearch.searchOpen.value).toBe(false)
    expect(documentSearch.searchQuery.value).toBe('')
    expect(documentSearch.matchCount.value).toBe(0)
    expect(documentSearch.activeMatchIndex.value).toBe(-1)
  })

  it('stays inert when no editor instance is available', () => {
    const { documentSearch } = createSearchHarness({ editorMissing: true })

    documentSearch.openSearch()
    documentSearch.setQuery('apple')
    documentSearch.findNext()
    documentSearch.closeSearch()

    expect(documentSearch.searchOpen.value).toBe(false)
    expect(documentSearch.matchCount.value).toBe(0)
  })
})

describe('handleSearchEnterKeydown', () => {
  function makeEnterEvent(isComposing: boolean) {
    return {
      isComposing,
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent & { preventDefault: ReturnType<typeof vi.fn> }
  }

  it('prevents the default and navigates on a real Enter', () => {
    const event = makeEnterEvent(false)
    const findNext = vi.fn()

    handleSearchEnterKeydown(event, findNext)

    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(findNext).toHaveBeenCalledTimes(1)
  })

  it('leaves a composing Enter to the IME: no preventDefault, no navigation', () => {
    const event = makeEnterEvent(true)
    const findNext = vi.fn()

    handleSearchEnterKeydown(event, findNext)

    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(findNext).not.toHaveBeenCalled()
  })
})
