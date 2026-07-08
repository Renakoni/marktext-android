<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from '../../../lib/i18n'

type ProbeValue = string | number | boolean | null | ProbeValue[] | { [key: string]: ProbeValue }

interface SpellcheckProbeResult {
  timestamp: string
  userAgent: string
  editorReady: boolean
  editingSettings: {
    spellcheckerEnabled: boolean
    spellcheckerLanguage: string
    spellcheckerUnderline: boolean
  } | null
  editorDom: Record<string, ProbeValue> | null
}

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const sampleText = 'dadaasda adad dadada adadadad pon pan'
const browserReport = ref<Record<string, ProbeValue>>({})
const editorReport = ref<SpellcheckProbeResult | null>(null)

function describeElement(element: HTMLElement | null) {
  if (!element) {
    return null
  }

  return {
    tag: element.tagName.toLowerCase(),
    spellcheckAttribute: element.getAttribute('spellcheck'),
    spellcheckProperty: element.spellcheck,
    lang: element.getAttribute('lang'),
    contentEditable: element.getAttribute('contenteditable'),
    className: element.className,
  }
}

function refreshBrowserReport() {
  const textarea = document.querySelector<HTMLElement>('[data-testid="spellcheck-probe-textarea"]')
  const contenteditable = document.querySelector<HTMLElement>(
    '[data-testid="spellcheck-probe-contenteditable"]',
  )

  browserReport.value = {
    userAgent: navigator.userAgent,
    documentSpellcheckProperty: document.documentElement.spellcheck,
    textarea: describeElement(textarea),
    contenteditable: describeElement(contenteditable),
    supportsSpellingErrorSelector:
      typeof CSS !== 'undefined' &&
      typeof CSS.supports === 'function' &&
      CSS.supports('selector(::spelling-error)'),
  }
}

function requestEditorProbe() {
  window.dispatchEvent(new CustomEvent('marktext-spellcheck-probe-request'))
}

function onEditorProbeResult(event: Event) {
  const detail = event instanceof CustomEvent ? event.detail : null
  if (detail && typeof detail === 'object') {
    editorReport.value = detail as SpellcheckProbeResult
  }
}

onMounted(() => {
  refreshBrowserReport()
  window.addEventListener('marktext-spellcheck-probe-result', onEditorProbeResult)
  requestEditorProbe()
})

onBeforeUnmount(() => {
  window.removeEventListener('marktext-spellcheck-probe-result', onEditorProbeResult)
})
</script>

<template>
  <section
    class="spellcheck-probe-sheet"
    role="dialog"
    aria-modal="true"
    :aria-label="t('settings.spellcheckProbe.title')"
    data-testid="spellcheck-probe-panel"
    @click.self="emit('close')"
  >
    <div class="spellcheck-probe-panel">
      <header class="spellcheck-probe-header">
        <h2>{{ t('settings.spellcheckProbe.title') }}</h2>
        <button type="button" data-testid="spellcheck-probe-close" @click="emit('close')">
          {{ t('settings.spellcheckProbe.close') }}
        </button>
      </header>

      <p class="spellcheck-probe-help">{{ t('settings.spellcheckProbe.help') }}</p>

      <section class="spellcheck-probe-section">
        <h3>{{ t('settings.spellcheckProbe.webviewTitle') }}</h3>
        <label class="spellcheck-probe-field">
          <span>{{ t('settings.spellcheckProbe.textarea') }}</span>
          <textarea
            data-testid="spellcheck-probe-textarea"
            spellcheck="true"
            lang="en-US"
            :value="sampleText"
            @input="refreshBrowserReport"
          />
        </label>
        <label class="spellcheck-probe-field">
          <span>{{ t('settings.spellcheckProbe.contenteditable') }}</span>
          <div
            class="spellcheck-probe-editable"
            data-testid="spellcheck-probe-contenteditable"
            contenteditable="true"
            spellcheck="true"
            lang="en-US"
            @input="refreshBrowserReport"
          >
            {{ sampleText }}
          </div>
        </label>
        <pre data-testid="spellcheck-probe-browser-report">{{
          JSON.stringify(browserReport, null, 2)
        }}</pre>
      </section>

      <section class="spellcheck-probe-section">
        <h3>{{ t('settings.spellcheckProbe.editorTitle') }}</h3>
        <button type="button" data-testid="spellcheck-probe-refresh" @click="requestEditorProbe">
          {{ t('settings.spellcheckProbe.refresh') }}
        </button>
        <pre data-testid="spellcheck-probe-editor-report">{{
          JSON.stringify(editorReport, null, 2)
        }}</pre>
      </section>
    </div>
  </section>
</template>

<style scoped>
.spellcheck-probe-sheet {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: flex-end;
  background: rgb(15 23 42 / 0.32);
}

.spellcheck-probe-panel {
  width: 100%;
  max-height: 92vh;
  overflow: auto;
  padding: 18px;
  border-radius: 8px 8px 0 0;
  background: var(--editor-bg-color, #fff);
  color: var(--editor-text-color, #111827);
  box-shadow: 0 -8px 24px rgb(15 23 42 / 0.18);
}

.spellcheck-probe-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.spellcheck-probe-header h2,
.spellcheck-probe-section h3 {
  margin: 0;
}

.spellcheck-probe-header button,
.spellcheck-probe-section button {
  min-height: 38px;
  padding: 0 14px;
  border: 1px solid rgb(148 163 184 / 0.55);
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font: inherit;
}

.spellcheck-probe-help {
  margin: 12px 0 0;
  color: var(--editor-secondary-text-color, #4b5563);
  line-height: 1.5;
}

.spellcheck-probe-section {
  display: grid;
  gap: 12px;
  margin-top: 18px;
}

.spellcheck-probe-field {
  display: grid;
  gap: 6px;
}

.spellcheck-probe-field span {
  color: var(--editor-secondary-text-color, #4b5563);
  font-size: 13px;
}

.spellcheck-probe-field textarea,
.spellcheck-probe-editable {
  min-height: 84px;
  padding: 12px;
  border: 1px solid rgb(148 163 184 / 0.55);
  border-radius: 6px;
  background: var(--editor-bg-color, #fff);
  color: inherit;
  font: 18px/1.45 system-ui, sans-serif;
}

.spellcheck-probe-field textarea {
  resize: vertical;
}

.spellcheck-probe-editable {
  outline: none;
}

.spellcheck-probe-panel pre {
  max-height: 220px;
  overflow: auto;
  margin: 0;
  padding: 12px;
  border-radius: 6px;
  background: rgb(15 23 42 / 0.06);
  color: inherit;
  font: 12px/1.5 ui-monospace, SFMono-Regular, Consolas, monospace;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
