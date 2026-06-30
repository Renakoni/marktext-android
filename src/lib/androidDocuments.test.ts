import { describe, expect, it } from 'vitest'
import {
  AndroidDocumentError,
  getAndroidDocumentErrorCode,
  getAndroidDocumentUserMessage,
} from './androidDocuments'

describe('androidDocuments', () => {
  it('reads Capacitor-style document error codes', () => {
    expect(
      getAndroidDocumentErrorCode({
        code: 'DOCUMENT_NOT_FOUND',
        message: 'missing',
      }),
    ).toBe('DOCUMENT_NOT_FOUND')
  })

  it('reads local AndroidDocumentError codes', () => {
    expect(
      getAndroidDocumentErrorCode(
        new AndroidDocumentError('DOCUMENT_PERMISSION_LOST', 'permission lost'),
      ),
    ).toBe('DOCUMENT_PERMISSION_LOST')
  })

  it('maps recoverable Android document failures to user messages', () => {
    expect(getAndroidDocumentUserMessage({ code: 'DOCUMENT_NOT_FOUND' })).toBe(
      'This file was moved or deleted. Open it again from Android.',
    )
    expect(getAndroidDocumentUserMessage({ code: 'DOCUMENT_PERMISSION_LOST' })).toBe(
      'Reopen this file from Android before saving again.',
    )
    expect(getAndroidDocumentUserMessage({ code: 'DOCUMENT_READ_FAILED' })).toBe(
      'Could not read this Markdown file.',
    )
    expect(getAndroidDocumentUserMessage({ code: 'DOCUMENT_WRITE_FAILED' })).toBe(
      'Could not save this Markdown file.',
    )
  })
})
