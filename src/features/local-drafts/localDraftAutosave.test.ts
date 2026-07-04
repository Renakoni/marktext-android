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
})
