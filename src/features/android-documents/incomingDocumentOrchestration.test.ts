import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createIncomingDocumentOrchestration } from './incomingDocumentOrchestration'
import { installAndroidDocumentIntentListeners } from './androidDocumentIntentListeners'
import { getAndroidDocumentUserMessage, AndroidDocumentError } from '../../lib/androidDocuments'
import { createUntitledDocument } from '../../lib/documentState'
import type { AppScreen } from '../../lib/appExitDecisions'
import type { LocalDraftRecord } from '../../lib/localDrafts'

vi.mock('./androidDocumentIntentListeners', () => ({
  installAndroidDocumentIntentListeners: vi.fn(() => ({ remove: vi.fn() })),
}))

const noopLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

const incomingDocument = {
  canceled: false as const,
  sourceUri: 'content://test/incoming.md',
  displayName: 'incoming.md',
  providerName: 'Documents',
  pathHint: 'incoming.md',
  mimeType: 'text/markdown',
  markdown: '# Incoming',
  canWrite: true,
  persisted: true,
}

const sharedTextDocument = {
  canceled: false as const,
  sourceUri: null,
  displayName: 'Shared text',
  providerName: null,
  pathHint: null,
  mimeType: 'text/plain',
  markdown: '# Shared note',
  canWrite: false,
  persisted: false,
  shareKind: 'text' as const,
}

function createOrchestration(overrides: {
  currentScreen?: AppScreen
  documentState?: ReturnType<typeof createUntitledDocument>
  hasEditor?: boolean
  saveResult?: boolean
  draftSaved?: boolean
  recoveryKept?: boolean
  canPersistDrafts?: boolean
} = {}) {
  const options = {
    currentScreen: ref<AppScreen>(overrides.currentScreen ?? 'home'),
    documentState: ref(
      overrides.documentState
      ?? createUntitledDocument({ markdown: '', autosaveTarget: 'local-draft' }),
    ),
    localDrafts: ref<LocalDraftRecord[]>([]),
    homeNotice: ref<string | null>(null),
    status: ref('Ready'),
    draftExitPromptOpen: ref(true),
    androidExitPromptOpen: ref(true),
    promptLocalDraftSaveOnExit: ref(false),
    currentAndroidDocumentCanWrite: ref(true),
    sharedTextImportedMessage: 'Imported shared text as a local draft.',
    hasEditor: () => overrides.hasEditor ?? false,
    openEditor: vi.fn().mockResolvedValue(undefined),
    releaseEditorFocusAfterOpen: vi.fn(),
    closeEditorMenu: vi.fn(),
    closeEditorToolbar: vi.fn(),
    openAndroidDocumentResult: vi.fn().mockResolvedValue(undefined),
    saveAndroidDocument: vi.fn().mockResolvedValue(overrides.saveResult ?? true),
    saveDraft: vi.fn(() => overrides.draftSaved ?? true),
    syncDocumentFromEditor: vi.fn(),
    persistAndroidRecoveryDraft: vi.fn(() => overrides.recoveryKept ?? true),
    canPersistLocalDrafts: () => overrides.canPersistDrafts ?? true,
    persistLocalDrafts: vi.fn(),
    confirmIncomingOpenAfterBlockedPreserve: vi.fn(),
    getAndroidDocumentUserMessage,
    appLogger: noopLogger,
    documentLogger: noopLogger,
  }

  return { orchestration: createIncomingDocumentOrchestration(options), options }
}

describe('incomingDocumentOrchestration', () => {
  it('surfaces rejected open-with events without opening anything', async () => {
    const { orchestration, options } = createOrchestration()
    const error = new AndroidDocumentError(
      'UNSUPPORTED_OPEN_WITH_DOCUMENT',
      'Open a Markdown document',
    )

    await orchestration.handleOpenWithDocumentEvent({ document: null, error })

    expect(options.homeNotice.value).toBe('Open a Markdown file.')
    expect(options.status.value).toBe('Open a Markdown file.')
    expect(options.openAndroidDocumentResult).not.toHaveBeenCalled()
    expect(options.saveDraft).not.toHaveBeenCalled()
  })

  it('opens an open-with document from home without preserving anything', async () => {
    const { orchestration, options } = createOrchestration({ currentScreen: 'home' })

    await orchestration.handleOpenWithDocumentEvent({ document: incomingDocument, error: null })

    expect(options.saveDraft).not.toHaveBeenCalled()
    expect(options.saveAndroidDocument).not.toHaveBeenCalled()
    expect(options.draftExitPromptOpen.value).toBe(false)
    expect(options.androidExitPromptOpen.value).toBe(false)
    expect(options.closeEditorMenu).toHaveBeenCalled()
    expect(options.closeEditorToolbar).toHaveBeenCalled()
    expect(options.openAndroidDocumentResult).toHaveBeenCalledWith(incomingDocument, {
      source: 'open-with',
      remember: true,
    })
  })

  it('preserves an open local draft before an incoming open', async () => {
    const { orchestration, options } = createOrchestration({
      currentScreen: 'editor',
      hasEditor: true,
      documentState: createUntitledDocument({ markdown: '# Draft', autosaveTarget: 'local-draft' }),
    })

    await orchestration.handleOpenWithDocumentEvent({ document: incomingDocument, error: null })

    expect(options.saveDraft).toHaveBeenCalled()
    expect(options.saveAndroidDocument).not.toHaveBeenCalled()
  })

  it('keeps a recovery draft when preserving an Android document fails to save', async () => {
    const documentState = {
      ...createUntitledDocument({
        markdown: '# Device doc',
        autosaveTarget: 'android-document',
        sourceUri: 'content://test/current.md',
      }),
      isDirty: true,
    }
    const { orchestration, options } = createOrchestration({
      currentScreen: 'editor',
      hasEditor: true,
      documentState,
      saveResult: false,
    })

    await orchestration.handleOpenWithDocumentEvent({ document: incomingDocument, error: null })

    expect(options.syncDocumentFromEditor).toHaveBeenCalledWith(true, true)
    expect(options.saveAndroidDocument).toHaveBeenCalled()
    expect(options.persistAndroidRecoveryDraft).toHaveBeenCalledWith(
      'content://test/current.md',
      '# Device doc',
    )
    // A durable recovery write counts as preserved, so the incoming doc opens.
    expect(options.confirmIncomingOpenAfterBlockedPreserve).not.toHaveBeenCalled()
    expect(options.openAndroidDocumentResult).toHaveBeenCalled()
  })

  it('blocks the incoming open when a failed Android save cannot be recovered', async () => {
    const documentState = {
      ...createUntitledDocument({
        markdown: '# Device doc',
        autosaveTarget: 'android-document',
        sourceUri: 'content://test/current.md',
      }),
      isDirty: true,
    }
    const { orchestration, options } = createOrchestration({
      currentScreen: 'editor',
      hasEditor: true,
      documentState,
      saveResult: false,
      recoveryKept: false,
    })

    await orchestration.handleOpenWithDocumentEvent({ document: incomingDocument, error: null })

    expect(options.confirmIncomingOpenAfterBlockedPreserve).toHaveBeenCalledTimes(1)
    const [request] = options.confirmIncomingOpenAfterBlockedPreserve.mock.calls[0]
    expect(request.incomingName).toBe('incoming.md')
    expect(typeof request.proceed).toBe('function')
    // The editor is not replaced and its chrome stays mounted.
    expect(options.openAndroidDocumentResult).not.toHaveBeenCalled()
    expect(options.closeEditorMenu).not.toHaveBeenCalled()
  })

  it('blocks when a failed save leaves a dirty Android document blank', async () => {
    const documentState = {
      ...createUntitledDocument({
        markdown: '',
        autosaveTarget: 'android-document',
        sourceUri: 'content://test/current.md',
      }),
      isDirty: true,
    }
    const { orchestration, options } = createOrchestration({
      currentScreen: 'editor',
      hasEditor: true,
      documentState,
      saveResult: false,
      recoveryKept: false,
    })

    await orchestration.handleOpenWithDocumentEvent({ document: incomingDocument, error: null })

    expect(options.confirmIncomingOpenAfterBlockedPreserve).toHaveBeenCalledTimes(1)
    expect(options.persistAndroidRecoveryDraft).not.toHaveBeenCalled()
    expect(options.openAndroidDocumentResult).not.toHaveBeenCalled()
  })

  it('blocks the incoming open when an unsaved local draft cannot be kept', async () => {
    const { orchestration, options } = createOrchestration({
      currentScreen: 'editor',
      hasEditor: true,
      documentState: createUntitledDocument({ markdown: '# Draft', autosaveTarget: 'local-draft' }),
      draftSaved: false,
    })

    await orchestration.handleShareDocumentEvent({ document: sharedTextDocument, error: null })

    expect(options.saveDraft).toHaveBeenCalled()
    expect(options.confirmIncomingOpenAfterBlockedPreserve).toHaveBeenCalledTimes(1)
    expect(options.confirmIncomingOpenAfterBlockedPreserve.mock.calls[0][0].incomingName).toBe(
      'Shared text',
    )
    // The shared text is not imported and the editor is not replaced.
    expect(options.openEditor).not.toHaveBeenCalled()
    expect(options.persistLocalDrafts).not.toHaveBeenCalled()
  })

  it('opens the incoming document when the user discards after a blocked preserve', async () => {
    const documentState = {
      ...createUntitledDocument({
        markdown: '# Device doc',
        autosaveTarget: 'android-document',
        sourceUri: 'content://test/current.md',
      }),
      isDirty: true,
    }
    const { orchestration, options } = createOrchestration({
      currentScreen: 'editor',
      hasEditor: true,
      documentState,
      saveResult: false,
      recoveryKept: false,
    })

    await orchestration.handleOpenWithDocumentEvent({ document: incomingDocument, error: null })
    expect(options.openAndroidDocumentResult).not.toHaveBeenCalled()

    // Running the deferred proceed is the user's "Discard & open" choice.
    const [request] = options.confirmIncomingOpenAfterBlockedPreserve.mock.calls[0]
    await request.proceed()

    expect(options.closeEditorMenu).toHaveBeenCalled()
    expect(options.openAndroidDocumentResult).toHaveBeenCalledWith(incomingDocument, {
      source: 'open-with',
      remember: true,
    })
  })

  it('recovers the latest content after the awaited save, not the pre-save snapshot', async () => {
    const documentState = {
      ...createUntitledDocument({
        markdown: '# Before save',
        autosaveTarget: 'android-document',
        sourceUri: 'content://test/current.md',
      }),
      isDirty: true,
    }
    const { orchestration, options } = createOrchestration({
      currentScreen: 'editor',
      hasEditor: true,
      documentState,
    })
    // The provider write is still pending while the user keeps typing: the save
    // reports changed-during-save (false) and the editor now holds newer text.
    options.saveAndroidDocument.mockImplementation(async () => {
      options.documentState.value = {
        ...options.documentState.value,
        markdown: '# Edited during save',
      }
      return false
    })

    await orchestration.handleOpenWithDocumentEvent({ document: incomingDocument, error: null })

    // The recovery payload must be the freshest content, never the stale snapshot.
    expect(options.persistAndroidRecoveryDraft).toHaveBeenCalledWith(
      'content://test/current.md',
      '# Edited during save',
    )
  })

  it('holds a second incoming open while a blocked prompt is still pending', async () => {
    const documentState = {
      ...createUntitledDocument({
        markdown: '# Device doc',
        autosaveTarget: 'android-document',
        sourceUri: 'content://test/current.md',
      }),
      isDirty: true,
    }
    const { orchestration, options } = createOrchestration({
      currentScreen: 'editor',
      hasEditor: true,
      documentState,
      saveResult: false,
      recoveryKept: false,
    })

    // First intent blocks and shows the prompt.
    await orchestration.handleOpenWithDocumentEvent({ document: incomingDocument, error: null })
    expect(options.confirmIncomingOpenAfterBlockedPreserve).toHaveBeenCalledTimes(1)
    expect(options.saveAndroidDocument).toHaveBeenCalledTimes(1)

    // A second intent arrives while the decision is pending. It must neither open
    // behind the prompt nor even run its own preservation yet (serialized).
    const secondDocument = {
      ...incomingDocument,
      sourceUri: 'content://test/second.md',
      displayName: 'second.md',
    }
    await orchestration.handleOpenWithDocumentEvent({ document: secondDocument, error: null })
    expect(options.openAndroidDocumentResult).not.toHaveBeenCalled()
    expect(options.saveAndroidDocument).toHaveBeenCalledTimes(1)

    // Resolving the first decision drains the queued second intent, which then
    // preserves the current editor (still blocked) and prompts for the new doc.
    await orchestration.resolveIncomingDecision()
    expect(options.saveAndroidDocument).toHaveBeenCalledTimes(2)
    expect(options.confirmIncomingOpenAfterBlockedPreserve).toHaveBeenCalledTimes(2)
    expect(options.confirmIncomingOpenAfterBlockedPreserve.mock.calls[1][0].incomingName).toBe(
      'second.md',
    )
    expect(options.openAndroidDocumentResult).not.toHaveBeenCalled()
  })

  it('continues with a queued incoming open after the active transaction fails', async () => {
    const { orchestration, options } = createOrchestration({ currentScreen: 'home' })
    let rejectFirst!: (error: Error) => void
    const firstOpen = new Promise<void>((_resolve, reject) => {
      rejectFirst = reject
    })
    options.openAndroidDocumentResult
      .mockImplementationOnce(() => firstOpen)
      .mockResolvedValue(undefined)

    const first = orchestration.handleOpenWithDocumentEvent({
      document: incomingDocument,
      error: null,
    })
    await vi.waitFor(() => expect(options.openAndroidDocumentResult).toHaveBeenCalledTimes(1))

    const secondDocument = {
      ...incomingDocument,
      sourceUri: 'content://test/second.md',
      displayName: 'second.md',
    }
    await orchestration.handleOpenWithDocumentEvent({ document: secondDocument, error: null })

    rejectFirst(new Error('open failed'))
    await first

    expect(options.openAndroidDocumentResult).toHaveBeenCalledTimes(2)
    expect(options.openAndroidDocumentResult).toHaveBeenLastCalledWith(secondDocument, {
      source: 'open-with',
      remember: true,
    })
  })

  it('routes a shared Markdown file through the shared open path', async () => {
    const { orchestration, options } = createOrchestration()

    await orchestration.handleShareDocumentEvent({
      document: { ...sharedTextDocument, sourceUri: 'content://test/shared.md', shareKind: 'stream' },
      error: null,
    })

    expect(options.openAndroidDocumentResult).toHaveBeenCalledWith(
      expect.objectContaining({ sourceUri: 'content://test/shared.md' }),
      { source: 'share', remember: false },
    )
  })

  it('imports shared text as a local draft and opens it', async () => {
    const { orchestration, options } = createOrchestration()

    await orchestration.handleShareDocumentEvent({ document: sharedTextDocument, error: null })

    expect(options.persistLocalDrafts).toHaveBeenCalledTimes(1)
    const [drafts] = options.persistLocalDrafts.mock.calls[0]
    expect(drafts[0].markdown).toBe('# Shared note')
    expect(options.documentState.value.autosaveTarget).toBe('local-draft')
    expect(options.promptLocalDraftSaveOnExit.value).toBe(true)
    expect(options.openEditor).toHaveBeenCalledWith('# Shared note')
    expect(options.status.value).toBe('Imported shared text as a local draft.')
    expect(options.releaseEditorFocusAfterOpen).toHaveBeenCalled()
  })

  it('still opens shared text when local drafts are disabled', async () => {
    const { orchestration, options } = createOrchestration({ canPersistDrafts: false })

    await orchestration.handleShareDocumentEvent({ document: sharedTextDocument, error: null })

    expect(options.persistLocalDrafts).not.toHaveBeenCalled()
    expect(options.openEditor).toHaveBeenCalledWith('# Shared note')
  })

  it('installs intent listeners once and can reinstall after removal', () => {
    const installMock = vi.mocked(installAndroidDocumentIntentListeners)
    installMock.mockClear()
    const { orchestration } = createOrchestration()

    orchestration.installListeners()
    orchestration.installListeners()
    expect(installMock).toHaveBeenCalledTimes(1)

    const handle = installMock.mock.results[0].value
    orchestration.removeListeners()
    expect(handle.remove).toHaveBeenCalledTimes(1)

    orchestration.installListeners()
    expect(installMock).toHaveBeenCalledTimes(2)
  })
})
