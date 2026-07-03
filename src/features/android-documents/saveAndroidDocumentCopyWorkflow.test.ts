import { describe, expect, it, vi } from 'vitest'
import { createUntitledDocument, updateDocumentMarkdown } from '../../lib/documentState'
import { saveAndroidDocumentCopyWorkflow } from './saveAndroidDocumentCopyWorkflow'
import type { OpenedAndroidDocument } from '../../lib/androidDocuments'

function createAndroidDocumentState(markdown = '# Original\n\nbody') {
  return createUntitledDocument({
    markdown,
    displayName: 'Original.md',
    sourceUri: 'content://provider/original.md',
    autosaveTarget: 'android-document',
    now: '2026-07-02T00:00:00.000Z',
  })
}

function createDirtyAndroidDocumentState(markdown = '# Original\n\nbody\n\nchanged') {
  return updateDocumentMarkdown(createAndroidDocumentState(), markdown, {
    markDirty: true,
    now: '2026-07-02T00:01:00.000Z',
  })
}

const persistedDocument: OpenedAndroidDocument = {
  canceled: false,
  sourceUri: 'content://provider/original-copy.md',
  displayName: 'Original copy.md',
  providerName: 'Documents',
  pathHint: 'Documents/Original copy.md',
  mimeType: 'text/markdown',
  markdown: 'plugin markdown',
  canWrite: true,
  persisted: true,
}

describe('saveAndroidDocumentCopyWorkflow', () => {
  it('creates Android Markdown copy with an incremented suggested file name and handles cancelation', async () => {
    const createAndroidMarkdownDocument = vi.fn().mockResolvedValue({ canceled: true })

    const result = await saveAndroidDocumentCopyWorkflow({
      copySourceDocument: createAndroidDocumentState('# Original Save Copy\n\nbody'),
      originalSourceUri: 'content://provider/original.md',
      reservedDisplayNames: ['Original Save Copy copy.md'],
      returnHomeAfterSave: true,
      transientAccessMessage: 'transient',
      createAndroidMarkdownDocument,
      getAndroidDocumentUserMessage: () => 'failed',
    })

    expect(createAndroidMarkdownDocument).toHaveBeenCalledWith(
      '# Original Save Copy\n\nbody',
      'Original Save Copy copy 2.md',
    )
    expect(result).toEqual({
      kind: 'canceled',
    })
  })

  it('keeps a recovery draft request when the copy is created without persisted access', async () => {
    const transientDocument = {
      ...persistedDocument,
      sourceUri: 'content://provider/transient-copy.md',
      displayName: 'Transient copy.md',
      persisted: false,
    }

    const result = await saveAndroidDocumentCopyWorkflow({
      copySourceDocument: createDirtyAndroidDocumentState(),
      originalSourceUri: 'content://provider/original.md',
      reservedDisplayNames: [],
      returnHomeAfterSave: true,
      transientAccessMessage: 'Saved transiently',
      createAndroidMarkdownDocument: vi.fn().mockResolvedValue(transientDocument),
      getAndroidDocumentUserMessage: () => 'failed',
    })

    expect(result).toMatchObject({
      kind: 'transient',
      status: 'Saved transiently',
      createdDocument: {
        sourceUri: 'content://provider/transient-copy.md',
        markdown: '# Original\n\nbody\n\nchanged',
      },
      recoveryDraft: {
        sourceUri: 'content://provider/original.md',
        markdown: '# Original\n\nbody\n\nchanged',
      },
    })
  })

  it('returns the saved copy state and recovery draft removal source', async () => {
    const result = await saveAndroidDocumentCopyWorkflow({
      copySourceDocument: createDirtyAndroidDocumentState(),
      originalSourceUri: 'content://provider/original.md',
      reservedDisplayNames: [],
      returnHomeAfterSave: true,
      transientAccessMessage: 'transient',
      createAndroidMarkdownDocument: vi.fn().mockResolvedValue(persistedDocument),
      getAndroidDocumentUserMessage: () => 'failed',
      now: () => '2026-07-02T00:03:00.000Z',
    })

    expect(result).toMatchObject({
      kind: 'saved',
      canWrite: true,
      removeRecoveryDraftSourceUri: 'content://provider/original.md',
      closeEditorToHome: true,
      createdDocument: {
        sourceUri: 'content://provider/original-copy.md',
        markdown: '# Original\n\nbody\n\nchanged',
      },
      savedDocument: {
        id: 'android-document:content://provider/original-copy.md',
        autosaveTarget: 'android-document',
        autosaveState: 'clean',
        isDirty: false,
        lastSavedAt: '2026-07-02T00:03:00.000Z',
      },
    })
  })

  it('returns failed document state, status, and recovery draft request on save-copy failure', async () => {
    const result = await saveAndroidDocumentCopyWorkflow({
      copySourceDocument: createDirtyAndroidDocumentState(),
      originalSourceUri: 'content://provider/original.md',
      reservedDisplayNames: [],
      returnHomeAfterSave: false,
      transientAccessMessage: 'transient',
      createAndroidMarkdownDocument: vi.fn().mockRejectedValue(new Error('creator failed')),
      getAndroidDocumentUserMessage: error => `message: ${(error as Error).message}`,
    })

    expect(result).toMatchObject({
      kind: 'failed',
      status: 'message: creator failed',
      failedDocument: {
        isDirty: true,
        autosaveState: 'save-failed',
        lastSaveError: 'creator failed',
      },
      recoveryDraft: {
        sourceUri: 'content://provider/original.md',
        markdown: '# Original\n\nbody\n\nchanged',
      },
    })
  })
})
