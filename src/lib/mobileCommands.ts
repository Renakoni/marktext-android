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
