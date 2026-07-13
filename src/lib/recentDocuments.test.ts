import { describe, expect, it } from 'vitest'
import {
  createRecentDocumentFromAndroidDocument,
  createRecentDocumentFromLocalDraft,
  getRecentDocumentListItems,
  markRecentDocumentSaved,
  normalizeRecentDocuments,
  parseRecentDocuments,
  serializeRecentDocuments,
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
})
