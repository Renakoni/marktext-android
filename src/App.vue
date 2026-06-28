<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
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
  getAndroidDocumentErrorCode,
  getAndroidDocumentUserMessage,
  openAndroidMarkdownDocument,
  readAndroidMarkdownDocument,
  type OpenedAndroidDocument,
} from './lib/androidDocuments'
import {
  createUntitledDocument,
  markDocumentSaved,
  markDocumentSaveFailed,
  markDocumentSaving,
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
const status = ref('Ready')
const homeNotice = ref<string | null>(null)
const currentScreen = ref<'home' | 'editor'>('home')

let editor: Muya | null = null
let lastContentLogAt = 0
let draftSaveTimer: number | null = null

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

function syncMarkdown(nextStatus: unknown = 'Edited') {
  if (!editor) {
    return
  }

  const resolvedStatus = typeof nextStatus === 'string' ? nextStatus : 'Edited'
  const nextMarkdown = normalizeEditorMarkdown(editor.getMarkdown())
  const markDirty = resolvedStatus === 'Edited'
  documentState.value = updateDocumentMarkdown(documentState.value, nextMarkdown, { markDirty })
  if (markDirty && documentState.value.autosaveTarget === 'android-document') {
    status.value = 'Unsaved changes'
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

function saveDraft() {
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
      status.value = 'Editing'
      editorLog.debug('editor focused')
    })
    editor.on('blur', () => {
      status.value = 'Ready'
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
  documentState.value = createDocumentFromAndroidDocument(document)
  androidDocumentLog.info('open Android document in editor', {
    displayName: document.displayName,
    sourceUri: document.sourceUri,
    canWrite: document.canWrite,
    persisted: document.persisted,
    characters: document.markdown.length,
  })
  await openEditor(document.markdown)
  status.value = document.canWrite ? 'Opened from Android' : 'Opened read-only'
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
  documentState.value = createUntitledDocument({ autosaveTarget: 'local-draft' })
  void openEditor('')
}

function destroyEditor() {
  if (draftSaveTimer !== null) {
    window.clearTimeout(draftSaveTimer)
    draftSaveTimer = null
  }
  editor?.destroy()
  editor = null
}

function showHome() {
  appLog.info('show recent home')
  saveDraft()
  destroyEditor()
  currentScreen.value = 'home'
}

onMounted(() => {
  appLog.info('app mounted')
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
  saveDraft()
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
    </header>

    <section class="editor-pane" aria-label="Markdown editor">
      <div ref="editorElement" class="muya-host" data-testid="editor-host" />
    </section>

    <footer class="status-bar">
      <span>{{ wordCount }} words</span>
      <span>{{ characterCount }} chars</span>
      <span>{{ lineCount }} lines</span>
    </footer>
  </main>
</template>
