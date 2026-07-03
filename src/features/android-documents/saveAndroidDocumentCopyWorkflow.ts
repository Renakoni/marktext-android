import {
  getSuggestedMarkdownCopyFileName,
  markDocumentSaveFailed,
  prepareMarkdownForSave,
  type MarkdownDocumentState,
} from '../../lib/documentState'
import {
  createSavedDocumentStateFromAndroidDocument,
  type SavedAndroidDocumentStateSource,
} from '../document-session/documentSessionState'
import type { OpenedAndroidDocument } from '../../lib/androidDocuments'

interface CanceledAndroidDocumentCreate {
  canceled: true
}

type AndroidDocumentCreateResult = OpenedAndroidDocument | CanceledAndroidDocumentCreate

interface WorkflowLogger {
  info(message: string, data?: unknown): void
  warn(message: string, data?: unknown): void
  error(message: string, data?: unknown): void
}

interface AndroidRecoveryDraftRequest {
  sourceUri: string
  markdown: string
}

export type SaveAndroidDocumentCopyResult =
  | {
      kind: 'canceled'
    }
  | {
      kind: 'transient'
      status: string
      createdDocument: OpenedAndroidDocument
      recoveryDraft: AndroidRecoveryDraftRequest | null
    }
  | {
      kind: 'saved'
      savedDocument: MarkdownDocumentState
      createdDocument: SavedAndroidDocumentStateSource
      canWrite: boolean
      removeRecoveryDraftSourceUri: string | null
      closeEditorToHome: boolean
    }
  | {
      kind: 'failed'
      failedDocument: MarkdownDocumentState
      status: string
      recoveryDraft: AndroidRecoveryDraftRequest | null
      error: unknown
    }

interface SaveAndroidDocumentCopyWorkflowOptions {
  copySourceDocument: MarkdownDocumentState
  originalSourceUri: string | null
  reservedDisplayNames: string[]
  returnHomeAfterSave: boolean
  transientAccessMessage: string
  createAndroidMarkdownDocument: (
    markdown: string,
    suggestedName: string,
  ) => Promise<AndroidDocumentCreateResult>
  getAndroidDocumentUserMessage: (error: unknown) => string
  now?: () => string
  logger?: WorkflowLogger
}

function createRecoveryDraftRequest(
  originalSourceUri: string | null,
  copySourceDocument: MarkdownDocumentState,
): AndroidRecoveryDraftRequest | null {
  if (!originalSourceUri || !copySourceDocument.isDirty || !copySourceDocument.markdown.trim()) {
    return null
  }

  return {
    sourceUri: originalSourceUri,
    markdown: copySourceDocument.markdown,
  }
}

export async function saveAndroidDocumentCopyWorkflow({
  copySourceDocument,
  originalSourceUri,
  reservedDisplayNames,
  returnHomeAfterSave,
  transientAccessMessage,
  createAndroidMarkdownDocument,
  getAndroidDocumentUserMessage,
  now = () => new Date().toISOString(),
  logger,
}: SaveAndroidDocumentCopyWorkflowOptions): Promise<SaveAndroidDocumentCopyResult> {
  const markdownForSave = prepareMarkdownForSave(copySourceDocument.markdown, copySourceDocument)
  const suggestedName = getSuggestedMarkdownCopyFileName(
    copySourceDocument.markdown,
    copySourceDocument.displayName,
    reservedDisplayNames,
  )

  try {
    const document = await createAndroidMarkdownDocument(markdownForSave, suggestedName)
    if (document.canceled) {
      logger?.info('Android document save copy canceled', {
        sourceUri: originalSourceUri,
      })
      return {
        kind: 'canceled',
      }
    }

    const createdDocument = {
      ...document,
      markdown: copySourceDocument.markdown,
    }

    if (!document.persisted) {
      logger?.warn('saved Android document copy without persisted access', {
        originalSourceUri,
        displayName: document.displayName,
        sourceUri: document.sourceUri,
        characters: copySourceDocument.markdown.length,
      })

      return {
        kind: 'transient',
        status: transientAccessMessage,
        createdDocument,
        recoveryDraft: createRecoveryDraftRequest(originalSourceUri, copySourceDocument),
      }
    }

    const savedAt = now()
    logger?.info('Android document saved as copy', {
      originalSourceUri,
      displayName: document.displayName,
      sourceUri: document.sourceUri,
      characters: copySourceDocument.markdown.length,
    })

    return {
      kind: 'saved',
      savedDocument: createSavedDocumentStateFromAndroidDocument(createdDocument, savedAt),
      createdDocument,
      canWrite: document.canWrite,
      removeRecoveryDraftSourceUri: originalSourceUri,
      closeEditorToHome: returnHomeAfterSave,
    }
  } catch (error) {
    logger?.error('Android document save copy failed', {
      originalSourceUri,
      error,
    })

    return {
      kind: 'failed',
      failedDocument: markDocumentSaveFailed(copySourceDocument, error),
      status: getAndroidDocumentUserMessage(error),
      recoveryDraft: createRecoveryDraftRequest(originalSourceUri, copySourceDocument),
      error,
    }
  }
}
