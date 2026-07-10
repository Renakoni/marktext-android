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
  renameAndroidMarkdownDocument,
  shareAndroidMarkdownDocument,
  shareAndroidMarkdownDocuments,
  writeAndroidMarkdownDocument,
  type OpenedAndroidDocument,
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
  createIncomingDocumentOrchestration,
} from './features/android-documents/incomingDocumentOrchestration'
import {
  isAndroidSelectionControlAvailable,
  readAndroidClipboardText,
} from './lib/androidSelection'
import { installAndroidSelectionDiagnostics } from './lib/androidSelectionDiagnostics'
import { createEditorSelectionLifecycle } from './features/editor/selectionLifecycle'
import {
  getAppBackButtonAction,
  getShowHomeAfterAndroidSaveAction,
  getShowHomeAfterLocalDraftSaveAction,
  getShowHomeDocumentSaveAction,
  type AppScreen,
} from './lib/appExitDecisions'
import { isAndroidRecoveryDraftId } from './features/android-documents/androidRecoveryDrafts'
import { rememberAndroidRecentDocument } from './features/android-documents/androidRecentDocuments'
import { getImageSharingSettings } from './features/android-documents/imageSharingSettings'
import {
  createUntitledDocument,
  updateDocumentMarkdown,
} from './lib/documentState'
import {
  createDocumentStateFromLocalDraft,
} from './features/document-session/documentSessionState'
import {
  getDocumentSettings,
  getSortedRecentDocumentListItems,
} from './features/document-session/documentSettings'
import { createAutosaveScheduler } from './features/document-session/autosaveScheduler'
import { createCurrentDocumentPersistence } from './features/document-session/currentDocumentPersistence'
import {
  createAndroidDocumentOpenResult,
  openAndroidMarkdownDocumentWorkflow,
  type AndroidDocumentOpenSource,
} from './features/android-documents/androidDocumentOpenWorkflow'
import {
  createAndroidImageInsertStart,
  createLinkInsertSheetWorkflow,
  insertAndroidImageWorkflow,
  insertLinkFromSheetWorkflow,
  normalizeToolbarSelectionText,
  runEditorToolbarCommandWorkflow,
  scheduleEditorToolbarSync,
} from './features/editor/editorToolbarWorkflow'
import { readEditorMarkdownSnapshot } from './features/editor/editorMarkdownSnapshot'
import {
  getEditorToolbarSettings,
} from './features/editor/editorToolbarSettings'
import { useEditorToolbar } from './features/editor/useEditorToolbar'
import {
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
  type LocalDraftRecord,
} from './lib/localDrafts'
import {
  readLegacyDraft,
  readStoredAndroidRecentDocuments,
  readStoredLocalDrafts,
  readStoredPinnedDocuments,
  writeStoredAndroidRecentDocuments,
  writeStoredLocalDrafts,
  writeStoredPinnedDocuments,
} from './lib/documentStorage'
import {
  areAllDocumentsPinned,
  getPinnedDocumentIds,
  prunePinnedDocuments,
  type PinnedDocumentRecord,
} from './lib/pinnedDocuments'
import {
  createLogger,
  exportNativeLogs,
  getNativeLogInfo,
  isNativeLoggerAvailable,
} from './lib/logger'
import {
  isSelectionDependentMobileCommand,
  type MobileCommandId,
  type MobileEditorCommandTarget,
} from './lib/mobileCommands'
import { DEFAULT_HOME_TAB, HOME_TABS, type HomeTab } from './features/home/homeNavigation'
import {
  partitionHomeDocumentItems,
  toHomeDocumentItem,
  type HomeDocumentText,
} from './features/home/homeDocuments'
import { useDocumentSelection } from './features/home/useDocumentSelection'
import { createHomeDocumentActions } from './features/home/homeDocumentActions'
import {
  DEFAULT_SETTINGS_PAGE,
  SETTINGS_PAGES,
  type SettingsPage,
} from './features/settings/settingsNavigation'
import { useSettingsState } from './features/settings/settingsState'
import {
  getAppearanceTextSettings,
  getAppearanceThemeSettings,
  getEditorStyleVars,
} from './features/settings/appearanceSettings'
import { getAdvancedDiagnostics } from './features/settings/advancedDiagnostics'
import {
  applyCjkBoldCompensation,
  shouldCompensateCjkBold,
} from './features/editor/cjkBoldCompensation'
import {
  applyAppTheme,
  getSystemPrefersDark,
  isDarkAppTheme,
  resolveAppTheme,
  watchSystemColorScheme,
} from './features/settings/themeRuntime'
import { applySystemBarsForTheme } from './lib/systemBars'
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
const RENAME_TEMPORARY_ACCESS_MESSAGE =
  'Renamed, but Android only kept temporary access. Reopen it from Android to add it back to Recents.'
const SHARED_TEXT_IMPORTED_MESSAGE = 'Imported shared text as a local draft.'
const ANDROID_SAVE_RECOVERY_MESSAGE = 'Save failed. A local recovery draft was kept.'
const ANDROID_EXIT_RECOVERY_MESSAGE = 'Unsaved changes were kept as a recovery draft.'
const ANDROID_EXIT_DISCARD_MESSAGE = 'Unsaved changes were discarded.'
const ENABLE_ANDROID_SELECTION_ACTION_MODE_SUPPRESSION = true
// Heavy per-event selection checkpoints are a debugging tool, not a product
// behavior: leave off unless actively diagnosing selection lifecycle issues.
const ENABLE_ANDROID_SELECTION_DIAGNOSTICS = false
const editorElement = ref<HTMLElement | null>(null)
const documentState = ref(createUntitledDocument())
const localDrafts = ref<LocalDraftRecord[]>([])
const androidRecentDocuments = ref<RecentDocumentRecord[]>([])
const pinnedDocuments = ref<PinnedDocumentRecord[]>([])
const homeSelection = useDocumentSelection()
const homeDeleteSheetOpen = ref(false)
const homeRenameSheetOpen = ref(false)
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
  applyEditorToolbarSettings,
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
const appearanceThemeSettings = computed(() => getAppearanceThemeSettings(getValue))
const systemPrefersDark = ref(getSystemPrefersDark())
const resolvedAppTheme = computed(() =>
  resolveAppTheme(appearanceThemeSettings.value, systemPrefersDark.value),
)
const editingSettings = computed(() => getEditingSettings(getValue))
const toolbarSettings = computed(() => getEditorToolbarSettings(getValue))
const documentSettings = computed(() => getDocumentSettings(getValue))
const imageSharingSettings = computed(() => getImageSharingSettings(getValue))
const advancedSettings = computed(() => getAdvancedSettings(getValue))
const androidMarkdownSettings = computed(() => getAndroidMarkdownSettings(advancedSettings.value))
const androidInputDiagnosticsEnabled = computed(
  () => advancedSettings.value.selectionInputDiagnostics,
)
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
let appLifecycleListeners: AppLifecycleListeners | null = null
let pendingInlineInsertRange: Range | null = null
let startupActionTimer: number | null = null
let editorSelectionDiagnosticCleanup: (() => void) | null = null
let editorInputDiagnosticCleanup: (() => void) | null = null
let systemColorSchemeCleanup: (() => void) | null = null

const appLog = createLogger('app')
const editorLog = createLogger('editor')
const draftLog = createLogger('draft')
const androidDocumentLog = createLogger('android-document')
const loggingLog = createLogger('logging')

watch(appearanceTextSettings, settings => {
  applyMuyaAppearanceSettings(editor, settings)
})

// Runs synchronously during setup so the stored theme lands before first paint.
watch(
  resolvedAppTheme,
  theme => {
    applyAppTheme(theme)
    void applySystemBarsForTheme(isDarkAppTheme(theme))
  },
  { immediate: true },
)

watch(editingSettings, (settings, previousSettings) => {
  applyMuyaEditingSettings(editor, settings, previousSettings)
})

watch(
  toolbarSettings,
  settings => {
    applyEditorToolbarSettings(settings)
    if (settings.displayMode === 'hidden') {
      closeEditorToolbar()
    }
  },
  { immediate: true },
)

watch(documentSettings, (settings, previousSettings) => {
  applyDocumentSettingsChange(settings, previousSettings)
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

watch(androidInputDiagnosticsEnabled, enabled => {
  if (!editorReady.value) {
    return
  }

  if (enabled) {
    installEditorInputDiagnostics()
  } else {
    uninstallEditorInputDiagnostics()
  }
})

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
const pinnedDocumentIds = computed(() => getPinnedDocumentIds(pinnedDocuments.value))
const homeDocumentSections = computed(() =>
  partitionHomeDocumentItems(documentItems.value, pinnedDocumentIds.value),
)
const continueDocumentItem = computed(() => homeDocumentSections.value.continueItem)
const continueDocument = computed(() =>
  continueDocumentItem.value
    ? toHomeDocumentItem(continueDocumentItem.value, homeDocumentText.value, locale.value)
    : null,
)
const pinnedHomeDocuments = computed(() =>
  homeDocumentSections.value.pinnedItems.map(item =>
    toHomeDocumentItem(item, homeDocumentText.value, locale.value),
  ),
)
const earlierDocuments = computed(() =>
  homeDocumentSections.value.earlierItems.map(item =>
    toHomeDocumentItem(item, homeDocumentText.value, locale.value),
  ),
)
const allSelectedDocumentsPinned = computed(() =>
  areAllDocumentsPinned(pinnedDocuments.value, [...homeSelection.selectedIds.value]),
)

// Documents can leave the list while selected (e.g. an autosave drops an
// emptied draft); the selection must not keep counting them.
watch(documentItems, items => {
  if (homeSelection.isActive.value) {
    homeSelection.retain(items.map(item => item.id))
  }
})

watch(homeSelection.isActive, active => {
  if (!active) {
    homeDeleteSheetOpen.value = false
    homeRenameSheetOpen.value = false
  }
})

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

const {
  canRunIdleLocalDraftAutosave,
  canRunIdleAndroidDocumentAutosave,
  scheduleDraftSave,
  clearDraftSaveTimer,
  scheduleAndroidDocumentSave,
  clearAndroidDocumentSaveTimer,
  applyDocumentSettingsChange,
} = createAutosaveScheduler({
  documentSettings,
  documentState,
  isEditingActive: () => Boolean(editor) && currentScreen.value === 'editor',
  canPersistLocalDrafts,
  // Deferred lookups: the persistence factory below provides these, and its
  // own options reference this scheduler's timer handles.
  saveDraft: () => saveDraft(),
  saveAndroidDocument: () => saveAndroidDocument(),
})

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
    return documentState.value
  }

  const value = getEditorMarkdownSnapshot(flushPending)
  documentState.value = updateDocumentMarkdown(documentState.value, value, { markDirty })
  return documentState.value
}

function syncMarkdown(nextStatus: unknown = 'Edited') {
  if (!editor) {
    return
  }

  const resolvedStatus = typeof nextStatus === 'string' ? nextStatus : 'Edited'
  const nextMarkdown = getEditorMarkdownSnapshot()
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

const {
  captureEditorSelection,
  restoreEditorSelectionRange,
  finishSelectionToolbarOutsideTap,
  runSelectionToolbarCommand,
  setEditorSelectionMenuSuppression,
  installNativeSelectionTapListener,
  uninstallNativeSelectionTapListener,
} = createEditorSelectionLifecycle({
  currentScreen,
  editorReady,
  androidInputDiagnosticsEnabled,
  getEditor: () => editor,
  getEditorElement: () => editorElement.value,
  describeEditorInputState: () => describeEditorInputState(),
  logger: editorLog,
})
function insertMarkdownAtPendingSelection(markdown: string) {
  editor?.focus()
  return insertTextAtRestoredSelection(markdown, pendingInlineInsertRange)
}

function openLinkSheet(restoreRange: Range | null = null) {
  const hasEditor = Boolean(editor)
  const capturedRange =
    editorReady.value && hasEditor
      ? restoreRange?.cloneRange() ?? captureEditorSelection()
      : null
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

async function insertImageFromAndroidPicker(restoreRange: Range | null = null) {
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
  pendingInlineInsertRange = restoreRange?.cloneRange() ?? captureEditorSelection()
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

const canPasteSelection =
  isAndroidSelectionControlAvailable() ||
  (typeof navigator !== 'undefined' && Boolean(navigator.clipboard?.readText))

function runEditorToolbarCommand(commandId: MobileCommandId, restoreRange: Range | null = null) {
  const activeEditor = editorReady.value ? editor : null
  const commandRange =
    activeEditor && isSelectionDependentMobileCommand(commandId)
      ? restoreRange?.cloneRange() ?? captureEditorSelection()
      : null
  if (activeEditor && commandRange) {
    restoreEditorSelectionRange(activeEditor, commandRange)
  }

  const result = runEditorToolbarCommandWorkflow({
    commandId,
    editorReady: editorReady.value,
    hasEditor: Boolean(activeEditor),
    commandTarget: activeEditor ? getEditorCommandTarget() : null,
    beforeMarkdown: activeEditor ? activeEditor.getMarkdown() : '',
    logger: editorLog,
  })

  if (result.kind === 'open-link-sheet') {
    openLinkSheet(commandRange)
    return
  }

  if (result.kind === 'insert-image') {
    void insertImageFromAndroidPicker(commandRange)
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

function persistLocalDrafts(nextDrafts: LocalDraftRecord[]) {
  localDrafts.value = nextDrafts
  writeStoredLocalDrafts(nextDrafts)
}

function persistAndroidRecentDocuments(nextDocuments: RecentDocumentRecord[]) {
  const filteredDocuments = writeStoredAndroidRecentDocuments(nextDocuments)
  androidRecentDocuments.value = filteredDocuments
}

function persistPinnedDocuments(nextPins: PinnedDocumentRecord[]) {
  pinnedDocuments.value = nextPins
  writeStoredPinnedDocuments(nextPins)
}

const {
  persistAndroidRecoveryDraft,
  removeAndroidRecoveryDraft,
  saveDraft,
  saveAndroidDocument,
  saveLocalDraftToAndroidDocument,
  saveAndroidDocumentCopy,
  shareCurrentMarkdownDocument,
  flushCurrentDocument,
} = createCurrentDocumentPersistence({
  currentScreen,
  documentState,
  status,
  homeNotice,
  localDrafts,
  androidRecentDocuments,
  currentAndroidDocumentCanWrite,
  promptLocalDraftSaveOnExit,
  draftExitPromptOpen,
  androidExitPromptOpen,
  savingLocalDraftToAndroid,
  savingAndroidDocumentCopy,
  sharingCurrentDocument,
  hasEditor: () => Boolean(editor),
  getEditorMarkdownSnapshot,
  syncDocumentFromEditor,
  closeEditorMenu,
  closeEditorToHome,
  isLocalDraftDocument,
  canSaveAndroidDocumentCopy,
  canShareCurrentDocument,
  canPersistLocalDrafts,
  canPersistAndroidRecoveryDrafts,
  getTransientAndroidSaveMessage,
  getAndroidEditorStatus,
  getDraftLogStats: () => ({
    characters: characterCount.value,
    words: wordCount.value,
    lines: lineCount.value,
  }),
  persistLocalDrafts,
  persistAndroidRecentDocuments,
  rememberAndroidDocument,
  clearDraftSaveTimer,
  clearAndroidDocumentSaveTimer,
  scheduleAndroidDocumentSave,
  writeAndroidMarkdownDocument,
  createAndroidMarkdownDocument,
  shareAndroidMarkdownDocument,
  getAndroidDocumentUserMessage,
  markdownSaveSettings,
  imageSharingSettings,
  androidSaveRecoveryMessage: ANDROID_SAVE_RECOVERY_MESSAGE,
  appLogger: appLog,
  documentLogger: androidDocumentLog,
  draftLogger: draftLog,
})
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
      clipboardText: isAndroidSelectionControlAvailable() ? readAndroidClipboardText : undefined,
      isStale: () => token !== editorInitToken || !editorElement.value,
      logger: editorLog,
    })
    if (!nextEditor) {
      await setEditorSelectionMenuSuppression(false, 'editor-init-stale')
      return
    }

    editor = nextEditor
    installEditorSelectionDiagnostics()
    installEditorInputDiagnostics()
    void installNativeSelectionTapListener()
    await setEditorSelectionMenuSuppression(
      ENABLE_ANDROID_SELECTION_ACTION_MODE_SUPPRESSION,
      ENABLE_ANDROID_SELECTION_ACTION_MODE_SUPPRESSION
        ? 'editor-init'
        : 'editor-init-baseline-disabled',
    )
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
    await setEditorSelectionMenuSuppression(false, 'editor-init-failed')
  }
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
    logger: editorLog,
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

  if (!androidInputDiagnosticsEnabled.value) {
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
    editorLog.debug('editor input event', {
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
  destroyEditor({ updateSelectionMenuSuppression: !wasEditorOpen })
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

const {
  pinSelectedDocuments,
  deleteSelectedDocuments,
  shareSelectedDocuments,
  renameSelectedDocument,
} = createHomeDocumentActions({
  documentItems,
  selection: homeSelection,
  homeNotice,
  localDrafts,
  persistLocalDrafts,
  androidRecentDocuments,
  persistAndroidRecentDocuments,
  pinnedDocuments,
  persistPinnedDocuments,
  documentState,
  currentAndroidDocumentCanWrite,
  readAndroidMarkdownDocument: sourceUri =>
    readAndroidMarkdownDocument(sourceUri, androidMarkdownSettings.value),
  shareAndroidMarkdownDocument,
  shareAndroidMarkdownDocuments,
  renameAndroidMarkdownDocument,
  getAndroidDocumentUserMessage,
  imageSharingSettings,
  markdownSaveSettings,
  renameTemporaryAccessMessage: RENAME_TEMPORARY_ACCESS_MESSAGE,
  appLogger: appLog,
  documentLogger: androidDocumentLog,
})
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

// MIUI WebViews rasterize CJK identically at every font-weight (see
// cjkBoldCompensation.ts), so bold Markdown needs stroke compensation there.
async function installCjkBoldCompensation() {
  const diagnostics = await getAdvancedDiagnostics()
  const compensate = shouldCompensateCjkBold(diagnostics.manufacturer)
  applyCjkBoldCompensation(compensate)
  if (compensate) {
    appLog.info('cjk bold compensation enabled', { manufacturer: diagnostics.manufacturer })
  }
}

function destroyEditor(options: { updateSelectionMenuSuppression?: boolean } = {}) {
  editorInitToken += 1
  editorReady.value = false
  clearDraftSaveTimer()
  clearAndroidDocumentSaveTimer()
  uninstallEditorSelectionDiagnostics()
  uninstallEditorInputDiagnostics()
  void uninstallNativeSelectionTapListener()
  destroyMuyaEditor(editor)
  editor = null
  if (options.updateSelectionMenuSuppression !== false) {
    void setEditorSelectionMenuSuppression(false, 'editor-destroy')
  }
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
  const currentDocument = syncDocumentFromEditor(documentState.value.isDirty, true)
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
    homeSelectionActive: homeSelection.isActive.value,
    homeSheetOpen: homeDeleteSheetOpen.value || homeRenameSheetOpen.value,
  })

  switch (action) {
    case 'close-android-exit-prompt':
      androidExitPromptOpen.value = false
      status.value = getAndroidEditorStatus()
      return
    case 'close-home-sheet':
      homeDeleteSheetOpen.value = false
      homeRenameSheetOpen.value = false
      return
    case 'clear-home-selection':
      homeSelection.clear()
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

const incomingDocuments = createIncomingDocumentOrchestration({
  currentScreen,
  documentState,
  localDrafts,
  homeNotice,
  status,
  draftExitPromptOpen,
  androidExitPromptOpen,
  promptLocalDraftSaveOnExit,
  currentAndroidDocumentCanWrite,
  sharedTextImportedMessage: SHARED_TEXT_IMPORTED_MESSAGE,
  hasEditor: () => Boolean(editor),
  openEditor,
  releaseEditorFocusAfterOpen,
  closeEditorMenu,
  closeEditorToolbar,
  openAndroidDocumentResult,
  saveAndroidDocument,
  saveDraft,
  syncDocumentFromEditor,
  persistAndroidRecoveryDraft,
  canPersistLocalDrafts,
  persistLocalDrafts,
  getAndroidDocumentUserMessage,
  appLogger: appLog,
  documentLogger: androidDocumentLog,
})

function removeAppLifecycleListeners() {
  appLifecycleListeners?.remove()
  appLifecycleListeners = null

  incomingDocuments.removeListeners()
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
  systemColorSchemeCleanup = watchSystemColorScheme(prefersDark => {
    systemPrefersDark.value = prefersDark
  })
  const restoredDrafts = readStoredLocalDrafts()
  const restoredRecentDocuments = readStoredAndroidRecentDocuments()
  const legacyDraft = readLegacyDraft()

  androidRecentDocuments.value = restoredRecentDocuments
  pinnedDocuments.value = readStoredPinnedDocuments()

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

  // Prune against everything in storage, not the filtered home list — hidden
  // recovery drafts and setting-disabled drafts still exist and keep pins.
  const storedDocumentIds = [
    ...localDrafts.value.map(draft => draft.id),
    ...androidRecentDocuments.value.map(record => record.id),
  ]
  const prunedPins = prunePinnedDocuments(pinnedDocuments.value, storedDocumentIds)
  if (prunedPins.length !== pinnedDocuments.value.length) {
    persistPinnedDocuments(prunedPins)
  }

  draftLog.info('local draft checked', {
    restoredDrafts: localDrafts.value.length,
    restoredAndroidDocuments: androidRecentDocuments.value.length,
    characters: characterCount.value,
  })

  incomingDocuments.installListeners()
  startupActionTimer = window.setTimeout(() => {
    startupActionTimer = null
    applyDocumentStartupAction()
  }, 0)

  void installCjkBoldCompensation()

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
  systemColorSchemeCleanup?.()
  systemColorSchemeCleanup = null
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
    :pinned-documents="pinnedHomeDocuments"
    :earlier-documents="earlierDocuments"
    :notice="displayHomeNotice"
    :selection-active="homeSelection.isActive.value"
    :selection-count="homeSelection.count.value"
    :selected-ids="homeSelection.selectedIds.value"
    :all-selected-pinned="allSelectedDocumentsPinned"
    :delete-sheet-open="homeDeleteSheetOpen"
    :rename-sheet-open="homeRenameSheetOpen"
    @new-document="newDocument"
    @open-document="openDocument"
    @open-file="openFileFromAndroid"
    @set-tab="setHomeTab"
    @set-settings-page="setSettingsPage"
    @run-maintenance-action="runAdvancedMaintenanceAction"
    @select-document="homeSelection.beginWith"
    @toggle-document="homeSelection.toggle"
    @exit-selection="homeSelection.clear"
    @pin-selected="pinSelectedDocuments"
    @delete-selected="deleteSelectedDocuments"
    @share-selected="shareSelectedDocuments"
    @rename-selected="renameSelectedDocument"
    @update:delete-sheet-open="open => (homeDeleteSheetOpen = open)"
    @update:rename-sheet-open="open => (homeRenameSheetOpen = open)"
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
    :toolbar-visible="toolbarSettings.displayMode !== 'hidden'"
    :toolbar-expanded="editorToolbarExpanded"
    :toolbar-panel="editorToolbarPanel"
    :toolbar-compact="toolbarSettings.compact"
    :quick-toolbar-commands="toolbarSettings.quickCommands"
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
    :can-paste-selection="canPasteSelection"
    @back="showHome"
    @search="openEditorSearch"
    @toggle-menu="toggleEditorMenu"
    @close-menu="closeEditorMenu"
    @share="shareCurrentMarkdownDocument"
    @save-to-device="saveLocalDraftToAndroidDocument"
    @save-copy="saveAndroidDocumentCopy"
    @run-toolbar-command="runEditorToolbarCommand"
    @run-selection-command="runSelectionToolbarCommand"
    @dismiss-selection="finishSelectionToolbarOutsideTap"
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
