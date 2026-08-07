import { describe, expect, it } from 'vitest'

import {
  buildCloudSourceUri,
  isCloudSourceUri,
  parseCloudSourceUri,
} from './cloudDocumentUris'

describe('cloudDocumentUris', () => {
  it('round-trips a OneDrive identity including colons in the file id', () => {
    const uri = buildCloudSourceUri('onedrive', 'ABC!123:xyz')

    expect(uri).toBe('cloud:onedrive:ABC!123:xyz')
    expect(isCloudSourceUri(uri)).toBe(true)
    expect(parseCloudSourceUri(uri)).toEqual({ provider: 'onedrive', fileId: 'ABC!123:xyz' })
  })

  it('rejects non-cloud and malformed URIs', () => {
    expect(isCloudSourceUri('content://provider/doc/1')).toBe(false)
    expect(isCloudSourceUri(null)).toBe(false)
    expect(parseCloudSourceUri('content://provider/doc/1')).toBeNull()
    expect(parseCloudSourceUri('cloud:onedrive:')).toBeNull()
    expect(parseCloudSourceUri('cloud:dropbox:file')).toBeNull()
    expect(parseCloudSourceUri(null)).toBeNull()
  })
})
