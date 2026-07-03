import { describe, expect, it } from 'vitest'
import {
  createDocumentStateFromAndroidDocument,
  createDocumentStateFromLocalDraft,
  createSavedDocumentStateFromAndroidDocument,
} from './documentSessionState'
import type { OpenedAndroidDocument } from './androidDocuments'
import type { LocalDraftRecord } from './localDrafts'

const localDraft: LocalDraftRecord = {
  id: 'draft-1',
  markdown: '# Local draft\n\nbody',
  updatedAt: '2026-07-02T00:01:00.000Z',
  lastSavedAt: '2026-07-02T00:00:00.000Z',
}

const androidDocument: OpenedAndroidDocument = {
  canceled: false,
  sourceUri: 'content://provider/note.md',
  displayName: 'note.md',
  providerName: 'Documents',
  pathHint: 'Documents/note.md',
  mimeType: 'text/markdown',
  markdown: '# Android note\n\nbody',
  canWrite: true,
  persisted: true,
}

describe('documentSessionState', () => {
  it('creates editable document state from a local draft record', () => {
    const documentState = createDocumentStateFromLocalDraft(localDraft)

    expect(documentState).toMatchObject({
      id: 'draft-1',
      markdown: '# Local draft\n\nbody',
      title: 'Local draft',
      autosaveTarget: 'local-draft',
      lastSavedAt: '2026-07-02T00:00:00.000Z',
      updatedAt: '2026-07-02T00:01:00.000Z',
      sourceUri: null,
      isDirty: false,
      autosaveState: 'clean',
    })
  })

  it('creates Android document state without marking it saved locally', () => {
    const documentState = createDocumentStateFromAndroidDocument(androidDocument)

    expect(documentState).toMatchObject({
      id: 'android-document:content://provider/note.md',
      markdown: '# Android note\n\nbody',
      displayName: 'note.md',
      title: 'Android note',
      sourceUri: 'content://provider/note.md',
      autosaveTarget: 'android-document',
      lastSavedAt: null,
      isDirty: false,
      autosaveState: 'clean',
    })
  })

  it('creates saved Android document state for documents created by save-copy flows', () => {
    const documentState = createSavedDocumentStateFromAndroidDocument(
      androidDocument,
      '2026-07-02T00:03:00.000Z',
    )

    expect(documentState).toMatchObject({
      id: 'android-document:content://provider/note.md',
      markdown: '# Android note\n\nbody',
      displayName: 'note.md',
      sourceUri: 'content://provider/note.md',
      autosaveTarget: 'android-document',
      updatedAt: '2026-07-02T00:03:00.000Z',
      lastSavedAt: '2026-07-02T00:03:00.000Z',
      isDirty: false,
      autosaveState: 'clean',
      lastSaveError: null,
    })
  })
})
