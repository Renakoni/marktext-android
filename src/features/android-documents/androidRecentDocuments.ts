import {
  createRecentDocumentFromAndroidDocument,
  markRecentDocumentSaved,
  upsertRecentDocument,
  type RecentDocumentRecord,
} from '../../lib/recentDocuments'

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

// The recents store is an Android document's ONLY durable home (local
// drafts have the unbounded drafts store behind them), so every write
// that re-applies the storage cap must know which ids are pinned —
// a pin-blind cap would silently evict a pinned document and its pin
// would be orphan-pruned on the next startup.
export function rememberAndroidRecentDocument(
  records: RecentDocumentRecord[],
  document: AndroidRecentDocumentSource,
  protectedIds?: ReadonlySet<string>,
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
    undefined,
    protectedIds,
  )
}

export function markSavedAndroidRecentDocument(
  records: RecentDocumentRecord[],
  sourceUri: string,
  options: SavedAndroidRecentDocumentOptions,
  protectedIds?: ReadonlySet<string>,
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
    undefined,
    protectedIds,
  )
}
