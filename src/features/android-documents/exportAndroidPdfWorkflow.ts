import {
  getSuggestedPdfFileName,
  type MarkdownDocumentState,
} from '../../lib/documentState'
import type { AndroidPdfExportResult } from '../../lib/androidDocuments'

interface WorkflowLogger {
  info(message: string, data?: unknown): void
  error(message: string, data?: unknown): void
}

export type ExportAndroidPdfResult =
  | {
      kind: 'exported'
      status: 'Share sheet opened'
      exportResult: AndroidPdfExportResult
    }
  | {
      kind: 'failed'
      status: string
      error: unknown
    }

export interface ExportAndroidPdfWorkflowOptions {
  currentDocument: MarkdownDocumentState
  textDirection: 'ltr' | 'rtl'
  renderPdfExportHtml: (options: {
    markdown: string
    title: string
    textDirection: 'ltr' | 'rtl'
  }) => Promise<string>
  exportAndroidMarkdownPdf: (
    html: string,
    suggestedName: string,
  ) => Promise<AndroidPdfExportResult>
  getAndroidDocumentUserMessage: (error: unknown) => string
  logger?: WorkflowLogger
}

// Renders the current document to the self-contained export HTML, hands it to
// the native printer, and reports the outcome the same way the Markdown share
// workflow does. Rendering failures and native failures share one failure
// shape so the caller only needs the status text.
export async function exportAndroidPdfWorkflow({
  currentDocument,
  textDirection,
  renderPdfExportHtml,
  exportAndroidMarkdownPdf,
  getAndroidDocumentUserMessage,
  logger,
}: ExportAndroidPdfWorkflowOptions): Promise<ExportAndroidPdfResult> {
  const suggestedName = getSuggestedPdfFileName(
    currentDocument.markdown,
    currentDocument.displayName,
  )

  try {
    const html = await renderPdfExportHtml({
      markdown: currentDocument.markdown,
      title: suggestedName.replace(/\.pdf$/i, ''),
      textDirection,
    })
    const result = await exportAndroidMarkdownPdf(html, suggestedName)
    logger?.info('Android PDF share sheet opened', {
      displayName: result.displayName,
      bytes: result.bytes,
      autosaveTarget: currentDocument.autosaveTarget,
    })

    return {
      kind: 'exported',
      status: 'Share sheet opened',
      exportResult: result,
    }
  } catch (error) {
    logger?.error('Android PDF export failed', error)

    return {
      kind: 'failed',
      status: getAndroidDocumentUserMessage(error),
      error,
    }
  }
}
