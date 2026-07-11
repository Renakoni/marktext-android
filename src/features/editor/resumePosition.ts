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

/** In-memory anchor refreshed on scroll settle; persisted only on exit paths. */
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

// Anchor updates wait for this quiet window after the last scroll event, so
// capture work never runs per-frame during a fling.
export const RESUME_CAPTURE_SETTLE_MS = 250
// Scrolling this far while the card shows counts as the user navigating on
// their own; the offer is stale at that point.
export const RESUME_CARD_SCROLL_DISMISS_PX = 24
// The card only appears when the jump is worth interrupting for.
export const RESUME_MIN_DISTANCE_VIEWPORTS = 1.5
// Bounded lifetime: the card withdraws on its own instead of lingering.
export const RESUME_CARD_AUTO_DISMISS_MS = 10_000
// Post-jump stabilization bounds: corrections stop after a quiet window, at
// the hard cap, or on the first trusted user input — whichever comes first.
export const RESUME_STABILIZE_QUIET_MS = 600
export const RESUME_STABILIZE_MAX_MS = 4_000
export const RESUME_STABILIZE_THRESHOLD_PX = 8

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
  /** Write the current in-memory anchor for the session's document, if any. */
  persistNow(reason: string): void
  /** Cancel everything and forget the session before a document replacement. */
  resetForNewDocument(): void
}

/**
 * Session controller for "resume where you left off". Capture updates an
 * in-memory anchor on scroll settle and persists it only through the
 * existing exit/lifecycle paths; restore is strictly validated (exact
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
  logger,
}: CreateResumePositionOptions): ResumePosition {
  const resumeCardVisible = ref(false)
  const resumeCardText = ref('')

  let generation = 0
  let sessionDocKey: string | null = null
  let anchor: ResumeAnchor | null = null
  let pendingTarget: PendingResumeTarget | null = null

  let scrollCleanup: (() => void) | null = null
  let captureTimer: ReturnType<typeof setTimeout> | null = null
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

  function clearCaptureTimer() {
    if (captureTimer !== null) {
      clearTimeout(captureTimer)
      captureTimer = null
    }
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

  function captureAnchor() {
    const scrollContainer = getScrollContainer()
    const blockContainer = getBlockContainer()
    if (!scrollContainer || !blockContainer) {
      return
    }

    const blocks = Array.from(blockContainer.children)
    const viewportTop = scrollContainer.getBoundingClientRect().top
    const computed = computeResumeAnchor(
      viewportTop,
      blocks.map(block => {
        const rect = block.getBoundingClientRect()
        return { top: rect.top, height: rect.height }
      }),
    )
    if (!computed) {
      return
    }

    anchor = {
      topBlockIndex: computed.index,
      topBlockRatio: computed.ratio,
      displayText: normalizeResumeDisplayText(blocks[computed.index].textContent ?? ''),
    }
  }

  function installScrollCapture(scrollContainer: HTMLElement) {
    const onScroll = () => {
      if (
        resumeCardVisible.value &&
        Math.abs(scrollContainer.scrollTop - cardShownScrollTop) > RESUME_CARD_SCROLL_DISMISS_PX
      ) {
        dismissCard('scrolled away')
      }

      clearCaptureTimer()
      captureTimer = setTimeout(() => {
        captureTimer = null
        captureAnchor()
      }, RESUME_CAPTURE_SETTLE_MS)
    }

    scrollContainer.addEventListener('scroll', onScroll, { passive: true })
    scrollCleanup = () => {
      scrollContainer.removeEventListener('scroll', onScroll)
      clearCaptureTimer()
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
      // no approximate relocation.
      removePosition(docKey)
      logger?.debug('resume position discarded: document hash mismatch', { docKey })
      return
    }

    const scrollContainer = getScrollContainer()
    const blockContainer = getBlockContainer()
    if (!scrollContainer || !blockContainer) {
      return
    }

    const block = blockContainer.children[record.topBlockIndex]
    if (!block) {
      logger?.debug('resume position discarded: block index out of range', {
        docKey,
        topBlockIndex: record.topBlockIndex,
      })
      return
    }

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

    const observer = new ResizeObserver(() => {
      if (quietTimer !== null) {
        clearTimeout(quietTimer)
      }
      quietTimer = setTimeout(() => stop('layout quiet'), RESUME_STABILIZE_QUIET_MS)
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
    quietTimer = setTimeout(() => stop('layout quiet'), RESUME_STABILIZE_QUIET_MS)

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
    if (!docKey || !scrollContainer || !getBlockContainer()) {
      return
    }

    generation += 1
    const sessionGeneration = generation
    sessionDocKey = docKey
    installScrollCapture(scrollContainer)

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
    standDown('document edited')
  }

  function persistNow(reason: string) {
    if (!sessionDocKey || !anchor) {
      return
    }

    const markdown = getMarkdown()
    if (markdown === null) {
      return
    }

    // Everything is snapshotted synchronously; the hash-and-write
    // continuation cannot be affected by editor destruction or replacement.
    const docKey = sessionDocKey
    const { topBlockIndex, topBlockRatio, displayText } = anchor
    void createResumePositionRecord({
      markdown,
      topBlockIndex,
      topBlockRatio,
      displayText,
    }).then(record => {
      if (record) {
        writePosition(docKey, record)
        logger?.debug('resume position persisted', { docKey, reason, topBlockIndex })
      }
    })
  }

  function resetForNewDocument() {
    generation += 1
    sessionDocKey = null
    anchor = null
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
