import {
  cleanupAndroidDocumentGrants,
  isAndroidDocumentAccessAvailable,
  type AndroidDocumentGrantCleanupResult,
} from '../../lib/androidDocuments'

interface ReferencedDocumentSource {
  sourceUri: string | null
}

export interface DocumentGrantSyncOptions {
  currentDocument: ReferencedDocumentSource
  recentDocuments: readonly ReferencedDocumentSource[]
}

/**
 * The set of content URIs whose persisted SAF grant a protected document
 * still depends on: every Android document in the recents store (pinned
 * records included — the store is the grant LRU, #153) plus the currently
 * open document, which may have just been removed from recents while its
 * editor session still writes through the grant.
 */
export function collectReferencedDocumentUris(options: DocumentGrantSyncOptions): string[] {
  const referenced = new Set<string>()
  if (options.currentDocument.sourceUri) {
    referenced.add(options.currentDocument.sourceUri)
  }
  for (const document of options.recentDocuments) {
    if (document.sourceUri) {
      referenced.add(document.sourceUri)
    }
  }
  return [...referenced].sort()
}

interface DocumentGrantSyncDependencies {
  cleanup?: (referencedUris: readonly string[]) => Promise<AndroidDocumentGrantCleanupResult>
  isAvailable?: () => boolean
}

/**
 * Returns a sync function that pushes the referenced-URI set to the native
 * grant cleanup whenever it changes. The native side is idempotent and
 * conservative (it releases only settled, unreferenced document grants it
 * itself recorded), so the memo here is purely traffic suppression: recents
 * persist on every autosave tick, but the URI set only changes when a
 * document is opened, saved-as, or removed. A cleanup that failed — the
 * call rejected, OR it resolved with failedReleaseCount > 0 (the native
 * side restores those ledger entries and resolves) — must leave the memo
 * unset so the next invocation retries even with an unchanged set.
 */
export function createDocumentGrantSync(dependencies: DocumentGrantSyncDependencies = {}) {
  const cleanup = dependencies.cleanup ?? cleanupAndroidDocumentGrants
  const isAvailable = dependencies.isAvailable ?? isAndroidDocumentAccessAvailable
  let lastSyncedKey: string | null = null

  return async function syncDocumentGrants(
    options: DocumentGrantSyncOptions,
  ): Promise<AndroidDocumentGrantCleanupResult | null> {
    if (!isAvailable()) {
      return null
    }

    const referencedUris = collectReferencedDocumentUris(options)
    const key = referencedUris.join('\n')
    if (key === lastSyncedKey) {
      return null
    }

    const result = await cleanup(referencedUris)
    lastSyncedKey = result.failedReleaseCount === 0 ? key : null
    return result
  }
}
