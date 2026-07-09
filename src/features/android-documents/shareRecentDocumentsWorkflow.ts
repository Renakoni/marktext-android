import { getSuggestedMarkdownFileName } from '../../lib/documentState'
import type {
  AndroidShareDocumentPayload,
  AndroidShareResult,
} from '../../lib/androidDocuments'
import type { RecentDocumentRecord } from '../../lib/recentDocuments'
import {
  shouldAttachImagesWhenSharing,
  type ImageSharingSettings,
} from './imageSharingSettings'
import {
  DEFAULT_MARKDOWN_SAVE_SETTINGS,
  type MarkdownEncoding,
  type MarkdownSaveSettings,
} from '../settings/advancedSettings'

interface WorkflowLogger {
  info(message: string, data?: unknown): void
  error(message: string, data?: unknown): void
}

export type ShareRecentDocumentsResult =
  | {
      kind: 'shared'
      status: 'Share sheet opened'
      shareResult: AndroidShareResult
    }
  | {
      kind: 'failed'
      status: string
      error: unknown
    }

interface ShareRecentDocumentsWorkflowOptions {
  documents: RecentDocumentRecord[]
  readAndroidMarkdownDocument: (sourceUri: string) => Promise<{ markdown: string }>
  shareAndroidMarkdownDocument: (
    markdown: string,
    suggestedName: string,
    options: { attachImages: boolean; encoding: MarkdownEncoding },
  ) => Promise<AndroidShareResult>
  shareAndroidMarkdownDocuments: (
    documents: AndroidShareDocumentPayload[],
    options: { encoding: MarkdownEncoding },
  ) => Promise<AndroidShareResult>
  getAndroidDocumentUserMessage: (error: unknown) => string
  imageSharingSettings: Pick<ImageSharingSettings, 'shareImages'>
  markdownSaveSettings?: MarkdownSaveSettings
  logger?: WorkflowLogger
}

function getShareFileName(record: RecentDocumentRecord) {
  if (record.kind === 'android-document') {
    return record.displayName
  }

  // A draft's list title already resolves rename-versus-content precedence,
  // so name the shared file after it instead of re-deriving from markdown.
  return getSuggestedMarkdownFileName('', record.title)
}

export async function shareRecentDocumentsWorkflow({
  documents,
  readAndroidMarkdownDocument,
  shareAndroidMarkdownDocument,
  shareAndroidMarkdownDocuments,
  getAndroidDocumentUserMessage,
  imageSharingSettings,
  markdownSaveSettings = DEFAULT_MARKDOWN_SAVE_SETTINGS,
  logger,
}: ShareRecentDocumentsWorkflowOptions): Promise<ShareRecentDocumentsResult> {
  try {
    if (documents.length === 0) {
      throw new Error('No documents were selected for sharing')
    }

    // All-or-nothing: a share that silently drops an unreadable file would
    // look complete while losing content.
    const payloads: AndroidShareDocumentPayload[] = []
    for (const record of documents) {
      const markdown =
        record.kind === 'local-draft'
          ? (record.markdownPreview ?? '')
          : (await readAndroidMarkdownDocument(record.sourceUri ?? '')).markdown

      payloads.push({ markdown, suggestedName: getShareFileName(record) })
    }

    // The single-document path keeps image attachments; a multi-file share
    // sends the Markdown files themselves.
    const shareResult =
      payloads.length === 1
        ? await shareAndroidMarkdownDocument(payloads[0].markdown, payloads[0].suggestedName, {
            attachImages: shouldAttachImagesWhenSharing(imageSharingSettings),
            encoding: markdownSaveSettings.encoding,
          })
        : await shareAndroidMarkdownDocuments(payloads, {
            encoding: markdownSaveSettings.encoding,
          })

    logger?.info('Android share sheet opened for recent documents', {
      documentCount: documents.length,
      sharedFileCount: shareResult.sharedFileCount,
      bytes: shareResult.bytes,
    })

    return { kind: 'shared', status: 'Share sheet opened', shareResult }
  } catch (error) {
    logger?.error('Android recent documents share failed', error)

    return { kind: 'failed', status: getAndroidDocumentUserMessage(error), error }
  }
}
