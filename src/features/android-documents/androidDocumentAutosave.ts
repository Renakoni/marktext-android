import {
  markDocumentSaved,
  markDocumentSaveFailed,
  markDocumentSaving,
  prepareMarkdownForSave,
  updateDocumentMarkdown,
  type MarkdownDocumentState,
} from '../../lib/documentState'

export interface AndroidDocumentAutosaveRequest {
  savingDocument: MarkdownDocumentState
  markdownForSave: string
  saveMarkdown: string
}

export function createAndroidDocumentAutosaveRequest(
  documentState: MarkdownDocumentState,
  markdown: string,
): AndroidDocumentAutosaveRequest {
  const nextDocument = updateDocumentMarkdown(documentState, markdown, {
    markDirty: documentState.isDirty,
  })

  return {
    savingDocument: markDocumentSaving(nextDocument),
    markdownForSave: prepareMarkdownForSave(nextDocument.markdown, nextDocument),
    saveMarkdown: nextDocument.markdown,
  }
}

export function canApplyAndroidDocumentAutosaveSuccess(
  documentState: MarkdownDocumentState,
  sourceUri: string,
  saveMarkdown: string,
) {
  return (
    documentState.autosaveTarget === 'android-document' &&
    documentState.sourceUri === sourceUri &&
    documentState.markdown === saveMarkdown
  )
}

export function applyAndroidDocumentAutosaveSuccess(
  documentState: MarkdownDocumentState,
  saveMarkdown: string,
  savedAt: string,
) {
  return markDocumentSaved(
    updateDocumentMarkdown(documentState, saveMarkdown, {
      markDirty: false,
      now: savedAt,
    }),
    { autosaveTarget: 'android-document', now: savedAt },
  )
}

export function applyAndroidDocumentAutosaveFailure(
  documentState: MarkdownDocumentState,
  error: unknown,
) {
  return markDocumentSaveFailed(documentState, error)
}
