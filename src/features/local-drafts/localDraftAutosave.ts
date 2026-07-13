import {
  getCustomDisplayName,
  getNextUntitledDisplayName,
  getUntitledNumber,
  hasDerivedTitle,
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

/**
 * The name to store for a draft. A rename is the draft's identity and always
 * wins. Otherwise the number only ever applies to a GENUINELY untitled draft
 * — one whose Markdown derives no heading/leading-text title — so the normal
 * title derivation is never touched. A number, once earned, is frozen: it is
 * the draft's stable identity, kept even if the draft later grows (or drops
 * and regrows) a content title, and freed only when the draft is deleted.
 */
function resolveDraftDisplayName(
  savedDocument: MarkdownDocumentState,
  drafts: LocalDraftRecord[],
): string | undefined {
  const customName = getCustomDisplayName(savedDocument.displayName)
  if (customName) {
    return customName
  }

  // The stored record is the source of truth for a frozen number — a fresh
  // document still carries the generic default, which must not be mistaken
  // for a deliberately assigned Untitled-1.
  const storedRecord = drafts.find(record => record.id === savedDocument.id)
  const frozenNumber = getUntitledNumber(storedRecord?.displayName)
  if (frozenNumber !== null) {
    return `Untitled-${frozenNumber}`
  }

  // A draft that shows a title of its own earns no number.
  if (hasDerivedTitle(savedDocument.markdown)) {
    return undefined
  }

  return getNextUntitledDisplayName(
    drafts.filter(record => record.id !== savedDocument.id).map(record => record.displayName),
  )
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
  const savedBase = markDocumentSaved(
    updateDocumentMarkdown(savingDocument, markdown, { markDirty: false }),
    { autosaveTarget: 'local-draft' },
  )

  const displayName = resolveDraftDisplayName(savedBase, drafts)
  // The document reflects its stored name so the editor's own header shows the
  // same Untitled-N the recent list does.
  const savedDocument = { ...savedBase, displayName: displayName ?? savedBase.displayName }

  const nextDrafts = hasContent
    ? upsertLocalDraft(drafts, {
        id: savedDocument.id,
        markdown: savedDocument.markdown,
        createdAt: savedDocument.createdAt,
        updatedAt: savedDocument.updatedAt,
        lastSavedAt: savedDocument.lastSavedAt,
        // Undefined keeps any number already frozen on the record (upsert
        // preserves it); a genuinely untitled draft gets its resolved number.
        displayName,
      })
    : removeLocalDraft(drafts, savedDocument.id)

  return {
    savingDocument,
    savedDocument,
    nextDrafts,
    hasContent,
  }
}
