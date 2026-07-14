import {
  cleanupImportedAndroidImages,
  collectMarkTextLocalImageFileNames,
  type ImportedAndroidImageCleanupResult,
} from '../../lib/androidImages'
import {
  readImportedImageRegistry,
  type ImportedImageRegistrySnapshot,
} from './importedImageRegistry'

interface MarkdownSource {
  markdown: string
}

interface CurrentDocumentSource extends MarkdownSource {
  sourceUri: string | null
}

interface RecentDocumentSource {
  sourceUri: string | null
}

interface ImportedImageMaintenanceOptions {
  currentDocument: CurrentDocumentSource
  localDrafts: readonly MarkdownSource[]
  recentDocuments: readonly RecentDocumentSource[]
  readRecentMarkdown: (sourceUri: string) => Promise<MarkdownSource>
  imageRegistry?: ImportedImageRegistrySnapshot
  cleanup?: (
    referencedFileNames: readonly string[],
    managedFileNames: readonly string[],
  ) => Promise<ImportedAndroidImageCleanupResult>
}

export class ImportedImageCleanupBlockedError extends Error {
  readonly code = 'RECENT_DOCUMENT_UNREADABLE'
  readonly unreadableDocumentCount: number

  constructor(unreadableDocumentCount: number) {
    super('Could not check every recent document')
    this.name = 'ImportedImageCleanupBlockedError'
    this.unreadableDocumentCount = unreadableDocumentCount
  }
}

export async function cleanupUnusedImportedImages(options: ImportedImageMaintenanceOptions) {
  const markdownSources = [
    options.currentDocument.markdown,
    ...options.localDrafts.map(draft => draft.markdown),
  ]
  const currentSourceUri = options.currentDocument.sourceUri
  const recentSourceUris = new Set(
    options.recentDocuments
      .map(document => document.sourceUri)
      .filter((sourceUri): sourceUri is string => Boolean(sourceUri) && sourceUri !== currentSourceUri),
  )
  let unreadableDocumentCount = 0

  for (const sourceUri of recentSourceUris) {
    try {
      markdownSources.push((await options.readRecentMarkdown(sourceUri)).markdown)
    } catch {
      unreadableDocumentCount += 1
    }
  }

  if (unreadableDocumentCount > 0) {
    throw new ImportedImageCleanupBlockedError(unreadableDocumentCount)
  }

  const referencedFileNames = new Set<string>()
  const imageRegistry = options.imageRegistry ?? readImportedImageRegistry()
  for (const fileName of imageRegistry.protectedFileNames) {
    referencedFileNames.add(fileName)
  }
  for (const markdown of markdownSources) {
    for (const fileName of collectMarkTextLocalImageFileNames(markdown)) {
      referencedFileNames.add(fileName)
    }
  }

  const cleanup = options.cleanup ?? cleanupImportedAndroidImages
  return cleanup(
    [...referencedFileNames],
    [...new Set(imageRegistry.managedFileNames)],
  )
}
