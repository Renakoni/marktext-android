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
const markdown = ref('')
const status = ref('Ready')

let editor: Muya | null = null
let lastContentLogAt = 0
let draftSaveTimer: number | null = null

const appLog = createLogger('app')
const editorLog = createLogger('editor')
const draftLog = createLogger('draft')
const loggingLog = createLogger('logging')

const lineCount = computed(() => (markdown.value ? markdown.value.split(/\r\n|\r|\n/).length : 0))
const characterCount = computed(() => markdown.value.length)
const wordCount = computed(() => countWords(markdown.value))
const documentTitle = computed(() => getDocumentTitle(markdown.value))

function registerMuyaPlugins() {
  editorLog.debug('register Muya plugins start', { count: editorPlugins.length })
  for (const plugin of editorPlugins) {
    if (!Muya.plugins.some(entry => entry.plugin === plugin)) {
      Muya.use(plugin)
    }
  }
  editorLog.debug('register Muya plugins complete', { registered: Muya.plugins.length })
}

function countWords(value: string) {
  const latinWords = value.match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g)?.length ?? 0
  const cjkCharacters = value.match(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g)?.length ?? 0
  return latinWords + cjkCharacters
}

function getDocumentTitle(value: string) {
  const heading = value
    .split(/\r\n|\r|\n/)
    .map(line => line.match(/^#{1,6}\s+(.+)$/)?.[1]?.trim())
    .find(Boolean)

  return heading || 'Untitled'
}

function syncMarkdown(nextStatus: unknown = 'Edited') {
  if (!editor) {
    return
  }

  const resolvedStatus = typeof nextStatus === 'string' ? nextStatus : 'Edited'
  markdown.value = editor.getMarkdown()
  status.value = resolvedStatus
  logContentSnapshot(resolvedStatus)

  if (resolvedStatus === 'Edited') {
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
    characters: markdown.value.length,
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
  try {
    localStorage.setItem(STORAGE_KEY, value)
    markdown.value = value
    status.value = 'Saved locally'
    draftLog.debug('local draft saved', {
      characters: markdown.value.length,
      words: wordCount.value,
      lines: lineCount.value,
    })
  } catch (error) {
    status.value = 'Draft save failed'
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
    const initialMarkdown = localStorage.getItem(STORAGE_KEY) ?? SAMPLE_MARKDOWN
    editorLog.info('Muya init start', {
      initialCharacters: initialMarkdown.length,
      restoredDraft: initialMarkdown !== SAMPLE_MARKDOWN,
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
      characters: markdown.value.length,
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
