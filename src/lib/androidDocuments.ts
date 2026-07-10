import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import {
  normalizeMarkdownEncoding,
  type AndroidMarkdownSettings,
  type MarkdownEncoding,
} from '../features/settings/advancedSettings'

export interface OpenedAndroidDocument {
  canceled?: false
  sourceUri: string
  displayName: string
  providerName: string | null
  pathHint: string | null
  mimeType: string | null
  markdown: string
  encoding?: MarkdownEncoding
  hasEncodingBom?: boolean
  canWrite: boolean
  persisted: boolean
}

export interface SharedAndroidDocument {
  canceled?: false
  sourceUri: string | null
  displayName: string
  providerName: string | null
  pathHint: string | null
  mimeType: string | null
  markdown: string
  encoding?: MarkdownEncoding
  hasEncodingBom?: boolean
  canWrite: boolean
  persisted: boolean
  shareKind: 'text' | 'stream'
}

interface SavedAndroidDocument {
  sourceUri: string
  displayName: string
  providerName: string | null
  pathHint: string | null
  mimeType: string | null
  encoding?: MarkdownEncoding
  hasEncodingBom?: boolean
  canWrite: boolean
  persisted: boolean
}

export type AndroidOpenWithDocumentEvent =
  | {
      document: OpenedAndroidDocument
      error: null
    }
  | {
      document: null
      error: AndroidDocumentError
    }

export type AndroidShareDocumentEvent =
  | {
      document: SharedAndroidDocument
      error: null
    }
  | {
      document: null
      error: AndroidDocumentError
    }

export interface AndroidShareResult {
  displayName: string
  mimeType: string
  bytes: number
  imageCount: number
  sharedFileCount: number
}

export interface AndroidShareOptions {
  attachImages: boolean
  encoding: MarkdownEncoding
}

export interface AndroidPdfExportResult {
  displayName: string
  mimeType: string
  bytes: number
}

export interface AndroidShareDocumentPayload {
  markdown: string
  suggestedName: string
}

export interface RenamedAndroidDocument {
  sourceUri: string
  displayName: string
  providerName: string | null
  pathHint: string | null
  canWrite: boolean
  persisted: boolean
}

export interface AndroidWriteOptions {
  encoding: MarkdownEncoding
  writeBom?: boolean
}

export type AndroidCreateOptions = AndroidWriteOptions
export type AndroidReadOptions = Partial<AndroidMarkdownSettings>

interface CanceledAndroidDocumentOpen {
  canceled: true
}

interface AndroidOpenWithDocumentPluginEvent {
  document?: OpenedAndroidDocument
  errorCode?: string
  message?: string
}

interface AndroidShareDocumentPluginEvent {
  document?: SharedAndroidDocument
  errorCode?: string
  message?: string
}

interface AndroidDocumentsPlugin {
  addListener(
    eventName: 'openWithDocument',
    listenerFunc: (event: AndroidOpenWithDocumentPluginEvent) => void,
  ): Promise<PluginListenerHandle>
  addListener(
    eventName: 'shareDocument',
    listenerFunc: (event: AndroidShareDocumentPluginEvent) => void,
  ): Promise<PluginListenerHandle>
  createMarkdownDocument(options: {
    markdown: string
    suggestedName: string
    encoding?: string
    writeBom?: boolean
  }): Promise<OpenedAndroidDocument | CanceledAndroidDocumentOpen>
  openMarkdownDocument(options?: AndroidReadOptions): Promise<OpenedAndroidDocument | CanceledAndroidDocumentOpen>
  readMarkdownDocument(options: { sourceUri: string } & AndroidReadOptions): Promise<OpenedAndroidDocument>
  shareMarkdownDocument(options: {
    markdown: string
    suggestedName: string
    attachImages?: boolean
    encoding?: string
  }): Promise<AndroidShareResult>
  shareMarkdownDocuments(options: {
    documents: AndroidShareDocumentPayload[]
    encoding?: string
  }): Promise<AndroidShareResult>
  exportMarkdownPdf(options: {
    html: string
    suggestedName: string
  }): Promise<AndroidPdfExportResult>
  renameMarkdownDocument(options: {
    sourceUri: string
    newName: string
  }): Promise<RenamedAndroidDocument>
  writeMarkdownDocument(options: {
    sourceUri: string
    markdown: string
    encoding?: string
    writeBom?: boolean
  }): Promise<SavedAndroidDocument>
  configureMarkdownSettings(options: AndroidMarkdownSettings): Promise<void>
  getImportedImageDirectory(): Promise<{ fileUri: string; webBaseUri?: string }>
  pickImageDocument(options?: { copyImage?: boolean }): Promise<{
    canceled?: false
    sourceUri: string
    displayName: string
    mimeType: string | null
    markdownSrc: string
    fileUri: string
    bytes: number
  } | { canceled: true }>
}

export class AndroidDocumentError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'AndroidDocumentError'
    this.code = code
  }
}

export const AndroidDocuments = registerPlugin<AndroidDocumentsPlugin>('AndroidDocuments')

export function isAndroidDocumentAccessAvailable() {
  return Capacitor.getPlatform() === 'android' && Capacitor.isNativePlatform()
}

export async function configureAndroidMarkdownSettings(settings: AndroidMarkdownSettings) {
  ensureAndroidDocumentsAvailable()
  await AndroidDocuments.configureMarkdownSettings(settings)
}

export async function openAndroidMarkdownDocument(options: AndroidReadOptions = {}) {
  ensureAndroidDocumentsAvailable()
  const result = await AndroidDocuments.openMarkdownDocument(options)
  if (result.canceled) {
    return result
  }

  return normalizeOpenedDocument(result)
}

export async function createAndroidMarkdownDocument(
  markdown: string,
  suggestedName: string,
  options: AndroidCreateOptions,
) {
  ensureAndroidDocumentsAvailable()
  const result = await AndroidDocuments.createMarkdownDocument({
    markdown,
    suggestedName,
    encoding: options.encoding,
    writeBom: options.writeBom,
  })
  if (result.canceled) {
    return result
  }

  return normalizeOpenedDocument(result)
}

export async function readAndroidMarkdownDocument(
  sourceUri: string,
  options: AndroidReadOptions = {},
) {
  ensureAndroidDocumentsAvailable()
  return normalizeOpenedDocument(await AndroidDocuments.readMarkdownDocument({ sourceUri, ...options }))
}

export async function writeAndroidMarkdownDocument(
  sourceUri: string,
  markdown: string,
  options: AndroidWriteOptions,
) {
  ensureAndroidDocumentsAvailable()
  return normalizeSavedDocument(
    await AndroidDocuments.writeMarkdownDocument({
      sourceUri,
      markdown,
      encoding: options.encoding,
      writeBom: options.writeBom,
    }),
  )
}

export async function shareAndroidMarkdownDocument(
  markdown: string,
  suggestedName: string,
  options: AndroidShareOptions,
) {
  ensureAndroidDocumentsAvailable()
  return normalizeShareResult(
    await AndroidDocuments.shareMarkdownDocument({
      markdown,
      suggestedName,
      attachImages: options.attachImages,
      encoding: options.encoding,
    }),
  )
}

export async function shareAndroidMarkdownDocuments(
  documents: AndroidShareDocumentPayload[],
  options: Pick<AndroidShareOptions, 'encoding'>,
) {
  ensureAndroidDocumentsAvailable()
  return normalizeShareResult(
    await AndroidDocuments.shareMarkdownDocuments({
      documents,
      encoding: options.encoding,
    }),
  )
}

export async function exportAndroidMarkdownPdf(html: string, suggestedName: string) {
  ensureAndroidDocumentsAvailable()
  return normalizePdfExportResult(
    await AndroidDocuments.exportMarkdownPdf({ html, suggestedName }),
  )
}

export async function renameAndroidMarkdownDocument(sourceUri: string, newName: string) {
  ensureAndroidDocumentsAvailable()
  return normalizeRenamedDocument(
    await AndroidDocuments.renameMarkdownDocument({ sourceUri, newName }),
  )
}

export async function addAndroidOpenWithDocumentListener(
  listener: (event: AndroidOpenWithDocumentEvent) => void,
) {
  ensureAndroidDocumentsAvailable()
  return AndroidDocuments.addListener('openWithDocument', event => {
    listener(normalizeOpenWithDocumentEvent(event))
  })
}

export async function addAndroidShareDocumentListener(
  listener: (event: AndroidShareDocumentEvent) => void,
) {
  ensureAndroidDocumentsAvailable()
  return AndroidDocuments.addListener('shareDocument', event => {
    listener(normalizeShareDocumentEvent(event))
  })
}

export function getAndroidDocumentErrorCode(error: unknown) {
  if (error instanceof AndroidDocumentError) {
    return error.code
  }

  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code
    return typeof code === 'string' ? code : 'UNKNOWN'
  }

  return 'UNKNOWN'
}

export function getAndroidDocumentUserMessage(error: unknown) {
  const code = getAndroidDocumentErrorCode(error)
  if (code === 'UNAVAILABLE') {
    return 'Open Markdown files from the Android app build.'
  }

  if (code === 'UNSUPPORTED_DOCUMENT') {
    return 'Choose a Markdown or plain text file.'
  }

  if (code === 'UNSUPPORTED_OPEN_WITH_DOCUMENT') {
    return 'Open a Markdown file.'
  }

  if (code === 'INVALID_OPEN_WITH_INTENT') {
    return 'This Android open-with request is not supported.'
  }

  if (code === 'UNSUPPORTED_SHARE_DOCUMENT') {
    return 'Share Markdown text or a Markdown file.'
  }

  if (code === 'INVALID_SHARE_INTENT') {
    return 'This Android share request is not supported.'
  }

  if (code === 'INVALID_SHARE_SOURCE_URI') {
    return 'This Android share did not provide a supported file URI.'
  }

  if (code === 'SHARE_CONTENT_MISSING') {
    return 'This Android share did not include Markdown content.'
  }

  if (code === 'SHARE_TARGET_UNAVAILABLE') {
    return 'No Android share target is available.'
  }

  if (code === 'SHARE_WRITE_FAILED') {
    return 'Could not prepare this Markdown file for sharing.'
  }

  if (code === 'PDF_EXPORT_FAILED') {
    return 'Could not export this document as a PDF.'
  }

  if (code === 'PDF_WRITE_FAILED') {
    return 'Could not prepare the PDF file for sharing.'
  }

  if (code === 'DOCUMENT_TOO_LARGE') {
    return 'This Markdown file is larger than the current 5 MB limit.'
  }

  if (code === 'INVALID_SOURCE_URI') {
    return 'This recent file can no longer be opened.'
  }

  if (code === 'DOCUMENT_NOT_FOUND') {
    return 'This file was moved or deleted. Open it again from Android.'
  }

  if (code === 'DOCUMENT_PERMISSION_LOST') {
    return 'Reopen this file from Android before saving again.'
  }

  if (code === 'DOCUMENT_READ_FAILED') {
    return 'Could not read this Markdown file.'
  }

  if (code === 'DOCUMENT_WRITE_PERMISSION_MISSING') {
    return 'This file is read-only.'
  }

  if (code === 'DOCUMENT_WRITE_FAILED') {
    return 'Could not save this Markdown file.'
  }

  if (code === 'DOCUMENT_ENCODING_UNSUPPORTED') {
    return 'This text encoding is not available on this device.'
  }

  if (code === 'DOCUMENT_ENCODING_FAILED') {
    return 'Could not read or save this file with the selected encoding.'
  }

  if (code === 'DOCUMENT_CREATOR_UNAVAILABLE') {
    return 'Could not create a Markdown file on this device.'
  }

  if (code === 'INVALID_DOCUMENT_NAME') {
    return 'Enter a name for this file.'
  }

  if (code === 'DOCUMENT_RENAME_UNSUPPORTED') {
    return 'This file’s storage location does not support renaming.'
  }

  if (code === 'DOCUMENT_RENAME_FAILED') {
    return 'Could not rename this Markdown file.'
  }

  return 'Could not open this Markdown file.'
}

function ensureAndroidDocumentsAvailable() {
  if (!isAndroidDocumentAccessAvailable()) {
    throw new AndroidDocumentError('UNAVAILABLE', 'Android document access is only available in Android builds')
  }
}

function normalizeOpenedDocument(value: OpenedAndroidDocument): OpenedAndroidDocument {
  if (!value.sourceUri || !value.displayName || typeof value.markdown !== 'string') {
    throw new AndroidDocumentError('INVALID_DOCUMENT_RESULT', 'Android document plugin returned an invalid result')
  }

  return {
    canceled: false,
    sourceUri: value.sourceUri,
    displayName: value.displayName,
    providerName: value.providerName ?? null,
    pathHint: value.pathHint ?? null,
    mimeType: value.mimeType ?? null,
    markdown: value.markdown,
    encoding: normalizeMarkdownEncodingValue(value.encoding),
    hasEncodingBom: Boolean(value.hasEncodingBom),
    canWrite: Boolean(value.canWrite),
    persisted: Boolean(value.persisted),
  }
}

function normalizeSharedDocument(value: SharedAndroidDocument): SharedAndroidDocument {
  if (!value.displayName || typeof value.markdown !== 'string') {
    throw new AndroidDocumentError('INVALID_DOCUMENT_RESULT', 'Android document plugin returned an invalid result')
  }

  const sourceUri = typeof value.sourceUri === 'string' && value.sourceUri ? value.sourceUri : null
  const shareKind = value.shareKind === 'stream' ? 'stream' : 'text'
  if (shareKind === 'stream' && !sourceUri) {
    throw new AndroidDocumentError('INVALID_DOCUMENT_RESULT', 'Android document plugin returned an invalid result')
  }

  return {
    canceled: false,
    sourceUri,
    displayName: value.displayName,
    providerName: value.providerName ?? null,
    pathHint: value.pathHint ?? null,
    mimeType: value.mimeType ?? null,
    markdown: value.markdown,
    encoding: normalizeMarkdownEncodingValue(value.encoding),
    hasEncodingBom: Boolean(value.hasEncodingBom),
    canWrite: Boolean(value.canWrite),
    persisted: Boolean(value.persisted),
    shareKind,
  }
}

function normalizeSavedDocument(value: SavedAndroidDocument): SavedAndroidDocument {
  if (!value.sourceUri || !value.displayName) {
    throw new AndroidDocumentError('INVALID_DOCUMENT_RESULT', 'Android document plugin returned an invalid result')
  }

  return {
    sourceUri: value.sourceUri,
    displayName: value.displayName,
    providerName: value.providerName ?? null,
    pathHint: value.pathHint ?? null,
    mimeType: value.mimeType ?? null,
    encoding: normalizeMarkdownEncodingValue(value.encoding),
    hasEncodingBom: Boolean(value.hasEncodingBom),
    canWrite: Boolean(value.canWrite),
    persisted: Boolean(value.persisted),
  }
}

function normalizeRenamedDocument(value: RenamedAndroidDocument): RenamedAndroidDocument {
  if (!value.sourceUri || !value.displayName) {
    throw new AndroidDocumentError('INVALID_DOCUMENT_RESULT', 'Android document plugin returned an invalid result')
  }

  return {
    sourceUri: value.sourceUri,
    displayName: value.displayName,
    providerName: value.providerName ?? null,
    pathHint: value.pathHint ?? null,
    canWrite: Boolean(value.canWrite),
    persisted: Boolean(value.persisted),
  }
}

function normalizeMarkdownEncodingValue(value: unknown): MarkdownEncoding {
  return normalizeMarkdownEncoding(value)
}

function normalizeShareResult(value: AndroidShareResult): AndroidShareResult {
  if (!value.displayName || !value.mimeType || typeof value.bytes !== 'number') {
    throw new AndroidDocumentError('INVALID_DOCUMENT_RESULT', 'Android document plugin returned an invalid result')
  }

  return {
    displayName: value.displayName,
    mimeType: value.mimeType,
    bytes: value.bytes,
    imageCount: typeof value.imageCount === 'number' ? value.imageCount : 0,
    sharedFileCount: typeof value.sharedFileCount === 'number' ? value.sharedFileCount : 1,
  }
}

function normalizePdfExportResult(value: AndroidPdfExportResult): AndroidPdfExportResult {
  if (!value.displayName || !value.mimeType || typeof value.bytes !== 'number') {
    throw new AndroidDocumentError('INVALID_DOCUMENT_RESULT', 'Android document plugin returned an invalid result')
  }

  return {
    displayName: value.displayName,
    mimeType: value.mimeType,
    bytes: value.bytes,
  }
}

function normalizeOpenWithDocumentEvent(
  value: AndroidOpenWithDocumentPluginEvent,
): AndroidOpenWithDocumentEvent {
  if (value.document) {
    return {
      document: normalizeOpenedDocument(value.document),
      error: null,
    }
  }

  const code = typeof value.errorCode === 'string' ? value.errorCode : 'DOCUMENT_READ_FAILED'
  const message = typeof value.message === 'string' ? value.message : 'Could not open this Markdown file'

  return {
    document: null,
    error: new AndroidDocumentError(code, message),
  }
}

function normalizeShareDocumentEvent(value: AndroidShareDocumentPluginEvent): AndroidShareDocumentEvent {
  if (value.document) {
    return {
      document: normalizeSharedDocument(value.document),
      error: null,
    }
  }

  const code = typeof value.errorCode === 'string' ? value.errorCode : 'DOCUMENT_READ_FAILED'
  const message = typeof value.message === 'string' ? value.message : 'Could not import this Android share'

  return {
    document: null,
    error: new AndroidDocumentError(code, message),
  }
}
