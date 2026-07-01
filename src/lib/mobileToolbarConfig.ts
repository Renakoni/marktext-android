import { MOBILE_COMMANDS, type MobileCommandId } from './mobileCommands'

export type MobileEditorToolbarPanel = 'format' | 'paragraph'

export interface MobileToolbarCommandButton {
  commandId: MobileCommandId
  label: string
  title: string
}

export interface MobileToolbarPanelDefinition {
  id: MobileEditorToolbarPanel
  label: string
  title: string
  commands: readonly MobileToolbarCommandButton[]
}

export const DEFAULT_MOBILE_TOOLBAR_PANEL: MobileEditorToolbarPanel = 'format'

export const MOBILE_TOOLBAR_EDIT_COMMANDS = [
  { commandId: MOBILE_COMMANDS.EDIT_UNDO, label: '↶', title: 'Undo' },
  { commandId: MOBILE_COMMANDS.EDIT_REDO, label: '↷', title: 'Redo' },
] as const satisfies readonly MobileToolbarCommandButton[]

export const MOBILE_TOOLBAR_PANEL_COMMANDS: Record<
  MobileEditorToolbarPanel,
  readonly MobileToolbarCommandButton[]
> = {
  format: [
    { commandId: MOBILE_COMMANDS.FORMAT_STRONG, label: 'B', title: 'Bold' },
    { commandId: MOBILE_COMMANDS.FORMAT_EMPHASIS, label: 'I', title: 'Italic' },
    { commandId: MOBILE_COMMANDS.FORMAT_INLINE_CODE, label: '`', title: 'Inline code' },
    { commandId: MOBILE_COMMANDS.FORMAT_HYPERLINK, label: '[]', title: 'Link' },
    { commandId: MOBILE_COMMANDS.FORMAT_IMAGE, label: 'Image', title: 'Image' },
    { commandId: MOBILE_COMMANDS.FORMAT_CLEAR, label: 'Clear', title: 'Clear format' },
  ],
  paragraph: [
    { commandId: MOBILE_COMMANDS.PARAGRAPH_PARAGRAPH, label: '¶', title: 'Paragraph' },
    { commandId: MOBILE_COMMANDS.PARAGRAPH_HEADING_1, label: 'H1', title: 'Heading 1' },
    { commandId: MOBILE_COMMANDS.PARAGRAPH_HEADING_2, label: 'H2', title: 'Heading 2' },
    { commandId: MOBILE_COMMANDS.PARAGRAPH_HEADING_3, label: 'H3', title: 'Heading 3' },
    { commandId: MOBILE_COMMANDS.PARAGRAPH_QUOTE_BLOCK, label: '>', title: 'Quote block' },
    { commandId: MOBILE_COMMANDS.PARAGRAPH_CODE_FENCE, label: 'Code', title: 'Code block' },
    { commandId: MOBILE_COMMANDS.PARAGRAPH_BULLET_LIST, label: '•', title: 'Bullet list' },
    { commandId: MOBILE_COMMANDS.PARAGRAPH_ORDERED_LIST, label: '1.', title: 'Ordered list' },
    { commandId: MOBILE_COMMANDS.PARAGRAPH_TASK_LIST, label: '[ ]', title: 'Task list' },
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
    id: 'paragraph',
    label: 'Paragraph',
    title: 'Paragraph blocks and lists',
    commands: MOBILE_TOOLBAR_PANEL_COMMANDS.paragraph,
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
