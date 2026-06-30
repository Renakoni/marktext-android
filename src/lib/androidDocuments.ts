import { Capacitor, registerPlugin } from '@capacitor/core'

export interface OpenedAndroidDocument {
  canceled?: false
  sourceUri: string
  displayName: string
  providerName: string | null
  pathHint: string | null
  mimeType: string | null
  markdown: string
  canWrite: boolean
  persisted: boolean
}

export interface SavedAndroidDocument {
  sourceUri: string
  displayName: string
  providerName: string | null
  pathHint: string | null
  mimeType: string | null
  canWrite: boolean
  persisted: boolean
}

interface CanceledAndroidDocumentOpen {
  canceled: true
}

interface AndroidDocumentsPlugin {
  createMarkdownDocument(options: {
    markdown: string
    suggestedName: string
  }): Promise<OpenedAndroidDocument | CanceledAndroidDocumentOpen>
  openMarkdownDocument(): Promise<OpenedAndroidDocument | CanceledAndroidDocumentOpen>
  readMarkdownDocument(options: { sourceUri: string }): Promise<OpenedAndroidDocument>
  writeMarkdownDocument(options: { sourceUri: string; markdown: string }): Promise<SavedAndroidDocument>
}

export class AndroidDocumentError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'AndroidDocumentError'
    this.code = code
  }
}

const AndroidDocuments = registerPlugin<AndroidDocumentsPlugin>('AndroidDocuments')

export function isAndroidDocumentAccessAvailable() {
  return Capacitor.getPlatform() === 'android' && Capacitor.isNativePlatform()
}

export async function openAndroidMarkdownDocument() {
  ensureAndroidDocumentsAvailable()
  const result = await AndroidDocuments.openMarkdownDocument()
  if (result.canceled) {
    return result
  }

  return normalizeOpenedDocument(result)
}

export async function createAndroidMarkdownDocument(markdown: string, suggestedName: string) {
  ensureAndroidDocumentsAvailable()
  const result = await AndroidDocuments.createMarkdownDocument({
    markdown,
    suggestedName,
  })
  if (result.canceled) {
    return result
  }

  return normalizeOpenedDocument(result)
}

export async function readAndroidMarkdownDocument(sourceUri: string) {
  ensureAndroidDocumentsAvailable()
  return normalizeOpenedDocument(await AndroidDocuments.readMarkdownDocument({ sourceUri }))
}

export async function writeAndroidMarkdownDocument(sourceUri: string, markdown: string) {
  ensureAndroidDocumentsAvailable()
  return normalizeSavedDocument(
    await AndroidDocuments.writeMarkdownDocument({
      sourceUri,
      markdown,
    }),
  )
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

  if (code === 'DOCUMENT_CREATOR_UNAVAILABLE') {
    return 'Could not create a Markdown file on this device.'
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
    canWrite: Boolean(value.canWrite),
    persisted: Boolean(value.persisted),
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
    canWrite: Boolean(value.canWrite),
    persisted: Boolean(value.persisted),
  }
}
