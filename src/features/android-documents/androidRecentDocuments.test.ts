import { describe, expect, it } from 'vitest'
import {
  markSavedAndroidRecentDocument,
  rememberAndroidRecentDocument,
} from './androidRecentDocuments'
import type { RecentDocumentRecord } from '../../lib/recentDocuments'

const existingAndroidDocument: RecentDocumentRecord = {
  id: 'android-document:content://provider/old.md',
  kind: 'android-document',
  displayName: 'old.md',
  title: 'Old',
  sourceUri: 'content://provider/old.md',
  providerName: 'Documents',
  pathHint: 'Documents/old.md',
  markdownPreview: null,
  updatedAt: '2026-07-02T00:00:00.000Z',
  lastOpenedAt: '2026-07-02T00:00:00.000Z',
  lastSavedAt: null,
  autosaveState: 'dirty',
  canWrite: false,
}

describe('androidRecentDocuments', () => {
  it('remembers Android documents without storing their Markdown content', () => {
    const records = rememberAndroidRecentDocument([], {
      sourceUri: 'content://provider/note.md',
      displayName: 'note.md',
      providerName: 'Documents',
      pathHint: 'Documents/note.md',
      markdown: '# Android note\n\nbody',
      canWrite: true,
    })

    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      id: 'android-document:content://provider/note.md',
      kind: 'android-document',
      title: 'Android note',
      sourceUri: 'content://provider/note.md',
      markdownPreview: null,
      canWrite: true,
      autosaveState: 'clean',
    })
  })

  it('updates saved Android recent metadata by source URI', () => {
    const records = markSavedAndroidRecentDocument(
      [existingAndroidDocument],
      'content://provider/old.md',
      {
        markdown: '# Saved title\n\nbody',
        savedAt: '2026-07-02T00:03:00.000Z',
        canWrite: true,
      },
    )

    expect(records).not.toBeNull()
    expect(records?.[0]).toMatchObject({
      title: 'Saved title',
      updatedAt: '2026-07-02T00:03:00.000Z',
      lastSavedAt: '2026-07-02T00:03:00.000Z',
      autosaveState: 'clean',
      markdownPreview: null,
      canWrite: true,
    })
  })

  it('returns null when the saved Android recent record is missing', () => {
    expect(
      markSavedAndroidRecentDocument([existingAndroidDocument], 'content://provider/missing.md', {
        markdown: '# Missing',
        savedAt: '2026-07-02T00:03:00.000Z',
        canWrite: true,
      }),
    ).toBeNull()
  })
})
