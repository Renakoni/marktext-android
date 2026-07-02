import {
  getSuggestedMarkdownFileName,
  prepareMarkdownForSave,
  type MarkdownDocumentState,
} from './documentState'
import type { AndroidShareResult } from './androidDocuments'

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
  ) => Promise<AndroidShareResult>
  getAndroidDocumentUserMessage: (error: unknown) => string
  logger?: WorkflowLogger
}

export async function shareAndroidMarkdownDocumentWorkflow({
  currentDocument,
  shareAndroidMarkdownDocument,
  getAndroidDocumentUserMessage,
  logger,
}: ShareAndroidMarkdownDocumentWorkflowOptions): Promise<ShareAndroidMarkdownDocumentResult> {
  const markdownForShare = prepareMarkdownForSave(currentDocument.markdown, currentDocument)
  const suggestedName = getSuggestedMarkdownFileName(
    currentDocument.markdown,
    currentDocument.displayName,
  )

  try {
    const result = await shareAndroidMarkdownDocument(markdownForShare, suggestedName)
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
