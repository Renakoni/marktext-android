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
  openSearch(): void
  closeSearch(options?: CloseDocumentSearchOptions): void
  setQuery(value: string): void
  findNext(): void
  findPrevious(): void
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
  let queryTimer: ReturnType<typeof setTimeout> | null = null

  function applySearchState(state: { matches: unknown[]; index: number }) {
    matchCount.value = state.matches.length
    activeMatchIndex.value = state.index
  }

  function clearSearchState() {
    searchQuery.value = ''
    matchCount.value = 0
    activeMatchIndex.value = -1
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

    applySearchState(editor.search(value))

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

    applySearchState(editor.find(action))
    scrollActiveMatchIntoView?.()
  }

  function findNext() {
    findInDirection('next')
  }

  function findPrevious() {
    findInDirection('previous')
  }

  function refreshAfterEdit() {
    if (!searchOpen.value || !searchQuery.value) {
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
    openSearch,
    closeSearch,
    setQuery,
    findNext,
    findPrevious,
    refreshAfterEdit,
    resetForNewDocument,
  }
}
