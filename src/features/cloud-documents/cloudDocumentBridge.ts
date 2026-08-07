import {
  readAndroidMarkdownDocument,
  writeAndroidMarkdownDocument,
  type AndroidReadOptions,
  type AndroidWriteOptions,
  type OpenedAndroidDocument,
  type SavedAndroidDocument,
} from '../../lib/androidDocuments'
import {
  readCloudDocument,
  writeCloudDocument,
  type CloudDocumentContent,
} from '../../lib/cloudDocuments'
import { buildCloudSourceUri, parseCloudSourceUri } from '../../lib/cloudDocumentUris'

/**
 * Last-seen ETag per cloud source URI, for conflict-checked writes
 * (If-Match). Process-lifetime is enough: a document is always read before
 * it can be saved, and a fresh read refreshes the entry.
 */
const cloudDocumentETags = new Map<string, string>()

export function toOpenedDocumentFromCloud(content: CloudDocumentContent): OpenedAndroidDocument {
  const sourceUri = buildCloudSourceUri('onedrive', content.fileId)
  cloudDocumentETags.set(sourceUri, content.eTag)
  return {
    canceled: false,
    sourceUri,
    displayName: content.displayName,
    providerName: content.providerName,
    pathHint: content.displayName,
    mimeType: 'text/markdown',
    markdown: content.markdown,
    encoding: content.encoding,
    hasEncodingBom: content.hasEncodingBom,
    canWrite: content.canWrite,
    // Token-backed access survives restarts the way a persisted SAF grant
    // does, which is what downstream `persisted` consumers actually gate on.
    persisted: true,
  }
}

/**
 * Drop-in replacements for the SAF read/write functions: `cloud:` source
 * URIs route to the cloud plugin, everything else passes through. Injected
 * where App.vue previously injected the SAF functions, so the entire
 * document pipeline (autosave, recovery, recents) stays unchanged.
 */
export async function readRoutedMarkdownDocument(
  sourceUri: string,
  options: AndroidReadOptions = {},
): Promise<OpenedAndroidDocument> {
  const cloud = parseCloudSourceUri(sourceUri)
  if (!cloud) {
    return readAndroidMarkdownDocument(sourceUri, options)
  }

  const content = await readCloudDocument(cloud.provider, cloud.fileId, options)
  return toOpenedDocumentFromCloud(content)
}

export async function writeRoutedMarkdownDocument(
  sourceUri: string,
  markdown: string,
  options: AndroidWriteOptions,
): Promise<SavedAndroidDocument> {
  const cloud = parseCloudSourceUri(sourceUri)
  if (!cloud) {
    return writeAndroidMarkdownDocument(sourceUri, markdown, options)
  }

  const written = await writeCloudDocument(cloud.provider, cloud.fileId, markdown, {
    encoding: options.encoding,
    writeBom: options.writeBom,
    eTag: cloudDocumentETags.get(sourceUri),
  })
  cloudDocumentETags.set(sourceUri, written.eTag)
  return {
    sourceUri,
    displayName: written.displayName,
    providerName: 'OneDrive',
    pathHint: written.displayName,
    mimeType: 'text/markdown',
    encoding: options.encoding,
    canWrite: true,
    persisted: true,
  }
}
