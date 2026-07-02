<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { App } from '@capacitor/app'
import AndroidExitPrompt from './components/editor/AndroidExitPrompt.vue'
import EditorActionSheet from './components/editor/EditorActionSheet.vue'
import LinkInsertSheet from './components/editor/LinkInsertSheet.vue'
import LocalDraftExitPrompt from './components/editor/LocalDraftExitPrompt.vue'
import HomeShell from './components/HomeShell.vue'
import MobileEditorToolbar from './components/MobileEditorToolbar.vue'
import {
  createAndroidMarkdownDocument,
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
} from './lib/androidDocumentIntentListeners'
import {
  createAndroidRecoveryDraft,
  getAndroidRecoveryDraftId,
} from './lib/androidRecoveryDrafts'
import {
  applyAndroidDocumentAutosaveFailure,
  applyAndroidDocumentAutosaveSuccess,
  canApplyAndroidDocumentAutosaveSuccess,
  createAndroidDocumentAutosaveRequest,
} from './lib/androidDocumentAutosave'
import {
  markSavedAndroidRecentDocument,
  rememberAndroidRecentDocument,
} from './lib/androidRecentDocuments'
import {
  createUntitledDocument,
  markDocumentSaveFailed,
  updateDocumentMarkdown,
} from './lib/documentState'
import {
  createDocumentStateFromLocalDraft,
} from './lib/documentSessionState'
import {
  createAndroidDocumentOpenResult,
  createAndroidOpenWithDocumentEventAction,
  createAndroidShareDocumentEventAction,
  createSharedTextDocumentOpenResult,
  getIncomingDocumentPreservationAction,
  openAndroidMarkdownDocumentWorkflow,
  shouldKeepAndroidRecoveryAfterPreserveFailure,
  type AndroidDocumentOpenSource,
} from './lib/androidDocumentOpenWorkflow'
import { saveAndroidDocumentCopyWorkflow } from './lib/saveAndroidDocumentCopyWorkflow'
import { saveLocalDraftToAndroidDocumentWorkflow } from './lib/saveLocalDraftToAndroidDocumentWorkflow'
import { shareAndroidMarkdownDocumentWorkflow } from './lib/shareAndroidMarkdownDocumentWorkflow'
import {
  buildMarkdownImage,
  buildMarkdownLink,
  normalizeLinkField,
} from './lib/editorMarkdownInsert'
import {
  captureSelectionWithin,
  insertTextAtRestoredSelection,
  resolveEditorDomNode,
} from './lib/editorInlineInsert'
import { createMuyaEditor, destroyMuyaEditor, type MuyaEditor } from './lib/editorRuntime'
import {
  removeLocalDraft,
  upsertLocalDraft,
  type LocalDraftRecord,
} from './lib/localDrafts'
import { createLocalDraftAutosaveResult } from './lib/localDraftAutosave'
import {
  readLegacyDraft,
  readStoredAndroidRecentDocuments,
  readStoredLocalDrafts,
  writeStoredAndroidRecentDocuments,
  writeStoredLocalDrafts,
} from './lib/documentStorage'
import { createLogger, getNativeLogInfo, isNativeLoggerAvailable } from './lib/logger'
import {
  MOBILE_COMMANDS,
  runMobileEditorCommand,
  type MobileCommandId,
  type MobileEditorCommandTarget,
} from './lib/mobileCommands'
import {
  DEFAULT_MOBILE_TOOLBAR_PANEL,
  type MobileEditorToolbarPanel,
} from './lib/mobileToolbarConfig'
import { DEFAULT_HOME_TAB, HOME_TABS, type HomeTab } from './lib/homeNavigation'
import { toHomeDocumentItem } from './lib/homeDocuments'
import {
  DEFAULT_SETTINGS_PAGE,
  SETTINGS_PAGES,
  type SettingsPage,
} from './lib/settingsNavigation'
import { createMuyaMobileEditorCommandTarget } from './lib/muyaMobileAdapter'
import {
  createRecentDocumentFromLocalDraft,
  getRecentDocumentListItems,
  type RecentDocumentRecord,
} from './lib/recentDocuments'

const DRAFT_SAVE_DELAY_MS = 800
const ANDROID_DOCUMENT_SAVE_DELAY_MS = 1200
const TRANSIENT_ANDROID_DOCUMENT_MESSAGE =
  'Saved to device. Kept local draft because Android did not grant long-term access.'
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
const currentScreen = ref<'home' | 'editor'>('home')
const homeTab = ref<HomeTab>(DEFAULT_HOME_TAB)
const settingsPage = ref<SettingsPage>(DEFAULT_SETTINGS_PAGE)
const editorReady = ref(false)
const draftExitPromptOpen = ref(false)
const androidExitPromptOpen = ref(false)
const editorMenuOpen = ref(false)
const editorToolbarExpanded = ref(false)
const editorToolbarPanel = ref<MobileEditorToolbarPanel>(DEFAULT_MOBILE_TOOLBAR_PANEL)
const linkSheetOpen = ref(false)
const linkText = ref('')
const linkUrl = ref('')
const promptLocalDraftSaveOnExit = ref(false)
const savingLocalDraftToAndroid = ref(false)
const savingAndroidDocumentCopy = ref(false)
const sharingCurrentDocument = ref(false)
const importingAndroidImage = ref(false)

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
    return 'This file cannot be saved directly. Save a copy or keep a recovery draft before leaving.'
  }

  return 'MarkText could not save this file. Save a copy or keep a recovery draft before leaving.'
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
  if (!editorReady.value || !editor) {
    return
  }

  pendingInlineInsertRange = captureEditorSelection()
  linkText.value = normalizeLinkField(pendingInlineInsertRange?.toString() ?? '')
  linkUrl.value = ''
  editorMenuOpen.value = false
  closeEditorToolbar()
  linkSheetOpen.value = true
}

function closeLinkSheet() {
  linkSheetOpen.value = false
  linkText.value = ''
  linkUrl.value = ''
  pendingInlineInsertRange = null
}

function insertLinkFromSheet() {
  if (!editor || !linkUrl.value.trim()) {
    return
  }

  const beforeMarkdown = editor.getMarkdown()
  const markdownLink = buildMarkdownLink(linkText.value, linkUrl.value)

  if (!insertMarkdownAtPendingSelection(markdownLink)) {
    editorLog.warn('mobile link insert failed because text insertion was not handled')
    return
  }

  closeLinkSheet()
  syncAfterToolbarCommand(beforeMarkdown)
}

async function insertImageFromAndroidPicker() {
  if (!editorReady.value || !editor || importingAndroidImage.value) {
    return
  }

  if (!isAndroidImageImportAvailable()) {
    status.value = getAndroidImageUserMessage({ code: 'UNAVAILABLE' })
    editorLog.warn('mobile image insert skipped because Android image import is unavailable')
    return
  }

  const beforeMarkdown = editor.getMarkdown()
  pendingInlineInsertRange = captureEditorSelection()
  const selectedText = normalizeLinkField(pendingInlineInsertRange?.toString() ?? '')
  editorMenuOpen.value = false
  closeEditorToolbar()
  importingAndroidImage.value = true
  status.value = 'Choose an image'

  try {
    await ensureAndroidImageResolver()
    const image = await pickAndroidImageDocument()
    if (image.canceled) {
      status.value = 'Ready'
      return
    }

    const alt = selectedText || image.displayName
    const markdownImage = buildMarkdownImage(alt, image.markdownSrc)
    if (!insertMarkdownAtPendingSelection(markdownImage)) {
      status.value = 'Image insert failed'
      editorLog.warn('mobile image insert failed because text insertion was not handled')
      return
    }

    status.value = 'Image inserted'
    editorLog.info('mobile image inserted', {
      displayName: image.displayName,
      mimeType: image.mimeType,
      bytes: image.bytes,
    })
    syncAfterToolbarCommand(beforeMarkdown)
  } catch (error) {
    status.value = getAndroidImageUserMessage(error)
    editorLog.error('mobile image insert failed', error)
  } finally {
    importingAndroidImage.value = false
    pendingInlineInsertRange = null
  }
}

function syncAfterToolbarCommand(beforeMarkdown: string) {
  window.requestAnimationFrame(() => {
    if (!editor) {
      return
    }

    const nextMarkdown = normalizeEditorMarkdown(editor.getMarkdown())
    if (nextMarkdown !== normalizeEditorMarkdown(beforeMarkdown)) {
      syncMarkdown('Edited')
      return
    }

    syncDocumentFromEditor(documentState.value.isDirty)
  })
}

function runEditorToolbarCommand(commandId: MobileCommandId) {
  if (!editorReady.value || !editor) {
    editorLog.warn('mobile toolbar command skipped because editor is not ready', { commandId })
    return
  }

  if (commandId === MOBILE_COMMANDS.FORMAT_HYPERLINK) {
    openLinkSheet()
    return
  }

  if (commandId === MOBILE_COMMANDS.FORMAT_IMAGE) {
    void insertImageFromAndroidPicker()
    return
  }

  const target = getEditorCommandTarget()
  const beforeMarkdown = editor.getMarkdown()
  let result

  try {
    result = runMobileEditorCommand(target, commandId)
  } catch (error) {
    editorLog.error('mobile toolbar command failed', { commandId, error })
    return
  }

  if (!result.handled) {
    editorLog.warn('mobile toolbar command was not handled', result)
    return
  }

  editorLog.info('mobile toolbar command handled', { commandId })
  syncAfterToolbarCommand(beforeMarkdown)
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
  writeStoredLocalDrafts(nextDrafts)
}

function persistAndroidRecentDocuments(nextDocuments: RecentDocumentRecord[]) {
  const filteredDocuments = writeStoredAndroidRecentDocuments(nextDocuments)
  androidRecentDocuments.value = filteredDocuments
}

function persistAndroidRecoveryDraft(sourceUri: string, markdown: string) {
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

  if (!editor || documentState.value.autosaveTarget !== 'android-document') {
    return true
  }

  const sourceUri = documentState.value.sourceUri
  if (!sourceUri) {
    status.value = 'Save failed'
    androidDocumentLog.error('Android document save missing source URI', {
      id: documentState.value.id,
    })
    return false
  }

  if (!currentAndroidDocumentCanWrite.value) {
    status.value = documentState.value.isDirty ? 'This file is read-only.' : 'Read only'
    androidDocumentLog.debug('skip Android document autosave without write access', {
      id: documentState.value.id,
      sourceUri,
    })
    return !documentState.value.isDirty
  }

  if (!documentState.value.isDirty && documentState.value.autosaveState !== 'save-failed') {
    return true
  }

  if (androidSaveInFlight) {
    androidSaveRequestedAfterCurrent = true
    return false
  }

  const value = normalizeEditorMarkdown(editor.getMarkdown())
  const autosaveRequest = createAndroidDocumentAutosaveRequest(documentState.value, value)

  androidSaveInFlight = true
  documentState.value = autosaveRequest.savingDocument
  status.value = 'Saving'

  try {
    await writeAndroidMarkdownDocument(sourceUri, autosaveRequest.markdownForSave)
    const savedAt = new Date().toISOString()

    if (canApplyAndroidDocumentAutosaveSuccess(
      documentState.value,
      sourceUri,
      autosaveRequest.saveMarkdown,
    )) {
      documentState.value = applyAndroidDocumentAutosaveSuccess(
        documentState.value,
        autosaveRequest.saveMarkdown,
        savedAt,
      )
      markAndroidRecentDocumentSaved(savedAt)
      status.value = 'Saved'
      androidDocumentLog.info('Android document autosaved', {
        sourceUri,
        characters: autosaveRequest.saveMarkdown.length,
      })
      return true
    } else {
      androidSaveRequestedAfterCurrent = true
      androidDocumentLog.debug('Android document changed during save; scheduling another save', {
        sourceUri,
      })
      return false
    }
  } catch (error) {
    documentState.value = applyAndroidDocumentAutosaveFailure(documentState.value, error)
    persistAndroidRecoveryDraft(sourceUri, autosaveRequest.saveMarkdown)
    status.value = `${getAndroidDocumentUserMessage(error)} ${ANDROID_SAVE_RECOVERY_MESSAGE}`
    androidDocumentLog.error('Android document autosave failed', {
      sourceUri,
      error,
    })
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
  editorMenuOpen.value = false

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
    transientAccessMessage: TRANSIENT_ANDROID_DOCUMENT_MESSAGE,
    createAndroidMarkdownDocument,
    getAndroidDocumentUserMessage,
    logger: androidDocumentLog,
  })

  try {
    if (result.kind === 'empty') {
      status.value = result.status
      return false
    }

    if (result.kind === 'canceled') {
      status.value = result.status
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
  editorMenuOpen.value = false

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
      transientAccessMessage: TRANSIENT_ANDROID_DOCUMENT_MESSAGE,
      createAndroidMarkdownDocument,
      getAndroidDocumentUserMessage,
      logger: androidDocumentLog,
    })

    if (result.kind === 'canceled') {
      status.value = getAndroidEditorStatus()
      return false
    }

    if (result.kind === 'transient') {
      if (result.recoveryDraft) {
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

    if (result.recoveryDraft) {
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
  editorMenuOpen.value = false

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

  persistLocalDrafts(upsertLocalDraft(localDrafts.value, openResult.localDraft))
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
    openAndroidMarkdownDocument,
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
  editorMenuOpen.value = false
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
  editorMenuOpen.value = false
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
  androidExitPromptOpen.value = false
  appLog.info('create new local document')
  currentAndroidDocumentCanWrite.value = false
  promptLocalDraftSaveOnExit.value = true
  documentState.value = createUntitledDocument({ autosaveTarget: 'local-draft' })
  void openEditor('')
}

function toggleEditorMenu() {
  editorMenuOpen.value = !editorMenuOpen.value
  if (editorMenuOpen.value) {
    editorToolbarExpanded.value = false
  }
}

function closeEditorMenu() {
  editorMenuOpen.value = false
}

function openEditorSearch() {
  appLog.info('editor search requested')
}

function toggleEditorToolbar() {
  editorToolbarExpanded.value = !editorToolbarExpanded.value
  if (editorToolbarExpanded.value) {
    editorMenuOpen.value = false
  }
}

function setEditorToolbarPanel(panel: MobileEditorToolbarPanel) {
  editorToolbarPanel.value = panel
}

function closeEditorToolbar() {
  editorToolbarExpanded.value = false
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
  editorMenuOpen.value = false
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
  editorMenuOpen.value = false
  closeEditorToolbar()
  if (documentState.value.autosaveTarget === 'android-document') {
    const saved = await saveAndroidDocument()
    if (!saved) {
      if (shouldPromptAndroidExitAfterSaveFailure()) {
        androidExitPromptOpen.value = true
      }
      return
    }
  } else {
    saveDraft()
    if (shouldPromptLocalDraftSaveToDevice()) {
      draftExitPromptOpen.value = true
      return
    }
  }
  closeEditorToHome()
}

function keepAndroidRecoveryAndShowHome() {
  const sourceUri = documentState.value.sourceUri
  const currentDocument = syncDocumentFromEditor(documentState.value.isDirty)
  if (sourceUri && currentDocument.markdown.trim()) {
    persistAndroidRecoveryDraft(sourceUri, currentDocument.markdown)
  }

  homeNotice.value = ANDROID_EXIT_RECOVERY_MESSAGE
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

  if (androidExitPromptOpen.value) {
    androidExitPromptOpen.value = false
    status.value = getAndroidEditorStatus()
    return
  }

  if (draftExitPromptOpen.value) {
    draftExitPromptOpen.value = false
    status.value = isLocalDraftDocument() ? 'Autosaved locally' : status.value
    return
  }

  if (linkSheetOpen.value) {
    closeLinkSheet()
    return
  }

  if (editorMenuOpen.value) {
    editorMenuOpen.value = false
    return
  }

  if (editorToolbarExpanded.value) {
    closeEditorToolbar()
    return
  }

  if (currentScreen.value === 'editor') {
    await showHome()
    return
  }

  if (
    currentScreen.value === 'home' &&
    homeTab.value === HOME_TABS.SETTINGS &&
    settingsPage.value !== SETTINGS_PAGES.INDEX
  ) {
    settingsPage.value = SETTINGS_PAGES.INDEX
    return
  }

  if (currentScreen.value === 'home' && homeTab.value !== HOME_TABS.DOCUMENTS) {
    homeTab.value = HOME_TABS.DOCUMENTS
    settingsPage.value = DEFAULT_SETTINGS_PAGE
    return
  }

  try {
    await App.exitApp()
  } catch (error) {
    appLog.warn('Android back exit unavailable', error)
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
  const restoredDrafts = readStoredLocalDrafts()
  const restoredRecentDocuments = readStoredAndroidRecentDocuments()
  const legacyDraft = readLegacyDraft()

  androidRecentDocuments.value = restoredRecentDocuments

  if (restoredDrafts.length > 0) {
    localDrafts.value = restoredDrafts
    documentState.value = createDocumentStateFromLocalDraft(restoredDrafts[0])
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

  installAndroidDocumentIntentListeners()

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
  <HomeShell
    v-if="currentScreen === 'home'"
    :active-tab="homeTab"
    :settings-page="settingsPage"
    :continue-document="continueDocument"
    :earlier-documents="earlierDocuments"
    :notice="homeNotice"
    @new-document="newDocument"
    @open-document="openDocument"
    @open-file="openFileFromAndroid"
    @set-tab="setHomeTab"
    @set-settings-page="setSettingsPage"
  />

  <main v-else class="app-shell">
    <header class="top-bar">
      <button
        class="nav-button"
        type="button"
        aria-label="Back"
        data-testid="back-button"
        @click="showHome"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </button>
      <div class="document-heading">
        <h1>{{ documentTitle }}</h1>
        <p>{{ status }}</p>
      </div>
      <div v-if="editorReady" class="editor-actions">
        <button
          class="icon-button"
          type="button"
          aria-label="Search"
          title="Search"
          @click="openEditorSearch"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="11" cy="11" r="6" />
            <path d="M16 16l4.5 4.5" />
          </svg>
        </button>
        <button
          v-if="canShowEditorActions()"
          class="icon-button"
          type="button"
          aria-label="More actions"
          :aria-expanded="editorMenuOpen"
          data-testid="editor-menu-button"
          @click="toggleEditorMenu"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="5" r="1.6" />
            <circle cx="12" cy="12" r="1.6" />
            <circle cx="12" cy="19" r="1.6" />
          </svg>
        </button>
      </div>
    </header>

    <section class="editor-pane" aria-label="Markdown editor">
      <div
        class="editor-host-shell"
        :aria-busy="!editorReady"
        :data-testid="editorReady ? 'editor-host' : 'editor-loading-host'"
      >
        <div ref="editorElement" class="muya-host" />
      </div>
    </section>

    <MobileEditorToolbar
      :expanded="editorToolbarExpanded"
      :active-panel="editorToolbarPanel"
      :editor-ready="editorReady"
      :word-count="wordCount"
      :character-count="characterCount"
      :line-count="lineCount"
      @run-command="runEditorToolbarCommand"
      @toggle-expanded="toggleEditorToolbar"
      @set-panel="setEditorToolbarPanel"
    />

    <Transition name="editor-sheet">
      <EditorActionSheet
        v-if="editorMenuOpen"
        :can-share="canShareCurrentDocument()"
        :can-save-to-device="canSaveLocalDraftToAndroidDocument()"
        :can-save-copy="canSaveAndroidDocumentCopy()"
        :sharing="sharingCurrentDocument"
        :saving-to-device="savingLocalDraftToAndroid"
        :saving-copy="savingAndroidDocumentCopy"
        @close="closeEditorMenu"
        @share="shareCurrentMarkdownDocument"
        @save-to-device="() => saveLocalDraftToAndroidDocument()"
        @save-copy="() => saveAndroidDocumentCopy()"
      />
    </Transition>

    <LinkInsertSheet
      v-if="linkSheetOpen"
      v-model:text="linkText"
      v-model:url="linkUrl"
      @cancel="closeLinkSheet"
      @insert="insertLinkFromSheet"
    />

    <LocalDraftExitPrompt
      v-if="draftExitPromptOpen"
      :can-save-to-device="canSaveLocalDraftToAndroidDocument()"
      :saving="savingLocalDraftToAndroid"
      @save-to-device="saveLocalDraftToAndroidDocument({ returnHomeAfterSave: true })"
      @keep="keepLocalDraftAndShowHome"
      @discard="discardLocalDraftAndShowHome"
    />

    <AndroidExitPrompt
      v-if="androidExitPromptOpen"
      :message="getAndroidExitPromptMessage()"
      :can-save-copy="canSaveAndroidDocumentCopy()"
      :saving="savingAndroidDocumentCopy"
      @save-copy="saveAndroidDocumentCopy({ returnHomeAfterSave: true })"
      @keep-recovery="keepAndroidRecoveryAndShowHome"
      @discard="discardAndroidChangesAndShowHome"
    />
  </main>
</template>
