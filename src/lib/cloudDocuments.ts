import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { AndroidDocumentError, isAndroidDocumentAccessAvailable } from './androidDocuments'
import type { AndroidMarkdownSettings } from '../features/settings/advancedSettings'
import type { MarkdownEncoding } from '../features/settings/advancedSettings'

export type CloudProviderId = 'onedrive' | 'googledrive' | 'webdav'

export interface CloudAccountState {
  connected: boolean
  /** False while the OAuth client id is not configured in this build. */
  available: boolean
  accountName: string | null
}

export interface CloudFolderEntry {
  id: string
  name: string
  isFolder: boolean
  size: number
  lastModified: string
}

export interface CloudDocumentContent {
  fileId: string
  displayName: string
  markdown: string
  encoding: MarkdownEncoding
  hasEncodingBom: boolean
  eTag: string
  providerName: string
  canWrite: boolean
}

export interface CloudDocumentWriteResult {
  fileId: string
  displayName: string
  eTag: string
  lastModified: string
}

export interface CloudAuthEvent {
  provider: CloudProviderId
  connected: boolean
  accountName: string | null
  /**
   * Files chosen in Google's in-flow picker (the authorization page hosts
   * the picker itself; the selection rides the OAuth redirect).
   */
  pickedFileIds?: string[]
  errorCode?: string
  message?: string
}

interface CloudDocumentsPlugin {
  addListener(
    eventName: 'cloudAuthCompleted',
    listenerFunc: (event: CloudAuthEvent) => void,
  ): Promise<PluginListenerHandle>
  getCloudAccountState(options: { provider: CloudProviderId }): Promise<CloudAccountState>
  connectCloudAccount(options: { provider: CloudProviderId }): Promise<{ started: boolean }>
  disconnectCloudAccount(options: { provider: CloudProviderId }): Promise<void>
  listCloudFolder(options: {
    provider: CloudProviderId
    folderId?: string
  }): Promise<{ entries: CloudFolderEntry[] }>
  readCloudDocument(options: {
    provider: CloudProviderId
    fileId: string
    defaultEncoding?: string
    autoDetectEncoding?: boolean
  }): Promise<CloudDocumentContent>
  writeCloudDocument(options: {
    provider: CloudProviderId
    fileId: string
    markdown: string
    encoding?: string
    writeBom?: boolean
    eTag?: string
  }): Promise<CloudDocumentWriteResult>
}

const CloudDocuments = registerPlugin<CloudDocumentsPlugin>('CloudDocuments')

export function isCloudDocumentAccessAvailable() {
  return isAndroidDocumentAccessAvailable()
}

/** Wraps plugin rejections so existing error-code branching applies. */
async function wrapCloudErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      const { code, message } = error as { code?: unknown; message?: unknown }
      throw new AndroidDocumentError(
        typeof code === 'string' ? code : 'UNKNOWN',
        typeof message === 'string' ? message : 'Cloud request failed',
      )
    }
    throw error
  }
}

export async function getCloudAccountState(provider: CloudProviderId) {
  return wrapCloudErrors(() => CloudDocuments.getCloudAccountState({ provider }))
}

export async function connectCloudAccount(provider: CloudProviderId) {
  return wrapCloudErrors(() => CloudDocuments.connectCloudAccount({ provider }))
}

export async function disconnectCloudAccount(provider: CloudProviderId) {
  return wrapCloudErrors(() => CloudDocuments.disconnectCloudAccount({ provider }))
}

export async function listCloudFolder(provider: CloudProviderId, folderId?: string) {
  const result = await wrapCloudErrors(() =>
    CloudDocuments.listCloudFolder({ provider, folderId }),
  )
  return result.entries
}

export async function readCloudDocument(
  provider: CloudProviderId,
  fileId: string,
  settings?: Partial<AndroidMarkdownSettings>,
) {
  return wrapCloudErrors(() =>
    CloudDocuments.readCloudDocument({
      provider,
      fileId,
      defaultEncoding: settings?.defaultEncoding,
      autoDetectEncoding: settings?.autoDetectEncoding,
    }),
  )
}

export async function writeCloudDocument(
  provider: CloudProviderId,
  fileId: string,
  markdown: string,
  options: { encoding?: string; writeBom?: boolean; eTag?: string } = {},
) {
  return wrapCloudErrors(() =>
    CloudDocuments.writeCloudDocument({
      provider,
      fileId,
      markdown,
      encoding: options.encoding,
      writeBom: options.writeBom,
      eTag: options.eTag,
    }),
  )
}

export async function addCloudAuthListener(listener: (event: CloudAuthEvent) => void) {
  return CloudDocuments.addListener('cloudAuthCompleted', listener)
}
