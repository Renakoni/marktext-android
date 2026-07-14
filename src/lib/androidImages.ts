import { Capacitor } from '@capacitor/core'
import { AndroidDocuments } from './androidDocuments'

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

let imageDirectory: ImportedAndroidImageDirectory | null = null

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
    win.MarkTextAndroidImageResolver = source => resolveMarkTextImageSource(source, imageDirectory)
    return
  }

  if (!imageDirectory) {
    imageDirectory = normalizeImageDirectory(await AndroidDocuments.getImportedImageDirectory())
  }

  win.MarkTextAndroidImageResolver = source => resolveMarkTextImageSource(source, imageDirectory)
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

export async function cleanupImportedAndroidImages(referencedFileNames: readonly string[]) {
  ensureAndroidImagesAvailable()
  const result = await AndroidDocuments.cleanupImportedImages({
    referencedFileNames: [...new Set(referencedFileNames)],
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
