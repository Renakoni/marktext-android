import {
  createRecentDocumentFromAndroidDocument,
  markRecentDocumentSaved,
  upsertRecentDocument,
  type RecentDocumentRecord,
} from './recentDocuments'

interface AndroidRecentDocumentSource {
  sourceUri: string
  displayName: string
  providerName: string | null
  pathHint: string | null
  markdown: string
  canWrite: boolean
}

interface SavedAndroidRecentDocumentOptions {
  markdown: string
  savedAt: string
  canWrite: boolean
}

export function rememberAndroidRecentDocument(
  records: RecentDocumentRecord[],
  document: AndroidRecentDocumentSource,
) {
  return upsertRecentDocument(
    records,
    createRecentDocumentFromAndroidDocument({
      sourceUri: document.sourceUri,
      displayName: document.displayName,
      providerName: document.providerName,
      pathHint: document.pathHint,
      markdown: document.markdown,
      canWrite: document.canWrite,
    }),
  )
}

export function markSavedAndroidRecentDocument(
  records: RecentDocumentRecord[],
  sourceUri: string,
  options: SavedAndroidRecentDocumentOptions,
) {
  const existingDocument = records.find(record => record.sourceUri === sourceUri)
  if (!existingDocument) {
    return null
  }

  return upsertRecentDocument(
    records,
    markRecentDocumentSaved(existingDocument, {
      markdown: options.markdown,
      savedAt: options.savedAt,
      canWrite: options.canWrite,
    }),
  )
}
