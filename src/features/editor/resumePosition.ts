import { ref, type Ref } from 'vue'
import {
  createResumePositionRecord,
  matchesResumeDocument,
  normalizeResumeDisplayText,
  type ResumePositionRecord,
} from '../../lib/resumePositions'
import type { MuyaEditor } from './editorRuntime'

interface ResumePositionLogger {
  debug(message: string, context?: Record<string, unknown>): void
}

/** Structural anchor read from the live DOM at persist time. */
interface ResumeAnchor {
  topBlockIndex: number
  topBlockRatio: number
  displayText: string
}

/** Card target resolved and validated at evaluation time. */
interface PendingResumeTarget {
  topBlockIndex: number
  topBlockRatio: number
}

export interface ResumeBlockRect {
  top: number
  height: number
}

// Scrolling this far while the card shows counts as the user navigating on
// their own; the offer is stale at that point.
export const RESUME_CARD_SCROLL_DISMISS_PX = 24
// The card only appears when the jump is worth interrupting for.
export const RESUME_MIN_DISTANCE_VIEWPORTS = 1.5
// Bounded lifetime: the card withdraws on its own instead of lingering.
export const RESUME_CARD_AUTO_DISMISS_MS = 10_000
// Initial-layout settle before eligibility is judged: images, fonts, KaTeX,
// and diagram previews can reflow the document long after editor readiness,
// and a distance check against that transient layout would suppress or show
// the card incorrectly.
export const RESUME_OPEN_SETTLE_QUIET_MS = 350
export const RESUME_OPEN_SETTLE_MAX_MS = 3_000
// Post-jump stabilization bounds: corrections stop after a quiet window, at
// the hard cap, or on the first trusted user input — whichever comes first.
export const RESUME_STABILIZE_QUIET_MS = 600
export const RESUME_STABILIZE_MAX_MS = 4_000
export const RESUME_STABILIZE_THRESHOLD_PX = 8

/**
 * An image whose network fetch is still in flight produces NO resize events,
 * so a quiet window alone cannot distinguish "settled" from "still waiting".
 * Muya marks in-flight image probes with `mu-image-loading` (removed on
 * success and failure); inserted `<img>` elements report `complete`.
 */
function hasPendingImageContent(target: Element) {
  if (target.querySelector('.mu-image-loading')) {
    return true
  }

  return Array.from(target.querySelectorAll('img')).some(image => !image.complete)
}

/**
 * Resolve once the element stops resizing for one quiet window AND no image
 * load is pending, or at the hard bound — the same event-driven-with-cap
 * shape as waitForViewportSettle in documentOutline.ts. The observer always
 * disconnects at resolution; callers re-check their generation token
 * afterwards.
 */
export function waitForLayoutSettle(
  target: Element,
  { quietMs = RESUME_OPEN_SETTLE_QUIET_MS, maxMs = RESUME_OPEN_SETTLE_MAX_MS } = {},
): Promise<void> {
  if (typeof ResizeObserver === 'undefined') {
    return Promise.resolve()
  }

  return new Promise(resolve => {
    let quietTimer: ReturnType<typeof setTimeout>

    const finish = () => {
      clearTimeout(quietTimer)
      clearTimeout(maxTimer)
      observer.disconnect()
      resolve()
    }

    const onQuiet = () => {
      // Quiet but not trustworthy yet: keep re-checking on the same cadence
      // until the pending loads land (their reflow re-arms the timer via the
      // observer) or the hard bound fires.
      if (hasPendingImageContent(target)) {
        quietTimer = setTimeout(onQuiet, quietMs)
        return
      }

      finish()
    }

    const observer = new ResizeObserver(() => {
      clearTimeout(quietTimer)
      quietTimer = setTimeout(onQuiet, quietMs)
    })

    const maxTimer = setTimeout(finish, maxMs)
    quietTimer = setTimeout(onQuiet, quietMs)
    observer.observe(target)
  })
}

/**
 * Locate the top-level block under the viewport top edge. Gaps between
 * blocks (margins) resolve to the next block at ratio 0; a viewport past the
 * last block resolves to the last block at ratio 1.
 */
export function computeResumeAnchor(
  viewportTop: number,
  blocks: readonly ResumeBlockRect[],
): { index: number; ratio: number } | null {
  if (blocks.length === 0) {
    return null
  }

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]
    if (viewportTop < block.top + block.height) {
      if (viewportTop <= block.top || block.height <= 0) {
        return { index, ratio: 0 }
      }

      return { index, ratio: (viewportTop - block.top) / block.height }
    }
  }

  return { index: blocks.length - 1, ratio: 1 }
}

/**
 * Indexed equivalent of computeResumeAnchor for vertically ordered DOM
 * blocks. Binary search avoids forcing layout for every block during an exit
 * or lifecycle flush on very large documents.
 */
export function computeResumeAnchorFromRects(
  viewportTop: number,
  blockCount: number,
  readRect: (index: number) => ResumeBlockRect,
): { index: number; ratio: number } | null {
  if (blockCount === 0) {
    return null
  }

  const rectCache = new Map<number, ResumeBlockRect>()
  const getRect = (index: number) => {
    const cached = rectCache.get(index)
    if (cached) {
      return cached
    }
    const rect = readRect(index)
    rectCache.set(index, rect)
    return rect
  }

  let low = 0
  let high = blockCount
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    const rect = getRect(middle)
    if (viewportTop < rect.top + rect.height) {
      high = middle
    } else {
      low = middle + 1
    }
  }

  if (low === blockCount) {
    return { index: blockCount - 1, ratio: 1 }
  }

  const block = getRect(low)
  if (viewportTop <= block.top || block.height <= 0) {
    return { index: low, ratio: 0 }
  }
  return { index: low, ratio: (viewportTop - block.top) / block.height }
}

/** Scroll offset that puts the viewport top at `ratio` inside the block. */
export function computeResumeScrollTop({
  scrollTop,
  containerTop,
  blockTop,
  blockHeight,
  ratio,
}: {
  scrollTop: number
  containerTop: number
  blockTop: number
  blockHeight: number
  ratio: number
}): number {
  const clampedRatio = Math.min(Math.max(ratio, 0), 1)
  return Math.max(0, scrollTop + (blockTop - containerTop) + clampedRatio * blockHeight)
}

export interface CreateResumePositionOptions {
  getEditor: () => MuyaEditor | null
  isEditorReady: () => boolean
  /** Stable document identity; null means "do not track this document". */
  getDocumentKey: () => string | null
  /** Normalized editor Markdown snapshot; null when no editor is alive. */
  getMarkdown: () => string | null
  readPosition: (docKey: string) => ResumePositionRecord | null
  writePosition: (docKey: string, record: ResumePositionRecord) => void
  removePosition: (docKey: string) => void
  /** Injectable for deterministic ordering tests; defaults to the real hash. */
  createRecord?: typeof createResumePositionRecord
  logger?: ResumePositionLogger
}

export interface ResumePosition {
  resumeCardVisible: Ref<boolean>
  resumeCardText: Ref<string>
  /**
   * Bind to the freshly opened document: install scroll capture and evaluate
   * whether a stored position can be offered. Safe to call repeatedly; each
   * call replaces the previous session.
   */
  startForOpenedDocument(): Promise<void>
  /** Jump to the offered position and run bounded stabilization. */
  activateResume(): void
  /** Hide the card without touching stabilization (tap on close, scroll). */
  dismissCard(reason: string): void
  /** A competing editor surface takes over: hide the card, stop corrections. */
  standDown(reason: string): void
  /** Content changed: the offer and any in-flight stabilization are stale. */
  notifyDocumentEdited(): void
  /**
   * Capture the live viewport anchor and persist it for the session's
   * document. Resolves when the write settled; callers on exit paths may
   * ignore the promise — ordering is guaranteed internally.
   */
  persistNow(reason: string): Promise<void>
  /** Cancel everything and forget the session before a document replacement. */
  resetForNewDocument(): void
}

/**
 * Session controller for "resume where you left off". Capture reads the live
 * viewport synchronously at each persist point (the existing exit/lifecycle
 * paths), gated by whether the user scrolled or edited this session; restore
 * waits for the initial layout to settle, is strictly validated (exact
 * SHA-256), never automatic, and every async step is bound to a generation
 * token so document replacement or editor destruction cancels it.
 */
export function createResumePosition({
  getEditor,
  isEditorReady,
  getDocumentKey,
  getMarkdown,
  readPosition,
  writePosition,
  removePosition,
  createRecord = createResumePositionRecord,
  logger,
}: CreateResumePositionOptions): ResumePosition {
  const resumeCardVisible = ref(false)
  const resumeCardText = ref('')

  let generation = 0
  let sessionDocKey: string | null = null
  // True once the user scrolled or edited this session. Only then does an
  // exit write a fresh position; a passive revisit leaves the stored record
  // untouched.
  let positionTouched = false
  let pendingTarget: PendingResumeTarget | null = null

  // Latest-capture-wins ordering for asynchronous hash-and-write requests.
  // Keyed per document and NEVER reset with the session: a snapshotted
  // outgoing-document write may complete after editor destruction, but it
  // must not overwrite a newer capture for the same document.
  const persistTokens = new Map<string, number>()

  let scrollCleanup: (() => void) | null = null
  let cardTimer: ReturnType<typeof setTimeout> | null = null
  let cardShownScrollTop = 0
  let stabilizeCleanup: (() => void) | null = null

  function getScrollContainer(): HTMLElement | null {
    return getEditor()?.domNode.parentElement ?? null
  }

  /**
   * Muya's scrollPage root. Its direct element children are exactly the
   * top-level state blocks, in order, front matter included (verified
   * against a mixed-block-type document; see documentOutline.ts for the
   * matching TOC-index contract).
   */
  function getBlockContainer(): HTMLElement | null {
    return getEditor()?.domNode.querySelector<HTMLElement>('.mu-container') ?? null
  }

  function hideCard() {
    if (cardTimer !== null) {
      clearTimeout(cardTimer)
      cardTimer = null
    }

    pendingTarget = null
    if (resumeCardVisible.value) {
      resumeCardVisible.value = false
      resumeCardText.value = ''
    }
  }

  function stopStabilization() {
    stabilizeCleanup?.()
    stabilizeCleanup = null
  }

  /**
   * Read the anchor from the live DOM. Always called synchronously at
   * persist time — after the pending editor content flushed — so the anchor
   * can never be structurally stale relative to the hashed Markdown, and an
   * exit inside any debounce window cannot lose the latest position.
   */
  function captureLiveAnchor(): ResumeAnchor | null {
    const scrollContainer = getScrollContainer()
    const blockContainer = getBlockContainer()
    if (!scrollContainer || !blockContainer) {
      return null
    }

    const blocks = Array.from(blockContainer.children)
    const viewportTop = scrollContainer.getBoundingClientRect().top
    const computed = computeResumeAnchorFromRects(viewportTop, blocks.length, index => {
      const rect = blocks[index].getBoundingClientRect()
      return { top: rect.top, height: rect.height }
    })
    if (!computed) {
      return null
    }

    return {
      topBlockIndex: computed.index,
      topBlockRatio: computed.ratio,
      displayText: normalizeResumeDisplayText(blocks[computed.index].textContent ?? ''),
    }
  }

  function installScrollCapture(scrollContainer: HTMLElement) {
    const onScroll = () => {
      positionTouched = true
      if (
        resumeCardVisible.value &&
        Math.abs(scrollContainer.scrollTop - cardShownScrollTop) > RESUME_CARD_SCROLL_DISMISS_PX
      ) {
        dismissCard('scrolled away')
      }
    }

    scrollContainer.addEventListener('scroll', onScroll, { passive: true })
    scrollCleanup = () => {
      scrollContainer.removeEventListener('scroll', onScroll)
    }
  }

  async function evaluateRestoreOpportunity(docKey: string, sessionGeneration: number) {
    const record = readPosition(docKey)
    if (!record) {
      return
    }

    const markdown = getMarkdown()
    if (markdown === null) {
      return
    }

    const matches = await matchesResumeDocument(record, markdown)
    if (generation !== sessionGeneration) {
      return
    }

    if (!matches) {
      // The content changed since capture; the position is permanently
      // invalid for this document version. Discard silently — no fallback,
      // no approximate relocation. Removal is ordered against concurrent
      // writes: only the exact record this validation read may be deleted —
      // a lifecycle capture can land a newer, valid record while the hash
      // above was still computing, and deleting that would erase a real
      // position. (A newer write completing AFTER this removal simply
      // re-creates the entry, so both orderings are safe.)
      const current = readPosition(docKey)
      if (
        current &&
        current.capturedAt === record.capturedAt &&
        current.markdownSha256 === record.markdownSha256
      ) {
        removePosition(docKey)
      }
      logger?.debug('resume position discarded: document hash mismatch', { docKey })
      return
    }

    const scrollContainer = getScrollContainer()
    const blockContainer = getBlockContainer()
    if (!scrollContainer || !blockContainer) {
      return
    }

    // This probe runs on every open without user action, so it must NEVER
    // materialize blocks: with a progressive mount in flight, a stored
    // near-end index would otherwise synchronously deep-mount the document
    // and reintroduce the very freeze progressive mounting removes. The
    // stored block may therefore have no DOM yet — the hash match above
    // proved the document identical, so validate the index against the
    // LOGICAL top-level count instead and defer materialization to the
    // user's explicit tap (activateResume).
    const block = blockContainer.children[record.topBlockIndex] ?? null
    if (!block) {
      const logicalCount = getEditor()?.editor.jsonState.rawState.length ?? 0
      if (record.topBlockIndex >= logicalCount) {
        logger?.debug('resume position discarded: block index out of range', {
          docKey,
          topBlockIndex: record.topBlockIndex,
        })
        return
      }
      // In the pending tail: the target sits past the synchronous mount
      // prefix — hundreds of blocks, far beyond the min-distance threshold —
      // so eligibility holds by construction and the rect check is skipped.
    } else {
      const containerRect = scrollContainer.getBoundingClientRect()
      const blockRect = block.getBoundingClientRect()
      const target = computeResumeScrollTop({
        scrollTop: scrollContainer.scrollTop,
        containerTop: containerRect.top,
        blockTop: blockRect.top,
        blockHeight: blockRect.height,
        ratio: record.topBlockRatio,
      })
      if (target < scrollContainer.clientHeight * RESUME_MIN_DISTANCE_VIEWPORTS) {
        logger?.debug('resume position skipped: too close to the top', { docKey })
        return
      }
    }

    // The user started scrolling or editing while validation ran: they are
    // already navigating on their own, so the offer would be noise.
    if (positionTouched) {
      logger?.debug('resume position skipped: user already navigating', { docKey })
      return
    }

    pendingTarget = {
      topBlockIndex: record.topBlockIndex,
      topBlockRatio: record.topBlockRatio,
    }
    resumeCardText.value = record.displayText
    resumeCardVisible.value = true
    cardShownScrollTop = scrollContainer.scrollTop
    cardTimer = setTimeout(() => dismissCard('timed out'), RESUME_CARD_AUTO_DISMISS_MS)
    logger?.debug('resume card offered', { docKey, topBlockIndex: record.topBlockIndex })
  }

  /**
   * Bounded post-jump stabilization: images, fonts, KaTeX, and diagram
   * previews can reflow the document after the jump, so the anchor block is
   * re-pinned on relevant layout changes until the layout goes quiet, the
   * hard cap fires, or the user takes over. No permanent observers, no
   * style mutation.
   */
  function startStabilization(target: PendingResumeTarget, sessionGeneration: number) {
    stopStabilization()

    if (typeof ResizeObserver === 'undefined') {
      return
    }

    const scrollContainer = getScrollContainer()
    const blockContainer = getBlockContainer()
    if (!scrollContainer || !blockContainer) {
      return
    }

    let quietTimer: ReturnType<typeof setTimeout> | null = null
    let observedBlock: Element | null = null

    const stop = (reason: string) => {
      if (stabilizeCleanup !== cleanup) {
        return
      }

      stabilizeCleanup = null
      cleanup()
      logger?.debug('resume stabilization stopped', { reason })
    }

    const correct = () => {
      if (generation !== sessionGeneration) {
        stop('generation changed')
        return
      }

      // Re-resolve by index every pass: Muya may re-render a block's DOM
      // node, and a held element would silently go stale.
      const block = blockContainer.children[target.topBlockIndex] ?? null
      if (!block) {
        stop('block gone')
        return
      }

      if (block !== observedBlock) {
        if (observedBlock) {
          observer.unobserve(observedBlock)
        }
        observer.observe(block)
        observedBlock = block
      }

      const containerRect = scrollContainer.getBoundingClientRect()
      const blockRect = block.getBoundingClientRect()
      const desired = computeResumeScrollTop({
        scrollTop: scrollContainer.scrollTop,
        containerTop: containerRect.top,
        blockTop: blockRect.top,
        blockHeight: blockRect.height,
        ratio: target.topBlockRatio,
      })
      if (Math.abs(desired - scrollContainer.scrollTop) > RESUME_STABILIZE_THRESHOLD_PX) {
        scrollContainer.scrollTop = desired
      }
    }

    // Same pending awareness as the initial settle: an image still fetching
    // produces no resize events, so a quiet window is only trustworthy once
    // no load is known to be in flight. The hard cap still bounds the wait,
    // and the load's eventual reflow re-pins through the observer.
    const onQuiet = () => {
      if (hasPendingImageContent(blockContainer)) {
        quietTimer = setTimeout(onQuiet, RESUME_STABILIZE_QUIET_MS)
        return
      }

      stop('layout quiet')
    }

    const observer = new ResizeObserver(() => {
      if (quietTimer !== null) {
        clearTimeout(quietTimer)
      }
      quietTimer = setTimeout(onQuiet, RESUME_STABILIZE_QUIET_MS)
      correct()
    })

    const onUserInput = (event: Event) => {
      if (event.isTrusted) {
        stop('user input')
      }
    }
    const inputEvents = ['pointerdown', 'touchstart', 'wheel', 'keydown'] as const
    for (const type of inputEvents) {
      window.addEventListener(type, onUserInput, { capture: true, passive: true })
    }

    const capTimer = setTimeout(() => stop('time cap'), RESUME_STABILIZE_MAX_MS)
    quietTimer = setTimeout(onQuiet, RESUME_STABILIZE_QUIET_MS)

    const cleanup = () => {
      observer.disconnect()
      for (const type of inputEvents) {
        window.removeEventListener(type, onUserInput, { capture: true })
      }
      clearTimeout(capTimer)
      if (quietTimer !== null) {
        clearTimeout(quietTimer)
      }
    }

    stabilizeCleanup = cleanup
    observer.observe(blockContainer)
    correct()
  }

  async function startForOpenedDocument() {
    resetForNewDocument()

    if (!isEditorReady() || !getEditor()) {
      return
    }

    const docKey = getDocumentKey()
    const scrollContainer = getScrollContainer()
    const blockContainer = getBlockContainer()
    if (!docKey || !scrollContainer || !blockContainer) {
      return
    }

    generation += 1
    const sessionGeneration = generation
    sessionDocKey = docKey
    installScrollCapture(scrollContainer)

    // Editor readiness is not layout readiness: images, fonts, KaTeX, and
    // diagram previews may still reflow the document. Judge eligibility only
    // against a settled layout (bounded — one quiet window or the hard cap),
    // otherwise the distance check can permanently suppress a valid offer or
    // show one whose target ends up near the top.
    await waitForLayoutSettle(blockContainer)
    if (generation !== sessionGeneration) {
      return
    }

    await evaluateRestoreOpportunity(docKey, sessionGeneration)
  }

  function activateResume() {
    const target = pendingTarget
    if (!resumeCardVisible.value || !target) {
      return
    }

    hideCard()

    const scrollContainer = getScrollContainer()
    const blockContainer = getBlockContainer()
    // Materialization happens HERE, on the user's explicit tap — the offer
    // deliberately never mounts (a stored near-end index would deep-mount
    // the whole document during the automatic probe). No-op once mounted.
    getEditor()?.ensureMountedThrough(target.topBlockIndex)
    const block = blockContainer?.children[target.topBlockIndex] ?? null
    if (!scrollContainer || !block) {
      logger?.debug('resume activation aborted: target unresolvable')
      return
    }

    const containerRect = scrollContainer.getBoundingClientRect()
    const blockRect = block.getBoundingClientRect()
    // Instant, unanimated jump: an animated scroll would fight the
    // stabilization corrections and reads as motion the user did not start.
    scrollContainer.scrollTo({
      top: computeResumeScrollTop({
        scrollTop: scrollContainer.scrollTop,
        containerTop: containerRect.top,
        blockTop: blockRect.top,
        blockHeight: blockRect.height,
        ratio: target.topBlockRatio,
      }),
    })

    startStabilization(target, generation)
    logger?.debug('resume position activated', { topBlockIndex: target.topBlockIndex })
  }

  function dismissCard(reason: string) {
    if (!resumeCardVisible.value) {
      return
    }

    hideCard()
    logger?.debug('resume card dismissed', { reason })
  }

  function standDown(reason: string) {
    stopStabilization()
    dismissCard(reason)
  }

  function notifyDocumentEdited() {
    // Edits can change the top-level block structure, so any previously
    // observed position is stale; the exit-time live capture (gated by this
    // flag) is the only anchor that may be persisted afterwards.
    positionTouched = true
    standDown('document edited')
  }

  function persistNow(reason: string): Promise<void> {
    // Nothing moved and nothing changed: keep the stored record so a passive
    // revisit does not erase a deep position with a top-of-document one.
    if (!sessionDocKey || !positionTouched) {
      return Promise.resolve()
    }

    // Flush pending editor content BEFORE reading the DOM, so the anchor and
    // the hashed Markdown describe the same document state.
    const markdown = getMarkdown()
    if (markdown === null) {
      return Promise.resolve()
    }

    const anchor = captureLiveAnchor()
    if (!anchor) {
      return Promise.resolve()
    }

    // Everything is snapshotted synchronously — including capturedAt, so LRU
    // recency reflects capture order, not hash completion order. The token
    // makes overlapping writes latest-capture-wins: WebCrypto digests may
    // resolve out of invocation order.
    const docKey = sessionDocKey
    const capturedAt = new Date().toISOString()
    const token = (persistTokens.get(docKey) ?? 0) + 1
    persistTokens.set(docKey, token)

    return createRecord({ markdown, capturedAt, ...anchor }).then(record => {
      if (!record || persistTokens.get(docKey) !== token) {
        return
      }

      writePosition(docKey, record)
      logger?.debug('resume position persisted', {
        docKey,
        reason,
        topBlockIndex: anchor.topBlockIndex,
      })
    })
  }

  function resetForNewDocument() {
    generation += 1
    sessionDocKey = null
    positionTouched = false
    stopStabilization()
    hideCard()
    scrollCleanup?.()
    scrollCleanup = null
  }

  return {
    resumeCardVisible,
    resumeCardText,
    startForOpenedDocument,
    activateResume,
    dismissCard,
    standDown,
    notifyDocumentEdited,
    persistNow,
    resetForNewDocument,
  }
}
