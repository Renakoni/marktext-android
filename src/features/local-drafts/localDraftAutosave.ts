import {
  markDocumentSaved,
  markDocumentSaving,
  updateDocumentMarkdown,
  type MarkdownDocumentState,
} from '../../lib/documentState'
import {
  removeLocalDraft,
  upsertLocalDraft,
  type LocalDraftRecord,
} from '../../lib/localDrafts'

export interface LocalDraftAutosaveResult {
  savingDocument: MarkdownDocumentState
  savedDocument: MarkdownDocumentState
  nextDrafts: LocalDraftRecord[]
  hasContent: boolean
}

export function createLocalDraftAutosaveResult(
  documentState: MarkdownDocumentState,
  markdown: string,
  drafts: LocalDraftRecord[],
): LocalDraftAutosaveResult {
  const hasContent = markdown.trim().length > 0
  const savingDocument = markDocumentSaving(
    updateDocumentMarkdown(documentState, markdown, { markDirty: documentState.isDirty }),
  )
  const savedDocument = markDocumentSaved(
    updateDocumentMarkdown(savingDocument, markdown, { markDirty: false }),
    { autosaveTarget: 'local-draft' },
  )
  const nextDrafts = hasContent
    ? upsertLocalDraft(drafts, {
        id: savedDocument.id,
        markdown: savedDocument.markdown,
        updatedAt: savedDocument.updatedAt,
        lastSavedAt: savedDocument.lastSavedAt,
      })
    : removeLocalDraft(drafts, savedDocument.id)

  return {
    savingDocument,
    savedDocument,
    nextDrafts,
    hasContent,
  }
}
