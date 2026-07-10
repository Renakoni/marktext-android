import { describe, expect, it, vi } from 'vitest'
import { exportAndroidPdfWorkflow } from './exportAndroidPdfWorkflow'
import { createUntitledDocument } from '../../lib/documentState'

function createDocument(markdown: string) {
  return {
    ...createUntitledDocument({ markdown }),
    displayName: 'Trip notes.md',
  }
}

describe('exportAndroidPdfWorkflow', () => {
  it('renders the document and opens the PDF share sheet', async () => {
    const renderPdfExportHtml = vi.fn(async () => '<!DOCTYPE html><html></html>')
    const exportAndroidMarkdownPdf = vi.fn(async () => ({
      displayName: 'Trip notes.pdf',
      mimeType: 'application/pdf',
      bytes: 4321,
    }))
    const logger = { info: vi.fn(), error: vi.fn() }

    const result = await exportAndroidPdfWorkflow({
      currentDocument: createDocument('# Trip notes\n\nbody'),
      textDirection: 'ltr',
      renderPdfExportHtml,
      exportAndroidMarkdownPdf,
      getAndroidDocumentUserMessage: () => 'unused',
      logger,
    })

    expect(result.kind).toBe('exported')
    expect(result.status).toBe('Share sheet opened')
    expect(renderPdfExportHtml).toHaveBeenCalledWith({
      markdown: '# Trip notes\n\nbody',
      title: 'Trip notes',
      textDirection: 'ltr',
    })
    expect(exportAndroidMarkdownPdf).toHaveBeenCalledWith(
      '<!DOCTYPE html><html></html>',
      'Trip notes.pdf',
    )
    expect(logger.info).toHaveBeenCalled()
  })

  it('passes the RTL text direction through to the renderer', async () => {
    const renderPdfExportHtml = vi.fn(async () => '<html></html>')

    await exportAndroidPdfWorkflow({
      currentDocument: createDocument('نص'),
      textDirection: 'rtl',
      renderPdfExportHtml,
      exportAndroidMarkdownPdf: vi.fn(async () => ({
        displayName: 'x.pdf',
        mimeType: 'application/pdf',
        bytes: 1,
      })),
      getAndroidDocumentUserMessage: () => 'unused',
    })

    expect(renderPdfExportHtml).toHaveBeenCalledWith(
      expect.objectContaining({ textDirection: 'rtl' }),
    )
  })

  it('reports rendering failures through the user message mapper', async () => {
    const error = new Error('muya render failed')
    const exportAndroidMarkdownPdf = vi.fn()

    const result = await exportAndroidPdfWorkflow({
      currentDocument: createDocument('body'),
      textDirection: 'ltr',
      renderPdfExportHtml: vi.fn(async () => {
        throw error
      }),
      exportAndroidMarkdownPdf,
      getAndroidDocumentUserMessage: () => 'Could not export this document as a PDF.',
    })

    expect(result.kind).toBe('failed')
    expect(result.status).toBe('Could not export this document as a PDF.')
    expect(exportAndroidMarkdownPdf).not.toHaveBeenCalled()
  })

  it('reports native export failures with their mapped message', async () => {
    const nativeError = Object.assign(new Error('print failed'), { code: 'PDF_EXPORT_FAILED' })
    const getAndroidDocumentUserMessage = vi.fn(() => 'Could not export this document as a PDF.')

    const result = await exportAndroidPdfWorkflow({
      currentDocument: createDocument('body'),
      textDirection: 'ltr',
      renderPdfExportHtml: vi.fn(async () => '<html></html>'),
      exportAndroidMarkdownPdf: vi.fn(async () => {
        throw nativeError
      }),
      getAndroidDocumentUserMessage,
    })

    expect(result.kind).toBe('failed')
    expect(result.status).toBe('Could not export this document as a PDF.')
    expect(getAndroidDocumentUserMessage).toHaveBeenCalledWith(nativeError)
  })
})
