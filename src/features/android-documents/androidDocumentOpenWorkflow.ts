import { createUntitledDocument, type AutosaveTarget } from '../../lib/documentState'
import {
  createDocumentStateFromAndroidDocument,
  createDocumentStateFromLocalDraft,
} from '../document-session/documentSessionState'
import type {
  AndroidOpenWithDocumentEvent,
  AndroidShareDocumentEvent,
  OpenedAndroidDocument,
  SharedAndroidDocument,
} from '../../lib/androidDocuments'
import type { LocalDraftRecord } from '../../lib/localDrafts'

export type AndroidDocumentOpenSource = 'picker' | 'recent' | 'open-with' | 'share'

interface CanceledAndroidDocumentOpen {
  canceled: true
}

type AndroidDocumentOpenResult = OpenedAndroidDocument | CanceledAndroidDocumentOpen

interface WorkflowLogger {
  info(message: string, data?: unknown): void
  warn(message: string, data?: unknown): void
  error(message: string, data?: unknown): void
}

interface CreateAndroidDocumentOpenResultOptions {
  source?: AndroidDocumentOpenSource
  logger?: WorkflowLogger
}

interface CreateSharedTextDocumentOpenResultOptions {
  sharedTextImportedMessage: string
  now?: () => string
  logger?: WorkflowLogger
}

interface CreateImportedIncomingDocumentOpenResultOptions {
  existingDrafts: LocalDraftRecord[]
  canPersistLocalDrafts: boolean
  incomingFileImportedMessage: string
  temporaryAccessMessage: string
  now?: () => string
  logger?: WorkflowLogger
}

export interface CreatedAndroidDocumentOpenResult {
  markdown: string
  documentState: ReturnType<typeof createDocumentStateFromAndroidDocument>
  homeNotice: null
  rememberDocument: OpenedAndroidDocument
  promptLocalDraftSaveOnExit: false
  currentAndroidDocumentCanWrite: boolean
  statusAfterOpen: 'Read only' | 'Saved'
}

export interface CreatedImportedIncomingDocumentOpenResult {
  markdown: string
  documentState: ReturnType<typeof createUntitledDocument>
  localDraft: LocalDraftRecord
  homeNotice: string | null
  promptLocalDraftSaveOnExit: true
  currentAndroidDocumentCanWrite: false
  statusAfterOpen: string
}

export interface CreatedSharedTextDocumentOpenResult {
  markdown: string
  documentState: ReturnType<typeof createUntitledDocument>
  localDraft: LocalDraftRecord
  homeNotice: null
  promptLocalDraftSaveOnExit: true
  currentAndroidDocumentCanWrite: false
  statusAfterOpen: string
}

export type AndroidDocumentPickerWorkflowResult =
  | {
      kind: 'canceled'
    }
  | {
      kind: 'opened'
      document: OpenedAndroidDocument
    }
  | {
      kind: 'failed'
      homeNotice: string
      error: unknown
    }

interface OpenAndroidMarkdownDocumentWorkflowOptions {
  openAndroidMarkdownDocument: () => Promise<AndroidDocumentOpenResult>
  getAndroidDocumentErrorCode: (error: unknown) => string
  getAndroidDocumentUserMessage: (error: unknown) => string
  logger?: WorkflowLogger
}

export type AndroidIncomingDocumentAction =
  | {
      kind: 'rejected'
      message: string
      error: unknown
    }
  | {
      kind: 'open-document'
      document: OpenedAndroidDocument
      source: Extract<AndroidDocumentOpenSource, 'open-with' | 'share'>
      remember: boolean
    }
  | {
      kind: 'open-shared-text'
      document: SharedAndroidDocument
    }

export type AndroidOpenWithDocumentAction = Extract<
  AndroidIncomingDocumentAction,
  { kind: 'rejected' } | { kind: 'open-document' }
>

interface IncomingDocumentActionOptions {
  getAndroidDocumentUserMessage: (error: unknown) => string
  logger?: WorkflowLogger
}

export type IncomingDocumentPreservationAction =
  | {
      kind: 'none'
    }
  | {
      kind: 'save-android-document'
    }
  | {
      kind: 'save-local-draft'
    }

interface IncomingDocumentPreservationActionOptions {
  currentScreen: 'home' | 'editor'
  hasEditor: boolean
  autosaveTarget: AutosaveTarget
}

export function createAndroidDocumentOpenResult(
  document: OpenedAndroidDocument,
  { source = 'picker', logger }: CreateAndroidDocumentOpenResultOptions = {},
): CreatedAndroidDocumentOpenResult {
  logger?.info('open Android document in editor', {
    displayName: document.displayName,
    sourceUri: document.sourceUri,
    canWrite: document.canWrite,
    persisted: document.persisted,
    source,
    characters: document.markdown.length,
  })

  return {
    markdown: document.markdown,
    documentState: createDocumentStateFromAndroidDocument(document),
    homeNotice: null,
    rememberDocument: document,
    promptLocalDraftSaveOnExit: false,
    currentAndroidDocumentCanWrite: document.canWrite,
    statusAfterOpen: document.canWrite ? 'Saved' : 'Read only',
  }
}

/**
 * A non-persistable incoming document (open-with or shared file) arrives on a
 * one-shot Android grant: the URI dies with the task and can never be
 * reopened. The only durable record is the content itself, so it is imported
 * as a named local draft — that is what puts the document in the history and
 * keeps edits safe after the app exits. Reopening the same unchanged file
 * reuses the existing draft (matched by name plus normalized content) instead
 * of multiplying copies; a changed file becomes a new draft so neither
 * version is silently lost.
 */
export function createImportedIncomingDocumentOpenResult(
  document: Pick<OpenedAndroidDocument, 'sourceUri' | 'displayName' | 'markdown'>,
  {
    existingDrafts,
    canPersistLocalDrafts,
    incomingFileImportedMessage,
    temporaryAccessMessage,
    now = () => new Date().toISOString(),
    logger,
  }: CreateImportedIncomingDocumentOpenResultOptions,
): CreatedImportedIncomingDocumentOpenResult {
  const openedAt = now()
  const importedDocument = createUntitledDocument({
    markdown: document.markdown,
    displayName: document.displayName,
    autosaveTarget: 'local-draft',
    now: openedAt,
  })

  const existingDraft = existingDrafts.find(
    draft =>
      draft.displayName === document.displayName &&
      draft.markdown === importedDocument.markdown,
  )
  const documentState = existingDraft
    ? createDocumentStateFromLocalDraft({ ...existingDraft, updatedAt: openedAt })
    : importedDocument

  if (canPersistLocalDrafts) {
    logger?.info('imported incoming Android document as a local draft', {
      displayName: document.displayName,
      sourceUri: document.sourceUri,
      reusedDraft: Boolean(existingDraft),
      characters: document.markdown.length,
    })
  } else {
    logger?.warn('opened incoming Android document without durable retention', {
      displayName: document.displayName,
      sourceUri: document.sourceUri,
    })
  }

  return {
    markdown: documentState.markdown,
    documentState,
    localDraft: {
      id: documentState.id,
      markdown: documentState.markdown,
      createdAt: documentState.createdAt,
      updatedAt: openedAt,
      lastSavedAt: documentState.lastSavedAt,
      displayName: document.displayName,
    },
    homeNotice: canPersistLocalDrafts ? null : temporaryAccessMessage,
    promptLocalDraftSaveOnExit: true,
    currentAndroidDocumentCanWrite: false,
    statusAfterOpen: canPersistLocalDrafts ? incomingFileImportedMessage : 'Opened temporarily',
  }
}

export function createSharedTextDocumentOpenResult(
  document: SharedAndroidDocument,
  {
    sharedTextImportedMessage,
    now = () => new Date().toISOString(),
    logger,
  }: CreateSharedTextDocumentOpenResultOptions,
): CreatedSharedTextDocumentOpenResult {
  const openedAt = now()
  const draftDocument = createUntitledDocument({
    markdown: document.markdown,
    displayName: document.displayName,
    autosaveTarget: 'local-draft',
    now: openedAt,
  })

  logger?.info('open Android shared text as local draft', {
    displayName: document.displayName,
    characters: document.markdown.length,
  })

  return {
    markdown: document.markdown,
    documentState: draftDocument,
    localDraft: {
      id: draftDocument.id,
      markdown: draftDocument.markdown,
      createdAt: draftDocument.createdAt,
      updatedAt: draftDocument.updatedAt,
      lastSavedAt: draftDocument.lastSavedAt,
    },
    homeNotice: null,
    promptLocalDraftSaveOnExit: true,
    currentAndroidDocumentCanWrite: false,
    statusAfterOpen: sharedTextImportedMessage,
  }
}

export async function openAndroidMarkdownDocumentWorkflow({
  openAndroidMarkdownDocument,
  getAndroidDocumentErrorCode,
  getAndroidDocumentUserMessage,
  logger,
}: OpenAndroidMarkdownDocumentWorkflowOptions): Promise<AndroidDocumentPickerWorkflowResult> {
  logger?.info('open Android document picker')

  try {
    const document = await openAndroidMarkdownDocument()
    if (document.canceled) {
      logger?.info('Android document picker canceled')
      return {
        kind: 'canceled',
      }
    }

    return {
      kind: 'opened',
      document,
    }
  } catch (error) {
    const code = getAndroidDocumentErrorCode(error)
    if (code === 'UNAVAILABLE') {
      logger?.warn('Android document picker unavailable', error)
    } else {
      logger?.error('Android document picker failed', error)
    }

    return {
      kind: 'failed',
      homeNotice: getAndroidDocumentUserMessage(error),
      error,
    }
  }
}

export function createAndroidOpenWithDocumentEventAction(
  event: AndroidOpenWithDocumentEvent,
  { getAndroidDocumentUserMessage, logger }: IncomingDocumentActionOptions,
): AndroidOpenWithDocumentAction {
  if (event.error) {
    const message = getAndroidDocumentUserMessage(event.error)
    logger?.warn('Android open-with document rejected', event.error)
    return {
      kind: 'rejected',
      message,
      error: event.error,
    }
  }

  return {
    kind: 'open-document',
    document: event.document,
    source: 'open-with',
    remember: event.document.persisted,
  }
}

export function createAndroidShareDocumentEventAction(
  event: AndroidShareDocumentEvent,
  { getAndroidDocumentUserMessage, logger }: IncomingDocumentActionOptions,
): AndroidIncomingDocumentAction {
  if (event.error) {
    const message = getAndroidDocumentUserMessage(event.error)
    logger?.warn('Android shared document rejected', event.error)
    return {
      kind: 'rejected',
      message,
      error: event.error,
    }
  }

  if (event.document.sourceUri) {
    return {
      kind: 'open-document',
      document: {
        canceled: false,
        sourceUri: event.document.sourceUri,
        displayName: event.document.displayName,
        providerName: event.document.providerName,
        pathHint: event.document.pathHint,
        mimeType: event.document.mimeType,
        markdown: event.document.markdown,
        canWrite: event.document.canWrite,
        persisted: event.document.persisted,
      },
      source: 'share',
      remember: event.document.persisted,
    }
  }

  return {
    kind: 'open-shared-text',
    document: event.document,
  }
}

export function getIncomingDocumentPreservationAction({
  currentScreen,
  hasEditor,
  autosaveTarget,
}: IncomingDocumentPreservationActionOptions): IncomingDocumentPreservationAction {
  if (currentScreen !== 'editor' || !hasEditor) {
    return {
      kind: 'none',
    }
  }

  if (autosaveTarget === 'android-document') {
    return {
      kind: 'save-android-document',
    }
  }

  return {
    kind: 'save-local-draft',
  }
}

export function shouldKeepAndroidRecoveryAfterPreserveFailure(
  saved: boolean,
  sourceUri: string | null,
  markdown: string,
) {
  return !saved && Boolean(sourceUri) && markdown.trim().length > 0
}
