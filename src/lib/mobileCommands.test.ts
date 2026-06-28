import { describe, expect, it } from 'vitest'
import {
  MOBILE_COMMANDS,
  getMobileCommandDefinition,
  runMobileEditorCommand,
  type MobileEditorCommandTarget,
} from './mobileCommands'

function createEditorTarget() {
  const calls: string[] = []
  const editor: MobileEditorCommandTarget = {
    undo: () => calls.push('undo'),
    redo: () => calls.push('redo'),
    format: type => calls.push(`format:${type}`),
    updateParagraph: type => calls.push(`paragraph:${type}`),
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
    const { editor, calls } = createEditorTarget()
    const result = runMobileEditorCommand(editor, MOBILE_COMMANDS.FORMAT_STRONG)

    expect(result.handled).toBe(true)
    expect(calls).toEqual(['format:strong'])
  })

  it('maps upstream paragraph command ids to Muya paragraph actions', () => {
    const { editor, calls } = createEditorTarget()
    const result = runMobileEditorCommand(editor, MOBILE_COMMANDS.PARAGRAPH_TASK_LIST)

    expect(result.handled).toBe(true)
    expect(calls).toEqual(['paragraph:ul-task'])
  })

  it('classifies frequent touch actions for a selection toolbar', () => {
    expect(getMobileCommandDefinition(MOBILE_COMMANDS.FORMAT_EMPHASIS)?.surface).toBe(
      'selection-toolbar',
    )
    expect(getMobileCommandDefinition(MOBILE_COMMANDS.PARAGRAPH_HEADING_1)?.surface).toBe(
      'bottom-sheet',
    )
  })
})
