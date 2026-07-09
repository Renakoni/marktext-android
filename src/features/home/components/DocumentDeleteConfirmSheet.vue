<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from '../../../lib/i18n'

const props = defineProps<{
  count: number
  draftCount: number
  androidDocumentCount: number
}>()

const emit = defineEmits<{
  cancel: []
  confirm: []
}>()

const { t } = useI18n()
const sheet = ref<HTMLElement | null>(null)
const cancelButton = ref<HTMLButtonElement | null>(null)
let restoreFocusTo: HTMLElement | null = null

const bodyText = computed(() => {
  if (props.draftCount > 0 && props.androidDocumentCount > 0) {
    return t('home.delete.mixed')
  }

  return props.draftCount > 0 ? t('home.delete.drafts') : t('home.delete.androidDocuments')
})

function cancel() {
  emit('cancel')
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    cancel()
    return
  }

  if (event.key !== 'Tab') {
    return
  }

  const focusable = [...(sheet.value?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? [])]
  const first = focusable[0]
  const last = focusable.at(-1)
  if (!first || !last) {
    return
  }

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

onMounted(() => {
  restoreFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null
  void nextTick(() => cancelButton.value?.focus())
})

onBeforeUnmount(() => {
  restoreFocusTo?.focus()
})
</script>

<template>
  <section
    ref="sheet"
    class="draft-save-sheet"
    role="dialog"
    aria-modal="true"
    aria-labelledby="home-delete-title"
    data-testid="home-delete-sheet"
    @click.self="cancel"
    @keydown="onKeydown"
  >
    <div class="draft-save-panel">
      <h2 id="home-delete-title">
        {{
          count === 1
            ? t('home.delete.title.one')
            : t('home.delete.title.other', { count })
        }}
      </h2>
      <p>{{ bodyText }}</p>
      <div class="draft-save-actions">
        <button
          class="danger-action"
          type="button"
          data-testid="home-delete-confirm"
          @click="emit('confirm')"
        >
          {{ t('home.delete.confirm') }}
        </button>
        <button
          ref="cancelButton"
          type="button"
          data-testid="home-delete-cancel"
          @click="cancel"
        >
          {{ t('editor.link.cancel') }}
        </button>
      </div>
    </div>
  </section>
</template>
