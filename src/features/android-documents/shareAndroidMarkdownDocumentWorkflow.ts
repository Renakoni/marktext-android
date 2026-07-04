import {
  getSuggestedMarkdownFileName,
  prepareMarkdownForSave,
  type MarkdownDocumentState,
} from '../../lib/documentState'
import type { AndroidShareResult } from '../../lib/androidDocuments'
import {
  shouldAttachImagesWhenSharing,
  type ImageSharingSettings,
} from './imageSharingSettings'

interface WorkflowLogger {
  info(message: string, data?: unknown): void
  error(message: string, data?: unknown): void
}

export type ShareAndroidMarkdownDocumentResult =
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

interface ShareAndroidMarkdownDocumentWorkflowOptions {
  currentDocument: MarkdownDocumentState
  shareAndroidMarkdownDocument: (
    markdown: string,
    suggestedName: string,
    options: { attachImages: boolean },
  ) => Promise<AndroidShareResult>
  getAndroidDocumentUserMessage: (error: unknown) => string
  imageSharingSettings: Pick<ImageSharingSettings, 'shareImages'>
  logger?: WorkflowLogger
}

export async function shareAndroidMarkdownDocumentWorkflow({
  currentDocument,
  shareAndroidMarkdownDocument,
  getAndroidDocumentUserMessage,
  imageSharingSettings,
  logger,
}: ShareAndroidMarkdownDocumentWorkflowOptions): Promise<ShareAndroidMarkdownDocumentResult> {
  const markdownForShare = prepareMarkdownForSave(currentDocument.markdown, currentDocument)
  const suggestedName = getSuggestedMarkdownFileName(
    currentDocument.markdown,
    currentDocument.displayName,
  )

  try {
    const result = await shareAndroidMarkdownDocument(markdownForShare, suggestedName, {
      attachImages: shouldAttachImagesWhenSharing(imageSharingSettings),
    })
    logger?.info('Android share sheet opened', {
      displayName: result.displayName,
      bytes: result.bytes,
      imageCount: result.imageCount,
      sharedFileCount: result.sharedFileCount,
      autosaveTarget: currentDocument.autosaveTarget,
    })

    return {
      kind: 'shared',
      status: 'Share sheet opened',
      shareResult: result,
    }
  } catch (error) {
    logger?.error('Android share failed', error)

    return {
      kind: 'failed',
      status: getAndroidDocumentUserMessage(error),
      error,
    }
  }
}
