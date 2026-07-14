<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useI18n } from '../../../lib/i18n'

const props = defineProps<{
  text: string
  url: string
}>()

const emit = defineEmits<{
  cancel: []
  insert: []
  'update:text': [value: string]
  'update:url': [value: string]
}>()

const linkUrlInput = ref<HTMLInputElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const { t } = useI18n()
const canInsert = computed(() => props.url.trim().length > 0)
const textValue = computed({
  get: () => props.text,
  set: value => emit('update:text', value),
})
const urlValue = computed({
  get: () => props.url,
  set: value => emit('update:url', value),
})

function focusInitialInput() {
  linkUrlInput.value?.focus()
}

defineExpose({ focusInitialInput })

onMounted(() => {
  void nextTick(() => {
    focusInitialInput()
  })
})

// Keyboard containment relies on this Tab trap ALONE (aria-modal does not
// contain focus). EditorScreen removes the background from the accessibility
// tree with aria-hidden, but keeps it non-inert so confirm can temporarily
// focus the still-mounted editor for insertion.
function trapTabKey(event: KeyboardEvent) {
  const root = panel.value
  if (!root) {
    return
  }

  const focusables = Array.from(
    root.querySelectorAll<HTMLElement>('input:not(:disabled), button:not(:disabled)'),
  )
  if (focusables.length === 0) {
    event.preventDefault()
    return
  }

  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  const active = document.activeElement

  if (event.shiftKey) {
    if (active === first || active === root) {
      event.preventDefault()
      last.focus()
    }
    return
  }

  if (active === last) {
    event.preventDefault()
    first.focus()
  }
}
</script>

<template>
  <section
    class="draft-save-sheet"
    role="dialog"
    aria-modal="true"
    aria-labelledby="link-sheet-title"
    data-testid="link-insert-sheet"
    @keydown.esc="emit('cancel')"
    @keydown.tab="trapTabKey"
  >
    <form
      ref="panel"
      class="draft-save-panel link-insert-panel"
      @submit.prevent="emit('insert')"
    >
      <h2 id="link-sheet-title">{{ t('editor.link.title') }}</h2>
      <label class="link-field">
        <span>{{ t('editor.link.text') }}</span>
        <input
          v-model="textValue"
          type="text"
          autocomplete="off"
          autocapitalize="sentences"
          data-testid="link-text-input"
        >
      </label>
      <label class="link-field">
        <span>{{ t('editor.link.url') }}</span>
        <input
          ref="linkUrlInput"
          v-model="urlValue"
          type="text"
          inputmode="url"
          autocomplete="url"
          autocapitalize="none"
          spellcheck="false"
          data-testid="link-url-input"
        >
      </label>
      <div class="draft-save-actions">
        <button
          class="primary-action"
          type="submit"
          data-testid="link-insert-button"
          :disabled="!canInsert"
        >
          {{ t('editor.link.insert') }}
        </button>
        <button type="button" data-testid="link-cancel-button" @click="emit('cancel')">
          {{ t('editor.link.cancel') }}
        </button>
      </div>
    </form>
  </section>
</template>
