import {
  getSuggestedMarkdownFileName,
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

export type SaveLocalDraftToAndroidDocumentResult =
  | {
      kind: 'empty'
      status: 'Ready'
    }
  | {
      kind: 'canceled'
      status: 'Autosaved locally'
      reopenPrompt: boolean
    }
  | {
      kind: 'transient'
      status: string
      homeNotice: string
      createdDocument: OpenedAndroidDocument
      closeEditorToHome: boolean
    }
  | {
      kind: 'saved'
      savedDocument: MarkdownDocumentState
      createdDocument: SavedAndroidDocumentStateSource
      removeLocalDraftId: string
      canWrite: boolean
      closeEditorToHome: boolean
    }
  | {
      kind: 'failed'
      failedDocument: MarkdownDocumentState
      status: string
      reopenPrompt: boolean
      error: unknown
    }

interface SaveLocalDraftToAndroidDocumentWorkflowOptions {
  draftDocument: MarkdownDocumentState
  returnHomeAfterSave: boolean
  reopenPromptOnCancel: boolean
  transientAccessMessage: string
  createAndroidMarkdownDocument: (
    markdown: string,
    suggestedName: string,
  ) => Promise<AndroidDocumentCreateResult>
  getAndroidDocumentUserMessage: (error: unknown) => string
  now?: () => string
  logger?: WorkflowLogger
}

export async function saveLocalDraftToAndroidDocumentWorkflow({
  draftDocument,
  returnHomeAfterSave,
  reopenPromptOnCancel,
  transientAccessMessage,
  createAndroidMarkdownDocument,
  getAndroidDocumentUserMessage,
  now = () => new Date().toISOString(),
  logger,
}: SaveLocalDraftToAndroidDocumentWorkflowOptions): Promise<SaveLocalDraftToAndroidDocumentResult> {
  if (!draftDocument.markdown.trim()) {
    return {
      kind: 'empty',
      status: 'Ready',
    }
  }

  try {
    const markdownForSave = prepareMarkdownForSave(draftDocument.markdown, draftDocument)
    const suggestedName = getSuggestedMarkdownFileName(
      draftDocument.markdown,
      draftDocument.displayName,
    )
    const document = await createAndroidMarkdownDocument(markdownForSave, suggestedName)
    if (document.canceled) {
      logger?.info('Android document create canceled')
      return {
        kind: 'canceled',
        status: 'Autosaved locally',
        reopenPrompt: reopenPromptOnCancel,
      }
    }

    const createdDocument = {
      ...document,
      markdown: draftDocument.markdown,
    }

    if (!document.persisted) {
      logger?.warn('created Android document without persisted access; kept local draft', {
        displayName: document.displayName,
        sourceUri: document.sourceUri,
        characters: draftDocument.markdown.length,
      })

      return {
        kind: 'transient',
        status: transientAccessMessage,
        homeNotice: transientAccessMessage,
        createdDocument,
        closeEditorToHome: returnHomeAfterSave,
      }
    }

    const savedAt = now()
    logger?.info('local draft saved as Android document', {
      displayName: document.displayName,
      sourceUri: document.sourceUri,
      characters: draftDocument.markdown.length,
    })

    return {
      kind: 'saved',
      savedDocument: createSavedDocumentStateFromAndroidDocument(createdDocument, savedAt),
      createdDocument,
      removeLocalDraftId: draftDocument.id,
      canWrite: document.canWrite,
      closeEditorToHome: returnHomeAfterSave,
    }
  } catch (error) {
    logger?.error('local draft save to Android document failed', error)
    return {
      kind: 'failed',
      failedDocument: markDocumentSaveFailed(draftDocument, error),
      status: getAndroidDocumentUserMessage(error),
      reopenPrompt: reopenPromptOnCancel,
      error,
    }
  }
}
