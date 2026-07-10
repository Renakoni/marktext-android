import { describe, expect, it } from 'vitest'
import {
  createUntitledDocument,
  getCustomDisplayName,
  getDocumentStats,
  getDocumentTitle,
  getSuggestedMarkdownCopyFileName,
  getSuggestedMarkdownFileName,
  getSuggestedPdfFileName,
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

  it('names untitled drafts from their first meaningful line', () => {
    // Drafts have no real file name, so without a heading they previously
    // all read "Untitled-1" on the home list.
    expect(getDocumentTitle('买菜清单，周六之前')).toBe('买菜清单，周六之前')
    expect(getDocumentTitle('- first item\n- second item')).toBe('first item')
    expect(getDocumentTitle('> quoted opening line\nbody')).toBe('quoted opening line')
    expect(getDocumentTitle('**bold start** of a note')).toBe('bold start of a note')
    expect(getDocumentTitle('[a link](https://example.com) opens this'))
      .toBe('a link opens this')
    expect(getDocumentTitle('1. step one\n2. step two')).toBe('step one')
  })

  it('drops inline HTML tags from derived titles', () => {
    // Styled first lines always resolve to plain text — with or without
    // emphasis around the tags, the title is the same readable content.
    expect(getDocumentTitle('***<u>alpha</u>*** bravo charlie delta'))
      .toBe('alpha bravo charlie delta')
    expect(getDocumentTitle('<u>alpha</u> bravo charlie delta'))
      .toBe('alpha bravo charlie delta')
    expect(getDocumentTitle('<mark>note</mark> for later')).toBe('note for later')
    expect(getDocumentTitle('alpha<br>beta')).toBe('alpha beta')
    // Autolinks are content, not markup.
    expect(getDocumentTitle('<https://example.com> reading list'))
      .toBe('<https://example.com> reading list')
  })

  it('reduces styled headings to plain-text titles', () => {
    expect(getDocumentTitle('# **Trip** to <u>Paris</u>')).toBe('Trip to Paris')
    // A pure-markup heading names nothing; the content below wins.
    expect(getDocumentTitle('# ***\n\nreal text')).toBe('real text')
  })

  it('keeps literal Markdown punctuation that is not paired markup', () => {
    expect(getDocumentTitle('# file_name')).toBe('file_name')
    expect(getDocumentTitle('# snake_case_name here')).toBe('snake_case_name here')
    expect(getDocumentTitle('# `file_name`')).toBe('file_name')
    expect(getDocumentTitle('# 2*3 benchmark')).toBe('2*3 benchmark')
    expect(getDocumentTitle('# foo~bar')).toBe('foo~bar')
    expect(getDocumentTitle('# ~~done~~ next steps')).toBe('done next steps')
    expect(getDocumentTitle('# _emphasized_ word')).toBe('emphasized word')
  })

  it('strips custom elements and tags with quoted attribute values', () => {
    expect(getDocumentTitle('<my-widget>alpha</my-widget> beta')).toBe('alpha beta')
    expect(getDocumentTitle('<span title="a>b">alpha</span> beta')).toBe('alpha beta')
    expect(getDocumentTitle('<user@example.com> contact line'))
      .toBe('<user@example.com> contact line')
  })

  it('skips front matter and pure-syntax lines when deriving draft titles', () => {
    expect(getDocumentTitle('---\ntitle: meta\n---\nActual first line')).toBe('Actual first line')
    expect(getDocumentTitle('---\n\nBelow a thematic break')).toBe('Below a thematic break')
    expect(getDocumentTitle('```js\nconst x = 1\n```')).toBe('const x = 1')
  })

  it('truncates long derived titles and keeps empty drafts untitled', () => {
    const longLine = 'word '.repeat(30).trim()
    expect(getDocumentTitle(longLine).length).toBeLessThanOrEqual(48)
    expect(getDocumentTitle('')).toBe('Untitled-1')
    expect(getDocumentTitle('   \n\n')).toBe('Untitled-1')
  })

  it('keeps real file display names ahead of content-derived titles', () => {
    expect(getDocumentTitle('leading text without heading', 'trip-notes.md'))
      .toBe('trip-notes')
  })

  it('treats the Untitled placeholder as no custom display name', () => {
    expect(getCustomDisplayName('Untitled-1')).toBeUndefined()
    expect(getCustomDisplayName('  ')).toBeUndefined()
    expect(getCustomDisplayName(' Trip plan ')).toBe('Trip plan')
  })

  it('suggests a Markdown file name from the first heading', () => {
    expect(getSuggestedMarkdownFileName('# Trip notes\n\nbody', 'draft.md')).toBe('Trip notes.md')
  })

  it('sanitizes suggested Markdown file names for Android document creation', () => {
    expect(getSuggestedMarkdownFileName('# Meeting: A/B?')).toBe('Meeting A B.md')
  })

  it('suggests a PDF file name from the document title', () => {
    expect(getSuggestedPdfFileName('# Trip notes\n\nbody', 'draft.md')).toBe('Trip notes.pdf')
    expect(getSuggestedPdfFileName('# Meeting: A/B?')).toBe('Meeting A B.pdf')
    expect(getSuggestedPdfFileName('plain text', 'notes.md')).toBe('notes.pdf')
    expect(getSuggestedPdfFileName('')).toBe('Untitled-1.pdf')
  })

  it('suggests a copy file name without changing the source Markdown title', () => {
    expect(getSuggestedMarkdownCopyFileName('# Trip notes\n\nbody', 'draft.md')).toBe(
      'Trip notes copy.md',
    )
  })

  it('increments copy file names around reserved Android document names', () => {
    expect(
      getSuggestedMarkdownCopyFileName('plain text', 'Trip notes copy.md', [
        'Trip notes copy 2.md',
      ]),
    ).toBe('Trip notes copy 3.md')
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

  it('overrides preserved line endings when a global save setting is selected', () => {
    const documentState = createUntitledDocument({ markdown: 'one\r\ntwo\r\n' })
    const saved = prepareMarkdownForSave('one\ntwo\n', documentState, {
      lineEnding: 'lf',
      trimTrailingNewline: 1,
    })

    expect(saved).toBe('one\ntwo\n')
  })

  it('trims trailing newlines when the global save setting requests it', () => {
    const documentState = createUntitledDocument({ markdown: 'one\n\n' })
    const saved = prepareMarkdownForSave('one\n\n', documentState, {
      trimTrailingNewline: 0,
    })

    expect(saved).toBe('one')
  })

  it('preserves a final newline added after opening a document without one', () => {
    const documentState = createUntitledDocument({ markdown: 'one' })
    const dirty = updateDocumentMarkdown(documentState, 'one\n')
    const saved = prepareMarkdownForSave(dirty.markdown, dirty)

    expect(dirty.trimTrailingNewline).toBe(1)
    expect(saved).toBe('one\n')
  })

  it('preserves final newline removal after opening a document with one', () => {
    const documentState = createUntitledDocument({ markdown: 'one\n' })
    const dirty = updateDocumentMarkdown(documentState, 'one')
    const saved = prepareMarkdownForSave(dirty.markdown, dirty)

    expect(dirty.trimTrailingNewline).toBe(0)
    expect(saved).toBe('one')
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
