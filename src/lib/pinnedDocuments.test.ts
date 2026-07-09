import { describe, expect, it } from 'vitest'
import {
  areAllDocumentsPinned,
  getPinnedDocumentIds,
  normalizePinnedDocuments,
  parsePinnedDocuments,
  prunePinnedDocuments,
  serializePinnedDocuments,
  togglePinnedDocuments,
} from './pinnedDocuments'

const pins = [
  { id: 'draft-1', pinnedAt: '2026-07-01T00:00:00.000Z' },
  { id: 'android-document:content://provider/notes.md', pinnedAt: '2026-07-02T00:00:00.000Z' },
]

describe('pinnedDocuments', () => {
  it('parses stored pins and drops malformed entries', () => {
    const stored = JSON.stringify([...pins, { id: 42 }, { pinnedAt: 'x' }, 'junk', null])

    expect(parsePinnedDocuments(stored)).toEqual([pins[1], pins[0]])
  })

  it('returns no pins for missing or corrupt storage values', () => {
    expect(parsePinnedDocuments(null)).toEqual([])
    expect(parsePinnedDocuments('{not json')).toEqual([])
    expect(parsePinnedDocuments('{"id":"draft-1"}')).toEqual([])
  })

  it('deduplicates by id keeping the most recent pin time', () => {
    const normalized = normalizePinnedDocuments([
      { id: 'draft-1', pinnedAt: '2026-07-01T00:00:00.000Z' },
      { id: 'draft-1', pinnedAt: '2026-07-03T00:00:00.000Z' },
    ])

    expect(normalized).toEqual([{ id: 'draft-1', pinnedAt: '2026-07-03T00:00:00.000Z' }])
  })

  it('round-trips through serialization', () => {
    expect(parsePinnedDocuments(serializePinnedDocuments(pins))).toEqual([pins[1], pins[0]])
  })

  it('pins the unpinned part of a mixed selection', () => {
    const next = togglePinnedDocuments(pins, ['draft-1', 'draft-2'], '2026-07-04T00:00:00.000Z')

    expect(getPinnedDocumentIds(next)).toEqual(
      new Set(['draft-1', 'draft-2', 'android-document:content://provider/notes.md']),
    )
    // The already-pinned draft keeps its original pin time.
    expect(next.find(record => record.id === 'draft-1')?.pinnedAt).toBe(
      '2026-07-01T00:00:00.000Z',
    )
  })

  it('unpins a selection that is already fully pinned', () => {
    const next = togglePinnedDocuments(pins, ['draft-1'], '2026-07-04T00:00:00.000Z')

    expect(next).toEqual([pins[1]])
  })

  it('treats an empty selection as a no-op pin', () => {
    expect(areAllDocumentsPinned(pins, [])).toBe(false)
    expect(togglePinnedDocuments(pins, [], '2026-07-04T00:00:00.000Z')).toEqual([
      pins[1],
      pins[0],
    ])
  })

  it('prunes pins for documents that no longer exist', () => {
    expect(prunePinnedDocuments(pins, ['draft-1'])).toEqual([pins[0]])
  })
})
