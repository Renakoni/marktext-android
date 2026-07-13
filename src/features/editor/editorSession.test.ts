// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest'
import { ref, watch } from 'vue'
import { createEditorSession, normalizeEditorMarkdown } from './editorSession'
import type { CreateMuyaEditorOptions, MuyaEditor } from './editorRuntime'
import type { AppScreen } from '../../lib/appExitDecisions'
import { createUntitledDocument } from '../../lib/documentState'
import type { AppearanceTextSettings } from '../settings/appearanceSettings'
import type { EditingSettings } from '../settings/editingSettings'

function createFakeMuyaEditor(markdown: string) {
  const domNode = document.createElement('div')
  document.body.appendChild(domNode)
  return {
    markdown,
    domNode,
    flush: vi.fn(),
    focus: vi.fn(),
    getMarkdown() {
      return this.markdown
    },
    editor: {
      selection: { getSelection: vi.fn(() => null) },
      activeContentBlock: null,
    },
  }
}

type FakeMuyaEditor = ReturnType<typeof createFakeMuyaEditor>

function createHarness(overrides: {
  screen?: AppScreen
  diagnosticsEnabled?: boolean
  createMuyaEditor?: (options: CreateMuyaEditorOptions) => Promise<MuyaEditor | null>
} = {}) {
  document.body.innerHTML = ''
  const currentScreen = ref<AppScreen>(overrides.screen ?? 'home')
  const documentState = ref(createUntitledDocument())
  const status = ref('Ready')
  const androidInputDiagnosticsEnabled = ref(overrides.diagnosticsEnabled ?? false)
  const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  const createdEditors: FakeMuyaEditor[] = []
  const createCalls: CreateMuyaEditorOptions[] = []

  const createMuyaEditor = vi.fn(async (options: CreateMuyaEditorOptions) => {
    createCalls.push(options)
    if (overrides.createMuyaEditor) {
      return overrides.createMuyaEditor(options)
    }
    if (options.isStale?.()) {
      return null
    }
    const fake = createFakeMuyaEditor(options.markdown)
    createdEditors.push(fake)
    return fake as unknown as MuyaEditor
  })

  const destroyMuyaEditor = vi.fn()
  const syncMarkdown = vi.fn()
  const setEditorSelectionMenuSuppression = vi.fn(async () => {})
  const installNativeSelectionTapListener = vi.fn(async () => {})
  const uninstallNativeSelectionTapListener = vi.fn(async () => {})
  const clearDraftSaveTimer = vi.fn()
  const clearAndroidDocumentSaveTimer = vi.fn()
  const closeEditorToolbar = vi.fn()

  const session = createEditorSession({
    currentScreen,
    documentState,
    status,
    locale: ref('en'),
    appearanceTextSettings: ref({} as AppearanceTextSettings),
    editingSettings: ref({} as EditingSettings),
    androidInputDiagnosticsEnabled,
    createMuyaEditor,
    destroyMuyaEditor,
    syncMarkdown,
    onEditorFocus: vi.fn(),
    onEditorBlur: vi.fn(),
    ensureAndroidImageResolver: vi.fn(async () => true),
    getClipboardText: () => undefined,
    setEditorSelectionMenuSuppression,
    installNativeSelectionTapListener,
    uninstallNativeSelectionTapListener,
    clearDraftSaveTimer,
    clearAndroidDocumentSaveTimer,
    closeEditorToolbar,
    logger,
  })

  const host = document.createElement('div')
  document.body.appendChild(host)
  session.setEditorElement(host)

  return {
    session,
    host,
    currentScreen,
    documentState,
    status,
    androidInputDiagnosticsEnabled,
    logger,
    createdEditors,
    createCalls,
    createMuyaEditor,
    destroyMuyaEditor,
    syncMarkdown,
    setEditorSelectionMenuSuppression,
    installNativeSelectionTapListener,
    uninstallNativeSelectionTapListener,
    clearDraftSaveTimer,
    clearAndroidDocumentSaveTimer,
    closeEditorToolbar,
  }
}

describe('editorSession', () => {
  it('normalizes the single-newline empty document to an empty string', () => {
    expect(normalizeEditorMarkdown('\n')).toBe('')
    expect(normalizeEditorMarkdown('one\n')).toBe('one\n')
  })

  it('opens the editor, wires callbacks, and reports ready', async () => {
    const harness = createHarness()

    await harness.session.openEditor('# hello')

    expect(harness.currentScreen.value).toBe('editor')
    expect(harness.session.editorReady.value).toBe(true)
    expect(harness.session.hasEditor()).toBe(true)
    expect(harness.closeEditorToolbar).toHaveBeenCalled()
    expect(harness.createCalls[0].markdown).toBe('# hello')
    expect(harness.syncMarkdown).toHaveBeenCalledWith('Ready')
    expect(harness.installNativeSelectionTapListener).toHaveBeenCalled()
    expect(harness.setEditorSelectionMenuSuppression).toHaveBeenCalledWith(true, 'editor-init')
    expect(harness.logger.info).toHaveBeenCalledWith('Muya init complete', expect.any(Object))
  })

  it('does not create an editor without a host element', async () => {
    const harness = createHarness()
    harness.session.setEditorElement(null)

    await harness.session.openEditor('text')

    expect(harness.createMuyaEditor).not.toHaveBeenCalled()
    expect(harness.session.editorReady.value).toBe(false)
    expect(harness.session.hasEditor()).toBe(false)
  })

  it('abandons a stale initialization when a newer open supersedes it', async () => {
    let releaseFirst: () => void = () => {}
    const gate = new Promise<void>(resolve => {
      releaseFirst = resolve
    })
    let call = 0
    const editors: FakeMuyaEditor[] = []
    const harness = createHarness({
      createMuyaEditor: async options => {
        call += 1
        if (call === 1) {
          await gate
        }
        if (options.isStale?.()) {
          return null
        }
        const fake = createFakeMuyaEditor(options.markdown)
        editors.push(fake)
        return fake as unknown as MuyaEditor
      },
    })

    const firstOpen = harness.session.openEditor('first')
    await vi.waitFor(() => {
      expect(call).toBe(1)
    })
    await harness.session.openEditor('second')

    expect(harness.session.editorReady.value).toBe(true)
    expect(harness.session.getEditorMarkdownSnapshot()).toBe('second')

    releaseFirst()
    await firstOpen

    // The first init resolved after being superseded: it must not replace the
    // live editor, and it resets suppression for the stale attempt.
    expect(editors).toHaveLength(1)
    expect(harness.session.getEditorMarkdownSnapshot()).toBe('second')
    expect(harness.session.editorReady.value).toBe(true)
    expect(harness.setEditorSelectionMenuSuppression).toHaveBeenCalledWith(
      false,
      'editor-init-stale',
    )
  })

  it('remounts through home when the editor screen is already open', async () => {
    const harness = createHarness()
    await harness.session.openEditor('first')
    const firstEditor = harness.createdEditors[0]
    harness.setEditorSelectionMenuSuppression.mockClear()

    const screens: string[] = []
    const unwatch = watch(harness.currentScreen, value => {
      screens.push(value)
    }, { flush: 'sync' })
    await harness.session.openEditor('second')
    unwatch()

    expect(screens).toEqual(['home', 'editor'])
    expect(harness.destroyMuyaEditor).toHaveBeenCalledWith(firstEditor)
    // Suppression stays untouched by the destroy half of a remount…
    expect(harness.setEditorSelectionMenuSuppression).not.toHaveBeenCalledWith(
      false,
      'editor-destroy',
    )
    // …and is re-established by the new initialization.
    expect(harness.session.getEditorMarkdownSnapshot()).toBe('second')
    expect(harness.session.editorReady.value).toBe(true)
  })

  it('reads snapshots and syncs the document state from the editor', async () => {
    const harness = createHarness()

    // Without an editor the snapshot is empty and the state is untouched.
    expect(harness.session.getEditorMarkdownSnapshot()).toBe('')
    const initialState = harness.documentState.value
    expect(harness.session.syncDocumentFromEditor(true)).toBe(initialState)

    await harness.session.openEditor('draft')
    const fake = harness.createdEditors[0]

    fake.markdown = 'updated text'
    expect(harness.session.getEditorMarkdownSnapshot()).toBe('updated text')
    expect(fake.flush).not.toHaveBeenCalled()
    harness.session.getEditorMarkdownSnapshot(true)
    expect(fake.flush).toHaveBeenCalledTimes(1)

    fake.markdown = '\n'
    expect(harness.session.getEditorMarkdownSnapshot()).toBe('')

    fake.markdown = 'dirty change'
    const synced = harness.session.syncDocumentFromEditor(true)
    expect(synced.markdown).toBe('dirty change')
    expect(synced.isDirty).toBe(true)
    expect(harness.documentState.value).toBe(synced)
  })

  it('destroys the editor and tears the session down', async () => {
    const harness = createHarness()
    await harness.session.openEditor('content')
    const fake = harness.createdEditors[0]

    harness.session.destroyEditor()

    expect(harness.session.editorReady.value).toBe(false)
    expect(harness.session.hasEditor()).toBe(false)
    expect(harness.session.getEditor()).toBeNull()
    expect(harness.clearDraftSaveTimer).toHaveBeenCalled()
    expect(harness.clearAndroidDocumentSaveTimer).toHaveBeenCalled()
    expect(harness.uninstallNativeSelectionTapListener).toHaveBeenCalled()
    expect(harness.destroyMuyaEditor).toHaveBeenCalledWith(fake)
    expect(harness.setEditorSelectionMenuSuppression).toHaveBeenCalledWith(
      false,
      'editor-destroy',
    )
  })

  it('skips the suppression reset when destroy is part of a remount', async () => {
    const harness = createHarness()
    await harness.session.openEditor('content')
    harness.setEditorSelectionMenuSuppression.mockClear()

    harness.session.destroyEditor({ updateSelectionMenuSuppression: false })

    expect(harness.setEditorSelectionMenuSuppression).not.toHaveBeenCalled()
  })

  it('survives repeated open and close cycles', async () => {
    const harness = createHarness()

    await harness.session.openEditor('one')
    harness.session.destroyEditor()
    await harness.session.openEditor('two')

    expect(harness.createdEditors).toHaveLength(2)
    expect(harness.session.editorReady.value).toBe(true)
    expect(harness.session.getEditorMarkdownSnapshot()).toBe('two')
    expect(harness.destroyMuyaEditor).toHaveBeenCalledWith(harness.createdEditors[0])
  })

  it('surfaces a failed initialization only after the transparent retry is exhausted', async () => {
    const harness = createHarness({
      createMuyaEditor: async () => {
        throw new Error('muya exploded')
      },
    })

    await harness.session.openEditor('content')

    // The initial attempt plus one auto-retry both ran before giving up.
    expect(harness.createMuyaEditor).toHaveBeenCalledTimes(2)
    expect(harness.status.value).toBe('Editor failed')
    expect(harness.session.editorFailed.value).toBe(true)
    expect(harness.logger.error).toHaveBeenCalledWith(
      'Muya init failed',
      expect.objectContaining({ attempt: 2, error: expect.any(Error) }),
    )
    expect(harness.setEditorSelectionMenuSuppression).toHaveBeenCalledWith(
      false,
      'editor-init-failed',
    )
    expect(harness.session.editorReady.value).toBe(false)
    expect(harness.session.hasEditor()).toBe(false)
  })

  it('retries a transient init failure once and recovers without surfacing it', async () => {
    let attempts = 0
    const harness = createHarness({
      createMuyaEditor: async options => {
        attempts += 1
        if (attempts === 1) {
          throw new Error('transient')
        }
        return createFakeMuyaEditor(options.markdown) as unknown as MuyaEditor
      },
    })

    await harness.session.openEditor('# recover')

    expect(attempts).toBe(2)
    expect(harness.session.editorReady.value).toBe(true)
    expect(harness.session.editorFailed.value).toBe(false)
    expect(harness.status.value).not.toBe('Editor failed')
    expect(harness.session.getEditorMarkdownSnapshot()).toBe('# recover')
  })

  it('reopens the failed document when retryEditor runs', async () => {
    let succeed = false
    const harness = createHarness({
      createMuyaEditor: async options => {
        if (!succeed) {
          throw new Error('still failing')
        }
        return createFakeMuyaEditor(options.markdown) as unknown as MuyaEditor
      },
    })

    await harness.session.openEditor('# retry me')
    expect(harness.session.editorFailed.value).toBe(true)
    expect(harness.session.editorReady.value).toBe(false)

    succeed = true
    await harness.session.retryEditor()

    expect(harness.session.editorFailed.value).toBe(false)
    expect(harness.session.editorReady.value).toBe(true)
    expect(harness.session.getEditorMarkdownSnapshot()).toBe('# retry me')
  })

  it('installs input diagnostics when enabled and removes them on teardown', async () => {
    const harness = createHarness({ diagnosticsEnabled: true })
    await harness.session.openEditor('content')
    const fake = harness.createdEditors[0]

    const deleteEvent = Object.assign(new Event('beforeinput'), {
      inputType: 'deleteContentBackward',
    })
    fake.domNode.dispatchEvent(deleteEvent)
    expect(harness.logger.debug).toHaveBeenCalledWith(
      'editor input event',
      expect.objectContaining({ inputType: 'deleteContentBackward' }),
    )

    // Non-delete, non-paste input stays out of the diagnostic trail.
    harness.logger.debug.mockClear()
    fake.domNode.dispatchEvent(Object.assign(new Event('beforeinput'), { inputType: 'insertText', data: 'a' }))
    expect(harness.logger.debug).not.toHaveBeenCalledWith(
      'editor input event',
      expect.anything(),
    )

    harness.session.uninstallEditorInputDiagnostics()
    fake.domNode.dispatchEvent(deleteEvent)
    expect(harness.logger.debug).not.toHaveBeenCalledWith(
      'editor input event',
      expect.anything(),
    )
  })

  it('does not install input diagnostics while disabled and supports late enabling', async () => {
    const harness = createHarness({ diagnosticsEnabled: false })
    await harness.session.openEditor('content')
    const fake = harness.createdEditors[0]

    const deleteEvent = Object.assign(new Event('beforeinput'), {
      inputType: 'deleteContentBackward',
    })
    fake.domNode.dispatchEvent(deleteEvent)
    expect(harness.logger.debug).not.toHaveBeenCalledWith(
      'editor input event',
      expect.anything(),
    )

    // The App watcher calls install after flipping the setting on.
    harness.androidInputDiagnosticsEnabled.value = true
    harness.session.installEditorInputDiagnostics()
    fake.domNode.dispatchEvent(deleteEvent)
    expect(harness.logger.debug).toHaveBeenCalledWith(
      'editor input event',
      expect.objectContaining({ inputType: 'deleteContentBackward' }),
    )
  })

  it('releases focus after opening only when focus sits inside the editor host', async () => {
    const harness = createHarness()
    const input = document.createElement('input')
    harness.host.appendChild(input)
    input.focus()
    expect(document.activeElement).toBe(input)

    harness.session.releaseEditorFocusAfterOpen()
    await new Promise<void>(resolve => {
      window.requestAnimationFrame(() => resolve())
    })

    expect(document.activeElement).not.toBe(input)
    expect(harness.logger.debug).toHaveBeenCalledWith('editor focus released after document open')
  })

  it('describes the editor input state for diagnostics collaborators', async () => {
    const harness = createHarness()

    expect(harness.session.describeEditorInputState()).toMatchObject({
      anchor: 'none',
      hasActiveBlock: false,
      modelCharacters: -1,
    })

    await harness.session.openEditor('content')
    expect(harness.session.describeEditorInputState()).toMatchObject({
      hasActiveBlock: false,
      modelCharacters: 'content'.length,
    })
  })
})
