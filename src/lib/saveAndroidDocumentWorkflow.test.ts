import { describe, expect, it, vi } from 'vitest'
import { createUntitledDocument, updateDocumentMarkdown } from './documentState'
import {
  createSaveAndroidDocumentWorkflowStart,
  saveAndroidDocumentWorkflow,
  type SaveAndroidDocumentWorkflowRequest,
} from './saveAndroidDocumentWorkflow'

function createAndroidDocumentState(markdown = '# Android\n\nbody') {
  return createUntitledDocument({
    markdown,
    displayName: 'Android.md',
    sourceUri: 'content://provider/android.md',
    autosaveTarget: 'android-document',
    now: '2026-07-02T00:00:00.000Z',
  })
}

function createDirtyAndroidDocumentState(markdown = '# Android\n\nbody\n\nchanged') {
  return updateDocumentMarkdown(createAndroidDocumentState(), markdown, {
    markDirty: true,
    now: '2026-07-02T00:01:00.000Z',
  })
}

function createWorkflowRequest(
  documentState = createDirtyAndroidDocumentState(),
): SaveAndroidDocumentWorkflowRequest {
  const start = createSaveAndroidDocumentWorkflowStart({
    documentState,
    markdown: documentState.markdown,
    canWrite: true,
  })

  if (start.kind !== 'ready') {
    throw new Error(`unexpected start result: ${start.kind}`)
  }

  return start.request
}

describe('saveAndroidDocumentWorkflow', () => {
  it('returns explicit preflight results for missing source, read-only, and clean documents', () => {
    const missingSource = createUntitledDocument({
      markdown: '# Missing source',
      autosaveTarget: 'android-document',
      sourceUri: null,
    })
    const readOnlyDirty = createDirtyAndroidDocumentState()
    const cleanDocument = createAndroidDocumentState()

    expect(createSaveAndroidDocumentWorkflowStart({
      documentState: missingSource,
      markdown: missingSource.markdown,
      canWrite: true,
    })).toMatchObject({
      kind: 'missing-source',
      saved: false,
      status: 'Save failed',
    })

    expect(createSaveAndroidDocumentWorkflowStart({
      documentState: readOnlyDirty,
      markdown: readOnlyDirty.markdown,
      canWrite: false,
    })).toMatchObject({
      kind: 'read-only',
      saved: false,
      status: 'This file is read-only.',
    })

    expect(createSaveAndroidDocumentWorkflowStart({
      documentState: cleanDocument,
      markdown: cleanDocument.markdown,
      canWrite: true,
    })).toEqual({
      kind: 'clean',
      saved: true,
    })
  })

  it('writes prepared Markdown and returns a saved document result', async () => {
    const documentState = updateDocumentMarkdown(
      createAndroidDocumentState('# Android\r\n\r\nbody\r\n'),
      '# Android\n\nbody\n\nchanged\n',
      { markDirty: true, now: '2026-07-02T00:01:00.000Z' },
    )
    const request = createWorkflowRequest(documentState)
    const writeAndroidMarkdownDocument = vi.fn().mockResolvedValue(undefined)

    const result = await saveAndroidDocumentWorkflow({
      request,
      getCurrentDocumentState: () => request.savingDocument,
      writeAndroidMarkdownDocument,
      getAndroidDocumentUserMessage: () => 'Save failed',
      recoveryMessage: 'A recovery draft was kept.',
      now: () => '2026-07-02T00:02:00.000Z',
    })

    expect(writeAndroidMarkdownDocument).toHaveBeenCalledWith(
      'content://provider/android.md',
      '# Android\r\n\r\nbody\r\n\r\nchanged\r\n',
    )
    expect(result).toMatchObject({
      kind: 'saved',
      saved: true,
      savedAt: '2026-07-02T00:02:00.000Z',
      sourceUri: 'content://provider/android.md',
      status: 'Saved',
      savedDocument: {
        isDirty: false,
        autosaveState: 'clean',
        lastSavedAt: '2026-07-02T00:02:00.000Z',
      },
    })
  })

  it('requests another save when the active document changes during the write', async () => {
    const request = createWorkflowRequest()
    const changedDocument = updateDocumentMarkdown(
      request.savingDocument,
      '# Android\n\nchanged again',
      { markDirty: true, now: '2026-07-02T00:03:00.000Z' },
    )

    const result = await saveAndroidDocumentWorkflow({
      request,
      getCurrentDocumentState: () => changedDocument,
      writeAndroidMarkdownDocument: vi.fn().mockResolvedValue(undefined),
      getAndroidDocumentUserMessage: () => 'Save failed',
      recoveryMessage: 'A recovery draft was kept.',
    })

    expect(result).toEqual({
      kind: 'changed-during-save',
      saved: false,
      sourceUri: 'content://provider/android.md',
      scheduleAnotherSave: true,
    })
  })

  it('returns a failed document, user status, and recovery draft request on write failure', async () => {
    const request = createWorkflowRequest()

    const result = await saveAndroidDocumentWorkflow({
      request,
      getCurrentDocumentState: () => request.savingDocument,
      writeAndroidMarkdownDocument: vi.fn().mockRejectedValue(new Error('permission lost')),
      getAndroidDocumentUserMessage: error => `message: ${(error as Error).message}`,
      recoveryMessage: 'A recovery draft was kept.',
    })

    expect(result).toMatchObject({
      kind: 'failed',
      saved: false,
      sourceUri: 'content://provider/android.md',
      status: 'message: permission lost A recovery draft was kept.',
      failedDocument: {
        isDirty: true,
        autosaveState: 'save-failed',
        lastSaveError: 'permission lost',
      },
      recoveryDraft: {
        sourceUri: 'content://provider/android.md',
        markdown: '# Android\n\nbody\n\nchanged',
      },
    })
  })
})
