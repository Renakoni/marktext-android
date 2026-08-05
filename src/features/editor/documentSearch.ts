import { ref, type Ref } from 'vue'
import type { MuyaEditor } from './editorRuntime'

interface DocumentSearchLogger {
  debug(message: string, context?: Record<string, unknown>): void
}

export interface CreateDocumentSearchOptions {
  getEditor: () => MuyaEditor | null
  /** Bring the active `.mu-highlight` span into view after search/navigation. */
  scrollActiveMatchIntoView?: () => void
  /** Delay repeated input while typing; zero keeps deterministic synchronous behavior. */
  queryDebounceMs?: number
  logger?: DocumentSearchLogger
}

export const DOCUMENT_SEARCH_QUERY_DEBOUNCE_MS = 120

export interface CloseDocumentSearchOptions {
  /**
   * Restore the editor cursor onto the last active match (Muya's
   * `selectHighlight` contract). Pass false when leaving the editor, where
   * focusing the editor again would be unwanted.
   */
  restoreCursor?: boolean
}

export interface DocumentSearch {
  searchOpen: Ref<boolean>
  searchQuery: Ref<string>
  matchCount: Ref<number>
  /** 0-based index of the active match; -1 when there is none. */
  activeMatchIndex: Ref<number>
  /** Whether the replace row under the find bar is expanded. */
  replaceOpen: Ref<boolean>
  replaceValue: Ref<string>
  caseSensitive: Ref<boolean>
  /**
   * Occurrences consumed by the last replace-all, surfaced in the count
   * slot until the next search action; null when no notice is pending.
   */
  replaceAllCount: Ref<number | null>
  openSearch(): void
  closeSearch(options?: CloseDocumentSearchOptions): void
  setQuery(value: string): void
  findNext(): void
  findPrevious(): void
  toggleReplaceOpen(): void
  setReplaceValue(value: string): void
  /** Re-runs the current query under the new sensitivity. */
  toggleCaseSensitive(): void
  /** Replace the active match and advance to the next one. */
  replaceCurrent(): void
  /** Replace every match in the document. */
  replaceAll(): void
  /** Re-run the current query after the document content changed. */
  refreshAfterEdit(): void
  /** Drop all search state without touching the (gone) editor instance. */
  resetForNewDocument(): void
}

/**
 * Keydown handler for the find-bar input's Enter key. During IME composition
 * Enter belongs to the input method (candidate confirmation / commit), so
 * both preventDefault and next-match navigation may run only for a real,
 * non-composing Enter press.
 */
export function handleSearchEnterKeydown(event: KeyboardEvent, findNext: () => void) {
  if (event.isComposing) {
    return
  }

  event.preventDefault()
  findNext()
}

/**
 * Session controller for the mobile in-document find bar. Wraps Muya's
 * search module (muya.search / muya.find): Muya owns match collection,
 * highlight rendering, and cursor restoration on close; this owns the
 * app-facing open/query/navigate/close state the UI binds to.
 */
export function createDocumentSearch({
  getEditor,
  scrollActiveMatchIntoView,
  queryDebounceMs = DOCUMENT_SEARCH_QUERY_DEBOUNCE_MS,
  logger,
}: CreateDocumentSearchOptions): DocumentSearch {
  const searchOpen = ref(false)
  const searchQuery = ref('')
  const matchCount = ref(0)
  const activeMatchIndex = ref(-1)
  const replaceOpen = ref(false)
  const replaceValue = ref('')
  const caseSensitive = ref(false)
  const replaceAllCount = ref<number | null>(null)
  let queryTimer: ReturnType<typeof setTimeout> | null = null
  // The engine dispatch inside a replace fires the app's synchronous
  // json-change -> refreshAfterEdit chain; that re-search would reset the
  // active-match index the engine just advanced, so it is muted while the
  // replace owns the search state.
  let replacing = false

  function applySearchState(state: { matches: unknown[]; index: number }) {
    matchCount.value = state.matches.length
    activeMatchIndex.value = state.index
  }

  function clearSearchState() {
    searchQuery.value = ''
    matchCount.value = 0
    activeMatchIndex.value = -1
    replaceOpen.value = false
    replaceValue.value = ''
    caseSensitive.value = false
    replaceAllCount.value = null
  }

  function cancelPendingQuery() {
    if (queryTimer !== null) {
      clearTimeout(queryTimer)
      queryTimer = null
    }
  }

  function applyQuery(value: string) {
    const editor = getEditor()
    if (!editor) {
      return
    }

    applySearchState(editor.search(value, { isCaseSensitive: caseSensitive.value }))

    if (value && matchCount.value > 0) {
      scrollActiveMatchIntoView?.()
    }
  }

  function flushPendingQuery() {
    if (queryTimer === null) {
      return
    }
    cancelPendingQuery()
    applyQuery(searchQuery.value)
  }

  function openSearch() {
    if (searchOpen.value) {
      return
    }

    searchOpen.value = true
    logger?.debug('document search opened')
  }

  function closeSearch({ restoreCursor = true }: CloseDocumentSearchOptions = {}) {
    if (!searchOpen.value) {
      return
    }

    cancelPendingQuery()
    const editor = getEditor()
    const hadActiveMatch = activeMatchIndex.value >= 0

    // Emptying the search clears every highlight; selectHighlight puts the
    // editor cursor back on the last active match so editing continues there.
    editor?.search('', { selectHighlight: restoreCursor })

    if (restoreCursor && !hadActiveMatch) {
      // Muya only restores a cursor when a match was active. For an empty or
      // no-match query the search input still owns focus and is about to
      // unmount, so fall back to Muya's focus(), which reinstates the
      // pre-search caret while it still belongs to the current document.
      editor?.focus()
    }

    clearSearchState()
    searchOpen.value = false
    logger?.debug('document search closed', { restoreCursor, hadActiveMatch })
  }

  function setQuery(value: string) {
    searchQuery.value = value
    replaceAllCount.value = null
    cancelPendingQuery()

    if (!value || queryDebounceMs <= 0) {
      applyQuery(value)
      return
    }

    queryTimer = setTimeout(() => {
      queryTimer = null
      applyQuery(value)
    }, queryDebounceMs)
  }

  function findInDirection(action: 'previous' | 'next') {
    flushPendingQuery()
    const editor = getEditor()
    if (!editor || matchCount.value === 0) {
      return
    }

    replaceAllCount.value = null
    applySearchState(editor.find(action))
    scrollActiveMatchIntoView?.()
  }

  function findNext() {
    findInDirection('next')
  }

  function findPrevious() {
    findInDirection('previous')
  }

  function toggleReplaceOpen() {
    replaceOpen.value = !replaceOpen.value
    logger?.debug('document search replace toggled', { open: replaceOpen.value })
  }

  function setReplaceValue(value: string) {
    replaceValue.value = value
  }

  function toggleCaseSensitive() {
    caseSensitive.value = !caseSensitive.value
    replaceAllCount.value = null
    cancelPendingQuery()

    if (searchQuery.value) {
      applyQuery(searchQuery.value)
    }
  }

  function runReplace(isSingle: boolean) {
    flushPendingQuery()
    const editor = getEditor()
    if (!editor || !searchQuery.value || matchCount.value === 0) {
      return
    }

    const consumed = isSingle ? 1 : matchCount.value
    replacing = true
    try {
      // Each user-visible replace is exactly one undo step: the history
      // coalesces by time window, so cut it on both sides of the
      // synchronous dispatch (contract pinned in Muya's search.spec).
      editor.editor.history.cutoff()
      applySearchState(
        editor.replace(replaceValue.value, {
          isSingle,
          isCaseSensitive: caseSensitive.value,
        }),
      )
      editor.editor.jsonState.flush()
      editor.editor.history.cutoff()
    } finally {
      replacing = false
    }

    replaceAllCount.value = isSingle ? null : consumed
    if (isSingle && matchCount.value > 0) {
      scrollActiveMatchIntoView?.()
    }
    logger?.debug('document search replace applied', {
      all: !isSingle,
      consumed,
      remaining: matchCount.value,
    })
  }

  function replaceCurrent() {
    runReplace(true)
  }

  function replaceAll() {
    runReplace(false)
  }

  function refreshAfterEdit() {
    if (replacing || !searchOpen.value || !searchQuery.value) {
      return
    }

    cancelPendingQuery()
    applyQuery(searchQuery.value)
  }

  function resetForNewDocument() {
    if (!searchOpen.value && !searchQuery.value) {
      return
    }

    cancelPendingQuery()
    // Muya resets its own match state on setContent; only the app-side
    // find-bar state needs dropping here.
    clearSearchState()
    searchOpen.value = false
    logger?.debug('document search reset for new document')
  }

  return {
    searchOpen,
    searchQuery,
    matchCount,
    activeMatchIndex,
    replaceOpen,
    replaceValue,
    caseSensitive,
    replaceAllCount,
    openSearch,
    closeSearch,
    setQuery,
    findNext,
    findPrevious,
    toggleReplaceOpen,
    setReplaceValue,
    toggleCaseSensitive,
    replaceCurrent,
    replaceAll,
    refreshAfterEdit,
    resetForNewDocument,
  }
}
