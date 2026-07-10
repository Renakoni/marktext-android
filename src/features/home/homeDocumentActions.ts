import type { Ref } from 'vue'
import type { DocumentSelection } from './useDocumentSelection'
import { getAndroidRecoveryDraftId } from '../android-documents/androidRecoveryDrafts'
import { renameAndroidRecentDocumentWorkflow } from '../android-documents/renameRecentDocumentWorkflow'
import { shareRecentDocumentsWorkflow } from '../android-documents/shareRecentDocumentsWorkflow'
import type { ImageSharingSettings } from '../android-documents/imageSharingSettings'
import type { MarkdownSaveSettings } from '../settings/advancedSettings'
import type {
  AndroidShareDocumentPayload,
  AndroidShareResult,
  RenamedAndroidDocument,
} from '../../lib/androidDocuments'
import { createUntitledDocument, type MarkdownDocumentState } from '../../lib/documentState'
import { removeLocalDraft, renameLocalDraft, type LocalDraftRecord } from '../../lib/localDrafts'
import {
  prunePinnedDocuments,
  togglePinnedDocuments,
  type PinnedDocumentRecord,
} from '../../lib/pinnedDocuments'
import type { RecentDocumentListItem, RecentDocumentRecord } from '../../lib/recentDocuments'

interface ActionsLogger {
  info(message: string, context?: unknown): void
  warn(message: string, context?: unknown): void
  error(message: string, context?: unknown): void
}

export interface HomeDocumentActionsOptions {
  // Home list + selection state owned by App.
  documentItems: Ref<RecentDocumentListItem[]>
  selection: DocumentSelection
  homeNotice: Ref<string | null>
  // Document stores and their persistence, owned by App.
  localDrafts: Ref<LocalDraftRecord[]>
  persistLocalDrafts: (drafts: LocalDraftRecord[]) => void
  androidRecentDocuments: Ref<RecentDocumentRecord[]>
  persistAndroidRecentDocuments: (records: RecentDocumentRecord[]) => void
  pinnedDocuments: Ref<PinnedDocumentRecord[]>
  persistPinnedDocuments: (records: PinnedDocumentRecord[]) => void
  // Open editor session state: deletes and renames must not desync it.
  documentState: Ref<MarkdownDocumentState>
  currentAndroidDocumentCanWrite: Ref<boolean>
  // Native adapters (settings-wrapped where the platform call needs them).
  readAndroidMarkdownDocument: (sourceUri: string) => Promise<{ markdown: string }>
  shareAndroidMarkdownDocument: (
    markdown: string,
    suggestedName: string,
    options: { attachImages: boolean, encoding: MarkdownSaveSettings['encoding'] },
  ) => Promise<AndroidShareResult>
  shareAndroidMarkdownDocuments: (
    documents: AndroidShareDocumentPayload[],
    options: { encoding: MarkdownSaveSettings['encoding'] },
  ) => Promise<AndroidShareResult>
  renameAndroidMarkdownDocument: (
    sourceUri: string,
    newName: string,
  ) => Promise<RenamedAndroidDocument>
  getAndroidDocumentUserMessage: (error: unknown) => string
  imageSharingSettings: Ref<ImageSharingSettings>
  markdownSaveSettings: Ref<MarkdownSaveSettings>
  renameTemporaryAccessMessage: string
  appLogger: ActionsLogger
  documentLogger: ActionsLogger
}

export interface HomeDocumentActions {
  pinSelectedDocuments(): void
  deleteSelectedDocuments(): void
  shareSelectedDocuments(): Promise<void>
  renameSelectedDocument(id: string, name: string): Promise<void>
}

/**
 * Orchestrates the home selection-mode actions (pin, delete, share, rename)
 * over the App-owned stores. Rendering stays in the home components; storage
 * shapes and the share/rename workflows are reused unchanged.
 */
export function createHomeDocumentActions(options: HomeDocumentActionsOptions): HomeDocumentActions {
  function getSelectedDocumentRecords() {
    const selectedIds = options.selection.selectedIds.value
    return options.documentItems.value.filter(record => selectedIds.has(record.id))
  }

  // Pins may only be pruned against everything in storage: the home list hides
  // recovery drafts and setting-disabled drafts without deleting them.
  function getAllStoredDocumentIds() {
    return [
      ...options.localDrafts.value.map(draft => draft.id),
      ...options.androidRecentDocuments.value.map(record => record.id),
    ]
  }

  function pinSelectedDocuments() {
    const selectedIds = [...options.selection.selectedIds.value]
    if (selectedIds.length === 0) {
      return
    }

    options.persistPinnedDocuments(
      togglePinnedDocuments(options.pinnedDocuments.value, selectedIds, new Date().toISOString()),
    )
    options.appLogger.info('toggled home document pins', { count: selectedIds.length })
    options.selection.clear()
  }

  function deleteSelectedDocuments() {
    const selectedRecords = getSelectedDocumentRecords()
    if (selectedRecords.length === 0) {
      return
    }

    const draftIds = new Set(
      selectedRecords.filter(record => record.kind === 'local-draft').map(record => record.id),
    )
    const androidRecords = selectedRecords.filter(record => record.kind === 'android-document')

    if (draftIds.size > 0) {
      options.persistLocalDrafts(options.localDrafts.value.filter(draft => !draftIds.has(draft.id)))
    }

    if (androidRecords.length > 0) {
      const androidIds = new Set(androidRecords.map(record => record.id))
      options.persistAndroidRecentDocuments(
        options.androidRecentDocuments.value.filter(record => !androidIds.has(record.id)),
      )
    }

    options.persistPinnedDocuments(
      prunePinnedDocuments(options.pinnedDocuments.value, getAllStoredDocumentIds()),
    )

    // A deleted document must not resurrect from the open editor session.
    if (selectedRecords.some(record => record.id === options.documentState.value.id)) {
      options.documentState.value = createUntitledDocument({ autosaveTarget: 'local-draft' })
      options.currentAndroidDocumentCanWrite.value = false
    }

    options.appLogger.info('deleted home documents', {
      drafts: draftIds.size,
      androidDocuments: androidRecords.length,
    })
    options.selection.clear()
  }

  async function shareSelectedDocuments() {
    const selectedRecords = getSelectedDocumentRecords()
    if (selectedRecords.length === 0) {
      return
    }

    const result = await shareRecentDocumentsWorkflow({
      documents: selectedRecords,
      readAndroidMarkdownDocument: options.readAndroidMarkdownDocument,
      shareAndroidMarkdownDocument: options.shareAndroidMarkdownDocument,
      shareAndroidMarkdownDocuments: options.shareAndroidMarkdownDocuments,
      getAndroidDocumentUserMessage: options.getAndroidDocumentUserMessage,
      imageSharingSettings: options.imageSharingSettings.value,
      markdownSaveSettings: options.markdownSaveSettings.value,
      logger: options.documentLogger,
    })

    if (result.kind === 'failed') {
      // Keep the selection so a transient failure can be retried as-is.
      options.homeNotice.value = result.status
      return
    }

    options.homeNotice.value = null
    options.selection.clear()
  }

  async function renameSelectedDocument(id: string, name: string) {
    const record = options.documentItems.value.find(item => item.id === id)
    if (!record) {
      options.appLogger.warn('rename target not found', { id })
      return
    }

    if (record.kind === 'local-draft') {
      options.persistLocalDrafts(renameLocalDraft(options.localDrafts.value, id, name))
      if (options.documentState.value.id === id) {
        // Keeps the new name flowing through the next autosave of an open session.
        options.documentState.value = { ...options.documentState.value, displayName: name.trim() }
      }
      options.appLogger.info('renamed local draft', { id })
      options.homeNotice.value = null
      options.selection.clear()
      return
    }

    const result = await renameAndroidRecentDocumentWorkflow({
      record,
      newName: name,
      readAndroidMarkdownDocument: options.readAndroidMarkdownDocument,
      renameAndroidMarkdownDocument: options.renameAndroidMarkdownDocument,
      getAndroidDocumentUserMessage: options.getAndroidDocumentUserMessage,
      logger: options.documentLogger,
    })

    if (result.kind === 'failed') {
      options.homeNotice.value = result.status
      return
    }

    const remainingRecentDocuments = options.androidRecentDocuments.value.filter(
      item => item.id !== result.previousId,
    )
    options.persistAndroidRecentDocuments(
      result.accessRetained
        ? [result.updatedRecord, ...remainingRecentDocuments]
        : remainingRecentDocuments,
    )

    // Renaming can change the SAF URI; migrate everything keyed by it.
    if (result.updatedRecord.id !== result.previousId) {
      if (
        result.accessRetained
        && options.pinnedDocuments.value.some(pin => pin.id === result.previousId)
      ) {
        options.persistPinnedDocuments(
          options.pinnedDocuments.value.map(pin =>
            pin.id === result.previousId ? { ...pin, id: result.updatedRecord.id } : pin,
          ),
        )
      }

      const previousUri = record.sourceUri
      const nextUri = result.updatedRecord.sourceUri
      if (previousUri && nextUri && previousUri !== nextUri) {
        const previousRecoveryId = getAndroidRecoveryDraftId(previousUri)
        const recoveryDraft = options.localDrafts.value.find(
          draft => draft.id === previousRecoveryId,
        )
        if (recoveryDraft) {
          options.persistLocalDrafts([
            { ...recoveryDraft, id: getAndroidRecoveryDraftId(nextUri) },
            ...removeLocalDraft(options.localDrafts.value, previousRecoveryId),
          ])
        }
      }
    }

    if (!result.accessRetained) {
      // A session grant cannot back a durable home entry or pin. Recovery
      // content remains local under the migrated URI until the user reopens the
      // renamed file through Android and obtains a new persisted grant.
      options.persistPinnedDocuments(
        options.pinnedDocuments.value.filter(
          pin => pin.id !== result.previousId && pin.id !== result.updatedRecord.id,
        ),
      )
    }

    if (options.documentState.value.id === result.previousId) {
      options.documentState.value = {
        ...options.documentState.value,
        id: result.updatedRecord.id,
        sourceUri: result.updatedRecord.sourceUri,
        displayName: result.updatedRecord.displayName,
      }
    }

    // The rename itself succeeded, but a session-scoped URI must not survive in
    // durable Recents. Tell the user how to restore the entry explicitly.
    options.homeNotice.value = result.accessRetained
      ? null
      : options.renameTemporaryAccessMessage
    options.selection.clear()
  }

  return {
    pinSelectedDocuments,
    deleteSelectedDocuments,
    shareSelectedDocuments,
    renameSelectedDocument,
  }
}
