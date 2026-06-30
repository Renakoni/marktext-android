import type { MobileEditorCommandTarget } from './mobileCommands'

type MaybeHandled = boolean | void

interface LegacyContentBlock {
  text?: string
  blockName?: string
  parent?: {
    blockName?: string
    meta?: {
      level?: number
    }
  } | null
  format?: (type: string) => void
  convertToParagraph?: (force?: boolean) => void
  _convertToAtxHeading?: (marker: string) => void
  _convertToBlockQuote?: () => void
  _convertToIndentedCodeBlock?: () => void
  _convertToList?: () => void
  getCursor?: () => unknown
  setCursor?: (begin: number, end: number, needUpdate?: boolean) => void
}

interface LegacySelection {
  anchorBlock?: LegacyContentBlock | null
  focusBlock?: LegacyContentBlock | null
  isSelectionInSameBlock?: boolean
}

interface MuyaCommandRuntime {
  undo?: () => void
  redo?: () => void
  format?: (type: string) => MaybeHandled
  updateParagraph?: (type: string) => MaybeHandled
  editor?: {
    activeContentBlock?: LegacyContentBlock | null
    selection?: {
      anchorBlock?: LegacyContentBlock | null
      focusBlock?: LegacyContentBlock | null
      getSelection?: () => LegacySelection | null
    }
  }
}

const HEADING_MATCHER = /^ {0,3}#{1,6}(?:\s+|$)/
const QUOTE_MATCHER = /^ {0,3}> ?/
const LIST_MATCHER = /^ {0,3}(?:[-+*]|\d{1,9}[.)]) {1,4}/
const TASK_MATCHER = /^\[[ xX]\] {1,4}/

function getActiveContentBlock(editor: MuyaCommandRuntime) {
  const selection = editor.editor?.selection?.getSelection?.()
  if (selection?.anchorBlock && selection.isSelectionInSameBlock !== false) {
    return selection.anchorBlock
  }

  return editor.editor?.selection?.anchorBlock ?? editor.editor?.activeContentBlock ?? null
}

function stripBlockSyntax(text: string) {
  return text
    .replace(HEADING_MATCHER, '')
    .replace(QUOTE_MATCHER, '')
    .replace(LIST_MATCHER, '')
    .replace(TASK_MATCHER, '')
}

function ensureCursorInBlock(block: LegacyContentBlock) {
  if (typeof block.getCursor !== 'function' || typeof block.setCursor !== 'function') {
    return
  }

  if (block.getCursor()) {
    return
  }

  const offset = block.text?.length ?? 0
  block.setCursor(offset, offset, true)
}

function runLegacyFormat(editor: MuyaCommandRuntime, type: string) {
  const block = getActiveContentBlock(editor)
  if (typeof block?.format !== 'function') {
    return false
  }

  block.format(type)
  return true
}

function updateLegacyAtxHeading(block: LegacyContentBlock, level: number) {
  if (typeof block._convertToAtxHeading !== 'function') {
    return false
  }

  ensureCursorInBlock(block)
  const marker = '#'.repeat(level)
  block.text = `${marker} ${stripBlockSyntax(block.text ?? '')}`.trimEnd()
  block._convertToAtxHeading(marker)
  return true
}

function updateLegacyList(block: LegacyContentBlock, marker: string) {
  if (typeof block._convertToList !== 'function') {
    return false
  }

  ensureCursorInBlock(block)
  block.text = `${marker} ${stripBlockSyntax(block.text ?? '')}`.trimEnd()
  block._convertToList()
  return true
}

function runLegacyParagraph(editor: MuyaCommandRuntime, type: string) {
  const block = getActiveContentBlock(editor)
  if (!block) {
    return false
  }

  if (type === 'paragraph') {
    if (typeof block.convertToParagraph !== 'function') {
      return false
    }

    ensureCursorInBlock(block)
    block.convertToParagraph(true)
    return true
  }

  if (type === 'heading 1') {
    return updateLegacyAtxHeading(block, 1)
  }

  if (type === 'heading 2') {
    return updateLegacyAtxHeading(block, 2)
  }

  if (type === 'heading 3') {
    return updateLegacyAtxHeading(block, 3)
  }

  if (type === 'ul-bullet') {
    return updateLegacyList(block, '-')
  }

  if (type === 'ol-order') {
    return updateLegacyList(block, '1.')
  }

  if (type === 'ul-task') {
    return updateLegacyList(block, '- [ ]')
  }

  if (type === 'blockquote') {
    if (typeof block._convertToBlockQuote !== 'function') {
      return false
    }

    ensureCursorInBlock(block)
    block.text = `> ${stripBlockSyntax(block.text ?? '')}`.trimEnd()
    block._convertToBlockQuote()
    return true
  }

  if (type === 'pre') {
    if (typeof block._convertToIndentedCodeBlock !== 'function') {
      return false
    }

    ensureCursorInBlock(block)
    block.text = `    ${stripBlockSyntax(block.text ?? '')}`.trimEnd()
    block._convertToIndentedCodeBlock()
    return true
  }

  return false
}

export function createMuyaMobileEditorCommandTarget(
  editor: unknown,
): MobileEditorCommandTarget {
  const commandEditor = editor as MuyaCommandRuntime

  return {
    undo: () => commandEditor.undo?.(),
    redo: () => commandEditor.redo?.(),
    format: type => {
      if (typeof commandEditor.format === 'function') {
        return commandEditor.format(type)
      }

      return runLegacyFormat(commandEditor, type)
    },
    updateParagraph: type => {
      if (typeof commandEditor.updateParagraph === 'function') {
        return commandEditor.updateParagraph(type)
      }

      return runLegacyParagraph(commandEditor, type)
    },
  }
}
