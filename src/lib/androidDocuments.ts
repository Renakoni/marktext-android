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

interface CanceledAndroidDocumentOpen {
  canceled: true
}

interface AndroidDocumentsPlugin {
  openMarkdownDocument(): Promise<OpenedAndroidDocument | CanceledAndroidDocumentOpen>
  readMarkdownDocument(options: { sourceUri: string }): Promise<OpenedAndroidDocument>
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

export async function readAndroidMarkdownDocument(sourceUri: string) {
  ensureAndroidDocumentsAvailable()
  return normalizeOpenedDocument(await AndroidDocuments.readMarkdownDocument({ sourceUri }))
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
