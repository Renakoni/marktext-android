import { describe, expect, it } from 'vitest'
import {
  createUntitledDocument,
  getDocumentStats,
  getDocumentTitle,
  normalizeMarkdownForEditor,
  prepareMarkdownForSave,
  updateDocumentMarkdown,
  markDocumentSaved,
  markDocumentSaveFailed,
} from './documentState'

describe('documentState', () => {
  it('derives a title from the first markdown heading', () => {
    expect(getDocumentTitle('intro\n\n## Mobile Notes\nbody', 'draft.md')).toBe('Mobile Notes')
  })

  it('falls back to the display name without markdown extension', () => {
    expect(getDocumentTitle('plain text', 'notes.md')).toBe('notes')
  })

  it('counts latin words and CJK characters for mobile status text', () => {
    expect(getDocumentStats('Hello MarkText\n你好').words).toBe(4)
  })

  it('normalizes CRLF documents to LF internally while preserving save intent', () => {
    const normalized = normalizeMarkdownForEditor('one\r\ntwo\r\n')

    expect(normalized.markdown).toBe('one\ntwo\n')
    expect(normalized.lineEnding).toBe('crlf')
    expect(normalized.adjustLineEndingOnSave).toBe(true)
  })

  it('detects mixed line endings', () => {
    const normalized = normalizeMarkdownForEditor('one\r\ntwo\nthree\r')

    expect(normalized.markdown).toBe('one\ntwo\nthree\n')
    expect(normalized.isMixedLineEndings).toBe(true)
  })

  it('prepares markdown for CRLF save targets', () => {
    const saved = prepareMarkdownForSave('one\ntwo\n', {
      adjustLineEndingOnSave: true,
      lineEnding: 'crlf',
      trimTrailingNewline: 1,
    })

    expect(saved).toBe('one\r\ntwo\r\n')
  })

  it('marks edited local drafts dirty until autosave succeeds', () => {
    const documentState = createUntitledDocument({
      markdown: 'initial',
      now: '2026-06-29T00:00:00.000Z',
    })
    const dirty = updateDocumentMarkdown(documentState, 'changed', {
      now: '2026-06-29T00:00:01.000Z',
    })

    expect(dirty.isDirty).toBe(true)
    expect(dirty.autosaveState).toBe('dirty')

    const saved = markDocumentSaved(dirty, { now: '2026-06-29T00:00:02.000Z' })
    expect(saved.isDirty).toBe(false)
    expect(saved.autosaveState).toBe('clean')
    expect(saved.lastSavedAt).toBe('2026-06-29T00:00:02.000Z')
  })

  it('keeps content dirty when autosave fails', () => {
    const documentState = createUntitledDocument({ markdown: 'initial' })
    const failed = markDocumentSaveFailed(documentState, new Error('write denied'))

    expect(failed.isDirty).toBe(true)
    expect(failed.autosaveState).toBe('save-failed')
    expect(failed.lastSaveError).toBe('write denied')
  })
})
