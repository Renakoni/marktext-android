<script setup lang="ts">
import { useI18n } from '../../../lib/i18n'

defineProps<{
  canSaveToDevice: boolean
  saving: boolean
}>()

const emit = defineEmits<{
  'save-to-device': []
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
    aria-labelledby="draft-save-title"
    data-testid="draft-save-prompt"
  >
    <div class="draft-save-panel">
      <h2 id="draft-save-title">{{ t('editor.exit.localDraftTitle') }}</h2>
      <p>{{ t('editor.exit.localDraftBody') }}</p>
      <div class="draft-save-actions">
        <button
          v-if="canSaveToDevice"
          class="primary-action"
          type="button"
          data-testid="prompt-save-to-device-button"
          :disabled="saving"
          @click="emit('save-to-device')"
        >
          {{ t('editor.actions.saveToDevice') }}
        </button>
        <button
          type="button"
          data-testid="prompt-keep-draft-button"
          :disabled="saving"
          @click="emit('keep')"
        >
          {{ t('editor.exit.keepDraft') }}
        </button>
        <button
          class="danger-action"
          type="button"
          data-testid="prompt-discard-draft-button"
          :disabled="saving"
          @click="emit('discard')"
        >
          {{ t('editor.exit.discard') }}
        </button>
      </div>
    </div>
  </section>
</template>
