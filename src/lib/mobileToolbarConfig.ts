import { MOBILE_COMMANDS, type MobileCommandId } from './mobileCommands'

export type MobileEditorToolbarPanel = 'format' | 'paragraph' | 'insert' | 'markdown'

interface MobileToolbarCommandButton {
  commandId: MobileCommandId
  label: string
  title: string
}

interface MobileToolbarPanelDefinition {
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

export const MOBILE_TOOLBAR_QUICK_COMMANDS = [
  { commandId: MOBILE_COMMANDS.EDIT_UNDO, label: '↶', title: 'Undo' },
  { commandId: MOBILE_COMMANDS.FORMAT_STRONG, label: 'B', title: 'Bold' },
  { commandId: MOBILE_COMMANDS.FORMAT_EMPHASIS, label: 'I', title: 'Italic' },
  { commandId: MOBILE_COMMANDS.FORMAT_UNDERLINE, label: 'U', title: 'Underline' },
  { commandId: MOBILE_COMMANDS.PARAGRAPH_BULLET_LIST, label: '•', title: 'Bullet list' },
  { commandId: MOBILE_COMMANDS.PARAGRAPH_ORDERED_LIST, label: '1.', title: 'Ordered list' },
] as const satisfies readonly MobileToolbarCommandButton[]

const MOBILE_TOOLBAR_PANEL_COMMANDS: Record<
  MobileEditorToolbarPanel,
  readonly MobileToolbarCommandButton[]
> = {
  format: [
    { commandId: MOBILE_COMMANDS.FORMAT_STRONG, label: 'B', title: 'Bold' },
    { commandId: MOBILE_COMMANDS.FORMAT_EMPHASIS, label: 'I', title: 'Italic' },
    { commandId: MOBILE_COMMANDS.FORMAT_UNDERLINE, label: 'U', title: 'Underline' },
    { commandId: MOBILE_COMMANDS.FORMAT_STRIKE, label: 'S', title: 'Strikethrough' },
    { commandId: MOBILE_COMMANDS.FORMAT_HIGHLIGHT, label: 'HL', title: 'Highlight' },
    { commandId: MOBILE_COMMANDS.FORMAT_CLEAR, label: 'Clr', title: 'Clear format' },
  ],
  paragraph: [
    { commandId: MOBILE_COMMANDS.PARAGRAPH_PARAGRAPH, label: 'P', title: 'Paragraph' },
    { commandId: MOBILE_COMMANDS.PARAGRAPH_HEADING_1, label: 'H1', title: 'Heading 1' },
    { commandId: MOBILE_COMMANDS.PARAGRAPH_HEADING_2, label: 'H2', title: 'Heading 2' },
    { commandId: MOBILE_COMMANDS.PARAGRAPH_HEADING_3, label: 'H3', title: 'Heading 3' },
    { commandId: MOBILE_COMMANDS.PARAGRAPH_HEADING_4, label: 'H4', title: 'Heading 4' },
    { commandId: MOBILE_COMMANDS.PARAGRAPH_HEADING_5, label: 'H5', title: 'Heading 5' },
    { commandId: MOBILE_COMMANDS.PARAGRAPH_HEADING_6, label: 'H6', title: 'Heading 6' },
    {
      commandId: MOBILE_COMMANDS.PARAGRAPH_UPGRADE_HEADING,
      label: 'Up',
      title: 'Promote heading',
    },
    {
      commandId: MOBILE_COMMANDS.PARAGRAPH_DEGRADE_HEADING,
      label: 'Down',
      title: 'Demote heading',
    },
    { commandId: MOBILE_COMMANDS.PARAGRAPH_QUOTE_BLOCK, label: '>', title: 'Quote block' },
    { commandId: MOBILE_COMMANDS.PARAGRAPH_CODE_FENCE, label: 'Code', title: 'Code block' },
    { commandId: MOBILE_COMMANDS.PARAGRAPH_BULLET_LIST, label: '•', title: 'Bullet list' },
    { commandId: MOBILE_COMMANDS.PARAGRAPH_ORDERED_LIST, label: '1.', title: 'Ordered list' },
    { commandId: MOBILE_COMMANDS.PARAGRAPH_TASK_LIST, label: '[ ]', title: 'Task list' },
    {
      commandId: MOBILE_COMMANDS.PARAGRAPH_LOOSE_LIST_ITEM,
      label: 'Loose',
      title: 'Loose list item',
    },
  ],
  insert: [
    { commandId: MOBILE_COMMANDS.FORMAT_HYPERLINK, label: '[]', title: 'Link' },
    { commandId: MOBILE_COMMANDS.FORMAT_IMAGE, label: 'Img', title: 'Image' },
    { commandId: MOBILE_COMMANDS.PARAGRAPH_TABLE, label: 'Table', title: 'Table' },
    { commandId: MOBILE_COMMANDS.PARAGRAPH_HORIZONTAL_LINE, label: 'HR', title: 'Horizontal rule' },
  ],
  markdown: [
    { commandId: MOBILE_COMMANDS.FORMAT_INLINE_CODE, label: '`', title: 'Inline code' },
    { commandId: MOBILE_COMMANDS.FORMAT_INLINE_MATH, label: '$x$', title: 'Inline math' },
    { commandId: MOBILE_COMMANDS.FORMAT_SUPERSCRIPT, label: 'Sup', title: 'Superscript' },
    { commandId: MOBILE_COMMANDS.FORMAT_SUBSCRIPT, label: 'Sub', title: 'Subscript' },
    { commandId: MOBILE_COMMANDS.PARAGRAPH_MATH_FORMULA, label: 'Math', title: 'Math block' },
    { commandId: MOBILE_COMMANDS.PARAGRAPH_HTML_BLOCK, label: 'HTML', title: 'HTML block' },
    { commandId: MOBILE_COMMANDS.PARAGRAPH_FRONT_MATTER, label: 'FM', title: 'Front matter' },
  ],
}

export const MOBILE_TOOLBAR_PANELS = [
  {
    id: 'format',
    label: 'Format',
    title: 'Emphasis and text marks',
    commands: MOBILE_TOOLBAR_PANEL_COMMANDS.format,
  },
  {
    id: 'paragraph',
    label: 'Paragraph',
    title: 'Headings, lists, and block structure',
    commands: MOBILE_TOOLBAR_PANEL_COMMANDS.paragraph,
  },
  {
    id: 'insert',
    label: 'Insert',
    title: 'Links, images, tables, rules',
    commands: MOBILE_TOOLBAR_PANEL_COMMANDS.insert,
  },
  {
    id: 'markdown',
    label: 'Markdown',
    title: 'Code, math, and raw syntax',
    commands: MOBILE_TOOLBAR_PANEL_COMMANDS.markdown,
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
