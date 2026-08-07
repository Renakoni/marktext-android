import {
  AndroidDocumentError,
  readAndroidMarkdownDocument,
  writeAndroidMarkdownDocument,
  type AndroidReadOptions,
  type AndroidWriteOptions,
  type OpenedAndroidDocument,
  type SavedAndroidDocument,
} from '../../lib/androidDocuments'
import {
  createCloudDocument,
  readCloudDocument,
  writeCloudDocument,
  type CloudDocumentContent,
  type CloudProviderId,
} from '../../lib/cloudDocuments'
import { buildCloudSourceUri, parseCloudSourceUri } from '../../lib/cloudDocumentUris'

/**
 * Last-seen version tag (OneDrive ETag / Drive headRevisionId) per cloud
 * source URI, for conflict-checked writes. Process-lifetime is enough: a
 * document is always read before it can be saved, and a fresh read
 * refreshes the entry.
 */
const cloudDocumentETags = new Map<string, string>()

const CLOUD_PROVIDER_LABELS: Record<CloudProviderId, string> = {
  onedrive: 'OneDrive',
  googledrive: 'Google Drive',
  webdav: 'WebDAV',
}

export function toOpenedDocumentFromCloud(
  provider: CloudProviderId,
  content: CloudDocumentContent,
): OpenedAndroidDocument {
  const sourceUri = buildCloudSourceUri(provider, content.fileId)
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
 * Save-as: creates a new provider document and adopts it into the
 * opened-document shape. The returned document's version tag is seeded
 * into this module's map, so the very first autosave writes with the
 * created ETag instead of failing closed.
 */
export async function createRoutedCloudDocument(
  provider: CloudProviderId,
  parentId: string | null,
  name: string,
  markdown: string,
  options: { encoding: OpenedAndroidDocument['encoding']; writeBom: boolean },
): Promise<OpenedAndroidDocument> {
  const created = await createCloudDocument(provider, {
    parentId: parentId ?? undefined,
    name,
    markdown,
    encoding: options.encoding,
    writeBom: options.writeBom,
  })
  const sourceUri = buildCloudSourceUri(provider, created.fileId)
  cloudDocumentETags.set(sourceUri, created.eTag)
  return {
    canceled: false,
    sourceUri,
    displayName: created.displayName,
    providerName: CLOUD_PROVIDER_LABELS[provider],
    pathHint: created.displayName,
    mimeType: 'text/markdown',
    markdown,
    encoding: options.encoding,
    hasEncodingBom: options.writeBom,
    canWrite: true,
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
  return toOpenedDocumentFromCloud(cloud.provider, content)
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

  // Fail closed without a baseline ETag (for example after a recovery
  // reload dropped this module's state): an ETag-less PUT would silently
  // overwrite whatever changed remotely in the meantime. The save-failed
  // path keeps the content in a recovery draft; reopening re-reads the
  // document and re-establishes the ETag.
  const eTag = cloudDocumentETags.get(sourceUri)
  if (!eTag) {
    throw new AndroidDocumentError(
      'CLOUD_DOCUMENT_CONFLICT',
      'This document must be reopened before it can be saved to the cloud',
    )
  }

  const written = await writeCloudDocument(cloud.provider, cloud.fileId, markdown, {
    encoding: options.encoding,
    writeBom: options.writeBom,
    eTag,
  })
  cloudDocumentETags.set(sourceUri, written.eTag)
  return {
    sourceUri,
    displayName: written.displayName,
    providerName: CLOUD_PROVIDER_LABELS[cloud.provider],
    pathHint: written.displayName,
    mimeType: 'text/markdown',
    encoding: options.encoding,
    canWrite: true,
    persisted: true,
  }
}
