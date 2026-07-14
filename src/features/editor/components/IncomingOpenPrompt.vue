<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from '../../../lib/i18n'
import { useModalFocus } from '../../../lib/modalFocus'

defineProps<{
  incomingName: string
}>()

const emit = defineEmits<{
  keep: []
  discard: []
}>()

const { t } = useI18n()
const modalRoot = ref<HTMLElement | null>(null)
const keepButton = ref<HTMLButtonElement | null>(null)
const { onModalKeydown } = useModalFocus({
  root: modalRoot,
  initialFocus: () => keepButton.value,
  onEscape: () => emit('keep'),
})
</script>

<template>
  <section
    ref="modalRoot"
    class="draft-save-sheet"
    role="dialog"
    aria-modal="true"
    aria-labelledby="incoming-open-title"
    tabindex="-1"
    data-testid="incoming-open-prompt"
    @keydown="onModalKeydown"
  >
    <div class="draft-save-panel">
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
