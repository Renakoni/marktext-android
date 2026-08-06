import { ref, type Ref } from 'vue'

// Source code mode (#180): the WYSIWYG editor steps aside for a plain
// monospace textarea holding the raw Markdown. The mode's correctness lives
// in the hand-off composition against three Muya APIs, audited and pinned by
// the engine's sourceModeHandoff spec:
//
//   enter:  markdown snapshot (pending ops flushed) + the live selection +
//           the caret as a source {line, ch} offset
//   exit:   replaceContent(text, entrySelection) — ONE undo boundary that
//           restores the entry document and caret — then setCursorByOffset
//           to land the WYSIWYG caret where the textarea caret ended
//
// Audit ground truths this module is built around:
// - getSelection()/getCursorOffset() read the LIVE DOM selection only; both
//   return null once the ranges are cleared, so entry state is captured at
//   toggle time and every capture tolerates null with deterministic
//   fallbacks (caret at document start, explicit null recordSelection).
// - The exit hand-back re-serializes to Muya's CANONICAL markdown (table
//   columns padded, etc.) exactly as if the same content had been typed in
//   WYSIWYG — semantic fidelity, not byte fidelity to keystrokes.

/** One end of a source selection in CodeMirror-style {line, ch} coordinates. */
export interface SourceIndexPosition {
  line: number
  ch: number
}

interface SourceIndexCursor {
  anchor: SourceIndexPosition | null
  focus: SourceIndexPosition | null
}

/** The Muya surface the mode composes; structurally typed like the command adapter. */
export interface SourceModeEditor {
  getSelection(): unknown
  getCursorOffset(): SourceIndexCursor | null
  replaceContent(content: string, recordSelection?: unknown): boolean
  setCursorByOffset(cursor: {
    anchor: SourceIndexPosition
    focus: SourceIndexPosition
  }): boolean
}

export interface SourceCaretRange {
  start: number
  end: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

/** Absolute string offset for a {line, ch} position, clamped into the text. */
export function indexPositionToOffset(text: string, position: SourceIndexPosition): number {
  const lines = text.split('\n')
  const line = clamp(Math.trunc(position.line) || 0, 0, lines.length - 1)

  let offset = 0
  for (let index = 0; index < line; index++) {
    offset += lines[index].length + 1
  }

  return offset + clamp(Math.trunc(position.ch) || 0, 0, lines[line].length)
}

/** {line, ch} position for an absolute string offset, clamped into the text. */
export function offsetToIndexPosition(text: string, offset: number): SourceIndexPosition {
  const clamped = clamp(Math.trunc(offset) || 0, 0, text.length)

  let line = 0
  let lineStart = 0
  for (let index = 0; index < clamped; index++) {
    if (text[index] === '\n') {
      line++
      lineStart = index + 1
    }
  }

  return { line, ch: clamped - lineStart }
}

interface SourceModeControllerOptions {
  getEditor: () => SourceModeEditor | null
  /** Muya-side markdown snapshot; `flushPending` must flush batched ops. */
  getMarkdownSnapshot: (flushPending?: boolean) => string
  /**
   * Ran after every content change the mode owns (textarea input, and the
   * exit hand-back when it changed the document) — the same pipeline WYSIWYG
   * edits drive: document-state sync, status, autosave scheduling.
   */
  onDocumentEdited: () => void
  logger: {
    info(message: string, context?: unknown): void
    warn(message: string, context?: unknown): void
  }
}

export interface SourceModeController {
  active: Ref<boolean>
  text: Ref<string>
  /** Textarea caret offset to apply when the view mounts (entry hand-off). */
  entryCaretOffset: Ref<number>
  enter(): boolean
  /** Hand the text back to Muya. `caret` null falls back to the last known caret. */
  exit(caret: SourceCaretRange | null): void
  /** Textarea input: keep the text and last caret, drive the edit pipeline. */
  updateText(next: string, caret: SourceCaretRange | null): void
  /** Drop the mode without a hand-back (editor teardown; state already synced). */
  reset(): void
  /** Snapshot override while active: the textarea IS the document. */
  activeText(): string | null
}

export function createSourceModeController(
  options: SourceModeControllerOptions,
): SourceModeController {
  const active = ref(false)
  const text = ref('')
  const entryCaretOffset = ref(0)

  let entrySelection: unknown = null
  let lastCaret: SourceCaretRange | null = null

  function enter(): boolean {
    if (active.value) {
      return true
    }

    const editor = options.getEditor()
    if (!editor) {
      options.logger.warn('source mode entry refused: no editor')
      return false
    }

    // Flush pending batched ops so the snapshot is the authoritative document.
    const markdown = options.getMarkdownSnapshot(true)

    // Live-DOM-only APIs: both may be null (cleared ranges); fall back to a
    // caret at the document start and record no selection on the boundary.
    entrySelection = editor.getSelection()
    const offsetCursor = editor.getCursorOffset()
    const focus = offsetCursor?.focus ?? offsetCursor?.anchor ?? null
    entryCaretOffset.value = focus ? indexPositionToOffset(markdown, focus) : 0

    text.value = markdown
    lastCaret = { start: entryCaretOffset.value, end: entryCaretOffset.value }
    active.value = true
    options.logger.info('source mode entered', {
      characters: markdown.length,
      caret: entryCaretOffset.value,
      hasSelection: entrySelection != null,
    })
    return true
  }

  function exit(caret: SourceCaretRange | null): void {
    if (!active.value) {
      return
    }

    const editor = options.getEditor()
    const nextText = text.value
    const exitCaret = caret ?? lastCaret

    // Deactivate FIRST: from here the document reads come from Muya again,
    // so the post-hand-back sync picks up the canonical serialization.
    active.value = false

    if (!editor) {
      // Teardown race: the document state was already synced from the
      // textarea on every input, so nothing is lost.
      options.logger.warn('source mode exit without editor; text already synced')
      clearEntryState()
      return
    }

    // One undo boundary; the ENTRY selection is recorded explicitly because
    // the live DOM selection points at the (now unmounting) textarea.
    const changed = editor.replaceContent(nextText, entrySelection ?? null)

    if (changed && exitCaret) {
      const restored = editor.setCursorByOffset({
        anchor: offsetToIndexPosition(nextText, exitCaret.start),
        focus: offsetToIndexPosition(nextText, exitCaret.end),
      })
      if (!restored) {
        options.logger.warn('source mode exit caret unresolved', exitCaret)
      }
    }

    if (changed) {
      options.onDocumentEdited()
    }

    options.logger.info('source mode exited', { changed })
    clearEntryState()
  }

  function updateText(next: string, caret: SourceCaretRange | null): void {
    if (!active.value) {
      return
    }

    text.value = next
    if (caret) {
      lastCaret = caret
    }
    options.onDocumentEdited()
  }

  function reset(): void {
    if (!active.value) {
      return
    }

    active.value = false
    clearEntryState()
    options.logger.info('source mode reset (editor teardown)')
  }

  function clearEntryState(): void {
    entrySelection = null
    lastCaret = null
    entryCaretOffset.value = 0
  }

  function activeText(): string | null {
    return active.value ? text.value : null
  }

  return { active, text, entryCaretOffset, enter, exit, updateText, reset, activeText }
}
