<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  CodeBlockLanguageSelector,
  EmojiSelector,
  InlineFormatToolbar,
  Muya,
  ParagraphQuickInsertMenu,
  PreviewToolBar,
  en,
} from '@muyajs/core'
import {
  createUntitledDocument,
  markDocumentSaved,
  markDocumentSaveFailed,
  markDocumentSaving,
  updateDocumentMarkdown,
} from './lib/documentState'
import { createLogger, getNativeLogInfo } from './lib/logger'

const STORAGE_KEY = 'marktext-for-android:draft'
const DRAFT_SAVE_DELAY_MS = 800

const SAMPLE_MARKDOWN = `# MarkText for Android

This editor shell runs Muya inside a Capacitor Android app.

## Checklist

- Reuse MarkText's Markdown editing core.
- Keep the mobile shell small.
- Add native file access after the editor baseline is stable.

## Markdown

1. Write
2. Preview
3. Export
`

const editorPlugins = [
  InlineFormatToolbar,
  ParagraphQuickInsertMenu,
  PreviewToolBar,
  CodeBlockLanguageSelector,
  EmojiSelector,
] as const

const editorElement = ref<HTMLElement | null>(null)
const documentState = ref(createUntitledDocument())
const status = ref('Ready')

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

function registerMuyaPlugins() {
  editorLog.debug('register Muya plugins start', { count: editorPlugins.length })
  for (const plugin of editorPlugins) {
    if (!Muya.plugins.some(entry => entry.plugin === plugin)) {
      Muya.use(plugin)
    }
  }
  editorLog.debug('register Muya plugins complete', { registered: Muya.plugins.length })
}

function syncMarkdown(nextStatus: unknown = 'Edited') {
  if (!editor) {
    return
  }

  const resolvedStatus = typeof nextStatus === 'string' ? nextStatus : 'Edited'
  const nextMarkdown = editor.getMarkdown()
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

function saveDraft() {
  if (!editor) {
    return
  }

  const value = editor.getMarkdown()
  documentState.value = markDocumentSaving(
    updateDocumentMarkdown(documentState.value, value, { markDirty: documentState.value.isDirty }),
  )

  try {
    localStorage.setItem(STORAGE_KEY, value)
    documentState.value = markDocumentSaved(
      updateDocumentMarkdown(documentState.value, value, { markDirty: false }),
      { autosaveTarget: 'local-draft' },
    )
    status.value = 'Autosaved locally'
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

onMounted(() => {
  if (!editorElement.value) {
    return
  }

  appLog.info('app mounted')
  registerMuyaPlugins()

  try {
    const restoredDraft = localStorage.getItem(STORAGE_KEY)
    const initialMarkdown = restoredDraft ?? SAMPLE_MARKDOWN
    documentState.value = createUntitledDocument({
      markdown: initialMarkdown,
      autosaveTarget: 'local-draft',
    })
    editorLog.info('Muya init start', {
      initialCharacters: initialMarkdown.length,
      restoredDraft: restoredDraft !== null,
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
  if (draftSaveTimer !== null) {
    window.clearTimeout(draftSaveTimer)
    draftSaveTimer = null
  }
  saveDraft()
  editor?.destroy()
  editor = null
})
</script>

<template>
  <main class="app-shell">
    <header class="top-bar">
      <div class="document-heading">
        <span>MarkText Android</span>
        <h1>{{ documentTitle }}</h1>
        <p>{{ status }}</p>
      </div>
    </header>

    <section class="editor-pane" aria-label="Markdown editor">
      <div ref="editorElement" class="muya-host" />
    </section>

    <footer class="status-bar">
      <span>{{ wordCount }} words</span>
      <span>{{ characterCount }} chars</span>
      <span>{{ lineCount }} lines</span>
    </footer>
  </main>
</template>
