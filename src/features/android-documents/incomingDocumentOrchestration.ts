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

/**
 * Whether the current document was durably preserved before replacing it with
 * an incoming one. `blocked` means it holds unsaved content that could not be
 * saved or recovered, so the editor must stay mounted and the user decides.
 */
type IncomingPreservationResult = { kind: 'preserved' } | { kind: 'blocked' }

export interface BlockedIncomingOpenRequest {
  /** Display name of the incoming document, for the confirmation copy. */
  incomingName: string
  /** Runs the deferred replacement once the user chooses to discard. */
  proceed: () => Promise<void>
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
  saveDraft: () => boolean
  syncDocumentFromEditor: (markDirty: boolean, flushPending: boolean) => void
  persistAndroidRecoveryDraft: (sourceUri: string, markdown: string) => boolean
  canPersistLocalDrafts: () => boolean
  persistLocalDrafts: (drafts: LocalDraftRecord[]) => void
  // Called instead of replacing the editor when preservation was blocked: keep
  // the current editor mounted and let the user keep editing or discard + open.
  confirmIncomingOpenAfterBlockedPreserve: (request: BlockedIncomingOpenRequest) => void
  getAndroidDocumentUserMessage: (error: unknown) => string
  appLogger: OrchestrationLogger
  documentLogger: OrchestrationLogger
}

export interface IncomingDocumentOrchestration {
  installListeners(): void
  removeListeners(): void
  handleOpenWithDocumentEvent(event: AndroidOpenWithDocumentEvent): Promise<void>
  handleShareDocumentEvent(event: AndroidShareDocumentEvent): Promise<void>
  /** Resume the incoming-open queue after the blocked prompt is answered. */
  resolveIncomingDecision(): Promise<void>
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

  async function preserveCurrentDocumentBeforeIncomingOpen(): Promise<IncomingPreservationResult> {
    const preservationAction = getIncomingDocumentPreservationAction({
      currentScreen: options.currentScreen.value,
      hasEditor: options.hasEditor(),
      autosaveTarget: options.documentState.value.autosaveTarget,
    })

    if (preservationAction.kind === 'none') {
      return { kind: 'preserved' }
    }

    options.appLogger.info('preserve current document before incoming Android document')

    if (preservationAction.kind === 'save-android-document') {
      options.syncDocumentFromEditor(options.documentState.value.isDirty, true)
      const saved = await options.saveAndroidDocument()

      // Read the payload AFTER the awaited save. A `changed-during-save` result
      // returns false while the editor already holds newer text than the
      // snapshot the save used, so flush and re-read the current content — the
      // recovery draft and the block decision must reflect the latest edits,
      // never the pre-save snapshot.
      options.syncDocumentFromEditor(options.documentState.value.isDirty, true)
      const sourceUri = options.documentState.value.sourceUri
      const markdown = options.documentState.value.markdown

      // Saved to its file, or there is nothing to lose.
      if (saved || markdown.trim().length === 0) {
        return { kind: 'preserved' }
      }

      // The save failed with unsaved content: keep it as a recovery draft when
      // we can. Only a durable recovery write counts as preserved.
      if (
        shouldKeepAndroidRecoveryAfterPreserveFailure(saved, sourceUri, markdown)
        && sourceUri
        && options.persistAndroidRecoveryDraft(sourceUri, markdown)
      ) {
        return { kind: 'preserved' }
      }

      options.appLogger.warn('incoming open would drop unsaved Android document edits')
      return { kind: 'blocked' }
    }

    // Local draft: saveDraft reports whether the content is durably safe.
    if (options.saveDraft()) {
      return { kind: 'preserved' }
    }

    options.appLogger.warn('incoming open would drop an unsaved local draft')
    return { kind: 'blocked' }
  }

  // Incoming opens are serialized so two intents can never race or replace the
  // editor behind a pending prompt. Only one transaction runs at a time; while a
  // blocked prompt awaits the user's decision the editor is frozen, so newer
  // intents wait (latest-wins) instead of opening. `awaitingDecision` is cleared
  // by resolveIncomingDecision when the user keeps or discards.
  let transactionActive = false
  let awaitingDecision = false
  let queuedTransaction: (() => Promise<void>) | null = null

  function scheduleIncomingTransaction(transaction: () => Promise<void>) {
    // Latest-wins: only the newest waiting intent survives.
    queuedTransaction = transaction
    return drainIncomingTransactions()
  }

  async function drainIncomingTransactions(): Promise<void> {
    if (transactionActive || awaitingDecision) {
      return
    }

    const next = queuedTransaction
    queuedTransaction = null
    if (!next) {
      return
    }

    transactionActive = true
    try {
      await next()
    } finally {
      transactionActive = false
    }

    // A blocked transaction leaves awaitingDecision set and pauses the queue
    // until the user resolves it; otherwise keep draining any newer intent.
    if (!awaitingDecision) {
      await drainIncomingTransactions()
    }
  }

  // Runs one incoming open: replace the editor now when the current document is
  // preserved, or keep it mounted and ask (freezing the queue) when it is not.
  async function runIncomingTransaction(incomingName: string, proceed: () => Promise<void>) {
    const preservation = await preserveCurrentDocumentBeforeIncomingOpen()
    if (preservation.kind === 'blocked') {
      awaitingDecision = true
      options.confirmIncomingOpenAfterBlockedPreserve({ incomingName, proceed })
      return
    }

    await proceed()
  }

  // Called by App once the user answers the blocked prompt (keep or discard);
  // resumes the queue so any intent that arrived while it was open is processed.
  function resolveIncomingDecision() {
    awaitingDecision = false
    return drainIncomingTransactions()
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

    await scheduleIncomingTransaction(() =>
      runIncomingTransaction(action.document.displayName, async () => {
        closeEditorChromeForIncomingOpen()
        await options.openAndroidDocumentResult(action.document, {
          source: action.source,
          remember: action.remember,
        })
      }),
    )
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

    if (action.kind === 'open-document') {
      await scheduleIncomingTransaction(() =>
        runIncomingTransaction(action.document.displayName, async () => {
          closeEditorChromeForIncomingOpen()
          await options.openAndroidDocumentResult(action.document, {
            source: action.source,
            remember: action.remember,
          })
        }),
      )
      return
    }

    await scheduleIncomingTransaction(() =>
      runIncomingTransaction(action.document.displayName, async () => {
        closeEditorChromeForIncomingOpen()
        await openSharedTextDocument(action.document)
      }),
    )
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
    resolveIncomingDecision,
  }
}
