import { describe, expect, it } from 'vitest'
import {
  normalizeLocalDrafts,
  parseLocalDrafts,
  removeLocalDraft,
  serializeLocalDrafts,
  upsertLocalDraft,
  type LocalDraftRecord,
} from './localDrafts'

const olderDraft: LocalDraftRecord = {
  id: 'older',
  markdown: '# Older draft\n\nhello',
  updatedAt: '2026-06-29T00:00:00.000Z',
  lastSavedAt: '2026-06-29T00:00:00.000Z',
}

const newerDraft: LocalDraftRecord = {
  id: 'newer',
  markdown: '# Newer draft\n\n你好',
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

  it('upserts drafts by id and keeps the latest markdown', () => {
    const drafts = upsertLocalDraft([olderDraft], {
      ...olderDraft,
      markdown: '# Updated draft',
      updatedAt: '2026-06-29T00:03:00.000Z',
    })

    expect(drafts).toHaveLength(1)
    expect(drafts[0].markdown).toBe('# Updated draft')
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
})
