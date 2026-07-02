<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { App } from '@capacitor/app'
import type { PluginListenerHandle } from '@capacitor/core'
import LinkInsertSheet from './components/editor/LinkInsertSheet.vue'
import HomeShell from './components/HomeShell.vue'
import MobileEditorToolbar from './components/MobileEditorToolbar.vue'
import {
  addAndroidOpenWithDocumentListener,
  addAndroidShareDocumentListener,
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
  createUntitledDocument,
  getSuggestedMarkdownCopyFileName,
  getSuggestedMarkdownFileName,
  markDocumentSaved,
  markDocumentSaveFailed,
  markDocumentSaving,
  prepareMarkdownForSave,
  updateDocumentMarkdown,
} from './lib/documentState'
import {
  buildMarkdownImage,
  buildMarkdownLink,
  normalizeLinkField,
} from './lib/editorMarkdownInsert'
import {
  removeLocalDraft,
  upsertLocalDraft,
  type LocalDraftRecord,
} from './lib/localDrafts'
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
  createRecentDocumentFromAndroidDocument,
  createRecentDocumentFromLocalDraft,
  getRecentDocumentListItems,
  markRecentDocumentSaved,
  upsertRecentDocument,
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
const ANDROID_RECOVERY_DRAFT_PREFIX = 'android-recovery:'
const ANDROID_SAVE_RECOVERY_MESSAGE = 'Save failed. A local recovery draft was kept.'
const ANDROID_EXIT_RECOVERY_MESSAGE = 'Unsaved changes were kept as a recovery draft.'
const ANDROID_EXIT_DISCARD_MESSAGE = 'Unsaved changes were discarded.'

type MuyaCoreModule = typeof import('@muyajs/core')
type MuyaEditor = InstanceType<MuyaCoreModule['Muya']>

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
let muyaCore: MuyaCoreModule | null = null
let editorInitToken = 0
let lastContentLogAt = 0
let draftSaveTimer: number | null = null
let androidSaveTimer: number | null = null
let androidSaveInFlight = false
let androidSaveRequestedAfterCurrent = false
let appLifecycleListenerHandles: PluginListenerHandle[] = []
let androidDocumentListenerHandles: PluginListenerHandle[] = []
let browserLifecycleListenersInstalled = false
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

async function loadMuyaCore() {
  if (!muyaCore) {
    muyaCore = await import('@muyajs/core')
  }

  return muyaCore
}

async function registerMuyaPlugins() {
  const core = await loadMuyaCore()
  const editorPlugins = [
    core.InlineFormatToolbar,
    core.PreviewToolBar,
    core.CodeBlockLanguageSelector,
    core.EmojiSelector,
  ] as const

  editorLog.debug('register Muya plugins start', { count: editorPlugins.length })
  for (const plugin of editorPlugins) {
    if (!core.Muya.plugins.some(entry => entry.plugin === plugin)) {
      core.Muya.use(plugin)
    }
  }
  editorLog.debug('register Muya plugins complete', { registered: core.Muya.plugins.length })
  return core
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

function getEditorCommandTarget(): MobileEditorCommandTarget | null {
  if (!editor) {
    return null
  }

  return createMuyaMobileEditorCommandTarget(editor)
}

function getEditorDomNode() {
  return (editor as { domNode?: HTMLElement } | null)?.domNode ?? editorElement.value
}

function captureEditorSelection() {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) {
    return null
  }

  const range = selection.getRangeAt(0).cloneRange()
  const editorDomNode = getEditorDomNode()
  if (editorDomNode && !editorDomNode.contains(range.commonAncestorContainer)) {
    return null
  }

  return range
}

function restorePendingLinkRange() {
  const selection = window.getSelection()
  if (!selection || !pendingInlineInsertRange) {
    return false
  }

  selection.removeAllRanges()
  selection.addRange(pendingInlineInsertRange)
  return true
}

function insertMarkdownAtPendingSelection(markdown: string) {
  editor?.focus()
  restorePendingLinkRange()
  return document.execCommand('insertText', false, markdown)
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

function getAndroidRecoveryDraftId(sourceUri: string) {
  return `${ANDROID_RECOVERY_DRAFT_PREFIX}${sourceUri}`
}

function persistAndroidRecoveryDraft(sourceUri: string, markdown: string) {
  if (!markdown.trim()) {
    return
  }

  const now = new Date().toISOString()
  persistLocalDrafts(
    upsertLocalDraft(localDrafts.value, {
      id: getAndroidRecoveryDraftId(sourceUri),
      markdown,
      updatedAt: now,
      lastSavedAt: null,
    }),
  )
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
      return true
    } else {
      androidSaveRequestedAfterCurrent = true
      androidDocumentLog.debug('Android document changed during save; scheduling another save', {
        sourceUri,
      })
      return false
    }
  } catch (error) {
    documentState.value = markDocumentSaveFailed(documentState.value, error)
    persistAndroidRecoveryDraft(sourceUri, saveMarkdown)
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

async function saveAndroidDocumentCopy(options: { returnHomeAfterSave?: boolean } = {}) {
  editorMenuOpen.value = false

  if (!editor || !canSaveAndroidDocumentCopy() || savingAndroidDocumentCopy.value) {
    return false
  }

  const originalSourceUri = documentState.value.sourceUri
  const copySourceDocument = syncDocumentFromEditor(documentState.value.isDirty)
  const markdownForSave = prepareMarkdownForSave(copySourceDocument.markdown, copySourceDocument)
  const suggestedName = getSuggestedMarkdownCopyFileName(
    copySourceDocument.markdown,
    copySourceDocument.displayName,
    androidRecentDocuments.value.map(document => document.displayName),
  )

  savingAndroidDocumentCopy.value = true
  status.value = 'Choose a location'

  try {
    const document = await createAndroidMarkdownDocument(markdownForSave, suggestedName)
    if (document.canceled) {
      status.value = getAndroidEditorStatus()
      androidDocumentLog.info('Android document save copy canceled', {
        sourceUri: originalSourceUri,
      })
      return false
    }

    const savedAt = new Date().toISOString()
    const createdDocument = {
      ...document,
      markdown: copySourceDocument.markdown,
    }

    if (!document.persisted) {
      if (originalSourceUri && copySourceDocument.isDirty) {
        persistAndroidRecoveryDraft(originalSourceUri, copySourceDocument.markdown)
      }
      status.value = TRANSIENT_ANDROID_DOCUMENT_MESSAGE
      androidDocumentLog.warn('saved Android document copy without persisted access', {
        originalSourceUri,
        displayName: document.displayName,
        sourceUri: document.sourceUri,
        characters: copySourceDocument.markdown.length,
      })
      return false
    }

    if (originalSourceUri) {
      removeAndroidRecoveryDraft(originalSourceUri)
    }
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
    androidDocumentLog.info('Android document saved as copy', {
      originalSourceUri,
      displayName: document.displayName,
      sourceUri: document.sourceUri,
      characters: copySourceDocument.markdown.length,
    })
    androidExitPromptOpen.value = false
    if (options.returnHomeAfterSave) {
      closeEditorToHome()
    }
    return true
  } catch (error) {
    if (originalSourceUri && copySourceDocument.isDirty) {
      persistAndroidRecoveryDraft(originalSourceUri, copySourceDocument.markdown)
    }
    documentState.value = markDocumentSaveFailed(documentState.value, error)
    status.value = getAndroidDocumentUserMessage(error)
    androidDocumentLog.error('Android document save copy failed', {
      originalSourceUri,
      error,
    })
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

  const markdownForShare = prepareMarkdownForSave(currentDocument.markdown, currentDocument)
  const suggestedName = getSuggestedMarkdownFileName(
    currentDocument.markdown,
    currentDocument.displayName,
  )

  sharingCurrentDocument.value = true
  status.value = 'Sharing'

  try {
    const result = await shareAndroidMarkdownDocument(markdownForShare, suggestedName)
    status.value = 'Share sheet opened'
    androidDocumentLog.info('Android share sheet opened', {
      displayName: result.displayName,
      bytes: result.bytes,
      imageCount: result.imageCount,
      sharedFileCount: result.sharedFileCount,
      autosaveTarget: currentDocument.autosaveTarget,
    })
    return true
  } catch (error) {
    status.value = getAndroidDocumentUserMessage(error)
    androidDocumentLog.error('Android share failed', error)
    return false
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

async function initEditor(initialMarkdown: string) {
  if (!editorElement.value) {
    return
  }

  try {
    const token = ++editorInitToken
    try {
      await ensureAndroidImageResolver()
    } catch (error) {
      editorLog.warn('Android image resolver unavailable during editor init', error)
    }
    const { Muya, en } = await registerMuyaPlugins()
    if (token !== editorInitToken || !editorElement.value) {
      return
    }

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

async function openAndroidDocumentResult(
  document: OpenedAndroidDocument,
  options: { source?: 'picker' | 'recent' | 'open-with' | 'share'; remember?: boolean } = {},
) {
  const source = options.source ?? 'picker'
  const shouldRemember = options.remember ?? true
  const temporaryAccessMessage =
    source === 'open-with'
      ? OPEN_WITH_TEMPORARY_ACCESS_MESSAGE
      : source === 'share'
        ? SHARE_TEMPORARY_ACCESS_MESSAGE
        : null
  homeNotice.value = temporaryAccessMessage && !document.persisted ? temporaryAccessMessage : null
  if (shouldRemember) {
    rememberAndroidDocument(document)
  } else {
    androidDocumentLog.warn('opened Android document without durable recent access', {
      displayName: document.displayName,
      sourceUri: document.sourceUri,
      source,
    })
  }
  promptLocalDraftSaveOnExit.value = false
  currentAndroidDocumentCanWrite.value = document.canWrite
  documentState.value = createDocumentFromAndroidDocument(document)
  androidDocumentLog.info('open Android document in editor', {
    displayName: document.displayName,
    sourceUri: document.sourceUri,
    canWrite: document.canWrite,
    persisted: document.persisted,
    source,
    characters: document.markdown.length,
  })
  await openEditor(document.markdown)
  status.value = temporaryAccessMessage && !document.persisted
    ? 'Opened temporarily'
    : getAndroidEditorStatus()
  releaseEditorFocusAfterOpen()
}

async function openSharedTextDocument(document: SharedAndroidDocument) {
  const draftDocument = createUntitledDocument({
    markdown: document.markdown,
    displayName: document.displayName,
    autosaveTarget: 'local-draft',
  })

  persistLocalDrafts(
    upsertLocalDraft(localDrafts.value, {
      id: draftDocument.id,
      markdown: draftDocument.markdown,
      updatedAt: draftDocument.updatedAt,
      lastSavedAt: draftDocument.lastSavedAt,
    }),
  )

  homeNotice.value = null
  promptLocalDraftSaveOnExit.value = true
  currentAndroidDocumentCanWrite.value = false
  documentState.value = draftDocument
  androidDocumentLog.info('open Android shared text as local draft', {
    displayName: document.displayName,
    characters: document.markdown.length,
  })
  await openEditor(document.markdown)
  status.value = SHARED_TEXT_IMPORTED_MESSAGE
  releaseEditorFocusAfterOpen()
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

async function preserveCurrentDocumentBeforeIncomingOpen() {
  if (currentScreen.value !== 'editor' || !editor) {
    return
  }

  appLog.info('preserve current document before incoming Android document')

  if (documentState.value.autosaveTarget === 'android-document') {
    syncDocumentFromEditor(documentState.value.isDirty)
    const sourceUri = documentState.value.sourceUri
    const saved = await saveAndroidDocument()
    if (!saved && sourceUri && documentState.value.markdown.trim()) {
      persistAndroidRecoveryDraft(sourceUri, documentState.value.markdown)
    }
    return
  }

  saveDraft()
}

async function handleAndroidOpenWithDocumentEvent(event: AndroidOpenWithDocumentEvent) {
  if (event.error) {
    const message = getAndroidDocumentUserMessage(event.error)
    homeNotice.value = message
    status.value = message
    androidDocumentLog.warn('Android open-with document rejected', event.error)
    return
  }

  await preserveCurrentDocumentBeforeIncomingOpen()
  draftExitPromptOpen.value = false
  androidExitPromptOpen.value = false
  editorMenuOpen.value = false
  closeEditorToolbar()
  await openAndroidDocumentResult(event.document, {
    source: 'open-with',
    remember: event.document.persisted,
  })
}

async function handleAndroidShareDocumentEvent(event: AndroidShareDocumentEvent) {
  if (event.error) {
    const message = getAndroidDocumentUserMessage(event.error)
    homeNotice.value = message
    status.value = message
    androidDocumentLog.warn('Android shared document rejected', event.error)
    return
  }

  await preserveCurrentDocumentBeforeIncomingOpen()
  draftExitPromptOpen.value = false
  androidExitPromptOpen.value = false
  editorMenuOpen.value = false
  closeEditorToolbar()

  if (event.document.sourceUri) {
    await openAndroidDocumentResult(
      {
        ...event.document,
        sourceUri: event.document.sourceUri,
      },
      {
        source: 'share',
        remember: event.document.persisted,
      },
    )
    return
  }

  await openSharedTextDocument(event.document)
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
    documentState.value = createDocumentFromDraft(draft)
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
  editor?.destroy()
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

function installAndroidDocumentIntentListeners() {
  if (!isAndroidDocumentAccessAvailable()) {
    return
  }

  Promise.all([
    addAndroidOpenWithDocumentListener(event => {
      void handleAndroidOpenWithDocumentEvent(event)
    }),
    addAndroidShareDocumentListener(event => {
      void handleAndroidShareDocumentEvent(event)
    }),
  ])
    .then(handles => {
      androidDocumentListenerHandles = handles
      androidDocumentLog.info('Android document intent listeners installed')
    })
    .catch(error => {
      androidDocumentLog.warn('Android document intent listeners unavailable', error)
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

  const documentHandles = androidDocumentListenerHandles
  androidDocumentListenerHandles = []
  for (const handle of documentHandles) {
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
  const restoredDrafts = readStoredLocalDrafts()
  const restoredRecentDocuments = readStoredAndroidRecentDocuments()
  const legacyDraft = readLegacyDraft()

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
      <section
        v-if="editorMenuOpen"
        class="editor-action-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Document actions"
        data-testid="editor-action-sheet"
        @click="closeEditorMenu"
        @keydown.esc="closeEditorMenu"
      >
        <div class="editor-action-panel" @click.stop>
          <div class="editor-action-grabber" aria-hidden="true" />
          <h2 class="editor-action-title">Document</h2>
          <div class="editor-action-list" role="menu">
            <button
              v-if="canShareCurrentDocument()"
              class="editor-action-row"
              type="button"
              role="menuitem"
              data-testid="share-document-button"
              :disabled="sharingCurrentDocument"
              @click="shareCurrentMarkdownDocument"
            >
              <span class="editor-action-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <circle cx="6" cy="12" r="2.4" fill="currentColor" stroke="none" />
                  <circle cx="18" cy="6" r="2.4" fill="currentColor" stroke="none" />
                  <circle cx="18" cy="18" r="2.4" fill="currentColor" stroke="none" />
                  <path d="M8.1 10.9l7.8-3.6M8.1 13.1l7.8 3.6" />
                </svg>
              </span>
              <span class="editor-action-label">Share</span>
            </button>
            <button
              v-if="canSaveLocalDraftToAndroidDocument()"
              class="editor-action-row"
              type="button"
              role="menuitem"
              data-testid="save-to-device-button"
              :disabled="savingLocalDraftToAndroid"
              @click="() => saveLocalDraftToAndroidDocument()"
            >
              <span class="editor-action-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M6 4h9l3 3v13H6z" />
                  <path d="M9 4v5h6" />
                  <rect x="9" y="14" width="6" height="5" rx="0.6" />
                </svg>
              </span>
              <span class="editor-action-label">Save to device</span>
            </button>
            <button
              v-if="canSaveAndroidDocumentCopy()"
              class="editor-action-row"
              type="button"
              role="menuitem"
              data-testid="save-copy-button"
              :disabled="savingAndroidDocumentCopy"
              @click="() => saveAndroidDocumentCopy()"
            >
              <span class="editor-action-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M6 4h9l3 3v13H6z" />
                  <path d="M9 4v5h6" />
                  <rect x="9" y="14" width="6" height="5" rx="0.6" />
                  <circle cx="18" cy="17.5" r="3.4" fill="var(--surface)" stroke="none" />
                  <path d="M18 15.6v3.8M16.1 17.5h3.8" />
                </svg>
              </span>
              <span class="editor-action-label">Save a copy</span>
            </button>
          </div>
        </div>
      </section>
    </Transition>

    <LinkInsertSheet
      v-if="linkSheetOpen"
      v-model:text="linkText"
      v-model:url="linkUrl"
      @cancel="closeLinkSheet"
      @insert="insertLinkFromSheet"
    />

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

    <section
      v-if="androidExitPromptOpen"
      class="draft-save-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="android-exit-title"
      data-testid="android-exit-prompt"
    >
      <div class="draft-save-panel">
        <h2 id="android-exit-title">Save changes before leaving?</h2>
        <p>{{ getAndroidExitPromptMessage() }}</p>
        <div class="draft-save-actions">
          <button
            v-if="canSaveAndroidDocumentCopy()"
            class="primary-action"
            type="button"
            data-testid="prompt-save-copy-button"
            :disabled="savingAndroidDocumentCopy"
            @click="saveAndroidDocumentCopy({ returnHomeAfterSave: true })"
          >
            Save a copy
          </button>
          <button
            type="button"
            data-testid="prompt-keep-recovery-button"
            :disabled="savingAndroidDocumentCopy"
            @click="keepAndroidRecoveryAndShowHome"
          >
            Keep recovery draft
          </button>
          <button
            class="danger-action"
            type="button"
            data-testid="prompt-discard-android-changes-button"
            :disabled="savingAndroidDocumentCopy"
            @click="discardAndroidChangesAndShowHome"
          >
            Discard changes
          </button>
        </div>
      </div>
    </section>
  </main>
</template>
