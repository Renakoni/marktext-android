import { describe, expect, it } from 'vitest'
import {
  MOBILE_COMMANDS,
  getMobileCommandDefinition,
  type MobileCommandId,
  type MobileCommandSurface,
} from './mobileCommands'
import {
  DEFAULT_MOBILE_TOOLBAR_PANEL,
  MOBILE_TOOLBAR_EDIT_COMMANDS,
  MOBILE_TOOLBAR_PANEL_COMMANDS,
  MOBILE_TOOLBAR_PANELS,
  MOBILE_TOOLBAR_QUICK_COMMANDS,
  getMobileToolbarPanel,
  getMobileToolbarPanelCommands,
} from './mobileToolbarConfig'

function getEditCommandIds() {
  return MOBILE_TOOLBAR_EDIT_COMMANDS.map(command => command.commandId)
}

function getPanelCommandIds() {
  return MOBILE_TOOLBAR_PANELS.flatMap(panel => panel.commands.map(command => command.commandId))
}

function addSurface(
  surfacesByCommand: Map<MobileCommandId, Set<MobileCommandSurface>>,
  commandId: MobileCommandId,
  surface: MobileCommandSurface,
) {
  const surfaces = surfacesByCommand.get(commandId) ?? new Set<MobileCommandSurface>()
  surfaces.add(surface)
  surfacesByCommand.set(commandId, surfaces)
}

function getActualToolbarSurfaces() {
  const surfacesByCommand = new Map<MobileCommandId, Set<MobileCommandSurface>>()

  for (const command of MOBILE_TOOLBAR_QUICK_COMMANDS) {
    addSurface(surfacesByCommand, command.commandId, 'quick-toolbar')
  }

  for (const command of MOBILE_TOOLBAR_EDIT_COMMANDS) {
    addSurface(surfacesByCommand, command.commandId, 'toolbar-header')
  }

  for (const panel of MOBILE_TOOLBAR_PANELS) {
    for (const command of panel.commands) {
      addSurface(surfacesByCommand, command.commandId, 'toolbar-panel')
    }
  }

  return surfacesByCommand
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
    expect(getEditCommandIds()).toEqual([MOBILE_COMMANDS.EDIT_UNDO, MOBILE_COMMANDS.EDIT_REDO])
  })

  it('surfaces the most-used actions in the collapsed quick strip', () => {
    expect(MOBILE_TOOLBAR_QUICK_COMMANDS.map(command => command.commandId)).toEqual([
      MOBILE_COMMANDS.EDIT_UNDO,
      MOBILE_COMMANDS.FORMAT_STRONG,
      MOBILE_COMMANDS.FORMAT_EMPHASIS,
      MOBILE_COMMANDS.FORMAT_UNDERLINE,
      MOBILE_COMMANDS.PARAGRAPH_BULLET_LIST,
      MOBILE_COMMANDS.PARAGRAPH_ORDERED_LIST,
    ])
  })

  it('groups editing commands into format, paragraph, insert, and markdown', () => {
    expect(MOBILE_TOOLBAR_PANELS.map(panel => panel.id)).toEqual([
      'format',
      'paragraph',
      'insert',
      'markdown',
    ])
    expect(MOBILE_TOOLBAR_PANEL_COMMANDS.format.map(command => command.commandId)).toEqual([
      MOBILE_COMMANDS.FORMAT_STRONG,
      MOBILE_COMMANDS.FORMAT_EMPHASIS,
      MOBILE_COMMANDS.FORMAT_UNDERLINE,
      MOBILE_COMMANDS.FORMAT_STRIKE,
      MOBILE_COMMANDS.FORMAT_HIGHLIGHT,
      MOBILE_COMMANDS.FORMAT_CLEAR,
    ])
    expect(MOBILE_TOOLBAR_PANEL_COMMANDS.paragraph.map(command => command.commandId)).toEqual([
      MOBILE_COMMANDS.PARAGRAPH_PARAGRAPH,
      MOBILE_COMMANDS.PARAGRAPH_HEADING_1,
      MOBILE_COMMANDS.PARAGRAPH_HEADING_2,
      MOBILE_COMMANDS.PARAGRAPH_HEADING_3,
      MOBILE_COMMANDS.PARAGRAPH_HEADING_4,
      MOBILE_COMMANDS.PARAGRAPH_HEADING_5,
      MOBILE_COMMANDS.PARAGRAPH_HEADING_6,
      MOBILE_COMMANDS.PARAGRAPH_UPGRADE_HEADING,
      MOBILE_COMMANDS.PARAGRAPH_DEGRADE_HEADING,
      MOBILE_COMMANDS.PARAGRAPH_QUOTE_BLOCK,
      MOBILE_COMMANDS.PARAGRAPH_CODE_FENCE,
      MOBILE_COMMANDS.PARAGRAPH_BULLET_LIST,
      MOBILE_COMMANDS.PARAGRAPH_ORDERED_LIST,
      MOBILE_COMMANDS.PARAGRAPH_TASK_LIST,
      MOBILE_COMMANDS.PARAGRAPH_LOOSE_LIST_ITEM,
    ])
    expect(MOBILE_TOOLBAR_PANEL_COMMANDS.insert.map(command => command.commandId)).toEqual([
      MOBILE_COMMANDS.FORMAT_HYPERLINK,
      MOBILE_COMMANDS.FORMAT_IMAGE,
      MOBILE_COMMANDS.PARAGRAPH_TABLE,
      MOBILE_COMMANDS.PARAGRAPH_HORIZONTAL_LINE,
    ])
    expect(MOBILE_TOOLBAR_PANEL_COMMANDS.markdown.map(command => command.commandId)).toEqual([
      MOBILE_COMMANDS.FORMAT_INLINE_CODE,
      MOBILE_COMMANDS.FORMAT_INLINE_MATH,
      MOBILE_COMMANDS.FORMAT_SUPERSCRIPT,
      MOBILE_COMMANDS.FORMAT_SUBSCRIPT,
      MOBILE_COMMANDS.PARAGRAPH_MATH_FORMULA,
      MOBILE_COMMANDS.PARAGRAPH_HTML_BLOCK,
      MOBILE_COMMANDS.PARAGRAPH_FRONT_MATTER,
    ])
  })

  it('uses only command ids that have mobile command definitions', () => {
    const toolbarCommandIds = new Set([
      ...getEditCommandIds(),
      ...getPanelCommandIds(),
      ...MOBILE_TOOLBAR_QUICK_COMMANDS.map(command => command.commandId),
    ])

    for (const commandId of toolbarCommandIds) {
      expect(getMobileCommandDefinition(commandId), commandId).not.toBeNull()
    }
  })

  it('keeps command surface metadata aligned with actual toolbar placement', () => {
    const actualToolbarSurfaces = getActualToolbarSurfaces()

    for (const [commandId, surfaces] of actualToolbarSurfaces) {
      expect(getMobileCommandDefinition(commandId)?.surfaces, commandId).toEqual([...surfaces])
    }
  })

  it('falls back to the default panel for an invalid panel id', () => {
    const panel = getMobileToolbarPanel('missing' as typeof DEFAULT_MOBILE_TOOLBAR_PANEL)

    expect(panel.id).toBe(DEFAULT_MOBILE_TOOLBAR_PANEL)
    expect(getMobileToolbarPanelCommands(panel.id)).toBe(MOBILE_TOOLBAR_PANEL_COMMANDS.format)
  })
})
