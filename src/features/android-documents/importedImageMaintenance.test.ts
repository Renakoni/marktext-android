import { describe, expect, it, vi } from 'vitest'
import {
  ImportedImageCleanupBlockedError,
  cleanupUnusedImportedImages,
} from './importedImageMaintenance'

const cleanupResult = {
  fileCount: 1,
  bytes: 12,
  removedFileCount: 2,
  removedBytes: 34,
  failedFileCount: 0,
}

describe('imported image maintenance', () => {
  it('protects references from the current document, drafts, and readable recents', async () => {
    const readRecentMarkdown = vi.fn(async (sourceUri: string) => ({
      markdown: sourceUri.endsWith('/one')
        ? '![recent](marktext-image://local/recent.png)'
        : '![shared](marktext-image://local/shared.png)',
    }))
    const cleanup = vi.fn(async () => cleanupResult)

    await expect(cleanupUnusedImportedImages({
      currentDocument: {
        sourceUri: 'content://current',
        markdown: '![current](marktext-image://local/shared.png)',
      },
      localDrafts: [
        { markdown: '![draft](marktext-image://local/draft.png)' },
      ],
      recentDocuments: [
        { sourceUri: 'content://current' },
        { sourceUri: 'content://recent/one' },
        { sourceUri: 'content://recent/one' },
        { sourceUri: 'content://recent/two' },
        { sourceUri: null },
      ],
      readRecentMarkdown,
      cleanup,
    })).resolves.toEqual(cleanupResult)

    expect(readRecentMarkdown).toHaveBeenCalledTimes(2)
    expect(cleanup).toHaveBeenCalledWith([
      'shared.png',
      'draft.png',
      'recent.png',
    ])
  })

  it('deletes nothing when any tracked recent document cannot be checked', async () => {
    const cleanup = vi.fn(async () => cleanupResult)

    const operation = cleanupUnusedImportedImages({
      currentDocument: { sourceUri: null, markdown: '' },
      localDrafts: [],
      recentDocuments: [
        { sourceUri: 'content://recent/readable' },
        { sourceUri: 'content://recent/unreadable' },
      ],
      readRecentMarkdown: vi.fn(async sourceUri => {
        if (sourceUri.endsWith('/unreadable')) {
          throw new Error('permission lost')
        }
        return { markdown: '' }
      }),
      cleanup,
    })

    await expect(operation).rejects.toBeInstanceOf(ImportedImageCleanupBlockedError)
    await expect(operation).rejects.toMatchObject({
      code: 'RECENT_DOCUMENT_UNREADABLE',
      unreadableDocumentCount: 1,
    })

    expect(cleanup).not.toHaveBeenCalled()
  })
})
