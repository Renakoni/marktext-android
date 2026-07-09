import { getDocumentTitle } from '../../lib/documentState'
import type { RenamedAndroidDocument } from '../../lib/androidDocuments'
import type { RecentDocumentRecord } from '../../lib/recentDocuments'

interface WorkflowLogger {
  info(message: string, data?: unknown): void
  error(message: string, data?: unknown): void
}

export type RenameAndroidRecentDocumentResult =
  | {
      kind: 'renamed'
      previousId: string
      updatedRecord: RecentDocumentRecord
      /**
       * False when the provider migrated only a session-scoped grant to the
       * renamed URI. The file works until the app restarts, but callers must
       * not persist updatedRecord as a durable recent entry.
       */
      accessRetained: boolean
    }
  | {
      kind: 'failed'
      status: string
      error: unknown
    }

interface RenameAndroidRecentDocumentWorkflowOptions {
  record: RecentDocumentRecord
  newName: string
  readAndroidMarkdownDocument: (sourceUri: string) => Promise<{ markdown: string }>
  renameAndroidMarkdownDocument: (
    sourceUri: string,
    newName: string,
  ) => Promise<RenamedAndroidDocument>
  getAndroidDocumentUserMessage: (error: unknown) => string
  logger?: WorkflowLogger
}

export async function renameAndroidRecentDocumentWorkflow({
  record,
  newName,
  readAndroidMarkdownDocument,
  renameAndroidMarkdownDocument,
  getAndroidDocumentUserMessage,
  logger,
}: RenameAndroidRecentDocumentWorkflowOptions): Promise<RenameAndroidRecentDocumentResult> {
  if (record.kind !== 'android-document' || !record.sourceUri) {
    const error = new Error('Only Android documents can be renamed on device')
    return { kind: 'failed', status: getAndroidDocumentUserMessage(error), error }
  }

  try {
    // Read before the irreversible provider operation. The recent record does
    // not store Android document content, and title/display-name equality is
    // not enough to tell a same-named heading from a filename-derived title.
    const document = await readAndroidMarkdownDocument(record.sourceUri)
    const renamed = await renameAndroidMarkdownDocument(record.sourceUri, newName)

    const updatedRecord: RecentDocumentRecord = {
      ...record,
      // Renaming can change the SAF document URI, and the record id embeds it.
      id: `android-document:${renamed.sourceUri}`,
      sourceUri: renamed.sourceUri,
      displayName: renamed.displayName,
      title: getDocumentTitle(document.markdown, renamed.displayName),
      providerName: renamed.providerName ?? record.providerName,
      pathHint: renamed.pathHint ?? renamed.displayName,
      canWrite: renamed.canWrite,
    }

    logger?.info('Renamed Android document', {
      displayName: renamed.displayName,
      persisted: renamed.persisted,
      uriChanged: renamed.sourceUri !== record.sourceUri,
    })

    return {
      kind: 'renamed',
      previousId: record.id,
      updatedRecord,
      accessRetained: renamed.persisted,
    }
  } catch (error) {
    logger?.error('Android document rename failed', error)

    return { kind: 'failed', status: getAndroidDocumentUserMessage(error), error }
  }
}
