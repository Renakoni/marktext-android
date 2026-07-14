<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from '../../../lib/i18n'
import { useModalFocus } from '../../../lib/modalFocus'

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

const bodyText = computed(() => {
  if (props.draftCount > 0 && props.androidDocumentCount > 0) {
    return t('home.delete.mixed')
  }

  return props.draftCount > 0 ? t('home.delete.drafts') : t('home.delete.androidDocuments')
})

function cancel() {
  emit('cancel')
}

const { onModalKeydown } = useModalFocus({
  root: sheet,
  initialFocus: () => cancelButton.value,
  onEscape: cancel,
})
</script>

<template>
  <section
    ref="sheet"
    class="draft-save-sheet"
    role="dialog"
    aria-modal="true"
    aria-labelledby="home-delete-title"
    tabindex="-1"
    data-testid="home-delete-sheet"
    @click.self="cancel"
    @keydown="onModalKeydown"
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
