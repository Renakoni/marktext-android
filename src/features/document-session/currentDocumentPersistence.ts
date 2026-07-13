import type { Ref } from 'vue'
import {
  createSaveAndroidDocumentWorkflowStart,
  saveAndroidDocumentWorkflow,
} from '../android-documents/saveAndroidDocumentWorkflow'
import { saveAndroidDocumentCopyWorkflow } from '../android-documents/saveAndroidDocumentCopyWorkflow'
import { saveLocalDraftToAndroidDocumentWorkflow } from '../android-documents/saveLocalDraftToAndroidDocumentWorkflow'
import { shareAndroidMarkdownDocumentWorkflow } from '../android-documents/shareAndroidMarkdownDocumentWorkflow'
import { exportAndroidPdfWorkflow } from '../android-documents/exportAndroidPdfWorkflow'
import {
  createAndroidRecoveryDraft,
  getAndroidRecoveryDraftId,
} from '../android-documents/androidRecoveryDrafts'
import { markSavedAndroidRecentDocument } from '../android-documents/androidRecentDocuments'
import type { ImageSharingSettings } from '../android-documents/imageSharingSettings'
import { createLocalDraftAutosaveResult } from '../local-drafts/localDraftAutosave'
import type { MarkdownSaveSettings } from '../settings/advancedSettings'
import type {
  AndroidPdfExportResult,
  AndroidShareResult,
  OpenedAndroidDocument,
} from '../../lib/androidDocuments'
import type { AppScreen } from '../../lib/appExitDecisions'
import {
  markDocumentSaveFailed,
  type MarkdownDocumentState,
} from '../../lib/documentState'
import {
  removeLocalDraft,
  upsertLocalDraft,
  type LocalDraftRecord,
} from '../../lib/localDrafts'
import type { RecentDocumentRecord } from '../../lib/recentDocuments'

interface PersistenceLogger {
  debug(message: string, context?: unknown): void
  info(message: string, context?: unknown): void
  warn(message: string, context?: unknown): void
  error(message: string, context?: unknown): void
}

type CreateAndroidMarkdownDocument = Parameters<
  typeof saveLocalDraftToAndroidDocumentWorkflow
>[0]['createAndroidMarkdownDocument']

type WriteAndroidMarkdownDocument = Parameters<
  typeof saveAndroidDocumentWorkflow
>[0]['writeAndroidMarkdownDocument']

export interface CurrentDocumentPersistenceOptions {
  // App-owned state the persistence flows read and write.
  currentScreen: Ref<AppScreen>
  documentState: Ref<MarkdownDocumentState>
  status: Ref<string>
  homeNotice: Ref<string | null>
  localDrafts: Ref<LocalDraftRecord[]>
  androidRecentDocuments: Ref<RecentDocumentRecord[]>
  currentAndroidDocumentCanWrite: Ref<boolean>
  promptLocalDraftSaveOnExit: Ref<boolean>
  draftExitPromptOpen: Ref<boolean>
  androidExitPromptOpen: Ref<boolean>
  savingLocalDraftToAndroid: Ref<boolean>
  savingAndroidDocumentCopy: Ref<boolean>
  sharingCurrentDocument: Ref<boolean>
  exportingPdfDocument: Ref<boolean>
  // Editor access and chrome, owned by App.
  hasEditor: () => boolean
  getEditorMarkdownSnapshot: (flushPending?: boolean) => string
  syncDocumentFromEditor: (markDirty: boolean, flushPending: boolean) => MarkdownDocumentState
  closeEditorMenu: () => void
  closeEditorToHome: () => void
  // Predicates and presentation helpers that stay with App state.
  isLocalDraftDocument: () => boolean
  canSaveAndroidDocumentCopy: () => boolean
  canShareCurrentDocument: () => boolean
  canPersistLocalDrafts: () => boolean
  canPersistAndroidRecoveryDrafts: () => boolean
  getTransientAndroidSaveMessage: () => string
  getAndroidEditorStatus: () => string
  getDraftLogStats: () => { characters: number, words: number, lines: number }
  // Store persistence and recents bookkeeping owned by App.
  persistLocalDrafts: (drafts: LocalDraftRecord[]) => void
  persistAndroidRecentDocuments: (records: RecentDocumentRecord[]) => void
  rememberAndroidDocument: (document: OpenedAndroidDocument) => void
  // Autosave scheduler handles.
  clearDraftSaveTimer: () => void
  clearAndroidDocumentSaveTimer: () => void
  scheduleAndroidDocumentSave: () => void
  // Native adapters.
  writeAndroidMarkdownDocument: WriteAndroidMarkdownDocument
  createAndroidMarkdownDocument: CreateAndroidMarkdownDocument
  shareAndroidMarkdownDocument: (
    markdown: string,
    suggestedName: string,
    options: { attachImages: boolean, encoding: MarkdownSaveSettings['encoding'] },
  ) => Promise<AndroidShareResult>
  renderPdfExportHtml: (options: {
    markdown: string
    title: string
    textDirection: 'ltr' | 'rtl'
  }) => Promise<string>
  exportAndroidMarkdownPdf: (
    html: string,
    suggestedName: string,
  ) => Promise<AndroidPdfExportResult>
  getPdfTextDirection: () => 'ltr' | 'rtl'
  getAndroidDocumentUserMessage: (error: unknown) => string
  // Settings and messages.
  markdownSaveSettings: Ref<MarkdownSaveSettings>
  imageSharingSettings: Ref<ImageSharingSettings>
  androidSaveRecoveryMessage: string
  appLogger: PersistenceLogger
  documentLogger: PersistenceLogger
  draftLogger: PersistenceLogger
}

export interface CurrentDocumentPersistence {
  /** Returns whether the recovery draft was durably written to storage. */
  persistAndroidRecoveryDraft(sourceUri: string, markdown: string): boolean
  removeAndroidRecoveryDraft(sourceUri: string): void
  /**
   * Returns whether the current local-draft content is durably safe: true when
   * it was persisted or there was nothing to persist, false when there was
   * content that could not be kept (drafts disabled, or a storage failure).
   */
  saveDraft(): boolean
  saveAndroidDocument(options?: SaveAndroidDocumentOptions): Promise<boolean>
  saveLocalDraftToAndroidDocument(options?: { returnHomeAfterSave?: boolean }): Promise<boolean>
  saveAndroidDocumentCopy(options?: { returnHomeAfterSave?: boolean }): Promise<boolean>
  shareCurrentMarkdownDocument(): Promise<boolean>
  exportCurrentDocumentPdf(): Promise<boolean>
  flushCurrentDocument(reason: string): Promise<void>
}

export interface SaveAndroidDocumentOptions {
  /** Wait for a coalesced save and then retry with the current editor snapshot. */
  waitForPendingSave?: boolean
  /** Let a caller that owns a fresher snapshot defer recovery persistence. */
  persistRecoveryDraftOnFailure?: boolean
}

/**
 * Orchestrates every way the current editor document is persisted or exported:
 * local-draft autosave, Android document save with in-flight coalescing,
 * draft-to-device save, save-a-copy, sharing, lifecycle flushes, and the
 * recovery-draft and recents bookkeeping around them. The save/share workflows
 * and document-state transitions are reused unchanged.
 */
export function createCurrentDocumentPersistence(
  options: CurrentDocumentPersistenceOptions,
): CurrentDocumentPersistence {
  let activeAndroidSave: Promise<boolean> | null = null
  let androidSaveRequestedAfterCurrent = false

  function persistAndroidRecoveryDraft(sourceUri: string, markdown: string): boolean {
    if (!options.canPersistAndroidRecoveryDrafts()) {
      options.documentLogger.warn('skip Android recovery draft because recovery drafts are disabled', {
        sourceUri,
        characters: markdown.length,
      })
      return false
    }

    const recoveryDraft = createAndroidRecoveryDraft(sourceUri, markdown, new Date().toISOString())
    if (!recoveryDraft) {
      return false
    }

    try {
      options.persistLocalDrafts(upsertLocalDraft(options.localDrafts.value, recoveryDraft))
    } catch (error) {
      options.draftLogger.error('failed to persist Android recovery draft', { sourceUri, error })
      return false
    }

    options.draftLogger.warn('kept Android document edits as a local recovery draft', {
      sourceUri,
      characters: markdown.length,
    })
    return true
  }

  function removeAndroidRecoveryDraft(sourceUri: string) {
    const recoveryDraftId = getAndroidRecoveryDraftId(sourceUri)
    if (options.localDrafts.value.some(draft => draft.id === recoveryDraftId)) {
      options.persistLocalDrafts(removeLocalDraft(options.localDrafts.value, recoveryDraftId))
    }
  }

  function markAndroidRecentDocumentSaved(savedAt: string) {
    const sourceUri = options.documentState.value.sourceUri
    if (!sourceUri) {
      return
    }

    const nextDocuments = markSavedAndroidRecentDocument(
      options.androidRecentDocuments.value,
      sourceUri,
      {
        markdown: options.documentState.value.markdown,
        savedAt,
        canWrite: options.currentAndroidDocumentCanWrite.value,
      },
    )
    if (!nextDocuments) {
      options.documentLogger.warn('saved Android recent document not found', { sourceUri })
      return
    }

    options.persistAndroidRecentDocuments(nextDocuments)
    removeAndroidRecoveryDraft(sourceUri)
  }

  function saveDraft(): boolean {
    options.clearDraftSaveTimer()

    if (!options.hasEditor()) {
      return true
    }

    if (options.documentState.value.autosaveTarget !== 'local-draft') {
      options.documentLogger.debug('skip local draft autosave for Android document', {
        id: options.documentState.value.id,
        sourceUri: options.documentState.value.sourceUri,
        autosaveState: options.documentState.value.autosaveState,
      })
      return true
    }

    const value = options.getEditorMarkdownSnapshot(true)

    if (!options.canPersistLocalDrafts()) {
      options.clearDraftSaveTimer()
      options.draftLogger.debug('skip local draft save because local drafts are disabled', {
        id: options.documentState.value.id,
      })
      // Nothing was persisted; the content is only safe if there is none to keep.
      return value.trim().length === 0
    }

    const localDraftAutosave = createLocalDraftAutosaveResult(
      options.documentState.value,
      value,
      options.localDrafts.value,
    )
    options.documentState.value = localDraftAutosave.savingDocument

    try {
      options.persistLocalDrafts(localDraftAutosave.nextDrafts)
      options.documentState.value = localDraftAutosave.savedDocument
      options.status.value = localDraftAutosave.hasContent ? 'Autosaved locally' : 'Ready'
      options.draftLogger.debug('local draft saved', options.getDraftLogStats())
      return true
    } catch (error) {
      options.documentState.value = markDocumentSaveFailed(options.documentState.value, error)
      options.status.value = 'Autosave failed'
      options.draftLogger.error('local draft save failed', error)
      return false
    }
  }

  async function saveAndroidDocument(saveOptions: SaveAndroidDocumentOptions = {}) {
    options.clearAndroidDocumentSaveTimer()

    if (!options.hasEditor()) {
      return true
    }

    const value = options.getEditorMarkdownSnapshot(true)
    const startResult = createSaveAndroidDocumentWorkflowStart({
      documentState: options.documentState.value,
      markdown: value,
      canWrite: options.currentAndroidDocumentCanWrite.value,
      markdownSaveSettings: options.markdownSaveSettings.value,
    })

    if (startResult.kind === 'not-android-document' || startResult.kind === 'clean') {
      return true
    }

    if (startResult.kind === 'missing-source') {
      options.status.value = startResult.status
      options.documentLogger.error('Android document save missing source URI', {
        id: startResult.documentId,
      })
      return false
    }

    if (startResult.kind === 'read-only') {
      options.status.value = startResult.status
      options.documentLogger.debug('skip Android document autosave without write access', {
        id: startResult.documentId,
        sourceUri: startResult.sourceUri,
      })
      return startResult.saved
    }

    if (activeAndroidSave) {
      if (saveOptions.waitForPendingSave) {
        await activeAndroidSave
        return saveAndroidDocument(saveOptions)
      }

      androidSaveRequestedAfterCurrent = true
      return false
    }

    options.documentState.value = startResult.request.savingDocument
    options.status.value = startResult.status

    const saveOperation = (async () => {
      const result = await saveAndroidDocumentWorkflow({
        request: startResult.request,
        getCurrentDocumentState: () => options.documentState.value,
        writeAndroidMarkdownDocument: options.writeAndroidMarkdownDocument,
        getAndroidDocumentUserMessage: options.getAndroidDocumentUserMessage,
        recoveryMessage: options.androidSaveRecoveryMessage,
        logger: options.documentLogger,
      })

      if (result.kind === 'saved') {
        options.documentState.value = result.savedDocument
        markAndroidRecentDocumentSaved(result.savedAt)
        options.status.value = result.status
        return true
      }

      if (result.kind === 'changed-during-save') {
        androidSaveRequestedAfterCurrent = true
        return false
      }

      options.documentState.value = result.failedDocument
      const recoveryKept =
        saveOptions.persistRecoveryDraftOnFailure !== false
        && options.canPersistAndroidRecoveryDrafts()
        && persistAndroidRecoveryDraft(result.recoveryDraft.sourceUri, result.recoveryDraft.markdown)
      options.status.value = recoveryKept
        ? result.status
        : options.getAndroidDocumentUserMessage(result.error)
      return false
    })()
    activeAndroidSave = saveOperation

    try {
      return await saveOperation
    } finally {
      if (activeAndroidSave === saveOperation) {
        activeAndroidSave = null
      }
      if (androidSaveRequestedAfterCurrent) {
        androidSaveRequestedAfterCurrent = false
        if (
          options.hasEditor()
          && options.documentState.value.autosaveTarget === 'android-document'
          && options.currentAndroidDocumentCanWrite.value
        ) {
          options.scheduleAndroidDocumentSave()
        }
      }
    }
  }

  async function saveLocalDraftToAndroidDocument(
    saveOptions: { returnHomeAfterSave?: boolean } = {},
  ) {
    options.closeEditorMenu()

    if (
      !options.hasEditor()
      || !options.isLocalDraftDocument()
      || options.savingLocalDraftToAndroid.value
    ) {
      return false
    }

    saveDraft()
    const draftDocument = options.syncDocumentFromEditor(false, true)

    const reopenPromptOnCancel
      = options.draftExitPromptOpen.value && saveOptions.returnHomeAfterSave === true
    options.draftExitPromptOpen.value = false
    options.savingLocalDraftToAndroid.value = true
    options.status.value = 'Choose a location'

    const result = await saveLocalDraftToAndroidDocumentWorkflow({
      draftDocument,
      returnHomeAfterSave: saveOptions.returnHomeAfterSave === true,
      reopenPromptOnCancel,
      transientAccessMessage: options.getTransientAndroidSaveMessage(),
      createAndroidMarkdownDocument: options.createAndroidMarkdownDocument,
      getAndroidDocumentUserMessage: options.getAndroidDocumentUserMessage,
      markdownSaveSettings: options.markdownSaveSettings.value,
      logger: options.documentLogger,
    })

    try {
      if (result.kind === 'empty') {
        options.status.value = result.status
        return false
      }

      if (result.kind === 'canceled') {
        options.status.value = options.canPersistLocalDrafts() ? result.status : 'Edited'
        if (reopenPromptOnCancel) {
          options.draftExitPromptOpen.value = true
        }
        return false
      }

      if (result.kind === 'transient') {
        options.status.value = result.status
        options.homeNotice.value = result.homeNotice
        options.currentAndroidDocumentCanWrite.value = false
        if (result.closeEditorToHome) {
          options.closeEditorToHome()
        }
        return false
      }

      if (result.kind === 'saved') {
        options.persistLocalDrafts(
          removeLocalDraft(options.localDrafts.value, result.removeLocalDraftId),
        )
        options.rememberAndroidDocument(result.createdDocument)
        options.currentAndroidDocumentCanWrite.value = result.canWrite
        options.promptLocalDraftSaveOnExit.value = false
        options.documentState.value = result.savedDocument
        options.status.value = options.getAndroidEditorStatus()
        if (result.closeEditorToHome) {
          options.closeEditorToHome()
        }
        return true
      }

      options.documentState.value = result.failedDocument
      options.status.value = result.status
      if (result.reopenPrompt) {
        options.draftExitPromptOpen.value = true
      }
      return false
    } finally {
      options.savingLocalDraftToAndroid.value = false
    }
  }

  async function saveAndroidDocumentCopy(saveOptions: { returnHomeAfterSave?: boolean } = {}) {
    options.closeEditorMenu()

    if (
      !options.hasEditor()
      || !options.canSaveAndroidDocumentCopy()
      || options.savingAndroidDocumentCopy.value
    ) {
      return false
    }

    const originalSourceUri = options.documentState.value.sourceUri
    const copySourceDocument = options.syncDocumentFromEditor(
      options.documentState.value.isDirty,
      true,
    )

    options.savingAndroidDocumentCopy.value = true
    options.status.value = 'Choose a location'

    try {
      const result = await saveAndroidDocumentCopyWorkflow({
        copySourceDocument,
        originalSourceUri,
        reservedDisplayNames: options.androidRecentDocuments.value.map(
          document => document.displayName,
        ),
        returnHomeAfterSave: saveOptions.returnHomeAfterSave === true,
        transientAccessMessage: options.getTransientAndroidSaveMessage(),
        createAndroidMarkdownDocument: options.createAndroidMarkdownDocument,
        getAndroidDocumentUserMessage: options.getAndroidDocumentUserMessage,
        markdownSaveSettings: options.markdownSaveSettings.value,
        logger: options.documentLogger,
      })

      if (result.kind === 'canceled') {
        options.status.value = options.getAndroidEditorStatus()
        return false
      }

      if (result.kind === 'transient') {
        if (result.recoveryDraft && options.canPersistAndroidRecoveryDrafts()) {
          persistAndroidRecoveryDraft(result.recoveryDraft.sourceUri, result.recoveryDraft.markdown)
        }
        options.status.value = result.status
        return false
      }

      if (result.kind === 'saved') {
        if (result.removeRecoveryDraftSourceUri) {
          removeAndroidRecoveryDraft(result.removeRecoveryDraftSourceUri)
        }
        options.rememberAndroidDocument(result.createdDocument)
        options.currentAndroidDocumentCanWrite.value = result.canWrite
        options.promptLocalDraftSaveOnExit.value = false
        options.documentState.value = result.savedDocument
        options.status.value = options.getAndroidEditorStatus()
        options.androidExitPromptOpen.value = false
        if (result.closeEditorToHome) {
          options.closeEditorToHome()
        }
        return true
      }

      if (result.recoveryDraft && options.canPersistAndroidRecoveryDrafts()) {
        persistAndroidRecoveryDraft(result.recoveryDraft.sourceUri, result.recoveryDraft.markdown)
      }
      options.documentState.value = result.failedDocument
      options.status.value = result.status
      return false
    } finally {
      options.savingAndroidDocumentCopy.value = false
    }
  }

  async function shareCurrentMarkdownDocument() {
    options.closeEditorMenu()

    if (
      !options.hasEditor()
      || !options.canShareCurrentDocument()
      || options.sharingCurrentDocument.value
    ) {
      return false
    }

    const currentDocument = options.syncDocumentFromEditor(
      options.documentState.value.isDirty,
      true,
    )
    if (currentDocument.autosaveTarget === 'local-draft') {
      saveDraft()
    }

    options.sharingCurrentDocument.value = true
    options.status.value = 'Sharing'

    try {
      const result = await shareAndroidMarkdownDocumentWorkflow({
        currentDocument,
        shareAndroidMarkdownDocument: options.shareAndroidMarkdownDocument,
        getAndroidDocumentUserMessage: options.getAndroidDocumentUserMessage,
        imageSharingSettings: options.imageSharingSettings.value,
        markdownSaveSettings: options.markdownSaveSettings.value,
        logger: options.documentLogger,
      })

      options.status.value = result.status
      return result.kind === 'shared'
    } finally {
      options.sharingCurrentDocument.value = false
    }
  }

  async function exportCurrentDocumentPdf() {
    options.closeEditorMenu()

    if (
      !options.hasEditor()
      || !options.canShareCurrentDocument()
      || options.exportingPdfDocument.value
    ) {
      return false
    }

    const currentDocument = options.syncDocumentFromEditor(
      options.documentState.value.isDirty,
      true,
    )
    if (currentDocument.autosaveTarget === 'local-draft') {
      saveDraft()
    }

    options.exportingPdfDocument.value = true
    options.status.value = 'Exporting PDF'

    try {
      const result = await exportAndroidPdfWorkflow({
        currentDocument,
        textDirection: options.getPdfTextDirection(),
        renderPdfExportHtml: options.renderPdfExportHtml,
        exportAndroidMarkdownPdf: options.exportAndroidMarkdownPdf,
        getAndroidDocumentUserMessage: options.getAndroidDocumentUserMessage,
        logger: options.documentLogger,
      })

      options.status.value = result.status
      return result.kind === 'exported'
    } finally {
      options.exportingPdfDocument.value = false
    }
  }

  async function flushCurrentDocument(reason: string) {
    if (options.currentScreen.value !== 'editor' || !options.hasEditor()) {
      return
    }

    options.appLogger.info('flush current editor document', {
      reason,
      autosaveTarget: options.documentState.value.autosaveTarget,
      isDirty: options.documentState.value.isDirty,
      autosaveState: options.documentState.value.autosaveState,
    })

    if (options.documentState.value.autosaveTarget === 'android-document') {
      await saveAndroidDocument()
    } else {
      saveDraft()
    }
  }

  return {
    persistAndroidRecoveryDraft,
    removeAndroidRecoveryDraft,
    saveDraft,
    saveAndroidDocument,
    saveLocalDraftToAndroidDocument,
    saveAndroidDocumentCopy,
    shareCurrentMarkdownDocument,
    exportCurrentDocumentPdf,
    flushCurrentDocument,
  }
}
