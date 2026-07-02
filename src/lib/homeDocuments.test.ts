import { describe, expect, it } from 'vitest'
import { formatHomeDocumentSavedTime, toHomeDocumentItem } from './homeDocuments'
import type { RecentDocumentListItem } from './recentDocuments'

describe('homeDocuments', () => {
  it('omits invalid saved times from document list details', () => {
    const item: RecentDocumentListItem = {
      id: 'draft-1',
      kind: 'local-draft',
      displayName: 'draft.md',
      title: 'Draft',
      sourceUri: null,
      providerName: 'Local draft',
      pathHint: null,
      markdownPreview: '# Draft',
      updatedAt: 'not-a-date',
      lastOpenedAt: 'not-a-date',
      lastSavedAt: null,
      autosaveState: 'clean',
      canWrite: true,
      stats: {
        words: 1,
        characters: 7,
        lines: 1,
      },
    }

    expect(toHomeDocumentItem(item)).toEqual({
      id: 'draft-1',
      title: 'Draft',
      details: 'Local draft - 1 word',
    })
  })

  it('formats empty saved times as blank text', () => {
    expect(formatHomeDocumentSavedTime(null)).toBe('')
    expect(formatHomeDocumentSavedTime('not-a-date')).toBe('')
  })
})
