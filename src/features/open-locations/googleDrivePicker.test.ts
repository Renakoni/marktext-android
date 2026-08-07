import { describe, expect, it } from 'vitest'

import { pickedDriveDocumentFrom } from './googleDrivePicker'

describe('pickedDriveDocumentFrom', () => {
  it('maps a picked document to its file id and name', () => {
    expect(
      pickedDriveDocumentFrom({
        action: 'picked',
        docs: [{ id: '1AbC', name: 'notes.md' }],
      }),
    ).toEqual({ fileId: '1AbC', name: 'notes.md' })
  })

  it('maps cancel to null so the session resolves without a document', () => {
    expect(pickedDriveDocumentFrom({ action: 'cancel' })).toBeNull()
  })

  it('ignores non-terminal events like loaded', () => {
    expect(pickedDriveDocumentFrom({ action: 'loaded' })).toBeUndefined()
    expect(pickedDriveDocumentFrom({})).toBeUndefined()
  })

  it('treats a pick without a usable file id as canceled', () => {
    expect(pickedDriveDocumentFrom({ action: 'picked', docs: [] })).toBeNull()
    expect(pickedDriveDocumentFrom({ action: 'picked', docs: [{ id: 42 }] })).toBeNull()
    expect(pickedDriveDocumentFrom({ action: 'picked' })).toBeNull()
  })

  it('tolerates a missing document name', () => {
    expect(pickedDriveDocumentFrom({ action: 'picked', docs: [{ id: '1AbC' }] })).toEqual({
      fileId: '1AbC',
      name: '',
    })
  })
})
