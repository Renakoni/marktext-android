import { createUntitledDocument, type AutosaveTarget } from '../../lib/documentState'
import { createDocumentStateFromAndroidDocument } from '../document-session/documentSessionState'
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
  remember?: boolean
  openWithTemporaryAccessMessage: string
  shareTemporaryAccessMessage: string
  logger?: WorkflowLogger
}

interface CreateSharedTextDocumentOpenResultOptions {
  sharedTextImportedMessage: string
  now?: () => string
  logger?: WorkflowLogger
}

export interface CreatedAndroidDocumentOpenResult {
  markdown: string
  documentState: ReturnType<typeof createDocumentStateFromAndroidDocument>
  homeNotice: string | null
  rememberDocument: OpenedAndroidDocument | null
  promptLocalDraftSaveOnExit: false
  currentAndroidDocumentCanWrite: boolean
  statusAfterOpen: 'Opened temporarily' | 'Read only' | 'Saved'
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
  {
    source = 'picker',
    remember = true,
    openWithTemporaryAccessMessage,
    shareTemporaryAccessMessage,
    logger,
  }: CreateAndroidDocumentOpenResultOptions,
): CreatedAndroidDocumentOpenResult {
  const temporaryAccessMessage =
    source === 'open-with'
      ? openWithTemporaryAccessMessage
      : source === 'share'
        ? shareTemporaryAccessMessage
        : null
  const openedTemporarily = Boolean(temporaryAccessMessage && !document.persisted)
  const shouldRemember = remember

  if (!shouldRemember) {
    logger?.warn('opened Android document without durable recent access', {
      displayName: document.displayName,
      sourceUri: document.sourceUri,
      source,
    })
  }

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
    homeNotice: openedTemporarily ? temporaryAccessMessage : null,
    rememberDocument: shouldRemember ? document : null,
    promptLocalDraftSaveOnExit: false,
    currentAndroidDocumentCanWrite: document.canWrite,
    statusAfterOpen: openedTemporarily ? 'Opened temporarily' : document.canWrite ? 'Saved' : 'Read only',
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
