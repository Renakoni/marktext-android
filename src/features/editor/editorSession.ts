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

// Editor init can fail on a transient hiccup (a cold dynamic import, a WebView
// stall). Retry once transparently before surfacing the failure UI; Muya's
// core import is not cached on rejection, so a retry re-attempts cleanly.
const MAX_INIT_ATTEMPTS = 2
const INIT_RETRY_DELAY_MS = 250

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
  editorFailed: Ref<boolean>
  setEditorElement(element: HTMLElement | null): void
  getEditorElement(): HTMLElement | null
  getEditor(): MuyaEditor | null
  hasEditor(): boolean
  getEditorMarkdownSnapshot(flushPending?: boolean): string
  syncDocumentFromEditor(markDirty?: boolean, flushPending?: boolean): MarkdownDocumentState
  openEditor(markdown: string): Promise<void>
  retryEditor(): Promise<void>
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
  const editorFailed = ref(false)
  let lastOpenedMarkdown = ''

  let editor: MuyaEditor | null = null
  let editorInitToken = 0
  // Bumped per openEditor() call so a superseded open (or its retry loop) bails
  // instead of racing a newer one — a coarser guard than editorInitToken that
  // also survives the destroy/remount each attempt performs.
  let openGeneration = 0
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

  // One initialization attempt against the CURRENT host. Muya destructively
  // replaces the element it is handed (getContainer -> replaceWith), so a
  // failed attempt leaves that element detached — it must never be retried
  // against; openEditor remounts a fresh host between attempts. Returns whether
  // the editor came up, plainly failed, or was superseded by a newer open.
  async function initEditorAttempt(
    initialMarkdown: string,
    attempt: number,
  ): Promise<'ready' | 'failed' | 'superseded'> {
    const element = editorElement.value
    if (!element) {
      return 'failed'
    }

    const token = ++editorInitToken
    try {
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
        return 'superseded'
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
      editorFailed.value = false
      editorReady.value = true
      options.logger.info('Muya init complete', {
        characters: options.documentState.value.stats.characters,
        words: options.documentState.value.stats.words,
        lines: options.documentState.value.stats.lines,
      })
      return 'ready'
    } catch (error) {
      // A newer open or destroy superseded this attempt: leave its state alone.
      if (token !== editorInitToken) {
        return 'superseded'
      }
      options.logger.error('Muya init failed', { attempt, error })
      await options.setEditorSelectionMenuSuppression(false, 'editor-init-failed')
      return 'failed'
    }
  }

  // Mount a fresh, document-connected editor host. Because Muya replaces the
  // element it is given, every attempt — including the transparent retry — must
  // init against a newly mounted host, never the detached leftover of a failed
  // attempt. The home bounce forces EditorScreen to remount its host; the two
  // screen writes are batched within a frame, so no home flash is painted.
  async function remountEditorHost() {
    const wasEditorOpen = options.currentScreen.value === 'editor'
    // The remount between attempts must NOT cancel its own open loop.
    destroyEditor({ updateSelectionMenuSuppression: !wasEditorOpen, preserveOpenGeneration: true })
    if (wasEditorOpen) {
      options.currentScreen.value = 'home'
      await nextTick()
    }
    options.currentScreen.value = 'editor'
    await nextTick()
  }

  async function openEditor(markdown: string) {
    const generation = ++openGeneration
    lastOpenedMarkdown = markdown
    editorFailed.value = false
    editorReady.value = false
    options.closeEditorToolbar()

    for (let attempt = 1; attempt <= MAX_INIT_ATTEMPTS; attempt++) {
      await remountEditorHost()
      if (generation !== openGeneration) {
        return
      }

      const result = await initEditorAttempt(markdown, attempt)
      if (result === 'ready' || result === 'superseded') {
        return
      }
      if (generation !== openGeneration) {
        return
      }

      // Transparent auto-retry once: the user only sees the loading state, and
      // the next attempt gets a fresh host from the remount above. A persistent
      // failure surfaces the recovery panel.
      if (attempt < MAX_INIT_ATTEMPTS) {
        await new Promise<void>(resolve => setTimeout(resolve, INIT_RETRY_DELAY_MS))
        if (generation !== openGeneration) {
          return
        }
      } else {
        options.status.value = 'Editor failed'
        editorFailed.value = true
      }
    }
  }

  // Re-open the document that failed to initialize. The full open() loop gives
  // the retry a freshly mounted, connected host plus its own transparent retry.
  async function retryEditor() {
    await openEditor(lastOpenedMarkdown)
  }

  function destroyEditor(
    destroyOptions: { updateSelectionMenuSuppression?: boolean; preserveOpenGeneration?: boolean } = {},
  ) {
    // External teardown (Back to home, app unmount) cancels any in-flight open
    // or transparent-retry loop, so a pending retry can never remount the editor
    // behind the user after they left. Only the internal remount between retry
    // attempts sets preserveOpenGeneration to keep its own loop alive.
    if (!destroyOptions.preserveOpenGeneration) {
      openGeneration += 1
    }
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
    editorFailed,
    retryEditor,
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
