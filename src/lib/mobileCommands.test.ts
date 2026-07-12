import { describe, expect, it } from 'vitest'
import {
  isSelectionDependentMobileCommand,
  MOBILE_COMMANDS,
  runMobileEditorCommand,
  type MobileEditorCommandTarget,
} from './mobileCommands'

function createEditorTarget() {
  const calls: string[] = []
  const editor: MobileEditorCommandTarget = {
    undo: () => {
      calls.push('undo')
    },
    redo: () => {
      calls.push('redo')
    },
    format: type => {
      calls.push(`format:${type}`)
    },
    updateParagraph: type => {
      calls.push(`paragraph:${type}`)
    },
  }

  return { editor, calls }
}

describe('mobileCommands', () => {
  it('keeps document file commands out of the editor command runner', () => {
    const result = runMobileEditorCommand(null, MOBILE_COMMANDS.FILE_OPEN)

    expect(result).toEqual({
      handled: false,
      commandId: MOBILE_COMMANDS.FILE_OPEN,
      reason: 'document-command',
    })
  })

  it('maps upstream format command ids to Muya format actions', () => {
    const cases = [
      [MOBILE_COMMANDS.FORMAT_STRONG, 'strong'],
      [MOBILE_COMMANDS.FORMAT_EMPHASIS, 'em'],
      [MOBILE_COMMANDS.FORMAT_UNDERLINE, 'u'],
      [MOBILE_COMMANDS.FORMAT_SUPERSCRIPT, 'sup'],
      [MOBILE_COMMANDS.FORMAT_SUBSCRIPT, 'sub'],
      [MOBILE_COMMANDS.FORMAT_STRIKE, 'del'],
      [MOBILE_COMMANDS.FORMAT_HIGHLIGHT, 'mark'],
      [MOBILE_COMMANDS.FORMAT_INLINE_CODE, 'inline_code'],
      [MOBILE_COMMANDS.FORMAT_INLINE_MATH, 'inline_math'],
      [MOBILE_COMMANDS.FORMAT_HYPERLINK, 'link'],
      [MOBILE_COMMANDS.FORMAT_IMAGE, 'image'],
      [MOBILE_COMMANDS.FORMAT_CLEAR, 'clear'],
    ] as const

    for (const [commandId, action] of cases) {
      const { editor, calls } = createEditorTarget()
      const result = runMobileEditorCommand(editor, commandId)

      expect(result.handled).toBe(true)
      expect(calls).toEqual([`format:${action}`])
    }
  })

  it('maps upstream paragraph command ids to Muya paragraph actions', () => {
    const cases = [
      [MOBILE_COMMANDS.PARAGRAPH_PARAGRAPH, 'paragraph'],
      [MOBILE_COMMANDS.PARAGRAPH_HEADING_1, 'heading 1'],
      [MOBILE_COMMANDS.PARAGRAPH_HEADING_2, 'heading 2'],
      [MOBILE_COMMANDS.PARAGRAPH_HEADING_3, 'heading 3'],
      [MOBILE_COMMANDS.PARAGRAPH_HEADING_4, 'heading 4'],
      [MOBILE_COMMANDS.PARAGRAPH_HEADING_5, 'heading 5'],
      [MOBILE_COMMANDS.PARAGRAPH_HEADING_6, 'heading 6'],
      [MOBILE_COMMANDS.PARAGRAPH_UPGRADE_HEADING, 'upgrade heading'],
      [MOBILE_COMMANDS.PARAGRAPH_DEGRADE_HEADING, 'degrade heading'],
      [MOBILE_COMMANDS.PARAGRAPH_BULLET_LIST, 'ul-bullet'],
      [MOBILE_COMMANDS.PARAGRAPH_ORDERED_LIST, 'ol-order'],
      [MOBILE_COMMANDS.PARAGRAPH_TASK_LIST, 'ul-task'],
      [MOBILE_COMMANDS.PARAGRAPH_LOOSE_LIST_ITEM, 'loose-list-item'],
      [MOBILE_COMMANDS.PARAGRAPH_QUOTE_BLOCK, 'blockquote'],
      [MOBILE_COMMANDS.PARAGRAPH_CODE_FENCE, 'pre'],
      [MOBILE_COMMANDS.PARAGRAPH_MATH_FORMULA, 'mathblock'],
      [MOBILE_COMMANDS.PARAGRAPH_HTML_BLOCK, 'html'],
      [MOBILE_COMMANDS.PARAGRAPH_HORIZONTAL_LINE, 'hr'],
      [MOBILE_COMMANDS.PARAGRAPH_FRONT_MATTER, 'front-matter'],
    ] as const

    for (const [commandId, action] of cases) {
      const { editor, calls } = createEditorTarget()
      const result = runMobileEditorCommand(editor, commandId)

      expect(result.handled).toBe(true)
      expect(calls).toEqual([`paragraph:${action}`])
    }
  })

  it('refuses the table command instead of feeding the Android no-op Muya path', () => {
    // `updateParagraph('table')` only emits `muya-table-picker`, which has no
    // subscriber on Android; the table sheet owns insertion instead. This
    // must surface as not-handled, never as a silent success.
    const { editor, calls } = createEditorTarget()
    const result = runMobileEditorCommand(editor, MOBILE_COMMANDS.PARAGRAPH_TABLE)

    expect(result.handled).toBe(false)
    expect(calls).toEqual([])
  })

  it('reports unsupported editor adapters without crashing command dispatch', () => {
    const { editor } = createEditorTarget()
    editor.updateParagraph = () => false
    const result = runMobileEditorCommand(editor, MOBILE_COMMANDS.PARAGRAPH_CODE_FENCE)

    expect(result.handled).toBe(false)
  })

  it('marks only selection-scoped editor commands as selection-dependent', () => {
    expect(isSelectionDependentMobileCommand(MOBILE_COMMANDS.FORMAT_STRONG)).toBe(true)
    expect(isSelectionDependentMobileCommand(MOBILE_COMMANDS.FORMAT_HYPERLINK)).toBe(true)
    expect(isSelectionDependentMobileCommand(MOBILE_COMMANDS.PARAGRAPH_HEADING_1)).toBe(true)
    // Table lost its PARAGRAPH_ACTIONS entry (Android no-op path) but its
    // size sheet must still receive the toolbar's cached pre-tap selection.
    expect(isSelectionDependentMobileCommand(MOBILE_COMMANDS.PARAGRAPH_TABLE)).toBe(true)
    expect(isSelectionDependentMobileCommand(MOBILE_COMMANDS.EDIT_UNDO)).toBe(false)
    expect(isSelectionDependentMobileCommand(MOBILE_COMMANDS.EDIT_REDO)).toBe(false)
    expect(isSelectionDependentMobileCommand(MOBILE_COMMANDS.FILE_OPEN)).toBe(false)
  })
})
