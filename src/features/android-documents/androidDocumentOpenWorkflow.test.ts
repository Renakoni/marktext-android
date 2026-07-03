import { describe, expect, it, vi } from 'vitest'
import { AndroidDocumentError, type OpenedAndroidDocument, type SharedAndroidDocument } from '../../lib/androidDocuments'
import {
  createAndroidDocumentOpenResult,
  createAndroidOpenWithDocumentEventAction,
  createAndroidShareDocumentEventAction,
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
      openWithTemporaryAccessMessage: 'open-with temporary',
      shareTemporaryAccessMessage: 'share temporary',
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

  it('marks temporary open-with documents as non-recent and opened temporarily', () => {
    const temporaryDocument = {
      ...openedDocument,
      persisted: false,
      canWrite: false,
    }

    const result = createAndroidDocumentOpenResult(temporaryDocument, {
      source: 'open-with',
      remember: false,
      openWithTemporaryAccessMessage: 'Opened temporarily from Android',
      shareTemporaryAccessMessage: 'share temporary',
    })

    expect(result).toMatchObject({
      homeNotice: 'Opened temporarily from Android',
      rememberDocument: null,
      currentAndroidDocumentCanWrite: false,
      statusAfterOpen: 'Opened temporarily',
    })
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
