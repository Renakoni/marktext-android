<script setup lang="ts">
import { useI18n } from '../../../lib/i18n'

defineProps<{
  incomingName: string
}>()

const emit = defineEmits<{
  keep: []
  discard: []
}>()

const { t } = useI18n()
</script>

<template>
  <section
    class="draft-save-sheet"
    role="dialog"
    aria-modal="true"
    aria-labelledby="incoming-open-title"
    data-testid="incoming-open-prompt"
  >
    <div class="draft-save-panel">
      <h2 id="incoming-open-title">{{ t('editor.incomingOpen.title') }}</h2>
      <p>{{ t('editor.incomingOpen.body', { name: incomingName }) }}</p>
      <div class="draft-save-actions">
        <button
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
