import { nextTick, ref, type Ref } from 'vue'
import type { AppScreen } from '../../lib/appExitDecisions'
import { installAndroidSelectionDiagnostics } from '../../lib/androidSelectionDiagnostics'
import {
  updateDocumentMarkdown,
  type MarkdownDocumentState,
} from '../../lib/documentState'
import type { AppearanceTextSettings } from '../settings/appearanceSettings'
import type { EditingSettings } from '../settings/editingSettings'
import { readEditorMarkdownSnapshot } from './editorMarkdownSnapshot'
import { resolveEditorDomNode } from './editorInlineInsert'
import type { CreateMuyaEditorOptions, MuyaEditor } from './editorRuntime'

const ENABLE_ANDROID_SELECTION_ACTION_MODE_SUPPRESSION = true
// Heavy per-event selection checkpoints are a debugging tool, not a product
// behavior: leave off unless actively diagnosing selection lifecycle issues.
const ENABLE_ANDROID_SELECTION_DIAGNOSTICS = false

interface EditorSessionLogger {
  debug(message: string, context?: unknown): void
  info(message: string, context?: unknown): void
  warn(message: string, context?: unknown): void
  error(message: string, context?: unknown): void
}

export interface EditorSessionOptions {
  // App-owned state the session reads and writes.
  currentScreen: Ref<AppScreen>
  documentState: Ref<MarkdownDocumentState>
  status: Ref<string>
  // Settings snapshots the editor is created with; live updates stay with the
  // App watchers that call the editorRuntime apply helpers.
  locale: Ref<string>
  appearanceTextSettings: Ref<AppearanceTextSettings>
  editingSettings: Ref<EditingSettings>
  androidInputDiagnosticsEnabled: Ref<boolean>
  // Muya runtime.
  createMuyaEditor: (options: CreateMuyaEditorOptions) => Promise<MuyaEditor | null>
  destroyMuyaEditor: (editor: MuyaEditor | null) => void
  // Editor-content handlers owned by App (status + autosave coordination).
  syncMarkdown: (nextStatus?: unknown) => void
  onEditorFocus: () => void
  onEditorBlur: () => void
  // Collaborators owned by App or sibling factories.
  ensureAndroidImageResolver: () => Promise<unknown>
  getClipboardText: () => (() => Promise<string>) | undefined
  setEditorSelectionMenuSuppression: (suppressed: boolean, reason: string) => Promise<void>
  installNativeSelectionTapListener: () => Promise<void>
  uninstallNativeSelectionTapListener: () => Promise<void>
  clearDraftSaveTimer: () => void
  clearAndroidDocumentSaveTimer: () => void
  closeEditorToolbar: () => void
  logger: EditorSessionLogger
}

export interface EditorSession {
  editorReady: Ref<boolean>
  setEditorElement(element: HTMLElement | null): void
  getEditorElement(): HTMLElement | null
  getEditor(): MuyaEditor | null
  hasEditor(): boolean
  getEditorMarkdownSnapshot(flushPending?: boolean): string
  syncDocumentFromEditor(markDirty?: boolean, flushPending?: boolean): MarkdownDocumentState
  openEditor(markdown: string): Promise<void>
  destroyEditor(options?: { updateSelectionMenuSuppression?: boolean }): void
  releaseEditorFocusAfterOpen(): void
  installEditorInputDiagnostics(): void
  uninstallEditorInputDiagnostics(): void
  describeEditorInputState(): Record<string, unknown>
}

// Muya reports an empty document as a single newline; treat that as empty for
// titles, autosave, and change detection.
export function normalizeEditorMarkdown(markdown: string) {
  return markdown === '\n' ? '' : markdown
}

/**
 * Owns the Muya editor instance and its runtime lifecycle: initialization with
 * stale-init token protection, the destroy/remount cycle behind opening a
 * document, Markdown snapshots and document-state sync, post-open focus
 * release, and the input/selection diagnostic hooks. Status text, autosave
 * scheduling, toolbar behavior, and navigation policy stay with App and are
 * reached only through the injected collaborators.
 */
export function createEditorSession(options: EditorSessionOptions): EditorSession {
  const editorElement = ref<HTMLElement | null>(null)
  const editorReady = ref(false)

  let editor: MuyaEditor | null = null
  let editorInitToken = 0
  let editorSelectionDiagnosticCleanup: (() => void) | null = null
  let editorInputDiagnosticCleanup: (() => void) | null = null

  function setEditorElement(element: HTMLElement | null) {
    editorElement.value = element
  }

  function getEditorElement() {
    return editorElement.value
  }

  function getEditor() {
    return editor
  }

  function hasEditor() {
    return Boolean(editor)
  }

  function getEditorMarkdownSnapshot(flushPending = false) {
    if (!editor) {
      return ''
    }

    return readEditorMarkdownSnapshot(editor, {
      flushPending,
      normalizeMarkdown: normalizeEditorMarkdown,
    })
  }

  function syncDocumentFromEditor(markDirty = false, flushPending = false) {
    if (!editor) {
      return options.documentState.value
    }

    const value = getEditorMarkdownSnapshot(flushPending)
    options.documentState.value = updateDocumentMarkdown(options.documentState.value, value, {
      markDirty,
    })
    return options.documentState.value
  }

  async function initEditor(initialMarkdown: string) {
    const element = editorElement.value
    if (!element) {
      return
    }

    try {
      const token = ++editorInitToken
      try {
        await options.ensureAndroidImageResolver()
      } catch (error) {
        options.logger.warn('Android image resolver unavailable during editor init', error)
      }
      const nextEditor = await options.createMuyaEditor({
        element,
        markdown: initialMarkdown,
        onContentChange: options.syncMarkdown,
        onJsonChange: options.syncMarkdown,
        onFocus: options.onEditorFocus,
        onBlur: options.onEditorBlur,
        appLocale: options.locale.value,
        appearanceTextSettings: options.appearanceTextSettings.value,
        editingSettings: options.editingSettings.value,
        clipboardText: options.getClipboardText(),
        isStale: () => token !== editorInitToken || !editorElement.value,
        logger: options.logger,
      })
      if (!nextEditor) {
        await options.setEditorSelectionMenuSuppression(false, 'editor-init-stale')
        return
      }

      editor = nextEditor
      installEditorSelectionDiagnostics()
      installEditorInputDiagnostics()
      void options.installNativeSelectionTapListener()
      await options.setEditorSelectionMenuSuppression(
        ENABLE_ANDROID_SELECTION_ACTION_MODE_SUPPRESSION,
        ENABLE_ANDROID_SELECTION_ACTION_MODE_SUPPRESSION
          ? 'editor-init'
          : 'editor-init-baseline-disabled',
      )
      options.syncMarkdown('Ready')
      editorReady.value = true
      options.logger.info('Muya init complete', {
        characters: options.documentState.value.stats.characters,
        words: options.documentState.value.stats.words,
        lines: options.documentState.value.stats.lines,
      })
    } catch (error) {
      options.status.value = 'Editor failed'
      options.logger.error('Muya init failed', error)
      await options.setEditorSelectionMenuSuppression(false, 'editor-init-failed')
    }
  }

  async function openEditor(markdown: string) {
    editorReady.value = false
    options.closeEditorToolbar()
    const wasEditorOpen = options.currentScreen.value === 'editor'
    destroyEditor({ updateSelectionMenuSuppression: !wasEditorOpen })
    if (wasEditorOpen) {
      options.currentScreen.value = 'home'
      await nextTick()
    }

    options.currentScreen.value = 'editor'
    await nextTick()
    await initEditor(markdown)
  }

  function destroyEditor(destroyOptions: { updateSelectionMenuSuppression?: boolean } = {}) {
    editorInitToken += 1
    editorReady.value = false
    options.clearDraftSaveTimer()
    options.clearAndroidDocumentSaveTimer()
    uninstallEditorSelectionDiagnostics()
    uninstallEditorInputDiagnostics()
    void options.uninstallNativeSelectionTapListener()
    options.destroyMuyaEditor(editor)
    editor = null
    if (destroyOptions.updateSelectionMenuSuppression !== false) {
      void options.setEditorSelectionMenuSuppression(false, 'editor-destroy')
    }
  }

  function releaseEditorFocusAfterOpen() {
    window.requestAnimationFrame(() => {
      const activeElement = document.activeElement
      if (activeElement instanceof HTMLElement && editorElement.value?.contains(activeElement)) {
        activeElement.blur()
        options.logger.debug('editor focus released after document open')
      }
    })
  }

  function installEditorSelectionDiagnostics() {
    uninstallEditorSelectionDiagnostics()

    if (!ENABLE_ANDROID_SELECTION_DIAGNOSTICS) {
      return
    }

    const root = resolveEditorDomNode(editor, editorElement.value)
    if (!root) {
      return
    }

    editorSelectionDiagnosticCleanup = installAndroidSelectionDiagnostics({
      root,
      getFallbackRoot: () => editorElement.value,
      logger: options.logger,
    })
  }

  function uninstallEditorSelectionDiagnostics() {
    editorSelectionDiagnosticCleanup?.()
    editorSelectionDiagnosticCleanup = null
  }

  function describeEditorInputState() {
    const selection = document.getSelection()
    const anchorNode = selection?.anchorNode ?? null
    const anchorElement =
      anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement ?? null
    const muyaSelection = editor?.editor.selection.getSelection() ?? null

    return {
      anchor: anchorNode
        ? `${anchorNode.nodeName}[${String(anchorElement?.className ?? '').slice(0, 44)}]@${selection?.anchorOffset}`
        : 'none',
      anchorInContent: Boolean(anchorElement?.closest?.('span.mu-content')),
      collapsed: selection?.isCollapsed ?? null,
      muyaSelection: muyaSelection
        ? {
            sameBlock: muyaSelection.isSelectionInSameBlock,
            anchorOffset: muyaSelection.anchor.offset,
            focusOffset: muyaSelection.focus.offset,
          }
        : null,
      hasActiveBlock: Boolean(editor?.editor.activeContentBlock),
      modelCharacters: editor?.getMarkdown().length ?? -1,
    }
  }

  function installEditorInputDiagnostics() {
    uninstallEditorInputDiagnostics()

    if (!options.androidInputDiagnosticsEnabled.value) {
      return
    }

    const root = resolveEditorDomNode(editor, editorElement.value)
    if (!root) {
      return
    }

    const handler = (event: Event) => {
      const inputEvent = event as InputEvent
      const inputType = inputEvent.inputType ?? ''
      const eventText = inputEvent.dataTransfer?.getData('text/plain') ?? inputEvent.data ?? ''
      const isDelete = inputType.startsWith('delete')
      // Paste-like inserts (IME clipboard chips commit these) are the known
      // model-divergence trigger, so keep them in the diagnostic trail too.
      const isPasteLike =
        inputType === 'insertFromPaste' ||
        inputType === 'insertReplacementText' ||
        (inputType.startsWith('insert') && /[\r\n]/.test(eventText))
      if (!isDelete && !isPasteLike) {
        return
      }

      const target = event.target
      const targetName =
        target instanceof Element
          ? `${target.nodeName}[${String(target.className).slice(0, 44)}]`
          : 'none'
      options.logger.debug('editor input event', {
        phase: event.type,
        inputType,
        cancelable: event.cancelable,
        dataLength: eventText.length,
        target: targetName,
        ...describeEditorInputState(),
      })
    }

    root.addEventListener('beforeinput', handler, true)
    root.addEventListener('input', handler, true)
    editorInputDiagnosticCleanup = () => {
      root.removeEventListener('beforeinput', handler, true)
      root.removeEventListener('input', handler, true)
    }
  }

  function uninstallEditorInputDiagnostics() {
    editorInputDiagnosticCleanup?.()
    editorInputDiagnosticCleanup = null
  }

  return {
    editorReady,
    setEditorElement,
    getEditorElement,
    getEditor,
    hasEditor,
    getEditorMarkdownSnapshot,
    syncDocumentFromEditor,
    openEditor,
    destroyEditor,
    releaseEditorFocusAfterOpen,
    installEditorInputDiagnostics,
    uninstallEditorInputDiagnostics,
    describeEditorInputState,
  }
}
