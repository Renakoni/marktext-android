export const MOBILE_COMMANDS = Object.freeze({
  FILE_NEW: 'file.new',
  FILE_OPEN: 'file.open-file',
  FILE_SAVE: 'file.save',
  FILE_SAVE_AS: 'file.save-as',
  EDIT_UNDO: 'edit.undo',
  EDIT_REDO: 'edit.redo',
  FORMAT_STRONG: 'format.strong',
  FORMAT_EMPHASIS: 'format.emphasis',
  FORMAT_UNDERLINE: 'format.underline',
  FORMAT_SUPERSCRIPT: 'format.superscript',
  FORMAT_SUBSCRIPT: 'format.subscript',
  FORMAT_STRIKE: 'format.strike',
  FORMAT_HIGHLIGHT: 'format.highlight',
  FORMAT_INLINE_CODE: 'format.inline-code',
  FORMAT_INLINE_MATH: 'format.inline-math',
  FORMAT_HYPERLINK: 'format.hyperlink',
  FORMAT_IMAGE: 'format.image',
  FORMAT_CLEAR: 'format.clear-format',
  PARAGRAPH_PARAGRAPH: 'paragraph.paragraph',
  PARAGRAPH_HEADING_1: 'paragraph.heading-1',
  PARAGRAPH_HEADING_2: 'paragraph.heading-2',
  PARAGRAPH_HEADING_3: 'paragraph.heading-3',
  PARAGRAPH_HEADING_4: 'paragraph.heading-4',
  PARAGRAPH_HEADING_5: 'paragraph.heading-5',
  PARAGRAPH_HEADING_6: 'paragraph.heading-6',
  PARAGRAPH_UPGRADE_HEADING: 'paragraph.upgrade-heading',
  PARAGRAPH_DEGRADE_HEADING: 'paragraph.degrade-heading',
  PARAGRAPH_BULLET_LIST: 'paragraph.bullet-list',
  PARAGRAPH_ORDERED_LIST: 'paragraph.order-list',
  PARAGRAPH_TASK_LIST: 'paragraph.task-list',
  PARAGRAPH_LOOSE_LIST_ITEM: 'paragraph.loose-list-item',
  PARAGRAPH_QUOTE_BLOCK: 'paragraph.quote-block',
  PARAGRAPH_CODE_FENCE: 'paragraph.code-fence',
  PARAGRAPH_MATH_FORMULA: 'paragraph.math-formula',
  PARAGRAPH_HTML_BLOCK: 'paragraph.html-block',
  PARAGRAPH_TABLE: 'paragraph.table',
  PARAGRAPH_HORIZONTAL_LINE: 'paragraph.horizontal-line',
  PARAGRAPH_FRONT_MATTER: 'paragraph.front-matter',
} as const)

export type MobileCommandId = (typeof MOBILE_COMMANDS)[keyof typeof MOBILE_COMMANDS]
export type MobileCommandGroup = 'document' | 'edit' | 'format' | 'paragraph'
export type MobileCommandSurface = 'android-file-entry' | 'quick-toolbar' | 'toolbar-panel'

export interface MobileCommandDefinition {
  id: MobileCommandId
  group: MobileCommandGroup
  surface: MobileCommandSurface
  label: string
}

export interface MobileEditorCommandTarget {
  undo(): void
  redo(): void
  format(type: string): boolean | void
  updateParagraph(type: string): boolean | void
}

export interface MobileCommandResult {
  handled: boolean
  commandId: MobileCommandId
  reason?: 'editor-unavailable' | 'document-command'
}

const DOCUMENT_COMMANDS = new Set<MobileCommandId>([
  MOBILE_COMMANDS.FILE_NEW,
  MOBILE_COMMANDS.FILE_OPEN,
  MOBILE_COMMANDS.FILE_SAVE,
  MOBILE_COMMANDS.FILE_SAVE_AS,
])

const FORMAT_ACTIONS: Partial<Record<MobileCommandId, string>> = {
  [MOBILE_COMMANDS.FORMAT_STRONG]: 'strong',
  [MOBILE_COMMANDS.FORMAT_EMPHASIS]: 'em',
  [MOBILE_COMMANDS.FORMAT_UNDERLINE]: 'u',
  [MOBILE_COMMANDS.FORMAT_SUPERSCRIPT]: 'sup',
  [MOBILE_COMMANDS.FORMAT_SUBSCRIPT]: 'sub',
  [MOBILE_COMMANDS.FORMAT_STRIKE]: 'del',
  [MOBILE_COMMANDS.FORMAT_HIGHLIGHT]: 'mark',
  [MOBILE_COMMANDS.FORMAT_INLINE_CODE]: 'inline_code',
  [MOBILE_COMMANDS.FORMAT_INLINE_MATH]: 'inline_math',
  [MOBILE_COMMANDS.FORMAT_HYPERLINK]: 'link',
  [MOBILE_COMMANDS.FORMAT_IMAGE]: 'image',
  [MOBILE_COMMANDS.FORMAT_CLEAR]: 'clear',
}

const PARAGRAPH_ACTIONS: Partial<Record<MobileCommandId, string>> = {
  [MOBILE_COMMANDS.PARAGRAPH_PARAGRAPH]: 'paragraph',
  [MOBILE_COMMANDS.PARAGRAPH_HEADING_1]: 'heading 1',
  [MOBILE_COMMANDS.PARAGRAPH_HEADING_2]: 'heading 2',
  [MOBILE_COMMANDS.PARAGRAPH_HEADING_3]: 'heading 3',
  [MOBILE_COMMANDS.PARAGRAPH_HEADING_4]: 'heading 4',
  [MOBILE_COMMANDS.PARAGRAPH_HEADING_5]: 'heading 5',
  [MOBILE_COMMANDS.PARAGRAPH_HEADING_6]: 'heading 6',
  [MOBILE_COMMANDS.PARAGRAPH_UPGRADE_HEADING]: 'upgrade heading',
  [MOBILE_COMMANDS.PARAGRAPH_DEGRADE_HEADING]: 'degrade heading',
  [MOBILE_COMMANDS.PARAGRAPH_BULLET_LIST]: 'ul-bullet',
  [MOBILE_COMMANDS.PARAGRAPH_ORDERED_LIST]: 'ol-order',
  [MOBILE_COMMANDS.PARAGRAPH_TASK_LIST]: 'ul-task',
  [MOBILE_COMMANDS.PARAGRAPH_LOOSE_LIST_ITEM]: 'loose-list-item',
  [MOBILE_COMMANDS.PARAGRAPH_QUOTE_BLOCK]: 'blockquote',
  [MOBILE_COMMANDS.PARAGRAPH_CODE_FENCE]: 'pre',
  [MOBILE_COMMANDS.PARAGRAPH_MATH_FORMULA]: 'mathblock',
  [MOBILE_COMMANDS.PARAGRAPH_HTML_BLOCK]: 'html',
  [MOBILE_COMMANDS.PARAGRAPH_TABLE]: 'table',
  [MOBILE_COMMANDS.PARAGRAPH_HORIZONTAL_LINE]: 'hr',
  [MOBILE_COMMANDS.PARAGRAPH_FRONT_MATTER]: 'front-matter',
}

export const MOBILE_COMMAND_DEFINITIONS: readonly MobileCommandDefinition[] = [
  {
    id: MOBILE_COMMANDS.FILE_NEW,
    group: 'document',
    surface: 'android-file-entry',
    label: 'New document',
  },
  {
    id: MOBILE_COMMANDS.FILE_OPEN,
    group: 'document',
    surface: 'android-file-entry',
    label: 'Open document',
  },
  {
    id: MOBILE_COMMANDS.FILE_SAVE,
    group: 'document',
    surface: 'android-file-entry',
    label: 'Autosave current document',
  },
  {
    id: MOBILE_COMMANDS.FILE_SAVE_AS,
    group: 'document',
    surface: 'android-file-entry',
    label: 'Save a copy',
  },
  {
    id: MOBILE_COMMANDS.EDIT_UNDO,
    group: 'edit',
    surface: 'quick-toolbar',
    label: 'Undo',
  },
  {
    id: MOBILE_COMMANDS.EDIT_REDO,
    group: 'edit',
    surface: 'quick-toolbar',
    label: 'Redo',
  },
  {
    id: MOBILE_COMMANDS.FORMAT_STRONG,
    group: 'format',
    surface: 'quick-toolbar',
    label: 'Bold',
  },
  {
    id: MOBILE_COMMANDS.FORMAT_EMPHASIS,
    group: 'format',
    surface: 'quick-toolbar',
    label: 'Italic',
  },
  {
    id: MOBILE_COMMANDS.FORMAT_UNDERLINE,
    group: 'format',
    surface: 'quick-toolbar',
    label: 'Underline',
  },
  {
    id: MOBILE_COMMANDS.FORMAT_SUPERSCRIPT,
    group: 'format',
    surface: 'toolbar-panel',
    label: 'Superscript',
  },
  {
    id: MOBILE_COMMANDS.FORMAT_SUBSCRIPT,
    group: 'format',
    surface: 'toolbar-panel',
    label: 'Subscript',
  },
  {
    id: MOBILE_COMMANDS.FORMAT_STRIKE,
    group: 'format',
    surface: 'quick-toolbar',
    label: 'Strikethrough',
  },
  {
    id: MOBILE_COMMANDS.FORMAT_HIGHLIGHT,
    group: 'format',
    surface: 'quick-toolbar',
    label: 'Highlight',
  },
  {
    id: MOBILE_COMMANDS.FORMAT_INLINE_CODE,
    group: 'format',
    surface: 'quick-toolbar',
    label: 'Inline code',
  },
  {
    id: MOBILE_COMMANDS.FORMAT_INLINE_MATH,
    group: 'format',
    surface: 'toolbar-panel',
    label: 'Inline math',
  },
  {
    id: MOBILE_COMMANDS.FORMAT_HYPERLINK,
    group: 'format',
    surface: 'quick-toolbar',
    label: 'Link',
  },
  {
    id: MOBILE_COMMANDS.FORMAT_IMAGE,
    group: 'format',
    surface: 'toolbar-panel',
    label: 'Image',
  },
  {
    id: MOBILE_COMMANDS.FORMAT_CLEAR,
    group: 'format',
    surface: 'toolbar-panel',
    label: 'Clear format',
  },
  {
    id: MOBILE_COMMANDS.PARAGRAPH_PARAGRAPH,
    group: 'paragraph',
    surface: 'toolbar-panel',
    label: 'Paragraph',
  },
  {
    id: MOBILE_COMMANDS.PARAGRAPH_HEADING_1,
    group: 'paragraph',
    surface: 'toolbar-panel',
    label: 'Heading 1',
  },
  {
    id: MOBILE_COMMANDS.PARAGRAPH_HEADING_2,
    group: 'paragraph',
    surface: 'toolbar-panel',
    label: 'Heading 2',
  },
  {
    id: MOBILE_COMMANDS.PARAGRAPH_HEADING_3,
    group: 'paragraph',
    surface: 'toolbar-panel',
    label: 'Heading 3',
  },
  {
    id: MOBILE_COMMANDS.PARAGRAPH_HEADING_4,
    group: 'paragraph',
    surface: 'toolbar-panel',
    label: 'Heading 4',
  },
  {
    id: MOBILE_COMMANDS.PARAGRAPH_HEADING_5,
    group: 'paragraph',
    surface: 'toolbar-panel',
    label: 'Heading 5',
  },
  {
    id: MOBILE_COMMANDS.PARAGRAPH_HEADING_6,
    group: 'paragraph',
    surface: 'toolbar-panel',
    label: 'Heading 6',
  },
  {
    id: MOBILE_COMMANDS.PARAGRAPH_UPGRADE_HEADING,
    group: 'paragraph',
    surface: 'toolbar-panel',
    label: 'Promote heading',
  },
  {
    id: MOBILE_COMMANDS.PARAGRAPH_DEGRADE_HEADING,
    group: 'paragraph',
    surface: 'toolbar-panel',
    label: 'Demote heading',
  },
  {
    id: MOBILE_COMMANDS.PARAGRAPH_BULLET_LIST,
    group: 'paragraph',
    surface: 'quick-toolbar',
    label: 'Bullet list',
  },
  {
    id: MOBILE_COMMANDS.PARAGRAPH_ORDERED_LIST,
    group: 'paragraph',
    surface: 'quick-toolbar',
    label: 'Ordered list',
  },
  {
    id: MOBILE_COMMANDS.PARAGRAPH_TASK_LIST,
    group: 'paragraph',
    surface: 'quick-toolbar',
    label: 'Task list',
  },
  {
    id: MOBILE_COMMANDS.PARAGRAPH_LOOSE_LIST_ITEM,
    group: 'paragraph',
    surface: 'toolbar-panel',
    label: 'Loose list item',
  },
  {
    id: MOBILE_COMMANDS.PARAGRAPH_QUOTE_BLOCK,
    group: 'paragraph',
    surface: 'toolbar-panel',
    label: 'Quote block',
  },
  {
    id: MOBILE_COMMANDS.PARAGRAPH_CODE_FENCE,
    group: 'paragraph',
    surface: 'toolbar-panel',
    label: 'Code block',
  },
  {
    id: MOBILE_COMMANDS.PARAGRAPH_MATH_FORMULA,
    group: 'paragraph',
    surface: 'toolbar-panel',
    label: 'Math block',
  },
  {
    id: MOBILE_COMMANDS.PARAGRAPH_HTML_BLOCK,
    group: 'paragraph',
    surface: 'toolbar-panel',
    label: 'HTML block',
  },
  {
    id: MOBILE_COMMANDS.PARAGRAPH_TABLE,
    group: 'paragraph',
    surface: 'toolbar-panel',
    label: 'Table',
  },
  {
    id: MOBILE_COMMANDS.PARAGRAPH_HORIZONTAL_LINE,
    group: 'paragraph',
    surface: 'toolbar-panel',
    label: 'Horizontal rule',
  },
  {
    id: MOBILE_COMMANDS.PARAGRAPH_FRONT_MATTER,
    group: 'paragraph',
    surface: 'toolbar-panel',
    label: 'Front matter',
  },
]

export function getMobileCommandDefinition(commandId: MobileCommandId) {
  return MOBILE_COMMAND_DEFINITIONS.find(command => command.id === commandId) ?? null
}

export function runMobileEditorCommand(
  editor: MobileEditorCommandTarget | null,
  commandId: MobileCommandId,
): MobileCommandResult {
  if (DOCUMENT_COMMANDS.has(commandId)) {
    return { handled: false, commandId, reason: 'document-command' }
  }

  if (!editor) {
    return { handled: false, commandId, reason: 'editor-unavailable' }
  }

  if (commandId === MOBILE_COMMANDS.EDIT_UNDO) {
    editor.undo()
    return { handled: true, commandId }
  }

  if (commandId === MOBILE_COMMANDS.EDIT_REDO) {
    editor.redo()
    return { handled: true, commandId }
  }

  const formatAction = FORMAT_ACTIONS[commandId]
  if (formatAction) {
    const handled = editor.format(formatAction)
    return { handled: handled !== false, commandId }
  }

  const paragraphAction = PARAGRAPH_ACTIONS[commandId]
  if (paragraphAction) {
    const handled = editor.updateParagraph(paragraphAction)
    return { handled: handled !== false, commandId }
  }

  return { handled: false, commandId, reason: 'editor-unavailable' }
}
