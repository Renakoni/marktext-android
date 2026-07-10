import type { Ref } from 'vue'
import {
  installAndroidDocumentIntentListeners,
  type AndroidDocumentIntentListeners,
} from './androidDocumentIntentListeners'
import {
  createAndroidOpenWithDocumentEventAction,
  createAndroidShareDocumentEventAction,
  createSharedTextDocumentOpenResult,
  getIncomingDocumentPreservationAction,
  shouldKeepAndroidRecoveryAfterPreserveFailure,
  type AndroidDocumentOpenSource,
} from './androidDocumentOpenWorkflow'
import type {
  AndroidOpenWithDocumentEvent,
  AndroidShareDocumentEvent,
  OpenedAndroidDocument,
  SharedAndroidDocument,
} from '../../lib/androidDocuments'
import type { AppScreen } from '../../lib/appExitDecisions'
import type { MarkdownDocumentState } from '../../lib/documentState'
import { upsertLocalDraft, type LocalDraftRecord } from '../../lib/localDrafts'

interface OrchestrationLogger {
  info(message: string, context?: unknown): void
  warn(message: string, context?: unknown): void
  error(message: string, context?: unknown): void
}

export interface IncomingDocumentOrchestrationOptions {
  // App-owned state the incoming flows read and write.
  currentScreen: Ref<AppScreen>
  documentState: Ref<MarkdownDocumentState>
  localDrafts: Ref<LocalDraftRecord[]>
  homeNotice: Ref<string | null>
  status: Ref<string>
  draftExitPromptOpen: Ref<boolean>
  androidExitPromptOpen: Ref<boolean>
  promptLocalDraftSaveOnExit: Ref<boolean>
  currentAndroidDocumentCanWrite: Ref<boolean>
  sharedTextImportedMessage: string
  // Collaborators that stay in App: shared open/save paths and editor chrome.
  hasEditor: () => boolean
  openEditor: (markdown: string) => Promise<void>
  releaseEditorFocusAfterOpen: () => void
  closeEditorMenu: () => void
  closeEditorToolbar: () => void
  openAndroidDocumentResult: (
    document: OpenedAndroidDocument,
    options?: { source?: AndroidDocumentOpenSource, remember?: boolean },
  ) => Promise<void>
  saveAndroidDocument: () => Promise<boolean>
  saveDraft: () => void
  syncDocumentFromEditor: (markDirty: boolean, flushPending: boolean) => void
  persistAndroidRecoveryDraft: (sourceUri: string, markdown: string) => void
  canPersistLocalDrafts: () => boolean
  persistLocalDrafts: (drafts: LocalDraftRecord[]) => void
  getAndroidDocumentUserMessage: (error: unknown) => string
  appLogger: OrchestrationLogger
  documentLogger: OrchestrationLogger
}

export interface IncomingDocumentOrchestration {
  installListeners(): void
  removeListeners(): void
  handleOpenWithDocumentEvent(event: AndroidOpenWithDocumentEvent): Promise<void>
  handleShareDocumentEvent(event: AndroidShareDocumentEvent): Promise<void>
}

/**
 * Orchestrates Android open-with/share intents: rejects bad events, preserves
 * the currently edited document, closes editor chrome, and routes the incoming
 * document through the shared open paths. Owns the intent-listener lifecycle.
 */
export function createIncomingDocumentOrchestration(
  options: IncomingDocumentOrchestrationOptions,
): IncomingDocumentOrchestration {
  let listeners: AndroidDocumentIntentListeners | null = null

  async function openSharedTextDocument(document: SharedAndroidDocument) {
    const openResult = createSharedTextDocumentOpenResult(document, {
      sharedTextImportedMessage: options.sharedTextImportedMessage,
      logger: options.documentLogger,
    })

    if (options.canPersistLocalDrafts()) {
      options.persistLocalDrafts(upsertLocalDraft(options.localDrafts.value, openResult.localDraft))
    }
    options.homeNotice.value = openResult.homeNotice
    options.promptLocalDraftSaveOnExit.value = openResult.promptLocalDraftSaveOnExit
    options.currentAndroidDocumentCanWrite.value = openResult.currentAndroidDocumentCanWrite
    options.documentState.value = openResult.documentState
    await options.openEditor(openResult.markdown)
    options.status.value = openResult.statusAfterOpen
    options.releaseEditorFocusAfterOpen()
  }

  async function preserveCurrentDocumentBeforeIncomingOpen() {
    const preservationAction = getIncomingDocumentPreservationAction({
      currentScreen: options.currentScreen.value,
      hasEditor: options.hasEditor(),
      autosaveTarget: options.documentState.value.autosaveTarget,
    })

    if (preservationAction.kind === 'none') {
      return
    }

    options.appLogger.info('preserve current document before incoming Android document')

    if (preservationAction.kind === 'save-android-document') {
      options.syncDocumentFromEditor(options.documentState.value.isDirty, true)
      const sourceUri = options.documentState.value.sourceUri
      const saved = await options.saveAndroidDocument()
      if (
        sourceUri
        && shouldKeepAndroidRecoveryAfterPreserveFailure(saved, sourceUri, options.documentState.value.markdown)
      ) {
        options.persistAndroidRecoveryDraft(sourceUri, options.documentState.value.markdown)
      }
      return
    }

    options.saveDraft()
  }

  function closeEditorChromeForIncomingOpen() {
    options.draftExitPromptOpen.value = false
    options.androidExitPromptOpen.value = false
    options.closeEditorMenu()
    options.closeEditorToolbar()
  }

  async function handleOpenWithDocumentEvent(event: AndroidOpenWithDocumentEvent) {
    const action = createAndroidOpenWithDocumentEventAction(event, {
      getAndroidDocumentUserMessage: options.getAndroidDocumentUserMessage,
      logger: options.documentLogger,
    })

    if (action.kind === 'rejected') {
      options.homeNotice.value = action.message
      options.status.value = action.message
      return
    }

    await preserveCurrentDocumentBeforeIncomingOpen()
    closeEditorChromeForIncomingOpen()
    await options.openAndroidDocumentResult(action.document, {
      source: action.source,
      remember: action.remember,
    })
  }

  async function handleShareDocumentEvent(event: AndroidShareDocumentEvent) {
    const action = createAndroidShareDocumentEventAction(event, {
      getAndroidDocumentUserMessage: options.getAndroidDocumentUserMessage,
      logger: options.documentLogger,
    })

    if (action.kind === 'rejected') {
      options.homeNotice.value = action.message
      options.status.value = action.message
      return
    }

    await preserveCurrentDocumentBeforeIncomingOpen()
    closeEditorChromeForIncomingOpen()

    if (action.kind === 'open-document') {
      await options.openAndroidDocumentResult(action.document, {
        source: action.source,
        remember: action.remember,
      })
      return
    }

    await openSharedTextDocument(action.document)
  }

  function installListeners() {
    if (listeners) {
      return
    }

    listeners = installAndroidDocumentIntentListeners({
      onOpenWithDocument: (event) => {
        void handleOpenWithDocumentEvent(event)
      },
      onShareDocument: (event) => {
        void handleShareDocumentEvent(event)
      },
      logger: options.documentLogger,
    })
  }

  function removeListeners() {
    listeners?.remove()
    listeners = null
  }

  return {
    installListeners,
    removeListeners,
    handleOpenWithDocumentEvent,
    handleShareDocumentEvent,
  }
}
