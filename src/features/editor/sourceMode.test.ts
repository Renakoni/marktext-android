import { describe, expect, it, vi } from 'vitest'
import {
  createSourceModeController,
  indexPositionToOffset,
  offsetToIndexPosition,
  type SourceModeEditor,
} from './sourceMode'

const noopLogger = { info: vi.fn(), warn: vi.fn() }

describe('source position math', () => {
  const text = 'alpha\n\nbravo lives\ncharlie'

  it('maps {line, ch} to absolute offsets and back', () => {
    expect(indexPositionToOffset(text, { line: 0, ch: 0 })).toBe(0)
    expect(indexPositionToOffset(text, { line: 0, ch: 5 })).toBe(5)
    expect(indexPositionToOffset(text, { line: 2, ch: 6 })).toBe(13)
    expect(offsetToIndexPosition(text, 13)).toEqual({ line: 2, ch: 6 })
    expect(offsetToIndexPosition(text, 0)).toEqual({ line: 0, ch: 0 })

    // Full round trip across every offset.
    for (let offset = 0; offset <= text.length; offset++) {
      const position = offsetToIndexPosition(text, offset)
      expect(indexPositionToOffset(text, position)).toBe(offset)
    }
  })

  it('clamps out-of-range positions instead of throwing', () => {
    expect(indexPositionToOffset(text, { line: 99, ch: 99 })).toBe(text.length)
    expect(indexPositionToOffset(text, { line: -1, ch: -5 })).toBe(0)
    expect(indexPositionToOffset(text, { line: 0, ch: 999 })).toBe(5)
    expect(offsetToIndexPosition(text, 9999)).toEqual({ line: 3, ch: 7 })
    expect(offsetToIndexPosition(text, -3)).toEqual({ line: 0, ch: 0 })
    expect(indexPositionToOffset('', { line: 5, ch: 5 })).toBe(0)
  })
})

interface FakeEditorOptions {
  cursorOffset?: { line: number, ch: number } | null
  selection?: unknown
  setCursorResult?: boolean
}

function createFakeEditor(options: FakeEditorOptions = {}) {
  const calls = {
    replaceContent: [] as { content: string, recordSelection: unknown }[],
    setCursorByOffset: [] as unknown[],
  }
  let markdown = 'one\ntwo\n'

  const editor: SourceModeEditor = {
    getSelection: () => options.selection ?? null,
    getCursorOffset: () => {
      const position = options.cursorOffset ?? null
      return position ? { anchor: position, focus: position } : null
    },
    replaceContent: (content, recordSelection) => {
      calls.replaceContent.push({ content, recordSelection })
      const changed = content !== markdown
      if (changed) {
        markdown = content
      }
      return changed
    },
    setCursorByOffset: (cursor, sourceMarkdown) => {
      calls.setCursorByOffset.push({ cursor, sourceMarkdown })
      return options.setCursorResult ?? true
    },
  }

  return { editor, calls, getMarkdown: () => markdown }
}

function createController(fake: ReturnType<typeof createFakeEditor> | null) {
  const onDocumentEdited = vi.fn()
  const controller = createSourceModeController({
    getEditor: () => fake?.editor ?? null,
    getMarkdownSnapshot: () => fake?.getMarkdown() ?? '',
    onDocumentEdited,
    logger: noopLogger,
  })
  return { controller, onDocumentEdited }
}

describe('source mode controller', () => {
  it('enters with the snapshot, the entry caret, and the captured selection', () => {
    const fake = createFakeEditor({
      cursorOffset: { line: 1, ch: 2 },
      selection: { marker: 'entry' },
    })
    const { controller } = createController(fake)

    expect(controller.enter()).toBe(true)
    expect(controller.active.value).toBe(true)
    expect(controller.text.value).toBe('one\ntwo\n')
    // line 1 ch 2 -> after "one\n" (4) + 2.
    expect(controller.entryCaretOffset.value).toBe(6)
    expect(controller.activeText()).toBe('one\ntwo\n')
  })

  it('falls back to a start-of-document caret when the selection APIs return null', () => {
    const fake = createFakeEditor({ cursorOffset: null, selection: null })
    const { controller } = createController(fake)

    expect(controller.enter()).toBe(true)
    expect(controller.entryCaretOffset.value).toBe(0)
  })

  it('refuses to enter without an editor', () => {
    const { controller } = createController(null)

    expect(controller.enter()).toBe(false)
    expect(controller.active.value).toBe(false)
  })

  it('drives the edit pipeline on every textarea input', () => {
    const fake = createFakeEditor()
    const { controller, onDocumentEdited } = createController(fake)
    controller.enter()

    controller.updateText('one\ntwo\nthree\n', { start: 14, end: 14 })

    expect(controller.text.value).toBe('one\ntwo\nthree\n')
    expect(onDocumentEdited).toHaveBeenCalledTimes(1)
  })

  it('hands back one replacement with the ENTRY selection and the exit caret', () => {
    const fake = createFakeEditor({
      cursorOffset: { line: 0, ch: 1 },
      selection: { marker: 'entry' },
    })
    const { controller, onDocumentEdited } = createController(fake)
    controller.enter()
    controller.updateText('edited body\n', { start: 6, end: 6 })
    onDocumentEdited.mockClear()

    controller.exit({ start: 6, end: 6 })

    expect(controller.active.value).toBe(false)
    expect(fake.calls.replaceContent).toEqual([
      { content: 'edited body\n', recordSelection: { marker: 'entry' } },
    ])
    // The RAW textarea text rides along so the engine maps the caret
    // through what the user saw, not the canonical re-serialization.
    expect(fake.calls.setCursorByOffset).toEqual([
      {
        cursor: { anchor: { line: 0, ch: 6 }, focus: { line: 0, ch: 6 } },
        sourceMarkdown: 'edited body\n',
      },
    ])
    // The hand-back changed the document: the canonical serialization must
    // flow through the same pipeline as WYSIWYG edits.
    expect(onDocumentEdited).toHaveBeenCalledTimes(1)
    expect(controller.activeText()).toBeNull()
  })

  it('falls back to the last known caret when exit gets none (Android back)', () => {
    const fake = createFakeEditor({ cursorOffset: { line: 0, ch: 0 } })
    const { controller } = createController(fake)
    controller.enter()
    controller.updateText('changed\n', { start: 3, end: 5 })

    controller.exit(null)

    expect(fake.calls.setCursorByOffset).toEqual([
      {
        cursor: { anchor: { line: 0, ch: 3 }, focus: { line: 0, ch: 5 } },
        sourceMarkdown: 'changed\n',
      },
    ])
  })

  it('snaps to the document start when even the engine ladder cannot resolve', () => {
    // Deterministic fallback, never a silent caret loss: if the engine
    // reports the exit caret unresolvable (its own backstep ladder
    // exhausted), the controller pins the caret to the document start.
    const fake = createFakeEditor({
      cursorOffset: { line: 0, ch: 0 },
      setCursorResult: false,
    })
    const { controller } = createController(fake)
    controller.enter()
    controller.updateText('| a |\n| - |\n| b |\n', { start: 18, end: 18 })

    controller.exit({ start: 18, end: 18 })

    expect(fake.calls.setCursorByOffset).toHaveLength(2)
    expect(fake.calls.setCursorByOffset[1]).toEqual({
      cursor: { anchor: { line: 0, ch: 0 }, focus: { line: 0, ch: 0 } },
      sourceMarkdown: '| a |\n| - |\n| b |\n',
    })
  })

  it('skips the caret restore and the edit pipeline when nothing changed', () => {
    const fake = createFakeEditor({ cursorOffset: { line: 0, ch: 0 } })
    const { controller, onDocumentEdited } = createController(fake)
    controller.enter()
    onDocumentEdited.mockClear()

    controller.exit({ start: 2, end: 2 })

    expect(fake.calls.replaceContent).toHaveLength(1)
    expect(fake.calls.setCursorByOffset).toHaveLength(0)
    expect(onDocumentEdited).not.toHaveBeenCalled()
  })

  it('exits cleanly when the editor died mid-mode (teardown race)', () => {
    const fake = createFakeEditor()
    const onDocumentEdited = vi.fn()
    let editorAlive = true
    const controller = createSourceModeController({
      getEditor: () => (editorAlive ? fake.editor : null),
      getMarkdownSnapshot: () => fake.getMarkdown(),
      onDocumentEdited,
      logger: noopLogger,
    })
    controller.enter()
    controller.updateText('late text\n', { start: 0, end: 0 })
    editorAlive = false

    controller.exit(null)

    expect(controller.active.value).toBe(false)
    expect(fake.calls.replaceContent).toHaveLength(0)
  })

  it('reset drops the mode without any hand-back', () => {
    const fake = createFakeEditor()
    const { controller, onDocumentEdited } = createController(fake)
    controller.enter()
    onDocumentEdited.mockClear()

    controller.reset()

    expect(controller.active.value).toBe(false)
    expect(controller.activeText()).toBeNull()
    expect(fake.calls.replaceContent).toHaveLength(0)
    expect(onDocumentEdited).not.toHaveBeenCalled()
  })
})
