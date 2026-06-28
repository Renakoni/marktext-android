<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  CodeBlockLanguageSelector,
  EmojiSelector,
  InlineFormatToolbar,
  Muya,
  ParagraphQuickInsertMenu,
  PreviewToolBar,
  renderToStaticHTML,
  en,
} from '@muyajs/core'

const STORAGE_KEY = 'marktext-for-android:draft'

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
const lastSavedAt = ref('')

let editor: Muya | null = null

const lineCount = computed(() => (markdown.value ? markdown.value.split(/\r\n|\r|\n/).length : 0))
const characterCount = computed(() => markdown.value.length)
const wordCount = computed(() => countWords(markdown.value))

function registerMuyaPlugins() {
  for (const plugin of editorPlugins) {
    if (!Muya.plugins.some(entry => entry.plugin === plugin)) {
      Muya.use(plugin)
    }
  }
}

function countWords(value: string) {
  const latinWords = value.match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g)?.length ?? 0
  const cjkCharacters = value.match(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g)?.length ?? 0
  return latinWords + cjkCharacters
}

function syncMarkdown(nextStatus = 'Edited') {
  if (!editor) {
    return
  }

  markdown.value = editor.getMarkdown()
  status.value = nextStatus
}

function saveDraft() {
  if (!editor) {
    return
  }

  const value = editor.getMarkdown()
  localStorage.setItem(STORAGE_KEY, value)
  markdown.value = value
  lastSavedAt.value = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date())
  status.value = 'Saved'
}

function restoreSample() {
  if (!editor) {
    return
  }

  editor.setContent(SAMPLE_MARKDOWN, true)
  syncMarkdown()
}

async function copyMarkdown() {
  if (!navigator.clipboard || !editor) {
    return
  }

  await navigator.clipboard.writeText(editor.getMarkdown())
  status.value = 'Copied'
}

function exportHtml() {
  const body = renderToStaticHTML(markdown.value)
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MarkText Export</title>
</head>
<body>
  <article>
${body}
  </article>
</body>
</html>
`
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'marktext-export.html'
  anchor.click()
  URL.revokeObjectURL(url)
  status.value = 'Exported'
}

onMounted(() => {
  if (!editorElement.value) {
    return
  }

  registerMuyaPlugins()

  editor = new Muya(editorElement.value, {
    markdown: localStorage.getItem(STORAGE_KEY) ?? SAMPLE_MARKDOWN,
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
  })
  editor.on('blur', () => {
    status.value = 'Ready'
  })
  syncMarkdown('Ready')
})

onBeforeUnmount(() => {
  editor?.destroy()
  editor = null
})
</script>

<template>
  <main class="app-shell">
    <header class="top-bar">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">M</span>
        <div>
          <h1>MarkText Android</h1>
          <p>{{ status }}<span v-if="lastSavedAt"> at {{ lastSavedAt }}</span></p>
        </div>
      </div>

      <div class="actions" aria-label="Document actions">
        <button type="button" @click="saveDraft">Save</button>
        <button type="button" @click="copyMarkdown">Copy</button>
        <button type="button" @click="exportHtml">HTML</button>
        <button type="button" @click="restoreSample">Sample</button>
      </div>
    </header>

    <section class="editor-pane" aria-label="Markdown editor">
      <div ref="editorElement" class="muya-host"></div>
    </section>

    <footer class="status-bar">
      <span>{{ wordCount }} words</span>
      <span>{{ characterCount }} chars</span>
      <span>{{ lineCount }} lines</span>
    </footer>
  </main>
</template>
