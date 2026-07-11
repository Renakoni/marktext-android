import { ref, type Ref } from 'vue'
import type { MuyaEditor } from './editorRuntime'

interface DocumentOutlineLogger {
  debug(message: string, context?: Record<string, unknown>): void
}

/** One row of the outline sheet, projected from Muya's TOC. */
export interface OutlineItem {
  /** Muya's stable per-block slug — the navigation key. */
  slug: string
  /** Rendered plain heading text (inline markdown already stripped by Muya). */
  text: string
  /** Original heading level (1-6). */
  level: number
  /**
   * Indentation steps normalized from the lowest level present in the
   * document and capped so deep hierarchies stay readable on phones.
   */
  indent: number
}

export const MAX_OUTLINE_INDENT = 3

interface MuyaTocItem {
  content: string
  lvl: number
  slug: string
}

/**
 * Project Muya's flat TOC into display rows: indentation is relative to the
 * shallowest heading in the document (a doc that starts at H3 renders flush
 * left) and capped at MAX_OUTLINE_INDENT steps so H4-H6 keep usable width.
 */
export function projectOutlineItems(toc: readonly MuyaTocItem[]): OutlineItem[] {
  if (toc.length === 0) {
    return []
  }

  const minLevel = Math.min(...toc.map(item => item.lvl))

  return toc.map(item => ({
    slug: item.slug,
    text: item.content,
    level: item.lvl,
    indent: Math.min(item.lvl - minLevel, MAX_OUTLINE_INDENT),
  }))
}

/**
 * Muya's TOC slug is NOT stamped onto the heading DOM. getTOC() walks only
 * the top-level scrollPage children, and those blocks render as the DIRECT
 * children of the scrollPage root (`.mu-container`), so the flat TOC index
 * maps 1:1 onto this ordered element set. Headings inside blockquotes,
 * lists, or raw HTML are NOT direct `.mu-container` children and must stay
 * out of the query, or every later index would shift.
 */
export const TOP_LEVEL_HEADING_SELECTOR =
  '.mu-container > h1, .mu-container > h2, .mu-container > h3, ' +
  '.mu-container > h4, .mu-container > h5, .mu-container > h6'

/**
 * Resolve an outline slug to its live heading element by TOC-index mapping.
 * Returns null when the slug or the index mapping is stale (e.g. the
 * document changed since the TOC snapshot) — callers must fail safe.
 */
export function resolveOutlineHeadingElement(
  root: ParentNode,
  toc: readonly { slug: string }[],
  slug: string,
): Element | null {
  const index = toc.findIndex(item => item.slug === slug)
  if (index < 0) {
    return null
  }

  const headings = root.querySelectorAll(TOP_LEVEL_HEADING_SELECTOR)
  return headings[index] ?? null
}

interface SettleViewport {
  addEventListener(type: 'resize', listener: () => void): void
  removeEventListener(type: 'resize', listener: () => void): void
}

export interface WaitForViewportSettleOptions {
  /** Resolve after this long with no resize events (one quiet window). */
  quietMs?: number
  /** Hard upper bound so a jittery viewport can never stall the sheet. */
  maxMs?: number
  viewport?: SettleViewport | null
}

/**
 * Wait until the visual viewport stops resizing (keyboard dismissal animates
 * the WebView viewport/insets). Event-driven with a bounded fallback: when no
 * keyboard was open there are no resize events and the first quiet window
 * resolves immediately-ish; a viewport that never goes quiet resolves at maxMs.
 */
export function waitForViewportSettle({
  quietMs = 90,
  maxMs = 450,
  viewport = typeof window !== 'undefined' ? window.visualViewport : null,
}: WaitForViewportSettleOptions = {}): Promise<void> {
  if (!viewport) {
    return Promise.resolve()
  }

  return new Promise(resolve => {
    let quietTimer: ReturnType<typeof setTimeout>

    const finish = () => {
      clearTimeout(quietTimer)
      clearTimeout(maxTimer)
      viewport.removeEventListener('resize', onResize)
      resolve()
    }

    const onResize = () => {
      clearTimeout(quietTimer)
      quietTimer = setTimeout(finish, quietMs)
    }

    const maxTimer = setTimeout(finish, maxMs)
    quietTimer = setTimeout(finish, quietMs)
    viewport.addEventListener('resize', onResize)
  })
}

export interface CreateDocumentOutlineOptions {
  getEditor: () => MuyaEditor | null
  /** Dismiss the soft keyboard without touching Muya's cached selection. */
  dismissKeyboard: () => void
  /** Wait for the WebView viewport/insets to settle after keyboard dismissal. */
  settleViewport: () => Promise<void>
  /** Scroll the live editor container so the heading is visible in context. */
  scrollToHeading: (heading: Element) => void
  logger?: DocumentOutlineLogger
}

export interface DocumentOutline {
  outlineOpen: Ref<boolean>
  outlineItems: Ref<OutlineItem[]>
  openOutline(): Promise<void>
  closeOutline(): void
  /** Navigate to a heading; closes the sheet, fails safe on stale slugs. */
  selectHeading(slug: string): void
  /** Drop all outline state without touching the (gone) editor instance. */
  resetForNewDocument(): void
}

/**
 * Session controller for the mobile document outline sheet. A fresh TOC is
 * snapshotted from the live Muya instance on every open — the editor is
 * non-interactive behind the sheet, so the snapshot cannot go stale while
 * the sheet is visible except through explicit document replacement, which
 * resets the sheet entirely.
 */
export function createDocumentOutline({
  getEditor,
  dismissKeyboard,
  settleViewport,
  scrollToHeading,
  logger,
}: CreateDocumentOutlineOptions): DocumentOutline {
  const outlineOpen = ref(false)
  const outlineItems = ref<OutlineItem[]>([])

  let tocSnapshot: MuyaTocItem[] = []

  async function openOutline() {
    const editor = getEditor()
    if (!editor || outlineOpen.value) {
      return
    }

    dismissKeyboard()
    await settleViewport()

    // The editor may have been destroyed while the viewport settled.
    const liveEditor = getEditor()
    if (!liveEditor) {
      return
    }

    tocSnapshot = liveEditor.getTOC()
    outlineItems.value = projectOutlineItems(tocSnapshot)
    outlineOpen.value = true
    logger?.debug('document outline opened', { headings: tocSnapshot.length })
  }

  function closeOutline() {
    if (!outlineOpen.value) {
      return
    }

    outlineOpen.value = false
    outlineItems.value = []
    tocSnapshot = []
    logger?.debug('document outline closed')
  }

  function selectHeading(slug: string) {
    if (!outlineOpen.value) {
      return
    }

    const editor = getEditor()
    const heading = editor
      ? resolveOutlineHeadingElement(editor.domNode, tocSnapshot, slug)
      : null

    if (heading) {
      scrollToHeading(heading)
      logger?.debug('document outline navigated', { slug })
    } else {
      logger?.debug('document outline target stale, closing without scroll', { slug })
    }

    closeOutline()
  }

  function resetForNewDocument() {
    if (!outlineOpen.value && outlineItems.value.length === 0) {
      return
    }

    outlineOpen.value = false
    outlineItems.value = []
    tocSnapshot = []
    logger?.debug('document outline reset for new document')
  }

  return {
    outlineOpen,
    outlineItems,
    openOutline,
    closeOutline,
    selectHeading,
    resetForNewDocument,
  }
}
