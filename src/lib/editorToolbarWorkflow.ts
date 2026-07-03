import type { ImportedAndroidImage } from './androidImages'
import {
  buildMarkdownImage,
  buildMarkdownLink,
  normalizeLinkField,
} from './editorMarkdownInsert'
import {
  MOBILE_COMMANDS,
  runMobileEditorCommand,
  type MobileCommandId,
  type MobileCommandResult,
  type MobileEditorCommandTarget,
} from './mobileCommands'

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
