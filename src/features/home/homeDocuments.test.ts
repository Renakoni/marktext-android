import { describe, expect, it } from 'vitest'
import {
  formatHomeDocumentSavedTime,
  partitionHomeDocumentItems,
  toHomeDocumentItem,
} from './homeDocuments'
import type { RecentDocumentListItem } from '../../lib/recentDocuments'

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
      createdAt: '2024-01-01T10:00:00.000Z',
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
      kind: 'local-draft',
      title: 'Draft',
      displayName: 'draft.md',
      details: 'Local draft - 1 word',
    })
  })

  it('keeps a canonical Untitled-N verbatim on every surface, never localized', () => {
    const base: RecentDocumentListItem = {
      id: 'draft-1',
      kind: 'local-draft',
      displayName: 'Untitled-2',
      title: 'Untitled-2',
      sourceUri: null,
      providerName: 'Local draft',
      pathHint: null,
      markdownPreview: '```\n```',
      createdAt: '2024-01-01T10:00:00.000Z',
      updatedAt: '2024-01-01T10:00:00.000Z',
      lastOpenedAt: '2024-01-01T10:00:00.000Z',
      lastSavedAt: null,
      autosaveState: 'clean',
      canWrite: true,
      stats: null,
    }
    const zh = {
      localDraftSource: '本地草稿',
      markdownDocumentSource: 'Markdown 文档',
      detailsSeparator: ' · ',
      formatWordCount: (count: number) => `${count} 字`,
    }

    // A titleless draft, and a real Android file whose own name is Untitled-2,
    // both keep the canonical value — no locale-specific rendering.
    expect(toHomeDocumentItem(base, zh).title).toBe('Untitled-2')
    expect(
      toHomeDocumentItem(
        { ...base, kind: 'android-document', markdownPreview: null },
        zh,
      ).title,
    ).toBe('Untitled-2')
  })

  it('keeps the masthead pin-agnostic and floats pinned documents above Earlier', () => {
    const items = [{ id: 'newest' }, { id: 'older-pin' }, { id: 'plain' }, { id: 'newer-pin' }]

    const sections = partitionHomeDocumentItems(items, new Set(['older-pin', 'newer-pin']))

    expect(sections.continueItem?.id).toBe('newest')
    // Pinned block preserves the list's own (chronological) order.
    expect(sections.pinnedItems.map(item => item.id)).toEqual(['older-pin', 'newer-pin'])
    expect(sections.earlierItems.map(item => item.id)).toEqual(['plain'])
  })

  it('keeps a pinned masthead in the Continue spot without duplicating it', () => {
    const items = [{ id: 'pinned-newest' }, { id: 'plain' }]

    const sections = partitionHomeDocumentItems(items, new Set(['pinned-newest']))

    expect(sections.continueItem?.id).toBe('pinned-newest')
    expect(sections.pinnedItems).toEqual([])
    expect(sections.earlierItems.map(item => item.id)).toEqual(['plain'])
  })

  it('partitions an empty list into empty sections', () => {
    const sections = partitionHomeDocumentItems([], new Set())

    expect(sections).toEqual({ continueItem: null, pinnedItems: [], earlierItems: [] })
  })

  it('formats empty saved times as blank text', () => {
    expect(formatHomeDocumentSavedTime(null)).toBe('')
    expect(formatHomeDocumentSavedTime('not-a-date')).toBe('')
  })

  it('formats app-owned recent draft details with localized presentation text', () => {
    const item: RecentDocumentListItem = {
      id: 'draft-1',
      kind: 'local-draft',
      displayName: 'draft.md',
      title: 'Draft',
      sourceUri: null,
      providerName: 'Local draft',
      pathHint: null,
      markdownPreview: '# Draft',
      createdAt: '2024-01-01T10:00:00.000Z',
      updatedAt: 'not-a-date',
      lastOpenedAt: 'not-a-date',
      lastSavedAt: null,
      autosaveState: 'clean',
      canWrite: true,
      stats: {
        words: 2,
        characters: 7,
        lines: 1,
      },
    }

    expect(
      toHomeDocumentItem(item, {
        localDraftSource: '本地草稿',
        markdownDocumentSource: 'Markdown 文档',
        detailsSeparator: ' · ',
        formatWordCount: count => `${count} 字`,
      }),
    ).toEqual({
      id: 'draft-1',
      kind: 'local-draft',
      title: 'Draft',
      displayName: 'draft.md',
      details: '本地草稿 · 2 字',
    })
  })
})
