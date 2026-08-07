import { beforeEach, describe, expect, it, vi } from 'vitest'

const readCloudDocument = vi.fn()
const writeCloudDocument = vi.fn()
const readAndroidMarkdownDocument = vi.fn()
const writeAndroidMarkdownDocument = vi.fn()

vi.mock('../../lib/cloudDocuments', () => ({
  readCloudDocument: (...args: unknown[]) => readCloudDocument(...args),
  writeCloudDocument: (...args: unknown[]) => writeCloudDocument(...args),
}))

vi.mock('../../lib/androidDocuments', () => ({
  AndroidDocumentError: class AndroidDocumentError extends Error {
    code: string
    constructor(code: string, message: string) {
      super(message)
      this.code = code
    }
  },
  readAndroidMarkdownDocument: (...args: unknown[]) => readAndroidMarkdownDocument(...args),
  writeAndroidMarkdownDocument: (...args: unknown[]) => writeAndroidMarkdownDocument(...args),
}))

import {
  readRoutedMarkdownDocument,
  toOpenedDocumentFromCloud,
  writeRoutedMarkdownDocument,
} from './cloudDocumentBridge'

const CLOUD_CONTENT = {
  fileId: 'item-1',
  displayName: 'notes.md',
  markdown: '# hi',
  encoding: 'utf8' as const,
  hasEncodingBom: false,
  eTag: 'etag-1',
  providerName: 'OneDrive',
  canWrite: true,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('cloudDocumentBridge', () => {
  it('adapts cloud content to the opened-document shape with a cloud source URI', () => {
    const opened = toOpenedDocumentFromCloud(CLOUD_CONTENT)

    expect(opened.sourceUri).toBe('cloud:onedrive:item-1')
    expect(opened.displayName).toBe('notes.md')
    expect(opened.markdown).toBe('# hi')
    expect(opened.canWrite).toBe(true)
    expect(opened.persisted).toBe(true)
    expect(opened.providerName).toBe('OneDrive')
  })

  it('routes cloud source URIs to the cloud plugin on read', async () => {
    readCloudDocument.mockResolvedValue(CLOUD_CONTENT)

    const opened = await readRoutedMarkdownDocument('cloud:onedrive:item-1', {
      defaultEncoding: 'utf8',
    })

    expect(readCloudDocument).toHaveBeenCalledWith('onedrive', 'item-1', {
      defaultEncoding: 'utf8',
    })
    expect(readAndroidMarkdownDocument).not.toHaveBeenCalled()
    expect(opened.sourceUri).toBe('cloud:onedrive:item-1')
  })

  it('passes content URIs through to the SAF reader', async () => {
    readAndroidMarkdownDocument.mockResolvedValue({ sourceUri: 'content://doc/1' })

    await readRoutedMarkdownDocument('content://doc/1', {})

    expect(readAndroidMarkdownDocument).toHaveBeenCalledWith('content://doc/1', {})
    expect(readCloudDocument).not.toHaveBeenCalled()
  })

  it('writes with the ETag from the last read and stores the new one', async () => {
    readCloudDocument.mockResolvedValue(CLOUD_CONTENT)
    writeCloudDocument.mockResolvedValue({
      fileId: 'item-1',
      displayName: 'notes.md',
      eTag: 'etag-2',
      lastModified: '2026-08-07T02:00:00Z',
    })

    await readRoutedMarkdownDocument('cloud:onedrive:item-1', {})
    const saved = await writeRoutedMarkdownDocument('cloud:onedrive:item-1', '# hi!', {
      encoding: 'utf8',
    })

    expect(writeCloudDocument).toHaveBeenCalledWith('onedrive', 'item-1', '# hi!', {
      encoding: 'utf8',
      writeBom: undefined,
      eTag: 'etag-1',
    })
    expect(saved.sourceUri).toBe('cloud:onedrive:item-1')
    expect(saved.persisted).toBe(true)

    // The next save carries the ETag returned by the previous one.
    await writeRoutedMarkdownDocument('cloud:onedrive:item-1', '# hi!!', { encoding: 'utf8' })
    expect(writeCloudDocument).toHaveBeenLastCalledWith('onedrive', 'item-1', '# hi!!', {
      encoding: 'utf8',
      writeBom: undefined,
      eTag: 'etag-2',
    })
    expect(writeAndroidMarkdownDocument).not.toHaveBeenCalled()
  })

  it('fails closed when no baseline ETag is known for a cloud write', async () => {
    // Codex round 1 P1: after a recovery reload this module's ETag map is
    // empty; an ETag-less PUT would silently overwrite remote changes.
    await expect(
      writeRoutedMarkdownDocument('cloud:onedrive:item-orphan', 'text', { encoding: 'utf8' }),
    ).rejects.toMatchObject({ code: 'CLOUD_DOCUMENT_CONFLICT' })
    expect(writeCloudDocument).not.toHaveBeenCalled()
  })

  it('passes non-cloud writes through to the SAF writer', async () => {
    writeAndroidMarkdownDocument.mockResolvedValue({ sourceUri: 'content://doc/1' })

    await writeRoutedMarkdownDocument('content://doc/1', 'text', { encoding: 'utf8' })

    expect(writeAndroidMarkdownDocument).toHaveBeenCalledWith('content://doc/1', 'text', {
      encoding: 'utf8',
    })
    expect(writeCloudDocument).not.toHaveBeenCalled()
  })
})
