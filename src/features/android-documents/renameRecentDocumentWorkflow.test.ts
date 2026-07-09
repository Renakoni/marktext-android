import { describe, expect, it, vi } from 'vitest'
import { renameAndroidRecentDocumentWorkflow } from './renameRecentDocumentWorkflow'
import { AndroidDocumentError, getAndroidDocumentUserMessage } from '../../lib/androidDocuments'
import type { RecentDocumentRecord } from '../../lib/recentDocuments'

const androidRecord: RecentDocumentRecord = {
  id: 'android-document:content://provider/notes.md',
  kind: 'android-document',
  displayName: 'notes.md',
  title: 'notes',
  sourceUri: 'content://provider/notes.md',
  providerName: 'Documents',
  pathHint: 'notes.md',
  markdownPreview: null,
  createdAt: '2026-07-08T00:00:00.000Z',
  updatedAt: '2026-07-08T00:00:00.000Z',
  lastOpenedAt: '2026-07-08T00:00:00.000Z',
  lastSavedAt: null,
  autosaveState: 'clean',
  canWrite: true,
}

describe('renameRecentDocumentWorkflow', () => {
  it('renames an Android document and migrates the record to the new URI', async () => {
    const readAndroidMarkdownDocument = vi.fn().mockResolvedValue({
      markdown: 'Body without a heading.',
    })
    const renameAndroidMarkdownDocument = vi.fn().mockResolvedValue({
      sourceUri: 'content://provider/trip-plan.md',
      displayName: 'trip-plan.md',
      providerName: 'Documents',
      pathHint: 'trip-plan.md',
      canWrite: true,
      persisted: true,
    })

    const result = await renameAndroidRecentDocumentWorkflow({
      record: androidRecord,
      newName: 'trip-plan',
      readAndroidMarkdownDocument,
      renameAndroidMarkdownDocument,
      getAndroidDocumentUserMessage,
    })

    expect(readAndroidMarkdownDocument).toHaveBeenCalledWith(
      'content://provider/notes.md',
    )
    expect(renameAndroidMarkdownDocument).toHaveBeenCalledWith(
      'content://provider/notes.md',
      'trip-plan',
    )
    expect(result).toMatchObject({
      kind: 'renamed',
      previousId: 'android-document:content://provider/notes.md',
      accessRetained: true,
      updatedRecord: {
        id: 'android-document:content://provider/trip-plan.md',
        sourceUri: 'content://provider/trip-plan.md',
        displayName: 'trip-plan.md',
        title: 'trip-plan',
      },
    })
  })

  it('reports when the provider kept only temporary access to the renamed URI', async () => {
    const result = await renameAndroidRecentDocumentWorkflow({
      record: androidRecord,
      newName: 'trip-plan',
      readAndroidMarkdownDocument: vi.fn().mockResolvedValue({
        markdown: 'Body without a heading.',
      }),
      renameAndroidMarkdownDocument: vi.fn().mockResolvedValue({
        sourceUri: 'content://provider/trip-plan.md',
        displayName: 'trip-plan.md',
        providerName: 'Documents',
        pathHint: 'trip-plan.md',
        canWrite: true,
        persisted: false,
      }),
      getAndroidDocumentUserMessage,
    })

    // The file is renamed either way; callers must surface the access loss.
    expect(result).toMatchObject({ kind: 'renamed', accessRetained: false })
  })

  it('keeps a heading-derived title when the file name changes', async () => {
    const result = await renameAndroidRecentDocumentWorkflow({
      record: { ...androidRecord, title: 'Trip to Paris' },
      newName: 'summer',
      readAndroidMarkdownDocument: vi.fn().mockResolvedValue({
        markdown: '# Trip to Paris\n\nBody.',
      }),
      renameAndroidMarkdownDocument: vi.fn().mockResolvedValue({
        sourceUri: 'content://provider/summer.md',
        displayName: 'summer.md',
        providerName: 'Documents',
        pathHint: 'summer.md',
        canWrite: true,
        persisted: false,
      }),
      getAndroidDocumentUserMessage,
    })

    expect(result.kind).toBe('renamed')
    if (result.kind === 'renamed') {
      expect(result.updatedRecord.title).toBe('Trip to Paris')
      expect(result.updatedRecord.displayName).toBe('summer.md')
    }
  })

  it('keeps a heading-derived title when it matches the old file name', async () => {
    const result = await renameAndroidRecentDocumentWorkflow({
      record: androidRecord,
      newName: 'trip-plan',
      readAndroidMarkdownDocument: vi.fn().mockResolvedValue({
        markdown: '# notes\n\nBody.',
      }),
      renameAndroidMarkdownDocument: vi.fn().mockResolvedValue({
        sourceUri: 'content://provider/trip-plan.md',
        displayName: 'trip-plan.md',
        providerName: 'Documents',
        pathHint: 'trip-plan.md',
        canWrite: true,
        persisted: true,
      }),
      getAndroidDocumentUserMessage,
    })

    expect(result.kind).toBe('renamed')
    if (result.kind === 'renamed') {
      expect(result.updatedRecord.title).toBe('notes')
      expect(result.updatedRecord.displayName).toBe('trip-plan.md')
    }
  })

  it('maps provider rename failures to a user message', async () => {
    const error = new AndroidDocumentError(
      'DOCUMENT_RENAME_UNSUPPORTED',
      'This Android storage provider does not support renaming',
    )

    const result = await renameAndroidRecentDocumentWorkflow({
      record: androidRecord,
      newName: 'trip-plan',
      readAndroidMarkdownDocument: vi.fn().mockResolvedValue({
        markdown: 'Body without a heading.',
      }),
      renameAndroidMarkdownDocument: vi.fn().mockRejectedValue(error),
      getAndroidDocumentUserMessage,
    })

    expect(result).toMatchObject({
      kind: 'failed',
      status: 'This file’s storage location does not support renaming.',
      error,
    })
  })

  it('does not rename when the current document cannot be read first', async () => {
    const error = new AndroidDocumentError(
      'DOCUMENT_PERMISSION_LOST',
      'Android document permission is no longer available',
    )
    const renameAndroidMarkdownDocument = vi.fn()

    const result = await renameAndroidRecentDocumentWorkflow({
      record: androidRecord,
      newName: 'trip-plan',
      readAndroidMarkdownDocument: vi.fn().mockRejectedValue(error),
      renameAndroidMarkdownDocument,
      getAndroidDocumentUserMessage,
    })

    expect(result).toMatchObject({
      kind: 'failed',
      status: 'Reopen this file from Android before saving again.',
      error,
    })
    expect(renameAndroidMarkdownDocument).not.toHaveBeenCalled()
  })

  it('rejects records that are not Android documents', async () => {
    const readAndroidMarkdownDocument = vi.fn()
    const renameAndroidMarkdownDocument = vi.fn()

    const result = await renameAndroidRecentDocumentWorkflow({
      record: { ...androidRecord, kind: 'local-draft', sourceUri: null },
      newName: 'trip-plan',
      readAndroidMarkdownDocument,
      renameAndroidMarkdownDocument,
      getAndroidDocumentUserMessage,
    })

    expect(result.kind).toBe('failed')
    expect(readAndroidMarkdownDocument).not.toHaveBeenCalled()
    expect(renameAndroidMarkdownDocument).not.toHaveBeenCalled()
  })
})
