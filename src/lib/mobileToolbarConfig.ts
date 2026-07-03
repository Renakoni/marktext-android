import { MOBILE_COMMANDS, type MobileCommandId } from './mobileCommands'
import type { I18nKey } from './i18n'

export type MobileEditorToolbarPanel = 'format' | 'paragraph' | 'insert' | 'markdown'

interface MobileToolbarCommandButton {
  commandId: MobileCommandId
  label: string
  labelKey?: I18nKey
  title: string
  titleKey: I18nKey
}

interface MobileToolbarPanelDefinition {
  id: MobileEditorToolbarPanel
  label: string
  labelKey: I18nKey
  title: string
  titleKey: I18nKey
  commands: readonly MobileToolbarCommandButton[]
}

export const DEFAULT_MOBILE_TOOLBAR_PANEL: MobileEditorToolbarPanel = 'format'

export const MOBILE_TOOLBAR_EDIT_COMMANDS = [
  { commandId: MOBILE_COMMANDS.EDIT_UNDO, label: '↶', title: 'Undo', titleKey: 'toolbar.command.undo' },
  { commandId: MOBILE_COMMANDS.EDIT_REDO, label: '↷', title: 'Redo', titleKey: 'toolbar.command.redo' },
] as const satisfies readonly MobileToolbarCommandButton[]

export const MOBILE_TOOLBAR_QUICK_COMMANDS = [
  { commandId: MOBILE_COMMANDS.EDIT_UNDO, label: '↶', title: 'Undo', titleKey: 'toolbar.command.undo' },
  { commandId: MOBILE_COMMANDS.FORMAT_STRONG, label: 'B', title: 'Bold', titleKey: 'toolbar.command.bold' },
  { commandId: MOBILE_COMMANDS.FORMAT_EMPHASIS, label: 'I', title: 'Italic', titleKey: 'toolbar.command.italic' },
  {
    commandId: MOBILE_COMMANDS.FORMAT_UNDERLINE,
    label: 'U',
    title: 'Underline',
    titleKey: 'toolbar.command.underline',
  },
  {
    commandId: MOBILE_COMMANDS.PARAGRAPH_BULLET_LIST,
    label: '•',
    title: 'Bullet list',
    titleKey: 'toolbar.command.bulletList',
  },
  {
    commandId: MOBILE_COMMANDS.PARAGRAPH_ORDERED_LIST,
    label: '1.',
    title: 'Ordered list',
    titleKey: 'toolbar.command.orderedList',
  },
] as const satisfies readonly MobileToolbarCommandButton[]

const MOBILE_TOOLBAR_PANEL_COMMANDS: Record<
  MobileEditorToolbarPanel,
  readonly MobileToolbarCommandButton[]
> = {
  format: [
    { commandId: MOBILE_COMMANDS.FORMAT_STRONG, label: 'B', title: 'Bold', titleKey: 'toolbar.command.bold' },
    { commandId: MOBILE_COMMANDS.FORMAT_EMPHASIS, label: 'I', title: 'Italic', titleKey: 'toolbar.command.italic' },
    {
      commandId: MOBILE_COMMANDS.FORMAT_UNDERLINE,
      label: 'U',
      title: 'Underline',
      titleKey: 'toolbar.command.underline',
    },
    {
      commandId: MOBILE_COMMANDS.FORMAT_STRIKE,
      label: 'S',
      title: 'Strikethrough',
      titleKey: 'toolbar.command.strikethrough',
    },
    {
      commandId: MOBILE_COMMANDS.FORMAT_HIGHLIGHT,
      label: 'HL',
      labelKey: 'toolbar.label.highlight',
      title: 'Highlight',
      titleKey: 'toolbar.command.highlight',
    },
    {
      commandId: MOBILE_COMMANDS.FORMAT_CLEAR,
      label: 'Clr',
      labelKey: 'toolbar.label.clear',
      title: 'Clear format',
      titleKey: 'toolbar.command.clearFormat',
    },
  ],
  paragraph: [
    {
      commandId: MOBILE_COMMANDS.PARAGRAPH_PARAGRAPH,
      label: 'P',
      title: 'Paragraph',
      titleKey: 'toolbar.command.paragraph',
    },
    { commandId: MOBILE_COMMANDS.PARAGRAPH_HEADING_1, label: 'H1', title: 'Heading 1', titleKey: 'toolbar.command.heading1' },
    { commandId: MOBILE_COMMANDS.PARAGRAPH_HEADING_2, label: 'H2', title: 'Heading 2', titleKey: 'toolbar.command.heading2' },
    { commandId: MOBILE_COMMANDS.PARAGRAPH_HEADING_3, label: 'H3', title: 'Heading 3', titleKey: 'toolbar.command.heading3' },
    { commandId: MOBILE_COMMANDS.PARAGRAPH_HEADING_4, label: 'H4', title: 'Heading 4', titleKey: 'toolbar.command.heading4' },
    { commandId: MOBILE_COMMANDS.PARAGRAPH_HEADING_5, label: 'H5', title: 'Heading 5', titleKey: 'toolbar.command.heading5' },
    { commandId: MOBILE_COMMANDS.PARAGRAPH_HEADING_6, label: 'H6', title: 'Heading 6', titleKey: 'toolbar.command.heading6' },
    {
      commandId: MOBILE_COMMANDS.PARAGRAPH_UPGRADE_HEADING,
      label: 'Up',
      labelKey: 'toolbar.label.up',
      title: 'Promote heading',
      titleKey: 'toolbar.command.promoteHeading',
    },
    {
      commandId: MOBILE_COMMANDS.PARAGRAPH_DEGRADE_HEADING,
      label: 'Down',
      labelKey: 'toolbar.label.down',
      title: 'Demote heading',
      titleKey: 'toolbar.command.demoteHeading',
    },
    {
      commandId: MOBILE_COMMANDS.PARAGRAPH_QUOTE_BLOCK,
      label: '>',
      title: 'Quote block',
      titleKey: 'toolbar.command.quoteBlock',
    },
    {
      commandId: MOBILE_COMMANDS.PARAGRAPH_CODE_FENCE,
      label: 'Code',
      labelKey: 'toolbar.label.code',
      title: 'Code block',
      titleKey: 'toolbar.command.codeBlock',
    },
    {
      commandId: MOBILE_COMMANDS.PARAGRAPH_BULLET_LIST,
      label: '•',
      title: 'Bullet list',
      titleKey: 'toolbar.command.bulletList',
    },
    {
      commandId: MOBILE_COMMANDS.PARAGRAPH_ORDERED_LIST,
      label: '1.',
      title: 'Ordered list',
      titleKey: 'toolbar.command.orderedList',
    },
    {
      commandId: MOBILE_COMMANDS.PARAGRAPH_TASK_LIST,
      label: '[ ]',
      title: 'Task list',
      titleKey: 'toolbar.command.taskList',
    },
    {
      commandId: MOBILE_COMMANDS.PARAGRAPH_LOOSE_LIST_ITEM,
      label: 'Loose',
      labelKey: 'toolbar.label.loose',
      title: 'Loose list item',
      titleKey: 'toolbar.command.looseListItem',
    },
  ],
  insert: [
    { commandId: MOBILE_COMMANDS.FORMAT_HYPERLINK, label: '[]', title: 'Link', titleKey: 'toolbar.command.link' },
    {
      commandId: MOBILE_COMMANDS.FORMAT_IMAGE,
      label: 'Img',
      labelKey: 'toolbar.label.image',
      title: 'Image',
      titleKey: 'toolbar.command.image',
    },
    {
      commandId: MOBILE_COMMANDS.PARAGRAPH_TABLE,
      label: 'Table',
      labelKey: 'toolbar.label.table',
      title: 'Table',
      titleKey: 'toolbar.command.table',
    },
    {
      commandId: MOBILE_COMMANDS.PARAGRAPH_HORIZONTAL_LINE,
      label: 'HR',
      title: 'Horizontal rule',
      titleKey: 'toolbar.command.horizontalRule',
    },
  ],
  markdown: [
    { commandId: MOBILE_COMMANDS.FORMAT_INLINE_CODE, label: '`', title: 'Inline code', titleKey: 'toolbar.command.inlineCode' },
    { commandId: MOBILE_COMMANDS.FORMAT_INLINE_MATH, label: '$x$', title: 'Inline math', titleKey: 'toolbar.command.inlineMath' },
    {
      commandId: MOBILE_COMMANDS.FORMAT_SUPERSCRIPT,
      label: 'Sup',
      labelKey: 'toolbar.label.superscript',
      title: 'Superscript',
      titleKey: 'toolbar.command.superscript',
    },
    {
      commandId: MOBILE_COMMANDS.FORMAT_SUBSCRIPT,
      label: 'Sub',
      labelKey: 'toolbar.label.subscript',
      title: 'Subscript',
      titleKey: 'toolbar.command.subscript',
    },
    {
      commandId: MOBILE_COMMANDS.PARAGRAPH_MATH_FORMULA,
      label: 'Math',
      labelKey: 'toolbar.label.math',
      title: 'Math block',
      titleKey: 'toolbar.command.mathBlock',
    },
    { commandId: MOBILE_COMMANDS.PARAGRAPH_HTML_BLOCK, label: 'HTML', title: 'HTML block', titleKey: 'toolbar.command.htmlBlock' },
    {
      commandId: MOBILE_COMMANDS.PARAGRAPH_FRONT_MATTER,
      label: 'FM',
      title: 'Front matter',
      titleKey: 'toolbar.command.frontMatter',
    },
  ],
}

export const MOBILE_TOOLBAR_PANELS = [
  {
    id: 'format',
    label: 'Format',
    labelKey: 'toolbar.panel.format',
    title: 'Emphasis and text marks',
    titleKey: 'toolbar.panel.formatTitle',
    commands: MOBILE_TOOLBAR_PANEL_COMMANDS.format,
  },
  {
    id: 'paragraph',
    label: 'Paragraph',
    labelKey: 'toolbar.panel.paragraph',
    title: 'Headings, lists, and block structure',
    titleKey: 'toolbar.panel.paragraphTitle',
    commands: MOBILE_TOOLBAR_PANEL_COMMANDS.paragraph,
  },
  {
    id: 'insert',
    label: 'Insert',
    labelKey: 'toolbar.panel.insert',
    title: 'Links, images, tables, rules',
    titleKey: 'toolbar.panel.insertTitle',
    commands: MOBILE_TOOLBAR_PANEL_COMMANDS.insert,
  },
  {
    id: 'markdown',
    label: 'Markdown',
    labelKey: 'toolbar.panel.markdown',
    title: 'Code, math, and raw syntax',
    titleKey: 'toolbar.panel.markdownTitle',
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
