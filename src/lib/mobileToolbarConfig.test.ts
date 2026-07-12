import { describe, expect, it } from 'vitest'
import { MOBILE_COMMANDS, type MobileCommandId } from './mobileCommands'
import {
  DEFAULT_MOBILE_TOOLBAR_PANEL,
  MOBILE_TOOLBAR_EDIT_COMMANDS,
  MOBILE_TOOLBAR_PANELS,
  MOBILE_TOOLBAR_QUICK_COMMANDS,
  getMobileToolbarCommandButton,
  getMobileToolbarPanel,
  getMobileToolbarPanelCommands,
  type MobileToolbarCommandButton,
} from './mobileToolbarConfig'
import { TOOLBAR_ICON_PATHS } from './toolbarIcons'

function getEditCommandIds() {
  return MOBILE_TOOLBAR_EDIT_COMMANDS.map(command => command.commandId)
}

function getPanelCommandIds() {
  return MOBILE_TOOLBAR_PANELS.flatMap(panel => panel.commands.map(command => command.commandId))
}

function getPanelCommandIdsByPanel(panelId: typeof DEFAULT_MOBILE_TOOLBAR_PANEL) {
  return getMobileToolbarPanel(panelId).commands.map(command => command.commandId)
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
    expect(getPanelCommandIdsByPanel('format')).toEqual([
      MOBILE_COMMANDS.FORMAT_STRONG,
      MOBILE_COMMANDS.FORMAT_EMPHASIS,
      MOBILE_COMMANDS.FORMAT_UNDERLINE,
      MOBILE_COMMANDS.FORMAT_STRIKE,
      MOBILE_COMMANDS.FORMAT_HIGHLIGHT,
      MOBILE_COMMANDS.FORMAT_CLEAR,
    ])
    expect(getPanelCommandIdsByPanel('paragraph')).toEqual([
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
    expect(getPanelCommandIdsByPanel('insert')).toEqual([
      MOBILE_COMMANDS.FORMAT_HYPERLINK,
      MOBILE_COMMANDS.FORMAT_IMAGE,
      MOBILE_COMMANDS.PARAGRAPH_TABLE,
      MOBILE_COMMANDS.PARAGRAPH_HORIZONTAL_LINE,
    ])
    expect(getPanelCommandIdsByPanel('markdown')).toEqual([
      MOBILE_COMMANDS.FORMAT_INLINE_CODE,
      MOBILE_COMMANDS.FORMAT_INLINE_MATH,
      MOBILE_COMMANDS.FORMAT_SUPERSCRIPT,
      MOBILE_COMMANDS.FORMAT_SUBSCRIPT,
      MOBILE_COMMANDS.PARAGRAPH_MATH_FORMULA,
      MOBILE_COMMANDS.PARAGRAPH_HTML_BLOCK,
      MOBILE_COMMANDS.PARAGRAPH_FRONT_MATTER,
    ])
  })

  it('uses only known mobile command ids', () => {
    const knownCommandIds = new Set(Object.values(MOBILE_COMMANDS))
    const toolbarCommandIds = new Set([
      ...getEditCommandIds(),
      ...getPanelCommandIds(),
      ...MOBILE_TOOLBAR_QUICK_COMMANDS.map(command => command.commandId),
    ])

    for (const commandId of toolbarCommandIds) {
      expect(knownCommandIds.has(commandId), commandId).toBe(true)
    }
  })

  it('looks up command button definitions by command id', () => {
    expect(getMobileToolbarCommandButton(MOBILE_COMMANDS.FORMAT_STRONG)).toMatchObject({
      commandId: MOBILE_COMMANDS.FORMAT_STRONG,
      label: 'B',
      titleKey: 'toolbar.command.bold',
    })
    expect(getMobileToolbarCommandButton('missing.command' as MobileCommandId)).toBeNull()
  })

  it('falls back to the default panel for an invalid panel id', () => {
    const panel = getMobileToolbarPanel('missing' as typeof DEFAULT_MOBILE_TOOLBAR_PANEL)

    expect(panel.id).toBe(DEFAULT_MOBILE_TOOLBAR_PANEL)
    expect(getMobileToolbarPanelCommands(panel.id)).toBe(getMobileToolbarPanel('format').commands)
  })
})

const ALL_COMMANDS: MobileToolbarCommandButton[] = [
  ...MOBILE_TOOLBAR_EDIT_COMMANDS,
  ...MOBILE_TOOLBAR_QUICK_COMMANDS,
  ...MOBILE_TOOLBAR_PANELS.flatMap(panel => [...panel.commands]),
]

// The visual-language contract: every command renders as an icon from the
// toolbar icon set or as a genuine typographic symbol. Engineering
// abbreviations ("HR", "FM", "Img", "Sup", "Clr") are not a visual.
const TYPOGRAPHIC_LABELS = new Set([
  'B',
  'U',
  'S',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'H↑',
  'H↓',
  '¶',
  'x²',
  'x₂',
])

describe('mobile toolbar visual contract', () => {
  it('renders every command as an icon or an approved typographic symbol', () => {
    for (const command of ALL_COMMANDS) {
      const isIcon = Boolean(command.iconName && command.iconName in TOOLBAR_ICON_PATHS)
      const isTypographic = TYPOGRAPHIC_LABELS.has(command.label)

      expect(
        isIcon || isTypographic,
        `${command.commandId} must use an icon or an approved symbol (got "${
          command.iconName ?? command.label
        }")`,
      ).toBe(true)
    }
  })

  it('gives every command an accessible title and a non-empty text fallback', () => {
    for (const command of ALL_COMMANDS) {
      expect(command.titleKey, command.commandId).toMatch(/^toolbar\.command\./)
      expect(command.title.length, command.commandId).toBeGreaterThan(1)
      expect(command.label.trim().length, command.commandId).toBeGreaterThan(0)
    }
  })

  it('draws every icon with real stroke paths on the 24px grid', () => {
    for (const [name, paths] of Object.entries(TOOLBAR_ICON_PATHS)) {
      expect(paths.length, name).toBeGreaterThan(0)
      for (const path of paths) {
        expect(path, name).toMatch(/^M[\d .]/)
      }
    }
  })
})
