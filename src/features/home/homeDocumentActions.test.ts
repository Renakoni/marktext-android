import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createHomeDocumentActions } from './homeDocumentActions'
import { useDocumentSelection } from './useDocumentSelection'
import { getAndroidDocumentUserMessage, AndroidDocumentError } from '../../lib/androidDocuments'
import { createUntitledDocument } from '../../lib/documentState'
import { getRecentDocumentListItems } from '../../lib/recentDocuments'
import type { LocalDraftRecord } from '../../lib/localDrafts'
import type { PinnedDocumentRecord } from '../../lib/pinnedDocuments'
import type { RecentDocumentRecord } from '../../lib/recentDocuments'
import type { ImageSharingSettings } from '../android-documents/imageSharingSettings'
import { DEFAULT_MARKDOWN_SAVE_SETTINGS } from '../settings/advancedSettings'

const noopLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

const draftRecord: LocalDraftRecord = {
  id: 'draft-1',
  markdown: '# Draft one\n\nbody',
  createdAt: '2026-07-09T00:00:00.000Z',
  updatedAt: '2026-07-09T00:01:00.000Z',
  lastSavedAt: '2026-07-09T00:01:00.000Z',
}

const androidRecord: RecentDocumentRecord = {
  id: 'android-document:content://test/notes.md',
  kind: 'android-document',
  displayName: 'notes.md',
  title: 'notes',
  sourceUri: 'content://test/notes.md',
  providerName: 'Documents',
  pathHint: 'notes.md',
  markdownPreview: null,
  createdAt: '2026-07-09T00:00:00.000Z',
  updatedAt: '2026-07-09T00:00:00.000Z',
  lastOpenedAt: '2026-07-09T00:00:00.000Z',
  lastSavedAt: null,
  autosaveState: 'clean',
  canWrite: true,
}

const draftListRecord: RecentDocumentRecord = {
  ...androidRecord,
  id: 'draft-1',
  kind: 'local-draft',
  displayName: 'Draft one',
  title: 'Draft one',
  sourceUri: null,
  providerName: 'Local draft',
  pathHint: null,
  markdownPreview: draftRecord.markdown,
}

function createActions(overrides: {
  drafts?: LocalDraftRecord[]
  androidDocuments?: RecentDocumentRecord[]
  pins?: PinnedDocumentRecord[]
  selectedIds?: string[]
  documentState?: ReturnType<typeof createUntitledDocument>
} = {}) {
  const localDrafts = ref(overrides.drafts ?? [draftRecord])
  const androidRecentDocuments = ref(overrides.androidDocuments ?? [androidRecord])
  const pinnedDocuments = ref(overrides.pins ?? [])
  const documentItems = ref(
    getRecentDocumentListItems([draftListRecord, ...androidRecentDocuments.value]),
  )
  const selection = useDocumentSelection()
  for (const id of overrides.selectedIds ?? []) {
    selection.toggle(id)
  }

  const options = {
    documentItems,
    selection,
    homeNotice: ref<string | null>('stale notice'),
    localDrafts,
    persistLocalDrafts: vi.fn((drafts: LocalDraftRecord[]) => {
      localDrafts.value = drafts
    }),
    androidRecentDocuments,
    persistAndroidRecentDocuments: vi.fn((records: RecentDocumentRecord[]) => {
      androidRecentDocuments.value = records
    }),
    pinnedDocuments,
    persistPinnedDocuments: vi.fn((records: PinnedDocumentRecord[]) => {
      pinnedDocuments.value = records
    }),
    documentState: ref(
      overrides.documentState ?? createUntitledDocument({ autosaveTarget: 'local-draft' }),
    ),
    currentAndroidDocumentCanWrite: ref(true),
    readAndroidMarkdownDocument: vi.fn().mockResolvedValue({ markdown: '# notes' }),
    shareAndroidMarkdownDocument: vi.fn().mockResolvedValue({
      displayName: 'x.md',
      mimeType: 'text/markdown',
      bytes: 1,
      imageCount: 0,
      sharedFileCount: 1,
    }),
    shareAndroidMarkdownDocuments: vi.fn().mockResolvedValue({
      displayName: 'x.md',
      mimeType: 'text/markdown',
      bytes: 2,
      imageCount: 0,
      sharedFileCount: 2,
    }),
    renameAndroidMarkdownDocument: vi.fn().mockResolvedValue({
      sourceUri: 'content://test/renamed.md',
      displayName: 'renamed.md',
      providerName: 'Documents',
      pathHint: 'renamed.md',
      canWrite: true,
      persisted: true,
    }),
    getAndroidDocumentUserMessage,
    imageSharingSettings: ref<ImageSharingSettings>({
      shareImages: 'attach',
      imageCopyImages: true,
    } as ImageSharingSettings),
    markdownSaveSettings: ref(DEFAULT_MARKDOWN_SAVE_SETTINGS),
    renameTemporaryAccessMessage: 'temporary access notice',
    appLogger: noopLogger,
    documentLogger: noopLogger,
  }

  return { actions: createHomeDocumentActions(options), options, selection }
}

describe('homeDocumentActions', () => {
  it('toggles pins for the selection and exits selection without touching notices', () => {
    const { actions, options, selection } = createActions({ selectedIds: ['draft-1'] })

    actions.pinSelectedDocuments()

    expect(options.pinnedDocuments.value.map(pin => pin.id)).toEqual(['draft-1'])
    // Pinning is unrelated to whatever the home notice is currently showing.
    expect(options.homeNotice.value).toBe('stale notice')
    expect(selection.isActive.value).toBe(false)
  })

  it('does nothing when pinning with an empty selection', () => {
    const { actions, options } = createActions()

    actions.pinSelectedDocuments()

    expect(options.persistPinnedDocuments).not.toHaveBeenCalled()
  })

  it('deletes drafts permanently, removes device files from the list, and prunes pins', () => {
    const { actions, options, selection } = createActions({
      selectedIds: ['draft-1', androidRecord.id],
      pins: [
        { id: 'draft-1', pinnedAt: '2026-07-09T00:00:00.000Z' },
        { id: androidRecord.id, pinnedAt: '2026-07-09T00:00:00.000Z' },
      ],
    })

    actions.deleteSelectedDocuments()

    expect(options.localDrafts.value).toEqual([])
    expect(options.androidRecentDocuments.value).toEqual([])
    expect(options.pinnedDocuments.value).toEqual([])
    // Deleting must not dismiss an unrelated notice the user may be reading.
    expect(options.homeNotice.value).toBe('stale notice')
    expect(selection.isActive.value).toBe(false)
  })

  it('resets the open editor session when its document is deleted', () => {
    const openDraftState = {
      ...createUntitledDocument({ markdown: '# Draft one', autosaveTarget: 'local-draft' }),
      id: 'draft-1',
    }
    const { actions, options } = createActions({
      selectedIds: ['draft-1'],
      documentState: openDraftState,
    })

    actions.deleteSelectedDocuments()

    expect(options.documentState.value.id).not.toBe('draft-1')
    expect(options.documentState.value.markdown).toBe('')
    expect(options.currentAndroidDocumentCanWrite.value).toBe(false)
  })

  it('keeps the selection and surfaces the message when sharing fails', async () => {
    const { actions, options, selection } = createActions({ selectedIds: [androidRecord.id] })
    options.readAndroidMarkdownDocument.mockRejectedValue(
      new AndroidDocumentError('DOCUMENT_NOT_FOUND', 'gone'),
    )

    await actions.shareSelectedDocuments()

    expect(options.homeNotice.value).toBe(
      'This file was moved or deleted. Open it again from Android.',
    )
    expect(selection.isActive.value).toBe(true)
  })

  it('clears the selection and notice after a successful share', async () => {
    const { actions, options, selection } = createActions({
      selectedIds: ['draft-1', androidRecord.id],
    })

    await actions.shareSelectedDocuments()

    expect(options.shareAndroidMarkdownDocuments).toHaveBeenCalledTimes(1)
    expect(options.homeNotice.value).toBeNull()
    expect(selection.isActive.value).toBe(false)
  })

  it('renames a draft and patches an open editor session for that draft', async () => {
    const openDraftState = {
      ...createUntitledDocument({ markdown: '# Draft one', autosaveTarget: 'local-draft' }),
      id: 'draft-1',
    }
    const { actions, options, selection } = createActions({
      selectedIds: ['draft-1'],
      documentState: openDraftState,
    })

    await actions.renameSelectedDocument('draft-1', '  Trip plan  ')

    expect(options.localDrafts.value[0].displayName).toBe('Trip plan')
    expect(options.documentState.value.displayName).toBe('Trip plan')
    expect(options.homeNotice.value).toBeNull()
    expect(selection.isActive.value).toBe(false)
  })

  it('migrates the record, pin, and recovery draft when a rename changes the URI', async () => {
    const recoveryDraft: LocalDraftRecord = {
      ...draftRecord,
      id: 'android-recovery:content://test/notes.md',
      markdown: '# Unsaved edits',
    }
    const { actions, options } = createActions({
      selectedIds: [androidRecord.id],
      drafts: [draftRecord, recoveryDraft],
      pins: [{ id: androidRecord.id, pinnedAt: '2026-07-09T00:00:00.000Z' }],
    })

    await actions.renameSelectedDocument(androidRecord.id, 'renamed')

    expect(options.androidRecentDocuments.value[0]).toMatchObject({
      id: 'android-document:content://test/renamed.md',
      sourceUri: 'content://test/renamed.md',
      displayName: 'renamed.md',
    })
    expect(options.pinnedDocuments.value.map(pin => pin.id)).toEqual([
      'android-document:content://test/renamed.md',
    ])
    expect(
      options.localDrafts.value.some(
        draft => draft.id === 'android-recovery:content://test/renamed.md',
      ),
    ).toBe(true)
    expect(options.homeNotice.value).toBeNull()
  })

  it('drops the entry and its pins when a rename keeps only temporary access', async () => {
    const { actions, options } = createActions({
      selectedIds: [androidRecord.id],
      pins: [{ id: androidRecord.id, pinnedAt: '2026-07-09T00:00:00.000Z' }],
    })
    options.renameAndroidMarkdownDocument.mockResolvedValue({
      sourceUri: 'content://test/renamed.md',
      displayName: 'renamed.md',
      providerName: 'Documents',
      pathHint: 'renamed.md',
      canWrite: true,
      persisted: false,
    })

    await actions.renameSelectedDocument(androidRecord.id, 'renamed')

    expect(options.androidRecentDocuments.value).toEqual([])
    expect(options.pinnedDocuments.value).toEqual([])
    expect(options.homeNotice.value).toBe('temporary access notice')
  })

  it('only warns when the rename target no longer exists', async () => {
    const { actions, options } = createActions()

    await actions.renameSelectedDocument('missing-id', 'name')

    expect(options.persistLocalDrafts).not.toHaveBeenCalled()
    expect(options.renameAndroidMarkdownDocument).not.toHaveBeenCalled()
    expect(noopLogger.warn).toHaveBeenCalledWith('rename target not found', { id: 'missing-id' })
  })
})
