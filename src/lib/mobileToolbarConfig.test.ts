import { describe, expect, it } from 'vitest'
import { MOBILE_COMMANDS, getMobileCommandDefinition } from './mobileCommands'
import {
  DEFAULT_MOBILE_TOOLBAR_PANEL,
  MOBILE_TOOLBAR_PANEL_COMMANDS,
  MOBILE_TOOLBAR_PANELS,
  MOBILE_TOOLBAR_QUICK_GROUPS,
  getMobileToolbarPanel,
  getMobileToolbarPanelCommands,
} from './mobileToolbarConfig'

function getQuickCommandIds() {
  return MOBILE_TOOLBAR_QUICK_GROUPS.flatMap(group =>
    group.commands.map(command => command.commandId),
  )
}

function getPanelCommandIds() {
  return MOBILE_TOOLBAR_PANELS.flatMap(panel => panel.commands.map(command => command.commandId))
}

describe('mobileToolbarConfig', () => {
  it('keeps document-level actions out of the editor toolbar', () => {
    const toolbarCommandIds = [...getQuickCommandIds(), ...getPanelCommandIds()]

    expect(toolbarCommandIds).not.toContain(MOBILE_COMMANDS.FILE_NEW)
    expect(toolbarCommandIds).not.toContain(MOBILE_COMMANDS.FILE_OPEN)
    expect(toolbarCommandIds).not.toContain(MOBILE_COMMANDS.FILE_SAVE)
    expect(toolbarCommandIds).not.toContain(MOBILE_COMMANDS.FILE_SAVE_AS)
  })

  it('exposes the frequent mobile editor commands in the quick row', () => {
    expect(getQuickCommandIds()).toEqual([
      MOBILE_COMMANDS.EDIT_UNDO,
      MOBILE_COMMANDS.EDIT_REDO,
      MOBILE_COMMANDS.FORMAT_STRONG,
      MOBILE_COMMANDS.FORMAT_EMPHASIS,
      MOBILE_COMMANDS.FORMAT_INLINE_CODE,
      MOBILE_COMMANDS.FORMAT_HYPERLINK,
      MOBILE_COMMANDS.PARAGRAPH_BULLET_LIST,
      MOBILE_COMMANDS.PARAGRAPH_ORDERED_LIST,
      MOBILE_COMMANDS.PARAGRAPH_TASK_LIST,
    ])
  })

  it('keeps expanded panels focused on inline, block, and list editing', () => {
    expect(MOBILE_TOOLBAR_PANEL_COMMANDS.format.map(command => command.commandId)).toContain(
      MOBILE_COMMANDS.FORMAT_CLEAR,
    )
    expect(MOBILE_TOOLBAR_PANEL_COMMANDS.block.map(command => command.commandId)).toEqual([
      MOBILE_COMMANDS.PARAGRAPH_PARAGRAPH,
      MOBILE_COMMANDS.PARAGRAPH_HEADING_1,
      MOBILE_COMMANDS.PARAGRAPH_HEADING_2,
      MOBILE_COMMANDS.PARAGRAPH_HEADING_3,
      MOBILE_COMMANDS.PARAGRAPH_QUOTE_BLOCK,
      MOBILE_COMMANDS.PARAGRAPH_CODE_FENCE,
    ])
    expect(MOBILE_TOOLBAR_PANEL_COMMANDS.list.map(command => command.commandId)).toEqual([
      MOBILE_COMMANDS.PARAGRAPH_BULLET_LIST,
      MOBILE_COMMANDS.PARAGRAPH_ORDERED_LIST,
      MOBILE_COMMANDS.PARAGRAPH_TASK_LIST,
    ])
  })

  it('uses only command ids that have mobile command definitions', () => {
    const toolbarCommandIds = new Set([...getQuickCommandIds(), ...getPanelCommandIds()])

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
