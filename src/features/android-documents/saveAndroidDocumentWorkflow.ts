import {
  markDocumentSaved,
  markDocumentSaveFailed,
  markDocumentSaving,
  prepareMarkdownForSave,
  updateDocumentMarkdown,
  type MarkdownDocumentState,
} from '../../lib/documentState'

interface WorkflowLogger {
  debug(message: string, data?: unknown): void
  info(message: string, data?: unknown): void
  error(message: string, data?: unknown): void
}

interface AndroidRecoveryDraftRequest {
  sourceUri: string
  markdown: string
}

export interface SaveAndroidDocumentWorkflowRequest {
  sourceUri: string
  savingDocument: MarkdownDocumentState
  markdownForSave: string
  saveMarkdown: string
}

export type SaveAndroidDocumentWorkflowStartResult =
  | {
      kind: 'not-android-document'
      saved: true
    }
  | {
      kind: 'missing-source'
      saved: false
      status: 'Save failed'
      documentId: string
    }
  | {
      kind: 'read-only'
      saved: boolean
      status: string
      documentId: string
      sourceUri: string
    }
  | {
      kind: 'clean'
      saved: true
    }
  | {
      kind: 'ready'
      saved: false
      status: 'Saving'
      request: SaveAndroidDocumentWorkflowRequest
    }

export type SaveAndroidDocumentWorkflowResult =
  | {
      kind: 'saved'
      saved: true
      savedDocument: MarkdownDocumentState
      savedAt: string
      sourceUri: string
      saveMarkdown: string
      status: 'Saved'
    }
  | {
      kind: 'changed-during-save'
      saved: false
      sourceUri: string
      scheduleAnotherSave: true
    }
  | {
      kind: 'failed'
      saved: false
      failedDocument: MarkdownDocumentState
      sourceUri: string
      recoveryDraft: AndroidRecoveryDraftRequest
      status: string
      error: unknown
    }

interface CreateSaveAndroidDocumentWorkflowStartOptions {
  documentState: MarkdownDocumentState
  markdown: string
  canWrite: boolean
}

interface SaveAndroidDocumentWorkflowOptions {
  request: SaveAndroidDocumentWorkflowRequest
  getCurrentDocumentState: () => MarkdownDocumentState
  writeAndroidMarkdownDocument: (sourceUri: string, markdown: string) => Promise<unknown>
  getAndroidDocumentUserMessage: (error: unknown) => string
  recoveryMessage: string
  now?: () => string
  logger?: WorkflowLogger
}

function createSaveAndroidDocumentWorkflowRequest(
  documentState: MarkdownDocumentState,
  markdown: string,
  sourceUri: string,
): SaveAndroidDocumentWorkflowRequest {
  const nextDocument = updateDocumentMarkdown(documentState, markdown, {
    markDirty: documentState.isDirty,
  })

  return {
    sourceUri,
    savingDocument: markDocumentSaving(nextDocument),
    markdownForSave: prepareMarkdownForSave(nextDocument.markdown, nextDocument),
    saveMarkdown: nextDocument.markdown,
  }
}

function canApplyAndroidDocumentSaveSuccess(
  documentState: MarkdownDocumentState,
  sourceUri: string,
  saveMarkdown: string,
) {
  return (
    documentState.autosaveTarget === 'android-document' &&
    documentState.sourceUri === sourceUri &&
    documentState.markdown === saveMarkdown
  )
}

function applyAndroidDocumentSaveSuccess(
  documentState: MarkdownDocumentState,
  saveMarkdown: string,
  savedAt: string,
) {
  return markDocumentSaved(
    updateDocumentMarkdown(documentState, saveMarkdown, {
      markDirty: false,
      now: savedAt,
    }),
    { autosaveTarget: 'android-document', now: savedAt },
  )
}

export function createSaveAndroidDocumentWorkflowStart({
  documentState,
  markdown,
  canWrite,
}: CreateSaveAndroidDocumentWorkflowStartOptions): SaveAndroidDocumentWorkflowStartResult {
  if (documentState.autosaveTarget !== 'android-document') {
    return {
      kind: 'not-android-document',
      saved: true,
    }
  }

  const sourceUri = documentState.sourceUri
  if (!sourceUri) {
    return {
      kind: 'missing-source',
      saved: false,
      status: 'Save failed',
      documentId: documentState.id,
    }
  }

  if (!canWrite) {
    return {
      kind: 'read-only',
      saved: !documentState.isDirty,
      status: documentState.isDirty ? 'This file is read-only.' : 'Read only',
      documentId: documentState.id,
      sourceUri,
    }
  }

  if (!documentState.isDirty && documentState.autosaveState !== 'save-failed') {
    return {
      kind: 'clean',
      saved: true,
    }
  }

  return {
    kind: 'ready',
    saved: false,
    status: 'Saving',
    request: createSaveAndroidDocumentWorkflowRequest(documentState, markdown, sourceUri),
  }
}

export async function saveAndroidDocumentWorkflow({
  request,
  getCurrentDocumentState,
  writeAndroidMarkdownDocument,
  getAndroidDocumentUserMessage,
  recoveryMessage,
  now = () => new Date().toISOString(),
  logger,
}: SaveAndroidDocumentWorkflowOptions): Promise<SaveAndroidDocumentWorkflowResult> {
  try {
    await writeAndroidMarkdownDocument(request.sourceUri, request.markdownForSave)
    const savedAt = now()
    const currentDocument = getCurrentDocumentState()

    if (canApplyAndroidDocumentSaveSuccess(
      currentDocument,
      request.sourceUri,
      request.saveMarkdown,
    )) {
      logger?.info('Android document autosaved', {
        sourceUri: request.sourceUri,
        characters: request.saveMarkdown.length,
      })

      return {
        kind: 'saved',
        saved: true,
        savedDocument: applyAndroidDocumentSaveSuccess(
          currentDocument,
          request.saveMarkdown,
          savedAt,
        ),
        savedAt,
        sourceUri: request.sourceUri,
        saveMarkdown: request.saveMarkdown,
        status: 'Saved',
      }
    }

    logger?.debug('Android document changed during save; scheduling another save', {
      sourceUri: request.sourceUri,
    })

    return {
      kind: 'changed-during-save',
      saved: false,
      sourceUri: request.sourceUri,
      scheduleAnotherSave: true,
    }
  } catch (error) {
    logger?.error('Android document autosave failed', {
      sourceUri: request.sourceUri,
      error,
    })

    return {
      kind: 'failed',
      saved: false,
      failedDocument: markDocumentSaveFailed(getCurrentDocumentState(), error),
      sourceUri: request.sourceUri,
      recoveryDraft: {
        sourceUri: request.sourceUri,
        markdown: request.saveMarkdown,
      },
      status: `${getAndroidDocumentUserMessage(error)} ${recoveryMessage}`,
      error,
    }
  }
}
