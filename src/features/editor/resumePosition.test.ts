// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  computeResumeAnchor,
  computeResumeAnchorFromRects,
  computeResumeScrollTop,
  createResumePosition,
} from './resumePosition'
import {
  createResumePositionRecord,
  type CreateResumePositionRecordOptions,
  type ResumePositionRecord,
} from '../../lib/resumePositions'
import type { MuyaEditor } from './editorRuntime'

// Rects as a scrolled viewport would report them: viewportTop is the scroll
// container's own top edge in the same coordinate space.
const BLOCKS = [
  { top: -500, height: 200 }, // spans -500..-300
  { top: -280, height: 400 }, // spans -280..120 (20px margin gap before it)
  { top: 140, height: 100 }, // spans 140..240
]

describe('computeResumeAnchor', () => {
  it('returns null for an empty document', () => {
    expect(computeResumeAnchor(0, [])).toBeNull()
  })

  it('resolves the block under the viewport top with an in-block ratio', () => {
    const anchor = computeResumeAnchor(0, BLOCKS)
    expect(anchor).toEqual({ index: 1, ratio: 0.7 })
  })

  it('resolves a margin gap to the next block at ratio 0', () => {
    // -290 sits between block 0 (ends -300) and block 1 (starts -280).
    expect(computeResumeAnchor(-290, BLOCKS)).toEqual({ index: 1, ratio: 0 })
  })

  it('resolves a viewport above the first block to index 0, ratio 0', () => {
    expect(computeResumeAnchor(-600, BLOCKS)).toEqual({ index: 0, ratio: 0 })
  })

  it('resolves a viewport past the last block to the last block at ratio 1', () => {
    expect(computeResumeAnchor(500, BLOCKS)).toEqual({ index: 2, ratio: 1 })
  })

  it('treats a zero-height block as ratio 0', () => {
    expect(computeResumeAnchor(10, [{ top: 0, height: 0 }, { top: 10, height: 50 }])).toEqual({
      index: 1,
      ratio: 0,
    })
  })

  it('finds the same anchors through indexed layout reads', () => {
    for (const viewportTop of [-600, -290, 0, 130, 500]) {
      expect(
        computeResumeAnchorFromRects(viewportTop, BLOCKS.length, index => BLOCKS[index]),
      ).toEqual(computeResumeAnchor(viewportTop, BLOCKS))
    }
  })

  it('uses logarithmic layout reads for a very large block list', () => {
    const blocks = Array.from({ length: 8_192 }, (_, index) => ({
      top: index * 20,
      height: 16,
    }))
    let reads = 0

    const anchor = computeResumeAnchorFromRects(120_017, blocks.length, index => {
      reads += 1
      return blocks[index]
    })

    expect(anchor).toEqual({ index: 6_001, ratio: 0 })
    expect(reads).toBeLessThanOrEqual(15)
  })
})

describe('computeResumeScrollTop', () => {
  it('places the viewport top at the saved ratio inside the block', () => {
    // Container top at 100, block currently rendered at 400 with height 200,
    // current scrollTop 50: ratio 0.25 targets y=450 → scrollTop 50+350.
    expect(
      computeResumeScrollTop({
        scrollTop: 50,
        containerTop: 100,
        blockTop: 400,
        blockHeight: 200,
        ratio: 0.25,
      }),
    ).toBe(400)
  })

  it('clamps the ratio and never returns a negative offset', () => {
    expect(
      computeResumeScrollTop({
        scrollTop: 0,
        containerTop: 0,
        blockTop: -30,
        blockHeight: 10,
        ratio: -2,
      }),
    ).toBe(0)
  })

  it('is the inverse of computeResumeAnchor for an unchanged layout', () => {
    // A capture at scrollTop 380 with the container top at 0: block rects in
    // viewport coordinates are documentTop - scrollTop.
    const layout = [
      { documentTop: 0, height: 300 },
      { documentTop: 320, height: 500 },
      { documentTop: 840, height: 200 },
    ]
    const scrollTop = 380
    const rects = layout.map(block => ({ top: block.documentTop - scrollTop, height: block.height }))
    const anchor = computeResumeAnchor(0, rects)
    expect(anchor).not.toBeNull()

    // Restore in a fresh session (scrollTop 0, same layout).
    const freshRect = layout[anchor!.index]
    const restored = computeResumeScrollTop({
      scrollTop: 0,
      containerTop: 0,
      blockTop: freshRect.documentTop,
      blockHeight: freshRect.height,
      ratio: anchor!.ratio,
    })
    expect(restored).toBeCloseTo(scrollTop, 6)
  })
})

function createStoredRecord(topBlockIndex: number): ResumePositionRecord {
  return {
    schemaVersion: 1,
    capturedAt: '2026-07-11T00:00:00.000Z',
    normalizedLength: 8,
    markdownSha256: 'a'.repeat(64),
    topBlockIndex,
    topBlockRatio: 0,
    displayText: '',
  }
}

function buildEditorDom() {
  const shell = document.createElement('div')
  const editorRoot = document.createElement('div')
  const blockContainer = document.createElement('div')
  blockContainer.className = 'mu-container'
  const paragraph = document.createElement('p')
  paragraph.textContent = 'Block zero'
  blockContainer.append(paragraph)
  editorRoot.append(blockContainer)
  shell.append(editorRoot)
  document.body.append(shell)
  return { shell, editorRoot }
}

interface ControllerHarnessOptions {
  createRecord: (options: CreateResumePositionRecordOptions) => Promise<ResumePositionRecord | null>
  readPosition?: (docKey: string) => ResumePositionRecord | null
  /** Logical top-level block count (jsonState), independent of mounted DOM. */
  logicalBlockCount?: number
}

function createControllerHarness({
  createRecord,
  readPosition,
  logicalBlockCount = 1,
}: ControllerHarnessOptions) {
  // No ResizeObserver: the open-settle phase and stabilization resolve
  // immediately, keeping these tests synchronous and deterministic.
  vi.stubGlobal('ResizeObserver', undefined)
  const { shell, editorRoot } = buildEditorDom()
  const store = new Map<string, ResumePositionRecord>()
  const ensureMountedThrough = vi.fn()

  const controller = createResumePosition({
    getEditor: () =>
      ({
        domNode: editorRoot,
        ensureMountedThrough,
        editor: { jsonState: { rawState: new Array(logicalBlockCount) } },
      }) as unknown as MuyaEditor,
    isEditorReady: () => true,
    getDocumentKey: () => 'doc',
    getMarkdown: () => 'markdown',
    readPosition: readPosition ?? (() => null),
    writePosition: (key, record) => void store.set(key, record),
    removePosition: key => void store.delete(key),
    createRecord,
  })

  return { controller, shell, editorRoot, store, ensureMountedThrough }
}

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('persistNow write ordering', () => {
  it('keeps the newest capture when an older hash resolves last', async () => {
    const deferred: Array<(record: ResumePositionRecord | null) => void> = []
    const { controller, shell, store } = createControllerHarness({
      createRecord: () => new Promise(resolve => deferred.push(resolve)),
    })

    await controller.startForOpenedDocument()

    // A session without scrolling or editing never starts a write.
    await controller.persistNow('untouched')
    expect(deferred).toHaveLength(0)

    shell.dispatchEvent(new Event('scroll'))
    const older = controller.persistNow('older')
    const newer = controller.persistNow('newer')
    expect(deferred).toHaveLength(2)

    // The newer request's digest resolves first and lands...
    deferred[1](createStoredRecord(9))
    await newer
    expect(store.get('doc')?.topBlockIndex).toBe(9)

    // ...and the older digest resolving afterwards must not overwrite it —
    // WebCrypto gives no ordering guarantee across digest promises.
    deferred[0](createStoredRecord(1))
    await older
    expect(store.get('doc')?.topBlockIndex).toBe(9)
  })

  it('outlives a session reset without letting the old write beat a newer one', async () => {
    const deferred: Array<(record: ResumePositionRecord | null) => void> = []
    const { controller, shell, store } = createControllerHarness({
      createRecord: () => new Promise(resolve => deferred.push(resolve)),
    })

    await controller.startForOpenedDocument()
    shell.dispatchEvent(new Event('scroll'))
    const before = controller.persistNow('before document replacement')

    // Same document reopened in a fresh session; a new position is written.
    controller.resetForNewDocument()
    await controller.startForOpenedDocument()
    shell.dispatchEvent(new Event('scroll'))
    const after = controller.persistNow('after reopen')

    deferred[1](createStoredRecord(7))
    await after
    // The pre-reset write completes late but stays subordinate.
    deferred[0](createStoredRecord(2))
    await before
    expect(store.get('doc')?.topBlockIndex).toBe(7)
  })
})

describe('restore validation versus concurrent writes', () => {
  it('a stale mismatch removal cannot delete a newer concurrently persisted record', async () => {
    // The record handed to opening-time validation: same canonical length as
    // the current markdown ("markdown" → 8) so validation reaches the async
    // hash, which then mismatches.
    const staleRecord: ResumePositionRecord = {
      ...createStoredRecord(3),
      capturedAt: '2026-07-10T00:00:00.000Z',
    }
    const newerRecord = createStoredRecord(7)

    // Validation reads the stale record once; every later read (the removal
    // identity check included) sees the live store.
    let validationRead = false
    let liveStore: Map<string, ResumePositionRecord> = new Map()
    const { controller, shell, store } = createControllerHarness({
      createRecord: () => Promise.resolve(newerRecord),
      readPosition: key => {
        if (!validationRead) {
          validationRead = true
          return staleRecord
        }
        return liveStore.get(key) ?? null
      },
    })
    liveStore = store

    const opening = controller.startForOpenedDocument()
    // A lifecycle flush persists a newer, valid record while the stale
    // record's hash comparison is still in flight.
    shell.dispatchEvent(new Event('scroll'))
    await controller.persistNow('lifecycle flush during validation')
    expect(store.get('doc')).toBe(newerRecord)

    await opening

    // Whichever side finished last, the newer record must survive: the
    // removal is identity-checked (skips a replaced entry), and a write
    // landing after a removal re-creates the entry.
    expect(store.get('doc')).toBe(newerRecord)
  })
})

describe('persistNow live capture', () => {
  it('captures the live DOM at persist time — snapshot timestamp included', async () => {
    const captured: CreateResumePositionRecordOptions[] = []
    const { controller, shell } = createControllerHarness({
      createRecord: options => {
        captured.push(options)
        return Promise.resolve(null)
      },
    })

    await controller.startForOpenedDocument()
    shell.dispatchEvent(new Event('scroll'))
    await controller.persistNow('exit')

    expect(captured).toHaveLength(1)
    // The anchor and display text come from the live block DOM, not from any
    // state captured earlier in the session.
    expect(captured[0].displayText).toBe('Block zero')
    expect(captured[0].markdown).toBe('markdown')
    // capturedAt is stamped before hashing so LRU recency follows capture
    // order even when digests resolve out of order.
    expect(typeof captured[0].capturedAt).toBe('string')
    expect(Number.isNaN(Date.parse(captured[0].capturedAt!))).toBe(false)
  })

  it('persists after an edit-only session so a stale anchor can never survive an edit', async () => {
    const captured: CreateResumePositionRecordOptions[] = []
    const { controller } = createControllerHarness({
      createRecord: options => {
        captured.push(options)
        return Promise.resolve(null)
      },
    })

    await controller.startForOpenedDocument()
    // No scroll at all — only an edit, which may have changed the top-level
    // block structure. The exit must capture a FRESH anchor from the live
    // (post-edit) DOM rather than skipping or reusing anything older.
    controller.notifyDocumentEdited()
    await controller.persistNow('exit after edit')

    expect(captured).toHaveLength(1)
    expect(captured[0].displayText).toBe('Block zero')
  })
})

describe('restore offer during a progressive mount', () => {
  // A real record whose hash matches the harness markdown, pointing past the
  // single mounted block — i.e. into the pending tail of a larger document.
  async function makeMatchingRecord(topBlockIndex: number) {
    const record = await createResumePositionRecord({
      markdown: 'markdown',
      topBlockIndex,
      topBlockRatio: 0,
      displayText: 'Resume deep in the document',
    })
    expect(record).not.toBeNull()
    return record!
  }

  it('offers a pending-tail target without materializing anything', async () => {
    const record = await makeMatchingRecord(5)
    const { controller, ensureMountedThrough } = createControllerHarness({
      createRecord: () => Promise.resolve(null),
      readPosition: () => record,
      logicalBlockCount: 10,
    })

    await controller.startForOpenedDocument()

    // The probe runs on every open without user action: it must never
    // deep-mount (a near-end index would synchronously rebuild the whole
    // document). The offer stands on the hash match plus logical bounds.
    expect(controller.resumeCardVisible.value).toBe(true)
    expect(ensureMountedThrough).not.toHaveBeenCalled()
    controller.resetForNewDocument()
  })

  it('discards an index beyond the logical document without mounting', async () => {
    const record = await makeMatchingRecord(25)
    const { controller, ensureMountedThrough } = createControllerHarness({
      createRecord: () => Promise.resolve(null),
      readPosition: () => record,
      logicalBlockCount: 10,
    })

    await controller.startForOpenedDocument()

    expect(controller.resumeCardVisible.value).toBe(false)
    expect(ensureMountedThrough).not.toHaveBeenCalled()
    controller.resetForNewDocument()
  })

  it('materializes through the target only when the user activates the card', async () => {
    const record = await makeMatchingRecord(5)
    const { controller, editorRoot, ensureMountedThrough } = createControllerHarness({
      createRecord: () => Promise.resolve(null),
      readPosition: () => record,
      logicalBlockCount: 10,
    })
    ensureMountedThrough.mockImplementation((index: number) => {
      const container = editorRoot.querySelector('.mu-container')!
      while (container.children.length <= index) {
        const paragraph = document.createElement('p')
        paragraph.textContent = `Block ${container.children.length}`
        container.append(paragraph)
      }
    })

    await controller.startForOpenedDocument()
    expect(controller.resumeCardVisible.value).toBe(true)

    controller.activateResume()

    expect(ensureMountedThrough).toHaveBeenCalledWith(5)
    expect(controller.resumeCardVisible.value).toBe(false)
    controller.resetForNewDocument()
  })
})
