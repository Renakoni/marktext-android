import { describe, expect, it } from 'vitest'
import {
  createRecentDocumentFromLocalDraft,
  getRecentDocumentListItems,
  normalizeRecentDocuments,
  parseRecentDocuments,
  serializeRecentDocuments,
  upsertRecentDocument,
  type RecentDocumentRecord,
} from './recentDocuments'

const olderDraft = {
  id: 'older',
  markdown: '# Older draft\n\nhello',
  updatedAt: '2026-06-29T00:00:00.000Z',
  lastSavedAt: '2026-06-29T00:00:00.000Z',
}

const newerDraft = {
  id: 'newer',
  markdown: '# Newer draft\n\n你好',
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
    expect(record.canWrite).toBe(true)
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
