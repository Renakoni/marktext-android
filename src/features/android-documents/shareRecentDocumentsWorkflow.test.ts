import { describe, expect, it, vi } from 'vitest'
import { shareRecentDocumentsWorkflow } from './shareRecentDocumentsWorkflow'
import { AndroidDocumentError, getAndroidDocumentUserMessage } from '../../lib/androidDocuments'
import type { RecentDocumentRecord } from '../../lib/recentDocuments'

const draftRecord: RecentDocumentRecord = {
  id: 'draft-1',
  kind: 'local-draft',
  displayName: 'Trip plan',
  title: 'Trip plan',
  sourceUri: null,
  providerName: 'Local draft',
  pathHint: null,
  markdownPreview: '# Shopping\n\n- milk',
  createdAt: '2026-07-08T00:00:00.000Z',
  updatedAt: '2026-07-08T00:00:00.000Z',
  lastOpenedAt: '2026-07-08T00:00:00.000Z',
  lastSavedAt: null,
  autosaveState: 'clean',
  canWrite: true,
}

const androidRecord: RecentDocumentRecord = {
  ...draftRecord,
  id: 'android-document:content://provider/notes.md',
  kind: 'android-document',
  displayName: 'notes.md',
  title: 'notes',
  sourceUri: 'content://provider/notes.md',
  providerName: 'Documents',
  pathHint: 'notes.md',
  markdownPreview: null,
}

const shareResult = {
  displayName: 'Trip plan.md',
  mimeType: 'text/markdown',
  bytes: 20,
  imageCount: 0,
  sharedFileCount: 1,
}

function createWorkflowOptions() {
  return {
    readAndroidMarkdownDocument: vi.fn().mockResolvedValue({ markdown: '# Android note' }),
    shareAndroidMarkdownDocument: vi.fn().mockResolvedValue(shareResult),
    shareAndroidMarkdownDocuments: vi
      .fn()
      .mockResolvedValue({ ...shareResult, sharedFileCount: 2 }),
    getAndroidDocumentUserMessage,
    imageSharingSettings: { shareImages: 'attach' as const },
  }
}

describe('shareRecentDocumentsWorkflow', () => {
  it('shares a single draft through the image-capable share path', async () => {
    const options = createWorkflowOptions()

    const result = await shareRecentDocumentsWorkflow({
      documents: [draftRecord],
      ...options,
    })

    expect(result.kind).toBe('shared')
    expect(options.shareAndroidMarkdownDocument).toHaveBeenCalledWith(
      '# Shopping\n\n- milk',
      'Trip plan.md',
      { attachImages: true, encoding: 'utf8' },
    )
    expect(options.shareAndroidMarkdownDocuments).not.toHaveBeenCalled()
  })

  it('shares multiple documents as markdown files, reading Android content fresh', async () => {
    const options = createWorkflowOptions()

    const result = await shareRecentDocumentsWorkflow({
      documents: [draftRecord, androidRecord],
      ...options,
    })

    expect(result.kind).toBe('shared')
    expect(options.readAndroidMarkdownDocument).toHaveBeenCalledWith(
      'content://provider/notes.md',
    )
    expect(options.shareAndroidMarkdownDocuments).toHaveBeenCalledWith(
      [
        { markdown: '# Shopping\n\n- milk', suggestedName: 'Trip plan.md' },
        { markdown: '# Android note', suggestedName: 'notes.md' },
      ],
      { encoding: 'utf8' },
    )
    expect(options.shareAndroidMarkdownDocument).not.toHaveBeenCalled()
  })

  it('fails the whole share when any Android document cannot be read', async () => {
    const options = createWorkflowOptions()
    const error = new AndroidDocumentError(
      'DOCUMENT_NOT_FOUND',
      'This Android document was moved or deleted',
    )
    options.readAndroidMarkdownDocument.mockRejectedValue(error)

    const result = await shareRecentDocumentsWorkflow({
      documents: [draftRecord, androidRecord],
      ...options,
    })

    expect(result).toMatchObject({
      kind: 'failed',
      status: 'This file was moved or deleted. Open it again from Android.',
      error,
    })
    expect(options.shareAndroidMarkdownDocuments).not.toHaveBeenCalled()
  })

  it('respects the link-only image sharing setting for single shares', async () => {
    const options = createWorkflowOptions()

    await shareRecentDocumentsWorkflow({
      documents: [draftRecord],
      ...options,
      imageSharingSettings: { shareImages: 'link-only' },
    })

    expect(options.shareAndroidMarkdownDocument).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      { attachImages: false, encoding: 'utf8' },
    )
  })

  it('fails when nothing is selected', async () => {
    const options = createWorkflowOptions()

    const result = await shareRecentDocumentsWorkflow({ documents: [], ...options })

    expect(result.kind).toBe('failed')
  })
})
