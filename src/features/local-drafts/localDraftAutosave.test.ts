import { describe, expect, it } from 'vitest'
import { createUntitledDocument, updateDocumentMarkdown } from '../../lib/documentState'
import { createLocalDraftAutosaveResult } from './localDraftAutosave'
import type { LocalDraftRecord } from '../../lib/localDrafts'

const existingDraft: LocalDraftRecord = {
  id: 'draft-1',
  markdown: '# Existing',
  createdAt: '2026-07-02T00:00:00.000Z',
  updatedAt: '2026-07-02T00:00:00.000Z',
  lastSavedAt: '2026-07-02T00:00:00.000Z',
}

describe('localDraftAutosave', () => {
  it('creates a saved document and upserts non-empty local draft content', () => {
    const documentState = updateDocumentMarkdown(
      createUntitledDocument({
        markdown: '# Existing',
        now: '2026-07-02T00:00:00.000Z',
      }),
      '# Updated draft\n\nbody',
    )
    const result = createLocalDraftAutosaveResult(documentState, '# Updated draft\n\nbody', [
      existingDraft,
    ])

    expect(result.hasContent).toBe(true)
    expect(result.savingDocument.autosaveState).toBe('saving')
    expect(result.savedDocument.autosaveTarget).toBe('local-draft')
    expect(result.savedDocument.autosaveState).toBe('clean')
    expect(result.savedDocument.isDirty).toBe(false)
    expect(result.nextDrafts[0]).toMatchObject({
      id: documentState.id,
      markdown: '# Updated draft\n\nbody',
      createdAt: result.savedDocument.createdAt,
      lastSavedAt: result.savedDocument.lastSavedAt,
    })
  })

  it('keeps a renamed draft name through autosave', () => {
    const renamedDraft = { ...existingDraft, displayName: 'Trip plan' }
    const documentState = updateDocumentMarkdown(
      { ...createUntitledDocument({ markdown: '# Existing' }), id: existingDraft.id },
      '# Updated draft',
    )

    const result = createLocalDraftAutosaveResult(documentState, '# Updated draft', [
      renamedDraft,
    ])

    expect(result.nextDrafts[0].displayName).toBe('Trip plan')
  })

  it('removes the local draft when autosaved Markdown is blank', () => {
    const documentState = createUntitledDocument({
      markdown: '# Existing',
      now: '2026-07-02T00:00:00.000Z',
    })
    const result = createLocalDraftAutosaveResult(documentState, '   ', [
      { ...existingDraft, id: documentState.id },
    ])

    expect(result.hasContent).toBe(false)
    expect(result.savedDocument.markdown).toBe('   ')
    expect(result.nextDrafts).toEqual([])
  })

  // A genuinely untitled draft is one whose Markdown derives no title (an
  // empty-bodied code fence here). It is the only case that earns a number.
  const untitledMarkdown = '```\n```'

  it('gives a genuinely untitled draft a gap-filled Untitled number', () => {
    const documentState = createUntitledDocument({ markdown: untitledMarkdown })
    // A named draft and a content-titled draft reserve no numbers, so the new
    // untitled draft still starts at 1.
    const result = createLocalDraftAutosaveResult(documentState, untitledMarkdown, [
      { ...existingDraft, id: 'other-1', displayName: 'Trip plan' },
      { ...existingDraft, id: 'other-2', markdown: '# A heading' },
    ])

    expect(result.savedDocument.displayName).toBe('Untitled-1')
    expect(result.nextDrafts.find(draft => draft.id === documentState.id)?.displayName)
      .toBe('Untitled-1')
  })

  it('reuses the lowest free Untitled number instead of marching onward', () => {
    const documentState = createUntitledDocument({ markdown: untitledMarkdown })
    const result = createLocalDraftAutosaveResult(documentState, untitledMarkdown, [
      { ...existingDraft, id: 'held-2', markdown: untitledMarkdown, displayName: 'Untitled-2' },
    ])

    expect(result.savedDocument.displayName).toBe('Untitled-1')
  })

  it('recomputes the saved title from the new number so header and storage agree', () => {
    // A second genuinely untitled draft autosaved while Untitled-1 is held: the
    // number resolves to 2, and the document the editor keeps must carry that
    // number as BOTH its displayName and its title, not the stale Untitled-1.
    const documentState = createUntitledDocument({ markdown: untitledMarkdown })
    const result = createLocalDraftAutosaveResult(documentState, untitledMarkdown, [
      { ...existingDraft, id: 'held-1', markdown: untitledMarkdown, displayName: 'Untitled-1' },
    ])

    expect(result.savedDocument.displayName).toBe('Untitled-2')
    expect(result.savedDocument.title).toBe('Untitled-2')
    expect(result.nextDrafts.find(draft => draft.id === documentState.id)?.displayName)
      .toBe('Untitled-2')
  })

  it('never reserves a number for a draft that shows a content title', () => {
    const documentState = createUntitledDocument({ markdown: '# Real title' })
    const result = createLocalDraftAutosaveResult(documentState, '# Real title', [])

    expect(result.nextDrafts[0].displayName).toBeUndefined()
  })

  it('freezes an earned number even after the draft grows a title', () => {
    const numbered = {
      ...existingDraft,
      id: 'numbered',
      markdown: untitledMarkdown,
      displayName: 'Untitled-3',
    }
    const documentState = updateDocumentMarkdown(
      { ...createUntitledDocument({ markdown: untitledMarkdown }), id: 'numbered' },
      '# Now it has a title',
    )
    const result = createLocalDraftAutosaveResult(documentState, '# Now it has a title', [numbered])

    // The number stays the draft's identity; the content title merely wins the
    // displayed name (asserted by recentDocuments), so it is kept, not dropped.
    expect(result.nextDrafts[0].displayName).toBe('Untitled-3')
  })
})
