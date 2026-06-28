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
  createUntitledDocument,
  markDocumentSaved,
  markDocumentSaveFailed,
  markDocumentSaving,
  updateDocumentMarkdown,
} from './lib/documentState'
import {
  getLocalDraftListItems,
  parseLocalDrafts,
  removeLocalDraft,
  serializeLocalDrafts,
  upsertLocalDraft,
  type LocalDraftListItem,
  type LocalDraftRecord,
} from './lib/localDrafts'
import { createLogger, getNativeLogInfo } from './lib/logger'

const LEGACY_DRAFT_STORAGE_KEY = 'marktext-for-android:draft'
const DRAFTS_STORAGE_KEY = 'marktext-for-android:drafts'
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
const status = ref('Ready')
const currentScreen = ref<'home' | 'editor'>('home')

let editor: Muya | null = null
let lastContentLogAt = 0
let draftSaveTimer: number | null = null

const appLog = createLogger('app')
const editorLog = createLogger('editor')
const draftLog = createLogger('draft')
const loggingLog = createLogger('logging')

const lineCount = computed(() => documentState.value.stats.lines)
const characterCount = computed(() => documentState.value.stats.characters)
const wordCount = computed(() => documentState.value.stats.words)
const documentTitle = computed(() => documentState.value.title)
const draftItems = computed(() => getLocalDraftListItems(localDrafts.value))
const continueDraftItem = computed(() => draftItems.value[0] ?? null)
const earlierDraftItems = computed(() => draftItems.value.slice(1))
const continueDraft = computed(() =>
  continueDraftItem.value ? toHomeDraftItem(continueDraftItem.value) : null,
)
const earlierDrafts = computed(() => earlierDraftItems.value.map(toHomeDraftItem))

function toHomeDraftItem(item: LocalDraftListItem) {
  const savedAt = formatSavedTime(item.lastSavedAt ?? item.updatedAt)
  const count = `${item.stats.words} ${item.stats.words === 1 ? 'word' : 'words'}`

  return {
    id: item.id,
    title: item.title,
    details: savedAt ? `Autosaved locally - ${savedAt} - ${count}` : `Local draft - ${count}`,
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
  status.value = markDirty ? 'Autosaving locally' : resolvedStatus
  logContentSnapshot(resolvedStatus)

  if (markDirty) {
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

function saveDraft() {
  if (!editor) {
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
  currentScreen.value = 'editor'
  await nextTick()
  initEditor(markdown)
}

function openDraft(id: string) {
  const draft = localDrafts.value.find(record => record.id === id)
  if (!draft) {
    draftLog.warn('local draft not found', { id })
    return
  }

  documentState.value = createDocumentFromDraft(draft)
  appLog.info('open local draft', { id })
  void openEditor(draft.markdown)
}

function newDocument() {
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
  const legacyDraft = localStorage.getItem(LEGACY_DRAFT_STORAGE_KEY)

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
      :continue-draft="continueDraft"
      :earlier-drafts="earlierDrafts"
      @new-document="newDocument"
      @open-draft="openDraft"
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
