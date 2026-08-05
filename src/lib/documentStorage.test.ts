import { describe, expect, it } from 'vitest'
import {
  ANDROID_RECENT_DOCUMENTS_STORAGE_KEY,
  LEGACY_DRAFT_STORAGE_KEY,
  LOCAL_DRAFTS_STORAGE_KEY,
  PINNED_DOCUMENTS_STORAGE_KEY,
  readLegacyDraft,
  readStoredAndroidRecentDocuments,
  readStoredLocalDrafts,
  readStoredPinnedDocuments,
  writeStoredAndroidRecentDocuments,
  writeStoredLocalDrafts,
  writeStoredPinnedDocuments,
} from './documentStorage'
import { createRecentDocumentFromLocalDraft } from './recentDocuments'
import type { LocalDraftRecord } from './localDrafts'
import type { RecentDocumentRecord } from './recentDocuments'

class MemoryStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }

  removeItem(key: string) {
    this.values.delete(key)
  }
}

const localDraft: LocalDraftRecord = {
  id: 'draft-1',
  markdown: '# Draft\n\nbody',
  createdAt: '2026-06-29T00:00:00.000Z',
  updatedAt: '2026-06-29T00:01:00.000Z',
  lastSavedAt: null,
}

const androidDocument: RecentDocumentRecord = {
  id: 'android-document:content://provider/notes.md',
  kind: 'android-document',
  displayName: 'notes.md',
  title: 'notes',
  sourceUri: 'content://provider/notes.md',
  providerName: 'Documents',
  pathHint: 'Documents/notes.md',
  markdownPreview: null,
  createdAt: '2026-06-29T00:02:00.000Z',
  updatedAt: '2026-06-29T00:02:00.000Z',
  lastOpenedAt: '2026-06-29T00:02:00.000Z',
  lastSavedAt: null,
  autosaveState: 'clean',
  canWrite: true,
}

describe('documentStorage', () => {
  it('reads local drafts from the stable drafts key', () => {
    const storage = new MemoryStorage()
    storage.setItem(LOCAL_DRAFTS_STORAGE_KEY, JSON.stringify([localDraft]))

    expect(readStoredLocalDrafts(storage)).toEqual([localDraft])
  })

  it('writes local drafts and clears the legacy draft key', () => {
    const storage = new MemoryStorage()
    storage.setItem(LEGACY_DRAFT_STORAGE_KEY, '# Legacy draft')

    writeStoredLocalDrafts([localDraft], storage)

    expect(readStoredLocalDrafts(storage)).toEqual([localDraft])
    expect(readLegacyDraft(storage)).toBeNull()
  })

  it('removes the local drafts key and legacy key for an empty draft list', () => {
    const storage = new MemoryStorage()
    storage.setItem(LOCAL_DRAFTS_STORAGE_KEY, JSON.stringify([localDraft]))
    storage.setItem(LEGACY_DRAFT_STORAGE_KEY, '# Legacy draft')

    writeStoredLocalDrafts([], storage)

    expect(storage.getItem(LOCAL_DRAFTS_STORAGE_KEY)).toBeNull()
    expect(storage.getItem(LEGACY_DRAFT_STORAGE_KEY)).toBeNull()
  })

  it('reads only Android recent documents from the recent documents key', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      ANDROID_RECENT_DOCUMENTS_STORAGE_KEY,
      JSON.stringify([createRecentDocumentFromLocalDraft(localDraft), androidDocument]),
    )

    expect(readStoredAndroidRecentDocuments(storage)).toEqual([androidDocument])
  })

  it('writes only Android recent documents and returns the stored records', () => {
    const storage = new MemoryStorage()
    const localRecentDocument = createRecentDocumentFromLocalDraft(localDraft)

    const storedRecords = writeStoredAndroidRecentDocuments(
      [localRecentDocument, androidDocument],
      undefined,
      storage,
    )

    expect(storedRecords).toEqual([androidDocument])
    expect(readStoredAndroidRecentDocuments(storage)).toEqual([androidDocument])
  })

  it('removes the Android recent documents key when no Android records remain', () => {
    const storage = new MemoryStorage()
    storage.setItem(ANDROID_RECENT_DOCUMENTS_STORAGE_KEY, JSON.stringify([androidDocument]))

    writeStoredAndroidRecentDocuments(
      [createRecentDocumentFromLocalDraft(localDraft)],
      undefined,
      storage,
    )

    expect(storage.getItem(ANDROID_RECENT_DOCUMENTS_STORAGE_KEY)).toBeNull()
  })

  it('keeps pinned Android records across the write cap and reloads', () => {
    // The recents store is an Android document's only durable home, so a
    // pin-blind write cap would silently delete the pinned document and
    // its pin would be orphan-pruned on the next startup.
    const storage = new MemoryStorage()
    const base = Date.parse('2026-07-01T00:00:00.000Z')
    // 102 records = 101 unpinned + 1 pinned: one over the 100-unpinned cap.
    const records = Array.from({ length: 102 }, (_, index) => ({
      ...androidDocument,
      id: `android-document:content://provider/doc-${index}.md`,
      sourceUri: `content://provider/doc-${index}.md`,
      updatedAt: new Date(base + index * 60_000).toISOString(),
      lastOpenedAt: new Date(base + index * 60_000).toISOString(),
    }))
    const pinnedOldest = records[0]

    writeStoredAndroidRecentDocuments(records, new Set([pinnedOldest.id]), storage)

    const reloaded = readStoredAndroidRecentDocuments(storage)
    // The total cap holds: the pinned oldest claims a slot with priority
    // and the 99 newest unpinned fill the rest; the oldest UNPINNED
    // records are the ones evicted.
    expect(reloaded).toHaveLength(100)
    expect(reloaded.some(record => record.id === pinnedOldest.id)).toBe(true)
    expect(reloaded.some(record => record.id === records[1].id)).toBe(false)
    expect(reloaded.some(record => record.id === records[2].id)).toBe(false)
  })

  it('round-trips pinned documents through their own storage key', () => {
    const storage = new MemoryStorage()
    const pins = [{ id: 'draft-1', pinnedAt: '2026-07-08T00:00:00.000Z' }]

    writeStoredPinnedDocuments(pins, storage)

    expect(readStoredPinnedDocuments(storage)).toEqual(pins)
  })

  it('removes the pinned documents key when the last pin is cleared', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      PINNED_DOCUMENTS_STORAGE_KEY,
      JSON.stringify([{ id: 'draft-1', pinnedAt: '2026-07-08T00:00:00.000Z' }]),
    )

    writeStoredPinnedDocuments([], storage)

    expect(storage.getItem(PINNED_DOCUMENTS_STORAGE_KEY)).toBeNull()
  })
})
