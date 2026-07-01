import { describe, expect, it } from 'vitest'
import { MOBILE_COMMANDS, getMobileCommandDefinition } from './mobileCommands'
import {
  DEFAULT_MOBILE_TOOLBAR_PANEL,
  MOBILE_TOOLBAR_EDIT_COMMANDS,
  MOBILE_TOOLBAR_PANEL_COMMANDS,
  MOBILE_TOOLBAR_PANELS,
  getMobileToolbarPanel,
  getMobileToolbarPanelCommands,
} from './mobileToolbarConfig'

function getEditCommandIds() {
  return MOBILE_TOOLBAR_EDIT_COMMANDS.map(command => command.commandId)
}

function getPanelCommandIds() {
  return MOBILE_TOOLBAR_PANELS.flatMap(panel => panel.commands.map(command => command.commandId))
}

describe('mobileToolbarConfig', () => {
  it('keeps document-level actions out of the editor toolbar', () => {
    const toolbarCommandIds = [...getEditCommandIds(), ...getPanelCommandIds()]

    expect(toolbarCommandIds).not.toContain(MOBILE_COMMANDS.FILE_NEW)
    expect(toolbarCommandIds).not.toContain(MOBILE_COMMANDS.FILE_OPEN)
    expect(toolbarCommandIds).not.toContain(MOBILE_COMMANDS.FILE_SAVE)
    expect(toolbarCommandIds).not.toContain(MOBILE_COMMANDS.FILE_SAVE_AS)
  })

  it('pins only global edit history outside the selected toolbar section', () => {
    expect(getEditCommandIds()).toEqual([
      MOBILE_COMMANDS.EDIT_UNDO,
      MOBILE_COMMANDS.EDIT_REDO,
    ])
  })

  it('uses MarkText desktop sections adapted to the current mobile command set', () => {
    expect(MOBILE_TOOLBAR_PANELS.map(panel => panel.id)).toEqual(['format', 'paragraph'])
    expect(MOBILE_TOOLBAR_PANEL_COMMANDS.format.map(command => command.commandId)).toEqual([
      MOBILE_COMMANDS.FORMAT_STRONG,
      MOBILE_COMMANDS.FORMAT_EMPHASIS,
      MOBILE_COMMANDS.FORMAT_INLINE_CODE,
      MOBILE_COMMANDS.FORMAT_HYPERLINK,
      MOBILE_COMMANDS.FORMAT_IMAGE,
      MOBILE_COMMANDS.FORMAT_CLEAR,
    ])
    expect(MOBILE_TOOLBAR_PANEL_COMMANDS.paragraph.map(command => command.commandId)).toEqual([
      MOBILE_COMMANDS.PARAGRAPH_PARAGRAPH,
      MOBILE_COMMANDS.PARAGRAPH_HEADING_1,
      MOBILE_COMMANDS.PARAGRAPH_HEADING_2,
      MOBILE_COMMANDS.PARAGRAPH_HEADING_3,
      MOBILE_COMMANDS.PARAGRAPH_QUOTE_BLOCK,
      MOBILE_COMMANDS.PARAGRAPH_CODE_FENCE,
      MOBILE_COMMANDS.PARAGRAPH_BULLET_LIST,
      MOBILE_COMMANDS.PARAGRAPH_ORDERED_LIST,
      MOBILE_COMMANDS.PARAGRAPH_TASK_LIST,
    ])
  })

  it('uses only command ids that have mobile command definitions', () => {
    const toolbarCommandIds = new Set([...getEditCommandIds(), ...getPanelCommandIds()])

    for (const commandId of toolbarCommandIds) {
      expect(getMobileCommandDefinition(commandId), commandId).not.toBeNull()
    }
  })

  it('falls back to the default panel for an invalid panel id', () => {
    const panel = getMobileToolbarPanel('missing' as typeof DEFAULT_MOBILE_TOOLBAR_PANEL)

    expect(panel.id).toBe(DEFAULT_MOBILE_TOOLBAR_PANEL)
    expect(getMobileToolbarPanelCommands(panel.id)).toBe(MOBILE_TOOLBAR_PANEL_COMMANDS.format)
  })
})
