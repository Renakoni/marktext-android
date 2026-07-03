import { createUntitledDocument, markDocumentSaved } from '../../lib/documentState'
import type { OpenedAndroidDocument } from '../../lib/androidDocuments'
import type { LocalDraftRecord } from '../../lib/localDrafts'

export type SavedAndroidDocumentStateSource = OpenedAndroidDocument

export function createDocumentStateFromLocalDraft(draft: LocalDraftRecord) {
  return {
    ...createUntitledDocument({
      markdown: draft.markdown,
      autosaveTarget: 'local-draft',
      createdAt: draft.createdAt,
      now: draft.updatedAt,
    }),
    id: draft.id,
    lastSavedAt: draft.lastSavedAt,
    updatedAt: draft.updatedAt,
  }
}

export function createDocumentStateFromAndroidDocument(document: OpenedAndroidDocument) {
  const openedDocument = createUntitledDocument({
    markdown: document.markdown,
    displayName: document.displayName,
    sourceUri: document.sourceUri,
    autosaveTarget: 'android-document',
  })

  return {
    ...openedDocument,
    id: `android-document:${document.sourceUri}`,
    lastSavedAt: null,
  }
}

export function createSavedDocumentStateFromAndroidDocument(
  document: SavedAndroidDocumentStateSource,
  savedAt: string,
) {
  return markDocumentSaved(
    {
      ...createDocumentStateFromAndroidDocument(document),
      updatedAt: savedAt,
      lastSavedAt: savedAt,
    },
    { autosaveTarget: 'android-document', now: savedAt },
  )
}
