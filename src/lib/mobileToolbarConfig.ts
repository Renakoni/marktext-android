import { MOBILE_COMMANDS, type MobileCommandId } from './mobileCommands'
import type { ToolbarIconName } from './toolbarIcons'
import type { I18nKey } from './i18n'

export type MobileEditorToolbarPanel = 'format' | 'paragraph' | 'insert' | 'markdown'

/**
 * A command's visual is either an icon from the toolbar icon set
 * (`iconName`) or its typographic label — familiar symbols like B, H1,
 * ¶, or x² that communicate faster than any icon. `label` doubles as the
 * fallback and stays required so a command can never render empty;
 * `titleKey` is the accessible name in both cases.
 */
export interface MobileToolbarCommandButton {
  commandId: MobileCommandId
  label: string
  iconName?: ToolbarIconName
  title: string
  titleKey: I18nKey
}

export interface MobileToolbarPanelDefinition {
  id: MobileEditorToolbarPanel
  label: string
  labelKey: I18nKey
  title: string
  titleKey: I18nKey
  commands: readonly MobileToolbarCommandButton[]
}

export const DEFAULT_MOBILE_TOOLBAR_PANEL: MobileEditorToolbarPanel = 'format'

export const MOBILE_TOOLBAR_EDIT_COMMANDS = [
  { commandId: MOBILE_COMMANDS.EDIT_UNDO, label: 'Undo', iconName: 'undo', title: 'Undo', titleKey: 'toolbar.command.undo' },
  { commandId: MOBILE_COMMANDS.EDIT_REDO, label: 'Redo', iconName: 'redo', title: 'Redo', titleKey: 'toolbar.command.redo' },
] as const satisfies readonly MobileToolbarCommandButton[]

export const MOBILE_TOOLBAR_QUICK_COMMANDS = [
  { commandId: MOBILE_COMMANDS.EDIT_UNDO, label: 'Undo', iconName: 'undo', title: 'Undo', titleKey: 'toolbar.command.undo' },
  { commandId: MOBILE_COMMANDS.FORMAT_STRONG, label: 'B', title: 'Bold', titleKey: 'toolbar.command.bold' },
  { commandId: MOBILE_COMMANDS.FORMAT_EMPHASIS, label: 'I', iconName: 'italic', title: 'Italic', titleKey: 'toolbar.command.italic' },
  {
    commandId: MOBILE_COMMANDS.FORMAT_UNDERLINE,
    label: 'U',
    title: 'Underline',
    titleKey: 'toolbar.command.underline',
  },
  {
    commandId: MOBILE_COMMANDS.PARAGRAPH_BULLET_LIST,
    label: 'List',
    iconName: 'bullet-list',
    title: 'Bullet list',
    titleKey: 'toolbar.command.bulletList',
  },
  {
    commandId: MOBILE_COMMANDS.PARAGRAPH_ORDERED_LIST,
    label: '1.',
    iconName: 'ordered-list',
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
    { commandId: MOBILE_COMMANDS.FORMAT_EMPHASIS, label: 'I', iconName: 'italic', title: 'Italic', titleKey: 'toolbar.command.italic' },
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
      label: 'Highlight',
      iconName: 'highlight',
      title: 'Highlight',
      titleKey: 'toolbar.command.highlight',
    },
    {
      commandId: MOBILE_COMMANDS.FORMAT_CLEAR,
      label: 'Clear',
      iconName: 'clear-format',
      title: 'Clear format',
      titleKey: 'toolbar.command.clearFormat',
    },
  ],
  paragraph: [
    {
      commandId: MOBILE_COMMANDS.PARAGRAPH_PARAGRAPH,
      label: '¶',
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
      label: 'H↑',
      title: 'Promote heading',
      titleKey: 'toolbar.command.promoteHeading',
    },
    {
      commandId: MOBILE_COMMANDS.PARAGRAPH_DEGRADE_HEADING,
      label: 'H↓',
      title: 'Demote heading',
      titleKey: 'toolbar.command.demoteHeading',
    },
    {
      commandId: MOBILE_COMMANDS.PARAGRAPH_QUOTE_BLOCK,
      label: 'Quote',
      iconName: 'quote',
      title: 'Quote block',
      titleKey: 'toolbar.command.quoteBlock',
    },
    {
      commandId: MOBILE_COMMANDS.PARAGRAPH_CODE_FENCE,
      label: 'Code',
      iconName: 'code-block',
      title: 'Code block',
      titleKey: 'toolbar.command.codeBlock',
    },
    {
      commandId: MOBILE_COMMANDS.PARAGRAPH_BULLET_LIST,
      label: 'List',
      iconName: 'bullet-list',
      title: 'Bullet list',
      titleKey: 'toolbar.command.bulletList',
    },
    {
      commandId: MOBILE_COMMANDS.PARAGRAPH_ORDERED_LIST,
      label: '1.',
      iconName: 'ordered-list',
      title: 'Ordered list',
      titleKey: 'toolbar.command.orderedList',
    },
    {
      commandId: MOBILE_COMMANDS.PARAGRAPH_TASK_LIST,
      label: 'Tasks',
      iconName: 'task-list',
      title: 'Task list',
      titleKey: 'toolbar.command.taskList',
    },
    {
      commandId: MOBILE_COMMANDS.PARAGRAPH_LOOSE_LIST_ITEM,
      label: 'Loose',
      iconName: 'line-spacing',
      title: 'Loose list item',
      titleKey: 'toolbar.command.looseListItem',
    },
  ],
  insert: [
    {
      commandId: MOBILE_COMMANDS.FORMAT_HYPERLINK,
      label: 'Link',
      iconName: 'link',
      title: 'Link',
      titleKey: 'toolbar.command.link',
    },
    {
      commandId: MOBILE_COMMANDS.FORMAT_IMAGE,
      label: 'Image',
      iconName: 'image',
      title: 'Image',
      titleKey: 'toolbar.command.image',
    },
    {
      commandId: MOBILE_COMMANDS.PARAGRAPH_TABLE,
      label: 'Table',
      iconName: 'table',
      title: 'Table',
      titleKey: 'toolbar.command.table',
    },
    {
      commandId: MOBILE_COMMANDS.PARAGRAPH_HORIZONTAL_LINE,
      label: 'Rule',
      iconName: 'horizontal-rule',
      title: 'Horizontal rule',
      titleKey: 'toolbar.command.horizontalRule',
    },
  ],
  markdown: [
    {
      commandId: MOBILE_COMMANDS.FORMAT_INLINE_CODE,
      label: 'Code',
      iconName: 'inline-code',
      title: 'Inline code',
      titleKey: 'toolbar.command.inlineCode',
    },
    { commandId: MOBILE_COMMANDS.FORMAT_INLINE_MATH, label: '√x', iconName: 'inline-math', title: 'Inline math', titleKey: 'toolbar.command.inlineMath' },
    {
      commandId: MOBILE_COMMANDS.FORMAT_SUPERSCRIPT,
      label: 'x²',
      title: 'Superscript',
      titleKey: 'toolbar.command.superscript',
    },
    {
      commandId: MOBILE_COMMANDS.FORMAT_SUBSCRIPT,
      label: 'x₂',
      title: 'Subscript',
      titleKey: 'toolbar.command.subscript',
    },
    {
      commandId: MOBILE_COMMANDS.PARAGRAPH_MATH_FORMULA,
      label: '∑',
      iconName: 'math-block',
      title: 'Math block',
      titleKey: 'toolbar.command.mathBlock',
    },
    {
      commandId: MOBILE_COMMANDS.PARAGRAPH_HTML_BLOCK,
      label: 'HTML',
      iconName: 'html-block',
      title: 'HTML block',
      titleKey: 'toolbar.command.htmlBlock',
    },
    {
      commandId: MOBILE_COMMANDS.PARAGRAPH_FRONT_MATTER,
      label: 'Meta',
      iconName: 'front-matter',
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

const MOBILE_TOOLBAR_COMMANDS_BY_ID = new Map<MobileCommandId, MobileToolbarCommandButton>()

for (const command of [
  ...MOBILE_TOOLBAR_EDIT_COMMANDS,
  ...MOBILE_TOOLBAR_QUICK_COMMANDS,
  ...MOBILE_TOOLBAR_PANELS.flatMap(panel => panel.commands),
]) {
  MOBILE_TOOLBAR_COMMANDS_BY_ID.set(command.commandId, command)
}

export function getMobileToolbarPanel(panelId: MobileEditorToolbarPanel) {
  return (
    MOBILE_TOOLBAR_PANELS.find(panel => panel.id === panelId) ??
    MOBILE_TOOLBAR_PANELS.find(panel => panel.id === DEFAULT_MOBILE_TOOLBAR_PANEL)!
  )
}

export function getMobileToolbarPanelCommands(panelId: MobileEditorToolbarPanel) {
  return getMobileToolbarPanel(panelId).commands
}

export function getMobileToolbarCommandButton(commandId: MobileCommandId) {
  return MOBILE_TOOLBAR_COMMANDS_BY_ID.get(commandId) ?? null
}
