import { describe, expect, it, vi } from 'vitest'
import { readEditorMarkdownSnapshot } from './editorMarkdownSnapshot'

function createEditorSnapshotSource() {
  let markdown = 'stale'
  const editor = {
    flush: vi.fn(() => {
      markdown = 'fresh\n'
    }),
    getMarkdown: vi.fn(() => markdown),
  }
  return editor
}

describe('readEditorMarkdownSnapshot', () => {
  it('flushes pending Muya edits before reading markdown for save paths', () => {
    const editor = createEditorSnapshotSource()

    const markdown = readEditorMarkdownSnapshot(editor, { flushPending: true })

    expect(markdown).toBe('fresh\n')
    expect(editor.flush).toHaveBeenCalledTimes(1)
    expect(editor.getMarkdown).toHaveBeenCalledTimes(1)
    const flushOrder = vi.mocked(editor.flush).mock.invocationCallOrder[0]
    const getMarkdownOrder = vi.mocked(editor.getMarkdown).mock.invocationCallOrder[0]
    expect(flushOrder).toBeDefined()
    expect(getMarkdownOrder).toBeDefined()
    expect(flushOrder as number).toBeLessThan(getMarkdownOrder as number)
  })

  it('keeps non-save reads unflushed', () => {
    const editor = createEditorSnapshotSource()

    const markdown = readEditorMarkdownSnapshot(editor)

    expect(markdown).toBe('stale')
    expect(editor.flush).not.toHaveBeenCalled()
  })

  it('normalizes the flushed markdown snapshot', () => {
    const editor = createEditorSnapshotSource()

    const markdown = readEditorMarkdownSnapshot(editor, {
      flushPending: true,
      normalizeMarkdown: value => value.trim(),
    })

    expect(markdown).toBe('fresh')
  })
})
