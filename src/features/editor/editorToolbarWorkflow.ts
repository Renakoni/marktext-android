import type { ImportedAndroidImage } from '../../lib/androidImages'
import {
  buildMarkdownImage,
  buildMarkdownLink,
  normalizeLinkField,
} from '../../lib/editorMarkdownInsert'
import {
  MOBILE_COMMANDS,
  runMobileEditorCommand,
  type MobileCommandId,
  type MobileCommandResult,
  type MobileEditorCommandTarget,
} from '../../lib/mobileCommands'

interface WorkflowLogger {
  info(message: string, data?: unknown): void
  warn(message: string, data?: unknown): void
  error(message: string, data?: unknown): void
}

type AndroidImagePickResult = ImportedAndroidImage | { canceled: true }

export type EditorToolbarCommandWorkflowResult =
  | {
      kind: 'not-ready'
      commandId: MobileCommandId
    }
  | {
      kind: 'open-link-sheet'
    }
  | {
      kind: 'open-table-sheet'
    }
  | {
      kind: 'insert-image'
    }
  | {
      kind: 'handled'
      commandId: MobileCommandId
      beforeMarkdown: string
    }
  | {
      kind: 'not-handled'
      result: MobileCommandResult
    }
  | {
      kind: 'failed'
      commandId: MobileCommandId
      error: unknown
    }

interface RunEditorToolbarCommandWorkflowOptions {
  commandId: MobileCommandId
  editorReady: boolean
  hasEditor: boolean
  commandTarget: MobileEditorCommandTarget | null
  beforeMarkdown: string
  logger?: WorkflowLogger
}

export function runEditorToolbarCommandWorkflow({
  commandId,
  editorReady,
  hasEditor,
  commandTarget,
  beforeMarkdown,
  logger,
}: RunEditorToolbarCommandWorkflowOptions): EditorToolbarCommandWorkflowResult {
  if (!editorReady || !hasEditor) {
    logger?.warn('mobile toolbar command skipped because editor is not ready', { commandId })
    return {
      kind: 'not-ready',
      commandId,
    }
  }

  if (commandId === MOBILE_COMMANDS.FORMAT_HYPERLINK) {
    return { kind: 'open-link-sheet' }
  }

  if (commandId === MOBILE_COMMANDS.FORMAT_IMAGE) {
    return { kind: 'insert-image' }
  }

  // Table cannot go through `updateParagraph('table')`: that path emits
  // Muya's `muya-table-picker` event, whose only subscriber (the desktop
  // hover chessboard) is not registered on Android, so it is a silent no-op.
  // The size sheet drives `muya.createTable` directly instead.
  if (commandId === MOBILE_COMMANDS.PARAGRAPH_TABLE) {
    return { kind: 'open-table-sheet' }
  }

  try {
    const result = runMobileEditorCommand(commandTarget, commandId)
    if (!result.handled) {
      logger?.warn('mobile toolbar command was not handled', result)
      return {
        kind: 'not-handled',
        result,
      }
    }

    logger?.info('mobile toolbar command handled', { commandId })
    return {
      kind: 'handled',
      commandId,
      beforeMarkdown,
    }
  } catch (error) {
    logger?.error('mobile toolbar command failed', { commandId, error })
    return {
      kind: 'failed',
      commandId,
      error,
    }
  }
}

export type LinkInsertSheetWorkflowResult =
  | {
      kind: 'not-ready'
    }
  | {
      kind: 'open'
      linkText: string
      linkUrl: ''
    }

export function createLinkInsertSheetWorkflow({
  editorReady,
  hasEditor,
  selectedText,
}: {
  editorReady: boolean
  hasEditor: boolean
  selectedText: string
}): LinkInsertSheetWorkflowResult {
  if (!editorReady || !hasEditor) {
    return { kind: 'not-ready' }
  }

  return {
    kind: 'open',
    linkText: normalizeLinkField(selectedText),
    linkUrl: '',
  }
}

export type InsertLinkFromSheetWorkflowResult =
  | {
      kind: 'not-ready'
    }
  | {
      kind: 'insert-failed'
    }
  | {
      kind: 'inserted'
      beforeMarkdown: string
    }

export function insertLinkFromSheetWorkflow({
  hasEditor,
  linkText,
  linkUrl,
  beforeMarkdown,
  insertMarkdown,
  logger,
}: {
  hasEditor: boolean
  linkText: string
  linkUrl: string
  beforeMarkdown: string
  insertMarkdown: (markdown: string) => boolean
  logger?: WorkflowLogger
}): InsertLinkFromSheetWorkflowResult {
  if (!hasEditor || !linkUrl.trim()) {
    return { kind: 'not-ready' }
  }

  if (!insertMarkdown(buildMarkdownLink(linkText, linkUrl))) {
    logger?.warn('mobile link insert failed because text insertion was not handled')
    return { kind: 'insert-failed' }
  }

  return {
    kind: 'inserted',
    beforeMarkdown,
  }
}

// Structure is immutable after insertion on Android (the desktop table
// row/column editing plugins are hover UIs and are not registered), so the
// size chosen in the sheet is final. Defaults match the Google Docs mobile
// insert dialog; the row minimum is the GFM header plus one body row, and
// the column maximum keeps cells usable on a phone-width measure.
export const TABLE_SHEET_DEFAULT_SIZE = { rows: 3, columns: 3 } as const

export const TABLE_SHEET_LIMITS = {
  rows: { min: 2, max: 20 },
  columns: { min: 1, max: 8 },
} as const

export function clampTableSheetDimension(kind: 'rows' | 'columns', value: number) {
  const { min, max } = TABLE_SHEET_LIMITS[kind]
  if (!Number.isFinite(value)) {
    return TABLE_SHEET_DEFAULT_SIZE[kind]
  }

  return Math.min(max, Math.max(min, Math.floor(value)))
}

export type TableInsertSheetWorkflowResult =
  | {
      kind: 'not-ready'
    }
  | {
      kind: 'open'
      rows: number
      columns: number
    }

export function createTableInsertSheetWorkflow({
  editorReady,
  hasEditor,
}: {
  editorReady: boolean
  hasEditor: boolean
}): TableInsertSheetWorkflowResult {
  if (!editorReady || !hasEditor) {
    return { kind: 'not-ready' }
  }

  return {
    kind: 'open',
    rows: TABLE_SHEET_DEFAULT_SIZE.rows,
    columns: TABLE_SHEET_DEFAULT_SIZE.columns,
  }
}

export type InsertTableFromSheetWorkflowResult =
  | {
      kind: 'not-ready'
    }
  | {
      kind: 'insert-failed'
      error?: unknown
    }
  | {
      kind: 'inserted'
      rows: number
      columns: number
      beforeMarkdown: string
    }

export function insertTableFromSheetWorkflow({
  hasEditor,
  rows,
  columns,
  beforeMarkdown,
  restoreInsertionPoint,
  createTable,
  logger,
}: {
  hasEditor: boolean
  rows: number
  columns: number
  beforeMarkdown: string
  restoreInsertionPoint: () => boolean
  createTable: (dimensions: { rows: number; columns: number }) => void
  logger?: WorkflowLogger
}): InsertTableFromSheetWorkflowResult {
  if (!hasEditor) {
    return { kind: 'not-ready' }
  }

  const safeRows = clampTableSheetDimension('rows', rows)
  const safeColumns = clampTableSheetDimension('columns', columns)

  try {
    // Best-effort: when the captured range cannot be restored (edited away,
    // detached document), Muya's cached selection still anchors the insert.
    if (!restoreInsertionPoint()) {
      logger?.warn('mobile table insert falls back to the cached editor selection')
    }

    createTable({ rows: safeRows, columns: safeColumns })
  } catch (error) {
    logger?.error('mobile table insert failed', { rows: safeRows, columns: safeColumns, error })
    return { kind: 'insert-failed', error }
  }

  return {
    kind: 'inserted',
    rows: safeRows,
    columns: safeColumns,
    beforeMarkdown,
  }
}

export type AndroidImageInsertStartResult =
  | {
      kind: 'not-ready'
    }
  | {
      kind: 'unavailable'
      status: string
    }
  | {
      kind: 'ready'
      status: 'Choose an image'
    }

export function createAndroidImageInsertStart({
  editorReady,
  hasEditor,
  importing,
  isAvailable,
  unavailableStatus,
  logger,
}: {
  editorReady: boolean
  hasEditor: boolean
  importing: boolean
  isAvailable: boolean
  unavailableStatus: string
  logger?: WorkflowLogger
}): AndroidImageInsertStartResult {
  if (!editorReady || !hasEditor || importing) {
    return { kind: 'not-ready' }
  }

  if (!isAvailable) {
    logger?.warn('mobile image insert skipped because Android image import is unavailable')
    return {
      kind: 'unavailable',
      status: unavailableStatus,
    }
  }

  return {
    kind: 'ready',
    status: 'Choose an image',
  }
}

export type InsertAndroidImageWorkflowResult =
  | {
      kind: 'canceled'
      status: 'Ready'
    }
  | {
      kind: 'insert-failed'
      status: 'Image insert failed'
    }
  | {
      kind: 'inserted'
      status: 'Image inserted'
    }
  | {
      kind: 'failed'
      status: string
      error: unknown
    }

export async function insertAndroidImageWorkflow({
  selectedText,
  ensureAndroidImageResolver,
  pickAndroidImageDocument,
  insertMarkdown,
  getAndroidImageUserMessage,
  logger,
}: {
  selectedText: string
  ensureAndroidImageResolver: () => Promise<void>
  pickAndroidImageDocument: () => Promise<AndroidImagePickResult>
  insertMarkdown: (markdown: string) => boolean
  getAndroidImageUserMessage: (error: unknown) => string
  logger?: WorkflowLogger
}): Promise<InsertAndroidImageWorkflowResult> {
  try {
    await ensureAndroidImageResolver()
    const image = await pickAndroidImageDocument()
    if (image.canceled) {
      return {
        kind: 'canceled',
        status: 'Ready',
      }
    }

    const alt = selectedText || image.displayName
    const markdownImage = buildMarkdownImage(alt, image.markdownSrc)
    if (!insertMarkdown(markdownImage)) {
      logger?.warn('mobile image insert failed because text insertion was not handled')
      return {
        kind: 'insert-failed',
        status: 'Image insert failed',
      }
    }

    logger?.info('mobile image inserted', {
      displayName: image.displayName,
      mimeType: image.mimeType,
      bytes: image.bytes,
    })

    return {
      kind: 'inserted',
      status: 'Image inserted',
    }
  } catch (error) {
    logger?.error('mobile image insert failed', error)
    return {
      kind: 'failed',
      status: getAndroidImageUserMessage(error),
      error,
    }
  }
}

export function normalizeToolbarSelectionText(value: string) {
  return normalizeLinkField(value)
}

export function scheduleEditorToolbarSync({
  beforeMarkdown,
  requestFrame,
  getMarkdown,
  normalizeMarkdown,
  onEdited,
  onUnchanged,
}: {
  beforeMarkdown: string
  requestFrame: (callback: () => void) => void
  getMarkdown: () => string | null
  normalizeMarkdown: (markdown: string) => string
  onEdited: () => void
  onUnchanged: () => void
}) {
  requestFrame(() => {
    const nextMarkdown = getMarkdown()
    if (nextMarkdown === null) {
      return
    }

    if (normalizeMarkdown(nextMarkdown) !== normalizeMarkdown(beforeMarkdown)) {
      onEdited()
      return
    }

    onUnchanged()
  })
}
