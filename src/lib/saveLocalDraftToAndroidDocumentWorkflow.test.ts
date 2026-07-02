import { describe, expect, it, vi } from 'vitest'
import { createUntitledDocument, updateDocumentMarkdown } from './documentState'
import { saveLocalDraftToAndroidDocumentWorkflow } from './saveLocalDraftToAndroidDocumentWorkflow'
import type { OpenedAndroidDocument } from './androidDocuments'

function createDraftDocument(markdown = '# Draft\n\nbody') {
  return updateDocumentMarkdown(
    createUntitledDocument({
      markdown,
      displayName: 'Draft.md',
      autosaveTarget: 'local-draft',
      now: '2026-07-02T00:00:00.000Z',
    }),
    markdown,
    { markDirty: false, now: '2026-07-02T00:01:00.000Z' },
  )
}

const persistedDocument: OpenedAndroidDocument = {
  canceled: false,
  sourceUri: 'content://provider/draft.md',
  displayName: 'Draft.md',
  providerName: 'Documents',
  pathHint: 'Documents/Draft.md',
  mimeType: 'text/markdown',
  markdown: '# Draft\n\nbody',
  canWrite: true,
  persisted: true,
}

describe('saveLocalDraftToAndroidDocumentWorkflow', () => {
  it('returns empty without opening Android create when the draft has no content', async () => {
    const createAndroidMarkdownDocument = vi.fn()

    const result = await saveLocalDraftToAndroidDocumentWorkflow({
      draftDocument: createDraftDocument('   \n'),
      returnHomeAfterSave: false,
      reopenPromptOnCancel: false,
      transientAccessMessage: 'transient',
      createAndroidMarkdownDocument,
      getAndroidDocumentUserMessage: () => 'failed',
    })

    expect(result).toEqual({
      kind: 'empty',
      status: 'Ready',
    })
    expect(createAndroidMarkdownDocument).not.toHaveBeenCalled()
  })

  it('creates Android Markdown with the suggested file name and handles cancelation', async () => {
    const createAndroidMarkdownDocument = vi.fn().mockResolvedValue({ canceled: true })

    const result = await saveLocalDraftToAndroidDocumentWorkflow({
      draftDocument: createDraftDocument('# Saved Draft\r\n\r\nbody\r\n'),
      returnHomeAfterSave: true,
      reopenPromptOnCancel: true,
      transientAccessMessage: 'transient',
      createAndroidMarkdownDocument,
      getAndroidDocumentUserMessage: () => 'failed',
    })

    expect(createAndroidMarkdownDocument).toHaveBeenCalledWith(
      '# Saved Draft\r\n\r\nbody\r\n',
      'Saved Draft.md',
    )
    expect(result).toEqual({
      kind: 'canceled',
      status: 'Autosaved locally',
      reopenPrompt: true,
    })
  })

  it('keeps the local draft when Android does not grant persisted access', async () => {
    const transientDocument = {
      ...persistedDocument,
      sourceUri: 'content://provider/transient.md',
      persisted: false,
    }

    const result = await saveLocalDraftToAndroidDocumentWorkflow({
      draftDocument: createDraftDocument(),
      returnHomeAfterSave: true,
      reopenPromptOnCancel: false,
      transientAccessMessage: 'Saved transiently',
      createAndroidMarkdownDocument: vi.fn().mockResolvedValue(transientDocument),
      getAndroidDocumentUserMessage: () => 'failed',
    })

    expect(result).toMatchObject({
      kind: 'transient',
      status: 'Saved transiently',
      homeNotice: 'Saved transiently',
      closeEditorToHome: true,
      createdDocument: {
        sourceUri: 'content://provider/transient.md',
        markdown: '# Draft\n\nbody',
      },
    })
  })

  it('returns the saved Android document state and local draft removal id', async () => {
    const draftDocument = createDraftDocument()

    const result = await saveLocalDraftToAndroidDocumentWorkflow({
      draftDocument,
      returnHomeAfterSave: false,
      reopenPromptOnCancel: false,
      transientAccessMessage: 'transient',
      createAndroidMarkdownDocument: vi.fn().mockResolvedValue(persistedDocument),
      getAndroidDocumentUserMessage: () => 'failed',
      now: () => '2026-07-02T00:03:00.000Z',
    })

    expect(result).toMatchObject({
      kind: 'saved',
      removeLocalDraftId: draftDocument.id,
      canWrite: true,
      closeEditorToHome: false,
      createdDocument: {
        sourceUri: 'content://provider/draft.md',
        markdown: '# Draft\n\nbody',
      },
      savedDocument: {
        id: 'android-document:content://provider/draft.md',
        autosaveTarget: 'android-document',
        autosaveState: 'clean',
        isDirty: false,
        lastSavedAt: '2026-07-02T00:03:00.000Z',
      },
    })
  })

  it('returns failed document state and user-facing error status', async () => {
    const result = await saveLocalDraftToAndroidDocumentWorkflow({
      draftDocument: createDraftDocument(),
      returnHomeAfterSave: true,
      reopenPromptOnCancel: true,
      transientAccessMessage: 'transient',
      createAndroidMarkdownDocument: vi.fn().mockRejectedValue(new Error('permission lost')),
      getAndroidDocumentUserMessage: error => `message: ${(error as Error).message}`,
    })

    expect(result).toMatchObject({
      kind: 'failed',
      status: 'message: permission lost',
      reopenPrompt: true,
      failedDocument: {
        isDirty: true,
        autosaveState: 'save-failed',
        lastSaveError: 'permission lost',
      },
    })
  })
})
