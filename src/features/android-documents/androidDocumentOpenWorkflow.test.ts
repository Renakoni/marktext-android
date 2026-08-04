import { describe, expect, it, vi } from 'vitest'
import { AndroidDocumentError, type OpenedAndroidDocument, type SharedAndroidDocument } from '../../lib/androidDocuments'
import {
  createAndroidDocumentOpenResult,
  createAndroidOpenWithDocumentEventAction,
  createAndroidShareDocumentEventAction,
  createImportedIncomingDocumentOpenResult,
  createSharedTextDocumentOpenResult,
  getIncomingDocumentPreservationAction,
  openAndroidMarkdownDocumentWorkflow,
  shouldKeepAndroidRecoveryAfterPreserveFailure,
} from './androidDocumentOpenWorkflow'

const openedDocument: OpenedAndroidDocument = {
  canceled: false,
  sourceUri: 'content://provider/opened.md',
  displayName: 'Opened.md',
  providerName: 'Documents',
  pathHint: 'Documents/Opened.md',
  mimeType: 'text/markdown',
  markdown: '# Opened\n\nbody',
  canWrite: true,
  persisted: true,
}

const sharedTextDocument: SharedAndroidDocument = {
  canceled: false,
  sourceUri: null,
  displayName: 'Shared Text.md',
  providerName: null,
  pathHint: null,
  mimeType: 'text/plain',
  markdown: '# Shared Text\n\nbody',
  canWrite: false,
  persisted: false,
  shareKind: 'text',
}

describe('androidDocumentOpenWorkflow', () => {
  it('creates an opened Android document session result for durable documents', () => {
    const result = createAndroidDocumentOpenResult(openedDocument, {
      source: 'picker',
    })

    expect(result).toMatchObject({
      markdown: '# Opened\n\nbody',
      homeNotice: null,
      rememberDocument: openedDocument,
      promptLocalDraftSaveOnExit: false,
      currentAndroidDocumentCanWrite: true,
      statusAfterOpen: 'Saved',
      documentState: {
        id: 'android-document:content://provider/opened.md',
        autosaveTarget: 'android-document',
        displayName: 'Opened.md',
        sourceUri: 'content://provider/opened.md',
      },
    })
  })

  it('imports a non-persistable incoming document as a named local draft', () => {
    const result = createImportedIncomingDocumentOpenResult(
      {
        sourceUri: 'content://provider/incoming.md',
        displayName: 'Incoming.md',
        markdown: '# Incoming\r\n\r\nfrom another app',
      },
      {
        existingDrafts: [],
        canPersistLocalDrafts: true,
        incomingFileImportedMessage: 'Imported this file as a local draft.',
        temporaryAccessMessage: 'open-with temporary',
        now: () => '2026-07-02T00:00:00.000Z',
      },
    )

    expect(result).toMatchObject({
      markdown: '# Incoming\n\nfrom another app',
      homeNotice: null,
      promptLocalDraftSaveOnExit: true,
      currentAndroidDocumentCanWrite: false,
      statusAfterOpen: 'Imported this file as a local draft.',
      documentState: {
        autosaveTarget: 'local-draft',
        displayName: 'Incoming.md',
        sourceUri: null,
        updatedAt: '2026-07-02T00:00:00.000Z',
      },
    })
    expect(result.localDraft).toEqual({
      id: result.documentState.id,
      markdown: '# Incoming\n\nfrom another app',
      createdAt: '2026-07-02T00:00:00.000Z',
      updatedAt: '2026-07-02T00:00:00.000Z',
      lastSavedAt: '2026-07-02T00:00:00.000Z',
      displayName: 'Incoming.md',
    })
  })

  it('reuses the existing draft when the same unchanged file is opened again', () => {
    const existingDraft = {
      id: 'draft-incoming',
      markdown: '# Incoming\n\nfrom another app',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
      lastSavedAt: '2026-07-01T00:00:00.000Z',
      displayName: 'Incoming.md',
    }

    const result = createImportedIncomingDocumentOpenResult(
      {
        sourceUri: 'content://provider/incoming.md',
        displayName: 'Incoming.md',
        markdown: '# Incoming\r\n\r\nfrom another app',
      },
      {
        existingDrafts: [existingDraft],
        canPersistLocalDrafts: true,
        incomingFileImportedMessage: 'Imported this file as a local draft.',
        temporaryAccessMessage: 'open-with temporary',
        now: () => '2026-07-02T00:00:00.000Z',
      },
    )

    expect(result.documentState.id).toBe('draft-incoming')
    expect(result.localDraft).toMatchObject({
      id: 'draft-incoming',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-02T00:00:00.000Z',
      displayName: 'Incoming.md',
    })
  })

  it('imports a changed file with the same name as a new draft', () => {
    const existingDraft = {
      id: 'draft-incoming',
      markdown: '# Incoming\n\nedited inside the app',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
      lastSavedAt: '2026-07-01T00:00:00.000Z',
      displayName: 'Incoming.md',
    }

    const result = createImportedIncomingDocumentOpenResult(
      {
        sourceUri: 'content://provider/incoming.md',
        displayName: 'Incoming.md',
        markdown: '# Incoming\n\nfrom another app',
      },
      {
        existingDrafts: [existingDraft],
        canPersistLocalDrafts: true,
        incomingFileImportedMessage: 'Imported this file as a local draft.',
        temporaryAccessMessage: 'open-with temporary',
        now: () => '2026-07-02T00:00:00.000Z',
      },
    )

    expect(result.documentState.id).not.toBe('draft-incoming')
    expect(result.localDraft?.markdown).toBe('# Incoming\n\nfrom another app')
  })

  it('keeps the temporary-access messaging when local drafts are disabled', () => {
    const result = createImportedIncomingDocumentOpenResult(
      {
        sourceUri: 'content://provider/incoming.md',
        displayName: 'Incoming.md',
        markdown: '# Incoming\n\nfrom another app',
      },
      {
        existingDrafts: [],
        canPersistLocalDrafts: false,
        incomingFileImportedMessage: 'Imported this file as a local draft.',
        temporaryAccessMessage: 'Opened temporarily from Android',
      },
    )

    expect(result).toMatchObject({
      localDraft: null,
      homeNotice: 'Opened temporarily from Android',
      promptLocalDraftSaveOnExit: true,
      statusAfterOpen: 'Opened temporarily',
    })
  })

  it('never reuses a stored draft while local drafts are disabled', () => {
    // Stored drafts stay loaded when persistence is off; reusing one's id
    // would let this session's Discard delete it from storage.
    const existingDraft = {
      id: 'draft-incoming',
      markdown: '# Incoming\n\nfrom another app',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
      lastSavedAt: '2026-07-01T00:00:00.000Z',
      displayName: 'Incoming.md',
    }

    const result = createImportedIncomingDocumentOpenResult(
      {
        sourceUri: 'content://provider/incoming.md',
        displayName: 'Incoming.md',
        markdown: '# Incoming\n\nfrom another app',
      },
      {
        existingDrafts: [existingDraft],
        canPersistLocalDrafts: false,
        incomingFileImportedMessage: 'Imported this file as a local draft.',
        temporaryAccessMessage: 'Opened temporarily from Android',
      },
    )

    expect(result.documentState.id).not.toBe('draft-incoming')
    expect(result.localDraft).toBeNull()
  })

  it('opens an empty incoming file as a named session without claiming an import', () => {
    const result = createImportedIncomingDocumentOpenResult(
      {
        sourceUri: 'content://provider/empty.md',
        displayName: 'Empty.md',
        markdown: '   \n\n  ',
      },
      {
        existingDrafts: [],
        canPersistLocalDrafts: true,
        incomingFileImportedMessage: 'Imported this file as a local draft.',
        temporaryAccessMessage: 'open-with temporary',
      },
    )

    // Empty drafts are dropped by the store, so nothing durable exists yet;
    // the session keeps the name and becomes durable once content is typed.
    expect(result.localDraft).toBeNull()
    expect(result.statusAfterOpen).toBe('Ready')
    expect(result.homeNotice).toBeNull()
    expect(result.documentState.displayName).toBe('Empty.md')
    expect(result.documentState.autosaveTarget).toBe('local-draft')
  })

  it('creates a local draft session result for shared text', () => {
    const result = createSharedTextDocumentOpenResult(sharedTextDocument, {
      sharedTextImportedMessage: 'Imported shared text as a local draft.',
      now: () => '2026-07-02T00:00:00.000Z',
    })

    expect(result).toMatchObject({
      markdown: '# Shared Text\n\nbody',
      homeNotice: null,
      promptLocalDraftSaveOnExit: true,
      currentAndroidDocumentCanWrite: false,
      statusAfterOpen: 'Imported shared text as a local draft.',
      documentState: {
        markdown: '# Shared Text\n\nbody',
        autosaveTarget: 'local-draft',
        displayName: 'Shared Text.md',
        updatedAt: '2026-07-02T00:00:00.000Z',
      },
    })
    expect(result.localDraft).toEqual({
      id: result.documentState.id,
      markdown: '# Shared Text\n\nbody',
      createdAt: '2026-07-02T00:00:00.000Z',
      updatedAt: '2026-07-02T00:00:00.000Z',
      lastSavedAt: '2026-07-02T00:00:00.000Z',
    })
  })

  it('opens, cancels, and reports picker failures through an explicit result', async () => {
    await expect(
      openAndroidMarkdownDocumentWorkflow({
        openAndroidMarkdownDocument: vi.fn().mockResolvedValue(openedDocument),
        getAndroidDocumentErrorCode: () => 'UNKNOWN',
        getAndroidDocumentUserMessage: () => 'failed',
      }),
    ).resolves.toMatchObject({
      kind: 'opened',
      document: openedDocument,
    })

    await expect(
      openAndroidMarkdownDocumentWorkflow({
        openAndroidMarkdownDocument: vi.fn().mockResolvedValue({ canceled: true }),
        getAndroidDocumentErrorCode: () => 'UNKNOWN',
        getAndroidDocumentUserMessage: () => 'failed',
      }),
    ).resolves.toEqual({
      kind: 'canceled',
    })

    await expect(
      openAndroidMarkdownDocumentWorkflow({
        openAndroidMarkdownDocument: vi.fn().mockRejectedValue(new AndroidDocumentError('UNAVAILABLE', 'no bridge')),
        getAndroidDocumentErrorCode: error => (error as AndroidDocumentError).code,
        getAndroidDocumentUserMessage: () => 'Open Markdown files from the Android app build.',
      }),
    ).resolves.toMatchObject({
      kind: 'failed',
      homeNotice: 'Open Markdown files from the Android app build.',
    })
  })

  it('maps incoming open-with and share events to open actions or rejections', () => {
    expect(
      createAndroidOpenWithDocumentEventAction(
        {
          document: openedDocument,
          error: null,
        },
        {
          getAndroidDocumentUserMessage: () => 'failed',
        },
      ),
    ).toMatchObject({
      kind: 'open-document',
      source: 'open-with',
      remember: true,
      document: openedDocument,
    })

    expect(
      createAndroidShareDocumentEventAction(
        {
          document: sharedTextDocument,
          error: null,
        },
        {
          getAndroidDocumentUserMessage: () => 'failed',
        },
      ),
    ).toMatchObject({
      kind: 'open-shared-text',
      document: sharedTextDocument,
    })

    expect(
      createAndroidShareDocumentEventAction(
        {
          document: null,
          error: new AndroidDocumentError('UNSUPPORTED_SHARE_DOCUMENT', 'bad share'),
        },
        {
          getAndroidDocumentUserMessage: () => 'Share Markdown text or a Markdown file.',
        },
      ),
    ).toMatchObject({
      kind: 'rejected',
      message: 'Share Markdown text or a Markdown file.',
    })
  })

  it('selects the preservation action before replacing the active editor document', () => {
    expect(
      getIncomingDocumentPreservationAction({
        currentScreen: 'home',
        hasEditor: false,
        autosaveTarget: 'local-draft',
      }),
    ).toEqual({ kind: 'none' })

    expect(
      getIncomingDocumentPreservationAction({
        currentScreen: 'editor',
        hasEditor: true,
        autosaveTarget: 'android-document',
      }),
    ).toEqual({ kind: 'save-android-document' })

    expect(
      getIncomingDocumentPreservationAction({
        currentScreen: 'editor',
        hasEditor: true,
        autosaveTarget: 'local-draft',
      }),
    ).toEqual({ kind: 'save-local-draft' })
  })

  it('keeps Android recovery only after failed preservation with non-empty content', () => {
    expect(shouldKeepAndroidRecoveryAfterPreserveFailure(false, 'content://provider/doc.md', 'body')).toBe(true)
    expect(shouldKeepAndroidRecoveryAfterPreserveFailure(true, 'content://provider/doc.md', 'body')).toBe(false)
    expect(shouldKeepAndroidRecoveryAfterPreserveFailure(false, null, 'body')).toBe(false)
    expect(shouldKeepAndroidRecoveryAfterPreserveFailure(false, 'content://provider/doc.md', '  ')).toBe(false)
  })
})
