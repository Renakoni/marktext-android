import { describe, expect, it } from 'vitest'
import {
  assignUntitledDraftNames,
  normalizeLocalDrafts,
  parseLocalDrafts,
  removeLocalDraft,
  renameLocalDraft,
  serializeLocalDrafts,
  upsertLocalDraft,
  type LocalDraftRecord,
} from './localDrafts'

const olderDraft: LocalDraftRecord = {
  id: 'older',
  markdown: '# Older draft\n\nhello',
  createdAt: '2026-06-28T23:59:00.000Z',
  updatedAt: '2026-06-29T00:00:00.000Z',
  lastSavedAt: '2026-06-29T00:00:00.000Z',
}

const newerDraft: LocalDraftRecord = {
  id: 'newer',
  markdown: '# Newer draft\n\n你好',
  createdAt: '2026-06-29T00:01:00.000Z',
  updatedAt: '2026-06-29T00:02:00.000Z',
  lastSavedAt: '2026-06-29T00:02:00.000Z',
}

describe('localDrafts', () => {
  it('parses invalid storage values as an empty draft list', () => {
    expect(parseLocalDrafts('not-json')).toEqual([])
    expect(parseLocalDrafts(JSON.stringify({ id: 'not-array' }))).toEqual([])
  })

  it('sorts drafts newest first and removes empty drafts', () => {
    const drafts = normalizeLocalDrafts([
      olderDraft,
      { ...newerDraft, markdown: '   ' },
      newerDraft,
    ])

    expect(drafts.map(draft => draft.id)).toEqual(['newer', 'older'])
  })

  it('migrates legacy untitled drafts to distinct gap-filled numbers', () => {
    const untitledOld: LocalDraftRecord = {
      id: 'u-old',
      markdown: '```\n```',
      createdAt: '2026-06-28T00:00:00.000Z',
      updatedAt: '2026-06-28T00:00:00.000Z',
      lastSavedAt: null,
    }
    const untitledNew: LocalDraftRecord = {
      ...untitledOld,
      id: 'u-new',
      createdAt: '2026-06-30T00:00:00.000Z',
    }
    const migrated = assignUntitledDraftNames([
      untitledNew,
      untitledOld,
      olderDraft, // has a content title — keeps deriving it, earns no number
      { ...newerDraft, id: 'held', markdown: '```\n```', displayName: 'Untitled-1' }, // frozen
    ])

    const byId = new Map(migrated.map(draft => [draft.id, draft.displayName]))
    // Oldest untitled first, filling around the already-held number 1.
    expect(byId.get('u-old')).toBe('Untitled-2')
    expect(byId.get('u-new')).toBe('Untitled-3')
    expect(byId.get('held')).toBe('Untitled-1')
    expect(byId.get('older')).toBeUndefined()
  })

  it('leaves the draft list untouched when no untitled draft needs a number', () => {
    const drafts = [olderDraft, { ...newerDraft, displayName: 'Trip plan' }]
    expect(assignUntitledDraftNames(drafts)).toBe(drafts)
  })

  it('upserts drafts by id and keeps the latest markdown', () => {
    const drafts = upsertLocalDraft([olderDraft], {
      ...olderDraft,
      markdown: '# Updated draft',
      updatedAt: '2026-06-29T00:03:00.000Z',
    })

    expect(drafts).toHaveLength(1)
    expect(drafts[0].markdown).toBe('# Updated draft')
    expect(drafts[0].createdAt).toBe(olderDraft.createdAt)
  })

  it('migrates legacy draft records without created time', () => {
    const legacyDraft = {
      id: 'legacy',
      markdown: '# Legacy draft',
      updatedAt: '2026-06-29T00:04:00.000Z',
      lastSavedAt: null,
    }

    expect(parseLocalDrafts(JSON.stringify([legacyDraft]))[0]).toMatchObject({
      ...legacyDraft,
      createdAt: legacyDraft.updatedAt,
    })
  })

  it('removes drafts by id', () => {
    expect(removeLocalDraft([olderDraft, newerDraft], 'older').map(draft => draft.id)).toEqual([
      'newer',
    ])
  })

  it('serializes normalized drafts for local storage', () => {
    const serialized = serializeLocalDrafts([olderDraft, newerDraft])

    expect(parseLocalDrafts(serialized).map(draft => draft.id)).toEqual(['newer', 'older'])
  })

  it('renames drafts and trims the chosen name', () => {
    const drafts = renameLocalDraft([olderDraft, newerDraft], 'older', '  Trip plan  ')

    expect(drafts.find(draft => draft.id === 'older')?.displayName).toBe('Trip plan')
    expect(drafts.find(draft => draft.id === 'newer')?.displayName).toBeUndefined()
    // Renaming is a metadata change, not an edit — it must not reorder the list.
    expect(drafts.find(draft => draft.id === 'older')?.updatedAt).toBe(olderDraft.updatedAt)
  })

  it('ignores empty rename requests', () => {
    const renamed = renameLocalDraft([olderDraft], 'older', 'Trip plan')

    expect(renameLocalDraft(renamed, 'older', '   ')).toEqual(renamed)
  })

  it('keeps a rename through storage round-trips and content upserts', () => {
    const renamed = renameLocalDraft([olderDraft], 'older', 'Trip plan')

    expect(parseLocalDrafts(serializeLocalDrafts(renamed))[0].displayName).toBe('Trip plan')

    const updated = upsertLocalDraft(renamed, {
      ...olderDraft,
      markdown: '# Updated content',
      updatedAt: '2026-06-29T00:05:00.000Z',
    })
    expect(updated[0].displayName).toBe('Trip plan')
  })
})
