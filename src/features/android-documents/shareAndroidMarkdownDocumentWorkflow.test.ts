import { describe, expect, it, vi } from 'vitest'
import { createUntitledDocument, updateDocumentMarkdown } from '../../lib/documentState'
import { shareAndroidMarkdownDocumentWorkflow } from './shareAndroidMarkdownDocumentWorkflow'
import type { AndroidShareResult } from '../../lib/androidDocuments'

function createCurrentDocument(markdown = '# Share Out Note\n\nbody') {
  return updateDocumentMarkdown(
    createUntitledDocument({
      markdown,
      displayName: 'Draft.md',
      autosaveTarget: 'local-draft',
      now: '2026-07-02T00:00:00.000Z',
    }),
    markdown,
    { markDirty: false, now: '2026-07-02T00:01:00.000Z' },
  )
}

const shareResult: AndroidShareResult = {
  displayName: 'Share Out Note.md',
  mimeType: 'text/markdown',
  bytes: 24,
  imageCount: 0,
  sharedFileCount: 1,
}

const defaultImageSharingSettings = {
  shareImages: 'attach' as const,
}

describe('shareAndroidMarkdownDocumentWorkflow', () => {
  it('shares prepared Markdown with the suggested file name', async () => {
    const shareAndroidMarkdownDocument = vi.fn().mockResolvedValue(shareResult)

    const result = await shareAndroidMarkdownDocumentWorkflow({
      currentDocument: createCurrentDocument(),
      shareAndroidMarkdownDocument,
      getAndroidDocumentUserMessage: () => 'failed',
      imageSharingSettings: defaultImageSharingSettings,
    })

    expect(shareAndroidMarkdownDocument).toHaveBeenCalledWith(
      '# Share Out Note\n\nbody',
      'Share Out Note.md',
      { attachImages: true, encoding: 'utf8' },
    )
    expect(result).toEqual({
      kind: 'shared',
      status: 'Share sheet opened',
      shareResult,
    })
  })

  it('shares Markdown without image attachments when image sharing is disabled', async () => {
    const shareAndroidMarkdownDocument = vi.fn().mockResolvedValue(shareResult)

    await shareAndroidMarkdownDocumentWorkflow({
      currentDocument: createCurrentDocument(),
      shareAndroidMarkdownDocument,
      getAndroidDocumentUserMessage: () => 'failed',
      imageSharingSettings: {
        shareImages: 'link-only',
      },
    })

    expect(shareAndroidMarkdownDocument).toHaveBeenCalledWith(
      '# Share Out Note\n\nbody',
      'Share Out Note.md',
      { attachImages: false, encoding: 'utf8' },
    )
  })

  it('shares Markdown with configured save preparation options', async () => {
    const shareAndroidMarkdownDocument = vi.fn().mockResolvedValue(shareResult)

    await shareAndroidMarkdownDocumentWorkflow({
      currentDocument: createCurrentDocument('one\ntwo\n\n'),
      shareAndroidMarkdownDocument,
      getAndroidDocumentUserMessage: () => 'failed',
      imageSharingSettings: defaultImageSharingSettings,
      markdownSaveSettings: {
        encoding: 'gb18030',
        lineEnding: 'crlf',
        trimTrailingNewline: 0,
      },
    })

    expect(shareAndroidMarkdownDocument).toHaveBeenCalledWith(
      'one\r\ntwo',
      'Draft.md',
      { attachImages: true, encoding: 'gb18030' },
    )
  })

  it('returns a user-facing status when sharing fails', async () => {
    const result = await shareAndroidMarkdownDocumentWorkflow({
      currentDocument: createCurrentDocument(),
      shareAndroidMarkdownDocument: vi.fn().mockRejectedValue(new Error('share target missing')),
      getAndroidDocumentUserMessage: error => `message: ${(error as Error).message}`,
      imageSharingSettings: defaultImageSharingSettings,
    })

    expect(result).toMatchObject({
      kind: 'failed',
      status: 'message: share target missing',
    })
  })
})
