<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { App } from '@capacitor/app'
import type { PluginListenerHandle } from '@capacitor/core'
import {
  CodeBlockLanguageSelector,
  EmojiSelector,
  InlineFormatToolbar,
  Muya,
  PreviewToolBar,
  en,
} from '@muyajs/core'
import DocumentHome from './components/DocumentHome.vue'
import {
  createAndroidMarkdownDocument,
  getAndroidDocumentErrorCode,
  getAndroidDocumentUserMessage,
  isAndroidDocumentAccessAvailable,
  openAndroidMarkdownDocument,
  readAndroidMarkdownDocument,
  writeAndroidMarkdownDocument,
  type OpenedAndroidDocument,
} from './lib/androidDocuments'
import {
  createUntitledDocument,
  getSuggestedMarkdownFileName,
  markDocumentSaved,
  markDocumentSaveFailed,
  markDocumentSaving,
  prepareMarkdownForSave,
  updateDocumentMarkdown,
} from './lib/documentState'
import {
  parseLocalDrafts,
  removeLocalDraft,
  serializeLocalDrafts,
  upsertLocalDraft,
  type LocalDraftRecord,
} from './lib/localDrafts'
import { createLogger, getNativeLogInfo } from './lib/logger'
import {
  createRecentDocumentFromAndroidDocument,
  createRecentDocumentFromLocalDraft,
  getRecentDocumentListItems,
  markRecentDocumentSaved,
  parseRecentDocuments,
  serializeRecentDocuments,
  upsertRecentDocument,
  type RecentDocumentListItem,
  type RecentDocumentRecord,
} from './lib/recentDocuments'

const LEGACY_DRAFT_STORAGE_KEY = 'marktext-for-android:draft'
const DRAFTS_STORAGE_KEY = 'marktext-for-android:drafts'
const RECENT_DOCUMENTS_STORAGE_KEY = 'marktext-for-android:recent-documents'
const DRAFT_SAVE_DELAY_MS = 800
const ANDROID_DOCUMENT_SAVE_DELAY_MS = 1200
const TRANSIENT_ANDROID_DOCUMENT_MESSAGE =
  'Saved to device. Kept local draft because Android did not grant long-term access.'

const editorPlugins = [
  InlineFormatToolbar,
  PreviewToolBar,
  CodeBlockLanguageSelector,
  EmojiSelector,
] as const

const editorElement = ref<HTMLElement | null>(null)
const documentState = ref(createUntitledDocument())
const localDrafts = ref<LocalDraftRecord[]>([])
const androidRecentDocuments = ref<RecentDocumentRecord[]>([])
const currentAndroidDocumentCanWrite = ref(false)
const status = ref('Ready')
const homeNotice = ref<string | null>(null)
const currentScreen = ref<'home' | 'editor'>('home')
const draftExitPromptOpen = ref(false)
const editorMenuOpen = ref(false)
const promptLocalDraftSaveOnExit = ref(false)
const savingLocalDraftToAndroid = ref(false)

let editor: Muya | null = null
let lastContentLogAt = 0
let draftSaveTimer: number | null = null
let androidSaveTimer: number | null = null
let androidSaveInFlight = false
let androidSaveRequestedAfterCurrent = false
let appLifecycleListenerHandles: PluginListenerHandle[] = []
let browserLifecycleListenersInstalled = false

const appLog = createLogger('app')
const editorLog = createLogger('editor')
const draftLog = createLogger('draft')
const androidDocumentLog = createLogger('android-document')
const loggingLog = createLogger('logging')

const lineCount = computed(() => documentState.value.stats.lines)
const characterCount = computed(() => documentState.value.stats.characters)
const wordCount = computed(() => documentState.value.stats.words)
const documentTitle = computed(() => documentState.value.title)
const recentDocumentRecords = computed(() =>
  [
    ...localDrafts.value.map(createRecentDocumentFromLocalDraft),
    ...androidRecentDocuments.value,
  ],
)
const documentItems = computed(() => getRecentDocumentListItems(recentDocumentRecords.value))
const continueDocumentItem = computed(() => documentItems.value[0] ?? null)
const earlierDocumentItems = computed(() => documentItems.value.slice(1))
const continueDocument = computed(() =>
  continueDocumentItem.value ? toHomeDocumentItem(continueDocumentItem.value) : null,
)
const earlierDocuments = computed(() => earlierDocumentItems.value.map(toHomeDocumentItem))

function toHomeDocumentItem(item: RecentDocumentListItem) {
  const savedAt = formatSavedTime(item.lastSavedAt ?? item.updatedAt)
  const count = item.stats ? `${item.stats.words} ${item.stats.words === 1 ? 'word' : 'words'}` : ''
  const source = item.providerName ?? 'Markdown document'

  return {
    id: item.id,
    title: item.title,
    details: [source, savedAt, count].filter(Boolean).join(' - '),
  }
}

function formatSavedTime(value: string | null) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getAndroidEditorStatus() {
  if (documentState.value.autosaveState === 'save-failed') {
    return 'Save failed'
  }

  if (!currentAndroidDocumentCanWrite.value) {
    return 'Read only'
  }

  if (documentState.value.autosaveState === 'saving' || documentState.value.isDirty) {
    return 'Saving'
  }

  return 'Saved'
}

function isLocalDraftDocument() {
  return documentState.value.autosaveTarget === 'local-draft'
}

function hasDraftContent() {
  return documentState.value.markdown.trim().length > 0
}

function shouldPromptLocalDraftSaveToDevice() {
  return promptLocalDraftSaveOnExit.value && isLocalDraftDocument() && hasDraftContent()
}

function canSaveLocalDraftToAndroidDocument() {
  return isLocalDraftDocument() && isAndroidDocumentAccessAvailable()
}

function registerMuyaPlugins() {
  editorLog.debug('register Muya plugins start', { count: editorPlugins.length })
  for (const plugin of editorPlugins) {
    if (!Muya.plugins.some(entry => entry.plugin === plugin)) {
      Muya.use(plugin)
    }
  }
  editorLog.debug('register Muya plugins complete', { registered: Muya.plugins.length })
}

function createDocumentFromDraft(draft: LocalDraftRecord) {
  return {
    ...createUntitledDocument({
      markdown: draft.markdown,
      autosaveTarget: 'local-draft',
      now: draft.updatedAt,
    }),
    id: draft.id,
    lastSavedAt: draft.lastSavedAt,
    updatedAt: draft.updatedAt,
  }
}

function createDocumentFromAndroidDocument(document: OpenedAndroidDocument) {
  const openedDocument = createUntitledDocument({
    markdown: document.markdown,
    displayName: document.displayName,
    sourceUri: document.sourceUri,
    autosaveTarget: 'android-document',
  })

  return {
    ...openedDocument,
    id: `android-document:${document.sourceUri}`,
    lastSavedAt: null,
  }
}

function normalizeEditorMarkdown(markdown: string) {
  return markdown === '\n' ? '' : markdown
}

function syncDocumentFromEditor(markDirty = false) {
  if (!editor) {
    return documentState.value
  }

  const value = normalizeEditorMarkdown(editor.getMarkdown())
  documentState.value = updateDocumentMarkdown(documentState.value, value, { markDirty })
  return documentState.value
}

function syncMarkdown(nextStatus: unknown = 'Edited') {
  if (!editor) {
    return
  }

  const resolvedStatus = typeof nextStatus === 'string' ? nextStatus : 'Edited'
  const nextMarkdown = normalizeEditorMarkdown(editor.getMarkdown())
  const markDirty = resolvedStatus === 'Edited'
  documentState.value = updateDocumentMarkdown(documentState.value, nextMarkdown, { markDirty })
  if (markDirty && documentState.value.autosaveTarget === 'android-document') {
    status.value = getAndroidEditorStatus()
    if (currentAndroidDocumentCanWrite.value) {
      scheduleAndroidDocumentSave()
    }
  } else {
    status.value = markDirty ? 'Autosaving locally' : resolvedStatus
  }
  logContentSnapshot(resolvedStatus)

  if (markDirty && documentState.value.autosaveTarget === 'local-draft') {
    scheduleDraftSave()
  }
}

function logContentSnapshot(reason: string) {
  const now = Date.now()
  if (reason === 'Edited' && now - lastContentLogAt < 1000) {
    return
  }

  lastContentLogAt = now
  editorLog.debug('content snapshot', {
    reason,
    characters: characterCount.value,
    words: wordCount.value,
    lines: lineCount.value,
  })
}

function scheduleDraftSave() {
  if (draftSaveTimer !== null) {
    window.clearTimeout(draftSaveTimer)
  }

  draftSaveTimer = window.setTimeout(saveDraft, DRAFT_SAVE_DELAY_MS)
}

function clearDraftSaveTimer() {
  if (draftSaveTimer !== null) {
    window.clearTimeout(draftSaveTimer)
    draftSaveTimer = null
  }
}

function scheduleAndroidDocumentSave() {
  if (androidSaveTimer !== null) {
    window.clearTimeout(androidSaveTimer)
  }

  androidSaveTimer = window.setTimeout(() => {
    void saveAndroidDocument()
  }, ANDROID_DOCUMENT_SAVE_DELAY_MS)
}

function clearAndroidDocumentSaveTimer() {
  if (androidSaveTimer !== null) {
    window.clearTimeout(androidSaveTimer)
    androidSaveTimer = null
  }
}

function persistLocalDrafts(nextDrafts: LocalDraftRecord[]) {
  localDrafts.value = nextDrafts

  if (nextDrafts.length > 0) {
    localStorage.setItem(DRAFTS_STORAGE_KEY, serializeLocalDrafts(nextDrafts))
  } else {
    localStorage.removeItem(DRAFTS_STORAGE_KEY)
  }

  localStorage.removeItem(LEGACY_DRAFT_STORAGE_KEY)
}

function persistAndroidRecentDocuments(nextDocuments: RecentDocumentRecord[]) {
  const filteredDocuments = nextDocuments.filter(record => record.kind === 'android-document')
  androidRecentDocuments.value = filteredDocuments

  if (filteredDocuments.length > 0) {
    localStorage.setItem(RECENT_DOCUMENTS_STORAGE_KEY, serializeRecentDocuments(filteredDocuments))
  } else {
    localStorage.removeItem(RECENT_DOCUMENTS_STORAGE_KEY)
  }
}

function markAndroidRecentDocumentSaved(savedAt: string) {
  const sourceUri = documentState.value.sourceUri
  if (!sourceUri) {
    return
  }

  const existingDocument = androidRecentDocuments.value.find(record => record.sourceUri === sourceUri)
  if (!existingDocument) {
    androidDocumentLog.warn('saved Android recent document not found', { sourceUri })
    return
  }

  persistAndroidRecentDocuments(
    upsertRecentDocument(
      androidRecentDocuments.value,
      markRecentDocumentSaved(existingDocument, {
        markdown: documentState.value.markdown,
        savedAt,
        canWrite: currentAndroidDocumentCanWrite.value,
      }),
    ),
  )
}

async function saveAndroidDocument() {
  clearAndroidDocumentSaveTimer()

  if (!editor || documentState.value.autosaveTarget !== 'android-document') {
    return
  }

  const sourceUri = documentState.value.sourceUri
  if (!sourceUri) {
    status.value = 'Save failed'
    androidDocumentLog.error('Android document save missing source URI', {
      id: documentState.value.id,
    })
    return
  }

  if (!currentAndroidDocumentCanWrite.value) {
    status.value = 'Read only'
    androidDocumentLog.debug('skip Android document autosave without write access', {
      id: documentState.value.id,
      sourceUri,
    })
    return
  }

  if (!documentState.value.isDirty && documentState.value.autosaveState !== 'save-failed') {
    return
  }

  if (androidSaveInFlight) {
    androidSaveRequestedAfterCurrent = true
    return
  }

  const value = normalizeEditorMarkdown(editor.getMarkdown())
  const nextDocument = updateDocumentMarkdown(documentState.value, value, {
    markDirty: documentState.value.isDirty,
  })
  const markdownForSave = prepareMarkdownForSave(nextDocument.markdown, nextDocument)
  const saveMarkdown = nextDocument.markdown

  androidSaveInFlight = true
  documentState.value = markDocumentSaving(nextDocument)
  status.value = 'Saving'

  try {
    await writeAndroidMarkdownDocument(sourceUri, markdownForSave)
    const savedAt = new Date().toISOString()

    if (
      documentState.value.autosaveTarget === 'android-document' &&
      documentState.value.sourceUri === sourceUri &&
      documentState.value.markdown === saveMarkdown
    ) {
      documentState.value = markDocumentSaved(
        updateDocumentMarkdown(documentState.value, saveMarkdown, {
          markDirty: false,
          now: savedAt,
        }),
        { autosaveTarget: 'android-document', now: savedAt },
      )
      markAndroidRecentDocumentSaved(savedAt)
      status.value = 'Saved'
      androidDocumentLog.info('Android document autosaved', {
        sourceUri,
        characters: saveMarkdown.length,
      })
    } else {
      androidSaveRequestedAfterCurrent = true
      androidDocumentLog.debug('Android document changed during save; scheduling another save', {
        sourceUri,
      })
    }
  } catch (error) {
    documentState.value = markDocumentSaveFailed(documentState.value, error)
    status.value = 'Save failed'
    androidDocumentLog.error('Android document autosave failed', {
      sourceUri,
      error,
    })
  } finally {
    androidSaveInFlight = false
    if (androidSaveRequestedAfterCurrent) {
      androidSaveRequestedAfterCurrent = false
      if (
        editor &&
        documentState.value.autosaveTarget === 'android-document' &&
        currentAndroidDocumentCanWrite.value
      ) {
        scheduleAndroidDocumentSave()
      }
    }
  }
}

async function saveLocalDraftToAndroidDocument(options: { returnHomeAfterSave?: boolean } = {}) {
  editorMenuOpen.value = false

  if (!editor || !isLocalDraftDocument() || savingLocalDraftToAndroid.value) {
    return false
  }

  saveDraft()
  const draftDocument = syncDocumentFromEditor(false)
  if (!draftDocument.markdown.trim()) {
    status.value = 'Ready'
    return false
  }

  const reopenPromptOnCancel = draftExitPromptOpen.value && options.returnHomeAfterSave === true
  draftExitPromptOpen.value = false
  savingLocalDraftToAndroid.value = true
  status.value = 'Choose a location'

  try {
    const markdownForSave = prepareMarkdownForSave(draftDocument.markdown, draftDocument)
    const suggestedName = getSuggestedMarkdownFileName(
      draftDocument.markdown,
      draftDocument.displayName,
    )
    const document = await createAndroidMarkdownDocument(markdownForSave, suggestedName)
    if (document.canceled) {
      status.value = 'Autosaved locally'
      if (reopenPromptOnCancel) {
        draftExitPromptOpen.value = true
      }
      androidDocumentLog.info('Android document create canceled')
      return false
    }

    const savedAt = new Date().toISOString()
    const createdDocument = {
      ...document,
      markdown: draftDocument.markdown,
    }

    if (!document.persisted) {
      status.value = TRANSIENT_ANDROID_DOCUMENT_MESSAGE
      homeNotice.value = TRANSIENT_ANDROID_DOCUMENT_MESSAGE
      currentAndroidDocumentCanWrite.value = false
      androidDocumentLog.warn('created Android document without persisted access; kept local draft', {
        displayName: document.displayName,
        sourceUri: document.sourceUri,
        characters: draftDocument.markdown.length,
      })

      if (options.returnHomeAfterSave) {
        closeEditorToHome()
      }
      return false
    }

    persistLocalDrafts(removeLocalDraft(localDrafts.value, draftDocument.id))
    rememberAndroidDocument(createdDocument)
    currentAndroidDocumentCanWrite.value = document.canWrite
    promptLocalDraftSaveOnExit.value = false
    documentState.value = markDocumentSaved(
      {
        ...createDocumentFromAndroidDocument(createdDocument),
        updatedAt: savedAt,
        lastSavedAt: savedAt,
      },
      { autosaveTarget: 'android-document', now: savedAt },
    )
    status.value = getAndroidEditorStatus()
    androidDocumentLog.info('local draft saved as Android document', {
      displayName: document.displayName,
      sourceUri: document.sourceUri,
      characters: draftDocument.markdown.length,
    })

    if (options.returnHomeAfterSave) {
      closeEditorToHome()
    }
    return true
  } catch (error) {
    documentState.value = markDocumentSaveFailed(documentState.value, error)
    status.value = getAndroidDocumentUserMessage(error)
    if (reopenPromptOnCancel) {
      draftExitPromptOpen.value = true
    }
    androidDocumentLog.error('local draft save to Android document failed', error)
    return false
  } finally {
    savingLocalDraftToAndroid.value = false
  }
}

function saveDraft() {
  clearDraftSaveTimer()

  if (!editor) {
    return
  }

  if (documentState.value.autosaveTarget !== 'local-draft') {
    androidDocumentLog.debug('skip local draft autosave for Android document', {
      id: documentState.value.id,
      sourceUri: documentState.value.sourceUri,
      autosaveState: documentState.value.autosaveState,
    })
    return
  }

  const value = normalizeEditorMarkdown(editor.getMarkdown())
  const hasContent = value.trim().length > 0
  documentState.value = markDocumentSaving(
    updateDocumentMarkdown(documentState.value, value, { markDirty: documentState.value.isDirty }),
  )

  try {
    const savedDocument = markDocumentSaved(
      updateDocumentMarkdown(documentState.value, value, { markDirty: false }),
      { autosaveTarget: 'local-draft' },
    )

    if (hasContent) {
      persistLocalDrafts(
        upsertLocalDraft(localDrafts.value, {
          id: savedDocument.id,
          markdown: savedDocument.markdown,
          updatedAt: savedDocument.updatedAt,
          lastSavedAt: savedDocument.lastSavedAt,
        }),
      )
    } else {
      persistLocalDrafts(removeLocalDraft(localDrafts.value, savedDocument.id))
    }

    documentState.value = savedDocument
    status.value = hasContent ? 'Autosaved locally' : 'Ready'
    draftLog.debug('local draft saved', {
      characters: characterCount.value,
      words: wordCount.value,
      lines: lineCount.value,
    })
  } catch (error) {
    documentState.value = markDocumentSaveFailed(documentState.value, error)
    status.value = 'Autosave failed'
    draftLog.error('local draft save failed', error)
  }
}

function initEditor(initialMarkdown: string) {
  if (!editorElement.value) {
    return
  }

  registerMuyaPlugins()

  try {
    editorLog.info('Muya init start', {
      initialCharacters: initialMarkdown.length,
    })

    editor = new Muya(editorElement.value, {
      markdown: initialMarkdown,
      fontSize: 16,
      lineHeight: 1.6,
      codeBlockLineNumbers: true,
      frontMatter: true,
      footnote: true,
      math: true,
      spellcheckEnabled: true,
      locale: en,
    })

    editor.init()
    editor.on('content-change', syncMarkdown)
    editor.on('json-change', syncMarkdown)
    editor.on('focus', () => {
      status.value =
        documentState.value.autosaveTarget === 'android-document' &&
        !currentAndroidDocumentCanWrite.value
          ? 'Read only'
          : 'Editing'
      editorLog.debug('editor focused')
    })
    editor.on('blur', () => {
      status.value =
        documentState.value.autosaveTarget === 'android-document'
          ? getAndroidEditorStatus()
          : 'Ready'
      editorLog.debug('editor blurred')
    })
    syncMarkdown('Ready')
    editorLog.info('Muya init complete', {
      characters: characterCount.value,
      words: wordCount.value,
      lines: lineCount.value,
    })
  } catch (error) {
    status.value = 'Editor failed'
    editorLog.error('Muya init failed', error)
  }
}

async function openEditor(markdown: string) {
  destroyEditor()
  currentScreen.value = 'editor'
  await nextTick()
  initEditor(markdown)
}

function rememberAndroidDocument(document: OpenedAndroidDocument) {
  const recentDocument = createRecentDocumentFromAndroidDocument({
    sourceUri: document.sourceUri,
    displayName: document.displayName,
    providerName: document.providerName,
    pathHint: document.pathHint,
    markdown: document.markdown,
    canWrite: document.canWrite,
  })

  persistAndroidRecentDocuments(upsertRecentDocument(androidRecentDocuments.value, recentDocument))
}

async function openAndroidDocumentResult(document: OpenedAndroidDocument) {
  homeNotice.value = null
  rememberAndroidDocument(document)
  promptLocalDraftSaveOnExit.value = false
  currentAndroidDocumentCanWrite.value = document.canWrite
  documentState.value = createDocumentFromAndroidDocument(document)
  androidDocumentLog.info('open Android document in editor', {
    displayName: document.displayName,
    sourceUri: document.sourceUri,
    canWrite: document.canWrite,
    persisted: document.persisted,
    characters: document.markdown.length,
  })
  await openEditor(document.markdown)
  status.value = getAndroidEditorStatus()
}

async function openFileFromAndroid() {
  homeNotice.value = null
  androidDocumentLog.info('open Android document picker')

  try {
    const document = await openAndroidMarkdownDocument()
    if (document.canceled) {
      androidDocumentLog.info('Android document picker canceled')
      return
    }

    await openAndroidDocumentResult(document)
  } catch (error) {
    const code = getAndroidDocumentErrorCode(error)
    homeNotice.value = getAndroidDocumentUserMessage(error)
    if (code === 'UNAVAILABLE') {
      androidDocumentLog.warn('Android document picker unavailable', error)
    } else {
      androidDocumentLog.error('Android document picker failed', error)
    }
  }
}

async function openDocument(id: string) {
  const recentDocument = documentItems.value.find(record => record.id === id)
  if (!recentDocument) {
    appLog.warn('recent document not found', { id })
    return
  }

  if (recentDocument.kind === 'local-draft') {
    const draft = localDrafts.value.find(record => record.id === id)
    if (!draft) {
      draftLog.warn('recent local draft not found', { id })
      return
    }

    homeNotice.value = null
    promptLocalDraftSaveOnExit.value = false
    currentAndroidDocumentCanWrite.value = false
    documentState.value = createDocumentFromDraft(draft)
    appLog.info('open recent local document', { id })
    await openEditor(draft.markdown)
    return
  }

  if (recentDocument.kind === 'android-document' && recentDocument.sourceUri) {
    homeNotice.value = null
    try {
      const document = await readAndroidMarkdownDocument(recentDocument.sourceUri)
      await openAndroidDocumentResult(document)
    } catch (error) {
      homeNotice.value = getAndroidDocumentUserMessage(error)
      androidDocumentLog.error('open recent Android document failed', {
        id,
        sourceUri: recentDocument.sourceUri,
        error,
      })
    }
    return
  }

  appLog.warn('recent document type is not openable yet', {
    id,
    kind: recentDocument.kind,
  })
}

function newDocument() {
  homeNotice.value = null
  appLog.info('create new local document')
  currentAndroidDocumentCanWrite.value = false
  promptLocalDraftSaveOnExit.value = true
  documentState.value = createUntitledDocument({ autosaveTarget: 'local-draft' })
  void openEditor('')
}

function toggleEditorMenu() {
  editorMenuOpen.value = !editorMenuOpen.value
}

function destroyEditor() {
  clearDraftSaveTimer()
  clearAndroidDocumentSaveTimer()
  editor?.destroy()
  editor = null
}

function closeEditorToHome() {
  draftExitPromptOpen.value = false
  editorMenuOpen.value = false
  destroyEditor()
  currentScreen.value = 'home'
}

async function showHome() {
  appLog.info('show recent home')
  editorMenuOpen.value = false
  if (documentState.value.autosaveTarget === 'android-document') {
    await saveAndroidDocument()
  } else {
    saveDraft()
    if (shouldPromptLocalDraftSaveToDevice()) {
      draftExitPromptOpen.value = true
      return
    }
  }
  closeEditorToHome()
}

async function flushCurrentDocument(reason: string) {
  if (currentScreen.value !== 'editor' || !editor) {
    return
  }

  appLog.info('flush current editor document', {
    reason,
    autosaveTarget: documentState.value.autosaveTarget,
    isDirty: documentState.value.isDirty,
    autosaveState: documentState.value.autosaveState,
  })

  if (documentState.value.autosaveTarget === 'android-document') {
    await saveAndroidDocument()
  } else {
    saveDraft()
  }
}

function requestLifecycleFlush(reason: string) {
  void flushCurrentDocument(reason)
}

function handleDocumentVisibilityChange() {
  if (document.hidden) {
    requestLifecycleFlush('document hidden')
  }
}

function handlePageHide() {
  requestLifecycleFlush('page hide')
}

async function handleAppBackButton() {
  appLog.info('Android back button pressed', {
    screen: currentScreen.value,
    promptOpen: draftExitPromptOpen.value,
    menuOpen: editorMenuOpen.value,
  })

  if (draftExitPromptOpen.value) {
    draftExitPromptOpen.value = false
    status.value = isLocalDraftDocument() ? 'Autosaved locally' : status.value
    return
  }

  if (editorMenuOpen.value) {
    editorMenuOpen.value = false
    return
  }

  if (currentScreen.value === 'editor') {
    await showHome()
    return
  }

  try {
    await App.exitApp()
  } catch (error) {
    appLog.warn('Android back exit unavailable', error)
  }
}

function installAppLifecycleListeners() {
  if (!browserLifecycleListenersInstalled) {
    browserLifecycleListenersInstalled = true
    document.addEventListener('visibilitychange', handleDocumentVisibilityChange)
    window.addEventListener('pagehide', handlePageHide)
  }

  void Promise.all([
    App.addListener('backButton', () => {
      void handleAppBackButton()
    }),
    App.addListener('pause', () => {
      requestLifecycleFlush('app pause')
    }),
    App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        requestLifecycleFlush('app inactive')
      }
    }),
  ])
    .then(handles => {
      appLifecycleListenerHandles = handles
      appLog.info('app lifecycle listeners installed')
    })
    .catch(error => {
      appLog.warn('app lifecycle listeners unavailable', error)
    })
}

function removeAppLifecycleListeners() {
  if (browserLifecycleListenersInstalled) {
    browserLifecycleListenersInstalled = false
    document.removeEventListener('visibilitychange', handleDocumentVisibilityChange)
    window.removeEventListener('pagehide', handlePageHide)
  }

  const handles = appLifecycleListenerHandles
  appLifecycleListenerHandles = []
  for (const handle of handles) {
    void handle.remove()
  }
}

function keepLocalDraftAndShowHome() {
  appLog.info('keep local draft and show recent home')
  promptLocalDraftSaveOnExit.value = false
  saveDraft()
  closeEditorToHome()
}

function discardLocalDraftAndShowHome() {
  appLog.info('discard local draft and show recent home', { id: documentState.value.id })
  promptLocalDraftSaveOnExit.value = false
  persistLocalDrafts(removeLocalDraft(localDrafts.value, documentState.value.id))
  closeEditorToHome()
}

onMounted(() => {
  appLog.info('app mounted')
  installAppLifecycleListeners()
  const restoredDrafts = parseLocalDrafts(localStorage.getItem(DRAFTS_STORAGE_KEY))
  const restoredRecentDocuments = parseRecentDocuments(
    localStorage.getItem(RECENT_DOCUMENTS_STORAGE_KEY),
  ).filter(record => record.kind === 'android-document')
  const legacyDraft = localStorage.getItem(LEGACY_DRAFT_STORAGE_KEY)

  androidRecentDocuments.value = restoredRecentDocuments

  if (restoredDrafts.length > 0) {
    localDrafts.value = restoredDrafts
    documentState.value = createDocumentFromDraft(restoredDrafts[0])
  } else if (legacyDraft?.trim()) {
    const migratedDocument = createUntitledDocument({
      markdown: legacyDraft,
      autosaveTarget: 'local-draft',
    })
    const migratedDraft = {
      id: migratedDocument.id,
      markdown: migratedDocument.markdown,
      updatedAt: migratedDocument.updatedAt,
      lastSavedAt: migratedDocument.lastSavedAt,
    }
    persistLocalDrafts([migratedDraft])
    documentState.value = migratedDocument
  } else {
    documentState.value = createUntitledDocument({ autosaveTarget: 'local-draft' })
  }

  draftLog.info('local draft checked', {
    restoredDrafts: localDrafts.value.length,
    restoredAndroidDocuments: androidRecentDocuments.value.length,
    characters: characterCount.value,
  })

  getNativeLogInfo().then(info => {
    if (info) {
      loggingLog.info('native logging ready', info)
    } else {
      loggingLog.warn('native logging unavailable')
    }
  })
})

onBeforeUnmount(() => {
  appLog.info('app before unmount')
  removeAppLifecycleListeners()
  if (documentState.value.autosaveTarget === 'android-document') {
    void saveAndroidDocument()
  } else {
    saveDraft()
  }
  destroyEditor()
})
</script>

<template>
  <main v-if="currentScreen === 'home'" class="app-shell is-home">
    <DocumentHome
      :continue-document="continueDocument"
      :earlier-documents="earlierDocuments"
      :notice="homeNotice"
      @new-document="newDocument"
      @open-document="openDocument"
      @open-file="openFileFromAndroid"
    />
  </main>

  <main v-else class="app-shell">
    <header class="top-bar">
      <button class="nav-button" type="button" data-testid="back-button" @click="showHome">Back</button>
      <div class="document-heading">
        <span>MarkText Android</span>
        <h1>{{ documentTitle }}</h1>
        <p>{{ status }}</p>
      </div>
      <div v-if="canSaveLocalDraftToAndroidDocument()" class="editor-actions">
        <button
          class="menu-button"
          type="button"
          aria-label="More actions"
          :aria-expanded="editorMenuOpen"
          data-testid="editor-menu-button"
          @click="toggleEditorMenu"
        >
          ...
        </button>
        <div v-if="editorMenuOpen" class="editor-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            data-testid="save-to-device-button"
            :disabled="savingLocalDraftToAndroid"
            @click="() => saveLocalDraftToAndroidDocument()"
          >
            Save to device
          </button>
        </div>
      </div>
    </header>

    <section class="editor-pane" aria-label="Markdown editor">
      <div ref="editorElement" class="muya-host" data-testid="editor-host" />
    </section>

    <footer class="status-bar">
      <span>{{ wordCount }} words</span>
      <span>{{ characterCount }} chars</span>
      <span>{{ lineCount }} lines</span>
    </footer>

    <section
      v-if="draftExitPromptOpen"
      class="draft-save-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="draft-save-title"
      data-testid="draft-save-prompt"
    >
      <div class="draft-save-panel">
        <h2 id="draft-save-title">Save this draft to your device?</h2>
        <p>This draft is saved inside MarkText, but it has not been saved as a Markdown file yet.</p>
        <div class="draft-save-actions">
          <button
            v-if="canSaveLocalDraftToAndroidDocument()"
            class="primary-action"
            type="button"
            data-testid="prompt-save-to-device-button"
            :disabled="savingLocalDraftToAndroid"
            @click="saveLocalDraftToAndroidDocument({ returnHomeAfterSave: true })"
          >
            Save to device
          </button>
          <button
            type="button"
            data-testid="prompt-keep-draft-button"
            :disabled="savingLocalDraftToAndroid"
            @click="keepLocalDraftAndShowHome"
          >
            Keep as draft
          </button>
          <button
            class="danger-action"
            type="button"
            data-testid="prompt-discard-draft-button"
            :disabled="savingLocalDraftToAndroid"
            @click="discardLocalDraftAndShowHome"
          >
            Discard
          </button>
        </div>
      </div>
    </section>
  </main>
</template>
