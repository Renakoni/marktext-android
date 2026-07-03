import { describe, expect, it, vi } from 'vitest'
import type { ImportedAndroidImage } from '../../lib/androidImages'
import { MOBILE_COMMANDS, type MobileEditorCommandTarget } from '../../lib/mobileCommands'
import {
  createAndroidImageInsertStart,
  createLinkInsertSheetWorkflow,
  insertAndroidImageWorkflow,
  insertLinkFromSheetWorkflow,
  normalizeToolbarSelectionText,
  runEditorToolbarCommandWorkflow,
  scheduleEditorToolbarSync,
} from './editorToolbarWorkflow'

function createCommandTarget(): MobileEditorCommandTarget {
  return {
    undo: vi.fn(),
    redo: vi.fn(),
    format: vi.fn().mockReturnValue(true),
    updateParagraph: vi.fn().mockReturnValue(true),
  }
}

const pickedImage: ImportedAndroidImage = {
  canceled: false,
  sourceUri: 'content://images/photo.png',
  displayName: 'Photo.png',
  mimeType: 'image/png',
  markdownSrc: 'marktext-image://local/photo.png',
  fileUri: 'file:///images/photo.png',
  bytes: 42,
}

describe('editorToolbarWorkflow', () => {
  it('routes toolbar commands to link, image, or Muya command execution', () => {
    const target = createCommandTarget()

    expect(runEditorToolbarCommandWorkflow({
      commandId: MOBILE_COMMANDS.FORMAT_HYPERLINK,
      editorReady: true,
      hasEditor: true,
      commandTarget: target,
      beforeMarkdown: 'before',
    })).toEqual({ kind: 'open-link-sheet' })

    expect(runEditorToolbarCommandWorkflow({
      commandId: MOBILE_COMMANDS.FORMAT_IMAGE,
      editorReady: true,
      hasEditor: true,
      commandTarget: target,
      beforeMarkdown: 'before',
    })).toEqual({ kind: 'insert-image' })

    expect(runEditorToolbarCommandWorkflow({
      commandId: MOBILE_COMMANDS.FORMAT_STRONG,
      editorReady: true,
      hasEditor: true,
      commandTarget: target,
      beforeMarkdown: 'before',
    })).toEqual({
      kind: 'handled',
      commandId: MOBILE_COMMANDS.FORMAT_STRONG,
      beforeMarkdown: 'before',
    })
    expect(target.format).toHaveBeenCalledWith('strong')
  })

  it('keeps toolbar commands inert when the editor is unavailable or command execution fails', () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }
    const throwingTarget = {
      ...createCommandTarget(),
      format: vi.fn(() => {
        throw new Error('format failed')
      }),
    }

    expect(runEditorToolbarCommandWorkflow({
      commandId: MOBILE_COMMANDS.FORMAT_STRONG,
      editorReady: false,
      hasEditor: false,
      commandTarget: null,
      beforeMarkdown: 'before',
      logger,
    })).toMatchObject({
      kind: 'not-ready',
      commandId: MOBILE_COMMANDS.FORMAT_STRONG,
    })

    expect(runEditorToolbarCommandWorkflow({
      commandId: MOBILE_COMMANDS.FORMAT_STRONG,
      editorReady: true,
      hasEditor: true,
      commandTarget: throwingTarget,
      beforeMarkdown: 'before',
      logger,
    })).toMatchObject({
      kind: 'failed',
      commandId: MOBILE_COMMANDS.FORMAT_STRONG,
    })
  })

  it('prepares and inserts Markdown links from the sheet state', () => {
    expect(createLinkInsertSheetWorkflow({
      editorReady: true,
      hasEditor: true,
      selectedText: '  selected   text  ',
    })).toEqual({
      kind: 'open',
      linkText: 'selected text',
      linkUrl: '',
    })

    const insertMarkdown = vi.fn().mockReturnValue(true)
    const result = insertLinkFromSheetWorkflow({
      hasEditor: true,
      linkText: 'selected text',
      linkUrl: 'https://example.com/a)b',
      beforeMarkdown: 'before',
      insertMarkdown,
    })

    expect(result).toEqual({
      kind: 'inserted',
      beforeMarkdown: 'before',
    })
    expect(insertMarkdown).toHaveBeenCalledWith('[selected text](https://example.com/a\\)b)')
  })

  it('prepares Android image insertion and inserts selected text as alt text', async () => {
    expect(createAndroidImageInsertStart({
      editorReady: true,
      hasEditor: true,
      importing: false,
      isAvailable: true,
      unavailableStatus: 'unavailable',
    })).toEqual({
      kind: 'ready',
      status: 'Choose an image',
    })

    const insertMarkdown = vi.fn().mockReturnValue(true)
    const result = await insertAndroidImageWorkflow({
      selectedText: normalizeToolbarSelectionText('  alt   text  '),
      ensureAndroidImageResolver: vi.fn().mockResolvedValue(undefined),
      pickAndroidImageDocument: vi.fn().mockResolvedValue(pickedImage),
      insertMarkdown,
      getAndroidImageUserMessage: () => 'failed',
    })

    expect(result).toEqual({
      kind: 'inserted',
      status: 'Image inserted',
    })
    expect(insertMarkdown).toHaveBeenCalledWith('![alt text](marktext-image://local/photo.png)')
  })

  it('returns Android image cancellation, insertion failure, and picker failure as explicit results', async () => {
    await expect(insertAndroidImageWorkflow({
      selectedText: '',
      ensureAndroidImageResolver: vi.fn().mockResolvedValue(undefined),
      pickAndroidImageDocument: vi.fn().mockResolvedValue({ canceled: true }),
      insertMarkdown: vi.fn(),
      getAndroidImageUserMessage: () => 'failed',
    })).resolves.toEqual({
      kind: 'canceled',
      status: 'Ready',
    })

    await expect(insertAndroidImageWorkflow({
      selectedText: '',
      ensureAndroidImageResolver: vi.fn().mockResolvedValue(undefined),
      pickAndroidImageDocument: vi.fn().mockResolvedValue(pickedImage),
      insertMarkdown: vi.fn().mockReturnValue(false),
      getAndroidImageUserMessage: () => 'failed',
    })).resolves.toEqual({
      kind: 'insert-failed',
      status: 'Image insert failed',
    })

    await expect(insertAndroidImageWorkflow({
      selectedText: '',
      ensureAndroidImageResolver: vi.fn().mockRejectedValue(new Error('resolver failed')),
      pickAndroidImageDocument: vi.fn(),
      insertMarkdown: vi.fn(),
      getAndroidImageUserMessage: error => `message: ${(error as Error).message}`,
    })).resolves.toMatchObject({
      kind: 'failed',
      status: 'message: resolver failed',
    })
  })

  it('schedules editor sync only when normalized Markdown changes', () => {
    const edited = vi.fn()
    const unchanged = vi.fn()

    scheduleEditorToolbarSync({
      beforeMarkdown: '\n',
      requestFrame: callback => callback(),
      getMarkdown: () => '',
      normalizeMarkdown: markdown => markdown === '\n' ? '' : markdown,
      onEdited: edited,
      onUnchanged: unchanged,
    })

    expect(edited).not.toHaveBeenCalled()
    expect(unchanged).toHaveBeenCalledOnce()

    scheduleEditorToolbarSync({
      beforeMarkdown: 'before',
      requestFrame: callback => callback(),
      getMarkdown: () => 'after',
      normalizeMarkdown: markdown => markdown,
      onEdited: edited,
      onUnchanged: unchanged,
    })

    expect(edited).toHaveBeenCalledOnce()
  })
})
