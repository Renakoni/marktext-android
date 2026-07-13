<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from '../../../lib/i18n'

defineProps<{
  incomingName: string
}>()

const emit = defineEmits<{
  keep: []
  discard: []
}>()

const { t } = useI18n()
const panel = ref<HTMLElement | null>(null)
const keepButton = ref<HTMLButtonElement | null>(null)
// Return focus to wherever it was (typically the editor) once the prompt closes.
let previouslyFocused: HTMLElement | null = null

onMounted(() => {
  previouslyFocused =
    document.activeElement instanceof HTMLElement ? document.activeElement : null
  // "Keep editing" is the safe default, so it takes focus on open.
  void nextTick(() => {
    keepButton.value?.focus()
  })
})

onBeforeUnmount(() => {
  if (previouslyFocused?.isConnected) {
    previouslyFocused.focus({ preventScroll: true })
  }
})

// aria-modal does not contain focus, so trap Tab within the two actions.
function trapTabKey(event: KeyboardEvent) {
  const root = panel.value
  if (!root) {
    return
  }

  const focusables = Array.from(root.querySelectorAll<HTMLElement>('button:not(:disabled)'))
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
    aria-labelledby="incoming-open-title"
    data-testid="incoming-open-prompt"
    @keydown.esc="emit('keep')"
    @keydown.tab="trapTabKey"
  >
    <div ref="panel" class="draft-save-panel">
      <h2 id="incoming-open-title">{{ t('editor.incomingOpen.title') }}</h2>
      <p>{{ t('editor.incomingOpen.body', { name: incomingName }) }}</p>
      <div class="draft-save-actions">
        <button
          ref="keepButton"
          class="primary-action"
          type="button"
          data-testid="prompt-keep-editing-button"
          @click="emit('keep')"
        >
          {{ t('editor.incomingOpen.keep') }}
        </button>
        <button
          class="danger-action"
          type="button"
          data-testid="prompt-discard-open-incoming-button"
          @click="emit('discard')"
        >
          {{ t('editor.incomingOpen.discard') }}
        </button>
      </div>
    </div>
  </section>
</template>
