<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { App } from '@capacitor/app'
import HomeScreen from './features/home/HomeScreen.vue'
import EditorScreen from './features/editor/EditorScreen.vue'
import {
  createAndroidMarkdownDocument,
  configureAndroidMarkdownSettings,
  getAndroidDocumentErrorCode,
  getAndroidDocumentUserMessage,
  isAndroidDocumentAccessAvailable,
  openAndroidMarkdownDocument,
  readAndroidMarkdownDocument,
  shareAndroidMarkdownDocument,
  writeAndroidMarkdownDocument,
  type AndroidOpenWithDocumentEvent,
  type AndroidShareDocumentEvent,
  type OpenedAndroidDocument,
  type SharedAndroidDocument,
} from './lib/androidDocuments'
import {
  ensureAndroidImageResolver,
  getAndroidImageUserMessage,
  isAndroidImageImportAvailable,
  pickAndroidImageDocument,
} from './lib/androidImages'
import {
  installAppLifecycleListeners as installAppLifecycleListenerHandles,
  type AppLifecycleListeners,
} from './lib/appLifecycleListeners'
import {
  installAndroidDocumentIntentListeners as installAndroidDocumentIntentListenerHandles,
  type AndroidDocumentIntentListeners,
} from './features/android-documents/androidDocumentIntentListeners'
import {
  getAppBackButtonAction,
  getShowHomeAfterAndroidSaveAction,
  getShowHomeAfterLocalDraftSaveAction,
  getShowHomeDocumentSaveAction,
  type AppScreen,
} from './lib/appExitDecisions'
import {
  createAndroidRecoveryDraft,
  getAndroidRecoveryDraftId,
  isAndroidRecoveryDraftId,
} from './features/android-documents/androidRecoveryDrafts'
import {
  markSavedAndroidRecentDocument,
  rememberAndroidRecentDocument,
} from './features/android-documents/androidRecentDocuments'
import { getImageSharingSettings } from './features/android-documents/imageSharingSettings'
import {
  createUntitledDocument,
  markDocumentSaveFailed,
  updateDocumentMarkdown,
} from './lib/documentState'
import {
  createDocumentStateFromLocalDraft,
} from './features/document-session/documentSessionState'
import {
  getDocumentSettings,
  getSortedRecentDocumentListItems,
} from './features/document-session/documentSettings'
import {
  createAndroidDocumentOpenResult,
  createAndroidOpenWithDocumentEventAction,
  createAndroidShareDocumentEventAction,
  createSharedTextDocumentOpenResult,
  getIncomingDocumentPreservationAction,
  openAndroidMarkdownDocumentWorkflow,
  shouldKeepAndroidRecoveryAfterPreserveFailure,
  type AndroidDocumentOpenSource,
} from './features/android-documents/androidDocumentOpenWorkflow'
import {
  createSaveAndroidDocumentWorkflowStart,
  saveAndroidDocumentWorkflow,
} from './features/android-documents/saveAndroidDocumentWorkflow'
import { saveAndroidDocumentCopyWorkflow } from './features/android-documents/saveAndroidDocumentCopyWorkflow'
import { saveLocalDraftToAndroidDocumentWorkflow } from './features/android-documents/saveLocalDraftToAndroidDocumentWorkflow'
import { shareAndroidMarkdownDocumentWorkflow } from './features/android-documents/shareAndroidMarkdownDocumentWorkflow'
import {
  createAndroidImageInsertStart,
  createLinkInsertSheetWorkflow,
  insertAndroidImageWorkflow,
  insertLinkFromSheetWorkflow,
  normalizeToolbarSelectionText,
  runEditorToolbarCommandWorkflow,
  scheduleEditorToolbarSync,
} from './features/editor/editorToolbarWorkflow'
import { useEditorToolbar } from './features/editor/useEditorToolbar'
import {
  captureSelectionWithin,
  insertTextAtRestoredSelection,
  resolveEditorDomNode,
} from './features/editor/editorInlineInsert'
import {
  applyMuyaAppearanceSettings,
  applyMuyaEditingSettings,
  applyMuyaEditorLocale,
  createMuyaEditor,
  destroyMuyaEditor,
  type MuyaEditor,
} from './features/editor/editorRuntime'
import {
  removeLocalDraft,
  upsertLocalDraft,
  type LocalDraftRecord,
} from './lib/localDrafts'
import { createLocalDraftAutosaveResult } from './features/local-drafts/localDraftAutosave'
import {
  readLegacyDraft,
  readStoredAndroidRecentDocuments,
  readStoredLocalDrafts,
  writeStoredAndroidRecentDocuments,
  writeStoredLocalDrafts,
} from './lib/documentStorage'
import {
  createLogger,
  exportNativeLogs,
  getNativeLogInfo,
  isNativeLoggerAvailable,
} from './lib/logger'
import {
  type MobileCommandId,
  type MobileEditorCommandTarget,
} from './lib/mobileCommands'
import { DEFAULT_HOME_TAB, HOME_TABS, type HomeTab } from './features/home/homeNavigation'
import { toHomeDocumentItem, type HomeDocumentText } from './features/home/homeDocuments'
import {
  DEFAULT_SETTINGS_PAGE,
  SETTINGS_PAGES,
  type SettingsPage,
} from './features/settings/settingsNavigation'
import { useSettingsState } from './features/settings/settingsState'
import {
  getAppearanceTextSettings,
  getEditorStyleVars,
} from './features/settings/appearanceSettings'
import { getEditingSettings } from './features/settings/editingSettings'
import {
  getAdvancedSettings,
  getAndroidMarkdownSettings,
  getMarkdownSaveSettings,
  type AdvancedMaintenanceActionId,
} from './features/settings/advancedSettings'
import { createMuyaMobileEditorCommandTarget } from './lib/muyaMobileAdapter'
import { translateKnownText, useI18n } from './lib/i18n'
import {
  createRecentDocumentFromLocalDraft,
  getRecentDocumentListItems,
  type RecentDocumentRecord,
} from './lib/recentDocuments'

const TRANSIENT_ANDROID_DOCUMENT_MESSAGE =
  'Saved to device. Kept local draft because Android did not grant long-term access.'
const TRANSIENT_ANDROID_DOCUMENT_WITHOUT_DRAFT_MESSAGE =
  'Saved to device. Reopen it from Android to keep editing later.'
const OPEN_WITH_TEMPORARY_ACCESS_MESSAGE =
  'Opened with temporary Android access. Save a copy to keep editing later.'
const SHARE_TEMPORARY_ACCESS_MESSAGE =
  'Opened from Android share with temporary access. Save a copy to keep editing later.'
const SHARED_TEXT_IMPORTED_MESSAGE = 'Imported shared text as a local draft.'
const ANDROID_SAVE_RECOVERY_MESSAGE = 'Save failed. A local recovery draft was kept.'
const ANDROID_EXIT_RECOVERY_MESSAGE = 'Unsaved changes were kept as a recovery draft.'
const ANDROID_EXIT_DISCARD_MESSAGE = 'Unsaved changes were discarded.'

const editorElement = ref<HTMLElement | null>(null)
const documentState = ref(createUntitledDocument())
const localDrafts = ref<LocalDraftRecord[]>([])
const androidRecentDocuments = ref<RecentDocumentRecord[]>([])
const currentAndroidDocumentCanWrite = ref(false)
const status = ref('Ready')
const homeNotice = ref<string | null>(null)
const currentScreen = ref<AppScreen>('home')
const homeTab = ref<HomeTab>(DEFAULT_HOME_TAB)
const settingsPage = ref<SettingsPage>(DEFAULT_SETTINGS_PAGE)
const editorReady = ref(false)
const draftExitPromptOpen = ref(false)
const androidExitPromptOpen = ref(false)
const promptLocalDraftSaveOnExit = ref(false)
const savingLocalDraftToAndroid = ref(false)
const savingAndroidDocumentCopy = ref(false)
const sharingCurrentDocument = ref(false)
const {
  editorMenuOpen,
  editorToolbarExpanded,
  editorToolbarPanel,
  linkSheetOpen,
  linkText,
  linkUrl,
  importingAndroidImage,
  toggleEditorMenu,
  closeEditorMenu,
  toggleEditorToolbar,
  setEditorToolbarPanel,
  closeEditorToolbar,
  openLinkSheet: openEditorLinkSheet,
  closeLinkSheet: resetEditorLinkSheet,
} = useEditorToolbar()
const { locale, setLocale, t } = useI18n()
const { getValue, clearSettings } = useSettingsState()
const appearanceTextSettings = computed(() => getAppearanceTextSettings(getValue))
const editingSettings = computed(() => getEditingSettings(getValue))
const documentSettings = computed(() => getDocumentSettings(getValue))
const imageSharingSettings = computed(() => getImageSharingSettings(getValue))
const advancedSettings = computed(() => getAdvancedSettings(getValue))
const androidMarkdownSettings = computed(() => getAndroidMarkdownSettings(advancedSettings.value))
const detectedDocumentEncoding = computed(() =>
  documentState.value.autosaveTarget === 'android-document'
    ? documentState.value.encoding
    : undefined,
)
const markdownSaveSettings = computed(() =>
  getMarkdownSaveSettings(advancedSettings.value, detectedDocumentEncoding.value),
)
const editorStyleVars = computed(() => getEditorStyleVars(appearanceTextSettings.value))
const displayStatus = computed(() => translateKnownText(status.value))
const displayHomeNotice = computed(() =>
  homeNotice.value ? translateKnownText(homeNotice.value) : null,
)
const homeDocumentText = computed<HomeDocumentText>(() => ({
  localDraftSource: t('home.source.localDraft'),
  markdownDocumentSource: t('home.source.markdownDocument'),
  detailsSeparator: t('home.detailsSeparator'),
  formatWordCount: count =>
    t(count === 1 ? 'home.wordCount.one' : 'home.wordCount.other', { count }),
}))

function setEditorElement(element: HTMLElement | null) {
  editorElement.value = element
}

let editor: MuyaEditor | null = null
let editorInitToken = 0
let lastContentLogAt = 0
let draftSaveTimer: number | null = null
let androidSaveTimer: number | null = null
let androidSaveInFlight = false
let androidSaveRequestedAfterCurrent = false
let appLifecycleListeners: AppLifecycleListeners | null = null
let androidDocumentIntentListeners: AndroidDocumentIntentListeners | null = null
let pendingInlineInsertRange: Range | null = null
let startupActionTimer: number | null = null

const appLog = createLogger('app')
const editorLog = createLogger('editor')
const draftLog = createLogger('draft')
const androidDocumentLog = createLogger('android-document')
const loggingLog = createLogger('logging')

watch(appearanceTextSettings, settings => {
  applyMuyaAppearanceSettings(editor, settings)
})

watch(editingSettings, (settings, previousSettings) => {
  applyMuyaEditingSettings(editor, settings, previousSettings)
})

watch(documentSettings, (settings, previousSettings) => {
  if (!settings.localDrafts) {
    clearDraftSaveTimer()
  }

  if (!settings.autoSave) {
    clearDraftSaveTimer()
    clearAndroidDocumentSaveTimer()
    return
  }

  if (!editor || currentScreen.value !== 'editor' || !documentState.value.isDirty) {
    return
  }

  const autoSaveWasEnabled = previousSettings?.autoSave ?? settings.autoSave
  const delayChanged = previousSettings?.autoSaveDelayMs !== settings.autoSaveDelayMs
  if (!autoSaveWasEnabled || delayChanged) {
    if (documentState.value.autosaveTarget === 'android-document') {
      scheduleAndroidDocumentSave()
    } else if (settings.localDrafts) {
      scheduleDraftSave()
    }
  }
})

watch(
  androidMarkdownSettings,
  settings => {
    if (!isAndroidDocumentAccessAvailable()) {
      return
    }

    configureAndroidMarkdownSettings(settings).catch(error => {
      androidDocumentLog.warn('Android Markdown settings update failed', error)
    })
  },
  { immediate: true },
)

watch(locale, nextLocale => {
  void applyMuyaEditorLocale(editor, nextLocale, editorLog)
})

const lineCount = computed(() => documentState.value.stats.lines)
const characterCount = computed(() => documentState.value.stats.characters)
const wordCount = computed(() => documentState.value.stats.words)
const documentTitle = computed(() => documentState.value.title)
const displayDocumentTitle = computed(() => {
  const untitledMatch = documentState.value.displayName.match(/^Untitled-(\d+)$/)
  if (
    untitledMatch &&
    documentState.value.sourceUri === null &&
    documentState.value.title === documentState.value.displayName &&
    documentState.value.markdown.trim() === ''
  ) {
    return t('document.untitledNumbered', { index: untitledMatch[1] })
  }

  return documentTitle.value
})
const recentDocumentRecords = computed(() =>
  [
    ...localDrafts.value
      .filter(draft => shouldShowLocalDraftRecord(draft.id))
      .map(createRecentDocumentFromLocalDraft),
    ...androidRecentDocuments.value,
  ],
)
const recentActivityDocumentItems = computed(() => getRecentDocumentListItems(recentDocumentRecords.value))
const documentItems = computed(() =>
  getSortedRecentDocumentListItems(recentDocumentRecords.value, documentSettings.value),
)
const continueDocumentItem = computed(() => documentItems.value[0] ?? null)
const earlierDocumentItems = computed(() => documentItems.value.slice(1))
const continueDocument = computed(() =>
  continueDocumentItem.value
    ? toHomeDocumentItem(continueDocumentItem.value, homeDocumentText.value, locale.value)
    : null,
)
const earlierDocuments = computed(() =>
  earlierDocumentItems.value.map(item =>
    toHomeDocumentItem(item, homeDocumentText.value, locale.value),
  ),
)

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

function shouldShowLocalDraftRecord(id: string) {
  return isAndroidRecoveryDraftId(id)
    ? documentSettings.value.recoveryDrafts
    : documentSettings.value.localDrafts
}

function canPersistLocalDrafts() {
  return documentSettings.value.localDrafts
}

function canPersistAndroidRecoveryDrafts() {
  return documentSettings.value.recoveryDrafts
}

function canRunIdleLocalDraftAutosave() {
  return documentSettings.value.autoSave && canPersistLocalDrafts()
}

function canRunIdleAndroidDocumentAutosave() {
  return documentSettings.value.autoSave
}

function getTransientAndroidSaveMessage() {
  return canPersistLocalDrafts()
    ? TRANSIENT_ANDROID_DOCUMENT_MESSAGE
    : TRANSIENT_ANDROID_DOCUMENT_WITHOUT_DRAFT_MESSAGE
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

function canSaveAndroidDocumentCopy() {
  return documentState.value.autosaveTarget === 'android-document' && isAndroidDocumentAccessAvailable()
}

function canShareCurrentDocument() {
  return isAndroidDocumentAccessAvailable()
}

function canShowEditorActions() {
  return canShareCurrentDocument() || canSaveLocalDraftToAndroidDocument() || canSaveAndroidDocumentCopy()
}

function shouldPromptAndroidExitAfterSaveFailure() {
  return (
    documentState.value.autosaveTarget === 'android-document' &&
    documentState.value.isDirty &&
    hasDraftContent() &&
    (documentState.value.autosaveState === 'save-failed' || !currentAndroidDocumentCanWrite.value)
  )
}

function getAndroidExitPromptMessage() {
  if (!currentAndroidDocumentCanWrite.value) {
    return t('editor.exit.androidReadOnlyMessage')
  }

  return t('editor.exit.androidSaveFailedMessage')
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
    if (currentAndroidDocumentCanWrite.value && canRunIdleAndroidDocumentAutosave()) {
      scheduleAndroidDocumentSave()
    }
  } else {
    status.value =
      markDirty && canRunIdleLocalDraftAutosave() ? 'Autosaving locally' : resolvedStatus
  }
  logContentSnapshot(resolvedStatus)

  if (
    markDirty &&
    documentState.value.autosaveTarget === 'local-draft' &&
    canRunIdleLocalDraftAutosave()
  ) {
    scheduleDraftSave()
  }
}

function getEditorCommandTarget(): MobileEditorCommandTarget | null {
  if (!editor) {
    return null
  }

  return createMuyaMobileEditorCommandTarget(editor)
}

function captureEditorSelection() {
  return captureSelectionWithin(resolveEditorDomNode(editor, editorElement.value))
}

function insertMarkdownAtPendingSelection(markdown: string) {
  editor?.focus()
  return insertTextAtRestoredSelection(markdown, pendingInlineInsertRange)
}

function openLinkSheet() {
  const hasEditor = Boolean(editor)
  const capturedRange = editorReady.value && hasEditor ? captureEditorSelection() : null
  const nextLinkSheet = createLinkInsertSheetWorkflow({
    editorReady: editorReady.value,
    hasEditor,
    selectedText: capturedRange?.toString() ?? '',
  })
  if (nextLinkSheet.kind !== 'open') {
    return
  }

  pendingInlineInsertRange = capturedRange
  openEditorLinkSheet({
    text: nextLinkSheet.linkText,
    url: nextLinkSheet.linkUrl,
  })
}

function closeLinkSheet() {
  resetEditorLinkSheet()
  pendingInlineInsertRange = null
}

function insertLinkFromSheet() {
  const beforeMarkdown = editor?.getMarkdown() ?? ''
  const result = insertLinkFromSheetWorkflow({
    hasEditor: Boolean(editor),
    linkText: linkText.value,
    linkUrl: linkUrl.value,
    beforeMarkdown,
    insertMarkdown: insertMarkdownAtPendingSelection,
    logger: editorLog,
  })

  if (result.kind !== 'inserted') {
    return
  }

  closeLinkSheet()
  syncAfterToolbarCommand(result.beforeMarkdown)
}

async function insertImageFromAndroidPicker() {
  const startResult = createAndroidImageInsertStart({
    editorReady: editorReady.value,
    hasEditor: Boolean(editor),
    importing: importingAndroidImage.value,
    isAvailable: isAndroidImageImportAvailable(),
    unavailableStatus: getAndroidImageUserMessage({ code: 'UNAVAILABLE' }),
    logger: editorLog,
  })
  if (startResult.kind === 'not-ready') {
    return
  }

  if (startResult.kind === 'unavailable') {
    status.value = startResult.status
    return
  }

  if (!editor) {
    return
  }

  const beforeMarkdown = editor.getMarkdown()
  pendingInlineInsertRange = captureEditorSelection()
  const selectedText = normalizeToolbarSelectionText(pendingInlineInsertRange?.toString() ?? '')
  closeEditorMenu()
  closeEditorToolbar()
  importingAndroidImage.value = true
  status.value = startResult.status

  try {
    const result = await insertAndroidImageWorkflow({
      selectedText,
      ensureAndroidImageResolver,
      pickAndroidImageDocument: () => pickAndroidImageDocument({
        copyImage: imageSharingSettings.value.imageCopyImages,
      }),
      insertMarkdown: insertMarkdownAtPendingSelection,
      getAndroidImageUserMessage,
      logger: editorLog,
    })
    status.value = result.status
    if (result.kind === 'inserted') {
      syncAfterToolbarCommand(beforeMarkdown)
    }
  } finally {
    importingAndroidImage.value = false
    pendingInlineInsertRange = null
  }
}

function syncAfterToolbarCommand(beforeMarkdown: string) {
  scheduleEditorToolbarSync({
    beforeMarkdown,
    requestFrame: callback => window.requestAnimationFrame(callback),
    getMarkdown: () => editor?.getMarkdown() ?? null,
    normalizeMarkdown: normalizeEditorMarkdown,
    onEdited: () => syncMarkdown('Edited'),
    onUnchanged: () => syncDocumentFromEditor(documentState.value.isDirty),
  })
}

function runEditorToolbarCommand(commandId: MobileCommandId) {
  const activeEditor = editorReady.value ? editor : null
  const result = runEditorToolbarCommandWorkflow({
    commandId,
    editorReady: editorReady.value,
    hasEditor: Boolean(activeEditor),
    commandTarget: activeEditor ? getEditorCommandTarget() : null,
    beforeMarkdown: activeEditor ? activeEditor.getMarkdown() : '',
    logger: editorLog,
  })

  if (result.kind === 'open-link-sheet') {
    openLinkSheet()
    return
  }

  if (result.kind === 'insert-image') {
    void insertImageFromAndroidPicker()
    return
  }

  if (result.kind === 'handled') {
    syncAfterToolbarCommand(result.beforeMarkdown)
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
  if (!canRunIdleLocalDraftAutosave()) {
    return
  }

  if (draftSaveTimer !== null) {
    window.clearTimeout(draftSaveTimer)
  }

  draftSaveTimer = window.setTimeout(saveDraft, documentSettings.value.autoSaveDelayMs)
}

function clearDraftSaveTimer() {
  if (draftSaveTimer !== null) {
    window.clearTimeout(draftSaveTimer)
    draftSaveTimer = null
  }
}

function scheduleAndroidDocumentSave() {
  if (!canRunIdleAndroidDocumentAutosave()) {
    return
  }

  if (androidSaveTimer !== null) {
    window.clearTimeout(androidSaveTimer)
  }

  androidSaveTimer = window.setTimeout(() => {
    void saveAndroidDocument()
  }, documentSettings.value.autoSaveDelayMs)
}

function clearAndroidDocumentSaveTimer() {
  if (androidSaveTimer !== null) {
    window.clearTimeout(androidSaveTimer)
    androidSaveTimer = null
  }
}

function persistLocalDrafts(nextDrafts: LocalDraftRecord[]) {
  localDrafts.value = nextDrafts
  writeStoredLocalDrafts(nextDrafts)
}

function persistAndroidRecentDocuments(nextDocuments: RecentDocumentRecord[]) {
  const filteredDocuments = writeStoredAndroidRecentDocuments(nextDocuments)
  androidRecentDocuments.value = filteredDocuments
}

function persistAndroidRecoveryDraft(sourceUri: string, markdown: string) {
  if (!canPersistAndroidRecoveryDrafts()) {
    androidDocumentLog.warn('skip Android recovery draft because recovery drafts are disabled', {
      sourceUri,
      characters: markdown.length,
    })
    return
  }

  const recoveryDraft = createAndroidRecoveryDraft(sourceUri, markdown, new Date().toISOString())
  if (!recoveryDraft) {
    return
  }

  persistLocalDrafts(upsertLocalDraft(localDrafts.value, recoveryDraft))
  draftLog.warn('kept Android document edits as a local recovery draft', {
    sourceUri,
    characters: markdown.length,
  })
}

function removeAndroidRecoveryDraft(sourceUri: string) {
  const recoveryDraftId = getAndroidRecoveryDraftId(sourceUri)
  if (localDrafts.value.some(draft => draft.id === recoveryDraftId)) {
    persistLocalDrafts(removeLocalDraft(localDrafts.value, recoveryDraftId))
  }
}

function markAndroidRecentDocumentSaved(savedAt: string) {
  const sourceUri = documentState.value.sourceUri
  if (!sourceUri) {
    return
  }

  const nextDocuments = markSavedAndroidRecentDocument(androidRecentDocuments.value, sourceUri, {
    markdown: documentState.value.markdown,
    savedAt,
    canWrite: currentAndroidDocumentCanWrite.value,
  })
  if (!nextDocuments) {
    androidDocumentLog.warn('saved Android recent document not found', { sourceUri })
    return
  }

  persistAndroidRecentDocuments(nextDocuments)
  removeAndroidRecoveryDraft(sourceUri)
}

async function saveAndroidDocument() {
  clearAndroidDocumentSaveTimer()

  if (!editor) {
    return true
  }

  const value = normalizeEditorMarkdown(editor.getMarkdown())
  const startResult = createSaveAndroidDocumentWorkflowStart({
    documentState: documentState.value,
    markdown: value,
    canWrite: currentAndroidDocumentCanWrite.value,
    markdownSaveSettings: markdownSaveSettings.value,
  })

  if (startResult.kind === 'not-android-document' || startResult.kind === 'clean') {
    return true
  }

  if (startResult.kind === 'missing-source') {
    status.value = startResult.status
    androidDocumentLog.error('Android document save missing source URI', {
      id: startResult.documentId,
    })
    return false
  }

  if (startResult.kind === 'read-only') {
    status.value = startResult.status
    androidDocumentLog.debug('skip Android document autosave without write access', {
      id: startResult.documentId,
      sourceUri: startResult.sourceUri,
    })
    return startResult.saved
  }

  if (androidSaveInFlight) {
    androidSaveRequestedAfterCurrent = true
    return false
  }

  androidSaveInFlight = true
  documentState.value = startResult.request.savingDocument
  status.value = startResult.status

  try {
    const result = await saveAndroidDocumentWorkflow({
      request: startResult.request,
      getCurrentDocumentState: () => documentState.value,
      writeAndroidMarkdownDocument,
      getAndroidDocumentUserMessage,
      recoveryMessage: ANDROID_SAVE_RECOVERY_MESSAGE,
      logger: androidDocumentLog,
    })

    if (result.kind === 'saved') {
      documentState.value = result.savedDocument
      markAndroidRecentDocumentSaved(result.savedAt)
      status.value = result.status
      return true
    }

    if (result.kind === 'changed-during-save') {
      androidSaveRequestedAfterCurrent = true
      return false
    }

    documentState.value = result.failedDocument
    if (canPersistAndroidRecoveryDrafts()) {
      persistAndroidRecoveryDraft(result.recoveryDraft.sourceUri, result.recoveryDraft.markdown)
      status.value = result.status
    } else {
      status.value = getAndroidDocumentUserMessage(result.error)
    }
    return false
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
  closeEditorMenu()

  if (!editor || !isLocalDraftDocument() || savingLocalDraftToAndroid.value) {
    return false
  }

  saveDraft()
  const draftDocument = syncDocumentFromEditor(false)

  const reopenPromptOnCancel = draftExitPromptOpen.value && options.returnHomeAfterSave === true
  draftExitPromptOpen.value = false
  savingLocalDraftToAndroid.value = true
  status.value = 'Choose a location'

  const result = await saveLocalDraftToAndroidDocumentWorkflow({
    draftDocument,
    returnHomeAfterSave: options.returnHomeAfterSave === true,
    reopenPromptOnCancel,
    transientAccessMessage: getTransientAndroidSaveMessage(),
    createAndroidMarkdownDocument,
    getAndroidDocumentUserMessage,
    markdownSaveSettings: markdownSaveSettings.value,
    logger: androidDocumentLog,
  })

  try {
    if (result.kind === 'empty') {
      status.value = result.status
      return false
    }

    if (result.kind === 'canceled') {
      status.value = canPersistLocalDrafts() ? result.status : 'Edited'
      if (reopenPromptOnCancel) {
        draftExitPromptOpen.value = true
      }
      return false
    }

    if (result.kind === 'transient') {
      status.value = result.status
      homeNotice.value = result.homeNotice
      currentAndroidDocumentCanWrite.value = false
      if (result.closeEditorToHome) {
        closeEditorToHome()
      }
      return false
    }

    if (result.kind === 'saved') {
      persistLocalDrafts(removeLocalDraft(localDrafts.value, result.removeLocalDraftId))
      rememberAndroidDocument(result.createdDocument)
      currentAndroidDocumentCanWrite.value = result.canWrite
      promptLocalDraftSaveOnExit.value = false
      documentState.value = result.savedDocument
      status.value = getAndroidEditorStatus()
      if (result.closeEditorToHome) {
        closeEditorToHome()
      }
      return true
    }

    documentState.value = result.failedDocument
    status.value = result.status
    if (result.reopenPrompt) {
      draftExitPromptOpen.value = true
    }
    return false
  } finally {
    savingLocalDraftToAndroid.value = false
  }
}

async function saveAndroidDocumentCopy(options: { returnHomeAfterSave?: boolean } = {}) {
  closeEditorMenu()

  if (!editor || !canSaveAndroidDocumentCopy() || savingAndroidDocumentCopy.value) {
    return false
  }

  const originalSourceUri = documentState.value.sourceUri
  const copySourceDocument = syncDocumentFromEditor(documentState.value.isDirty)

  savingAndroidDocumentCopy.value = true
  status.value = 'Choose a location'

  try {
    const result = await saveAndroidDocumentCopyWorkflow({
      copySourceDocument,
      originalSourceUri,
      reservedDisplayNames: androidRecentDocuments.value.map(document => document.displayName),
      returnHomeAfterSave: options.returnHomeAfterSave === true,
      transientAccessMessage: getTransientAndroidSaveMessage(),
      createAndroidMarkdownDocument,
      getAndroidDocumentUserMessage,
      markdownSaveSettings: markdownSaveSettings.value,
      logger: androidDocumentLog,
    })

    if (result.kind === 'canceled') {
      status.value = getAndroidEditorStatus()
      return false
    }

    if (result.kind === 'transient') {
      if (result.recoveryDraft && canPersistAndroidRecoveryDrafts()) {
        persistAndroidRecoveryDraft(result.recoveryDraft.sourceUri, result.recoveryDraft.markdown)
      }
      status.value = result.status
      return false
    }

    if (result.kind === 'saved') {
      if (result.removeRecoveryDraftSourceUri) {
        removeAndroidRecoveryDraft(result.removeRecoveryDraftSourceUri)
      }
      rememberAndroidDocument(result.createdDocument)
      currentAndroidDocumentCanWrite.value = result.canWrite
      promptLocalDraftSaveOnExit.value = false
      documentState.value = result.savedDocument
      status.value = getAndroidEditorStatus()
      androidExitPromptOpen.value = false
      if (result.closeEditorToHome) {
        closeEditorToHome()
      }
      return true
    }

    if (result.recoveryDraft && canPersistAndroidRecoveryDrafts()) {
      persistAndroidRecoveryDraft(result.recoveryDraft.sourceUri, result.recoveryDraft.markdown)
    }
    documentState.value = result.failedDocument
    status.value = result.status
    return false
  } finally {
    savingAndroidDocumentCopy.value = false
  }
}

async function shareCurrentMarkdownDocument() {
  closeEditorMenu()

  if (!editor || !canShareCurrentDocument() || sharingCurrentDocument.value) {
    return false
  }

  const currentDocument = syncDocumentFromEditor(documentState.value.isDirty)
  if (currentDocument.autosaveTarget === 'local-draft') {
    saveDraft()
  }

  sharingCurrentDocument.value = true
  status.value = 'Sharing'

  try {
    const result = await shareAndroidMarkdownDocumentWorkflow({
      currentDocument,
      shareAndroidMarkdownDocument,
      getAndroidDocumentUserMessage,
      imageSharingSettings: imageSharingSettings.value,
      markdownSaveSettings: markdownSaveSettings.value,
      logger: androidDocumentLog,
    })

    status.value = result.status
    return result.kind === 'shared'
  } finally {
    sharingCurrentDocument.value = false
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

  if (!canPersistLocalDrafts()) {
    clearDraftSaveTimer()
    draftLog.debug('skip local draft save because local drafts are disabled', {
      id: documentState.value.id,
    })
    return
  }

  const value = normalizeEditorMarkdown(editor.getMarkdown())
  const localDraftAutosave = createLocalDraftAutosaveResult(
    documentState.value,
    value,
    localDrafts.value,
  )
  documentState.value = localDraftAutosave.savingDocument

  try {
    persistLocalDrafts(localDraftAutosave.nextDrafts)
    documentState.value = localDraftAutosave.savedDocument
    status.value = localDraftAutosave.hasContent ? 'Autosaved locally' : 'Ready'
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

async function initEditor(initialMarkdown: string) {
  const element = editorElement.value
  if (!element) {
    return
  }

  try {
    const token = ++editorInitToken
    try {
      await ensureAndroidImageResolver()
    } catch (error) {
      editorLog.warn('Android image resolver unavailable during editor init', error)
    }
    const nextEditor = await createMuyaEditor({
      element,
      markdown: initialMarkdown,
      onContentChange: syncMarkdown,
      onJsonChange: syncMarkdown,
      onFocus: () => {
        status.value =
          documentState.value.autosaveTarget === 'android-document' &&
          !currentAndroidDocumentCanWrite.value
            ? 'Read only'
            : 'Editing'
        editorLog.debug('editor focused')
      },
      onBlur: () => {
        status.value =
          documentState.value.autosaveTarget === 'android-document'
            ? getAndroidEditorStatus()
            : 'Ready'
        editorLog.debug('editor blurred')
      },
      appLocale: locale.value,
      appearanceTextSettings: appearanceTextSettings.value,
      editingSettings: editingSettings.value,
      isStale: () => token !== editorInitToken || !editorElement.value,
      logger: editorLog,
    })
    if (!nextEditor) {
      return
    }

    editor = nextEditor
    syncMarkdown('Ready')
    editorReady.value = true
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

function releaseEditorFocusAfterOpen() {
  window.requestAnimationFrame(() => {
    const activeElement = document.activeElement
    if (activeElement instanceof HTMLElement && editorElement.value?.contains(activeElement)) {
      activeElement.blur()
      editorLog.debug('editor focus released after document open')
    }
  })
}

async function openEditor(markdown: string) {
  editorReady.value = false
  closeEditorToolbar()
  const wasEditorOpen = currentScreen.value === 'editor'
  destroyEditor()
  if (wasEditorOpen) {
    currentScreen.value = 'home'
    await nextTick()
  }

  currentScreen.value = 'editor'
  await nextTick()
  await initEditor(markdown)
}

function rememberAndroidDocument(document: OpenedAndroidDocument) {
  persistAndroidRecentDocuments(rememberAndroidRecentDocument(androidRecentDocuments.value, document))
}

async function openAndroidDocumentResult(
  document: OpenedAndroidDocument,
  options: { source?: AndroidDocumentOpenSource; remember?: boolean } = {},
) {
  const openResult = createAndroidDocumentOpenResult(document, {
    source: options.source,
    remember: options.remember,
    openWithTemporaryAccessMessage: OPEN_WITH_TEMPORARY_ACCESS_MESSAGE,
    shareTemporaryAccessMessage: SHARE_TEMPORARY_ACCESS_MESSAGE,
    logger: androidDocumentLog,
  })

  homeNotice.value = openResult.homeNotice
  if (openResult.rememberDocument) {
    rememberAndroidDocument(openResult.rememberDocument)
  }
  promptLocalDraftSaveOnExit.value = openResult.promptLocalDraftSaveOnExit
  currentAndroidDocumentCanWrite.value = openResult.currentAndroidDocumentCanWrite
  documentState.value = openResult.documentState
  await openEditor(openResult.markdown)
  status.value = openResult.statusAfterOpen
  releaseEditorFocusAfterOpen()
}

async function openSharedTextDocument(document: SharedAndroidDocument) {
  const openResult = createSharedTextDocumentOpenResult(document, {
    sharedTextImportedMessage: SHARED_TEXT_IMPORTED_MESSAGE,
    logger: androidDocumentLog,
  })

  if (canPersistLocalDrafts()) {
    persistLocalDrafts(upsertLocalDraft(localDrafts.value, openResult.localDraft))
  }
  homeNotice.value = openResult.homeNotice
  promptLocalDraftSaveOnExit.value = openResult.promptLocalDraftSaveOnExit
  currentAndroidDocumentCanWrite.value = openResult.currentAndroidDocumentCanWrite
  documentState.value = openResult.documentState
  await openEditor(openResult.markdown)
  status.value = openResult.statusAfterOpen
  releaseEditorFocusAfterOpen()
}

async function openFileFromAndroid() {
  homeNotice.value = null

  const result = await openAndroidMarkdownDocumentWorkflow({
    openAndroidMarkdownDocument: () => openAndroidMarkdownDocument(androidMarkdownSettings.value),
    getAndroidDocumentErrorCode,
    getAndroidDocumentUserMessage,
    logger: androidDocumentLog,
  })

  if (result.kind === 'opened') {
    await openAndroidDocumentResult(result.document)
  } else if (result.kind === 'failed') {
    homeNotice.value = result.homeNotice
  }
}

async function preserveCurrentDocumentBeforeIncomingOpen() {
  const preservationAction = getIncomingDocumentPreservationAction({
    currentScreen: currentScreen.value,
    hasEditor: Boolean(editor),
    autosaveTarget: documentState.value.autosaveTarget,
  })

  if (preservationAction.kind === 'none') {
    return
  }

  appLog.info('preserve current document before incoming Android document')

  if (preservationAction.kind === 'save-android-document') {
    syncDocumentFromEditor(documentState.value.isDirty)
    const sourceUri = documentState.value.sourceUri
    const saved = await saveAndroidDocument()
    if (sourceUri && shouldKeepAndroidRecoveryAfterPreserveFailure(saved, sourceUri, documentState.value.markdown)) {
      persistAndroidRecoveryDraft(sourceUri, documentState.value.markdown)
    }
    return
  }

  saveDraft()
}

async function handleAndroidOpenWithDocumentEvent(event: AndroidOpenWithDocumentEvent) {
  const action = createAndroidOpenWithDocumentEventAction(event, {
    getAndroidDocumentUserMessage,
    logger: androidDocumentLog,
  })

  if (action.kind === 'rejected') {
    homeNotice.value = action.message
    status.value = action.message
    return
  }

  await preserveCurrentDocumentBeforeIncomingOpen()
  draftExitPromptOpen.value = false
  androidExitPromptOpen.value = false
  closeEditorMenu()
  closeEditorToolbar()
  await openAndroidDocumentResult(action.document, {
    source: action.source,
    remember: action.remember,
  })
}

async function handleAndroidShareDocumentEvent(event: AndroidShareDocumentEvent) {
  const action = createAndroidShareDocumentEventAction(event, {
    getAndroidDocumentUserMessage,
    logger: androidDocumentLog,
  })

  if (action.kind === 'rejected') {
    homeNotice.value = action.message
    status.value = action.message
    return
  }

  await preserveCurrentDocumentBeforeIncomingOpen()
  draftExitPromptOpen.value = false
  androidExitPromptOpen.value = false
  closeEditorMenu()
  closeEditorToolbar()

  if (action.kind === 'open-document') {
    await openAndroidDocumentResult(action.document, {
      source: action.source,
      remember: action.remember,
    })
    return
  }

  await openSharedTextDocument(action.document)
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
    androidExitPromptOpen.value = false
    promptLocalDraftSaveOnExit.value = false
    currentAndroidDocumentCanWrite.value = false
    documentState.value = createDocumentStateFromLocalDraft(draft)
    appLog.info('open recent local document', { id })
    await openEditor(draft.markdown)
    releaseEditorFocusAfterOpen()
    return
  }

  if (recentDocument.kind === 'android-document' && recentDocument.sourceUri) {
    homeNotice.value = null
    androidExitPromptOpen.value = false
    try {
      const document = await readAndroidMarkdownDocument(
        recentDocument.sourceUri,
        androidMarkdownSettings.value,
      )
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

async function openLastEditedDocumentOnStartup() {
  const recentDocument = recentActivityDocumentItems.value[0]
  if (!recentDocument) {
    return
  }

  appLog.info('open last edited document on startup', {
    id: recentDocument.id,
    kind: recentDocument.kind,
  })
  await openDocument(recentDocument.id)
}

function applyDocumentStartupAction() {
  if (currentScreen.value !== 'home') {
    return
  }

  if (documentSettings.value.startUpAction === 'blank') {
    newDocument()
    return
  }

  if (documentSettings.value.startUpAction === 'lastEdit') {
    void openLastEditedDocumentOnStartup()
  }
}

function newDocument() {
  homeNotice.value = null
  androidExitPromptOpen.value = false
  appLog.info('create new local document')
  currentAndroidDocumentCanWrite.value = false
  promptLocalDraftSaveOnExit.value = true
  documentState.value = createUntitledDocument({ autosaveTarget: 'local-draft' })
  void openEditor('')
}

function openEditorSearch() {
  appLog.info('editor search requested')
}

function destroyEditor() {
  editorInitToken += 1
  editorReady.value = false
  clearDraftSaveTimer()
  clearAndroidDocumentSaveTimer()
  destroyMuyaEditor(editor)
  editor = null
}

function closeEditorToHome() {
  draftExitPromptOpen.value = false
  androidExitPromptOpen.value = false
  closeEditorMenu()
  closeLinkSheet()
  closeEditorToolbar()
  destroyEditor()
  homeTab.value = HOME_TABS.DOCUMENTS
  settingsPage.value = DEFAULT_SETTINGS_PAGE
  currentScreen.value = 'home'
}

function setHomeTab(tab: HomeTab) {
  homeTab.value = tab
  settingsPage.value = DEFAULT_SETTINGS_PAGE
}

function setSettingsPage(page: SettingsPage) {
  settingsPage.value = page
}

async function showHome() {
  appLog.info('show recent home')
  closeEditorMenu()
  closeEditorToolbar()

  const saveAction = getShowHomeDocumentSaveAction(documentState.value.autosaveTarget)
  if (saveAction === 'save-android-document') {
    const saved = await saveAndroidDocument()
    const afterSaveAction = getShowHomeAfterAndroidSaveAction({
      saved,
      shouldPromptAndroidExitAfterSaveFailure: shouldPromptAndroidExitAfterSaveFailure(),
    })

    if (afterSaveAction === 'open-android-exit-prompt') {
      androidExitPromptOpen.value = true
      return
    }

    if (afterSaveAction === 'stay-editor') {
      return
    }
  } else {
    saveDraft()
    const afterSaveAction = getShowHomeAfterLocalDraftSaveAction({
      shouldPromptLocalDraftSaveToDevice: shouldPromptLocalDraftSaveToDevice(),
    })

    if (afterSaveAction === 'open-local-draft-exit-prompt') {
      draftExitPromptOpen.value = true
      return
    }
  }

  closeEditorToHome()
}

function keepAndroidRecoveryAndShowHome() {
  const sourceUri = documentState.value.sourceUri
  const currentDocument = syncDocumentFromEditor(documentState.value.isDirty)
  if (sourceUri && currentDocument.markdown.trim() && canPersistAndroidRecoveryDrafts()) {
    persistAndroidRecoveryDraft(sourceUri, currentDocument.markdown)
    homeNotice.value = ANDROID_EXIT_RECOVERY_MESSAGE
  } else {
    homeNotice.value = ANDROID_EXIT_DISCARD_MESSAGE
  }

  closeEditorToHome()
}

function discardAndroidChangesAndShowHome() {
  const sourceUri = documentState.value.sourceUri
  if (sourceUri) {
    removeAndroidRecoveryDraft(sourceUri)
  }

  homeNotice.value = ANDROID_EXIT_DISCARD_MESSAGE
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

async function handleAppBackButton() {
  appLog.info('Android back button pressed', {
    screen: currentScreen.value,
    homeTab: homeTab.value,
    settingsPage: settingsPage.value,
    promptOpen: draftExitPromptOpen.value,
    androidExitPromptOpen: androidExitPromptOpen.value,
    menuOpen: editorMenuOpen.value,
    toolbarOpen: editorToolbarExpanded.value,
  })

  const action = getAppBackButtonAction({
    currentScreen: currentScreen.value,
    homeTab: homeTab.value,
    settingsPage: settingsPage.value,
    androidExitPromptOpen: androidExitPromptOpen.value,
    draftExitPromptOpen: draftExitPromptOpen.value,
    linkSheetOpen: linkSheetOpen.value,
    editorMenuOpen: editorMenuOpen.value,
    editorToolbarExpanded: editorToolbarExpanded.value,
  })

  switch (action) {
    case 'close-android-exit-prompt':
      androidExitPromptOpen.value = false
      status.value = getAndroidEditorStatus()
      return
    case 'close-local-draft-exit-prompt':
      draftExitPromptOpen.value = false
      status.value = isLocalDraftDocument() ? 'Autosaved locally' : status.value
      return
    case 'close-link-sheet':
      closeLinkSheet()
      return
    case 'close-editor-menu':
      closeEditorMenu()
      return
    case 'close-editor-toolbar':
      closeEditorToolbar()
      return
    case 'show-home':
      await showHome()
      return
    case 'show-settings-index':
      settingsPage.value = SETTINGS_PAGES.INDEX
      return
    case 'show-documents-tab':
      homeTab.value = HOME_TABS.DOCUMENTS
      settingsPage.value = DEFAULT_SETTINGS_PAGE
      return
    case 'exit-app':
      try {
        await App.exitApp()
      } catch (error) {
        appLog.warn('Android back exit unavailable', error)
      }
  }
}

function installAppLifecycleListeners() {
  if (appLifecycleListeners) {
    return
  }

  appLifecycleListeners = installAppLifecycleListenerHandles({
    onBackButton: handleAppBackButton,
    onDocumentHidden: () => requestLifecycleFlush('document hidden'),
    onPageHide: () => requestLifecycleFlush('page hide'),
    onPause: () => requestLifecycleFlush('app pause'),
    onInactive: () => requestLifecycleFlush('app inactive'),
    logger: appLog,
  })
}

function installAndroidDocumentIntentListeners() {
  if (androidDocumentIntentListeners) {
    return
  }

  androidDocumentIntentListeners = installAndroidDocumentIntentListenerHandles({
    onOpenWithDocument: event => {
      void handleAndroidOpenWithDocumentEvent(event)
    },
    onShareDocument: event => {
      void handleAndroidShareDocumentEvent(event)
    },
    logger: androidDocumentLog,
  })
}

function removeAppLifecycleListeners() {
  appLifecycleListeners?.remove()
  appLifecycleListeners = null

  androidDocumentIntentListeners?.remove()
  androidDocumentIntentListeners = null
}

function keepLocalDraftAndShowHome() {
  appLog.info('keep local draft and show recent home')
  promptLocalDraftSaveOnExit.value = false
  if (canPersistLocalDrafts()) {
    saveDraft()
  }
  closeEditorToHome()
}

function discardLocalDraftAndShowHome() {
  appLog.info('discard local draft and show recent home', { id: documentState.value.id })
  promptLocalDraftSaveOnExit.value = false
  persistLocalDrafts(removeLocalDraft(localDrafts.value, documentState.value.id))
  closeEditorToHome()
}

function clearLocalDraftMaintenanceState() {
  clearDraftSaveTimer()
  localDrafts.value = []
  writeStoredLocalDrafts([])
  if (documentState.value.autosaveTarget === 'local-draft') {
    documentState.value = createUntitledDocument({ autosaveTarget: 'local-draft' })
    promptLocalDraftSaveOnExit.value = false
  }
  draftLog.info('cleared local drafts from Advanced maintenance')
}

function resetSettingsMaintenanceState() {
  clearSettings()
  setLocale('en')
  appLog.info('reset settings from Advanced maintenance')
}

async function runAdvancedMaintenanceAction(action: AdvancedMaintenanceActionId) {
  if (action === 'exportLogs') {
    const result = await exportNativeLogs()
    if (!result) {
      throw new Error(t('settings.maintenance.exportLogsUnavailable'))
    }
    loggingLog.info('exported native logs', result)
    return
  }

  if (action === 'clearDrafts') {
    clearLocalDraftMaintenanceState()
    return
  }

  resetSettingsMaintenanceState()
}

onMounted(() => {
  appLog.info('app mounted')
  installAppLifecycleListeners()
  const restoredDrafts = readStoredLocalDrafts()
  const restoredRecentDocuments = readStoredAndroidRecentDocuments()
  const legacyDraft = readLegacyDraft()

  androidRecentDocuments.value = restoredRecentDocuments

  if (restoredDrafts.length > 0) {
    localDrafts.value = restoredDrafts
    const visibleDraft = restoredDrafts.find(draft => shouldShowLocalDraftRecord(draft.id))
    if (visibleDraft) {
      documentState.value = createDocumentStateFromLocalDraft(visibleDraft)
    } else {
      documentState.value = createUntitledDocument({ autosaveTarget: 'local-draft' })
    }
  } else if (legacyDraft?.trim() && canPersistLocalDrafts()) {
    const migratedDocument = createUntitledDocument({
      markdown: legacyDraft,
      autosaveTarget: 'local-draft',
    })
    const migratedDraft = {
      id: migratedDocument.id,
      markdown: migratedDocument.markdown,
      createdAt: migratedDocument.createdAt,
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

  installAndroidDocumentIntentListeners()
  startupActionTimer = window.setTimeout(() => {
    startupActionTimer = null
    applyDocumentStartupAction()
  }, 0)

  if (isNativeLoggerAvailable()) {
    getNativeLogInfo().then(info => {
      if (info) {
        loggingLog.info('native logging ready', info)
      } else {
        loggingLog.warn('native logging unavailable')
      }
    })
  }
})

onBeforeUnmount(() => {
  appLog.info('app before unmount')
  if (startupActionTimer !== null) {
    window.clearTimeout(startupActionTimer)
    startupActionTimer = null
  }
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
  <HomeScreen
    v-if="currentScreen === 'home'"
    :active-tab="homeTab"
    :settings-page="settingsPage"
    :continue-document="continueDocument"
    :earlier-documents="earlierDocuments"
    :notice="displayHomeNotice"
    @new-document="newDocument"
    @open-document="openDocument"
    @open-file="openFileFromAndroid"
    @set-tab="setHomeTab"
    @set-settings-page="setSettingsPage"
    @run-maintenance-action="runAdvancedMaintenanceAction"
  />

  <EditorScreen
    v-else
    v-model:link-text="linkText"
    v-model:link-url="linkUrl"
    :document-title="displayDocumentTitle"
    :status="displayStatus"
    :editor-ready="editorReady"
    :show-editor-actions="canShowEditorActions()"
    :editor-menu-open="editorMenuOpen"
    :toolbar-expanded="editorToolbarExpanded"
    :toolbar-panel="editorToolbarPanel"
    :word-count="wordCount"
    :character-count="characterCount"
    :line-count="lineCount"
    :can-share="canShareCurrentDocument()"
    :can-save-to-device="canSaveLocalDraftToAndroidDocument()"
    :can-save-copy="canSaveAndroidDocumentCopy()"
    :sharing="sharingCurrentDocument"
    :saving-to-device="savingLocalDraftToAndroid"
    :saving-copy="savingAndroidDocumentCopy"
    :link-sheet-open="linkSheetOpen"
    :draft-exit-prompt-open="draftExitPromptOpen"
    :draft-can-save-to-device="canSaveLocalDraftToAndroidDocument()"
    :draft-can-keep-local="canPersistLocalDrafts()"
    :draft-saving="savingLocalDraftToAndroid"
    :android-exit-prompt-open="androidExitPromptOpen"
    :android-exit-message="getAndroidExitPromptMessage()"
    :android-can-save-copy="canSaveAndroidDocumentCopy()"
    :android-can-keep-recovery="canPersistAndroidRecoveryDrafts()"
    :android-saving="savingAndroidDocumentCopy"
    :text-direction="appearanceTextSettings.textDirection"
    :editor-style-vars="editorStyleVars"
    @back="showHome"
    @search="openEditorSearch"
    @toggle-menu="toggleEditorMenu"
    @close-menu="closeEditorMenu"
    @share="shareCurrentMarkdownDocument"
    @save-to-device="saveLocalDraftToAndroidDocument"
    @save-copy="saveAndroidDocumentCopy"
    @run-toolbar-command="runEditorToolbarCommand"
    @toggle-toolbar="toggleEditorToolbar"
    @set-toolbar-panel="setEditorToolbarPanel"
    @close-link-sheet="closeLinkSheet"
    @insert-link="insertLinkFromSheet"
    @save-draft-to-device="saveLocalDraftToAndroidDocument({ returnHomeAfterSave: true })"
    @keep-local-draft="keepLocalDraftAndShowHome"
    @discard-local-draft="discardLocalDraftAndShowHome"
    @save-android-copy="saveAndroidDocumentCopy({ returnHomeAfterSave: true })"
    @keep-android-recovery="keepAndroidRecoveryAndShowHome"
    @discard-android-changes="discardAndroidChangesAndShowHome"
    @editor-host-change="setEditorElement"
  />
</template>
