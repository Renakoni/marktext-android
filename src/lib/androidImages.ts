import { Capacitor } from '@capacitor/core'
import {
  AndroidDocuments,
  isAndroidDocumentAccessAvailable,
  resolveAndroidDocumentImages,
} from './androidDocuments'

export interface ImportedAndroidImage {
  canceled?: false
  sourceUri: string
  displayName: string
  mimeType: string | null
  markdownSrc: string
  fileUri: string
  bytes: number
}

interface ImportedAndroidImageDirectory {
  fileUri: string
  webBaseUri?: string
}

interface AndroidImageResolverWindow extends Window {
  MarkTextAndroidImageResolver?: (source: string) => string | null
}

export interface AndroidImagePickOptions {
  copyImage: boolean
}

export interface ImportedAndroidImageStorageStats {
  fileCount: number
  bytes: number
}

export interface ImportedAndroidImageCleanupResult extends ImportedAndroidImageStorageStats {
  removedFileCount: number
  removedBytes: number
  failedFileCount: number
}

export class AndroidImageError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'AndroidImageError'
    this.code = code
  }
}

const MARKTEXT_LOCAL_IMAGE_SOURCE_REGEXP = /^marktext-image:\/\/local\/([^/?#]+)$/i
const MARKTEXT_ANDROID_IMAGE_SOURCE_REGEXP = /^marktext-image:\/\/android\/([^/?#]+)$/i
const MARKTEXT_LOCAL_IMAGE_REFERENCE_REGEXP = /marktext-image:\/\/local\/([^/?#\s"'<>()[\]]+)/gi
// Mirrors the editor's own local-image test: only a destination that ends in an
// image extension and carries no scheme can name a file next to the document.
const LOCAL_IMAGE_EXTENSION_REGEXP = /\.(?:jpeg|jpg|png|gif|svg|webp)(?=\?|#|$)/i
const ABSOLUTE_LOCAL_IMAGE_SOURCE_REGEXP = /^(?:\/|\\\\|[a-z]:[\\/])/i
const SCHEME_OR_HOST_IMAGE_SOURCE_REGEXP = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i
// Deliberately permissive: the scanner only feeds a resolution attempt, so an
// over-match costs one failed bridge lookup and an under-match a missing image.
const MARKDOWN_INLINE_IMAGE_DESTINATION_REGEXP = /!\[[^\]]*\]\(\s*(<[^>\n]*>|[^\s)]+)/g
const MARKDOWN_REFERENCE_IMAGE_DESTINATION_REGEXP = /^ {0,3}\[[^\]\n]+\]:[ \t]*(<[^>\n]*>|\S+)/gm

let imageDirectory: ImportedAndroidImageDirectory | null = null

// The document currently open in the editor, and the sibling images Android
// could resolve for it. Reset per document, so a stale grant can never leak an
// image from the previous file into the next one.
let documentImageAccess: DocumentImageAccess | null = null
const documentImageContentUris = new Map<string, string>()

interface DocumentImageAccess {
  treeUri: string
  documentDirectoryId: string
}

export interface AndroidDocumentImagePreparation {
  // False when the document's provider cannot name local siblings (cloud
  // drives), so no folder prompt should ever be offered.
  supported: boolean
  access: 'granted' | 'missing'
  // The document folder's own name, for the permission prompt.
  folderName: string | null
  localImageCount: number
  unresolvedImageCount: number
}


export function isAndroidImageImportAvailable() {
  return Capacitor.getPlatform() === 'android' && Capacitor.isNativePlatform()
}

export function resolveMarkTextImageSource(
  source: string,
  directory: ImportedAndroidImageDirectory | null,
) {
  const androidUri = getMarkTextAndroidImageUri(source)
  if (androidUri) {
    return Capacitor.convertFileSrc(androidUri)
  }

  if (!directory) {
    return null
  }

  const fileName = getMarkTextLocalImageFileName(source)
  if (!fileName) {
    return null
  }

  const baseUri = directory.webBaseUri?.replace(/\/+$/, '')
  if (baseUri) {
    return `${baseUri}/${encodeURIComponent(fileName)}`
  }

  return Capacitor.convertFileSrc(`${directory.fileUri.replace(/\/+$/, '')}/${encodeURIComponent(fileName)}`)
}

// Resolves a MarkText image source to a URI loadable outside the Capacitor
// WebView (the native PDF print WebView reads plain file:// URIs; the
// convertFileSrc form only resolves inside the app's own WebView). Android
// content URIs are returned as-is. Returns null when the source cannot be
// mapped.
export function getMarkTextImageExportFileSource(
  source: string,
  directory: ImportedAndroidImageDirectory | null,
) {
  const androidUri = getMarkTextAndroidImageUri(source)
  if (androidUri) {
    return androidUri
  }

  if (!directory) {
    return null
  }

  const fileName = getMarkTextLocalImageFileName(source)
  if (!fileName) {
    return null
  }

  return `${directory.fileUri.replace(/\/+$/, '')}/${encodeURIComponent(fileName)}`
}

export function getImportedAndroidImageDirectory() {
  return imageDirectory
}

export async function ensureAndroidImageResolver() {
  const win = window as AndroidImageResolverWindow
  if (!isAndroidImageImportAvailable()) {
    win.MarkTextAndroidImageResolver = resolveAndroidImageSource
    return
  }

  if (!imageDirectory) {
    imageDirectory = normalizeImageDirectory(await AndroidDocuments.getImportedImageDirectory())
  }

  win.MarkTextAndroidImageResolver = resolveAndroidImageSource
}

// The single resolver the editor core consults for every image source. A
// sibling image resolved for the open document wins: on Android it is the only
// thing a desktop-style relative path can map to.
function resolveAndroidImageSource(source: string) {
  return resolveDocumentImageSource(source) ?? resolveMarkTextImageSource(source, imageDirectory)
}

function resolveDocumentImageSource(source: string) {
  const contentUri = getDocumentImageContentUri(source)
  return contentUri ? Capacitor.convertFileSrc(contentUri) : null
}

/**
 * Prepares the open document's local images: scans its Markdown for relative
 * image destinations, asks Android to resolve them against the document
 * folder's grant (if one exists), and installs the results for the synchronous
 * editor resolver.
 *
 * The returned preparation is what tells the caller whether to offer the folder
 * grant: `supported` says the provider can have local siblings at all, `access`
 * whether the folder is already reachable, and `unresolvedImageCount` how many
 * destinations are still unreadable.
 */
export async function prepareAndroidDocumentImages(input: {
  sourceUri: string | null
  markdown: string
}): Promise<AndroidDocumentImagePreparation> {
  resetAndroidDocumentImages()

  const sources = findLocalMarkdownImageSources(input.markdown)
  const preparation: AndroidDocumentImagePreparation = {
    supported: false,
    access: 'missing',
    folderName: null,
    localImageCount: sources.length,
    unresolvedImageCount: sources.length,
  }

  // Asked even with no local destination in sight: knowing the folder is
  // granted up front is what lets an image typed into the document later
  // resolve without another bridge round trip.
  if (
    !input.sourceUri
    || !isAndroidContentUri(input.sourceUri)
    || !isAndroidDocumentAccessAvailable()
  ) {
    return preparation
  }

  let result
  try {
    result = await resolveAndroidDocumentImages(input.sourceUri, sources)
  } catch {
    // An unreachable bridge, or a provider the user revoked: the document must
    // still open, just without its local images.
    return preparation
  }

  preparation.supported = result.supported
  preparation.access = result.access
  preparation.folderName = result.folderName ?? null

  if (result.access === 'granted' && result.treeUri && result.documentDirectoryId) {
    documentImageAccess = {
      treeUri: result.treeUri,
      documentDirectoryId: result.documentDirectoryId,
    }
  }

  for (const [source, uri] of Object.entries(result.resolved ?? {})) {
    documentImageContentUris.set(source, uri)
  }

  preparation.unresolvedImageCount = sources.filter(
    source => !getDocumentImageContentUri(source),
  ).length

  return preparation
}

export function resetAndroidDocumentImages() {
  documentImageAccess = null
  documentImageContentUris.clear()
}

/**
 * Whether the folder-grant offer is worth showing: the document's provider can
 * have local siblings, none of them is reachable yet, and the document actually
 * links one. A missing or non-SAF `sourceUri` (a local draft, a cloud document)
 * never qualifies, and neither does a folder whose grant is already held.
 */
export function shouldOfferAndroidDocumentImageAccess(
  preparation: AndroidDocumentImagePreparation,
  sourceUri: string | null,
) {
  return Boolean(
    sourceUri
    && isAndroidContentUri(sourceUri)
    && preparation.supported
    && preparation.access === 'missing'
    && preparation.unresolvedImageCount > 0,
  )
}

/**
 * The relative image destinations in `markdown`, in document order, duplicates
 * collapsed. Absolute paths, remote URLs, data URIs, and the app's own
 * marktext-image:// sources are excluded: none of them names a file beside the
 * document.
 */
export function findLocalMarkdownImageSources(markdown: string) {
  const sources = new Set<string>()
  for (const match of markdown.matchAll(MARKDOWN_INLINE_IMAGE_DESTINATION_REGEXP)) {
    addLocalImageSource(sources, match[1])
  }
  for (const match of markdown.matchAll(MARKDOWN_REFERENCE_IMAGE_DESTINATION_REGEXP)) {
    addLocalImageSource(sources, match[1])
  }
  return [...sources]
}

export function isLocalRelativeImageSource(source: string) {
  const trimmed = unwrapImageDestination(source)
  if (!trimmed || !LOCAL_IMAGE_EXTENSION_REGEXP.test(trimmed)) {
    return false
  }
  if (SCHEME_OR_HOST_IMAGE_SOURCE_REGEXP.test(trimmed)) {
    return false
  }
  return !ABSOLUTE_LOCAL_IMAGE_SOURCE_REGEXP.test(trimmed)
}

// A content URI the native PDF print WebView can open directly, or null when
// the source is not a resolved local sibling.
export function getDocumentLocalImageExportSource(source: string) {
  return getDocumentImageContentUri(source)
}

function addLocalImageSource(sources: Set<string>, destination: string | undefined) {
  if (destination === undefined) {
    return
  }

  const source = unwrapImageDestination(destination)
  if (isLocalRelativeImageSource(source)) {
    sources.add(source)
  }
}

// A Markdown destination may be wrapped in angle brackets when it contains
// spaces; the editor hands the resolver the unwrapped form either way.
function unwrapImageDestination(destination: string) {
  const trimmed = destination.trim()
  if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

function isAndroidContentUri(sourceUri: string) {
  return sourceUri.startsWith('content://')
}

function getDocumentImageContentUri(source: string) {
  return documentImageContentUris.get(source) ?? buildDocumentImageContentUri(source) ?? null
}

// Derives a sibling's content URI straight from the granted tree, so an image
// typed after the document opened resolves without another bridge round trip.
// `..` is clamped to the document's own folder: a crafted Markdown file must
// not reach above the folder the user granted.
function buildDocumentImageContentUri(source: string) {
  const access = documentImageAccess
  if (!access || !isLocalRelativeImageSource(source)) {
    return null
  }

  const segments: string[] = []
  for (const segment of source.replace(/\\/g, '/').split('/')) {
    if (!segment || segment === '.') {
      continue
    }
    if (segment === '..') {
      if (segments.length === 0) {
        return null
      }
      segments.pop()
      continue
    }
    segments.push(segment)
  }

  if (segments.length === 0) {
    return null
  }

  const documentId = `${access.documentDirectoryId}/${segments.join('/')}`
  return `${access.treeUri.replace(/\/+$/, '')}/document/${encodeURIComponent(documentId)}`
}

export async function pickAndroidImageDocument(
  options: AndroidImagePickOptions = { copyImage: true },
) {
  ensureAndroidImagesAvailable()
  const result = await AndroidDocuments.pickImageDocument({
    copyImage: options.copyImage,
  })
  if (result.canceled) {
    return result
  }

  return normalizeImportedImage(result)
}

export async function getImportedAndroidImageStorageStats() {
  if (!isAndroidImageImportAvailable()) {
    return null
  }
  return normalizeStorageStats(await AndroidDocuments.getImportedImageStorageStats())
}

export async function cleanupImportedAndroidImages(
  referencedFileNames: readonly string[],
  managedFileNames: readonly string[],
) {
  ensureAndroidImagesAvailable()
  const result = await AndroidDocuments.cleanupImportedImages({
    referencedFileNames: [...new Set(referencedFileNames)],
    managedFileNames: [...new Set(managedFileNames)],
  })
  return {
    ...normalizeStorageStats(result),
    removedFileCount: normalizeCount(result.removedFileCount),
    removedBytes: normalizeBytes(result.removedBytes),
    failedFileCount: normalizeCount(result.failedFileCount),
  } satisfies ImportedAndroidImageCleanupResult
}

export function collectMarkTextLocalImageFileNames(markdown: string) {
  const fileNames = new Set<string>()
  for (const match of markdown.matchAll(MARKTEXT_LOCAL_IMAGE_REFERENCE_REGEXP)) {
    try {
      const fileName = getMarkTextLocalImageFileName(`marktext-image://local/${match[1]}`)
      if (fileName) {
        fileNames.add(fileName)
      }
    } catch {
      // Malformed sources cannot name a file created by the import workflow.
    }
  }
  return [...fileNames]
}

export function formatImportedImageStorageBytes(bytes: number, locale: string) {
  const safeBytes = normalizeBytes(bytes)
  const units = ['B', 'KB', 'MB', 'GB'] as const
  let value = safeBytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  const formatted = new Intl.NumberFormat(locale, {
    maximumFractionDigits: unitIndex === 0 ? 0 : 1,
  }).format(value)
  return `${formatted} ${units[unitIndex]}`
}

function getAndroidImageErrorCode(error: unknown) {
  if (error instanceof AndroidImageError) {
    return error.code
  }

  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code
    return typeof code === 'string' ? code : 'UNKNOWN'
  }

  return 'UNKNOWN'
}

export function getAndroidImageUserMessage(error: unknown) {
  const code = getAndroidImageErrorCode(error)
  if (code === 'UNAVAILABLE') {
    return 'Insert images from the Android app build.'
  }

  if (code === 'IMAGE_PICKER_UNAVAILABLE') {
    return 'No Android image picker is available.'
  }

  if (code === 'UNSUPPORTED_IMAGE') {
    return 'Choose a JPEG, PNG, GIF, WebP, or SVG image.'
  }

  if (code === 'IMAGE_TOO_LARGE') {
    return 'This image is larger than the current 15 MB limit.'
  }

  if (code === 'IMAGE_NOT_FOUND') {
    return 'This image was moved or deleted.'
  }

  if (code === 'IMAGE_PERMISSION_LOST') {
    return 'Choose this image again from Android.'
  }

  if (code === 'IMAGE_IMPORT_FAILED') {
    return 'Could not import this image.'
  }

  return 'Could not insert this image.'
}

function ensureAndroidImagesAvailable() {
  if (!isAndroidImageImportAvailable()) {
    throw new AndroidImageError('UNAVAILABLE', 'Android image import is only available in Android builds')
  }
}

function normalizeImageDirectory(value: ImportedAndroidImageDirectory): ImportedAndroidImageDirectory {
  if (!value.fileUri) {
    throw new AndroidImageError('INVALID_IMAGE_RESULT', 'Android image plugin returned an invalid directory')
  }

  return {
    fileUri: value.fileUri,
    webBaseUri: typeof value.webBaseUri === 'string' ? value.webBaseUri : undefined,
  }
}

function normalizeImportedImage(value: ImportedAndroidImage): ImportedAndroidImage {
  if (!value.sourceUri || !value.displayName || !value.markdownSrc || !value.fileUri) {
    throw new AndroidImageError('INVALID_IMAGE_RESULT', 'Android image plugin returned an invalid image')
  }

  return {
    canceled: false,
    sourceUri: value.sourceUri,
    displayName: value.displayName,
    mimeType: value.mimeType ?? null,
    markdownSrc: value.markdownSrc,
    fileUri: value.fileUri,
    bytes: typeof value.bytes === 'number' ? value.bytes : 0,
  }
}

function normalizeStorageStats(value: ImportedAndroidImageStorageStats) {
  return {
    fileCount: normalizeCount(value.fileCount),
    bytes: normalizeBytes(value.bytes),
  }
}

function normalizeCount(value: number) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

function normalizeBytes(value: number) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

function getMarkTextLocalImageFileName(source: string) {
  const match = MARKTEXT_LOCAL_IMAGE_SOURCE_REGEXP.exec(source)
  if (!match) {
    return null
  }

  try {
    return normalizeImageFileName(decodeURIComponent(match[1]))
  } catch (error) {
    if (error instanceof AndroidImageError) {
      throw error
    }
    throw new AndroidImageError('INVALID_IMAGE_RESULT', 'Android image plugin returned an invalid file name')
  }
}

function getMarkTextAndroidImageUri(source: string) {
  const match = MARKTEXT_ANDROID_IMAGE_SOURCE_REGEXP.exec(source)
  if (!match) {
    return null
  }

  try {
    const uri = decodeURIComponent(match[1]).trim()
    if (!uri || !uri.toLowerCase().startsWith('content://')) {
      throw new AndroidImageError('INVALID_IMAGE_RESULT', 'Android image plugin returned an invalid URI')
    }
    return uri
  } catch (error) {
    if (error instanceof AndroidImageError) {
      throw error
    }
    throw new AndroidImageError('INVALID_IMAGE_RESULT', 'Android image plugin returned an invalid URI')
  }
}

function normalizeImageFileName(fileName: string) {
  const normalized = fileName.trim()
  if (!normalized || normalized.includes('/') || normalized.includes('\\')) {
    throw new AndroidImageError('INVALID_IMAGE_RESULT', 'Android image plugin returned an invalid file name')
  }
  return normalized
}
