<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { App } from '@capacitor/app'
import HomeScreen from './features/home/HomeScreen.vue'
import EditorScreen from './features/editor/EditorScreen.vue'
import {
  createAndroidMarkdownDocument,
  configureAndroidMarkdownSettings,
  exportAndroidMarkdownPdf,
  getAndroidDocumentErrorCode,
  getAndroidDocumentUserMessage,
  isAndroidDocumentAccessAvailable,
  openAndroidMarkdownDocument,
  renameAndroidMarkdownDocument,
  shareAndroidMarkdownDocument,
  shareAndroidMarkdownDocuments,
  type OpenedAndroidDocument,
} from './lib/androidDocuments'
import {
  addCloudAuthListener,
  addCloudAuthPendingListener,
  connectCloudAccount,
  disconnectCloudAccount,
  getCloudAccountState,
  isCloudDocumentAccessAvailable,
  listCloudFolder,
  readCloudDocument,
  type CloudAccountState,
  type CloudFolderEntry,
} from './lib/cloudDocuments'
import { createGoogleDrivePickFlow } from './features/open-locations/googleDrivePickFlow'
import { isCloudSourceUri } from './lib/cloudDocumentUris'
import {
  createRoutedCloudDocument,
  readRoutedMarkdownDocument,
  toOpenedDocumentFromCloud,
  writeRoutedMarkdownDocument,
} from './features/cloud-documents/cloudDocumentBridge'
import OpenLocationsScreen from './features/open-locations/OpenLocationsScreen.vue'
import CloudBrowserScreen from './features/open-locations/CloudBrowserScreen.vue'
import CloudNameSheet from './features/open-locations/CloudNameSheet.vue'
import {
  ensureAndroidImageResolver,
  formatImportedImageStorageBytes,
  getAndroidImageUserMessage,
  isAndroidImageImportAvailable,
  pickAndroidImageDocument,
  type ImportedAndroidImageCleanupResult,
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
import { openExternalUrl } from './lib/externalLinks'
import { createDocumentOutline, waitForViewportSettle } from './features/editor/documentOutline'
import { createDocumentSearch } from './features/editor/documentSearch'
import {
  resolveTableContext,
  runTableCommand,
  type TableCommandId,
} from './features/editor/tableCommands'
import { createSelectionToolbarLongPress } from './features/editor/selectionToolbarLongPress'
import type { SelectionToolbarCommandId } from './features/editor/selectionToolbar'
import { createCaretFollow } from './features/editor/caretFollow'
import { createResumePosition } from './features/editor/resumePosition'
import {
  readStoredResumePosition,
  removeStoredResumePosition,
  writeStoredResumePosition,
} from './lib/resumePositions'
import { createEditorSelectionLifecycle } from './features/editor/selectionLifecycle'
import { createEditorSession, normalizeEditorMarkdown } from './features/editor/editorSession'
import {
  consumeEditorRecoveryHandoff,
  persistEditorRecoveryHandoff,
  type EditorRecoveryHandoff,
} from './features/editor/editorRecoveryHandoff'
import { renderMarkdownToPdfExportHtml } from './features/editor/pdfExportHtml'
import {
  getAppBackButtonAction,
  getShowHomeAfterAndroidSaveAction,
  getShowHomeAfterLocalDraftSaveAction,
  getShowHomeDocumentSaveAction,
  type AppScreen,
} from './lib/appExitDecisions'
import { useModalFocus } from './lib/modalFocus'
import { isAndroidRecoveryDraftId } from './features/android-documents/androidRecoveryDrafts'
import { rememberAndroidRecentDocument } from './features/android-documents/androidRecentDocuments'
import { getImageSharingSettings } from './features/android-documents/imageSharingSettings'
import {
  ImportedImageCleanupBlockedError,
  cleanupUnusedImportedImages,
} from './features/android-documents/importedImageMaintenance'
import { createDocumentGrantSync } from './features/android-documents/documentGrantMaintenance'
import {
  protectImportedImagesInAndroidDocument,
  registerImportedImageCopy,
} from './features/android-documents/importedImageRegistry'
import { createUntitledDocument } from './lib/documentState'
import {
  createDocumentStateFromLocalDraft,
} from './features/document-session/documentSessionState'
import {
  getDocumentSettings,
  getSortedRecentDocumentRecords,
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
  createTableInsertSheetWorkflow,
  insertAndroidImageWorkflow,
  insertLinkFromSheetWorkflow,
  insertTableFromSheetWorkflow,
  normalizeToolbarSelectionText,
  runEditorToolbarCommandWorkflow,
  scheduleEditorToolbarSync,
} from './features/editor/editorToolbarWorkflow'
import {
  getEditorToolbarSettings,
} from './features/editor/editorToolbarSettings'
import { getSelectionToolbarSettings } from './features/editor/selectionToolbarSettings'
import { useEditorToolbar } from './features/editor/useEditorToolbar'
import { insertTextAtRestoredSelection } from './features/editor/editorInlineInsert'
import {
  applyMuyaAppearanceSettings,
  applyMuyaEditingSettings,
  applyMuyaEditorLocale,
  createMuyaEditor,
  destroyMuyaEditor,
} from './features/editor/editorRuntime'
import {
  assignUntitledDraftNames,
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
  type MarkdownEncoding,
} from './features/settings/advancedSettings'
import { createMuyaMobileEditorCommandTarget } from './lib/muyaMobileAdapter'
import {
  createSourceModeController,
  type SourceModeController,
} from './features/editor/sourceMode'
import { AUTO_APP_LOCALE, translateKnownText, useI18n } from './lib/i18n'
import {
  createRecentDocumentFromLocalDraft,
  getRecentDocumentListItems,
  normalizeRecentDocuments,
  toRecentDocumentListItems,
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
const INCOMING_FILE_IMPORTED_MESSAGE = 'Imported this file as a local draft.'
const ANDROID_SAVE_RECOVERY_MESSAGE = 'Save failed. A local recovery draft was kept.'
const ANDROID_EXIT_RECOVERY_MESSAGE = 'Unsaved changes were kept as a recovery draft.'
const ANDROID_EXIT_DISCARD_MESSAGE = 'Unsaved changes were discarded.'
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
const draftExitPromptOpen = ref(false)
const androidExitPromptOpen = ref(false)
const incomingOpenPromptOpen = ref(false)
const incomingOpenName = ref('')
// The deferred replacement to run if the user discards the current document
// after preservation was blocked; cleared whenever the prompt resolves.
let pendingIncomingOpenProceed: (() => Promise<void>) | null = null
const promptLocalDraftSaveOnExit = ref(false)
const savingLocalDraftToAndroid = ref(false)
const savingAndroidDocumentCopy = ref(false)
const sharingCurrentDocument = ref(false)
const exportingPdfDocument = ref(false)
const {
  editorMenuOpen,
  editorToolbarExpanded,
  editorToolbarPanel,
  caretInTable: editorCaretInTable,
  setCaretInTable: setEditorCaretInTable,
  linkSheetOpen,
  linkText,
  linkUrl,
  tableSheetOpen,
  tableRows,
  tableColumns,
  importingAndroidImage,
  applyEditorToolbarSettings,
  toggleEditorMenu,
  closeEditorMenu,
  toggleEditorToolbar,
  setEditorToolbarPanel,
  closeEditorToolbar,
  openLinkSheet: openEditorLinkSheet,
  closeLinkSheet: resetEditorLinkSheet,
  openTableSheet: openEditorTableSheet,
  closeTableSheet: resetEditorTableSheet,
} = useEditorToolbar()
const { locale, setLocalePreference, t } = useI18n()
const { getValue, clearSettings } = useSettingsState()
const appearanceTextSettings = computed(() => getAppearanceTextSettings(getValue))
const appearanceThemeSettings = computed(() => getAppearanceThemeSettings(getValue))
const systemPrefersDark = ref(getSystemPrefersDark())
const resolvedAppTheme = computed(() =>
  resolveAppTheme(appearanceThemeSettings.value, systemPrefersDark.value),
)
const editingSettings = computed(() => getEditingSettings(getValue))
const toolbarSettings = computed(() => getEditorToolbarSettings(getValue))
const selectionToolbarSettings = computed(() => getSelectionToolbarSettings(getValue))
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

let lastContentLogAt = 0
let appLifecycleListeners: AppLifecycleListeners | null = null
let pendingInlineInsertRange: Range | null = null
let pendingTableInsertRange: Range | null = null
// The editor instance each sheet was opened for: a warm open-with or share
// intent can replace the editor under an open sheet, and a confirm must
// never act on the successor document.
let pendingLinkInsertEditor: unknown = null
let pendingTableInsertEditor: unknown = null
let startupActionTimer: number | null = null
let systemColorSchemeCleanup: (() => void) | null = null

const appLog = createLogger('app')
const editorLog = createLogger('editor')
const draftLog = createLogger('draft')
const androidDocumentLog = createLogger('android-document')
const loggingLog = createLogger('logging')

watch(appearanceTextSettings, settings => {
  applyMuyaAppearanceSettings(getEditor(), settings)
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
  applyMuyaEditingSettings(getEditor(), settings, previousSettings)
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
  void applyMuyaEditorLocale(getEditor(), nextLocale, editorLog)
})

const lineCount = computed(() => documentState.value.stats.lines)
const characterCount = computed(() => documentState.value.stats.characters)
const wordCount = computed(() => documentState.value.stats.words)
const documentTitle = computed(() => documentState.value.title)
// The Untitled-N placeholder is canonical everywhere: it is a draft's stable
// identity, so it stays byte-for-byte the same in the header, the recent list,
// rename, share, and export — it is never localized to a per-locale form.
const displayDocumentTitle = computed(() => documentTitle.value)
const recentDocumentRecords = computed(() =>
  [
    ...localDrafts.value
      .filter(draft => shouldShowLocalDraftRecord(draft.id))
      .map(createRecentDocumentFromLocalDraft),
    ...androidRecentDocuments.value,
  ],
)
const recentActivityDocumentItems = computed(() => getRecentDocumentListItems(recentDocumentRecords.value))
// The home's "show all" expansion (#151): the resting view keeps the quiet
// recency cap, the expanded view reads the COMPLETE collection. Ephemeral —
// never persisted, so paging can never modify the durable stores.
//
// The projection is layered to keep the heavy work off the resting path:
// list-item STATISTICS (full-Markdown scans per draft) are materialized
// only for the records the current state actually renders. The records
// level is cheaper but not free — local-draft records derive their title
// from the draft's Markdown — so it must only evaluate while something
// actually renders it: the selection watcher below unsubscribes when no
// selection is active, and everything else reading this chain is mounted
// only on the home screen.
const pinnedDocumentIds = computed(() => getPinnedDocumentIds(pinnedDocuments.value))
const homeListExpanded = ref(false)
const sortedRecentRecords = computed(() =>
  getSortedRecentDocumentRecords(recentDocumentRecords.value, documentSettings.value),
)
const visibleRecentRecords = computed(() => {
  if (homeListExpanded.value) {
    return sortedRecentRecords.value
  }

  // The resting view = the recency-capped set, plus any PINNED document
  // beyond the cap — pinning is explicit intent and must keep an item
  // visible without expanding.
  const cappedIds = new Set(
    normalizeRecentDocuments(recentDocumentRecords.value).map(record => record.id),
  )
  return sortedRecentRecords.value.filter(
    record => cappedIds.has(record.id) || pinnedDocumentIds.value.has(record.id),
  )
})
const documentItems = computed(() => toRecentDocumentListItems(visibleRecentRecords.value))
const hiddenHomeDocumentCount = computed(
  () => sortedRecentRecords.value.length - visibleRecentRecords.value.length,
)
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
// emptied draft); the selection must not keep counting them. The source
// getter short-circuits BEFORE touching the records projection when no
// selection is active: a watcher must evaluate its source on every
// dependency change (a guard inside the callback cannot prevent that),
// so an unconditional source would pull the whole projection — including
// per-draft title derivation over full Markdown bodies — hot on every
// autosave even while the home screen is not rendered. With the
// short-circuit, Vue's dynamic dependency tracking drops the projection
// subscription entirely while selection is inactive.
watch(
  () => (homeSelection.isActive.value ? visibleRecentRecords.value : null),
  records => {
    if (records) {
      homeSelection.retain(records.map(record => record.id))
    }
  },
)

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
  // Deferred lookup: the editor session below owns the editor instance, and
  // its own options reference this scheduler's timer handles.
  isEditingActive: () => Boolean(getEditor()) && currentScreen.value === 'editor',
  canPersistLocalDrafts,
  // Deferred lookups: the persistence factory below provides these, and its
  // own options reference this scheduler's timer handles.
  saveDraft: () => saveDraft(),
  saveAndroidDocument: () => saveAndroidDocument(),
})

// Source code mode controller (assigned right after the editor session; the
// session's markdown-override option dereferences it lazily per snapshot).
let sourceModeController: SourceModeController | null = null

// Deferred lookup: the editor session below owns the editor instance; the
// follow handler only dereferences it per selection-change event.
const caretFollow = createCaretFollow({
  getEditor: () => getEditor(),
  logger: editorLog,
})

const {
  editorReady,
  editorFailed,
  retryEditor,
  setEditorElement,
  getEditorElement,
  getEditor,
  hasEditor,
  getEditorMarkdownSnapshot,
  syncDocumentFromEditor,
  openEditor: openEditorSessionDocument,
  destroyEditor,
  releaseEditorFocusAfterOpen,
  installEditorInputDiagnostics,
  uninstallEditorInputDiagnostics,
  describeEditorInputState,
} = createEditorSession({
  currentScreen,
  documentState,
  status,
  locale,
  appearanceTextSettings,
  editingSettings,
  androidInputDiagnosticsEnabled,
  createMuyaEditor,
  destroyMuyaEditor,
  syncMarkdown: nextStatus => syncMarkdown(nextStatus),
  getMarkdownOverride: () => sourceModeController?.activeText() ?? null,
  onEditorSelectionChange: (...args: unknown[]) => {
    caretFollow.onEditorSelectionChange(...args)
    refreshEditorTableCaretState()
  },
  onEditorFocus: () => {
    status.value =
      documentState.value.autosaveTarget === 'android-document' &&
      !currentAndroidDocumentCanWrite.value
        ? 'Read only'
        : 'Editing'
    editorLog.debug('editor focused')
  },
  onEditorBlur: () => {
    status.value =
      documentState.value.autosaveTarget === 'android-document'
        ? getAndroidEditorStatus()
        : 'Ready'
    editorLog.debug('editor blurred')
  },
  ensureAndroidImageResolver,
  getClipboardText: () =>
    isAndroidSelectionControlAvailable() ? readAndroidClipboardText : undefined,
  // Deferred lookups: the selection lifecycle below is created after this
  // session, and its own options reference the session's editor accessors.
  setEditorSelectionMenuSuppression: (suppressed, reason) =>
    setEditorSelectionMenuSuppression(suppressed, reason),
  installNativeSelectionTapListener: () => installNativeSelectionTapListener(),
  uninstallNativeSelectionTapListener: () => uninstallNativeSelectionTapListener(),
  clearDraftSaveTimer,
  clearAndroidDocumentSaveTimer,
  closeEditorToolbar,
  logger: editorLog,
})

// Source code mode (#180): a plain textarea replaces the WYSIWYG surface.
// While active the session's markdown override makes the textarea the
// document for every consumer (autosave, share, export, lifecycle flushes);
// entry/exit compose the engine's audited replaceContent/getCursorOffset/
// setCursorByOffset hand-off, and edits drive the same syncMarkdown pipeline
// WYSIWYG changes do.
sourceModeController = createSourceModeController({
  getEditor: () => getEditor(),
  getMarkdownSnapshot: flushPending => getEditorMarkdownSnapshot(flushPending),
  onDocumentEdited: () => syncMarkdown('Edited'),
  logger: editorLog,
})
const sourceMode = sourceModeController
const sourceModeActive = sourceMode.active
const sourceModeText = sourceMode.text
const sourceModeEntryCaret = sourceMode.entryCaretOffset
// Menu-driven entry focuses the textarea (the user asked for the mode);
// setting-driven auto-entry must not pop the keyboard on open, matching
// releaseEditorFocusAfterOpen's contract for the WYSIWYG surface.
const sourceModeFocusOnEnter = ref(true)

function enterSourceMode(options: { focus: boolean } = { focus: true }) {
  if (!editorReady.value || sourceModeActive.value) {
    return
  }

  // The mode owns the whole editing surface: panels that act on the muya
  // tree stand down first.
  closeEditorMenu()
  closeEditorSearch({ restoreCursor: false })
  closeEditorOutline()
  closeEditorToolbar()
  endSelectionCaretSession('entering source mode')
  sourceModeFocusOnEnter.value = options.focus
  sourceMode.enter()
}

function exitSourceMode(caret: { start: number, end: number } | null) {
  closeEditorMenu()
  sourceMode.exit(caret)
}

function toggleSourceModeFromScreen(caret: { start: number, end: number } | null) {
  if (sourceModeActive.value) {
    exitSourceMode(caret)
  } else {
    enterSourceMode()
  }
}

const {
  searchOpen: editorSearchOpen,
  searchQuery: editorSearchQuery,
  matchCount: editorSearchMatchCount,
  activeMatchIndex: editorSearchActiveIndex,
  replaceOpen: editorSearchReplaceOpen,
  replaceValue: editorSearchReplaceValue,
  caseSensitive: editorSearchCaseSensitive,
  replaceAllCount: editorSearchReplaceAllCount,
  openSearch: openEditorSearchBar,
  closeSearch: closeEditorSearch,
  setQuery: setEditorSearchQuery,
  findNext: findNextEditorSearchMatch,
  findPrevious: findPreviousEditorSearchMatch,
  toggleReplaceOpen: toggleEditorSearchReplace,
  setReplaceValue: setEditorSearchReplaceValue,
  toggleCaseSensitive: toggleEditorSearchCase,
  replaceCurrent: replaceCurrentEditorSearchMatch,
  replaceAll: replaceAllEditorSearchMatches,
  refreshAfterEdit: refreshEditorSearchAfterEdit,
  resetForNewDocument: resetEditorSearchForNewDocument,
} = createDocumentSearch({
  getEditor,
  scrollActiveMatchIntoView: scrollActiveSearchMatchIntoView,
  logger: editorLog,
})

function scrollActiveSearchMatchIntoView() {
  getEditor()?.domNode.querySelector('.mu-highlight')?.scrollIntoView({ block: 'center' })
}

const {
  outlineOpen: editorOutlineOpen,
  outlineItems: editorOutlineItems,
  openOutline: openEditorOutlineSheet,
  closeOutline: closeEditorOutline,
  selectHeading: selectEditorOutlineHeading,
  resetForNewDocument: resetEditorOutlineForNewDocument,
} = createDocumentOutline({
  getEditor,
  dismissKeyboard: dismissEditorKeyboard,
  settleViewport: () => waitForViewportSettle(),
  scrollToHeading: scrollEditorToHeading,
  logger: editorLog,
})

// Blur only editor-owned focus: the soft keyboard retracts while Muya's
// cached internal selection (used by focus()/search restore) stays intact.
function dismissEditorKeyboard() {
  const active = document.activeElement
  if (active instanceof HTMLElement && getEditor()?.domNode.contains(active)) {
    active.blur()
  }
}

// Scroll the real editor scroll container (.editor-host-shell wraps Muya's
// root) so the heading sits near the top with context, clear of app chrome.
function scrollEditorToHeading(heading: Element) {
  const editorRoot = getEditor()?.domNode
  const container = editorRoot?.parentElement
  if (!editorRoot || !container) {
    return
  }

  const headingTop =
    heading.getBoundingClientRect().top - container.getBoundingClientRect().top
  container.scrollTo({ top: container.scrollTop + headingTop - 24 })
}

// Stable identity for resume positions. Android documents key by source URI
// (survives renames of drafts they never had); local drafts key by draft id.
// An Android document without a persisted URI has no stable identity and is
// not tracked.
function getResumeDocumentKey() {
  const state = documentState.value
  if (state.autosaveTarget === 'android-document') {
    return state.sourceUri ? `android-document:${state.sourceUri}` : null
  }

  return `local-draft:${state.id}`
}

const {
  resumeCardVisible,
  resumeCardText,
  startForOpenedDocument: startResumeForOpenedDocument,
  activateResume: activateEditorResume,
  dismissCard: dismissResumeCard,
  standDown: standDownResume,
  notifyDocumentEdited: notifyResumeDocumentEdited,
  persistNow: persistResumePosition,
  resetForNewDocument: resetResumeForNewDocument,
} = createResumePosition({
  getEditor,
  isEditorReady: () => editorReady.value,
  getDocumentKey: getResumeDocumentKey,
  // Flush pending edits so the hash matches what the save paths write.
  getMarkdown: () => (hasEditor() ? getEditorMarkdownSnapshot(true) : null),
  readPosition: readStoredResumePosition,
  writePosition: writeStoredResumePosition,
  removePosition: removeStoredResumePosition,
  logger: editorLog,
})

// Whether the clipboard currently holds pasteable text. Read through the
// native bridge on Android; on the web the Clipboard API may refuse to be
// inspected (permissions) — offering Paste then beats silently losing it.
async function queryClipboardHasText() {
  if (isAndroidSelectionControlAvailable()) {
    return (await readAndroidClipboardText()).length > 0
  }

  if (!navigator.clipboard?.readText) {
    return false
  }

  try {
    return (await navigator.clipboard.readText()).length > 0
  } catch {
    return true
  }
}

const {
  caretSessionActive: selectionCaretSessionActive,
  clipboardHasText: selectionClipboardHasText,
  enterFromContextRequest: enterSelectionToolbarContext,
  notifyCommandRun: notifySelectionToolbarCommandRun,
  notifyDocumentEdited: notifySelectionToolbarDocumentEdited,
  endCaretSession: endSelectionCaretSession,
  attachWebFallbacks: attachSelectionToolbarWebFallbacks,
  resetForNewDocument: resetSelectionToolbarLongPress,
} = createSelectionToolbarLongPress({
  isEditorReady: () => editorReady.value,
  getEditorHost: () => getEditor()?.domNode ?? null,
  canActivate: () =>
    currentScreen.value === 'editor' &&
    !editorMenuOpen.value &&
    !editorSearchOpen.value &&
    !editorOutlineOpen.value &&
    !linkSheetOpen.value &&
    !tableSheetOpen.value &&
    !draftExitPromptOpen.value &&
    !androidExitPromptOpen.value,
  queryClipboardHasText,
  logger: editorLog,
})

// The suppressed native floating ActionMode started: refresh the clipboard
// state and open a caret session when the long-press placed a caret.
function handleSelectionContextRequest() {
  void enterSelectionToolbarContext('native action mode')
}

async function runEditorSelectionCommand(
  commandId: SelectionToolbarCommandId,
  restoreRange: Range | null,
) {
  await runSelectionToolbarCommand(commandId, restoreRange)
  notifySelectionToolbarCommandRun()
}

// Follow a link from the floating link overlay. The scheme is re-validated
// inside openExternalUrl, so an unsafe target never reaches AppLauncher. A
// failure to open (no handler for a mailto/tel) is logged rather than surfaced:
// the http case effectively always has a browser, and the overlay stays put.
async function openEditorLink(href: string) {
  const opened = await openExternalUrl(href)
  if (!opened) {
    editorLog.warn('could not open external link', { href })
  }
}

function openEditorOutline() {
  if (!hasEditor()) {
    return
  }

  closeEditorMenu()
  closeEditorToolbar()
  // Defensive: search owns the top bar while open, but never let both
  // overlays coexist. No cursor restore — that would reopen the keyboard.
  closeEditorSearch({ restoreCursor: false })
  standDownResume('outline opened')
  endSelectionCaretSession('outline opened')
  void openEditorOutlineSheet()
  appLog.info('editor outline opened')
}

// Editor surfaces are mutually exclusive with the outline, including its
// PENDING open (viewport settling): every entry point that can open the
// menu, the expanded toolbar, or the link sheet during that window must
// cancel the outline request first, exactly like openEditorSearch does.
function toggleEditorMenuExclusive() {
  closeEditorOutline()
  standDownResume('menu opened')
  endSelectionCaretSession('menu opened')
  toggleEditorMenu()
}

function toggleEditorToolbarExclusive() {
  closeEditorOutline()
  standDownResume('toolbar expanded')
  toggleEditorToolbar()
}

// Every document open lands here (including incoming share/open-with intents),
// so stale find-bar, outline, and resume state never carries across documents.
async function openEditor(markdown: string) {
  // The outgoing document's position is written under the resume session's
  // cached key (documentState already points at the incoming document here).
  void persistResumePosition('document replaced')
  resetResumeForNewDocument()
  resetSelectionToolbarLongPress()
  resetEditorSearchForNewDocument()
  resetEditorOutlineForNewDocument()
  // The sheets and their pending ranges belong to the outgoing document.
  closeLinkSheet()
  closeTableSheet()
  await openEditorSessionDocument(markdown)
  void startResumeForOpenedDocument()
  // Long-press entry: Android uses the native suppressed-ActionMode signal;
  // web dev/e2e fall back to in-page contextmenu + selection watching.
  if (!isAndroidSelectionControlAvailable()) {
    attachSelectionToolbarWebFallbacks()
  }
}

// The recovery panel's Retry drives the session-level retry, which reopens the
// SAME document and so must not repeat the destructive "new document is opening"
// resets. But a bare session retry skips the common post-open lifecycle, so on
// a successful recovery restore it here: restart resume-position tracking and
// re-apply the focus-release policy (Muya init calls focus(); a normal open
// releases it so the keyboard does not spring up unprompted).
async function retryEditorFromRecovery() {
  const statusAfterRecovery =
    status.value === 'Editor failed'
      ? documentState.value.autosaveTarget === 'android-document'
        ? getAndroidEditorStatus()
        : 'Ready'
      : status.value
  await retryEditor()
  if (editorReady.value) {
    status.value = statusAfterRecovery
    void startResumeForOpenedDocument()
    releaseEditorFocusAfterOpen()
    return
  }
  // The in-app retry could not recover in this page — e.g. a rejected Muya
  // dynamic import, which the WebView caches per-specifier and refuses to
  // re-resolve. Only a full reload gets a fresh module registry. But a temporary
  // Open With / shared session has no Recents entry and, with init failed, no
  // live editor to save a draft from, so persist the live document as a one-shot
  // handoff FIRST and reopen it after boot — the reload must never drop the
  // only in-memory copy.
  const handoffPersisted = persistEditorRecoveryHandoff({
    documentState: documentState.value,
    status: statusAfterRecovery,
    currentAndroidDocumentCanWrite: currentAndroidDocumentCanWrite.value,
    promptLocalDraftSaveOnExit: promptLocalDraftSaveOnExit.value,
  })
  if (!handoffPersisted) {
    appLog.warn('editor recovery reload canceled because the handoff could not be persisted')
    return
  }
  window.location.reload()
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
  // The action sheet always carries at least the source-mode toggle, so the
  // menu button no longer hides when the share/save bridges are unavailable
  // (plain-web runs included); the capability rows still gate themselves.
  return true
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

function syncMarkdown(nextStatus: unknown = 'Edited') {
  if (!hasEditor()) {
    return
  }

  const resolvedStatus = typeof nextStatus === 'string' ? nextStatus : 'Edited'
  const markDirty = resolvedStatus === 'Edited'
  syncDocumentFromEditor(markDirty)
  if (markDirty) {
    // Content edits invalidate match offsets; re-run the open query so the
    // highlights and the match counter stay truthful.
    refreshEditorSearchAfterEdit()
    // Edits also invalidate the resume offer and any in-flight re-pinning,
    // and end a long-press caret session (typing owns the caret now).
    notifyResumeDocumentEdited()
    notifySelectionToolbarDocumentEdited()
  }
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
  const activeEditor = getEditor()
  if (!activeEditor) {
    return null
  }

  return createMuyaMobileEditorCommandTarget(activeEditor)
}

const {
  captureEditorSelection,
  restoreEditorSelectionRange,
  restoreEditorInsertionCaret,
  finishSelectionToolbarOutsideTap,
  runSelectionToolbarCommand,
  setEditorSelectionMenuSuppression,
  installNativeSelectionTapListener,
  uninstallNativeSelectionTapListener,
} = createEditorSelectionLifecycle({
  currentScreen,
  editorReady,
  androidInputDiagnosticsEnabled,
  getEditor,
  getEditorElement,
  describeEditorInputState,
  onSelectionContextRequest: handleSelectionContextRequest,
  logger: editorLog,
})
function insertMarkdownAtPendingSelection(markdown: string) {
  getEditor()?.focus()
  return insertTextAtRestoredSelection(markdown, pendingInlineInsertRange)
}

function openLinkSheet(restoreRange: Range | null = null) {
  const editorPresent = hasEditor()
  const capturedRange =
    editorReady.value && editorPresent
      ? restoreRange?.cloneRange() ?? captureEditorSelection()
      : null
  const nextLinkSheet = createLinkInsertSheetWorkflow({
    editorReady: editorReady.value,
    hasEditor: editorPresent,
    selectedText: capturedRange?.toString() ?? '',
  })
  if (nextLinkSheet.kind !== 'open') {
    return
  }

  // Same policy as the outline and table sheets: never stack on the search
  // overlay; no cursor restore — that would reopen the keyboard.
  closeEditorSearch({ restoreCursor: false })
  pendingInlineInsertRange = capturedRange
  pendingLinkInsertEditor = getEditor()
  closeEditorOutline()
  standDownResume('link sheet opened')
  endSelectionCaretSession('link sheet opened')
  openEditorLinkSheet({
    text: nextLinkSheet.linkText,
    url: nextLinkSheet.linkUrl,
  })
}

function closeLinkSheet() {
  resetEditorLinkSheet()
  pendingInlineInsertRange = null
  pendingLinkInsertEditor = null
}

function insertLinkFromSheet() {
  const activeEditor = getEditor()
  if (!activeEditor || activeEditor !== pendingLinkInsertEditor) {
    editorLog.warn('mobile link insert dropped: the editor was replaced under the sheet')
    closeLinkSheet()
    return
  }

  const beforeMarkdown = activeEditor.getMarkdown() ?? ''
  const result = insertLinkFromSheetWorkflow({
    hasEditor: hasEditor(),
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

function openTableSheet(restoreRange: Range | null = null) {
  const nextTableSheet = createTableInsertSheetWorkflow({
    editorReady: editorReady.value,
    hasEditor: hasEditor(),
  })
  if (nextTableSheet.kind !== 'open') {
    return
  }

  // Same policy as the outline: never let the sheet stack on the search
  // overlay; no cursor restore — that would reopen the keyboard.
  closeEditorSearch({ restoreCursor: false })
  pendingTableInsertRange = restoreRange?.cloneRange() ?? captureEditorSelection()
  pendingTableInsertEditor = getEditor()
  closeEditorOutline()
  standDownResume('table sheet opened')
  endSelectionCaretSession('table sheet opened')
  openEditorTableSheet({
    rows: nextTableSheet.rows,
    columns: nextTableSheet.columns,
  })
}

function closeTableSheet() {
  resetEditorTableSheet()
  pendingTableInsertRange = null
  pendingTableInsertEditor = null
}

function insertTableFromSheet() {
  const activeEditor = getEditor()
  if (!activeEditor || activeEditor !== pendingTableInsertEditor) {
    editorLog.warn('mobile table insert dropped: the editor was replaced under the sheet')
    closeTableSheet()
    return
  }

  const result = insertTableFromSheetWorkflow({
    hasEditor: hasEditor(),
    rows: tableRows.value,
    columns: tableColumns.value,
    beforeMarkdown: activeEditor?.getMarkdown() ?? '',
    restoreInsertionPoint: () =>
      activeEditor
        ? restoreEditorInsertionCaret(activeEditor, pendingTableInsertRange)
        : false,
    createTable: dimensions => activeEditor?.createTable(dimensions),
    logger: editorLog,
  })

  if (result.kind !== 'inserted') {
    return
  }

  closeTableSheet()
  syncAfterToolbarCommand(result.beforeMarkdown)
  // The engine seats the caret in the fresh table without emitting a
  // selection change, so enter the table toolbar state explicitly —
  // shaping the just-created table is the most likely next action.
  refreshEditorTableCaretState()
}

async function insertImageFromAndroidPicker(restoreRange: Range | null = null) {
  const startResult = createAndroidImageInsertStart({
    editorReady: editorReady.value,
    hasEditor: hasEditor(),
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

  const activeEditor = getEditor()
  if (!activeEditor) {
    return
  }

  const beforeMarkdown = activeEditor.getMarkdown()
  const protectImportedImageFromCleanup = Boolean(documentState.value.sourceUri)
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
      pickAndroidImageDocument: async () => {
        const image = await pickAndroidImageDocument({
          copyImage: imageSharingSettings.value.imageCopyImages,
        })
        if (
          !image.canceled
          && !registerImportedImageCopy(image.markdownSrc, protectImportedImageFromCleanup)
        ) {
          editorLog.warn('imported image registry could not be updated')
        }
        return image
      },
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
    getMarkdown: () => getEditor()?.getMarkdown() ?? null,
    normalizeMarkdown: normalizeEditorMarkdown,
    onEdited: () => syncMarkdown('Edited'),
    onUnchanged: () => syncDocumentFromEditor(documentState.value.isDirty),
  })
}

// The contextual table panel follows the caret (issue #144): Muya's
// selection-change drives entry/exit, and the editor going away always
// counts as an exit so the panel snapshot is restored for the next session.
function refreshEditorTableCaretState() {
  setEditorCaretInTable(
    editorReady.value && resolveTableContext(getEditor()) !== null,
  )
}

watch(editorReady, ready => {
  if (!ready) {
    setEditorCaretInTable(false)
    // The mode never survives an editor teardown/remount; the document
    // state was already synced from the textarea on every input.
    sourceMode.reset()
    return
  }

  if (currentScreen.value === 'editor' && editingSettings.value.sourceCodeModeEnabled) {
    // The wired half of #149: the stored setting now opens documents in
    // source code mode. No keyboard pop on open.
    enterSourceMode({ focus: false })
  }
})

function runEditorTableCommand(commandId: TableCommandId) {
  if (!editorReady.value) {
    return
  }

  runTableCommand(getEditor(), commandId)
  // Deleting the row/column/table that held the caret can move it out of
  // any table; recompute synchronously instead of waiting for the next
  // selection-change tick.
  refreshEditorTableCaretState()
}

function runEditorToolbarCommand(commandId: MobileCommandId, restoreRange: Range | null = null) {
  const activeEditor = editorReady.value ? getEditor() : null
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

  if (result.kind === 'open-table-sheet') {
    openTableSheet(commandRange)
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
  const filteredDocuments = writeStoredAndroidRecentDocuments(
    nextDocuments,
    pinnedDocumentIds.value,
  )
  androidRecentDocuments.value = filteredDocuments
  requestAndroidDocumentGrantCleanup()
}

const syncAndroidDocumentGrants = createDocumentGrantSync()

// Fire-and-forget: grant cleanup is background maintenance and must never
// block or fail the recents mutation that triggered it.
function requestAndroidDocumentGrantCleanup() {
  syncAndroidDocumentGrants({
    currentDocument: {
      sourceUri: isCloudSourceUri(documentState.value.sourceUri)
        ? null
        : documentState.value.sourceUri,
    },
    // cloud: source URIs have no SAF grant; keep the referenced set to
    // real content:// URIs.
    recentDocuments: androidRecentDocuments.value.filter(
      record => !isCloudSourceUri(record.sourceUri),
    ),
  })
    .then(result => {
      if (result && (result.releasedGrantCount > 0 || result.failedReleaseCount > 0)) {
        androidDocumentLog.info('document grant cleanup', result)
      }
    })
    .catch(error => {
      androidDocumentLog.warn('document grant cleanup failed', { error })
    })
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
  exportCurrentDocumentPdf,
  flushCurrentDocument,
} = createCurrentDocumentPersistence({
  currentScreen,
  documentState,
  status,
  homeNotice,
  localDrafts,
  androidRecentDocuments,
  pinnedDocumentIds,
  currentAndroidDocumentCanWrite,
  promptLocalDraftSaveOnExit,
  draftExitPromptOpen,
  androidExitPromptOpen,
  savingLocalDraftToAndroid,
  savingAndroidDocumentCopy,
  sharingCurrentDocument,
  exportingPdfDocument,
  hasEditor,
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
  // Routed: cloud: source URIs save through the cloud plugin, content://
  // URIs through SAF — the whole autosave pipeline stays target-agnostic.
  writeAndroidMarkdownDocument: writeRoutedMarkdownDocument,
  // Creates prompt for a destination first (device / OneDrive / Drive);
  // the workflows only ever see the shared create contract.
  createAndroidMarkdownDocument: createMarkdownDocumentAtChosenDestination,
  shareAndroidMarkdownDocument,
  // The live editor instance carries the user's rendering settings
  // (footnotes, super/subscript, GitLab compatibility, diagram options), so
  // the PDF renders with editor parity.
  renderPdfExportHtml: options =>
    renderMarkdownToPdfExportHtml({ ...options, muya: getEditor() }),
  exportAndroidMarkdownPdf,
  getPdfTextDirection: () => appearanceTextSettings.value.textDirection,
  getAndroidDocumentUserMessage,
  markdownSaveSettings,
  imageSharingSettings,
  androidSaveRecoveryMessage: ANDROID_SAVE_RECOVERY_MESSAGE,
  appLogger: appLog,
  documentLogger: androidDocumentLog,
  draftLogger: draftLog,
})
function protectAndroidDocumentImportedImages(document: OpenedAndroidDocument) {
  if (!protectImportedImagesInAndroidDocument(document.markdown)) {
    androidDocumentLog.warn('imported image protection could not be updated', {
      sourceUri: document.sourceUri,
    })
  }
}

function rememberAndroidDocument(document: OpenedAndroidDocument) {
  protectAndroidDocumentImportedImages(document)
  persistAndroidRecentDocuments(
    rememberAndroidRecentDocument(
      androidRecentDocuments.value,
      document,
      pinnedDocumentIds.value,
    ),
  )
}

async function openAndroidDocumentResult(
  document: OpenedAndroidDocument,
  options: { source?: AndroidDocumentOpenSource } = {},
) {
  const openResult = createAndroidDocumentOpenResult(document, {
    source: options.source,
    logger: androidDocumentLog,
  })

  homeNotice.value = openResult.homeNotice
  rememberAndroidDocument(openResult.rememberDocument)
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

// --- Open locations + cloud providers (#185) ---

const oneDriveAccountState = ref<CloudAccountState | null>(null)
// 'browser' = waiting for the sign-in browser (clearable when the app
// merely becomes visible again — the user backed out); 'completing' = the
// redirect landed and the token exchange is running (only the auth event
// may clear it, or the sign-in button revives mid-exchange).
const cloudConnecting = ref<'browser' | 'completing' | null>(null)
const cloudBrowserLoading = ref(false)
const cloudBrowserError = ref<string | null>(null)
const cloudBrowserEntries = ref<CloudFolderEntry[]>([])
const cloudBrowserPath = ref<{ id: string; name: string }[]>([])
const cloudOpeningFileId = ref<string | null>(null)

async function refreshOneDriveAccountState() {
  if (!isCloudDocumentAccessAvailable()) {
    oneDriveAccountState.value = { connected: false, available: false, accountName: null }
    return
  }
  try {
    oneDriveAccountState.value = await getCloudAccountState('onedrive')
  } catch (error) {
    androidDocumentLog.warn('OneDrive account state unavailable', { error })
    oneDriveAccountState.value = { connected: false, available: false, accountName: null }
  }
}

function showOpenLocations() {
  homeNotice.value = null
  openLocationsNotice.value = null
  currentScreen.value = 'open-locations'
  void refreshOneDriveAccountState()
  void refreshGoogleDriveAccountState()
}

async function openFileFromLocations() {
  await openFileFromAndroid()
  // A failure notice renders on the home screen; a cancel stays here.
  if (homeNotice.value) {
    currentScreen.value = 'home'
  }
}

// Guards stale async listings: only the newest request may touch the UI
// (Back during a slow folder load fires a competing root request, and the
// two can complete in either order).
let cloudBrowserRequestGeneration = 0

async function loadCloudFolder() {
  const generation = ++cloudBrowserRequestGeneration
  const folderId = cloudBrowserPath.value.at(-1)?.id
  cloudBrowserLoading.value = true
  cloudBrowserError.value = null
  try {
    const entries = await listCloudFolder('onedrive', folderId)
    if (generation !== cloudBrowserRequestGeneration) {
      return
    }
    cloudBrowserEntries.value = entries
  } catch (error) {
    if (generation !== cloudBrowserRequestGeneration) {
      return
    }
    cloudBrowserEntries.value = []
    cloudBrowserError.value = getAndroidDocumentUserMessage(error)
    androidDocumentLog.warn('OneDrive folder listing failed', { error })
  } finally {
    if (generation === cloudBrowserRequestGeneration) {
      cloudBrowserLoading.value = false
    }
  }
}

async function showCloudBrowser() {
  currentScreen.value = 'cloud-browser'
  cloudBrowserPath.value = []
  cloudBrowserEntries.value = []
  cloudBrowserError.value = null
  // Wait for the account state when it has not resolved yet, so a signed-in
  // user entering quickly is not stranded on an empty, never-loaded list.
  if (oneDriveAccountState.value === null) {
    await refreshOneDriveAccountState()
  }
  if (oneDriveAccountState.value?.connected) {
    void loadCloudFolder()
  }
}

async function connectOneDrive() {
  if (cloudConnecting.value !== null) {
    return
  }
  cloudConnecting.value = 'browser'
  cloudBrowserError.value = null
  try {
    await connectCloudAccount('onedrive')
    // Completion arrives through the cloudAuthCompleted listener once the
    // browser redirects back.
  } catch (error) {
    cloudConnecting.value = null
    cloudBrowserError.value = getAndroidDocumentUserMessage(error)
    androidDocumentLog.warn('OneDrive connect failed to start', { error })
  }
}

async function disconnectOneDrive() {
  try {
    await disconnectCloudAccount('onedrive')
  } catch (error) {
    androidDocumentLog.warn('OneDrive disconnect failed', { error })
  }
  cloudBrowserEntries.value = []
  cloudBrowserPath.value = []
  cloudBrowserError.value = null
  await refreshOneDriveAccountState()
}

async function handleCloudEntryOpen(entry: CloudFolderEntry) {
  if (entry.isFolder) {
    cloudBrowserPath.value = [...cloudBrowserPath.value, { id: entry.id, name: entry.name }]
    await loadCloudFolder()
    return
  }
  if (cloudBrowserSaveModeActive.value) {
    // Files are inert while choosing a save-as destination folder.
    return
  }

  cloudOpeningFileId.value = entry.id
  try {
    const content = await readCloudDocument('onedrive', entry.id, androidMarkdownSettings.value)
    await openAndroidDocumentResult(toOpenedDocumentFromCloud('onedrive', content))
  } catch (error) {
    cloudBrowserError.value = getAndroidDocumentUserMessage(error)
    androidDocumentLog.error('open OneDrive document failed', { fileId: entry.id, error })
  } finally {
    cloudOpeningFileId.value = null
  }
}

async function cloudBrowserNavigateUp() {
  cloudBrowserPath.value = cloudBrowserPath.value.slice(0, -1)
  await loadCloudFolder()
}

// --- Google Drive (in-flow picker: the OAuth page hosts the file picker,
// picked_file_ids ride the redirect — drive.file cannot browse folders and
// the Picker cannot run in a session-less WebView) ---

const googleDriveAccountState = ref<CloudAccountState | null>(null)
// 'connecting' = browser trip (visibility-clearable, see above);
// 'completing' = redirect landed, exchange running; 'opening' = reading
// the picked document.
const googleDriveBusy = ref<'connecting' | 'completing' | 'opening' | null>(null)

// "Still on the Open page" is not "still in the flow that started this
// pick": leaving and returning mid-exchange/mid-download must not let the
// abandoned completion through (Codex round 4).
const googleDrivePickFlow = createGoogleDrivePickFlow()
watch(currentScreen, (next, previous) => {
  if (previous === 'open-locations' && next !== 'open-locations') {
    googleDrivePickFlow.noteLeftOpenPage()
  }
})

function ownsGoogleDrivePickCompletion() {
  return googleDrivePickFlow.ownsCompletion() && currentScreen.value === 'open-locations'
}
const openLocationsNotice = ref<string | null>(null)

async function refreshGoogleDriveAccountState() {
  if (!isCloudDocumentAccessAvailable()) {
    googleDriveAccountState.value = { connected: false, available: false, accountName: null }
    return
  }
  try {
    googleDriveAccountState.value = await getCloudAccountState('googledrive')
  } catch (error) {
    androidDocumentLog.warn('Google Drive account state unavailable', { error })
    googleDriveAccountState.value = { connected: false, available: false, accountName: null }
  }
}

// Every pick is one browser round trip (sign-in and picking are the same
// authorization flow), so connected or not, the row starts the same trip.
async function handleOpenGoogleDrive() {
  if (googleDriveBusy.value !== null) {
    return
  }
  // Lock BEFORE the first await: a second tap during the account-state
  // refresh would otherwise start a competing browser flow whose fresh
  // OAuth state clobbers the first one's pending record.
  googleDriveBusy.value = 'connecting'
  googleDrivePickFlow.beginFlow()
  openLocationsNotice.value = null
  try {
    if (googleDriveAccountState.value === null) {
      await refreshGoogleDriveAccountState()
    }
    if (!googleDriveAccountState.value?.available) {
      googleDriveBusy.value = null
      return
    }
    await connectCloudAccount('googledrive')
    // Completion arrives through the cloudAuthCompleted listener once the
    // browser redirects back, carrying the picked file ids.
  } catch (error) {
    googleDriveBusy.value = null
    openLocationsNotice.value = getAndroidDocumentUserMessage(error)
    androidDocumentLog.warn('Google Drive pick failed to start', { error })
  }
}

async function openPickedGoogleDriveDocument(fileId: string) {
  googleDriveBusy.value = 'opening'
  try {
    const content = await readCloudDocument('googledrive', fileId, androidMarkdownSettings.value)
    if (!ownsGoogleDrivePickCompletion()) {
      // The user moved on while the document was downloading; opening it
      // now would replace their current work without consent.
      androidDocumentLog.info('discarded a picked document open: the user left the Open page', {
        fileId,
      })
      return
    }
    await openAndroidDocumentResult(toOpenedDocumentFromCloud('googledrive', content))
  } catch (error) {
    openLocationsNotice.value = getAndroidDocumentUserMessage(error)
    androidDocumentLog.error('open Google Drive document failed', { fileId, error })
  } finally {
    googleDriveBusy.value = null
  }
}

async function disconnectGoogleDrive() {
  try {
    await disconnectCloudAccount('googledrive')
  } catch (error) {
    androidDocumentLog.warn('Google Drive disconnect failed', { error })
  }
  openLocationsNotice.value = null
  await refreshGoogleDriveAccountState()
}

// --- Save-as destinations (#185): the draft save and save-copy flows get
// their create function from here — a full-screen destination page (the
// Open page in save mode) routes to the SAF creator, an in-app OneDrive
// folder pick, or a Drive folder browser trip.

let saveDestinationResolver:
  | ((choice: 'device' | 'onedrive' | 'googledrive' | null) => void)
  | null = null

function promptSaveDestination(): Promise<'device' | 'onedrive' | 'googledrive' | null> {
  return new Promise(resolve => {
    saveDestinationResolver = choice => {
      saveDestinationResolver = null
      resolve(choice)
    }
    currentScreen.value = 'save-locations'
    void refreshOneDriveAccountState()
    void refreshGoogleDriveAccountState()
  })
}

function chooseSaveDestination(choice: 'device' | 'onedrive' | 'googledrive' | null) {
  saveDestinationResolver?.(choice)
}

const cloudNameSheetOpen = ref(false)
const cloudNameSuggested = ref('')
let cloudNameResolver: ((name: string | null) => void) | null = null

function promptCloudDocumentName(suggestedName: string): Promise<string | null> {
  return new Promise(resolve => {
    cloudNameResolver = name => {
      cloudNameResolver = null
      cloudNameSheetOpen.value = false
      resolve(name)
    }
    cloudNameSuggested.value = suggestedName
    cloudNameSheetOpen.value = true
  })
}

function resolveCloudDocumentName(name: string | null) {
  cloudNameResolver?.(name)
}

const cloudBrowserSaveModeActive = ref(false)
let oneDriveSaveFolderResolver: ((folderId: string | null) => void) | null = null

function pickOneDriveSaveFolder(): Promise<string | null> {
  return new Promise(resolve => {
    oneDriveSaveFolderResolver = folderId => {
      oneDriveSaveFolderResolver = null
      // Save mode stays on through the create that follows — dropping it
      // here would hand the browser back its file rows and sign-out while
      // the upload still runs. The orchestrator's finally clears it and
      // restores the screen.
      resolve(folderId)
    }
    cloudBrowserSaveModeActive.value = true
    cloudBrowserPath.value = []
    cloudBrowserEntries.value = []
    cloudBrowserError.value = null
    currentScreen.value = 'cloud-browser'
    void loadCloudFolder()
  })
}

function handleCloudSaveHere() {
  // Empty id = the drive root.
  oneDriveSaveFolderResolver?.(cloudBrowserPath.value.at(-1)?.id ?? '')
}

function cancelOneDriveSaveFolderPick() {
  oneDriveSaveFolderResolver?.(null)
}

const googleDrivePickingFolder = ref(false)
let googleDriveSaveFolderResolver: ((folderId: string | null) => void) | null = null

function pickGoogleDriveSaveFolder(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    googleDriveSaveFolderResolver = folderId => {
      googleDriveSaveFolderResolver = null
      googleDrivePickingFolder.value = false
      resolve(folderId)
    }
    googleDrivePickingFolder.value = true
    connectCloudAccount('googledrive', { pickMode: 'folder' }).catch(error => {
      if (googleDriveSaveFolderResolver !== null) {
        googleDriveSaveFolderResolver = null
        googleDrivePickingFolder.value = false
        reject(error)
      }
    })
  })
}

function cancelGoogleDriveSaveFolderPick() {
  googleDriveSaveFolderResolver?.(null)
}

const googleDrivePickOverlay = ref<HTMLElement | null>(null)
const { onModalKeydown: onGoogleDrivePickOverlayKeydown } = useModalFocus({
  root: googleDrivePickOverlay,
  onEscape: cancelGoogleDriveSaveFolderPick,
})

/** Set while the routed cloud create is in flight; locks the whole UI. */
const cloudSaveInProgress = ref<'onedrive' | 'googledrive' | null>(null)
const cloudSaveOverlay = ref<HTMLElement | null>(null)
const { onModalKeydown: onCloudSaveOverlayKeydown } = useModalFocus({ root: cloudSaveOverlay })

// The save-as screens cover the still-mounted editor; each takes the
// modal focus scope so the editor leaves the accessibility tree and the
// Tab order (inert + aria-hidden) and focus enters the page. Separate
// instances per screen keep the background-isolation counters balanced
// across the destination-page → folder-browser hop.
const saveDestinationScreen = ref<HTMLElement | null>(null)
const { onModalKeydown: onSaveDestinationScreenKeydown } = useModalFocus({
  root: saveDestinationScreen,
  initialFocus: () => saveDestinationScreen.value,
})
const oneDriveSaveScreen = ref<HTMLElement | null>(null)
const { onModalKeydown: onOneDriveSaveScreenKeydown } = useModalFocus({
  root: oneDriveSaveScreen,
  initialFocus: () => oneDriveSaveScreen.value,
})

/**
 * The create function injected into the persistence workflows: same
 * contract as the SAF creator, with the destination chosen first on a
 * full-screen page (the Open page in save mode). Backing out at any step
 * reads as a cancel, which the workflows already handle; the editor
 * screen is restored whichever way the flow ends.
 */
async function createMarkdownDocumentAtChosenDestination(
  markdown: string,
  suggestedName: string,
  options: { encoding: MarkdownEncoding; writeBom: boolean },
) {
  try {
    const destination = await promptSaveDestination()
    if (destination === null) {
      return { canceled: true as const }
    }
    if (destination === 'device') {
      return await createAndroidMarkdownDocument(markdown, suggestedName, options)
    }
    const name = await promptCloudDocumentName(suggestedName)
    if (name === null) {
      return { canceled: true as const }
    }
    const folderId =
      destination === 'onedrive'
        ? await pickOneDriveSaveFolder()
        : await pickGoogleDriveSaveFolder()
    if (folderId === null) {
      return { canceled: true as const }
    }
    cloudSaveInProgress.value = destination
    return await createRoutedCloudDocument(destination, folderId, name, markdown, options)
  } finally {
    cloudSaveInProgress.value = null
    cloudBrowserSaveModeActive.value = false
    currentScreen.value = 'editor'
  }
}

function installCloudAuthListener() {
  if (!isCloudDocumentAccessAvailable()) {
    return
  }
  // Backing out of the sign-in browser produces no redirect and therefore
  // no auth event; returning to a visible app with `connecting` still set
  // means exactly that. Reset so the button recovers — a redirect that DID
  // land completes asynchronously and wins via the auth event below.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') {
      return
    }
    // Only the browser-wait phase may be cleared here: with no redirect
    // there will never be an auth event, so visibility is the only signal
    // the user backed out. The 'completing' phase belongs to the pending/
    // completed events below — a landed redirect flips visibility too, and
    // clearing it would revive the sign-in mid-exchange (Codex round 2).
    if (cloudConnecting.value === 'browser') {
      cloudConnecting.value = null
      void refreshOneDriveAccountState()
    }
    if (googleDriveBusy.value === 'connecting') {
      googleDriveBusy.value = null
      void refreshGoogleDriveAccountState()
    }
  })
  // The redirect landed and the token exchange started: lock the sign-in
  // controls until the completed event reports the outcome.
  void addCloudAuthPendingListener(event => {
    if (event.provider === 'googledrive') {
      // A save-folder trip has its own modal overlay; the Open-page row
      // state machine only tracks document-pick trips.
      if (googleDriveSaveFolderResolver !== null) {
        return
      }
      if (googleDriveBusy.value === null || googleDriveBusy.value === 'connecting') {
        googleDriveBusy.value = 'completing'
      }
      return
    }
    if (event.provider === 'onedrive') {
      cloudConnecting.value = 'completing'
    }
  })
  void addCloudAuthListener(event => {
    if (event.provider === 'googledrive') {
      // Save-as folder trips resolve their own promise; nothing here may
      // fall through to the document-open handling below.
      if (googleDriveSaveFolderResolver !== null) {
        const resolveFolder = googleDriveSaveFolderResolver
        if (event.connected) {
          void refreshGoogleDriveAccountState()
          resolveFolder(event.pickedFileIds?.[0] ?? null)
        } else {
          androidDocumentLog.warn('Google Drive folder pick did not complete', {
            errorCode: event.errorCode,
          })
          resolveFolder(null)
        }
        return
      }
      if (event.connected) {
        const pickedFileId = event.pickedFileIds?.[0]
        if (pickedFileId && ownsGoogleDrivePickCompletion()) {
          // Atomic completing → opening: no unlocked gap in which a second
          // flow could start before the picked document begins loading.
          googleDriveBusy.value = 'opening'
          void refreshGoogleDriveAccountState()
          void openPickedGoogleDriveDocument(pickedFileId)
        } else {
          // The user left the Open page while the exchange ran (Back is
          // never blocked); a late event must not clobber whatever they
          // are working on now — the pick is dropped, the account stays
          // connected, and picking again is one tap.
          if (pickedFileId) {
            androidDocumentLog.info('discarded a picked document: the user left the Open page')
          }
          googleDriveBusy.value = null
          void refreshGoogleDriveAccountState()
        }
        return
      }
      if (googleDriveBusy.value === 'connecting' || googleDriveBusy.value === 'completing') {
        googleDriveBusy.value = null
      }
      if (event.errorCode !== 'CLOUD_AUTH_CANCELED') {
        openLocationsNotice.value = event.message ?? 'The Google Drive sign-in failed'
      }
      androidDocumentLog.warn('Google Drive sign-in did not complete', {
        errorCode: event.errorCode,
      })
      return
    }
    if (event.connected) {
      // Unlock only after the account state reflects the connection: the
      // native exchange gate is already released, so an early unlock would
      // let a second sign-in start in the refresh window.
      void refreshOneDriveAccountState().then(() => {
        cloudConnecting.value = null
        if (currentScreen.value === 'cloud-browser') {
          void loadCloudFolder()
        }
      })
      return
    }
    cloudConnecting.value = null
    if (event.errorCode !== 'CLOUD_AUTH_CANCELED') {
      cloudBrowserError.value = event.message ?? 'OneDrive sign-in failed'
    }
    androidDocumentLog.warn('OneDrive sign-in did not complete', {
      errorCode: event.errorCode,
    })
  })
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
    readRoutedMarkdownDocument(sourceUri, androidMarkdownSettings.value),
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
      const document = await readRoutedMarkdownDocument(
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

  // A recovery reload carried the live document across the page restart as a
  // one-shot handoff; restoring it takes priority over the configured startup
  // action so a temporary Open With / shared session is reopened, not lost.
  const recoveryHandoff = consumeEditorRecoveryHandoff()
  if (recoveryHandoff) {
    void restoreEditorRecoveryHandoff(recoveryHandoff)
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

// Reopen the exact document a recovery reload carried across the page restart.
// Mirrors a normal incoming open (state, editor, status, focus release) but from
// the persisted handoff — the only path back to a temporary Open With / shared
// session that never reached Recents.
async function restoreEditorRecoveryHandoff(handoff: EditorRecoveryHandoff) {
  appLog.info('restore editor recovery handoff', {
    autosaveTarget: handoff.documentState.autosaveTarget,
  })
  homeNotice.value = null
  androidExitPromptOpen.value = false
  currentAndroidDocumentCanWrite.value = handoff.currentAndroidDocumentCanWrite
  promptLocalDraftSaveOnExit.value = handoff.promptLocalDraftSaveOnExit
  documentState.value = handoff.documentState
  await openEditor(handoff.documentState.markdown)
  if (!editorReady.value) {
    return
  }
  status.value = handoff.status
  releaseEditorFocusAfterOpen()
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
  if (!hasEditor()) {
    return
  }

  closeEditorMenu()
  // Also cancels an outline open that is still waiting for the viewport,
  // so the two surfaces can never end up open at the same time.
  closeEditorOutline()
  standDownResume('search opened')
  endSelectionCaretSession('search opened')
  openEditorSearchBar()
  appLog.info('editor search opened')
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

function closeEditorToHome() {
  // Write the resume position while the editor still exists; the session is
  // gone right after, so a late flush cannot double-write.
  void persistResumePosition('editor closed')
  resetResumeForNewDocument()
  draftExitPromptOpen.value = false
  androidExitPromptOpen.value = false
  closeEditorMenu()
  closeLinkSheet()
  closeTableSheet()
  closeEditorToolbar()
  // No hand-back on the way out: the document state already tracks the
  // textarea, and the muya instance is about to be destroyed anyway.
  sourceMode.reset()
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
  closeEditorOutline()
  standDownResume('leaving editor')
  endSelectionCaretSession('leaving editor')
  // Leaving the editor: clear highlights without refocusing the editor.
  closeEditorSearch({ restoreCursor: false })

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

// An incoming Intent could not durably preserve the current document. Keep the
// editor mounted and let the user decide instead of silently replacing it.
function confirmIncomingOpenAfterBlockedPreserve(request: {
  incomingName: string
  proceed: () => Promise<void>
}) {
  // The safety prompt must be the only surface on screen so it is visible and
  // Android Back answers it — otherwise an open menu/outline (z-index 40) would
  // cover it. Close transient editor chrome WITHOUT touching the editor, which
  // stays mounted with its unsaved content.
  closeEditorMenu()
  closeEditorToolbar()
  closeEditorOutline()
  closeEditorSearch({ restoreCursor: false })
  closeLinkSheet()
  closeTableSheet()
  draftExitPromptOpen.value = false
  androidExitPromptOpen.value = false

  pendingIncomingOpenProceed = request.proceed
  incomingOpenName.value = request.incomingName
  incomingOpenPromptOpen.value = true
  appLog.warn('incoming open blocked: current document could not be preserved', {
    incomingName: request.incomingName,
  })
}

function keepEditingInsteadOfIncomingOpen() {
  pendingIncomingOpenProceed = null
  incomingOpenPromptOpen.value = false
  incomingOpenName.value = ''
  // Resume the queue: any intent that arrived while the prompt was open runs now.
  void incomingDocuments.resolveIncomingDecision()
}

async function discardCurrentAndOpenIncoming() {
  const proceed = pendingIncomingOpenProceed
  pendingIncomingOpenProceed = null
  incomingOpenPromptOpen.value = false
  incomingOpenName.value = ''
  try {
    if (proceed) {
      await proceed()
    }
  } catch (error) {
    const message = getAndroidDocumentUserMessage(error)
    homeNotice.value = message
    status.value = message
    androidDocumentLog.error('open incoming Android document after discard failed', error)
  } finally {
    // Always release the decision gate, even when the deferred open fails.
    // Otherwise every future incoming Intent stays queued with no prompt left
    // on screen to resume it.
    void incomingDocuments.resolveIncomingDecision()
  }
}

function requestLifecycleFlush(reason: string) {
  void flushCurrentDocument(reason)
  // Same lifecycle moments the document flush uses; the position write is
  // independent of the save pipeline and never dirties the document.
  void persistResumePosition(reason)
}

async function handleAppBackButton() {
  appLog.info('Android back button pressed', {
    screen: currentScreen.value,
    homeTab: homeTab.value,
    settingsPage: settingsPage.value,
    promptOpen: draftExitPromptOpen.value,
    androidExitPromptOpen: androidExitPromptOpen.value,
    menuOpen: editorMenuOpen.value,
    outlineOpen: editorOutlineOpen.value,
    searchOpen: editorSearchOpen.value,
    toolbarOpen: editorToolbarExpanded.value,
    sourceModeOpen: sourceModeActive.value,
  })

  const action = getAppBackButtonAction({
    currentScreen: currentScreen.value,
    homeTab: homeTab.value,
    settingsPage: settingsPage.value,
    incomingOpenPromptOpen: incomingOpenPromptOpen.value,
    androidExitPromptOpen: androidExitPromptOpen.value,
    draftExitPromptOpen: draftExitPromptOpen.value,
    linkSheetOpen: linkSheetOpen.value,
    tableSheetOpen: tableSheetOpen.value,
    editorMenuOpen: editorMenuOpen.value,
    editorOutlineOpen: editorOutlineOpen.value,
    editorSearchOpen: editorSearchOpen.value,
    editorToolbarExpanded: editorToolbarExpanded.value,
    editorSourceModeActive: sourceModeActive.value,
    homeSelectionActive: homeSelection.isActive.value,
    homeSheetOpen: homeDeleteSheetOpen.value || homeRenameSheetOpen.value,
    cloudBrowserAtRoot: cloudBrowserPath.value.length === 0,
    cloudBrowserSaveModeActive: cloudBrowserSaveModeActive.value,
    cloudNameSheetOpen: cloudNameSheetOpen.value,
    googleDriveFolderPickActive: googleDrivePickingFolder.value,
    cloudSaveInProgress: cloudSaveInProgress.value !== null,
  })

  switch (action) {
    case 'close-incoming-open-prompt':
      keepEditingInsteadOfIncomingOpen()
      return
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
    case 'close-table-sheet':
      closeTableSheet()
      return
    case 'close-editor-menu':
      closeEditorMenu()
      return
    case 'close-editor-source-mode':
      // Back dismisses the mode like a panel; the controller falls back to
      // the last known textarea caret for the WYSIWYG hand-back.
      exitSourceMode(null)
      return
    case 'close-editor-outline':
      closeEditorOutline()
      return
    case 'close-editor-search':
      closeEditorSearch()
      return
    case 'close-editor-toolbar':
      closeEditorToolbar()
      return
    case 'show-home':
      await showHome()
      return
    case 'show-open-locations':
      currentScreen.value = 'open-locations'
      return
    case 'cancel-save-destination':
      chooseSaveDestination(null)
      return
    case 'cancel-cloud-name':
      resolveCloudDocumentName(null)
      return
    case 'cancel-google-folder-pick':
      cancelGoogleDriveSaveFolderPick()
      return
    case 'cancel-onedrive-folder-pick':
      cancelOneDriveSaveFolderPick()
      return
    case 'ignore-cloud-save':
      // A cloud create is in flight; Back settles after it does.
      return
    case 'cloud-browser-up':
      await cloudBrowserNavigateUp()
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
  incomingFileImportedMessage: INCOMING_FILE_IMPORTED_MESSAGE,
  openWithTemporaryAccessMessage: OPEN_WITH_TEMPORARY_ACCESS_MESSAGE,
  shareTemporaryAccessMessage: SHARE_TEMPORARY_ACCESS_MESSAGE,
  hasEditor,
  openEditor,
  releaseEditorFocusAfterOpen,
  closeEditorMenu,
  closeEditorToolbar,
  openAndroidDocumentResult,
  protectIncomingDocumentImages: protectAndroidDocumentImportedImages,
  saveAndroidDocument,
  saveDraft,
  syncDocumentFromEditor,
  persistAndroidRecoveryDraft,
  canPersistLocalDrafts,
  persistLocalDrafts,
  confirmIncomingOpenAfterBlockedPreserve,
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
  setLocalePreference(AUTO_APP_LOCALE)
  appLog.info('reset settings from Advanced maintenance')
}

async function cleanImportedImagesMaintenanceState() {
  if (!isAndroidImageImportAvailable()) {
    throw new Error(t('settings.maintenance.cleanImagesUnavailable'))
  }

  let result: ImportedAndroidImageCleanupResult
  try {
    result = await cleanupUnusedImportedImages({
      currentDocument: {
        sourceUri: documentState.value.sourceUri,
        markdown: documentState.value.markdown,
      },
      localDrafts: localDrafts.value,
      recentDocuments: androidRecentDocuments.value,
      readRecentMarkdown: sourceUri =>
        readRoutedMarkdownDocument(sourceUri, androidMarkdownSettings.value),
    })
  } catch (error) {
    if (error instanceof ImportedImageCleanupBlockedError) {
      throw new Error(
        t(error.unreadableDocumentCount === 1
          ? 'settings.maintenance.cleanImagesUnreadable.one'
          : 'settings.maintenance.cleanImagesUnreadable.other', {
          count: error.unreadableDocumentCount,
        }),
        { cause: error },
      )
    }
    throw error
  }

  androidDocumentLog.info('cleaned unused imported images from Advanced maintenance', result)
  if (result.removedFileCount === 0) {
    if (result.failedFileCount > 0) {
      return {
        message: t(result.failedFileCount === 1
          ? 'settings.maintenance.cleanImagesFailed.one'
          : 'settings.maintenance.cleanImagesFailed.other', {
          count: result.failedFileCount,
        }),
      }
    }
    return { message: t('settings.maintenance.cleanImagesNone') }
  }

  const params = {
    count: result.removedFileCount,
    size: formatImportedImageStorageBytes(result.removedBytes, locale.value),
    failed: result.failedFileCount,
  }
  return {
    message: t(
      result.failedFileCount > 0
        ? (result.removedFileCount === 1
            ? 'settings.maintenance.cleanImagesPartial.one'
            : 'settings.maintenance.cleanImagesPartial.other')
        : (result.removedFileCount === 1
            ? 'settings.maintenance.cleanImagesSuccess.one'
            : 'settings.maintenance.cleanImagesSuccess.other'),
      params,
    ),
  }
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

  if (action === 'cleanImportedImages') {
    return cleanImportedImagesMaintenanceState()
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
  // Drafts saved before per-draft numbering shared the generic Untitled-1;
  // give each genuinely untitled one a distinct, frozen Untitled-N once so
  // their identities are stable from here on.
  const storedDrafts = readStoredLocalDrafts()
  const restoredDrafts = assignUntitledDraftNames(storedDrafts)
  const restoredRecentDocuments = readStoredAndroidRecentDocuments()
  const legacyDraft = readLegacyDraft()

  androidRecentDocuments.value = restoredRecentDocuments
  pinnedDocuments.value = readStoredPinnedDocuments()

  if (restoredDrafts.length > 0) {
    if (restoredDrafts !== storedDrafts) {
      persistLocalDrafts(restoredDrafts)
    }
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

  // Releases grants left pending by a previous session (for example the app
  // was killed between a recents mutation and its cleanup call).
  requestAndroidDocumentGrantCleanup()

  incomingDocuments.installListeners()
  installCloudAuthListener()
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
  void persistResumePosition('app unmount')
  resetResumeForNewDocument()
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
    :hidden-document-count="hiddenHomeDocumentCount"
    :notice="displayHomeNotice"
    :selection-active="homeSelection.isActive.value"
    :selection-count="homeSelection.count.value"
    :selected-ids="homeSelection.selectedIds.value"
    :all-selected-pinned="allSelectedDocumentsPinned"
    :delete-sheet-open="homeDeleteSheetOpen"
    :rename-sheet-open="homeRenameSheetOpen"
    :run-maintenance-action="runAdvancedMaintenanceAction"
    @new-document="newDocument"
    @open-document="openDocument"
    @open-file="showOpenLocations"
    @show-all-documents="homeListExpanded = true"
    @set-tab="setHomeTab"
    @set-settings-page="setSettingsPage"
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

  <OpenLocationsScreen
    v-else-if="currentScreen === 'open-locations'"
    :one-drive-state="oneDriveAccountState"
    :google-drive-state="googleDriveAccountState"
    :google-drive-busy="googleDriveBusy"
    :notice="openLocationsNotice"
    @back="currentScreen = 'home'"
    @open-this-phone="openFileFromLocations"
    @browse-all="openFileFromLocations"
    @open-one-drive="showCloudBrowser"
    @open-google-drive="handleOpenGoogleDrive"
    @disconnect-one-drive="disconnectOneDrive"
    @disconnect-google-drive="disconnectGoogleDrive"
  />

  <CloudBrowserScreen
    v-else-if="currentScreen === 'cloud-browser' && !cloudBrowserSaveModeActive"
    :account-state="oneDriveAccountState"
    :connecting="cloudConnecting"
    :loading="cloudBrowserLoading"
    :error-message="cloudBrowserError"
    :entries="cloudBrowserEntries"
    :folder-name="cloudBrowserPath.at(-1)?.name ?? null"
    :opening-file-id="cloudOpeningFileId"
    @back="
      cloudBrowserPath.length > 0 ? cloudBrowserNavigateUp() : (currentScreen = 'open-locations')
    "
    @connect="connectOneDrive"
    @disconnect="disconnectOneDrive"
    @open-entry="handleCloudEntryOpen"
    @retry="loadCloudFolder"
  />

  <EditorScreen
    v-else
    v-model:link-text="linkText"
    v-model:link-url="linkUrl"
    v-model:table-rows="tableRows"
    v-model:table-columns="tableColumns"
    :document-title="displayDocumentTitle"
    :status="displayStatus"
    :editor-ready="editorReady"
    :editor-failed="editorFailed"
    :show-editor-actions="canShowEditorActions()"
    :editor-menu-open="editorMenuOpen"
    :toolbar-visible="toolbarSettings.displayMode !== 'hidden'"
    :toolbar-expanded="editorToolbarExpanded"
    :toolbar-panel="editorToolbarPanel"
    :toolbar-compact="toolbarSettings.compact"
    :toolbar-caret-in-table="editorCaretInTable"
    :quick-toolbar-commands="toolbarSettings.quickCommands"
    :word-count="wordCount"
    :character-count="characterCount"
    :line-count="lineCount"
    :can-share="canShareCurrentDocument()"
    :can-export-pdf="canShareCurrentDocument()"
    :can-save-to-device="canSaveLocalDraftToAndroidDocument()"
    :can-save-copy="canSaveAndroidDocumentCopy()"
    :sharing="sharingCurrentDocument"
    :exporting-pdf="exportingPdfDocument"
    :saving-to-device="savingLocalDraftToAndroid"
    :saving-copy="savingAndroidDocumentCopy"
    :link-sheet-open="linkSheetOpen"
    :table-sheet-open="tableSheetOpen"
    :draft-exit-prompt-open="draftExitPromptOpen"
    :draft-can-save-to-device="canSaveLocalDraftToAndroidDocument()"
    :draft-can-keep-local="canPersistLocalDrafts()"
    :draft-saving="savingLocalDraftToAndroid"
    :android-exit-prompt-open="androidExitPromptOpen"
    :android-exit-message="getAndroidExitPromptMessage()"
    :android-can-save-copy="canSaveAndroidDocumentCopy()"
    :android-can-keep-recovery="canPersistAndroidRecoveryDrafts()"
    :android-saving="savingAndroidDocumentCopy"
    :incoming-open-prompt-open="incomingOpenPromptOpen"
    :incoming-open-name="incomingOpenName"
    :text-direction="appearanceTextSettings.textDirection"
    :editor-style-vars="editorStyleVars"
    :can-paste-selection="selectionClipboardHasText"
    :selection-caret-session="selectionCaretSessionActive"
    :selection-custom-commands="selectionToolbarSettings.customCommands"
    :selection-custom-rows="selectionToolbarSettings.rows"
    :link-overlay-enabled="editingSettings.linkPopup"
    :search-open="editorSearchOpen"
    :search-query="editorSearchQuery"
    :search-match-count="editorSearchMatchCount"
    :search-active-index="editorSearchActiveIndex"
    :search-replace-open="editorSearchReplaceOpen"
    :search-replace-value="editorSearchReplaceValue"
    :search-case-sensitive="editorSearchCaseSensitive"
    :search-replace-all-count="editorSearchReplaceAllCount"
    :outline-open="editorOutlineOpen"
    :outline-items="editorOutlineItems"
    :resume-card-visible="resumeCardVisible"
    :resume-card-text="resumeCardText"
    :source-mode-active="sourceModeActive"
    :source-text="sourceModeText"
    :source-entry-caret="sourceModeEntryCaret"
    :source-focus-on-enter="sourceModeFocusOnEnter"
    @toggle-source-mode="toggleSourceModeFromScreen"
    @update:source-text="
      (value: string, caret: { start: number, end: number } | null) =>
        sourceMode.updateText(value, caret)
    "
    @back="showHome"
    @retry-editor="retryEditorFromRecovery"
    @search="openEditorSearch"
    @close-search="closeEditorSearch()"
    @update:search-query="setEditorSearchQuery"
    @search-next="findNextEditorSearchMatch"
    @search-previous="findPreviousEditorSearchMatch"
    @toggle-search-replace="toggleEditorSearchReplace"
    @update:search-replace-value="setEditorSearchReplaceValue"
    @toggle-search-case="toggleEditorSearchCase"
    @search-replace-current="replaceCurrentEditorSearchMatch"
    @search-replace-all="replaceAllEditorSearchMatches"
    @open-outline="openEditorOutline"
    @close-outline="closeEditorOutline"
    @select-outline-heading="selectEditorOutlineHeading"
    @resume-activate="activateEditorResume"
    @resume-dismiss="dismissResumeCard('dismiss button')"
    @toggle-menu="toggleEditorMenuExclusive"
    @close-menu="closeEditorMenu"
    @share="shareCurrentMarkdownDocument"
    @export-pdf="exportCurrentDocumentPdf"
    @save-to-device="saveLocalDraftToAndroidDocument"
    @save-copy="saveAndroidDocumentCopy"
    @run-toolbar-command="runEditorToolbarCommand"
    @run-table-command="runEditorTableCommand"
    @run-selection-command="runEditorSelectionCommand"
    @dismiss-selection="finishSelectionToolbarOutsideTap"
    @open-link="openEditorLink"
    @toggle-toolbar="toggleEditorToolbarExclusive"
    @set-toolbar-panel="setEditorToolbarPanel"
    @close-link-sheet="closeLinkSheet"
    @insert-link="insertLinkFromSheet"
    @close-table-sheet="closeTableSheet"
    @insert-table="insertTableFromSheet"
    @save-draft-to-device="saveLocalDraftToAndroidDocument({ returnHomeAfterSave: true })"
    @keep-local-draft="keepLocalDraftAndShowHome"
    @discard-local-draft="discardLocalDraftAndShowHome"
    @save-android-copy="saveAndroidDocumentCopy({ returnHomeAfterSave: true })"
    @keep-android-recovery="keepAndroidRecoveryAndShowHome"
    @discard-android-changes="discardAndroidChangesAndShowHome"
    @keep-incoming="keepEditingInsteadOfIncomingOpen"
    @discard-incoming="discardCurrentAndOpenIncoming"
    @editor-host-change="setEditorElement"
  />

  <!-- The save-as screens overlay the still-mounted editor: unmounting it
       would tear down the Muya session mid-save (#198 review). -->
  <div
    v-if="currentScreen === 'save-locations'"
    ref="saveDestinationScreen"
    class="save-flow-screen"
    tabindex="-1"
    @keydown="onSaveDestinationScreenKeydown"
  >
    <OpenLocationsScreen
      mode="save"
      :one-drive-state="oneDriveAccountState"
      :google-drive-state="googleDriveAccountState"
      :google-drive-busy="null"
      :notice="openLocationsNotice"
      @back="chooseSaveDestination(null)"
      @open-this-phone="chooseSaveDestination('device')"
      @open-one-drive="chooseSaveDestination('onedrive')"
      @open-google-drive="chooseSaveDestination('googledrive')"
    />
  </div>

  <div
    v-else-if="currentScreen === 'cloud-browser' && cloudBrowserSaveModeActive"
    ref="oneDriveSaveScreen"
    class="save-flow-screen"
    tabindex="-1"
    @keydown="onOneDriveSaveScreenKeydown"
  >
    <CloudBrowserScreen
      :account-state="oneDriveAccountState"
      :connecting="cloudConnecting"
      :loading="cloudBrowserLoading"
      :error-message="cloudBrowserError"
      :entries="cloudBrowserEntries"
      :folder-name="cloudBrowserPath.at(-1)?.name ?? null"
      :opening-file-id="cloudOpeningFileId"
      :save-mode="true"
      @back="
        cloudBrowserPath.length > 0 ? cloudBrowserNavigateUp() : cancelOneDriveSaveFolderPick()
      "
      @connect="connectOneDrive"
      @open-entry="handleCloudEntryOpen"
      @retry="loadCloudFolder"
      @save-here="handleCloudSaveHere"
    />
  </div>

  <CloudNameSheet
    v-if="cloudNameSheetOpen"
    :suggested-name="cloudNameSuggested"
    @confirm="name => resolveCloudDocumentName(name)"
    @cancel="resolveCloudDocumentName(null)"
  />

  <section
    v-if="googleDrivePickingFolder"
    ref="googleDrivePickOverlay"
    class="draft-save-sheet save-flow-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="drive-folder-pick-title"
    tabindex="-1"
    @keydown="onGoogleDrivePickOverlayKeydown"
  >
    <div class="draft-save-panel">
      <h2 id="drive-folder-pick-title">{{ t('saveAs.drivePickingFolder') }}</h2>
      <div class="draft-save-actions">
        <button type="button" @click="cancelGoogleDriveSaveFolderPick">
          {{ t('saveAs.cancel') }}
        </button>
      </div>
    </div>
  </section>

  <section
    v-if="cloudSaveInProgress !== null"
    ref="cloudSaveOverlay"
    class="draft-save-sheet save-flow-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="cloud-save-progress-title"
    tabindex="-1"
    data-testid="cloud-save-progress"
    @keydown="onCloudSaveOverlayKeydown"
  >
    <div class="draft-save-panel">
      <h2 id="cloud-save-progress-title">{{ t('saveAs.saving') }}</h2>
    </div>
  </section>
</template>
