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

  const replace = vi.fn((_value: string, opts: { isSingle?: boolean } = {}) => {
    if (opts.isSingle === false) {
      matches = []
      index = -1
    } else if (matches.length > 0) {
      matches = matches.slice(0, -1)
      index = matches.length > 0 ? Math.min(index, matches.length - 1) : -1
    }
    return { matches, index }
  })

  const focus = vi.fn()
  const inner = {
    history: { cutoff: vi.fn() },
    jsonState: { flush: vi.fn() },
  }

  return { search, find, replace, focus, editor: inner } as unknown as MuyaEditor & {
    search: typeof search
    find: typeof find
    replace: typeof replace
    focus: typeof focus
    editor: typeof inner
  }
}

function createSearchHarness(options: FakeEditorOptions & { editorMissing?: boolean } = {}) {
  const editor = createFakeEditor(options)
  const scrollActiveMatchIntoView = vi.fn()
  const documentSearch = createDocumentSearch({
    getEditor: () => (options.editorMissing ? null : editor),
    scrollActiveMatchIntoView,
    queryDebounceMs: 0,
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

    expect(editor.search).toHaveBeenCalledWith('apple', { isCaseSensitive: false })
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

    expect(editor.search).toHaveBeenLastCalledWith('apple', { isCaseSensitive: false })
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

  it('coalesces rapid query input into one search', () => {
    vi.useFakeTimers()
    try {
      const editor = createFakeEditor({ matchCounts: { apple: 2 } })
      const documentSearch = createDocumentSearch({
        getEditor: () => editor,
        queryDebounceMs: 120,
      })
      documentSearch.openSearch()

      documentSearch.setQuery('a')
      documentSearch.setQuery('app')
      documentSearch.setQuery('apple')

      expect(editor.search).not.toHaveBeenCalled()
      vi.advanceTimersByTime(119)
      expect(editor.search).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1)
      expect(editor.search).toHaveBeenCalledTimes(1)
      expect(editor.search).toHaveBeenCalledWith('apple', { isCaseSensitive: false })
      expect(documentSearch.matchCount.value).toBe(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('replaces the active match as a cutoff-bounded single undo step and scrolls on', () => {
    const { editor, scrollActiveMatchIntoView, documentSearch } = createSearchHarness({
      matchCounts: { apple: 3 },
    })

    documentSearch.openSearch()
    documentSearch.setQuery('apple')
    documentSearch.setReplaceValue('pear')
    documentSearch.replaceCurrent()

    expect(editor.replace).toHaveBeenCalledWith('pear', {
      isSingle: true,
      isCaseSensitive: false,
    })
    // cutoff -> replace -> flush -> cutoff: the exact boundary sequence the
    // Muya-side undo contract pins.
    expect(editor.editor.history.cutoff).toHaveBeenCalledTimes(2)
    expect(editor.editor.jsonState.flush).toHaveBeenCalledTimes(1)
    expect(documentSearch.matchCount.value).toBe(2)
    expect(documentSearch.replaceAllCount.value).toBeNull()
    // Query scroll + post-replace scroll onto the advanced match.
    expect(scrollActiveMatchIntoView).toHaveBeenCalledTimes(2)
  })

  it('replaces all matches and surfaces the consumed count', () => {
    const { editor, scrollActiveMatchIntoView, documentSearch } = createSearchHarness({
      matchCounts: { apple: 3 },
    })

    documentSearch.openSearch()
    documentSearch.setQuery('apple')
    documentSearch.replaceAll()

    expect(editor.replace).toHaveBeenCalledWith('', {
      isSingle: false,
      isCaseSensitive: false,
    })
    expect(documentSearch.matchCount.value).toBe(0)
    expect(documentSearch.replaceAllCount.value).toBe(3)
    // Only the query scroll: nothing is active after replace-all.
    expect(scrollActiveMatchIntoView).toHaveBeenCalledTimes(1)
  })

  it('clears the replace-all notice on the next search action', () => {
    const { documentSearch } = createSearchHarness({ matchCounts: { apple: 3, pear: 1 } })

    documentSearch.openSearch()
    documentSearch.setQuery('apple')
    documentSearch.replaceAll()
    expect(documentSearch.replaceAllCount.value).toBe(3)

    documentSearch.setQuery('pear')
    expect(documentSearch.replaceAllCount.value).toBeNull()
  })

  it('ignores replace requests without a query, matches, or an editor', () => {
    const missing = createSearchHarness({ editorMissing: true })
    missing.documentSearch.openSearch()
    missing.documentSearch.replaceCurrent()
    missing.documentSearch.replaceAll()

    const { editor, documentSearch } = createSearchHarness({ matchCounts: { apple: 0 } })
    documentSearch.openSearch()
    documentSearch.replaceCurrent()
    documentSearch.setQuery('apple')
    documentSearch.replaceAll()

    expect(editor.replace).not.toHaveBeenCalled()
    expect(editor.editor.history.cutoff).not.toHaveBeenCalled()
  })

  it('mutes the edit refresh triggered by its own replace dispatch', () => {
    const { editor, documentSearch } = createSearchHarness({ matchCounts: { apple: 2 } })

    documentSearch.openSearch()
    documentSearch.setQuery('apple')

    // The real flush fires json-change synchronously, which the app routes
    // back into refreshAfterEdit mid-replace.
    editor.editor.jsonState.flush.mockImplementation(() => {
      documentSearch.refreshAfterEdit()
    })
    editor.search.mockClear()
    documentSearch.replaceCurrent()

    expect(editor.search).not.toHaveBeenCalled()
    expect(documentSearch.matchCount.value).toBe(1)
  })

  it('re-runs the query under the flipped case sensitivity', () => {
    const { editor, documentSearch } = createSearchHarness({ matchCounts: { Apple: 2 } })

    documentSearch.openSearch()
    documentSearch.setQuery('Apple')
    documentSearch.toggleCaseSensitive()

    expect(documentSearch.caseSensitive.value).toBe(true)
    expect(editor.search).toHaveBeenLastCalledWith('Apple', { isCaseSensitive: true })

    documentSearch.toggleCaseSensitive()
    expect(editor.search).toHaveBeenLastCalledWith('Apple', { isCaseSensitive: false })
  })

  it('toggles the replace row without touching the editor', () => {
    const { editor, documentSearch } = createSearchHarness()

    documentSearch.toggleReplaceOpen()
    expect(documentSearch.replaceOpen.value).toBe(true)
    documentSearch.toggleReplaceOpen()
    expect(documentSearch.replaceOpen.value).toBe(false)
    expect(editor.search).not.toHaveBeenCalled()
  })

  it('closing resets the replace row, value, sensitivity, and notice', () => {
    const { documentSearch } = createSearchHarness({ matchCounts: { apple: 2 } })

    documentSearch.openSearch()
    documentSearch.setQuery('apple')
    documentSearch.toggleReplaceOpen()
    documentSearch.setReplaceValue('pear')
    documentSearch.toggleCaseSensitive()
    documentSearch.replaceAll()
    documentSearch.closeSearch()

    expect(documentSearch.replaceOpen.value).toBe(false)
    expect(documentSearch.replaceValue.value).toBe('')
    expect(documentSearch.caseSensitive.value).toBe(false)
    expect(documentSearch.replaceAllCount.value).toBeNull()
  })

  it('flushes a pending query before next-match navigation', () => {
    vi.useFakeTimers()
    try {
      const editor = createFakeEditor({ matchCounts: { apple: 2 } })
      const documentSearch = createDocumentSearch({
        getEditor: () => editor,
        queryDebounceMs: 120,
      })
      documentSearch.openSearch()
      documentSearch.setQuery('apple')

      documentSearch.findNext()

      expect(editor.search).toHaveBeenCalledWith('apple', { isCaseSensitive: false })
      expect(editor.find).toHaveBeenCalledWith('next')
      expect(documentSearch.activeMatchIndex.value).toBe(1)
      vi.runAllTimers()
      expect(editor.search).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
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
