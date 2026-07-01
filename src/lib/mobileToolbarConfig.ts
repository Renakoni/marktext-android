import { MOBILE_COMMANDS, type MobileCommandId } from './mobileCommands'

export type MobileEditorToolbarPanel = 'format' | 'block' | 'list'

export interface MobileToolbarCommandButton {
  commandId: MobileCommandId
  label: string
  title: string
}

export interface MobileToolbarCommandGroup {
  id: 'history' | 'inline' | 'structure'
  title: string
  commands: readonly MobileToolbarCommandButton[]
}

export interface MobileToolbarPanelDefinition {
  id: MobileEditorToolbarPanel
  label: string
  title: string
  commands: readonly MobileToolbarCommandButton[]
}

export const DEFAULT_MOBILE_TOOLBAR_PANEL: MobileEditorToolbarPanel = 'format'

export const MOBILE_TOOLBAR_QUICK_GROUPS = [
  {
    id: 'history',
    title: 'History',
    commands: [
      { commandId: MOBILE_COMMANDS.EDIT_UNDO, label: '↶', title: 'Undo' },
      { commandId: MOBILE_COMMANDS.EDIT_REDO, label: '↷', title: 'Redo' },
    ],
  },
  {
    id: 'inline',
    title: 'Inline formatting',
    commands: [
      { commandId: MOBILE_COMMANDS.FORMAT_STRONG, label: 'B', title: 'Bold' },
      { commandId: MOBILE_COMMANDS.FORMAT_EMPHASIS, label: 'I', title: 'Italic' },
      { commandId: MOBILE_COMMANDS.FORMAT_INLINE_CODE, label: '`', title: 'Inline code' },
      { commandId: MOBILE_COMMANDS.FORMAT_HYPERLINK, label: '[]', title: 'Link' },
    ],
  },
  {
    id: 'structure',
    title: 'Paragraph structure',
    commands: [
      {
        commandId: MOBILE_COMMANDS.PARAGRAPH_BULLET_LIST,
        label: '•',
        title: 'Bullet list',
      },
      {
        commandId: MOBILE_COMMANDS.PARAGRAPH_ORDERED_LIST,
        label: '1.',
        title: 'Ordered list',
      },
      {
        commandId: MOBILE_COMMANDS.PARAGRAPH_TASK_LIST,
        label: '[ ]',
        title: 'Task list',
      },
    ],
  },
] as const satisfies readonly MobileToolbarCommandGroup[]

export const MOBILE_TOOLBAR_PANEL_COMMANDS: Record<
  MobileEditorToolbarPanel,
  readonly MobileToolbarCommandButton[]
> = {
  format: [
    { commandId: MOBILE_COMMANDS.FORMAT_STRONG, label: 'Bold', title: 'Bold' },
    { commandId: MOBILE_COMMANDS.FORMAT_EMPHASIS, label: 'Italic', title: 'Italic' },
    { commandId: MOBILE_COMMANDS.FORMAT_INLINE_CODE, label: 'Inline code', title: 'Inline code' },
    { commandId: MOBILE_COMMANDS.FORMAT_HYPERLINK, label: 'Link', title: 'Link' },
    { commandId: MOBILE_COMMANDS.FORMAT_IMAGE, label: 'Image', title: 'Image' },
    { commandId: MOBILE_COMMANDS.FORMAT_CLEAR, label: 'Clear', title: 'Clear format' },
  ],
  block: [
    { commandId: MOBILE_COMMANDS.PARAGRAPH_PARAGRAPH, label: 'Paragraph', title: 'Paragraph' },
    { commandId: MOBILE_COMMANDS.PARAGRAPH_HEADING_1, label: 'Heading 1', title: 'Heading 1' },
    { commandId: MOBILE_COMMANDS.PARAGRAPH_HEADING_2, label: 'Heading 2', title: 'Heading 2' },
    { commandId: MOBILE_COMMANDS.PARAGRAPH_HEADING_3, label: 'Heading 3', title: 'Heading 3' },
    { commandId: MOBILE_COMMANDS.PARAGRAPH_QUOTE_BLOCK, label: 'Quote', title: 'Quote block' },
    { commandId: MOBILE_COMMANDS.PARAGRAPH_CODE_FENCE, label: 'Code block', title: 'Code block' },
  ],
  list: [
    { commandId: MOBILE_COMMANDS.PARAGRAPH_BULLET_LIST, label: 'Bullet list', title: 'Bullet list' },
    { commandId: MOBILE_COMMANDS.PARAGRAPH_ORDERED_LIST, label: 'Ordered list', title: 'Ordered list' },
    { commandId: MOBILE_COMMANDS.PARAGRAPH_TASK_LIST, label: 'Task list', title: 'Task list' },
  ],
}

export const MOBILE_TOOLBAR_PANELS = [
  {
    id: 'format',
    label: 'Format',
    title: 'Inline formatting',
    commands: MOBILE_TOOLBAR_PANEL_COMMANDS.format,
  },
  {
    id: 'block',
    label: 'Block',
    title: 'Block style',
    commands: MOBILE_TOOLBAR_PANEL_COMMANDS.block,
  },
  {
    id: 'list',
    label: 'List',
    title: 'List style',
    commands: MOBILE_TOOLBAR_PANEL_COMMANDS.list,
  },
] as const satisfies readonly MobileToolbarPanelDefinition[]

export function getMobileToolbarPanel(panelId: MobileEditorToolbarPanel) {
  return (
    MOBILE_TOOLBAR_PANELS.find(panel => panel.id === panelId) ??
    MOBILE_TOOLBAR_PANELS.find(panel => panel.id === DEFAULT_MOBILE_TOOLBAR_PANEL)!
  )
}

export function getMobileToolbarPanelCommands(panelId: MobileEditorToolbarPanel) {
  return getMobileToolbarPanel(panelId).commands
}
