import { describe, expect, it } from 'vitest'
import {
  createRecentDocumentFromAndroidDocument,
  createRecentDocumentFromLocalDraft,
  getRecentDocumentListItems,
  markRecentDocumentSaved,
  normalizeRecentDocuments,
  parseRecentDocuments,
  serializeRecentDocuments,
  toRecentDocumentListItems,
  upsertRecentDocument,
  type RecentDocumentRecord,
} from './recentDocuments'

const olderDraft = {
  id: 'older',
  markdown: '# Older draft\n\nhello',
  createdAt: '2026-06-28T23:59:00.000Z',
  updatedAt: '2026-06-29T00:00:00.000Z',
  lastSavedAt: '2026-06-29T00:00:00.000Z',
}

const newerDraft = {
  id: 'newer',
  markdown: '# Newer draft\n\n你好',
  createdAt: '2026-06-29T00:01:00.000Z',
  updatedAt: '2026-06-29T00:02:00.000Z',
  lastSavedAt: '2026-06-29T00:02:00.000Z',
}

const androidDocument: RecentDocumentRecord = {
  id: 'android-1',
  kind: 'android-document',
  displayName: 'notes.md',
  title: 'notes',
  sourceUri: 'content://provider/notes.md',
  providerName: 'Documents',
  pathHint: 'Documents/notes.md',
  markdownPreview: null,
  createdAt: '2026-06-29T00:01:00.000Z',
  updatedAt: '2026-06-29T00:01:00.000Z',
  lastOpenedAt: '2026-06-29T00:01:00.000Z',
  lastSavedAt: null,
  autosaveState: 'clean',
  canWrite: true,
}

describe('recentDocuments', () => {
  it('parses invalid storage values as an empty recent document list', () => {
    expect(parseRecentDocuments('not-json')).toEqual([])
    expect(parseRecentDocuments(JSON.stringify({ id: 'not-array' }))).toEqual([])
    expect(parseRecentDocuments(JSON.stringify([{ ...androidDocument, kind: 'bad-kind' }]))).toEqual(
      [],
    )
  })

  it('creates recent document records from local drafts', () => {
    const record = createRecentDocumentFromLocalDraft(newerDraft)

    expect(record.kind).toBe('local-draft')
    expect(record.title).toBe('Newer draft')
    expect(record.providerName).toBe('Local draft')
    expect(record.markdownPreview).toBe(newerDraft.markdown)
    expect(record.createdAt).toBe(newerDraft.createdAt)
    expect(record.canWrite).toBe(true)
  })

  it('lets an explicit draft rename beat content-derived titles', () => {
    const record = createRecentDocumentFromLocalDraft({
      ...newerDraft,
      displayName: 'Trip plan',
    })

    expect(record.title).toBe('Trip plan')
    expect(record.displayName).toBe('Trip plan')
  })

  it('treats a stored Untitled-N as a placeholder, not a name', () => {
    // A frozen number never overrides the draft's own content title.
    const titled = createRecentDocumentFromLocalDraft({
      ...newerDraft,
      displayName: 'Untitled-3',
    })
    expect(titled.title).toBe('Newer draft')

    // It only surfaces when the draft has no title of its own, and it is the
    // draft's distinct number rather than the shared Untitled-1.
    const untitled = createRecentDocumentFromLocalDraft({
      ...newerDraft,
      markdown: '```\n```',
      displayName: 'Untitled-3',
    })
    expect(untitled.title).toBe('Untitled-3')
  })

  it('creates recent document records from Android documents without storing markdown content', () => {
    const record = createRecentDocumentFromAndroidDocument({
      sourceUri: 'content://provider/android-note.md',
      displayName: 'android-note.md',
      providerName: 'Documents',
      pathHint: 'Documents/android-note.md',
      markdown: '# Android note\n\nopened from SAF',
      canWrite: false,
      openedAt: '2026-06-29T00:06:00.000Z',
    })

    expect(record.id).toBe('android-document:content://provider/android-note.md')
    expect(record.kind).toBe('android-document')
    expect(record.title).toBe('Android note')
    expect(record.markdownPreview).toBeNull()
    expect(record.createdAt).toBe('2026-06-29T00:06:00.000Z')
    expect(record.lastOpenedAt).toBe('2026-06-29T00:06:00.000Z')
    expect(record.canWrite).toBe(false)
  })

  it('sorts recent documents newest first by update or open time', () => {
    const openedLater = {
      ...androidDocument,
      id: 'opened-later',
      sourceUri: 'content://provider/opened-later.md',
      updatedAt: '2026-06-29T00:00:00.000Z',
      lastOpenedAt: '2026-06-29T00:05:00.000Z',
    }
    const updatedEarlier = createRecentDocumentFromLocalDraft(newerDraft)

    expect(normalizeRecentDocuments([updatedEarlier, openedLater]).map(record => record.id)).toEqual(
      ['opened-later', 'newer'],
    )
  })

  it('deduplicates Android documents by content URI', () => {
    const newerRecord = {
      ...androidDocument,
      id: 'android-2',
      updatedAt: '2026-06-29T00:03:00.000Z',
      lastOpenedAt: '2026-06-29T00:03:00.000Z',
    }

    const records = normalizeRecentDocuments([androidDocument, newerRecord])

    expect(records).toHaveLength(1)
    expect(records[0].id).toBe('android-2')
  })

  it('updates recent document metadata after a save without storing Android markdown', () => {
    const saved = markRecentDocumentSaved(androidDocument, {
      markdown: '# Updated Android title\n\nsaved',
      savedAt: '2026-06-29T00:07:00.000Z',
      canWrite: true,
    })

    expect(saved.title).toBe('Updated Android title')
    expect(saved.createdAt).toBe(androidDocument.createdAt)
    expect(saved.updatedAt).toBe('2026-06-29T00:07:00.000Z')
    expect(saved.lastSavedAt).toBe('2026-06-29T00:07:00.000Z')
    expect(saved.markdownPreview).toBeNull()
    expect(saved.canWrite).toBe(true)
  })

  it('deduplicates local drafts by id', () => {
    const olderRecord = createRecentDocumentFromLocalDraft(olderDraft)
    const newerRecord = createRecentDocumentFromLocalDraft({
      ...olderDraft,
      markdown: '# Updated draft',
      updatedAt: '2026-06-29T00:04:00.000Z',
    })

    const records = upsertRecentDocument([olderRecord], newerRecord)

    expect(records).toHaveLength(1)
    expect(records[0].title).toBe('Updated draft')
    expect(records[0].createdAt).toBe(olderRecord.createdAt)
  })

  it('migrates recent records without created time', () => {
    const legacyRecord = {
      ...androidDocument,
      createdAt: undefined,
    }
    const [record] = parseRecentDocuments(JSON.stringify([legacyRecord]))

    expect(record.createdAt).toBe(androidDocument.lastOpenedAt)
  })

  it('filters empty local draft previews', () => {
    const emptyDraft = {
      ...createRecentDocumentFromLocalDraft(olderDraft),
      markdownPreview: '   ',
      updatedAt: '2026-06-29T00:05:00.000Z',
    }

    expect(normalizeRecentDocuments([emptyDraft])).toEqual([])
  })

  it('serializes normalized recent documents for storage', () => {
    const serialized = serializeRecentDocuments([
      createRecentDocumentFromLocalDraft(olderDraft),
      createRecentDocumentFromLocalDraft(newerDraft),
    ])

    expect(parseRecentDocuments(serialized).map(record => record.id)).toEqual(['newer', 'older'])
  })

  it('creates list items with stats when a markdown preview exists', () => {
    const items = getRecentDocumentListItems([createRecentDocumentFromLocalDraft(newerDraft)])

    expect(items[0].stats?.words).toBe(4)
  })

  it('keeps stats empty for Android documents without a markdown preview', () => {
    const items = getRecentDocumentListItems([androidDocument])

    expect(items[0].stats).toBeNull()
  })

  it('caps the resting list at 100 and lets an explicit limit read past it (#151)', () => {
    const base = Date.parse('2026-06-01T00:00:00.000Z')
    const drafts = Array.from({ length: 105 }, (_, i) =>
      createRecentDocumentFromLocalDraft({
        id: `draft-${i + 1}`,
        markdown: `# Draft ${i + 1}\n\ncontent`,
        createdAt: new Date(base).toISOString(),
        updatedAt: new Date(base + (i + 1) * 1000).toISOString(),
        lastSavedAt: null,
      }),
    )

    expect(getRecentDocumentListItems(drafts)).toHaveLength(100)
    // The "show all" expansion reads the COMPLETE collection.
    expect(getRecentDocumentListItems(drafts, Number.POSITIVE_INFINITY)).toHaveLength(105)
  })

  it('materializes list items from pre-sorted records without reordering', () => {
    // toRecentDocumentListItems is the projection stage AFTER settings
    // sorting — re-normalizing here would re-sort by recency and destroy
    // a title or ascending order.
    const older = createRecentDocumentFromLocalDraft(olderDraft)
    const newer = createRecentDocumentFromLocalDraft(newerDraft)

    const items = toRecentDocumentListItems([older, newer])

    expect(items.map(item => item.id)).toEqual(['older', 'newer'])
    expect(items[0].stats?.words).toBe(3)
  })

  describe('the storage cap protects pinned records', () => {
    const base = Date.parse('2026-06-01T00:00:00.000Z')

    function androidRecords(count: number) {
      return Array.from({ length: count }, (_, index) => ({
        ...androidDocument,
        id: `android-document:content://provider/doc-${index}.md`,
        sourceUri: `content://provider/doc-${index}.md`,
        updatedAt: new Date(base + index * 60_000).toISOString(),
        lastOpenedAt: new Date(base + index * 60_000).toISOString(),
      }))
    }

    it('evicts the oldest UNPINNED records when an upsert crosses the cap', () => {
      // The concrete data-loss sequence: 100 unpinned Android records +
      // 1 pinned oldest, then the user opens one more document. Pin-blind
      // recency eviction would drop the pinned record — whose only
      // durable home is this store — and its pin would be orphan-pruned
      // at the next startup.
      const existing = androidRecords(101)
      const pinnedOldest = existing[0]
      const incoming = {
        ...androidDocument,
        id: 'android-document:content://provider/incoming.md',
        sourceUri: 'content://provider/incoming.md',
        updatedAt: new Date(base + 200 * 60_000).toISOString(),
        lastOpenedAt: new Date(base + 200 * 60_000).toISOString(),
      }

      const records = upsertRecentDocument(
        existing,
        incoming,
        undefined,
        new Set([pinnedOldest.id]),
      )

      // The limit is a TOTAL cap: the pinned record claims a slot with
      // priority, the newest unprotected records fill the remainder.
      expect(records).toHaveLength(100)
      expect(records.some(record => record.id === pinnedOldest.id)).toBe(true)
      expect(records.some(record => record.id === incoming.id)).toBe(true)
      // The oldest unpinned records are the ones that leave.
      expect(records.some(record => record.id === existing[1].id)).toBe(false)
      expect(records.some(record => record.id === existing[2].id)).toBe(false)
    })

    it('serializes a pinned beyond-cap record and parses it back uncapped', () => {
      const records = androidRecords(102)
      const pinnedOldest = records[0]

      const roundTripped = parseRecentDocuments(
        serializeRecentDocuments(records, new Set([pinnedOldest.id])),
      )

      // The pinned oldest plus the 99 newest unpinned survive within the
      // total cap; the read side must not re-cap them (it has no pin
      // knowledge).
      expect(roundTripped).toHaveLength(100)
      expect(roundTripped.some(record => record.id === pinnedOldest.id)).toBe(true)
    })

    it('never exceeds the total cap even at the pin ceiling', () => {
      // Worst case: 50 pinned (the pin store's own ceiling) + 100
      // unpinned. The advertised cap is a TOTAL — the store must hold
      // 100 records (50 pinned + the 50 newest unpinned), not 150,
      // preserving the headroom argument under Android <= 10's
      // 128-persisted-grant limit.
      const records = androidRecords(150)
      const pinnedIds = new Set(records.slice(0, 50).map(record => record.id))

      const roundTripped = parseRecentDocuments(
        serializeRecentDocuments(records, pinnedIds),
      )

      expect(roundTripped).toHaveLength(100)
      for (const id of pinnedIds) {
        expect(roundTripped.some(record => record.id === id)).toBe(true)
      }
    })
  })
})
