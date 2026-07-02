import { describe, expect, it } from 'vitest'
import { createUntitledDocument, updateDocumentMarkdown } from './documentState'
import {
  applyAndroidDocumentAutosaveFailure,
  applyAndroidDocumentAutosaveSuccess,
  canApplyAndroidDocumentAutosaveSuccess,
  createAndroidDocumentAutosaveRequest,
} from './androidDocumentAutosave'

describe('androidDocumentAutosave', () => {
  it('creates a saving request with Markdown prepared for the current document line ending', () => {
    const documentState = updateDocumentMarkdown(
      createUntitledDocument({
        markdown: 'one\r\ntwo\r\n',
        sourceUri: 'content://provider/note.md',
        autosaveTarget: 'android-document',
      }),
      'one\ntwo\nthree\n',
    )

    const request = createAndroidDocumentAutosaveRequest(documentState, 'one\ntwo\nthree\n')

    expect(request.savingDocument.autosaveState).toBe('saving')
    expect(request.saveMarkdown).toBe('one\ntwo\nthree\n')
    expect(request.markdownForSave).toBe('one\r\ntwo\r\nthree\r\n')
  })

  it('only applies a successful save to the same Android document and Markdown snapshot', () => {
    const documentState = createUntitledDocument({
      markdown: '# Android note',
      sourceUri: 'content://provider/note.md',
      autosaveTarget: 'android-document',
    })

    expect(
      canApplyAndroidDocumentAutosaveSuccess(
        documentState,
        'content://provider/note.md',
        '# Android note',
      ),
    ).toBe(true)
    expect(
      canApplyAndroidDocumentAutosaveSuccess(
        documentState,
        'content://provider/other.md',
        '# Android note',
      ),
    ).toBe(false)
    expect(
      canApplyAndroidDocumentAutosaveSuccess(
        documentState,
        'content://provider/note.md',
        '# Changed while saving',
      ),
    ).toBe(false)
  })

  it('marks Android autosave success clean with the saved timestamp', () => {
    const documentState = createUntitledDocument({
      markdown: '# Android note',
      sourceUri: 'content://provider/note.md',
      autosaveTarget: 'android-document',
    })

    const savedDocument = applyAndroidDocumentAutosaveSuccess(
      documentState,
      '# Android note',
      '2026-07-02T00:03:00.000Z',
    )

    expect(savedDocument.isDirty).toBe(false)
    expect(savedDocument.autosaveTarget).toBe('android-document')
    expect(savedDocument.autosaveState).toBe('clean')
    expect(savedDocument.updatedAt).toBe('2026-07-02T00:03:00.000Z')
    expect(savedDocument.lastSavedAt).toBe('2026-07-02T00:03:00.000Z')
  })

  it('marks Android autosave failure as dirty and failed', () => {
    const documentState = createUntitledDocument({
      markdown: '# Android note',
      sourceUri: 'content://provider/note.md',
      autosaveTarget: 'android-document',
    })

    const failedDocument = applyAndroidDocumentAutosaveFailure(
      documentState,
      new Error('permission lost'),
    )

    expect(failedDocument.isDirty).toBe(true)
    expect(failedDocument.autosaveState).toBe('save-failed')
    expect(failedDocument.lastSaveError).toBe('permission lost')
  })
})
