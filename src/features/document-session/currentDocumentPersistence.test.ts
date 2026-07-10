import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createCurrentDocumentPersistence } from './currentDocumentPersistence'
import type { AppScreen } from '../../lib/appExitDecisions'
import type { OpenedAndroidDocument } from '../../lib/androidDocuments'
import {
  createUntitledDocument,
  updateDocumentMarkdown,
  type MarkdownDocumentState,
} from '../../lib/documentState'
import type { LocalDraftRecord } from '../../lib/localDrafts'
import type { RecentDocumentRecord } from '../../lib/recentDocuments'
import type { ImageSharingSettings } from '../android-documents/imageSharingSettings'
import { DEFAULT_MARKDOWN_SAVE_SETTINGS } from '../settings/advancedSettings'

const noopLogger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }

const ANDROID_URI = 'content://provider/original.md'

function dirtyAndroidDocumentState(markdown = '# Original\n\nchanged') {
  return updateDocumentMarkdown(
    createUntitledDocument({
      markdown: '# Original',
      displayName: 'Original.md',
      sourceUri: ANDROID_URI,
      autosaveTarget: 'android-document',
      now: '2026-07-10T00:00:00.000Z',
    }),
    markdown,
    { markDirty: true, now: '2026-07-10T00:01:00.000Z' },
  )
}

function androidRecentRecord(): RecentDocumentRecord {
  return {
    id: `android-document:${ANDROID_URI}`,
    kind: 'android-document',
    displayName: 'Original.md',
    title: 'Original',
    sourceUri: ANDROID_URI,
    providerName: 'Documents',
    pathHint: 'Original.md',
    markdownPreview: null,
    createdAt: '2026-07-10T00:00:00.000Z',
    updatedAt: '2026-07-10T00:00:00.000Z',
    lastOpenedAt: '2026-07-10T00:00:00.000Z',
    lastSavedAt: null,
    autosaveState: 'clean',
    canWrite: true,
  }
}

const createdDocument: OpenedAndroidDocument = {
  canceled: false,
  sourceUri: 'content://provider/created.md',
  displayName: 'created.md',
  providerName: 'Documents',
  pathHint: 'created.md',
  mimeType: 'text/markdown',
  markdown: '# Draft',
  canWrite: true,
  persisted: true,
}

function createPersistence(overrides: {
  documentState?: MarkdownDocumentState
  drafts?: LocalDraftRecord[]
  androidDocuments?: RecentDocumentRecord[]
  hasEditor?: boolean
  currentScreen?: AppScreen
  canPersistLocalDrafts?: boolean
  canPersistRecoveryDrafts?: boolean
  markdownSnapshot?: string
} = {}) {
  const localDrafts = ref(overrides.drafts ?? [])
  const androidRecentDocuments = ref(overrides.androidDocuments ?? [])
  const documentState = ref(
    overrides.documentState ?? createUntitledDocument({ autosaveTarget: 'local-draft' }),
  )

  const options = {
    currentScreen: ref<AppScreen>(overrides.currentScreen ?? 'editor'),
    documentState,
    status: ref('Ready'),
    homeNotice: ref<string | null>(null),
    localDrafts,
    androidRecentDocuments,
    currentAndroidDocumentCanWrite: ref(true),
    promptLocalDraftSaveOnExit: ref(true),
    draftExitPromptOpen: ref(false),
    androidExitPromptOpen: ref(false),
    savingLocalDraftToAndroid: ref(false),
    savingAndroidDocumentCopy: ref(false),
    sharingCurrentDocument: ref(false),
    hasEditor: () => overrides.hasEditor ?? true,
    getEditorMarkdownSnapshot: vi.fn(
      () => overrides.markdownSnapshot ?? documentState.value.markdown,
    ),
    syncDocumentFromEditor: vi.fn(() => documentState.value),
    closeEditorMenu: vi.fn(),
    closeEditorToHome: vi.fn(),
    isLocalDraftDocument: () => documentState.value.autosaveTarget === 'local-draft',
    canSaveAndroidDocumentCopy: () => true,
    canShareCurrentDocument: () => true,
    canPersistLocalDrafts: () => overrides.canPersistLocalDrafts ?? true,
    canPersistAndroidRecoveryDrafts: () => overrides.canPersistRecoveryDrafts ?? true,
    getTransientAndroidSaveMessage: () => 'transient message',
    getAndroidEditorStatus: () => 'Saved',
    getDraftLogStats: () => ({ characters: 0, words: 0, lines: 0 }),
    persistLocalDrafts: vi.fn((drafts: LocalDraftRecord[]) => {
      localDrafts.value = drafts
    }),
    persistAndroidRecentDocuments: vi.fn((records: RecentDocumentRecord[]) => {
      androidRecentDocuments.value = records
    }),
    rememberAndroidDocument: vi.fn(),
    clearDraftSaveTimer: vi.fn(),
    clearAndroidDocumentSaveTimer: vi.fn(),
    scheduleAndroidDocumentSave: vi.fn(),
    writeAndroidMarkdownDocument: vi.fn().mockResolvedValue(undefined),
    createAndroidMarkdownDocument: vi.fn().mockResolvedValue(createdDocument),
    shareAndroidMarkdownDocument: vi.fn().mockResolvedValue({
      displayName: 'x.md',
      mimeType: 'text/markdown',
      bytes: 1,
      imageCount: 0,
      sharedFileCount: 1,
    }),
    getAndroidDocumentUserMessage: (error: unknown) =>
      `user message: ${(error as Error)?.message ?? 'unknown'}`,
    markdownSaveSettings: ref(DEFAULT_MARKDOWN_SAVE_SETTINGS),
    imageSharingSettings: ref<ImageSharingSettings>({
      shareImages: 'attach',
      imageCopyImages: true,
    } as ImageSharingSettings),
    androidSaveRecoveryMessage: 'Save failed. A local recovery draft was kept.',
    appLogger: noopLogger,
    documentLogger: noopLogger,
    draftLogger: noopLogger,
  }

  return { persistence: createCurrentDocumentPersistence(options), options }
}

describe('currentDocumentPersistence', () => {
  it('autosaves a dirty local draft and reports the saved status', () => {
    const dirtyDraft = updateDocumentMarkdown(
      createUntitledDocument({ markdown: '', autosaveTarget: 'local-draft' }),
      '# Draft body',
      { markDirty: true },
    )
    const { persistence, options } = createPersistence({ documentState: dirtyDraft })

    persistence.saveDraft()

    expect(options.clearDraftSaveTimer).toHaveBeenCalled()
    expect(options.localDrafts.value[0]?.markdown).toBe('# Draft body')
    expect(options.documentState.value.autosaveState).toBe('clean')
    expect(options.status.value).toBe('Autosaved locally')
  })

  it('skips draft autosave for Android documents and when drafts are disabled', () => {
    const android = createPersistence({ documentState: dirtyAndroidDocumentState() })
    android.persistence.saveDraft()
    expect(android.options.persistLocalDrafts).not.toHaveBeenCalled()

    const disabled = createPersistence({ canPersistLocalDrafts: false })
    disabled.persistence.saveDraft()
    expect(disabled.options.persistLocalDrafts).not.toHaveBeenCalled()
  })

  it('saves a dirty Android document, updates recents, and drops its recovery draft', async () => {
    const recoveryDraft: LocalDraftRecord = {
      id: `android-recovery:${ANDROID_URI}`,
      markdown: '# stale recovery',
      createdAt: '2026-07-10T00:00:00.000Z',
      updatedAt: '2026-07-10T00:00:00.000Z',
      lastSavedAt: null,
    }
    const { persistence, options } = createPersistence({
      documentState: dirtyAndroidDocumentState(),
      drafts: [recoveryDraft],
      androidDocuments: [androidRecentRecord()],
    })

    const saved = await persistence.saveAndroidDocument()

    expect(saved).toBe(true)
    expect(options.writeAndroidMarkdownDocument).toHaveBeenCalledTimes(1)
    expect(options.documentState.value.isDirty).toBe(false)
    expect(options.androidRecentDocuments.value[0].lastSavedAt).not.toBeNull()
    expect(options.localDrafts.value).toEqual([])
  })

  it('keeps a recovery draft and the recovery status when the Android save fails', async () => {
    const { persistence, options } = createPersistence({
      documentState: dirtyAndroidDocumentState(),
      androidDocuments: [androidRecentRecord()],
    })
    options.writeAndroidMarkdownDocument.mockRejectedValue(new Error('disk full'))

    const saved = await persistence.saveAndroidDocument()

    expect(saved).toBe(false)
    expect(
      options.localDrafts.value.some(draft => draft.id === `android-recovery:${ANDROID_URI}`),
    ).toBe(true)
    // The workflow prefixes the user-facing failure before the recovery note.
    expect(options.status.value).toBe(
      'user message: disk full Save failed. A local recovery draft was kept.',
    )
  })

  it('falls back to the user message when recovery drafts are disabled', async () => {
    const { persistence, options } = createPersistence({
      documentState: dirtyAndroidDocumentState(),
      androidDocuments: [androidRecentRecord()],
      canPersistRecoveryDrafts: false,
    })
    options.writeAndroidMarkdownDocument.mockRejectedValue(new Error('disk full'))

    await persistence.saveAndroidDocument()

    expect(options.localDrafts.value).toEqual([])
    expect(options.status.value).toBe('user message: disk full')
  })

  it('coalesces overlapping Android saves and reschedules once the first completes', async () => {
    const { persistence, options } = createPersistence({
      documentState: dirtyAndroidDocumentState(),
      androidDocuments: [androidRecentRecord()],
    })
    let releaseWrite!: () => void
    options.writeAndroidMarkdownDocument.mockImplementation(
      () => new Promise<void>(resolve => (releaseWrite = () => resolve())),
    )

    const first = persistence.saveAndroidDocument()
    const second = await persistence.saveAndroidDocument()
    expect(second).toBe(false)
    expect(options.writeAndroidMarkdownDocument).toHaveBeenCalledTimes(1)

    // Keep the document dirty for the rescheduling check on completion.
    options.documentState.value = dirtyAndroidDocumentState('# even newer')
    releaseWrite()
    await first

    expect(options.scheduleAndroidDocumentSave).toHaveBeenCalledTimes(1)
  })

  it('flushes to the save path matching the current autosave target', async () => {
    const android = createPersistence({ documentState: dirtyAndroidDocumentState() })
    await android.persistence.flushCurrentDocument('test')
    expect(android.options.writeAndroidMarkdownDocument).toHaveBeenCalled()

    const home = createPersistence({ currentScreen: 'home' })
    await home.persistence.flushCurrentDocument('test')
    expect(home.options.clearDraftSaveTimer).not.toHaveBeenCalled()
  })

  it('saves a local draft to the device and cleans up the draft copy', async () => {
    const dirtyDraft = updateDocumentMarkdown(
      createUntitledDocument({ markdown: '', autosaveTarget: 'local-draft' }),
      '# Draft body',
      { markDirty: true },
    )
    const { persistence, options } = createPersistence({ documentState: dirtyDraft })

    const saved = await persistence.saveLocalDraftToAndroidDocument({ returnHomeAfterSave: true })

    expect(saved).toBe(true)
    expect(options.rememberAndroidDocument).toHaveBeenCalledWith(
      expect.objectContaining({ sourceUri: 'content://provider/created.md' }),
    )
    expect(options.localDrafts.value).toEqual([])
    expect(options.promptLocalDraftSaveOnExit.value).toBe(false)
    expect(options.documentState.value.autosaveTarget).toBe('android-document')
    expect(options.closeEditorToHome).toHaveBeenCalled()
    expect(options.savingLocalDraftToAndroid.value).toBe(false)
  })

  it('reopens the exit prompt when a return-home draft save is canceled', async () => {
    const dirtyDraft = updateDocumentMarkdown(
      createUntitledDocument({ markdown: '', autosaveTarget: 'local-draft' }),
      '# Draft body',
      { markDirty: true },
    )
    const { persistence, options } = createPersistence({ documentState: dirtyDraft })
    options.draftExitPromptOpen.value = true
    options.createAndroidMarkdownDocument.mockResolvedValue({ canceled: true })

    const saved = await persistence.saveLocalDraftToAndroidDocument({ returnHomeAfterSave: true })

    expect(saved).toBe(false)
    expect(options.draftExitPromptOpen.value).toBe(true)
  })

  it('saves a copy, clears the exit prompt, and removes the original recovery draft', async () => {
    const recoveryDraft: LocalDraftRecord = {
      id: `android-recovery:${ANDROID_URI}`,
      markdown: '# stale recovery',
      createdAt: '2026-07-10T00:00:00.000Z',
      updatedAt: '2026-07-10T00:00:00.000Z',
      lastSavedAt: null,
    }
    const { persistence, options } = createPersistence({
      documentState: dirtyAndroidDocumentState(),
      drafts: [recoveryDraft],
      androidDocuments: [androidRecentRecord()],
    })
    options.androidExitPromptOpen.value = true

    const saved = await persistence.saveAndroidDocumentCopy()

    expect(saved).toBe(true)
    expect(options.rememberAndroidDocument).toHaveBeenCalledWith(
      expect.objectContaining({ sourceUri: 'content://provider/created.md' }),
    )
    expect(options.androidExitPromptOpen.value).toBe(false)
    expect(options.localDrafts.value).toEqual([])
  })

  it('shares the current document and restores the busy flag', async () => {
    const { persistence, options } = createPersistence({
      documentState: dirtyAndroidDocumentState(),
    })

    const shared = await persistence.shareCurrentMarkdownDocument()

    expect(shared).toBe(true)
    expect(options.status.value).toBe('Share sheet opened')
    expect(options.sharingCurrentDocument.value).toBe(false)
  })

  it('refuses to share while a share is already in flight', async () => {
    const { persistence, options } = createPersistence({
      documentState: dirtyAndroidDocumentState(),
    })
    options.sharingCurrentDocument.value = true

    const shared = await persistence.shareCurrentMarkdownDocument()

    expect(shared).toBe(false)
    expect(options.shareAndroidMarkdownDocument).not.toHaveBeenCalled()
  })
})
